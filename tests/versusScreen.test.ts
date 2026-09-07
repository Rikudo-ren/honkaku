import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer, type ViteDevServer } from 'vite';
import { ALL_CHARS, CHARS, INTRO_PAIRS, MIRROR_INTROS, pairKey } from '../src/game/characters';
import { Battle } from '../src/game/engine';
import { EMPTY_INPUT, type CharId, type Setup } from '../src/game/types';

let server: ViteDevServer;
let VersusScreen: ComponentType<{ setup: Setup; onDone: () => void }>;

before(async () => {
  // Viteで実際のTSXを読む。立ち絵の画像前処理だけをスタブにし、VSの条件分岐と本文を検証する。
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('../', import.meta.url)),
    cacheDir: 'node_modules/.vite-versus-tests',
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false, watch: null },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
    plugins: [{
      name: 'versus-test-portrait',
      enforce: 'pre',
      resolveId(id) {
        if (id === '@/components/Portrait' || /\/components\/Portrait(?:\.tsx)?$/.test(id)) return '\0test-portrait';
      },
      load(id) {
        if (id === '\0test-portrait') return "import { createElement } from 'react'; export function Portrait({id, alt}) { return createElement('img', {'data-portrait': id, alt}); }";
      },
    }],
  });
  ({ default: VersusScreen } = await server.ssrLoadModule('/src/components/VersusScreen.tsx'));
});

after(async () => { await server?.close(); });

const setupFor = (p1: CharId, p2: CharId, mode: Setup['mode'] = '1p'): Setup => ({
  p1, p2, mode, difficulty: 'normal', stage: 'classroom', seed: 0,
});
const markupFor = (setup: Setup) => renderToStaticMarkup(createElement(VersusScreen, { setup, onDone() {} }));
const escaped = (s: string) => renderToStaticMarkup(createElement('span', null, s)).slice(6, -7);

function assertNoPreview(html: string, a: CharId, b: CharId) {
  for (const pair of INTRO_PAIRS[pairKey(a, b)] ?? []) {
    const other = pair.first === a ? b : a;
    assert.ok(!html.includes(escaped(`${CHARS[pair.first].name}「${pair.a}」`)), `${a}/${b}: 先手の掛け合いを先出ししている`);
    assert.ok(!html.includes(escaped(`${CHARS[other].name}「${pair.b}」`)), `${a}/${b}: 返答を先出ししている`);
  }
  if (a === b) {
    const mirror = MIRROR_INTROS[a];
    if (mirror) assert.ok(!html.includes(escaped(`「${mirror.a}」「${mirror.b}」`)), `${a}: ミラー掛け合いの先出し`);
    else assert.ok(!html.includes('自演じゃなくて自己対話だよ'), `${a}: ミラー戦の予告文を残さない`);
  }
}

test('VSカットインは全組み合わせ・同キャラ戦で掛け合いを先出しせず、名前・ステージ・スキップ案内を残す', () => {
  for (const mode of ['1p', '2p', 'cpu', 'online'] as const) for (const a of ALL_CHARS) for (const b of ALL_CHARS) {
    const html = markupFor(setupFor(a, b, mode));
    assertNoPreview(html, a, b);
    assert.ok(html.includes(CHARS[a].name));
    assert.ok(html.includes(CHARS[b].name));
    assert.ok(html.includes(`data-portrait="${a}"`));
    assert.ok(html.includes('>VS<'));
    assert.ok(html.includes('STAGE：'));
    assert.ok(html.includes('クリック / Enter でスキップ'));
  }
});

test('オンラインのプレイヤー表示と、チーム戦の編成表示は維持する', () => {
  const online = markupFor({ ...setupFor('ryoma', 'mitsumine', 'online'), onlineNames: ['Alice', 'Bob'], onlineSide: 0 });
  assert.ok(online.includes('Alice（あなた）'));
  assert.ok(online.includes('Bob'));
  assertNoPreview(online, 'ryoma', 'mitsumine');
  for (const mode of ['team', 'online'] as const) {
    const html = markupFor({ ...setupFor('ryoma', 'mitsumine', mode), teamMode: true, fighters: [
      { char: 'ryoma', team: 0, ai: false, pad: 0 },
      { char: 'rei', team: 0, ai: true },
      { char: 'mitsumine', team: 1, ai: false, pad: 1 },
      { char: 'naito', team: 1, ai: true },
    ] });
    assertNoPreview(html, 'ryoma', 'mitsumine');
    assert.ok(html.includes('青チーム'));
    assert.ok(html.includes('赤チーム'));
    assert.ok(html.includes('4人同時乱戦'));
    assert.equal((html.match(/data-portrait=/g) ?? []).length, 4);
  }
});

test('対戦開始後の掛け合いとミラー会話は削除しない', () => {
  for (const [a, b] of [['mie', 'ryoma'], ['mitsumine', 'rei'], ['naito', 'sakura'], ['mie', 'mie'], ['mitsumine', 'mitsumine'], ['sakura', 'sakura']] as const) {
    const battle = new Battle({ ...setupFor(a, b), ai: [false, false], seed: 23 });
    for (let t = 0; t < 40; t++) battle.step([EMPTY_INPUT, EMPTY_INPUT]);
    const spoken = battle.bubbles.map((bubble) => bubble.text);
    if (a === b) {
      const mirror = MIRROR_INTROS[a];
      assert.ok(spoken.includes(mirror?.a ?? CHARS[a].intro));
      assert.ok(spoken.includes(mirror?.b ?? '自演じゃなくて自己対話だよ'));
    } else {
      const pairs = INTRO_PAIRS[pairKey(a, b)];
      if (pairs?.length) assert.ok(pairs.some((pair) => spoken.includes(pair.a) && spoken.includes(pair.b)), `${a}/${b}: 本番の掛け合いがない`);
      else {
        assert.ok(spoken.includes(CHARS[a].intro));
        assert.ok(spoken.includes(CHARS[b].intro));
      }
    }
  }
});
