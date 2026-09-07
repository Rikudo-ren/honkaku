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
      if (look.outfit === 'gym') return { ...base, dy: bob * 4, armF: 'behind', armB: 'behind', lean: -4 };
      return { ...base, dy: bob * 4, armF: iF, armB: iB };
    case 'frozen':
      return { ...base, face: 'closed', armF: iF, armB: iB };
    case 'walk': {
      if (look.outfit === 'gym') {
        const lf = Math.floor(t / 3) % 4;
        return { ...base, dy: lf % 2 ? 0 : 4, lean: 8, legs: 'walk', legFrame: lf, armF: lf < 2 ? 'walkF' : 'walkB', armB: lf < 2 ? 'walkB' : 'walkF' };
      }
      const lf = Math.floor(t / 6) % 4;
      return {
        ...base, dy: lf % 2 ? 0 : 4, lean: 4, legs: 'walk', legFrame: lf,
        armF: hug ? 'hold' : lf < 2 ? 'walkF' : 'walkB',
        armB: hug ? 'hold' : lf < 2 ? 'walkB' : 'walkF',
      };
    }
    case 'jump':
      return { ...base, legs: 'jump', armF: 'up', armB: 'up' };
    case 'crouch':
      return { ...base, dy: 24, legs: 'crouch', armF: iF, armB: iB };
    case 'getup':
      return { ...base, dy: 24, legs: 'crouch', face: 'hurt', armF: iF, armB: iB };
    case 'lose':
      return { ...base, dy: 24, legs: 'crouch', face: 'hurt', armF: iF, armB: iB };
    case 'block':
      return { ...base, armF: 'block', armB: iB, face: 'closed' };
    case 'jab':
      return phase === 0
        ? { ...base, armF: 'chamber', lean: -4 }
        : phase === 1
          ? { ...base, dy: 4, armF: 'punch', face: 'shout', legs: 'wide', lean: 8 }
          : { ...base, armF: 'forward', legs: 'wide' };
    case 'penJab':
      // シャーペンで突いてから、ノートにメモする
      return phase === 0
        ? { ...base, armF: 'chamber', armB: hug ? 'hold' : 'down', lean: -4, pen: true }
        : phase === 1
          ? { ...base, dy: 4, armF: 'punch', armB: hug ? 'hold' : 'down', face: 'closed', legs: 'wide', lean: 8, pen: true }
          : { ...base, armF: 'hold', armB: 'hold', legs: 'wide', face: 'normal', pen: true };
    case 'cheerClap':
      return { ...base, armF: phase === 1 ? 'clap' : 'clapOpen', armB: phase === 1 ? 'clap' : 'clapOpen', legs: 'wide', lean: phase === 1 ? 4 : -4, face: 'shout' };
    case 'cheerTurn':
      return phase === 0
        ? { ...base, lean: -8, armF: 'hip', armB: 'hip', legs: 'crouch', dy: 8 }
        : phase === 1
          ? { ...base, lean: 12, armF: 'chamber', armB: 'flail', legs: 'walk', legFrame: Math.floor(t / 2) % 4 }
          : { ...base, lean: -8, armF: 'forward', armB: 'spread', legs: 'wide', face: 'shout' };
    case 'cheerCall':
      return phase === 0
        ? { ...base, armF: 'clapOpen', armB: 'clapOpen', face: 'closed', legs: 'wide' }
        : { ...base, lean: 8, armF: 'cup', armB: 'cup', face: 'shout', legs: 'wide' };
    case 'airStep':
      return { ...base, lean: 4, armF: 'spread', armB: 'spread', legs: 'jump' };
    case 'airClap':
      return { ...base, lean: 4, armF: phase === 1 ? 'clap' : 'clapOpen', armB: phase === 1 ? 'clap' : 'clapOpen', legs: 'jump', face: 'shout' };
    case 'airDive':
      return { ...base, lean: 8, armF: 'up', armB: 'flail', legs: phase === 1 ? 'dive' : 'jump', face: 'shout' };
    case 'confess':
      // 深呼吸して、ノートを胸の前で開く。目は閉じている（緊張）
      return { ...base, lean: 8, armF: 'hold', armB: 'hold', legs: 'wide', face: 'closed', openNote: true };
    case 'swing':
      return phase === 0
        ? { ...base, armF: 'raise', weapon: true, lean: -8 }
        : phase === 1
          ? { ...base, dy: 4, armF: 'swingDown', weapon: true, face: 'shout', legs: 'wide', lean: 8 }
          : { ...base, armF: 'forward', weapon: true, legs: 'wide' };
    case 'lash':
      return phase === 0
        ? { ...base, armF: 'chamber', weapon: true, lean: -4 }
        : phase === 1
          ? { ...base, dy: 4, armF: 'punch', weapon: true, face: 'shout', legs: 'wide', lean: 8 }
          : { ...base, armF: 'forward', legs: 'wide' };
    case 'kick':
      return phase === 0
        ? { ...base, lean: -8, armB: 'up' }
        : phase === 1
          ? { ...base, legs: 'kick', armF: 'chamber', armB: 'flail', lean: -4, face: 'shout' }
          : { ...base, legs: 'wide' };
    case 'throw':
      return phase === 0 ? { ...base, armF: 'raise', lean: -4 } : { ...base, dy: 4, armF: 'punch', legs: 'wide', lean: 8, face: 'shout' };
    case 'counter':
    case 'spread':
      return { ...base, armF: 'spread', armB: 'spread', legs: 'wide', face: 'shout' };
    case 'point':
      return phase === 0 ? { ...base, armF: 'chamber' } : { ...base, dy: 4, armF: 'punch', legs: 'wide', lean: 4 };
    case 'pointUp':
      return { ...base, armF: 'raise', face: phase === 1 ? 'shout' : 'normal' };
    case 'hurt':
      return { ...base, lean: -12, armF: 'flail', armB: 'flail', face: 'hurt' };
    case 'launch':
      return { ...base, lean: -16, armF: 'flail', armB: 'flail', legs: 'jump', face: 'hurt' };
    case 'down':
      return { ...base, lying: true };
    case 'stun':
      return { ...base, lean: Math.floor(t / 8) % 2 ? -4 : 4, face: 'dizzy', armF: iF, armB: iB };
    case 'grab':
      return { ...base, dy: 4, armF: 'punch', armB: 'punch', legs: 'wide', face: 'shout' };
    case 'grabbed':
      return { ...base, lean: -8, legs: 'dangle', armF: 'flail', armB: 'flail', face: 'hurt' };
    case 'paper':
      return { ...base, armF: 'raise', face: 'normal', paper: true };
    case 'win': {
      const wp = look.winPose ?? 'cheer';
      if (wp === 'tsundere') return { ...base, dy: bob * 4, lean: -4, armF: 'behind', armB: 'behind', face: 'closed' };
      if (wp === 'cool') {
        const crossed = look.outfit === 'suit' || look.outfit === 'kensetsu';
        return { ...base, dy: bob * 4, face: 'closed', armF: crossed ? 'crossed' : 'hip', armB: crossed ? 'crossed' : 'hip' };
      }
      if (wp === 'shy') return { ...base, dy: bob * 4, face: 'smile', armF: 'block', armB: hug ? 'hold' : 'down' };
      if (wp === 'peace') return { ...base, dy: bob * 4, face: 'smile', armF: 'peace' };
      if (wp === 'hug') return { ...base, dy: bob * 4, face: 'smile', armF: 'hold', armB: 'hold' };
      return { ...base, dy: bob * 4, face: 'smile', armF: 'up', armB: 'up', legs: bob ? 'wide' : 'stand' };
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
 * ドット絵ファイターを描画する。(x, y) は足元中央。HD版：1単位=旧1pxの4倍。
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
  const pantsD = isSuit ? '#2c2e34' : isWork ? '#26282e' : '#1b2347';
  const shoe = look.shoeColor ?? (isGym ? '#f7f7fc' : isWork ? '#5a4632' : isF || isSuit ? '#5b3a22' : '#141418');
  const sockC = isGym ? '#f0f0f5' : '#22222e';
  const handC = isWork ? '#5a5346' : skin; // 土木作業は軍手
  const dy = P.dy;
  const ln = P.lean;
  const hc = look.hairColor;
  const hd = look.hairDark ?? hc;
  const hl = look.hairLight ?? hc;
  const eye = look.eyeColor;
  const eyeStyle = look.eyeStyle ?? 'round';
  // 髪・ネクタイの揺れ（-4〜4）。瞬きは約3.3秒に1回、6フレームだけ閉じる。
  const sway = Math.round(Math.sin((o.t + seed) / 9) * 4);
  const walking = P.legs === 'walk';
  const tieSway = walking ? Math.round(Math.sin(o.t / 4 + seed) * 4.8) : sway;
  const blink = P.face === 'normal' && (o.t + seed) % 200 < 5;
  let hand = { x: 16, y: -72 + dy };

  if (P.lying) {
    // ── ダウン（横たわり）: 服装ごとの胴＋頭。眼鏡は細い線だけ残す。
    const torsoC = isGym ? '#f5f4fa' : isWork ? '#e0691a' : isSuit ? '#5c554b' : outfit === 'vest' ? '#242b4c' : body;
    R(-48, -32, 56, 28, torsoC);
    R(-48, -8, 56, 4, isWork ? '#b34d12' : isSuit ? '#46403a' : isGym ? '#d4d1df' : blazerD);
    if (isWork) {
      R(-48, -24, 56, 8, '#c9d2dc');
      R(-28, -32, 8, 28, '#2c3448');
      R(-28, -32, 2, 28, '#222839');
    }
    if (isSuit) {
      R(-28, -32, 16, 28, '#2e3138'); // ベスト
      R(-24, -28, 8, 20, look.tieColor ?? '#2f3a5a'); // ネクタイ
    }
    if (!isGym && !isWork && !isSuit) {
      R(-28, -32, 16, 7, '#f4f4f8'); // 白シャツ
      if (!isF) R(-24, -25, 8, 21, look.tieColor ?? '#a8262e');
      else {
        R(-32, -28, 12, 12, '#2f4f8f'); // リボン
        R(-28, -28, 5, 12, '#22386a');
      }
    }
    if (isF && !isGym) R(-4, -36, 32, 32, '#2a3357');
    if (isGym) {
      R(16, -36, 4, 28, '#e9e9f1');
      R(-12, -36, 28, 16, '#29334e'); // 紺の短パン（腰）
      R(16, -36, 12, 16, '#29334e');
      R(-12, -24, 28, 4, '#1c243a');
    }
    const c = isF && !isWork ? skin : pants;
    R(8, -28, 44, 20, c);
    R(8, -12, 44, 4, isF && !isWork ? skinD : pantsD);
    if (isF && !isGym) R(36, -28, 16, 20, sockC);
    if (isWork) R(16, -28, 12, 20, '#c9d2dc');
    R(52, -28, 12, 20, shoe);
    R(52, -12, 12, 4, isGym ? '#29334e' : '#2e2118'); // 靴底
    R(-32, -56, 12, 24, sleeve);
    R(-32, -64, 12, 8, handC);
    // 頭（横向き）
    R(-84, -40, 40, 40, skin);
    R(-84, -8, 40, 8, skinD); // 顎側の影
    R(-88, -48, 48, 16, hc);
    R(-88, -48, 48, 4, hl); // 髪の照り
    R(-88, -36, 12, 32, hc);
    if (look.hair === 'long') {
      R(-96, -32, 12, 40, hc);
      R(-96, -32, 3, 40, hd);
    }
    if (look.hair === 'fluffy') R(-92, -48, 8, 12, hc);
    if (look.hair === 'bob' || look.hair === 'straight' || look.hair === 'messyAhoge') R(-88, -8, 16, 6, hc);
    R(-60, -28, 8, 4, eye); // 閉じた目
    R(-56, -12, 8, 4, '#8a4a4a');
    if (look.blush) R(-68, -20, 8, 4, '#e89b9f');
    if (look.glasses) {
      const g = look.glassesColor ?? '#2a2a30';
      R(-68, -32, 20, 4, g);
      R(-68, -24, 20, 4, g);
    }
    if (look.accessory === 'headphones') {
      R(-36, -36, 12, 20, '#1c1c22');
      R(20, -36, 8, 16, '#1c1c22');
      R(-36, -36, 3, 20, '#3a3a44');
    }
    if (isGym) {
      R(-88, -44, 48, 8, '#f7f7fc');
      R(-88, -38, 48, 3, '#dedbe5');
      R(-96, -40, 12, 12, '#e9e9f1');
      R(-112, -32, 20, 8, '#f7f7fc');
      R(-36, -44, 8, 20, skin);
    }
    if (isWork) {
      // ヘルメットは脱げて頭の横に転がる
      R(-120, -24, 36, 20, '#facc15');
      R(-120, -24, 36, 4, '#fde047');
      R(-112, -16, 20, 4, '#2f9e44');
      R(-120, -8, 36, 4, '#c78a00');
    }
    ctx.globalAlpha = prevAlpha;
    return;
  }

  const leg = (lx: number, ly: number, w: number, h: number) => {
    if (isWork) {
      // カーゴパンツ＋再帰反射テープ＋安全靴
      R(lx, ly, w, h, pants);
      R(lx, ly, 3, h, pantsD); // 脇の影
      R(lx + w - 5, ly + 4, 2, h - 8, '#3d4149'); // 折り目の照り
      R(lx + (lx < 0 ? 0 : w - 8), ly + 12, 8, 12, '#2a2d33'); // カーゴポケット
      R(lx + (lx < 0 ? 0 : w - 8), ly + 12, 8, 3, '#3a3e45');
      R(lx, ly + h - 32, w, 8, '#c9d2dc'); // 反射テープ
      R(lx, ly + h - 32, w, 2, '#eef2f6');
      R(lx, ly + h - 16, w + 4, 16, shoe); // 安全靴（高め）
      R(lx, ly + h - 16, w + 4, 3, '#7a6248'); // 履き口
      R(lx + 4, ly + h - 13, w - 4, 3, '#2e2118');
      R(lx, ly + h - 4, w + 4, 4, '#2e2118'); // 靴底
      R(lx + 4, ly + h - 16, 4, 8, '#7a6248'); // 紐
      R(lx + w - 4, ly + h - 12, 6, 4, '#6b5540'); // 爪先キャップ
      return;
    }
    if (isF) {
      R(lx, ly, w, h, skin);
      R(lx + w - 4, ly + 4, 4, h - 8, skinD); // 脚の丸み
      if (isGym) {
        R(lx, ly + h - 20, w, 12, sockC); // 白クルーソックス
        R(lx, ly + h - 20, w, 3, '#ffffff');
        R(lx + 3, ly + h - 17, 2, 9, '#d4d1df');
        R(lx + w - 5, ly + h - 17, 2, 9, '#d4d1df');
      } else {
        R(lx, ly + h - 36, w, 28, sockC); // 黒ニーハイ
        R(lx, ly + h - 36, w, 4, '#3a3a48');
        R(lx + 2, ly + h - 32, 2, 24, '#2e2e3a'); // リブ
        R(lx + w - 4, ly + h - 32, 2, 24, '#2e2e3a');
      }
    } else {
      R(lx, ly, w, h, pants);
      R(lx, ly, 3, h, pantsD);
      R(lx + 5, ly + 4, 2, h - 20, '#2e3760'); // 折り目
      R(lx, ly + h - 16, w, 8, '#1c1c28'); // 短い靴下
    }
    R(lx, ly + h - 8, w + 4, 8, shoe);
    if (isGym) {
      R(lx - 4, ly + h - 12, w + 8, 8, shoe);
      R(lx, ly + h - 12, 8, 4, '#c4c6d3'); // 紐通し
      R(lx + w - 8, ly + h - 12, 8, 4, '#c4c6d3');
      R(lx - 4, ly + h - 4, w + 8, 4, '#29334e'); // ソール
      R(lx - 4, ly + h - 6, w + 8, 2, '#ffffff');
    } else if (isF || isSuit) {
      R(lx, ly + h - 8, w, 4, '#6b4a2e'); // ローファーの甲
      R(lx + 3, ly + h - 7, w - 6, 2, '#8a5f38');
      R(lx, ly + h - 3, w + 4, 3, '#241a12'); // 底
    } else {
      R(lx + 2, ly + h - 8, w - 2, 3, '#2a2a34'); // 革靴の照り
      R(lx, ly + h - 3, w + 4, 3, '#0a0a0e');
    }
  };

  const legs = () => {
    const c = isF ? skin : pants;
    const cd = isF ? skinD : pantsD;
    switch (P.legs) {
      case 'stand':
        leg(-20, -56, 16, 56);
        leg(4, -56, 16, 56);
        break;
      case 'walk': {
        const s = [8, 0, -8, 0][P.legFrame];
        const bl = s > 0 ? 4 : 0;
        const fl = s < 0 ? 4 : 0;
        leg(-20 - s, -56 + bl, 16, 56 - bl);
        leg(4 + s, -56 + fl, 16, 56 - fl);
        break;
      }
      case 'jump':
        R(-20, -56, 16, 28, c);
        R(-32, -36, 16, 16, c);
        R(-32, -24, 16, 4, cd);
        if (isF && !isGym) R(-32, -32, 16, 8, sockC);
        if (isWork) R(-32, -36, 8, 16, '#c9d2dc');
        R(-32, -24, 20, 8, shoe);
        R(-32, -20, 20, 4, isGym ? '#29334e' : '#241a12');
        R(4, -56, 16, 32, c);
        R(12, -32, 16, 16, c);
        R(12, -20, 16, 4, cd);
        if (isF && !isGym) R(12, -28, 16, 8, sockC);
        if (isWork) R(20, -32, 8, 16, '#c9d2dc');
        R(12, -20, 20, 8, shoe);
        R(12, -16, 20, 4, isGym ? '#29334e' : '#241a12');
        break;
      case 'dive':
        // 片脚を下へ伸ばし、もう片脚を畳む。空中強専用の急降下シルエット。
        leg(20, -60, 16, 60);
        R(-24, -56, 16, 24, c);
        R(-40, -44, 16, 12, c);
        R(-44, -44, 16, 12, sockC);
        R(-52, -44, 12, 16, shoe);
        R(-52, -32, 12, 4, isGym ? '#29334e' : '#241a12');
        break;
      case 'dangle':
        R(-20, -48, 16, 32, c);
        R(-20, -20, 20, 8, shoe);
        R(4, -48, 16, 36, c);
        R(4, -16, 20, 8, shoe);
        break;
      case 'crouch':
        leg(-28, -32, 20, 32);
        leg(8, -32, 20, 32);
        break;
      case 'kick':
        leg(-20, -56, 16, 56);
        R(4, -68, 52, 16, c);
        R(4, -56, 52, 4, cd);
        if (isF && !isGym) R(40, -68, 16, 16, sockC);
        R(56, -72, 12, 20, shoe);
        R(56, -56, 12, 4, '#241a12');
        break;
      case 'wide':
        leg(-32, -56, 16, 56);
        leg(16, -56, 16, 56);
        break;
    }
  };

  const arm = (side: 'F' | 'B', p: ArmPose) => {
    const bx = side === 'F' ? 16 : -28;
    const c = sleeve;
    const handD = isWork ? '#4a4438' : skinD;
    const H = (lx: number, ly: number, w = 12, h = 12) => {
      R(lx, ly, w, h, handC);
      R(lx, ly + h - 4, w, 4, handD); // 手の丸み
      if (w >= 12 && !isWork) {
        R(lx + 3, ly + 2, 2, h - 6, handD); // 指の分かれ目
        R(lx + w - 5, ly + 2, 2, h - 6, handD);
      }
      if (side === 'F') hand = { x: lx, y: ly };
    };
    // 白シャツのカフス（ブレザー・ベスト・スーツの長袖）
    const cuffed = !isGym && !isWork;
    const CU = (lx: number, ly: number, w = 12) => {
      if (cuffed) {
        R(lx + ln, ly + dy, w, 4, '#f4f4f8');
        R(lx + ln, ly + dy + 3, w, 1, '#c9c9d4');
        R(lx + ln + 2, ly + dy + 1, 2, 2, '#aab0bc'); // カフスボタン
      }
    };
    if (isGym) {
      // 半袖は肩だけ。肘〜手首は肌色で描く。
      const S = (lx: number, ly: number, w = 16, h = 20) => {
        R(lx + ln, ly + dy, w, h, sleeve);
        R(lx + ln, ly + dy + h - 5, w, 5, sleeveD); // 袖口
      };
      const A = (lx: number, ly: number, w: number, h: number) => {
        R(lx + ln, ly + dy, w, h, skin);
        R(lx + ln + w - 4, ly + dy + 2, 4, h - 4, skinD);
      };
      const front = side === 'F';
      const b = front ? 20 : -32;
      switch (p) {
        case 'none': return;
        case 'pocket':
        case 'fist':
        case 'behind':
        case 'down':
          S(b, -120);
          A(b + (front ? 0 : 4), -100, 12, 28);
          H(b + ln, -72 + dy, 8, 12);
          return;
        case 'walkF':
          S(b, -120);
          A(b + 4, -100, 12, 16);
          H(b + 4 + ln, -88 + dy, 8, 12);
          return;
        case 'walkB':
          S(b, -120);
          A(b - 4, -100, 12, 16);
          H(b - 4 + ln, -88 + dy, 8, 12);
          return;
        case 'crossed':
        case 'hold':
          S(b, -120);
          A(front ? 4 : -28, -100, 32, 12);
          H((front ? -8 : 4) + ln, -100 + dy);
          return;
        case 'clap':
        case 'clapOpen':
          S(b, -120);
          if (front) {
            A(32, -108, 20, 12);
            A(p === 'clap' ? 44 : 52, -128, 12, 24);
            H((p === 'clap' ? 40 : 52) + ln, -132 + dy, 12, 16);
          } else {
            A(-24, -100, 48, 12);
            A(20, -112, p === 'clap' ? 20 : 8, 12);
            H((p === 'clap' ? 36 : 20) + ln, -124 + dy, 12, 16);
          }
          return;
        case 'cup':
          S(b, -120);
          if (front) {
            A(32, -128, 12, 32);
            H(20 + ln, -144 + dy, 12, 16);
          } else {
            A(-24, -104, 28, 12);
            A(-8, -128, 12, 32);
            H(-4 + ln, -144 + dy, 8, 16);
          }
          return;
        case 'hip':
          S(b, -120);
          A(b, -100, 12, 20);
          H(b + ln + (front ? -8 : 8), -88 + dy);
          return;
        case 'punch':
        case 'forward':
          S(20, front ? -116 : -104, 20, 16);
          A(40, front ? -112 : -100, p === 'punch' ? 20 : 12, 12);
          H((p === 'punch' ? 60 : 52) + ln, (front ? -116 : -104) + dy, 12, 16);
          return;
        case 'chamber':
          S(12, -120);
          A(-12, -108, 28, 12);
          H(-20 + ln, -112 + dy, 12, 16);
          return;
        case 'up':
        case 'peace':
        case 'raise':
        case 'block':
          S(b, -132, 16, 20);
          A(b, p === 'raise' ? -176 : -164, 12, p === 'raise' ? 44 : 32);
          H(b + ln, (p === 'raise' ? -188 : -176) + dy);
          return;
        case 'spread':
          S(b, -128, 16, 20);
          A(front ? 36 : -48, -140, 16, 20);
          H((front ? 52 : -60) + ln, -152 + dy);
          return;
        case 'flail':
          S(b, -120);
          A(front ? 32 : -44, -136, 12, 32);
          H((front ? 32 : -44) + ln, -148 + dy);
          return;
        case 'swingDown':
          S(b, -120);
          A(front ? 4 : -28, -100, 32, 12);
          H((front ? -8 : 4) + ln, -100 + dy);
          return;
      }
    }
    // 土木作業は腕まくり：肩だけ作業着で、前腕は肌＋軍手。
    const rolled = (lx: number, ly: number, w: number, h: number) => {
      R(lx + ln, ly + dy, w, h, skin);
      R(lx + ln + w - 4, ly + dy + 2, 4, h - 4, skinD);
    };
    switch (p) {
      case 'none':
        break;
      case 'down':
        if (isWork) {
          R(bx + ln, -116 + dy, 12, 20, c);
          R(bx + ln, -116 + dy, 4, 20, sleeveD);
          R(bx + ln, -96 + dy, 12, 4, '#3d4a68');
          rolled(bx, -92, 12, 20);
        } else {
          R(bx + ln, -116 + dy, 12, 44, c);
          R(bx + (side === 'F' ? 8 : 0) + ln, -116 + dy, 4, 44, sleeveD);
          R(bx + (side === 'F' ? 0 : 8) + ln, -112 + dy, 2, 36, isSuit ? '#6e675c' : blazer);
          CU(bx, -76);
        }
        H(bx + ln, -72 + dy);
        break;
      case 'pocket':
        // ポケットに手を突っ込む。手は見えない。
        R(bx + ln, -116 + dy, 12, 36, c);
        R(bx + (side === 'F' ? 8 : 0) + ln, -116 + dy, 4, 36, sleeveD);
        CU(bx, -84);
        R(bx + ln - 2, -84 + dy, 16, 5, sleeveD); // ポケット口
        if (side === 'F') hand = { x: bx + ln, y: -80 + dy };
        break;
      case 'fist':
        // 少し握りしめた拳。小刻みに上下する。
        R(bx + ln, -116 + dy, 12, 40, c);
        R(bx + (side === 'F' ? 8 : 0) + ln, -116 + dy, 4, 40, sleeveD);
        CU(bx, -80);
        H(bx + ln, -76 + dy, 12, 16);
        break;
      case 'walkF':
        if (isWork) {
          R(bx + ln, -116 + dy, 12, 16, c);
          rolled(bx + 4, -100, 12, 16);
        } else {
          R(bx + ln, -116 + dy, 12, 20, c);
          R(bx + 4 + ln, -100 + dy, 12, 16, c);
          R(bx + 12 + ln, -100 + dy, 4, 16, sleeveD);
          CU(bx + 4, -88);
        }
        H(bx + 4 + ln, -88 + dy);
        break;
      case 'walkB':
        if (isWork) {
          R(bx + ln, -116 + dy, 12, 16, c);
          rolled(bx - 4, -100, 12, 16);
        } else {
          R(bx + ln, -116 + dy, 12, 20, c);
          R(bx - 4 + ln, -100 + dy, 12, 16, c);
          R(bx - 4 + ln, -100 + dy, 4, 16, sleeveD);
          CU(bx - 4, -88);
        }
        H(bx - 4 + ln, -88 + dy);
        break;
      case 'crossed':
        // 腕組み（大人の勝ちポーズ）
        if (side === 'B') {
          R(-20 + ln, -96 + dy, 40, 12, c);
          R(-20 + ln, -96 + dy, 40, 4, sleeveD);
          CU(12, -96, 8);
          R(20 + ln, -96 + dy, 12, 12, handC);
        } else {
          R(8 + ln, -116 + dy, 16, 12, c);
          R(-16 + ln, -112 + dy, 40, 12, c);
          R(-16 + ln, -104 + dy, 40, 4, sleeveD);
          CU(-24, -112, 8);
          H(-32 + ln, -112 + dy);
        }
        break;
      case 'hip':
        R(bx + ln, -116 + dy, 12, 32, c);
        R(bx + ln, -116 + dy, 4, 32, sleeveD);
        H(bx + ln + (side === 'F' ? -8 : 8), -88 + dy);
        break;
      case 'punch':
        if (side === 'F') {
          R(20 + ln, -108 + dy, 36, 12, c);
          R(20 + ln, -100 + dy, 36, 4, sleeveD);
          R(20 + ln, -108 + dy, 36, 3, isSuit ? '#6e675c' : c);
          CU(44, -108, 12);
          H(56 + ln, -112 + dy, 12, 16);
        } else {
          R(16 + ln, -96 + dy, 36, 12, c);
          R(16 + ln, -96 + dy, 36, 3, sleeveD);
          H(52 + ln, -100 + dy, 12, 16);
        }
        break;
      case 'forward':
        R(20 + ln, -108 + dy, 24, 12, c);
        R(20 + ln, -100 + dy, 24, 4, sleeveD);
        CU(32, -108, 12);
        H(44 + ln, -112 + dy, 12, 16);
        break;
      case 'chamber':
        R(-12 + ln, -108 + dy, 24, 12, c);
        R(-12 + ln, -100 + dy, 24, 4, sleeveD);
        H(-24 + ln, -112 + dy, 12, 16);
        break;
      case 'up':
        R(bx + ln, -164 + dy, 12, 48, c);
        R(bx + (side === 'F' ? 8 : 0) + ln, -164 + dy, 4, 48, sleeveD);
        CU(bx, -132, 12);
        H(bx + ln, -176 + dy);
        break;
      case 'peace':
        // ピースサイン（数理零の勝ちポーズ）
        R(bx + ln, -164 + dy, 12, 48, c);
        R(bx + ln, -176 + dy, 12, 8, handC);
        R(bx + ln, -188 + dy, 4, 12, handC);
        R(bx + 8 + ln, -188 + dy, 4, 12, handC);
        R(bx + 4 + ln, -184 + dy, 4, 6, handD);
        if (side === 'F') hand = { x: bx + ln, y: -176 + dy };
        break;
      case 'block':
        R(16 + ln, -116 + dy, 16, 12, c);
        R(28 + ln, -164 + dy, 12, 48, c);
        R(36 + ln, -164 + dy, 4, 48, sleeveD);
        H(28 + ln, -176 + dy);
        break;
      case 'raise':
        R(16 + ln, -124 + dy, 12, 16, c);
        R(24 + ln, -184 + dy, 12, 60, c);
        R(32 + ln, -184 + dy, 4, 60, sleeveD);
        CU(24, -152, 12);
        H(24 + ln, -196 + dy);
        break;
      case 'swingDown':
        R(20 + ln, -108 + dy, 28, 12, c);
        R(48 + ln, -108 + dy, 12, 28, c);
        R(48 + ln, -108 + dy, 4, 28, sleeveD);
        H(48 + ln, -80 + dy);
        break;
      case 'spread':
        if (side === 'F') {
          R(20 + ln, -120 + dy, 12, 12, c);
          R(32 + ln, -132 + dy, 12, 12, c);
          R(44 + ln, -144 + dy, 12, 12, c);
          R(44 + ln, -136 + dy, 12, 4, sleeveD);
          H(56 + ln, -156 + dy);
        } else {
          R(-32 + ln, -120 + dy, 12, 12, c);
          R(-44 + ln, -132 + dy, 12, 12, c);
          R(-56 + ln, -144 + dy, 12, 12, c);
          R(-56 + ln, -136 + dy, 12, 4, sleeveD);
          H(-68 + ln, -156 + dy);
        }
        break;
      case 'flail':
        if (side === 'F') {
          R(24 + ln, -136 + dy, 12, 28, c);
          R(32 + ln, -136 + dy, 4, 28, sleeveD);
          H(24 + ln, -148 + dy);
        } else {
          R(-36 + ln, -136 + dy, 12, 28, c);
          R(-36 + ln, -136 + dy, 4, 28, sleeveD);
          H(-36 + ln, -148 + dy);
        }
        break;
      case 'hold':
        if (side === 'F') {
          R(4 + ln, -96 + dy, 32, 12, c);
          R(4 + ln, -88 + dy, 32, 4, sleeveD);
          H(-12 + ln, -96 + dy, 16, 12);
        } else {
          R(-28 + ln, -116 + dy, 12, 24, c);
          H(-24 + ln, -96 + dy, 16, 12);
        }
        break;
      case 'clap':
      case 'clapOpen':
      case 'cup':
      case 'behind':
        R(bx + ln, -116 + dy, 12, 36, c);
        R(bx + ln, -116 + dy, 4, 36, sleeveD);
        if (side === 'F') hand = { x: bx + ln, y: -80 + dy };
        break;
    }
  };

  const skirt = () => {
    // 暗めチェックのプリーツスカート。歩くと裾が少し広がる。
    const flare = walking && P.legFrame % 2 === 1 ? 4 : 0;
    R(-32 - flare, -64 + dy, 64 + flare * 2, 32, '#2a3357');
    for (const px of [-20, -8, 4, 16]) {
      R(px, -64 + dy, 4, 32, '#3a4266'); // プリーツの山
      R(px + 4, -64 + dy, 3, 32, '#20263f'); // 谷の影
    }
    R(-32 - flare, -52 + dy, 64 + flare * 2, 4, '#3a4266'); // 横チェック線
    R(-32 - flare, -40 + dy, 64 + flare * 2, 3, '#454e78');
    R(-32 - flare, -64 + dy, 64 + flare * 2, 4, '#1a1f36'); // ベルト
    R(-32 - flare, -36 + dy, 64 + flare * 2, 4, '#1a1f36'); // 裾
  };

  const glyph = (pattern: string[], lx: number, ly: number, color: string) => {
    pattern.forEach((row, yy) => [...row].forEach((dot, xx) => { if (dot === '1') R(lx + xx * 4, ly + yy * 4, 4, 4, color); }));
  };

  const shorts = () => {
    const navy = '#29334e';
    // 紺の短パン。裾は二つに分かれ、側面に白線。スカートにはしない。
    R(-28, -64 + dy, 56, 28, navy);
    R(-28, -64 + dy, 56, 5, '#36405a'); // ウエスト
    R(-6, -63 + dy, 4, 3, '#f5f4fa'); // 紐の結び目
    R(-28, -40 + dy, 24, 8, navy);
    R(4, -40 + dy, 24, 8, navy);
    R(-28, -60 + dy, 4, 24, '#f5f4fa');
    R(24, -60 + dy, 4, 24, '#f5f4fa');
    R(0, -52 + dy, 4, 20, '#1c243a');
    R(-24, -36 + dy, 20, 4, '#36405a');
    // 右裾の「PE」
    glyph(['11011', '11010', '10011'], 4, -48 + dy, '#ffffff');
  };

  const torso = () => {
    if (isGym) {
      const navy = '#29334e';
      R(-28 + ln, -124 + dy, 56, 68, '#f5f4fa');
      R(-28 + ln, -108 + dy, 4, 48, '#d4d1df');
      R(24 + ln, -108 + dy, 4, 48, '#dedbe5');
      R(-24 + ln, -60 + dy, 48, 4, '#ffffff');
      // 紺の丸襟と、左肩から胸へ薄くなるハーフトーン。
      R(-12 + ln, -124 + dy, 28, 8, navy);
      R(-8 + ln, -124 + dy, 20, 4, skin);
      R(-12 + ln, -116 + dy, 28, 3, '#1c243a');
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 6 - Math.floor(row / 2); col++) {
          if (row < 2 || (row + col) % 2 === 0) R(-24 + col * 4 + ln, -120 + row * 4 + dy, 4, 4, row < 3 ? navy : '#9da3b8');
        }
      }
      // 胸の小さな縦書き「桐葉」
      glyph(['111', '101', '111'], 12 + ln, -108 + dy, navy);
      glyph(['111', '010', '111'], 12 + ln, -92 + dy, navy);
      R(-12 + ln, -80 + dy, 4, 16, '#e2dfe9');
      return;
    }
    if (isWork) {
      // 作業着＋反射ベスト。Vに開けた襟元から白インナー。
      R(-24 + ln, -120 + dy, 48, 64, '#2c3448');
      R(-24 + ln, -120 + dy, 8, 64, '#222839');
      R(-24 + ln, -120 + dy, 48, 4, '#3d4a68'); // 肩の照り
      R(-8 + ln, -120 + dy, 16, 12, '#e8e8e8');
      R(-4 + ln, -120 + dy, 8, 4, skin);
      R(-8 + ln, -112 + dy, 16, 3, '#b9b9c2'); // 襟の影
      // オレンジのベスト（左右パネル）
      R(-24 + ln, -116 + dy, 16, 56, '#e0691a');
      R(8 + ln, -116 + dy, 16, 56, '#e0691a');
      R(-24 + ln, -116 + dy, 4, 56, '#f08a3c');
      R(8 + ln, -116 + dy, 4, 56, '#f08a3c');
      R(-12 + ln, -116 + dy, 4, 56, '#b34d12');
      R(20 + ln, -116 + dy, 4, 56, '#b34d12');
      // 銀の反射テープ（縦＋横）
      R(-16 + ln, -116 + dy, 4, 56, '#c9d2dc');
      R(12 + ln, -116 + dy, 4, 56, '#c9d2dc');
      R(-16 + ln, -116 + dy, 4, 6, '#eef2f6');
      R(12 + ln, -116 + dy, 4, 6, '#eef2f6');
      R(-24 + ln, -84 + dy, 16, 8, '#c9d2dc');
      R(8 + ln, -84 + dy, 16, 8, '#c9d2dc');
      // 安全第一ワッペン
      R(12 + ln, -108 + dy, 12, 8, '#e8e8e8');
      R(16 + ln, -108 + dy, 4, 8, '#2f9e44');
      // 工具ベルト
      R(-24 + ln, -64 + dy, 48, 8, '#191c22');
      R(-24 + ln, -64 + dy, 48, 2, '#2e323b');
      R(-4 + ln, -64 + dy, 8, 8, '#8a8f96');
      R(-4 + ln, -64 + dy, 8, 2, '#c9ced4');
      R(-32 + ln, -64 + dy, 8, 16, '#23262e');
      R(24 + ln, -64 + dy, 8, 16, '#23262e');
      R(-32 + ln, -72 + dy, 4, 8, '#c0392b');
      R(28 + ln, -72 + dy, 4, 8, '#f0b429');
      return;
    }
    if (isSuit) {
      // ツイードのジャケット＋ダークベスト＋ストライプタイ
      R(-24 + ln, -120 + dy, 48, 64, '#5c554b');
      R(-24 + ln, -120 + dy, 8, 64, '#46403a');
      R(-20 + ln, -120 + dy, 4, 12, '#6e675c');
      for (let i = 0; i < 8; i++) R(-16 + ((i * 13) % 32) + ln, -116 + ((i * 29) % 52) + dy, 3, 2, '#6e675c'); // ツイードの節
      // ラペル
      R(-16 + ln, -120 + dy, 4, 4, '#46403a');
      R(-12 + ln, -116 + dy, 4, 8, '#46403a');
      R(-8 + ln, -108 + dy, 4, 8, '#46403a');
      R(12 + ln, -120 + dy, 4, 4, '#46403a');
      R(8 + ln, -116 + dy, 4, 8, '#46403a');
      R(4 + ln, -108 + dy, 4, 8, '#46403a');
      R(-12 + ln, -116 + dy, 2, 8, '#6e675c'); // ラペルの縁
      R(10 + ln, -116 + dy, 2, 8, '#6e675c');
      // 白シャツ＋ベスト
      R(-8 + ln, -120 + dy, 16, 8, '#f4f4f8');
      R(-8 + ln, -112 + dy, 16, 48, '#2e3138');
      R(-8 + ln, -112 + dy, 4, 48, '#23262c');
      R(0 + ln, -108 + dy, 4, 4, '#14161c');
      R(0 + ln, -96 + dy, 4, 4, '#14161c');
      // ストライプのネクタイ
      const tie = look.tieColor ?? '#2f3a5a';
      R(-4 + ln, -112 + dy, 8, 8, tie);
      R(-4 + ln, -104 + dy, 8, 28, tie);
      R(-4 + ln, -112 + dy, 3, 28, '#232c48'); // 結び目の影
      R(-4 + ln, -96 + dy, 4, 4, '#93b4e6');
      R(0 + ln, -88 + dy, 4, 4, '#93b4e6');
      R(-4 + ln, -80 + dy, 4, 4, '#93b4e6');
      R(8 + ln, -100 + dy, 12, 4, '#46403a'); // 胸ポケット
      R(8 + ln, -104 + dy, 8, 4, '#e8e4da'); // ポケットチーフ
      R(-24 + ln, -60 + dy, 48, 4, '#46403a');
      return;
    }
    // ── 学生服 ──
    R(-24 + ln, -120 + dy, 48, 64, body);
    R(-24 + ln, -120 + dy, 6, 64, blazerD);
    R(18 + ln, -120 + dy, 6, 64, blazerD);
    if (outfit === 'vest') {
      // 白シャツ＋紺Vネックベスト（三峰）。V開きからシャツとリボン。
      R(-24 + ln, -120 + dy, 48, 64, '#f2f2f6');
      R(-24 + ln, -120 + dy, 48, 64, '#242b4c');
      R(-24 + ln, -120 + dy, 48, 64, '#242b4c');
      R(-8 + ln, -120 + dy, 16, 4, '#f2f2f6');
      R(-8 + ln, -116 + dy, 16, 12, '#f2f2f6');
      R(-4 + ln, -108 + dy, 8, 4, '#f2f2f6');
      R(-8 + ln, -116 + dy, 3, 12, '#d4d4dc'); // Vの影
      R(-24 + ln, -120 + dy, 4, 64, '#1a2040');
      R(-24 + ln, -64 + dy, 48, 4, '#1a2040'); // リブの裾
      for (let i = 0; i < 6; i++) R(-20 + i * 8 + ln, -64 + dy, 4, 4, '#2e3760');
    } else {
      // ブレザー：ラペル・ボタン・胸ポケット
      R(-16 + ln, -120 + dy, 4, 4, blazerD);
      R(-12 + ln, -116 + dy, 4, 8, blazerD);
      R(-8 + ln, -108 + dy, 4, 8, blazerD);
      R(12 + ln, -120 + dy, 4, 4, blazerD);
      R(8 + ln, -116 + dy, 4, 8, blazerD);
      R(4 + ln, -108 + dy, 4, 8, blazerD);
      R(-12 + ln, -116 + dy, 2, 8, '#3d4a7a'); // ラペルの縁
      R(10 + ln, -116 + dy, 2, 8, '#3d4a7a');
      R(-4 + ln, -72 + dy, 4, 4, '#c9a86a');
      R(-2 + ln, -72 + dy, 2, 2, '#e8d5a0');
      R(-4 + ln, -64 + dy, 4, 4, '#c9a86a');
      R(8 + ln, -100 + dy, 12, 4, blazerD);
      R(-24 + ln, -60 + dy, 48, 4, blazerD);
    }
    if (isF) {
      // 女子：白襟＋紺ストライプのリボン
      R(-12 + ln, -120 + dy, 24, 8, '#f4f4f8');
      R(-12 + ln, -114 + dy, 24, 3, '#d4d4dc');
      if (outfit === 'blazer') {
        // 内藤はブレザーの下にダークベスト
        R(-8 + ln, -112 + dy, 16, 40, '#232842');
        R(0 + ln, -96 + dy, 4, 4, '#141828');
      }
      const rib = '#2f4f8f';
      const ribD = '#22386a';
      R(-16 + ln, -116 + dy, 12, 12, rib); // 左羽
      R(4 + ln, -116 + dy, 12, 12, rib); // 右羽
      R(-16 + ln, -116 + dy, 12, 3, '#4a6db3'); // 羽の照り
      R(4 + ln, -116 + dy, 12, 3, '#4a6db3');
      R(-4 + ln, -116 + dy, 8, 12, ribD); // 結び目
      R(-4 + ln, -116 + dy, 8, 3, '#3a5a9a');
      R(-12 + ln, -116 + dy, 4, 4, '#8fa3c8');
      R(8 + ln, -112 + dy, 4, 4, '#8fa3c8');
      R(-8 + ln, -104 + dy, 4, 12, rib); // 垂れ
      R(4 + ln, -104 + dy, 4, 12, rib);
      R(-8 + ln, -94 + dy, 4, 3, ribD);
      R(4 + ln, -94 + dy, 4, 3, ribD);
    } else {
      // 男子：ネクタイ（えんじ／紺）。寺地だけ緩めて長く。
      const tie = look.tieColor ?? '#a8262e';
      const tieD = '#7c1d24';
      if (look.tieLoose) {
        R(-16 + ln, -120 + dy, 32, 8, '#f4f4f8'); // 開けた襟
        R(-8 + ln, -112 + dy, 16, 8, '#f4f4f8');
        R(-8 + ln, -114 + dy, 16, 3, '#d4d4dc');
        R(-4 + ln, -120 + dy, 8, 4, skin);
        R(-4 + ln, -104 + dy, 8, 8, tie); // 低い結び目
        R(-4 + ln, -104 + dy, 3, 8, tieD);
        R(-4 + ln, -96 + dy, 8, 12, tie);
        R(-4 + tieSway + ln, -84 + dy, 8, 12, tie); // 揺れる剣先
        R(-4 + tieSway + ln, -72 + dy, 4, 4, tie);
        R(-4 + tieSway + ln, -84 + dy, 3, 12, tieD);
      } else {
        R(-12 + ln, -120 + dy, 24, 8, '#f4f4f8');
        R(-12 + ln, -114 + dy, 24, 3, '#d4d4dc');
        R(-4 + ln, -112 + dy, 8, 12, '#f4f4f8');
        R(-4 + ln, -112 + dy, 8, 8, tie);
        R(-4 + ln, -112 + dy, 3, 8, tieD);
        R(-4 + ln, -104 + dy, 8, 16, tie);
        R(-4 + tieSway + ln, -88 + dy, 8, 12, tie);
        R(-4 + tieSway + ln, -88 + dy, 3, 12, tieD);
        if (look.tieStripe) {
          R(-4 + ln, -100 + dy, 4, 4, '#93b4e6');
          R(0 + ln, -92 + dy, 4, 4, '#93b4e6');
          R(-4 + tieSway + ln, -84 + dy, 4, 4, '#93b4e6');
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
        R(-12 + ln, -112 + dy, 36, 28, '#e9dfcc');
        R(-12 + ln, -112 + dy, 4, 28, '#7a5a3a');
        R(-12 + ln, -112 + dy, 36, 4, '#f4efe0');
        R(-12 + ln, -88 + dy, 36, 4, '#d4c8a8');
        R(0 + ln, -104 + dy, 12, 12, '#8fa3c8');
        R(4 + ln, -100 + dy, 4, 4, '#e9dfcc');
        R(-4 + ln, -104 + dy, 4, 12, '#5a6a8a');
        R(-4 + ln, -96 + dy, 12, 3, '#7a5a3a'); // 題字
        R(-4 + ln, -91 + dy, 8, 3, '#7a5a3a');
        break;
      case 'bookSide':
        // 難しそうな紺の本（金帯つき）
        R(8 + ln, -108 + dy, 24, 36, '#1c2340');
        R(8 + ln, -108 + dy, 4, 36, '#0e1230');
        R(28 + ln, -108 + dy, 4, 36, '#e9dfcc');
        R(28 + ln, -100 + dy, 4, 3, '#c9bd98');
        R(28 + ln, -90 + dy, 4, 3, '#c9bd98');
        R(16 + ln, -100 + dy, 8, 4, '#c9a86a');
        R(12 + ln, -92 + dy, 16, 4, '#c9a86a');
        R(12 + ln, -84 + dy, 12, 3, '#c9a86a');
        break;
      case 'notebook':
        R(12 + ln, -108 + dy, 20, 28, '#f4f4f8');
        R(12 + ln, -108 + dy, 20, 4, '#2c4a8a');
        R(20 + ln, -104 + dy, 4, 20, '#111111');
        R(16 + ln, -96 + dy, 12, 4, '#111111');
        R(16 + ln, -88 + dy, 12, 3, '#555555');
        break;
      case 'loveNote':
        // ピンクの研究ノート「恋愛学ノート」。紺ネクタイが見えるよう少し低め。
        R(-12 + ln, -100 + dy, 36, 28, '#f3b3c6');
        R(-12 + ln, -100 + dy, 4, 28, '#c9748f');
        R(-4 + ln, -96 + dy, 24, 4, '#fde2ea');
        R(0 + ln, -88 + dy, 16, 4, '#a34d6b');
        R(0 + ln, -80 + dy, 12, 4, '#a34d6b');
        // 小さなハート
        R(14 + ln, -82 + dy, 4, 3, '#e879f9');
        R(20 + ln, -82 + dy, 4, 3, '#e879f9');
        R(14 + ln, -79 + dy, 10, 4, '#e879f9');
        R(16 + ln, -75 + dy, 6, 3, '#e879f9');
        R(18 + ln, -72 + dy, 2, 2, '#e879f9');
        break;
      case 'map':
        // 地形図を両腕で抱える（スーツの塀）。丸めた端＋等高線。
        R(-20 + ln, -112 + dy, 44, 40, '#e6dcc0');
        R(-20 + ln, -112 + dy, 8, 40, '#c9bd98');
        R(-20 + ln, -112 + dy, 8, 4, '#f4efe0');
        R(2 + ln, -112 + dy, 3, 40, '#c9bd98'); // 折り目
        R(4 + ln, -104 + dy, 12, 4, '#7a9a6a');
        R(0 + ln, -96 + dy, 20, 4, '#7a9a6a');
        R(4 + ln, -88 + dy, 16, 4, '#7a9a6a');
        R(8 + ln, -104 + dy, 4, 12, '#5a7a4a');
        R(6 + ln, -106 + dy, 4, 4, '#8a6a4a'); // 三角点
        R(12 + ln, -84 + dy, 8, 4, '#8a6a4a');
        R(-16 + ln, -80 + dy, 24, 3, '#7ab3d4'); // 川
        break;
    }
  };

  const head = () => {
    const hx = ln;
    const hy = dy;
    const lash = '#2e2226';
    const pupil = '#26202a';
    R(-8 + hx, -124 + hy, 16, 8, skinD); // 首
    R(-8 + hx, -124 + hy, 16, 3, skin);
    R(-24 + hx, -168 + hy, 48, 48, skin); // 顔
    R(-24 + hx, -148 + hy, 4, 12, skinD); // 左輪郭
    R(20 + hx, -132 + hy, 4, 8, skinD); // 顎の影
    R(-16 + hx, -124 + hy, 32, 4, skinD); // 顎下
    R(20 + hx, -160 + hy, 4, 20, skinD); // 右頬の丸み

    // ── 目（後ろ目スロットx0-8・前目スロットx12-20／基準y-154） ──
    const eyes = () => {
      if (blink) {
        R(0 + hx, -150 + hy, 8, 3, lash);
        R(12 + hx, -150 + hy, 8, 3, lash);
        return;
      }
      switch (eyeStyle) {
        case 'sharp':
          for (const ex of [0, 12]) {
            R(ex - 1 + hx, -155 + hy, 10, 3, lash); // 上まつげ
            R(ex + 8 + hx, -157 + hy, 3, 2, lash); // 目尻の跳ね
            R(ex + hx, -152 + hy, 8, 7, eye); // 虹彩
            R(ex + 3 + hx, -150 + hy, 3, 4, pupil); // 瞳孔
            R(ex + 1 + hx, -151 + hy, 2, 2, '#ffffff'); // ハイライト
            R(ex + 1 + hx, -145 + hy, 6, 1, lash); // 下睫
          }
          // 眼鏡なしのときだけ切れ長の上まぶたを足す（眼鏡時は枠が輪郭になる）
          if (!look.glasses) {
            R(-2 + hx, -159 + hy, 12, 2, hd);
            R(10 + hx, -159 + hy, 12, 2, hd);
          }
          break;
        case 'bright':
          for (const ex of [0, 12]) {
            R(ex - 1 + hx, -157 + hy, 10, 3, lash);
            R(ex + hx, -154 + hy, 8, 10, eye);
            R(ex + 2 + hx, -151 + hy, 4, 6, pupil);
            R(ex + 1 + hx, -153 + hy, 3, 3, '#ffffff');
            R(ex + 5 + hx, -147 + hy, 2, 2, '#ffffff');
            R(ex + hx, -144 + hy, 8, 2, lash);
          }
          break;
        case 'calm':
          for (const ex of [1, 13]) {
            R(ex - 2 + hx, -155 + hy, 7, 2, lash);
            R(ex + hx, -153 + hy, 5, 8, eye);
            R(ex + 1 + hx, -150 + hy, 3, 5, pupil);
            R(ex + 1 + hx, -152 + hy, 2, 2, '#ffffff');
            R(ex + hx, -145 + hy, 5, 1, lash);
          }
          break;
        case 'sleepy':
          for (const ex of [1, 13]) {
            R(ex - 2 + hx, -156 + hy, 10, 4, lash); // 重いまぶた
            R(ex + hx, -152 + hy, 6, 5, eye); // 細く開いた目
            R(ex + 2 + hx, -150 + hy, 3, 4, pupil);
            R(ex + hx, -147 + hy, 6, 1, lash);
            R(ex - 1 + hx, -146 + hy, 8, 2, skinD); // 隈
          }
          break;
        case 'tsun':
          // ツンとした流し目：目尻が上がる
          for (const ex of [1, 13]) {
            R(ex - 2 + hx, -157 + hy, 10, 3, lash);
            R(ex + 6 + hx, -159 + hy, 4, 2, lash);
            R(ex + hx, -154 + hy, 6, 7, eye);
            R(ex + 2 + hx, -152 + hy, 3, 4, pupil);
            R(ex + 1 + hx, -153 + hy, 2, 2, '#ffffff');
            R(ex + hx, -147 + hy, 6, 1, lash);
          }
          break;
        default:
          for (const ex of [0, 12]) {
            R(ex - 1 + hx, -156 + hy, 10, 3, lash);
            R(ex + hx, -153 + hy, 8, 9, eye);
            R(ex + 2 + hx, -150 + hy, 4, 6, pupil);
            R(ex + 1 + hx, -152 + hy, 3, 3, '#ffffff');
            R(ex + 5 + hx, -146 + hy, 2, 2, '#ffffff');
            R(ex + hx, -144 + hy, 8, 2, lash);
          }
          break;
      }
    };
    // ── 眉（y-164付近。怒りは内側が下がり、困りは内側が上がる） ──
    const brows = () => {
      const bc = look.brows === 'flat' ? '#3a3430' : hd;
      switch (look.brows) {
        case 'angry':
          R(-3 + hx, -164 + hy, 12, 3, bc);
          R(4 + hx, -161 + hy, 6, 3, bc);
          R(9 + hx, -164 + hy, 12, 3, bc);
          R(9 + hx, -161 + hy, 6, 3, bc);
          break;
        case 'worried':
          R(-3 + hx, -162 + hy, 12, 3, bc);
          R(5 + hx, -165 + hy, 6, 3, bc);
          R(9 + hx, -162 + hy, 12, 3, bc);
          R(9 + hx, -165 + hy, 6, 3, bc);
          break;
        case 'soft':
          R(0 + hx, -163 + hy, 7, 2, bc);
          R(12 + hx, -163 + hy, 7, 2, bc);
          break;
        case 'thick':
          R(-3 + hx, -164 + hy, 12, 4, bc);
          R(9 + hx, -164 + hy, 12, 4, bc);
          break;
        case 'flat':
          R(-3 + hx, -163 + hy, 10, 3, bc);
          R(11 + hx, -163 + hy, 10, 3, bc);
          break;
      }
    };
    // ── 口（通常時だけキャラ別。それ以外は表情が優先） ──
    const mc = '#8a4a4a';
    const deep = '#5a2323';
    const tongue = '#e06a6a';
    const teeth = '#f4f4f8';
    const mouthIdle = () => {
      switch (look.mouthIdle ?? 'flat') {
        case 'smile':
          R(4 + hx, -136 + hy, 3, 3, mc);
          R(7 + hx, -134 + hy, 6, 2, mc);
          R(13 + hx, -136 + hy, 3, 3, mc);
          break;
        case 'grin':
          // 両馬の歯見せ笑い
          R(4 + hx, -138 + hy, 12, 6, deep);
          R(4 + hx, -138 + hy, 12, 3, teeth);
          R(9 + hx, -138 + hy, 2, 3, '#c9c9d4');
          break;
        case 'frown':
          R(8 + hx, -137 + hy, 4, 2, mc);
          R(4 + hx, -135 + hy, 4, 3, mc);
          R(12 + hx, -135 + hy, 4, 3, mc);
          break;
        case 'open':
          R(7 + hx, -138 + hy, 6, 7, deep);
          R(7 + hx, -133 + hy, 6, 3, tongue);
          break;
        case 'gritted':
          // 覚醒三重の食いしばり
          R(4 + hx, -138 + hy, 12, 6, teeth);
          R(4 + hx, -135 + hy, 12, 2, deep);
          R(9 + hx, -138 + hy, 2, 6, '#c9c9d4');
          break;
        default:
          R(7 + hx, -134 + hy, 6, 2, mc);
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
        R(4 + hx, -138 + hy, 12, 9, deep);
        R(4 + hx, -138 + hy, 12, 3, teeth);
        R(5 + hx, -132 + hy, 10, 4, tongue);
        break;
      case 'smile':
        for (const ex of [0, 12]) {
          R(ex + 1 + hx, -152 + hy, 6, 2, lash); // 閉じた笑い目（アーチ）
          R(ex + hx, -150 + hy, 2, 3, lash);
          R(ex + 6 + hx, -150 + hy, 2, 3, lash);
        }
        R(4 + hx, -136 + hy, 3, 3, mc);
        R(7 + hx, -134 + hy, 6, 2, mc);
        R(13 + hx, -136 + hy, 3, 3, mc);
        break;
      case 'closed':
        R(0 + hx, -150 + hy, 8, 3, lash);
        R(12 + hx, -150 + hy, 8, 3, lash);
        if (look.mouthIdle === 'gritted') {
          R(4 + hx, -138 + hy, 12, 6, teeth);
          R(4 + hx, -135 + hy, 12, 2, deep);
        } else mouthIdle();
        break;
      case 'hurt':
        for (const ex of [0, 12]) {
          R(ex + hx, -154 + hy, 3, 3, eye); // ＞＜目
          R(ex + 5 + hx, -154 + hy, 3, 3, eye);
          R(ex + 2 + hx, -151 + hy, 4, 2, eye);
          R(ex + hx, -148 + hy, 3, 3, eye);
          R(ex + 5 + hx, -148 + hy, 3, 3, eye);
        }
        R(7 + hx, -138 + hy, 6, 7, deep);
        R(7 + hx, -133 + hy, 6, 3, tongue);
        break;
      case 'dizzy':
        for (const ex of [0, 12]) {
          R(ex + hx, -154 + hy, 8, 3, eye); // うずまき目
          R(ex + hx, -154 + hy, 3, 8, eye);
          R(ex + 5 + hx, -151 + hy, 3, 6, eye);
          R(ex + 2 + hx, -149 + hy, 4, 3, '#ffffff');
        }
        R(4 + hx, -133 + hy, 3, 2, mc); // 波口
        R(7 + hx, -135 + hy, 3, 2, mc);
        R(10 + hx, -133 + hy, 3, 2, mc);
        R(13 + hx, -135 + hy, 3, 2, mc);
        break;
    }
    R(9 + hx, -142 + hy, 3, 3, skinD); // 鼻（小さな影）
    if (look.blush) {
      R(-10 + hx, -142 + hy, 8, 5, '#e89b9f');
      R(-10 + hx, -142 + hy, 8, 2, '#f6c0c2');
      R(19 + hx, -142 + hy, 5, 5, '#e89b9f');
    }
    if (look.stubble) {
      // 顎の無精ひげ＋もみあげ
      for (let i = 0; i < 12; i++) R(-18 + i * 3 + hx, -128 + hy, 2, 2, skinD);
      for (let i = 0; i < 6; i++) R(-15 + i * 6 + hx, -132 + hy, 2, 2, skinD);
      R(-24 + hx, -152 + hy, 4, 12, hd);
    }
    if (look.sweat && P.face !== 'smile' && P.face !== 'shout') {
      // こめかみの汗（緊張）。垂れて落ちる。
      const drip = (Math.floor(o.t / 20) % 3) * 4;
      R(22 + hx, -156 + hy + drip, 4, 8, '#a8dcff');
      R(20 + hx, -150 + hy + drip, 8, 6, '#a8dcff');
      R(22 + hx, -156 + hy + drip, 4, 3, '#e6f6ff');
    }
    if (look.glasses) {
      // 細枠メガネ。rect=上枠＋下隅のみのリムレス風。round=丸メガネ全周枠。
      const g = look.glassesColor ?? '#2a2a30';
      const isRound = look.glassesStyle === 'round';
      const lens = (ex: number, ey: number, w: number) => {
        if (isRound) {
          R(ex - 4 + hx, ey - 8 + hy, 4, 4, g);
          R(ex + hx, ey - 4 + hy, w, 3, g);
          R(ex + w + hx, ey - 8 + hy, 4, 4, g);
          R(ex - 4 + hx, ey - 4 + hy, 4, 12, g);
          R(ex + w + hx, ey - 4 + hy, 4, 12, g);
          R(ex + hx, ey + 8 + hy, w, 3, g);
        } else {
          R(ex - 4 + hx, ey - 4 + hy, w + 8, 3, g);
          R(ex - 4 + hx, ey + 8 + hy, 4, 4, g);
          R(ex + w + hx, ey + 8 + hy, 4, 4, g);
        }
      };
      if (eyeStyle === 'calm') {
        lens(4, -152, 4);
        lens(12, -152, 4);
        R(-24 + hx, -152 + hy, 24, 4, g); // テンプル
      } else {
        lens(0, -152, 8);
        lens(12, -152, 8);
        if (isRound) R(-20 + hx, -156 + hy, 16, 4, g);
        else R(-24 + hx, -152 + hy, 24, 4, g);
      }
      R(8 + hx, -152 + hy, 4, 4, g); // ブリッジ
    }
    // ── 髪 ──
    R(-28 + hx, -180 + hy, 56, 20, hc); // 頭頂
    R(16 + hx, -180 + hy, 12, 20, hd); // 右の影
    R(-20 + hx, -180 + hy, 32, 5, hl); // 頭頂の照り
    switch (look.hair) {
      case 'short':
        // きっちりした短髪（三重・覚醒・倉石）。揃った前髪。
        R(-28 + hx, -160 + hy, 8, 20, hc);
        R(20 + hx, -160 + hy, 4, 8, hc);
        R(-24 + hx, -144 + hy, 4, 8, hd); // もみあげ
        R(-16 + hx, -160 + hy, 28, 4, hc);
        R(-12 + hx, -156 + hy, 4, 4, hc);
        R(0 + hx, -156 + hy, 4, 4, hc);
        R(12 + hx, -156 + hy, 4, 4, hc);
        R(-28 + hx, -140 + hy, 8, 8, hd); // 襟足
        R(-16 + hx, -172 + hy, 20, 4, hl); // 分け目の照り
        break;
      case 'spiky':
        // 逆立てた赤茶ツンツン（両馬）。前に流れる。
        R(-24 + hx, -188 + hy, 12, 8, hc);
        R(-8 + hx, -192 + hy, 12, 12, hc);
        R(8 + hx, -188 + hy, 12, 8, hc);
        R(20 + hx, -184 + hy, 8, 8, hc);
        R(-32 + hx, -176 + hy, 8, 8, hc);
        R(20 + hx, -172 + hy, 12, 8, hc);
        R(-24 + hx, -188 + hy, 12, 3, hl); // 棘先の照り
        R(-8 + hx, -192 + hy, 12, 3, hl);
        R(8 + hx, -188 + hy, 12, 3, hl);
        R(-16 + hx, -184 + hy, 4, 4, hd);
        R(4 + hx, -184 + hy, 4, 4, hd);
        R(-28 + hx, -160 + hy, 8, 16, hc);
        R(20 + hx, -164 + hy, 8, 12, hc);
        R(-4 + hx, -160 + hy, 16, 4, hc); // 短い前髪
        R(8 + hx, -156 + hy, 4, 4, hc);
        break;
      case 'long':
        // 姫カット＋腰までのストレート（内藤）。毛先が揺れる。
        R(-16 + hx, -160 + hy, 28, 4, hc);
        R(-12 + hx, -156 + hy, 4, 4, hc);
        R(0 + hx, -156 + hy, 4, 4, hc);
        R(12 + hx, -156 + hy, 4, 4, hc);
        R(-32 + hx, -160 + hy, 8, 32, hc); // サイド
        R(20 + hx, -160 + hy, 8, 24, hc);
        R(20 + hx, -144 + hy, 8, 36, hc); // 肩にかかる前髪
        R(20 + hx, -144 + hy, 3, 36, hd);
        R(-36 + hx, -160 + hy, 12, 80, hc); // 背中の髪
        R(-40 + hx, -136 + hy, 4, 48, hc);
        R(-36 + hx, -160 + hy, 4, 80, hd); // 影
        R(-31 + hx, -152 + hy, 3, 56, hl); // 艶
        R(-36 + sway + hx, -80 + hy, 12, 20, hc); // 揺れる毛先
        R(-32 + sway + hx, -64 + hy, 4, 4, hc);
        break;
      case 'bob':
        // 顎までの丸いボブ（三峰）。丸いシルエット。
        R(-32 + hx, -172 + hy, 8, 12, hc);
        R(24 + hx, -172 + hy, 8, 8, hc);
        R(-12 + hx, -160 + hy, 24, 4, hc);
        R(-8 + hx, -156 + hy, 4, 4, hc);
        R(4 + hx, -156 + hy, 4, 4, hc);
        R(-32 + hx, -160 + hy, 8, 36, hc);
        R(24 + hx, -160 + hy, 8, 32, hc);
        R(-28 + hx, -128 + hy, 8, 8, hc); // 丸い裾
        R(20 + hx, -128 + hy, 8, 8, hc);
        R(-32 + hx, -160 + hy, 4, 36, hd);
        R(-18 + hx, -174 + hy, 16, 5, hl); // ボブの照り
        R(20 + hx, -136 + hy, 4, 8, hd); // 内巻きの影
        break;
      case 'straight':
        // 額を覆うストレート＋少し長いサイド（寺地）。眉は隠れる。
        R(-32 + hx, -176 + hy, 8, 8, hc);
        R(24 + hx, -176 + hy, 8, 4, hc);
        R(-20 + hx, -160 + hy, 40, 8, hc); // 厚い前髪
        R(-16 + hx, -152 + hy, 4, 4, hc);
        R(-4 + hx, -152 + hy, 4, 4, hc);
        R(8 + hx, -152 + hy, 4, 4, hc);
        R(0 + hx, -152 + hy, 4, 6, hc); // 目にかかる束
        R(12 + hx, -152 + hy, 4, 4, hc);
        R(-28 + hx, -160 + hy, 8, 28, hc);
        R(20 + hx, -160 + hy, 8, 24, hc);
        R(-28 + hx, -136 + hy, 8, 12, hd);
        R(-12 + hx, -180 + hy, 4, 4, hd);
        R(8 + hx, -176 + hy, 4, 4, hd);
        R(-14 + hx, -172 + hy, 14, 4, hl);
        break;
      case 'messy':
        R(-32 + hx, -176 + hy, 8, 8, hc);
        R(-16 + hx, -188 + hy, 8, 8, hc);
        R(0 + hx, -184 + hy, 8, 4, hc);
        R(12 + hx, -188 + hy, 8, 8, hc);
        R(24 + hx, -180 + hy, 8, 4, hc);
        R(-28 + hx, -160 + hy, 8, 20, hc);
        R(-4 + hx, -160 + hy, 8, 4, hc);
        R(8 + hx, -160 + hy, 4, 8, hc);
        R(16 + hx, -160 + hy, 8, 4, hc);
        R(-12 + hx, -176 + hy, 12, 4, hl);
        break;
      case 'messyAhoge':
        // 荒っぽい束感＋アホ毛（数理零）。目に前髪がかかる。
        R(-32 + hx, -176 + hy, 8, 12, hc);
        R(-20 + hx, -188 + hy, 8, 8, hc);
        R(-4 + hx, -192 + hy, 8, 12, hc);
        R(12 + hx, -188 + hy, 8, 8, hc);
        R(24 + hx, -180 + hy, 8, 8, hc);
        R(-28 + hx, -160 + hy, 8, 16, hc);
        R(20 + hx, -160 + hy, 8, 12, hc);
        R(-8 + hx, -160 + hy, 8, 4, hc);
        R(8 + hx, -160 + hy, 4, 8, hc);
        R(16 + hx, -160 + hy, 8, 4, hc);
        // 目にかかる束（気だるげな目つきの正体）。目の上半分を覆う。
        R(0 + hx, -156 + hy, 4, 8, hc);
        R(12 + hx, -156 + hy, 4, 8, hc);
        R(-8 + hx, -156 + hy, 4, 4, hc);
        R(4 + hx, -160 + hy, 4, 4, hc);
        R(16 + hx, -156 + hy, 4, 5, hc);
        R(-16 + hx, -180 + hy, 4, 4, hd);
        R(8 + hx, -180 + hy, 4, 4, hd);
        // 跳ねたアホ毛
        R(0 + hx, -200 + hy, 4, 8, hc);
        R(4 + hx, -204 + hy, 8, 4, hc);
        R(8 + hx, -200 + hy, 4, 4, hc);
        break;
      case 'adult':
        // 分け目のあるミディアム＋ゆるいウェーブ（塀）。耳を覆う。
        R(-32 + hx, -176 + hy, 12, 24, hc);
        R(20 + hx, -176 + hy, 12, 16, hc);
        R(-16 + hx, -160 + hy, 20, 4, hc); // 流した前髪
        R(12 + hx, -160 + hy, 4, 12, hc);
        R(-32 + hx, -160 + hy, 8, 32, hc);
        R(24 + hx, -160 + hy, 8, 28, hc);
        R(-36 + sway + hx, -136 + hy, 8, 16, hc); // 揺れる裾
        R(-28 + hx, -136 + hy, 8, 20, hd);
        R(-24 + hx, -148 + hy, 3, 16, hl); // ウェーブの照り
        R(-8 + hx, -180 + hy, 8, 4, '#8a8078'); // 灰色の筋
        R(12 + hx, -176 + hy, 4, 4, '#8a8078');
        break;
      case 'fluffy': {
        // ふわっとした量の多い茶髪（櫻）。長めの前髪と丸い輪郭。
        R(-32 + hx, -176 + hy, 12, 24, hc);
        R(24 + hx, -176 + hy, 8, 20, hc);
        R(-24 + hx, -188 + hy, 12, 8, hc);
        R(-8 + hx, -192 + hy, 12, 12, hc);
        R(8 + hx, -188 + hy, 12, 8, hc);
        R(20 + hx, -184 + hy, 8, 4, hc);
        R(-16 + hx, -160 + hy, 12, 8, hc);
        R(0 + hx, -160 + hy, 8, 8, hc);
        R(12 + hx, -160 + hy, 8, 12, hc);
        R(-32 + hx, -160 + hy, 12, 36, hc);
        R(-28 + hx, -128 + hy, 8, 8, hc);
        R(-12 + hx, -180 + hy, 4, 4, hd);
        R(4 + hx, -176 + hy, 4, 4, hd);
        R(16 + hx, -180 + hy, 4, 4, hd);
        R(-24 + hx, -168 + hy, 4, 12, hd);
        R(-16 + hx, -184 + hy, 16, 5, hl); // ふわ髪の照り
        break;
      }
    }
    if (look.accessory === 'headphones') {
      // 首にかけたヘッドホン（寺地）。後ろのバンド＋両耳の下のカップ。
      R(-28 + hx, -128 + hy, 56, 8, '#2b2b32');
      R(-20 + hx, -128 + hy, 40, 3, '#3a3a44');
      R(-36 + hx, -140 + hy, 12, 24, '#1c1c22');
      R(24 + hx, -140 + hy, 12, 24, '#1c1c22');
      R(-36 + hx, -136 + hy, 4, 16, '#3a3a44');
      R(32 + hx, -136 + hy, 4, 16, '#3a3a44');
      R(-32 + hx, -132 + hy, 4, 8, '#5c5c6a');
      R(28 + hx, -132 + hy, 4, 8, '#5c5c6a');
      R(-34 + hx, -138 + hy, 3, 3, '#6a6a78'); // カップの照り
      R(26 + hx, -138 + hy, 3, 3, '#6a6a78');
    }
  };

  /** 白い鉢巻と後ろの結び目。動くと二本の端がなびく。 */
  const headband = () => {
    if (!isGym) return;
    const flap = o.pose === 'idle' || o.pose === 'win' ? 0 : (Math.floor(o.t / 4) % 3) * 4;
    R(-28 + ln, -172 + dy, 56, 12, '#f7f7fc');
    R(-28 + ln, -172 + dy, 56, 3, '#ffffff');
    R(-28 + ln, -164 + dy, 56, 4, '#dedbe5');
    R(-12 + ln, -180 + dy, 8, 8, '#79564b'); // 前髪のハイライト
    R(12 + ln, -180 + dy, 4, 20, hc);
    R(-16 + ln, -164 + dy, 8, 4, hc); // 鉢巻にかかる前髪
    R(4 + ln, -164 + dy, 4, 4, hc);
    // 後ろのリボン結び＋なびく端
    R(-40 + ln, -172 + dy, 16, 16, '#f7f7fc');
    R(-36 + ln, -168 + dy, 8, 8, '#dedbe5');
    R(-48 + ln - flap, -164 + dy, 16, 12, '#e9e9f1');
    R(-56 + ln - flap, -160 + dy, 12, 8, '#f7f7fc');
    R(-52 + ln - flap, -160 + dy, 3, 8, '#dedbe5');
    R(-40 + ln, -156 + dy, 12, 20, '#f7f7fc');
    R(-44 + ln - flap, -140 + dy, 12, 16, '#e9e9f1');
    R(-48 + ln - flap, -128 + dy, 12, 8, '#f7f7fc');
  };

  /** 工事ヘルメット。緑のライン＋安全第一の十字。 */
  const helmet = () => {
    if (outfit !== 'kensetsu') return;
    const hx = ln;
    const hy = dy;
    R(-28 + hx, -184 + hy, 56, 12, '#facc15');
    R(-28 + hx, -184 + hy, 8, 12, '#e0a800'); // 左の丸み
    R(20 + hx, -184 + hy, 8, 12, '#e0a800');
    R(-24 + hx, -188 + hy, 48, 4, '#fde047');
    R(-20 + hx, -192 + hy, 12, 4, '#fde047');
    R(-8 + hx, -196 + hy, 16, 4, '#fdd835'); // 頭頂
    R(-4 + hx, -196 + hy, 4, 12, '#e0a800'); // 中央リブ
    R(-28 + hx, -176 + hy, 56, 4, '#2f9e44'); // 緑ライン
    R(-28 + hx, -172 + hy, 56, 8, '#e0a800');
    R(-28 + hx, -172 + hy, 56, 4, '#f6d030');
    R(20 + hx, -172 + hy, 16, 4, '#c78a00'); // 前面のツバ
    R(20 + hx, -168 + hy, 8, 4, '#e0a800');
    // 前面の緑十字
    R(8 + hx, -184 + hy, 4, 12, '#2f9e44');
    R(4 + hx, -180 + hy, 12, 4, '#2f9e44');
    R(-4 + hx, -164 + hy, 8, 4, look.hairColor); // 額の毛
  };

  const weapon = () => {
    // 覚醒三重は振り回す瞬間と吹き飛ばされているとき以外、常にハンマーを持つ
    const dropped = o.pose === 'hurt' || o.pose === 'launch' || o.pose === 'grabbed';
    const showIdleHammer = isWork && !P.weapon && !P.lying && !dropped;
    if (!P.weapon && !showIdleHammer) {
      // 素手の打撃にも小さな風切りを添える
      if ((o.pose === 'jab' || o.pose === 'penJab') && (o.phase ?? 0) === 1 && look.weapon === 'none') {
        R(hand.x + 12, hand.y - 4, 8, 4, '#e8ecf0');
        R(hand.x + 16, hand.y + 4, 8, 4, '#e8ecf0');
      }
      return;
    }
    const hx = hand.x;
    const hy = hand.y;
    // 振り抜きの斬撃線
    if (!showIdleHammer && (o.pose === 'swing' || o.pose === 'lash') && (o.phase ?? 0) === 1) {
      R(hx + 12, hy - 28, 4, 12, '#e8ecf0');
      R(hx + 16, hy - 16, 4, 12, '#e8ecf0');
      R(hx + 16, hy - 4, 4, 8, '#e8ecf0');
    }
    switch (look.weapon) {
      case 'bowl': {
        // 二郎系ラーメン（湯気つき）
        R(hx - 16, hy - 20, 4, 8, '#d8d8d8'); // 割り箸
        R(hx + 24, hy - 20, 4, 8, '#d8d8d8');
        R(hx - 4, hy - 30, 3, 12, '#dfe5ea'); // 湯気
        R(hx + 8, hy - 32, 3, 14, '#dfe5ea');
        R(hx - 12, hy - 4, 36, 20, '#f4f0e8');
        R(hx - 12, hy - 4, 36, 4, '#c0392b');
        R(hx - 12, hy - 4, 36, 2, '#ffffff');
        R(hx - 12, hy + 8, 36, 8, '#d8cfc0');
        R(hx - 8, hy - 12, 28, 8, '#e8c46a'); // 麺
        R(hx - 8, hy - 12, 28, 3, '#d8a84e');
        R(hx - 8, hy - 16, 6, 6, '#1c2a1c'); // 海苔
        R(hx - 2, hy - 14, 8, 6, '#ffffff'); // なると
        R(hx, hy - 12, 4, 3, '#f06080');
        R(hx + 8, hy - 14, 8, 6, '#8a5a3a'); // チャーシュー
        R(hx + 10, hy - 12, 4, 3, '#a06a4a');
        R(hx + 2, hy + 16, 12, 6, '#c0392b'); // 高台
        break;
      }
      case 'book':
        R(hx - 8, hy - 28, 24, 32, '#e9dfcc');
        R(hx - 8, hy - 28, 4, 32, '#7a5a3a');
        R(hx + 12, hy - 28, 4, 32, '#f4efe0'); // 小口
        R(hx, hy - 20, 8, 12, '#8fa3c8');
        R(hx + 2, hy - 16, 4, 4, '#e9dfcc');
        R(hx - 4, hy - 12, 12, 3, '#7a5a3a'); // 題字
        break;
      case 'binder':
        R(hx - 4, hy - 36, 28, 40, '#f4f4f8');
        R(hx - 4, hy - 36, 28, 4, '#2c4a8a');
        R(hx - 4, hy - 28, 6, 6, '#888888'); // リング
        R(hx - 4, hy - 12, 6, 6, '#888888');
        R(hx + 4, hy - 24, 12, 4, '#333333');
        R(hx + 4, hy - 16, 12, 4, '#333333');
        R(hx + 4, hy - 8, 12, 4, '#c0392b');
        break;
      case 'paper':
        R(hx - 4, hy - 24, 32, 28, '#ffffff');
        R(hx, hy - 20, 24, 4, '#99a0aa');
        R(hx, hy - 12, 24, 4, '#99a0aa');
        R(hx, hy - 4, 16, 4, '#99a0aa');
        R(hx, hy - 20, 4, 4, '#c0392b');
        break;
      case 'python':
        for (let i = 0; i < 11; i++) {
          const wy = Math.round(Math.sin(i * 1.1 + o.t * 0.6) * 6);
          R(hx + 12 + i * 8, hy + wy, 8, 8, i % 2 ? '#3776ab' : '#ffd43b');
          R(hx + 12 + i * 8, hy + wy + 6, 8, 2, i % 2 ? '#2a5a88' : '#d8a800');
        }
        R(hx + 100, hy - 4, 12, 12, '#3776ab');
        R(hx + 100, hy - 4, 4, 4, '#ffd43b');
        R(hx + 106, hy - 4, 4, 4, '#ffd43b');
        R(hx + 110, hy + 2, 6, 3, '#c0392b'); // 舌
        break;
      case 'lovenote':
        // ピンクの研究ノート（振り回す）
        R(hx - 4, hy - 36, 28, 40, '#f3b3c6');
        R(hx - 4, hy - 36, 4, 40, '#c9748f');
        R(hx + 4, hy - 28, 16, 4, '#fde2ea');
        R(hx + 4, hy - 20, 12, 4, '#a34d6b');
        R(hx + 4, hy - 12, 16, 4, '#a34d6b');
        R(hx + 10, hy - 8, 4, 3, '#e879f9');
        R(hx + 16, hy - 8, 4, 3, '#e879f9');
        R(hx + 10, hy - 5, 10, 4, '#e879f9');
        R(hx + 12, hy - 1, 6, 3, '#e879f9');
        break;
      case 'hammer': {
        if (showIdleHammer) {
          // 待機中は柄を下に、頭を地面すれすれで持つ
          R(hx, hy + 8, 12, 40, '#9c6a34');
          R(hx, hy + 8, 4, 40, '#b98a4e');
          R(hx, hy + 32, 12, 4, '#4a3518'); // グリップ
          R(hx - 16, hy + 48, 44, 20, '#565b63');
          R(hx - 16, hy + 48, 44, 4, '#a7adb8');
          R(hx - 20, hy + 44, 8, 24, '#3a3f46');
          R(hx + 20, hy + 44, 8, 24, '#3a3f46');
          break;
        }
        // 大ハンマー（解体用）── 手から真下に柄、その先に金属の頭
        R(hx - 4, hy + 4, 12, 64, '#9c6a34');
        R(hx - 4, hy + 4, 4, 64, '#b98a4e');
        R(hx + 4, hy + 12, 4, 48, '#6e4a22');
        R(hx - 4, hy + 68, 12, 8, '#4a3518');
        R(hx - 20, hy - 32, 44, 24, '#a7adb8');
        R(hx - 20, hy - 32, 44, 4, '#d5dae1');
        R(hx - 20, hy - 16, 44, 8, '#565b63');
        R(hx - 24, hy - 36, 8, 28, '#3a3f46');
        R(hx + 16, hy - 36, 8, 28, '#3a3f46');
        R(hx - 16, hy - 32, 12, 8, '#e8ecf0');
        break;
      }
      case 'map':
        // 地形図（折りたたんで持ち、広げて払う）。紙と等高線
        R(hx - 8, hy - 32, 32, 40, '#e6dcc0');
        R(hx - 8, hy - 32, 32, 4, '#c9bd98');
        R(hx - 8, hy - 32, 4, 40, '#c9bd98');
        R(hx + 8, hy - 32, 4, 40, '#c9bd98');
        R(hx - 4, hy - 20, 24, 4, '#7a9a6a');
        R(hx - 4, hy - 8, 24, 4, '#7a9a6a');
        R(hx + 4, hy - 20, 4, 8, '#5a7a4a');
        R(hx + 6, hy - 24, 4, 4, '#8a6a4a');
        R(hx - 4, hy + 0, 20, 3, '#7ab3d4');
        break;
    }
  };

  const pen = () => {
    if (!P.pen) return;
    const hx = hand.x;
    const hy = hand.y;
    // シャーペン（前手から前方へ）
    R(hx + 12, hy + 4, 24, 4, '#1f2937');
    R(hx + 12, hy + 4, 8, 4, '#e5e7eb');
    R(hx + 20, hy + 4, 3, 4, '#6b7280'); // グリップ
    R(hx + 25, hy + 4, 3, 4, '#6b7280');
    R(hx + 36, hy + 4, 4, 4, '#9ca3af');
  };

  const openNote = () => {
    if (!P.openNote) return;
    // 胸の前で開いた研究ノート（見開き）
    R(-28 + ln, -120 + dy, 56, 36, '#fde2ea');
    R(-28 + ln, -120 + dy, 56, 4, '#f8c8da');
    R(0 + ln, -120 + dy, 4, 36, '#c9748f');
    R(-20 + ln, -112 + dy, 16, 4, '#a34d6b');
    R(-20 + ln, -104 + dy, 12, 4, '#a34d6b');
    R(-20 + ln, -96 + dy, 16, 4, '#a34d6b');
    R(8 + ln, -112 + dy, 16, 4, '#a34d6b');
    R(8 + ln, -104 + dy, 16, 4, '#e879f9');
    R(8 + ln, -96 + dy, 8, 4, '#a34d6b');
    R(20 + ln, -96 + dy, 4, 3, '#e879f9');
    R(26 + ln, -96 + dy, 4, 3, '#e879f9');
    R(20 + ln, -93 + dy, 10, 4, '#e879f9');
    R(22 + ln, -89 + dy, 6, 3, '#e879f9');
  };

  const paper = () => {
    if (!P.paper) return;
    const hx = hand.x;
    const hy = hand.y;
    R(hx - 16, hy - 52, 52, 48, '#ffffff');
    R(hx - 16, hy - 52, 52, 6, '#2c4a8a'); // タイトル帯
    R(hx - 12, hy - 44, 40, 4, '#333333');
    R(hx - 12, hy - 36, 32, 4, '#333333');
    R(hx - 12, hy - 28, 40, 4, '#333333');
    R(hx - 12, hy - 20, 24, 4, '#333333');
    R(hx + 24, hy - 16, 10, 10, '#c0392b'); // ハンコ
    R(hx + 26, hy - 14, 6, 6, '#ffffff');
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
  const w = Math.max(24, 64 - airHeight * 0.15);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(Math.round(x - w / 2), y - 4, Math.round(w), 8);
}
