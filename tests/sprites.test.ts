import assert from 'node:assert/strict';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { test, type TestContext } from 'node:test';
import { createCanvas } from '@napi-rs/canvas';
import { CHARS, EXTRA_LOOKS, SAKURA_LOVE_LOOK } from '../src/game/characters';
import { SpriteSheetCache, type PixelPaintContext } from '../src/game/spriteSheet';
import { clearSpriteSheets, drawFighter, drawFighterPixels, getSpriteSheetStats, resolveFighterFrame, type DrawOpts } from '../src/game/sprites';
import type { Look, PoseId } from '../src/game/types';

const POSES: PoseId[] = [
  'idle', 'walk', 'jump', 'crouch', 'block', 'jab', 'swing', 'kick', 'lash', 'throw', 'counter',
  'point', 'pointUp', 'hurt', 'launch', 'down', 'getup', 'win', 'observe', 'lose', 'stun', 'frozen', 'spread',
  'grab', 'grabbed', 'paper', 'penJab', 'confess', 'cheerClap', 'cheerTurn', 'cheerCall',
  'airClap', 'airDive', 'airStep',
];
const LOOKS: [string, Look][] = [
  ...Object.entries(CHARS).map(([id, c]): [string, Look] => [id, c.look]),
  ...Object.entries(EXTRA_LOOKS),
  ['sakura-love', SAKURA_LOVE_LOOK],
];
const TIMES = [0, 1, 3, 4, 5, 6, 8, 12, 19, 20, 24, 39, 40, 47, 48, 59, 60, 195, 199, 200, 205, 12345, 1e9];
const BASE: DrawOpts = { pose: 'idle', facing: 1, t: 0 };

// The production code only needs the standard Canvas 2D API. These native test
// canvases exercise real rasterization/blitting, not a mock of drawImage itself.
const canvas = (w = 480, h = 320) => createCanvas(w, h) as unknown as HTMLCanvasElement;
const context = (cv = canvas()) => cv.getContext('2d')!;
const pixels = (g: CanvasRenderingContext2D) => Buffer.from(g.getImageData(0, 0, g.canvas.width, g.canvas.height).data);
const wipe = (g: CanvasRenderingContext2D) => g.clearRect(0, 0, g.canvas.width, g.canvas.height);

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

function paintRect(color: string, w = 14, h = 14) {
  return (g: PixelPaintContext) => {
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
  };
}

test('シートは遅延生成し、キャッシュヒット時は再作画せず drawImage 1回で描く', (t) => {
  let allocations = 0;
  let paints = 0;
  let blits = 0;
  const sheets = new SpriteSheetCache({ createCanvas: () => { allocations++; return canvas(); } });
  t.after(() => sheets.clear());
  const g = context();
  const drawImage = g.drawImage.bind(g);
  g.drawImage = (...args: unknown[]) => { blits++; Reflect.apply(drawImage, g, args); };
  const paint = (ctx: PixelPaintContext) => { paints++; paintRect('#ff0000')(ctx); };
  assert.equal(allocations, 0);
  assert.equal(sheets.getStats().frames, 0);
  assert.equal(sheets.draw(g, 20, 30, 'frame', paint), true);
  assert.equal(sheets.draw(g, 100, 60, 'frame', paint, { flipX: true, alpha: 0.3 }), true);
  assert.deepEqual({ allocations, paints, blits }, { allocations: 1, paints: 1, blits: 2 });
  assert.equal(sheets.getStats().hits, 1);
  assert.equal(sheets.getStats().frames, 1);
});

test('実際の描画範囲から切り出すので負座標・張り出した武器・左右反転も欠けない', (t) => {
  const sheets = new SpriteSheetCache({ pageSize: 512, createCanvas: () => canvas() });
  t.after(() => sheets.clear());
  const expected = context();
  const actual = context();
  const paint = (g: PixelPaintContext) => {
    g.fillStyle = '#123456';
    g.fillRect(-120, -240, 12, 8);
    g.fillStyle = '#ff0000';
    g.fillRect(180, -100, 24, 16);
    g.fillStyle = '#00ff00';
    g.fillRect(10, 20, -8, -12);
  };
  for (const flipX of [false, true]) {
    wipe(expected);
    wipe(actual);
    expected.save();
    expected.translate(224, 273);
    expected.scale(flipX ? -1 : 1, 1);
    paint(expected);
    expected.restore();
    sheets.draw(actual, 224.4, 272.6, 'wide', paint, { flipX });
    assert.ok(pixels(actual).equals(pixels(expected)));
  }
});

test('描画先の変換・透明度・補間・色は save/restore で維持される', (t) => {
  const sheets = new SpriteSheetCache({ createCanvas: () => canvas() });
  t.after(() => sheets.clear());
  const g = context();
  g.setTransform(2, 0, 0, 2, 7, 9);
  g.globalAlpha = 0.7;
  g.imageSmoothingEnabled = true;
  g.fillStyle = '#abcdef';
  const before = { transform: g.getTransform(), alpha: g.globalAlpha, fill: g.fillStyle };
  sheets.draw(g, 10, 20, 'frame', paintRect('#ff0000'), { flipX: true, alpha: 0.4 });
  assert.deepEqual(g.getTransform(), before.transform);
  assert.equal(g.globalAlpha, before.alpha);
  assert.equal(g.fillStyle, before.fill);
  assert.equal(g.imageSmoothingEnabled, true);
});

test('容量上限では最近使っていないページを再利用し、古いキーとピクセルを消す', (t) => {
  const backing: HTMLCanvasElement[] = [];
  const sheets = new SpriteSheetCache({ pageSize: 16, maxPages: 2, createCanvas: () => {
    const cv = canvas();
    backing.push(cv);
    return cv;
  } });
  t.after(() => sheets.clear());
  const g = context(canvas(16, 16));
  const counts = { a: 0, b: 0, c: 0 };
  const paint = (id: keyof typeof counts) => (ctx: PixelPaintContext) => {
    counts[id]++;
    paintRect(id === 'a' ? '#ff0000' : '#0000ff')(ctx);
  };
  sheets.draw(g, 0, 0, 'a', paint('a'));
  sheets.draw(g, 0, 0, 'b', paint('b'));
  sheets.draw(g, 0, 0, 'a', paint('a')); // a のページを保護する
  sheets.draw(g, 0, 0, 'c', paint('c')); // b のページを再利用
  sheets.draw(g, 0, 0, 'a', paint('a'));
  assert.deepEqual(counts, { a: 1, b: 1, c: 1 });
  assert.equal(sheets.getStats().evictions, 1);
  sheets.draw(g, 0, 0, 'b', paint('b'));
  assert.equal(counts.b, 2);
  assert.equal(backing.length, 2, '新しい Canvas を作り続けない');
  assert.equal(sheets.getStats().frames, 2, '退避したページのキーを残さない');
  assert.equal(sheets.getStats().bytes, 16 * 16 * 4 * 2);

  // 外枠の大きさは同じでも、中が透明なコマへ置換するときに旧画像を残さない。
  wipe(g);
  const outline = (ctx: PixelPaintContext) => {
    paintRect('#00ff00', 14, 2)(ctx);
    paintRect('#00ff00', 2, 14)(ctx);
  };
  sheets.draw(g, 0, 0, 'outline', outline);
  assert.equal(g.getImageData(7, 7, 1, 1).data[3], 0);
  sheets.clear();
  assert.equal(sheets.getStats().bytes, 0);
  assert.equal(sheets.getStats().frames, 0);
  assert.equal(sheets.getStats().pages, 0);
  sheets.draw(g, 0, 0, 'a', paint('a'));
  assert.equal(backing.length, 3, 'clear 後は旧ページを保持せず、新しく生成する');
});

test('空の絵・大きすぎる絵は切り捨てずフォールバックでき、その後の正常描画も可能', (t) => {
  let allocations = 0;
  const sheets = new SpriteSheetCache({ pageSize: 16, createCanvas: () => { allocations++; return canvas(); } });
  t.after(() => sheets.clear());
  const g = context();
  assert.equal(sheets.draw(g, 0, 0, 'empty', () => {}), false);
  assert.equal(sheets.draw(g, 0, 0, 'too-wide', paintRect('#ff0000', 15)), false);
  assert.equal(sheets.draw(g, 0, 0, 'too-high', paintRect('#ff0000', 14, 15)), false);
  assert.equal(allocations, 0);
  assert.equal(sheets.getStats().disabled, false);
  assert.equal(sheets.draw(g, 0, 0, 'fits', paintRect('#ff0000')), true);
  assert.equal(allocations, 1);
});

test('Canvas の確保失敗・2D 非対応でも例外にせず、毎フレーム確保を再試行しない', () => {
  const factories = [
    () => null,
    () => { throw new Error('allocation failed'); },
    () => ({ width: 1, height: 1, getContext: () => null }) as unknown as HTMLCanvasElement,
  ];
  for (const factory of factories) {
    let attempts = 0;
    const sheets = new SpriteSheetCache({ createCanvas: () => { attempts++; return factory(); } });
    const g = context();
    assert.equal(sheets.draw(g, 0, 0, 'frame', paintRect('#ff0000')), false);
    assert.equal(sheets.draw(g, 0, 0, 'frame', paintRect('#ff0000')), false);
    assert.equal(attempts, 1);
    assert.equal(sheets.getStats().disabled, true);
    sheets.clear();
    assert.equal(sheets.getStats().disabled, false);
    sheets.draw(g, 0, 0, 'frame', paintRect('#ff0000'));
    assert.equal(attempts, 2);
    sheets.clear();
  }
  assert.throws(() => new SpriteSheetCache({ maxPages: 0 }), RangeError);
  assert.throws(() => new SpriteSheetCache({ pageSize: 2 }), RangeError);
});

test('全キャラ・変身・背景人物の全ポーズ/攻撃フェーズを、反転・白フラッシュ込みでピクセル比較', async (t) => {
  browserCanvases(t);
  const expected = context();
  const actual = context();
  let blits = 0;
  const drawImage = actual.drawImage.bind(actual);
  actual.drawImage = (...args: unknown[]) => { blits++; Reflect.apply(drawImage, actual, args); };
  let compared = 0;
  for (const [id, look] of LOOKS) for (const pose of POSES) for (const phase of [0, 1, 2] as const) for (const facing of [1, -1] as const) {
    const o: DrawOpts = { pose, phase, facing, t: TIMES[compared % TIMES.length], flash: compared % 5 === 0 };
    wipe(expected);
    wipe(actual);
    drawFighterPixels(expected, 224.4, 272.6, look, o);
    drawFighter(actual, 224.4, 272.6, look, o);
    assert.ok(pixels(actual).equals(pixels(expected)), `${id}/${pose}/${phase}/${facing}/${o.t}/${o.flash}`);
    compared++;
    // Let native Canvas readback handles be released between batches, rather
    // than retaining thousands of image buffers in one synchronous JS turn.
    if (compared % 24 === 0) await nextTurn();
  }
  assert.equal(blits, compared, '既存の全コマがページ内に収まり、直接描画へ逃げていない');
  assert.ok(getSpriteSheetStats().hits > 0);
  assert.ok(getSpriteSheetStats().evictions > 0, 'ページ再利用後の画像も比較する');
  assert.ok(getSpriteSheetStats().bytes <= 32 * 1024 * 1024);
  assert.equal(getSpriteSheetStats().disabled, false);
});

test('時間をキーにせず、位置・左右・透明度の違う同じ絵を再利用する', (t) => {
  browserCanvases(t);
  const g = context();
  for (const [i, time] of [0, 47, 200, 1e9].entries()) {
    drawFighter(g, 100 + i * 20, 260, CHARS.mie.look, { ...BASE, pose: 'down', t: time, facing: i % 2 ? -1 : 1, alpha: 1 - i * 0.2 });
  }
  assert.equal(getSpriteSheetStats().frames, 1);
  assert.equal(getSpriteSheetStats().hits, 3);
  const idleFrames = new Set(Array.from({ length: 1000 }, (_, t) => JSON.stringify(resolveFighterFrame(CHARS.mitsumine.look, { ...BASE, t }))));
  assert.equal(idleFrames.size, 4, 'ボブ＋リボンの待機は呼吸2コマ×瞬き2コマだけ');
});

test('瞬き・両方の揺れる髪型・汗・鉢巻・Python の動きと攻撃フェーズを区別する', () => {
  const frames = (look: Look, pose: PoseId = 'idle', phase: 0 | 1 | 2 = 0) =>
    Array.from({ length: 200 }, (_, t) => resolveFighterFrame(look, { pose, phase, t }));
  for (const id of ['naito', 'heikatsu'] as const) {
    assert.ok(new Set(frames(CHARS[id].look).map((f) => f.sway)).size > 1, `${id} の毛先を止めない`);
  }
  assert.equal(frames(CHARS.mie.look).filter((f) => f.blink).length, 5);
  assert.ok(frames(CHARS.mie.look, 'frozen').every((f) => !f.blink));
  assert.deepEqual(new Set(frames(CHARS.sakura.look).map((f) => f.sweatDrip)), new Set([0, 4, 8]));
  assert.deepEqual(new Set(frames(CHARS.mitsumine_cheer.look, 'walk').map((f) => f.headbandFlap)), new Set([0, 4, 8]));
  assert.ok(frames(CHARS.mitsumine_cheer.look).every((f) => f.headbandFlap === 0));
  assert.ok(new Set(frames(CHARS.rei.look, 'lash', 1).map((f) => JSON.stringify(f.pythonWave))).size > 20);
  assert.ok(frames(CHARS.rei.look).every((f) => f.pythonWave.length === 0));
  assert.equal(new Set([0, 1, 2].map((phase) => JSON.stringify(resolveFighterFrame(CHARS.ryoma.look, { ...BASE, pose: 'swing', phase: phase as 0 | 1 | 2 })))).size, 3);
});

test('変身・色替えは別コマになり、同じ Look オブジェクトの編集も即座に反映する', (t) => {
  browserCanvases(t);
  const actual = context();
  const expected = context();
  const look = { ...CHARS.sakura.look };
  drawFighter(actual, 224, 273, look, BASE);
  look.hairColor = '#00ff00';
  wipe(actual);
  drawFighter(actual, 224, 273, look, BASE);
  drawFighterPixels(expected, 224, 273, look, BASE);
  assert.ok(pixels(actual).equals(pixels(expected)));
  assert.equal(getSpriteSheetStats().frames, 2);
  drawFighter(actual, 224, 273, { ...look }, BASE);
  assert.equal(getSpriteSheetStats().frames, 2, '内容の等しい Look は共有');
  drawFighter(actual, 224, 273, SAKURA_LOVE_LOOK, BASE);
  assert.equal(getSpriteSheetStats().frames, 3);
});

test('無敵・起き上がり・残像の alpha は完成したコマに一度だけ適用する', (t) => {
  browserCanvases(t);
  const actual = context();
  const expected = context();
  const opaque = context();
  for (const alpha of [0, 0.175, 0.35, 0.55, 0.65, 1, undefined]) for (const facing of [1, -1] as const) {
    const o: DrawOpts = { ...BASE, pose: 'walk', t: 12, facing, flash: alpha === 0.65 };
    wipe(opaque);
    drawFighterPixels(opaque, 224, 273, CHARS.kakusei.look, o);
    wipe(actual);
    wipe(expected);
    actual.globalAlpha = 0.8;
    expected.globalAlpha = alpha ?? actual.globalAlpha;
    expected.drawImage(opaque.canvas, 0, 0);
    drawFighter(actual, 224, 273, CHARS.kakusei.look, { ...o, alpha });
    assert.ok(pixels(actual).equals(pixels(expected)), `alpha=${alpha}, facing=${facing}`);
    assert.equal(actual.globalAlpha, 0.8);
  }
  assert.equal(getSpriteSheetStats().frames, 2, '通常とフラッシュだけ。alpha ごとのシートは作らない');
});

test('DOM がない環境でも従来の直接描画にフォールバックする', (t) => {
  clearSpriteSheets();
  t.after(clearSpriteSheets);
  const actual = context();
  const expected = context();
  const o: DrawOpts = { ...BASE, pose: 'paper', facing: -1, flash: true, alpha: 0.55 };
  drawFighter(actual, 224, 273, CHARS.heikatsu.look, o);
  drawFighterPixels(expected, 224, 273, CHARS.heikatsu.look, o);
  assert.ok(pixels(actual).equals(pixels(expected)));
  assert.equal(getSpriteSheetStats().pages, 0);
});
