import type { Setup, Side } from './types';

/** 偏差値100 解禁フラグ（localStorage） */
export const EXTREME_UNLOCK_KEY = 'honkaku_extreme_unlocked';
/** 隠しキャラ「櫻優」解禁フラグ（localStorage） */
export const SAKURA_UNLOCK_KEY = 'honkaku_sakura_unlocked';
/** 隠しキャラ「覚醒三重」解禁フラグ（localStorage） */
export const KAKUSEI_UNLOCK_KEY = 'honkaku_kakusei_unlocked';

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

/**
 * 隠しキャラ「覚醒三重」の解禁条件：チーム戦（乱戦）で、
 * 自分ひとり（人間操作1体）で 偏差値100（extreme）のCPU7人 に勝つ。
 * ── たった一人で、七人の最高偏差値を超えろ。
 * 相手7体のキャラ・自分の使用キャラは不問。勝つのは人間のチーム側であること。
 * （オンラインのチーム戦で同じ条件を満たした場合も解禁する）
 */
export function isKakuseiUnlockMatch(setup: Setup, winner: Side): boolean {
  if ((setup.mode !== 'team' && setup.mode !== 'online') || !setup.teamMode || !setup.fighters) return false;
  const humans = setup.fighters.filter((f) => !f.ai);
  if (humans.length !== 1) return false; // 自分のみ
  const myTeam = humans[0].team;
  if (winner !== myTeam) return false; // 人間側の勝利
  const mine = setup.fighters.filter((f) => f.team === myTeam);
  const foes = setup.fighters.filter((f) => f.team !== myTeam);
  if (mine.length !== 1) return false; // 自チーム=自分のみ
  if (foes.length !== 7 || !foes.every((f) => f.ai)) return false; // 相手=CPU7体
  return foes.every((f) => (f.aiDifficulty ?? setup.difficulty) === 'extreme'); // 全員 偏差値100
}
