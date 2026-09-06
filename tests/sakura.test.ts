import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_CHARS, CHARS, CHAR_ORDER, HIDDEN_CHARS, INTRO_PAIRS, MIRROR_INTROS, pairKey, rosterFor } from '../src/game/characters';
import { Battle } from '../src/game/engine';
import { EMPTY_INPUT } from '../src/game/types';
import type { CharId, InputState, Setup, Side } from '../src/game/types';
import { hiddenCharsSatisfied, NO_HIDDEN, rosterFor } from '../src/game/characters';

type BattleOpts = ConstructorParameters<typeof Battle>[0];

/** 解禁済みロスターなしで、この試合が「隠しキャラ解禁」を満たすか（id→bool）で判定する */
const satisfied = (setup: Setup, winner: Side): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  for (const m of hiddenCharsSatisfied(NO_HIDDEN, setup, winner)) out[m.id] = true;
  return out;
};

const run = (opts: Partial<BattleOpts>, frames: number, inputs?: (t: number, b: Battle) => InputState[]) => {
  const b = new Battle({ p1: 'sakura', p2: 'naito', ai: [true, true], difficulty: 'extreme', stage: 'classroom', seed: 42, ...opts });
  for (let i = 0; i < frames; i++) {
    b.step(inputs ? inputs(i, b) : [EMPTY_INPUT, EMPTY_INPUT]);
    if (b.phase === 'matchEnd') break;
  }
  return b;
};

test('隠しキャラ①櫻優・②覚醒三重：通常ロスターには出ず、解禁すると末尾に追加される', () => {
  assert.ok(!CHAR_ORDER.includes('sakura'));
  assert.ok(!CHAR_ORDER.includes('kakusei'));
  assert.deepEqual(HIDDEN_CHARS, ['sakura', 'kakusei']);
  assert.deepEqual(rosterFor({}), CHAR_ORDER);
  assert.deepEqual(rosterFor({ sakura: true }), [...CHAR_ORDER, 'sakura']);
  assert.deepEqual(rosterFor({ kakusei: true }), [...CHAR_ORDER, 'kakusei']);
  assert.deepEqual(rosterFor({ sakura: true, kakusei: true }), [...CHAR_ORDER, 'sakura', 'kakusei']);
  assert.deepEqual(ALL_CHARS, [...CHAR_ORDER, ...HIDDEN_CHARS]);
  assert.equal(CHARS.sakura.hidden, true);
  assert.equal(CHARS.sakura.look.tieColor, '#2f4f8f', '内進コースなのでネクタイは紺');
  assert.equal(CHARS.kakusei.hidden, true);
  assert.equal(CHARS.kakusei.look.outfit, 'kensetsu', '覚醒三重は土木作業員の恰好');
  assert.equal(CHARS.kakusei.look.weapon, 'hammer', '大ハンマーを持つ');
});

test('覚醒三重の解禁条件：青1人（人間）で赤7体（偏差値100のCPU）にチーム戦で勝つ', () => {
  const NAMES = ['kakusei', 'mie', 'ryoma', 'naito', 'mitsumine', 'terachi', 'rei', 'sakura'] as const;
  const F = (i: number, team: 0 | 1, ai: boolean, aiDifficulty: 'extreme' | 'hard' = 'extreme') => ({ char: NAMES[i], team, ai, aiDifficulty });
  const mk = (mut?: (fs: NonNullable<Setup['fighters']>) => NonNullable<Setup['fighters']>): Setup => {
    const fighters = [F(0, 0, false), F(1, 1, true), F(2, 1, true), F(3, 1, true), F(4, 1, true), F(5, 1, true), F(6, 1, true), F(7, 1, true)];
    return { mode: 'team', teamMode: true, p1: 'kakusei', p2: 'mie', difficulty: 'extreme', stage: 'classroom', fighters: mut ? mut(fighters) : fighters };
  };
  const isKakusei = (s: Setup, w: Side) => !!satisfied(s, w)['kakusei'];
  assert.ok(isKakusei(mk(), 0));
  assert.ok(!isKakusei(mk(), 1), '青が負けたら解禁されない');
  assert.ok(!isKakusei({ ...mk(), teamMode: false }, 0), 'チーム戦でなければ解禁されない');
  assert.ok(!isKakusei({ ...mk(), mode: '1p' }, 0), '1P対CPUでは解禁されない');
  // 赤の1体だけ偏差値が違う
  assert.ok(
    !isKakusei(mk((fs) => fs.map((f, i) => (i === 2 ? { ...f, aiDifficulty: 'hard' as const } : f))), 0),
    '偏差値100でないCPUが混ざると解禁されない'
  );
  // 赤に人間が混ざる
  assert.ok(
    !isKakusei(mk((fs) => fs.map((f, i) => (i === 3 ? { ...f, ai: false } : f))), 0),
    '赤に人間がいると解禁されない'
  );
  // 赤が6体では解禁されない
  assert.ok(!isKakusei(mk((fs) => fs.slice(0, 7)), 0), '7体ちょうど必要');
  // 青にCPUが混ざると解禁されない（自分1人だけで勝っていないと）
  assert.ok(!isKakusei(mk((fs) => fs.map((f, i) => (i === 0 ? { ...f, ai: true, aiDifficulty: 'hard' as const } : f))), 0), '青は人間1人だけでなければいけない');
});

test('解禁条件：1P対CPU・偏差値100の内藤蘭に勝つ', () => {
  const base: Setup = { mode: '1p', p1: 'mie', p2: 'naito', difficulty: 'extreme', stage: 'classroom' };
  const isSakura = (s: Setup, w: Side) => !!satisfied(s, w)['sakura'];
  assert.ok(isSakura(base, 0));
  assert.ok(!isSakura(base, 1), '負けたら解禁されない');
  assert.ok(!isSakura({ ...base, difficulty: 'hard' }, 0), '偏差値85では解禁されない');
  assert.ok(!isSakura({ ...base, p2: 'mie' }, 0), '相手が内藤でないと解禁されない');
  assert.ok(!isSakura({ ...base, mode: '2p' }, 0), '2P対戦では解禁されない');
  assert.ok(!isSakura({ ...base, teamMode: true }, 0), 'チーム戦では解禁されない');
});

test('掛け合いは全キャラ分あり、鏡合わせも用意されている', () => {
  for (const id of CHAR_ORDER) {
    const list = INTRO_PAIRS[pairKey(id, 'sakura')];
    assert.ok(list && list.length >= 5, `${id} との掛け合いが少ない: ${list?.length ?? 0}`);
    for (const line of list) {
      assert.ok(line.a.trim() && line.b.trim(), `${id}|sakura に空の台詞`);
    }
  }
  assert.ok(MIRROR_INTROS.sakura && MIRROR_INTROS.sakura.a.trim() && MIRROR_INTROS.sakura.b.trim());
});

test('櫻 vs 全キャラ（AI同士・偏差値100）が完走し、同じシードなら同じ結果になる', () => {
  for (const opp of ALL_CHARS as readonly CharId[]) {
    // 最大 3 ラウンド × 99 秒 + 演出ぶん
    const a = run({ p2: opp, seed: 7 }, 60 * 340);
    const c = run({ p2: opp, seed: 7 }, 60 * 340);
    assert.equal(a.stateHash(), c.stateHash(), `nondeterministic vs ${opp}`);
    assert.equal(a.phase, 'matchEnd', `vs ${opp} が時間内に終わらない`);
  }
});

test('シュレディンガーの好意：設置→観測で崩壊し、実存的崩壊で「理論のない状態の恋」になる', () => {
  let placed = false;
  let collapsed = false;
  let superSeen = false;
  let loveSeen = false;
  const b = run({ ai: [false, true], difficulty: 'easy', seed: 3 }, 60 * 90, (t, b) => {
    const me = b.f[0];
    const inp: InputState = { ...EMPTY_INPUT };
    // 告白で K.O. した場合、バフは K.O. 演出中に付くのでフェーズを問わず見る
    if (b.projectiles.some((p) => p.kind === 'koi')) placed = true;
    if (b.texts.some((x) => x.text === '波動関数、崩壊')) collapsed = true;
    if (me.state === 'super') superSeen = true;
    if (me.loveT > 0) loveSeen = true;
    if (b.phase !== 'fight') return [inp, EMPTY_INPUT];
    if (me.meter >= 100 && me.state === 'idle') inp.super = true;
    else if (t % 90 === 0 || t % 90 === 45) inp.special = true; // 設置 / 観測
    else if (t % 7 === 0) inp.light = true;
    else if (t % 11 === 0) inp.heavy = true;
    else inp.right = true;
    return [inp, EMPTY_INPUT];
  });
  assert.ok(placed, '好意（罠）が設置される');
  assert.ok(collapsed, '観測で崩壊する');
  assert.ok(superSeen, '超必殺が出る');
  assert.ok(loveSeen, '理論のない状態の恋バフが付く');
  assert.ok(b.f[0].research >= 0 && b.f[0].research <= 15, '研究データ n は 0..15');
});

test('チーム戦で両チームに櫻がいても完走する', () => {
  const b = new Battle({
    p1: 'sakura',
    p2: 'mie',
    ai: [true, true],
    difficulty: 'hard',
    stage: 'lake',
    seed: 99,
    fighters: [
      { char: 'sakura', team: 0, ai: true },
      { char: 'rei', team: 0, ai: true },
      { char: 'sakura', team: 1, ai: true },
      { char: 'mitsumine', team: 1, ai: true },
    ],
  });
  for (let i = 0; i < 60 * 240 && b.phase !== 'matchEnd'; i++) b.step([]);
  assert.equal(b.phase, 'matchEnd');
});
