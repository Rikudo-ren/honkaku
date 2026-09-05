import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InputRelay, INPUT_GRACE_MS, MAX_PENDING_FRAMES } from '../server/src/rooms/InputRelay';

function makeRelay(slots = [0, 1], delay = 5) {
  const inputs: [number, number, number][] = [];
  const lag: number[][] = [];
  const relay = new InputRelay(slots, delay, (f, s, m) => inputs.push([f, s, m]), (s) => lag.push(s));
  return { relay, inputs, lag };
}

test('wall time never finalizes inputs that nobody has requested', () => {
  const { relay, inputs, lag } = makeRelay();
  relay.receive(5, 0, 1, 0);
  relay.receive(5, 1, 2, 0);
  relay.tick(60_000);
  assert.deepEqual(inputs, [[5, 0, 1], [5, 1, 2]]);
  assert.deepEqual(lag, []);
  assert.equal(relay.receive(6, 0, 16, 60_001), true);
  assert.equal(relay.receive(6, 1, 32, 60_021), true);
  relay.tick(61_000);
  assert.deepEqual(inputs.slice(-2), [[6, 0, 16], [6, 1, 32]]);
  assert.deepEqual(lag, []);
});

test('one player skipping the VS screen does not time out the other player', () => {
  const { relay, inputs, lag } = makeRelay();
  for (let frame = 5; frame <= 10; frame++) relay.receive(frame, 0, 1, frame * 16);
  relay.tick(3_600);
  assert.equal(inputs.length, 6);
  assert.deepEqual(lag, []);
  relay.receive(5, 1, 2, 3_601);
  relay.tick(3_602);
  assert.equal(inputs.length, 7, 'the old pending rows must get a fresh grace period');
  for (let frame = 6; frame <= 10; frame++) relay.receive(frame, 1, 2, 3_602 + frame * 10);
  relay.tick(5_000);
  assert.equal(inputs.length, 12);
  assert.equal(inputs.some(([, , mask]) => mask === 0), false);
  assert.deepEqual(lag, []);
});

test('a missing input is neutralized once; late input cannot overwrite it; recovery clears lag', () => {
  const { relay, inputs, lag } = makeRelay();
  relay.receive(5, 0, 1, 0);
  relay.receive(5, 1, 2, 0);
  relay.receive(6, 0, 16, 50);
  relay.tick(50 + INPUT_GRACE_MS - 1);
  assert.equal(inputs.length, 3);
  relay.tick(50 + INPUT_GRACE_MS);
  assert.deepEqual(inputs.at(-1), [6, 1, 0]);
  assert.deepEqual(lag, [[1]]);
  assert.equal(relay.receive(6, 1, 32, 310), false);
  assert.deepEqual(inputs.at(-1), [6, 1, 0]);
  assert.deepEqual(lag, [[1], []]);
  assert.equal(relay.receive(7, 1, 32, 311), true);
  assert.equal(relay.receive(7, 0, 16, 312), true);
  relay.tick(10_000);
  assert.deepEqual(inputs.slice(-2), [[7, 1, 32], [7, 0, 16]]);
  assert.deepEqual(lag, [[1], []]);
});

test('an inactive player does not impose a fresh full timeout on every frame', () => {
  const { relay, inputs } = makeRelay();
  relay.receive(5, 0, 1, 0);
  relay.receive(5, 1, 2, 0);
  relay.receive(6, 0, 1, 50);
  relay.tick(300);
  relay.receive(7, 0, 1, 301);
  relay.tick(350);
  assert.deepEqual(inputs.at(-1), [7, 1, 0]);
  relay.tick(3_600_000);
  assert.equal(inputs.length, 6, 'no runaway wall-clock stream while clients are paused');
});

test('out-of-order inputs and duplicates do not create a permanent frame gap', () => {
  const { relay, inputs, lag } = makeRelay();
  relay.receive(5, 0, 1, 0);
  relay.receive(5, 1, 2, 0);
  relay.receive(7, 1, 32, 100);
  assert.equal(relay.receive(6, 1, 16, 110), true);
  assert.equal(relay.receive(7, 1, 64, 111), false);
  relay.receive(6, 0, 1, 120);
  relay.receive(7, 0, 2, 125);
  relay.tick(5_000);
  assert.deepEqual(inputs.filter(([f, s]) => f === 7 && s === 1), [[7, 1, 32]]);
  assert.equal(inputs.some(([, , mask]) => mask === 0), false);
  assert.deepEqual(lag, []);
});

test('skipped frames get neutralized rather than waiting forever', () => {
  const { relay, inputs } = makeRelay();
  relay.receive(7, 0, 1, 0);
  relay.receive(7, 1, 2, 0);
  relay.tick(INPUT_GRACE_MS);
  for (const frame of [5, 6]) {
    for (const slot of [0, 1]) assert.equal(inputs.some(([f, s, m]) => f === frame && s === slot && m === 0), true);
  }
  assert.equal(relay.receive(8, 0, 16, INPUT_GRACE_MS + 1), true);
});

test('AI slots are never awaited or neutralized, including human + AI duels', () => {
  const { relay, inputs, lag } = makeRelay([0]);
  for (let frame = 5; frame < 100; frame++) relay.receive(frame, 0, 16, frame * 100);
  relay.tick(100_000);
  assert.equal(inputs.length, 95);
  assert.equal(inputs.every(([, slot, mask]) => slot === 0 && mask === 16), true);
  assert.deepEqual(lag, []);

  const team = makeRelay([0, 2, 4]);
  for (const slot of [0, 2, 4]) team.relay.receive(5, slot, 1, 0);
  team.relay.receive(6, 2, 2, 10);
  team.relay.tick(300);
  assert.deepEqual(team.lag, [[0, 4]]);
  assert.equal(team.inputs.some(([, slot]) => slot === 1 || slot === 3), false);
});

test('invalid or arbitrarily far-future inputs cannot allocate an unbounded backlog', () => {
  const { relay, inputs } = makeRelay();
  for (const frame of [NaN, Infinity, -1, 4, 5.5, 5 + MAX_PENDING_FRAMES, 1e12]) {
    assert.equal(relay.receive(frame, 0, 1, 0), false);
  }
  assert.equal(relay.receive(5, 2, 1, 0), false);
  for (const mask of [-1, 256, NaN, 1.5]) assert.equal(relay.receive(5, 0, mask, 0), false);
  relay.tick(60_000);
  assert.deepEqual(inputs, []);
});
