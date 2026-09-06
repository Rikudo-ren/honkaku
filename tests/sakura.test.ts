import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_CHARS, CHARS, CHAR_ORDER, HIDDEN_CHARS, INTRO_PAIRS, MIRROR_INTROS, pairKey, rosterFor } from '../src/game/characters';
import { Battle } from '../src/game/engine';
import { EMPTY_INPUT } from '../src/game/types';
import type { CharId, InputState, Setup } from '../src/game/types';
import { isSakuraUnlockMatch } from '../src/game/unlock';

type BattleOpts = ConstructorParameters<typeof Battle>[0];

const run = (opts: Partial<BattleOpts>, frames: number, inputs?: (t: number, b: Battle) => InputState[]) => {
  const b = new Battle({ p1: 'sakura', p2: 'naito', ai: [true, true], difficulty: 'extreme', stage: 'classroom', seed: 42, ...opts });
  for (let i = 0; i < frames; i++) {
    b.step(inputs ? inputs(i, b) : [EMPTY_INPUT, EMPTY_INPUT]);
    if (b.phase === 'matchEnd') break;
  }
  return b;
};

test('櫻優は隠しキャラ：通常ロスターには出ず、解禁すると末尾に追加される', () => {
  assert.ok(!CHAR_ORDER.includes('sakura'));
  assert.deepEqual(HIDDEN_CHARS, ['sakura']);
  assert.deepEqual(rosterFor(false), CHAR_ORDER);
  assert.deepEqual(rosterFor(true), [...CHAR_ORDER, 'sakura']);
  assert.deepEqual(ALL_CHARS, [...CHAR_ORDER, ...HIDDEN_CHARS]);
  assert.equal(CHARS.sakura.hidden, true);
  assert.equal(CHARS.sakura.look.tieColor, '#2f4f8f', '内進コースなのでネクタイは紺');
});

test('解禁条件：1P対CPU・偏差値100の内藤蘭に勝つ', () => {
  const base: Setup = { mode: '1p', p1: 'mie', p2: 'naito', difficulty: 'extreme', stage: 'classroom' };
  assert.ok(isSakuraUnlockMatch(base, 0));
  assert.ok(!isSakuraUnlockMatch(base, 1), '負けたら解禁されない');
  assert.ok(!isSakuraUnlockMatch({ ...base, difficulty: 'hard' }, 0), '偏差値85では解禁されない');
  assert.ok(!isSakuraUnlockMatch({ ...base, p2: 'mie' }, 0), '相手が内藤でないと解禁されない');
  assert.ok(!isSakuraUnlockMatch({ ...base, mode: '2p' }, 0), '2P対戦では解禁されない');
  assert.ok(!isSakuraUnlockMatch({ ...base, teamMode: true }, 0), 'チーム戦では解禁されない');
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
