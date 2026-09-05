import { useEffect, useRef, useState } from 'react';
import { Battle, type CutIn } from '@/game/engine';
import { Renderer } from '@/game/render';
import { InputManager } from '@/game/input';
import { Portrait } from '@/components/Portrait';
import { audio } from '@/game/audio';
import { CHARS, STAGES } from '@/game/characters';
import type { InputState, Setup, Side } from '@/game/types';

interface Props {
  setup: Setup;
  onEnd: (winner: Side, wins: [number, number]) => void;
  onQuit: (to: 'select' | 'title') => void;
}

export default function BattleScreen({ setup, onEnd, onQuit }: Props) {
  const gameRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [cutin, setCutin] = useState<{ c: CutIn; key: number } | null>(null);
  const [input, setInput] = useState<InputManager | null>(null);
  const [touch] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const st = STAGES.find((s) => s.id === setup.stage) ?? STAGES[0];

  useEffect(() => {
    const game = gameRef.current;
    const fx = fxRef.current;
    if (!game || !fx) return;
    const im = new InputManager();
    im.attach();
    setInput(im);
    const renderer = new Renderer(game, fx);
    let cutinTimer = 0;
    let endTimer = 0;
    const battle = new Battle({
      p1: setup.p1,
      p2: setup.p2,
      ai: [setup.mode === 'cpu', setup.mode !== '2p'],
      difficulty: setup.difficulty,
      stage: setup.stage,
      onCutin: (c) => {
        setCutin({ c, key: Date.now() });
        window.clearTimeout(cutinTimer);
        cutinTimer = window.setTimeout(() => setCutin(null), 1180);
      },
      onSfx: (s) => audio.sfx(s),
      onMatchEnd: (winner, wins) => {
        endTimer = window.setTimeout(() => onEndRef.current(winner, wins), 1600);
      },
    });
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const STEP = 1000 / 60;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(120, now - last);
      last = now;
      if (!pausedRef.current) {
        acc += dt;
        let n = 0;
        while (acc >= STEP && n < 4) {
          battle.step([im.poll(0), im.poll(1)]);
          acc -= STEP;
          n++;
        }
        if (acc > STEP * 4) acc = 0;
      }
      renderer.draw(battle);
    };
    raf = requestAnimationFrame(loop);
    if (document.fonts && 'load' in document.fonts) {
      document.fonts.load("16px 'DotGothic16'").catch(() => undefined);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        pausedRef.current = !pausedRef.current;
        setPaused(pausedRef.current);
        im.reset();
        audio.sfx(pausedRef.current ? 'back' : 'confirm');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      im.detach();
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(cutinTimer);
      window.clearTimeout(endTimer);
    };
  }, [setup]);

  const resume = () => {
    pausedRef.current = false;
    setPaused(false);
    audio.sfx('confirm');
  };

  const p1 = CHARS[setup.p1];
  const p2 = CHARS[setup.p2];

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#05050c] select-none">
      <div className="relative w-full max-w-[177.78vh]" style={{ aspectRatio: '16 / 9' }}>
        <canvas ref={gameRef} className="pixelated absolute inset-0 h-full w-full" />
        <canvas ref={fxRef} className="absolute inset-0 h-full w-full" />
        <div className="scanlines pointer-events-none absolute inset-0 opacity-60" />
        {cutin && <CutInOverlay key={cutin.key} c={cutin.c} />}
        {paused && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
            <div className="animate-pop w-72 border-4 border-slate-100 bg-slate-950 p-4 text-center shadow-[8px_8px_0_#000]">
              <div className="pixel-text-shadow text-3xl text-amber-300">PAUSE ✝</div>
              <div className="mt-1 text-xs text-slate-400">「ヘイカツが窓の外を見ている」</div>
              <div className="mt-4 flex flex-col gap-2">
                <button className="border-2 border-amber-300 bg-amber-300 py-1.5 text-slate-950 hover:bg-amber-200" onClick={resume}>
                  再開（Esc）
                </button>
                <button className="border-2 border-slate-400 py-1.5 text-slate-100 hover:bg-slate-800" onClick={() => onQuit('select')}>
                  キャラクター選択へ
                </button>
                <button className="border-2 border-slate-400 py-1.5 text-slate-100 hover:bg-slate-800" onClick={() => onQuit('title')}>
                  タイトルへ
                </button>
              </div>
            </div>
          </div>
        )}
        {touch && input && !paused && <TouchControls input={input} />}
      </div>
      <div className="mt-2 hidden w-full max-w-5xl items-center justify-between px-3 text-[11px] text-slate-400 md:flex">
        <span>
          <span style={{ color: p1.color }}>{p1.name}</span>：WASD 移動 ／ F 弱 ／ G 強 ／ H 必殺 ／ Space 超必殺
        </span>
        <span className="text-slate-500">
          {st.name} ── {st.sub} ／ Esc ポーズ ／ M ミュート
        </span>
        <span>
          <span style={{ color: p2.color }}>{p2.name}</span>：矢印 移動 ／ K 弱 ／ L 強 ／ ; 必殺 ／ Enter 超必殺{setup.mode !== '2p' ? '（CPU操作中）' : ''}
        </span>
      </div>
    </div>
  );
}

function CutInOverlay({ c }: { c: CutIn }) {
  const def = CHARS[c.char];
  const left = c.side === 0;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div className="absolute inset-0 animate-cutin-fade bg-black/60" />
      <div
        className={`absolute inset-y-[-10%] w-[130%] ${left ? 'left-[-15%] animate-cutin-band-l' : 'right-[-15%] animate-cutin-band-r'}`}
        style={{ background: `linear-gradient(90deg, ${def.light} 0%, #ffffff 50%, ${def.light} 100%)` }}
      />
      <Portrait
        id={c.char}
        alt={def.name}
        className={`absolute bottom-[-4%] h-[118%] max-w-none drop-shadow-[6px_6px_0_rgba(0,0,0,0.4)] ${left ? 'left-[1%] animate-cutin-slide-l' : 'right-[1%] animate-cutin-slide-r'}`}
      />
      <div className={`absolute top-[12%] w-[62%] ${left ? 'right-[4%] text-right animate-cutin-text-l' : 'left-[4%] text-left animate-cutin-text-r'}`}>
        <div className="text-xs md:text-lg" style={{ color: def.color, textShadow: '1px 1px 0 #000' }}>
          {def.name} ── 超必殺技
        </div>
        <div className="pixel-text-shadow text-2xl leading-tight text-white md:text-5xl lg:text-6xl">{c.name}</div>
        <div className="mt-1 inline-block bg-slate-900/90 px-2 py-0.5 text-sm text-amber-100 md:text-2xl">「{c.quote}」</div>
      </div>
      {c.paper && (
        <div
          className={`absolute bottom-[8%] w-[46%] max-w-md border-2 border-slate-300 bg-white p-2 text-slate-900 shadow-[6px_6px_0_rgba(0,0,0,0.6)] md:p-3 ${left ? 'right-[5%] -rotate-3 animate-cutin-text-l' : 'left-[5%] rotate-2 animate-cutin-text-r'}`}
        >
          <div className="text-[9px] text-slate-500 md:text-[11px]">LINEオープンチャット「✝本質✝募集所」より ── 紙に書いて読みます</div>
          <div className="mt-1 text-sm leading-snug md:text-2xl">{c.paper}</div>
        </div>
      )}
    </div>
  );
}

function TouchControls({ input }: { input: InputManager }) {
  const bind = (key: keyof InputState) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      input.touch(0, key, true);
    },
    onPointerUp: () => input.touch(0, key, false),
    onPointerCancel: () => input.touch(0, key, false),
    onPointerLeave: () => input.touch(0, key, false),
  });
  const cls = 'flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/60 bg-black/40 text-lg text-white active:bg-amber-300 active:text-slate-950 md:h-14 md:w-14';
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between p-2 touch-none">
      <div className="pointer-events-auto grid grid-cols-3 gap-1">
        <span />
        <button className={cls} {...bind('up')}>
          ▲
        </button>
        <span />
        <button className={cls} {...bind('left')}>
          ◀
        </button>
        <button className={cls} {...bind('down')}>
          ▼
        </button>
        <button className={cls} {...bind('right')}>
          ▶
        </button>
      </div>
      <div className="pointer-events-auto grid grid-cols-2 gap-1.5">
        <button className={cls} {...bind('light')}>
          弱
        </button>
        <button className={cls} {...bind('heavy')}>
          強
        </button>
        <button className={cls} {...bind('special')}>
          必
        </button>
        <button className={`${cls} border-amber-300 text-amber-300`} {...bind('super')}>
          ✝
        </button>
      </div>
    </div>
  );
}
