import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ALL_CHARS, CHARS, CHAR_ORDER, HIDDEN_CHARS, HIDDEN_META,
  hiddenCharsSatisfied, hiddenMeta, isHiddenChar, lockedHidden, rosterFor,
} from '../src/game/characters';
import type { HiddenUnlocks } from '../src/game/characters';
import { loadHiddenUnlocks, saveUnlocked } from '../src/game/unlock';
import type { Setup } from '../src/game/types';

const id = 'mitsumine_cheer' as const;
const meta = hiddenMeta(id)!;
const match: Setup = { mode: '1p', p1: 'mie', p2: 'mitsumine', difficulty: 'hard', stage: 'classroom' };

test('応援三峰は初期選択不可。隠し順・解禁演出順はヘイカツの次、覚醒三重の前', () => {
  assert.equal(CHARS[id].hidden, true);
  assert.equal(isHiddenChar(id), true);
  assert.equal(isHiddenChar('mitsumine'), false, '通常版の三峰は初期キャラのまま');
  assert.deepEqual(CHAR_ORDER, ['mie', 'ryoma', 'naito', 'mitsumine', 'terachi', 'rei']);
  assert.deepEqual(HIDDEN_CHARS, ['sakura', 'heikatsu', id, 'kakusei']);
  assert.deepEqual(HIDDEN_META.map((m) => m.id), HIDDEN_CHARS);
  assert.deepEqual(rosterFor({}), CHAR_ORDER);
  assert.equal(ALL_CHARS.indexOf(id), ALL_CHARS.indexOf('heikatsu') + 1);
  assert.equal(ALL_CHARS.indexOf('kakusei'), ALL_CHARS.indexOf(id) + 1);
  assert.equal(meta.key, 'honkaku_mitsumine_cheer_unlocked');
  assert.equal(new Set(HIDDEN_META.map((m) => m.key)).size, HIDDEN_META.length);
  assert.equal(meta.title, '？？？');
  assert.match(meta.hint, /否定の守護者.*常識の塊.*85/);
  assert.match(meta.condition, /三重県臣.*85以上.*三峰瑠衣（通常版）/);
  for (const text of [meta.sub, meta.quote, meta.byline, meta.kit, meta.bannerTitle, meta.bannerText]) assert.ok(text.length > 0);
});

test('既存の解禁フラグを含む全16通りで、解禁済みだけが隠し順に選択できる', () => {
  for (let mask = 0; mask < 1 << HIDDEN_CHARS.length; mask++) {
    const flags: HiddenUnlocks = {};
    HIDDEN_CHARS.forEach((char, i) => { if (mask & (1 << i)) flags[char] = true; });
    const roster = rosterFor(flags);
    assert.deepEqual(roster, [...CHAR_ORDER, ...HIDDEN_CHARS.filter((char) => flags[char])]);
    assert.deepEqual(lockedHidden(flags), HIDDEN_CHARS.filter((char) => !flags[char]));
    assert.equal(roster.includes(id), !!flags[id]);
    assert.equal(new Set(roster).size, roster.length);
    if (flags.heikatsu && flags[id]) assert.equal(roster.indexOf(id), roster.indexOf('heikatsu') + 1);
    if (flags.kakusei && flags[id]) assert.equal(roster.indexOf('kakusei'), roster.indexOf(id) + 1);
  }
});

test('解放条件：1Pの三重県臣が偏差値85または100の通常版三峰に勝つ（ステージ不問）', () => {
  for (const difficulty of ['hard', 'extreme'] as const) {
    for (const stage of ['classroom', 'lake', 'sakura', 'hawaii'] as const) {
      const result = hiddenCharsSatisfied({}, { ...match, difficulty, stage }, 0);
      assert.deepEqual(result.map((m) => m.id), [id], `${difficulty} / ${stage}`);
    }
  }
});

test('敗北・低難易度・別モード・チーム戦・違う使用キャラや相手では応援三峰は解放しない', () => {
  assert.equal(meta.isUnlock(match, 1), false, '1Pの敗北');
  for (const difficulty of ['easy', 'normal'] as const) {
    assert.equal(meta.isUnlock({ ...match, difficulty }, 0), false, difficulty);
  }
  for (const mode of ['2p', 'cpu', 'team', 'online'] as const) {
    assert.equal(meta.isUnlock({ ...match, mode }, 0), false, mode);
  }
  assert.equal(meta.isUnlock({ ...match, teamMode: true }, 0), false);
  for (const char of ALL_CHARS) {
    if (char !== 'mie') assert.equal(meta.isUnlock({ ...match, p1: char }, 0), false, `使用キャラ ${char}`);
    if (char !== 'mitsumine') assert.equal(meta.isUnlock({ ...match, p2: char }, 0), false, `相手 ${char}`);
  }
  assert.equal(meta.isUnlock({ ...match, p1: 'mitsumine', p2: 'mie' }, 0), false, '対戦カードを逆にしても不可');
});

test('解放フラグは既存セーブに追加して保存でき、再読込後も維持・再解放はしない', (t) => {
  const storage = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });

  assert.deepEqual(loadHiddenUnlocks(), {});
  assert.ok(!rosterFor(loadHiddenUnlocks()).includes(id));
  for (const char of ['sakura', 'heikatsu', 'kakusei'] as const) saveUnlocked(hiddenMeta(char)!.key);
  const oldFlags = loadHiddenUnlocks();
  assert.deepEqual(oldFlags, { sakura: true, heikatsu: true, kakusei: true });
  assert.ok(!rosterFor(oldFlags).includes(id), '過去の解禁だけで応援版を自動解放しない');

  for (const unlocked of hiddenCharsSatisfied(oldFlags, match, 0)) saveUnlocked(unlocked.key);
  assert.equal(storage.get(meta.key), '1');
  assert.deepEqual(loadHiddenUnlocks(), { ...oldFlags, [id]: true });
  assert.deepEqual(rosterFor(loadHiddenUnlocks()), ALL_CHARS);
  assert.deepEqual(hiddenCharsSatisfied(loadHiddenUnlocks(), match, 0), [], '同じ条件で再解放しない');
  assert.equal(storage.get('honkaku_sakura_unlocked'), '1');
  assert.equal(storage.get('honkaku_heikatsu_unlocked'), '1');
  assert.equal(storage.get('honkaku_kakusei_unlocked'), '1');
});
