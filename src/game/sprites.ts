import type { Facing, Look, PoseId } from './types';

type ArmPose =
  | 'down'
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
  | 'none';
type LegPose = 'stand' | 'walk' | 'jump' | 'crouch' | 'kick' | 'wide' | 'dangle';
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

function resolvePose(pose: PoseId, phase: 0 | 1 | 2, t: number, look: Look): PoseParams {
  const base: PoseParams = { dy: 0, lean: 0, armF: 'down', armB: 'down', legs: 'stand', legFrame: 0, face: 'normal' };
  const bob = Math.floor(t / 24) % 2;
  const hug = look.accessory === 'bookFront' || look.accessory === 'loveNote';
  switch (pose) {
    case 'idle':
      return { ...base, dy: bob, armF: hug ? 'hold' : 'down', armB: hug ? 'hold' : 'down' };
    case 'frozen':
      return { ...base, face: 'closed', armF: hug ? 'hold' : 'down', armB: hug ? 'hold' : 'down' };
    case 'walk':
      return { ...base, legs: 'walk', legFrame: Math.floor(t / 6) % 4, armF: hug ? 'hold' : 'down', armB: hug ? 'hold' : 'down' };
    case 'jump':
      return { ...base, legs: 'jump', armF: 'up', armB: 'up' };
    case 'crouch':
      return { ...base, dy: 6, legs: 'crouch', armF: hug ? 'hold' : 'down', armB: hug ? 'hold' : 'down' };
    case 'getup':
      return { ...base, dy: 6, legs: 'crouch', face: 'hurt' };
    case 'lose':
      return { ...base, dy: 6, legs: 'crouch', face: 'hurt' };
    case 'block':
      return { ...base, armF: 'block', face: 'closed' };
    case 'jab':
      return phase === 0
        ? { ...base, armF: 'chamber', lean: -1 }
        : phase === 1
          ? { ...base, armF: 'punch', face: 'shout', legs: 'wide', lean: 1 }
          : { ...base, armF: 'forward', legs: 'wide' };
    case 'penJab':
      // シャーペンで突いてから、ノートにメモする
      return phase === 0
        ? { ...base, armF: 'chamber', armB: hug ? 'hold' : 'down', lean: -1, pen: true }
        : phase === 1
          ? { ...base, armF: 'punch', armB: hug ? 'hold' : 'down', face: 'closed', legs: 'wide', lean: 1, pen: true }
          : { ...base, armF: 'hold', armB: 'hold', legs: 'wide', face: 'normal', pen: true };
    case 'confess':
      // 深呼吸して、ノートを胸の前で開く。目は閉じている（緊張）
      return { ...base, lean: 2, armF: 'hold', armB: 'hold', legs: 'wide', face: 'closed', openNote: true };
    case 'swing':
      return phase === 0
        ? { ...base, armF: 'raise', weapon: true, lean: -1 }
        : phase === 1
          ? { ...base, armF: 'swingDown', weapon: true, face: 'shout', legs: 'wide', lean: 1 }
          : { ...base, armF: 'forward', weapon: true, legs: 'wide' };
    case 'lash':
      return phase === 0
        ? { ...base, armF: 'chamber', weapon: true }
        : phase === 1
          ? { ...base, armF: 'punch', weapon: true, face: 'shout', legs: 'wide', lean: 1 }
          : { ...base, armF: 'forward', legs: 'wide' };
    case 'kick':
      return phase === 0
        ? { ...base, lean: -2, armB: 'up' }
        : phase === 1
          ? { ...base, legs: 'kick', armF: 'chamber', armB: 'flail', lean: -1, face: 'shout' }
          : { ...base, legs: 'wide' };
    case 'throw':
      return phase === 0 ? { ...base, armF: 'raise', lean: -1 } : { ...base, armF: 'punch', legs: 'wide', lean: 1, face: 'shout' };
    case 'counter':
    case 'spread':
      return { ...base, armF: 'spread', armB: 'spread', legs: 'wide', face: 'shout' };
    case 'point':
      return phase === 0 ? { ...base, armF: 'chamber' } : { ...base, armF: 'punch', legs: 'wide' };
    case 'pointUp':
      return { ...base, armF: 'raise', face: phase === 1 ? 'shout' : 'normal' };
    case 'hurt':
      return { ...base, lean: -3, armF: 'flail', armB: 'flail', face: 'hurt' };
    case 'launch':
      return { ...base, lean: -4, armF: 'flail', armB: 'flail', legs: 'jump', face: 'hurt' };
    case 'down':
      return { ...base, lying: true };
    case 'stun':
      return { ...base, lean: Math.floor(t / 8) % 2 ? -1 : 1, face: 'dizzy' };
    case 'grab':
      return { ...base, armF: 'punch', armB: 'punch', legs: 'wide', face: 'shout' };
    case 'grabbed':
      return { ...base, lean: -2, legs: 'dangle', armF: 'flail', armB: 'flail', face: 'hurt' };
    case 'paper':
      return { ...base, armF: 'raise', face: 'normal', paper: true };
    case 'win': {
      const wp = look.winPose ?? 'cheer';
      if (wp === 'cool') return { ...base, dy: bob, face: 'closed', armF: 'hip', armB: 'hip' };
      if (wp === 'shy') return { ...base, dy: bob, face: 'smile', armF: 'block', armB: hug ? 'hold' : 'down' };
      if (wp === 'peace') return { ...base, dy: bob, face: 'smile', armF: 'up' };
      if (wp === 'hug') return { ...base, dy: bob, face: 'smile', armF: 'hold', armB: 'hold' };
      return { ...base, dy: bob, face: 'smile', armF: 'up', armB: 'up', legs: bob ? 'wide' : 'stand' };
    }
  }
  return base;
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
  const skin = look.skin ?? '#f3d4b4';
  const skinD = look.skinDark ?? '#d9a986';
  const isF = look.gender === 'f';
  const outfit = look.outfit;
  const blazer = '#26335f';
  const blazerD = '#1b2547';
  const sleeve = outfit === 'vest' ? '#eeeef4' : outfit === 'suit' ? '#6e6a5e' : outfit === 'kensetsu' ? '#232938' : blazer;
  const body = outfit === 'vest' ? '#242b4c' : outfit === 'suit' ? '#6e6a5e' : outfit === 'kensetsu' ? '#e0691a' : blazer;
  const pants = outfit === 'suit' ? '#45454a' : outfit === 'kensetsu' ? '#4a4640' : '#243059';
  const shoe = isF ? '#5b3a22' : '#141418';
  const sock = '#1c1c28';
  const dy = P.dy;
  const ln = P.lean;
  const hc = look.hairColor;
  let hand = { x: 4, y: -18 + dy };

  if (P.lying) {
    R(-12, -8, 14, 7, body);
    if (isF) R(-1, -9, 8, 8, '#2a3357');
    const c = isF ? skin : pants;
    R(2, -7, 11, 5, c);
    if (isF) R(9, -7, 4, 5, sock);
    R(13, -7, 3, 5, shoe);
    R(-8, -14, 3, 6, sleeve);
    R(-8, -16, 3, 2, skin);
    R(-21, -10, 10, 10, skin);
    R(-22, -12, 12, 4, hc);
    R(-22, -9, 3, 8, hc);
    if (look.hair === 'long') R(-24, -8, 3, 8, hc);
    R(-14, -7, 1, 1, look.eyeColor);
    R(-15, -6, 1, 1, look.eyeColor);
    R(-14, -3, 2, 1, '#8a4a4a');
    if (look.glasses) R(-17, -7, 5, 1, '#2a2a30');
    ctx.globalAlpha = prevAlpha;
    return;
  }

  const leg = (lx: number, ly: number, w: number, h: number) => {
    if (isF) {
      R(lx, ly, w, h, skin);
      R(lx, ly + h - 4, w, 4, sock);
    } else R(lx, ly, w, h, pants);
    R(lx, ly + h - 2, w + 1, 2, shoe);
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
        if (isF) R(-8, -8, 4, 2, sock);
        R(-8, -6, 5, 2, shoe);
        R(1, -14, 4, 8, c);
        R(3, -8, 4, 4, c);
        if (isF) R(3, -7, 4, 2, sock);
        R(3, -5, 5, 2, shoe);
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
        if (isF) R(10, -17, 4, 4, sock);
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
      R(lx, ly, w, h, skin);
      if (side === 'F') hand = { x: lx, y: ly };
    };
    switch (p) {
      case 'none':
        break;
      case 'down':
        R(bx + ln, -29 + dy, 3, 11, c);
        H(bx + ln, -18 + dy);
        break;
      case 'hip':
        R(bx + ln, -29 + dy, 3, 8, c);
        H(bx + ln + (side === 'F' ? -2 : 2), -22 + dy);
        break;
      case 'punch':
        if (side === 'F') {
          R(5 + ln, -27 + dy, 9, 3, c);
          H(14 + ln, -28 + dy, 3, 4);
        } else {
          R(4 + ln, -24 + dy, 9, 3, c);
          H(13 + ln, -25 + dy, 3, 4);
        }
        break;
      case 'forward':
        R(5 + ln, -27 + dy, 6, 3, c);
        H(11 + ln, -28 + dy, 3, 4);
        break;
      case 'chamber':
        R(-3 + ln, -27 + dy, 6, 3, c);
        H(-6 + ln, -28 + dy, 3, 4);
        break;
      case 'up':
        R(bx + ln, -41 + dy, 3, 12, c);
        H(bx + ln, -44 + dy);
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
    }
  };

  const skirt = () => {
    R(-8, -16 + dy, 16, 8, '#2a3357');
    R(-8, -13 + dy, 16, 1, '#4a578c');
    R(-4, -16 + dy, 1, 8, '#4a578c');
    R(2, -16 + dy, 1, 8, '#4a578c');
    R(-8, -9 + dy, 16, 1, '#1d2440');
  };

  const torso = () => {
    if (outfit === 'kensetsu') {
      // 工事ベスト（ハイビズ）：暗い作業着の上にオレンジの反射ベスト
      R(-6 + ln, -30 + dy, 12, 16, '#242a38');
      R(-3 + ln, -29 + dy, 6, 14, '#e0691a');
      R(-3 + ln, -24 + dy, 6, 1, '#d8e0ea');
      R(-3 + ln, -19 + dy, 6, 1, '#d8e0ea');
      R(-3 + ln, -29 + dy, 1, 14, '#c9d2dc');
      R(2 + ln, -29 + dy, 1, 14, '#c9d2dc');
      R(-6 + ln, -15 + dy, 12, 1, '#1a202e');
      return;
    }
    R(-6 + ln, -30 + dy, 12, 16, body);
    if (outfit !== 'vest') R(-6 + ln, -30 + dy, 12, 1, blazerD);
    R(-2 + ln, -30 + dy, 4, 2, '#f4f4f8');
    R(-1 + ln, -28 + dy, 2, 3, '#f4f4f8');
    if (isF) {
      R(-2 + ln, -28 + dy, 4, 2, '#2f4f8f');
      R(0 + ln, -28 + dy, 1, 2, '#c9a56a');
    } else {
      const tie = look.tieColor ?? (outfit === 'suit' ? '#7a5230' : '#a8262e');
      R(0 + ln, -28 + dy, 1, 8, tie);
      if (look.tieStripe) {
        // 斜めストライプ風（1px幅なので明るいドットを等間隔に）
        R(0 + ln, -26 + dy, 1, 1, '#93b4e6');
        R(0 + ln, -23 + dy, 1, 1, '#93b4e6');
      }
    }
    if (outfit === 'blazer') {
      R(-1 + ln, -21 + dy, 1, 1, '#c9a86a');
      R(-6 + ln, -15 + dy, 12, 1, blazerD);
    } else if (outfit === 'vest') {
      R(-6 + ln, -15 + dy, 12, 1, '#1a2040');
    } else {
      R(-6 + ln, -15 + dy, 12, 1, '#4f4b42');
    }
  };

  const accessory = () => {
    const calm =
      o.pose === 'idle' ||
      o.pose === 'walk' ||
      o.pose === 'win' ||
      o.pose === 'frozen' ||
      o.pose === 'crouch' ||
      o.pose === 'block' ||
      o.pose === 'stun' ||
      (o.pose === 'penJab' && (o.phase ?? 0) === 2); // 突いたあとノートにメモ
    if (!calm) return;
    switch (look.accessory) {
      case 'bookFront':
        R(-3 + ln, -28 + dy, 9, 7, '#e9dfcc');
        R(-3 + ln, -28 + dy, 1, 7, '#7a5a3a');
        R(0 + ln, -26 + dy, 3, 3, '#8fa3c8');
        break;
      case 'bookSide':
        R(2 + ln, -27 + dy, 6, 9, '#1c2340');
        R(4 + ln, -25 + dy, 2, 1, '#c9a86a');
        R(3 + ln, -23 + dy, 4, 1, '#c9a86a');
        break;
      case 'notebook':
        R(3 + ln, -27 + dy, 5, 7, '#f4f4f8');
        R(5 + ln, -26 + dy, 1, 5, '#111111');
        R(4 + ln, -24 + dy, 3, 1, '#111111');
        break;
      case 'loveNote':
        // ピンクの研究ノート「恋愛学ノート」を胸に抱える（少し低めに持って紺のネクタイが見えるように）
        R(-3 + ln, -25 + dy, 9, 7, '#f3b3c6');
        R(-3 + ln, -25 + dy, 1, 7, '#c9748f');
        R(-1 + ln, -24 + dy, 6, 1, '#fde2ea');
        R(0 + ln, -22 + dy, 4, 1, '#a34d6b');
        R(0 + ln, -20 + dy, 3, 1, '#a34d6b');
        break;
      case 'map':
        R(4 + ln, -30 + dy, 3, 13, '#e6dcc0');
        R(4 + ln, -26 + dy, 3, 1, '#7a9a6a');
        R(4 + ln, -22 + dy, 3, 1, '#7a9a6a');
        break;
    }
  };

  const head = () => {
    const hx = ln;
    const hy = dy;
    R(-2 + hx, -31 + hy, 4, 2, skinD);
    R(-6 + hx, -42 + hy, 12, 12, skin);
    R(-6 + hx, -37 + hy, 1, 3, skinD);
    const eye = look.eyeColor;
    const eyes = () => {
      R(0 + hx, -38 + hy, 2, 2, eye);
      R(3 + hx, -38 + hy, 2, 2, eye);
      R(0 + hx, -38 + hy, 1, 1, '#ffffff');
      R(3 + hx, -38 + hy, 1, 1, '#ffffff');
    };
    switch (P.face) {
      case 'normal':
        eyes();
        R(2 + hx, -33 + hy, 2, 1, '#8a4a4a');
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
        R(2 + hx, -33 + hy, 2, 1, '#8a4a4a');
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
    if (look.sweat && P.face !== 'smile' && P.face !== 'shout') {
      // こめかみの汗（緊張）
      const drip = Math.floor(o.t / 20) % 3;
      R(6 + hx, -39 + hy + drip, 1, 2, '#a8dcff');
      R(6 + hx, -39 + hy + drip, 1, 1, '#e6f6ff');
    }
    if (look.glasses) {
      const g = '#2a2a30';
      R(-1 + hx, -39 + hy, 7, 1, g);
      R(-1 + hx, -36 + hy, 7, 1, g);
      R(-1 + hx, -39 + hy, 1, 4, g);
      R(2 + hx, -39 + hy, 1, 4, g);
      R(5 + hx, -39 + hy, 1, 4, g);
      R(-6 + hx, -38 + hy, 5, 1, g);
    }
    // hair
    R(-7 + hx, -45 + hy, 14, 6, hc);
    R(-7 + hx, -39 + hy, 2, 4, hc);
    switch (look.hair) {
      case 'short':
        R(-1 + hx, -39 + hy, 3, 1, hc);
        R(3 + hx, -39 + hy, 3, 1, hc);
        break;
      case 'spiky':
        R(-6 + hx, -47 + hy, 2, 2, hc);
        R(-2 + hx, -48 + hy, 2, 3, hc);
        R(2 + hx, -47 + hy, 2, 2, hc);
        R(5 + hx, -46 + hy, 2, 2, hc);
        R(-4 + hx, -46 + hy, 1, 1, hc);
        R(0 + hx, -46 + hy, 1, 1, hc);
        R(2 + hx, -39 + hy, 4, 1, hc);
        break;
      case 'long':
        R(-1 + hx, -39 + hy, 3, 1, hc);
        R(3 + hx, -39 + hy, 3, 1, hc);
        R(-9 + hx, -41 + hy, 3, 25, hc);
        R(-10 + hx, -35 + hy, 1, 15, hc);
        R(6 + hx, -40 + hy, 1, 10, hc);
        R(-7 + hx, -39 + hy, 2, 7, hc);
        break;
      case 'bob':
        R(-1 + hx, -39 + hy, 3, 1, hc);
        R(3 + hx, -39 + hy, 3, 1, hc);
        R(-8 + hx, -41 + hy, 2, 10, hc);
        R(6 + hx, -40 + hy, 2, 8, hc);
        R(-7 + hx, -39 + hy, 2, 8, hc);
        break;
      case 'messy':
      case 'messyAhoge':
        R(-8 + hx, -44 + hy, 2, 2, hc);
        R(-4 + hx, -47 + hy, 2, 2, hc);
        R(0 + hx, -46 + hy, 2, 1, hc);
        R(3 + hx, -47 + hy, 2, 2, hc);
        R(6 + hx, -45 + hy, 2, 1, hc);
        R(-1 + hx, -39 + hy, 2, 1, hc);
        R(2 + hx, -39 + hy, 1, 2, hc);
        R(4 + hx, -39 + hy, 2, 1, hc);
        if (look.hair === 'messyAhoge') {
          R(0 + hx, -49 + hy, 1, 2, hc);
          R(1 + hx, -50 + hy, 1, 1, hc);
        }
        break;
      case 'adult':
        R(-7 + hx, -39 + hy, 2, 3, hc);
        if (look.hairDark) R(-7 + hx, -45 + hy, 14, 1, look.hairDark);
        break;
      case 'fluffy': {
        // ふわっとした量の多い茶髪（櫻）
        R(-8 + hx, -44 + hy, 2, 5, hc);
        R(6 + hx, -44 + hy, 2, 4, hc);
        R(-6 + hx, -47 + hy, 3, 2, hc);
        R(-2 + hx, -48 + hy, 3, 3, hc);
        R(2 + hx, -47 + hy, 3, 2, hc);
        R(5 + hx, -46 + hy, 2, 1, hc);
        R(-4 + hx, -46 + hy, 1, 1, hc);
        R(1 + hx, -46 + hy, 1, 1, hc);
        R(-1 + hx, -39 + hy, 3, 1, hc);
        R(3 + hx, -39 + hy, 2, 2, hc);
        R(-7 + hx, -39 + hy, 2, 6, hc);
        const hd = look.hairDark ?? hc;
        R(-3 + hx, -45 + hy, 1, 1, hd);
        R(1 + hx, -44 + hy, 1, 1, hd);
        R(4 + hx, -45 + hy, 1, 1, hd);
        break;
      }
    }
    if (look.accessory === 'headphones') {
      R(-7 + hx, -32 + hy, 14, 2, '#2b2b32');
      R(-9 + hx, -34 + hy, 3, 5, '#1c1c22');
      R(5 + hx, -34 + hy, 3, 5, '#1c1c22');
      R(-8 + hx, -33 + hy, 1, 2, '#5c5c6a');
    }
  };

  /** 工事ヘルメット（kensetsu 服装のとき頭頂に描く）。R() が左右を反転してくれるので前面ツバは常に正面に来る。 */
  const helmet = () => {
    if (outfit !== 'kensetsu') return;
    const hx = ln;
    const hy = dy;
    R(-7 + hx, -46 + hy, 14, 3, '#facc15');
    R(-6 + hx, -47 + hy, 12, 1, '#fde047');
    R(-5 + hx, -48 + hy, 3, 1, '#fde047');
    R(-7 + hx, -43 + hy, 14, 2, '#e0a800');
    R(-7 + hx, -44 + hy, 14, 1, '#f6d030');
    // 前面のツバ（+x 側 → 向きに応じて鏡映される）
    R(5 + hx, -43 + hy, 4, 1, '#c78a00');
    R(5 + hx, -42 + hy, 2, 1, '#e0a800');
    // 頭頂のアタッチメント
    R(-2 + hx, -49 + hy, 4, 1, '#fdd835');
    // ヘルメットの下からはみ出る額の毛
    R(-1 + hx, -41 + hy, 2, 1, look.hairColor);
  };

  const weapon = () => {
    if (!P.weapon) return;
    const hx = hand.x;
    const hy = hand.y;
    switch (look.weapon) {
      case 'bowl':
        R(hx - 3, hy - 1, 9, 5, '#f4f0e8');
        R(hx - 3, hy - 1, 9, 1, '#c0392b');
        R(hx - 2, hy - 3, 7, 2, '#e8c46a');
        R(hx, hy - 4, 2, 1, '#fff2a8');
        R(hx + 3, hy - 4, 2, 1, '#a0522d');
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
        break;
      case 'python':
        for (let i = 0; i < 11; i++) {
          const wy = Math.round(Math.sin(i * 1.1 + o.t * 0.6) * 1.5);
          R(hx + 3 + i * 2, hy + wy, 2, 2, i % 2 ? '#3776ab' : '#ffd43b');
        }
        R(hx + 25, hy - 1, 3, 3, '#3776ab');
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
      case 'hammer':
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
  if (isF) skirt();
  torso();
  accessory();
  head();
  helmet();
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
