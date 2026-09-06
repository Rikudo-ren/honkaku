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
