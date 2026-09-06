import type { Setup, Side } from './types';

/** 偏差値100 解禁フラグ（localStorage） */
export const EXTREME_UNLOCK_KEY = 'honkaku_extreme_unlocked';
/** 隠しキャラ「櫻優」解禁フラグ（localStorage） */
export const SAKURA_UNLOCK_KEY = 'honkaku_sakura_unlocked';

export function loadUnlocked(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

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

/**
 * 隠しキャラ「櫻優」の解禁条件：1P対CPU・偏差値100の内藤蘭に勝つ。
 * ── 微笑む観測者を、最高偏差値で観測せよ。
 */
export function isSakuraUnlockMatch(setup: Setup, winner: Side): boolean {
  return winner === 0 && setup.mode === '1p' && setup.difficulty === 'extreme' && setup.p2 === 'naito' && !setup.teamMode;
}
