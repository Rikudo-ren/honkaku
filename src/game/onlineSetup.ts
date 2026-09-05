import type { StartData } from './net';
import type { FighterSetup, Setup } from './types';

/** サーバーのスロット・チーム・AI設定を落とさず、オンライン対戦用の設定へ変換する。 */
export function makeOnlineSetup(data: StartData, sessionId: string | null): Setup {
  const mySlot = data.fighters.findIndex((f) => f.sessionId !== null && f.sessionId === sessionId);
  if (mySlot < 0) throw new Error('この対戦の参加者情報が見つかりません。');

  const fighters: FighterSetup[] = data.fighters.map((f, slot) => ({
    char: f.char,
    team: f.team,
    ai: f.sessionId === null,
    aiDifficulty: f.aiDifficulty,
    tag: f.sessionId === null ? 'CPU' : f.name || (slot === mySlot ? 'あなた' : 'NET'),
    you: slot === mySlot,
  }));
  // 「2人だから1対1」ではない。人間＋AIや、ホストがチームを入れ替えた編成は
  // チーム設定をそのまま使う。AIを人間扱いすると届かない入力を永久に待ってしまう。
  const duel = fighters.length === 2 && fighters.every((f, slot) => !f.ai && f.team === slot);
  return {
    mode: 'online',
    difficulty: 'normal',
    p1: fighters.find((f) => f.team === 0)?.char ?? 'mie',
    p2: fighters.find((f) => f.team === 1)?.char ?? 'ryoma',
    stage: data.stage,
    seed: data.seed,
    onlineMatchId: data.matchId,
    netInputDelay: data.inputDelay,
    onlineSide: fighters[mySlot].team,
    onlineNames: data.fighters.map((f) => f.name ?? null),
    teamMode: !duel,
    fighters: duel ? undefined : fighters,
    mySlot: duel ? undefined : mySlot,
  };
}
