import { useEffect, useState } from 'react';
import { CHARS } from '@/game/characters';
import { drawFighter, drawShadow } from '@/game/sprites';
import type { CharId } from '@/game/types';

/**
 * 立ち絵画像のファイル名（src/assets/portraits/ に配置すると自動で使われる）。
 * 白背景・黒背景いずれもコード側でフラッドフィル透過する。未配置時はドット絵立ち絵を自動生成。
 */
const PORTRAIT_FILES: Record<CharId, string> = {
  mie: 'yxWjo.jpg',
  ryoma: '2f4yf.jpg',
  naito: 't1s3p.jpg',
  mitsumine: 'BnEZx.jpg',
  terachi: 'b1eQ6.jpg',
  rei: 'OCvNF.jpg',
  sakura: 'sakura_yu.jpg',
};

const mods = import.meta.glob<string>('../assets/portraits/*', {
  eager: true,
  import: 'default',
  query: '?url',
});

const byName: Record<string, string> = {};
for (const [path, url] of Object.entries(mods)) {
  const base = path.split('/').pop();
  if (base) byName[base.toLowerCase()] = url;
}

export const USER_PORTRAIT_URLS: Record<CharId, string | null> = {
  mie: byName[PORTRAIT_FILES.mie.toLowerCase()] ?? null,
  ryoma: byName[PORTRAIT_FILES.ryoma.toLowerCase()] ?? null,
  naito: byName[PORTRAIT_FILES.naito.toLowerCase()] ?? null,
  mitsumine: byName[PORTRAIT_FILES.mitsumine.toLowerCase()] ?? null,
  terachi: byName[PORTRAIT_FILES.terachi.toLowerCase()] ?? null,
  rei: byName[PORTRAIT_FILES.rei.toLowerCase()] ?? null,
  sakura: byName[PORTRAIT_FILES.sakura.toLowerCase()] ?? null,
};

// ───────────────────────── 背景（白 or 黒）の透過処理 ─────────────────────────
const processedCache = new Map<string, Promise<string>>();
// 透過処理が完了した URL を同期的に引けるキャッシュ。
// ゲーム起動時のローディング画面で先読みしておくことで、
// 選択画面などで背景付き版が一瞬表示されるポップインを防ぐ。
const resolvedCache = new Map<string, string>();

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('img load failed'));
    img.src = src;
  });
}

/** 画像の縁（上下左右の枠）の平均明度から、背景が黒系かどうかを推定する */
function estimateBackgroundIsDark(d: Uint8ClampedArray, w: number, h: number): boolean {
  let sum = 0;
  let count = 0;
  const add = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    sum += (d[i] + d[i + 1] + d[i + 2]) / 3;
    count++;
  };
  for (let x = 0; x < w; x++) {
    add(x, 0);
    add(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    add(0, y);
    add(w - 1, y);
  }
  return count > 0 && sum / count < 128;
}

/**
 * 境界からフラッドフィルで背景を抜き、輪郭の背景色フリンジも除去する。
 * 背景が白系か黒系かを自動判定し、それに応じて判定方向を反転させる。
 */
function removeBackground(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0);
  const idata = g.getImageData(0, 0, w, h);
  const d = idata.data;
  const n = w * h;
  const isDark = estimateBackgroundIsDark(d, w, h);
  const bg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0;
  let qt = 0;

  // tol は「背景色からどれだけ離れてよいか」の許容量。
  // 白背景なら「明るく無彩色」、黒背景なら「暗く無彩色」を背景とみなす。
  const isBgColor = (p: number, tol: number) => {
    const i = p * 4;
    const r = d[i];
    const gg = d[i + 1];
    const b = d[i + 2];
    const mx = r > gg ? (r > b ? r : b) : gg > b ? gg : b;
    const mn = r < gg ? (r < b ? r : b) : gg < b ? gg : b;
    if (isDark) return mx <= 255 - tol && mx - mn <= 26;
    return mn >= tol && mx - mn <= 26;
  };
  const push = (p: number) => {
    if (!bg[p]) {
      bg[p] = 1;
      queue[qt++] = p;
    }
  };
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const p = y * w + x;
      if (isBgColor(p, 240)) push(p);
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const p = y * w + x;
      if (isBgColor(p, 240)) push(p);
    }
  }
  while (qh < qt) {
    const p = queue[qh++];
    d[p * 4 + 3] = 0;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) {
      const q = p - 1;
      if (!bg[q] && isBgColor(q, 232)) push(q);
    }
    if (x < w - 1) {
      const q = p + 1;
      if (!bg[q] && isBgColor(q, 232)) push(q);
    }
    if (y > 0) {
      const q = p - w;
      if (!bg[q] && isBgColor(q, 232)) push(q);
    }
    if (y < h - 1) {
      const q = p + w;
      if (!bg[q] && isBgColor(q, 232)) push(q);
    }
  }
  // 輪郭に残った半端な背景色ピクセルを2パスで削る
  for (let pass = 0; pass < 2; pass++) {
    const add: number[] = [];
    for (let p = 0; p < n; p++) {
      if (bg[p] || !isBgColor(p, 236)) continue;
      const x = p % w;
      const y = (p - x) / w;
      if ((x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w])) add.push(p);
    }
    if (!add.length) break;
    for (const p of add) {
      bg[p] = 1;
      d[p * 4 + 3] = 0;
    }
  }
  // 前景側に残った背景色のフリンジを半透明化してハローを抑える
  for (let p = 0; p < n; p++) {
    if (bg[p]) continue;
    const x = p % w;
    const y = (p - x) / w;
    const nearBg = (x > 0 && bg[p - 1]) || (x < w - 1 && bg[p + 1]) || (y > 0 && bg[p - w]) || (y < h - 1 && bg[p + w]);
    if (!nearBg) continue;
    const i = p * 4;
    if (isDark) {
      const mx = Math.max(d[i], d[i + 1], d[i + 2]);
      if (mx <= 50) d[i + 3] = Math.round(d[i + 3] * 0.4);
      else if (mx <= 70) d[i + 3] = Math.round(d[i + 3] * 0.72);
    } else {
      const mn = Math.min(d[i], d[i + 1], d[i + 2]);
      if (mn >= 205) d[i + 3] = Math.round(d[i + 3] * 0.4);
      else if (mn >= 185) d[i + 3] = Math.round(d[i + 3] * 0.72);
    }
  }
  g.putImageData(idata, 0, 0);
  return cv;
}

function processUrl(src: string): Promise<string> {
  let p = processedCache.get(src);
  if (!p) {
    p = loadImg(src)
      .then((img) => {
        const cv = removeBackground(img);
        return new Promise<string>((res) => {
          cv.toBlob((b) => res(b ? URL.createObjectURL(b) : cv.toDataURL('image/png')), 'image/png');
        });
      })
      .then((url) => {
        resolvedCache.set(src, url);
        return url;
      })
      .catch(() => src);
    processedCache.set(src, p);
  }
  return p;
}

/**
 * 全キャラクターの立ち絵透過処理をあらかじめ実行しておく。
 * ゲーム起動時のローディング画面から呼び出す想定で、done/total で進捗を返す。
 */
export function preloadPortraits(onProgress?: (done: number, total: number) => void): Promise<void> {
  const urls = Object.values(USER_PORTRAIT_URLS).filter((u): u is string => !!u);
  const total = urls.length;
  if (total === 0) {
    onProgress?.(0, 0);
    return Promise.resolve();
  }
  let done = 0;
  onProgress?.(0, total);
  return Promise.all(
    urls.map((u) =>
      processUrl(u).finally(() => {
        done++;
        onProgress?.(done, total);
      })
    )
  ).then(() => undefined);
}

// ───────────────────────── 未配置時のドット絵立ち絵 ─────────────────────────
const fallbackCache = new Map<CharId, string>();

function spritePortrait(id: CharId): string {
  const hit = fallbackCache.get(id);
  if (hit) return hit;
  const def = CHARS[id];
  const cv = document.createElement('canvas');
  cv.width = 132;
  cv.height = 176;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const grd = g.createLinearGradient(0, 0, 0, 176);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(1, def.light);
  g.fillStyle = grd;
  g.fillRect(0, 0, 132, 176);
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 8; y < 176; y += 8) g.fillRect(0, y, 132, 1);
  g.save();
  g.scale(2.6, 2.6);
  drawShadow(g, 25, 64, 0);
  drawFighter(g, 25, 64, def.look, { pose: 'idle', facing: 1, t: 0 });
  g.restore();
  const url = cv.toDataURL('image/png');
  fallbackCache.set(id, url);
  return url;
}

export function usePortraitSrc(id: CharId): string {
  const user = USER_PORTRAIT_URLS[id];
  const [src, setSrc] = useState<string>(() => (user && resolvedCache.has(user) ? resolvedCache.get(user)! : spritePortrait(id)));
  useEffect(() => {
    let on = true;
    if (!user) {
      setSrc(spritePortrait(id));
      return;
    }
    const cached = resolvedCache.get(user);
    if (cached) {
      // 先読み済み（ローディング画面で処理済み）ならポップインなしで即反映。
      setSrc(cached);
      return;
    }
    setSrc(spritePortrait(id));
    processUrl(user).then((u) => {
      if (on) setSrc(u);
    });
    return () => {
      on = false;
    };
  }, [id, user]);
  return src;
}

export function Portrait({ id, className, alt }: { id: CharId; className?: string; alt?: string }) {
  const src = usePortraitSrc(id);
  return <img src={src} alt={alt ?? CHARS[id].name} className={className} draggable={false} />;
}
