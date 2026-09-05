import assert from 'node:assert/strict';
import { test } from 'node:test';
import { makeOnlineSetup } from '../src/game/onlineSetup';
import type { StartData, StartFighter } from '../src/game/net';

const human: StartFighter = { char: 'mie', team: 0, sessionId: 'host', aiDifficulty: 'normal', name: 'ホスト' };
const other: StartFighter = { char: 'ryoma', team: 1, sessionId: 'guest', aiDifficulty: 'normal', name: 'ゲスト' };
const ai: StartFighter = { char: 'rei', team: 1, sessionId: null, aiDifficulty: 'hard', name: null };
const start = (fighters: StartFighter[]): StartData => ({ matchId: 3, inputDelay: 5, seed: 123, stage: 'classroom', fighters });

test('a two-fighter private match keeps its AI instead of waiting for a nonexistent human', () => {
  const setup = makeOnlineSetup(start([human, ai]), 'host');
  assert.equal(setup.teamMode, true);
  assert.equal(setup.mySlot, 0);
  assert.deepEqual(setup.fighters?.map((f) => f.ai), [false, true]);
  assert.equal(setup.fighters?.[1].aiDifficulty, 'hard');
  assert.equal(setup.fighters?.[0].you, true);
});

test('ordinary two-human quick matches retain the duel layout', () => {
  const setup = makeOnlineSetup(start([human, other]), 'guest');
  assert.equal(setup.teamMode, false);
  assert.equal(setup.onlineSide, 1);
  assert.equal(setup.p1, 'mie');
  assert.equal(setup.p2, 'ryoma');
  assert.equal(setup.seed, 123);
  assert.equal(setup.onlineMatchId, 3);
  assert.deepEqual(setup.onlineNames, ['ホスト', 'ゲスト']);
});

test('swapping teams in a private duel does not swap input ownership or override teams', () => {
  const setup = makeOnlineSetup(start([{ ...human, team: 1 }, { ...other, team: 0 }]), 'host');
  assert.equal(setup.teamMode, true);
  assert.equal(setup.onlineSide, 1);
  assert.equal(setup.mySlot, 0);
  assert.deepEqual(setup.fighters?.map((f) => f.team), [1, 0]);
  assert.equal(setup.p1, 'ryoma');
  assert.equal(setup.p2, 'mie');
});

test('larger mixed matches preserve all server slots, difficulty and ownership', () => {
  const setup = makeOnlineSetup(start([human, other, ai, { ...ai, team: 0 }]), 'guest');
  assert.equal(setup.teamMode, true);
  assert.equal(setup.mySlot, 1);
  assert.deepEqual(setup.fighters?.map((f) => f.ai), [false, false, true, true]);
  assert.deepEqual(setup.fighters?.map((f) => f.you), [false, true, false, false]);
});

test('a missing session never silently takes control of slot zero', () => {
  assert.throws(() => makeOnlineSetup(start([human, other]), null), /参加者情報/);
});
