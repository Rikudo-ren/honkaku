import assert from 'node:assert/strict';
import { test } from 'node:test';
import { InputRelay } from '../server/src/rooms/InputRelay';
import { Battle } from '../src/game/engine';
import { InputBuffer, OnlineClock } from '../src/game/lockstep';
import { unmask } from '../src/game/net';
import { makeOnlineSetup } from '../src/game/onlineSetup';
import type { StartData, StartFighter } from '../src/game/net';
import { EMPTY_INPUT } from '../src/game/types';

interface Options {
  duration?: number;
  starts?: number[];
  fps?: number[];
  paused?: (slot: number, now: number) => boolean;
  latency?: (slot: number, now: number) => number;
  fighters?: StartFighter[];
}

/** 仮想時計＋順序を保持する回線で、実際のリレー・時計・Battleを組み合わせて検証する。 */
function simulate(options: Options = {}) {
  const fighters = options.fighters ?? [
    { char: 'mie', team: 0, sessionId: 'p0', aiDifficulty: 'normal', name: '青' },
    { char: 'ryoma', team: 1, sessionId: 'p1', aiDifficulty: 'normal', name: '赤' },
  ];
  const humanSlots = fighters.flatMap((f, slot) => f.sessionId === null ? [] : [slot]);
  const delay = humanSlots.length > 2 ? 10 : 5;
  const start: StartData = { matchId: 1, seed: 123456, inputDelay: delay, stage: 'classroom', fighters };
  const clients = humanSlots.map((slot) => {
    const setup = makeOnlineSetup(start, fighters[slot].sessionId);
    const starts = options.starts?.[slot] ?? 0;
    return {
      slot, frame: 0, starts, nextRender: starts, lastRender: starts,
      clock: new OnlineClock(delay), buffer: new InputBuffer(), sent: new Set<number>(),
      hashes: new Map<number, number>(),
      battle: new Battle({
        p1: setup.p1, p2: setup.p2, stage: setup.stage, difficulty: setup.difficulty,
        seed: setup.seed, online: true, ai: [false, false], fighters: setup.fighters,
      }),
    };
  });
  const events = new Map<number, (() => void)[]>();
  const lag: { at: number; slots: number[] }[] = [];
  const canonical: { at: number; frame: number; slot: number; mask: number }[] = [];
  const upAt = new Map<number, number>();
  const downAt = new Map<number, number>();
  let now = 0;
  const schedule = (slot: number, lane: Map<number, number>, fn: () => void) => {
    const at = Math.max(now + 1, Math.ceil(now + (options.latency?.(slot, now) ?? 20)), lane.get(slot) ?? 0);
    lane.set(slot, at);
    if (!events.has(at)) events.set(at, []);
    events.get(at)!.push(fn);
  };
  const relay = new InputRelay(humanSlots, delay, (frame, slot, mask) => {
    canonical.push({ at: now, frame, slot, mask });
    for (const client of clients) schedule(client.slot, downAt, () => client.buffer.add(frame, slot, mask));
  }, (slots) => lag.push({ at: now, slots }));

  for (now = 0; now <= (options.duration ?? 20_000); now++) {
    const due = events.get(now);
    events.delete(now);
    due?.forEach((fn) => fn());
    if (now % 50 === 0) relay.tick(now);
    for (const c of clients) {
      if (now < c.nextRender) continue;
      c.nextRender += 1000 / (options.fps?.[c.slot] ?? 60);
      if (options.paused?.(c.slot, now)) continue;
      const elapsed = now - c.lastRender;
      c.lastRender = now;
      c.clock.advance(elapsed, c.frame, c.buffer.latestFrame, () => {
        const target = c.frame + delay;
        if (!c.sent.has(target) && c.buffer.get(target, c.slot) === undefined) {
          c.sent.add(target);
          const mask = (c.slot % 2 === 0 ? 2 : 1) | (target % 37 === 0 ? 16 : 0);
          schedule(c.slot, upAt, () => relay.receive(target, c.slot, mask, now));
        }
        const inputs = fighters.map((f, slot) => f.sessionId === null || c.frame < delay
          ? EMPTY_INPUT : c.buffer.get(c.frame, slot));
        if (inputs.some((input) => input === undefined)) return false;
        c.battle.step(inputs.map((input) => typeof input === 'number' ? unmask(input) : input!));
        c.buffer.discard(c.frame);
        c.sent.delete(c.frame);
        c.frame++;
        c.hashes.set(c.frame, c.battle.stateHash());
        return true;
      });
    }
  }
  // 同じフレームで比較する。描画時刻・端末のfpsに依存せず全員が同じ結果であること。
  const commonFrame = Math.min(...clients.map((c) => c.frame));
  for (let frame = 1; frame <= commonFrame; frame++) {
    for (const c of clients) assert.equal(c.hashes.get(frame), clients[0].hashes.get(frame), `desync at frame ${frame}, slot ${c.slot}`);
  }
  return { clients, lag, canonical, commonFrame };
}

test('normal play and 30Hz / 144Hz rendering stay playable without false lag for 30 seconds', () => {
  const result = simulate({ duration: 30_000, fps: [30, 144] });
  assert.ok(result.commonFrame >= 1_750, `only ${result.commonFrame} frames ran`);
  assert.ok(result.commonFrame <= 1_805, 'normal play must not accelerate');
  assert.deepEqual(result.lag, []);
  assert.equal(result.canonical.some((i) => i.mask === 0), false);
});

test('VS-screen start skew does not consume the later player’s controls', () => {
  const result = simulate({ starts: [0, 3_600] });
  assert.ok(result.commonFrame > 900, `only ${result.commonFrame} frames ran`);
  assert.deepEqual(result.lag, []);
  assert.equal(result.canonical.some((i) => i.mask === 0), false);
});

test('repeated short render stalls recover instead of drifting permanently behind the relay', () => {
  const result = simulate({ paused: (slot, now) => slot === 1 && now % 2_000 >= 1_000 && now % 2_000 < 1_180 });
  assert.ok(result.commonFrame > 1_140, `only ${result.commonFrame} frames ran`);
  assert.ok(Math.abs(result.clients[0].frame - result.clients[1].frame) < 8);
  assert.ok(result.canonical.filter((i) => i.at > 19_000 && i.slot === 1 && i.mask !== 0).length > 45);
});

test('a background tab catches up, regains real inputs, and clears its lag warning', () => {
  const result = simulate({ paused: (slot, now) => slot === 1 && now >= 3_000 && now < 7_000 });
  assert.ok(result.commonFrame > 1_100, `only ${result.commonFrame} frames ran`);
  assert.ok(Math.abs(result.clients[0].frame - result.clients[1].frame) < 8);
  assert.ok(result.lag.some((event) => event.slots.includes(1)));
  assert.deepEqual(result.lag.at(-1)?.slots, []);
  assert.ok(result.canonical.filter((i) => i.at > 8_000 && i.at < 9_000 && i.slot === 1 && i.mask !== 0).length > 45);
  assert.ok(result.canonical.filter((i) => i.at > 4_000 && i.at < 6_000 && i.slot === 0 && i.mask !== 0).length > 100,
    'the active player should keep playing while the other tab is suspended');
});

test('temporary network delay recovers without divergent simulations or permanently dropped controls', () => {
  const result = simulate({ latency: (slot, now) => slot === 1 && now >= 3_000 && now < 5_000 ? 450 : 20 });
  assert.ok(result.commonFrame > 1_050, `only ${result.commonFrame} frames ran`);
  assert.ok(Math.abs(result.clients[0].frame - result.clients[1].frame) < 8);
  assert.deepEqual(result.lag.at(-1)?.slots ?? [], []);
  assert.ok(result.canonical.filter((i) => i.at > 7_000 && i.at < 8_000 && i.slot === 1 && i.mask !== 0).length > 45);
});

test('a single human with an AI opponent actually leaves the intro and accepts controls', () => {
  const result = simulate({ fighters: [
    { char: 'mie', team: 0, sessionId: 'host', aiDifficulty: 'normal', name: 'ホスト' },
    { char: 'rei', team: 1, sessionId: null, aiDifficulty: 'hard', name: null },
  ] });
  assert.ok(result.commonFrame > 1_150);
  assert.ok(result.clients[0].battle.f[1].ai);
  assert.ok(result.clients[0].battle.timer < 99 * 60);
  assert.deepEqual(result.lag, []);
});

test('eight-human team matches recover a slow player with identical state on every client', () => {
  const result = simulate({
    duration: 12_000,
    fps: [60, 30, 60, 144, 60, 30, 60, 20],
    paused: (slot, now) => slot === 3 && now >= 2_000 && now < 5_000,
    fighters: Array.from({ length: 8 }, (_, slot) => ({
      char: slot % 2 === 0 ? 'mie' : 'ryoma', team: slot % 2 as 0 | 1,
      sessionId: `p${slot}`, aiDifficulty: 'normal', name: `プレイヤー${slot}`,
    })),
  });
  assert.ok(result.commonFrame > 650, `only ${result.commonFrame} frames ran`);
  assert.deepEqual(result.lag.at(-1)?.slots, []);
});
