import { Client, Room } from 'colyseus.js';
import { EMPTY_INPUT } from './types';
import type { CharId, Difficulty, InputState, Side, StageId, Team } from './types';

/** ─────────────────────────────────────────────
 *  オンライン対戦ネットワーク層（Colyseus クライアント）
 *
 *  方式：ディレイ方式ロックステップ
 *   - サーバーは「マッチメイキング＋入力リレー」のみ
 *   - 全クライアントが同じシードで Battle を決定論的に実行
 *   - 各フレームの入力(8bitマスク)を全員で送り合う
 *   - 1対1クイックマッチ＋多人数チーム戦（同時乱戦）対応
 *  ───────────────────────────────────────────── */

export interface LobbyPlayer {
  /** サーバー発行のセッションID */
  id: string;
  team: Team;
  char: CharId | null;
  ready: boolean;
  host: boolean;
  /** プレイヤーが決めた表示名 */
  name: string;
}

export interface LobbyAi {
  team: Team;
  char: CharId;
  difficulty: Difficulty;
}

export interface LobbyInfo {
  code: string;
  private: boolean;
  /** true=チーム戦ルーム（ホスト開始式）、false=1対1クイック（両者readyで自動開始） */
  teamMode: boolean;
  maxHumans: number;
  players: LobbyPlayer[];
  ai: LobbyAi[];
}

/** 試合開始時にサーバーから配られるファイター1人分 */
export interface StartFighter {
  char: CharId;
  team: Team;
  /** 人間が操作するスロットならそのセッションID、AIなら null */
  sessionId: string | null;
  aiDifficulty: Difficulty;
  /** 人間のプレイヤー名（AIは null） */
  name: string | null;
}

/** プレイヤー名の最大文字数（サーバー側 BattleRoom と同じ値） */
export const MAX_NAME = 12;
/** 名前を設定していない人の表示名 */
export const DEFAULT_NAME = '名無しの本質';
const NAME_KEY = 'honkaku_player_name';

/** 表示に使えない制御文字を落とし、長さを制限する（サーバー側と同じ基準） */
export function sanitizeName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
}

/** 保存済みのプレイヤー名を読み出す */
function loadName(): string {
  try {
    return sanitizeName(localStorage.getItem(NAME_KEY) ?? '');
  } catch {
    return '';
  }
}

export interface StartData {
  matchId: number;
  inputDelay: number;
  seed: number;
  stage: StageId;
  fighters: StartFighter[];
}

type NetEvent = 'lobby' | 'start' | 'opponent-left' | 'error' | 'ping' | 'desync';

/** InputState → 8bit マスク */
const KEYS: (keyof InputState)[] = ['left', 'right', 'up', 'down', 'light', 'heavy', 'special', 'super'];
const HASH_WINDOW = 120;

export function maskOf(s: InputState): number {
  let m = 0;
  for (let i = 0; i < 8; i++) if (s[KEYS[i]]) m |= 1 << i;
  return m;
}

export function unmask(m: number): InputState {
  const s: InputState = { ...EMPTY_INPUT };
  for (let i = 0; i < 8; i++) if (m & (1 << i)) s[KEYS[i]] = true;
  return s;
}

/** 接続先エンドポイントの決定 */
function resolveEndpoint(): string {
  const fromEnv = import.meta.env.VITE_COLYSEUS_URL as string | undefined;
  if (fromEnv) return fromEnv;
  const h = window.location.hostname;
  if (h === 'localhost' || h === '127.0.0.1') return 'ws://localhost:2567';
  // サンドボックス/プレビュー環境（{port}-{id}.e2b.app）ではポート差し替えで推測
  const m = h.match(/^\d+-(.+\.e2b\.app)$/);
  if (m) return `wss://2567-${m[1]}`;
  // 本番は VITE_COLYSEUS_URL を必ず設定すること
  return 'ws://localhost:2567';
}

class NetClient {
  private client: Client | null = null;
  private room: Room | null = null;
  private listeners = new Map<NetEvent, Set<(data?: unknown) => void>>();

  /** 自分のサイド（1対1用。チーム戦では mySlot を使う） */
  side: Side = 0;
  /** 現在のロビー情報 */
  lobby: LobbyInfo | null = null;
  /** 試合開始データ（"start" 受信時にセット） */
  startData: StartData | null = null;
  /** 直近の計測レイテンシ(ms) */
  latency = -1;
  /** 自分のプレイヤー名（ロビー・対戦中の表示に使う。ブラウザに保存される） */
  name = loadName();

  /** 他プレイヤーの入力バッファ frame → (slot → mask) */
  private remote = new Map<number, Map<number, number>>();
  /** 相手から届いた同期ハッシュ frame → hash */
  private remoteHash = new Map<number, number>();
  /** 自分が計算した同期ハッシュ frame → hash */
  private localHash = new Map<number, number>();
  private pingTimer: number | null = null;

  get connected() {
    return !!this.room;
  }

  get roomCode() {
    return this.room?.roomId ?? null;
  }

  /** 自分のセッションID（StartData.fighters[].sessionId と照合して mySlot を求める） */
  get sessionId(): string | null {
    return this.room?.sessionId ?? null;
  }

  /** 自分のロビー情報（チーム戦用） */
  get me(): LobbyPlayer | null {
    if (!this.lobby || !this.sessionId) return null;
    return this.lobby.players.find((p) => p.id === this.sessionId) ?? null;
  }

  get isHost(): boolean {
    return this.me?.host ?? false;
  }

  on(ev: NetEvent, fn: (data?: unknown) => void): () => void {
    if (!this.listeners.has(ev)) this.listeners.set(ev, new Set());
    this.listeners.get(ev)!.add(fn);
    return () => this.listeners.get(ev)?.delete(fn);
  }

  private emit(ev: NetEvent, data?: unknown) {
    this.listeners.get(ev)?.forEach((fn) => fn(data));
  }

  /** クイックマッチ（1対1。空いてる公開部屋に入る／なければ作る） */
  async quickMatch() {
    await this.join((c) => c.joinOrCreate('battle', { name: this.name }));
  }

  /** 合言葉付きプライベート部屋を作る（チーム戦対応・最大8人） */
  async createPrivate() {
    await this.join((c) => c.create('battle', { private: true, name: this.name }));
  }

  /** 合言葉で部屋に入る */
  async joinByCode(code: string) {
    await this.join((c) => c.joinById(code.trim().toUpperCase(), { name: this.name }));
  }

  /**
   * 自分のプレイヤー名を変更する。
   * ブラウザに保存されるので次回以降も自動で使われる。
   * 入室中ならサーバーにも通知してロビー表示を更新する（試合中はサーバー側で無視される）。
   * @returns 整形後の名前
   */
  setName(raw: string): string {
    const next = sanitizeName(raw);
    this.name = next;
    try {
      localStorage.setItem(NAME_KEY, next);
    } catch {
      /* localStorage が使えない環境では保存しない */
    }
    this.room?.send('name', next);
    return next;
  }

  private async join(fn: (c: Client) => Promise<Room>) {
    this.leave();
    this.client = new Client(resolveEndpoint());
    const room = await fn(this.client);
    this.room = room;

    room.onMessage('welcome', (d: { side: Side }) => {
      this.side = d.side;
    });
    room.onMessage('lobby', (d: LobbyInfo) => {
      this.lobby = d;
      this.emit('lobby', d);
    });
    room.onMessage('start', (d: StartData) => {
      this.startData = d;
      this.remote.clear();
      this.remoteHash.clear();
      this.localHash.clear();
      this.emit('start', d);
    });
    room.onMessage('i', (d: [number, number, number, number]) => {
      // [matchId, frame, slot, mask]
      if (!this.startData || d[0] !== this.startData.matchId) return;
      const frame = d[1];
      const slot = d[2];
      const mask = d[3];
      let row = this.remote.get(frame);
      if (!row) {
        row = new Map<number, number>();
        this.remote.set(frame, row);
      }
      row.set(slot, mask);
    });
    room.onMessage('h', (d: [number, number, number]) => {
      // [matchId, frame, hash]
      if (!this.startData || d[0] !== this.startData.matchId) return;
      const frame = d[1];
      const hash = d[2];
      this.remoteHash.set(frame, hash);
      this.trimHashMap(this.remoteHash, frame - HASH_WINDOW);
      const mine = this.localHash.get(frame);
      if (mine !== undefined && mine !== hash) this.emit('desync');
    });
    room.onMessage('pong', (t: number) => {
      this.latency = Math.round(performance.now() - t);
      this.emit('ping', this.latency);
    });
    room.onMessage('opponent-left', () => {
      this.emit('opponent-left');
    });
    room.onError((_code, message) => this.emit('error', message ?? '通信エラー'));
    room.onLeave(() => {
      this.room = null;
      this.client = null;
      this.stopPing();
    });

    room.send('hello');
    this.startPing();
  }

  private startPing() {
    this.stopPing();
    const tick = () => {
      this.room?.send('ping', performance.now());
    };
    tick();
    this.pingTimer = window.setInterval(tick, 2000);
  }

  private stopPing() {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private trimHashMap(map: Map<number, number>, minFrame: number) {
    for (const frame of map.keys()) {
      if (frame < minFrame) map.delete(frame);
    }
  }

  /** ロビー情報の再送をサーバーに要求（再戦でロビーへ戻った時など） */
  refreshLobby() {
    this.room?.send('hello');
  }

  /** キャラクター選択をサーバーに通知 */
  setChara(id: CharId) {
    this.room?.send('chara', id);
  }

  /** 準備完了トグル */
  setReady(ready: boolean) {
    this.room?.send('ready', ready);
  }

  /** [ホスト専用] プレイヤーのチームを変更 */
  setTeam(playerId: string, team: Team) {
    this.room?.send('team', [playerId, team]);
  }

  /** [ホスト専用] AIを追加 */
  addAi(ai: LobbyAi) {
    this.room?.send('ai-add', ai);
  }

  /** [ホスト専用] AIの設定を変更 */
  updateAi(index: number, patch: Partial<LobbyAi>) {
    this.room?.send('ai-set', { index, ...patch });
  }

  /** [ホスト専用] AIを削除 */
  removeAi(index: number) {
    this.room?.send('ai-del', index);
  }

  /** [ホスト専用] 試合開始（チーム戦ルーム） */
  startGame() {
    this.room?.send('start-game');
  }

  /** フレーム入力を送信（slot=自分のファイター番号） */
  sendInput(frame: number, slot: number, mask: number) {
    const matchId = this.startData?.matchId;
    if (matchId === undefined) return;
    this.room?.send('i', [matchId, frame, slot, mask]);
  }

  /** 他プレイヤーのフレーム入力を取得（未着なら undefined） */
  remoteInput(frame: number, slot: number): number | undefined {
    return this.remote.get(frame)?.get(slot);
  }

  /** 実行済みフレームの受信バッファを掃除 */
  discardConsumedFrame(frame: number) {
    this.remote.delete(frame);
    const minFrame = frame - HASH_WINDOW;
    this.trimHashMap(this.remoteHash, minFrame);
    this.trimHashMap(this.localHash, minFrame);
    for (const key of this.remote.keys()) {
      if (key < minFrame) this.remote.delete(key);
    }
  }

  /** 同期チェック：ハッシュ送信と比較 */
  sendHash(frame: number, hash: number) {
    const matchId = this.startData?.matchId;
    if (matchId === undefined) return;
    this.localHash.set(frame, hash);
    this.trimHashMap(this.localHash, frame - HASH_WINDOW);
    this.room?.send('h', [matchId, frame, hash]);
    // 過去に受け取った相手ハッシュと比較
    const other = this.remoteHash.get(frame);
    if (other !== undefined && other !== hash) this.emit('desync');
  }

  /** 試合終了をサーバーに通知（再戦を可能にする） */
  sendEnd() {
    const matchId = this.startData?.matchId;
    if (matchId === undefined) return;
    this.room?.send('end', matchId);
  }

  /** 退室 */
  leave() {
    this.stopPing();
    try {
      this.room?.leave();
    } catch {
      /* ignore */
    }
    this.client = null;
    this.room = null;
    this.lobby = null;
    this.startData = null;
    this.remote.clear();
    this.remoteHash.clear();
    this.localHash.clear();
  }
}

export const net = new NetClient();
