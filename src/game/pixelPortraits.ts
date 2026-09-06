import { getPreloadedPortraitUrl } from '@/components/Portrait';
import { ALL_CHARS } from './characters';
import type { CharId, Facing, PoseId } from './types';

/**
 * A low-resolution, transparent copy of a standing illustration.
 *
 * The battle scene is intentionally rendered at 384×216.  Drawing the source
 * illustrations directly would look soft and would also make the characters
 * feel like stickers.  PixelPortraitBank first reduces each illustration to a
 * small, palette-quantised canvas and the battle renderer draws that canvas
 * with nearest-neighbour sampling.  This keeps the facial features from the
 * standing art (especially glasses, hair and the different uniforms) while
 * retaining the game's pixel language.
 */
export interface PixelPortrait {
  id: CharId;
  canvas: HTMLCanvasElement;
  /** full canvas size used by drawPixelPortrait */
  width: number;
  height: number;
  /** visible bounds inside the canvas, useful for shadows and labels */
  visibleWidth: number;
  visibleHeight: number;
}

export interface PixelPortraitDrawOptions {
  pose: PoseId;
  phase?: 0 | 1 | 2;
  facing: Facing;
  t: number;
  alpha?: number;
  flash?: boolean;
  /** compact team battles use a smaller, but otherwise identical, sprite */
  scale?: number;
}

const CANVAS_W = 84;
const CANVAS_H = 112;
const SAMPLE_W = 192;
const PALETTE_STEP = 24;

const hash = (id: string) => {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(n);
};

function quantise(g: CanvasRenderingContext2D, w: number, h: number) {
  const image = g.getImageData(0, 0, w, h);
  const d = image.data;
  const q = (v: number) => Math.max(0, Math.min(255, Math.round(v / PALETTE_STEP) * PALETTE_STEP));
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 18) {
      d[i + 3] = 0;
      continue;
    }
    // Keep the alpha edge, but reduce the number of colours in the interior.
    d[i] = q(d[i]);
    d[i + 1] = q(d[i + 1]);
    d[i + 2] = q(d[i + 2]);
    if (d[i + 3] < 90) d[i + 3] = Math.round(d[i + 3] * 0.7);
  }
  g.putImageData(image, 0, 0);
  return image.data;
}

function makePixelPortrait(id: CharId, image: HTMLImageElement): PixelPortrait | null {
  if (!image.naturalWidth || !image.naturalHeight) return null;

  // Reduce before scanning.  This removes JPEG-sized edge noise and makes the
  // later crop stable for both white and black source backgrounds.
  const sampleH = Math.max(1, Math.round((image.naturalHeight / image.naturalWidth) * SAMPLE_W));
  const sample = document.createElement('canvas');
  sample.width = SAMPLE_W;
  sample.height = sampleH;
  const sg = sample.getContext('2d', { willReadFrequently: true });
  if (!sg) return null;
  sg.imageSmoothingEnabled = true;
  sg.drawImage(image, 0, 0, SAMPLE_W, sampleH);
  const data = quantise(sg, SAMPLE_W, sampleH);

  let minX = SAMPLE_W;
  let minY = sampleH;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < SAMPLE_W; x++) {
      if (data[(y * SAMPLE_W + x) * 4 + 3] < 22) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return null;

  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(SAMPLE_W - 1, maxX + pad);
  maxY = Math.min(sampleH - 1, maxY + pad);
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  // Most illustrations are full-body; keep the feet at exactly the fighter's
  // physics y coordinate.  A small width cap prevents the hammer and open
  // hands from swallowing the adjacent fighter in a team battle.
  let visibleH = 108;
  let visibleW = Math.max(1, Math.round((cropW / cropH) * visibleH));
  if (visibleW > 78) {
    visibleW = 78;
    visibleH = Math.max(1, Math.round((cropH / cropW) * visibleW));
  }

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const dx = Math.round((CANVAS_W - visibleW) / 2);
  const dy = CANVAS_H - visibleH;
  g.drawImage(sample, minX, minY, cropW, cropH, dx, dy, visibleW, visibleH);

  // One-pixel dark keyline makes the reduced illustration readable against
  // every stage without turning pale shirts into a solid silhouette.
  const outline = document.createElement('canvas');
  outline.width = CANVAS_W;
  outline.height = CANVAS_H;
  const og = outline.getContext('2d')!;
  og.imageSmoothingEnabled = false;
  og.drawImage(canvas, 0, 0);
  og.globalCompositeOperation = 'source-in';
  og.fillStyle = 'rgba(8,12,28,0.62)';
  og.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // Put the outline behind the sprite by drawing it offset in the final canvas.
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = CANVAS_W;
  finalCanvas.height = CANVAS_H;
  const fg = finalCanvas.getContext('2d')!;
  fg.imageSmoothingEnabled = false;
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) fg.drawImage(outline, ox, oy);
  fg.drawImage(canvas, 0, 0);
  return { id, canvas: finalCanvas, width: CANVAS_W, height: CANVAS_H, visibleWidth: visibleW, visibleHeight: visibleH };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`pixel portrait load failed: ${src}`));
    image.src = src;
  });
}

export class PixelPortraitBank {
  private readonly sprites = new Map<CharId, PixelPortrait>();
  private readonly pending = new Map<CharId, Promise<void>>();
  private readonly failed = new Set<CharId>();

  constructor(ids: CharId[]) {
    if (typeof Image === 'undefined') return;
    // Portrait.tsx's preload runs after the module graph is evaluated.  The
    // first load may therefore see an empty cache; get() retries once the
    // loading screen has populated the processed URLs.
    for (const id of ids) void this.load(id);
  }

  private load(id: CharId): Promise<void> {
    if (this.sprites.has(id) || this.failed.has(id)) return Promise.resolve();
    const active = this.pending.get(id);
    if (active) return active;
    const src = getPreloadedPortraitUrl(id);
    if (!src || typeof Image === 'undefined') return Promise.resolve();

    const task = loadImage(src)
      .then((image) => {
        const sprite = makePixelPortrait(id, image);
        if (sprite) this.sprites.set(id, sprite);
        else this.failed.add(id);
      })
      .catch(() => this.failed.add(id))
      .then(() => undefined);
    this.pending.set(id, task);
    void task.finally(() => this.pending.delete(id));
    return task;
  }

  /** Wait for all currently supplied standing illustrations to become pixel sprites. */
  preload(ids: CharId[]): Promise<void> {
    return Promise.all(ids.map((id) => this.load(id))).then(() => undefined);
  }

  get(id: CharId): PixelPortrait | undefined {
    void this.load(id);
    return this.sprites.get(id);
  }

  height(id: CharId): number | undefined {
    void this.load(id);
    return this.sprites.get(id)?.visibleHeight;
  }

  width(id: CharId): number | undefined {
    void this.load(id);
    return this.sprites.get(id)?.visibleWidth;
  }
}

/** Shared by the title canvas and all battle renderers. */
export const sharedPixelPortraits = new PixelPortraitBank(ALL_CHARS);

/** App loading hook: avoid showing the handcrafted fallback for even one frame. */
export function preloadPixelPortraits(): Promise<void> {
  return sharedPixelPortraits.preload(ALL_CHARS);
}

function motionFor(o: PixelPortraitDrawOptions, id: CharId) {
  const phase = o.phase ?? 0;
  const pulse = Math.sin((o.t + hash(id) % 29) * 0.13);
  let x = 0;
  let y = Math.round(pulse * 0.55);
  let sx = 1 + pulse * 0.008;
  let sy = 1 - pulse * 0.008;
  let rotate = 0;
  let centred = false;

  switch (o.pose) {
    case 'idle':
    case 'frozen':
    case 'win':
      break;
    case 'walk': {
      const step = [0, 1, 0, -1][Math.floor(o.t / 4) % 4];
      y += step;
      x += step * 0.35;
      break;
    }
    case 'jump':
    case 'airStep':
      y -= 1;
      sx += 0.03;
      sy -= 0.04;
      rotate = Math.sin(o.t * 0.16) * 0.035 * o.facing;
      break;
    case 'airClap':
      sx += phase === 1 ? 0.08 : 0.02;
      sy -= phase === 1 ? 0.07 : 0.02;
      rotate = 0.05 * o.facing;
      break;
    case 'airDive':
      x += o.facing * 2;
      sx += 0.1;
      sy -= 0.08;
      rotate = 0.12 * o.facing;
      break;
    case 'crouch':
      y += 1;
      sy = 0.82;
      sx = 1.08;
      break;
    case 'getup':
      y += 1;
      sy = 0.9;
      sx = 1.04;
      rotate = -0.03 * o.facing;
      break;
    case 'down':
    case 'lose':
      centred = true;
      x += o.facing * 24;
      y -= 10;
      sx = 0.72;
      sy = 0.72;
      rotate = -Math.PI / 2 * o.facing;
      break;
    case 'hurt':
    case 'grabbed':
      x -= o.facing * 2;
      sx = 0.94;
      sy = 1.04;
      rotate = -0.075 * o.facing;
      break;
    case 'launch':
      x -= o.facing * 4;
      y -= 3;
      sx = 0.92;
      sy = 1.08;
      rotate = -0.17 * o.facing;
      break;
    case 'block':
      sx = 0.96;
      sy = 1.02;
      x -= o.facing;
      break;
    case 'jab':
    case 'penJab':
    case 'lash':
    case 'point':
    case 'grab':
      x += o.facing * (phase === 0 ? -1 : phase === 1 ? 3 : 1);
      sx += phase === 1 ? 0.06 : 0.01;
      sy -= phase === 1 ? 0.04 : 0;
      rotate = (phase === 0 ? -0.025 : phase === 1 ? 0.06 : 0.015) * o.facing;
      break;
    case 'swing':
    case 'kick':
    case 'throw':
      x += o.facing * (phase === 0 ? -2 : phase === 1 ? 4 : 1);
      sx += phase === 1 ? 0.1 : 0.03;
      sy -= phase === 1 ? 0.08 : 0.01;
      rotate = (phase === 0 ? -0.08 : phase === 1 ? 0.1 : 0.025) * o.facing;
      break;
    case 'counter':
    case 'spread':
    case 'pointUp':
      sx = phase === 1 ? 1.06 : 1.01;
      sy = phase === 1 ? 0.94 : 1;
      rotate = 0.025 * o.facing;
      break;
    case 'stun':
      x += Math.sin(o.t * 0.45) * 1.5;
      rotate = Math.sin(o.t * 0.35) * 0.1;
      break;
    case 'confess':
    case 'paper':
      sx = 1.02;
      y -= 1;
      break;
    case 'cheerClap':
    case 'cheerTurn':
    case 'cheerCall':
      y += Math.sin(o.t * 0.35) > 0 ? -1 : 0;
      sx += phase === 1 ? 0.05 : 0;
      rotate = Math.sin(o.t * 0.23) * 0.045 * o.facing;
      break;
  }
  // All super poses arrive here as a character-specific PoseId (counter,
  // spread, confess, paper, and so on). Their pulse is applied by the small
  // pose branches above instead of inventing a non-game pose called "super".
  return { x, y, sx, sy, rotate, centred };
}

/** Draw one pixelated standing illustration with deterministic pose motion. */
export function drawPixelPortrait(ctx: CanvasRenderingContext2D, portrait: PixelPortrait, x: number, y: number, o: PixelPortraitDrawOptions) {
  const m = motionFor(o, portrait.id);
  const scale = o.scale ?? 1;
  const alpha = o.alpha ?? 1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;

  if (m.centred) {
    ctx.translate(Math.round(x + m.x), Math.round(y + m.y));
    ctx.rotate(m.rotate);
    ctx.scale(o.facing * m.sx * scale, m.sy * scale);
    ctx.drawImage(portrait.canvas, -portrait.width / 2, -portrait.height / 2, portrait.width, portrait.height);
  } else {
    ctx.translate(Math.round(x + m.x), Math.round(y + m.y));
    ctx.rotate(m.rotate);
    ctx.scale(o.facing * m.sx * scale, m.sy * scale);
    ctx.drawImage(portrait.canvas, -portrait.width / 2, -portrait.height, portrait.width, portrait.height);
  }

  if (o.flash) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-portrait.width, -portrait.height, portrait.width * 2, portrait.height * 2);
  }
  ctx.restore();
}
