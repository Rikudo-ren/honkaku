import { useEffect, useState } from 'react';
import { CHARS, DIFFICULTY_LABELS } from '@/game/characters';
import { HONSHITSU_QUOTES } from '@/game/quotes';
import { Portrait } from '@/components/Portrait';
import { audio } from '@/game/audio';
import type { Setup, Side } from '@/game/types';

interface Props {
  setup: Setup;
  result: { winner: Side; wins: [number, number] };
  onRematch: () => void;
  onSelect: () => void;
  onTitle: () => void;
  willUnlockExtreme?: boolean;
  /** この試合で隠しキャラ「櫻優」が解禁された */
  willUnlockSakura?: boolean;
  /** この試合で隠しキャラ「覚醒三重」が解禁された */
  willUnlockKakusei?: boolean;
}

const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

export default function ResultScreen({ setup, result, onRematch, onSelect, onTitle, willUnlockExtreme, willUnlockSakura, willUnlockKakusei }: Props) {
  const teamMode = !!setup.teamMode && !!setup.fighters && setup.fighters.length >= 2;
  if (teamMode) return <TeamResult setup={setup} result={result} onRematch={onRematch} onSelect={onSelect} onTitle={onTitle} />;
  const w = result.winner;
  const wId = w === 0 ? setup.p1 : setup.p2;
  const lId = w === 0 ? setup.p2 : setup.p1;
  const wd = CHARS[wId];
  const ld = CHARS[lId];
  const [quote] = useState(() => pick(wd.wins));
  const [hq] = useState(() => pick(HONSHITSU_QUOTES));
  const [postNo] = useState(() => 200 + Math.floor(Math.random() * 700));
  const winnerLabel =
    setup.mode === 'online'
      ? w === setup.onlineSide
        ? 'あなた'
        : '相手'
      : w === 0
        ? setup.mode === 'cpu'
          ? 'CPU'
          : '1P'
        : setup.mode === '2p'
          ? '2P'
          : 'CPU';

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (['Enter', 'Space', 'KeyF', 'KeyK'].includes(e.code)) {
        e.preventDefault();
        audio.sfx('confirm');
        onRematch();
      } else if (['Escape', 'KeyG', 'KeyL'].includes(e.code)) {
        audio.sfx('back');
        onSelect();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onRematch, onSelect]);

  const post =
    wd.id === 'ryoma'
      ? `${wd.name}が${ld.name}に勝った。これまじ✝本質✝。✝`
      : wd.id === 'mie'
        ? `${wd.name}が勝った。本人は「まあ」と言った。認めないけど否定もしないらしい。`
        : wd.id === 'terachi'
          ? `本質配信の巫女が${ld.name}を倒した。本人は「俺はペットボトル」と主張。`
          : wd.id === 'rei'
            ? `全科目学年首席、格闘でも首席。本人談「面白かった」。`
            : wd.id === 'naito'
              ? `${wd.name}が少し笑った。それだけで${ld.name}の理論が崩壊した。`
              : wd.id === 'sakura'
                ? `紺のネクタイの恋愛学者が${ld.name}を観測して勝った。本人談「研究です」。ノートには✝本質✝と書いてあった。`
                : wd.id === 'kakusei'
                  ? `ヘルメットの土木作業員が${ld.name}を転圧した。本人談「完工」。#${ld.id === 'rei' ? '終幕' : '残土処分'}`
                  : `${wd.name}「理論はいい！！」で${ld.name}が沈黙。波動関数、崩壊。`;

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0b0b18] px-4 py-8 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fde68a 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="scanlines pointer-events-none absolute inset-0" />
      <div className="relative z-10 grid w-full max-w-5xl gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden border-4 border-amber-300 shadow-[8px_8px_0_#000]" style={{ background: `linear-gradient(160deg, #ffffff, ${wd.light})` }}>
          <Portrait id={wId} alt={wd.name} className="h-full w-full object-contain object-bottom p-2 animate-pop" />
          <div className="absolute left-2 top-2 bg-amber-300 px-2 py-0.5 text-sm text-slate-950">WINNER ✝ {winnerLabel}</div>
          <div className="absolute bottom-3 left-3 right-3 border-2 border-slate-800 bg-white/95 p-2 text-slate-900">
            <div className="text-[10px] text-slate-500">勝利セリフ</div>
            <div className="text-lg leading-snug md:text-xl">「{quote}」</div>
          </div>
          <div className="absolute right-[-6%] top-[18%] w-[38%] rotate-6 opacity-70 grayscale">
            <Portrait id={lId} alt={ld.name} className="w-full" />
            <div className="pixel-text-shadow -mt-6 text-center text-2xl text-rose-300">K.O.</div>
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="text-xs text-slate-400">{wd.kana}</div>
          <div className="pixel-text-shadow text-5xl leading-none md:text-6xl" style={{ color: wd.color }}>
            {wd.name}
          </div>
          <div className="mt-1 text-amber-200">{wd.title}</div>
          {(setup.mode === '1p' || setup.mode === 'cpu') && (
            <div className="mt-2 text-sm text-slate-300">
              対戦したCPU強さ：
              <span
                className={`ml-1 font-bold ${
                  setup.difficulty === 'extreme' ? 'text-fuchsia-300' : setup.difficulty === 'hard' ? 'text-rose-300' : 'text-amber-200'
                }`}
              >
                {DIFFICULTY_LABELS[setup.difficulty]}
              </span>
            </div>
          )}
          <div className="mt-4 flex items-center gap-4 text-2xl">
            <span style={{ color: CHARS[setup.p1].color }}>{CHARS[setup.p1].name}</span>
            <span className="border-2 border-slate-600 bg-slate-950 px-3 py-1 text-3xl">
              {result.wins[0]} - {result.wins[1]}
            </span>
            <span style={{ color: CHARS[setup.p2].color }}>{CHARS[setup.p2].name}</span>
          </div>
          {willUnlockExtreme && (
            <div className="mt-4 animate-pop border-2 border-fuchsia-400 bg-fuchsia-950/80 p-3 text-center">
              <div className="text-xs tracking-widest text-fuchsia-300">NEW DIFFICULTY</div>
              <div className="text-xl font-bold text-fuchsia-100">偏差値100 解禁間近…</div>
              <div className="mt-1 text-xs text-slate-300">タイトルに戻ると豪華演出が流れます</div>
            </div>
          )}
          {willUnlockSakura && (
            <div className="mt-4 animate-pop border-2 border-pink-400 bg-pink-950/80 p-3 text-center">
              <div className="text-xs tracking-widest text-pink-300">SECRET CHARACTER</div>
              <div className="text-xl font-bold text-pink-100">紺のネクタイが、もう一人来た。</div>
              <div className="mt-1 text-xs text-slate-300">微笑む観測者を最高偏差値で観測した ── タイトルに戻ると報告があります</div>
            </div>
          )}
          {willUnlockKakusei && (
            <div className="mt-4 animate-pop border-2 border-orange-400 bg-orange-950/80 p-3 text-center">
              <div className="text-xs tracking-widest text-orange-300">SECRET CHARACTER</div>
              <div className="text-xl font-bold text-orange-100">式場の外から、鉄を曳く足音が聞こえる。</div>
              <div className="mt-1 text-xs text-slate-300">一人で七人の最高偏差値を超えた ── タイトルに戻ると完工報告があります</div>
            </div>
          )}
          <div className="mt-5 border-2 border-slate-700 bg-slate-950/80 p-3 text-sm">
            <div className="text-xs text-emerald-300">匿名掲示板「ヘイカツ雑談スレ」に新着</div>
            <div className="mt-1 text-slate-200">
              <span className="text-slate-500">{postNo} 名無しの地形図好き：</span>
              {post}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {postNo + 1} 名無しの地形図好き：&gt;&gt;{postNo} {hq}
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button className="flex-1 border-2 border-amber-300 bg-amber-300 py-2 text-slate-950 hover:bg-amber-200" onClick={onRematch}>
              もう一回（Enter）
            </button>
            <button className="flex-1 border-2 border-slate-400 py-2 hover:bg-slate-800" onClick={onSelect}>
              キャラ選択（Esc）
            </button>
            <button className="flex-1 border-2 border-slate-600 py-2 text-slate-300 hover:bg-slate-800" onClick={onTitle}>
              タイトル
            </button>
          </div>
          <div className="mt-3 text-xs text-slate-500">何も変わらない。何も解決しない。✝本質✝が何かは最後までわからない。でも、来年もある。</div>
        </div>
      </div>
    </div>
  );
}

function TeamResult({
  setup,
  result,
  onRematch,
  onSelect,
  onTitle,
}: {
  setup: Setup;
  result: { winner: Side; wins: [number, number] };
  onRematch: () => void;
  onSelect: () => void;
  onTitle: () => void;
}) {
  const fighters = setup.fighters!;
  const w = result.winner;
  const online = setup.mode === 'online';
  const winners = fighters.filter((f) => f.team === w);
  const losers = fighters.filter((f) => f.team !== w);
  const rep = CHARS[winners[0]?.char ?? 'mie'];
  const [quote] = useState(() => pick(rep.wins));
  const [hq] = useState(() => pick(HONSHITSU_QUOTES));
  const [postNo] = useState(() => 200 + Math.floor(Math.random() * 700));
  const teamColor = w === 0 ? '#38bdf8' : '#fb7185';
  const teamName = w === 0 ? '青チーム' : '赤チーム';
  const youWon =
    setup.mode === 'online'
      ? (fighters[setup.mySlot ?? 0]?.team ?? 0) === w
      : fighters.some((f, i) => f.team === w && !f.ai && (setup.mode === 'team' ? f.pad != null : i === 0));

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (['Enter', 'Space', 'KeyF', 'KeyK'].includes(e.code)) {
        e.preventDefault();
        audio.sfx('confirm');
        onRematch();
      } else if (['Escape', 'KeyG', 'KeyL'].includes(e.code)) {
        audio.sfx('back');
        onSelect();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onRematch, onSelect]);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0b0b18] px-4 py-8 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fde68a 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="scanlines pointer-events-none absolute inset-0" />
      <div className="relative z-10 grid w-full max-w-5xl gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden border-4 shadow-[8px_8px_0_#000] animate-pop" style={{ borderColor: teamColor, background: `linear-gradient(160deg, #ffffff, ${rep.light})` }}>
          <Portrait id={rep.id} alt={rep.name} className="h-full w-full object-contain object-bottom p-2" />
          <div className="absolute left-2 top-2 px-2 py-0.5 text-sm text-slate-950" style={{ background: teamColor }}>
            WINNER ✝ {teamName}
          </div>
          <div className="absolute bottom-3 left-3 right-3 border-2 border-slate-800 bg-white/95 p-2 text-slate-900">
            <div className="text-[10px] text-slate-500">代表コメント（{rep.name}）</div>
            <div className="text-lg leading-snug md:text-xl">「{quote}」</div>
          </div>
        </div>
        <div className="flex flex-col justify-center">
          <div className="pixel-text-shadow text-5xl leading-none md:text-6xl" style={{ color: teamColor }}>
            {teamName}
          </div>
          <div className="mt-1 text-amber-200">{youWon ? '勝利 ── ✝本質✝はお前たちのものだ' : '敗北 ── まあ（四百二十一回目）'}</div>
          <div className="mt-4 flex items-center gap-3 text-xl">
            <span style={{ color: '#38bdf8' }}>青{fighters.filter((f) => f.team === 0).length}人</span>
            <span className="border-2 border-slate-600 bg-slate-950 px-3 py-1 text-3xl">
              {result.wins[0]} - {result.wins[1]}
            </span>
            <span style={{ color: '#fb7185' }}>赤{fighters.filter((f) => f.team === 1).length}人</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="border border-sky-400/60 bg-slate-950/60 p-2">
              <div className="text-sky-300">青チーム</div>
              {fighters.filter((f) => f.team === 0).map((f, i) => (
                <div key={i} style={{ color: CHARS[f.char].color }}>
                  {CHARS[f.char].name} {f.ai ? '(CPU)' : online ? `(${f.tag || 'NET'})` : ''}
                </div>
              ))}
            </div>
            <div className="border border-rose-400/60 bg-slate-950/60 p-2">
              <div className="text-rose-300">赤チーム</div>
              {fighters.filter((f) => f.team === 1).map((f, i) => (
                <div key={i} style={{ color: CHARS[f.char].color }}>
                  {CHARS[f.char].name} {f.ai ? '(CPU)' : online ? `(${f.tag || 'NET'})` : ''}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            勝利：{winners.map((f) => CHARS[f.char].name).join('・')} ／ 敗北：{losers.map((f) => CHARS[f.char].name).join('・')}
          </div>
          <div className="mt-4 border-2 border-slate-700 bg-slate-950/80 p-3 text-sm">
            <div className="text-xs text-emerald-300">匿名掲示板「ヘイカツ雑談スレ」に新着</div>
            <div className="mt-1 text-slate-200">
              <span className="text-slate-500">{postNo} 名無しの地形図好き：</span>
              {fighters.length}人乱戦、{teamName}が勝った。これまじ✝本質✝。✝
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {postNo + 1} 名無しの地形図好き：&gt;&gt;{postNo} {hq}
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button className="flex-1 border-2 border-amber-300 bg-amber-300 py-2 text-slate-950 hover:bg-amber-200" onClick={onRematch}>
              もう一回（Enter）
            </button>
            <button className="flex-1 border-2 border-slate-400 py-2 hover:bg-slate-800" onClick={onSelect}>
              {setup.mode === 'team' ? '編成へ（Esc）' : 'キャラ選択（Esc）'}
            </button>
            <button className="flex-1 border-2 border-slate-600 py-2 text-slate-300 hover:bg-slate-800" onClick={onTitle}>
              タイトル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
