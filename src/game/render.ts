import { CHARS, EXTRA_LOOKS } from './characters';
import { GROUND, H, W, type Battle, type Fighter, type PixelFx, type Projectile } from './engine';
import { drawFighter, drawShadow } from './sprites';
import type { CharId, StageId } from './types';

export const SCALE = 3;
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
    g.fillRect(Math.round(cx - hw), y, Math.max(1, Math.round(hw * 2)), 1);
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
    g.fillRect(Math.round(cx - hw), y, 1, 1);
    g.fillRect(Math.round(cx + hw) - 1, y, 1, 1);
  }
}

function pixCircle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  pixEllipse(g, cx, cy, r, r, color);
}

function drawCross(g: CanvasRenderingContext2D, x: number, y: number, c1: string, c2: string, s = 1) {
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
    for (let i = 0; i < 40; i++) this.petals.push({ x: Math.random() * W, y: Math.random() * H, vx: 0.3 + Math.random() * 0.4, vy: 0.4 + Math.random() * 0.5, ph: Math.random() * 10 });
    this.joggers = [
      { x: 40, v: 0.35, c: '#f87171' },
      { x: 160, v: 0.5, c: '#60a5fa' },
      { x: 300, v: 0.28, c: '#fbbf24' },
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

    // ground props (items) behind fighters
    for (const p of b.projectiles) if (p.item || p.kind === 'vending') this.drawProjectile(p, b.t);

    // fighters: draw the "active" ones last
    const isActive = (f: Fighter) => f.state === 'attack' || f.state === 'super' || f.state === 'launch';
    const order = [...b.f].sort((p, q) => Number(isActive(p)) - Number(isActive(q)));
    for (const f of order) this.drawFighter(f, b);

    for (const p of b.projectiles) if (!p.item && p.kind !== 'vending') this.drawProjectile(p, b.t);
    for (const e of b.fx) this.drawFx(e, b.t);

    if (b.darkness > 0) this.drawDarkness(b);
    if (b.flash > 0) {
      g.fillStyle = `rgba(255,255,255,${Math.min(1, b.flash / 10)})`;
      g.fillRect(-10, -10, W + 20, H + 20);
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
        g.fillRect(Math.round(f.x + Math.cos(ang) * 12), Math.round(f.y - 24 + Math.sin(ang) * 16), 2, 2);
      }
    }
    if (f.state === 'stun') {
      g.fillStyle = '#fde047';
      for (let i = 0; i < 3; i++) {
        const ang = (i / 3) * Math.PI * 2 + b.t * 0.12;
        g.fillRect(Math.round(f.x + Math.cos(ang) * 9), Math.round(f.y - 50 + Math.sin(ang) * 3), 2, 2);
      }
    }
    if (f.countering) {
      g.fillStyle = `rgba(125,211,252,${0.35 + 0.25 * Math.sin(b.t * 0.6)})`;
      g.fillRect(Math.round(f.x - 12), f.y - 46, 24, 1);
      g.fillRect(Math.round(f.x - 12), f.y - 1, 24, 1);
    }
  }

  private drawProjectile(p: Projectile, t: number) {
    const g = this.g;
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    switch (p.kind) {
      case 'cross': {
        const pulse = Math.floor(t / 6) % 2 === 0;
        drawCross(g, x, y, p.owner === -1 ? '#fbbf24' : '#fde68a', pulse ? '#ffffff' : '#fff7cc');
        break;
      }
      case 'eraser': {
        const roll = Math.floor(t / 4) % 2;
        g.fillStyle = '#f8fafc';
        g.fillRect(x - 3, y - 2 + roll, 7, 4);
        g.fillStyle = '#2563eb';
        g.fillRect(x - 3, y - 2 + roll, 2, 4);
        g.fillStyle = '#cbd5e1';
        g.fillRect(x + 2, y - 2 + roll, 2, 1);
        break;
      }
      case 'cat': {
        const d = p.vx >= 0 ? 1 : -1;
        const R = (lx: number, ly: number, w: number, h: number, c: string) => {
          g.fillStyle = c;
          g.fillRect(d === 1 ? x + lx : x - lx - w, y + ly, w, h);
        };
        const step = Math.floor(t / 4) % 2;
        R(-5, -2, 8, 4, '#a3a3ad');
        R(1, -5, 5, 5, '#b4b4bd');
        R(1, -6, 1, 1, '#b4b4bd');
        R(4, -6, 1, 1, '#b4b4bd');
        R(4, -4, 1, 1, '#facc15');
        R(-7, -4, 2, 1, '#a3a3ad');
        R(-8, -5, 1, 1, '#a3a3ad');
        R(-4 + step, 2, 2, 2, '#8a8a94');
        R(1 - step, 2, 2, 2, '#8a8a94');
        break;
      }
      case 'star': {
        g.fillStyle = 'rgba(254,243,199,0.5)';
        g.fillRect(x - 1, y - 16, 3, 12);
        g.fillStyle = '#fde68a';
        g.fillRect(x - 1, y - 4, 3, 9);
        g.fillRect(x - 4, y - 1, 9, 3);
        g.fillRect(x - 3, y - 3, 1, 1);
        g.fillRect(x + 3, y - 3, 1, 1);
        g.fillRect(x - 3, y + 3, 1, 1);
        g.fillRect(x + 3, y + 3, 1, 1);
        g.fillStyle = '#ffffff';
        g.fillRect(x, y, 1, 1);
        break;
      }
      case 'basketball': {
        pixCircle(g, x, y, 4, '#f97316');
        g.fillStyle = '#7c2d12';
        const r = Math.floor(t / 5) % 2;
        if (r) {
          g.fillRect(x - 3, y, 7, 1);
          g.fillRect(x, y - 3, 1, 7);
        } else {
          g.fillRect(x - 2, y - 2, 1, 1);
          g.fillRect(x + 2, y + 2, 1, 1);
          g.fillRect(x - 2, y + 2, 1, 1);
          g.fillRect(x + 2, y - 2, 1, 1);
          g.fillRect(x - 1, y - 1, 3, 3);
          g.fillStyle = '#f97316';
          g.fillRect(x, y, 1, 1);
        }
        break;
      }
      case 'soup': {
        g.fillStyle = '#fde68a';
        g.fillRect(x - 4, y - 6, 8, 12);
        g.fillStyle = '#dc2626';
        g.fillRect(x - 4, y - 3, 8, 5);
        g.fillStyle = '#ffffff';
        g.fillRect(x - 2, y - 2, 4, 1);
        g.fillRect(x - 2, y, 4, 1);
        g.fillStyle = '#d4d4d8';
        g.fillRect(x - 4, y - 6, 8, 1);
        g.fillRect(x - 4, y + 5, 8, 1);
        if (Math.floor(t / 10) % 2 === 0) {
          g.fillStyle = '#fff';
          g.fillRect(x - 5, y - 9, 1, 1);
          g.fillRect(x + 5, y - 9, 1, 1);
        }
        break;
      }
      case 'mikan': {
        pixCircle(g, x, y, 4, '#fb923c');
        g.fillStyle = '#65a30d';
        g.fillRect(x, y - 5, 2, 1);
        g.fillRect(x - 1, y - 6, 1, 1);
        g.fillStyle = '#fdba74';
        g.fillRect(x - 2, y - 2, 1, 1);
        break;
      }
      case 'vending': {
        g.fillStyle = '#d23c3c';
        g.fillRect(x - 8, y - 13, 16, 26);
        g.fillStyle = '#a82a2a';
        g.fillRect(x - 8, y - 13, 16, 2);
        g.fillStyle = '#20263a';
        g.fillRect(x - 6, y - 10, 12, 10);
        const cans = ['#fde68a', '#60a5fa', '#f87171', '#a3e635'];
        for (let i = 0; i < 4; i++) {
          g.fillStyle = cans[i];
          g.fillRect(x - 5 + i * 3, y - 8, 2, 3);
          g.fillRect(x - 5 + i * 3, y - 4, 2, 3);
        }
        g.fillStyle = '#fef3c7';
        g.fillRect(x - 6, y + 2, 12, 4);
        g.fillStyle = '#dc2626';
        g.fillRect(x - 4, y + 3, 8, 2);
        g.fillStyle = '#111';
        g.fillRect(x - 6, y + 8, 12, 3);
        if (p.vy > 1) {
          g.fillStyle = 'rgba(255,255,255,0.5)';
          g.fillRect(x - 11, y - 20, 1, 10);
          g.fillRect(x + 10, y - 24, 1, 10);
        }
        break;
      }
      case 'kuraishi': {
        drawShadow(g, p.x, GROUND, 0);
        drawFighter(g, p.x, p.y + 20, EXTRA_LOOKS.kuraishi, { pose: 'walk', facing: p.vx >= 0 ? 1 : -1, t });
        const bob = Math.floor(t / 8) % 2;
        drawCross(g, x - 10, y - 30 + bob, '#f8fafc', '#e2e8f0');
        drawCross(g, x, y - 36 - bob, '#f8fafc', '#e2e8f0');
        drawCross(g, x + 10, y - 30 + bob, '#f8fafc', '#e2e8f0');
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
        g.fillRect(x, y, 1, 1);
        g.globalAlpha = 1;
        break;
      case 'crossburst':
        g.globalAlpha = k;
        g.fillStyle = e.color;
        g.fillRect(x, y - 1, 1, 3);
        g.fillRect(x - 1, y, 3, 1);
        g.globalAlpha = 1;
        break;
      case 'heart':
        g.globalAlpha = k;
        g.fillStyle = e.color;
        g.fillRect(x, y, 1, 1);
        g.fillRect(x + 2, y, 1, 1);
        g.fillRect(x - 1, y + 1, 5, 1);
        g.fillRect(x, y + 2, 3, 1);
        g.fillRect(x + 1, y + 3, 1, 1);
        g.globalAlpha = 1;
        break;
      case 'sparkle':
        g.globalAlpha = k;
        g.fillStyle = e.color;
        if (t % 6 < 3) {
          g.fillRect(x, y - 1, 1, 3);
          g.fillRect(x - 1, y, 3, 1);
        } else g.fillRect(x, y, 1, 1);
        g.globalAlpha = 1;
        break;
      case 'guard':
        g.globalAlpha = k;
        g.fillStyle = e.color;
        g.fillRect(x - 1, y - 9, 2, 18);
        g.fillRect(x - 3, y - 7, 2, 2);
        g.fillRect(x - 3, y + 5, 2, 2);
        g.globalAlpha = 1;
        break;
      case 'afterimage':
        if (e.look && e.pose && e.facing) drawFighter(g, e.x, e.y, e.look, { pose: e.pose, facing: e.facing, t, alpha: 0.35 * k });
        break;
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
      const grd = d.createRadialGradient(f.x, f.y - 22, 6, f.x, f.y - 22, 42);
      grd.addColorStop(0, 'rgba(0,0,0,1)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = grd;
      d.fillRect(f.x - 42, f.y - 64, 84, 84);
    }
    for (const p of b.projectiles) {
      if (p.kind === 'kusa') continue;
      const grd = d.createRadialGradient(p.x, p.y, 2, p.x, p.y, 14);
      grd.addColorStop(0, 'rgba(0,0,0,0.9)');
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = grd;
      d.fillRect(p.x - 14, p.y - 14, 28, 28);
    }
    g.drawImage(this.dark, 0, 0);
    // stars
    g.fillStyle = `rgba(255,255,255,${a * 0.9})`;
    for (let i = 0; i < 30; i++) {
      if ((i + Math.floor(b.t / 20)) % 7 === 0) continue;
      g.fillRect(Math.floor(seeded(i) * W), Math.floor(seeded(i + 100) * 90), 1, 1);
    }
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
    g.fillRect(0, 0, W, 150);
    g.fillStyle = '#d8c9a4';
    g.fillRect(0, 128, W, 22);
    g.fillStyle = '#b39a6c';
    g.fillRect(0, 128, W, 1);
    g.fillRect(0, 149, W, 1);
    // floor
    g.fillStyle = '#c9a06a';
    g.fillRect(0, 150, W, 36);
    g.fillStyle = '#b98a58';
    g.fillRect(0, 186, W, 30);
    g.fillStyle = '#a3774a';
    for (let x = 0; x < W; x += 32) {
      g.fillRect(x, 150, 1, 66);
      g.fillRect(x + 16, 186, 1, 30);
    }
    g.fillRect(0, 186, W, 1);
    g.fillStyle = '#9a6e42';
    g.fillRect(0, 200, W, 1);
    // window
    g.fillStyle = '#8fc7ee';
    g.fillRect(14, 26, 92, 84);
    g.fillStyle = '#b9deff';
    g.fillRect(20, 34, 26, 6);
    g.fillRect(60, 48, 30, 5);
    g.fillRect(30, 62, 20, 4);
    // outdoor AC unit (室外機) seen through the window
    g.fillStyle = '#a7adb3';
    g.fillRect(56, 70, 34, 26);
    g.fillStyle = '#7f858c';
    g.fillRect(56, 70, 34, 2);
    g.fillRect(56, 94, 34, 2);
    pixCircle(g, 70, 83, 8, '#5c6166');
    g.fillStyle = '#3f4448';
    const a = t * 0.25;
    for (let i = 0; i < 3; i++) {
      const ang = a + (i * Math.PI * 2) / 3;
      g.fillRect(Math.round(70 + Math.cos(ang) * 4), Math.round(83 + Math.sin(ang) * 4), 2, 2);
    }
    g.fillStyle = '#cfd4d8';
    g.fillRect(81, 74, 6, 3);
    g.fillRect(81, 80, 6, 3);
    // window frame
    g.fillStyle = '#f5f5f5';
    g.fillRect(12, 24, 96, 2);
    g.fillRect(12, 110, 96, 2);
    g.fillRect(12, 24, 2, 88);
    g.fillRect(106, 24, 2, 88);
    g.fillRect(59, 24, 2, 88);
    g.fillRect(12, 66, 96, 2);
    g.fillStyle = '#d9d9d9';
    g.fillRect(10, 112, 100, 3);
    // blackboard
    g.fillStyle = '#6b4a2b';
    g.fillRect(126, 28, 156, 88);
    g.fillStyle = '#2f5d4a';
    g.fillRect(130, 32, 148, 78);
    g.fillStyle = '#8a6a48';
    g.fillRect(126, 116, 156, 3);
    g.fillStyle = '#f1f5e9';
    g.fillRect(140, 116, 6, 2);
    g.fillRect(150, 116, 4, 2);
    g.font = `10px ${FONT}`;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(241,245,233,0.9)';
    g.fillText('糸魚川-静岡構造線', 136, 48);
    g.font = `16px ${FONT}`;
    g.fillText('味噌', 140, 78);
    g.font = `8px ${FONT}`;
    g.fillText('西=丸餅  東=角餅', 136, 98);
    for (let i = 0; i < 3; i++) pixEllipseOutline(g, 240, 78, 10 + i * 8, 6 + i * 5, 'rgba(241,245,233,0.75)');
    drawCross(g, 268, 44, 'rgba(241,245,233,0.85)', 'rgba(241,245,233,0.85)');
    // clock
    pixCircle(g, 300, 16, 7, '#f8fafc');
    pixEllipseOutline(g, 300, 16, 7, 7, '#1f2937');
    g.fillStyle = '#1f2937';
    g.fillRect(300, 12, 1, 5);
    g.fillRect(300, 16, 4, 1);
    // vending machine
    g.fillStyle = '#d23c3c';
    g.fillRect(334, 110, 40, 76);
    g.fillStyle = '#a82a2a';
    g.fillRect(334, 110, 40, 3);
    g.fillRect(334, 110, 2, 76);
    g.fillStyle = '#20263a';
    g.fillRect(339, 118, 30, 30);
    const cans = ['#fde68a', '#60a5fa', '#f87171', '#a3e635', '#fbbf24', '#e2e8f0'];
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
      const sold = r === 0 && i === 4;
      g.fillStyle = sold ? '#374151' : cans[(i + r) % cans.length];
      g.fillRect(341 + i * 5, 121 + r * 9, 3, 6);
    }
    g.fillStyle = '#fef3c7';
    g.fillRect(339, 152, 30, 9);
    g.fillStyle = '#dc2626';
    g.font = `7px ${FONT}`;
    g.fillText('ｺｰﾝｽｰﾌﾟ 売切', 340, 159);
    g.fillStyle = '#111827';
    g.fillRect(339, 166, 30, 10);
    g.fillStyle = '#4b5563';
    g.fillRect(343, 169, 22, 4);
    // desks (back row)
    for (let i = 0; i < 6; i++) {
      const x = 22 + i * 60;
      g.fillStyle = '#d6b27a';
      g.fillRect(x, 156, 28, 4);
      g.fillStyle = '#7a5a3a';
      g.fillRect(x + 2, 160, 2, 12);
      g.fillRect(x + 24, 160, 2, 12);
      g.fillStyle = '#8b7355';
      g.fillRect(x + 8, 162, 12, 2);
      g.fillRect(x + 9, 164, 2, 8);
      g.fillRect(x + 17, 164, 2, 8);
    }
    // Heikatsu, looking out of the window
    const looking = t % 720 < 150;
    drawFighter(g, 44, 176, EXTRA_LOOKS.heikatsu, { pose: looking ? 'pointUp' : 'idle', facing: -1, t, alpha: 0.95 });
    if (looking && Math.floor(t / 30) % 2 === 0) {
      g.fillStyle = '#f8fafc';
      g.fillRect(48, 122, 12, 6);
      g.fillStyle = '#111';
      g.fillRect(50, 125, 1, 1);
      g.fillRect(53, 125, 1, 1);
      g.fillRect(56, 125, 1, 1);
    }
  }

  private stageLake(t: number) {
    const g = this.g;
    const bands: [number, number, string][] = [
      [0, 30, '#7dbcff'],
      [30, 60, '#93c8ff'],
      [60, 90, '#aed6ff'],
      [90, 116, '#c9e5ff'],
    ];
    for (const [y0, y1, c] of bands) {
      g.fillStyle = c;
      g.fillRect(0, y0, W, y1 - y0);
    }
    pixCircle(g, 318, 26, 9, '#fff4b0');
    g.fillStyle = 'rgba(255,244,176,0.35)';
    g.fillRect(304, 25, 28, 2);
    g.fillRect(317, 12, 2, 28);
    // clouds
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 97 + t * 0.08) % (W + 60)) - 30;
      const cy = 18 + (i % 2) * 14 + i * 5;
      g.fillRect(Math.round(cx), cy, 26, 6);
      g.fillRect(Math.round(cx) + 6, cy - 4, 12, 4);
    }
    // hills with contour lines
    const hills: [number, number, number, string][] = [
      [40, 60, 40, '#6aa878'],
      [150, 90, 52, '#5c9a6a'],
      [270, 70, 44, '#68a676'],
      [360, 55, 34, '#5c9a6a'],
      [95, 50, 24, '#4e8a5c'],
      [215, 48, 22, '#4e8a5c'],
      [330, 40, 20, '#4e8a5c'],
    ];
    for (const [cx, rx, ry, c] of hills) {
      pixEllipse(g, cx, 116, rx, ry, c, true);
      for (let i = 1; i <= 3; i++) pixEllipseOutline(g, cx, 116, rx * (1 - i * 0.22), ry * (1 - i * 0.22), 'rgba(255,255,255,0.22)', true);
    }
    // lake
    g.fillStyle = '#3f86c6';
    g.fillRect(0, 116, W, 46);
    g.fillStyle = '#5aa0dc';
    g.fillRect(0, 116, W, 2);
    for (let i = 0; i < 26; i++) {
      const x = Math.round((i * 37 + t * (0.4 + (i % 3) * 0.2)) % (W + 20)) - 10;
      const y = 120 + ((i * 13) % 38);
      g.fillStyle = i % 2 ? '#9fd0ff' : '#7ab8ec';
      g.fillRect(x, y, 6 + (i % 3) * 3, 1);
    }
    // path
    g.fillStyle = '#d9c9a6';
    g.fillRect(0, 162, W, 54);
    g.fillStyle = '#b9a77f';
    g.fillRect(0, 162, W, 1);
    g.fillRect(0, 186, W, 1);
    g.fillStyle = '#c4b08a';
    g.fillRect(0, 187, W, 29);
    g.fillStyle = '#e6d8b8';
    for (let x = 0; x < W; x += 24) g.fillRect(x + 8, 200, 8, 1);
    // fence
    g.fillStyle = '#8b6f4a';
    for (let x = 6; x < W; x += 40) g.fillRect(x, 150, 2, 13);
    g.fillRect(0, 153, W, 1);
    g.fillRect(0, 158, W, 1);
    // joggers
    for (const j of this.joggers) {
      j.x = (j.x + j.v) % (W + 20);
      const x = Math.round(j.x) - 10;
      const step = Math.floor(t / 6) % 2;
      g.fillStyle = '#f3d4b4';
      g.fillRect(x, 146, 2, 2);
      g.fillStyle = j.c;
      g.fillRect(x, 148, 2, 4);
      g.fillStyle = '#243059';
      g.fillRect(x - step, 152, 1, 2);
      g.fillRect(x + 1 + step, 152, 1, 2);
    }
    // a ✝ reflected in the water (両馬談)
    const cx = 200 + Math.round(Math.sin(t / 40) * 3);
    drawCross(g, cx, 140, 'rgba(255,255,255,0.35)', 'rgba(255,255,255,0.5)');
  }

  private stageSakura(t: number) {
    const g = this.g;
    const bands: [number, number, string][] = [
      [0, 40, '#f4cfe0'],
      [40, 80, '#f7dbe8'],
      [80, 120, '#fbe7f0'],
      [120, 170, '#fdf0f5'],
    ];
    for (const [y0, y1, c] of bands) {
      g.fillStyle = c;
      g.fillRect(0, y0, W, y1 - y0);
    }
    // 南棟 (left, brighter)
    g.fillStyle = '#e3e7ee';
    g.fillRect(0, 36, 74, 134);
    g.fillStyle = '#c9d0da';
    g.fillRect(0, 36, 74, 3);
    for (let r = 0; r < 5; r++) for (let i = 0; i < 3; i++) {
      g.fillStyle = (r + i) % 3 === 0 ? '#fff4c2' : '#bcd7f0';
      g.fillRect(8 + i * 22, 46 + r * 24, 14, 12);
    }
    g.fillStyle = '#9aa4b4';
    g.fillRect(0, 150, 74, 20);
    g.fillStyle = '#5b6474';
    g.fillRect(30, 154, 14, 16);
    // 北棟 (right, a bit shabbier)
    g.fillStyle = '#cfd0d2';
    g.fillRect(310, 52, 74, 118);
    g.fillStyle = '#b3b5b9';
    g.fillRect(310, 52, 74, 3);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) {
      g.fillStyle = '#c8d4e6';
      g.fillRect(318 + i * 22, 62 + r * 24, 14, 12);
    }
    g.fillStyle = '#9aa0a6';
    g.fillRect(346, 128, 12, 8);
    g.fillStyle = '#5c6166';
    g.fillRect(349, 130, 4, 4);
    g.fillStyle = '#8f9299';
    g.fillRect(310, 150, 74, 20);
    g.fillStyle = '#4b4f57';
    g.fillRect(340, 154, 14, 16);
    g.font = `9px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.fillStyle = '#334155';
    g.fillText('南棟', 37, 34);
    g.fillText('北棟', 347, 50);
    g.font = `6px ${FONT}`;
    g.fillStyle = '#64748b';
    g.fillText('偏差値70', 37, 148);
    g.fillText('偏差値60', 347, 148);
    // ground
    g.fillStyle = '#d8cfc0';
    g.fillRect(0, 170, W, 46);
    g.fillStyle = '#c4b9a8';
    g.fillRect(0, 170, W, 1);
    g.fillRect(0, 186, W, 1);
    for (let x = 0; x < W; x += 20) {
      g.fillRect(x, 196, 10, 1);
      g.fillRect(x + 10, 206, 10, 1);
    }
    // trees
    const trunks = [100, 160, 222, 284];
    for (const tx of trunks) {
      g.fillStyle = '#6b4a32';
      g.fillRect(tx - 3, 118, 6, 54);
      g.fillRect(tx - 7, 126, 4, 2);
      g.fillRect(tx + 3, 122, 5, 2);
      const cols = ['#f9b8cf', '#f6a5c1', '#fcd5e3'];
      pixEllipse(g, tx, 108, 26, 18, cols[1]);
      pixEllipse(g, tx - 10, 100, 16, 12, cols[0]);
      pixEllipse(g, tx + 12, 98, 16, 12, cols[2]);
      pixEllipse(g, tx, 92, 12, 9, cols[0]);
    }
    // petals on the ground
    g.fillStyle = '#f9b8cf';
    for (let i = 0; i < 30; i++) g.fillRect(Math.floor(seeded(i + 7) * W), 172 + Math.floor(seeded(i + 40) * 42), 2, 1);
    // falling petals
    for (const p of this.petals) {
      p.ph += 0.05;
      p.x += p.vx + Math.sin(p.ph) * 0.4;
      p.y += p.vy;
      if (p.y > H || p.x > W + 4) {
        p.y = -4;
        p.x = Math.random() * W - 20;
      }
      g.fillStyle = Math.floor(p.ph) % 2 ? '#f9b8cf' : '#fde2ec';
      g.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
    void t;
  }

  private stageHawaii(t: number) {
    const g = this.g;
    const bands: [number, number, string][] = [
      [0, 28, '#4c1d5e'],
      [28, 52, '#7a2f6b'],
      [52, 76, '#b8446a'],
      [76, 98, '#e8714f'],
      [98, 122, '#ffa552'],
    ];
    for (const [y0, y1, c] of bands) {
      g.fillStyle = c;
      g.fillRect(0, y0, W, y1 - y0);
    }
    pixEllipse(g, 300, 122, 26, 26, '#fff0b0', true);
    // volcano
    for (let y = 58; y < 122; y++) {
      const k = (y - 58) / 64;
      const l = Math.round(150 - k * 100);
      const r = Math.round(176 + k * 150);
      g.fillStyle = '#2a1a2a';
      g.fillRect(l, y, r - l, 1);
    }
    g.fillStyle = '#ff6a1a';
    g.fillRect(152, 57, 22, 2);
    const fl = Math.floor(t / 6) % 3;
    g.fillStyle = '#ffb347';
    g.fillRect(158 + fl * 3, 55, 3, 2);
    // smoke
    g.fillStyle = 'rgba(200,180,200,0.45)';
    for (let i = 0; i < 6; i++) {
      const yy = 50 - ((t * 0.3 + i * 12) % 60);
      g.fillRect(160 + Math.round(Math.sin(t / 30 + i) * 6) + i * 2, Math.round(yy), 6 + i, 3);
    }
    // stars in the upper sky
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 18; i++) if ((i + Math.floor(t / 25)) % 5 !== 0) g.fillRect(Math.floor(seeded(i + 3) * W), Math.floor(seeded(i + 50) * 40), 1, 1);
    // lava field
    g.fillStyle = '#1a1416';
    g.fillRect(0, 122, W, 94);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = seeded(i) < 0.5 ? '#231b1e' : '#120e10';
      g.fillRect(Math.floor(seeded(i + 11) * W), 122 + Math.floor(seeded(i + 23) * 94), 2 + Math.floor(seeded(i + 5) * 6), 1);
    }
    g.fillStyle = '#2a2224';
    g.fillRect(0, 186, W, 1);
    // glowing cracks
    const glow = 0.55 + 0.45 * Math.sin(t / 12);
    const cracks: [number, number, number][] = [
      [30, 196, 40],
      [120, 206, 60],
      [230, 192, 30],
      [300, 210, 50],
      [180, 170, 24],
      [40, 140, 34],
      [330, 150, 26],
    ];
    for (const [x, y, len] of cracks) {
      for (let i = 0; i < len; i += 3) {
        const yy = y + Math.round(Math.sin(i / 5 + x) * 2);
        g.fillStyle = `rgba(255,${110 + Math.floor(60 * glow)},26,${0.5 + glow * 0.5})`;
        g.fillRect(x + i, yy, 2, 1);
      }
    }
    g.fillStyle = `rgba(255,140,40,${0.25 * glow})`;
    g.fillRect(0, 122, W, 94);
  }

  // ═══════════════════════ OVERLAY LAYER (3x, crisp text) ═══════════════════════
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
      if (p.kind === 'formula') this.txt(p.text ?? '∑', p.x, p.y, 8 + Math.sin(p.t / 4) * 1, '#ffffff', 'center', '#1e3a8a');
      else if (p.kind === 'qed') this.txt('Q.E.D.', p.x, p.y, 10, '#fde68a', 'center', '#7c2d12');
      else if (p.kind === 'kusa') this.txt('草', p.x, p.y, 8, '#4ade80', 'center', '#052e16');
    }

    // fighter status labels
    for (const f of b.f) {
      if (f.silence > 0 && f.state !== 'down') this.txt(`沈黙 ${Math.ceil(f.silence / 60)}`, f.x, f.y - 52, 5, '#e2e8f0');
      if (b.phase === 'intro' || (b.phase === 'fight' && b.phaseT < 150)) {
        const tag = f.tag ?? (f.ai ? 'CPU' : f.side === 0 ? '1P' : '2P');
        const bob = Math.sin(b.t / 6) * 1.5;
        this.txt(`${tag}▼`, f.x, f.y - 56 + bob, 5.5, f.you || tag === 'あなた' ? '#fde68a' : f.def.color);
      }
      // チームカラーの足元マーカー（チーム戦のみ）
      if (!b.isDuel && f.hp > 0 && b.phase !== 'matchEnd') {
        this.txt(f.team === 0 ? '●' : '●', f.x, f.y + 3.5, 5, f.team === 0 ? '#38bdf8' : '#fb7185');
      }
    }

    // text fx
    for (const e of b.texts) {
      const k = e.t < e.life - 10 ? 1 : (e.life - e.t) / 10;
      c.globalAlpha = Math.max(0, k);
      const jx = e.shake ? (Math.random() - 0.5) * 2 : 0;
      const jy = e.shake ? (Math.random() - 0.5) * 2 : 0;
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
      c.font = `6px ${FONT}`;
      const tw = c.measureText(bb.text).width;
      const w = (tw + 8) * grow;
      const h = 11 * grow;
      let x = f.x;
      x = Math.max(w / 2 + 2, Math.min(W - w / 2 - 2, x));
      const y = f.y - 60 - (f.state === 'crouch' ? -6 : 0);
      c.fillStyle = '#ffffff';
      c.fillRect(x - w / 2, y - h / 2, w, h);
      c.strokeStyle = '#1f2937';
      c.lineWidth = 1;
      c.strokeRect(x - w / 2, y - h / 2, w, h);
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(f.x - 2, y + h / 2);
      c.lineTo(f.x + 2, y + h / 2);
      c.lineTo(f.x, y + h / 2 + 3);
      c.fill();
      if (grow >= 1) this.txt(bb.text, x, y + 0.5, 6, '#111827', 'center', null);
      c.globalAlpha = 1;
    }

    // Heikatsu mumble on classroom
    if (b.stage === 'classroom' && b.t % 720 < 150 && Math.floor(b.t / 40) % 2 === 0) this.txt('（地面は忘れない……）', 44, 124, 4.5, '#475569', 'center', null);

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
    const barY = 8;
    const barH = 7;
    const barW = 152;
    const drawBar = (f: Fighter, right: boolean) => {
      const x0 = right ? W - 16 - barW : 16;
      c.fillStyle = '#0f1016';
      c.fillRect(x0 - 1, barY - 1, barW + 2, barH + 2);
      const gw = (f.ghostHp / f.def.hp) * barW;
      const hw = (f.hp / f.def.hp) * barW;
      c.fillStyle = '#dc2626';
      c.fillRect(right ? W - 16 - gw : 16, barY, gw, barH);
      const low = f.hp / f.def.hp < 0.3;
      c.fillStyle = low ? (b.t % 20 < 10 ? '#fb923c' : '#fde047') : '#fde047';
      c.fillRect(right ? W - 16 - hw : 16, barY, hw, barH);
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(right ? W - 16 - hw : 16, barY, hw, 2);
      const nx = right ? W - 16 : 16;
      this.txt(f.def.name, nx, barY + barH + 6, 7, '#ffffff', right ? 'right' : 'left');
      this.txt(f.def.title, nx, barY + barH + 13, 4.2, f.def.color, right ? 'right' : 'left', '#000', 1);
      // オンライン対戦ではプレイヤー名（自分は金色）をキャラ名の下に添える
      if (b.opts.online && f.tag) {
        this.txt(f.tag, nx, barY + barH + 19.5, 4.2, f.you ? '#fde68a' : '#cbd5e1', right ? 'right' : 'left', '#000', 1);
      }
      // meter
      const mw = 118;
      const my = 205;
      const mx = right ? W - 16 - mw : 16;
      c.fillStyle = '#0f1016';
      c.fillRect(mx - 1, my - 1, mw + 2, 6);
      const full = f.meter >= 100;
      const fw = (Math.min(100, f.meter) / 100) * mw;
      c.fillStyle = full ? (b.t % 10 < 5 ? '#ffffff' : f.def.color) : f.def.color;
      c.fillRect(right ? W - 16 - fw : 16, my, fw, 4);
      this.txt(full ? '✝本質✝ MAX' : '✝本質✝', right ? W - 16 : 16, my - 5, 4.5, full ? '#fff' : '#cbd5e1', right ? 'right' : 'left', '#000', 1);
      if (full) {
        const bob = Math.sin(b.t / 5) * 1.2;
        this.txt('超必殺 OK', right ? W - 16 - mw - 4 : 16 + mw + 4, my + 1 + bob, 5, '#fde68a', right ? 'right' : 'left');
      }
      // 櫻優：サンプル数nの表示（超必殺の威力源）
      if (f.id === 'sakura') {
        this.txt(`サンプル n=${f.sampleN}`, right ? W - 16 : 16, my + 8, 4.5, f.sampleN >= 12 ? '#fb7185' : '#fda4af', right ? 'right' : 'left', '#000', 1);
      }
      if (f.combo >= 2 && f.comboTimer > 0) {
        const cx = right ? W - 60 : 60;
        this.txt(`${f.combo}`, cx, 58, 16, f.def.color);
        this.txt('HIT', cx + (right ? -14 : 14), 60, 7, '#fff');
      }
    };
    drawBar(p1, false);
    drawBar(p2, true);
    // timer
    c.fillStyle = '#0f1016';
    c.fillRect(174, 4, 36, 18);
    c.strokeStyle = '#475569';
    c.lineWidth = 1;
    c.strokeRect(174.5, 4.5, 35, 17);
    const sec = b.timerSec;
    this.txt(String(sec), 192, 13.5, 13, sec <= 10 ? '#f87171' : '#ffffff', 'center', '#000', 2);
    // round marks
    for (let i = 0; i < 2; i++) {
      this.txt('✝', 186 - i * 8 - 12, 28, 8, b.wins[0] > i ? '#fde68a' : '#334155', 'center', '#000', 1.5);
      this.txt('✝', 198 + i * 8 + 12, 28, 8, b.wins[1] > i ? '#fde68a' : '#334155', 'center', '#000', 1.5);
    }
    this.txt(`ROUND ${b.round}`, 192, 28, 4.5, '#cbd5e1');
  }

  /** チーム戦（同時乱戦）用HUD：両チームのメンバーをコンパクトに並べる */
  private drawTeamHud(b: Battle) {
    const c = this.c;
    const team0 = b.f.filter((f) => f.team === 0);
    const team1 = b.f.filter((f) => f.team === 1);
    const drawList = (list: Fighter[], right: boolean, teamColor: string, label: string) => {
      const x0 = right ? W - 8 : 8;
      const align = right ? ('right' as const) : ('left' as const);
      this.txt(label, x0, 7, 5, teamColor, align, '#000', 1);
      list.forEach((f, i) => {
        const y = 13 + i * 13;
        const w = 104;
        const bx = right ? W - 8 - w : 8;
        // 名前＋タグ
        const tag = f.tag ? `(${f.tag})` : '';
        const nTag = f.id === 'sakura' ? ` n${f.sampleN}` : '';
        const nameColor = f.hp <= 0 ? '#64748b' : f.you ? '#fde68a' : '#ffffff';
        this.txt(`${f.def.name}${nTag}${tag}`, right ? W - 8 : 8, y, 4.5, nameColor, align, '#000', 1);
        // HPバー
        c.fillStyle = '#0f1016';
        c.fillRect(bx - 1, y + 2, w + 2, 4);
        const hw = (Math.max(0, f.hp) / f.def.hp) * w;
        c.fillStyle = f.hp <= 0 ? '#334155' : f.hp / f.def.hp < 0.3 ? (b.t % 20 < 10 ? '#fb923c' : '#fde047') : '#fde047';
        c.fillRect(right ? W - 8 - hw : 8, y + 3, hw, 2);
        // ゲージ（細バー）
        const mw = (Math.min(100, f.meter) / 100) * w;
        c.fillStyle = f.meter >= 100 ? (b.t % 10 < 5 ? '#ffffff' : f.def.color) : '#475569';
        c.fillRect(right ? W - 8 - mw : 8, y + 6, mw, 1);
        // メーターMAX表示
        if (f.meter >= 100 && f.hp > 0) this.txt('✝', right ? W - 8 - w - 4 : 8 + w + 4, y + 4, 5, '#fde68a', 'center');
      });
    };
    drawList(team0, false, '#38bdf8', '青');
    drawList(team1, true, '#fb7185', '赤');
    // timer
    c.fillStyle = '#0f1016';
    c.fillRect(174, 4, 36, 18);
    c.strokeStyle = '#475569';
    c.lineWidth = 1;
    c.strokeRect(174.5, 4.5, 35, 17);
    const sec = b.timerSec;
    this.txt(String(sec), 192, 13.5, 13, sec <= 10 ? '#f87171' : '#ffffff', 'center', '#000', 2);
    // round marks（チームの勝利数）
    for (let i = 0; i < 2; i++) {
      this.txt('✝', 186 - i * 8 - 12, 28, 8, b.wins[0] > i ? '#38bdf8' : '#334155', 'center', '#000', 1.5);
      this.txt('✝', 198 + i * 8 + 12, 28, 8, b.wins[1] > i ? '#fb7185' : '#334155', 'center', '#000', 1.5);
    }
    this.txt(`ROUND ${b.round}`, 192, 28, 4.5, '#cbd5e1');
    // コンボ表示（チーム戦は発生位置の近くに）
    for (const f of b.f) {
      if (f.combo >= 2 && f.comboTimer > 0) {
        this.txt(`${f.combo}HIT`, Math.max(20, Math.min(W - 20, f.x)), f.y - 68, 7, f.def.color);
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
      c.translate(W / 2, 96);
      c.scale(pop, pop);
      const jitter = bn.t < 10 ? (Math.random() - 0.5) * 2 : 0;
      this.txt(bn.text, jitter, 0, 24, bn.color, 'center', '#000', 5);
      if (bn.sub) this.txt(bn.sub, 0, 20, 8, '#ffffff');
      c.restore();
    } else {
      c.fillStyle = 'rgba(10,10,20,0.72)';
      c.fillRect(0, 44, W, bn.sub ? 26 : 18);
      c.fillStyle = bn.color;
      c.fillRect(0, 44, W, 1);
      c.fillRect(0, bn.sub ? 69 : 61, W, 1);
      c.save();
      c.translate(W / 2, 53);
      c.scale(pop, 1);
      this.txt(`✝ ${bn.text} ✝`, 0, 0, 9, bn.color, 'center', '#000', 2);
      c.restore();
      if (bn.sub) this.txt(bn.sub, W / 2, 64, 5.5, '#e2e8f0');
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
    [0, 50, '#141a3a'],
    [50, 100, '#1e2a5a'],
    [100, 150, '#2c3f7a'],
    [150, 186, '#3f5aa0'],
  ];
  for (const [y0, y1, c] of bands) {
    g.fillStyle = c;
    g.fillRect(0, y0, W, y1 - y0);
  }
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 40; i++) if ((i + Math.floor(t / 20)) % 6 !== 0) g.fillRect(Math.floor(seeded(i + 9) * W), Math.floor(seeded(i + 90) * 120), 1, 1);
  for (let i = 0; i < 10; i++) {
    const y = (t * (0.3 + (i % 3) * 0.15) + i * 47) % (H + 30) - 15;
    const x = (i * 41 + Math.sin(t / 50 + i) * 6) % W;
    drawCross(g, x, y, `rgba(253,230,138,${0.2 + (i % 3) * 0.1})`, 'rgba(255,255,255,0.3)');
  }
  // buildings silhouettes
  g.fillStyle = '#0b0f26';
  g.fillRect(0, 70, 80, 116);
  g.fillRect(304, 90, 80, 96);
  g.fillStyle = '#fde68a';
  for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) if ((r * 3 + i + Math.floor(t / 90)) % 4 !== 0) g.fillRect(10 + i * 22, 80 + r * 24, 12, 10);
  g.fillStyle = '#93c5fd';
  for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) if ((r + i) % 2 === 0) g.fillRect(314 + i * 22, 100 + r * 24, 12, 10);
  // ground
  g.fillStyle = '#1b2447';
  g.fillRect(0, 186, W, 30);
  g.fillStyle = '#2b3868';
  g.fillRect(0, 186, W, 1);
  // sakura
  for (const tx of [120, 264]) {
    g.fillStyle = '#3a2a2a';
    g.fillRect(tx - 3, 130, 6, 56);
    pixEllipse(g, tx, 122, 26, 16, '#c96a8f');
    pixEllipse(g, tx - 8, 112, 16, 12, '#d97ea2');
    pixEllipse(g, tx + 10, 110, 14, 10, '#e79ab9');
  }
  // fighters in a row
  const n = ids.length;
  ids.forEach((id, i) => {
    const x = Math.round(W / 2 + (i - (n - 1) / 2) * 44);
    const def = CHARS[id];
    drawShadow(g, x, GROUND, 0);
    const pose = Math.floor((t + i * 60) / 240) % 4 === 0 ? 'win' : 'idle';
    drawFighter(g, x, GROUND, def.look, { pose, facing: i < n / 2 ? 1 : -1, t: t + i * 13 });
  });
}
