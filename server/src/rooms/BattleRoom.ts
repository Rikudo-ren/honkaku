import { Room, Client } from "@colyseus/core";

/** 合言葉コードに使う文字（紛らわしい 0/O/1/I は除外） */
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const STAGES = ["classroom", "lake", "sakura", "hawaii"] as const;
const CHAR_IDS = ["mie", "ryoma", "naito", "mitsumine", "terachi", "rei"];

interface PlayerInfo {
  side: 0 | 1;
  char: string | null;
  ready: boolean;
}

/**
 * ✝本質✝ FIGHTERS 対戦ルーム
 *
 * サーバーは「マッチメイキング＋入力リレー」に徹する。
 * ゲームロジックは両クライアントが同じシードで決定論的に実行する
 * （ディレイ方式ロックステップ）。
 *
 * メッセージ:
 *  - "hello"            クライアント → 接続後の挨拶。welcome / lobby を返す
 *  - "chara"  (id)      キャラクター選択
 *  - "ready"  (bool)    準備完了トグル。両者 ready で "start" を配信
 *  - "i"      [f, mask] フレーム入力。相手にそのままリレー
 *  - "h"      [f, hash] 同期チェック用ハッシュ。相手にリレー
 *  - "ping"   (t)       レイテンシ計測。"pong" で返す
 *  - "end"              試合終了通知（再戦を可能にする）
 */
export class BattleRoom extends Room {
  maxClients = 2;

  private players = new Map<string, PlayerInfo>();
  private isPrivate = false;
  private started = false;

  onCreate(options: { private?: boolean } = {}) {
    this.isPrivate = !!options?.private;
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
      client.send("welcome", { side: p.side, code: this.roomId, private: this.isPrivate });
      this.broadcastLobby();
    });

    this.onMessage("chara", (client, id: string) => {
      const p = this.players.get(client.sessionId);
      if (!p || this.started) return;
      if (!CHAR_IDS.includes(id)) return;
      if (p.ready) return; // ready 後は変更不可
      p.char = id;
      this.broadcastLobby();
    });

    this.onMessage("ready", (client, ready: boolean) => {
      const p = this.players.get(client.sessionId);
      if (!p) return;
      p.ready = !!ready && !!p.char;
      if (!ready) this.started = false; // 再戦のためのリセット
      this.broadcastLobby();
      this.tryStart();
    });

    // ロックステップ入力（[frame, bitmask]）を相手へリレー
    this.onMessage("i", (client, data) => this.relay(client, "i", data));
    // 同期チェック用ハッシュ（[frame, hash]）を相手へリレー
    this.onMessage("h", (client, data) => this.relay(client, "h", data));

    this.onMessage("ping", (client, t) => client.send("pong", t));
    this.onMessage("end", () => {
      this.started = false;
    });
  }

  onJoin(client: Client) {
    const used = new Set([...this.players.values()].map((p) => p.side));
    const side: 0 | 1 = used.has(0) ? 1 : 0;
    this.players.set(client.sessionId, { side, char: null, ready: false });
    if (this.clients.length >= 2) this.lock();
  }

  onLeave(client: Client) {
    this.players.delete(client.sessionId);
    this.started = false;
    // 残ったプレイヤーの ready を解除して、次の相手を待てる状態に戻す
    for (const p of this.players.values()) p.ready = false;
    this.broadcast("opponent-left");
    this.broadcastLobby();
    // 公開部屋なら再びマッチング対象に戻す
    if (this.clients.length < 2) this.unlock();
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
      players: [...this.players.values()].map((p) => ({ side: p.side, char: p.char, ready: p.ready })),
    });
  }

  private tryStart() {
    if (this.started || this.players.size < 2) return;
    const list = [...this.players.values()];
    if (!list.every((p) => p.ready && p.char)) return;
    this.started = true;
    for (const p of list) p.ready = false;
    const p0 = list.find((p) => p.side === 0)!;
    const p1 = list.find((p) => p.side === 1)!;
    this.broadcast("start", {
      seed: Math.floor(Math.random() * 0xffffffff) >>> 0,
      stage: STAGES[Math.floor(Math.random() * STAGES.length)],
      chars: [p0.char, p1.char],
    });
  }
}
