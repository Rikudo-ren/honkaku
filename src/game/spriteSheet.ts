/** The small Canvas API used by the procedural pixel-art source. */
export type PixelPaintContext = Pick<CanvasRenderingContext2D, 'fillStyle' | 'globalAlpha' | 'fillRect'>;

type Paint = (ctx: PixelPaintContext) => void;
type Rect = { x: number; y: number; w: number; h: number; color: PixelPaintContext['fillStyle']; alpha: number };

/** Record once on a cache miss, measuring the *actual* bounds (including weapons). */
class PixelFrame implements PixelPaintContext {
  fillStyle: PixelPaintContext['fillStyle'] = '#000000';
  globalAlpha = 1;
  rects: Rect[] = [];
  left = Infinity;
  top = Infinity;
  right = -Infinity;
  bottom = -Infinity;

  fillRect(x: number, y: number, w: number, h: number) {
    if (!w || !h || !this.globalAlpha) return;
    this.left = Math.min(this.left, Math.floor(Math.min(x, x + w)));
    this.top = Math.min(this.top, Math.floor(Math.min(y, y + h)));
    this.right = Math.max(this.right, Math.ceil(Math.max(x, x + w)));
    this.bottom = Math.max(this.bottom, Math.ceil(Math.max(y, y + h)));
    this.rects.push({ x, y, w, h, color: this.fillStyle, alpha: this.globalAlpha });
  }
}

interface Sheet {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  keys: Set<string>;
  x: number;
  y: number;
  rowHeight: number;
  lastUsed: number;
}

interface Frame {
  sheet: Sheet;
  sx: number;
  sy: number;
  w: number;
  h: number;
  /** Offset from the caller's origin, not from the top-left of the character. */
  left: number;
  top: number;
}

interface SheetOptions {
  pageSize?: number;
  maxPages?: number;
  createCanvas?: () => HTMLCanvasElement | null;
}

export interface SpriteSheetStats {
  pages: number;
  frames: number;
  /** RGBA pixel storage only; excludes browser/driver overhead. */
  bytes: number;
  hits: number;
  misses: number;
  evictions: number;
  disabled: boolean;
}

const GUTTER = 1;
const browserCanvas = () => typeof document === 'undefined' ? null : document.createElement('canvas');

/**
 * Lazy, tightly cropped sprite sheets. A hit needs only one drawImage call.
 * Pages use shelf packing and page-level LRU eviction, so long matches, palette
 * changes and title/battle transitions cannot grow the cache without a limit.
 * No DOM/canvas allocation occurs at module import time.
 */
export class SpriteSheetCache {
  private readonly pageSize: number;
  private readonly maxPages: number;
  private readonly createCanvas: () => HTMLCanvasElement | null;
  private sheets: Sheet[] = [];
  private frames = new Map<string, Frame>();
  private clock = 0;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private disabled = false;

  // Small pages keep source-canvas copy/upload costs low when a new frame is
  // added during play. 256 × 256 × 4 × 128 caps pixel storage at 32 MiB.
  constructor({ pageSize = 256, maxPages = 128, createCanvas = browserCanvas }: SheetOptions = {}) {
    if (!Number.isInteger(pageSize) || pageSize <= GUTTER * 2 || !Number.isInteger(maxPages) || maxPages < 1) {
      throw new RangeError('Invalid sprite sheet capacity');
    }
    this.pageSize = pageSize;
    this.maxPages = maxPages;
    this.createCanvas = createCanvas;
  }

  /** Returns false if a sheet cannot be used; the caller can paint directly. */
  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    key: string,
    paint: Paint,
    { flipX = false, alpha }: { flipX?: boolean; alpha?: number } = {},
  ): boolean {
    const frame = this.getFrame(key, paint);
    if (!frame) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (alpha !== undefined) ctx.globalAlpha = alpha;
    x = Math.round(x);
    y = Math.round(y);
    if (flipX) {
      ctx.translate(x, y);
      ctx.scale(-1, 1);
      x = 0;
      y = 0;
    }
    ctx.drawImage(frame.sheet.canvas, frame.sx, frame.sy, frame.w, frame.h, x + frame.left, y + frame.top, frame.w, frame.h);
    ctx.restore();
    return true;
  }

  getStats(): SpriteSheetStats {
    return {
      pages: this.sheets.length,
      frames: this.frames.size,
      bytes: this.sheets.length * this.pageSize * this.pageSize * 4,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      disabled: this.disabled,
    };
  }

  /** Release backing stores as well as keys. Also allows retry after allocation failure. */
  clear() {
    for (const sheet of this.sheets) {
      sheet.canvas.width = 0;
      sheet.canvas.height = 0;
    }
    this.sheets = [];
    this.frames.clear();
    this.clock = this.hits = this.misses = this.evictions = 0;
    this.disabled = false;
  }

  private getFrame(key: string, paint: Paint): Frame | null {
    if (this.disabled) return null;
    const cached = this.frames.get(key);
    if (cached) {
      this.hits++;
      cached.sheet.lastUsed = ++this.clock;
      return cached;
    }
    this.misses++;
    const pixels = new PixelFrame();
    paint(pixels);
    const w = pixels.right - pixels.left;
    const h = pixels.bottom - pixels.top;
    // Never silently clip an oversized/new accessory or allocate an unbounded sheet.
    if (!Number.isFinite(w + h) || w <= 0 || h <= 0 || w + GUTTER * 2 > this.pageSize || h + GUTTER * 2 > this.pageSize) return null;

    const slot = this.allocate(w + GUTTER * 2, h + GUTTER * 2);
    if (!slot) return null;
    const { sheet, x, y } = slot;
    const sx = x + GUTTER;
    const sy = y + GUTTER;
    let color: PixelPaintContext['fillStyle'] | undefined;
    let alpha = 1;
    for (const r of pixels.rects) {
      if (color !== r.color) sheet.ctx.fillStyle = color = r.color;
      if (alpha !== r.alpha) sheet.ctx.globalAlpha = alpha = r.alpha;
      sheet.ctx.fillRect(sx + r.x - pixels.left, sy + r.y - pixels.top, r.w, r.h);
    }
    if (alpha !== 1) sheet.ctx.globalAlpha = 1;
    sheet.lastUsed = ++this.clock;
    sheet.keys.add(key);
    const frame: Frame = { sheet, sx, sy, w, h, left: pixels.left, top: pixels.top };
    this.frames.set(key, frame);
    return frame;
  }

  private reserve(sheet: Sheet, w: number, h: number): { sheet: Sheet; x: number; y: number } | null {
    const wrap = sheet.x + w > this.pageSize;
    const x = wrap ? 0 : sheet.x;
    const y = wrap ? sheet.y + sheet.rowHeight : sheet.y;
    if (y + h > this.pageSize) return null;
    sheet.x = x + w;
    sheet.y = y;
    sheet.rowHeight = Math.max(wrap ? 0 : sheet.rowHeight, h);
    return { sheet, x, y };
  }

  private allocate(w: number, h: number): { sheet: Sheet; x: number; y: number } | null {
    for (const sheet of this.sheets) {
      const slot = this.reserve(sheet, w, h);
      if (slot) return slot;
    }

    let sheet: Sheet;
    if (this.sheets.length < this.maxPages) {
      // Canvas allocation can fail on constrained devices. Keep the game playable
      // through the procedural fallback, rather than retrying on every fighter.
      try {
        const canvas = this.createCanvas();
        if (!canvas) {
          this.disabled = true;
          return null;
        }
        canvas.width = canvas.height = this.pageSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          canvas.width = canvas.height = 0;
          this.disabled = true;
          return null;
        }
        sheet = { canvas, ctx, keys: new Set(), x: 0, y: 0, rowHeight: 0, lastUsed: 0 };
        this.sheets.push(sheet);
      } catch {
        this.disabled = true;
        return null;
      }
    } else {
      sheet = this.sheets.reduce((oldest, next) => next.lastUsed < oldest.lastUsed ? next : oldest);
      for (const key of sheet.keys) this.frames.delete(key);
      sheet.keys.clear();
      sheet.ctx.clearRect(0, 0, this.pageSize, this.pageSize);
      sheet.x = sheet.y = sheet.rowHeight = 0;
      this.evictions++;
    }
    return this.reserve(sheet, w, h);
  }
}
