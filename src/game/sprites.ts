import type { Facing, IdleArm, Look, PoseId } from './types';

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
  const bob = Math.floor(t / 24) % 2;
  const hug = isHug(look);
  const iF = idleArm(look, 'F');
  const iB = idleArm(look, 'B');
  switch (pose) {
    case 'idle':
      if (look.outfit === 'gym') return { ...base, dy: bob, armF: 'behind', armB: 'behind', lean: -1 };
      return { ...base, dy: bob, armF: iF, armB: iB };
    case 'frozen':
      return { ...base, face: 'closed', armF: iF, armB: iB };
    case 'walk': {
      if (look.outfit === 'gym') {
        const lf = Math.floor(t / 3) % 4;
        return { ...base, dy: lf % 2 ? 0 : 1, lean: 2, legs: 'walk', legFrame: lf, armF: lf < 2 ? 'walkF' : 'walkB', armB: lf < 2 ? 'walkB' : 'walkF' };
      }
      const lf = Math.floor(t / 6) % 4;
      return {
        ...base, dy: lf % 2 ? 0 : 1, lean: 1, legs: 'walk', legFrame: lf,
        armF: hug ? 'hold' : lf < 2 ? 'walkF' : 'walkB',
        armB: hug ? 'hold' : lf < 2 ? 'walkB' : 'walkF',
      };
    }
    case 'jump':
      return { ...base, legs: 'jump', armF: 'up', armB: 'up' };
    case 'crouch':
      return { ...base, dy: 6, legs: 'crouch', armF: iF, armB: iB };
    case 'getup':
      return { ...base, dy: 6, legs: 'crouch', face: 'hurt', armF: iF, armB: iB };
    case 'lose':
      return { ...base, dy: 6, legs: 'crouch', face: 'hurt', armF: iF, armB: iB };
    case 'block':
      return { ...base, armF: 'block', armB: iB, face: 'closed' };
    case 'jab':
      return phase === 0
        ? { ...base, armF: 'chamber', lean: -1 }
        : phase === 1
          ? { ...base, dy: 1, armF: 'punch', face: 'shout', legs: 'wide', lean: 2 }
          : { ...base, armF: 'forward', legs: 'wide' };
    case 'penJab':
      // シャーペンで突いてから、ノートにメモする
      return phase === 0
        ? { ...base, armF: 'chamber', armB: hug ? 'hold' : 'down', lean: -1, pen: true }
        : phase === 1
          ? { ...base, dy: 1, armF: 'punch', armB: hug ? 'hold' : 'down', face: 'closed', legs: 'wide', lean: 2, pen: true }
          : { ...base, armF: 'hold', armB: 'hold', legs: 'wide', face: 'normal', pen: true };
    case 'cheerClap':
      return { ...base, armF: phase === 1 ? 'clap' : 'clapOpen', armB: phase === 1 ? 'clap' : 'clapOpen', legs: 'wide', lean: phase === 1 ? 1 : -1, face: 'shout' };
    case 'cheerTurn':
      return phase === 0
        ? { ...base, lean: -2, armF: 'hip', armB: 'hip', legs: 'crouch', dy: 2 }
        : phase === 1
          ? { ...base, lean: 3, armF: 'chamber', armB: 'flail', legs: 'walk', legFrame: Math.floor(t / 2) % 4 }
          : { ...base, lean: -2, armF: 'forward', armB: 'spread', legs: 'wide', face: 'shout' };
    case 'cheerCall':
      return phase === 0
        ? { ...base, armF: 'clapOpen', armB: 'clapOpen', face: 'closed', legs: 'wide' }
        : { ...base, lean: 2, armF: 'cup', armB: 'cup', face: 'shout', legs: 'wide' };
    case 'airStep':
      return { ...base, lean: 1, armF: 'spread', armB: 'spread', legs: 'jump' };
    case 'airClap':
      return { ...base, lean: 1, armF: phase === 1 ? 'clap' : 'clapOpen', armB: phase === 1 ? 'clap' : 'clapOpen', legs: 'jump', face: 'shout' };
    case 'airDive':
      return { ...base, lean: 2, armF: 'up', armB: 'flail', legs: phase === 1 ? 'dive' : 'jump', face: 'shout' };
    case 'confess':
      // 深呼吸して、ノートを胸の前で開く。目は閉じている（緊張）
      return { ...base, lean: 2, armF: 'hold', armB: 'hold', legs: 'wide', face: 'closed', openNote: true };
    case 'swing':
      return phase === 0
        ? { ...base, armF: 'raise', weapon: true, lean: -2 }
        : phase === 1
          ? { ...base, dy: 1, armF: 'swingDown', weapon: true, face: 'shout', legs: 'wide', lean: 2 }
          : { ...base, armF: 'forward', weapon: true, legs: 'wide' };
    case 'lash':
      return phase === 0
        ? { ...base, armF: 'chamber', weapon: true, lean: -1 }
        : phase === 1
          ? { ...base, dy: 1, armF: 'punch', weapon: true, face: 'shout', legs: 'wide', lean: 2 }
          : { ...base, armF: 'forward', legs: 'wide' };
    case 'kick':
      return phase === 0
        ? { ...base, lean: -2, armB: 'up' }
        : phase === 1
          ? { ...base, legs: 'kick', armF: 'chamber', armB: 'flail', lean: -1, face: 'shout' }
          : { ...base, legs: 'wide' };
    case 'throw':
      return phase === 0 ? { ...base, armF: 'raise', lean: -1 } : { ...base, dy: 1, armF: 'punch', legs: 'wide', lean: 2, face: 'shout' };
    case 'counter':
    case 'spread':
      return { ...base, armF: 'spread', armB: 'spread', legs: 'wide', face: 'shout' };
    case 'point':
      return phase === 0 ? { ...base, armF: 'chamber' } : { ...base, dy: 1, armF: 'punch', legs: 'wide', lean: 1 };
    case 'pointUp':
      return { ...base, armF: 'raise', face: phase === 1 ? 'shout' : 'normal' };
    case 'hurt':
      return { ...base, lean: -3, armF: 'flail', armB: 'flail', face: 'hurt' };
    case 'launch':
      return { ...base, lean: -4, armF: 'flail', armB: 'flail', legs: 'jump', face: 'hurt' };
    case 'down':
      return { ...base, lying: true };
    case 'stun':
      return { ...base, lean: Math.floor(t / 8) % 2 ? -1 : 1, face: 'dizzy', armF: iF, armB: iB };
    case 'grab':
      return { ...base, dy: 1, armF: 'punch', armB: 'punch', legs: 'wide', face: 'shout' };
    case 'grabbed':
      return { ...base, lean: -2, legs: 'dangle', armF: 'flail', armB: 'flail', face: 'hurt' };
    case 'paper':
      return { ...base, armF: 'raise', face: 'normal', paper: true };
    case 'win': {
      const wp = look.winPose ?? 'cheer';
      if (wp === 'tsundere') return { ...base, dy: bob, lean: -1, armF: 'behind', armB: 'behind', face: 'closed' };
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

/** 見た目ごとの決定的な乱数シード（瞬き・揺れのタイミングをキャラごとにずらす） */
function seedOf(look: Look): number {
  const s = `${look.hair}${look.hairColor}${look.eyeColor}${look.outfit}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
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
  const eye = look.eyeColor;
  const eyeStyle = look.eyeStyle ?? 'round';
  // 髪・ネクタイの揺れ（-1〜1）。瞬きは約3.3秒に1回、6フレームだけ閉じる。
  const sway = Math.round(Math.sin((o.t + seed) / 9));
  const walking = P.legs === 'walk';
  const tieSway = walking ? Math.round(Math.sin(o.t / 4 + seed) * 1.2) : sway;
  const blink = P.face === 'normal' && (o.t + seed) % 200 < 5;
  let hand = { x: 4, y: -18 + dy };

  if (P.lying) {
    // ── ダウン（横たわり）: 服装ごとの胴＋頭。眼鏡は細い線だけ残す。
    const torsoC = isGym ? '#f5f4fa' : isWork ? '#e0691a' : isSuit ? '#5c554b' : outfit === 'vest' ? '#242b4c' : body;
    R(-12, -8, 14, 7, torsoC);
    if (isWork) {
      R(-12, -6, 14, 2, '#c9d2dc');
      R(-7, -8, 2, 7, '#2c3448');
    }
    if (isF && !isGym) R(-1, -9, 8, 8, '#2a3357');
    if (isGym) {
      R(4, -9, 1, 7, '#e9e9f1');
      R(-3, -9, 7, 4, '#29334e'); // 紺の短パン（腰）
      R(4, -9, 3, 4, '#29334e');
    }
    const c = isF && !isWork ? skin : pants;
    R(2, -7, 11, 5, c);
    if (isF && !isGym) R(9, -7, 4, 5, sockC);
    if (isWork) R(4, -7, 3, 5, '#c9d2dc');
    R(13, -7, 3, 5, shoe);
    R(-8, -14, 3, 6, sleeve);
    R(-8, -16, 3, 2, handC);
    // 頭（横向き）
    R(-21, -10, 10, 10, skin);
    R(-22, -12, 12, 4, hc);
    R(-22, -9, 3, 8, hc);
    if (look.hair === 'long') R(-24, -8, 3, 10, hc);
    if (look.hair === 'fluffy') R(-23, -12, 2, 3, hc);
    R(-15, -7, 2, 1, eye); // 閉じた目
    R(-14, -3, 2, 1, '#8a4a4a');
    if (look.blush) R(-17, -5, 2, 1, '#e89b9f');
    if (look.glasses) {
      const g = look.glassesColor ?? '#2a2a30';
      R(-17, -8, 5, 1, g);
      R(-17, -6, 5, 1, g);
    }
    if (look.accessory === 'headphones') {
      R(-9, -9, 3, 5, '#1c1c22');
      R(5, -9, 2, 4, '#1c1c22');
    }
    if (isGym) {
      R(-22, -11, 12, 2, '#f7f7fc');
      R(-24, -10, 3, 3, '#e9e9f1');
      R(-28, -8, 5, 2, '#f7f7fc');
      R(-9, -11, 2, 5, skin);
    }
    if (isWork) {
      // ヘルメットは脱げて頭の横に転がる
      R(-30, -6, 9, 5, '#facc15');
      R(-30, -6, 9, 1, '#fde047');
      R(-28, -4, 5, 1, '#2f9e44');
    }
    ctx.globalAlpha = prevAlpha;
    return;
  }

  const leg = (lx: number, ly: number, w: number, h: number) => {
    if (isWork) {
      // カーゴパンツ＋再帰反射テープ＋安全靴
      R(lx, ly, w, h, pants);
      R(lx + (lx < 0 ? 0 : w - 2), ly + 3, 2, 3, '#2a2d33'); // カーゴポケット
      R(lx, ly + h - 8, w, 2, '#c9d2dc'); // 反射テープ
      R(lx, ly + h - 4, w + 1, 4, shoe); // 安全靴（高め）
      R(lx, ly + h - 1, w + 1, 1, '#2e2118');
      R(lx + 1, ly + h - 4, 1, 2, '#7a6248'); // 紐
      return;
    }
    if (isF) {
      R(lx, ly, w, h, skin);
      if (isGym) {
        R(lx, ly + h - 5, w, 3, sockC); // 白クルーソックス
      } else {
        R(lx, ly + h - 9, w, 7, sockC); // 黒ニーハイ
        R(lx, ly + h - 9, w, 1, '#3a3a48');
      }
    } else {
      R(lx, ly, w, h, pants);
      R(lx, ly + h - 4, w, 2, '#1c1c28'); // 短い靴下
    }
    R(lx, ly + h - 2, w + 1, 2, shoe);
    if (isGym) {
      R(lx - 1, ly + h - 3, w + 2, 2, shoe);
      R(lx, ly + h - 3, 2, 1, '#c4c6d3');
      R(lx - 1, ly + h - 1, w + 2, 1, '#29334e');
    } else if (isF || isSuit) {
      R(lx, ly + h - 2, w, 1, '#6b4a2e'); // ローファーの甲
    }
  };

  const legs = () => {
    const c = isF ? skin : pants;
    switch (P.legs) {
      case 'stand':
        leg(-5, -14, 4, 14);
        leg(1, -14, 4, 14);
        break;
      case 'walk': {
        const s = [2, 0, -2, 0][P.legFrame];
        const bl = s > 0 ? 1 : 0;
        const fl = s < 0 ? 1 : 0;
        leg(-5 - s, -14 + bl, 4, 14 - bl);
        leg(1 + s, -14 + fl, 4, 14 - fl);
        break;
      }
      case 'jump':
        R(-5, -14, 4, 7, c);
        R(-8, -9, 4, 4, c);
        if (isF && !isGym) R(-8, -8, 4, 2, sockC);
        if (isWork) R(-8, -9, 2, 4, '#c9d2dc');
        R(-8, -6, 5, 2, shoe);
        R(1, -14, 4, 8, c);
        R(3, -8, 4, 4, c);
        if (isF && !isGym) R(3, -7, 4, 2, sockC);
        if (isWork) R(5, -8, 2, 4, '#c9d2dc');
        R(3, -5, 5, 2, shoe);
        break;
      case 'dive':
        // 片脚を下へ伸ばし、もう片脚を畳む。空中強専用の急降下シルエット。
        leg(5, -15, 4, 15);
        R(-6, -14, 4, 6, c);
        R(-10, -11, 4, 3, c);
        R(-11, -11, 4, 3, sockC);
        R(-13, -11, 3, 4, shoe);
        break;
      case 'dangle':
        R(-5, -12, 4, 8, c);
        R(-5, -5, 5, 2, shoe);
        R(1, -12, 4, 9, c);
        R(1, -4, 5, 2, shoe);
        break;
      case 'crouch':
        leg(-7, -8, 5, 8);
        leg(2, -8, 5, 8);
        break;
      case 'kick':
        leg(-5, -14, 4, 14);
        R(1, -17, 13, 4, c);
        if (isF && !isGym) R(10, -17, 4, 4, sockC);
        R(14, -18, 3, 5, shoe);
        break;
      case 'wide':
        leg(-8, -14, 4, 14);
        leg(4, -14, 4, 14);
        break;
    }
  };

  const arm = (side: 'F' | 'B', p: ArmPose) => {
    const bx = side === 'F' ? 4 : -7;
    const c = sleeve;
    const H = (lx: number, ly: number, w = 3, h = 3) => {
      R(lx, ly, w, h, handC);
      if (side === 'F') hand = { x: lx, y: ly };
    };
    // 白シャツのカフス（ブレザー・ベスト・スーツの長袖）
    const cuffed = !isGym && !isWork;
    const CU = (lx: number, ly: number, w = 3) => {
      if (cuffed) R(lx + ln, ly + dy, w, 1, '#f4f4f8');
    };
    if (isGym) {
      // 半袖は肩だけ。肘〜手首は肌色で描く。
      const S = (lx: number, ly: number, w = 4, h = 5) => R(lx + ln, ly + dy, w, h, sleeve);
      const A = (lx: number, ly: number, w: number, h: number) => R(lx + ln, ly + dy, w, h, skin);
      const front = side === 'F';
      const b = front ? 5 : -8;
      switch (p) {
        case 'none': return;
        case 'pocket':
        case 'fist':
        case 'behind':
        case 'down':
          S(b, -30);
          A(b + (front ? 0 : 1), -25, 3, 7);
          H(b + ln, -18 + dy, 2, 3);
          return;
        case 'walkF':
          S(b, -30);
          A(b + 1, -25, 3, 4);
          H(b + 1 + ln, -22 + dy, 2, 3);
          return;
        case 'walkB':
          S(b, -30);
          A(b - 1, -25, 3, 4);
          H(b - 1 + ln, -22 + dy, 2, 3);
          return;
        case 'crossed':
        case 'hold':
          S(b, -30);
          A(front ? 1 : -7, -25, 8, 3);
          H((front ? -2 : 1) + ln, -25 + dy);
          return;
        case 'clap':
        case 'clapOpen':
          S(b, -30);
          if (front) {
            A(8, -27, 5, 3);
            A(p === 'clap' ? 11 : 13, -32, 3, 6);
            H((p === 'clap' ? 10 : 13) + ln, -33 + dy, 3, 4);
          } else {
            A(-6, -25, 12, 3);
            A(5, -28, p === 'clap' ? 5 : 2, 3);
            H((p === 'clap' ? 9 : 5) + ln, -31 + dy, 3, 4);
          }
          return;
        case 'cup':
          S(b, -30);
          if (front) {
            A(8, -32, 3, 8);
            H(5 + ln, -36 + dy, 3, 4);
          } else {
            A(-6, -26, 7, 3);
            A(-2, -32, 3, 8);
            H(-1 + ln, -36 + dy, 2, 4);
          }
          return;
        case 'hip':
          S(b, -30);
          A(b, -25, 3, 5);
          H(b + ln + (front ? -2 : 2), -22 + dy);
          return;
        case 'punch':
        case 'forward':
          S(5, front ? -29 : -26, 5, 4);
          A(10, front ? -28 : -25, p === 'punch' ? 5 : 3, 3);
          H((p === 'punch' ? 15 : 13) + ln, (front ? -29 : -26) + dy, 3, 4);
          return;
        case 'chamber':
          S(3, -30);
          A(-3, -27, 7, 3);
          H(-5 + ln, -28 + dy, 3, 4);
          return;
        case 'up':
        case 'peace':
        case 'raise':
        case 'block':
          S(b, -33, 4, 5);
          A(b, p === 'raise' ? -44 : -41, 3, p === 'raise' ? 11 : 8);
          H(b + ln, (p === 'raise' ? -47 : -44) + dy);
          return;
        case 'spread':
          S(b, -32, 4, 5);
          A(front ? 9 : -12, -35, 4, 5);
          H((front ? 13 : -15) + ln, -38 + dy);
          return;
        case 'flail':
          S(b, -30);
          A(front ? 8 : -11, -34, 3, 8);
          H((front ? 8 : -11) + ln, -37 + dy);
          return;
        case 'swingDown':
          S(b, -30);
          A(front ? 1 : -7, -25, 8, 3);
          H((front ? -2 : 1) + ln, -25 + dy);
          return;
      }
    }
    // 土木作業は腕まくり：肩だけ作業着で、前腕は肌＋軍手。
    const rolled = (lx: number, ly: number, w: number, h: number) => R(lx + ln, ly + dy, w, h, skin);
    switch (p) {
      case 'none':
        break;
      case 'down':
        if (isWork) {
          R(bx + ln, -29 + dy, 3, 5, c);
          R(bx + ln, -24 + dy, 3, 1, '#3d4a68');
          rolled(bx, -23, 3, 5);
        } else {
          R(bx + ln, -29 + dy, 3, 11, c);
          R(bx + (side === 'F' ? 2 : 0) + ln, -29 + dy, 1, 11, sleeveD);
          CU(bx, -19);
        }
        H(bx + ln, -18 + dy);
        break;
      case 'pocket':
        // ポケットに手を突っ込む。手は見えない。
        R(bx + ln, -29 + dy, 3, 9, c);
        R(bx + (side === 'F' ? 2 : 0) + ln, -29 + dy, 1, 9, sleeveD);
        CU(bx, -21);
        if (side === 'F') hand = { x: bx + ln, y: -20 + dy };
        break;
      case 'fist':
        // 少し握りしめた拳。小刻みに上下する。
        R(bx + ln, -29 + dy, 3, 10, c);
        R(bx + (side === 'F' ? 2 : 0) + ln, -29 + dy, 1, 10, sleeveD);
        CU(bx, -20);
        H(bx + ln, -19 + dy, 3, 4);
        break;
      case 'walkF':
        if (isWork) {
          R(bx + ln, -29 + dy, 3, 4, c);
          rolled(bx + 1, -25, 3, 4);
        } else {
          R(bx + ln, -29 + dy, 3, 5, c);
          R(bx + 1 + ln, -25 + dy, 3, 4, c);
          CU(bx + 1, -22);
        }
        H(bx + 1 + ln, -22 + dy);
        break;
      case 'walkB':
        if (isWork) {
          R(bx + ln, -29 + dy, 3, 4, c);
          rolled(bx - 1, -25, 3, 4);
        } else {
          R(bx + ln, -29 + dy, 3, 5, c);
          R(bx - 1 + ln, -25 + dy, 3, 4, c);
          CU(bx - 1, -22);
        }
        H(bx - 1 + ln, -22 + dy);
        break;
      case 'crossed':
        // 腕組み（大人の勝ちポーズ）
        if (side === 'B') {
          R(-5 + ln, -24 + dy, 10, 3, c);
          R(-5 + ln, -24 + dy, 10, 1, sleeveD);
          CU(3, -24, 2);
          R(5 + ln, -24 + dy, 3, 3, handC);
        } else {
          R(2 + ln, -29 + dy, 4, 3, c);
          R(-4 + ln, -28 + dy, 10, 3, c);
          CU(-6, -28, 2);
          H(-8 + ln, -28 + dy);
        }
        break;
      case 'hip':
        R(bx + ln, -29 + dy, 3, 8, c);
        H(bx + ln + (side === 'F' ? -2 : 2), -22 + dy);
        break;
      case 'punch':
        if (side === 'F') {
          R(5 + ln, -27 + dy, 9, 3, c);
          R(5 + ln, -25 + dy, 9, 1, sleeveD);
          CU(11, -27, 3);
          H(14 + ln, -28 + dy, 3, 4);
        } else {
          R(4 + ln, -24 + dy, 9, 3, c);
          H(13 + ln, -25 + dy, 3, 4);
        }
        break;
      case 'forward':
        R(5 + ln, -27 + dy, 6, 3, c);
        CU(8, -27, 3);
        H(11 + ln, -28 + dy, 3, 4);
        break;
      case 'chamber':
        R(-3 + ln, -27 + dy, 6, 3, c);
        H(-6 + ln, -28 + dy, 3, 4);
        break;
      case 'up':
        R(bx + ln, -41 + dy, 3, 12, c);
        R(bx + (side === 'F' ? 2 : 0) + ln, -41 + dy, 1, 12, sleeveD);
        H(bx + ln, -44 + dy);
        break;
      case 'peace':
        // ピースサイン（数理零の勝ちポーズ）
        R(bx + ln, -41 + dy, 3, 12, c);
        R(bx + ln, -44 + dy, 3, 2, handC);
        R(bx + ln, -47 + dy, 1, 3, handC);
        R(bx + 2 + ln, -47 + dy, 1, 3, handC);
        if (side === 'F') hand = { x: bx + ln, y: -44 + dy };
        break;
      case 'block':
        R(4 + ln, -29 + dy, 4, 3, c);
        R(7 + ln, -41 + dy, 3, 12, c);
        H(7 + ln, -44 + dy);
        break;
      case 'raise':
        R(4 + ln, -31 + dy, 3, 4, c);
        R(6 + ln, -46 + dy, 3, 15, c);
        H(6 + ln, -49 + dy);
        break;
      case 'swingDown':
        R(5 + ln, -27 + dy, 7, 3, c);
        R(12 + ln, -27 + dy, 3, 7, c);
        H(12 + ln, -20 + dy);
        break;
      case 'spread':
        if (side === 'F') {
          R(5 + ln, -30 + dy, 3, 3, c);
          R(8 + ln, -33 + dy, 3, 3, c);
          R(11 + ln, -36 + dy, 3, 3, c);
          H(14 + ln, -39 + dy);
        } else {
          R(-8 + ln, -30 + dy, 3, 3, c);
          R(-11 + ln, -33 + dy, 3, 3, c);
          R(-14 + ln, -36 + dy, 3, 3, c);
          H(-17 + ln, -39 + dy);
        }
        break;
      case 'flail':
        if (side === 'F') {
          R(6 + ln, -34 + dy, 3, 7, c);
          H(6 + ln, -37 + dy);
        } else {
          R(-9 + ln, -34 + dy, 3, 7, c);
          H(-9 + ln, -37 + dy);
        }
        break;
      case 'hold':
        if (side === 'F') {
          R(1 + ln, -24 + dy, 8, 3, c);
          H(-3 + ln, -24 + dy, 4, 3);
        } else {
          R(-7 + ln, -29 + dy, 3, 6, c);
          H(-6 + ln, -24 + dy, 4, 3);
        }
        break;
      case 'clap':
      case 'clapOpen':
      case 'cup':
      case 'behind':
        R(bx + ln, -29 + dy, 3, 9, c);
        if (side === 'F') hand = { x: bx + ln, y: -20 + dy };
        break;
    }
  };

  const skirt = () => {
    // 暗めチェックのプリーツスカート。歩くと裾が少し広がる。
    const flare = walking && P.legFrame % 2 === 1 ? 1 : 0;
    R(-8 - flare, -16 + dy, 16 + flare * 2, 8, '#2a3357');
    for (const px of [-5, -2, 1, 4]) R(px, -16 + dy, 1, 8, '#3a4266');
    R(-8 - flare, -13 + dy, 16 + flare * 2, 1, '#3a4266');
    R(-8 - flare, -16 + dy, 16 + flare * 2, 1, '#1a1f36');
    R(-8 - flare, -9 + dy, 16 + flare * 2, 1, '#1a1f36');
  };

  const glyph = (pattern: string[], lx: number, ly: number, color: string) => {
    pattern.forEach((row, yy) => [...row].forEach((dot, xx) => { if (dot === '1') R(lx + xx, ly + yy, 1, 1, color); }));
  };

  const shorts = () => {
    const navy = '#29334e';
    // 紺の短パン。裾は二つに分かれ、側面に白線。スカートにはしない。
    R(-7, -16 + dy, 14, 7, navy);
    R(-7, -10 + dy, 6, 2, navy);
    R(1, -10 + dy, 6, 2, navy);
    R(-7, -15 + dy, 1, 6, '#f5f4fa');
    R(6, -15 + dy, 1, 6, '#f5f4fa');
    R(0, -13 + dy, 1, 5, '#1c243a');
    R(-6, -9 + dy, 5, 1, '#36405a');
    // 右裾の「PE」
    glyph(['11011', '11010', '10011'], 1, -12 + dy, '#ffffff');
  };

  const torso = () => {
    if (isGym) {
      const navy = '#29334e';
      R(-7 + ln, -31 + dy, 14, 17, '#f5f4fa');
      R(-7 + ln, -27 + dy, 1, 12, '#d4d1df');
      R(6 + ln, -27 + dy, 1, 12, '#dedbe5');
      R(-6 + ln, -15 + dy, 12, 1, '#ffffff');
      // 紺の丸襟と、左肩から胸へ薄くなるハーフトーン。
      R(-3 + ln, -31 + dy, 7, 2, navy);
      R(-2 + ln, -31 + dy, 5, 1, skin);
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 6 - Math.floor(row / 2); col++) {
          if (row < 2 || (row + col) % 2 === 0) R(-6 + col + ln, -30 + row + dy, 1, 1, row < 3 ? navy : '#9da3b8');
        }
      }
      // 胸の小さな縦書き「桐葉」
      glyph(['111', '101', '111'], 3 + ln, -27 + dy, navy);
      glyph(['111', '010', '111'], 3 + ln, -23 + dy, navy);
      R(-3 + ln, -20 + dy, 1, 4, '#e2dfe9');
      return;
    }
    if (isWork) {
      // 作業着＋反射ベスト。Vに開けた襟元から白インナー。
      R(-6 + ln, -30 + dy, 12, 16, '#2c3448');
      R(-6 + ln, -30 + dy, 2, 16, '#222839');
      R(-2 + ln, -30 + dy, 4, 3, '#e8e8e8');
      R(-1 + ln, -30 + dy, 2, 1, skin);
      // オレンジのベスト（左右パネル）
      R(-6 + ln, -29 + dy, 4, 14, '#e0691a');
      R(2 + ln, -29 + dy, 4, 14, '#e0691a');
      R(-6 + ln, -29 + dy, 1, 14, '#f08a3c');
      R(2 + ln, -29 + dy, 1, 14, '#f08a3c');
      // 銀の反射テープ（縦＋横）
      R(-4 + ln, -29 + dy, 1, 14, '#c9d2dc');
      R(3 + ln, -29 + dy, 1, 14, '#c9d2dc');
      R(-6 + ln, -21 + dy, 4, 2, '#c9d2dc');
      R(2 + ln, -21 + dy, 4, 2, '#c9d2dc');
      // 安全第一ワッペン
      R(3 + ln, -27 + dy, 3, 2, '#e8e8e8');
      R(4 + ln, -27 + dy, 1, 2, '#2f9e44');
      // 工具ベルト
      R(-6 + ln, -16 + dy, 12, 2, '#191c22');
      R(-1 + ln, -16 + dy, 2, 2, '#8a8f96');
      R(-8 + ln, -16 + dy, 2, 4, '#23262e');
      R(6 + ln, -16 + dy, 2, 4, '#23262e');
      R(-8 + ln, -18 + dy, 1, 2, '#c0392b');
      R(7 + ln, -18 + dy, 1, 2, '#f0b429');
      return;
    }
    if (isSuit) {
      // ツイードのジャケット＋ダークベスト＋ストライプタイ
      R(-6 + ln, -30 + dy, 12, 16, '#5c554b');
      R(-6 + ln, -30 + dy, 2, 16, '#46403a');
      R(-5 + ln, -30 + dy, 1, 3, '#6e675c');
      // ラペル
      R(-4 + ln, -30 + dy, 1, 1, '#46403a');
      R(-3 + ln, -29 + dy, 1, 2, '#46403a');
      R(3 + ln, -30 + dy, 1, 1, '#46403a');
      R(2 + ln, -29 + dy, 1, 2, '#46403a');
      // 白シャツ＋ベスト
      R(-2 + ln, -30 + dy, 4, 2, '#f4f4f8');
      R(-2 + ln, -28 + dy, 4, 12, '#2e3138');
      R(0 + ln, -27 + dy, 1, 1, '#14161c');
      R(0 + ln, -24 + dy, 1, 1, '#14161c');
      // ストライプのネクタイ
      const tie = look.tieColor ?? '#2f3a5a';
      R(-1 + ln, -28 + dy, 2, 2, tie);
      R(-1 + ln, -26 + dy, 2, 7, tie);
      R(-1 + ln, -24 + dy, 1, 1, '#93b4e6');
      R(0 + ln, -22 + dy, 1, 1, '#93b4e6');
      R(2 + ln, -25 + dy, 3, 1, '#46403a'); // 胸ポケット
      R(-6 + ln, -15 + dy, 12, 1, '#46403a');
      return;
    }
    // ── 学生服 ──
    R(-6 + ln, -30 + dy, 12, 16, body);
    if (outfit === 'vest') {
      // 白シャツ＋紺Vネックベスト（三峰）。V開きからシャツとリボン。
      R(-6 + ln, -30 + dy, 12, 16, '#f2f2f6');
      R(-6 + ln, -30 + dy, 12, 16, '#242b4c');
      R(-2 + ln, -30 + dy, 4, 1, '#f2f2f6');
      R(-2 + ln, -29 + dy, 4, 3, '#f2f2f6');
      R(-1 + ln, -27 + dy, 2, 1, '#f2f2f6');
      R(-6 + ln, -30 + dy, 1, 16, '#1a2040');
      R(-6 + ln, -16 + dy, 12, 1, '#1a2040'); // リブの裾
      for (let i = 0; i < 6; i++) R(-5 + i * 2 + ln, -16 + dy, 1, 1, '#2e3760');
    } else {
      // ブレザー：ラペル・ボタン・胸ポケット
      R(-4 + ln, -30 + dy, 1, 1, blazerD);
      R(-3 + ln, -29 + dy, 1, 2, blazerD);
      R(-2 + ln, -27 + dy, 1, 2, blazerD);
      R(3 + ln, -30 + dy, 1, 1, blazerD);
      R(2 + ln, -29 + dy, 1, 2, blazerD);
      R(1 + ln, -27 + dy, 1, 2, blazerD);
      R(-1 + ln, -18 + dy, 1, 1, '#c9a86a');
      R(-1 + ln, -16 + dy, 1, 1, '#c9a86a');
      R(2 + ln, -25 + dy, 3, 1, blazerD);
      R(-6 + ln, -15 + dy, 12, 1, blazerD);
    }
    if (isF) {
      // 女子：白襟＋紺ストライプのリボン
      R(-3 + ln, -30 + dy, 6, 2, '#f4f4f8');
      if (outfit === 'blazer') {
        // 内藤はブレザーの下にダークベスト
        R(-2 + ln, -28 + dy, 4, 10, '#232842');
        R(0 + ln, -24 + dy, 1, 1, '#141828');
      }
      const rib = '#2f4f8f';
      const ribD = '#22386a';
      R(-4 + ln, -29 + dy, 3, 3, rib); // 左羽
      R(1 + ln, -29 + dy, 3, 3, rib); // 右羽
      R(-1 + ln, -29 + dy, 2, 3, ribD); // 結び目
      R(-3 + ln, -29 + dy, 1, 1, '#8fa3c8');
      R(2 + ln, -28 + dy, 1, 1, '#8fa3c8');
      R(-2 + ln, -26 + dy, 1, 3, rib); // 垂れ
      R(1 + ln, -26 + dy, 1, 3, rib);
    } else {
      // 男子：ネクタイ（えんじ／紺）。寺地だけ緩めて長く。
      const tie = look.tieColor ?? '#a8262e';
      if (look.tieLoose) {
        R(-4 + ln, -30 + dy, 8, 2, '#f4f4f8'); // 開けた襟
        R(-2 + ln, -28 + dy, 4, 2, '#f4f4f8');
        R(-1 + ln, -30 + dy, 2, 1, skin);
        R(-1 + ln, -26 + dy, 2, 2, tie); // 低い結び目
        R(-1 + ln, -24 + dy, 2, 3, tie);
        R(-1 + tieSway + ln, -21 + dy, 2, 3, tie); // 揺れる剣先
        R(-1 + tieSway + ln, -18 + dy, 1, 1, tie);
      } else {
        R(-3 + ln, -30 + dy, 6, 2, '#f4f4f8');
        R(-1 + ln, -28 + dy, 2, 3, '#f4f4f8');
        R(-1 + ln, -28 + dy, 2, 2, tie);
        R(-1 + ln, -26 + dy, 2, 4, tie);
        R(-1 + tieSway + ln, -22 + dy, 2, 3, tie);
        if (look.tieStripe) {
          R(-1 + ln, -25 + dy, 1, 1, '#93b4e6');
          R(0 + ln, -23 + dy, 1, 1, '#93b4e6');
          R(-1 + tieSway + ln, -21 + dy, 1, 1, '#93b4e6');
        }
      }
    }
  };

  const calm =
    o.pose === 'idle' ||
    o.pose === 'walk' ||
    o.pose === 'win' ||
    o.pose === 'frozen' ||
    o.pose === 'crouch' ||
    o.pose === 'block' ||
    o.pose === 'stun' ||
    (o.pose === 'penJab' && (o.phase ?? 0) === 2); // 突いたあとノートにメモ
  const accessory = () => {
    if (!calm) return;
    switch (look.accessory) {
      case 'bookFront':
        // 夏目漱石「こころ」（生成り表紙＋青い挿絵）
        R(-3 + ln, -28 + dy, 9, 7, '#e9dfcc');
        R(-3 + ln, -28 + dy, 1, 7, '#7a5a3a');
        R(-3 + ln, -28 + dy, 9, 1, '#f4efe0');
        R(0 + ln, -26 + dy, 3, 3, '#8fa3c8');
        R(1 + ln, -25 + dy, 1, 1, '#e9dfcc');
        R(-1 + ln, -26 + dy, 1, 3, '#5a6a8a');
        break;
      case 'bookSide':
        // 難しそうな紺の本（金帯つき）
        R(2 + ln, -27 + dy, 6, 9, '#1c2340');
        R(2 + ln, -27 + dy, 1, 9, '#0e1230');
        R(7 + ln, -27 + dy, 1, 9, '#e9dfcc');
        R(4 + ln, -25 + dy, 2, 1, '#c9a86a');
        R(3 + ln, -23 + dy, 4, 1, '#c9a86a');
        break;
      case 'notebook':
        R(3 + ln, -27 + dy, 5, 7, '#f4f4f8');
        R(5 + ln, -26 + dy, 1, 5, '#111111');
        R(4 + ln, -24 + dy, 3, 1, '#111111');
        break;
      case 'loveNote':
        // ピンクの研究ノート「恋愛学ノート」。紺ネクタイが見えるよう少し低め。
        R(-3 + ln, -25 + dy, 9, 7, '#f3b3c6');
        R(-3 + ln, -25 + dy, 1, 7, '#c9748f');
        R(-1 + ln, -24 + dy, 6, 1, '#fde2ea');
        R(0 + ln, -22 + dy, 4, 1, '#a34d6b');
        R(0 + ln, -20 + dy, 3, 1, '#a34d6b');
        R(4 + ln, -20 + dy, 1, 1, '#e879f9');
        break;
      case 'map':
        // 地形図を両腕で抱える（スーツの塀）。丸めた端＋等高線。
        R(-5 + ln, -28 + dy, 11, 10, '#e6dcc0');
        R(-5 + ln, -28 + dy, 2, 10, '#c9bd98');
        R(-5 + ln, -28 + dy, 2, 1, '#f4efe0');
        R(1 + ln, -26 + dy, 3, 1, '#7a9a6a');
        R(0 + ln, -24 + dy, 5, 1, '#7a9a6a');
        R(1 + ln, -22 + dy, 4, 1, '#7a9a6a');
        R(2 + ln, -26 + dy, 1, 3, '#5a7a4a');
        R(3 + ln, -21 + dy, 2, 1, '#8a6a4a');
        break;
    }
  };

  const head = () => {
    const hx = ln;
    const hy = dy;
    R(-2 + hx, -31 + hy, 4, 2, skinD);
    R(-6 + hx, -42 + hy, 12, 12, skin);
    R(-6 + hx, -37 + hy, 1, 3, skinD);
    R(5 + hx, -33 + hy, 1, 2, skinD); // 顎の影

    // ── 目（後ろ目スロットx0-1・前目スロットx3-4／基準y-38） ──
    const eyes = () => {
      if (blink) {
        R(0 + hx, -37 + hy, 2, 1, eye);
        R(3 + hx, -37 + hy, 2, 1, eye);
        return;
      }
      switch (eyeStyle) {
        case 'sharp':
          R(0 + hx, -38 + hy, 2, 2, eye);
          R(3 + hx, -38 + hy, 2, 2, eye);
          R(1 + hx, -38 + hy, 1, 1, '#ffffff');
          R(4 + hx, -38 + hy, 1, 1, '#ffffff');
          // 眼鏡なしのときだけ切れ長の上まぶたを足す（眼鏡時は枠が輪郭になる）
          if (!look.glasses) {
            R(-1 + hx, -39 + hy, 4, 1, hd);
            R(2 + hx, -39 + hy, 4, 1, hd);
          }
          break;
        case 'bright':
          R(0 + hx, -39 + hy, 2, 3, eye);
          R(3 + hx, -39 + hy, 2, 3, eye);
          R(0 + hx, -39 + hy, 1, 1, '#ffffff');
          R(3 + hx, -39 + hy, 1, 1, '#ffffff');
          R(1 + hx, -37 + hy, 1, 1, '#ffffff');
          R(4 + hx, -37 + hy, 1, 1, '#ffffff');
          break;
        case 'calm':
          R(1 + hx, -38 + hy, 1, 2, eye);
          R(3 + hx, -38 + hy, 1, 2, eye);
          break;
        case 'sleepy':
          R(0 + hx, -38 + hy, 2, 1, hd); // 半分閉じたまぶた
          R(3 + hx, -38 + hy, 2, 1, hd);
          R(0 + hx, -37 + hy, 2, 1, eye);
          R(3 + hx, -37 + hy, 2, 1, eye);
          break;
        case 'tsun':
          // ツンとした流し目：目尻が上がる
          R(0 + hx, -38 + hy, 2, 1, hd);
          R(3 + hx, -38 + hy, 2, 1, hd);
          R(-1 + hx, -39 + hy, 1, 1, hd);
          R(5 + hx, -39 + hy, 1, 1, hd);
          R(0 + hx, -37 + hy, 2, 1, eye);
          R(3 + hx, -37 + hy, 2, 1, eye);
          break;
        default:
          R(0 + hx, -38 + hy, 2, 2, eye);
          R(3 + hx, -38 + hy, 2, 2, eye);
          R(0 + hx, -38 + hy, 1, 1, '#ffffff');
          R(3 + hx, -38 + hy, 1, 1, '#ffffff');
          break;
      }
    };
    // ── 眉（y-40。怒りは内側が下がり、困りは内側が上がる） ──
    const brows = () => {
      const bc = look.brows === 'flat' ? '#3a3430' : hd;
      switch (look.brows) {
        case 'angry':
          R(-1 + hx, -40 + hy, 3, 1, bc);
          R(1 + hx, -39 + hy, 1, 1, bc);
          R(2 + hx, -40 + hy, 3, 1, bc);
          R(2 + hx, -39 + hy, 1, 1, bc);
          break;
        case 'worried':
          R(-1 + hx, -40 + hy, 3, 1, bc);
          R(-1 + hx, -39 + hy, 1, 1, bc);
          R(2 + hx, -40 + hy, 3, 1, bc);
          R(4 + hx, -39 + hy, 1, 1, bc);
          break;
        case 'soft':
          R(0 + hx, -40 + hy, 2, 1, bc);
          R(3 + hx, -40 + hy, 2, 1, bc);
          break;
        case 'thick':
          R(-1 + hx, -40 + hy, 4, 1, bc);
          R(2 + hx, -40 + hy, 4, 1, bc);
          break;
        case 'flat':
          R(-1 + hx, -40 + hy, 3, 1, bc);
          R(3 + hx, -40 + hy, 3, 1, bc);
          break;
      }
    };
    // ── 口（通常時だけキャラ別。それ以外は表情が優先） ──
    const mouthIdle = () => {
      const mc = '#8a4a4a';
      switch (look.mouthIdle ?? 'flat') {
        case 'smile':
          R(1 + hx, -34 + hy, 1, 1, mc);
          R(2 + hx, -33 + hy, 2, 1, mc);
          R(4 + hx, -34 + hy, 1, 1, mc);
          break;
        case 'grin':
          // 両馬の歯見せ笑い
          R(1 + hx, -34 + hy, 4, 2, '#5a2323');
          R(1 + hx, -34 + hy, 4, 1, '#f4f4f8');
          break;
        case 'frown':
          R(2 + hx, -34 + hy, 2, 1, mc);
          R(1 + hx, -33 + hy, 1, 1, mc);
          R(4 + hx, -33 + hy, 1, 1, mc);
          break;
        case 'open':
          R(2 + hx, -34 + hy, 2, 2, '#5a2323');
          R(2 + hx, -33 + hy, 2, 1, '#e06a6a');
          break;
        case 'gritted':
          // 覚醒三重の食いしばり
          R(1 + hx, -34 + hy, 4, 2, '#f4f4f8');
          R(1 + hx, -33 + hy, 4, 1, '#5a2323');
          break;
        default:
          R(2 + hx, -33 + hy, 2, 1, mc);
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
        R(1 + hx, -34 + hy, 4, 2, '#5a2323');
        R(2 + hx, -34 + hy, 2, 1, '#e06a6a');
        break;
      case 'smile':
        R(0 + hx, -38 + hy, 2, 1, eye);
        R(3 + hx, -38 + hy, 2, 1, eye);
        R(1 + hx, -34 + hy, 1, 1, '#8a4a4a');
        R(2 + hx, -33 + hy, 2, 1, '#8a4a4a');
        R(4 + hx, -34 + hy, 1, 1, '#8a4a4a');
        break;
      case 'closed':
        R(0 + hx, -37 + hy, 2, 1, eye);
        R(3 + hx, -37 + hy, 2, 1, eye);
        if (look.mouthIdle === 'gritted') {
          R(1 + hx, -34 + hy, 4, 2, '#f4f4f8');
          R(1 + hx, -33 + hy, 4, 1, '#5a2323');
        } else mouthIdle();
        break;
      case 'hurt':
        for (const ex of [0, 3]) {
          R(ex + hx, -39 + hy, 1, 1, eye);
          R(ex + 1 + hx, -38 + hy, 1, 1, eye);
          R(ex + hx, -37 + hy, 1, 1, eye);
        }
        R(2 + hx, -34 + hy, 2, 2, '#5a2323');
        break;
      case 'dizzy':
        for (const ex of [0, 3]) {
          R(ex + hx, -39 + hy, 2, 3, eye);
          R(ex + 1 + hx, -38 + hy, 1, 1, '#ffffff');
        }
        R(1 + hx, -33 + hy, 1, 1, '#8a4a4a');
        R(2 + hx, -34 + hy, 1, 1, '#8a4a4a');
        R(3 + hx, -33 + hy, 1, 1, '#8a4a4a');
        R(4 + hx, -34 + hy, 1, 1, '#8a4a4a');
        break;
    }
    if (look.blush) {
      R(-2 + hx, -35 + hy, 2, 1, '#e89b9f');
      R(5 + hx, -35 + hy, 1, 1, '#e89b9f');
    }
    if (look.stubble) {
      // 顎の無精ひげ＋もみあげ
      for (let i = 0; i < 5; i++) R(-4 + i * 2 + hx, -32 + hy, 1, 1, skinD);
      R(-3 + hx, -33 + hy, 1, 1, skinD);
      R(3 + hx, -33 + hy, 1, 1, skinD);
      R(-6 + hx, -38 + hy, 1, 3, hd);
    }
    if (look.sweat && P.face !== 'smile' && P.face !== 'shout') {
      // こめかみの汗（緊張）。垂れて落ちる。
      const drip = Math.floor(o.t / 20) % 3;
      R(6 + hx, -39 + hy + drip, 1, 2, '#a8dcff');
      R(6 + hx, -39 + hy + drip, 1, 1, '#e6f6ff');
    }
    if (look.glasses) {
      // 細い上枠＋ツル＋ブリッジだけ。下枠は描かない（リムレス風）ので
      // レンズは透明に見え、目は白目ハイライトまで見える（サングラス化しない）。
      const g = look.glassesColor ?? '#2a2a30';
      const frame = (ex: number, ey: number, w: number, h: number) => {
        R(ex - 1 + hx, ey - 1 + hy, w + 2, 1, g);
        R(ex - 1 + hx, ey + hy, 1, h, g);
        R(ex + w + hx, ey + hy, 1, h, g);
        R(ex - 1 + hx, ey + h + hy, 1, 1, g);
        R(ex + w + hx, ey + h + hy, 1, 1, g);
      };
      if (eyeStyle === 'calm') {
        frame(1, -38, 1, 2);
        frame(3, -38, 1, 2);
        R(-6 + hx, -38 + hy, 6, 1, g); // テンプル
        R(2 + hx, -37 + hy, 1, 1, g); // ブリッジ
      } else {
        frame(0, -38, 2, 2);
        frame(3, -38, 2, 2);
        R(-6 + hx, -38 + hy, 5, 1, g);
      }
    }
    // ── 髪 ──
    R(-7 + hx, -45 + hy, 14, 5, hc); // 頭頂
    R(4 + hx, -45 + hy, 3, 5, hd); // 右の影
    switch (look.hair) {
      case 'short':
        // きっちりした短髪（三重・覚醒・倉石）。揃った前髪。
        R(-7 + hx, -40 + hy, 2, 5, hc);
        R(5 + hx, -40 + hy, 1, 2, hc);
        R(-6 + hx, -36 + hy, 1, 2, hd); // もみあげ
        R(-4 + hx, -40 + hy, 7, 1, hc);
        R(-3 + hx, -39 + hy, 1, 1, hc);
        R(0 + hx, -39 + hy, 1, 1, hc);
        R(3 + hx, -39 + hy, 1, 1, hc);
        R(-7 + hx, -35 + hy, 2, 2, hd); // 襟足
        break;
      case 'spiky':
        // 逆立てた赤茶ツンツン（両馬）。前に流れる。
        R(-6 + hx, -47 + hy, 3, 2, hc);
        R(-2 + hx, -48 + hy, 3, 3, hc);
        R(2 + hx, -47 + hy, 3, 2, hc);
        R(5 + hx, -46 + hy, 2, 2, hc);
        R(-8 + hx, -44 + hy, 2, 2, hc);
        R(5 + hx, -43 + hy, 3, 2, hc);
        R(-4 + hx, -46 + hy, 1, 1, hd);
        R(1 + hx, -46 + hy, 1, 1, hd);
        R(-7 + hx, -40 + hy, 2, 4, hc);
        R(5 + hx, -41 + hy, 2, 3, hc);
        R(-1 + hx, -40 + hy, 4, 1, hc); // 短い前髪
        R(2 + hx, -39 + hy, 1, 1, hc);
        break;
      case 'long':
        // 姫カット＋腰までのストレート（内藤）。毛先が揺れる。
        R(-4 + hx, -40 + hy, 7, 1, hc);
        R(-3 + hx, -39 + hy, 1, 1, hc);
        R(0 + hx, -39 + hy, 1, 1, hc);
        R(3 + hx, -39 + hy, 1, 1, hc);
        R(-8 + hx, -40 + hy, 2, 8, hc); // サイド
        R(5 + hx, -40 + hy, 2, 6, hc);
        R(5 + hx, -36 + hy, 2, 9, hc); // 肩にかかる前髪
        R(-9 + hx, -40 + hy, 3, 20, hc); // 背中の髪
        R(-10 + hx, -34 + hy, 1, 12, hc);
        R(-9 + hx, -40 + hy, 1, 20, hd); // 影
        R(-9 + sway + hx, -20 + hy, 3, 5, hc); // 揺れる毛先
        R(-8 + sway + hx, -16 + hy, 1, 1, hc);
        break;
      case 'bob':
        // 顎までの丸いボブ（三峰）。丸いシルエット。
        R(-8 + hx, -43 + hy, 2, 3, hc);
        R(6 + hx, -43 + hy, 2, 2, hc);
        R(-3 + hx, -40 + hy, 6, 1, hc);
        R(-2 + hx, -39 + hy, 1, 1, hc);
        R(1 + hx, -39 + hy, 1, 1, hc);
        R(-8 + hx, -40 + hy, 2, 9, hc);
        R(6 + hx, -40 + hy, 2, 8, hc);
        R(-7 + hx, -32 + hy, 2, 2, hc); // 丸い裾
        R(5 + hx, -32 + hy, 2, 2, hc);
        R(-8 + hx, -40 + hy, 1, 9, hd);
        break;
      case 'straight':
        // 額を覆うストレート＋少し長いサイド（寺地）。眉は隠れる。
        R(-8 + hx, -44 + hy, 2, 2, hc);
        R(6 + hx, -44 + hy, 2, 1, hc);
        R(-5 + hx, -40 + hy, 10, 2, hc); // 厚い前髪
        R(-4 + hx, -38 + hy, 1, 1, hc);
        R(-1 + hx, -38 + hy, 1, 1, hc);
        R(2 + hx, -38 + hy, 1, 1, hc);
        R(-7 + hx, -40 + hy, 2, 7, hc);
        R(5 + hx, -40 + hy, 2, 6, hc);
        R(-7 + hx, -34 + hy, 2, 3, hd);
        R(-3 + hx, -45 + hy, 1, 1, hd);
        R(2 + hx, -44 + hy, 1, 1, hd);
        break;
      case 'messy':
        R(-8 + hx, -44 + hy, 2, 2, hc);
        R(-4 + hx, -47 + hy, 2, 2, hc);
        R(0 + hx, -46 + hy, 2, 1, hc);
        R(3 + hx, -47 + hy, 2, 2, hc);
        R(6 + hx, -45 + hy, 2, 1, hc);
        R(-7 + hx, -40 + hy, 2, 5, hc);
        R(-1 + hx, -40 + hy, 2, 1, hc);
        R(2 + hx, -40 + hy, 1, 2, hc);
        R(4 + hx, -40 + hy, 2, 1, hc);
        break;
      case 'messyAhoge':
        // 荒っぽい束感＋アホ毛（数理零）。額が少し見える。
        R(-8 + hx, -44 + hy, 2, 3, hc);
        R(-5 + hx, -47 + hy, 2, 2, hc);
        R(-1 + hx, -48 + hy, 2, 3, hc);
        R(3 + hx, -47 + hy, 2, 2, hc);
        R(6 + hx, -45 + hy, 2, 2, hc);
        R(-7 + hx, -40 + hy, 2, 4, hc);
        R(5 + hx, -40 + hy, 2, 3, hc);
        R(-2 + hx, -40 + hy, 2, 1, hc);
        R(2 + hx, -40 + hy, 1, 2, hc);
        R(4 + hx, -40 + hy, 2, 1, hc);
        R(-4 + hx, -45 + hy, 1, 1, hd);
        R(2 + hx, -45 + hy, 1, 1, hd);
        // 跳ねたアホ毛
        R(0 + hx, -50 + hy, 1, 2, hc);
        R(1 + hx, -51 + hy, 2, 1, hc);
        R(2 + hx, -50 + hy, 1, 1, hc);
        break;
      case 'adult':
        // 分け目のあるミディアム＋ゆるいウェーブ（塀）。耳を覆う。
        R(-8 + hx, -44 + hy, 3, 6, hc);
        R(5 + hx, -44 + hy, 3, 4, hc);
        R(-4 + hx, -40 + hy, 5, 1, hc); // 流した前髪
        R(3 + hx, -40 + hy, 1, 3, hc);
        R(-8 + hx, -40 + hy, 2, 8, hc);
        R(6 + hx, -40 + hy, 2, 7, hc);
        R(-9 + sway + hx, -34 + hy, 2, 4, hc); // 揺れる裾
        R(-7 + hx, -34 + hy, 2, 5, hd);
        R(-2 + hx, -45 + hy, 2, 1, '#8a8078'); // 灰色の筋
        R(3 + hx, -44 + hy, 1, 1, '#8a8078');
        break;
      case 'fluffy': {
        // ふわっとした量の多い茶髪（櫻）。長めの前髪と丸い輪郭。
        R(-8 + hx, -44 + hy, 3, 6, hc);
        R(6 + hx, -44 + hy, 2, 5, hc);
        R(-6 + hx, -47 + hy, 3, 2, hc);
        R(-2 + hx, -48 + hy, 3, 3, hc);
        R(2 + hx, -47 + hy, 3, 2, hc);
        R(5 + hx, -46 + hy, 2, 1, hc);
        R(-4 + hx, -40 + hy, 3, 2, hc);
        R(0 + hx, -40 + hy, 2, 2, hc);
        R(3 + hx, -40 + hy, 2, 3, hc);
        R(-8 + hx, -40 + hy, 3, 9, hc);
        R(-7 + hx, -32 + hy, 2, 2, hc);
        R(-3 + hx, -45 + hy, 1, 1, hd);
        R(1 + hx, -44 + hy, 1, 1, hd);
        R(4 + hx, -45 + hy, 1, 1, hd);
        R(-6 + hx, -42 + hy, 1, 3, hd);
        break;
      }
    }
    if (look.accessory === 'headphones') {
      // 首にかけたヘッドホン（寺地）。後ろのバンド＋両耳の下のカップ。
      R(-7 + hx, -32 + hy, 14, 2, '#2b2b32');
      R(-9 + hx, -35 + hy, 3, 6, '#1c1c22');
      R(6 + hx, -35 + hy, 3, 6, '#1c1c22');
      R(-9 + hx, -34 + hy, 1, 4, '#3a3a44');
      R(8 + hx, -34 + hy, 1, 4, '#3a3a44');
      R(-8 + hx, -33 + hy, 1, 2, '#5c5c6a');
      R(7 + hx, -33 + hy, 1, 2, '#5c5c6a');
    }
  };

  /** 白い鉢巻と後ろの結び目。動くと二本の端がなびく。 */
  const headband = () => {
    if (!isGym) return;
    const flap = o.pose === 'idle' || o.pose === 'win' ? 0 : Math.floor(o.t / 4) % 3;
    R(-7 + ln, -43 + dy, 14, 3, '#f7f7fc');
    R(-7 + ln, -41 + dy, 14, 1, '#dedbe5');
    R(-3 + ln, -45 + dy, 2, 2, '#79564b'); // 前髪のハイライト
    R(3 + ln, -45 + dy, 1, 5, hc);
    R(-4 + ln, -41 + dy, 2, 1, hc); // 鉢巻にかかる前髪
    R(1 + ln, -41 + dy, 1, 1, hc);
    // 後ろのリボン結び＋なびく端
    R(-10 + ln, -43 + dy, 4, 4, '#f7f7fc');
    R(-9 + ln, -42 + dy, 2, 2, '#dedbe5');
    R(-12 + ln - flap, -41 + dy, 4, 3, '#e9e9f1');
    R(-14 + ln - flap, -40 + dy, 3, 2, '#f7f7fc');
    R(-10 + ln, -39 + dy, 3, 5, '#f7f7fc');
    R(-11 + ln - flap, -35 + dy, 3, 4, '#e9e9f1');
    R(-12 + ln - flap, -32 + dy, 3, 2, '#f7f7fc');
  };

  /** 工事ヘルメット。緑のライン＋安全第一の十字。 */
  const helmet = () => {
    if (outfit !== 'kensetsu') return;
    const hx = ln;
    const hy = dy;
    R(-7 + hx, -46 + hy, 14, 3, '#facc15');
    R(-6 + hx, -47 + hy, 12, 1, '#fde047');
    R(-5 + hx, -48 + hy, 3, 1, '#fde047');
    R(-7 + hx, -44 + hy, 14, 1, '#2f9e44'); // 緑ライン
    R(-7 + hx, -43 + hy, 14, 2, '#e0a800');
    R(-7 + hx, -43 + hy, 14, 1, '#f6d030');
    R(5 + hx, -43 + hy, 4, 1, '#c78a00'); // 前面のツバ
    R(5 + hx, -42 + hy, 2, 1, '#e0a800');
    R(-2 + hx, -49 + hy, 4, 1, '#fdd835'); // 頭頂
    // 前面の緑十字
    R(2 + hx, -46 + hy, 1, 3, '#2f9e44');
    R(1 + hx, -45 + hy, 3, 1, '#2f9e44');
    R(-1 + hx, -41 + hy, 2, 1, look.hairColor); // 額の毛
  };

  const weapon = () => {
    // 覚醒三重は振り回す瞬間と吹き飛ばされているとき以外、常にハンマーを持つ
    const dropped = o.pose === 'hurt' || o.pose === 'launch' || o.pose === 'grabbed';
    const showIdleHammer = isWork && !P.weapon && !P.lying && !dropped;
    if (!P.weapon && !showIdleHammer) {
      // 素手の打撃にも小さな風切りを添える
      if ((o.pose === 'jab' || o.pose === 'penJab') && (o.phase ?? 0) === 1 && look.weapon === 'none') {
        R(hand.x + 3, hand.y - 1, 2, 1, '#e8ecf0');
        R(hand.x + 4, hand.y + 1, 2, 1, '#e8ecf0');
      }
      return;
    }
    const hx = hand.x;
    const hy = hand.y;
    // 振り抜きの斬撃線
    if (!showIdleHammer && (o.pose === 'swing' || o.pose === 'lash') && (o.phase ?? 0) === 1) {
      R(hx + 3, hy - 7, 1, 3, '#e8ecf0');
      R(hx + 4, hy - 4, 1, 3, '#e8ecf0');
      R(hx + 4, hy - 1, 1, 2, '#e8ecf0');
    }
    switch (look.weapon) {
      case 'bowl':
        R(hx - 3, hy - 1, 9, 5, '#f4f0e8');
        R(hx - 3, hy - 1, 9, 1, '#c0392b');
        R(hx - 2, hy - 3, 7, 2, '#e8c46a');
        R(hx, hy - 4, 2, 1, '#fff2a8');
        R(hx + 3, hy - 4, 2, 1, '#a0522d');
        R(hx - 4, hy - 5, 1, 2, '#d8d8d8'); // 割り箸
        R(hx + 6, hy - 5, 1, 2, '#d8d8d8');
        break;
      case 'book':
        R(hx - 2, hy - 7, 6, 8, '#e9dfcc');
        R(hx - 2, hy - 7, 1, 8, '#7a5a3a');
        R(hx, hy - 5, 2, 3, '#8fa3c8');
        break;
      case 'binder':
        R(hx - 1, hy - 9, 7, 10, '#f4f4f8');
        R(hx - 1, hy - 9, 7, 1, '#2c4a8a');
        R(hx + 1, hy - 6, 3, 1, '#333333');
        R(hx + 1, hy - 4, 3, 1, '#333333');
        R(hx + 1, hy - 2, 3, 1, '#c0392b');
        break;
      case 'paper':
        R(hx - 1, hy - 6, 8, 7, '#ffffff');
        R(hx, hy - 5, 6, 1, '#99a0aa');
        R(hx, hy - 3, 6, 1, '#99a0aa');
        R(hx, hy - 1, 4, 1, '#99a0aa');
        R(hx, hy - 5, 1, 1, '#c0392b');
        break;
      case 'python':
        for (let i = 0; i < 11; i++) {
          const wy = Math.round(Math.sin(i * 1.1 + o.t * 0.6) * 1.5);
          R(hx + 3 + i * 2, hy + wy, 2, 2, i % 2 ? '#3776ab' : '#ffd43b');
        }
        R(hx + 25, hy - 1, 3, 3, '#3776ab');
        R(hx + 25, hy - 1, 1, 1, '#ffd43b');
        break;
      case 'lovenote':
        // ピンクの研究ノート（振り回す）
        R(hx - 1, hy - 9, 7, 10, '#f3b3c6');
        R(hx - 1, hy - 9, 1, 10, '#c9748f');
        R(hx + 1, hy - 7, 4, 1, '#fde2ea');
        R(hx + 1, hy - 5, 3, 1, '#a34d6b');
        R(hx + 1, hy - 3, 4, 1, '#a34d6b');
        R(hx + 3, hy - 1, 1, 1, '#e879f9');
        break;
      case 'hammer': {
        if (showIdleHammer) {
          // 待機中は柄を下に、頭を地面すれすれで持つ
          R(hx, hy + 2, 3, 10, '#9c6a34');
          R(hx, hy + 2, 1, 10, '#b98a4e');
          R(hx - 4, hy + 12, 11, 5, '#565b63');
          R(hx - 4, hy + 12, 11, 1, '#a7adb8');
          R(hx - 5, hy + 11, 2, 6, '#3a3f46');
          R(hx + 5, hy + 11, 2, 6, '#3a3f46');
          break;
        }
        // 大ハンマー（解体用）── 手から真下に柄、その先に金属の頭
        R(hx - 1, hy + 1, 3, 16, '#9c6a34');
        R(hx - 1, hy + 1, 1, 16, '#b98a4e');
        R(hx + 1, hy + 3, 1, 12, '#6e4a22');
        R(hx - 1, hy + 17, 3, 2, '#4a3518');
        R(hx - 5, hy - 8, 11, 6, '#a7adb8');
        R(hx - 5, hy - 8, 11, 1, '#d5dae1');
        R(hx - 5, hy - 4, 11, 2, '#565b63');
        R(hx - 6, hy - 9, 2, 7, '#3a3f46');
        R(hx + 4, hy - 9, 2, 7, '#3a3f46');
        R(hx - 4, hy - 8, 3, 2, '#e8ecf0');
        break;
      }
      case 'map':
        // 地形図（折りたたんで持ち、広げて払う）。紙と等高線
        R(hx - 2, hy - 8, 8, 10, '#e6dcc0');
        R(hx - 2, hy - 8, 8, 1, '#c9bd98');
        R(hx - 2, hy - 8, 1, 10, '#c9bd98');
        R(hx + 2, hy - 8, 1, 10, '#c9bd98');
        R(hx - 1, hy - 5, 6, 1, '#7a9a6a');
        R(hx - 1, hy - 2, 6, 1, '#7a9a6a');
        R(hx + 1, hy - 5, 1, 2, '#5a7a4a');
        break;
    }
  };

  const pen = () => {
    if (!P.pen) return;
    const hx = hand.x;
    const hy = hand.y;
    // シャーペン（前手から前方へ）
    R(hx + 3, hy + 1, 6, 1, '#1f2937');
    R(hx + 3, hy + 1, 2, 1, '#e5e7eb');
    R(hx + 9, hy + 1, 1, 1, '#9ca3af');
  };

  const openNote = () => {
    if (!P.openNote) return;
    // 胸の前で開いた研究ノート（見開き）
    R(-7 + ln, -30 + dy, 14, 9, '#fde2ea');
    R(0 + ln, -30 + dy, 1, 9, '#c9748f');
    R(-5 + ln, -28 + dy, 4, 1, '#a34d6b');
    R(-5 + ln, -26 + dy, 3, 1, '#a34d6b');
    R(-5 + ln, -24 + dy, 4, 1, '#a34d6b');
    R(2 + ln, -28 + dy, 4, 1, '#a34d6b');
    R(2 + ln, -26 + dy, 4, 1, '#e879f9');
    R(2 + ln, -24 + dy, 2, 1, '#a34d6b');
  };

  const paper = () => {
    if (!P.paper) return;
    const hx = hand.x;
    const hy = hand.y;
    R(hx - 4, hy - 13, 13, 12, '#ffffff');
    R(hx - 3, hy - 11, 10, 1, '#333333');
    R(hx - 3, hy - 9, 8, 1, '#333333');
    R(hx - 3, hy - 7, 10, 1, '#333333');
    R(hx - 3, hy - 5, 6, 1, '#333333');
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
  const w = Math.max(6, 16 - airHeight * 0.15);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(Math.round(x - w / 2), y - 1, Math.round(w), 2);
}
