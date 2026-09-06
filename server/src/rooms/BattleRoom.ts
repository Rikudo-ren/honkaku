import { Client, Room } from "@colyseus/core";
import { InputRelay } from "./InputRelay";

/** 合言葉コードに使う文字（紛らわしい 0/O/1/I は除外） */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const STAGES = ["classroom", "lake", "sakura", "hawaii"] as const;
const CHAR_IDS = ["mie", "ryoma", "naito", "mitsumine", "terachi", "rei", "sakura", "kakusei"] as const;
const DIFFICULTIES = ["easy", "normal", "hard", "extreme"] as const;

/** チーム戦ルームの上限（人間＋AIの合計ファイター数） */
const MAX_FIGHTERS = 8;
/** 1部屋に入れる最大人数 */
const MAX_HUMANS = 8;
const BASE_INPUT_DELAY = 5;
const MAX_INPUT_DELAY = 10;

/** 入力監視ティック間隔(ms) */
const INPUT_TICK_MS = 50;

/** プレイヤー名の最大文字数（HUDやロビーの表示崩れ防止） */
const MAX_NAME = 12;
/** 名前を設定していない人の表示名 */
const DEFAULT_NAME = "名無しの本質";

/** 表示に使えない制御文字を落とし、長さを制限する */
function sanitizeName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_NAME);
}

interface PlayerInfo {
  team: 0 | 1;
  char: string | null;
  ready: boolean;
  host: boolean;
  /** プレイヤーが自分で決めた表示名 */
  name: string;
}

interface AiSlot {
  team: 0 | 1;
  char: string;
  difficulty: string;
}

interface FighterSlot {
  char: string | null;
  team: 0 | 1;
  sessionId: string | null;
  aiDifficulty: string;
}

function calcInputDelay(humanCount: number): number {
  const extra = Math.max(0, humanCount - 2) + (humanCount >= 4 ? 1 : 0);
  return Math.min(MAX_INPUT_DELAY, BASE_INPUT_DELAY + extra);
}

/**
 * ✝本質✝ FIGHTERS 対戦ルーム
 *
 * サーバーは「マッチメイキング＋入力リレー」に徹する。
 * ゲームロジックは全クライアントが同じシードで決定論的に実行する
 * （ディレイ方式ロックステップ）。
 *
 * 2種類の部屋：
 *  - 公開クイック部屋（1対1）：2人揃って両者 ready で自動開始
 *  - プライベート部屋（チーム戦・最大8人＋AI）：ホストがチーム分け・AI追加・開始を操作
 *
 * メッセージ:
 *  - "hello"            クライアント → 接続後の挨拶。welcome / lobby を返す
 *  - "name"   (string)  プレイヤー名の変更（試合中は不可・同名なら連番を付与）
 *  - "chara"  (id)      キャラクター選択
 *  - "ready"  (bool)    準備完了トグル
 *  - "team"   [id,team] [ホスト専用] プレイヤーのチーム変更
 *  - "ai-add" (ai)      [ホスト専用] AI追加 {team,char,difficulty}
 *  - "ai-set" ({index,..}) [ホスト専用] AI設定変更
 *  - "ai-del" (index)   [ホスト専用] AI削除
 *  - "start-game"       [ホスト専用] 試合開始（チーム戦ルーム）
 *  - "i"      [matchId,f,s,mask] 入力リレー
 *  - "h"      [matchId,f,hash]   同期チェック用ハッシュ
 *  - "ping"   (t)       レイテンシ計測。"pong" で返す
 *  - "end"    (matchId) 試合終了通知（再戦を可能にする）
 */
export class BattleRoom extends Room {
  maxClients = 8;

  private players = new Map<string, PlayerInfo>();
  private aiSlots: AiSlot[] = [];
  private isPrivate = false;
  private teamMode = false;
  private started = false;
  /** 試合中の入力スロット所有者。クライアント入力のなりすまし防止に使う。 */
  private lastFighters: FighterSlot[] = [];
  private currentMatchId = 0;
  private inputRelay: InputRelay | null = null;

  onCreate(options: { private?: boolean } = {}) {
    this.isPrivate = !!options?.private;

    // 入力タイムアウトを監視するティック（誰かの入力が遅れたらニュートラルで補完）
    this.setSimulationInterval(() => this.inputRelay?.tick(performance.now()), INPUT_TICK_MS);
    this.teamMode = this.isPrivate;
    this.maxClients = this.teamMode ? MAX_HUMANS : 2;
    if (this.isPrivate) {
      // 合言葉（カスタム roomId）を生成して友達対戦に使う
      let code = "";
      for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      this.roomId = code;
      this.setPrivate(true);
    }

    this.onMessage("hello", (client) => {
      const p = this.players.get(client.sessionId);
      if (!p) return;
      client.send("welcome", { side: p.team, code: this.roomId, private: this.isPrivate });
      this.broadcastLobby();
    });

    // プレイヤー名の変更（ロビーにいる間はいつでもOK。試合中は不可）
    this.onMessage("name", (client, raw: string) => {
      const p = this.players.get(client.sessionId);
      if (!p || this.started) return;
      const next = sanitizeName(raw);
      if (!next) return;
      p.name = this.uniqueName(next, client.sessionId);
      this.broadcastLobby();
    });

    this.onMessage("chara", (client, id: string) => {
      const p = this.players.get(client.sessionId);
      if (!p || this.started) return;
      if (!CHAR_IDS.includes(id as (typeof CHAR_IDS)[number])) return;
      if (p.ready) return; // ready 後は変更不可
      p.char = id;
      this.broadcastLobby();
    });

    this.onMessage("ready", (client, ready: boolean) => {
      const p = this.players.get(client.sessionId);
      if (!p || this.started) return;
      p.ready = !!ready && !!p.char;
      this.broadcastLobby();
      if (!this.teamMode) this.tryStartQuick();
    });

    // ── チーム戦ルーム専用：ホスト操作 ──
    this.onMessage("team", (client, data: [string, 0 | 1]) => {
      if (!this.teamMode || this.started) return;
      const me = this.players.get(client.sessionId);
      if (!me?.host) return;
      const [targetId, team] = data ?? [];
      const tgt = this.players.get(targetId);
      if (!tgt || (team !== 0 && team !== 1)) return;
      tgt.team = team;
      tgt.ready = false; // チーム変更されたら再ready
      this.broadcastLobby();
    });

    this.onMessage("ai-add", (client, data: AiSlot) => {
      if (!this.teamMode || this.started) return;
      const me = this.players.get(client.sessionId);
      if (!me?.host) return;
      if (this.players.size + this.aiSlots.length >= MAX_FIGHTERS) return;
      const team = data?.team === 1 ? 1 : 0;
      const char = CHAR_IDS.includes(data?.char as (typeof CHAR_IDS)[number]) ? data.char : "mie";
      const difficulty = DIFFICULTIES.includes(data?.difficulty as (typeof DIFFICULTIES)[number]) ? data.difficulty : "normal";
      this.aiSlots.push({ team, char, difficulty });
      this.broadcastLobby();
    });

    this.onMessage("ai-set", (client, data: { index: number } & Partial<AiSlot>) => {
      if (!this.teamMode || this.started) return;
      const me = this.players.get(client.sessionId);
      if (!me?.host) return;
      const slot = this.aiSlots[data?.index];
      if (!slot) return;
      if (data.team === 0 || data.team === 1) slot.team = data.team;
      if (data.char && CHAR_IDS.includes(data.char as (typeof CHAR_IDS)[number])) slot.char = data.char;
      if (data.difficulty && DIFFICULTIES.includes(data.difficulty as (typeof DIFFICULTIES)[number])) slot.difficulty = data.difficulty;
      this.broadcastLobby();
    });

    this.onMessage("ai-del", (client, index: number) => {
      if (!this.teamMode || this.started) return;
      const me = this.players.get(client.sessionId);
      if (!me?.host) return;
      if (typeof index !== "number" || index < 0 || index >= this.aiSlots.length) return;
      this.aiSlots.splice(index, 1);
      this.broadcastLobby();
    });

    this.onMessage("start-game", (client) => {
      if (!this.teamMode) return;
      const me = this.players.get(client.sessionId);
      if (!me?.host) return;
      this.tryStartTeam();
    });

    // ロックステップ入力（[matchId, frame, slot, bitmask]）
    // 送信元も含めた全員にブロードキャストする。全クライアントがサーバーを通った
    // 単一の正規入力ストリームでシミュレーションすることで決定論が保証される
    // （タイムアウト時にサーバーが補完した入力を自スロットへ後から上書きされないためにも必要）。
    this.onMessage("i", (client, data) => {
      if (!this.started || !Array.isArray(data) || data.length !== 4) return;
      const [matchId, frame, slot, mask] = data;
      if (matchId !== this.currentMatchId) return;
      if (!Number.isInteger(frame) || frame < 0 || !Number.isInteger(slot) || slot < 0 || slot >= this.lastFighters.length || !Number.isInteger(mask) || mask < 0 || mask > 0xff) return;
      if (this.lastFighters[slot]?.sessionId !== client.sessionId) return;
      this.inputRelay?.receive(frame, slot, mask, performance.now());
    });

    // 同期チェック用ハッシュ（[matchId, frame, hash]）を他の全員へリレー
    this.onMessage("h", (client, data) => {
      if (!this.started || !Array.isArray(data) || data.length !== 3) return;
      const [matchId, frame, hash] = data;
      if (matchId !== this.currentMatchId) return;
      if (!Number.isInteger(frame) || frame < 0 || !Number.isInteger(hash)) return;
      if (!this.isActiveParticipant(client.sessionId)) return;
      this.relay(client, "h", [matchId, frame, hash]);
    });

    this.onMessage("ping", (client, t) => client.send("pong", t));

    this.onMessage("end", (client, matchId: number) => {
      if (!this.started) return;
      if (matchId !== this.currentMatchId) return;
      if (!this.isActiveParticipant(client.sessionId)) return;
      this.finishMatch();
    });
  }

  onJoin(client: Client, options: { name?: unknown } = {}) {
    // チームは人数の少ない方へ自動配属（ホストが後から変更可）
    let count0 = 0;
    let count1 = 0;
    for (const p of this.players.values()) (p.team === 0 ? count0++ : count1++);
    const team: 0 | 1 = count0 <= count1 ? 0 : 1;
    const host = this.players.size === 0;
    // 参加オプションで名前が渡されたら採用（未設定/不正ならデフォルト名）
    const requested = sanitizeName((options as { name?: unknown } | undefined)?.name) || DEFAULT_NAME;
    this.players.set(client.sessionId, { team, char: null, ready: false, host, name: this.uniqueName(requested, client.sessionId) });
    if (!this.teamMode && this.clients.length >= 2) this.lock();
  }

  /** 同名プレイヤーがいたら末尾に連番を付けて被りを避ける */
  private uniqueName(desired: string, selfId: string): string {
    const taken = (n: string) => [...this.players.entries()].some(([id, p]) => id !== selfId && p.name === n);
    if (!taken(desired)) return desired;
    for (let i = 2; i < 100; i++) {
      const suffix = String(i);
      const candidate = `${desired.slice(0, Math.max(1, MAX_NAME - suffix.length))}${suffix}`;
      if (!taken(candidate)) return candidate;
    }
    return desired;
  }

  onLeave(client: Client) {
    const wasHost = this.players.get(client.sessionId)?.host;
    const wasActiveParticipant = this.isActiveParticipant(client.sessionId);
    this.players.delete(client.sessionId);
    if (wasActiveParticipant) {
      this.started = false;
      this.lastFighters = [];
      this.inputRelay = null;
      this.broadcast("lag", []);
      if (this.teamMode) this.unlock();
    }
    // ホストが抜けたら次に入った人にホスト権を移譲
    if (wasHost) {
      const next = this.players.values().next().value as PlayerInfo | undefined;
      if (next) next.host = true;
    }
    // 残ったプレイヤーの ready を解除して、次の相手を待てる状態に戻す
    for (const p of this.players.values()) p.ready = false;
    this.broadcast("opponent-left");
    this.broadcastLobby();
    // 公開部屋なら再びマッチング対象に戻す
    if (!this.teamMode && this.clients.length < 2) this.unlock();
  }

  private relay(sender: Client, type: string, data: unknown) {
    for (const c of this.clients) {
      if (c.sessionId !== sender.sessionId) c.send(type, data);
    }
  }

  private broadcastLobby() {
    this.broadcast("lobby", {
      code: this.roomId,
      private: this.isPrivate,
      teamMode: this.teamMode,
      maxHumans: this.teamMode ? MAX_HUMANS : 2,
      players: [...this.players.entries()].map(([id, p]) => ({ id, team: p.team, char: p.char, ready: p.ready, host: p.host, name: p.name })),
      ai: this.aiSlots.map((a) => ({ team: a.team, char: a.char, difficulty: a.difficulty })),
    });
  }

  /** 1対1クイック：両者 ready で自動開始 */
  private tryStartQuick() {
    if (this.started || this.players.size < 2) return;
    const list = [...this.players.entries()];
    if (!list.every(([, p]) => p.ready && p.char)) return;
    this.started = true;
    this.currentMatchId += 1;
    for (const [, p] of list) p.ready = false;
    // team 順に並べてスロット0=青、スロット1=赤に
    list.sort((a, b) => a[1].team - b[1].team);
    const fighters = list.map(([sessionId, p]) => ({
      char: p.char,
      team: p.team,
      sessionId,
      aiDifficulty: "normal",
      name: p.name,
    }));
    this.lastFighters = fighters;
    this.initInputs(BASE_INPUT_DELAY);
    this.lock();
    this.broadcast("start", {
      matchId: this.currentMatchId,
      inputDelay: BASE_INPUT_DELAY,
      seed: Math.floor(Math.random() * 0xffffffff) >>> 0,
      stage: STAGES[Math.floor(Math.random() * STAGES.length)],
      fighters,
    });
  }

  /** チーム戦：ホストの開始操作で開始。条件チェック付き */
  private tryStartTeam() {
    if (this.started) return;
    const humans = [...this.players.entries()];
    const total = humans.length + this.aiSlots.length;
    if (humans.length < 1 || total < 2) return;
    // 全員キャラ選択済み＆（ホスト以外は）ready済み
    for (const [, p] of humans) {
      if (!p.char) return;
      if (!p.host && !p.ready) return;
    }
    // 両チームに1人以上
    const teams = new Set<number>();
    for (const [, p] of humans) teams.add(p.team);
    for (const a of this.aiSlots) teams.add(a.team);
    if (teams.size < 2) return;

    this.started = true;
    this.currentMatchId += 1;
    for (const [, p] of humans) p.ready = false;
    // スロット順：人間（入室順）→ AI（追加順）。チームでソートはしない
    // （mySlot は sessionId 照合で各クライアントが求める）
    const fighters = [
      ...humans.map(([sessionId, p]) => ({ char: p.char, team: p.team, sessionId, aiDifficulty: "normal", name: p.name })),
      ...this.aiSlots.map((a) => ({ char: a.char, team: a.team, sessionId: null, aiDifficulty: a.difficulty, name: null })),
    ];
    const inputDelay = calcInputDelay(humans.length);
    this.lastFighters = fighters;
    this.initInputs(inputDelay);
    this.lock();
    this.broadcast("start", {
      matchId: this.currentMatchId,
      inputDelay,
      seed: Math.floor(Math.random() * 0xffffffff) >>> 0,
      stage: STAGES[Math.floor(Math.random() * STAGES.length)],
      fighters,
    });
  }

  private isActiveParticipant(sessionId: string): boolean {
    return this.lastFighters.some((fighter) => fighter.sessionId === sessionId);
  }

  private finishMatch() {
    this.started = false;
    this.lastFighters = [];
    this.inputRelay = null;
    this.broadcast("lag", []);
    if (this.teamMode) this.unlock();
    this.broadcastLobby();
  }

  private initInputs(inputDelay: number) {
    const humanSlots = this.lastFighters.flatMap((f, slot) => f.sessionId === null ? [] : [slot]);
    this.inputRelay = new InputRelay(
      humanSlots,
      inputDelay,
      (frame, slot, mask) => this.broadcast("i", [this.currentMatchId, frame, slot, mask]),
      (slots) => this.broadcast("lag", slots),
    );
  }
}
