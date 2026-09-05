import { CHAR_ORDER, CHARS } from './characters';
import type { CharId, Difficulty, Mode, Setup } from './types';

/** 偏差値100（extreme）解禁の保存キー */
export const EXTREME_KEY = 'honkaku_extreme_unlocked';
/** 隠しキャラ・櫻優 解禁の保存キー */
export const SAKURA_KEY = 'honkaku_sakura_unlocked';

/**
 * 櫻優の解放条件：1P対戦（1対1）で、偏差値100（解禁）の内藤蘭に勝つ。
 * ※偏差値100は「1P対戦・偏差値85に勝つ」で先に解禁しておく必要がある。
 */
export const SAKURA_UNLOCK = {
  char: 'sakura' as CharId,
  mode: '1p' as Mode,
  difficulty: 'extreme' as Difficulty,
  opponent: 'naito' as CharId,
};

/** 解放条件の説明文（選択画面・タイトルのヒントに使う） */
export const SAKURA_UNLOCK_TEXT = '1P対戦・偏差値100（解禁）の内藤蘭に勝つ';

export function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function writeFlag(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* localStorage が使えない環境では何もしない */
  }
}

/** 解放済みのキャラクター一覧（隠しキャラは条件を満たした分だけ並ぶ） */
export function unlockedChars(sakuraUnlocked: boolean): CharId[] {
  return CHAR_ORDER.filter((id) => !CHARS[id].hidden || sakuraUnlocked);
}

/** 1キャラが解放済みか */
export function isUnlocked(id: CharId, sakuraUnlocked: boolean): boolean {
  return !CHARS[id].hidden || sakuraUnlocked;
}

/**
 * 櫻優の解放条件を満たす勝ち方か。
 * winner は勝った side（0=1P側）。1P対戦・偏差値100・相手が内藤蘭・1Pの勝利 の4条件。
 */
export function isSakuraUnlockWin(setup: Setup, winner: 0 | 1): boolean {
  if (winner !== 0) return false;
  if (setup.teamMode) return false; // 1対1のみ
  return (
    setup.mode === SAKURA_UNLOCK.mode &&
    setup.difficulty === SAKURA_UNLOCK.difficulty &&
    setup.p2 === SAKURA_UNLOCK.opponent
  );
}
