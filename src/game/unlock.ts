import type { Difficulty, Setup, Side } from './types';
import type { HiddenUnlocks } from './characters';
import { HIDDEN_META } from './characters';

/**
 * 解禁（アンロック）関連の小物一式。
 * - 偏差値100（難易度）の解禁はここで管理。
 * - 隠しキャラの解禁は characters.ts の HIDDEN_META（解禁キー＋条件）を参照する。
 *   新キャラを足すときは HIDDEN_META に1項目足すだけでよく、ここを触る必要はない。
 */

/** 偏差値100 解禁フラグ（localStorage） */
export const EXTREME_UNLOCK_KEY = 'honkaku_extreme_unlocked';

/** localStorage に解禁フラグがあるか（無ければ false） */
export function loadUnlocked(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** localStorage に解禁フラグを保存 */
export function saveUnlocked(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
}

/** localStorage の解禁フラグを消す（デバッグコンソール用） */
export function clearUnlocked(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

// ───────────────────────── デバッグコンソール ─────────────────────────
/**
 * ブラウザの開発者コンソールから呼ぶデバッグAPI。
 * App 側で `window.__honkaku` に登録する。例:
 *   __honkaku.unlockAll()      // 隠しキャラ＋偏差値100を全部解禁
 *   __honkaku.unlock('sakura') // 隠しキャラ1体を解禁
 *   __honkaku.extreme()        // 偏差値100だけ解禁
 *   __honkaku.lockAll()        // 全解禁を取り消し
 *   __honkaku.status()         // 現在の解禁状況
 */
export interface DebugConsole {
  unlockAll: () => { extreme: boolean; hidden: HiddenUnlocks };
  unlock: (id: string) => { extreme: boolean; hidden: HiddenUnlocks };
  extreme: () => { extreme: boolean; hidden: HiddenUnlocks };
  lockAll: () => { extreme: boolean; hidden: HiddenUnlocks };
  status: () => { extreme: boolean; hidden: HiddenUnlocks };
  help: () => void;
}

export function createDebugConsole(refresh: () => void): DebugConsole {
  const status = () => ({ extreme: loadUnlocked(EXTREME_UNLOCK_KEY), hidden: loadHiddenUnlocks() });
  const done = () => {
    refresh();
    return status();
  };
  return {
    unlockAll() {
      for (const m of HIDDEN_META) saveUnlocked(m.key);
      saveUnlocked(EXTREME_UNLOCK_KEY);
      return done();
    },
    unlock(id: string) {
      const m = HIDDEN_META.find((x) => x.id === id);
      if (!m) {
        console.warn(`[honkaku] unknown hidden char: ${id}（使えるid: ${HIDDEN_META.map((x) => x.id).join(', ')}）`);
        return status();
      }
      saveUnlocked(m.key);
      return done();
    },
    extreme() {
      saveUnlocked(EXTREME_UNLOCK_KEY);
      return done();
    },
    lockAll() {
      for (const m of HIDDEN_META) clearUnlocked(m.key);
      clearUnlocked(EXTREME_UNLOCK_KEY);
      return done();
    },
    status,
    help() {
      console.log(
        '[honkaku debug]\n' +
          '  __honkaku.unlockAll()      隠しキャラ全員＋偏差値100を解禁\n' +
          `  __honkaku.unlock('sakura')  隠しキャラ1体を解禁（id: ${HIDDEN_META.map((x) => x.id).join(', ')}）\n` +
          '  __honkaku.extreme()        偏差値100だけ解禁\n' +
          '  __honkaku.lockAll()        全解禁を取り消し（初期状態に戻す）\n' +
          '  __honkaku.status()         現在の解禁状況を表示'
      );
    },
  };
}

/** 偏差値100の解禁条件：1P対CPU・偏差値85で勝つ */
export function isExtremeUnlockMatch(setup: Setup, winner: Side): boolean {
  return winner === 0 && setup.mode === '1p' && setup.difficulty === 'hard' && !setup.teamMode;
}

/** 保存済みの隠しキャラ解禁状況を読み込む（全キャラ分） */
export function loadHiddenUnlocks(): HiddenUnlocks {
  const u: HiddenUnlocks = {};
  for (const m of HIDDEN_META) if (loadUnlocked(m.key)) u[m.id] = true;
  return u;
}

// ───────────────────────── 設定の記憶（CPU偏差値など） ─────────────────────────
/** 選択したCPU偏差値を記憶する localStorage キー（タイトル⇔他画面を往復しても維持） */
export const DIFFICULTY_KEY = 'honkaku_selected_difficulty';
const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'normal', 'hard', 'extreme'];

function loadPref(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function savePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** 記憶されたCPU偏差値を読む（不正値は normal にフォールバック。extreme は解禁済みかどうかは呼び出し側で判定） */
export function loadDifficulty(): Difficulty {
  const v = loadPref(DIFFICULTY_KEY);
  return (DIFFICULTY_ORDER as string[]).includes(v as string) ? (v as Difficulty) : 'normal';
}

/** CPU偏差値を記憶する（タイトル画面での選択時に呼ぶ） */
export function saveDifficulty(d: Difficulty) {
  savePref(DIFFICULTY_KEY, d);
}
