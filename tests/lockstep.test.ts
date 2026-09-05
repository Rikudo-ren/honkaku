import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FRAME_MS, InputBuffer, MAX_ONLINE_STEPS, OnlineClock } from '../src/game/lockstep';

test('canonical input is first-wins; consumed frames stay discarded; rematches start clean', () => {
  const buffer = new InputBuffer();
  buffer.add(5, 0, 0);
  buffer.add(5, 0, 16);
  buffer.add(10, 1, 2);
  assert.equal(buffer.get(5, 0), 0);
  assert.equal(buffer.get(5, 1), undefined);
  assert.equal(buffer.latestFrame, 10);
  buffer.discard(5);
  buffer.add(5, 1, 16);
  assert.equal(buffer.get(5, 1), undefined);
  assert.equal(buffer.get(10, 1), 2);
  buffer.clear();
  assert.equal(buffer.latestFrame, -1);
  assert.equal(buffer.get(10, 1), undefined);
  buffer.add(5, 0, 16);
  assert.equal(buffer.get(5, 0), 16);
});

for (const fps of [20, 30, 60, 120, 144]) {
  test(`${fps}Hz rendering still runs 60 simulation frames per second, not a faster game`, () => {
    const clock = new OnlineClock(5);
    let frame = 0;
    for (let tick = 0; tick < fps * 10; tick++) {
      clock.advance(1000 / fps, frame, frame + 5, () => { frame++; return true; });
    }
    assert.equal(frame, 600);
  });
}

test('short stalls retain elapsed time and catch up without skipping simulation frames', () => {
  const clock = new OnlineClock(5);
  let frame = 0;
  for (let i = 0; i < 5; i++) assert.equal(clock.advance(FRAME_MS, frame, -1, () => false), 0);
  const seen: number[] = [];
  assert.equal(clock.advance(FRAME_MS, frame, 5, () => { seen.push(frame++); return true; }), 6);
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5]);
});

test('background-tab backlog is replayed in bounded bursts, never skipped or locally guessed', () => {
  const clock = new OnlineClock(5);
  let frame = 10;
  assert.equal(clock.advance(10_000, frame, 600, () => false), 0);
  for (let tick = 0; tick < 60; tick++) {
    const steps = clock.advance(0, frame, 600, () => { frame++; return true; });
    assert.ok(steps <= MAX_ONLINE_STEPS);
  }
  assert.equal(frame, 595, 'preserve the normal input-delay lookahead instead of fast-forwarding past it');
});
