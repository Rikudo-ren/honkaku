/** 最初に届いた入力から、同じフレームの他の入力を待つ猶予。 */
export const INPUT_GRACE_MS = 250;
/** クライアントが要求できる先行フレーム数の上限（巨大な欠番やバッファ確保を防ぐ）。 */
export const MAX_PENDING_FRAMES = 120;

interface PendingFrame {
  since: number;
  inputs: Map<number, number>;
}

/**
 * 入力が実際に要求されたフレームだけを監視する、正規入力のリレー。
 *
 * 実時間 × 60 を基準に補完すると、描画落ちや入力待ちで遅れたクライアントの
 * 未来の操作まで 0 で確定し、以後の操作が永久に捨てられる。時計でフレームを
 * 作らず、最初の実入力からの待ち時間をフレームごとに測る。
 */
export class InputRelay {
  private pending = new Map<number, PendingFrame>();
  private ready = new Set<number>();
  private lastReceivedAt = new Map<number, number>();
  private lagging = new Set<number>();
  private lagSignature = '';
  private nextFrame: number;
  private highestFrame: number;

  constructor(
    private readonly humanSlots: readonly number[],
    private readonly firstFrame: number,
    private readonly broadcastInput: (frame: number, slot: number, mask: number) => void,
    private readonly broadcastLag: (slots: number[]) => void,
  ) {
    this.nextFrame = firstFrame;
    this.highestFrame = firstFrame - 1;
  }

  receive(frame: number, slot: number, mask: number, now: number): boolean {
    if (!Number.isSafeInteger(frame) || frame < this.firstFrame || frame >= this.nextFrame + MAX_PENDING_FRAMES) return false;
    if (!this.humanSlots.includes(slot) || !Number.isInteger(mask) || mask < 0 || mask > 0xff) return false;

    // 補完済みの古い入力でも「操作を再開した」ことは分かる。
    // 正規値は上書きせず、新しいフレームには再び通常の猶予を与える。
    this.lastReceivedAt.set(slot, now);
    this.lagging.delete(slot);
    this.publishLag();

    if (!this.ready.has(slot)) {
      this.ready.add(slot);
      if (this.ready.size === this.humanSlots.length) {
        // VS画面のスキップやロード時間の差をラグ扱いしない。
        // 全人間が対戦画面から入力を送り始めてから監視を開始する。
        for (const row of this.pending.values()) row.since = now;
        for (const s of this.humanSlots) this.lastReceivedAt.set(s, now);
      }
    }

    if (frame < this.nextFrame) return false;
    // 欠番も有限の待機対象にする。後のフレームが先着しても永久待機しない。
    for (let f = this.highestFrame + 1; f <= frame; f++) {
      this.pending.set(f, { since: now, inputs: new Map() });
    }
    this.highestFrame = Math.max(this.highestFrame, frame);
    const row = this.pending.get(frame)!;
    if (row.inputs.has(slot)) return false;
    row.inputs.set(slot, mask);
    this.broadcastInput(frame, slot, mask);
    this.discardComplete();
    return true;
  }

  tick(now: number) {
    if (this.ready.size !== this.humanSlots.length) return;

    for (const [frame, row] of this.pending) {
      const expired = now - row.since >= INPUT_GRACE_MS;
      for (const slot of this.humanSlots) {
        if (row.inputs.has(slot)) continue;
        // 放置中の人を毎フレーム250ms待ち直さない。実入力が戻れば receive で解除。
        if (!expired && !this.lagging.has(slot)) continue;
        row.inputs.set(slot, 0);
        this.broadcastInput(frame, slot, 0);
        if (now - (this.lastReceivedAt.get(slot) ?? now) >= INPUT_GRACE_MS) this.lagging.add(slot);
      }
    }
    this.discardComplete();
    this.publishLag();
  }

  private discardComplete() {
    while (this.pending.get(this.nextFrame)?.inputs.size === this.humanSlots.length) {
      this.pending.delete(this.nextFrame++);
    }
  }

  private publishLag() {
    const slots = this.humanSlots.filter((slot) => this.lagging.has(slot));
    const signature = slots.join(',');
    if (signature === this.lagSignature) return;
    this.lagSignature = signature;
    // 回復時の [] も必ず送る。以前は警告が一度出ると消えなかった。
    this.broadcastLag(slots);
  }
}
