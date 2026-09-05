import { useEffect, useState } from 'react';
import { CHARS, DIFFICULTY_LABELS, INTRO_PAIRS, STAGES, pairKey } from '@/game/characters';
import { LOADING_TIPS } from '@/game/quotes';
import { Portrait } from '@/components/Portrait';
import type { Setup } from '@/game/types';

interface Props {
  setup: Setup;
  onDone: () => void;
}

export default function VersusScreen({ setup, onDone }: Props) {
  const teamMode = !!setup.teamMode && !!setup.fighters && setup.fighters.length >= 2;
  if (teamMode) return <TeamVersus setup={setup} onDone={onDone} />;
  return <DuelVersus setup={setup} onDone={onDone} />;
}

export function DuelVersus({ setup, onDone }: Props) {
  const a = CHARS[setup.p1];
  const b = CHARS[setup.p2];
  const st = STAGES.find((s) => s.id === setup.stage) ?? STAGES[0];
  const [tip] = useState(() => LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]);
  const pair = INTRO_PAIRS[pairKey(a.id, b.id)];
  const online = setup.mode === 'online';
  // オンライン対戦ではプレイヤー名を表示（自分には「あなた」を添える）
  const onlineLabel = (side: 0 | 1) => {
    const name = setup.onlineNames?.[side] ?? null;
    const mine = setup.onlineSide === side;
    if (!name) return mine ? 'あなた' : '相手';
    return mine ? `${name}（あなた）` : name;
  };
  const p2Label = online ? onlineLabel(1) : setup.mode === '2p' ? '2P' : 'CPU';
  const p1Label = online ? onlineLabel(0) : setup.mode === 'cpu' ? 'CPU' : '1P';
  const showDiff = setup.mode === '1p' || setup.mode === 'cpu';
  const diffColor =
    setup.difficulty === 'extreme' ? 'text-fuchsia-300 border-fuchsia-400' : setup.difficulty === 'hard' ? 'text-rose-300 border-rose-400' : 'text-amber-200 border-amber-400';

  useEffect(() => {
    const t = window.setTimeout(onDone, 3200);
    const k = (e: KeyboardEvent) => {
      if (['Enter', 'Space', 'KeyF', 'KeyK'].includes(e.code)) {
        e.preventDefault();
        onDone();
      }
    };
    window.addEventListener('keydown', k);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', k);
    };
  }, [onDone]);

  return (
    <div className="relative h-screen w-full cursor-pointer overflow-hidden bg-black" onClick={onDone}>
      <div className="absolute inset-0 animate-vs-l" style={{ clipPath: 'polygon(0 0, 58% 0, 42% 100%, 0 100%)', background: `linear-gradient(135deg, ${a.light} 0%, #ffffff 60%, ${a.light} 100%)` }}>
        <Portrait id={a.id} alt={a.name} className="absolute bottom-0 left-[2%] h-[106%] max-w-none drop-shadow-[5px_5px_0_rgba(0,0,0,0.3)]" />
        <div className="absolute left-4 top-6 md:left-8 md:top-10">
          <div className="text-xs text-slate-600 md:text-base">
            {p1Label} ／ {a.affiliation}
          </div>
          <div className="pixel-text-shadow text-3xl text-white md:text-6xl">{a.name}</div>
          <div className="mt-1 inline-block bg-slate-900 px-2 py-0.5 text-xs text-white md:text-base">{a.title}</div>
        </div>
      </div>
      <div className="absolute inset-0 animate-vs-r" style={{ clipPath: 'polygon(58% 0, 100% 0, 100% 100%, 42% 100%)', background: `linear-gradient(225deg, ${b.light} 0%, #ffffff 60%, ${b.light} 100%)` }}>
        <Portrait id={b.id} alt={b.name} className="absolute bottom-0 right-[2%] h-[106%] max-w-none drop-shadow-[-5px_5px_0_rgba(0,0,0,0.3)]" />
        <div className="absolute right-4 top-6 text-right md:right-8 md:top-10">
          <div className="text-xs text-slate-600 md:text-base">
            {b.affiliation} ／ {p2Label}
          </div>
          <div className="pixel-text-shadow text-3xl text-white md:text-6xl">{b.name}</div>
          <div className="mt-1 inline-block bg-slate-900 px-2 py-0.5 text-xs text-white md:text-base">{b.title}</div>
          {showDiff && (
            <div className={`mt-2 inline-block border-2 bg-black/80 px-2 py-0.5 text-sm font-bold md:text-base ${diffColor}`}>
              {DIFFICULTY_LABELS[setup.difficulty]}
            </div>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-vs-pop">
        <div className="pixel-text-shadow text-7xl text-amber-300 md:text-9xl">VS</div>
        {showDiff && (
          <div className={`mx-auto mt-1 w-fit border-2 bg-black/85 px-3 py-1 text-center text-sm font-bold md:text-lg ${diffColor}`}>
            CPU {DIFFICULTY_LABELS[setup.difficulty]}
          </div>
        )}
        {pair && (
          <div className="mt-2 whitespace-nowrap bg-black/80 px-3 py-1 text-center text-xs text-amber-100 md:text-base">
            「{pair.a}」「{pair.b}」{pair.note ?? ''}
          </div>
        )}
        {a.id === b.id && <div className="mt-2 whitespace-nowrap bg-black/80 px-3 py-1 text-center text-xs text-amber-100 md:text-base">自演じゃなくて自己対話だよ</div>}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-black/85 py-3 text-center">
        <div className="text-base text-amber-200 md:text-xl">STAGE：{st.name}</div>
        <div className="text-xs text-slate-300 md:text-sm">{st.sub}</div>
        <div className="mt-1 text-[11px] text-slate-400 md:text-xs">TIP：{tip}</div>
        <div className="mt-1 animate-blink text-[11px] text-slate-500">クリック / Enter でスキップ</div>
      </div>
    </div>
  );
}

function TeamVersus({ setup, onDone }: Props) {
  const fighters = setup.fighters!;
  const st = STAGES.find((s) => s.id === setup.stage) ?? STAGES[0];
  const [tip] = useState(() => LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]);
  const team0 = fighters.map((f, i) => ({ ...f, slot: i })).filter((f) => f.team === 0);
  const team1 = fighters.map((f, i) => ({ ...f, slot: i })).filter((f) => f.team === 1);

  useEffect(() => {
    const t = window.setTimeout(onDone, 3600);
    const k = (e: KeyboardEvent) => {
      if (['Enter', 'Space', 'KeyF', 'KeyK'].includes(e.code)) {
        e.preventDefault();
        onDone();
      }
    };
    window.addEventListener('keydown', k);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', k);
    };
  }, [onDone]);

  const labelOf = (slot: number, ai: boolean) => {
    if (setup.mode === 'online') {
      if (ai) return 'CPU';
      const name = setup.onlineNames?.[slot] ?? fighters[slot].tag ?? null;
      return slot === setup.mySlot ? `${name || 'あなた'}★` : name || 'NET';
    }
    const f = fighters[slot];
    if (f.pad === 0) return '1P';
    if (f.pad === 1) return '2P';
    return 'CPU';
  };

  const col = (list: typeof team0, team: 0 | 1) => (
    <div className={`flex flex-1 flex-col items-center gap-1 px-2 ${team === 0 ? 'animate-vs-l' : 'animate-vs-r'}`}>
      <div
        className="pixel-text-shadow text-xl md:text-3xl"
        style={{ color: team === 0 ? '#38bdf8' : '#fb7185' }}
      >
        {team === 0 ? '青チーム' : '赤チーム'}
      </div>
      <div className="flex flex-wrap items-end justify-center gap-1.5">
        {list.map((f) => {
          const d = CHARS[f.char];
          return (
            <div key={f.slot} className="flex w-20 flex-col items-center md:w-24">
              <div
                className="relative aspect-[3/4] w-full overflow-hidden border-2 border-slate-700"
                style={{ background: `linear-gradient(180deg,#fff,${d.light})` }}
              >
                <Portrait id={f.char} alt={d.name} className="h-full w-full object-contain object-bottom" />
                <div className={`absolute left-0 top-0 px-1 text-[10px] text-slate-950 ${f.team === 0 ? 'bg-sky-400' : 'bg-rose-400'}`}>
                  {labelOf(f.slot, f.ai)}
                </div>
              </div>
              <div className="mt-0.5 text-center text-[11px] leading-tight text-white md:text-xs">{d.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-screen w-full cursor-pointer flex-col overflow-hidden bg-black" onClick={onDone}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fde68a 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="relative flex flex-1 items-center justify-center gap-2 px-4 pt-8">
        {col(team0, 0)}
        <div className="animate-vs-pop px-1 text-center">
          <div className="pixel-text-shadow text-5xl text-amber-300 md:text-7xl">VS</div>
          <div className="mt-1 whitespace-nowrap bg-slate-900 px-2 py-0.5 text-[10px] text-amber-100 md:text-xs">
            {fighters.length}人同時乱戦
          </div>
        </div>
        {col(team1, 1)}
      </div>
      <div className="relative bg-black/85 py-3 text-center">
        <div className="text-base text-amber-200 md:text-xl">STAGE：{st.name}</div>
        <div className="text-xs text-slate-300 md:text-sm">{st.sub}</div>
        <div className="mt-1 text-[11px] text-slate-400 md:text-xs">TIP：{tip}</div>
        <div className="mt-1 animate-blink text-[11px] text-slate-500">クリック / Enter でスキップ</div>
      </div>
    </div>
  );
}
