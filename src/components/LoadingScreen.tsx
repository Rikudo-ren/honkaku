import { useEffect, useState } from 'react';
import { LOADING_TIPS } from '@/game/quotes';

interface Props {
  /** 0〜1 の進捗率 */
  progress: number;
}

/**
 * ゲーム起動直後に表示するローディング画面。
 * 立ち絵の白背景透過処理（Portrait.tsx の preloadPortraits）が
 * 実際に完了するまでここで待機する。
 */
export default function LoadingScreen({ progress }: Props) {
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * LOADING_TIPS.length));

  useEffect(() => {
    const id = window.setInterval(() => setTipIdx((i) => (i + 1) % LOADING_TIPS.length), 2600);
    return () => window.clearInterval(id);
  }, []);

  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#07070f]">
      <div className="scanlines pointer-events-none absolute inset-0" />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-4 text-center">
        <h1 className="pixel-text-shadow text-4xl leading-none text-amber-300 md:text-6xl">
          <span className="inline-block animate-wobble text-white">✝</span>本質
          <span className="inline-block animate-wobble text-white [animation-delay:0.3s]">✝</span>
          <span className="ml-2 text-white">FIGHTERS</span>
        </h1>
        <p className="mt-2 text-xs tracking-[0.3em] text-slate-300 md:text-sm">起動中 ／ LOADING</p>

        <div className="mt-8 w-full border-4 border-slate-200/80 bg-slate-950/80 p-1 shadow-[6px_6px_0_#000]">
          <div className="h-4 w-full bg-slate-900">
            <div className="h-full bg-amber-300 transition-[width] duration-200 ease-out" style={{ width: `${Math.max(6, pct)}%` }} />
          </div>
        </div>
        <div className="mt-2 text-sm text-amber-200 md:text-base">{pct}%</div>

        <div className="mt-6 min-h-[2.5em] text-[11px] text-slate-400 md:text-xs">TIP：{LOADING_TIPS[tipIdx]}</div>
        <div className="mt-3 animate-blink text-[11px] text-slate-500">✝本質✝を準備中…</div>
      </div>
    </div>
  );
}
