import { CHARS, EXTRA_LOOKS } from './characters';
import { CHEER } from './cheer';
import { GROUND, H, W, type Battle, type Fighter, type PixelFx, type Projectile } from './engine';
import { drawFighter, drawShadow } from './sprites';
import type { CharId, StageId } from './types';

export const SCALE = 1;
export const FONT = "'DotGothic16', 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif";

interface Petal {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ph: number;
}
interface Jogger {
  x: number;
  v: number;
  c: string;
}

const seeded = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function pixEllipse(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, upperOnly = false) {
  g.fillStyle = color;
  const y0 = Math.round(cy - ry);
  const y1 = upperOnly ? Math.round(cy) : Math.round(cy + ry);
  for (let y = y0; y < y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    const hw = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
    if (hw <= 0) continue;
    g.fillRect(Math.round(cx - hw), y, Math.max(4, Math.round(hw * 2)), 1);
  }
}

function pixEllipseOutline(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, color: string, upperOnly = false) {
  g.fillStyle = color;
  const y0 = Math.round(cy - ry);
  const y1 = upperOnly ? Math.round(cy) : Math.round(cy + ry);
  for (let y = y0; y < y1; y++) {
    const dy = (y + 0.5 - cy) / ry;
    const hw = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
    if (hw <= 0) continue;
    g.fillRect(Math.round(cx - hw), y, 4, 1);
    g.fillRect(Math.round(cx + hw) - 4, y, 4, 1);
  }
}

function pixCircle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  pixEllipse(g, cx, cy, r, r, color);
}

function drawCross(g: CanvasRenderingContext2D, x: number, y: number, c1: string, c2: string, s = 4) {
  x = Math.round(x);
  y = Math.round(y);
  g.fillStyle = c1;
  g.fillRect(x - 1 * s, y - 5 * s, 3 * s, 11 * s);
  g.fillRect(x - 4 * s, y - 2 * s, 9 * s, 3 * s);
  g.fillStyle = c2;
  g.fillRect(x, y - 4 * s, 1 * s, 9 * s);
  g.fillRect(x - 3 * s, y - 1 * s, 7 * s, 1 * s);
}

export class Renderer {
  private g: CanvasRenderingContext2D;
  private c: CanvasRenderingContext2D;
  private dark: HTMLCanvasElement;
  private petals: Petal[] = [];
  private joggers: Jogger[] = [];

  constructor(game: HTMLCanvasElement, fx: HTMLCanvasElement) {
    game.width = W;
    game.height = H;
    fx.width = W * SCALE;
    fx.height = H * SCALE;
    this.g = game.getContext('2d')!;
    this.c = fx.getContext('2d')!;
    this.g.imageSmoothingEnabled = false;
    this.dark = document.createElement('canvas');
    this.dark.width = W;
    this.dark.height = H;
    for (let i = 0; i < 40; i++) this.petals.push({ x: Math.random() * W, y: Math.random() * H, vx: 1.2 + Math.random() * 1.6, vy: 1.6 + Math.random() * 2, ph: Math.random() * 10 });
    this.joggers = [
      { x: 160, v: 1.4, c: '#f87171' },
      { x: 640, v: 2, c: '#60a5fa' },
      { x: 1200, v: 1.12, c: '#fbbf24' },
    ];
  }

  draw(b: Battle) {
    this.drawGame(b);
    this.drawOverlay(b);
  }

  // ═══════════════════════ GAME LAYER (1x pixel) ═══════════════════════
  private drawGame(b: Battle) {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, W, H);
    const sx = b.shake > 0 ? Math.round((Math.random() - 0.5) * b.shake) : 0;
    const sy = b.shake > 0 ? Math.round((Math.random() - 0.5) * b.shake * 0.6) : 0;
    g.translate(sx, sy);

    this.drawStage(b.stage, b.t);
    if (b.f.some((f) => f.id === 'mitsumine_cheer' && f.state === 'super')) this.drawCheerStands(b.t);

    // ground props (items) behind fighters
    for (const p of b.projectiles) if (p.item || p.kind === 'vending' || p.kind === 'chisen') this.drawProjectile(p, b.t);

    // fighters: draw the "active" ones last
    const isActive = (f: Fighter) => f.state === 'attack' || f.state === 'super' || f.state === 'launch';
    const order = [...b.f].sort((p, q) => Number(isActive(p)) - Number(isActive(q)));
    for (const f of order) this.drawFighter(f, b);

    for (const p of b.projectiles) if (!p.item && p.kind !== 'vending' && p.kind !== 'chisen') this.drawProjectile(p, b.t);
    for (const e of b.fx) this.drawFx(e, b.t);

    if (b.darkness > 0) this.drawDarkness(b);
    if (b.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${Math.min(1, b.flash / 10)})`;
      g.fillRect(-40, -40, W + 80, H + 80);
    }
  }

  private drawFighter(f: Fighter, b: Battle) {
    const g = this.g;
    drawShadow(g, f.x, GROUND, GROUND - f.y);
    const alpha = f.state === 'getup' ? 0.65 : f.invuln > 0 && f.state !== 'win' && f.state !== 'super' && f.state !== 'frozen' && b.t % 4 < 2 ? 0.55 : 1;
    drawFighter(g, f.x, f.y, f.look, { pose: b.poseOf(f), phase: b.phaseOf(f), facing: f.facing, t: b.t, flash: f.flash > 0, alpha });
    // status marks
    if (f.state === 'frozen') {
      g.fillStyle = 'rgba(147,197,253,0.55)';
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + b.t * 0.03;
        g.fillRect(Math.round(f.x + Math.cos(ang) * 48), Math.round(f.y - 96 + Math.sin(ang) * 64), 8, 8);
      }
    }
    if (f.state === 'stun') {
      g.fillStyle = '#fde047';
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2 + b.t * 0.12;
        g.fillRect(Math.round(f.x + Math.cos(ang) * 36), Math.round(f.y - 200 + Math.sin(ang) * 12), 8, 8);
      }
    }
    if (f.countering) {
      g.fillStyle = `rgba(125,211,252,${0.35 + 0.25 * Math.sin(b.t * 0.6)})`;
      g.fillRect(Math.round(f.x - 48), f.y - 184, 96, 4);
      g.fillRect(Math.round(f.x - 48), f.y - 4, 96, 4);
    }
  }

  private drawProjectile(p: Projectile, t: number) {
    const g = this.g;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    switch (p.kind) {
      case 'cheerEcho':
      case 'cheerNote': {
        const d = p.vx >= 0 ? 1 : -1;
        const color = p.echoReturned ? '#7dd3fc' : '#fb7185';
        // 声は弾丸ではなく、三本の括弧型の音圧。復路は水色かつ低い位置。
        for (let i = 0; i < 3; i++) {
          const xx = x + d * (i * 16 - 20);
          const h = 12 + i * 8;
          g.fillStyle = i === 1 ? '#fff1f2' : color;
          g.fillRect(xx, y - h, 8, h * 2);
          g.fillRect(xx - d * 8, y - h - 4, 8, 8);
          g.fillRect(xx - d * 8, y + h - 4, 8, 8);
        }
        if (p.kind === 'cheerNote') {
          g.fillStyle = '#ffffff';
          g.fillRect(x - d * 32, y - 24, 8, 8);
          g.fillRect(x - d * 44, y - 36, 4, 4);
        }
        break;
      }
      case 'cheerWave': {
        const radius = p.t * CHEER.waveSpeed;
        // 判定と同じ速度で円の先端が広がる。遠い相手へも瞬間着弾はしない。
        const strong = p.dmg > 10;
        for (let yy = Math.max(0, y - radius); yy < Math.min(H, y + radius); yy++) {
          const dx = Math.round(Math.sqrt(Math.max(0, radius * radius - (yy - y) ** 2)));
          for (const xx of [x - dx, x + dx]) {
            if (xx < -16 || xx > W + 16) continue;
            g.fillStyle = strong ? '#fb7185' : '#7dd3fc';
            g.fillRect(xx - 8, yy, strong ? 20 : 12, 1);
            g.fillStyle = '#fff1f2';
            g.fillRect(xx, yy, 4, 1);
          }
        }
        break;
      }
      case 'cross': {
        const pulse = Math.floor(t / 6) % 2 === 0;
        drawCross(g, x, y, p.owner === -1 ? '#fbbf24' : '#fde68a', pulse ? '#ffffff' : '#fff7cc');
        break;
      }
      case 'eraser': {
        const roll = Math.floor(t / 4) % 2;
        g.fillStyle = '#f8fafc';
        g.fillRect(x - 12, y - 8 + roll * 4, 28, 16);
        g.fillStyle = '#2563eb';
        g.fillRect(x - 12, y - 8 + roll * 4, 8, 16);
        g.fillStyle = '#cbd5e1';
        g.fillRect(x + 8, y - 8 + roll * 4, 8, 4);
        break;
      }
      case 'cat': {
        const d = p.vx >= 0 ? 1 : -1;
        const R = (lx: number, ly: number, w: number, h: number, c: string) => {
          g.fillStyle = c;
          g.fillRect(d === 1 ? x + lx : x - lx - w, y + ly, w, h);
        };
        const step = Math.floor(t / 4) % 2;
        R(-20, -8, 32, 16, '#a3a3ad');
        R(4, -20, 20, 20, '#b4b4bd');
        R(4, -24, 4, 4, '#b4b4bd');
        R(16, -24, 4, 4, '#b4b4bd');
        R(16, -16, 4, 4, '#facc15');
        R(-28, -16, 8, 4, '#a3a3ad');
        R(-32, -20, 4, 4, '#a3a3ad');
        R(-16 + step * 4, 8, 8, 8, '#8a8a94');
        R(4 - step * 4, 8, 8, 8, '#8a8a94');
        break;
      }
      case 'star': {
        g.fillStyle = 'rgba(254,243,199,0.5)';
        g.fillRect(x - 4, y - 64, 12, 48);
        g.fillStyle = '#fde68a';
        g.fillRect(x - 4, y - 16, 12, 36);
        g.fillRect(x - 16, y - 4, 36, 12);
        g.fillRect(x - 12, y - 12, 4, 4);
        g.fillRect(x + 12, y - 12, 4, 4);
        g.fillRect(x - 12, y + 12, 4, 4);
        g.fillRect(x + 12, y + 12, 4, 4);
        g.fillStyle = '#ffffff';
        g.fillRect(x, y, 4, 4);
        break;
      }
      case 'basketball': {
        pixCircle(g, x, y, 16, '#f97316');
        g.fillStyle = '#7c2d12';
        const r = Math.floor(t / 5) % 2;
        if (r) {
          g.fillRect(x - 12, y, 28, 4);
          g.fillRect(x, y - 12, 4, 28);
        } else {
          g.fillRect(x - 8, y - 8, 4, 4);
          g.fillRect(x + 8, y + 8, 4, 4);
          g.fillRect(x - 8, y + 8, 4, 4);
          g.fillRect(x + 8, y - 8, 4, 4);
          g.fillRect(x - 4, y - 4, 12, 12);
          g.fillStyle = '#f97316';
          g.fillRect(x, y, 4, 4);
        }
        break;
      }
      case 'soup': {
        g.fillStyle = '#fde68a';
        g.fillRect(x - 16, y - 24, 32, 48);
        g.fillStyle = '#dc2626';
        g.fillRect(x - 16, y - 12, 32, 20);
        g.fillStyle = '#ffffff';
        g.fillRect(x - 8, y - 8, 16, 4);
        g.fillRect(x - 8, y, 16, 4);
        g.fillStyle = '#d4d4d8';
        g.fillRect(x - 16, y - 24, 32, 4);
        g.fillRect(x - 16, y + 20, 32, 4);
        if (Math.floor(t / 10) % 2 === 0) {
          g.fillStyle = '#fff';
          g.fillRect(x - 20, y - 36, 4, 4);
          g.fillRect(x + 20, y - 36, 4, 4);
        }
        break;
      }
      case 'mikan': {
        pixCircle(g, x, y, 16, '#fb923c');
        g.fillStyle = '#65a30d';
        g.fillRect(x, y - 20, 8, 4);
        g.fillRect(x - 4, y - 24, 4, 4);
        g.fillStyle = '#fdba74';
        g.fillRect(x - 8, y - 8, 4, 4);
        break;
      }
      case 'vending': {
        g.fillStyle = '#d23c3c';
        g.fillRect(x - 32, y - 52, 64, 104);
        g.fillStyle = '#a82a2a';
        g.fillRect(x - 32, y - 52, 64, 8);
        g.fillStyle = '#20263a';
        g.fillRect(x - 24, y - 40, 48, 40);
        const cans = ['#fde68a', '#60a5fa', '#f87171', '#a3e635'];
        for (let i = 0; i < 4; i++) {
          g.fillStyle = cans[i];
          g.fillRect(x - 20 + i * 12, y - 32, 8, 12);
          g.fillRect(x - 20 + i * 12, y - 16, 8, 12);
        }
        g.fillStyle = '#fef3c7';
        g.fillRect(x - 24, y + 8, 48, 16);
        g.fillStyle = '#dc2626';
        g.fillRect(x - 16, y + 12, 32, 8);
        g.fillStyle = '#111';
        g.fillRect(x - 24, y + 32, 48, 12);
        if (p.vy > 4) {
          g.fillStyle = 'rgba(255,255,255,0.5)';
          g.fillRect(x - 44, y - 80, 4, 40);
          g.fillRect(x + 40, y - 96, 4, 40);
        }
        break;
      }
      case 'kuraishi': {
        drawShadow(g, p.x, GROUND, 0);
        drawFighter(g, p.x, p.y + 80, EXTRA_LOOKS.kuraishi, { pose: 'walk', facing: p.vx >= 0 ? 1 : -1, t });
        const bob = Math.floor(t / 8) % 2;
        drawCross(g, x - 40, y - 120 + bob * 4, '#f8fafc', '#e2e8f0');
        drawCross(g, x, y - 144 - bob * 4, '#f8fafc', '#e2e8f0');
        drawCross(g, x + 40, y - 120 + bob * 4, '#f8fafc', '#e2e8f0');
        break;
      }
      case 'koi': {
        // シュレディンガーの好意：観測されるまで「ある」と「ない」が重なっている
        const ph = Math.floor(t / 5) % 4;
        const alive = ph !== 3; // 4フレームに1回だけ消える（重ね合わせ）
        const bob = Math.floor(t / 12) % 2;
        const yy = y - 8 - bob * 4;
        const dying = p.life < 90 && Math.floor(t / 3) % 2 === 0; // 減衰間近は点滅
        g.globalAlpha = dying ? 0.35 : alive ? 0.9 : 0.25;
        const c1 = ph === 1 ? '#fbcfe8' : '#f472b6';
        const c2 = '#be185d';
        // heart (7x6)
        g.fillStyle = c1;
        g.fillRect(x - 12, yy - 12, 8, 4);
        g.fillRect(x + 4, yy - 12, 8, 4);
        g.fillRect(x - 16, yy - 8, 32, 8);
        g.fillRect(x - 12, yy, 24, 4);
        g.fillRect(x - 8, yy + 4, 16, 4);
        g.fillRect(x - 4, yy + 8, 8, 4);
        g.fillStyle = c2;
        g.fillRect(x, yy + 12, 4, 4);
        g.fillStyle = '#ffffff';
        g.fillRect(x - 12, yy - 8, 4, 4);
        // 「？」（観測前）
        g.fillStyle = alive ? '#ffffff' : '#f9a8d4';
        g.fillRect(x - 4, yy - 40, 12, 4);
        g.fillRect(x + 8, yy - 36, 4, 8);
        g.fillRect(x + 4, yy - 28, 4, 4);
        g.fillRect(x, yy - 24, 4, 4);
        g.fillRect(x, yy - 16, 4, 4);
        g.globalAlpha = 1;
        // 判定の気配（薄い枠）
        if (ph === 2) {
          g.fillStyle = 'rgba(249,168,212,0.25)';
          g.fillRect(x - 28, yy - 48, 56, 4);
          g.fillRect(x - 28, yy + 20, 56, 4);
        }
        break;
      }
      case 'chisen': {
        // 塀勝也の「防災マップ」：地面に広がる予報図。発災ゲージが溜まるほど警告色が濃くなる。
        const d = Math.floor(t / 4) % 2 === 0 ? 0 : 1;
        const px = Math.round(p.x);
        const py = Math.round(p.y);
        // 発災ゲージ（0〜1）
        const charge = Math.min(1, (p.charge ?? 0) / 60);
        const warn = charge * charge;
        const bl = 220 - warn * 140; // 赤が濃くなる
        // 紙面（うっすらしたベージュ→発災前に警告の赤み）
        g.fillStyle = `rgba(${bl},${Math.round(215 - warn * 120)},${Math.round(192 - warn * 140)},${0.3 + warn * 0.25})`;
        g.fillRect(px - p.w / 2, py - 12, p.w, 28);
        g.fillStyle = 'rgba(180,170,130,0.55)';
        g.fillRect(px - p.w / 2, py - 12, p.w, 4);
        g.fillRect(px - p.w / 2, py + 12, p.w, 4);
        // 等高線（楕円の輪郭）＊縮小して地面に描く。発災が近いと震える
        const shk = warn > 0.5 && d ? 4 : 0;
        for (let i = 0; i < 3; i++) {
          pixEllipseOutline(g, px - 32 + i * 32 + shk, py + 4, 20 + i * 8, 8, `rgba(${Math.round(120 + warn * 100)},${Math.round(150 - warn * 90)},${Math.round(90 - warn * 40)},${0.6 + warn * 0.3})`);
        }
        // 川・集落の記号
        g.fillStyle = 'rgba(90,130,180,0.55)';
        g.fillRect(px + 40, py, 32, 4);
        g.fillStyle = 'rgba(150,110,70,0.5)';
        g.fillRect(px - 56, py + 4, 8, 4);
        g.fillRect(px - 44, py - 4, 8, 4);
        // 発災ゲージのバー
        g.fillStyle = 'rgba(20,16,8,0.6)';
        g.fillRect(px - 24, GROUND - 48, 48, 8);
        g.fillStyle = charge >= 1 ? '#ff4d3d' : d ? '#fbbf24' : '#e9a23b';
        g.fillRect(px - 20 + (charge >= 1 ? (d ? 4 : 0) : 0), GROUND - 48, Math.round(40 * charge), 8);
        // 中央の測量点（発災が近いと点滅して赤くなる）
        if (warn < 0.8 || d) {
          g.fillStyle = warn > 0.5 ? '#ff4d3d' : d ? '#c0392b' : '#e74c3c';
          g.fillRect(px - 4, py - 4, 8, 8);
        } else {
          g.fillStyle = '#ffb199';
          g.fillRect(px - 8, py - 8, 16, 16);
        }
        break;
      }
      case 'shock': {
        // 覚醒三重の「地面震撃」：地面を走る亀裂と砕けた瓦礫
        const d = p.vx >= 0 ? 1 : -1;
        const front = d === 1 ? x : x + 4;
        // 進行方向の盛り上がり
        g.fillStyle = '#e7dcc7';
        g.fillRect(front - (d === 1 ? 16 : 0), y - 16, 4, 12);
        g.fillRect(front - (d === 1 ? 8 : -4), y - 8, 4, 8);
        // 地を割る亀裂（一定間隔で後ろへ）
        for (let i = 0; i < 5; i++) {
          const bx = x - d * (8 + i * 12 + (Math.floor(t / 6) % 2) * 4);
          const len = 8 + (i % 3) * 4;
          g.fillStyle = i % 2 ? '#b9a57e' : '#8f7c5c';
          g.fillRect(Math.round(bx) - 4, y - 4, len, 4);
        }
        // 飛び散る破片
        const bob = Math.floor(t / 4) % 3;
        g.fillStyle = '#cbb690';
        g.fillRect(x - d * 12, y - 12 - bob * 4, 4, 4);
        g.fillStyle = '#e7dcc7';
        g.fillRect(x + d * 8, y - 8 - (bob === 2 ? 8 : 0), 4, 4);
        break;
      }
      case 'formula':
      case 'qed':
      case 'kusa':
        // drawn as text in the overlay layer
        break;
    }
  }

  private drawFx(e: PixelFx, t: number) {
    const g = this.g;
    const k = 1 - e.t / e.life;
    const x = Math.round(e.x);
    const y = Math.round(e.y);
    switch (e.kind) {
      case 'spark':
        g.globalAlpha = k;
        g.fillStyle = e.color;
        g.fillRect(x, y, e.size, e.size);
        g.globalAlpha = 1;
        break;
      case 'sound': {
        g.globalAlpha = k;
        const d = e.facing ?? 1;
        const reach = Math.round(e.size * e.t / e.life);
        for (let i = -1; i <= 1; i++) {
          g.fillStyle = i === 0 ? '#ffffff' : e.color;
          g.fillRect(x + d * reach, y + i * (16 + Math.floor(reach / 2)), 8, 8);
          g.fillRect(x + d * (reach + 12), y + i * (20 + Math.floor(reach / 2)), 12, 4);
        }
        g.globalAlpha = 1;
        break;
      }
      case 'ring': {
        const r = e.size * (e.t / e.life);
        g.globalAlpha = k;
        pixEllipseOutline(g, e.x, e.y, r, r * 0.7, e.color);
        g.globalAlpha = 1;
        break;
      }
      case 'dust':
        g.globalAlpha = k;
        g.fillStyle = e.color;
        g.fillRect(x, y, 4, 4);
        g.globalAlpha = 1;
        break;
      case 'crossburst':
        g.globalAlpha = k;
        g.fillStyle = e.color;
        g.fillRect(x, y - 4, 4, 12);
        g.fillRect(x - 4, y, 12, 4);
        g.globalAlpha = 1;
        break;
      case 'heart':
        g.globalAlpha = k;
        g.fillStyle = e.color;
        g.fillRect(x, y, 4, 4);
        g.fillRect(x + 8, y, 4, 4);
        g.fillRect(x - 4, y + 4, 20, 4);
        g.fillRect(x, y + 8, 12, 4);
        g.fillRect(x + 4, y + 12, 4, 4);
        g.globalAlpha = 1;
        break;
      case 'sparkle':
        g.globalAlpha = k;
        g.fillStyle = e.color;
        if (t % 6 < 3) {
          g.fillRect(x, y - 4, 4, 12);
          g.fillRect(x - 4, y, 12, 4);
        } else g.fillRect(x, y, 4, 4);
        g.globalAlpha = 1;
        break;
      case 'guard':
        g.globalAlpha = k;
        g.fillStyle = e.color;
        g.fillRect(x - 4, y - 36, 8, 72);
        g.fillRect(x - 12, y - 28, 8, 8);
        g.fillRect(x - 12, y + 20, 8, 8);
        g.globalAlpha = 1;
        break;
      case 'afterimage':
        if (e.look && e.pose && e.facing) drawFighter(g, e.x, e.y, e.look, { pose: e.pose, facing: e.facing, t, alpha: 0.35 * k });
        break;
      case 'soil':
        // 土砂の粒（重力で落ちる）
        g.globalAlpha = k;
        g.fillStyle = e.color;
        g.fillRect(x, y, e.size, e.size);
        g.globalAlpha = 1;
        break;
      case 'geyser': {
        // 地面から噴き上がる土の柱：伸びたあと細くなって消える
        const prog = e.t / e.life;
        const h = Math.round(e.size * Math.min(1, prog * 2.2));
        const w = Math.max(4, Math.round(20 * (1 - prog)));
        g.globalAlpha = Math.max(0, k * 1.4);
        g.fillStyle = '#8a6c46';
        g.fillRect(x - w, GROUND - h, w * 2 + 4, h + 4);
        g.fillStyle = '#b09264';
        g.fillRect(x - w + 4, GROUND - h, Math.max(4, w - 4), h + 4);
        // 先端の飛沫
        if (e.t % 3 < 2) {
          g.fillStyle = '#a3b18a';
          g.fillRect(x + (e.t % 5 === 0 ? 12 : -12), GROUND - h - 8, 4, 8);
        }
        g.globalAlpha = 1;
        break;
      }
      case 'crack': {
        // 地面のヒビ：中心から左右にギザギザが走り、じわじわ薄くなる
        const prog = e.t / e.life;
        const d = Math.round((e.size / 2) * Math.min(1, prog * 3));
        g.globalAlpha = Math.max(0, k);
        g.fillStyle = '#4a3a26';
        for (let i = 0; i < d; i += 12) {
          const jx = i % 24 === 0 ? 4 : i % 24 === 12 ? -4 : 0;
          g.fillRect(x - d + i + jx, e.y + (i % 16 === 0 ? 4 : 0), 16, 4);
          g.fillRect(x + d - i - 12 - jx, e.y + (i % 16 === 0 ? 4 : 0), 16, 4);
        }
        g.globalAlpha = 1;
        break;
      }
    }
  }

  private drawDarkness(b: Battle) {
    const g = this.g;
    const d = this.dark.getContext('2d')!;
    const a = Math.min(1, b.darkness / 30) * 0.88;
    d.setTransform(1, 0, 0, 1, 0, 0);
    d.globalCompositeOperation = 'source-over';
    d.clearRect(0, 0, W, H);
    d.fillStyle = `rgba(4,6,24,${a})`;
    d.fillRect(0, 0, W, H);
    d.globalCompositeOperation = 'destination-out';
    for (const f of b.f) {
      const grd = d.createRadialGradient(f.x, f.y - 88, 24, f.x, f.y - 88, 168);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = grd;
      d.fillRect(f.x - 168, f.y - 256, 336, 336);
    }
    for (const p of b.projectiles) {
      if (p.kind === 'kusa') continue;
      const grd = d.createRadialGradient(p.x, p.y, 8, p.x, p.y, 56);
      grd.addColorStop(0, 'rgba(0,0,0,0.9)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = grd;
      d.fillRect(p.x - 56, p.y - 56, 112, 112);
    }
    g.drawImage(this.dark, 0, 0);
    // stars
    g.fillStyle = `rgba(255,255,255,${a * 0.9})`;
    for (let i = 0; i < 30; i++) {
      if ((i + Math.floor(b.t / 20)) % 7 === 0) continue;
      g.fillRect(Math.floor(seeded(i) * W), Math.floor(seeded(i + 100) * 360), 4, 4);
    }
  }

  /** 超必殺だけ、いつもの背景に二階応援席の記憶が重なる。 */
  private drawCheerStands(t: number) {
    const g = this.g;
    g.fillStyle = 'rgba(22,29,53,0.8)';
    g.fillRect(0, 288, W, 256);
    for (let row = 0; row < 2; row++) {
      const y = 364 + row * 116;
      g.fillStyle = '#47516d';
      g.fillRect(0, y + 40, W, 12);
      g.fillStyle = '#c7cbd9';
      g.fillRect(0, y + 56, W, 4);
      for (let i = 0; i < 23; i++) {
        const x = i * 72 + (row ? 28 : 0);
        const clap = (Math.floor(t / 6) + i + row) % 2;
        g.fillStyle = '#1c2239';
        g.fillRect(x + 16, y - 20, 20, 20);
        g.fillStyle = i % 3 === 0 ? '#f5f4fa' : '#707f9f';
        g.fillRect(x + 8, y, 36, 36);
        g.fillStyle = '#e6c6b7';
        g.fillRect(x + (clap ? 16 : 0), y - (clap ? 4 : 20), 8, 16);
        g.fillRect(x + (clap ? 28 : 44), y - (clap ? 4 : 20), 8, 16);
      }
    }
    g.fillStyle = '#fda4af';
    g.fillRect(512, 468, 512, 68);
    g.fillStyle = '#29334e';
    g.font = `32px ${FONT}`;
    g.textAlign = 'center';
    g.fillText('理数科、最後まで！', W / 2, 516);
  }

  // ═══════════════════════ STAGES ═══════════════════════
  drawStage(stage: StageId, t: number) {
    switch (stage) {
      case 'classroom':
        this.stageClassroom(t);
        break;
      case 'lake':
        this.stageLake(t);
        break;
      case 'sakura':
        this.stageSakura(t);
        break;
      case 'hawaii':
        this.stageHawaii(t);
        break;
    }
  }

  private stageClassroom(t: number) {
    const g = this.g;
    // wall
    g.fillStyle = '#ece6d3';
    g.fillRect(0, 0, W, 600);
    g.fillStyle = '#d8c9a4';
    g.fillRect(0, 512, W, 88);
    g.fillStyle = '#b39a6c';
    g.fillRect(0, 512, W, 4);
    g.fillRect(0, 596, W, 4);
    // floor
    g.fillStyle = '#c9a06a';
    g.fillRect(0, 600, W, 144);
    g.fillStyle = '#b98a58';
    g.fillRect(0, 744, W, 120);
    g.fillStyle = '#a3774a';
    for (let x = 0; x < W; x += 128) {
      g.fillRect(x, 600, 4, 264);
      g.fillRect(x + 64, 744, 4, 120);
    }
    g.fillRect(0, 744, W, 4);
    g.fillStyle = '#9a6e42';
    g.fillRect(0, 800, W, 4);
    // window
    g.fillStyle = '#8fc7ee';
    g.fillRect(56, 104, 368, 336);
    g.fillStyle = '#b9deff';
    g.fillRect(80, 136, 104, 24);
    g.fillRect(240, 192, 120, 20);
    g.fillRect(120, 248, 80, 16);
    // outdoor AC unit (室外機) seen through the window
    g.fillStyle = '#a7adb3';
    g.fillRect(224, 280, 136, 104);
    g.fillStyle = '#7f858c';
    g.fillRect(224, 280, 136, 8);
    g.fillRect(224, 376, 136, 8);
    pixCircle(g, 280, 332, 32, '#5c6166');
    g.fillStyle = '#3f4448';
    const a = t * 0.25;
    for (let i = 0; i < 3; i++) {
      const ang = a + (i * Math.PI * 2) / 3;
      g.fillRect(Math.round(280 + Math.cos(ang) * 16), Math.round(332 + Math.sin(ang) * 16), 8, 8);
    }
    g.fillStyle = '#cfd4d8';
    g.fillRect(324, 296, 24, 12);
    g.fillRect(324, 320, 24, 12);
    // window frame
    g.fillStyle = '#f5f5f5';
    g.fillRect(48, 96, 384, 8);
    g.fillRect(48, 440, 384, 8);
    g.fillRect(48, 96, 8, 352);
    g.fillRect(424, 96, 8, 352);
    g.fillRect(236, 96, 8, 352);
    g.fillRect(48, 264, 384, 8);
    g.fillStyle = '#d9d9d9';
    g.fillRect(40, 448, 400, 12);
    // blackboard
    g.fillStyle = '#6b4a2b';
    g.fillRect(504, 112, 624, 352);
    g.fillStyle = '#2f5d4a';
    g.fillRect(520, 128, 592, 312);
    g.fillStyle = '#8a6a48';
    g.fillRect(504, 464, 624, 12);
    g.fillStyle = '#f1f5e9';
    g.fillRect(560, 464, 24, 8);
    g.fillRect(600, 464, 16, 8);
    g.font = `40px ${FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(241,245,233,0.9)';
    g.fillText('糸魚川-静岡構造線', 544, 192);
    g.font = `64px ${FONT}`;
    g.fillText('味噌', 560, 312);
    g.font = `32px ${FONT}`;
    g.fillText('西=丸餅  東=角餅', 544, 392);
    for (let i = 0; i < 3; i++) pixEllipseOutline(g, 960, 312, 40 + i * 32, 24 + i * 20, 'rgba(241,245,233,0.75)');
    drawCross(g, 1064, 176, 'rgba(241,245,233,0.85)', 'rgba(241,245,233,0.85)');
    // clock
    pixCircle(g, 1200, 64, 28, '#f8fafc');
    pixEllipseOutline(g, 1200, 64, 28, 28, '#1f2937');
    g.fillStyle = '#1f2937';
    g.fillRect(1200, 48, 4, 20);
    g.fillRect(1200, 64, 16, 4);
    // vending machine
    g.fillStyle = '#d23c3c';
    g.fillRect(1336, 440, 160, 304);
    g.fillStyle = '#a82a2a';
    g.fillRect(1336, 440, 160, 12);
    g.fillRect(1336, 440, 8, 304);
    g.fillStyle = '#20263a';
    g.fillRect(1356, 472, 120, 120);
    const cans = ['#fde68a', '#60a5fa', '#f87171', '#a3e635', '#fbbf24', '#e2e8f0'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
      const sold = r === 0 && i === 4;
      g.fillStyle = sold ? '#374151' : cans[(i + r) % cans.length];
      g.fillRect(1364 + i * 20, 484 + r * 36, 12, 24);
    }
    g.fillStyle = '#fef3c7';
    g.fillRect(1356, 608, 120, 36);
    g.fillStyle = '#dc2626';
    g.font = `28px ${FONT}`;
    g.fillText('ｺｰﾝｽｰﾌﾟ 売切', 1360, 636);
    g.fillStyle = '#111827';
    g.fillRect(1356, 664, 120, 40);
    g.fillStyle = '#4b5563';
    g.fillRect(1372, 676, 88, 16);
    // desks (back row)
    for (let i = 0; i < 6; i++) {
      const x = 88 + i * 240;
      g.fillStyle = '#d6b27a';
      g.fillRect(x, 624, 112, 16);
      g.fillStyle = '#7a5a3a';
      g.fillRect(x + 8, 640, 8, 48);
      g.fillRect(x + 96, 640, 8, 48);
      g.fillStyle = '#8b7355';
      g.fillRect(x + 32, 648, 48, 8);
      g.fillRect(x + 36, 656, 8, 32);
      g.fillRect(x + 68, 656, 8, 32);
    }
    // Heikatsu, looking out of the window
    const looking = t % 720 < 150;
    drawFighter(g, 176, 704, EXTRA_LOOKS.heikatsu, { pose: looking ? 'pointUp' : 'idle', facing: -1, t, alpha: 0.95 });
    if (looking && Math.floor(t / 30) % 2 === 0) {
      g.fillStyle = '#f8fafc';
      g.fillRect(192, 488, 48, 24);
      g.fillStyle = '#111';
      g.fillRect(200, 500, 4, 4);
      g.fillRect(212, 500, 4, 4);
      g.fillRect(224, 500, 4, 4);
    }
  }

  private stageLake(t: number) {
    const g = this.g;
    const bands: [number, number, string][] = [
      [0, 120, '#7dbcff'],
      [120, 240, '#93c8ff'],
      [240, 360, '#aed6ff'],
      [360, 464, '#c9e5ff'],
    ];
    for (const [y0, y1, c] of bands) {
      g.fillStyle = c;
      g.fillRect(0, y0, W, y1 - y0);
    }
    pixCircle(g, 1272, 104, 36, '#fff4b0');
    g.fillStyle = 'rgba(255,244,176,0.35)';
    g.fillRect(1216, 100, 112, 8);
    g.fillRect(1268, 48, 8, 112);
    // clouds
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 388 + t * 0.32) % (W + 240)) - 120;
      const cy = 72 + (i % 2) * 56 + i * 20;
      g.fillRect(Math.round(cx), cy, 104, 24);
      g.fillRect(Math.round(cx) + 24, cy - 16, 48, 16);
    }
    // hills with contour lines
    const hills: [number, number, number, string][] = [
      [160, 240, 160, '#6aa878'],
      [600, 360, 208, '#5c9a6a'],
      [1080, 280, 176, '#68a676'],
      [1440, 220, 136, '#5c9a6a'],
      [380, 200, 96, '#4e8a5c'],
      [860, 192, 88, '#4e8a5c'],
      [1320, 160, 80, '#4e8a5c'],
    ];
    for (const [cx, rx, ry, c] of hills) {
      pixEllipse(g, cx, 464, rx, ry, c, true);
      for (let i = 1; i <= 3; i++) pixEllipseOutline(g, cx, 464, rx * (1 - i * 0.22), ry * (1 - i * 0.22), 'rgba(255,255,255,0.22)', true);
    }
    // lake
    g.fillStyle = '#3f86c6';
    g.fillRect(0, 464, W, 184);
    g.fillStyle = '#5aa0dc';
    g.fillRect(0, 464, W, 8);
    for (let i = 0; i < 26; i++) {
      const x = Math.round((i * 148 + t * (1.6 + (i % 3) * 0.8)) % (W + 80)) - 40;
      const y = 480 + ((i * 52) % 152);
      g.fillStyle = i % 2 ? '#9fd0ff' : '#7ab8ec';
      g.fillRect(x, y, 24 + (i % 3) * 12, 4);
    }
    // path
    g.fillStyle = '#d9c9a6';
    g.fillRect(0, 648, W, 216);
    g.fillStyle = '#b9a77f';
    g.fillRect(0, 648, W, 4);
    g.fillRect(0, 744, W, 4);
    g.fillStyle = '#c4b08a';
    g.fillRect(0, 748, W, 116);
    g.fillStyle = '#e6d8b8';
    for (let x = 0; x < W; x += 96) g.fillRect(x + 32, 800, 32, 4);
    // fence
    g.fillStyle = '#8b6f4a';
    for (let x = 24; x < W; x += 160) g.fillRect(x, 600, 8, 52);
    g.fillRect(0, 612, W, 4);
    g.fillRect(0, 632, W, 4);
    // joggers
    for (const j of this.joggers) {
      j.x = (j.x + j.v) % (W + 80);
      const x = Math.round(j.x) - 40;
      const step = Math.floor(t / 6) % 2;
      g.fillStyle = '#f3d4b4';
      g.fillRect(x, 584, 8, 8);
      g.fillStyle = j.c;
      g.fillRect(x, 592, 8, 16);
      g.fillStyle = '#243059';
      g.fillRect(x - step * 4, 608, 4, 8);
      g.fillRect(x + 4 + step * 4, 608, 4, 8);
    }
    // a ✝ reflected in the water (両馬談)
    const cx = 800 + Math.round(Math.sin(t / 40) * 12);
    drawCross(g, cx, 560, 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.5)');
  }

  private stageSakura(t: number) {
    const g = this.g;
    const bands: [number, number, string][] = [
      [0, 160, '#f4cfe0'],
      [160, 320, '#f7dbe8'],
      [320, 480, '#fbe7f0'],
      [480, 680, '#fdf0f5'],
    ];
    for (const [y0, y1, c] of bands) {
      g.fillStyle = c;
      g.fillRect(0, y0, W, y1 - y0);
    }
    // 南棟 (left, brighter)
    g.fillStyle = '#e3e7ee';
    g.fillRect(0, 144, 296, 536);
    g.fillStyle = '#c9d0da';
    g.fillRect(0, 144, 296, 12);
    for (let r = 0; r < 5; r++) for (let i = 0; i < 3; i++) {
      g.fillStyle = (r + i) % 3 === 0 ? '#fff4c2' : '#bcd7f0';
      g.fillRect(32 + i * 88, 184 + r * 96, 56, 48);
    }
    g.fillStyle = '#9aa4b4';
    g.fillRect(0, 600, 296, 80);
    g.fillStyle = '#5b6474';
    g.fillRect(120, 616, 56, 64);
    // 北棟 (right, a bit shabbier)
    g.fillStyle = '#cfd0d2';
    g.fillRect(1240, 208, 296, 472);
    g.fillStyle = '#b3b5b9';
    g.fillRect(1240, 208, 296, 12);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) {
      g.fillStyle = '#c8d4e6';
      g.fillRect(1272 + i * 88, 248 + r * 96, 56, 48);
    }
    g.fillStyle = '#9aa0a6';
    g.fillRect(1384, 512, 48, 32);
    g.fillStyle = '#5c6166';
    g.fillRect(1396, 520, 16, 16);
    g.fillStyle = '#8f9299';
    g.fillRect(1240, 600, 296, 80);
    g.fillStyle = '#4b4f57';
    g.fillRect(1360, 616, 56, 64);
    g.font = `36px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#334155';
    g.fillText('南棟', 148, 136);
    g.fillText('北棟', 1388, 200);
    g.font = `24px ${FONT}`;
    g.fillStyle = '#64748b';
    g.fillText('偏差値70', 148, 592);
    g.fillText('偏差値60', 1388, 592);
    // ground
    g.fillStyle = '#d8cfc0';
    g.fillRect(0, 680, W, 184);
    g.fillStyle = '#c4b9a8';
    g.fillRect(0, 680, W, 4);
    g.fillRect(0, 744, W, 4);
    for (let x = 0; x < W; x += 80) {
      g.fillRect(x, 784, 40, 4);
      g.fillRect(x + 40, 824, 40, 4);
    }
    // trees
    const trunks = [400, 640, 888, 1136];
    for (const tx of trunks) {
      g.fillStyle = '#6b4a32';
      g.fillRect(tx - 12, 472, 24, 216);
      g.fillRect(tx - 28, 504, 16, 8);
      g.fillRect(tx + 12, 488, 20, 8);
      const cols = ['#f9b8cf', '#f6a5c1', '#fcd5e3'];
      pixEllipse(g, tx, 432, 104, 72, cols[1]);
      pixEllipse(g, tx - 40, 400, 64, 48, cols[0]);
      pixEllipse(g, tx + 48, 392, 64, 48, cols[2]);
      pixEllipse(g, tx, 368, 48, 36, cols[0]);
    }
    // petals on the ground
    g.fillStyle = '#f9b8cf';
    for (let i = 0; i < 30; i++) g.fillRect(Math.floor(seeded(i + 7) * W), 688 + Math.floor(seeded(i + 40) * 168), 8, 4);
    // falling petals
    for (const p of this.petals) {
      p.ph += 0.05;
      p.x += p.vx + Math.sin(p.ph) * 1.6;
      p.y += p.vy;
      if (p.y > H || p.x > W + 16) {
        p.y = -16;
        p.x = Math.random() * W - 80;
      }
      g.fillStyle = Math.floor(p.ph) % 2 ? '#f9b8cf' : '#fde2ec';
      g.fillRect(Math.round(p.x), Math.round(p.y), 8, 8);
    }
    void t;
  }

  private stageHawaii(t: number) {
    const g = this.g;
    const bands: [number, number, string][] = [
      [0, 112, '#4c1d5e'],
      [112, 208, '#7a2f6b'],
      [208, 304, '#b8446a'],
      [304, 392, '#e8714f'],
      [392, 488, '#ffa552'],
    ];
    for (const [y0, y1, c] of bands) {
      g.fillStyle = c;
      g.fillRect(0, y0, W, y1 - y0);
    }
    pixEllipse(g, 1200, 488, 104, 104, '#fff0b0', true);
    // volcano
    for (let y = 232; y < 488; y++) {
      const k = (y - 232) / 256;
      const l = Math.round(600 - k * 400);
      const r = Math.round(704 + k * 600);
      g.fillStyle = '#2a1a2a';
      g.fillRect(l, y, r - l, 1);
    }
    g.fillStyle = '#ff6a1a';
    g.fillRect(608, 228, 88, 8);
    const fl = Math.floor(t / 6) % 3;
    g.fillStyle = '#ffb347';
    g.fillRect(632 + fl * 12, 220, 12, 8);
    // smoke
    g.fillStyle = 'rgba(200,180,200,0.45)';
    for (let i = 0; i < 6; i++) {
      const yy = 200 - ((t * 1.2 + i * 48) % 240);
      g.fillRect(640 + Math.round(Math.sin(t / 30 + i) * 24) + i * 8, Math.round(yy), 24 + i * 4, 12);
    }
    // stars in the upper sky
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 18; i++) if ((i + Math.floor(t / 25)) % 5 !== 0) g.fillRect(Math.floor(seeded(i + 3) * W), Math.floor(seeded(i + 50) * 160), 4, 4);
    // lava field
    g.fillStyle = '#1a1416';
    g.fillRect(0, 488, W, 376);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = seeded(i) < 0.5 ? '#231b1e' : '#120e10';
      g.fillRect(Math.floor(seeded(i + 11) * W), 488 + Math.floor(seeded(i + 23) * 376), 8 + Math.floor(seeded(i + 5) * 24), 4);
    }
    g.fillStyle = '#2a2224';
    g.fillRect(0, 744, W, 4);
    // glowing cracks
    const glow = 0.55 + 0.45 * Math.sin(t / 12);
    const cracks: [number, number, number][] = [
      [120, 784, 160],
      [480, 824, 240],
      [920, 768, 120],
      [1200, 840, 200],
      [720, 680, 96],
      [160, 560, 136],
      [1320, 600, 104],
    ];
    for (const [x, y, len] of cracks) {
      for (let i = 0; i < len; i += 12) {
        const yy = y + Math.round(Math.sin(i / 20 + x) * 8);
        g.fillStyle = `rgba(255,${110 + Math.floor(60 * glow)},26,${0.5 + glow * 0.5})`;
        g.fillRect(x + i, yy, 8, 4);
      }
    }
    g.fillStyle = `rgba(255,140,40,${0.25 * glow})`;
    g.fillRect(0, 488, W, 376);
  }

  // ═══════════════════════ OVERLAY LAYER (1x, crisp text) ═══════════════════════
  private txt(text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center', outline: string | null = '#000', ow?: number, baseline: CanvasTextBaseline = 'middle') {
    const c = this.c;
    c.font = `${size}px ${FONT}`;
    c.textAlign = align;
    c.textBaseline = baseline;
    c.lineJoin = 'round';
    if (outline) {
      c.lineWidth = ow ?? Math.max(1, size / 5);
      c.strokeStyle = outline;
      c.strokeText(text, x, y);
    }
    c.fillStyle = color;
    c.fillText(text, x, y);
  }

  private drawOverlay(b: Battle) {
    const c = this.c;
    c.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    c.clearRect(0, 0, W, H);
    const sx = b.shake > 0 ? (Math.random() - 0.5) * b.shake : 0;
    const sy = b.shake > 0 ? (Math.random() - 0.5) * b.shake * 0.6 : 0;
    c.translate(sx, sy);

    // projectile texts
    for (const p of b.projectiles) {
      if (p.kind === 'formula') this.txt(p.text ?? '∑', p.x, p.y, 32 + Math.sin(p.t / 4) * 4, '#ffffff', 'center', '#1e3a8a');
      else if (p.kind === 'qed') this.txt('Q.E.D.', p.x, p.y, 40, '#fde68a', 'center', '#7c2d12');
      else if (p.kind === 'kusa') this.txt('草', p.x, p.y, 32, '#4ade80', 'center', '#052e16');
    }

    // fighter status labels
    for (const f of b.f) {
      if (f.silence > 0 && f.state !== 'down') this.txt(`沈黙 ${Math.ceil(f.silence / 60)}`, f.x, f.y - 208, 20, '#e2e8f0');
      if (f.hp > 0 && b.phase === 'fight' && f.def.airControl) {
        const ay = Math.min(GROUND + 28, f.y + 28);
        const width = 80;
        c.fillStyle = '#172033';
        c.fillRect(f.x - width / 2 - 4, ay - 8, width + 8, 16);
        c.fillStyle = f.airLift > 0 ? '#7dd3fc' : '#64748b';
        c.fillRect(f.x - width / 2, ay - 4, width * f.airLift / f.def.airControl.liftFrames, 8);
        this.txt(`AIR  ${f.airUsed & 1 ? '－' : '弱'} ${f.airUsed & 2 ? '－' : '強'}`, f.x, ay + 24, 15.2, '#e0f2fe');
      }
      if (f.rallyT > 0 && f.hp > 0) this.txt(`声援↑ ${Math.ceil(f.rallyT / 60)}`, f.x, f.y - 196, 18, '#bae6fd');
      if (f.id === 'sakura' && f.hp > 0 && b.phase === 'fight') {
        // 研究データ n（超必殺の威力に反映）／理論のない状態の恋の残り時間
        if (f.loveT > 0) this.txt(`恋 ${Math.ceil(f.loveT / 60)}`, f.x, f.y - 200, 20, '#f9a8d4');
        else if (f.research > 0) this.txt(`n=${f.research}`, f.x, f.y - 200, 18, f.research >= 15 ? '#f0abfc' : '#e9d5ff');
      }
      if (b.phase === 'intro' || (b.phase === 'fight' && b.phaseT < 150)) {
        const tag = f.tag ?? (f.ai ? 'CPU' : f.side === 0 ? '1P' : '2P');
        const bob = Math.sin(b.t / 6) * 6;
        this.txt(`${tag}▼`, f.x, f.y - 224 + bob, 22, f.you || tag === 'あなた' ? '#fde68a' : f.def.color);
      }
      // チームカラーの足元マーカー（チーム戦のみ）
      if (!b.isDuel && f.hp > 0 && b.phase !== 'matchEnd') {
        this.txt(f.team === 0 ? '●' : '●', f.x, f.y + 14, 20, f.team === 0 ? '#38bdf8' : '#fb7185');
      }
    }

    // text fx
    for (const e of b.texts) {
      const k = e.t < e.life - 10 ? 1 : (e.life - e.t) / 10;
      c.globalAlpha = Math.max(0, k);
      const jx = e.shake ? (Math.random() - 0.5) * 8 : 0;
      const jy = e.shake ? (Math.random() - 0.5) * 8 : 0;
      const pop = e.t < 4 ? 1 + (4 - e.t) * 0.12 : 1;
      this.txt(e.text, e.x + jx, e.y + jy, e.size * pop, e.color);
      c.globalAlpha = 1;
    }

    // bubbles
    for (const bb of b.bubbles) {
      const f = b.f[bb.idx] ?? b.f[0];
      const k = bb.t < bb.life - 8 ? 1 : (bb.life - bb.t) / 8;
      const grow = Math.min(1, bb.t / 4);
      c.globalAlpha = k;
      c.font = `24px ${FONT}`;
      const tw = c.measureText(bb.text).width;
      const w = (tw + 32) * grow;
      const h = 44 * grow;
      let x = f.x;
      x = Math.max(w / 2 + 8, Math.min(W - w / 2 - 8, x));
      const y = f.y - 240 - (f.state === 'crouch' ? -24 : 0);
      c.fillStyle = '#ffffff';
      c.fillRect(x - w / 2, y - h / 2, w, h);
      c.strokeStyle = '#1f2937';
      c.lineWidth = 4;
      c.strokeRect(x - w / 2, y - h / 2, w, h);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(f.x - 8, y + h / 2);
      c.lineTo(f.x + 8, y + h / 2);
      c.lineTo(f.x, y + h / 2 + 12);
      c.fill();
      if (grow >= 1) this.txt(bb.text, x, y + 2, 24, '#111827', 'center', null);
      c.globalAlpha = 1;
    }

    // Heikatsu mumble on classroom
    if (b.stage === 'classroom' && b.t % 720 < 150 && Math.floor(b.t / 40) % 2 === 0) this.txt('（地面は忘れない……）', 176, 496, 18, '#475569', 'center', null);

    this.drawHud(b);
    this.drawBanner(b);
  }

  private drawHud(b: Battle) {
    if (!b.isDuel) {
      this.drawTeamHud(b);
      return;
    }
    const c = this.c;
    const [p1, p2] = b.f;
    const barY = 32;
    const barH = 28;
    const barW = 608;
    const drawBar = (f: Fighter, right: boolean) => {
      const x0 = right ? W - 64 - barW : 64;
      c.fillStyle = '#0f1016';
      c.fillRect(x0 - 4, barY - 4, barW + 8, barH + 8);
      const gw = (f.ghostHp / f.def.hp) * barW;
      const hw = (f.hp / f.def.hp) * barW;
      c.fillStyle = '#dc2626';
      c.fillRect(right ? W - 64 - gw : 64, barY, gw, barH);
      const low = f.hp / f.def.hp < 0.3;
      c.fillStyle = low ? (b.t % 20 < 10 ? '#fb923c' : '#fde047') : '#fde047';
      c.fillRect(right ? W - 64 - hw : 64, barY, hw, barH);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(right ? W - 64 - hw : 64, barY, hw, 8);
      const nx = right ? W - 64 : 64;
      this.txt(f.def.name, nx, barY + barH + 24, 28, '#ffffff', right ? 'right' : 'left');
      this.txt(f.def.title, nx, barY + barH + 52, 16.8, f.def.color, right ? 'right' : 'left', '#000', 4);
      // オンライン対戦ではプレイヤー名（自分は金色）をキャラ名の下に添える
      if (b.opts.online && f.tag) {
        this.txt(f.tag, nx, barY + barH + 78, 16.8, f.you ? '#fde68a' : '#cbd5e1', right ? 'right' : 'left', '#000', 4);
      }
      // meter
      const mw = 472;
      const my = 820;
      const mx = right ? W - 64 - mw : 64;
      c.fillStyle = '#0f1016';
      c.fillRect(mx - 4, my - 4, mw + 8, 24);
      const full = f.meter >= 100;
      const fw = (Math.min(100, f.meter) / 100) * mw;
      c.fillStyle = full ? (b.t % 10 < 5 ? '#ffffff' : f.def.color) : f.def.color;
      c.fillRect(right ? W - 64 - fw : 64, my, fw, 16);
      this.txt(full ? '✝本質✝ MAX' : '✝本質✝', right ? W - 64 : 64, my - 20, 18, full ? '#fff' : '#cbd5e1', right ? 'right' : 'left', '#000', 4);
      if (full) {
        const bob = Math.sin(b.t / 5) * 4.8;
        this.txt('超必殺 OK', right ? W - 64 - mw - 16 : 64 + mw + 16, my + 4 + bob, 20, '#fde68a', right ? 'right' : 'left');
      }
      if (f.combo >= 2 && f.comboTimer > 0) {
        const cx = right ? W - 240 : 240;
        this.txt(`${f.combo}`, cx, 232, 64, f.def.color);
        this.txt('HIT', cx + (right ? -56 : 56), 240, 28, '#fff');
      }
    };
    drawBar(p1, false);
    drawBar(p2, true);
    // timer
    c.fillStyle = '#0f1016';
    c.fillRect(696, 16, 144, 72);
    c.strokeStyle = '#475569';
    c.lineWidth = 4;
    c.strokeRect(698, 18, 140, 68);
    const sec = b.timerSec;
    this.txt(String(sec), 768, 54, 52, sec <= 10 ? '#f87171' : '#ffffff', 'center', '#000', 8);
    // round marks
    for (let i = 0; i < 2; i++) {
      this.txt('✝', 744 - i * 32 - 48, 112, 32, b.wins[0] > i ? '#fde68a' : '#334155', 'center', '#000', 6);
      this.txt('✝', 792 + i * 32 + 48, 112, 32, b.wins[1] > i ? '#fde68a' : '#334155', 'center', '#000', 6);
    }
    this.txt(`ROUND ${b.round}`, 768, 112, 18, '#cbd5e1');
  }

  /** チーム戦（同時乱戦）用HUD：両チームのメンバーをコンパクトに並べる */
  private drawTeamHud(b: Battle) {
    const c = this.c;
    const team0 = b.f.filter((f) => f.team === 0);
    const team1 = b.f.filter((f) => f.team === 1);
    const drawList = (list: Fighter[], right: boolean, teamColor: string, label: string) => {
      const x0 = right ? W - 32 : 32;
      const align = right ? ('right' as const) : ('left' as const);
      this.txt(label, x0, 28, 20, teamColor, align, '#000', 4);
      list.forEach((f, i) => {
        const y = 52 + i * 52;
        const w = 416;
        const bx = right ? W - 32 - w : 32;
        // 名前＋タグ
        const tag = f.tag ? `(${f.tag})` : '';
        const nameColor = f.hp <= 0 ? '#64748b' : f.you ? '#fde68a' : '#ffffff';
        this.txt(`${f.def.name}${tag}`, right ? W - 32 : 32, y, 18, nameColor, align, '#000', 4);
        // HPバー
        c.fillStyle = '#0f1016';
        c.fillRect(bx - 4, y + 8, w + 8, 16);
        const hw = (Math.max(0, f.hp) / f.def.hp) * w;
        c.fillStyle = f.hp <= 0 ? '#334155' : f.hp / f.def.hp < 0.3 ? (b.t % 20 < 10 ? '#fb923c' : '#fde047') : '#fde047';
        c.fillRect(right ? W - 32 - hw : 32, y + 12, hw, 8);
        // ゲージ（細バー）
        const mw = (Math.min(100, f.meter) / 100) * w;
        c.fillStyle = f.meter >= 100 ? (b.t % 10 < 5 ? '#ffffff' : f.def.color) : '#475569';
        c.fillRect(right ? W - 32 - mw : 32, y + 24, mw, 4);
        // メーターMAX表示
        if (f.meter >= 100 && f.hp > 0) this.txt('✝', right ? W - 32 - w - 16 : 32 + w + 16, y + 16, 20, '#fde68a', 'center');
      });
    };
    drawList(team0, false, '#38bdf8', '青');
    drawList(team1, true, '#fb7185', '赤');
    // timer
    c.fillStyle = '#0f1016';
    c.fillRect(696, 16, 144, 72);
    c.strokeStyle = '#475569';
    c.lineWidth = 4;
    c.strokeRect(698, 18, 140, 68);
    const sec = b.timerSec;
    this.txt(String(sec), 768, 54, 52, sec <= 10 ? '#f87171' : '#ffffff', 'center', '#000', 8);
    // round marks（チームの勝利数）
    for (let i = 0; i < 2; i++) {
      this.txt('✝', 744 - i * 32 - 48, 112, 32, b.wins[0] > i ? '#38bdf8' : '#334155', 'center', '#000', 6);
      this.txt('✝', 792 + i * 32 + 48, 112, 32, b.wins[1] > i ? '#fb7185' : '#334155', 'center', '#000', 6);
    }
    this.txt(`ROUND ${b.round}`, 768, 112, 18, '#cbd5e1');
    // コンボ表示（チーム戦は発生位置の近くに）
    for (const f of b.f) {
      if (f.combo >= 2 && f.comboTimer > 0) {
        this.txt(`${f.combo}HIT`, Math.max(80, Math.min(W - 80, f.x)), f.y - 272, 28, f.def.color);
      }
    }
  }

  private drawBanner(b: Battle) {
    const bn = b.banner;
    if (!bn) return;
    const c = this.c;
    const k = bn.t < bn.life - 15 ? 1 : (bn.life - bn.t) / 15;
    const pop = bn.t < 6 ? 1 + (6 - bn.t) * 0.12 : 1;
    c.globalAlpha = Math.max(0, k);
    if (bn.big) {
      c.save();
      c.translate(W / 2, 384);
      c.scale(pop, pop);
      const jitter = bn.t < 10 ? (Math.random() - 0.5) * 8 : 0;
      this.txt(bn.text, jitter, 0, 96, bn.color, 'center', '#000', 20);
      if (bn.sub) this.txt(bn.sub, 0, 80, 32, '#ffffff');
      c.restore();
    } else {
      c.fillStyle = 'rgba(10,10,20,0.72)';
      c.fillRect(0, 176, W, bn.sub ? 104 : 72);
      c.fillStyle = bn.color;
      c.fillRect(0, 176, W, 4);
      c.fillRect(0, bn.sub ? 276 : 244, W, 4);
      c.save();
      c.translate(W / 2, 212);
      c.scale(pop, 1);
      this.txt(`✝ ${bn.text} ✝`, 0, 0, 36, bn.color, 'center', '#000', 8);
      c.restore();
      if (bn.sub) this.txt(bn.sub, W / 2, 256, 22, '#e2e8f0');
    }
    c.globalAlpha = 1;
  }
}

/** タイトル画面用のデモシーン */
export function drawTitleScene(g: CanvasRenderingContext2D, t: number, ids: CharId[]) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, W, H);
  // night-ish sky with crosses
  const bands: [number, number, string][] = [
    [0, 200, '#141a3a'],
    [200, 400, '#1e2a5a'],
    [400, 600, '#2c3f7a'],
    [600, 744, '#3f5aa0'],
  ];
  for (const [y0, y1, c] of bands) {
    g.fillStyle = c;
    g.fillRect(0, y0, W, y1 - y0);
  }
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 40; i++) if ((i + Math.floor(t / 20)) % 6 !== 0) g.fillRect(Math.floor(seeded(i + 9) * W), Math.floor(seeded(i + 90) * 480), 4, 4);
  for (let i = 0; i < 10; i++) {
    const y = (t * (1.2 + (i % 3) * 0.6) + i * 188) % (H + 120) - 60;
    const x = (i * 164 + Math.sin(t / 50 + i) * 24) % W;
    drawCross(g, x, y, `rgba(253,230,138,${0.2 + (i % 3) * 0.1})`, 'rgba(255,255,255,0.3)');
  }
  // buildings silhouettes
  g.fillStyle = '#0b0f26';
  g.fillRect(0, 280, 320, 464);
  g.fillRect(1216, 360, 320, 384);
  g.fillStyle = '#fde68a';
  for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) if ((r * 3 + i + Math.floor(t / 90)) % 4 !== 0) g.fillRect(40 + i * 88, 320 + r * 96, 48, 40);
  g.fillStyle = '#93c5fd';
  for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) if ((r + i) % 2 === 0) g.fillRect(1256 + i * 88, 400 + r * 96, 48, 40);
  // ground
  g.fillStyle = '#1b2447';
  g.fillRect(0, 744, W, 120);
  g.fillStyle = '#2b3868';
  g.fillRect(0, 744, W, 4);
  // sakura
  for (const tx of [480, 1056]) {
    g.fillStyle = '#3a2a2a';
    g.fillRect(tx - 12, 520, 24, 224);
    pixEllipse(g, tx, 488, 104, 64, '#c96a8f');
    pixEllipse(g, tx - 32, 448, 64, 48, '#d97ea2');
    pixEllipse(g, tx + 40, 440, 56, 40, '#e79ab9');
  }
  // fighters in a row
  const n = ids.length;
  ids.forEach((id, i) => {
    const x = Math.round(W / 2 + (i - (n - 1) / 2) * 176);
    const def = CHARS[id];
    drawShadow(g, x, GROUND, 0);
    const pose = Math.floor((t + i * 60) / 240) % 4 === 0 ? 'win' : 'idle';
    drawFighter(g, x, GROUND, def.look, { pose, facing: i < n / 2 ? 1 : -1, t: t + i * 13 });
  });
}
