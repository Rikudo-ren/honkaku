import { useState } from 'react';
import { CHARS, DIFFICULTY_SHORT, rosterFor } from '@/game/characters';
import { Portrait } from '@/components/Portrait';
import { audio } from '@/game/audio';
import type { CharId, Difficulty, FighterSetup, Team } from '@/game/types';
import { MAX_FIGHTERS, TEAM_COLORS, TEAM_NAMES } from '@/game/types';

interface Props {
  defaultDifficulty: Difficulty;
  /** 隠しキャラ「櫻優」が解禁済みか */
  sakuraUnlocked?: boolean;
  onDone: (fighters: FighterSetup[]) => void;
  onBack: () => void;
}

type Ctrl = 'p1' | 'p2' | 'cpu';

interface Row {
  char: CharId;
  team: Team;
  ctrl: Ctrl;
  aiDifficulty: Difficulty;
}

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard', 'extreme'];

const CTRL_LABEL: Record<Ctrl, string> = { p1: '1P操作', p2: '2P操作', cpu: 'CPU' };

export default function TeamSetup({ defaultDifficulty, sakuraUnlocked = false, onDone, onBack }: Props) {
  const roster = rosterFor(sakuraUnlocked);
  const [rows, setRows] = useState<Row[]>([
    { char: 'mie', team: 0, ctrl: 'p1', aiDifficulty: defaultDifficulty },
    { char: 'ryoma', team: 0, ctrl: 'cpu', aiDifficulty: defaultDifficulty },
    { char: 'naito', team: 1, ctrl: 'p2', aiDifficulty: defaultDifficulty },
    { char: 'mitsumine', team: 1, ctrl: 'cpu', aiDifficulty: defaultDifficulty },
  ]);

  const patch = (i: number, p: Partial<Row>) => {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
    audio.sfx('move');
  };

  const cycleChar = (i: number, dir: 1 | -1) => {
    const cur = roster.indexOf(rows[i].char);
    patch(i, { char: roster[(cur + dir + roster.length) % roster.length] });
  };

  const cycleCtrl = (i: number) => {
    // P1/P2は各1人まで。埋まっていたらCPUへ
    const order: Ctrl[] = ['p1', 'p2', 'cpu'];
    const cur = order.indexOf(rows[i].ctrl);
    for (let k = 1; k <= 3; k++) {
      const next = order[(cur + k) % 3];
      if (next === 'cpu' || !rows.some((r, j) => j !== i && r.ctrl === next)) {
        patch(i, { ctrl: next });
        return;
      }
    }
  };

  const cycleDiff = (i: number) => {
    const cur = DIFFS.indexOf(rows[i].aiDifficulty);
    patch(i, { aiDifficulty: DIFFS[(cur + 1) % DIFFS.length] });
  };

  const addRow = () => {
    if (rows.length >= MAX_FIGHTERS) return;
    const c0 = rows.filter((r) => r.team === 0).length;
    setRows((rs) => [...rs, { char: roster[rs.length % roster.length], team: c0 <= rs.length / 2 ? 0 : 1, ctrl: 'cpu', aiDifficulty: defaultDifficulty }]);
    audio.sfx('confirm');
  };

  const delRow = (i: number) => {
    if (rows.length <= 2) return;
    setRows((rs) => rs.filter((_, j) => j !== i));
    audio.sfx('back');
  };

  const teams = new Set(rows.map((r) => r.team));
  const valid = teams.size >= 2 && rows.length >= 2;
  const humans = rows.filter((r) => r.ctrl !== 'cpu').length;

  const start = () => {
    if (!valid) return;
    audio.sfx('confirm');
    onDone(
      rows.map((r) => ({
        char: r.char,
        team: r.team,
        ai: r.ctrl === 'cpu',
        aiDifficulty: r.aiDifficulty,
        pad: r.ctrl === 'p1' ? 0 : r.ctrl === 'p2' ? 1 : null,
        tag: r.ctrl === 'p1' ? '1P' : r.ctrl === 'p2' ? '2P' : 'CPU',
      }))
    );
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-[#0b0b18] px-3 py-4 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fde68a 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="scanlines pointer-events-none absolute inset-0" />
      <header className="relative z-10 flex w-full max-w-4xl items-center justify-between">
        <button className="border-2 border-slate-500 px-2 py-1 text-xs hover:bg-slate-800" onClick={onBack}>
          ◀ タイトル
        </button>
        <div className="text-center">
          <div className="pixel-text-shadow text-2xl text-amber-300 md:text-4xl">TEAM BATTLE ✝ 乱戦</div>
          <div className="text-xs text-slate-300">2対2も3対1も自由自在 ── 全員同時出場のチーム戦</div>
        </div>
        <div className="w-28 text-right text-xs text-slate-400">{rows.length}人出場中</div>
      </header>

      <div className="relative z-10 mt-4 grid w-full max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
        {([0, 1] as Team[]).map((t) => {
          const idxs = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.team === t);
          return (
            <div key={t} className="border-4 bg-slate-950/80 p-2" style={{ borderColor: TEAM_COLORS[t] }}>
              <div className="px-1 text-sm font-bold" style={{ color: TEAM_COLORS[t] }}>
                {TEAM_NAMES[t]}（{idxs.length}人）
              </div>
              <div className="mt-2 flex flex-col gap-2">
                {idxs.map(({ r, i }) => (
                  <div key={i} className="flex items-center gap-2 border border-slate-700 bg-black/50 p-1.5">
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button className="border border-slate-600 px-1 text-xs hover:bg-slate-800" onClick={() => cycleChar(i, -1)}>
                        ◀
                      </button>
                      <div className="h-14 w-11 overflow-hidden border border-slate-600" style={{ background: `linear-gradient(160deg,#fff, ${CHARS[r.char].light})` }}>
                        <Portrait id={r.char} alt={CHARS[r.char].name} className="h-full w-full object-contain object-bottom" />
                      </div>
                      <button className="border border-slate-600 px-1 text-xs hover:bg-slate-800" onClick={() => cycleChar(i, 1)}>
                        ▶
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm" style={{ color: CHARS[r.char].color }}>
                        {CHARS[r.char].name}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <button
                          onClick={() => patch(i, { team: t === 0 ? 1 : 0 })}
                          className="border px-1.5 py-0.5 text-[10px] hover:bg-slate-800"
                          style={{ borderColor: TEAM_COLORS[t === 0 ? 1 : 0], color: TEAM_COLORS[t === 0 ? 1 : 0] }}
                        >
                          {t === 0 ? '赤へ▶' : '◀青へ'}
                        </button>
                        <button
                          onClick={() => cycleCtrl(i)}
                          className={`border px-1.5 py-0.5 text-[10px] ${r.ctrl === 'cpu' ? 'border-slate-500 text-slate-300' : 'border-amber-300 text-amber-200'} hover:bg-slate-800`}
                        >
                          {CTRL_LABEL[r.ctrl]}
                        </button>
                        {r.ctrl === 'cpu' && (
                          <button
                            onClick={() => cycleDiff(i)}
                            className={`border px-1.5 py-0.5 text-[10px] hover:bg-slate-800 ${r.aiDifficulty === 'extreme' ? 'border-fuchsia-400 text-fuchsia-300' : r.aiDifficulty === 'hard' ? 'border-rose-400 text-rose-300' : 'border-slate-500 text-slate-300'}`}
                          >
                            {DIFFICULTY_SHORT[r.aiDifficulty]}
                          </button>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => delRow(i)}
                      disabled={rows.length <= 2}
                      className="shrink-0 border border-rose-500 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-950 disabled:opacity-30"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {idxs.length === 0 && <div className="p-2 text-center text-xs text-slate-600">── 空き ──</div>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="relative z-10 mt-3 flex items-center gap-2">
        <button
          onClick={addRow}
          disabled={rows.length >= MAX_FIGHTERS}
          className="border-2 border-slate-400 px-4 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-30"
        >
          ＋出場者を追加（最大{MAX_FIGHTERS}人）
        </button>
      </div>

      <div className="relative z-10 mt-2 text-center text-xs text-slate-400">
        1P：WASD移動・F弱・G強・H必殺・Space超必殺 ／ 2P：矢印移動・K弱・L強・;必殺・Enter超必殺
        {humans === 0 && <span className="ml-2 text-slate-500">（人間0人＝CPU観戦になります）</span>}
      </div>
      {!valid && <div className="relative z-10 mt-1 text-sm text-rose-300">両チームに1人以上配置してください</div>}

      <div className="relative z-10 mt-3">
        <button
          onClick={start}
          disabled={!valid}
          className="border-2 border-amber-300 bg-amber-300 px-10 py-2 font-bold text-slate-950 shadow-[3px_3px_0_#000] hover:bg-amber-200 active:scale-95 disabled:opacity-40"
        >
          乱戦開始 ✝
        </button>
      </div>
    </div>
  );
}
