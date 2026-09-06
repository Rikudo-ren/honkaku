import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHARS, DEFAULT_TEAM_SLOTS, HIDDEN_META, INTRO_PAIRS, MIRROR_INTROS, pairKey } from '../src/game/characters';
import { Battle } from '../src/game/engine';
import { EMPTY_INPUT, MAX_FIGHTERS } from '../src/game/types';
import type { CharId } from '../src/game/types';

/** 覚醒三重が絡む全ペア（ロスターの他の全員） */
const OTHERS: CharId[] = ['mie', 'mitsumine', 'naito', 'rei', 'ryoma', 'sakura', 'terachi', 'heikatsu'];

const run = (p1: CharId, p2: CharId, seed: number) => {
  const b = new Battle({ p1, p2, ai: [true, true], difficulty: 'extreme', stage: 'classroom', seed });
  for (let i = 0; i < 60 * 340; i++) {
    b.step([EMPTY_INPUT, EMPTY_INPUT]);
    if (b.phase === 'matchEnd') break;
  }
  return b;
};

test('覚醒三重はロスター全員と専用掛け合いを持つ（通夜→現場の誤読は入っていない）', () => {
  for (const other of OTHERS) {
    const list = INTRO_PAIRS[pairKey('kakusei', other)];
    assert.ok(list && list.length >= 2, `${other} との掛け合いが足りない: ${list?.length ?? 0}`);
    for (const line of list) {
      assert.ok(line.a.trim() && line.b.trim(), `${other} との掛け合いに空の台詞`);
      assert.ok(line.first === 'kakusei' || line.first === other, `${other} の掛け合いの first が不正: ${line.first}`);
      assert.ok(!/通夜/.test(line.a + line.b + (line.note ?? '')), `${other} の掛け合いに「通夜」が残っている`);
      assert.equal(line.note, undefined, `${other} の掛け合いにカッコの補足はいらない`);
    }
  }
  // 覚醒三重自身の汎用セリフ・説明文にも「通夜を経て現場へ戻る男」の読みが残っていないこと
  assert.ok(!/通夜/.test(CHARS.kakusei.intro), 'kakusei.intro に「通夜」が残っている');
  assert.ok(!/通夜/.test(CHARS.kakusei.desc), 'kakusei.desc に「通夜」が残っている');
  const meta = HIDDEN_META.find((m) => m.id === 'kakusei');
  assert.ok(meta && !/通夜/.test(meta.sub + meta.byline), 'kakusei の解禁演出に「通夜」が残っている');
  // 葬儀（三峰の式）へ向かう男として書かれていること
  assert.ok(/葬儀|葬式/.test(CHARS.kakusei.desc), 'desc は葬儀の場を指していない');
  assert.ok(CHARS.kakusei.title.includes('葬式'), 'title は葬式を指していない');
  const mirror = MIRROR_INTROS.kakusei;
  assert.ok(mirror && mirror.a.trim() && mirror.b.trim());
  assert.ok(!/通夜/.test(mirror.a + mirror.b), '自己対話に「通夜」が残っている');
});

test('覚醒三重 vs 三峰瑠衣：三峰は死んでいるので何も返さない（覚醒三重が謝る）', () => {
  const list = INTRO_PAIRS[pairKey('kakusei', 'mitsumine')];
  assert.ok(list && list.length >= 1);
  for (const line of list) {
    assert.equal(line.first, 'kakusei', '三峰は口を開かない（先に言うのは覚醒三重だけ）');
    assert.equal(line.b, '……', '三峰の応答は無言');
  }
  assert.ok(list.some((l) => l.a === '……ごめん'), '「……ごめん」が入っていない');
});

test('覚醒三重 vs 数理零：葬儀での断定と、はぐらかしがそのまま入っている', () => {
  const list = INTRO_PAIRS[pairKey('kakusei', 'rei')];
  assert.ok(list);
  assert.ok(list.some((l) => l.first === 'kakusei' && l.a === 'お前が、三峰を殺したんだろ' && l.b === '……何のことかな？'));
});

test('覚醒三重 vs 三重県臣（AI同士・偏差値100）が完走し、同じシードなら同じ結果になる', () => {
  for (const other of OTHERS) {
    const a = run('kakusei', other, 11);
    const b = run('kakusei', other, 11);
    assert.equal(a.stateHash(), b.stateHash(), `nondeterministic vs ${other}`);
    assert.equal(a.phase, 'matchEnd', `vs ${other} が時間内に終わらない`);
  }
});

test('乱戦の初期編成は「1P 1人＋CPU多数」（デフォで 2P は立てない）', () => {
  assert.ok(DEFAULT_TEAM_SLOTS.length >= 2 && DEFAULT_TEAM_SLOTS.length <= MAX_FIGHTERS);
  const humans = DEFAULT_TEAM_SLOTS.filter((s) => s.ctrl === 'p1');
  assert.equal(humans.length, 1, '操作できるのは 1P の 1人だけ');
  assert.ok(
    DEFAULT_TEAM_SLOTS.every((s) => s.ctrl === 'p1' || s.ctrl === 'cpu'),
    '初期編成は 1P か CPU のみ（2P は立てない）'
  );
  assert.ok(
    DEFAULT_TEAM_SLOTS.some((s) => s.ctrl === 'cpu') && DEFAULT_TEAM_SLOTS.filter((s) => s.ctrl === 'cpu').length >= 2,
    'CPU が多数いない'
  );
  const teams = new Set(DEFAULT_TEAM_SLOTS.map((s) => s.team));
  assert.equal(teams.size, 2, '両チームに人が必要');
});
