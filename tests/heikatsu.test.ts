import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ALL_CHARS, CHARS, CHAR_ORDER, HIDDEN_CHARS, HIDDEN_META, INTRO_PAIRS, MIRROR_INTROS, pairKey, rosterFor, NO_HIDDEN } from '../src/game/characters';
import { Battle } from '../src/game/engine';
import { EMPTY_INPUT } from '../src/game/types';
import type { CharId, InputState, Setup, Side } from '../src/game/types';
import { hiddenCharsSatisfied } from '../src/game/characters';

type BattleOpts = ConstructorParameters<typeof Battle>[0];

const satisfied = (setup: Setup, winner: Side): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  for (const m of hiddenCharsSatisfied(NO_HIDDEN, setup, winner)) out[m.id] = true;
  return out;
};

const run = (opts: Partial<BattleOpts>, frames: number, inputs?: (t: number, b: Battle) => InputState[]) => {
  const b = new Battle({ p1: 'heikatsu', p2: 'mie', ai: [true, true], difficulty: 'extreme', stage: 'classroom', seed: 42, ...opts });
  for (let i = 0; i < frames; i++) {
    b.step(inputs ? inputs(i, b) : [EMPTY_INPUT, EMPTY_INPUT]);
    if (b.phase === 'matchEnd') break;
  }
  return b;
};

test('塀勝也の解禁条件：1P対CPU・自分と同じキャラ（鏡像）で偏差値100に勝つ', () => {
  const base: Setup = { mode: '1p', p1: 'mie', p2: 'mie', difficulty: 'extreme', stage: 'classroom' };
  const isHeikatsu = (s: Setup, w: Side) => !!satisfied(s, w)['heikatsu'];
  assert.ok(isHeikatsu(base, 0));
  assert.ok(!isHeikatsu(base, 1), '負けたら解禁されない');
  assert.ok(!isHeikatsu({ ...base, p2: 'ryoma' }, 0), '相手が自分と違うと解禁されない（鏡像でなくては）');
  assert.ok(!isHeikatsu({ ...base, difficulty: 'hard' }, 0), '偏差値85では解禁されない');
  assert.ok(!isHeikatsu({ ...base, mode: '2p' }, 0), '2P対戦では解禁されない');
  assert.ok(!isHeikatsu({ ...base, mode: 'cpu' }, 0), '自己対話（CPU同士）では解禁されない');
  assert.ok(!isHeikatsu({ ...base, teamMode: true }, 0), 'チーム戦では解禁されない');
});

test('塀勝也は櫻と覚醒三重の間の隠しキャラ（並び順が sakura→heikatsu→kakusei）', () => {
  assert.deepEqual(HIDDEN_CHARS, ['sakura', 'heikatsu', 'kakusei']);
  assert.deepEqual(rosterFor({ sakura: true, heikatsu: true, kakusei: true }), [...CHAR_ORDER, 'sakura', 'heikatsu', 'kakusei']);
  assert.equal(HIDDEN_META.find((m) => m.id === 'heikatsu')?.key, 'honkaku_heikatsu_unlocked');
});

test('生徒は全員、塀先生に敬語で話す（覚醒三重×ヘイカツのみ motoneta2 の文言）', () => {
  for (const other of CHAR_ORDER) {
    const list = INTRO_PAIRS[pairKey(other, 'heikatsu')];
    assert.ok(list && list.length >= 4, `${other} との掛け合いが少ない: ${list?.length ?? 0}`);
    for (const line of list) {
      // 生徒役の台詞（first が他キャラなら a、first が heikatsu なら b）を敬語で
      const studentLine = line.first === 'heikatsu' ? line.b : line.a;
      assert.ok(/(です|ます|ました|でした|ましょう|ください|ません|ですか)/.test(studentLine), `${other} の生徒台詞が敬語でない: ${studentLine}`);
      if (line.first === other) {
        // 生徒から先に言うときも最後は先生に対する語尾 or 丁寧体
        assert.ok(/です|ます|ました|でした|でしょう|ますか|ください/.test(line.a), `${other} の先手台詞が敬語でない: ${line.a}`);
      }
    }
  }
  // 覚醒三重（旧・三重県臣）との掛け合いは motoneta2 由来の語彙を含む
  const kaku = INTRO_PAIRS[pairKey('heikatsu', 'kakusei')];
  assert.ok(kaku && kaku.length >= 3, `kakusei との掛け合いが少ない: ${kaku?.length ?? 0}`);
  const all = kaku.map((l) => l.a + l.b + (l.note ?? '')).join('');
  assert.ok(/治水工事/.test(all), '「治水工事」が入っていない');
  assert.ok(/人命救助/.test(all), '「人命救助」が入っていない');
  assert.ok(/低い方へ流れる/.test(all), '「水は低い方へ流れる」が入っていない');
  // 覚醒三重はヘイカツにも敬語
  for (const line of kaku) {
    const studentLine = line.first === 'heikatsu' ? line.b : line.a;
    assert.ok(/(です|ます|ました|でしょう|ますか)/.test(studentLine), `kakusei の台詞が敬語でない: ${studentLine}`);
  }
});

test('塀勝也 vs 全キャラ（AI同士・偏差値100）が完走し、同じシードなら同じ結果になる', () => {
  for (const opp of ALL_CHARS as readonly CharId[]) {
    const a = run({ p2: opp, seed: 7 }, 60 * 340);
    const c = run({ p2: opp, seed: 7 }, 60 * 340);
    assert.equal(a.stateHash(), c.stateHash(), `nondeterministic vs ${opp}`);
    assert.equal(a.phase, 'matchEnd', `vs ${opp} が時間内に終わらない`);
  }
});

test('防災マップ：図の上に立つと読まれて鈍り、超必殺「地面は忘れない」も出る', () => {
  let chisenSeen = false;
  let readSeen = false;
  let superSeen = false;
  const b = run({ ai: [false, true], difficulty: 'easy', seed: 3 }, 60 * 120, (t, b) => {
    const me = b.f[0];
    const foe = b.f[1];
    const inp: InputState = { ...EMPTY_INPUT };
    if (b.projectiles.some((p) => p.kind === 'chisen' && p.owner === 0)) chisenSeen = true;
    if (foe.readT > 0) readSeen = true;
    if (me.state === 'super') superSeen = true;
    if (b.phase !== 'fight') return [inp, EMPTY_INPUT];
    if (me.meter >= 100 && me.state === 'idle') inp.super = true;
    else if (t % 100 === 0) inp.special = true;
    else if (t % 7 === 0) inp.light = true;
    else if (t % 13 === 0) inp.heavy = true;
    else if (t % 31 === 0) inp.up = true;
    else inp.right = true;
    return [inp, EMPTY_INPUT];
  });
  assert.ok(chisenSeen, '防災マップが設置されない');
  assert.ok(readSeen, '防災マップが相手を読んでいない');
  assert.ok(superSeen, '超必殺が出ない');
});

test('防災マップ：図の上に留まり続けると「発災」し、16ダメージ＋吹き飛び', () => {
  const b = new Battle({
    p1: 'heikatsu',
    p2: 'mie',
    ai: [false, false],
    difficulty: 'easy',
    stage: 'classroom',
    seed: 9,
  });
  for (let i = 0; i < 200 && b.phase !== 'fight'; i++) b.step([EMPTY_INPUT, EMPTY_INPUT]);
  assert.equal(b.phase, 'fight');
  // 自分と相手を近付けて固定し、必殺を撃つ
  b.f[0].x = 120;
  b.f[0].facing = 1;
  b.f[1].x = 150;
  b.f[1].state = 'idle';
  b.f[1].hp = 100;
  let mapSeen = false;
  const hpBefore = b.f[1].hp;
  for (let i = 0; i < 60 * 4; i++) {
    const p = b.projectiles.find((x) => x.kind === 'chisen');
    if (p) {
      mapSeen = true;
      // 相手を図の上に留まらせる（動かさない）
      b.f[1].x = p.x;
      b.f[1].vx = 0;
    }
    b.step([b.f[0].state === 'idle' ? { ...EMPTY_INPUT, special: true } : EMPTY_INPUT, EMPTY_INPUT]);
  }
  assert.ok(mapSeen, '防災マップが設置されない');
  assert.ok(b.f[1].hp < hpBefore, `発災していない（hp ${hpBefore}→${b.f[1].hp}）`);
});

test('防災マップ：誰も乗っていなくても時間が来れば必ず発災する（時限爆弾）', () => {
  const b = new Battle({
    p1: 'heikatsu',
    p2: 'mie',
    ai: [false, false],
    difficulty: 'easy',
    stage: 'classroom',
    seed: 11,
  });
  for (let i = 0; i < 200 && b.phase !== 'fight'; i++) b.step([EMPTY_INPUT, EMPTY_INPUT]);
  assert.equal(b.phase, 'fight');
  // 相手を画面右端に立たせて必殺を撃つ（マップは相手の現在地に置かれる）
  b.f[0].x = 60;
  b.f[0].facing = 1;
  b.f[1].x = 320;
  b.f[1].state = 'idle';
  b.f[1].hp = 100;
  let mapX = -1;
  for (let i = 0; i < 60 * 2 && mapX < 0; i++) {
    const p = b.projectiles.find((x) => x.kind === 'chisen' && x.owner === 0);
    if (p) mapX = p.x;
    b.step([b.f[0].state === 'idle' ? { ...EMPTY_INPUT, special: true } : EMPTY_INPUT, EMPTY_INPUT]);
  }
  assert.ok(mapX > 0, '防災マップが設置されない');
  // 相手をマップから遠ざけて、誰も乗っていない状態で待つ
  for (let i = 0; i < 60 * 3; i++) {
    b.f[1].x = 60; // マップ（右端）の上に乗せない
    b.f[1].vx = 0;
    b.step([EMPTY_INPUT, EMPTY_INPUT]);
  }
  assert.ok(!b.projectiles.some((x) => x.kind === 'chisen' && x.owner === 0), '時間が来ても発災しない');
  assert.equal(b.f[1].hp, 100, '乗っていない相手が発災に巻き込まれた');
});

test('塀勝也 vs 覚醒三重の掛け合い：motoneta2 の語彙を含み、傷ついた跡も描かない', () => {
  const list = INTRO_PAIRS[pairKey('heikatsu', 'kakusei')];
  assert.ok(list);
  for (const line of list) {
    assert.equal(line.note, undefined, '覚醒三重の掛け合いにカッコの補足はいらない');
    assert.ok(line.first === 'heikatsu' || line.first === 'kakusei');
  }
});

test('塀勝也の超必殺：地面の相手だけ吹き飛ばし、空中の相手は無傷（「地面は忘れない」）', () => {
  const b = new Battle({
    p1: 'heikatsu',
    p2: 'mie',
    ai: [false, false],
    difficulty: 'easy',
    stage: 'lake',
    seed: 5,
    fighters: [
      { char: 'heikatsu', team: 0, ai: false },
      { char: 'mie', team: 1, ai: false },
      { char: 'ryoma', team: 1, ai: false },
    ],
  });
  // フェーズを fight まで進める
  for (let i = 0; i < 200 && b.phase !== 'fight'; i++) b.step([EMPTY_INPUT, EMPTY_INPUT, EMPTY_INPUT]);
  assert.equal(b.phase, 'fight');
  // 相手1体目（mie）は地面に、2体目（ryoma）は空中に置く
  b.f[1].y = 186;
  b.f[1].state = 'idle';
  b.f[1].hp = 100;
  b.f[2].y = 100;
  b.f[2].state = 'jump';
  b.f[2].hp = 100;
  // 自分は超必殺を撃てるようにする
  b.f[0].meter = 100;
  const inp = { ...EMPTY_INPUT };
  const hp1 = b.f[1].hp;
  const hp2 = b.f[2].hp;
  let superStarted = false;
  for (let i = 0; i < 240; i++) {
    b.step([b.f[0].state === 'idle' ? { ...inp, super: true } : EMPTY_INPUT, EMPTY_INPUT, EMPTY_INPUT]);
    if (b.f[0].state === 'super') superStarted = true;
    if (superStarted && b.f[0].state !== 'super') break;
  }
  assert.ok(superStarted, '超必殺が発動しない');
  assert.ok(b.f[1].hp < hp1, `地面にいた相手が無傷（hp ${hp1}→${b.f[1].hp}）`);
  assert.equal(b.f[2].hp, hp2, '空中にいた相手がダメージを受けた');
});

