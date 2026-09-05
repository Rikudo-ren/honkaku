import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Battle } from '../src/game/engine';
import { CHARS, CHAR_ORDER, INTRO_PAIRS, MATCHUP_SCRIPTS, pairKey } from '../src/game/characters';
import { isSakuraUnlockWin, unlockedChars } from '../src/game/unlocks';
import { EMPTY_INPUT } from '../src/game/types';
import type { CharId, Difficulty, Mode, Setup } from '../src/game/types';

const setup = (p: Partial<Setup>): Setup => ({
  mode: '1p' as Mode,
  difficulty: 'normal' as Difficulty,
  p1: 'mie',
  p2: 'ryoma',
  stage: 'classroom',
  ...p,
});

// ───────────────── 解放条件 ─────────────────

test('櫻優は偏差値100の内藤蘭に1Pで勝ったときだけ解放される', () => {
  // 条件を満たす：1P対戦・偏差値100・相手が内藤・1Pの勝ち
  assert.equal(isSakuraUnlockWin(setup({ mode: '1p', difficulty: 'extreme', p2: 'naito' }), 0), true);
  // 負けたら解放されない
  assert.equal(isSakuraUnlockWin(setup({ mode: '1p', difficulty: 'extreme', p2: 'naito' }), 1), false);
  // 偏差値が足りない
  assert.equal(isSakuraUnlockWin(setup({ mode: '1p', difficulty: 'hard', p2: 'naito' }), 0), false);
  // 相手が内藤じゃない
  assert.equal(isSakuraUnlockWin(setup({ mode: '1p', difficulty: 'extreme', p2: 'rei' }), 0), false);
  // 1対1（1P対戦）じゃない（チーム戦）
  assert.equal(isSakuraUnlockWin(setup({ mode: 'team', difficulty: 'extreme', p2: 'naito', teamMode: true }), 0), false);
  // 2P対戦・自己対話は対象外
  assert.equal(isSakuraUnlockWin(setup({ mode: '2p', difficulty: 'extreme', p2: 'naito' }), 0), false);
  assert.equal(isSakuraUnlockWin(setup({ mode: 'cpu', difficulty: 'extreme', p2: 'naito' }), 0), false);
});

test('隠しキャラは未解放のうちは一覧に出ない', () => {
  assert.equal(unlockedChars(false).includes('sakura'), false);
  assert.equal(unlockedChars(false).length, CHAR_ORDER.length - 1);
  assert.deepEqual(unlockedChars(true), CHAR_ORDER);
  assert.equal(CHARS.sakura.hidden, true);
  // 通常キャラは常に出る
  for (const id of ['mie', 'ryoma', 'naito', 'mitsumine', 'terachi', 'rei'] as CharId[]) {
    assert.equal(unlockedChars(false).includes(id), true);
  }
});

// ───────────────── キャラ定義・掛け合いデータの整合性 ─────────────────

test('櫻優のキャラ定義は他キャラと同じ項目を備えている', () => {
  const s = CHARS.sakura;
  assert.equal(s.id, 'sakura');
  assert.equal(s.name, '櫻優');
  assert.equal(s.tie, '紺');
  assert.equal(s.tieColor, '#2f4f8f'); // 内進＝紺のネクタイ
  assert.equal(s.look.glasses, true);
  assert.equal(s.look.accessory, 'notebook');
  for (const key of ['light', 'heavy', 'special'] as const) {
    assert.ok(s.moves[key].name.length > 0, key);
    assert.ok(s.moves[key].callout && s.moves[key].callout!.length > 0, key);
  }
  assert.ok(s.wins.length >= 3);
  assert.ok(s.superName.length > 0 && s.superQuote.length > 0 && s.superDesc.length > 0);
});

test('櫻優は全キャラと試合前・試合後の掛け合いを持つ', () => {
  const others: CharId[] = ['mie', 'ryoma', 'naito', 'mitsumine', 'terachi', 'rei'];
  for (const id of others) {
    const key = pairKey('sakura', id);
    const intro = INTRO_PAIRS[key];
    assert.ok(intro, `INTRO_PAIRS missing: ${key}`);
    assert.ok([intro.a, intro.b].every((l) => l.length > 0), `empty line: ${key}`);
    assert.ok(intro.first === 'sakura' || intro.first === id, `first must be one of the pair: ${key}`);
    assert.ok(intro.c, `二往復目が無い: ${key}`);

    assert.ok(intro.final, `最終ラウンド用の掛け合いが無い: ${key}`);
    assert.ok(intro.final!.a.length > 0 && intro.final!.b.length > 0, `empty final line: ${key}`);

    const script = MATCHUP_SCRIPTS[key];
    assert.ok(script, `MATCHUP_SCRIPTS missing: ${key}`);
    assert.ok(script.first === 'sakura' || script.first === id, `first must be one of the pair: ${key}`);
    assert.ok(script.lines.length >= 4, `掛け合いが短すぎる: ${key}`);
    assert.ok(script.note && script.note.length > 0, `note missing: ${key}`);
  }
});

test('掛け合いデータのキーはすべて「辞書順ペア」の形式になっている', () => {
  const check = (table: Record<string, { first: CharId }>, label: string) => {
    for (const [key, value] of Object.entries(table)) {
      const ids = key.split('|') as CharId[];
      assert.equal(ids.length, 2, `${label}: ${key}`);
      for (const id of ids) assert.ok(CHAR_ORDER.includes(id), `${label}: unknown char ${id}`);
      assert.deepEqual([...ids].sort(), ids, `${label}: key must be sorted: ${key}`);
      assert.ok(ids.includes(value.first), `${label}: first not in pair: ${key}`);
    }
  };
  check(INTRO_PAIRS, 'INTRO_PAIRS');
  check(MATCHUP_SCRIPTS, 'MATCHUP_SCRIPTS');
});

// ───────────────── バトル自体の検証 ─────────────────

function runSakuraMatch(seed: number, inputs: (frame: number) => typeof EMPTY_INPUT[]) {
  const battle = new Battle({
    p1: 'sakura',
    p2: 'naito',
    stage: 'classroom',
    difficulty: 'normal',
    seed,
    ai: [false, true],
  });
  const hashes: number[] = [];
  let maxNotes = 0;
  for (let frame = 0; frame < 900; frame++) {
    battle.step(inputs(frame));
    maxNotes = Math.max(maxNotes, battle.projectiles.filter((p) => p.kind === 'note').length);
    hashes.push(battle.stateHash());
  }
  return { battle, hashes, maxNotes };
}

test('櫻優は通常技・必殺技・超必殺技が決定的に動く（同じ種子なら同じ結果）', () => {
  // 弱→強→必殺→超必殺（ゲージを満タンにしてから）を順に入力する
  const inputs = (frame: number) => {
    const superReady = frame > 200;
    const inp = { ...EMPTY_INPUT };
    if (superReady && frame % 240 === 0) inp.super = true; // 超必殺
    else if (frame % 7 === 0) inp.light = true;
    else if (frame % 11 === 0) inp.heavy = true;
    else if (frame % 13 === 0) inp.special = true;
    return [inp, { ...EMPTY_INPUT }];
  };
  const a = runSakuraMatch(20260401, inputs);
  const b = runSakuraMatch(20260401, inputs);
  assert.deepEqual(a.hashes, b.hashes, '同じ種子・同じ入力なら状態は一致する');
  assert.ok(a.maxNotes >= 1, '必殺技（シュレディンガーの好意）でノートが飛ぶ');
  assert.ok(a.battle.f[0].hp <= CHARS.sakura.hp);
  assert.ok(a.battle.f[1].hp < CHARS.naito.hp || a.battle.f[0].hp < CHARS.sakura.hp, '900フレームで何らかのダメージが入る');
});

test('櫻優の超必殺は複数ページのノートを飛ばして相手の理論を崩壊させる', () => {
  const battle = new Battle({
    p1: 'sakura',
    p2: 'naito',
    stage: 'classroom',
    difficulty: 'normal',
    seed: 424242,
    ai: [false, false],
  });
  // イントロを消化してゲージを満タンにする
  for (let i = 0; i < 120; i++) battle.step([{ ...EMPTY_INPUT }, { ...EMPTY_INPUT }]);
  battle.f[0].meter = 100;
  battle.f[1].x = battle.f[0].x + 96;
  let sawSuper = false;
  // ノートは当たると消えるので、同時数ではなく「生成された枚数」を数える
  const pages = new Set<unknown>();
  for (let i = 0; i < 220; i++) {
    battle.step([{ ...EMPTY_INPUT, super: i === 0 }, { ...EMPTY_INPUT }]);
    if (battle.f[0].state === 'super') sawSuper = true;
    for (const p of battle.projectiles) if (p.kind === 'note') pages.add(p);
  }
  assert.ok(sawSuper, '超必殺が発動する');
  assert.ok(pages.size >= 5, `研究ノートのページが飛ぶ（観測: ${pages.size}枚）`);
  assert.ok(battle.f[1].hp < CHARS.naito.hp, '観測された相手はダメージを受ける');
});

test('最終ラウンド（1勝1敗の3本目）は専用の掛け合いに差し替わる', () => {
  const battle = new Battle({
    p1: 'sakura',
    p2: 'naito',
    stage: 'classroom',
    difficulty: 'normal',
    seed: 7,
    ai: [false, false],
  });
  const pair = INTRO_PAIRS[pairKey('sakura', 'naito')];
  // 1勝1敗の状態からラウンドを開始させる（内部状態なのでテストからのみ触る）
  const raw = battle as unknown as { wins: [number, number]; startRound: () => void };
  raw.wins = [1, 1];
  raw.startRound();
  for (let i = 0; i < 10; i++) battle.step([{ ...EMPTY_INPUT }, { ...EMPTY_INPUT }]);
  const said = battle.bubbles.map((b) => b.text);
  assert.ok(said.includes(pair.final!.a), `最終ラウンド用のセリフが出ない: ${said.join(' / ')}`);
  assert.equal(said.includes(pair.a), false, '通常ラウンドのセリフは出ない');
});
