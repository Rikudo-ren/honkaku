export type CharId = 'mie' | 'ryoma' | 'naito' | 'mitsumine' | 'terachi' | 'rei' | 'sakura';
export type Side = 0 | 1;
/** チーム戦のチーム（0=青、1=赤）。Side と同じ 0|1。 */
export type Team = 0 | 1;
export type Facing = 1 | -1;
export type StageId = 'classroom' | 'lake' | 'sakura' | 'hawaii';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'extreme';
export type Mode = '1p' | '2p' | 'cpu' | 'online' | 'team';

/** 同時乱戦チームバトルに参加できる最大ファイター数（人間＋AIの合計） */
export const MAX_FIGHTERS = 8;
/** 1部屋に入れる最大人数（人間プレイヤー） */
export const MAX_HUMANS = 8;

export const TEAM_NAMES: Record<Team, string> = { 0: '青チーム', 1: '赤チーム' };
export const TEAM_COLORS: Record<Team, string> = { 0: '#38bdf8', 1: '#fb7185' };

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
  | 'qed'
  | 'note';

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
  /** 隠しキャラクター（解放条件を満たすまで選択不可） */
  hidden?: boolean;
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

/** チーム戦（同時乱戦）1人分の設定 */
export interface FighterSetup {
  char: CharId;
  team: Team;
  /** true=CPU操作、false=人間操作 */
  ai: boolean;
  /** AIの強さ（ai=true のとき使用。未指定なら Setup.difficulty） */
  aiDifficulty?: Difficulty;
  /** ローカルチーム戦で人間が操作するパッド（0=P1キー、1=P2キー）。AIのときは null */
  pad?: 0 | 1 | null;
  /** 頭上に表示するタグ（'1P' / 'あなた' / 'CPU' / オンラインのプレイヤー名 など） */
  tag?: string;
  /** 自分が操作するファイターか（表示色の切り替え用。オンライン対戦で使用） */
  you?: boolean;
}

export interface Setup {
  mode: Mode;
  difficulty: Difficulty;
  p1: CharId;
  p2: CharId;
  stage: StageId;
  /** オンライン対戦：試合の決定論シード */
  seed?: number;
  /** オンライン対戦：試合ID（旧試合の遅延メッセージ混入防止に使う） */
  onlineMatchId?: number;
  /** オンライン対戦：ロックステップの固定入力遅延フレーム数 */
  netInputDelay?: number;
  /** オンライン対戦：自分がどちら側か（1対1用） */
  onlineSide?: Side;
  /** チーム戦（同時乱戦）かどうか */
  teamMode?: boolean;
  /** チーム戦の全ファイター設定（teamMode のとき必須） */
  fighters?: FighterSetup[];
  /** オンラインチーム戦：自分が操作するファイターのインデックス */
  mySlot?: number;
  /** オンライン対戦：各スロットのプレイヤー名（AIスロットは null） */
  onlineNames?: (string | null)[];
}
