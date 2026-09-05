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
  const a = CHARS[setup.p1];
  const b = CHARS[setup.p2];
  const st = STAGES.find((s) => s.id === setup.stage) ?? STAGES[0];
  const [tip] = useState(() => LOADING_TIPS[Math.floor(Math.random() * LOADING_TIPS.length)]);
  const pair = INTRO_PAIRS[pairKey(a.id, b.id)];
  const p2Label = setup.mode === '2p' ? '2P' : 'CPU';
  const p1Label = setup.mode === 'cpu' ? 'CPU' : '1P';
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
