import type { CharDef, CharId, Difficulty, Look, Setup, Side, StageDef, Team } from './types';

/** 通常ロスター（最初から選べる6人） */
export const CHAR_ORDER: CharId[] = ['mie', 'ryoma', 'naito', 'mitsumine', 'terachi', 'rei'];
// ═══════════════════════════════════════════════════════════════════════
//  隠しキャラ（解禁でロスターに追加される）の定義
//  新しい隠しキャラを増やす手順（3ステップ）:
//    1. types.ts の CharId に id を追加する
//    2. このファイルの CHARS にキャラ定義を1つ足す
//    3. HIDDEN_CHARS 配列に id を加え、HIDDEN_META に解禁条件・演出用文言を1項目足す
//  ロスター・解禁判定・解禁演出・??の枠・ヒントは全てここから自動で作られる。
// ═══════════════════════════════════════════════════════════════════════

/** 隠しキャラクター（解禁で選択可能になる）。並び順＝解禁後にロスター末尾へ付く順番 */
export const HIDDEN_CHARS: CharId[] = ['sakura', 'kakusei'];
/** 隠しキャラ込みの全ロスター */
export const ALL_CHARS: CharId[] = [...CHAR_ORDER, ...HIDDEN_CHARS];

/** 解禁状況：隠しキャラの id → true（未解禁は undefined） */
export type HiddenUnlocks = Partial<Record<CharId, boolean>>;
/** 未解禁（空）の状態 */
export const NO_HIDDEN: HiddenUnlocks = {};

export const isHiddenChar = (id: CharId): boolean => HIDDEN_CHARS.includes(id);

/** 解禁状況に応じたロスター（先頭は常に通常6人、解禁済みの隠しキャラが順に続く） */
export function rosterFor(u: HiddenUnlocks = {}): CharId[] {
  return [...CHAR_ORDER, ...HIDDEN_CHARS.filter((h) => u[h])];
}

/** まだ解禁していない隠しキャラ（キャラ選択の「？？？」枠に出す） */
export function lockedHidden(u: HiddenUnlocks = {}): CharId[] {
  return HIDDEN_CHARS.filter((h) => !u[h]);
}

/** 乱戦（チーム戦）の初期編成スロット。操作は 1P だけ（2P は画面のボタンで割り当てる）。 */
export type TeamSlotCtrl = 'p1' | 'cpu';

/** 乱戦のはじめの編成：1P 1人 vs CPU 多数。このゲームの基本形は「1人と大勢のAI」。 */
export const DEFAULT_TEAM_SLOTS: { char: CharId; team: Team; ctrl: TeamSlotCtrl }[] = [
  { char: 'mie', team: 0, ctrl: 'p1' },
  { char: 'ryoma', team: 1, ctrl: 'cpu' },
  { char: 'naito', team: 1, ctrl: 'cpu' },
  { char: 'mitsumine', team: 1, ctrl: 'cpu' },
];

/** 1キャラ分の「隠しキャラ」メタ情報。解禁条件と、解禁演出・??????の枠・バナーで使う文言をここに集約する。 */
export interface HiddenMeta {
  /** CHARS のキーと同一 */
  id: CharId;
  /** localStorage の解禁フラグキー */
  key: string;
  /** 演出の主色（枠・発光・ラベルに使う） */
  accent: string;
  /** 「？？？」枠や演出で出す見出し（未解禁時は「？？？」） */
  title: string;
  /** 「？？？」枠の2行目（伏せ文字） */
  sub: string;
  /** 「？？？」枠にだけ出すヒント（※タイトル等には出さない） */
  hint: string;
  /** 操作説明などで出す、はっきりした条件 */
  condition: string;
  /** 「？？？」枠の左帯色 */
  stripe: string;
  /** 解禁演出：胸に刺さる一言 */
  quote: string;
  /** 解禁演出：その下の解説 */
  byline: string;
  /** 解禁演出：技の紹介 */
  kit: string;
  /** リザルトの予告バナー見出し */
  bannerTitle: string;
  /** リザルトの予告バナー本文 */
  bannerText: string;
  /** この試合結果が解禁条件を満たすか */
  isUnlock: (setup: Setup, winner: Side) => boolean;
}

export const HIDDEN_META: HiddenMeta[] = [
  {
    id: 'sakura',
    key: 'honkaku_sakura_unlocked',
    accent: '#e879f9',
    title: '？？？',
    sub: '紺のネクタイが、もう一人。',
    hint: 'ヒント：微笑む観測者を、最高偏差値で観測せよ。',
    condition: '1P対CPU・偏差値100の内藤蘭に勝利すると解禁',
    stripe: '#2f4f8f',
    quote: '「両馬先輩。報告があります。私は恋をしました」',
    byline: '── 微笑む観測者を最高偏差値で観測した者の前に、紺のネクタイがもう一人現れた。',
    kit: '必殺「シュレディンガーの好意」で未観測の♡？を置き、超必殺「実存的崩壊」で告白＝観測。被弾・ガードで研究データ n が溜まるほど重くなる。',
    bannerTitle: '紺のネクタイが、もう一人来た。',
    bannerText: '微笑む観測者を最高偏差値で観測した ── タイトルに戻ると報告があります',
    isUnlock: (setup, winner) => winner === 0 && setup.mode === '1p' && setup.difficulty === 'extreme' && setup.p2 === 'naito' && !setup.teamMode,
  },
  {
    id: 'kakusei',
    key: 'honkaku_kakusei_unlocked',
    accent: '#fb923c',
    title: '？？？',
    sub: '道具を持って、葬式へ。',
    hint: 'ヒント：青の一人で、赤の七人を同時に鎮圧せよ（偏差値100）。',
    condition: 'チーム戦で青1人（自分）だけを率い、赤7体（偏差値100のCPU）に勝利すると解禁',
    stripe: '#b45309',
    quote: '「葬式は終わった。何も解決しなかった。だから、こわす」',
    byline: '── 青の一人で赤の七人を鎮圧した者の前に、否定の守護者が壊す側の男として現れた。',
    kit: '強攻撃「解体の一撃」は振りかぶり〜振り抜きが超アーマーで止まらず、飛び道具も叩き落とす。必殺「地面震撃」で地を走る衝撃波を飛ばし、超必殺「葬式は終わった」は各撃の震撃が画面の端まで届く。弱点は空中。飛び越えられると脆い。',
    bannerTitle: '青の一人が、赤の七人を鎮圧した。',
    bannerText: '葬式は終わらない ── タイトルに戻ると、現場から誰かが現れます',
    isUnlock: (setup, winner) => {
      // チーム戦で、青が人間1人だけ・赤が偏差値100のCPUのみ・その青が勝つ
      if (winner !== 0 || !setup.teamMode || setup.mode !== 'team') return false;
      const fs = setup.fighters;
      if (!fs || fs.length < 2) return false;
      const blue = fs.filter((f) => f.team === 0);
      const red = fs.filter((f) => f.team === 1);
      if (blue.filter((f) => !f.ai).length !== 1) return false;
      if (red.length < 7) return false;
      if (red.some((f) => f.ai !== true || f.aiDifficulty !== 'extreme')) return false;
      return true;
    },
  },
];

/** id から隠しキャラのメタ情報を引く */
export const hiddenMeta = (id: CharId): HiddenMeta | undefined => HIDDEN_META.find((m) => m.id === id);

/** 解禁済みの隠しキャラのうち、今回の試合結果で新たに条件を満たしたもの */
export function hiddenCharsSatisfied(u: HiddenUnlocks, setup: Setup, winner: Side): HiddenMeta[] {
  return HIDDEN_META.filter((m) => !u[m.id] && m.isUnlock(setup, winner));
}

const JAB_BOX = { x: 5, y: -32, w: 14, h: 9 };
const SWING_BOX = { x: 3, y: -38, w: 17, h: 18 };

export const CHARS: Record<CharId, CharDef> = {
  mie: {
    id: 'mie',
    name: '三重県臣',
    kana: 'みえ・けんしん',
    title: '否定の守護者',
    affiliation: '理数科B組',
    tie: 'えんじ',
    tieColor: '#a8262e',
    color: '#5aa0e6',
    light: '#dbeafe',
    hp: 100,
    speed: 1.75,
    jump: 6.3,
    dmgMul: 1,
    look: {
      hair: 'short',
      hairColor: '#4a3222',
      hairDark: '#33210f',
      eyeColor: '#3a2a20',
      glasses: true,
      gender: 'm',
      outfit: 'blazer',
      weapon: 'none',
      winPose: 'cool',
    },
    moves: {
      light: {
        key: 'light',
        name: 'やめろ',
        desc: '素早いツッコミ。三年間で四百二十回言った。',
        callout: ['やめろ', '書くな', '日本語やめろ'],
        startup: 4,
        active: 4,
        recovery: 8,
        dmg: 5,
        hitstun: 14,
        kbx: 1.6,
        kby: 0,
        box: JAB_BOX,
        kind: 'melee',
        pose: 'jab',
        sfx: 'hit',
      },
      heavy: {
        key: 'heavy',
        name: 'スティール→速攻→レイアップ',
        desc: '冷笑系のくせに速い。前進しながらの飛び蹴り。ダウンを奪う。',
        callout: ['スティール', 'レイアップ！'],
        startup: 9,
        active: 8,
        recovery: 16,
        dmg: 12,
        hitstun: 24,
        kbx: 3,
        kby: 3.5,
        knockdown: true,
        box: { x: 4, y: -24, w: 17, h: 12 },
        moveX: 3.2,
        kind: 'melee',
        pose: 'kick',
        sfx: 'heavy',
      },
      special: {
        key: 'special',
        name: 'は？',
        desc: '当身。構え中に打撃を受けると「は？」で反撃。飛び道具は跳ね返す。',
        callout: ['は？'],
        startup: 3,
        active: 20,
        recovery: 16,
        dmg: 18,
        hitstun: 30,
        kbx: 4,
        kby: 4,
        knockdown: true,
        kind: 'counter',
        pose: 'counter',
        sfx: 'special',
        cooldown: 24,
      },
    },
    superName: '否定の守護者',
    superQuote: '四百二十一回目',
    superDesc: '画面中の✝本質✝を全否定する。飛び道具を全消去し、相手を吹き飛ばしてゲージも削る。',
    intro: 'は？',
    wins: ['……まあ', 'は？（四百二十一回目）', '認めないけど、否定もしない', '俺に✝本質✝をつけるな'],
    blockText: 'まあ',
    koText: 'は？',
    stats: { power: 3, speed: 5, honshitsu: 1, joushiki: 4 },
    desc: '冷笑系。「は？」を言い続けることで✝本質✝の防波堤になっている。本人は認めない。',
  },
  ryoma: {
    id: 'ryoma',
    name: '両馬二郎',
    kana: 'りょうま・じろう',
    title: '✝本質✝の創始者（自称・元からあった）',
    affiliation: '理数科B組',
    tie: 'えんじ',
    tieColor: '#a8262e',
    color: '#f0b429',
    light: '#fef3c7',
    hp: 95,
    speed: 1.4,
    jump: 6,
    dmgMul: 1.1,
    look: {
      hair: 'spiky',
      hairColor: '#8a3a1c',
      hairDark: '#5e2610',
      eyeColor: '#3a2a20',
      glasses: true,
      gender: 'm',
      outfit: 'blazer',
      weapon: 'bowl',
      winPose: 'cheer',
    },
    moves: {
      light: {
        key: 'light',
        name: 'これまじ',
        desc: '「これまじ」で殴る。✝本質✝まで言う前に当たる。',
        callout: ['これまじ', 'まじ', '✝'],
        startup: 5,
        active: 4,
        recovery: 9,
        dmg: 6,
        hitstun: 14,
        kbx: 1.6,
        kby: 0,
        box: JAB_BOX,
        kind: 'melee',
        pose: 'jab',
        sfx: 'hit',
      },
      heavy: {
        key: 'heavy',
        name: '二郎系（脂多め）',
        desc: '週三で食べている二郎系を振り下ろす。脂の浮き方まじ✝本質✝。',
        callout: ['脂の浮き方✝本質✝', 'ニンニク入れますか', 'マシマシ'],
        startup: 11,
        active: 5,
        recovery: 17,
        dmg: 14,
        hitstun: 24,
        kbx: 3,
        kby: 2,
        box: SWING_BOX,
        kind: 'melee',
        pose: 'swing',
        sfx: 'heavy',
      },
      special: {
        key: 'special',
        name: '✝本質✝',
        desc: '✝を投げる。文脈はあったりなかったりする。画面に2つまで。',
        callout: ['これまじ✝本質✝', '今日の電線✝本質✝感ある', 'すごい✝本質✝が降りてきた', '自己対話だよ'],
        startup: 12,
        active: 1,
        recovery: 16,
        dmg: 8,
        hitstun: 16,
        kbx: 2.2,
        kby: 0,
        kind: 'projectile',
        pose: 'throw',
        sfx: 'cross',
        projectile: { kind: 'cross', vx: 3, life: 150, w: 9, h: 11 },
      },
    },
    superName: 'フェイカツ降臨',
    superQuote: '受験生よ、来い。✝',
    superDesc: '✝本質✝の雨が全画面に降り注ぐ。偏差値は知らん。',
    intro: 'これまじ✝本質✝',
    wins: ['これまじ✝本質✝', '✝本質✝の勝利！！', '自演じゃなくて自己対話だよ', '普通に頑張ることが✝本質✝なんだよ'],
    blockText: '✝',
    koText: '✝ K.O. ✝',
    stats: { power: 5, speed: 2, honshitsu: 5, joushiki: 1 },
    desc: '三重の名前をインターネットのあちこちに埋め込む男。無敵のメンタル。二郎系を週三で食べているわりに太っていない。',
  },
  naito: {
    id: 'naito',
    name: '内藤蘭',
    kana: 'ないとう・らん',
    title: '微笑む観測者',
    affiliation: '内進コース',
    tie: '紺',
    tieColor: '#2f4f8f',
    color: '#a78bfa',
    light: '#ede9fe',
    hp: 105,
    speed: 1.3,
    jump: 6,
    dmgMul: 1,
    look: {
      hair: 'long',
      hairColor: '#1a1a26',
      hairDark: '#0e0e16',
      eyeColor: '#3b4a7a',
      gender: 'f',
      outfit: 'blazer',
      accessory: 'bookFront',
      weapon: 'book',
      winPose: 'hug',
    },
    moves: {
      light: {
        key: 'light',
        name: '文庫本',
        desc: '静かに文庫本の角で突く。',
        callout: ['……', 'あ、'],
        startup: 5,
        active: 4,
        recovery: 9,
        dmg: 5,
        hitstun: 14,
        kbx: 1.6,
        kby: 0,
        box: JAB_BOX,
        kind: 'melee',
        pose: 'jab',
        sfx: 'hit',
      },
      heavy: {
        key: 'heavy',
        name: 'こころ（夏目漱石）',
        desc: '重い。物理的にも内容的にも。吹き飛ばし力が高い。',
        callout: ['こころ', '先生、', '夏目漱石'],
        startup: 12,
        active: 5,
        recovery: 18,
        dmg: 13,
        hitstun: 26,
        kbx: 3.6,
        kby: 1,
        box: SWING_BOX,
        kind: 'melee',
        pose: 'swing',
        sfx: 'heavy',
      },
      special: {
        key: 'special',
        name: '消しゴム落ちてます',
        desc: '消しゴムを転がす。足元に当たると転ぶ。恋の始まりでもある。',
        callout: ['消しゴム落ちてます', 'あ、落ちてますよ'],
        startup: 10,
        active: 1,
        recovery: 14,
        dmg: 7,
        hitstun: 18,
        kbx: 2,
        kby: 2.5,
        knockdown: true,
        kind: 'projectile',
        pose: 'point',
        sfx: 'special',
        projectile: { kind: 'eraser', vx: 2.6, life: 170, ground: true, w: 7, h: 4 },
      },
    },
    superName: '面白い考え方だね',
    superQuote: '意味わかんないけど、安心する',
    superDesc: '相手の理論に核爆弾を落とす。相手は長時間スタン、ゲージ没収。自分は回復。',
    intro: '……面白そう',
    wins: ['面白い考え方だね', '意味わかんないけど安心する', 'なんで二回お礼言うの？', '人がどんなこと考えてるか知るの、好きだから'],
    blockText: '……',
    koText: '✝ K.O. ✝',
    stats: { power: 3, speed: 2, honshitsu: 3, joushiki: 4 },
    desc: '静かな生徒。怒りも困惑も示さず「面白い考え方だね」と少し笑う。本質配信の視聴者。',
  },
  mitsumine: {
    id: 'mitsumine',
    name: '三峰瑠衣',
    kana: 'みつみね・るい',
    title: '常識の塊',
    affiliation: '内進コース',
    tie: '紺',
    tieColor: '#2f4f8f',
    color: '#f472b6',
    light: '#fce7f3',
    hp: 100,
    speed: 1.5,
    jump: 6.2,
    dmgMul: 1.05,
    look: {
      hair: 'bob',
      hairColor: '#5a3a26',
      hairDark: '#3e2716',
      eyeColor: '#4a3020',
      gender: 'f',
      outfit: 'vest',
      weapon: 'binder',
      winPose: 'cheer',
    },
    moves: {
      light: {
        key: 'light',
        name: '素直に言いなよ',
        desc: '直球。嘘つくとき人間は利き手の反対側を見る。',
        callout: ['素直に言いなよ', '嘘', 'は？'],
        startup: 4,
        active: 4,
        recovery: 8,
        dmg: 5,
        hitstun: 14,
        kbx: 1.6,
        kby: 0,
        box: JAB_BOX,
        kind: 'melee',
        pose: 'jab',
        sfx: 'hit',
      },
      heavy: {
        key: 'heavy',
        name: '作戦ノート',
        desc: 'A4ルーズリーフの束で殴る。恋愛は作戦なの。理論じゃない。',
        callout: ['作戦1', '猫にして', '理論の話はいい'],
        startup: 10,
        active: 5,
        recovery: 16,
        dmg: 12,
        hitstun: 24,
        kbx: 3.2,
        kby: 1.5,
        box: SWING_BOX,
        kind: 'melee',
        pose: 'swing',
        sfx: 'heavy',
      },
      special: {
        key: 'special',
        name: '猫は万能',
        desc: '猫を走らせる。なぜ猫なのかの根拠はない。でも猫にして。',
        callout: ['猫は万能だから', 'にゃー', '根拠はない'],
        startup: 12,
        active: 1,
        recovery: 15,
        dmg: 9,
        hitstun: 18,
        kbx: 2.4,
        kby: 0,
        kind: 'projectile',
        pose: 'point',
        sfx: 'special',
        projectile: { kind: 'cat', vx: 3.4, life: 160, ground: true, w: 10, h: 7 },
      },
    },
    superName: '理論はいい！！',
    superQuote: '好きなら好きって言いなよ！',
    superDesc: '突進して掴む。波動関数もシュレディンガーも問答無用。画面の飛び道具も全部消す。',
    intro: '理論はいい。',
    wins: ['普通は普通だよ！', '好きなら好きって言いなよ', 'は？（ハモリじゃない）', '面白いでいいんだよ'],
    blockText: 'は？',
    koText: 'は？',
    stats: { power: 4, speed: 3, honshitsu: 1, joushiki: 5 },
    desc: '恋愛において「理論」という概念が介在する余地を一切許容しない。三重と「は？」がハモる。',
  },
  terachi: {
    id: 'terachi',
    name: '寺地星',
    kana: 'てらち・せい',
    title: '✝本質✝の巫女（自称ペットボトル）',
    affiliation: '理数科B組',
    tie: 'えんじ',
    tieColor: '#a8262e',
    color: '#34d399',
    light: '#d1fae5',
    hp: 100,
    speed: 1.4,
    jump: 6.1,
    dmgMul: 1,
    look: {
      hair: 'messy',
      hairColor: '#1e1e28',
      hairDark: '#101018',
      eyeColor: '#3a3a4a',
      gender: 'm',
      outfit: 'blazer',
      accessory: 'headphones',
      weapon: 'paper',
      winPose: 'shy',
    },
    moves: {
      light: {
        key: 'light',
        name: 'マジックペン',
        desc: '太いマジックで突く。紙に書く前の動作。',
        callout: ['えー……', '紙に書きます'],
        startup: 5,
        active: 4,
        recovery: 9,
        dmg: 5,
        hitstun: 14,
        kbx: 1.6,
        kby: 0,
        box: JAB_BOX,
        kind: 'melee',
        pose: 'jab',
        sfx: 'hit',
      },
      heavy: {
        key: 'heavy',
        name: 'A4コピー用紙×21枚',
        desc: '過去最多の✝本質✝の束で殴る。引き出しにしまってあった。',
        callout: ['過去最多', '引き出しにしまう', '二十一枚'],
        startup: 10,
        active: 6,
        recovery: 16,
        dmg: 11,
        hitstun: 22,
        kbx: 3,
        kby: 1.5,
        box: SWING_BOX,
        kind: 'melee',
        pose: 'swing',
        sfx: 'heavy',
      },
      special: {
        key: 'special',
        name: '星と地面',
        desc: '相手の頭上に星を落とす。昼でも星はある。太陽が明るすぎて見えないだけ。',
        callout: ['昼でも星はある', '太陽が明るすぎるだけ', '星と地面と'],
        startup: 14,
        active: 1,
        recovery: 18,
        dmg: 10,
        hitstun: 20,
        kbx: 1.5,
        kby: 3,
        knockdown: true,
        kind: 'projectile',
        pose: 'pointUp',
        sfx: 'special',
        projectile: { kind: 'star', fromTop: true, vy: 3.6, life: 120, w: 9, h: 9 },
      },
    },
    superName: '本質配信',
    superQuote: '紙に書いて読みます',
    superDesc: 'LINEオープンチャットに届いた✝本質✝をランダムに読み上げる。効果は読むまでわからない。',
    intro: '本質配信、始めます',
    wins: ['……え、俺なんか良いこと言った？', '俺はペットボトルです', '笑われた数だけ本質に近づく', 'カス配信でした'],
    blockText: '……',
    koText: '✝ K.O. ✝',
    stats: { power: 3, speed: 3, honshitsu: 4, joushiki: 3 },
    desc: '底辺YouTuber。届いていないことを理解した上で作り続けている。紙に書いて固まる。',
  },
  rei: {
    id: 'rei',
    name: '数理零',
    kana: 'すうり・れい',
    title: '面白さの王・全科目学年首席',
    affiliation: '理数科B組',
    tie: 'えんじ',
    tieColor: '#a8262e',
    color: '#fb923c',
    light: '#ffedd5',
    hp: 100,
    speed: 1.6,
    jump: 6.4,
    dmgMul: 1,
    look: {
      hair: 'messyAhoge',
      hairColor: '#1c1c22',
      hairDark: '#0e0e12',
      eyeColor: '#404050',
      gender: 'm',
      outfit: 'blazer',
      accessory: 'bookSide',
      weapon: 'python',
      winPose: 'peace',
    },
    moves: {
      light: {
        key: 'light',
        name: 'シャーペン',
        desc: '回していたシャーペンで突く。ここはこう。',
        callout: ['ここはこう', 'どこわかんない？'],
        startup: 4,
        active: 4,
        recovery: 7,
        dmg: 5,
        hitstun: 14,
        kbx: 1.6,
        kby: 0,
        box: JAB_BOX,
        kind: 'melee',
        pose: 'jab',
        sfx: 'hit',
      },
      heavy: {
        key: 'heavy',
        name: 'Python（ちょっとだけ）',
        desc: 'リーチが長い。「ちょっとだけ」は嘘。',
        callout: ['ちょっとだけ', 'import honshitsu', 'Excelより早い'],
        startup: 9,
        active: 5,
        recovery: 15,
        dmg: 10,
        hitstun: 22,
        kbx: 3,
        kby: 1,
        box: { x: 5, y: -32, w: 31, h: 9 },
        kind: 'melee',
        pose: 'lash',
        sfx: 'heavy',
      },
      special: {
        key: 'special',
        name: '位相幾何学',
        desc: '枠の外に出る。相手の背後にワープ。今まで内側だったものが外側になる。',
        callout: ['枠の外に出る', '内側が外側になる', '位相幾何学的に言うと'],
        startup: 8,
        active: 4,
        recovery: 10,
        dmg: 0,
        hitstun: 0,
        kbx: 0,
        kby: 0,
        kind: 'teleport',
        pose: 'point',
        sfx: 'special',
        cooldown: 30,
      },
    },
    superName: '面白いデータが出たので見てください',
    superQuote: '面白い',
    superDesc: '数式が相手を追尾する。Q.E.D.でフィニッシュ。全科目学年首席。',
    intro: '面白いことを探す',
    wins: ['面白かった', '面白いデータが出たので見てください', '偶然か✝本質✝かは、決められないよ', 'セット✝'],
    blockText: 'ふーん',
    koText: 'Q.E.D.',
    stats: { power: 4, speed: 4, honshitsu: 3, joushiki: 3 },
    desc: '偏差値八十五。理数科にいる理由は「家が近いから」。評価軸は「面白い」だけ。',
  },
  sakura: {
    id: 'sakura',
    hidden: true,
    name: '櫻優',
    kana: 'さくら・ゆう',
    title: '恋愛学の研究者（理論崩壊中）',
    affiliation: '内進コース',
    tie: '紺',
    tieColor: '#2f4f8f',
    color: '#e879f9',
    light: '#fae8ff',
    hp: 100,
    speed: 1.6,
    jump: 6.2,
    dmgMul: 1,
    look: {
      hair: 'fluffy',
      hairColor: '#6b4a2e',
      hairDark: '#4a3120',
      eyeColor: '#4a3626',
      glasses: true,
      gender: 'm',
      outfit: 'blazer',
      accessory: 'loveNote',
      weapon: 'lovenote',
      winPose: 'shy',
      tieColor: '#2f4f8f',
      tieStripe: true,
      sweat: true,
    },
    moves: {
      light: {
        key: 'light',
        name: '要検証',
        desc: 'シャーペンで突いてノートに書く。当たっても外れても「要検証」。',
        callout: ['要検証', 'メモします', 'サンプルG-07', '有用なデータです'],
        startup: 4,
        active: 4,
        recovery: 8,
        dmg: 5,
        hitstun: 14,
        kbx: 1.6,
        kby: 0,
        box: JAB_BOX,
        kind: 'melee',
        pose: 'penJab',
        sfx: 'hit',
      },
      heavy: {
        key: 'heavy',
        name: '第一法則：近接性',
        desc: '研究ノートで払う。当たった相手はこちらへ引き寄せられる。近接性と反復接触が好意を生む。',
        callout: ['近接性', '反復接触', '第一法則', '引き寄せ'],
        startup: 10,
        active: 5,
        recovery: 14,
        dmg: 12,
        hitstun: 24,
        kbx: -2.6,
        kby: 0,
        box: SWING_BOX,
        kind: 'melee',
        pose: 'swing',
        sfx: 'heavy',
      },
      special: {
        key: 'special',
        name: 'シュレディンガーの好意',
        desc: '未観測の好意（♡？）を前方に置く。相手が触れるか、もう一度必殺で「観測」すると波動関数が崩壊して爆発。画面に1つまで。',
        callout: ['シュレディンガーの好意', '観測前です', '重ね合わせ', '第三法則'],
        startup: 12,
        active: 1,
        recovery: 14,
        dmg: 10,
        hitstun: 22,
        kbx: 2.5,
        kby: 4,
        knockdown: true,
        kind: 'trap',
        pose: 'point',
        sfx: 'special',
        cooldown: 18,
      },
    },
    superName: '実存的崩壊',
    superQuote: '報告があります。私は恋をしました',
    superDesc:
      '最も近い相手に恋を告白（＝観測）。ダメージは溜めた研究データ n で増える（n=0で14、n=15で51）。その後10秒間「理論のない状態の恋」：ノートを手放し、第七法則・不理解の引力で相手を引き寄せ続け、速度と攻撃力アップ。',
    intro: '観察のために来ました',
    wins: [
      'n=1で統計的処理は不可能です',
      '……研究です',
      '観察のために、また来ます',
      '恋愛発生の第十五法則（暫定）：〈面白い〉は理論を超える。要検証',
      '理論が壊れても、恋は壊れてない。……たぶん',
    ],
    blockText: '要検証',
    koText: '観測完了',
    stats: { power: 2, speed: 3, honshitsu: 4, joushiki: 2 },
    desc: '内進コース二年。紺のネクタイで北棟に通う恋愛学の研究者。彼女はいません。いたこともありません。ノートは✝本質✝だらけになり、理論は崩壊中（実存的）。被弾・ガードで研究データnが溜まる。',
  },
  kakusei: {
    id: 'kakusei',
    hidden: true,
    name: '覚醒三重',
    kana: 'みえ・けんしん（かくせい）',
    title: '葬式に殴り込む土木作業員',
    affiliation: '元・理数科B組（現在：現場）',
    tie: 'えんじ（＝理数科）',
    tieColor: '#a8262e',
    color: '#f05a28',
    light: '#ffefe2',
    hp: 114,
    speed: 1.55,
    jump: 6.2,
    dmgMul: 1.12,
    look: {
      hair: 'short',
      hairColor: '#33220f',
      hairDark: '#1f1308',
      eyeColor: '#d9480f',
      skin: '#e8c4a0',
      gender: 'm',
      outfit: 'kensetsu',
      weapon: 'hammer',
      winPose: 'cool',
    },
    moves: {
      light: {
        key: 'light',
        name: '杭打ち',
        desc: '大ハンマーの柄で小さく叩く。速いツッコミ程度には間合いを取る。',
        callout: ['来るな', '立ち入り禁止', '危険区域です'],
        startup: 4,
        active: 5,
        recovery: 8,
        dmg: 7,
        hitstun: 16,
        kbx: 2.2,
        kby: 0,
        box: { x: 5, y: -30, w: 20, h: 10 },
        kind: 'melee',
        pose: 'jab',
        sfx: 'hit',
      },
      heavy: {
        key: 'heavy',
        name: '解体の一撃',
        desc: '頭上から振り下ろす大振り。振りかぶり〜振り抜きは「超アーマー」で崩れず、飛び道具も叩き落とす。読まれれば振り抜き後が無防備。',
        callout: ['ガンッ', '解体！', '更地にする', '止まらねェ'],
        startup: 14,
        active: 7,
        recovery: 22,
        dmg: 19,
        hitstun: 30,
        kbx: 4.2,
        kby: 5,
        knockdown: true,
        box: { x: 2, y: -46, w: 27, h: 28 },
        moveX: 2,
        armor: true,
        kind: 'melee',
        pose: 'swing',
        sfx: 'heavy',
      },
      special: {
        key: 'special',
        name: '地面震撃',
        desc: 'ハンマーで目の前の地面を叩き、砕けた地盤が前方へ震撃（衝撃波）となって走る。地面専用なのでジャンプで飛び越えられる。',
        callout: ['地面が来る', '割れた', '足を止めろ'],
        startup: 15,
        active: 6,
        recovery: 24,
        dmg: 13,
        hitstun: 26,
        kbx: 2.8,
        kby: 3.4,
        knockdown: true,
        kind: 'projectile',
        pose: 'lash',
        sfx: 'heavy',
        projectile: { kind: 'shock', vx: 3.8, ground: true, life: 280, w: 12, h: 14 },
      },
    },
    superName: '葬式は終わった',
    superQuote: '何も解決しなかった。だから、こわす。',
    superDesc: '前へ進みながら大ハンマーで3連の解体（解体・排除・更地）を叩き込む。各撃は近接を直撃しつつ、砕けた地盤が画面の端まで走る貫通震撃になる。着地している相手は逃げ場がない。ジャンプで震撃は飛び越えられる。',
    intro: '……悪い。今日は、急いでる',
    wins: [
      '……まあ（これで、多少は直ったか）',
      '何も解決しなかった。だから、こわした',
      '更地にして、正しく立て直す',
      'は？（本気で言った）',
      '否定してる場合じゃなかった',
    ],
    blockText: '……来た',
    koText: '解体完了',
    stats: { power: 5, speed: 3, honshitsu: 2, joushiki: 1 },
    desc: '三峰瑠衣の葬儀に、現場のヘルメットと一キロのハンマーをカバンの底に沈めて現れた三重県臣の姿。「は？」で守るのをやめ、自らの手で元凶を叩き潰すことを選んだ。高HPを活かしてアーマーで殴り合い、地を走る震撃で距離を支配する解体屋。弱点は「空中」。飛び越えられると崩れやすい。',
  },
};

/** 櫻優「理論のない状態の恋」中の見た目：ノートを手放し、汗も引いた */
export const SAKURA_LOVE_LOOK: Look = {
  ...CHARS.sakura.look,
  accessory: undefined,
  weapon: 'none',
  sweat: false,
};

export const EXTRA_LOOKS: Record<'kuraishi' | 'heikatsu', Look> = {
  kuraishi: {
    hair: 'short',
    hairColor: '#202028',
    eyeColor: '#202030',
    gender: 'm',
    outfit: 'blazer',
    accessory: 'notebook',
    weapon: 'none',
  },
  heikatsu: {
    hair: 'adult',
    hairColor: '#5a5048',
    hairDark: '#8a8078',
    eyeColor: '#2a2a2a',
    gender: 'm',
    outfit: 'suit',
    accessory: 'map',
    weapon: 'none',
    skin: '#e8c8a8',
  },
};

export const STAGES: StageDef[] = [
  { id: 'classroom', name: '北棟 理数科B組', sub: '室外機の唸りと、コーンスープの不在' },
  { id: 'lake', name: '翠湖 遊歩道（十キロ）', sub: '走りながら✝本質✝が降りてくる' },
  { id: 'sakura', name: '南棟と北棟の間の並木道', sub: 'ネクタイは違うが、桜は同じだ' },
  { id: 'hawaii', name: 'キラウエア溶岩台地', sub: '地図が追いつかない地面' },
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '偏差値50',
  normal: '偏差値60（理数科）',
  hard: '偏差値85（難関）',
  extreme: '偏差値100（解禁）',
};

export const DIFFICULTY_SHORT: Record<Difficulty, string> = {
  easy: '偏差値50',
  normal: '偏差値60',
  hard: '偏差値85',
  extreme: '偏差値100',
};

export const DIFFICULTY_HINT: Record<Difficulty, string> = {
  easy: 'ガードが甘く反応も遅い',
  normal: '標準的な理数科レベル',
  hard: 'ガードが堅く反応も速い',
  extreme: '数理零カンスト相当・ほぼ完璧',
};

// 特殊な試合前の掛け合い（idの辞書順ペア → 候補リスト。試合ごとに1つ選ばれる）
// first: 先に言う側のid / a: 先に言う側のセリフ / b: 返す側のセリフ / note: 画面中央に出る補足
export interface IntroLine {
  first: CharId;
  a: string;
  b: string;
  note?: string;
}

export const INTRO_PAIRS: Record<string, IntroLine[]> = {
  'mie|mitsumine': [
    { first: 'mie', a: 'は？', b: 'は？', note: '（ハモリ）' },
    { first: 'mitsumine', a: 'あんたも〈は？〉って思ってるでしょ', b: '思ってる' },
  ],
  'mie|ryoma': [
    { first: 'ryoma', a: 'これまじ✝本質✝', b: 'は？' },
    { first: 'mie', a: '俺に✝本質✝をつけるな', b: 'もうついてるよ' },
  ],
  'mie|terachi': [{ first: 'terachi', a: '三重について考えよ', b: '書くな！！' }],
  'ryoma|terachi': [{ first: 'terachi', a: '本質配信やります', b: 'なんで俺に先に言わないんだよ' }],
  'mitsumine|naito': [
    { first: 'mitsumine', a: '好きなら好きって言いなよ', b: '面白い考え方だね' },
    { first: 'naito', a: '三峰さん、作戦ノートって何？', b: '……なんでもない！' },
  ],
  'naito|terachi': [{ first: 'naito', a: '配信、見てます', b: '……え、マジ？' }],
  'rei|ryoma': [{ first: 'ryoma', a: '零まじ✝本質✝', b: 'そう思っただけだけど' }],
  'mie|rei': [{ first: 'rei', a: 'セット✝', b: '零、✝つけるな' }],
  'mitsumine|ryoma': [{ first: 'ryoma', a: 'もう巻き込まれてるよ', b: 'は？' }],
  'naito|ryoma': [{ first: 'ryoma', a: '✝本質✝は恋愛に適用可能', b: '面白い考え方だね' }],

  // ───── 櫻優（隠しキャラ）との掛け合い ─────
  'mie|sakura': [
    { first: 'mie', a: '……また来たのか', b: '観察のために来ました。今日で四十二回目です' },
    { first: 'sakura', a: '三重先輩、今の〈は？〉は何回目ですか', b: '数えるな。……四百二十回目', note: '（数えている）' },
    { first: 'mie', a: 'お前のノート、✝本質✝だらけだぞ', b: '研究メモです。手遅れではありません' },
    { first: 'sakura', a: '両馬先輩の発言は十回に一回意味があると聞きました。今日は？', b: '……わからない' },
    { first: 'mie', a: '俺たちの会話を研究データにするな', b: '非常に有用なデータです' },
    { first: 'sakura', a: '三重先輩と三峰さんの〈は？〉、周波数が一致しています', b: 'ハモリじゃない', note: '（ハモリ）' },
  ],
  'ryoma|sakura': [
    { first: 'sakura', a: '両馬先輩。✝本質✝は恋愛に適用可能ですか', b: '全部に適用可能だよ。恋愛にもラーメンにも' },
    { first: 'ryoma', a: '恋愛の✝本質✝？ わかんない。でも、あるんじゃない？', b: '〈わからないが、ある〉……恋愛の定義に近い。要検証' },
    { first: 'sakura', a: '✝本質✝は、私の理論を壊しに来たんですか', b: '壊れたんじゃなくて、広がったんだよ', note: '（十回に一回のやつ）' },
    { first: 'sakura', a: '両馬先輩。報告があります。私は恋をしました', b: 'おお。それまじ✝本質✝' },
    { first: 'ryoma', a: '母親の卵焼きまじ✝本質✝', b: '今のは一回ですか、九回ですか' },
    { first: 'ryoma', a: '恋愛とは✝本質✝であり、✝本質✝とは恋愛である', b: 'それ、私のノートの第十三法則です。助けて。' },
  ],
  'naito|sakura': [
    { first: 'naito', a: 'あ、消しゴム落ちてます', b: '……ありがとうございます。ありがとうございます', note: '（心拍数、上昇）' },
    { first: 'naito', a: '櫻くんって、理数科によく行ってるよね', b: 'は、はい。研究で。……恋愛学の' },
    { first: 'sakura', a: '内藤さん。好意の観測について、一つ確認したいことが——', b: '面白い考え方だね', note: '（理論に核爆弾）' },
    { first: 'naito', a: 'なんで二回お礼言うの？', b: '分類できない……この笑いは、分類できない' },
    { first: 'sakura', a: '（n=1。統計的処理は不可能。でも——）', b: '……なに？' },
    { first: 'naito', a: '人がどんなこと考えてるか知るの、好きだから', b: '好き……（文脈とは無関係に刺さった）' },
    { first: 'naito', a: '寺地くんの配信、見てるんだ、あたし', b: '知ってます。……いえ、今知りました' },
  ],
  'mitsumine|sakura': [
    { first: 'mitsumine', a: 'あんた、好きな子いるでしょ', b: '……いません', note: '（視線が左に動いた）' },
    { first: 'sakura', a: '好意の観測が波動関数を崩壊させる問題への対策は——', b: '理論はいい！！' },
    { first: 'mitsumine', a: '好きなら好きって言いなよ', b: 'それは波動関数の——' },
    { first: 'mitsumine', a: 'アイコン、猫にした？', b: 'しました。n=1では結論は出せませんが', note: '（n=1じゃなくて、一日目だから）' },
    { first: 'sakura', a: '三峰さん、作戦ノートと研究ノート、どちらが科学的か——', b: '科学の話はいい。作戦の話をして' },
    { first: 'mitsumine', a: 'もっと誘えよ', b: '適切な頻度を理論的に——', note: '（五回目のやりとり）' },
    { first: 'sakura', a: '恋愛は作戦だと言いましたね。作戦は理論の一種では——', b: 'は？' },
  ],
  'sakura|terachi': [
    { first: 'sakura', a: '寺地先輩。内藤さんが、本質配信を見ていると言っていました', b: '……マジ？' },
    { first: 'terachi', a: '理論が壊れても、恋は壊れてないから。たぶん', b: '（匿名で送ったのに、バレている……）', note: '（本質配信 #7）' },
    { first: 'sakura', a: '配信、見てました', b: '身内率、上がった' },
    { first: 'terachi', a: 'えー……恋愛学の研究者が恋をした場合の✝本質✝。これ、重いやつですね', b: '重いです。研究対象に自分が含まれています' },
    { first: 'sakura', a: '〈意味わかんないけど安心する〉……寺地先輩、あれは何なんですか', b: '俺が聞きたい' },
    { first: 'terachi', a: '俺はペットボトルです', b: 'ペットボトルは恋をしますか。要検証' },
  ],
  'rei|sakura': [
    { first: 'rei', a: '告白が崩壊なら、告白の後って何になるの？', b: '……第四法則がそこを扱ってます' },
    { first: 'rei', a: '理論で処理しようとすること自体をやめたら？', b: 'やめたら、何を頼りにすればいいんですか' },
    { first: 'sakura', a: '枠の外に出た理論はどこへ行くんですか', b: 'わかんない。でも、消えるわけじゃない' },
    { first: 'rei', a: '〈半減〉は文献値？', b: '文献によって違うので〈だいたい〉です' },
    { first: 'sakura', a: '数理先輩は、✝本質✝に近い人種ですか', b: '面白いかどうかしか考えてないよ' },
    { first: 'rei', a: '面白いな', b: '面白いと言われても、私は今つらいんですが' },
    { first: 'rei', a: 'それ、データあるの？', b: '文献調査です。自分のデータはないので' },
  ],

  // ───── 覚醒三重（隠しキャラ②）との掛け合い ─────
  // 覚醒三重＝三峰瑠衣の葬儀に、土木現場のハンマーをカバンの底に沈めて出席した三重県臣。
  // 「通夜を終えて現場へ戻る男」ではなく「数理零を殺す覚悟で式場に来た男」。
  // 三峰はこの時点で死んでいるので、覚醒三重が三峰と対峙しても三峰は何も返さない。
  'kakusei|mie': [
    { first: 'kakusei', a: '……お前の〈は？〉は、まだ間に合う', b: '間に合うって、何にだ' },
    { first: 'kakusei', a: '否定はやめた。次は、直す', b: 'は？　直すって、何を' },
    { first: 'mie', a: '俺を俺で殴るな', b: '殴らない。殴る相手は、決めてある' },
    { first: 'mie', a: 'なあ。俺とお前、同じ人間だよな', b: '……は？' },
  ],
  'kakusei|mitsumine': [
    // 三峰は死んでいる。だから彼女は一言も返さない。
    { first: 'kakusei', a: '……ごめん', b: '……' },
    { first: 'kakusei', a: '線香、上げた。……それでいいか', b: '……' },
    { first: 'kakusei', a: '……〈は？〉でいい。一言、言ってくれ', b: '……' },
  ],
  'kakusei|rei': [
    { first: 'kakusei', a: 'お前が、三峰を殺したんだろ', b: '……何のことかな？' },
    { first: 'rei', a: '来てくれたんだね。三峰さんも喜んでるよ', b: '……喜ぶわけがない' },
    { first: 'kakusei', a: 'カバンの底に、一キロの鉄がある', b: '面白い。君が物理を選ぶなんて' },
    { first: 'rei', a: '壊すことは、面白いデータだよ', b: '直すところまで見てから言え' },
  ],
  'kakusei|ryoma': [
    { first: 'ryoma', a: '三重……そのカバン、中身は', b: '道具だ。一キロの' },
    { first: 'kakusei', a: 'お前のメッセージで、俺は起きた', b: '……俺が、✝本質✝なんて撒くから' },
    { first: 'ryoma', a: '俺も行く。三峰さんの葬式', b: '来るな。お前は、歩けないだろ' },
    { first: 'ryoma', a: '✝本質✝なんて、ただの幻だった', b: '幻でも、地面に落ちれば重い' },
  ],
  'kakusei|naito': [
    { first: 'kakusei', a: '蘭。三峰の葬式、来なかったな', b: '行く必要、ないでしょ' },
    { first: 'naito', a: '三重くん、壊したら直せるの？', b: 'わかんない。直るまで、こわし続ける' },
    { first: 'kakusei', a: 'あいつは、最後までお前の心配をしてた', b: '面白い考え方だね。……関係ないよ' },
  ],
  'kakusei|sakura': [
    { first: 'kakusei', a: 'お前の目、あの日のままだ', b: '爬虫類、でしたか。記録します' },
    { first: 'sakura', a: '好意の観測が、波動関数を——', b: '理論はいい' },
    { first: 'sakura', a: '三重先輩。退学は、私の証言のせいです', b: '知ってる。……それで、楽になったか' },
    { first: 'kakusei', a: '恋は、観測して済むものか', b: '……済まないから、崩れてます。要検証' },
  ],
  'kakusei|terachi': [
    { first: 'terachi', a: 'え、三重……そのハンマー、何', b: 'お前を殴った拳より、重い' },
    { first: 'kakusei', a: '式場、見渡した。お前はいなかった', b: '……蘭が、行かないって言うから' },
    { first: 'terachi', a: '俺、ペットボトルです。何でも入ります', b: '器は割れる。……お前は、もう割れてる' },
  ],
};

/** 同キャラ対戦（自己対話）の専用掛け合い。未定義なら「自演じゃなくて自己対話だよ」 */
export const MIRROR_INTROS: Partial<Record<CharId, { a: string; b: string }>> = {
  sakura: { a: '同一個体を二つ観測した場合、n=2になりますか', b: 'なりません。自己対話はn=1のままです' },
  kakusei: { a: '……お前も、葬式か', b: 'ああ。……鉄は、一本しかない' },
};

/** 櫻優の恋愛発生法則（超必殺で画面に散る） */
export const LOVE_LAWS = [
  '第一法則：近接性と反復接触',
  '第二法則：類似性の引力',
  '第三法則：シュレディンガーの好意',
  '第四法則：古典的恋愛の減衰（半減期三〜六ヶ月）',
  '第五法則：視線の三秒則',
  '第六法則：消しゴム事象',
  '第七法則：不理解の引力',
  '第八法則：作戦は理論に優先しない（三峰、反証）',
  '第九法則：昼食の適切な頻度（要検証）',
  '第十法則：アイコン変更の信号性（猫）',
  '第十一法則：笑いの分類不能性',
  '第十二法則：n=1で統計的処理は不可能',
  '第十三法則（暫定）：恋愛とは✝本質✝である',
  '第十四法則（暫定）：当事者になると理論は機能しない',
  '第十五法則（暫定）：〈面白い〉は理論を超える',
];

/** 超必殺カットインで映る研究ノートの1ページ */
export const LOVE_NOTE_PAGES = [
  '恋愛発生の第三法則：好意は観測されていない状態で重ね合わさっている。告白は波動関数の崩壊である。',
  '恋愛発生の第十三法則（暫定）：恋愛とは✝本質✝であり、✝本質✝とは恋愛である。……何を言っているかわからない。助けて。',
  '恋愛発生の第十四法則（暫定）：当事者になると理論は機能しない。',
  '消しゴム事象：軽微な接触が好意の種子になりうるか？ 要検証（二十七回目の再分析。結論、また変わる）',
  '数理零。〈理論がない状態の恋〉。怖い。でも、✝本質✝的にはそちらが正しい気がする。',
  '内藤蘭が少し笑った。好意か、社交か、知的反応か。……分類できない。分類できない。',
  '分析不能。サンプル数1。n=1で統計的処理は不可能。（ノートを閉じても感情は閉じなかった）',
];

export function pairKey(a: CharId, b: CharId): string {
  return [a, b].sort().join('|');
}
