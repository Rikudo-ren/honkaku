/** サーバーが確定した入力だけを保存する。補完入力も実入力も先着の値を維持する。 */
export class InputBuffer {
  private frames = new Map<number, Map<number, number>>();
  private consumedThrough = -1;
  /** 一番先まで届いた入力。描画停止後に他クライアントの進行へ追いつくための目安。 */
  latestFrame = -1;

  add(frame: number, slot: number, mask: number) {
    if (frame <= this.consumedThrough) return;
    let row = this.frames.get(frame);
    if (!row) {
      row = new Map();
      this.frames.set(frame, row);
    }
    if (!row.has(slot)) row.set(slot, mask);
    this.latestFrame = Math.max(this.latestFrame, frame);
  }

  get(frame: number, slot: number): number | undefined {
    return this.frames.get(frame)?.get(slot);
  }

  discard(frame: number) {
    this.frames.delete(frame);
    this.consumedThrough = Math.max(this.consumedThrough, frame);
  }

  clear() {
    this.frames.clear();
    this.consumedThrough = -1;
    this.latestFrame = -1;
  }
}

export const FRAME_MS = 1000 / 60;
/** 1描画での追いつき処理の上限。長いタブ放置後もUIを固めない。 */
export const MAX_ONLINE_STEPS = 12;

/**
 * 通常は60fps。入力待ちの時間を捨てず、受信済みの先行入力が多いときだけ追いつく。
 * 予約入力の inputDelay 分は追いつき対象から除く（正常な対戦を倍速にしない）。
 * フレームは飛ばさず、step が false（入力不足）なら必ず止まる。
 */
export class OnlineClock {
  private accumulated = 0;

  constructor(private readonly inputDelay: number) {}

  advance(elapsed: number, frame: number, latestInputFrame: number, step: () => boolean): number {
    this.accumulated = Math.min(FRAME_MS * MAX_ONLINE_STEPS, this.accumulated + Math.max(0, elapsed));
    let steps = 0;
    while (
      steps < MAX_ONLINE_STEPS &&
      (this.accumulated + 0.001 >= FRAME_MS || latestInputFrame > frame + steps + this.inputDelay)
    ) {
      if (!step()) break;
      this.accumulated = Math.max(0, this.accumulated - FRAME_MS);
      steps++;
    }
    return steps;
  }
}
