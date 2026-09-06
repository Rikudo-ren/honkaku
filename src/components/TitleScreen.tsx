import { useEffect, useRef, useState } from 'react';
import { CHARS, DIFFICULTY_HINT, DIFFICULTY_LABELS, HIDDEN_HINTS, rosterFor } from '@/game/characters';
import { Portrait } from '@/components/Portrait';
import { drawTitleScene } from '@/game/render';
import { H, W } from '@/game/engine';
import { HONSHITSU_QUOTES } from '@/game/quotes';
import { audio } from '@/game/audio';
import type { Difficulty, Mode } from '@/game/types';

interface Props {
  onStart: (mode: Mode, difficulty: Difficulty) => void;
  extremeUnlocked: boolean;
  justUnlocked?: boolean;
  onUnlockSeen?: () => void;
  /** 隠しキャラ「櫻優」が解禁済みか */
  sakuraUnlocked?: boolean;
  /** 直前の試合で櫻優が解禁された（演出を流す） */
  sakuraJustUnlocked?: boolean;
  onSakuraUnlockSeen?: () => void;
  /** 隠しキャラ「覚醒三重」が解禁済みか */
  kakuseiUnlocked?: boolean;
  /** 直前の試合で覚醒三重が解禁された（演出を流す） */
  kakuseiJustUnlocked?: boolean;
  onKakuseiUnlockSeen?: () => void;
}

const MENU: { id: Mode | 'diff' | 'help' | 'what'; label: string; sub: string }[] = [
  { id: '1p', label: '1P 対 CPU', sub: '理数科B組の日常に殴り込む' },
  { id: '2p', label: '2P 対戦', sub: '同じキーボードで殴り合う（内進 vs 理数科）' },
  { id: 'team', label: 'チーム戦（乱戦）✝', sub: '2対2も3対1も自由・全員同時出場（オフライン）' },
  { id: 'online', label: 'オンライン対戦 ✝', sub: 'ネット越しに✝本質✝をぶつけ合う（クイック／合言葉・チーム戦可）' },
  { id: 'cpu', label: '自己対話モード', sub: 'CPU 対 CPU。自演じゃなくて自己対話だよ' },
  { id: 'diff', label: 'CPUの偏差値', sub: '◀ ▶ で変更（対戦相手の強さ）' },
  { id: 'help', label: '操作説明', sub: 'キー配置と基本ルール' },
  { id: 'what', label: '✝本質✝とは', sub: '説明できたら✝本質✝じゃない' },
];

export default function TitleScreen({
  onStart,
  extremeUnlocked,
  justUnlocked,
  onUnlockSeen,
  sakuraUnlocked = false,
  sakuraJustUnlocked,
  onSakuraUnlockSeen,
  kakuseiUnlocked = false,
  kakuseiJustUnlocked,
  onKakuseiUnlockSeen,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cursor, setCursor] = useState(0);
  const [diff, setDiff] = useState<Difficulty>('normal');
  const [modal, setModal] = useState<'help' | 'what' | null>(null);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [showUnlock, setShowUnlock] = useState(!!justUnlocked);
  // 偏差値100と櫻優が同時に解禁されることはない（櫻優は偏差値100が必要）が、念のため偏差値100→櫻優の順に見せる
  const [showSakuraUnlock, setShowSakuraUnlock] = useState(!!sakuraJustUnlocked);
  const [showKakuseiUnlock, setShowKakuseiUnlock] = useState(!!kakuseiJustUnlocked);
  const stateRef = useRef({ cursor, diff, modal, extremeUnlocked });
  stateRef.current = { cursor, diff, modal, extremeUnlocked };
  const sakuraRef = useRef(sakuraUnlocked);
  sakuraRef.current = sakuraUnlocked;
  const kakuseiRef = useRef(kakuseiUnlocked);
  kakuseiRef.current = kakuseiUnlocked;

  useEffect(() => {
    if (justUnlocked) {
      setShowUnlock(true);
      audio.init();
      audio.sfx('super');
    }
  }, [justUnlocked]);

  useEffect(() => {
    if (sakuraJustUnlocked) {
      setShowSakuraUnlock(true);
      audio.init();
      audio.sfx('super');
    }
  }, [sakuraJustUnlocked]);

  useEffect(() => {
    if (kakuseiJustUnlocked) {
      setShowKakuseiUnlock(true);
      audio.init();
      audio.sfx('super');
    }
  }, [kakuseiJustUnlocked]);

  const closeSakuraUnlock = () => {
    setShowSakuraUnlock(false);
    onSakuraUnlockSeen?.();
  };

  const closeKakuseiUnlock = () => {
    setShowKakuseiUnlock(false);
    onKakuseiUnlockSeen?.();
  };

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    let raf = 0;
    let t = 0;
    const loop = () => {
      t++;
      drawTitleScene(g, t, rosterFor(sakuraRef.current, kakuseiRef.current));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setQuoteIdx((i) => (i + 1) % HONSHITSU_QUOTES.length), 4200);
    return () => window.clearInterval(id);
  }, []);

  const activate = (idx: number) => {
    const item = MENU[idx];
    audio.init();
    if (item.id === 'help' || item.id === 'what') {
      audio.sfx('confirm');
      setModal(item.id);
    } else if (item.id === 'diff') {
      const d = stateRef.current.diff;
      const list = stateRef.current.extremeUnlocked ? (['easy', 'normal', 'hard', 'extreme'] as Difficulty[]) : (['easy', 'normal', 'hard'] as Difficulty[]);
      setDiff(list[(list.indexOf(d) + 1) % list.length]);
      audio.sfx('move');
    } else {
      audio.sfx('confirm');
      onStart(item.id, stateRef.current.diff);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showUnlock) {
        if (['Enter', 'Space', 'Escape', 'KeyF', 'KeyG'].includes(e.code)) {
          e.preventDefault();
          setShowUnlock(false);
          onUnlockSeen?.();
          audio.sfx('confirm');
        }
        return;
      }
      if (showSakuraUnlock) {
        if (['Enter', 'Space', 'Escape', 'KeyF', 'KeyG'].includes(e.code)) {
          e.preventDefault();
          closeSakuraUnlock();
          audio.sfx('confirm');
        }
        return;
      }
      const { cursor: c, diff: d, modal: m, extremeUnlocked: un } = stateRef.current;
      const list = un ? (['easy', 'normal', 'hard', 'extreme'] as Difficulty[]) : (['easy', 'normal', 'hard'] as Difficulty[]);
      if (m) {
        if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyF' || e.code === 'KeyG') {
          setModal(null);
          audio.sfx('back');
        }
        return;
      }
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        setCursor((c + MENU.length - 1) % MENU.length);
        audio.init();
        audio.sfx('move');
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        setCursor((c + 1) % MENU.length);
        audio.init();
        audio.sfx('move');
      } else if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD') {
        if (MENU[c].id === 'diff') {
          const dir = e.code === 'ArrowLeft' || e.code === 'KeyA' ? -1 : 1;
          setDiff(list[(list.indexOf(d) + dir + list.length) % list.length]);
          audio.init();
          audio.sfx('move');
        }
      } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyF' || e.code === 'KeyK') {
        e.preventDefault();
        activate(c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUnlock, showSakuraUnlock]);

  return (
    <div className="relative flex h-full min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#07070f]">
      <canvas ref={canvasRef} className="pixelated absolute inset-0 h-full w-full object-cover opacity-90" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
      <div className="scanlines pointer-events-none absolute inset-0" />

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center px-4 py-8">
        <div className="text-center">
          <div className="animate-float text-sm tracking-[0.4em] text-amber-200/80 md:text-base">桐葉高校 理数科B組 非公認</div>
          <h1 className="pixel-text-shadow mt-2 text-5xl leading-none text-amber-300 md:text-7xl lg:text-8xl">
            <span className="inline-block animate-wobble text-white">✝</span>本質<span className="inline-block animate-wobble text-white [animation-delay:0.3s]">✝</span>
            <span className="ml-3 text-white">FIGHTERS</span>
          </h1>
          <p className="pixel-text-shadow mt-3 text-base text-slate-100 md:text-xl">偏差値60の教室から✝本質✝が漏れ出している件について</p>
          <p className="mt-1 text-xs text-slate-300 md:text-sm">— THE FIGHTING GAME — カオス・コメディ全振り</p>
        </div>

        {/* 現在のCPU偏差値を常に大きく表示 */}
        <div
          className={`mt-5 border-4 px-5 py-2 text-center shadow-[6px_6px_0_#000] ${
            diff === 'extreme'
              ? 'border-fuchsia-400 bg-fuchsia-950/90 text-fuchsia-100'
              : diff === 'hard'
                ? 'border-rose-400 bg-rose-950/90 text-rose-100'
                : 'border-amber-300/80 bg-slate-950/90 text-amber-100'
          }`}
        >
          <div className="text-[11px] tracking-widest opacity-80">対戦相手の強さ（CPU偏差値）</div>
          <div className="pixel-text-shadow text-2xl font-bold md:text-3xl">{DIFFICULTY_LABELS[diff]}</div>
          <div className="mt-0.5 text-xs opacity-90">{DIFFICULTY_HINT[diff]}</div>
          {!extremeUnlocked && <div className="mt-1 text-[10px] text-slate-400">※偏差値85に勝つと偏差値100が解禁</div>}
          {extremeUnlocked && !sakuraUnlocked && <div className="mt-1 text-[10px] text-fuchsia-300/80">※{HIDDEN_HINTS.sakura.hint}</div>}
          {sakuraUnlocked && <div className="mt-1 text-[10px] text-pink-300/90">※隠しキャラ「櫻優」解禁済み（全モードで選択可）</div>}
          {extremeUnlocked && !kakuseiUnlocked && <div className="mt-1 text-[10px] text-orange-300/80">※{HIDDEN_HINTS.kakusei.hint}</div>}
          {kakuseiUnlocked && <div className="mt-1 text-[10px] text-orange-300/90">※隠しキャラ「覚醒三重」解禁済み（全モードで選択可・オンラインも可）</div>}
        </div>

        <div className="mt-6 w-full max-w-md rounded border-4 border-slate-200/80 bg-slate-950/85 p-3 shadow-[6px_6px_0_#000] md:p-4">
          {MENU.map((m, i) => {
            const active = i === cursor;
            return (
              <button
                key={m.id}
                onMouseEnter={() => {
                  if (cursor !== i) {
                    setCursor(i);
                    audio.sfx('move');
                  }
                }}
                onClick={() => activate(i)}
                className={`flex w-full items-center gap-3 px-2 py-1.5 text-left transition-colors ${active ? 'bg-amber-300 text-slate-950' : 'text-slate-200 hover:bg-slate-800'}`}
              >
                <span className={`w-5 text-lg ${active ? 'animate-blink' : 'opacity-0'}`}>▶</span>
                <span className="flex-1">
                  <span className="block text-lg leading-tight md:text-xl">
                    {m.label}
                    {m.id === 'diff' && (
                      <span className="ml-2 text-base">
                        ◀ {DIFFICULTY_LABELS[diff]} ▶
                      </span>
                    )}
                  </span>
                  <span className={`block text-xs ${active ? 'text-slate-800' : 'text-slate-400'}`}>{m.sub}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 text-center text-xs text-slate-300 md:text-sm">
          <span className="animate-blink">▶</span> ↑↓ / W S で選択、Enter / F で決定 ・ M でミュート
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-amber-300/40 bg-black/70 py-1.5 text-center text-xs text-amber-100 md:text-sm">
        <span className="text-amber-300">✝本質✝募集所：</span> {HONSHITSU_QUOTES[quoteIdx]}
      </div>

      {modal && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-4" onClick={() => setModal(null)}>
          <div className="animate-pop max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded border-4 border-slate-100 bg-slate-950 p-5 text-slate-100 shadow-[8px_8px_0_#000]" onClick={(e) => e.stopPropagation()}>
            {modal === 'help' ? <HelpContent sakuraUnlocked={sakuraUnlocked} kakuseiUnlocked={kakuseiUnlocked} /> : <WhatContent />}
            <button className="mt-4 w-full border-2 border-amber-300 bg-amber-300 py-2 text-slate-950 hover:bg-amber-200" onClick={() => setModal(null)}>
              閉じる（Esc）
            </button>
          </div>
        </div>
      )}

      {/* 櫻優解禁演出 */}
      {showSakuraUnlock && !showUnlock && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={closeSakuraUnlock}>
          <div className="animate-pop relative w-full max-w-2xl overflow-hidden border-4 border-pink-400 bg-gradient-to-b from-pink-950 via-slate-950 to-black p-6 text-center shadow-[0_0_40px_#f472b6,12px_12px_0_#000] md:p-8">
            <div className="grid items-center gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
              <div className="relative mx-auto aspect-[3/4] w-40 overflow-hidden border-4 border-[#2f4f8f] md:w-52" style={{ background: `linear-gradient(180deg,#fff,${CHARS.sakura.light})` }}>
                <Portrait id="sakura" alt={CHARS.sakura.name} className="h-full w-full object-contain object-bottom p-1" />
                <div className="absolute left-0 top-0 h-full w-1.5 bg-[#2f4f8f]" />
              </div>
              <div className="text-left">
                <div className="text-xs tracking-[0.5em] text-pink-300">SECRET CHARACTER UNLOCKED</div>
                <div className="mt-1 text-xs text-slate-400">{CHARS.sakura.kana}</div>
                <div className="pixel-text-shadow text-5xl text-pink-200 md:text-6xl">{CHARS.sakura.name}</div>
                <div className="mt-1 text-amber-200">{CHARS.sakura.title}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="inline-block h-3 w-3 border border-white/40" style={{ background: CHARS.sakura.tieColor }} />
                  {CHARS.sakura.affiliation}（ネクタイ：{CHARS.sakura.tie}）
                </div>
                <div className="mt-3 border-l-4 border-pink-400 bg-black/40 p-2 text-sm text-slate-100">
                  「両馬先輩。報告があります。私は恋をしました」
                  <div className="mt-1 text-xs text-slate-400">── 微笑む観測者を最高偏差値で観測した者の前に、紺のネクタイがもう一人現れた。</div>
                </div>
                <p className="mt-3 text-xs text-slate-300">
                  必殺「シュレディンガーの好意」で未観測の♡？を置き、超必殺「実存的崩壊」で告白＝観測。被弾・ガードで研究データ n が溜まるほど重くなる。
                </p>
                <p className="mt-1 text-[11px] text-slate-400">1P・2P・自己対話・チーム戦・オンライン、全モードで選択可能になりました。</p>
              </div>
            </div>
            <div className="mt-5 animate-blink text-sm text-pink-200">Enter / クリックで閉じる（……観察のために、また来ます）</div>
          </div>
        </div>
      )}

      {/* 覚醒三重解禁演出 */}
      {showKakuseiUnlock && !showUnlock && !showSakuraUnlock && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={closeKakuseiUnlock}>
          <div className="animate-pop relative w-full max-w-2xl overflow-hidden border-4 border-orange-400 bg-gradient-to-b from-orange-950 via-slate-950 to-black p-6 text-center shadow-[0_0_40px_#fb923c,12px_12px_0_#000] md:p-8">
            <div className="grid items-center gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
              <div className="relative mx-auto aspect-[3/4] w-40 overflow-hidden border-4 border-orange-400 md:w-52" style={{ background: `linear-gradient(180deg,#fff,${CHARS.kakusei.light})` }}>
                <Portrait id="kakusei" alt={CHARS.kakusei.name} className="h-full w-full object-contain object-bottom p-1" />
                <div className="absolute left-0 top-0 h-full w-1.5 bg-orange-500" />
              </div>
              <div className="text-left">
                <div className="text-xs tracking-[0.5em] text-orange-300">SECRET CHARACTER UNLOCKED</div>
                <div className="mt-1 text-xs text-slate-400">{CHARS.kakusei.kana}</div>
                <div className="pixel-text-shadow text-5xl text-orange-200 md:text-6xl">{CHARS.kakusei.name}</div>
                <div className="mt-1 text-amber-200">{CHARS.kakusei.title}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-300">
                  <span className="inline-block h-3 w-3 border border-white/40" style={{ background: CHARS.kakusei.tieColor }} />
                  {CHARS.kakusei.affiliation}（ネクタイ：{CHARS.kakusei.tie}）
                </div>
                <div className="mt-3 border-l-4 border-orange-400 bg-black/40 p-2 text-sm text-slate-100">
                  「動くな。……均す。」
                  <div className="mt-1 text-xs text-slate-400">── 一人で七人の最高偏差値を超えた者の前に、ヘルメットの男が現れた。</div>
                </div>
                <p className="mt-3 text-xs text-slate-300">
                  必殺「土嚢堡」で飛び道具を止める壁を築き、超必殺「残土処分」で起振ローラーごと戦場を均す。1kgの片手ハンマーは、しゃがんだ相手まで掘る。
                </p>
                <p className="mt-1 text-[11px] text-slate-400">1P・2P・自己対話・チーム戦・オンライン、全モードで選択可能になりました。</p>
              </div>
            </div>
            <div className="mt-5 animate-blink text-sm text-orange-200">Enter / クリックで閉じる（……完工。）</div>
          </div>
        </div>
      )}

      {/* 偏差値100解禁演出 */}
      {showUnlock && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => {
            setShowUnlock(false);
            onUnlockSeen?.();
          }}
        >
          <div className="animate-pop max-w-lg border-4 border-fuchsia-400 bg-gradient-to-b from-fuchsia-950 via-slate-950 to-black p-8 text-center shadow-[0_0_40px_#e879f9,12px_12px_0_#000]">
            <div className="text-xs tracking-[0.5em] text-fuchsia-300">NEW DIFFICULTY UNLOCKED</div>
            <div className="pixel-text-shadow mt-3 text-5xl text-fuchsia-200 md:text-6xl">偏差値100</div>
            <div className="mt-2 text-lg text-amber-200">解禁 ✝</div>
            <p className="mt-4 text-sm text-slate-200">偏差値85の壁を越えた者だけが辿り着く領域。</p>
            <p className="mt-1 text-xs text-slate-400">ガード・反応・間合い管理がほぼ完璧。数理零カンスト相当。</p>
            <div className="mt-6 animate-blink text-sm text-fuchsia-200">Enter / クリックで閉じる</div>
          </div>
        </div>
      )}
    </div>
  );
}

function HelpContent({ sakuraUnlocked = false, kakuseiUnlocked = false }: { sakuraUnlocked?: boolean; kakuseiUnlocked?: boolean }) {
  return (
    <div className="space-y-4 text-sm md:text-base">
      <h2 className="text-2xl text-amber-300">操作説明</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="border-2 border-sky-400 p-3">
          <div className="mb-2 text-lg text-sky-300">1P（左側）</div>
          <KeyRow k="A / D" v="移動（相手と逆方向でガード）" />
          <KeyRow k="W" v="ジャンプ" />
          <KeyRow k="S" v="しゃがみガード" />
          <KeyRow k="F" v="弱攻撃" />
          <KeyRow k="G" v="強攻撃" />
          <KeyRow k="H" v="必殺技" />
          <KeyRow k="Space" v="超必殺技（✝本質✝ゲージMAX時）" />
        </div>
        <div className="border-2 border-rose-400 p-3">
          <div className="mb-2 text-lg text-rose-300">2P（右側）</div>
          <KeyRow k="← / →" v="移動（相手と逆方向でガード）" />
          <KeyRow k="↑" v="ジャンプ" />
          <KeyRow k="↓" v="しゃがみガード" />
          <KeyRow k="K" v="弱攻撃" />
          <KeyRow k="L" v="強攻撃" />
          <KeyRow k=";" v="必殺技" />
          <KeyRow k="Enter" v="超必殺技（✝本質✝ゲージMAX時）" />
        </div>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-slate-300">
        <li>2本先取。制限時間99秒（授業終了で体力の多い方が勝ち）。チーム戦は相手チーム全滅で1本。</li>
        <li>チーム戦（乱戦）は最大8人が同時に戦う。味方への攻撃は当たらない。青●と赤●が目印。</li>
        <li>攻撃を当てる／受けると✝本質✝ゲージが溜まる。MAXで超必殺技（立ち絵カットイン付き）。</li>
        <li>空中でも弱・強攻撃が出せる。三重の「は？」は当身。飛び道具も跳ね返す。</li>
        <li>試合中はランダムで✝本質✝イベントが発生する。ヘイカツが窓の外を見たら全員止まる。</li>
        <li>CPU偏差値はタイトルで変更。偏差値85に勝つと偏差値100が解禁。</li>
        <li>
          隠しキャラ①：{sakuraUnlocked ? `櫻優 ── 解禁済み。${HIDDEN_HINTS.sakura.condition}（達成）。` : `${HIDDEN_HINTS.sakura.sub} ${HIDDEN_HINTS.sakura.hint}`}
        </li>
        <li>
          隠しキャラ②：{kakuseiUnlocked ? `覚醒三重 ── 解禁済み。${HIDDEN_HINTS.kakusei.condition}（達成）。` : `${HIDDEN_HINTS.kakusei.sub} ${HIDDEN_HINTS.kakusei.hint}`}
        </li>
        <li>Esc / P でポーズ。M でミュート。スマホはタッチボタン対応（1Pのみ）。</li>
      </ul>
    </div>
  );
}

function KeyRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="min-w-[4.5rem] border border-slate-400 bg-slate-800 px-1.5 text-center text-xs text-slate-100">{k}</span>
      <span className="text-slate-300">{v}</span>
    </div>
  );
}

function WhatContent() {
  return (
    <div className="space-y-3 text-sm md:text-base">
      <h2 className="text-2xl text-amber-300">✝本質✝とは</h2>
      <p>
        第一章：✝本質✝とは何か——<span className="text-amber-200">✝本質✝の定義は不可能である。定義できないことが✝本質✝の定義である。</span>（両馬二郎先輩の教え）
      </p>
      <p className="text-slate-300">「いや、だから何が本質なんだよ」「だから本質に〈何が〉はないんだって」「いや、あるだろ。本質って言葉は何かの本質だろ。文法的に」「文法の✝本質✝を超えたところに本質があるんだよ」「日本語やめろ」</p>
      <div className="border-l-4 border-amber-300 pl-3 text-slate-200">
        前-原✝本質✝ → 原✝本質✝ → ✝本質✝ → 亜✝本質✝ → 非✝本質✝
        <div className="text-xs text-slate-400">（✝本質✝のグレートチェーン／倉石暁 編。寺地により一瞬で崩壊）</div>
      </div>
      <p className="text-slate-300">
        このゲームには✝本質✝がある。どこにあるかはわからない。わからないことが✝本質✝。<span className="text-sky-300">「は？」</span>
      </p>
    </div>
  );
}
