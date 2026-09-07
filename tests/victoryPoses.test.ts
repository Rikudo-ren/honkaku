import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { createCanvas } from '@napi-rs/canvas';
import { ALL_CHARS, CHARS, EXTRA_LOOKS, SAKURA_LOVE_LOOK } from '../src/game/characters';
import { Battle } from '../src/game/engine';
import { Renderer } from '../src/game/render';
import { clearSpriteSheets, drawFighter, drawFighterPixels, getSpriteSheetStats, resolveFighterFrame, type DrawOpts } from '../src/game/sprites';
import { EMPTY_INPUT, type CharId, type Look, type PoseId } from '../src/game/types';

type Rect = { x: number; y: number; w: number; h: number; color: string };
const winOpts = (poseT = 72, t = 12345): DrawOpts => ({ pose: 'win', facing: 1, t, poseT });
const win = (id: CharId, poseT = 72, t = 12345) => resolveFighterFrame(CHARS[id].look, winOpts(poseT, t));

function record(look: Look, opts = winOpts()): Rect[] {
  const rects: Rect[] = [];
  const ctx = {
    fillStyle: '', globalAlpha: 1,
    fillRect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h, color: this.fillStyle }); },
  };
  drawFighterPixels(ctx, 0, 0, look, opts);
  return rects;
}

const canvas = (w = 480, h = 320) => createCanvas(w, h) as unknown as HTMLCanvasElement;
const pixels = (cv: HTMLCanvasElement) => Buffer.from(cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data);
function browserCanvases(t: TestContext) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  clearSpriteSheets();
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => canvas(1, 1) } });
  t.after(() => {
    clearSpriteSheets();
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  });
}

test('全10キャラに本人専用の勝利定義があり、名前だけでなく手・表情・姿勢も異なる', () => {
  const gestures = new Set<string>();
  for (const id of ALL_CHARS) {
    assert.equal(CHARS[id].look.winPose, id, id);
    const { victory, ...pose } = win(id).pose;
    assert.equal(victory, id);
    gestures.add(JSON.stringify(pose));
  }
  assert.equal(gestures.size, ALL_CHARS.length, '共通 cheer/cool プリセットへ戻さない');
});

test('数理零は全コマで平静な目と平らな口。笑顔・ピース・万歳で勝ち誇らない', () => {
  for (let poseT = 0; poseT < 240; poseT++) {
    const p = win('rei', poseT).pose;
    assert.equal(p.face, 'normal');
    assert.equal(p.mouth, 'flat');
    assert.ok(p.armF === 'down' || p.armF === 'penReady');
    assert.equal(p.armB, 'down');
    assert.equal(p.legs, 'stand');
  }
  const rects = record(CHARS.rei.look);
  assert.ok(rects.some((r) => r.color === CHARS.rei.look.eyeColor && r.y < -140), '切れ長の目を閉じた笑い目にしない');
  assert.ok(rects.some((r) => r.color === '#8a4a4a' && r.x === 7 && r.y === -134 && r.w === 6 && r.h === 2), '口元も作画上フラット');
  assert.ok(rects.some((r) => r.color === '#1c2340' && r.x < -30), '量子力学の本は脇に置く');
  const frames = [12, 18, 24, 30].map((t) => record(CHARS.rei.look, winOpts(t)));
  assert.equal(new Set(frames.map((r) => JSON.stringify(r))).size, 4, 'ペン回しの4コマ');
  assert.ok(frames.every((rs) => rs.some((r) => r.color === '#cbd5e1')), '銀色のシャーペンを実際に描く');
});

test('三重は片手をポケットに残して制し、両馬は手ぶらで拳を突き上げる', () => {
  assert.equal(win('mie', 0).pose.armF, 'down');
  assert.equal(win('mie').pose.armF, 'dismiss');
  assert.equal(win('mie').pose.armB, 'pocket');
  assert.equal(win('mie').pose.mouth, 'flat');
  assert.equal(win('ryoma', 0).pose.armF, 'fist');
  assert.equal(win('ryoma').pose.armF, 'raise');
  assert.equal(win('ryoma').pose.armB, 'fist');
  assert.equal(win('ryoma').pose.mouth, 'grin');
  for (const t of [0, 9, 10, 72, 240, 960]) {
    const rs = record(CHARS.ryoma.look, winOpts(t));
    assert.ok(!rs.some((r) => ['#163243', '#121826'].includes(r.color)), 'スマホや提示物を出さない');
    assert.equal(win('ryoma', t).accessory, false);
    if (t >= 10) assert.ok(rs.some((r) => r.color === CHARS.ryoma.look.skin && r.y < -192), '拳は頭より高く上がる');
  }
});

test('内藤は本を閉じて口元だけ少し笑う（三峰の修正に巻き込まない）', () => {
  assert.equal(win('naito', 0).pose.propFrame, 1);
  const naito = win('naito').pose;
  assert.equal(naito.propFrame, 0);
  assert.equal(naito.face, 'normal');
  assert.equal(naito.mouth, 'subtleSmile');
  assert.equal(naito.armF, 'hold');
  assert.equal(naito.armB, 'hold');
  assert.notDeepEqual(record(CHARS.naito.look, winOpts(0)), record(CHARS.naito.look));

});

test('通常三峰はノートなしで腕を組み、ツンとした目つきのまま赤面して顔をそらす', () => {
  const initial = win('mitsumine', 0).pose;
  assert.equal(initial.armF, 'hip');
  assert.equal(initial.headFacing, 1);
  assert.equal(initial.blush, undefined);
  for (const t of [16, 24, 72, 240, 960]) {
    const rui = win('mitsumine', t).pose;
    assert.equal(rui.armF, 'crossed');
    assert.equal(rui.armB, 'crossed');
    assert.equal(rui.eyeStyle, 'tsun');
    assert.equal(rui.brows, 'angry');
    assert.equal(rui.mouth, 'flat');
    assert.equal(rui.legs, 'stand');
    const rs = record(CHARS.mitsumine.look, winOpts(t));
    assert.ok(!rs.some((r) => ['#2c4a8a', '#c0392b', '#888888'].includes(r.color)), '作戦ノートの提示は廃止');
    if (t >= 24) {
      assert.equal(rui.headFacing, -1);
      assert.equal(rui.blush, 'flustered');
      assert.ok(rs.some((r) => r.color === '#d46d83'), '赤面は描画にも出る');
    }
  }
  // 表情差分は勝利時だけ。通常立ちや、承認済みの応援版の顔を上書きしない。
  const idle = resolveFighterFrame(CHARS.mitsumine.look, { ...winOpts(), pose: 'idle' }).pose;
  assert.equal(idle.eyeStyle, undefined);
  assert.equal(idle.brows, undefined);
  assert.equal(idle.blush, undefined);
  const cheer = win('mitsumine_cheer').pose;
  assert.equal(cheer.armF, 'behind');
  assert.equal(cheer.eyeStyle, undefined);
  assert.equal(cheer.blush, undefined);
});

test('三峰の前腕は同じ高さで重ね、斜めの腕や離れた二本の帯に戻さない', () => {
  const look = CHARS.mitsumine.look;
  for (const poseT of [16, 23, 24, 72, 144, 960]) for (const facing of [1, -1] as const) {
    const opts = { ...winOpts(poseT), facing };
    const p = resolveFighterFrame(look, opts).pose;
    const rs = record(look, opts);
    const mouth = rs.filter((r) => r.color === '#8a4a4a');
    assert.equal(mouth.length, 1, 'への字の強い口元には戻さない');
    assert.deepEqual([mouth[0].w, mouth[0].h], [6, 2], '小さな閉じた口');
    const hands = rs.filter((r) => r.color === look.skin && r.y >= -118 + p.dy && r.y < -72 + p.dy);
    assert.equal(hands.length, 2);
    assert.ok(hands.every((r) => r.w < 12 && r.h < 12), '腕の両端に握り拳を置かず、指先を収める');
    const sleeves = rs.filter((r) => r.color === '#eeeef4' && r.y >= -118 + p.dy && r.y < -72 + p.dy);
    assert.ok(!sleeves.some((r) => r.w >= 36 && r.h >= 8), '端を丸めずに大きな白い板を置くだけにはしない');
    // 前腕の縦方向の中心を比較する。端の丸みは許容し、斜めの傾きは許容しない。
    const near = sleeves.filter((r) => r.w === 4 && r.h >= 8);
    const far = rs.filter((r) => r.color === '#c9c9d4' && r.w === 4 && r.h === 10);
    assert.equal(near.length, 9);
    assert.equal(far.length, 9);
    const nearCenters = new Set(near.map((r) => r.y + r.h / 2));
    const farCenters = new Set(far.map((r) => r.y + r.h / 2));
    assert.equal(nearCenters.size, 1, '手前の前腕を胸の斜め上へ向けない');
    assert.equal(farCenters.size, 1, '奥の前腕も水平に保つ');
    assert.equal(far[0].y + far[0].h / 2 - (near[0].y + near[0].h / 2), 3, '高さの差は袖の厚み分だけ');
    for (const a of near) for (const b of far) {
      if (a.x < b.x + b.w && b.x < a.x + a.w) {
        const overlap = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        assert.ok(overlap >= 6, '前腕同士を離さず、大部分が重なるようにする');
      }
    }
    assert.equal(p.headFacing, poseT < 24 ? 1 : -1, '顔をそらす動きの時点は維持');
    assert.equal(p.headDy, poseT < 24 ? 0 : 2);
  }
});

test('寺地は紙を見せて固まり、櫻は結果まで研究ノートに記録する', () => {
  assert.equal(win('terachi', 0).pose.armF, 'penReady');
  const terachi = win('terachi').pose;
  assert.equal(terachi.armF, 'present');
  assert.equal(terachi.armB, 'pocket');
  assert.equal(terachi.mouth, 'flat');
  assert.ok(record(CHARS.terachi.look).some((r) => r.color === '#ffffff' && r.w === 40 && r.h === 52), '配信のA4用紙');
  const sakura = win('sakura').pose;
  assert.equal(sakura.armF, 'write');
  assert.equal(sakura.armB, 'hold');
  assert.equal(sakura.headDy, 4);
  assert.ok(record(CHARS.sakura.look).some((r) => r.color === '#f3b3c6'), '恋愛学の研究ノート');
  assert.ok(record(CHARS.sakura.look).some((r) => r.color === '#1f2937' && r.h === 24), '書き込み用のペン');
  assert.notDeepEqual(record(CHARS.sakura.look, winOpts(0)), record(CHARS.sakura.look, winOpts(8)));
});

test('理論を手放した櫻は胸に手を当て、ノートやペンを復活させない', () => {
  const f = resolveFighterFrame(SAKURA_LOVE_LOOK, winOpts());
  assert.equal(f.pose.victory, 'sakura');
  assert.equal(f.pose.armF, 'chest');
  assert.equal(f.pose.armB, 'down');
  assert.equal(f.accessory, false);
  assert.equal(f.sweatDrip, 0);
  const rects = record(SAKURA_LOVE_LOOK);
  assert.ok(!rects.some((r) => ['#f3b3c6', '#c9748f', '#1f2937'].includes(r.color)));
});

test('塀先生は等高線をなぞってから地図の向こうを見る。背景の先生も同じ定義', () => {
  const reading = win('heikatsu', 0).pose;
  const horizon = win('heikatsu').pose;
  assert.equal(reading.armF, 'trace');
  assert.equal(reading.headDy, 4);
  assert.equal(horizon.armF, 'hold');
  assert.equal(horizon.armB, 'hold');
  assert.equal(horizon.headDy, -4);
  assert.equal(horizon.face, 'normal');
  assert.equal(horizon.mouth, 'flat');
  assert.ok(record(CHARS.heikatsu.look).some((r) => r.color === '#e6dcc0' && r.w === 64 && r.h === 44));
  assert.equal(EXTRA_LOOKS.heikatsu.winPose, 'heikatsu');
});

test('応援三峰は小さな拳から照れ隠しへ。身体ではなく頭だけを反対に向ける', () => {
  const initial = win('mitsumine_cheer', 0).pose;
  assert.equal(initial.armF, 'cheerFist');
  assert.equal(initial.headFacing, 1);
  assert.equal(initial.mouth, 'subtleSmile');
  for (const t of [24, 72, 240, 960, 10000]) {
    const p = win('mitsumine_cheer', t).pose;
    assert.equal(p.armF, 'behind');
    assert.equal(p.armB, 'behind');
    assert.equal(p.headFacing, -1);
    assert.equal(p.face, 'normal');
    assert.equal(p.mouth, 'flat');
  }
});

test('覚醒三重は拳と下げたハンマー・重い呼吸。腕組みや満足げな笑顔は使わない', () => {
  for (let t = 0; t < 120; t += 10) {
    const f = win('kakusei', t);
    assert.equal(f.pose.armF, 'fist');
    assert.equal(f.pose.armB, 'fist');
    assert.equal(f.pose.legs, 'wide');
    assert.equal(f.pose.headDy, 4);
    assert.equal(f.pose.face, 'normal');
    assert.ok(f.pose.mouth === 'gritted' || f.pose.mouth === 'exhale');
    assert.equal(f.idleHammer, true);
    const rects = record(CHARS.kakusei.look, winOpts(t));
    assert.ok(rects.some((r) => r.color === '#9c6a34'), '握った木柄');
    assert.ok(rects.some((r) => r.color === '#565b63' && r.y > -40), 'ハンマーの頭は下げている');
  }
});

test('勝利開始からの時間で決め動作を行い、長い試合やタイトルの周回でも冒頭を繰り返さない', () => {
  for (const id of ALL_CHARS) {
    for (const poseT of [0, 12, 24, 72]) {
      assert.deepEqual(win(id, poseT, 0).pose, win(id, poseT, 987654).pose, `${id}/${poseT}`);
    }
  }
  for (const t of [72, 240, 960, 10000]) {
    assert.equal(win('mie', t).pose.armF, 'dismiss');
    assert.equal(win('naito', t).pose.propFrame, 0);
    assert.equal(win('rei', t).pose.armF, 'penReady');
    assert.equal(win('mitsumine_cheer', t).pose.headFacing, -1);
  }
  const ordinary: PoseId[] = ['idle', 'walk', 'jab', 'swing', 'hurt', 'observe'];
  for (const pose of ordinary) {
    assert.deepEqual(
      resolveFighterFrame(CHARS.naito.look, { ...winOpts(0, 18), pose }),
      resolveFighterFrame(CHARS.naito.look, { ...winOpts(9000, 18), pose }),
      `poseT は ${pose} の動きに影響しない`,
    );
  }
  // undefined の背景人物に加え、HMRで旧プリセットを持つLookが残った場合も安全。
  for (const winPose of [undefined, 'peace' as CharId]) {
    const unknown: Look = { ...CHARS.rei.look, winPose };
    const p = resolveFighterFrame(unknown, winOpts()).pose;
    assert.equal(p.victory, undefined);
    assert.equal(p.face, 'normal');
    assert.equal(p.mouth, 'flat');
  }
});

test('勝利の全決め動作・保持コマを左右/フラッシュ込みで実画像比較し、シートから描ける', async (t) => {
  browserCanvases(t);
  const actual = canvas();
  const expected = canvas();
  const a = actual.getContext('2d')!;
  const e = expected.getContext('2d')!;
  const drawImage = a.drawImage.bind(a);
  let blits = 0;
  a.drawImage = (...args: unknown[]) => { blits++; Reflect.apply(drawImage, a, args); };
  let count = 0;
  const looks = [...ALL_CHARS.map((id) => CHARS[id].look), SAKURA_LOVE_LOOK];
  for (const look of looks) for (const poseT of [0, 9, 10, 12, 15, 16, 18, 23, 24, 30, 35, 36, 48, 72, 144, 960]) for (const facing of [1, -1] as const) for (const flash of [false, true]) {
    const opts = { ...winOpts(poseT), facing, flash };
    a.clearRect(0, 0, 480, 320);
    e.clearRect(0, 0, 480, 320);
    drawFighter(a, 224, 273, look, opts);
    drawFighterPixels(e, 224, 273, look, opts);
    assert.ok(pixels(actual).equals(pixels(expected)), `${look.winPose}/${poseT}/${facing}/${flash}`);
    count++;
    if (count % 24 === 0) await nextTurn();
  }
  assert.equal(blits, count, '新しい小物を含めて256pxのシートに収まる');
  assert.ok(getSpriteSheetStats().bytes <= 32 * 1024 * 1024);
  clearSpriteSheets();
  for (const poseT of [24, 48, 72, 96]) drawFighter(a, 224, 273, CHARS.rei.look, winOpts(poseT));
  assert.equal(getSpriteSheetStats().frames, 1, '生の poseT をキーに入れて無限にコマを増やさない');
  assert.equal(getSpriteSheetStats().hits, 3);
});

test('実際のKOから勝利状態に入り、Renderer は試合時刻ではなく stateT のコマを描く', async (t) => {
  browserCanvases(t);
  const game = canvas();
  const fx = canvas();
  const renderer = new Renderer(game, fx);
  const g = game.getContext('2d')!;
  const drawImage = g.drawImage.bind(g);
  type Capture = { source: CanvasImageSource; sx: number; sy: number; w: number; h: number; dx: number };
  let captures: Capture[] = [];
  g.drawImage = (...args: unknown[]) => {
    if (args.length === 9) {
      const [source, sx, sy, w, h, dx] = args as [HTMLCanvasElement, number, number, number, number, number];
      if (source.width === 256 && source.height === 256) captures.push({ source, sx, sy, w, h, dx });
    }
    Reflect.apply(drawImage, g, args);
  };
  for (const id of ALL_CHARS) {
    const b = new Battle({ p1: id, p2: 'mie', ai: [false, false], difficulty: 'normal', stage: 'classroom', seed: 7 });
    b.phase = 'fight';
    b.t = 5000;
    b.f[1].hp = 0;
    for (let i = 0; i < 200 && b.f[0].state !== 'win'; i++) b.step([EMPTY_INPUT, EMPTY_INPUT]);
    assert.equal(b.f[0].state, 'win', id);
    assert.equal(b.f[0].stateT, 0, '勝利の開始は常に0');
    assert.equal(b.poseOf(b.f[0]), 'win');
    for (const elapsed of [0, 48]) {
      while (b.f[0].stateT < elapsed) b.step([EMPTY_INPUT, EMPTY_INPUT]);
      const f = b.f[0];
      captures = [];
      renderer.draw(b);
      const capture = captures.find((c) => c.dx > f.x - 128 && c.dx < f.x + 128);
      assert.ok(capture, `${id}/${elapsed} のファイターのシート描画がない`);
      const opts = { ...winOpts(f.stateT, b.t), phase: b.phaseOf(f), flash: f.flash > 0 };
      const rects = record(f.look, opts);
      const left = Math.min(...rects.map((r) => r.x));
      const top = Math.min(...rects.map((r) => r.y));
      const right = Math.max(...rects.map((r) => r.x + r.w));
      const bottom = Math.max(...rects.map((r) => r.y + r.h));
      const expected = canvas(right - left, bottom - top);
      drawFighterPixels(expected.getContext('2d')!, -left, -top, f.look, opts);
      const actual = canvas(capture.w, capture.h);
      actual.getContext('2d')!.drawImage(capture.source, capture.sx, capture.sy, capture.w, capture.h, 0, 0, capture.w, capture.h);
      assert.equal(capture.w, expected.width);
      assert.equal(capture.h, expected.height);
      assert.ok(pixels(actual).equals(pixels(expected)), `${id}/${elapsed}: stateT の勝利コマと一致しない`);
    }
    await nextTurn();
  }
});

test('内藤の超必殺の微笑みは勝利モーションから独立し、本を閉じる決め動作を発火しない', () => {
  const b = new Battle({ p1: 'naito', p2: 'mie', ai: [false, false], difficulty: 'normal', stage: 'classroom', seed: 7 });
  const f = b.f[0];
  f.state = 'super';
  assert.equal(b.poseOf(f), 'observe');
  const p = resolveFighterFrame(f.look, { pose: b.poseOf(f), t: b.t, poseT: 0 }).pose;
  assert.equal(p.victory, undefined);
  assert.equal(p.mouth, 'subtleSmile');
  f.state = 'win';
  assert.equal(b.poseOf(f), 'win');
  assert.equal(win('naito', 0).pose.propFrame, 1);
});
