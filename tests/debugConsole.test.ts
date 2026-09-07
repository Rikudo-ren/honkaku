import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HIDDEN_META } from '../src/game/characters';
import {
  EXTREME_UNLOCK_KEY,
  clearUnlocked,
  createDebugConsole,
  loadHiddenUnlocks,
  loadUnlocked,
  saveUnlocked,
} from '../src/game/unlock';

/** localStorage スタブ（removeItem 付き）を入れる */
function stubStorage(t: { after: (fn: () => void) => void }, storage = new Map<string, string>()) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    },
  });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  });
  return storage;
}

test('clearUnlocked は解禁フラグだけを消す', (t) => {
  const storage = stubStorage(t);
  saveUnlocked(EXTREME_UNLOCK_KEY);
  saveUnlocked(HIDDEN_META[0].key);
  assert.equal(loadUnlocked(EXTREME_UNLOCK_KEY), true);
  clearUnlocked(EXTREME_UNLOCK_KEY);
  assert.equal(loadUnlocked(EXTREME_UNLOCK_KEY), false);
  assert.equal(storage.get(HIDDEN_META[0].key), '1');
});

test('unlockAll ですべて解禁され、refresh が呼ばれる', (t) => {
  stubStorage(t);
  let refreshed = 0;
  const api = createDebugConsole(() => {
    refreshed++;
  });
  const st = api.unlockAll();
  assert.equal(refreshed, 1);
  assert.equal(st.extreme, true);
  for (const m of HIDDEN_META) assert.equal(st.hidden[m.id], true);
  assert.equal(loadUnlocked(EXTREME_UNLOCK_KEY), true);
  assert.deepEqual(loadHiddenUnlocks(), st.hidden);
});

test("unlock('sakura') は1体だけ解禁する。不正idは警告して何もしない", (t) => {
  stubStorage(t);
  let refreshed = 0;
  const api = createDebugConsole(() => {
    refreshed++;
  });
  const warned: string[] = [];
  const origWarn = console.warn;
  console.warn = (msg: string) => {
    warned.push(msg);
  };
  try {
    const st = api.unlock('sakura');
    assert.equal(refreshed, 1);
    assert.deepEqual(st.hidden, { sakura: true });
    assert.equal(st.extreme, false);
    const before = refreshed;
    const st2 = api.unlock('mie');
    assert.equal(refreshed, before, '不正idでは refresh しない');
    assert.deepEqual(st2.hidden, { sakura: true });
    assert.equal(warned.length, 1);
    assert.match(warned[0], /unknown hidden char: mie/);
  } finally {
    console.warn = origWarn;
  }
});

test('extreme は偏差値100だけ、lockAll は全消去、status は現状を返す', (t) => {
  stubStorage(t);
  let refreshed = 0;
  const api = createDebugConsole(() => {
    refreshed++;
  });
  assert.deepEqual(api.status(), { extreme: false, hidden: {} });
  api.extreme();
  assert.equal(api.status().extreme, true);
  assert.deepEqual(api.status().hidden, {});
  api.unlockAll();
  const locked = api.lockAll();
  assert.equal(refreshed, 3);
  assert.deepEqual(locked, { extreme: false, hidden: {} });
  assert.equal(loadUnlocked(EXTREME_UNLOCK_KEY), false);
  assert.deepEqual(loadHiddenUnlocks(), {});
});
