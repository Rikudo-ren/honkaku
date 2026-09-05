export type CharId = 'mie' | 'ryoma' | 'naito' | 'mitsumine' | 'terachi' | 'rei';
export type Side = 0 | 1;
export type Facing = 1 | -1;
export type StageId = 'classroom' | 'lake' | 'sakura' | 'hawaii';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'extreme';
export type Mode = '1p' | '2p' | 'cpu' | 'online';

export interface InputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  light: boolean;
  heavy: boolean;
  special: boolean;
  super: boolean;
}

export const EMPTY_INPUT: InputState = {
  left: false,
  right: false,
  up: false,
  down: false,
  light: false,
  heavy: false,
  special: false,
  super: false,
};

export type PoseId =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'crouch'
  | 'block'
  | 'jab'
  | 'swing'
  | 'kick'
  | 'lash'
  | 'throw'
  | 'counter'
  | 'point'
  | 'pointUp'
  | 'hurt'
  | 'launch'
  | 'down'
  | 'getup'
  | 'win'
  | 'lose'
  | 'stun'
  | 'frozen'
  | 'spread'
  | 'grab'
  | 'grabbed'
  | 'paper';

export type HairStyle = 'short' | 'spiky' | 'long' | 'bob' | 'messy' | 'messyAhoge' | 'adult';

export interface Look {
  hair: HairStyle;
  hairColor: string;
  hairDark?: string;
  skin?: string;
  skinDark?: string;
  eyeColor: string;
  glasses?: boolean;
  gender: 'm' | 'f';
  outfit: 'blazer' | 'vest' | 'suit';
  accessory?: 'headphones' | 'bookFront' | 'bookSide' | 'notebook' | 'map';
  weapon?: 'bowl' | 'book' | 'binder' | 'paper' | 'python' | 'none';
  winPose?: 'cheer' | 'cool' | 'shy' | 'peace' | 'hug';
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type MoveKind = 'melee' | 'projectile' | 'counter' | 'teleport';
export type ProjKind =
  | 'cross'
  | 'eraser'
  | 'cat'
  | 'star'
  | 'formula'
  | 'kusa'
  | 'basketball'
  | 'soup'
  | 'mikan'
  | 'vending'
  | 'kuraishi'
  | 'qed';

export interface ProjectileSpec {
  kind: ProjKind;
  vx?: number;
  vy?: number;
  fromTop?: boolean;
  ground?: boolean;
  life: number;
  grav?: number;
  w?: number;
  h?: number;
}

export type SfxName =
  | 'hit'
  | 'heavy'
  | 'guard'
  | 'special'
  | 'super'
  | 'ko'
  | 'jump'
  | 'select'
  | 'move'
  | 'ha'
  | 'item'
  | 'event'
  | 'swing'
  | 'confirm'
  | 'back'
  | 'round'
  | 'cross'
  | 'heal'
  | 'land';

export interface MoveDef {
  key: 'light' | 'heavy' | 'special';
  name: string;
  desc?: string;
  callout?: string[];
  startup: number;
  active: number;
  recovery: number;
  dmg: number;
  hitstun: number;
  kbx: number;
  kby: number;
  box?: Box;
  knockdown?: boolean;
  moveX?: number;
  kind: MoveKind;
  pose: PoseId;
  sfx: SfxName;
  projectile?: ProjectileSpec;
  cooldown?: number;
}

export interface CharDef {
  id: CharId;
  name: string;
  kana: string;
  title: string;
  affiliation: string;
  tie: string;
  tieColor: string;
  color: string;
  light: string;
  hp: number;
  speed: number;
  jump: number;
  dmgMul: number;
  look: Look;
  moves: { light: MoveDef; heavy: MoveDef; special: MoveDef };
  superName: string;
  superQuote: string;
  superDesc: string;
  intro: string;
  wins: string[];
  blockText: string;
  koText: string;
  stats: { power: number; speed: number; honshitsu: number; joushiki: number };
  desc: string;
}

export interface StageDef {
  id: StageId;
  name: string;
  sub: string;
}

export interface Setup {
  mode: Mode;
  difficulty: Difficulty;
  p1: CharId;
  p2: CharId;
  stage: StageId;
  /** オンライン対戦：試合の決定論シード */
  seed?: number;
  /** オンライン対戦：自分がどちら側か */
  onlineSide?: Side;
}
