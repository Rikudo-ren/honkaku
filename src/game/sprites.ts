import type { Facing, IdleArm, Look, PoseId } from './types';

/**
 * ドット絵ファイター（約90px・3.2頭身ちび）。
 * 顔22×22・目6px級のアニメ顔で、10人を描き分ける。
 * (x, y) は足元中央、+x が正面（facing=1）、y は上向きにマイナス。
 */

type ArmPose =
  | 'down'
  | 'pocket'
  | 'fist'
  | 'walkF'
  | 'walkB'
  | 'crossed'
  | 'peace'
  | 'punch'
  | 'forward'
  | 'chamber'
  | 'up'
  | 'block'
  | 'raise'
  | 'swingDown'
  | 'spread'
  | 'flail'
  | 'hold'
  | 'hip'
  | 'none'
  | 'behind'
  | 'clap'
  | 'clapOpen'
  | 'cup';
type LegPose = 'stand' | 'walk' | 'jump' | 'crouch' | 'kick' | 'wide' | 'dangle' | 'dive';
type Face = 'normal' | 'hurt' | 'shout' | 'smile' | 'closed' | 'dizzy';

interface PoseParams {
  dy: number;
  lean: number;
  armF: ArmPose;
  armB: ArmPose;
  legs: LegPose;
  legFrame: number;
  face: Face;
  lying?: boolean;
  weapon?: boolean;
  paper?: boolean;
  /** シャーペンを前手に持つ（櫻の「要検証」） */
  pen?: boolean;
  /** ノートを胸の前で開いて見せる（櫻の告白） */
  openNote?: boolean;
}

export interface DrawOpts {
  pose: PoseId;
  phase?: 0 | 1 | 2;
  facing: Facing;
  t: number;
  flash?: boolean;
  alpha?: number;
}

/** 小物を胸に抱える立ち絵かどうか（内藤・櫻・塀） */
function isHug(look: Look): boolean {
  if (look.accessory === 'bookFront' || look.accessory === 'loveNote') return true;
  return look.outfit === 'suit' && look.accessory === 'map';
}

function idleArm(look: Look, side: 'F' | 'B'): ArmPose {
  const set: IdleArm | undefined = side === 'F' ? look.idleArmF : look.idleArmB;
  if (set) return set;
  if (isHug(look)) return 'hold';
  if (look.outfit === 'gym') return 'behind';
  return 'down';
}

function resolvePose(pose: PoseId, phase: 0 | 1 | 2, t: number, look: Look): PoseParams {
  const base: PoseParams = { dy: 0, lean: 0, armF: 'down', armB: 'down', legs: 'stand', legFrame: 0, face: 'normal' };
  const bob = Math.floor(t / 24) % 2 ? 2 : 0;
  const hug = isHug(look);
  const iF = idleArm(look, 'F');
  const iB = idleArm(look, 'B');
  switch (pose) {
    case 'idle':
      if (look.outfit === 'gym') return { ...base, dy: bob, armF: 'behind', armB: 'behind', lean: -2 };
      return { ...base, dy: bob, armF: iF, armB: iB };
    case 'frozen':
      return { ...base, face: 'closed', armF: iF, armB: iB };
    case 'walk': {
      const lf = Math.floor(t / (look.outfit === 'gym' ? 3 : 6)) % 4;
      if (look.outfit === 'gym') {
        return { ...base, dy: lf % 2 ? 0 : 2, lean: 3, legs: 'walk', legFrame: lf, armF: lf < 2 ? 'walkF' : 'walkB', armB: lf < 2 ? 'walkB' : 'walkF' };
      }
      return {
        ...base, dy: lf % 2 ? 0 : 2, lean: 2, legs: 'walk', legFrame: lf,
        armF: hug ? 'hold' : lf < 2 ? 'walkF' : 'walkB',
        armB: hug ? 'hold' : lf < 2 ? 'walkB' : 'walkF',
      };
    }
    case 'jump':
      return { ...base, legs: 'jump', armF: 'up', armB: 'up' };
    case 'crouch':
      return { ...base, dy: 10, legs: 'crouch', armF: iF, armB: iB };
    case 'getup':
      return { ...base, dy: 10, legs: 'crouch', face: 'hurt', armF: iF, armB: iB };
    case 'lose':
      return { ...base, dy: 10, legs: 'crouch', face: 'hurt', armF: iF, armB: iB };
    case 'block':
      return { ...base, armF: 'block', armB: iB, face: 'closed' };
    case 'jab':
      return phase === 0
        ? { ...base, armF: 'chamber', lean: -2 }
        : phase === 1
          ? { ...base, dy: 2, armF: 'punch', face: 'shout', legs: 'wide', lean: 3 }
          : { ...base, armF: 'forward', legs: 'wide' };
    case 'penJab':
      return phase === 0
        ? { ...base, armF: 'chamber', armB: hug ? 'hold' : 'down', lean: -2, pen: true }
        : phase === 1
          ? { ...base, dy: 2, armF: 'punch', armB: hug ? 'hold' : 'down', face: 'closed', legs: 'wide', lean: 3, pen: true }
          : { ...base, armF: 'hold', armB: 'hold', legs: 'wide', face: 'normal', pen: true };
    case 'cheerClap':
      return { ...base, armF: phase === 1 ? 'clap' : 'clapOpen', armB: phase === 1 ? 'clap' : 'clapOpen', legs: 'wide', lean: phase === 1 ? 2 : -2, face: 'shout' };
    case 'cheerTurn':
      return phase === 0
        ? { ...base, lean: -3, armF: 'hip', armB: 'hip', legs: 'crouch', dy: 4 }
        : phase === 1
          ? { ...base, lean: 5, armF: 'chamber', armB: 'flail', legs: 'walk', legFrame: Math.floor(t / 2) % 4 }
          : { ...base, lean: -3, armF: 'forward', armB: 'spread', legs: 'wide', face: 'shout' };
    case 'cheerCall':
      return phase === 0
        ? { ...base, armF: 'clapOpen', armB: 'clapOpen', face: 'closed', legs: 'wide' }
        : { ...base, lean: 3, armF: 'cup', armB: 'cup', face: 'shout', legs: 'wide' };
    case 'airStep':
      return { ...base, lean: 2, armF: 'spread', armB: 'spread', legs: 'jump' };
    case 'airClap':
      return { ...base, lean: 2, armF: phase === 1 ? 'clap' : 'clapOpen', armB: phase === 1 ? 'clap' : 'clapOpen', legs: 'jump', face: 'shout' };
    case 'airDive':
      return { ...base, lean: 3, armF: 'up', armB: 'flail', legs: phase === 1 ? 'dive' : 'jump', face: 'shout' };
    case 'confess':
      return { ...base, lean: 3, armF: 'hold', armB: 'hold', legs: 'wide', face: 'closed', openNote: true };
    case 'swing':
      return phase === 0
        ? { ...base, armF: 'raise', weapon: true, lean: -3 }
        : phase === 1
          ? { ...base, dy: 2, armF: 'swingDown', weapon: true, face: 'shout', legs: 'wide', lean: 3 }
          : { ...base, armF: 'forward', weapon: true, legs: 'wide' };
    case 'lash':
      return phase === 0
        ? { ...base, armF: 'chamber', weapon: true, lean: -2 }
        : phase === 1
          ? { ...base, dy: 2, armF: 'punch', weapon: true, face: 'shout', legs: 'wide', lean: 3 }
          : { ...base, armF: 'forward', legs: 'wide' };
    case 'kick':
      return phase === 0
        ? { ...base, lean: -3, armB: 'up' }
        : phase === 1
          ? { ...base, legs: 'kick', armF: 'chamber', armB: 'flail', lean: -2, face: 'shout' }
          : { ...base, legs: 'wide' };
    case 'throw':
      return phase === 0 ? { ...base, armF: 'raise', lean: -2 } : { ...base, dy: 2, armF: 'punch', legs: 'wide', lean: 3, face: 'shout' };
    case 'counter':
    case 'spread':
      return { ...base, armF: 'spread', armB: 'spread', legs: 'wide', face: 'shout' };
    case 'point':
      return phase === 0 ? { ...base, armF: 'chamber' } : { ...base, dy: 2, armF: 'punch', legs: 'wide', lean: 2 };
    case 'pointUp':
      return { ...base, armF: 'raise', face: phase === 1 ? 'shout' : 'normal' };
    case 'hurt':
      return { ...base, lean: -5, armF: 'flail', armB: 'flail', face: 'hurt' };
    case 'launch':
      return { ...base, lean: -7, armF: 'flail', armB: 'flail', legs: 'jump', face: 'hurt' };
    case 'down':
      return { ...base, lying: true };
    case 'stun':
      return { ...base, lean: Math.floor(t / 8) % 2 ? -2 : 2, face: 'dizzy', armF: iF, armB: iB };
    case 'grab':
      return { ...base, dy: 2, armF: 'punch', armB: 'punch', legs: 'wide', face: 'shout' };
    case 'grabbed':
      return { ...base, lean: -3, legs: 'dangle', armF: 'flail', armB: 'flail', face: 'hurt' };
    case 'paper':
      return { ...base, armF: 'raise', face: 'normal', paper: true };
    case 'win': {
      const wp = look.winPose ?? 'cheer';
      if (wp === 'tsundere') return { ...base, dy: bob, lean: -2, armF: 'behind', armB: 'behind', face: 'closed' };
      if (wp === 'cool') {
        const crossed = look.outfit === 'suit' || look.outfit === 'kensetsu';
        return { ...base, dy: bob, face: 'closed', armF: crossed ? 'crossed' : 'hip', armB: crossed ? 'crossed' : 'hip' };
      }
      if (wp === 'shy') return { ...base, dy: bob, face: 'smile', armF: 'block', armB: hug ? 'hold' : 'down' };
      if (wp === 'peace') return { ...base, dy: bob, face: 'smile', armF: 'peace' };
      if (wp === 'hug') return { ...base, dy: bob, face: 'smile', armF: 'hold', armB: 'hold' };
      return { ...base, dy: bob, face: 'smile', armF: 'up', armB: 'up', legs: bob ? 'wide' : 'stand' };
    }
  }
  return base;
}

/** 見た目ごとの決定的なシード（瞬き・揺れのタイミングをキャラごとにずらす） */
function seedOf(look: Look): number {
  const s = `${look.hair}${look.hairColor}${look.eyeColor}${look.outfit}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** hex カラーを白方向へ寄せる（髪ツヤ用）。amt 0〜1 */
function lighten(hex: string, amt: number): string {
  const h = hex.replace('#', '');
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amt);
  const to = (v: number) => mix(v).toString(16).padStart(2, '0');
  return `#${to(n(0))}${to(n(2))}${to(n(4))}`;
}

/**
 * ドット絵ファイターを描画する。(x, y) は足元中央。1px = ゲーム内1ピクセル。
 */
export function drawFighter(ctx: CanvasRenderingContext2D, x: number, y: number, look: Look, o: DrawOpts) {
  const F = o.facing;
  x = Math.round(x);
  y = Math.round(y);
  const flash = !!o.flash;
  const prevAlpha = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;

  const R = (lx: number, ly: number, w: number, h: number, c: string) => {
    ctx.fillStyle = flash ? '#ffffff' : c;
    ctx.fillRect(F === 1 ? x + lx : x - lx - w, y + ly, w, h);
  };

  const P = resolvePose(o.pose, o.phase ?? 0, o.t, look);
  const seed = seedOf(look);
  const skin = look.skin ?? '#f3d4b4';
  const skinD = look.skinDark ?? '#d9a986';
  const isF = look.gender === 'f';
  const outfit = look.outfit;
  const isGym = outfit === 'gym';
  const isSuit = outfit === 'suit';
  const isWork = outfit === 'kensetsu';
  const blazer = look.blazer ?? '#26335f';
  const blazerD = look.blazerDark ?? '#1b2547';
  const sleeve =
    isGym ? '#f5f4fa'
    : outfit === 'vest' ? '#eeeef4'
    : isSuit ? '#5c554b'
    : isWork ? '#2c3448'
    : blazer;
  const sleeveD =
    isGym ? '#d4d1df'
    : outfit === 'vest' ? '#c9c9d4'
    : isSuit ? '#46403a'
    : isWork ? '#222839'
    : blazerD;
  const body =
    isGym ? '#f5f4fa'
    : outfit === 'vest' ? '#242b4c'
    : isSuit ? '#5c554b'
    : isWork ? '#2c3448'
    : blazer;
  const pants = isSuit ? '#3a3d44' : isWork ? '#33363e' : '#243059';
  const shoe = look.shoeColor ?? (isGym ? '#f7f7fc' : isWork ? '#5a4632' : isF || isSuit ? '#5b3a22' : '#141418');
  const sockC = isGym ? '#f0f0f5' : '#22222e';
  const handC = isWork ? '#5a5346' : skin; // 土木作業は軍手
  const dy = P.dy;
  const ln = P.lean;
  const hc = look.hairColor;
  const hd = look.hairDark ?? hc;
  const hl = lighten(hc, 0.45); // 髪ツヤ
  const eye = look.eyeColor;
  const eyeStyle = look.eyeStyle ?? 'round';
  const lash = '#2a2028';
  const sway = Math.round(Math.sin((o.t + seed) / 9));
  const walking = P.legs === 'walk';
  const tieSway = walking ? Math.round(Math.sin(o.t / 4 + seed) * 2) : sway;
  const bounce = walking ? (P.legFrame % 2 === 1 ? 1 : 0) : 0; // 歩行の髪跳ね
  const blink = P.face === 'normal' && (o.t + seed) % 200 < 5;
  let hand = { x: 7, y: -32 + dy };

  // ═══════════ ダウン（横たわり） ═══════════
  if (P.lying) {
    const torsoC = isGym ? '#f5f4fa' : isWork ? '#e0691a' : isSuit ? '#5c554b' : outfit === 'vest' ? '#242b4c' : body;
    // 胴（横）
    R(-20, -14, 24, 12, torsoC);
    if (isWork) {
      R(-20, -10, 24, 3, '#c9d2dc');
      R(-12, -14, 3, 12, '#2c3448');
    }
    if (outfit === 'vest') R(-14, -14, 4, 12, '#f2f2f6');
    if (!isF && !isGym && !isWork && !isSuit) R(-9, -14, 3, 12, look.tieColor ?? '#a8262e');
    if (isSuit) R(-9, -14, 4, 12, '#2e3138');
    if (isF && !isGym) R(-2, -15, 13, 13, '#2a3357'); // スカート
    if (isGym) {
      R(-4, -15, 12, 7, '#29334e'); // 短パン
      R(5, -15, 2, 12, '#e9e9f1');
    }
    // 脚（横）
    const c = isF && !isWork ? skin : pants;
    R(4, -12, 18, 8, c);
    if (isF && !isGym) R(14, -12, 8, 8, sockC);
    if (isWork) R(8, -12, 4, 8, '#c9d2dc');
    R(22, -12, 5, 8, shoe);
    // 腕
    R(-14, -24, 5, 10, sleeve);
    R(-14, -27, 5, 3, handC);
    // 頭（横向き・大きめ）
    R(-36, -18, 17, 17, skin);
    R(-37, -21, 19, 6, hc);
    R(-37, -15, 5, 13, hc);
    if (look.hair === 'long') R(-41, -14, 5, 16, hc);
    if (look.hair === 'fluffy') R(-38, -21, 4, 5, hc);
    if (look.hair === 'spiky') {
      R(-38, -24, 4, 3, hc);
      R(-33, -25, 4, 4, hc);
      R(-28, -24, 3, 3, hc);
    }
    if (look.hair === 'bob' || look.hair === 'straight' || look.hair === 'messyAhoge' || look.hair === 'adult') {
      R(-38, -15, 4, 10, hc);
    }
    R(-26, -12, 3, 2, eye); // 閉じた目
    R(-24, -5, 3, 2, '#8a4a4a');
    if (look.blush) R(-29, -9, 3, 2, '#e89b9f');
    if (look.glasses) {
      const g = look.glassesColor ?? '#2a2a30';
      R(-29, -14, 8, 1, g);
      R(-29, -10, 8, 1, g);
    }
    if (look.accessory === 'headphones') {
      R(-16, -15, 5, 8, '#1c1c22');
      R(8, -15, 4, 7, '#1c1c22');
    }
    if (isGym) {
      R(-37, -19, 19, 3, '#f7f7fc'); // 鉢巻
      R(-42, -16, 7, 4, '#e9e9f1');
      R(-46, -14, 5, 3, '#f7f7fc');
      R(-16, -18, 3, 8, skin);
    }
    if (isWork) {
      // ヘルメットは脱げて頭の横に転がる
      R(-50, -10, 14, 8, '#facc15');
      R(-50, -10, 14, 2, '#fde047');
      R(-47, -6, 8, 2, '#2f9e44');
    }
    ctx.globalAlpha = prevAlpha;
    return;
  }

  // ═══════════ 脚 ═══════════
  const leg = (lx: number, ly: number, w: number, h: number) => {
    if (isWork) {
      R(lx, ly, w, h, pants);
      R(lx + (lx < 0 ? 0 : w - 3), ly + 5, 3, 5, '#2a2d33'); // カーゴポケット
      R(lx, ly + h - 13, w, 3, '#c9d2dc'); // 反射テープ
      R(lx, ly + h - 7, w + 1, 7, shoe); // 安全靴
      R(lx, ly + h - 2, w + 1, 2, '#2e2118');
      R(lx + 2, ly + h - 7, 2, 4, '#7a6248'); // 紐
      return;
    }
    if (isF) {
      R(lx, ly, w, h, skin);
      R(lx, ly, 1, h, skinD); // 脚の影
      if (isGym) {
        R(lx, ly + h - 8, w, 5, sockC); // 白クルーソックス
        R(lx, ly + h - 8, w, 1, '#d4d1df');
      } else {
        R(lx, ly + h - 15, w, 12, sockC); // 黒ニーハイ
        R(lx, ly + h - 15, w, 2, '#3a3a48');
      }
    } else {
      R(lx, ly, w, h, pants);
      R(lx + Math.floor(w / 2), ly, 1, h - 3, isSuit ? '#4a4d55' : '#2e3a68'); // 折り目
      R(lx, ly + h - 6, w, 3, '#1c1c28'); // 短い靴下
    }
    R(lx, ly + h - 3, w + 1, 3, shoe);
    if (isGym) {
      R(lx - 1, ly + h - 5, w + 2, 4, shoe);
      R(lx + 1, ly + h - 5, 3, 2, '#c4c6d3');
      R(lx - 1, ly + h - 2, w + 2, 2, '#29334e');
    } else if (isF || isSuit) {
      R(lx, ly + h - 3, w, 2, '#6b4a2e'); // ローファーの甲
      R(lx + 1, ly + h - 3, w - 2, 1, '#7d5a38');
    } else {
      R(lx + 1, ly + h - 3, 2, 1, '#3a3a44'); // 革靴のツヤ
    }
  };

  const legs = () => {
    const c = isF ? skin : pants;
    switch (P.legs) {
      case 'stand':
        leg(-9, -26, 7, 26);
        leg(2, -26, 7, 26);
        break;
      case 'walk': {
        const s = [4, 0, -4, 0][P.legFrame];
        const lift = s !== 0 ? 2 : 0;
        leg(-9 - s, -26 + (s > 0 ? lift : 0), 7, 26 - (s > 0 ? lift : 0));
        leg(2 + s, -26 + (s < 0 ? lift : 0), 7, 26 - (s < 0 ? lift : 0));
        break;
      }
      case 'jump':
        R(-9, -26, 7, 12, c);
        R(-14, -17, 7, 7, c);
        if (isF && !isGym) R(-14, -14, 7, 4, sockC);
        if (isWork) R(-14, -16, 3, 6, '#c9d2dc');
        R(-14, -11, 8, 4, shoe);
        R(2, -26, 7, 13, c);
        R(5, -15, 7, 7, c);
        if (isF && !isGym) R(5, -12, 7, 4, sockC);
        if (isWork) R(9, -14, 3, 6, '#c9d2dc');
        R(5, -9, 8, 4, shoe);
        break;
      case 'dive':
        leg(9, -27, 7, 27);
        R(-10, -26, 7, 10, c);
        R(-17, -20, 7, 5, c);
        R(-18, -20, 7, 5, sockC);
        R(-22, -20, 5, 7, shoe);
        break;
      case 'dangle':
        R(-9, -22, 7, 14, c);
        R(-9, -9, 8, 4, shoe);
        R(2, -22, 7, 15, c);
        R(2, -8, 8, 4, shoe);
        break;
      case 'crouch':
        leg(-12, -14, 8, 14);
        leg(4, -14, 8, 14);
        break;
      case 'kick':
        leg(-9, -26, 7, 26);
        R(2, -30, 22, 7, c);
        if (isF && !isGym) R(17, -30, 7, 7, sockC);
        if (isWork) R(14, -30, 4, 7, '#c9d2dc');
        R(24, -32, 5, 9, shoe);
        break;
      case 'wide':
        leg(-14, -26, 7, 26);
        leg(7, -26, 7, 26);
        break;
    }
  };

  // ═══════════ 腕 ═══════════
  const arm = (side: 'F' | 'B', p: ArmPose) => {
    const bx = side === 'F' ? 7 : -12;
    const c = sleeve;
    const H = (lx: number, ly: number, w = 4, h = 4) => {
      R(lx, ly, w, h, handC);
      if (side === 'F') hand = { x: lx, y: ly };
    };
    const cuffed = !isGym && !isWork;
    const CU = (lx: number, ly: number, w = 5) => {
      if (cuffed) R(lx + ln, ly + dy, w, 2, '#f4f4f8');
    };
    if (isGym) {
      // 半袖：肩だけ白、肘から先は肌。
      const S = (lx: number, ly: number, w = 7, h = 8) => R(lx + ln, ly + dy, w, h, sleeve);
      const A = (lx: number, ly: number, w: number, h: number) => R(lx + ln, ly + dy, w, h, skin);
      const front = side === 'F';
      const b = front ? 8 : -14;
      switch (p) {
        case 'none': return;
        case 'pocket':
        case 'fist':
        case 'behind':
        case 'down':
          S(b, -52);
          A(b + (front ? 1 : 1), -44, 5, 12);
          H(b + ln, -32 + dy, 4, 5);
          return;
        case 'walkF':
          S(b, -52);
          A(b + 2, -44, 5, 7);
          H(b + 2 + ln, -38 + dy, 4, 5);
          return;
        case 'walkB':
          S(b, -52);
          A(b - 2, -44, 5, 7);
          H(b - 2 + ln, -38 + dy, 4, 5);
          return;
        case 'crossed':
        case 'hold':
          S(b, -52);
          A(front ? 1 : -12, -43, 14, 5);
          H((front ? -4 : 2) + ln, -43 + dy, 5, 5);
          return;
        case 'clap':
        case 'clapOpen': {
          S(b, -52);
          const open = p === 'clapOpen';
          if (front) {
            A(14, -46, 8, 5);
            A(open ? 21 : 19, -55, 5, 10);
            H((open ? 20 : 18) + ln, -57 + dy, 5, 6);
          } else {
            A(-10, -44, 20, 5);
            A(8, -48, open ? 4 : 8, 5);
            H((open ? 8 : 14) + ln, -53 + dy, 5, 6);
          }
          return;
        }
        case 'cup':
          S(b, -52);
          if (front) {
            A(13, -56, 5, 13);
            H(9 + ln, -62 + dy, 5, 6);
          } else {
            A(-10, -45, 12, 5);
            A(-3, -56, 5, 13);
            H(-2 + ln, -62 + dy, 4, 6);
          }
          return;
        case 'hip':
          S(b, -52);
          A(b, -44, 5, 8);
          H(b + ln + (front ? -3 : 3), -38 + dy, 4, 5);
          return;
        case 'punch':
        case 'forward': {
          const reach = p === 'punch' ? 9 : 5;
          S(8, front ? -51 : -46, 8, 7);
          A(16, front ? -50 : -45, reach, 5);
          H((16 + reach) + ln, (front ? -51 : -46) + dy, 5, 6);
          return;
        }
        case 'chamber':
          S(5, -52);
          A(-5, -47, 12, 5);
          H(-9 + ln, -48 + dy, 5, 6);
          return;
        case 'up':
        case 'peace':
        case 'raise':
        case 'block': {
          const top = p === 'raise' ? -76 : -70;
          S(b, -57, 7, 8);
          A(b + 1, top + 6, 5, -51 - (top + 6));
          H(b + 1 + ln, top + dy, 4, 6);
          return;
        }
        case 'spread':
          S(b, -55, 7, 8);
          A(front ? 15 : -21, -60, 7, 8);
          H((front ? 22 : -27) + ln, -65 + dy, 4, 5);
          return;
        case 'flail':
          S(b, -52);
          A(front ? 13 : -19, -58, 5, 13);
          H((front ? 13 : -19) + ln, -63 + dy, 4, 5);
          return;
        case 'swingDown':
          S(b, -52);
          A(front ? 1 : -12, -43, 14, 5);
          H((front ? -4 : 2) + ln, -43 + dy, 5, 5);
          return;
      }
    }
    const rolled = (lx: number, ly: number, w: number, h: number) => R(lx + ln, ly + dy, w, h, skin);
    switch (p) {
      case 'none':
        break;
      case 'down':
        if (isWork) {
          R(bx + ln, -51 + dy, 5, 8, c);
          R(bx + ln, -43 + dy, 5, 2, '#3d4a68');
          rolled(bx, -41, 5, 9);
        } else {
          R(bx + ln, -51 + dy, 5, 19, c);
          R(bx + (side === 'F' ? 3 : 0) + ln, -51 + dy, 2, 19, sleeveD);
          CU(bx, -34);
        }
        H(bx + ln, -32 + dy, 4, 5);
        break;
      case 'pocket':
        R(bx + ln, -51 + dy, 5, 15, c);
        R(bx + (side === 'F' ? 3 : 0) + ln, -51 + dy, 2, 15, sleeveD);
        CU(bx, -37);
        if (side === 'F') hand = { x: bx + ln, y: -35 + dy };
        break;
      case 'fist': {
        const pump = Math.floor(o.t / 12) % 2;
        R(bx + ln, -51 + dy, 5, 17, c);
        R(bx + (side === 'F' ? 3 : 0) + ln, -51 + dy, 2, 17, sleeveD);
        CU(bx, -35);
        H(bx + ln, -34 + dy - pump, 5, 6);
        break;
      }
      case 'walkF':
        if (isWork) {
          R(bx + ln, -51 + dy, 5, 7, c);
          rolled(bx + 2, -44, 5, 7);
        } else {
          R(bx + ln, -51 + dy, 5, 8, c);
          R(bx + 2 + ln, -44 + dy, 5, 7, c);
          CU(bx + 2, -38);
        }
        H(bx + 2 + ln, -37 + dy, 4, 5);
        break;
      case 'walkB':
        if (isWork) {
          R(bx + ln, -51 + dy, 5, 7, c);
          rolled(bx - 2, -44, 5, 7);
        } else {
          R(bx + ln, -51 + dy, 5, 8, c);
          R(bx - 2 + ln, -44 + dy, 5, 7, c);
          CU(bx - 2, -38);
        }
        H(bx - 2 + ln, -37 + dy, 4, 5);
        break;
      case 'crossed':
        if (side === 'B') {
          R(-9 + ln, -42 + dy, 17, 5, c);
          R(-9 + ln, -42 + dy, 17, 2, sleeveD);
          CU(4, -42, 4);
          R(8 + ln, -42 + dy, 5, 5, handC);
        } else {
          R(3 + ln, -51 + dy, 7, 5, c);
          R(-7 + ln, -48 + dy, 17, 5, c);
          CU(-11, -48, 4);
          H(-14 + ln, -48 + dy, 5, 5);
        }
        break;
      case 'hip':
        R(bx + ln, -51 + dy, 5, 13, c);
        H(bx + ln + (side === 'F' ? -3 : 3), -39 + dy, 4, 5);
        break;
      case 'punch':
        if (side === 'F') {
          R(8 + ln, -47 + dy, 16, 5, c);
          R(8 + ln, -43 + dy, 16, 2, sleeveD);
          CU(19, -47, 5);
          H(24 + ln, -48 + dy, 5, 7);
        } else {
          R(7 + ln, -42 + dy, 16, 5, c);
          H(23 + ln, -43 + dy, 5, 7);
        }
        break;
      case 'forward':
        R(8 + ln, -47 + dy, 10, 5, c);
        CU(14, -47, 4);
        H(18 + ln, -48 + dy, 5, 7);
        break;
      case 'chamber':
        R(-5 + ln, -47 + dy, 10, 5, c);
        H(-10 + ln, -48 + dy, 5, 6);
        break;
      case 'up':
        R(bx + ln, -71 + dy, 5, 20, c);
        R(bx + (side === 'F' ? 3 : 0) + ln, -71 + dy, 2, 20, sleeveD);
        H(bx + ln, -76 + dy, 4, 6);
        break;
      case 'peace':
        R(bx + ln, -71 + dy, 5, 20, c);
        R(bx + ln, -75 + dy, 5, 4, handC);
        R(bx + ln, -80 + dy, 2, 5, handC);
        R(bx + 3 + ln, -80 + dy, 2, 5, handC);
        if (side === 'F') hand = { x: bx + ln, y: -75 + dy };
        break;
      case 'block':
        R(7 + ln, -51 + dy, 7, 5, c);
        R(12 + ln, -71 + dy, 5, 20, c);
        R(14 + ln, -71 + dy, 2, 20, sleeveD);
        H(12 + ln, -76 + dy, 4, 6);
        break;
      case 'raise':
        R(7 + ln, -54 + dy, 5, 7, c);
        R(10 + ln, -80 + dy, 5, 26, c);
        R(12 + ln, -80 + dy, 2, 26, sleeveD);
        H(10 + ln, -85 + dy, 4, 6);
        break;
      case 'swingDown':
        R(8 + ln, -47 + dy, 12, 5, c);
        R(20 + ln, -47 + dy, 5, 12, c);
        H(20 + ln, -35 + dy, 5, 6);
        break;
      case 'spread':
        if (side === 'F') {
          R(8 + ln, -52 + dy, 5, 5, c);
          R(13 + ln, -57 + dy, 5, 5, c);
          R(18 + ln, -62 + dy, 5, 5, c);
          H(23 + ln, -67 + dy, 4, 5);
        } else {
          R(-13 + ln, -52 + dy, 5, 5, c);
          R(-18 + ln, -57 + dy, 5, 5, c);
          R(-23 + ln, -62 + dy, 5, 5, c);
          H(-27 + ln, -67 + dy, 4, 5);
        }
        break;
      case 'flail':
        if (side === 'F') {
          R(10 + ln, -59 + dy, 5, 12, c);
          H(10 + ln, -64 + dy, 4, 5);
        } else {
          R(-15 + ln, -59 + dy, 5, 12, c);
          H(-15 + ln, -64 + dy, 4, 5);
        }
        break;
      case 'hold':
        if (side === 'F') {
          R(2 + ln, -42 + dy, 14, 5, c);
          R(2 + ln, -42 + dy, 14, 2, sleeveD);
          H(-5 + ln, -42 + dy, 7, 5);
        } else {
          R(-12 + ln, -51 + dy, 5, 10, c);
          H(-10 + ln, -42 + dy, 7, 5);
        }
        break;
      case 'clap':
      case 'clapOpen':
      case 'cup':
      case 'behind':
        R(bx + ln, -51 + dy, 5, 15, c);
        if (side === 'F') hand = { x: bx + ln, y: -35 + dy };
        break;
    }
  };

  // ═══════════ スカート・短パン ═══════════
  const skirt = () => {
    const flare = walking && P.legFrame % 2 === 1 ? 2 : 0;
    R(-14 - flare, -30 + dy, 28 + flare * 2, 14, '#2a3357');
    for (const px of [-9, -4, 1, 6]) R(px, -30 + dy, 2, 14, '#3a4266');
    R(-14 - flare, -25 + dy, 28 + flare * 2, 2, '#3a4266');
    R(-14 - flare, -20 + dy, 28 + flare * 2, 1, '#4a578c');
    R(-14 - flare, -30 + dy, 28 + flare * 2, 2, '#1a1f36');
    R(-14 - flare, -17 + dy, 28 + flare * 2, 2, '#1a1f36');
  };

  const glyph = (pattern: string[], lx: number, ly: number, color: string) => {
    pattern.forEach((row, yy) => [...row].forEach((dot, xx) => { if (dot === '1') R(lx + xx, ly + yy, 1, 1, color); }));
  };

  const shorts = () => {
    const navy = '#29334e';
    R(-12, -30 + dy, 24, 12, navy);
    R(-12, -20 + dy, 10, 4, navy);
    R(2, -20 + dy, 10, 4, navy);
    R(-12, -28 + dy, 2, 10, '#f5f4fa');
    R(10, -28 + dy, 2, 10, '#f5f4fa');
    R(0, -24 + dy, 1, 8, '#1c243a');
    R(-10, -17 + dy, 8, 2, '#36405a');
    // 右裾の「PE」（5pxフォント）
    glyph(['11110', '10010', '11110', '10000', '10000'], 2, -22 + dy, '#ffffff');
    glyph(['11110', '10010', '10110', '10010', '11110'], 8, -22 + dy, '#ffffff');
  };

  // ═══════════ 胴 ═══════════
  const torso = () => {
    if (isGym) {
      const navy = '#29334e';
      R(-12 + ln, -54 + dy, 24, 26, '#f5f4fa');
      R(-12 + ln, -48 + dy, 2, 20, '#d4d1df');
      R(10 + ln, -48 + dy, 2, 20, '#dedbe5');
      R(-10 + ln, -29 + dy, 20, 2, '#ffffff');
      // 紺の丸襟
      R(-5 + ln, -54 + dy, 11, 3, navy);
      R(-3 + ln, -54 + dy, 7, 2, skin);
      // 左肩から胸へ薄くなるハーフトーン
      for (let row = 0; row < 11; row++) {
        for (let col = 0; col < 10 - Math.floor(row / 2); col++) {
          if (row < 3 || (row + col) % 2 === 0) R(-10 + col + ln, -52 + row + dy, 1, 1, row < 5 ? navy : '#9da3b8');
        }
      }
      // 胸の縦書き「桐葉」（5pxグリフ×2文字）
      glyph(['01110', '01010', '11111', '01010', '01110'], 5 + ln, -48 + dy, navy);
      glyph(['01110', '01110', '00100', '01110', '00100'], 5 + ln, -42 + dy, navy);
      R(-5 + ln, -36 + dy, 2, 7, '#e2dfe9');
      return;
    }
    if (isWork) {
      R(-11 + ln, -53 + dy, 22, 27, '#2c3448');
      R(-11 + ln, -53 + dy, 3, 27, '#222839');
      R(-4 + ln, -53 + dy, 7, 5, '#e8e8e8'); // 白インナー
      R(-2 + ln, -53 + dy, 4, 2, skin);
      // オレンジのベスト
      R(-11 + ln, -51 + dy, 7, 25, '#e0691a');
      R(4 + ln, -51 + dy, 7, 25, '#e0691a');
      R(-11 + ln, -51 + dy, 2, 25, '#f08a3c');
      R(4 + ln, -51 + dy, 2, 25, '#f08a3c');
      // 銀の反射テープ
      R(-7 + ln, -51 + dy, 2, 25, '#c9d2dc');
      R(6 + ln, -51 + dy, 2, 25, '#c9d2dc');
      R(-11 + ln, -37 + dy, 7, 3, '#c9d2dc');
      R(4 + ln, -37 + dy, 7, 3, '#c9d2dc');
      // 安全第一ワッペン
      R(5 + ln, -48 + dy, 5, 4, '#e8e8e8');
      R(7 + ln, -48 + dy, 1, 4, '#2f9e44');
      R(5 + ln, -46 + dy, 5, 1, '#2f9e44');
      // 工具ベルト
      R(-11 + ln, -28 + dy, 22, 4, '#191c22');
      R(-2 + ln, -28 + dy, 4, 4, '#8a8f96');
      R(-14 + ln, -28 + dy, 3, 7, '#23262e');
      R(11 + ln, -28 + dy, 3, 7, '#23262e');
      R(-14 + ln, -31 + dy, 2, 3, '#c0392b');
      R(12 + ln, -31 + dy, 2, 3, '#f0b429');
      return;
    }
    if (isSuit) {
      R(-11 + ln, -53 + dy, 22, 27, '#5c554b');
      R(-11 + ln, -53 + dy, 3, 27, '#46403a');
      R(-9 + ln, -53 + dy, 2, 5, '#6e675c');
      // ラペル
      R(-7 + ln, -53 + dy, 2, 2, '#46403a');
      R(-5 + ln, -51 + dy, 2, 3, '#46403a');
      R(-4 + ln, -48 + dy, 2, 4, '#46403a');
      R(5 + ln, -53 + dy, 2, 2, '#46403a');
      R(3 + ln, -51 + dy, 2, 3, '#46403a');
      R(2 + ln, -48 + dy, 2, 4, '#46403a');
      // 白シャツ＋ダークベスト
      R(-4 + ln, -53 + dy, 7, 3, '#f4f4f8');
      R(-4 + ln, -50 + dy, 7, 22, '#2e3138');
      R(-1 + ln, -48 + dy, 2, 2, '#14161c');
      R(-1 + ln, -43 + dy, 2, 2, '#14161c');
      R(-1 + ln, -38 + dy, 2, 2, '#14161c');
      // ストライプのネクタイ
      const tie = look.tieColor ?? '#2f3a5a';
      R(-2 + ln, -50 + dy, 4, 3, tie);
      R(-2 + ln, -47 + dy, 4, 12, tie);
      R(-2 + ln, -44 + dy, 2, 2, '#93b4e6');
      R(0 + ln, -41 + dy, 2, 2, '#93b4e6');
      R(-2 + ln, -38 + dy, 2, 2, '#93b4e6');
      R(4 + ln, -44 + dy, 5, 2, '#46403a'); // 胸ポケット
      R(-11 + ln, -27 + dy, 22, 2, '#46403a');
      return;
    }
    // ── 学生服 ──
    R(-11 + ln, -53 + dy, 22, 27, body);
    if (outfit === 'vest') {
      R(-11 + ln, -53 + dy, 22, 27, '#f2f2f6');
      R(-11 + ln, -53 + dy, 22, 27, '#242b4c');
      // V開き
      R(-3 + ln, -53 + dy, 6, 2, '#f2f2f6');
      R(-3 + ln, -51 + dy, 6, 4, '#f2f2f6');
      R(-2 + ln, -47 + dy, 4, 2, '#f2f2f6');
      R(-11 + ln, -53 + dy, 2, 27, '#1a2040');
      R(-11 + ln, -28 + dy, 22, 2, '#1a2040'); // リブの裾
      for (let i = 0; i < 10; i++) R(-9 + i * 2 + ln, -28 + dy, 1, 2, '#2e3760');
    } else {
      // ブレザー：ラペル・ボタン・胸ポケット
      R(-7 + ln, -53 + dy, 2, 2, blazerD);
      R(-5 + ln, -51 + dy, 2, 3, blazerD);
      R(-4 + ln, -48 + dy, 2, 4, blazerD);
      R(5 + ln, -53 + dy, 2, 2, blazerD);
      R(3 + ln, -51 + dy, 2, 3, blazerD);
      R(2 + ln, -48 + dy, 2, 4, blazerD);
      R(-2 + ln, -33 + dy, 2, 2, '#c9a86a');
      R(-2 + ln, -29 + dy, 2, 2, '#c9a86a');
      R(4 + ln, -44 + dy, 5, 2, blazerD);
      R(-11 + ln, -27 + dy, 22, 2, blazerD);
    }
    if (isF) {
      R(-5 + ln, -53 + dy, 10, 3, '#f4f4f8'); // 白襟
      if (outfit === 'blazer') {
        R(-4 + ln, -50 + dy, 7, 18, '#232842'); // 下のベスト
        R(-1 + ln, -42 + dy, 2, 2, '#141828');
      }
      // 紺ストライプのリボン
      const rib = '#2f4f8f';
      const ribD = '#22386a';
      R(-7 + ln, -51 + dy, 5, 5, rib); // 左羽
      R(2 + ln, -51 + dy, 5, 5, rib); // 右羽
      R(-2 + ln, -51 + dy, 4, 5, ribD); // 結び目
      R(-6 + ln, -51 + dy, 2, 2, '#8fa3c8');
      R(4 + ln, -50 + dy, 2, 2, '#8fa3c8');
      R(-1 + ln, -51 + dy, 2, 5, '#3a5ea8');
      R(-4 + ln, -46 + dy, 2, 5, rib); // 垂れ
      R(2 + ln, -46 + dy, 2, 5, rib);
    } else {
      const tie = look.tieColor ?? '#a8262e';
      if (look.tieLoose) {
        R(-7 + ln, -53 + dy, 14, 3, '#f4f4f8'); // 開けた襟
        R(-4 + ln, -50 + dy, 7, 3, '#f4f4f8');
        R(-2 + ln, -53 + dy, 4, 2, skin);
        R(-2 + ln, -47 + dy, 4, 4, tie); // 低い結び目
        R(-2 + ln, -43 + dy, 4, 5, tie);
        R(-2 + tieSway + ln, -38 + dy, 4, 5, tie); // 揺れる剣先
        R(-1 + tieSway + ln, -33 + dy, 2, 2, tie);
      } else {
        R(-5 + ln, -53 + dy, 10, 3, '#f4f4f8');
        R(-2 + ln, -50 + dy, 4, 5, '#f4f4f8');
        R(-2 + ln, -50 + dy, 4, 4, tie);
        R(-2 + ln, -46 + dy, 4, 7, tie);
        R(-2 + tieSway + ln, -39 + dy, 4, 5, tie);
        R(-1 + tieSway + ln, -34 + dy, 2, 2, tie);
        if (look.tieStripe) {
          R(-2 + ln, -45 + dy, 2, 2, '#93b4e6');
          R(0 + ln, -42 + dy, 2, 2, '#93b4e6');
          R(-2 + tieSway + ln, -38 + dy, 2, 2, '#93b4e6');
        }
      }
    }
  };

  // ═══════════ 小物 ═══════════
  const calm =
    o.pose === 'idle' ||
    o.pose === 'walk' ||
    o.pose === 'win' ||
    o.pose === 'frozen' ||
    o.pose === 'crouch' ||
    o.pose === 'block' ||
    o.pose === 'stun' ||
    (o.pose === 'penJab' && (o.phase ?? 0) === 2);
  const accessory = () => {
    if (!calm) return;
    switch (look.accessory) {
      case 'bookFront':
        R(-6 + ln, -49 + dy, 15, 12, '#e9dfcc');
        R(-6 + ln, -49 + dy, 2, 12, '#7a5a3a');
        R(-6 + ln, -49 + dy, 15, 2, '#f4efe0');
        R(0 + ln, -46 + dy, 5, 5, '#8fa3c8');
        R(1 + ln, -45 + dy, 2, 2, '#e9dfcc');
        R(-2 + ln, -46 + dy, 2, 5, '#5a6a8a');
        R(1 + ln, -41 + dy, 4, 1, '#7a5a3a');
        break;
      case 'bookSide':
        R(4 + ln, -48 + dy, 10, 15, '#1c2340');
        R(4 + ln, -48 + dy, 2, 15, '#0e1230');
        R(12 + ln, -48 + dy, 2, 15, '#e9dfcc');
        R(7 + ln, -44 + dy, 3, 2, '#c9a86a');
        R(6 + ln, -41 + dy, 6, 2, '#c9a86a');
        R(6 + ln, -38 + dy, 4, 1, '#8a743a');
        break;
      case 'notebook':
        R(5 + ln, -48 + dy, 8, 12, '#f4f4f8');
        R(8 + ln, -46 + dy, 2, 8, '#111111');
        R(6 + ln, -43 + dy, 5, 2, '#111111');
        break;
      case 'loveNote':
        R(-6 + ln, -44 + dy, 15, 12, '#f3b3c6');
        R(-6 + ln, -44 + dy, 2, 12, '#c9748f');
        R(-2 + ln, -42 + dy, 10, 2, '#fde2ea');
        R(0 + ln, -39 + dy, 7, 2, '#a34d6b');
        R(0 + ln, -36 + dy, 5, 2, '#a34d6b');
        R(7 + ln, -35 + dy, 2, 2, '#e879f9');
        break;
      case 'map':
        R(-9 + ln, -49 + dy, 19, 17, '#e6dcc0');
        R(-9 + ln, -49 + dy, 3, 17, '#c9bd98');
        R(-9 + ln, -49 + dy, 3, 2, '#f4efe0');
        R(1 + ln, -46 + dy, 5, 2, '#7a9a6a');
        R(-1 + ln, -43 + dy, 8, 2, '#7a9a6a');
        R(1 + ln, -40 + dy, 7, 2, '#7a9a6a');
        R(3 + ln, -46 + dy, 2, 5, '#5a7a4a');
        R(5 + ln, -37 + dy, 3, 2, '#8a6a4a');
        R(-4 + ln, -37 + dy, 4, 1, '#a08a5a');
        break;
    }
  };

  // ═══════════ 頭 ═══════════
  const head = () => {
    const hx = ln;
    const hy = dy;
    // 首・顔（22×22）
    R(-4 + hx, -60 + hy, 8, 5, skinD);
    R(-11 + hx, -82 + hy, 22, 22, skin);
    R(-11 + hx, -74 + hy, 2, 8, skinD); // 頬の影
    R(9 + hx, -64 + hy, 2, 4, skinD); // 顎の影
    R(-5 + hx, -61 + hy, 10, 1, skinD);
    // 後ろ耳
    R(-13 + hx, -72 + hy, 3, 5, skin);
    R(-13 + hx, -71 + hy, 2, 3, skinD);

    // 目のスロット：後ろ目 x-4..1／前目 x4..9（6px）、基準y-73
    const EX = [-4, 4];
    const eyes = () => {
      if (blink) {
        for (const ex of EX) R(ex + hx, -69 + hy, 6, 2, eye);
        return;
      }
      switch (eyeStyle) {
        case 'sharp':
          for (const ex of EX) {
            R(ex - 1 + hx, -74 + hy, 8, 2, lash); // 切れ長の睫
            R(ex + hx, -72 + hy, 6, 4, eye);
            R(ex + 2 + hx, -72 + hy, 2, 4, '#1c1418');
            R(ex + 1 + hx, -72 + hy, 2, 2, '#ffffff');
            R(ex + 4 + hx, -70 + hy, 1, 1, '#ffffff');
          }
          break;
        case 'bright':
          for (const ex of EX) {
            R(ex - 1 + hx, -75 + hy, 8, 2, lash);
            R(ex + hx, -73 + hy, 6, 6, eye);
            R(ex + 2 + hx, -72 + hy, 2, 4, '#1c1418');
            R(ex + 1 + hx, -72 + hy, 2, 2, '#ffffff');
            R(ex + 4 + hx, -69 + hy, 2, 2, '#ffffff');
            R(ex + 1 + hx, -67 + hy, 4, 1, lash);
          }
          break;
        case 'calm':
          for (const ex of EX) {
            R(ex - 1 + hx, -72 + hy, 8, 2, lash); // 伏し目がち
            R(ex + hx, -70 + hy, 6, 3, eye);
            R(ex + 2 + hx, -70 + hy, 2, 3, '#1c1418');
            R(ex + 1 + hx, -70 + hy, 1, 1, '#ffffff');
          }
          break;
        case 'sleepy':
          for (const ex of EX) {
            R(ex + hx, -73 + hy, 6, 3, skinD); // まぶたの影
            R(ex - 1 + hx, -70 + hy, 8, 2, lash); // 半分閉じる
            R(ex + hx, -68 + hy, 6, 2, eye);
          }
          break;
        case 'tsun':
          for (let i = 0; i < 2; i++) {
            const ex = EX[i];
            const outer = i === 0 ? -1 : 1; // 目尻側
            R(ex - 1 + hx, -74 + hy, 8, 2, lash);
            R(ex + (outer < 0 ? -2 : 6) + hx, -75 + hy, 2, 2, lash); // 上がった目尻
            R(ex + hx, -72 + hy, 6, 4, eye);
            R(ex + 2 + hx, -72 + hy, 2, 3, '#1c1418');
            R(ex + 1 + hx, -72 + hy, 1, 1, '#ffffff');
          }
          break;
        default:
          for (const ex of EX) {
            R(ex - 1 + hx, -74 + hy, 8, 2, lash);
            R(ex + hx, -72 + hy, 6, 5, eye);
            R(ex + 2 + hx, -71 + hy, 2, 3, '#1c1418');
            R(ex + 1 + hx, -71 + hy, 2, 2, '#ffffff');
            R(ex + 4 + hx, -69 + hy, 1, 1, '#ffffff');
            R(ex + 1 + hx, -67 + hy, 4, 1, skinD);
          }
          break;
      }
    };
    const brows = () => {
      const bc = look.brows === 'flat' ? '#3a3430' : hd;
      const y = -79 + hy;
      switch (look.brows) {
        case 'angry':
          R(-5 + hx, y, 6, 2, bc);
          R(0 + hx, y + 2, 2, 2, bc);
          R(3 + hx, y, 6, 2, bc);
          R(3 + hx, y + 2, 2, 2, bc);
          break;
        case 'worried':
          R(-5 + hx, y, 6, 2, bc);
          R(-5 + hx, y + 2, 2, 2, bc);
          R(3 + hx, y, 6, 2, bc);
          R(7 + hx, y + 2, 2, 2, bc);
          break;
        case 'soft':
          R(-4 + hx, y, 5, 2, bc);
          R(4 + hx, y, 5, 2, bc);
          break;
        case 'thick':
          R(-6 + hx, y, 8, 2, bc);
          R(3 + hx, y, 8, 2, bc);
          break;
        case 'flat':
          R(-5 + hx, y, 7, 2, bc);
          R(4 + hx, y, 7, 2, bc);
          break;
      }
    };
    const mouthIdle = () => {
      const mc = '#8a4a4a';
      const mx = 0 + hx;
      switch (look.mouthIdle ?? 'flat') {
        case 'smile':
          R(mx - 1, -64 + hy, 2, 2, mc);
          R(mx + 1, -63 + hy, 4, 2, mc);
          R(mx + 5, -64 + hy, 2, 2, mc);
          break;
        case 'grin':
          R(mx - 1, -65 + hy, 8, 4, '#5a2323');
          R(mx - 1, -65 + hy, 8, 2, '#f4f4f8');
          break;
        case 'frown':
          R(mx + 1, -64 + hy, 4, 2, mc);
          R(mx - 1, -63 + hy, 2, 2, mc);
          R(mx + 5, -63 + hy, 2, 2, mc);
          break;
        case 'open':
          R(mx + 1, -65 + hy, 4, 4, '#5a2323');
          R(mx + 1, -63 + hy, 4, 2, '#e06a6a');
          break;
        case 'gritted':
          R(mx - 1, -65 + hy, 8, 4, '#f4f4f8');
          R(mx - 1, -63 + hy, 8, 1, '#5a2323');
          R(mx + 1, -65 + hy, 1, 4, '#c9c9d4');
          R(mx + 4, -65 + hy, 1, 4, '#c9c9d4');
          break;
        default:
          R(mx + 1, -63 + hy, 4, 2, mc);
          break;
      }
    };
    switch (P.face) {
      case 'normal':
        brows();
        eyes();
        mouthIdle();
        break;
      case 'shout':
        eyes();
        R(-1 + hx, -65 + hy, 8, 4, '#5a2323');
        R(1 + hx, -65 + hy, 4, 2, '#e06a6a');
        break;
      case 'smile':
        for (const ex of EX) {
          R(ex + hx, -71 + hy, 6, 2, eye); // 笑って細まる
          R(ex - 1 + hx, -72 + hy, 8, 1, lash);
        }
        R(-1 + hx, -64 + hy, 2, 2, '#8a4a4a');
        R(1 + hx, -63 + hy, 4, 2, '#8a4a4a');
        R(5 + hx, -64 + hy, 2, 2, '#8a4a4a');
        break;
      case 'closed':
        for (const ex of EX) R(ex + hx, -69 + hy, 6, 2, eye);
        if (look.mouthIdle === 'gritted') {
          R(-1 + hx, -65 + hy, 8, 4, '#f4f4f8');
          R(-1 + hx, -63 + hy, 8, 1, '#5a2323');
        } else mouthIdle();
        break;
      case 'hurt':
        for (const ex of EX) {
          // >< の苦悶
          R(ex + hx, -73 + hy, 2, 2, eye);
          R(ex + 2 + hx, -71 + hy, 2, 2, eye);
          R(ex + 4 + hx, -73 + hy, 2, 2, eye);
          R(ex + 2 + hx, -69 + hy, 2, 2, eye);
        }
        R(1 + hx, -65 + hy, 4, 4, '#5a2323');
        break;
      case 'dizzy':
        for (const ex of EX) {
          // 渦巻き目
          R(ex + hx, -73 + hy, 6, 5, eye);
          R(ex + 1 + hx, -72 + hy, 4, 3, skin);
          R(ex + 2 + hx, -71 + hy, 2, 2, eye);
          R(ex + 1 + hx, -72 + hy, 1, 1, '#ffffff');
        }
        R(-1 + hx, -63 + hy, 2, 2, '#8a4a4a');
        R(1 + hx, -64 + hy, 2, 2, '#8a4a4a');
        R(3 + hx, -63 + hy, 2, 2, '#8a4a4a');
        R(5 + hx, -64 + hy, 2, 2, '#8a4a4a');
        break;
    }
    if (look.blush) {
      R(-9 + hx, -69 + hy, 4, 2, '#e89b9f');
      R(-8 + hx, -70 + hy, 2, 1, '#f4b8bc');
      R(8 + hx, -69 + hy, 3, 2, '#e89b9f');
    }
    if (look.stubble) {
      for (let i = 0; i < 6; i++) R(-8 + i * 3 + hx, -62 + hy, 2, 1, skinD);
      R(-6 + hx, -64 + hy, 2, 1, skinD);
      R(4 + hx, -64 + hy, 2, 1, skinD);
      R(-11 + hx, -68 + hy, 2, 5, hd); // もみあげ
    }
    if (look.sweat && P.face !== 'smile' && P.face !== 'shout') {
      const drip = Math.floor(o.t / 20) % 4;
      R(11 + hx, -72 + hy + drip * 2, 2, 4, '#a8dcff');
      R(11 + hx, -72 + hy + drip * 2, 2, 2, '#e6f6ff');
    }
    if (look.glasses) {
      // 目の周りの細いフレーム。レンズは透明。
      const g = look.glassesColor ?? '#2a2a30';
      for (const ex of EX) {
        R(ex - 2 + hx, -76 + hy, 10, 2, g); // 上枠
        R(ex - 2 + hx, -66 + hy, 10, 1, g); // 下枠（細）
        R(ex - 2 + hx, -74 + hy, 2, 9, g);
        R(ex + 6 + hx, -74 + hy, 2, 9, g);
      }
      R(1 + hx, -71 + hy, 3, 2, g); // ブリッジ
      R(-11 + hx, -71 + hy, 8, 2, g); // テンプル
    }
    // ── 髪 ──
    R(-13 + hx, -90 + hy, 27, 10, hc); // 頭頂
    R(7 + hx, -90 + hy, 7, 10, hd); // 右の影
    R(-9 + hx, -90 + hy, 8, 3, hl); // ツヤ
    R(-11 + hx, -87 + hy, 3, 2, hl);
    switch (look.hair) {
      case 'short':
        R(-13 + hx, -80 + hy, 4, 9, hc);
        R(10 + hx, -80 + hy, 3, 5, hc);
        R(-12 + hx, -72 + hy, 2, 4, hd); // もみあげ
        R(-8 + hx, -81 + hy, 14, 2, hc); // 揃った前髪
        R(-6 + hx, -79 + hy, 2, 2, hc);
        R(-1 + hx, -79 + hy, 2, 2, hc);
        R(4 + hx, -79 + hy, 2, 2, hc);
        R(-13 + hx, -71 + hy, 4, 4, hd); // 襟足
        break;
      case 'spiky':
        R(-11 + hx, -94 + hy, 5, 4, hc);
        R(-4 + hx, -96 + hy, 5, 6, hc);
        R(3 + hx, -94 + hy, 5, 4, hc);
        R(9 + hx, -92 + hy, 4, 3, hc);
        R(-15 + hx, -88 + hy, 4, 4, hc);
        R(9 + hx, -86 + hy, 6, 4, hc);
        R(11 + hx, -82 + hy, 4, 3, hc);
        R(-8 + hx, -92 + hy, 2, 2, hd);
        R(2 + hx, -92 + hy, 2, 2, hd);
        R(-13 + hx, -80 + hy, 4, 8, hc);
        R(10 + hx, -80 + hy, 3, 6, hc);
        R(-2 + hx, -81 + hy, 8, 2, hc); // 短い前髪
        R(3 + hx, -79 + hy, 2, 2, hc);
        break;
      case 'long': {
        // 姫カット＋腰までのストレート。毛先が揺れる。
        R(-8 + hx, -81 + hy, 14, 2, hc);
        R(-6 + hx, -79 + hy, 2, 2, hc);
        R(-1 + hx, -79 + hy, 2, 2, hc);
        R(4 + hx, -79 + hy, 2, 2, hc);
        R(-14 + hx, -80 + hy, 4, 14, hc); // サイド
        R(10 + hx, -80 + hy, 4, 11, hc);
        R(10 + hx, -70 + hy, 4, 16, hc); // 肩にかかる前髪
        R(-15 + hx, -80 + hy, 5, 34, hc); // 背中の髪
        R(-17 + hx, -68 + hy, 2, 20, hc);
        R(-15 + hx, -80 + hy, 2, 34, hd);
        R(-13 + hx, -80 + hy, 1, 30, hl);
        const tip = -46 + bounce * 2;
        R(-15 + sway * 2 + hx, tip + hy, 5, 9, hc); // 揺れる毛先
        R(-14 + sway * 2 + hx, tip + 9 + hy, 3, 2, hc);
        break;
      }
      case 'bob':
        R(-15 + hx, -86 + hy, 4, 6, hc);
        R(11 + hx, -86 + hy, 4, 5, hc);
        R(-6 + hx, -81 + hy, 12, 2, hc);
        R(-4 + hx, -79 + hy, 2, 2, hc);
        R(2 + hx, -79 + hy, 2, 2, hc);
        R(-15 + hx, -80 + hy, 4, 16, hc);
        R(11 + hx, -80 + hy, 4, 15, hc);
        R(-14 + hx, -65 + hy, 4, 4, hc); // 丸い裾
        R(10 + hx, -65 + hy, 4, 4, hc);
        R(-15 + hx, -80 + hy, 2, 16, hd);
        break;
      case 'straight':
        R(-15 + hx, -88 + hy, 4, 4, hc);
        R(11 + hx, -88 + hy, 4, 3, hc);
        R(-10 + hx, -81 + hy, 20, 4, hc); // 厚い前髪
        R(-8 + hx, -77 + hy, 2, 2, hc);
        R(-2 + hx, -77 + hy, 2, 2, hc);
        R(4 + hx, -77 + hy, 2, 2, hc);
        R(-13 + hx, -80 + hy, 4, 12, hc);
        R(10 + hx, -80 + hy, 4, 11, hc);
        R(-13 + hx, -69 + hy, 4, 6, hd);
        R(-6 + hx, -90 + hy, 2, 2, hd);
        R(3 + hx, -89 + hy, 2, 2, hd);
        break;
      case 'messy':
        R(-15 + hx, -88 + hy, 4, 4, hc);
        R(-8 + hx, -94 + hy, 4, 4, hc);
        R(0 + hx, -92 + hy, 4, 2, hc);
        R(6 + hx, -94 + hy, 4, 4, hc);
        R(11 + hx, -90 + hy, 4, 3, hc);
        R(-13 + hx, -80 + hy, 4, 9, hc);
        R(-2 + hx, -81 + hy, 4, 2, hc);
        R(4 + hx, -81 + hy, 2, 4, hc);
        R(8 + hx, -81 + hy, 4, 2, hc);
        break;
      case 'messyAhoge':
        R(-15 + hx, -88 + hy, 4, 5, hc);
        R(-10 + hx, -94 + hy, 4, 4, hc);
        R(-2 + hx, -96 + hy, 4, 6, hc);
        R(6 + hx, -94 + hy, 4, 4, hc);
        R(11 + hx, -90 + hy, 4, 4, hc);
        R(-13 + hx, -80 + hy, 4, 8, hc);
        R(10 + hx, -80 + hy, 4, 6, hc);
        R(-4 + hx, -81 + hy, 4, 2, hc);
        R(4 + hx, -81 + hy, 2, 4, hc);
        R(8 + hx, -81 + hy, 4, 2, hc);
        R(-8 + hx, -90 + hy, 2, 2, hd);
        R(4 + hx, -90 + hy, 2, 2, hd);
        // 跳ねたアホ毛
        R(0 + hx, -100 + hy, 2, 4, hc);
        R(2 + hx, -102 + hy, 4, 2, hc);
        R(4 + hx, -100 + hy, 2, 2, hc);
        break;
      case 'adult':
        R(-15 + hx, -88 + hy, 5, 10, hc);
        R(10 + hx, -88 + hy, 5, 8, hc);
        R(-8 + hx, -81 + hy, 10, 2, hc); // 流した前髪
        R(6 + hx, -81 + hy, 2, 5, hc);
        R(-15 + hx, -80 + hy, 4, 14, hc);
        R(11 + hx, -80 + hy, 4, 13, hc);
        R(-16 + sway * 2 + hx, -68 + hy, 4, 7, hc); // 揺れる裾
        R(-14 + hx, -68 + hy, 4, 9, hd);
        R(-4 + hx, -90 + hy, 4, 2, '#8a8078'); // 灰色の筋
        R(5 + hx, -88 + hy, 2, 2, '#8a8078');
        break;
      case 'fluffy':
        R(-15 + hx, -88 + hy, 5, 10, hc);
        R(11 + hx, -88 + hy, 4, 9, hc);
        R(-11 + hx, -94 + hy, 5, 4, hc);
        R(-4 + hx, -96 + hy, 5, 6, hc);
        R(3 + hx, -94 + hy, 5, 4, hc);
        R(9 + hx, -92 + hy, 4, 3, hc);
        R(-8 + hx, -81 + hy, 6, 4, hc); // 長めの前髪
        R(0 + hx, -81 + hy, 4, 4, hc);
        R(6 + hx, -81 + hy, 4, 5, hc);
        R(-15 + hx, -80 + hy, 5, 16, hc);
        R(-14 + hx, -65 + hy, 4, 4, hc);
        R(-6 + hx, -90 + hy, 2, 2, hd);
        R(2 + hx, -88 + hy, 2, 2, hd);
        R(7 + hx, -90 + hy, 2, 2, hd);
        R(-11 + hx, -84 + hy, 2, 5, hd);
        break;
    }
    if (look.accessory === 'headphones') {
      // 首にかけたヘッドホン
      R(-13 + hx, -62 + hy, 26, 4, '#2b2b32');
      R(-16 + hx, -66 + hy, 5, 10, '#1c1c22');
      R(11 + hx, -66 + hy, 5, 10, '#1c1c22');
      R(-16 + hx, -64 + hy, 2, 7, '#3a3a44');
      R(14 + hx, -64 + hy, 2, 7, '#3a3a44');
      R(-14 + hx, -62 + hy, 2, 4, '#5c5c6a');
      R(12 + hx, -62 + hy, 2, 4, '#5c5c6a');
    }
  };

  /** 白い鉢巻と後ろのリボン結び。動くと端がなびく。 */
  const headband = () => {
    if (!isGym) return;
    const flap = o.pose === 'idle' || o.pose === 'win' ? 0 : Math.floor(o.t / 4) % 4;
    R(-13 + ln, -86 + dy, 27, 5, '#f7f7fc');
    R(-13 + ln, -82 + dy, 27, 2, '#dedbe5');
    R(-6 + ln, -90 + dy, 4, 4, '#79564b'); // 前髪のハイライト
    R(5 + ln, -90 + dy, 2, 9, hc);
    R(-8 + ln, -82 + dy, 4, 2, hc); // 鉢巻にかかる前髪
    R(2 + ln, -82 + dy, 2, 2, hc);
    // 後ろのリボン結び＋なびく端
    R(-18 + ln, -86 + dy, 7, 7, '#f7f7fc');
    R(-16 + ln, -84 + dy, 4, 3, '#dedbe5');
    R(-21 + ln - flap, -82 + dy, 7, 5, '#e9e9f1');
    R(-24 + ln - flap, -80 + dy, 5, 4, '#f7f7fc');
    R(-18 + ln, -79 + dy, 5, 9, '#f7f7fc');
    R(-19 + ln - flap, -71 + dy, 5, 7, '#e9e9f1');
    R(-20 + ln - flap, -65 + dy, 5, 4, '#f7f7fc');
  };

  /** 工事ヘルメット。緑のライン＋安全第一の十字。 */
  const helmet = () => {
    if (outfit !== 'kensetsu') return;
    const hx = ln;
    const hy = dy;
    R(-13 + hx, -92 + hy, 27, 5, '#facc15');
    R(-11 + hx, -94 + hy, 23, 2, '#fde047');
    R(-9 + hx, -96 + hy, 6, 2, '#fde047');
    R(-13 + hx, -88 + hy, 27, 2, '#2f9e44'); // 緑ライン
    R(-13 + hx, -86 + hy, 27, 3, '#e0a800');
    R(-13 + hx, -86 + hy, 27, 2, '#f6d030');
    R(10 + hx, -86 + hy, 7, 2, '#c78a00'); // 前面のツバ
    R(10 + hx, -84 + hy, 4, 2, '#e0a800');
    R(-4 + hx, -98 + hy, 8, 2, '#fdd835'); // 頭頂
    // 前面の緑十字
    R(3 + hx, -92 + hy, 2, 5, '#2f9e44');
    R(1 + hx, -90 + hy, 6, 2, '#2f9e44');
    R(-2 + hx, -82 + hy, 4, 2, look.hairColor); // 額の毛
  };

  // ═══════════ 武器 ═══════════
  const weapon = () => {
    const dropped = o.pose === 'hurt' || o.pose === 'launch' || o.pose === 'grabbed';
    const showIdleHammer = isWork && !P.weapon && !P.lying && !dropped;
    if (!P.weapon && !showIdleHammer) {
      if ((o.pose === 'jab' || o.pose === 'penJab') && (o.phase ?? 0) === 1 && look.weapon === 'none') {
        R(hand.x + 5, hand.y - 2, 3, 2, '#e8ecf0');
        R(hand.x + 7, hand.y + 2, 3, 2, '#e8ecf0');
      }
      return;
    }
    const hx = hand.x;
    const hy = hand.y;
    if (!showIdleHammer && (o.pose === 'swing' || o.pose === 'lash') && (o.phase ?? 0) === 1) {
      // 振り抜きの斬撃線
      R(hx + 5, hy - 12, 2, 5, '#e8ecf0');
      R(hx + 7, hy - 7, 2, 5, '#e8ecf0');
      R(hx + 7, hy - 2, 2, 4, '#e8ecf0');
      R(hx + 8, hy - 6, 2, 2, '#ffffff');
    }
    switch (look.weapon) {
      case 'bowl':
        // 二郎系ラーメン（湯気つき）
        R(hx - 5, hy - 2, 15, 8, '#f4f0e8');
        R(hx - 5, hy - 2, 15, 2, '#c0392b');
        R(hx - 5, hy + 4, 15, 2, '#d8cfc0');
        R(hx - 3, hy - 5, 11, 3, '#e8c46a');
        R(hx, hy - 7, 3, 2, '#fff2a8');
        R(hx + 5, hy - 7, 3, 2, '#a0522d');
        R(hx - 2, hy - 5, 2, 2, '#7a9a6a');
        R(hx - 7, hy - 9, 2, 4, '#d8d8d8'); // 割り箸
        R(hx + 10, hy - 9, 2, 4, '#d8d8d8');
        R(hx + 1, hy - 11, 2, 2, 'rgba(255,255,255,0.7)'); // 湯気
        R(hx + 5, hy - 13, 2, 2, 'rgba(255,255,255,0.7)');
        break;
      case 'book':
        R(hx - 4, hy - 12, 10, 13, '#e9dfcc');
        R(hx - 4, hy - 12, 2, 13, '#7a5a3a');
        R(hx - 4, hy - 12, 10, 2, '#f4efe0');
        R(hx, hy - 8, 4, 5, '#8fa3c8');
        R(hx + 1, hy - 7, 2, 2, '#e9dfcc');
        break;
      case 'binder':
        R(hx - 2, hy - 15, 12, 17, '#f4f4f8');
        R(hx - 2, hy - 15, 12, 2, '#2c4a8a');
        R(hx + 2, hy - 10, 5, 2, '#333333');
        R(hx + 2, hy - 7, 5, 2, '#333333');
        R(hx + 2, hy - 4, 5, 2, '#c0392b');
        break;
      case 'paper':
        R(hx - 2, hy - 10, 13, 12, '#ffffff');
        R(hx, hy - 8, 10, 2, '#99a0aa');
        R(hx, hy - 5, 10, 2, '#99a0aa');
        R(hx, hy - 2, 7, 2, '#99a0aa');
        R(hx, hy - 8, 2, 2, '#c0392b');
        break;
      case 'python':
        for (let i = 0; i < 18; i++) {
          const wy = Math.round(Math.sin(i * 1.1 + o.t * 0.6) * 2.5);
          R(hx + 5 + i * 3, hy + wy, 3, 3, i % 2 ? '#3776ab' : '#ffd43b');
        }
        R(hx + 59, hy - 2, 5, 5, '#3776ab');
        R(hx + 59, hy - 2, 2, 2, '#ffd43b');
        break;
      case 'lovenote':
        R(hx - 2, hy - 15, 12, 17, '#f3b3c6');
        R(hx - 2, hy - 15, 2, 17, '#c9748f');
        R(hx + 2, hy - 12, 7, 2, '#fde2ea');
        R(hx + 2, hy - 9, 5, 2, '#a34d6b');
        R(hx + 2, hy - 6, 7, 2, '#a34d6b');
        R(hx + 5, hy - 3, 2, 2, '#e879f9');
        break;
      case 'hammer': {
        if (showIdleHammer) {
          R(hx, hy + 4, 5, 17, '#9c6a34');
          R(hx, hy + 4, 2, 17, '#b98a4e');
          R(hx - 1, hy + 19, 7, 4, '#4a3518');
          R(hx - 7, hy + 21, 19, 8, '#565b63');
          R(hx - 7, hy + 21, 19, 2, '#a7adb8');
          R(hx - 9, hy + 19, 3, 11, '#3a3f46');
          R(hx + 10, hy + 19, 3, 11, '#3a3f46');
          R(hx - 5, hy + 21, 5, 3, '#e8ecf0');
          break;
        }
        R(hx - 2, hy + 2, 5, 27, '#9c6a34');
        R(hx - 2, hy + 2, 2, 27, '#b98a4e');
        R(hx + 1, hy + 5, 2, 20, '#6e4a22');
        R(hx - 2, hy + 29, 5, 4, '#4a3518');
        R(hx - 9, hy - 14, 19, 10, '#a7adb8');
        R(hx - 9, hy - 14, 19, 2, '#d5dae1');
        R(hx - 9, hy - 7, 19, 3, '#565b63');
        R(hx - 11, hy - 16, 3, 12, '#3a3f46');
        R(hx + 8, hy - 16, 3, 12, '#3a3f46');
        R(hx - 7, hy - 14, 5, 3, '#e8ecf0');
        break;
      }
      case 'map':
        R(hx - 4, hy - 14, 14, 17, '#e6dcc0');
        R(hx - 4, hy - 14, 14, 2, '#c9bd98');
        R(hx - 4, hy - 14, 2, 17, '#c9bd98');
        R(hx + 3, hy - 14, 2, 17, '#c9bd98');
        R(hx - 1, hy - 9, 10, 2, '#7a9a6a');
        R(hx - 1, hy - 4, 10, 2, '#7a9a6a');
        R(hx + 2, hy - 9, 2, 4, '#5a7a4a');
        break;
    }
  };

  const pen = () => {
    if (!P.pen) return;
    const hx = hand.x;
    const hy = hand.y;
    R(hx + 5, hy + 2, 10, 2, '#1f2937');
    R(hx + 5, hy + 2, 3, 2, '#e5e7eb');
    R(hx + 15, hy + 2, 2, 2, '#9ca3af');
  };

  const openNote = () => {
    if (!P.openNote) return;
    R(-12 + ln, -52 + dy, 24, 15, '#fde2ea');
    R(-1 + ln, -52 + dy, 2, 15, '#c9748f');
    R(-9 + ln, -49 + dy, 7, 2, '#a34d6b');
    R(-9 + ln, -45 + dy, 5, 2, '#a34d6b');
    R(-9 + ln, -41 + dy, 7, 2, '#a34d6b');
    R(3 + ln, -49 + dy, 7, 2, '#a34d6b');
    R(3 + ln, -45 + dy, 7, 2, '#e879f9');
    R(3 + ln, -41 + dy, 4, 2, '#a34d6b');
  };

  const paper = () => {
    if (!P.paper) return;
    const hx = hand.x;
    const hy = hand.y;
    R(hx - 7, hy - 22, 22, 20, '#ffffff');
    R(hx - 5, hy - 19, 17, 2, '#333333');
    R(hx - 5, hy - 15, 14, 2, '#333333');
    R(hx - 5, hy - 11, 17, 2, '#333333');
    R(hx - 5, hy - 7, 10, 2, '#333333');
  };

  arm('B', P.armB);
  legs();
  if (isGym) shorts();
  else if (isF) skirt();
  torso();
  accessory();
  head();
  helmet();
  headband();
  arm('F', P.armF);
  weapon();
  paper();
  pen();
  openNote();
  ctx.globalAlpha = prevAlpha;
}

/** 足元の影 */
export function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, airHeight: number) {
  const w = Math.max(10, 28 - airHeight * 0.25);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(Math.round(x - w / 2), y - 1, Math.round(w), 2);
}
