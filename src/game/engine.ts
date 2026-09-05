import { CHARS, INTRO_PAIRS, pairKey } from './characters';
import { COMBO_COMMENTS, HIT_TEXTS, TERACHI_OUTCOMES, type TerachiOutcome } from './quotes';
import { EMPTY_INPUT } from './types';
import type { Box, CharDef, CharId, Difficulty, Facing, InputState, Look, MoveDef, PoseId, ProjKind, SfxName, Side, StageId } from './types';

export const W = 384;
export const H = 216;
export const GROUND = 186;
const GRAV = 0.32;
const ROUND_TIME = 99 * 60;

export type FighterState =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'crouch'
  | 'block'
  | 'attack'
  | 'hurt'
  | 'launch'
  | 'down'
  | 'getup'
  | 'stun'
  | 'frozen'
  | 'win'
  | 'lose'
  | 'grabbed'
  | 'super';

export type Phase = 'intro' | 'fight' | 'ko' | 'roundEnd' | 'matchEnd';

type AiPlan = 'approach' | 'retreat' | 'block' | 'jump' | 'jumpIn' | 'light' | 'heavy' | 'special' | 'super' | 'wait';

interface AiState {
  plan: AiPlan;
  planT: number;
  nextDecision: number;
  held: InputState | null;
}

export interface Fighter {
  side: Side;
  id: CharId;
  def: CharDef;
  look: Look;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: Facing;
  hp: number;
  ghostHp: number;
  meter: number;
  state: FighterState;
  stateT: number;
  stateDur: number;
  move: MoveDef | null;
  moveHit: boolean;
  movePhase: 0 | 1 | 2;
  moveFrame: number;
  airAttack: boolean;
  hitstop: number;
  invuln: number;
  silence: number;
  blocking: boolean;
  countering: boolean;
  cooldown: number;
  combo: number;
  comboTimer: number;
  maxCombo: number;
  ai: AiState | null;
  input: InputState;
  flash: number;
  grabbedBy: Side | -1;
  superT: number;
  superData: Record<string, unknown> | TerachiOutcome | null;
}

export interface Projectile {
  kind: ProjKind;
  owner: Side | -1;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  dmg: number;
  hitstun: number;
  kbx: number;
  kby: number;
  knockdown?: boolean;
  life: number;
  grav?: number;
  ground?: boolean;
  pierce?: boolean;
  item?: 'heal';
  heal?: number;
  homing?: Side;
  text?: string;
  hitMask: number;
  t: number;
  seed: number;
}

export interface PixelFx {
  kind: 'spark' | 'ring' | 'dust' | 'crossburst' | 'heart' | 'afterimage' | 'sparkle' | 'guard';
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  color: string;
  size: number;
  look?: Look;
  pose?: PoseId;
  facing?: Facing;
}

export interface TextFx {
  text: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  life: number;
  size: number;
  color: string;
  shake?: boolean;
  box?: boolean;
}

export interface Bubble {
  side: Side;
  text: string;
  t: number;
  life: number;
}

export interface Banner {
  text: string;
  sub?: string;
  t: number;
  life: number;
  color: string;
  big?: boolean;
}

export interface CutIn {
  side: Side;
  char: CharId;
  name: string;
  quote: string;
  paper?: string;
}

export interface BattleOptions {
  p1: CharId;
  p2: CharId;
  ai: [boolean, boolean];
  difficulty: Difficulty;
  stage: StageId;
  onCutin?: (c: CutIn) => void;
  onSfx?: (s: SfxName) => void;
  onMatchEnd?: (winner: Side, wins: [number, number]) => void;
}

interface HitSpec {
  hitstun: number;
  kbx: number;
  kby: number;
  knockdown?: boolean;
}

const AIR_LIGHT: MoveDef = {
  key: 'light',
  name: '空中弱',
  startup: 4,
  active: 6,
  recovery: 6,
  dmg: 6,
  hitstun: 14,
  kbx: 1.5,
  kby: 0,
  box: { x: 2, y: -30, w: 14, h: 12 },
  kind: 'melee',
  pose: 'jab',
  sfx: 'hit',
};
const AIR_HEAVY: MoveDef = {
  key: 'heavy',
  name: '空中強',
  startup: 7,
  active: 7,
  recovery: 8,
  dmg: 9,
  hitstun: 18,
  kbx: 2.5,
  kby: 0,
  box: { x: 3, y: -24, w: 16, h: 12 },
  kind: 'melee',
  pose: 'kick',
  sfx: 'heavy',
};

const FORMULAS = ['∑', '∫', '∂', 'π', '∞', 'λ', '∇', '√', 'Δ', 'ℵ', 'e^iπ', 'lim'];
const EVENT_NAMES = ['window', 'feikatsu', 'soupBack', 'soupGone', 'matome', 'kuraishi', 'ring', 'threepoint', 'observe', 'night', 'mikan'] as const;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

function makeFighter(side: Side, id: CharId, ai: boolean): Fighter {
  const def = CHARS[id];
  return {
    side,
    id,
    def,
    look: def.look,
    x: side === 0 ? 110 : 274,
    y: GROUND,
    vx: 0,
    vy: 0,
    facing: side === 0 ? 1 : -1,
    hp: def.hp,
    ghostHp: def.hp,
    meter: 0,
    state: 'idle',
    stateT: 0,
    stateDur: 0,
    move: null,
    moveHit: false,
    movePhase: 0,
    moveFrame: 0,
    airAttack: false,
    hitstop: 0,
    invuln: 0,
    silence: 0,
    blocking: false,
    countering: false,
    cooldown: 0,
    combo: 0,
    comboTimer: 0,
    maxCombo: 0,
    ai: ai ? { plan: 'wait', planT: 0, nextDecision: 30, held: null } : null,
    input: { ...EMPTY_INPUT },
    flash: 0,
    grabbedBy: -1,
    superT: 0,
    superData: null,
  };
}

export class Battle {
  f: [Fighter, Fighter];
  projectiles: Projectile[] = [];
  fx: PixelFx[] = [];
  texts: TextFx[] = [];
  bubbles: Bubble[] = [];
  banner: Banner | null = null;
  phase: Phase = 'intro';
  phaseT = 0;
  round = 1;
  wins: [number, number] = [0, 0];
  timer = ROUND_TIME;
  t = 0;
  shake = 0;
  flash = 0;
  darkness = 0;
  freeze = 0;
  slow = 0;
  cutin: CutIn | null = null;
  koWinner: Side | -1 = -1;
  matchWinner: Side | -1 = -1;
  stage: StageId;
  opts: BattleOptions;
  private pendingSuper: (() => void) | null = null;
  private nextEventT = 0;
  private lastEvent = '';
  private queue: { at: number; fn: () => void }[] = [];
  private matchEndNotified = false;

  constructor(opts: BattleOptions) {
    this.opts = opts;
    this.stage = opts.stage;
    this.f = [makeFighter(0, opts.p1, opts.ai[0]), makeFighter(1, opts.p2, opts.ai[1])];
    this.startRound();
  }

  // ───────────────────────── helpers ─────────────────────────
  private sfx(n: SfxName) {
    this.opts.onSfx?.(n);
  }

  get timerSec() {
    return Math.max(0, Math.ceil(this.timer / 60));
  }

  private setState(f: Fighter, st: FighterState, dur = 0) {
    f.state = st;
    f.stateT = 0;
    f.stateDur = dur;
    if (st !== 'attack') {
      f.move = null;
      f.countering = false;
    }
    if (st === 'idle') f.airAttack = false;
  }

  private setBanner(text: string, sub: string | undefined, color: string, life = 150, big = false) {
    this.banner = { text, sub, t: 0, life, color, big };
  }

  text(text: string, x: number, y: number, o: Partial<TextFx> = {}) {
    this.texts.push({ text, x, y, vx: o.vx ?? 0, vy: o.vy ?? -0.4, t: 0, life: o.life ?? 40, size: o.size ?? 8, color: o.color ?? '#ffffff', shake: o.shake, box: o.box });
  }

  private bubble(side: Side, text: string, life = 70) {
    this.bubbles = this.bubbles.filter((b) => b.side !== side);
    this.bubbles.push({ side, text, t: 0, life });
  }

  private spark(x: number, y: number, color = '#fff6a0', n = 8, size = 2) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 2;
      this.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: 10 + Math.random() * 8, color, size });
    }
  }

  private ring(x: number, y: number, color: string, size = 20) {
    this.fx.push({ kind: 'ring', x, y, vx: 0, vy: 0, t: 0, life: 16, color, size });
  }

  private dust(x: number) {
    for (let i = 0; i < 5; i++) this.fx.push({ kind: 'dust', x: x + (Math.random() - 0.5) * 10, y: GROUND - 1, vx: (Math.random() - 0.5) * 1.2, vy: -Math.random() * 0.8, t: 0, life: 14, color: '#c9c2b4', size: 1 });
  }

  private crossBurst(x: number, y: number, n = 6) {
    for (let i = 0; i < n; i++) this.fx.push({ kind: 'crossburst', x, y, vx: (Math.random() - 0.5) * 3, vy: -1 - Math.random() * 2, t: 0, life: 30, color: '#fde68a', size: 3 });
  }

  private hearts(x: number, y: number) {
    for (let i = 0; i < 6; i++) this.fx.push({ kind: 'heart', x: x + (Math.random() - 0.5) * 16, y, vx: (Math.random() - 0.5) * 0.6, vy: -0.6 - Math.random() * 0.6, t: 0, life: 40, color: '#f9a8d4', size: 3 });
  }

  private sparkles(x: number, y: number, color: string) {
    for (let i = 0; i < 10; i++) this.fx.push({ kind: 'sparkle', x: x + (Math.random() - 0.5) * 24, y: y + (Math.random() - 0.5) * 30, vx: 0, vy: -0.5 - Math.random(), t: 0, life: 30 + Math.random() * 20, color, size: 2 });
  }

  private afterimage(f: Fighter) {
    this.fx.push({ kind: 'afterimage', x: f.x, y: f.y, vx: 0, vy: 0, t: 0, life: 14, color: f.def.color, size: 0, look: f.look, pose: this.poseOf(f), facing: f.facing });
  }

  hurtbox(f: Fighter): Box {
    const h = f.state === 'crouch' || f.state === 'getup' || f.state === 'lose' ? 30 : f.state === 'down' ? 12 : 42;
    return { x: f.x - 7, y: f.y - h, w: 14, h };
  }

  private worldBox(f: Fighter, b: Box): Box {
    return { x: f.facing === 1 ? f.x + b.x : f.x - b.x - b.w, y: f.y + b.y, w: b.w, h: b.h };
  }

  private projBox(p: Projectile): Box {
    return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h };
  }

  private hittable(o: Fighter) {
    return o.invuln <= 0 && o.state !== 'down' && o.state !== 'getup' && o.state !== 'grabbed' && o.hp > 0;
  }

  private canBeAffected(f: Fighter) {
    return f.state !== 'down' && f.state !== 'getup' && f.state !== 'grabbed' && f.state !== 'super' && f.hp > 0;
  }

  private spawnProj(p: Omit<Projectile, 'hitMask' | 't' | 'seed'>) {
    this.projectiles.push({ ...p, hitMask: 0, t: 0, seed: Math.random() });
  }

  /** 描画用ポーズ */
  poseOf(f: Fighter): PoseId {
    switch (f.state) {
      case 'idle':
        return 'idle';
      case 'walk':
        return 'walk';
      case 'jump':
        return 'jump';
      case 'crouch':
        return 'crouch';
      case 'block':
        return 'block';
      case 'attack':
        return f.move?.pose ?? 'jab';
      case 'hurt':
        return 'hurt';
      case 'launch':
        return 'launch';
      case 'down':
        return 'down';
      case 'getup':
        return 'getup';
      case 'stun':
        return 'stun';
      case 'frozen':
        return 'frozen';
      case 'win':
        return 'win';
      case 'lose':
        return 'lose';
      case 'grabbed':
        return 'grabbed';
      case 'super':
        return this.superPose(f);
    }
  }

  private superPose(f: Fighter): PoseId {
    switch (f.id) {
      case 'mie':
        return 'counter';
      case 'ryoma':
        return 'spread';
      case 'naito':
        return 'win';
      case 'mitsumine':
        return (f.superData as { grabbed?: boolean })?.grabbed ? 'grab' : 'walk';
      case 'terachi':
        return 'paper';
      case 'rei':
        return 'point';
    }
  }

  /** 描画用フェーズ */
  phaseOf(f: Fighter): 0 | 1 | 2 {
    if (f.state === 'attack') return f.movePhase;
    if (f.state === 'super') return 1;
    return 0;
  }

  // ───────────────────────── round flow ─────────────────────────
  private startRound() {
    for (const f of this.f) {
      f.x = f.side === 0 ? 110 : 274;
      f.y = GROUND;
      f.vx = 0;
      f.vy = 0;
      f.facing = f.side === 0 ? 1 : -1;
      f.hp = f.def.hp;
      f.ghostHp = f.def.hp;
      this.setState(f, 'idle');
      f.hitstop = 0;
      f.invuln = 0;
      f.silence = 0;
      f.blocking = false;
      f.cooldown = 0;
      f.combo = 0;
      f.comboTimer = 0;
      f.grabbedBy = -1;
      f.flash = 0;
      f.superData = null;
      if (f.ai) f.ai = { plan: 'wait', planT: 0, nextDecision: 20, held: null };
    }
    this.projectiles = [];
    this.bubbles = [];
    this.texts = [];
    this.queue = [];
    this.darkness = 0;
    this.timer = ROUND_TIME;
    this.phase = 'intro';
    this.phaseT = 0;
    this.banner = null;
    this.koWinner = -1;
    this.slow = 0;
  }

  private updateIntro() {
    const [a, b] = this.f;
    if (this.phaseT === 1) {
      const final = this.wins[0] === 1 && this.wins[1] === 1;
      this.setBanner(final ? 'FINAL ROUND' : `ROUND ${this.round}`, this.round === 1 ? undefined : undefined, '#fde68a', 70);
      this.sfx('round');
    }
    if (this.phaseT === 6) {
      const key = pairKey(a.id, b.id);
      const pair = INTRO_PAIRS[key];
      if (a.id === b.id) {
        this.bubble(0, a.def.intro);
        this.queue.push({ at: this.t + 30, fn: () => this.bubble(1, '自演じゃなくて自己対話だよ') });
      } else if (pair) {
        const firstSide: Side = a.id === pair.first ? 0 : 1;
        const other: Side = firstSide === 0 ? 1 : 0;
        this.bubble(firstSide, pair.a);
        this.queue.push({ at: this.t + 30, fn: () => this.bubble(other, pair.b) });
        if (pair.note) this.queue.push({ at: this.t + 34, fn: () => this.text(pair.note!, W / 2, 70, { size: 9, color: '#fca5a5', life: 50, vy: -0.2 }) });
      } else {
        this.bubble(0, a.def.intro);
        this.queue.push({ at: this.t + 30, fn: () => this.bubble(1, b.def.intro) });
      }
    }
    if (this.phaseT === 76) {
      this.setBanner('FIGHT！✝', undefined, '#f87171', 40, true);
      this.sfx('confirm');
    }
    for (const s of [0, 1] as Side[]) this.updateFighter(s, EMPTY_INPUT);
    this.processQueue();
    if (this.phaseT >= 100) {
      this.phase = 'fight';
      this.phaseT = 0;
      this.nextEventT = 420 + Math.random() * 360;
    }
  }

  private ko(winner: Side | -1) {
    if (this.phase !== 'fight') return;
    this.phase = 'ko';
    this.phaseT = 0;
    this.koWinner = winner;
    this.slow = 75;
    this.shake = 10;
    this.flash = 12;
    this.projectiles = this.projectiles.filter((p) => p.item);
    this.queue = [];
    this.cutin = null;
    for (const f of this.f) {
      f.hitstop = 0;
      f.combo = 0;
      if (f.state === 'grabbed') {
        f.grabbedBy = -1;
        this.setState(f, 'launch');
        f.vy = -4;
      }
    }
    if (winner === -1) this.setBanner('DOUBLE K.O.', '自演？', '#fca5a5', 130, true);
    else {
      const w = this.f[winner];
      this.setBanner(w.def.koText, w.id === 'mie' ? '四百二十一回目' : w.id === 'rei' ? '面白かった' : undefined, w.def.color, 130, true);
    }
    this.sfx('ko');
  }

  private timeUp() {
    if (this.phase !== 'fight') return;
    const [a, b] = this.f;
    const winner: Side | -1 = a.hp > b.hp ? 0 : b.hp > a.hp ? 1 : -1;
    this.phase = 'ko';
    this.phaseT = 0;
    this.koWinner = winner;
    this.slow = 0;
    this.projectiles = this.projectiles.filter((p) => p.item);
    this.queue = [];
    this.setBanner('授業終了', winner === -1 ? '引き分け（まあ）' : 'TIME UP', '#cbd5e1', 130, true);
    this.sfx('round');
  }

  private updateKO() {
    for (const s of [0, 1] as Side[]) this.updateFighter(s, EMPTY_INPUT);
    this.updateProjectiles();
    if (this.phaseT >= 100) {
      this.slow = 0;
      this.phase = 'roundEnd';
      this.phaseT = 0;
      const kw = this.koWinner;
      if (kw !== -1) {
        this.wins[kw]++;
        const w = this.f[kw];
        const l = this.f[kw === 0 ? 1 : 0];
        this.setState(w, 'win');
        w.invuln = 9999;
        if (l.state !== 'down' && l.state !== 'launch') this.setState(l, 'lose');
        this.bubble(kw, pick(w.def.wins), 150);
        this.sparkles(w.x, w.y - 30, w.def.color);
      } else {
        for (const f of this.f) if (f.state !== 'down' && f.state !== 'launch') this.setState(f, 'lose');
        this.text('まあ', W / 2, 110, { size: 14, color: '#e2e8f0', life: 90, vy: -0.1 });
      }
    }
  }

  private updateRoundEnd() {
    for (const s of [0, 1] as Side[]) this.updateFighter(s, EMPTY_INPUT);
    if (this.phaseT >= 165) {
      const kw = this.koWinner;
      if (kw !== -1 && this.wins[kw] >= 2) {
        this.phase = 'matchEnd';
        this.phaseT = 0;
        this.matchWinner = kw;
        if (!this.matchEndNotified) {
          this.matchEndNotified = true;
          this.opts.onMatchEnd?.(kw, [...this.wins] as [number, number]);
        }
      } else {
        this.round++;
        this.startRound();
      }
    }
  }

  // ───────────────────────── main step ─────────────────────────
  step(inputs: [InputState, InputState]) {
    this.t++;
    if (this.freeze > 0) {
      this.freeze--;
      if (this.freeze === 0 && this.pendingSuper) {
        const fn = this.pendingSuper;
        this.pendingSuper = null;
        fn();
      }
      this.updateFx();
      return;
    }
    if (this.slow > 0) {
      this.slow--;
      if (this.t % 3 !== 0) {
        this.updateFx();
        return;
      }
    }
    this.phaseT++;
    switch (this.phase) {
      case 'intro':
        this.updateIntro();
        break;
      case 'fight':
        this.updateFight(inputs);
        break;
      case 'ko':
        this.updateKO();
        break;
      case 'roundEnd':
        this.updateRoundEnd();
        break;
      case 'matchEnd':
        for (const s of [0, 1] as Side[]) this.updateFighter(s, EMPTY_INPUT);
        break;
    }
    this.updateFx();
  }

  private updateFight(inputs: [InputState, InputState]) {
    this.timer--;
    for (const s of [0, 1] as Side[]) {
      const f = this.f[s];
      const inp = f.ai ? this.aiInput(s) : inputs[s];
      this.updateFighter(s, inp);
    }
    this.resolvePush();
    this.resolveHits();
    this.updateProjectiles();
    this.updateEvents();
    this.processQueue();

    const dead: [boolean, boolean] = [this.f[0].hp <= 0, this.f[1].hp <= 0];
    if (dead[0] || dead[1]) {
      for (const f of this.f) {
        if (f.hp > 0) continue;
        if (f.state === 'grabbed') f.grabbedBy = -1;
        if (f.state !== 'launch' && f.state !== 'down') {
          this.setState(f, 'launch');
          f.vy = -4.5;
          f.vx = -f.facing * 3;
          f.y -= 1;
        }
      }
      this.ko(dead[0] && dead[1] ? -1 : dead[0] ? 1 : 0);
    } else if (this.timer <= 0) this.timeUp();
  }

  private processQueue() {
    if (!this.queue.length) return;
    const rest: typeof this.queue = [];
    for (const q of this.queue) {
      if (this.t >= q.at) q.fn();
      else rest.push(q);
    }
    this.queue = rest;
  }

  private updateFx() {
    for (const e of this.fx) {
      e.t++;
      e.x += e.vx;
      e.y += e.vy;
      if (e.kind === 'dust' || e.kind === 'crossburst') e.vy += 0.08;
    }
    this.fx = this.fx.filter((e) => e.t < e.life);
    for (const e of this.texts) {
      e.t++;
      e.x += e.vx;
      e.y += e.vy;
    }
    this.texts = this.texts.filter((e) => e.t < e.life);
    for (const b of this.bubbles) b.t++;
    this.bubbles = this.bubbles.filter((b) => b.t < b.life);
    if (this.banner) {
      this.banner.t++;
      if (this.banner.t >= this.banner.life) this.banner = null;
    }
    this.shake = this.shake > 0.5 ? this.shake * 0.82 : 0;
    if (this.flash > 0) this.flash--;
    if (this.darkness > 0) this.darkness--;
    for (const f of this.f) {
      if (f.ghostHp > f.hp) f.ghostHp = Math.max(f.hp, f.ghostHp - Math.max(0.25, (f.ghostHp - f.hp) * 0.05));
      else f.ghostHp = f.hp;
    }
  }

  // ───────────────────────── fighter update ─────────────────────────
  private updateFighter(s: Side, inp: InputState) {
    const f = this.f[s];
    const o = this.f[s === 0 ? 1 : 0];
    f.input = inp;
    if (f.flash > 0) f.flash--;
    if (f.invuln > 0) f.invuln--;
    if (f.silence > 0) f.silence--;
    if (f.cooldown > 0) f.cooldown--;
    if (f.comboTimer > 0) {
      f.comboTimer--;
      if (f.comboTimer === 0) f.combo = 0;
    }
    if (f.hitstop > 0) {
      f.hitstop--;
      return;
    }
    f.stateT++;
    const grounded = f.y >= GROUND;
    const free = f.state === 'idle' || f.state === 'walk' || f.state === 'crouch' || f.state === 'jump';
    if (free && f.grabbedBy < 0 && this.phase !== 'roundEnd' && this.phase !== 'matchEnd') f.facing = o.x >= f.x ? 1 : -1;
    f.blocking = false;

    switch (f.state) {
      case 'hurt':
        if (f.stateT >= f.stateDur) this.setState(f, 'idle');
        break;
      case 'block':
        f.blocking = true;
        if (f.stateT >= f.stateDur) this.setState(f, 'idle');
        break;
      case 'launch':
        break;
      case 'down':
        if (f.stateT >= f.stateDur) {
          this.setState(f, 'getup', 18);
          f.invuln = 34;
        }
        break;
      case 'getup':
        if (f.stateT >= f.stateDur) this.setState(f, 'idle');
        break;
      case 'stun':
      case 'frozen':
        if (f.stateT >= f.stateDur) this.setState(f, 'idle');
        break;
      case 'grabbed':
      case 'win':
      case 'lose':
        break;
      case 'super':
        this.updateSuper(f, o);
        break;
      case 'attack':
        this.updateAttack(f, o);
        break;
      default:
        if (this.phase === 'fight') this.updateFree(f, o, inp, grounded);
        else if (grounded) {
          f.state = 'idle';
          f.vx = 0;
        }
    }

    // physics
    const wasAir = f.y < GROUND;
    if (f.state !== 'grabbed') {
      f.x += f.vx;
      f.y += f.vy;
      if (f.y < GROUND) f.vy += GRAV;
    }
    if (f.y >= GROUND) {
      f.y = GROUND;
      if (wasAir) {
        f.vy = 0;
        if (f.state === 'launch') {
          this.setState(f, 'down', f.hp <= 0 ? 99999 : 42);
          this.dust(f.x);
          this.shake = Math.max(this.shake, 3);
          this.sfx('land');
          f.vx = 0;
        } else if (f.state === 'jump' || (f.state === 'attack' && f.airAttack)) {
          this.setState(f, 'idle');
          this.dust(f.x);
          this.sfx('land');
        }
        f.airAttack = false;
      }
      if (f.state !== 'walk') {
        f.vx *= 0.72;
        if (Math.abs(f.vx) < 0.05) f.vx = 0;
      }
    }
    f.x = clamp(f.x, 10, W - 10);
  }

  private updateFree(f: Fighter, o: Fighter, inp: InputState, grounded: boolean) {
    if (grounded) {
      if (inp.super && f.meter >= 100 && f.silence <= 0) {
        this.startSuper(f, o);
        return;
      }
      if (inp.special && f.silence <= 0 && f.cooldown <= 0 && this.canSpecial(f)) {
        this.startMove(f, f.def.moves.special);
        return;
      }
      if (inp.heavy) {
        this.startMove(f, f.def.moves.heavy);
        return;
      }
      if (inp.light) {
        this.startMove(f, f.def.moves.light);
        return;
      }
      if (inp.up) {
        f.vy = -f.def.jump;
        f.vx = (inp.left ? -1 : inp.right ? 1 : 0) * f.def.speed * 0.95;
        f.y -= 1;
        this.setState(f, 'jump');
        this.sfx('jump');
        return;
      }
      const back = f.facing === 1 ? inp.left : inp.right;
      const fwd = f.facing === 1 ? inp.right : inp.left;
      if (inp.down) {
        f.state = 'crouch';
        f.blocking = true;
        f.vx = 0;
        return;
      }
      if (back) {
        f.state = 'walk';
        f.vx = -f.facing * f.def.speed * 0.8;
        f.blocking = true;
      } else if (fwd) {
        f.state = 'walk';
        f.vx = f.facing * f.def.speed;
      } else {
        f.state = 'idle';
        f.vx = 0;
      }
    } else if ((inp.light || inp.heavy) && !f.airAttack) {
      this.startMove(f, inp.heavy ? AIR_HEAVY : AIR_LIGHT);
      f.airAttack = true;
    }
  }

  private canSpecial(f: Fighter) {
    const m = f.def.moves.special;
    if (m.kind === 'projectile') return this.projectiles.filter((p) => p.owner === f.side && p.kind === m.projectile!.kind).length < 2;
    return true;
  }

  private startMove(f: Fighter, m: MoveDef) {
    const air = f.y < GROUND;
    this.setState(f, 'attack');
    f.move = m;
    f.moveFrame = 0;
    f.moveHit = false;
    f.movePhase = 0;
    if (!air) f.vx = 0;
    if (m.callout && Math.random() < 0.7) this.text(pick(m.callout), f.x, f.y - 52, { size: 7, color: '#ffffff', life: 34, vy: -0.5 });
    this.sfx(m.kind === 'melee' ? 'swing' : m.kind === 'counter' ? 'ha' : 'special');
  }

  private updateAttack(f: Fighter, o: Fighter) {
    const m = f.move;
    if (!m) {
      this.setState(f, 'idle');
      return;
    }
    f.moveFrame++;
    const total = m.startup + m.active + m.recovery;
    f.movePhase = f.moveFrame <= m.startup ? 0 : f.moveFrame <= m.startup + m.active ? 1 : 2;
    if (f.moveFrame === m.startup + 1) {
      if (m.kind === 'projectile' && m.projectile) this.spawnMoveProjectile(f, o, m);
      if (m.kind === 'teleport') {
        this.afterimage(f);
        f.x = clamp(o.x - o.facing * 26, 12, W - 12);
        f.facing = o.x >= f.x ? 1 : -1;
        f.invuln = Math.max(f.invuln, 8);
        this.sparkles(f.x, f.y - 24, f.def.color);
        this.sfx('special');
      }
    }
    if (m.kind === 'teleport' && f.movePhase === 0) f.invuln = Math.max(f.invuln, 2);
    f.countering = m.kind === 'counter' && f.movePhase === 1;
    if (f.movePhase === 1 && m.moveX) {
      f.x += f.facing * m.moveX;
      if (f.moveFrame % 2 === 0) this.afterimage(f);
    }
    if (f.moveFrame >= total) {
      if (m.cooldown) f.cooldown = m.cooldown;
      this.setState(f, f.y < GROUND ? 'jump' : 'idle');
    }
  }

  private spawnMoveProjectile(f: Fighter, o: Fighter, m: MoveDef) {
    const spec = m.projectile!;
    const w = spec.w ?? 8;
    const h = spec.h ?? 8;
    if (spec.fromTop) {
      this.spawnProj({ kind: spec.kind, owner: f.side, x: o.x + o.vx * 6, y: -10, vx: 0, vy: spec.vy ?? 3, w, h, dmg: m.dmg * f.def.dmgMul, hitstun: m.hitstun, kbx: m.kbx, kby: m.kby, knockdown: m.knockdown, life: spec.life });
      this.text('★', o.x, 12, { size: 8, color: '#fde68a', life: 20, vy: 0 });
    } else {
      const ground = !!spec.ground;
      this.spawnProj({
        kind: spec.kind,
        owner: f.side,
        x: f.x + f.facing * 14,
        y: ground ? GROUND - h / 2 : f.y - 30,
        vx: f.facing * (spec.vx ?? 3),
        vy: spec.vy ?? 0,
        w,
        h,
        dmg: m.dmg * f.def.dmgMul,
        hitstun: m.hitstun,
        kbx: m.kbx,
        kby: m.kby,
        knockdown: m.knockdown,
        life: spec.life,
        ground,
        grav: spec.grav,
      });
    }
    if (spec.kind === 'cross') this.crossBurst(f.x + f.facing * 12, f.y - 30, 3);
  }

  // ───────────────────────── hits ─────────────────────────
  private resolvePush() {
    const [a, b] = this.f;
    if (a.state === 'grabbed' || b.state === 'grabbed') return;
    if (a.state === 'down' || b.state === 'down') return;
    if (Math.abs(a.y - b.y) > 34) return;
    const dx = b.x - a.x;
    const ov = 14 - Math.abs(dx);
    if (ov > 0) {
      const dir = dx === 0 ? a.facing : dx > 0 ? 1 : -1;
      a.x -= (ov / 2) * dir;
      b.x += (ov / 2) * dir;
      a.x = clamp(a.x, 10, W - 10);
      b.x = clamp(b.x, 10, W - 10);
    }
  }

  private isBlocking(v: Fighter) {
    if (v.y < GROUND) return false;
    if (v.state === 'block') return true;
    return v.blocking && (v.state === 'idle' || v.state === 'walk' || v.state === 'crouch');
  }

  private resolveHits() {
    if (this.phase !== 'fight') return;
    for (const s of [0, 1] as Side[]) {
      const f = this.f[s];
      const o = this.f[s === 0 ? 1 : 0];
      if (f.state !== 'attack' || !f.move || !f.move.box) continue;
      if (f.movePhase !== 1 || f.moveHit || f.hitstop > 0) continue;
      const m = f.move;
      const box = m.box;
      if (!box) continue;
      if (!overlap(this.worldBox(f, box), this.hurtbox(o))) continue;
      if (!this.hittable(o)) continue;
      f.moveHit = true;
      if (o.countering) {
        this.triggerCounter(o, f);
        continue;
      }
      if (this.isBlocking(o)) this.applyBlock(f, o, m.dmg, m.hitstun);
      else this.applyHit(f, o, m.dmg * f.def.dmgMul, m, f.facing, m.sfx);
    }
  }

  private triggerCounter(mie: Fighter, att: Fighter) {
    const m = mie.def.moves.special;
    mie.countering = false;
    mie.moveFrame = m.startup + m.active;
    mie.invuln = Math.max(mie.invuln, 20);
    this.applyHit(mie, att, m.dmg, m, mie.facing, 'ha');
    this.text('は？', mie.x, mie.y - 62, { size: 20, color: '#7dd3fc', life: 45, vy: -0.3, shake: true });
    this.ring(mie.x, mie.y - 25, '#7dd3fc', 30);
    this.flash = 6;
    this.shake = Math.max(this.shake, 8);
    mie.meter = Math.min(100, mie.meter + 15);
  }

  applyHit(att: Fighter | null, vic: Fighter, dmg: number, m: HitSpec, dir: Facing, sfx: SfxName = 'hit') {
    if (vic.state === 'grabbed' && (!att || att.side !== vic.grabbedBy)) return;
    const wasCombo = vic.state === 'hurt' || vic.state === 'launch' || vic.state === 'stun' || vic.state === 'grabbed';
    vic.hp = Math.max(0, vic.hp - dmg);
    vic.flash = 3;
    const kd = !!m.knockdown || vic.hp <= 0 || vic.y < GROUND;
    if (vic.state !== 'grabbed') {
      if (kd) {
        this.setState(vic, 'launch');
        vic.vy = -(m.kby || 3) - (vic.hp <= 0 ? 1.5 : 0);
        vic.vx = dir * ((m.kbx || 2) + (vic.hp <= 0 ? 1.5 : 0));
        vic.y -= 1;
      } else {
        this.setState(vic, 'hurt', m.hitstun);
        vic.vx = dir * (m.kbx || 1.5);
      }
    }
    if (att) {
      att.combo = wasCombo ? att.combo + 1 : 1;
      att.comboTimer = 55;
      att.maxCombo = Math.max(att.maxCombo, att.combo);
      att.meter = Math.min(100, att.meter + 6 + dmg * 0.35);
      att.hitstop = dmg >= 10 ? 7 : 4;
    }
    vic.meter = Math.min(100, vic.meter + 3 + dmg * 0.2);
    vic.hitstop = dmg >= 10 ? 7 : 4;
    this.shake = Math.max(this.shake, dmg >= 10 ? 5 : 2);
    const hx = vic.x - dir * 4;
    const hy = vic.y - 28;
    this.spark(hx, hy, dmg >= 10 ? '#fca5a5' : '#fff6a0', dmg >= 10 ? 12 : 7, dmg >= 10 ? 2 : 1);
    if (att?.id === 'ryoma') this.crossBurst(hx, hy, 3);
    const label = att?.combo && att.combo >= 2 ? undefined : pick(HIT_TEXTS);
    if (label) this.text(label, hx, hy - 10, { size: dmg >= 10 ? 11 : 8, color: dmg >= 10 ? '#fecaca' : '#ffffff', life: 30, vy: -0.7 });
    if (att && att.combo >= 2) {
      const c = [...COMBO_COMMENTS].reverse().find(([n]) => att.combo >= n);
      this.text(`${att.combo} HIT ${c ? c[1] : ''}`, att.side === 0 ? 70 : W - 70, 84, { size: 9, color: att.def.color, life: 45, vy: -0.15 });
    }
    this.sfx(dmg >= 10 ? 'heavy' : sfx);
  }

  private applyBlock(att: Fighter | null, vic: Fighter, dmg: number, hitstun: number) {
    const chip = dmg * 0.1;
    vic.hp = Math.max(1, vic.hp - chip);
    this.setState(vic, 'block', Math.max(8, hitstun * 0.6));
    vic.vx = -vic.facing * 2;
    vic.hitstop = 3;
    if (att) {
      att.hitstop = 3;
      att.meter = Math.min(100, att.meter + 2);
      if (vic.x <= 10 || vic.x >= W - 10) att.vx = -att.facing * 2;
    }
    vic.meter = Math.min(100, vic.meter + 3);
    this.fx.push({ kind: 'guard', x: vic.x + vic.facing * 8, y: vic.y - 28, vx: 0, vy: 0, t: 0, life: 12, color: '#93c5fd', size: 10 });
    this.text(vic.def.blockText, vic.x, vic.y - 52, { size: 8, color: '#bfdbfe', life: 26, vy: -0.5 });
    this.sfx('guard');
  }

  // ───────────────────────── projectiles ─────────────────────────
  private updateProjectiles() {
    const keep: Projectile[] = [];
    for (const p of this.projectiles) {
      p.t++;
      p.life--;
      if (p.homing !== undefined) {
        const tg = this.f[p.homing];
        const ang = Math.atan2(tg.y - 26 - p.y, tg.x - p.x);
        p.vx += Math.cos(ang) * 0.4;
        p.vy += Math.sin(ang) * 0.4;
        const sp = Math.hypot(p.vx, p.vy);
        const max = p.kind === 'qed' ? 5.5 : 4.2;
        if (sp > max) {
          p.vx = (p.vx / sp) * max;
          p.vy = (p.vy / sp) * max;
        }
      }
      p.x += p.vx;
      p.y += p.vy;
      if (p.grav) p.vy += p.grav;
      if (p.ground || p.kind === 'basketball' || p.kind === 'vending' || p.item) {
        const floor = GROUND - p.h / 2;
        if (p.y > floor) {
          p.y = floor;
          if (p.kind === 'cat') p.vy = -1.7;
          else if (p.kind === 'basketball') p.vy = -Math.abs(p.vy) * 0.72;
          else if (p.kind === 'vending' && p.vy > 1) {
            p.vy = 0;
            this.shake = Math.max(this.shake, 8);
            this.dust(p.x - 6);
            this.dust(p.x + 6);
            this.sfx('heavy');
          } else p.vy = 0;
        } else if (p.kind === 'cat' && p.vy === 0) p.vy = -1.7;
        if (p.kind === 'cat' && p.y < floor) p.vy += 0.25;
      }
      let dead = p.life <= 0 || p.x < -40 || p.x > W + 40 || p.y > H + 40 || (p.y < -60 && p.vy < 0);
      if (!dead && this.phase === 'fight') {
        for (const s of [0, 1] as Side[]) {
          if (p.owner === s) continue;
          if (p.hitMask & (1 << s)) continue;
          const f = this.f[s];
          if (!overlap(this.projBox(p), this.hurtbox(f))) continue;
          if (p.item) {
            if (f.state === 'down') continue;
            f.hp = Math.min(f.def.hp, f.hp + (p.heal ?? 10));
            this.text(`+${p.heal ?? 10}`, f.x, f.y - 56, { size: 10, color: '#86efac', life: 40, vy: -0.6 });
            this.text(p.kind === 'soup' ? '六ヶ月ぶり' : '白い筋は取る派', f.x, f.y - 66, { size: 7, color: '#fde68a', life: 40, vy: -0.4 });
            this.sparkles(f.x, f.y - 24, '#86efac');
            this.sfx('heal');
            dead = true;
            break;
          }
          if (!this.hittable(f)) continue;
          if (f.countering) {
            p.owner = s;
            p.vx = -p.vx * 1.25;
            p.vy = p.kind === 'star' || p.kind === 'cross' ? -Math.abs(p.vy) * 0.6 : p.vy;
            if (p.kind === 'star') {
              p.vx = f.facing * 3.5;
              p.vy = -1;
            }
            p.dmg *= 1.5;
            p.hitMask = 0;
            p.homing = undefined;
            p.life = Math.max(p.life, 120);
            this.text('は？', f.x, f.y - 60, { size: 16, color: '#7dd3fc', life: 40, vy: -0.4, shake: true });
            this.ring(p.x, p.y, '#7dd3fc', 16);
            f.meter = Math.min(100, f.meter + 10);
            this.sfx('ha');
            p.hitMask |= 1 << s;
            continue;
          }
          const owner = p.owner;
          const att: Fighter | null = owner === -1 ? null : this.f[owner];
          const dir: Facing = p.vx !== 0 ? (p.vx > 0 ? 1 : -1) : f.x >= p.x ? 1 : -1;
          if (this.isBlocking(f) && p.kind !== 'kuraishi' && p.kind !== 'vending') {
            this.applyBlock(att, f, p.dmg, p.hitstun);
          } else {
            this.applyHit(att, f, p.dmg, { hitstun: p.hitstun, kbx: p.kbx, kby: p.kby, knockdown: p.knockdown }, dir, p.kind === 'cross' ? 'cross' : 'hit');
            if (p.kind === 'cross') this.crossBurst(f.x, f.y - 30, 4);
            if (p.kind === 'kuraishi') this.text('✝✝✝', f.x, f.y - 62, { size: 12, color: '#f8fafc', life: 40, vy: -0.5 });
            if (p.kind === 'basketball') this.text('用は済んだ', p.x, p.y - 14, { size: 8, color: '#fdba74', life: 40, vy: -0.4 });
            if (p.kind === 'kusa') this.text('草', f.x + (Math.random() - 0.5) * 20, f.y - 40 - Math.random() * 20, { size: 8, color: '#4ade80', life: 30, vy: -0.8 });
          }
          p.hitMask |= 1 << s;
          if (!p.pierce) dead = true;
          break;
        }
      }
      if (!dead) keep.push(p);
    }
    this.projectiles = keep;
  }

  // ───────────────────────── supers ─────────────────────────
  private startSuper(f: Fighter, o: Fighter) {
    f.meter = 0;
    f.vx = 0;
    f.facing = o.x >= f.x ? 1 : -1;
    const cut: CutIn = { side: f.side, char: f.id, name: f.def.superName, quote: f.def.superQuote };
    if (f.id === 'terachi') {
      const oc = pick(TERACHI_OUTCOMES);
      cut.paper = oc.text;
      f.superData = oc;
    } else f.superData = {};
    this.cutin = cut;
    this.opts.onCutin?.(cut);
    this.sfx('super');
    this.setState(f, 'super', 99999);
    f.superT = 0;
    f.invuln = 80;
    f.hitstop = 0;
    this.freeze = 66;
    this.pendingSuper = () => {
      this.cutin = null;
      this.flash = 8;
      this.shake = 6;
    };
  }

  private updateSuper(f: Fighter, o: Fighter) {
    f.superT++;
    const T = f.superT;
    const c = f.def.color;
    switch (f.id) {
      case 'mie': {
        if (T === 1) {
          this.projectiles = this.projectiles.filter((p) => p.item);
          this.setBanner('四百二十一回目', '否定の守護者', c, 100);
          for (let i = 0; i < 44; i++) {
            this.queue.push({
              at: this.t + i,
              fn: () => this.text('は？', 10 + Math.random() * (W - 20), 20 + Math.random() * (H - 50), { size: 7 + Math.random() * 18, color: Math.random() < 0.5 ? '#ffffff' : '#7dd3fc', life: 40 + Math.random() * 30, vy: -0.3, shake: true }),
            });
          }
          this.sfx('ha');
        }
        if (T === 12) {
          this.ring(f.x, f.y - 25, '#7dd3fc', 60);
          if (this.hittable(o)) {
            this.applyHit(f, o, 30, { hitstun: 30, kbx: 4.5, kby: 5, knockdown: true }, f.facing, 'ha');
            o.meter = Math.max(0, o.meter - 30);
            this.text('否定', o.x, o.y - 60, { size: 16, color: '#7dd3fc', life: 50, vy: -0.3 });
          }
        }
        if (T === 24 || T === 36) this.sfx('ha');
        if (T >= 56) this.setState(f, 'idle');
        break;
      }
      case 'ryoma': {
        if (T === 1) this.setBanner('フェイカツ降臨', '受験生よ、来い。✝', c, 110);
        if (T <= 66 && T % 3 === 0) {
          const near = Math.random() < 0.6;
          this.spawnProj({ kind: 'cross', owner: f.side, x: clamp(near ? o.x + (Math.random() - 0.5) * 90 : Math.random() * W, 8, W - 8), y: -12 - Math.random() * 20, vx: (Math.random() - 0.5) * 0.6, vy: 2.6 + Math.random() * 1.2, w: 9, h: 11, dmg: 4, hitstun: 12, kbx: 1, kby: 0, life: 220 });
          if (T % 9 === 0) this.sfx('cross');
        }
        if (T === 30) this.text('✝本質✝は止まらない', f.x, f.y - 60, { size: 9, color: '#fde68a', life: 50, vy: -0.3 });
        if (T >= 82) this.setState(f, 'idle');
        break;
      }
      case 'naito': {
        if (T === 1) this.setBanner('面白い考え方だね', '理論に核爆弾が落ちた', c, 110);
        if (T === 8) {
          if (this.hittable(o)) {
            o.hp = Math.max(0, o.hp - 10);
            o.flash = 4;
            this.setState(o, 'stun', 135);
            o.vx = 0;
            o.meter = 0;
            for (let i = 0; i < 6; i++) this.text('？', o.x + (Math.random() - 0.5) * 24, o.y - 50 - Math.random() * 16, { size: 10 + Math.random() * 8, color: '#c4b5fd', life: 60, vy: -0.3 });
            this.text('分類できない', o.x, o.y - 70, { size: 8, color: '#e9d5ff', life: 60, vy: -0.2 });
          }
          f.hp = Math.min(f.def.hp, f.hp + 25);
          this.text('+25 安心', f.x, f.y - 58, { size: 10, color: '#86efac', life: 50, vy: -0.5 });
          this.sparkles(f.x, f.y - 26, '#c4b5fd');
          this.hearts(o.x, o.y - 40);
          this.sfx('heal');
        }
        if (T >= 46) this.setState(f, 'idle');
        break;
      }
      case 'mitsumine': {
        const d = f.superData as { grabbed?: boolean; gt?: number };
        if (T === 1) this.setBanner('理論はいい！！', '突進', c, 60);
        if (!d.grabbed) {
          if (T <= 34) {
            f.x = clamp(f.x + f.facing * 7, 10, W - 10);
            if (T % 3 === 0) this.afterimage(f);
            if (Math.abs(o.x - f.x) < 30 && o.y > GROUND - 26 && this.hittable(o)) {
              d.grabbed = true;
              d.gt = 0;
              this.setState(o, 'grabbed', 99999);
              o.grabbedBy = f.side;
              o.vx = 0;
              o.vy = 0;
              this.projectiles = this.projectiles.filter((p) => p.item);
              this.setBanner('好きなら好きって言いなよ！', '波動関数、崩壊', c, 110);
              this.sfx('heavy');
              this.shake = 6;
            }
          } else {
            this.text('は？', f.x, f.y - 55, { size: 12, color: '#f9a8d4', life: 40 });
            this.setState(f, 'idle');
            f.cooldown = 20;
          }
        } else {
          d.gt = (d.gt ?? 0) + 1;
          o.x = clamp(f.x + f.facing * 13, 10, W - 10);
          o.y = GROUND - 4;
          o.facing = f.facing === 1 ? -1 : 1;
          const hits: [number, string, number][] = [
            [12, '好きなら', 9],
            [28, '好きって', 9],
            [44, '言いなよ！！', 14],
          ];
          for (const [at, txt, dmg] of hits) {
            if (d.gt === at) {
              o.hp = Math.max(0, o.hp - dmg * f.def.dmgMul);
              o.flash = 3;
              this.shake = 6;
              this.spark(o.x, o.y - 28, '#f9a8d4', 10, 2);
              this.text(txt, o.x, o.y - 60, { size: dmg > 10 ? 14 : 11, color: '#fbcfe8', life: 45, vy: -0.4, shake: dmg > 10 });
              this.sfx(dmg > 10 ? 'heavy' : 'hit');
              f.combo = hits.findIndex((h) => h[0] === at) + 1;
              f.comboTimer = 40;
            }
          }
          if (d.gt === 58) {
            o.grabbedBy = -1;
            this.setState(o, 'launch');
            o.vx = f.facing * 5;
            o.vy = -5.5;
            o.y -= 2;
            this.setState(f, 'idle');
          }
        }
        break;
      }
      case 'terachi': {
        const oc = f.superData as TerachiOutcome;
        if (T === 1) {
          this.setBanner(oc.text, oc.comment, c, 200);
          this.applyTerachi(f, o, oc);
          if (f.state !== 'super') return;
        }
        if (T >= 52) this.setState(f, 'idle');
        break;
      }
      case 'rei': {
        if (T === 1) this.setBanner('面白いデータが出たので見てください', '全科目学年首席', c, 110);
        if (T <= 36 && T % 3 === 0) {
          this.spawnProj({ kind: 'formula', owner: f.side, x: f.x + f.facing * 8, y: f.y - 34, vx: f.facing * (1.5 + Math.random() * 2), vy: -3 + Math.random() * 6, w: 8, h: 8, dmg: 3, hitstun: 12, kbx: 0.8, kby: 0, life: 160, homing: o.side, text: pick(FORMULAS) });
          if (T % 9 === 0) this.sfx('special');
        }
        if (T === 50) {
          this.spawnProj({ kind: 'qed', owner: f.side, x: f.x + f.facing * 8, y: f.y - 34, vx: f.facing * 3, vy: 0, w: 22, h: 10, dmg: 12, hitstun: 30, kbx: 4, kby: 4.5, knockdown: true, life: 160, homing: o.side, text: 'Q.E.D.' });
          this.sfx('cross');
        }
        if (T >= 64) this.setState(f, 'idle');
        break;
      }
    }
  }

  private applyTerachi(f: Fighter, o: Fighter, oc: TerachiOutcome) {
    const can = this.hittable(o);
    switch (oc.id) {
      case 'silence':
        o.silence = 600;
        if (can) this.applyHit(f, o, 15, { hitstun: 24, kbx: 2, kby: 0 }, f.facing);
        this.text('沈黙', o.x, o.y - 60, { size: 12, color: '#e2e8f0', life: 60 });
        break;
      case 'kusa':
        for (let i = 0; i < 30; i++) {
          this.queue.push({
            at: this.t + i * 2,
            fn: () => this.spawnProj({ kind: 'kusa', owner: f.side, x: clamp(o.x + (Math.random() - 0.5) * 70, 8, W - 8), y: -10, vx: 0, vy: 3 + Math.random() * 2, w: 8, h: 8, dmg: 1.2, hitstun: 8, kbx: 0.4, kby: 0, life: 120 }),
          });
        }
        break;
      case 'soup':
        f.hp = Math.min(f.def.hp, f.hp + 30);
        this.text('+30 不在感', f.x, f.y - 58, { size: 10, color: '#86efac', life: 50, vy: -0.5 });
        this.sparkles(f.x, f.y - 26, '#fde68a');
        this.sfx('heal');
        if (can) this.applyHit(f, o, 10, { hitstun: 20, kbx: 2, kby: 0 }, f.facing);
        break;
      case 'night':
        this.darkness = 480;
        if (can) this.applyHit(f, o, 18, { hitstun: 24, kbx: 3, kby: 4, knockdown: true }, f.facing);
        break;
      case 'freeze':
        if (can) this.applyHit(f, o, 22, { hitstun: 24, kbx: 3.5, kby: 4.5, knockdown: true }, f.facing);
        this.text('六秒固まった', f.x, f.y - 58, { size: 9, color: '#e2e8f0', life: 80, vy: -0.1 });
        this.setState(f, 'frozen', 120);
        f.invuln = 125;
        break;
      case 'truth':
        if (can) this.applyHit(f, o, 35, { hitstun: 30, kbx: 4.5, kby: 5.5, knockdown: true }, f.facing, 'heavy');
        this.text('本当のこと', o.x, o.y - 62, { size: 14, color: '#fecaca', life: 60, vy: -0.3, shake: true });
        this.flash = 10;
        break;
      case 'nothing':
        f.meter = 50;
        this.text('……', f.x, f.y - 58, { size: 12, color: '#e2e8f0', life: 60, vy: -0.1 });
        if (can) this.applyHit(f, o, 5, { hitstun: 12, kbx: 1, kby: 0 }, f.facing);
        this.text('草', o.x, o.y - 55, { size: 10, color: '#4ade80', life: 50 });
        break;
    }
  }

  // ───────────────────────── chaos events ─────────────────────────
  private updateEvents() {
    if (this.phase !== 'fight') return;
    this.nextEventT--;
    if (this.nextEventT > 0) return;
    this.nextEventT = 660 + Math.random() * 600;
    this.fireEvent();
  }

  private fireEvent(forced?: (typeof EVENT_NAMES)[number]) {
    let name = forced ?? pick(EVENT_NAMES);
    if (name === this.lastEvent) name = EVENT_NAMES[(EVENT_NAMES.indexOf(name) + 1) % EVENT_NAMES.length];
    this.lastEvent = name;
    this.sfx('event');
    const [a, b] = this.f;
    switch (name) {
      case 'window':
        this.setBanner('ヘイカツが窓の外を見た', '……（5秒）', '#cbd5e1');
        for (const f of this.f) if (this.canBeAffected(f) && f.y >= GROUND) this.setState(f, 'frozen', 90);
        this.text('……', W / 2, 44, { size: 14, color: '#e2e8f0', life: 90, vy: -0.05 });
        break;
      case 'feikatsu':
        this.setBanner('フェイカツ：受験生よ、来い。✝', '✝本質✝が降ってくる', '#fbbf24');
        for (let i = 0; i < 12; i++) {
          this.queue.push({
            at: this.t + i * 6,
            fn: () => this.spawnProj({ kind: 'cross', owner: -1, x: 20 + Math.random() * (W - 40), y: -12, vx: 0, vy: 2.2 + Math.random(), w: 9, h: 11, dmg: 4, hitstun: 12, kbx: 1, kby: 0, life: 200 }),
          });
        }
        break;
      case 'soupBack':
        this.setBanner('コーンスープ、六ヶ月ぶりに補充', '取った方が回復する', '#fde68a');
        this.spawnProj({ kind: 'soup', owner: -1, x: 60 + Math.random() * (W - 120), y: -10, vx: 0, vy: 1.5, w: 8, h: 12, dmg: 0, hitstun: 0, kbx: 0, kby: 0, life: 900, ground: true, item: 'heal', heal: 18 });
        break;
      case 'soupGone': {
        const tgt = Math.random() < 0.5 ? a : b;
        this.setBanner('コーンスープの不在', '業者が忘れている（自販機が降ってくる）', '#94a3b8');
        this.text('！', tgt.x, 30, { size: 14, color: '#fca5a5', life: 60, vy: 0 });
        this.spawnProj({ kind: 'vending', owner: -1, x: clamp(tgt.x + (Math.random() - 0.5) * 24, 20, W - 20), y: -40, vx: 0, vy: 0, grav: 0.22, w: 16, h: 26, dmg: 16, hitstun: 30, kbx: 2, kby: 4, knockdown: true, life: 420, ground: true, pierce: true });
        break;
      }
      case 'matome':
        this.setBanner('まとめサイトに載った', '【永久保存版】wwwww', '#4ade80');
        this.shake = 14;
        for (let i = 0; i < 40; i++) this.text('草', Math.random() * W, Math.random() * H, { size: 6 + Math.random() * 12, color: '#4ade80', vy: -0.3 - Math.random() * 0.6, life: 60 + Math.random() * 60 });
        for (const f of this.f) {
          if (this.canBeAffected(f)) {
            f.hp = Math.max(1, f.hp - 8);
            f.flash = 4;
          }
          f.meter = Math.min(100, f.meter + 30);
        }
        break;
      case 'kuraishi': {
        const fromLeft = Math.random() < 0.5;
        this.setBanner('倉石暁、乱入', '✝✝✝は重い', '#f8fafc');
        this.spawnProj({ kind: 'kuraishi', owner: -1, x: fromLeft ? -20 : W + 20, y: GROUND - 20, vx: fromLeft ? 3.2 : -3.2, vy: 0, w: 14, h: 40, dmg: 8, hitstun: 24, kbx: 3, kby: 3.5, knockdown: true, life: 230, pierce: true });
        this.text('教祖に会えた', fromLeft ? 60 : W - 60, GROUND - 60, { size: 8, color: '#f8fafc', life: 60, vy: -0.2 });
        break;
      }
      case 'ring':
        this.setBanner('結婚指輪が光った', '召野：心臓が止まった', '#f9a8d4');
        this.flash = 10;
        for (const f of this.f)
          if (this.canBeAffected(f) && f.y >= GROUND) {
            this.setState(f, 'stun', 70);
            this.hearts(f.x, f.y - 45);
          }
        break;
      case 'threepoint': {
        const fromLeft = Math.random() < 0.5;
        this.setBanner('砂糖のスリーポイント', '用は済んだ', '#fb923c');
        this.spawnProj({ kind: 'basketball', owner: -1, x: fromLeft ? -8 : W + 8, y: 120, vx: fromLeft ? 2.8 : -2.8, vy: -3.4, grav: 0.11, w: 8, h: 8, dmg: 10, hitstun: 20, kbx: 2, kby: 2, life: 280 });
        break;
      }
      case 'observe': {
        this.setBanner('櫻：好意の観測', '波動関数が崩壊した（位置が入れ替わる）', '#c4b5fd');
        this.flash = 8;
        if (a.state !== 'grabbed' && b.state !== 'grabbed') {
          this.afterimage(a);
          this.afterimage(b);
          const ax = a.x;
          a.x = b.x;
          b.x = ax;
          this.sparkles(a.x, a.y - 24, '#c4b5fd');
          this.sparkles(b.x, b.y - 24, '#c4b5fd');
        }
        this.sfx('special');
        break;
      }
      case 'night':
        this.setBanner('夜道に出ろ。', '昼には見えなかった本質が、そこにある。', '#a5b4fc');
        this.darkness = 420;
        break;
      case 'mikan':
        this.setBanner('三重県産みかん、臣下が剥く', '白い筋の境界線（回復）', '#fdba74');
        this.spawnProj({ kind: 'mikan', owner: -1, x: 60 + Math.random() * (W - 120), y: -10, vx: 0, vy: 1.4, w: 8, h: 8, dmg: 0, hitstun: 0, kbx: 0, kby: 0, life: 900, ground: true, item: 'heal', heal: 12 });
        break;
    }
  }

  // ───────────────────────── AI ─────────────────────────
  /** 通常攻撃の実効リーチ（box + 少しのマージン）。これより遠いと空振り確定なので撃たない */
  private aiLightReach(f: Fighter): number {
    const b = f.def.moves.light.box;
    return b ? b.x + b.w + 6 : 24;
  }
  private aiHeavyReach(f: Fighter): number {
    const m = f.def.moves.heavy;
    const b = m.box;
    const base = b ? b.x + b.w + 4 : 28;
    return base + (m.moveX ?? 0) * 2.5;
  }

  private aiInput(s: Side): InputState {
    const f = this.f[s];
    const o = this.f[s === 0 ? 1 : 0];
    const ai = f.ai!;
    // 数理零は常にエリート脳
    if (f.id === 'rei') {
      const react =
        this.opts.difficulty === 'extreme' ? 1 : this.opts.difficulty === 'hard' ? 1 : this.opts.difficulty === 'normal' ? 2 : 3;
      if (ai.held && (this.t + s) % react !== 0) return ai.held;
      const inp = this.reiBrain(s);
      ai.held = inp;
      return inp;
    }
    // 通常AIもフレーム単位で優先順位判断（旧planシステムは廃止）
    return this.generalBrain(s);
  }

  /**
   * 通常キャラ用AI。毎フレーム優先度で判断する。
   * - ガード・飛び道具回避を最優先（難易度で反応率を変える）
   * - 攻撃はリーチ内にいるときだけ撃つ（空振りスパム禁止）
   * - 相手の硬直・起き上がりをちゃんと罰する
   */
  private generalBrain(s: Side): InputState {
    const inp: InputState = { ...EMPTY_INPUT };
    const f = this.f[s];
    const o = this.f[s === 0 ? 1 : 0];
    if (this.phase !== 'fight') return inp;

    const busy =
      f.state === 'attack' ||
      f.state === 'hurt' ||
      f.state === 'launch' ||
      f.state === 'down' ||
      f.state === 'getup' ||
      f.state === 'stun' ||
      f.state === 'frozen' ||
      f.state === 'grabbed' ||
      f.state === 'super' ||
      f.state === 'win' ||
      f.state === 'lose';
    if (busy) return inp;

    const grounded = f.y >= GROUND;
    const dist = Math.abs(o.x - f.x);
    const fwd: 'left' | 'right' = o.x > f.x ? 'right' : 'left';
    const back: 'left' | 'right' = fwd === 'right' ? 'left' : 'right';
    const d = this.opts.difficulty;

    // 難易度パラメータ
    const blockP =
      d === 'extreme' ? 0.96 : d === 'hard' ? 0.88 : d === 'normal' ? 0.62 : 0.28;
    const projP =
      d === 'extreme' ? 0.92 : d === 'hard' ? 0.8 : d === 'normal' ? 0.55 : 0.3;
    const agg =
      d === 'extreme' ? 0.92 : d === 'hard' ? 0.82 : d === 'normal' ? 0.65 : 0.42;
    const specialP =
      d === 'extreme' ? 0.55 : d === 'hard' ? 0.4 : d === 'normal' ? 0.28 : 0.15;
    const superP =
      d === 'extreme' ? 0.95 : d === 'hard' ? 0.85 : d === 'normal' ? 0.6 : 0.35;

    const lightR = this.aiLightReach(f);
    const heavyR = this.aiHeavyReach(f);
    const inLight = dist <= lightR + 2;
    const inHeavy = dist <= heavyR + 2;

    // ── 1. 超必殺（ダウン中は撃たない）──
    if (
      f.meter >= 100 &&
      f.silence <= 0 &&
      o.state !== 'down' &&
      o.state !== 'getup' &&
      dist < 160 &&
      Math.random() < superP
    ) {
      inp.super = true;
      return inp;
    }

    // ── 2. 飛び道具回避（毎フレーム）──
    const proj = this.projectiles.find((p) => {
      if (p.owner === s || p.item) return false;
      const dx = f.x - p.x;
      const closing = p.homing === s || (p.vx !== 0 && Math.sign(p.vx) === Math.sign(dx));
      return closing && Math.abs(dx) < 110 && Math.abs(p.y - (f.y - 22)) < 50;
    });
    if (proj && grounded && Math.random() < projP) {
      // 三重は当身で跳ね返す
      if (f.id === 'mie' && f.cooldown <= 0 && f.silence <= 0 && Math.random() < 0.65) {
        inp.special = true;
        return inp;
      }
      if (proj.ground) {
        inp.up = true;
        inp[fwd] = true;
      } else {
        inp.up = true;
        if (Math.random() < 0.5) inp[fwd] = true;
      }
      return inp;
    }

    // ── 3. ガード（相手の打撃発生・アクティブ中を優先）──
    const oMelee =
      o.state === 'attack' &&
      !!o.move &&
      o.move.kind === 'melee' &&
      (o.movePhase === 0 || o.movePhase === 1);
    const oGrabThreat = o.state === 'super' && o.id === 'mitsumine' && dist < 85;
    const jumpInThreat = o.y < GROUND - 8 && dist < 55 && o.vy > -1.5;
    const threat = (oMelee && dist < 62 && Math.abs(o.y - f.y) < 40) || oGrabThreat || jumpInThreat;

    if (threat && grounded) {
      if (Math.random() < blockP) {
        // 三重は当身優先
        if (f.id === 'mie' && f.cooldown <= 0 && f.silence <= 0 && Math.random() < 0.5) {
          inp.special = true;
        } else {
          inp[back] = true;
        }
        return inp;
      }
      // ガード失敗時は何もしない（被弾）か、低確率でジャンプ避け
      if (Math.random() < 0.15) {
        inp.up = true;
        return inp;
      }
    }

    // ── 4. カウンター立ち（三重の「は？」）には触らない ──
    if (o.countering) {
      if (dist < 70) inp[back] = true;
      else if (f.cooldown <= 0 && dist < 110 && this.aiCanSpecial(f, dist, false, !!proj) && Math.random() < 0.35) {
        inp.special = true;
      } else inp[fwd] = true;
      return inp;
    }

    // ── 5. パニッシュ：硬直・ヒット中・空振り ──
    const oWhiff = o.state === 'attack' && o.movePhase === 2;
    const oVuln =
      oWhiff ||
      o.state === 'stun' ||
      o.state === 'frozen' ||
      (o.state === 'hurt' && o.stateT > 2);

    if (oVuln && grounded) {
      if (dist > heavyR + 4) {
        inp[fwd] = true;
      } else if (inHeavy && Math.random() < 0.7) {
        inp.heavy = true;
      } else if (inLight) {
        inp.light = true;
      } else {
        inp[fwd] = true;
      }
      return inp;
    }

    // ── 6. 対空 ──
    if (o.y < GROUND - 10 && dist < 52 && o.vy > -1.2 && grounded && inHeavy) {
      inp.heavy = true;
      return inp;
    }

    // ── 7. 起き攻め / ダウン待ち ──
    if (o.state === 'getup' && grounded) {
      if (dist > 48) inp[fwd] = true;
      else if (o.stateT >= 6 && inHeavy) inp.heavy = true;
      else if (o.stateT >= 6 && inLight) inp.light = true;
      else inp[back] = true;
      return inp;
    }
    if (o.state === 'down') {
      if (dist > 55) inp[fwd] = true;
      else if (dist < 30) inp[back] = true;
      // 適度な距離で待つ（起き上がりを狙う）
      return inp;
    }

    // ── 8. 遠距離：接近 or 飛び道具・必殺 ──
    if (dist > 100) {
      if (
        this.aiCanSpecial(f, dist, false, !!proj) &&
        Math.random() < specialP * 0.7
      ) {
        inp.special = true;
        return inp;
      }
      if (Math.random() < 0.08) {
        inp.up = true;
        inp[fwd] = true;
      } else {
        inp[fwd] = true;
      }
      return inp;
    }

    // ── 9. 中距離：接近してリーチ内に入る、たまに必殺 ──
    if (dist > heavyR + 6) {
      if (
        this.aiCanSpecial(f, dist, false, !!proj) &&
        Math.random() < specialP * 0.35
      ) {
        inp.special = true;
        return inp;
      }
      if (Math.random() < 0.1) {
        inp.up = true;
        inp[fwd] = true;
      } else {
        inp[fwd] = true;
      }
      return inp;
    }

    // ── 10. 攻撃距離内：リーチを見てから撃つ（ここが一番重要）──
    // 近すぎるときは軽攻撃 or 下がる
    if (dist < 18) {
      if (Math.random() < 0.35) {
        inp[back] = true;
      } else if (Math.random() < agg) {
        inp.light = true;
      } else {
        inp[back] = true;
      }
      return inp;
    }

    // リーチ内なら攻撃、外なら歩いて詰める
    const r = Math.random();
    if (inHeavy && r < agg * 0.55) {
      inp.heavy = true;
    } else if (inLight && r < agg * 0.85) {
      inp.light = true;
    } else if (
      this.aiCanSpecial(f, dist, false, !!proj) &&
      r < agg * 0.95 &&
      Math.random() < specialP
    ) {
      inp.special = true;
    } else if (r < 0.55) {
      // 少し下がって間合いを整える
      inp[back] = true;
    } else {
      inp[fwd] = true;
    }
    return inp;
  }

  /**
   * 数理零 専用エリートAI（プレイスキルカンスト）。
   * 差し返し・対空・置き身逃げ・起こし攻め・コンボルートをフレーム単位で判断する。
   */
  private reiBrain(s: Side): InputState {
    const inp: InputState = { ...EMPTY_INPUT };
    const f = this.f[s];
    const o = this.f[s === 0 ? 1 : 0];
    if (this.phase !== 'fight') return inp;
    const busy =
      f.state === 'attack' ||
      f.state === 'hurt' ||
      f.state === 'launch' ||
      f.state === 'down' ||
      f.state === 'getup' ||
      f.state === 'stun' ||
      f.state === 'frozen' ||
      f.state === 'grabbed' ||
      f.state === 'super' ||
      f.state === 'win' ||
      f.state === 'lose';
    if (busy) return inp;
    const grounded = f.y >= GROUND;
    const dist = Math.abs(o.x - f.x);
    const fwd: 'left' | 'right' = o.x > f.x ? 'right' : 'left';
    const back: 'left' | 'right' = fwd === 'right' ? 'left' : 'right';
    const d = this.opts.difficulty;
    const blockP = d === 'extreme' ? 0.995 : d === 'hard' ? 0.985 : d === 'normal' ? 0.92 : 0.8;
    const teleP = d === 'extreme' ? 0.38 : d === 'hard' ? 0.3 : 0.22;
    const pokeHeavy = d === 'extreme' || d === 'hard' ? 0.72 : 0.55;

    const lightR = this.aiLightReach(f);
    const heavyR = this.aiHeavyReach(f);

    // 超必殺：ゲージが溜まった瞬間に起動（ダウン中の相手には撃たない）
    if (f.meter >= 100 && f.silence <= 0 && o.state !== 'down' && o.state !== 'getup' && dist < 185) {
      inp.super = true;
      return inp;
    }
    // 三峰の超必殺掴みは位相幾何学で抜けて背後から懲罰
    if (o.state === 'super' && o.id === 'mitsumine' && dist < 90 && f.cooldown <= 0 && grounded) {
      inp.special = true;
      return inp;
    }
    // 三重の「は？」構えには絶対に触らない
    if (o.countering) {
      if (dist < 68) inp[back] = true;
      else if (f.cooldown <= 0 && dist < 100 && Math.random() < 0.4) inp.special = true;
      else inp[fwd] = true;
      return inp;
    }
    // 飛び道具対処
    const proj = this.projectiles.find((p) => {
      if (p.owner === s || p.item) return false;
      const dx = f.x - p.x;
      const closing = p.homing === s || (p.vx !== 0 && Math.sign(p.vx) === Math.sign(dx));
      return closing && Math.abs(dx) < 120 && Math.abs(p.y - (f.y - 22)) < 55;
    });
    if (proj && grounded) {
      if (proj.ground) {
        inp.up = true;
        inp[fwd] = true;
      } else if (f.cooldown <= 0 && Math.random() < (d === 'extreme' ? 0.55 : 0.4)) inp.special = true;
      else {
        inp.up = true;
        if (Math.random() < 0.55) inp[fwd] = true;
      }
      return inp;
    }
    // 防御：相手の打撃発生を読み切ってガード
    const oMelee = o.state === 'attack' && !!o.move && o.move.kind === 'melee';
    const oThreat =
      (oMelee && dist < 56 && Math.abs(o.y - f.y) < 36) ||
      (o.y < GROUND - 8 && dist < 58 && o.vy > -1.2);
    if (oThreat && grounded) {
      if (Math.random() > blockP) return inp;
      if (f.cooldown <= 0 && Math.random() < teleP) inp.special = true;
      else inp[back] = true;
      return inp;
    }
    // punish
    if (o.state === 'hurt' && dist < 46 && grounded) {
      if (o.stateT <= 6) inp.light = true;
      else if (dist <= heavyR) inp.heavy = true;
      else if (dist <= lightR) inp.light = true;
      else inp[fwd] = true;
      return inp;
    }
    const oWhiff = o.state === 'attack' && o.movePhase === 2;
    const oVuln = oWhiff || o.state === 'stun' || o.state === 'frozen';
    if (oVuln && grounded) {
      if (dist > heavyR + 4) inp[fwd] = true;
      else if (dist >= 26 && dist <= heavyR) inp.heavy = true;
      else if (dist <= lightR) inp.light = true;
      else inp[fwd] = true;
      return inp;
    }
    // 対空
    if (o.y < GROUND - 10 && dist < 54 && o.vy > -1 && grounded && dist <= heavyR) {
      inp.heavy = true;
      return inp;
    }
    // 起こし攻め
    if (o.state === 'getup' && grounded) {
      if (dist > 46) inp[fwd] = true;
      else if (o.stateT >= 5 && dist <= heavyR) inp.heavy = true;
      else inp[back] = true;
      return inp;
    }
    if (o.state === 'down') {
      if (dist > 52) inp[fwd] = true;
      else if (dist < 34) inp[back] = true;
      return inp;
    }
    // 攻め：間合いを維持して poke（リーチ外では撃たない）
    if (dist > heavyR + 4) {
      if (dist > 105 && f.cooldown <= 0 && Math.random() < (d === 'extreme' ? 0.12 : 0.06)) {
        inp.special = true;
      } else if (dist > 110 && Math.random() < 0.06) {
        inp.up = true;
        inp[fwd] = true;
      } else inp[fwd] = true;
      return inp;
    }
    if (dist < 20) {
      if (f.cooldown <= 0 && Math.random() < (d === 'extreme' ? 0.22 : 0.14)) inp.special = true;
      else if (dist <= lightR) inp.light = true;
      else inp[back] = true;
      return inp;
    }
    const r = Math.random();
    if (r < pokeHeavy && dist <= heavyR) inp.heavy = true;
    else if (r < pokeHeavy + 0.14) inp[fwd] = true;
    else if (r < pokeHeavy + 0.22 && dist <= lightR) inp.light = true;
    else inp[back] = true;
    return inp;
  }

  private aiCanSpecial(f: Fighter, dist: number, oppAttacking: boolean, projIncoming: boolean) {
    if (f.cooldown > 0 || f.silence > 0) return false;
    switch (f.id) {
      case 'mie':
        return oppAttacking || projIncoming;
      case 'rei':
        return dist > 60;
      default:
        return this.canSpecial(f);
    }
  }

  /** デバッグ・演出用: 外部から任意のイベントを起こす */
  forceEvent(name: (typeof EVENT_NAMES)[number]) {
    if (this.phase === 'fight') this.fireEvent(name);
  }
}
