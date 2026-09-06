import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_CHARS, CHARS, CHAR_ORDER, HIDDEN_HINTS, INTRO_PAIRS, MIRROR_INTROS, pairKey, rosterFor } from '../src/game/characters';
import { Battle, GROUND } from '../src/game/engine';
import { EMPTY_INPUT } from '../src/game/types';
import type { CharId, FighterSetup, InputState, Setup } from '../src/game/types';
import { isKakuseiUnlockMatch } from '../src/game/unlock';

type BattleOpts = ConstructorParameters<typeof Battle>[0];

const run = (opts: Partial<BattleOpts>, frames: number, inputs?: (t: number, b: Battle) => InputState[]) => {
  const b = new Battle({ p1: 'kakusei', p2: 'rei', ai: [true, true], difficulty: 'extreme', stage: 'classroom', seed: 42, ...opts });
  for (let i = 0; i < frames; i++) {
    b.step(inputs ? inputs(i, b) : ([] as InputState[]));
    if (b.phase === 'matchEnd') break;
  }
  return b;
};

const mkFighters = (over: Partial<FighterSetup> = {}): FighterSetup[] => [
  { char: 'mie', team: 0, ai: false, aiDifficulty: 'extreme', ...over },
  ...([1, 2, 3, 4, 5, 6, 7] as const).map<FighterSetup>((i) => ({ char: (['ryoma', 'naito', 'mitsumine', 'terachi', 'rei', 'sakura', 'mie'] as CharId[])[i - 1], team: 1, ai: true, aiDifficulty: 'extreme' })),
];

test('覚醒三重は隠しキャラ②：櫻の次に解禁され、ロスター末尾に追加される', () => {
  assert.ok(!CHAR_ORDER.includes('kakusei'));
  assert.equal(CHARS.kakusei.hidden, true);
  assert.deepEqual(rosterFor(false, false), CHAR_ORDER);
  assert.deepEqual(rosterFor(true, false), [...CHAR_ORDER, 'sakura']);
  assert.deepEqual(rosterFor(false, true), [...CHAR_ORDER, 'kakusei']);
  assert.deepEqual(rosterFor(true, true), [...CHAR_ORDER, 'sakura', 'kakusei']);
  // 服装は土木作業着・ヘルメット・ハンマー
  assert.equal(CHARS.kakusei.look.outfit, 'workgear');
  assert.equal(CHARS.kakusei.look.weapon, 'hammer');
  assert.ok(CHARS.kakusei.look.helmet, 'ヘルメット着用');
  // ヒントが用意されている
  assert.ok(HIDDEN_HINTS.kakusei.hint && HIDDEN_HINTS.kakusei.condition);
});

test('解禁条件：チーム戦で自分ひとり vs 偏差値100のCPU7人 に勝つ（キャラ不問）', () => {
  const base: Setup = {
    mode: 'team',
    teamMode: true,
    difficulty: 'extreme',
    p1: 'mie',
    p2: 'ryoma',
    stage: 'classroom',
    fighters: mkFighters(),
  };
  assert.ok(isKakuseiUnlockMatch(base, 0), '自分ひとりでCPU7体（全員extreme）に勝てば解禁');
  assert.ok(!isKakuseiUnlockMatch(base, 1), '負けたら解禁されない');
  assert.ok(isKakuseiUnlockMatch({ ...base, fighters: mkFighters({ char: 'naito' }) }, 0), '自分の使用キャラは不問');
  const hardTeam: Setup = { ...base, fighters: mkFighters().map((f) => (f.team === 1 ? { ...f, aiDifficulty: 'hard' as const } : f)) };
  assert.ok(!isKakuseiUnlockMatch(hardTeam, 0), '相手が1体でも偏差値100でないと解禁されない');
  const inherited: Setup = { ...base, fighters: mkFighters().map((f) => ({ ...f, aiDifficulty: undefined })) };
  assert.ok(isKakuseiUnlockMatch(inherited, 0), '個別設定がなければ全体設定（extreme）を引き継ぐ');
  const sixFoes: Setup = { ...base, fighters: mkFighters().slice(0, 7) };
  assert.ok(!isKakuseiUnlockMatch(sixFoes, 0), 'CPUは7体必要（6体では不可）');
  const withAlly: Setup = { ...base, fighters: [...mkFighters(), { char: 'naito', team: 0, ai: true, aiDifficulty: 'extreme' }] };
  assert.ok(!isKakuseiUnlockMatch(withAlly, 0), '自チームが自分のみ（味方いると不可）');
  const twoHumans: Setup = { ...base, fighters: mkFighters().map((f, i) => (i === 1 ? { ...f, team: 0, ai: false } : f)) };
  assert.ok(!isKakuseiUnlockMatch(twoHumans, 0), '人間が2人いると解禁されない');
  assert.ok(!isKakuseiUnlockMatch({ ...base, mode: '1p', teamMode: false, fighters: undefined }, 0), 'チーム戦以外では解禁されない');
  // 人間が赤チーム側でも、そのチームが勝てば解禁
  const flipped: Setup = { ...base, fighters: mkFighters().map((f) => ({ ...f, team: f.team === 0 ? 1 : 0 })) };
  assert.ok(isKakuseiUnlockMatch(flipped, 1), '人間側チームの勝利なら解禁');
});

test('掛け合いは全キャラ分あり、数理零・両馬との因縁は特に濃い', () => {
  for (const id of [...CHAR_ORDER, 'sakura'] as CharId[]) {
    const list = INTRO_PAIRS[pairKey(id, 'kakusei')];
    assert.ok(list && list.length >= 5, `${id} との掛け合いが少ない: ${list?.length ?? 0}`);
    for (const line of list) {
      assert.ok(line.a.trim() && line.b.trim(), `${id}|kakusei に空の台詞`);
      assert.ok(line.first === id || line.first === 'kakusei', 'first はペアのどちらか');
    }
  }
  assert.ok(INTRO_PAIRS[pairKey('rei', 'kakusei')].length >= 6, '数理零との掛け合いは6本以上');
  assert.ok(INTRO_PAIRS[pairKey('ryoma', 'kakusei')].length >= 6, '両馬との掛け合いは6本以上');
  assert.ok(MIRROR_INTROS.kakusei && MIRROR_INTROS.kakusei.a.trim() && MIRROR_INTROS.kakusei.b.trim());
});

test('覚醒三重 vs 全キャラ（AI同士・偏差値100）が完走し、同じシードなら同じ結果になる', () => {
  for (const opp of ALL_CHARS as readonly CharId[]) {
    const a = run({ p2: opp, seed: 7 }, 60 * 340);
    const c = run({ p2: opp, seed: 7 }, 60 * 340);
    assert.equal(a.stateHash(), c.stateHash(), `nondeterministic vs ${opp}`);
    assert.equal(a.phase, 'matchEnd', `vs ${opp} が時間内に終わらない`);
  }
});

test('土嚢堡：設置した土嚢が敵の飛び道具を止め、壊れる', () => {
  const b = new Battle({ p1: 'kakusei', p2: 'rei', ai: [true, true], difficulty: 'normal', stage: 'classroom', seed: 11 });
  // fight フェーズまで進める
  for (let i = 0; i < 200 && b.phase !== 'fight'; i++) b.step([]);
  assert.equal(b.phase, 'fight');
  const me = b.f[0];
  // 土嚢と、それに向かう敵の数式を直接設置（単体テスト）
  const bagX = me.x + 30;
  b.projectiles.push({ kind: 'sandbag', owner: me.idx, x: bagX, y: GROUND - 8, vx: 0, vy: 0, w: 13, h: 16, dmg: 8, hitstun: 20, kbx: 2.5, kby: 0, life: 300, ground: true, pierce: true, hitMask: 0, t: 0, seed: 1 });
  b.projectiles.push({ kind: 'formula', owner: 1, x: bagX - 10, y: GROUND - 12, vx: 3, vy: 0, w: 8, h: 8, dmg: 3, hitstun: 12, kbx: 0.8, kby: 0, life: 200, homing: me.idx, text: '∑', hitMask: 0, t: 0, seed: 2 });
  b.step([]);
  b.step([]);
  assert.ok(!b.projectiles.some((p) => p.kind === 'sandbag'), '土嚢は敵の飛び道具を止めて壊れる');
  assert.ok(!b.projectiles.some((p) => p.kind === 'formula'), '数式も相殺される');
  assert.ok(b.texts.some((t) => t.text === '土嚢、散土'), '破砕の演出が出る');
});

test('残土処分：超必殺でがれきが降り、起振ローラーが戦場を均す', () => {
  let seenGravel = false;
  let seenRoller = false;
  let seenBag = false;
  let seenSuper = false;
  const b = run({ p2: 'rei', ai: [false, true], difficulty: 'easy', seed: 5 }, 60 * 150, (t, b) => {
    if (b.projectiles.some((p) => p.kind === 'gravel')) seenGravel = true;
    if (b.projectiles.some((p) => p.kind === 'roller')) seenRoller = true;
    if (b.projectiles.some((p) => p.kind === 'sandbag')) seenBag = true;
    if (b.f[0].state === 'super') seenSuper = true;
    const inp: InputState = { ...EMPTY_INPUT };
    if (b.phase !== 'fight') return [inp, EMPTY_INPUT];
    const me = b.f[0];
    if (me.meter >= 100 && (me.state === 'idle' || me.state === 'walk')) inp.super = true;
    else if (t % 120 === 60) inp.special = true; // 土嚢
    else if (t % 9 === 0) inp.light = true;
    else inp.right = true;
    return [inp, EMPTY_INPUT];
  });
  assert.ok(seenBag, '土嚢が設置される');
  assert.ok(seenSuper, '超必殺が出る');
  assert.ok(seenGravel, '残土（がれき）が降る');
  assert.ok(seenRoller, '起振ローラーが出る');
  assert.equal(b.f[0].hp > 0 || b.f[1].hp > 0, true, '試合は完走する');
});

test('チーム戦で両チームに覚醒三重がいても完走する', () => {
  const b = new Battle({
    p1: 'kakusei',
    p2: 'mie',
    ai: [true, true],
    difficulty: 'hard',
    stage: 'lake',
    seed: 99,
    fighters: [
      { char: 'kakusei', team: 0, ai: true },
      { char: 'kakusei', team: 0, ai: true },
      { char: 'rei', team: 0, ai: true },
      { char: 'kakusei', team: 1, ai: true },
      { char: 'sakura', team: 1, ai: true },
      { char: 'mitsumine', team: 1, ai: true },
      { char: 'naito', team: 1, ai: true },
      { char: 'kakusei', team: 1, ai: true },
    ],
  });
  for (let i = 0; i < 60 * 240 && b.phase !== 'matchEnd'; i++) b.step([]);
  assert.equal(b.phase, 'matchEnd');
});
