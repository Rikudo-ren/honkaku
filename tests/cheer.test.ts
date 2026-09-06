import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ALL_CHARS, CHARS, CHAR_ORDER, HIDDEN_CHARS, INTRO_PAIRS, MIRROR_INTROS, NO_HIDDEN, pairKey, rosterFor, winQuotesFor } from '../src/game/characters';
import { CHEER } from '../src/game/cheer';
import { Battle, GROUND } from '../src/game/engine';
import type { Fighter, FighterState, Projectile } from '../src/game/engine';
import { drawFighter } from '../src/game/sprites';
import { EMPTY_INPUT } from '../src/game/types';
import type { CharId, InputState, PoseId } from '../src/game/types';

type Opts = ConstructorParameters<typeof Battle>[0];
const cheer = CHARS.mitsumine_cheer;
const input = (p: Partial<InputState> = {}): InputState => ({ ...EMPTY_INPUT, ...p });
const step = (b: Battle, n = 1, a: Partial<InputState> = {}, c: Partial<InputState> = {}) => {
  for (let i = 0; i < n; i++) b.step([input(a), input(c)]);
};
const until = (b: Battle, predicate: () => boolean, max = 240, a: Partial<InputState> = {}, c: Partial<InputState> = {}) => {
  for (let i = 0; i < max && !predicate(); i++) step(b, 1, a, c);
  assert.ok(predicate(), `condition not met in ${max} frames`);
};
const battle = (opts: Partial<Opts> = {}) => {
  const b = new Battle({ p1: 'mitsumine_cheer', p2: 'ryoma', ai: [false, false], difficulty: 'extreme', stage: 'classroom', seed: 83, ...opts });
  until(b, () => b.phase === 'fight');
  b.f[0].x = 70;
  b.f[1].x = 320;
  return b;
};
const airborne = (f: Fighter, y = 115) => {
  f.state = 'jump';
  f.y = y;
  f.vx = 0;
  f.vy = 0;
};
const projectile = (b: Battle, overrides: Partial<Projectile>) => {
  const p: Projectile = { kind: 'cheerWave', owner: 0, x: 70, y: GROUND - 30, vx: 0, vy: 0, w: 2, h: 2, dmg: 6, hitstun: 25, kbx: 0.8, kby: 0, life: CHEER.waveLife, pierce: true, hitMask: 0, t: 0, seed: 0, ...overrides };
  b.projectiles.push(p);
  return p;
};

test('体育着三峰はヘイカツの次の隠しキャラ。通常版と技・衣装は別のまま', () => {
  assert.deepEqual(CHAR_ORDER, ['mie', 'ryoma', 'naito', 'mitsumine', 'terachi', 'rei']);
  assert.deepEqual(rosterFor(NO_HIDDEN), CHAR_ORDER);
  assert.deepEqual(HIDDEN_CHARS, ['sakura', 'heikatsu', 'mitsumine_cheer', 'kakusei']);
  assert.equal(cheer.hidden, true);
  assert.ok(!rosterFor(NO_HIDDEN).includes(cheer.id));
  assert.equal(ALL_CHARS.length, 10);
  assert.equal(cheer.name, '三峰瑠衣(応援)');
  assert.equal(cheer.passive?.name, 'アリーナ・ステップ');
  assert.equal(cheer.look.outfit, 'gym');
  assert.equal(cheer.look.weapon, 'none');
  assert.equal(cheer.look.hair, 'bob');
  assert.ok(cheer.speed > Math.max(...ALL_CHARS.filter((id) => id !== cheer.id).map((id) => CHARS[id].speed)));
  assert.equal(cheer.hp, 90);
  assert.match(cheer.desc, /内進生.*体育着.*理数科/);
  assert.match(cheer.desc, /58対60.*二点差の敗戦/);
  assert.match(cheer.outfitLabel!, /体育着.*白い鉢巻/);
  assert.notEqual(cheer.moves.special.projectile?.kind, CHARS.mitsumine.moves.special.projectile?.kind);
  for (const id of ALL_CHARS) {
    if (id !== cheer.id) assert.equal(CHARS[id].airControl, undefined, `${id} に空中制御が漏れた`);
  }
  const server = readFileSync(new URL('../server/src/rooms/BattleRoom.ts', import.meta.url), 'utf8');
  assert.match(server.split('\n').find((l) => l.startsWith('const CHAR_IDS'))!, /["']mitsumine_cheer["']/);
  const portraits = readFileSync(new URL('../src/components/Portrait.tsx', import.meta.url), 'utf8');
  assert.match(portraits, /mitsumine_cheer: 'mitsumine_taiiku.jpg'/);
  assert.match(portraits, /mitsumine_cheer: byName\[PORTRAIT_FILES.mitsumine_cheer/);
});

test('全9相手に50組＋鏡像の掛け合い。ヘイカツの問いに丁寧語のまま慌てる', () => {
  let count = 0;
  const doc = readFileSync(new URL('../docs/all-intro-lines.md', import.meta.url), 'utf8');
  for (const id of ALL_CHARS) {
    if (id === cheer.id) continue;
    const list = INTRO_PAIRS[pairKey(id, cheer.id)];
    assert.ok(list.length >= 4, id);
    assert.equal(list, INTRO_PAIRS[pairKey(cheer.id, id)]);
    count += list.length;
    for (const line of list) {
      assert.ok(line.first === id || line.first === cheer.id);
      assert.ok(doc.includes(`「${line.a}」`));
      assert.ok(doc.includes(`「${line.b}」`));
    }
  }
  assert.equal(count, 50);
  assert.equal(INTRO_PAIRS[pairKey('mie', cheer.id)].length, 10);
  const heikatsu = INTRO_PAIRS[pairKey('heikatsu', cheer.id)];
  assert.ok(heikatsu.some((l) => /内進/.test(l.a) && /理数科/.test(l.a)));
  assert.ok(heikatsu.some((l) => /せ、先生|ちょ、|べ、|違います/.test(l.b)));
  for (const line of heikatsu) assert.match(line.first === cheer.id ? line.a : line.b, /です|ます|ました|ません|ください/);
  assert.ok(MIRROR_INTROS.mitsumine_cheer);
});

test('覚醒三重だけが先に話し、応援三峰は「……」のみ。勝利・リザルト用台詞も沈黙', () => {
  for (const line of INTRO_PAIRS[pairKey('kakusei', cheer.id)]) {
    assert.equal(line.first, 'kakusei');
    assert.equal(line.b, '……');
    assert.equal(line.note, undefined);
  }
  assert.deepEqual(winQuotesFor(cheer.id, 'kakusei'), ['……']);
  assert.equal(winQuotesFor('ryoma', cheer.id), CHARS.ryoma.wins);
  assert.notEqual(winQuotesFor(cheer.id, 'mie'), cheer.wins);
  const b = battle({ p2: 'kakusei' });
  b.f[1].hp = 0;
  until(b, () => b.phase === 'roundEnd');
  assert.ok(b.bubbles.some((v) => v.idx === 0 && v.text === '……'));
  const result = readFileSync(new URL('../src/components/ResultScreen.tsx', import.meta.url), 'utf8');
  assert.ok(result.includes('winQuotesFor(wId, lId)'));
  assert.ok(result.includes('winQuotesFor(rep.id, losers[0]?.char'));
});

test('地上は2.55px/frameで走り、AIRの左右反転は応援版限定（他全員は離陸慣性のまま）', () => {
  const b = battle();
  const x = b.f[0].x;
  step(b, 1, { right: true });
  assert.ok(Math.abs(b.f[0].x - x - cheer.speed) < 1e-8);
  for (const id of ALL_CHARS) {
    const air = battle({ p1: id });
    const f = air.f[0];
    airborne(f);
    f.vx = 1.1;
    step(air, 5, { left: true });
    if (id === cheer.id) assert.ok(f.vx < 0, '空中で反転できない');
    else assert.equal(f.vx, 1.1, `${id} が空中入力で軌道を変えた`);
  }
});

test('空中は加速上限と離した時のブレーキがある。読み・声援の速度補正も有効', () => {
  const b = battle();
  const f = b.f[0];
  airborne(f);
  step(b, 6, { right: true });
  assert.equal(f.vx, cheer.airControl!.speed);
  step(b);
  assert.ok(f.vx > 0 && f.vx < cheer.airControl!.speed);
  f.readT = 60;
  step(b, 1, { right: true });
  assert.equal(f.vx, cheer.airControl!.speed * 0.55);
  f.readT = 0;
  f.rallyT = 60;
  step(b, 6, { right: true });
  assert.equal(f.vx, cheer.airControl!.speed * CHEER.rallySpeed);
});

test('上の浮力は有限。天井を越えず、上を押し続けても必ず着地しAIRが戻る', () => {
  const b = battle();
  const f = b.f[0];
  step(b, 1, { up: true });
  let spent = false;
  let depleted = false;
  let landed = false;
  for (let i = 0; i < 180; i++) {
    step(b, 1, { up: true });
    assert.ok(f.y >= CHEER.airCeiling, `天井抜け: ${f.y}`);
    assert.ok(f.airLift >= 0 && f.airLift <= cheer.airControl!.liftFrames);
    spent ||= f.airLift < cheer.airControl!.liftFrames;
    depleted ||= f.airLift === 0;
    if (f.y === GROUND) { landed = true; break; }
  }
  assert.ok(spent && depleted && landed);
  assert.equal(f.airLift, cheer.airControl!.liftFrames);
  assert.equal(f.airUsed, 0);
  const down = battle();
  const neutral = battle();
  airborne(down.f[0]);
  airborne(neutral.f[0]);
  step(down, 8, { down: true });
  step(neutral, 8);
  assert.ok(down.f[0].y > neutral.f[0].y + 15, '下入力の急降下が効かない');
});

test('被弾・吹き飛び・硬直・掴まれ・ヒットストップ中は空中入力で逃げられない', () => {
  for (const state of ['hurt', 'launch', 'stun', 'frozen', 'grabbed', 'down', 'getup'] as FighterState[]) {
    const a = battle();
    const c = battle();
    for (const b of [a, c]) {
      Object.assign(b.f[0], { state, stateT: 0, stateDur: 80, y: 110, vx: 0.8, vy: 1, airLift: 19 });
      if (state === 'grabbed') b.f[0].grabbedBy = 1;
    }
    step(a, 3, { left: true, up: true, light: true, heavy: true });
    step(c, 3);
    assert.equal(a.f[0].x, c.f[0].x, state);
    assert.equal(a.f[0].y, c.f[0].y, state);
    assert.equal(a.f[0].airLift, 19, state);
    assert.equal(a.f[0].airUsed, 0, state);
  }
  const b = battle();
  airborne(b.f[0]);
  b.f[0].hitstop = 4;
  step(b, 3, { up: true, right: true });
  assert.equal(b.f[0].y, 115);
  assert.equal(b.f[0].vx, 0);
  assert.equal(b.f[0].airLift, cheer.airControl!.liftFrames);
});

test('空中弱は専用の斜め下音弾＋浮き直し。押しっぱなしでも1ジャンプ1発', () => {
  const b = battle();
  const f = b.f[0];
  airborne(f);
  step(b, 1, { light: true });
  assert.equal(f.move, cheer.airMoves!.light);
  assert.equal(f.airUsed, 1);
  until(b, () => b.projectiles.some((p) => p.kind === 'cheerNote'), 10, { light: true });
  assert.ok(f.vy < 0, '手拍子の浮き直しがない');
  const note = b.projectiles.find((p) => p.kind === 'cheerNote')!;
  assert.ok(note.vx > 0 && note.vy > 0);
  let emissions = 1;
  for (let i = 0; i < 32; i++) {
    step(b, 1, { light: true, up: true });
    emissions += b.projectiles.filter((p) => p.kind === 'cheerNote' && p.t === 1).length;
    assert.ok(f.y < GROUND);
  }
  assert.equal(emissions, 1);
  assert.equal(f.airUsed, 1);
  assert.notEqual(f.state, 'attack');
  step(b, 1, { heavy: true });
  assert.equal(f.move, cheer.airMoves!.heavy, '弱を使っても専用強はまだ使える');
  assert.equal(f.airUsed, 3);
});

test('空中必殺・空中超必殺は不可、沈黙中も地上必殺・超必殺は出ない', () => {
  const b = battle();
  const f = b.f[0];
  airborne(f);
  f.meter = 100;
  step(b, 3, { special: true, super: true });
  assert.equal(f.state, 'jump');
  assert.equal(f.meter, 100);
  assert.equal(b.projectiles.length, 0);
  f.y = GROUND;
  f.vy = 0;
  f.silence = 40;
  step(b, 3, { special: true, super: true });
  assert.equal(f.state, 'idle');
  assert.equal(f.meter, 100);
});

test('空中強は直撃だけ上へリバウンドし、AIRも空中強の回数も戻らない', () => {
  const b = battle();
  const f = b.f[0];
  airborne(f, 145);
  f.x = 130;
  f.airLift = 12;
  b.f[1].x = 148;
  const hp = b.f[1].hp;
  step(b, 1, { heavy: true });
  until(b, () => b.f[1].hp < hp, 30);
  assert.equal(b.f[1].hp, hp - cheer.airMoves!.heavy.dmg);
  assert.ok(f.vy < -4 && f.y < GROUND);
  assert.equal(f.airUsed, 2);
  assert.equal(f.airLift, 12);
  assert.equal(f.movePhase, 2);
  until(b, () => f.state !== 'attack', 35, { up: true });
  assert.ok(f.y < GROUND);
  step(b, 1, { heavy: true });
  assert.notEqual(f.state, 'attack', '跳ね返りで強を再使用できてしまう');
  assert.equal(f.airUsed, 2);
});

for (const guarded of [false, true]) {
  test(`空中強の${guarded ? 'ガード' : '空振り'}着地は18フレーム硬直。着地で資源だけ回復`, () => {
    const b = battle();
    const f = b.f[0];
    airborne(f, 145);
    f.x = 130;
    f.meter = 100;
    f.airLift = 3;
    b.f[1].x = guarded ? 150 : 340;
    const hp = b.f[1].hp;
    step(b, 1, { heavy: true }, { down: guarded });
    until(b, () => f.y === GROUND, 50, {}, { down: guarded });
    assert.equal(f.state, 'attack');
    assert.equal(f.movePhase, 2);
    assert.equal(b.poseOf(f), 'getup');
    assert.equal(f.airAttack, false);
    assert.equal(f.airUsed, 0);
    assert.equal(f.airLift, cheer.airControl!.liftFrames);
    if (guarded) assert.ok(b.f[1].hp < hp && b.f[1].hp > hp - 2);
    else assert.equal(b.f[1].hp, hp);
    step(b, 17, { up: true, light: true, super: true }, { down: guarded });
    assert.equal(f.state, 'attack', '着地硬直が入力で消えている');
    assert.equal(f.y, GROUND);
    assert.equal(f.meter, 100);
    step(b);
    assert.equal(f.state, 'idle');
  });
}

test('裏拍クラップは独立した二つの拍で3＋3ダメージ、3発目は出ない', () => {
  const b = battle();
  b.f[0].x = 100;
  b.f[1].x = 122;
  const hp = b.f[1].hp;
  step(b, 1, { light: true });
  until(b, () => b.f[0].state !== 'attack', 60);
  assert.equal(hp - b.f[1].hp, 6);
  assert.equal(b.f[0].maxCombo, 2);
  assert.equal(b.projectiles.length, 0);
});

test('折り返しは先に退き、接触判定なしで横切り、振り返るまで攻撃しない', () => {
  const b = battle();
  const f = b.f[0];
  f.x = 100;
  b.f[1].x = 120;
  const hp = b.f[1].hp;
  step(b, 1, { heavy: true });
  step(b, 3);
  assert.ok(f.x < 97, 'フェイントの一歩引きがない');
  until(b, () => f.moveFrame === CHEER.turnPivot - 1, 30);
  assert.equal(b.f[1].hp, hp, '通過中に攻撃が当たった');
  assert.ok(f.x > b.f[1].x, '相手を通り抜けられない');
  step(b);
  assert.equal(f.facing, -1);
  assert.equal(b.f[1].hp, hp - 11);
  assert.equal(b.phaseOf(f), 2, '振り返りのポーズにならない');
  // 被弾キャンセル後には通常の押し合いが戻る。
  b.applyHit(b.f[1], f, 1, { hitstun: 12, kbx: 1, kby: 0 }, 1);
  f.x = b.f[1].x;
  f.hitstop = 0;
  b.f[1].hitstop = 0;
  b.f[1].y = GROUND;
  b.f[1].vy = 0;
  step(b);
  assert.ok(Math.abs(f.x - b.f[1].x) >= 13.9);
});

test('エコーは往復各1ヒット。復路は低く、1つが残る間は追加で出せない', () => {
  const b = battle();
  b.f[1].x = 120;
  const hp = b.f[1].hp;
  step(b, 1, { special: true });
  until(b, () => b.projectiles.some((p) => p.kind === 'cheerEcho'), 20);
  const echo = b.projectiles.find((p) => p.kind === 'cheerEcho')!;
  const y = echo.y;
  let returned = false;
  for (let i = 0; i < 80 && b.projectiles.includes(echo); i++) {
    step(b, 1, { special: true });
    assert.ok(b.projectiles.filter((p) => p.kind === 'cheerEcho' && p.owner === 0).length <= 1);
    if (echo.echoReturned) {
      returned = true;
      assert.equal(echo.vx, -CHEER.echoReturnSpeed);
      assert.equal(echo.y, y + CHEER.echoDrop);
    }
  }
  assert.ok(returned);
  assert.equal(hp - b.f[1].hp, 14);
  assert.ok(!b.projectiles.includes(echo), 'エコーが寿命で消えていない');
});

test('壁際のエコーは予定時刻を待たず反転する。反射されたエコーは再度折り返さない', () => {
  const b = battle({ p2: 'mie' });
  const wall = projectile(b, { kind: 'cheerEcho', x: 373, vx: 3.4, y: 150, w: 16, h: 15, life: 68 });
  step(b);
  assert.equal(wall.echoReturned, true);
  assert.equal(wall.vx, -CHEER.echoReturnSpeed);
  b.projectiles = [];
  step(b, 1, {}, { special: true });
  until(b, () => b.f[1].countering, 20);
  const p = projectile(b, { kind: 'cheerEcho', x: b.f[1].x - 6, vx: 3.4, y: GROUND - 28, w: 16, h: 15, life: 68 });
  step(b);
  assert.equal(p.owner, 1);
  assert.equal(p.echoReturned, true);
  const vx = p.vx;
  step(b, 30);
  assert.equal(p.vx, vx);
  assert.ok(p.vx < 0);
  assert.ok(p.hitMask & (1 << 1));
});

test('空中音弾の反射で新所有者の仲間を同フレームに巻き込まない', () => {
  const b = battle({ fighters: [
    { char: cheer.id, team: 0, ai: false },
    { char: 'mie', team: 1, ai: false },
    { char: 'naito', team: 1, ai: false },
  ] });
  b.f[1].x = 200;
  b.f[2].x = 218;
  step(b, 1, {}, { special: true });
  until(b, () => b.f[1].countering, 20);
  const hp = b.f[2].hp;
  const p = projectile(b, { kind: 'cheerNote', x: 205, vx: 2.8, y: GROUND - 28, w: 13, h: 11, pierce: false, life: 38 });
  step(b);
  assert.equal(p.owner, 1);
  assert.equal(b.f[2].hp, hp);
  assert.equal(p.hitMask, 1 << 1);
});

test('大声援は3つの伝わる輪。瞬間全画面攻撃ではなく、6→6→18でガード可', () => {
  for (const guard of [false, true]) {
    const b = battle();
    const f = b.f[0];
    const hp = b.f[1].hp;
    f.meter = 100;
    step(b, 1, { super: true }, { down: guard });
    assert.equal(f.meter, 0);
    assert.equal(b.cutin?.char, cheer.id);
    const waves = new Set<Projectile>();
    const damages: number[] = [];
    let rally = false;
    for (let i = 0; i < 250; i++) {
      step(b, 1, {}, { down: guard });
      for (const p of b.projectiles.filter((p) => p.kind === 'cheerWave')) {
        if (waves.has(p)) continue;
        waves.add(p);
        damages.push(p.dmg);
        if (waves.size === 1) assert.equal(b.f[1].hp, hp, '輪が広がる前にダメージ');
      }
      rally ||= f.rallyT > 0;
    }
    assert.deepEqual(damages, [6, 6, 18]);
    assert.ok(rally);
    assert.ok(!b.projectiles.some((p) => p.kind === 'cheerWave'));
    assert.notEqual(f.state, 'super');
    assert.ok(Math.abs(hp - b.f[1].hp - (guard ? 3 : 30)) < 1e-8);
  }
});

test('音の輪も三重の当身・覚醒三重の対飛び道具アーマーを尊重する', () => {
  for (const id of ['mie', 'kakusei'] as const) {
    const b = battle({ p2: id });
    step(b, 1, {}, id === 'mie' ? { special: true } : { heavy: true });
    if (id === 'mie') until(b, () => b.f[1].countering, 20);
    const hp = b.f[1].hp;
    const p = projectile(b, { x: b.f[1].x - 6 });
    step(b);
    assert.equal(b.f[1].hp, hp, id);
    assert.ok(p.hitMask & 2);
    assert.ok(b.f[1].meter > 0);
  }
});

test('音の輪は同心円の先端のみ。通過後の内側へ入っても被弾しない', () => {
  const b = battle();
  b.f[1].invuln = 100;
  const p = projectile(b, {});
  step(b, 24);
  assert.equal(b.f[1].hp, CHARS.ryoma.hp);
  b.f[1].invuln = 0;
  b.f[1].x = p.x + 35;
  step(b, 5);
  assert.equal(b.f[1].hp, CHARS.ryoma.hp);
  assert.equal(p.hitMask, 0);
});

test('音の輪が通る場所の敵弾だけを消す。味方弾・回復アイテムは残す', () => {
  const b = battle({ fighters: [
    { char: cheer.id, team: 0, ai: false },
    { char: 'ryoma', team: 1, ai: false },
    { char: 'mie', team: 0, ai: false },
  ] });
  b.f[2].x = 30;
  const wave = projectile(b, { x: 70, y: 120 });
  const enemy = projectile(b, { kind: 'cross', owner: 1, x: 100, y: 120, w: 4, h: 4, life: 100 });
  const ally = projectile(b, { kind: 'star', owner: 2, x: 100, y: 120, w: 4, h: 4, life: 100 });
  const heal = projectile(b, { kind: 'orange', owner: -1, x: 100, y: 120, w: 4, h: 4, life: 100, item: 'heal' });
  step(b, 2);
  assert.ok(b.projectiles.includes(enemy));
  step(b, 3);
  assert.ok(!b.projectiles.includes(enemy));
  assert.ok(b.projectiles.includes(ally));
  assert.ok(b.projectiles.includes(heal));
  assert.ok(b.projectiles.includes(wave));
});

test('8スロット乱戦でも波は敵全員に1度ずつ・味方には当たらず、死者には声援バフなし', () => {
  const b = battle({ fighters: Array.from({ length: 8 }, (_, i) => ({ char: i === 6 ? cheer.id : 'ryoma', team: i % 2 as 0 | 1, ai: false })) });
  b.f.forEach((f, i) => { f.x = 24 + i * 45; });
  const hp = b.f.map((f) => f.hp);
  projectile(b, { owner: 6, x: b.f[6].x, y: GROUND - 30 });
  step(b, 55);
  b.f.forEach((f, i) => assert.equal(f.hp, hp[i] - (i % 2 === 1 ? 6 : 0), `slot ${i}`));
  b.f[0].hp = 0;
  b.f[6].meter = 100;
  b.step(b.f.map((_, i) => input({ super: i === 6 })));
  until(b, () => b.f[6].rallyT > 0, 220);
  assert.equal(b.f[0].rallyT, 0);
  b.f.forEach((f, i) => {
    if (i % 2 === 1) assert.equal(f.rallyT, 0, `敵 slot ${i} にバフ`);
    else if (i > 0) assert.ok(f.rallyT >= CHEER.rallyFrames - 1, `味方 slot ${i} にバフがない`);
  });
});

test('味方三重への声援、3秒の速度アップ、ラウンド跨ぎの資源リセット', () => {
  const b = battle({ fighters: [
    { char: cheer.id, team: 0, ai: false },
    { char: 'ryoma', team: 1, ai: false },
    { char: 'mie', team: 0, ai: false },
  ] });
  b.f[2].x = 25;
  b.f[0].meter = 100;
  step(b, 1, { super: true });
  until(b, () => b.f[2].rallyT > 0, 220);
  assert.ok(b.bubbles.some((v) => v.idx === 2 && /聞こえてる/.test(v.text)));
  const f = b.f[2];
  const x = f.x;
  b.step([EMPTY_INPUT, EMPTY_INPUT, input({ right: true })]);
  assert.ok(Math.abs(f.x - x - CHARS.mie.speed * CHEER.rallySpeed) < 1e-8);
  step(b, CHEER.rallyFrames);
  assert.equal(f.rallyT, 0);
  b.f[0].airUsed = 3;
  b.f[0].airLift = 0;
  b.f[0].rallyT = 99;
  b.f[1].hp = 0;
  until(b, () => b.round === 2, 400);
  assert.equal(b.f[0].airUsed, 0);
  assert.equal(b.f[0].airLift, cheer.airControl!.liftFrames);
  assert.equal(b.f[0].rallyT, 0);
});

test('状態ハッシュが空中資源・技進行・声援と、反響弾の所有者・復路・寿命を含む', () => {
  const b = battle();
  for (const key of ['airUsed', 'airLift', 'rallyT', 'moveFrame', 'movePhase'] as const) {
    const before = b.stateHash();
    const old = b.f[0][key];
    b.f[0][key] = 1 as never;
    if (old === 1) b.f[0][key] = 0 as never;
    assert.notEqual(b.stateHash(), before, key);
    b.f[0][key] = old as never;
  }
  const p = projectile(b, { kind: 'cheerEcho', vx: 3.4 });
  for (const key of ['owner', 'hitMask', 'life', 'vx', 'vy', 'dmg', 't'] as const) {
    const old = p[key];
    const hash = b.stateHash();
    p[key]++;
    assert.notEqual(b.stateHash(), hash, key);
    p[key] = old;
  }
  const hash = b.stateHash();
  p.echoReturned = true;
  assert.notEqual(b.stateHash(), hash);
});

test('専用CPUは全10キャラ・鏡像戦で完走し同じシードなら一致。空中弱・強も使う', () => {
  const seen = new Set<string>();
  for (const id of ALL_CHARS) {
    const opts: Opts = { p1: cheer.id, p2: id, ai: [true, true], difficulty: 'extreme', stage: 'classroom', seed: 9 };
    const a = new Battle(opts);
    const c = new Battle(opts);
    for (let frame = 0; frame < 60 * 340 && a.phase !== 'matchEnd'; frame++) {
      step(a);
      step(c);
      if (a.f[0].move) seen.add(a.f[0].move.pose);
      if (frame % 31 === 0) assert.equal(a.stateHash(), c.stateHash(), `${id} frame ${frame}`);
      for (const f of a.f) assert.ok(Number.isFinite(f.x + f.y + f.hp + f.vx + f.vy));
    }
    assert.equal(a.phase, 'matchEnd', `vs ${id}`);
    assert.equal(a.stateHash(), c.stateHash(), id);
  }
  assert.ok(seen.has('airClap'), [...seen].join(', '));
  assert.ok(seen.has('airDive'), [...seen].join(', '));
});

test('体育着の全専用ポーズは半袖・短パン・白い靴下靴・鉢巻。倒れても制服化しない', () => {
  type Rect = { x: number; y: number; w: number; h: number; color: string };
  const raster = (pose: PoseId, phase: 0 | 1 | 2 = 1, id: CharId = cheer.id) => {
    const rects: Rect[] = [];
    const g = {
      fillStyle: '', globalAlpha: 1,
      save() {}, restore() {}, translate() {}, scale() {},
      fillRect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h, color: this.fillStyle }); },
    };
    drawFighter(g as unknown as CanvasRenderingContext2D, 0, 0, CHARS[id].look, { pose, phase, facing: 1, t: 12 });
    return rects;
  };
  const poses: PoseId[] = ['idle', 'walk', 'jump', 'airStep', 'cheerClap', 'cheerTurn', 'cheerCall', 'airClap', 'airDive', 'crouch', 'block', 'hurt', 'launch', 'grabbed', 'getup', 'win', 'lose', 'down'];
  for (const pose of poses) for (const phase of [0, 1, 2] as const) {
    const rects = raster(pose, phase);
    assert.ok(rects.some((r) => r.color === '#f7f7fc'), `${pose}: 白い鉢巻・靴がない`);
    assert.ok(rects.some((r) => r.color === '#29334e'), `${pose}: 紺の短パンがない`);
    assert.ok(rects.some((r) => r.color === '#e9e9f1'), `${pose}: 白い靴下がない`);
    assert.ok(!rects.some((r) => r.color === '#5b3a22' || r.color === '#2a3357'), `${pose}: 制服の靴・スカートが出た`);
    assert.ok(rects.every((r) => Number.isInteger(r.x) && Number.isInteger(r.y)), `${pose}: ピクセルが滲む`);
  }
  const idle = raster('idle');
  assert.ok(idle.some((r) => r.color === '#f7f7fc' && r.y < -39 && r.w >= 12), '白鉢巻の帯がない');
  assert.ok(idle.filter((r) => r.color === '#29334e' && r.w === 1 && r.h === 1).length > 25, '肩柄と縦の校名がない');
  assert.ok(idle.some((r) => r.x < -10 && r.color === '#f7f7fc'), '鉢巻の長い端がない');
  assert.notDeepEqual(raster('airClap'), raster('airDive'));
  assert.notDeepEqual(raster('cheerClap', 0), raster('cheerClap', 1));
  const uniform = raster('idle', 1, 'mitsumine');
  assert.ok(uniform.some((r) => r.color === '#2a3357'), '元の三峰のスカートを変えてしまった');
  assert.ok(uniform.some((r) => r.color === '#5b3a22'), '元の三峰の靴を変えてしまった');
});
