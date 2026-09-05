import { useEffect, useRef, useState } from 'react';
import { Battle, type CutIn } from '@/game/engine';
import { Renderer } from '@/game/render';
import { InputManager } from '@/game/input';
import { Portrait } from '@/components/Portrait';
import { audio } from '@/game/audio';
import { CHARS, STAGES } from '@/game/characters';
import { net, maskOf, unmask } from '@/game/net';
import type { FighterSetup, InputState, Setup, Side } from '@/game/types';
import { EMPTY_INPUT, TEAM_NAMES } from '@/game/types';

/** オンライン時のデフォルト入力遅延フレーム数（サーバー指定がない場合のフォールバック） */
const DEFAULT_NET_DELAY = 5;

interface Props {
  setup: Setup;
  onEnd: (winner: Side, wins: [number, number]) => void;
  onQuit: (to: 'select' | 'title') => void;
}

function checkTouchCapable(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(any-pointer: coarse)').matches
  );
}

export default function BattleScreen({ setup, onEnd, onQuit }: Props) {
  const gameRef = useRef<HTMLCanvasElement>(null);
  const fxRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(false);
  const [paused, setPaused] = useState(false);
  const [cutin, setCutin] = useState<{ c: CutIn; key: number } | null>(null);
  const [input, setInput] = useState<InputManager | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [oppLeft, setOppLeft] = useState(false);
  const [desync, setDesync] = useState(false);

  // タッチ操作UI（タブレット・スマホ対応）
  const [touchMode, setTouchMode] = useState<'auto' | 'on' | 'off'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('honkaku_touch_mode') as 'auto' | 'on' | 'off' | null;
      if (saved === 'on' || saved === 'off' || saved === 'auto') return saved;
    }
    return 'auto';
  });
  const [detectedTouch, setDetectedTouch] = useState(checkTouchCapable);

  useEffect(() => {
    const onTouch = () => setDetectedTouch(true);
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') setDetectedTouch(true);
    };
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('pointerdown', onPointerDown);
    return () => {
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  const showTouchControls = touchMode === 'on' || (touchMode === 'auto' && detectedTouch);

  const toggleTouchMode = () => {
    setTouchMode((curr) => {
      const next = curr === 'on' ? 'off' : curr === 'off' ? 'auto' : 'on';
      localStorage.setItem('honkaku_touch_mode', next);
      audio.sfx('move');
      return next;
    });
  };

  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const st = STAGES.find((s) => s.id === setup.stage) ?? STAGES[0];
  const online = setup.mode === 'online';
  const mySide: Side = online ? (setup.onlineSide ?? 0) : 0;
  const teamMode = !!setup.teamMode && !!setup.fighters && setup.fighters.length >= 2;
  const netDelay = online ? Math.max(0, setup.netInputDelay ?? DEFAULT_NET_DELAY) : 0;

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
    // チーム戦／1対1 のファイター構成を決める
    const fighters: FighterSetup[] = teamMode
      ? setup.fighters!
      : [
          { char: setup.p1, team: 0, ai: online ? false : setup.mode === 'cpu', tag: online ? (mySide === 0 ? 'あなた' : '相手') : setup.mode === 'cpu' ? 'CPU' : '1P' },
          { char: setup.p2, team: 1, ai: online ? false : setup.mode !== '2p', tag: online ? (mySide === 1 ? 'あなた' : '相手') : setup.mode === '2p' ? '2P' : 'CPU' },
        ];
    const battle = new Battle({
      p1: setup.p1,
      p2: setup.p2,
      ai: online ? [false, false] : [setup.mode === 'cpu', setup.mode !== '2p'],
      fighters: fighters.map((f) => ({ char: f.char, team: f.team, ai: f.ai, aiDifficulty: f.aiDifficulty, tag: f.tag })),
      difficulty: setup.difficulty,
      stage: setup.stage,
      seed: setup.seed,
      onCutin: (c) => {
        setCutin({ c, key: Date.now() });
        window.clearTimeout(cutinTimer);
        cutinTimer = window.setTimeout(() => setCutin(null), 1180);
      },
      onSfx: (s) => audio.sfx(s),
      onMatchEnd: (winner, wins) => {
        if (online) net.sendEnd();
        endTimer = window.setTimeout(() => onEndRef.current(winner, wins), 1600);
      },
    });

    // ── オンライン（ロックステップ）用 ──
    let frame = 0; // 実行済みフレーム数
    const localBuf = new Map<number, number>(); // 自分の予約入力 frame → mask
    let stallStartTime: number | null = null;
    let isWaitingDisplayed = false;

    const offLeft = online
      ? net.on('opponent-left', () => {
          setOppLeft(true);
        })
      : null;
    const offDesync = online ? net.on('desync', () => setDesync(true)) : null;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const STEP = 1000 / 60;

    // オンラインで自分が操作するスロット（1対1では side と一致）
    const mySlot = teamMode ? (setup.mySlot ?? 0) : mySide;

    const stepOnline = (): boolean => {
      // 自分の入力を netDelay フレーム先に予約して送信
      const target = frame + netDelay;
      if (!localBuf.has(target)) {
        // オンラインではどちらのキー配置（WASD系・矢印系・タッチ）でも操作できるようマージ
        const mask = maskOf(im.poll(0)) | maskOf(im.poll(1));
        localBuf.set(target, mask);
        net.sendInput(target, mySlot, mask);
      }
      // このフレームに必要な入力が揃っているか（人間スロット全員分）
      const inputs: InputState[] = [];
      for (let s = 0; s < fighters.length; s++) {
        if (fighters[s].ai) {
          inputs.push(EMPTY_INPUT);
          continue;
        }
        if (frame < netDelay) {
          inputs.push(EMPTY_INPUT);
          continue;
        }
        const m = s === mySlot ? localBuf.get(frame) : net.remoteInput(frame, s);
        if (m === undefined) return false; // 誰かの入力待ち
        inputs.push(unmask(m));
      }
      const currentFrame = frame;
      battle.step(inputs);
      localBuf.delete(currentFrame);
      net.discardConsumedFrame(currentFrame);
      frame++;
      // 定期的に同期チェック
      if (frame % 60 === 0) net.sendHash(frame, battle.stateHash());
      return true;
    };

    const stepLocal = () => {
      const polls = [im.poll(0), im.poll(1)];
      const inputs: InputState[] = fighters.map((f, i) => {
        if (f.ai) return EMPTY_INPUT;
        if (teamMode) return f.pad == null ? EMPTY_INPUT : polls[f.pad];
        return polls[i] ?? EMPTY_INPUT;
      });
      battle.step(inputs);
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(120, now - last);
      last = now;
      if (!pausedRef.current) {
        acc += dt;
        let n = 0;
        let stalled = false;
        while (acc >= STEP && n < 4) {
          if (online) {
            if (!stepOnline()) {
              stalled = true;
              acc = 0;
              break;
            }
          } else {
            stepLocal();
          }
          acc -= STEP;
          n++;
        }
        if (acc > STEP * 4) acc = 0;

        // ── オンライン待機中インジケータ（短時間のジッターでは表示せず、350ms以上の実質的な停止時のみ表示） ──
        if (online) {
          if (stalled) {
            if (stallStartTime === null) stallStartTime = now;
            if (now - stallStartTime >= 350 && !isWaitingDisplayed) {
              isWaitingDisplayed = true;
              setWaiting(true);
            }
          } else {
            stallStartTime = null;
            if (isWaitingDisplayed) {
              isWaitingDisplayed = false;
              setWaiting(false);
            }
          }
        }
      }
      renderer.draw(battle);
    };
    raf = requestAnimationFrame(loop);
    if (document.fonts && 'load' in document.fonts) {
      document.fonts.load("16px 'DotGothic16'").catch(() => undefined);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (online) {
          // オンライン中は試合を止められない（メニュー表示のみ）
          setPaused((p) => {
            audio.sfx(p ? 'confirm' : 'back');
            return !p;
          });
          return;
        }
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
      offLeft?.();
      offDesync?.();
    };
  }, [setup, online, mySide, teamMode, netDelay]);

  const resume = () => {
    pausedRef.current = false;
    setPaused(false);
    audio.sfx('confirm');
  };

  const p1 = CHARS[setup.p1];
  const p2 = CHARS[setup.p2];
  // タッチ操作が駆動するパッド：オンラインは0（両パッドをマージして送信するためどちらでも可）、
  // ローカルチーム戦は最初の人間ファイターのパッド、1対1ローカルは0
  const touchPad: Side = online ? 0 : teamMode ? (setup.fighters?.find((f) => !f.ai && f.pad != null)?.pad ?? 0) : 0;
  const myFighter = teamMode && setup.fighters ? setup.fighters[online ? (setup.mySlot ?? 0) : 0] : null;
  const myChar = myFighter ? CHARS[myFighter.char] : mySide === 0 ? p1 : p2;
  const teamCounts = teamMode && setup.fighters ? [setup.fighters.filter((f) => f.team === 0).length, setup.fighters.filter((f) => f.team === 1).length] : null;

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-[#05050c] select-none">
      <div className="relative w-full max-w-[177.78vh]" style={{ aspectRatio: '16 / 9' }}>
        <canvas ref={gameRef} className="pixelated absolute inset-0 h-full w-full" />
        <canvas ref={fxRef} className="absolute inset-0 h-full w-full" />
        <div className="scanlines pointer-events-none absolute inset-0 opacity-60" />
        {cutin && <CutInOverlay key={cutin.key} c={cutin.c} />}

        {/* 相手の回線待機中バナー（350ms以上の実質停止時のみ安定表示） */}
        {online && waiting && !oppLeft && (
          <div className="pointer-events-none absolute left-1/2 top-3 z-30 flex -translate-x-1/2 items-center gap-2 border-2 border-sky-400/90 bg-slate-950/90 px-3.5 py-1 text-xs text-sky-200 shadow-[0_0_12px_rgba(56,189,248,0.4)] backdrop-blur-sm">
            <span className="inline-block h-2 w-2 animate-ping rounded-full bg-sky-400" />
            <span>相手の回線を待機中…</span>
          </div>
        )}

        {/* 上部ステータスバー・コントロール */}
        <div className="absolute left-2 top-2 z-30 flex items-center gap-2">
          {online && net.latency >= 0 && (
            <div className="bg-black/60 px-2 py-0.5 text-[10px] text-slate-400 backdrop-blur-sm">PING {net.latency}ms</div>
          )}
        </div>

        <div className="absolute right-2 top-2 z-30 flex items-center gap-1.5">
          <button
            onClick={toggleTouchMode}
            className="rounded border border-slate-500/70 bg-black/60 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800 active:bg-amber-300 active:text-slate-950"
            title="タッチ操作UIの切り替え（ON / OFF / AUTO）"
          >
            📱 パッド: {touchMode === 'on' ? 'ON' : touchMode === 'off' ? 'OFF' : 'AUTO'}
          </button>
          <button
            onClick={() => {
              if (online) {
                setPaused((p) => {
                  audio.sfx(p ? 'confirm' : 'back');
                  return !p;
                });
              } else {
                pausedRef.current = !pausedRef.current;
                setPaused(pausedRef.current);
                input?.reset();
                audio.sfx(pausedRef.current ? 'back' : 'confirm');
              }
            }}
            className="rounded border border-slate-500/70 bg-black/60 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800 active:bg-amber-300 active:text-slate-950"
          >
            ⏸ MENU
          </button>
        </div>

        {online && desync && (
          <div className="absolute bottom-2 left-1/2 z-30 -translate-x-1/2 border border-rose-400 bg-black/80 px-2 py-0.5 text-[10px] text-rose-300">
            ⚠ 同期ずれを検出しました（結果が食い違う可能性があります）
          </div>
        )}

        {oppLeft && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80">
            <div className="animate-pop w-80 border-4 border-rose-400 bg-slate-950 p-4 text-center shadow-[8px_8px_0_#000]">
              <div className="pixel-text-shadow text-2xl text-rose-300">相手が退室しました</div>
              <div className="mt-1 text-xs text-slate-400">「✝本質✝から逃げたか…」</div>
              <button
                className="mt-4 w-full border-2 border-amber-300 bg-amber-300 py-1.5 text-slate-950 hover:bg-amber-200"
                onClick={() => {
                  net.leave();
                  onQuit('title');
                }}
              >
                タイトルへ
              </button>
            </div>
          </div>
        )}

        {paused && online && !oppLeft && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
            <div className="animate-pop w-72 border-4 border-slate-100 bg-slate-950 p-4 text-center shadow-[8px_8px_0_#000]">
              <div className="pixel-text-shadow text-3xl text-amber-300">MENU ✝</div>
              <div className="mt-1 text-xs text-slate-400">オンライン対戦中は試合は止まりません</div>
              <div className="mt-4 flex flex-col gap-2">
                <button className="border-2 border-amber-300 bg-amber-300 py-1.5 text-slate-950 hover:bg-amber-200" onClick={() => setPaused(false)}>
                  閉じる（Esc）
                </button>
                <button
                  className="border-2 border-rose-400 py-1.5 text-rose-200 hover:bg-rose-950"
                  onClick={() => {
                    net.leave();
                    onQuit('title');
                  }}
                >
                  対戦を放棄してタイトルへ
                </button>
              </div>
            </div>
          </div>
        )}

        {paused && !online && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
            <div className="animate-pop w-72 border-4 border-slate-100 bg-slate-950 p-4 text-center shadow-[8px_8px_0_#000]">
              <div className="pixel-text-shadow text-3xl text-amber-300">PAUSE ✝</div>
              <div className="mt-1 text-xs text-slate-400">「ヘイカツが窓の外を見ている」</div>
              <div className="mt-4 flex flex-col gap-2">
                <button className="border-2 border-amber-300 bg-amber-300 py-1.5 text-slate-950 hover:bg-amber-200" onClick={resume}>
                  再開（Esc）
                </button>
                <button className="border-2 border-slate-400 py-1.5 text-slate-100 hover:bg-slate-800" onClick={() => onQuit('select')}>
                  {teamMode ? 'チーム編成へ' : 'キャラクター選択へ'}
                </button>
                <button className="border-2 border-slate-400 py-1.5 text-slate-100 hover:bg-slate-800" onClick={() => onQuit('title')}>
                  タイトルへ
                </button>
              </div>
            </div>
          </div>
        )}

        {/* タッチ操作UI（D-pad & アクションボタン） */}
        {showTouchControls && input && !paused && <TouchControls input={input} side={touchPad} />}
      </div>

      <div className="mt-2 hidden w-full max-w-5xl items-center justify-between px-3 text-[11px] text-slate-400 md:flex">
        {teamMode && teamCounts ? (
          <>
            <span>
              <span style={{ color: myChar.color }}>{myChar.name}</span>（あなた）：WASD/矢印/タッチ 移動 ／ F 弱 ／ G 強 ／ H 必殺 ／ Space 超必殺
            </span>
            <span className="text-slate-500">
              {TEAM_NAMES[0]} {teamCounts[0]}人 vs {TEAM_NAMES[1]} {teamCounts[1]}人 ／ {st.name} ／ {online ? 'オンライン乱戦' : 'オフライン乱戦'} ／ M ミュート
            </span>
            <span>
              {setup.mode === 'online' ? '回線待機あり' : 'Esc ポーズ'}
            </span>
          </>
        ) : online ? (
          <>
            <span>
              <span style={{ color: (mySide === 0 ? p1 : p2).color }}>{(mySide === 0 ? p1 : p2).name}</span>（あなた）：WASD/矢印/タッチ 移動 ／ F 弱 ／ G 強 ／ H 必殺 ／ Space 超必殺
            </span>
            <span className="text-slate-500">
              {st.name} ── {st.sub} ／ オンライン対戦 ／ M ミュート
            </span>
            <span>
              <span style={{ color: (mySide === 0 ? p2 : p1).color }}>{(mySide === 0 ? p2 : p1).name}</span>（相手）
            </span>
          </>
        ) : (
          <>
            <span>
              <span style={{ color: p1.color }}>{p1.name}</span>：WASD/タッチ 移動 ／ F 弱 ／ G 強 ／ H 必殺 ／ Space 超必殺
            </span>
            <span className="text-slate-500">
              {st.name} ── {st.sub} ／ Esc ポーズ ／ M ミュート
            </span>
            <span>
              <span style={{ color: p2.color }}>{p2.name}</span>：矢印 移動 ／ K 弱 ／ L 強 ／ ; 必殺 ／ Enter 超必殺{setup.mode !== '2p' ? '（CPU操作中）' : ''}
            </span>
          </>
        )}
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

/** タッチ・タブレット操作用コントローラー（D-pad ＋ アクションボタン） */
function TouchControls({ input, side }: { input: InputManager; side: Side }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-1 z-20 flex items-end justify-between px-3 pb-1 touch-none">
      <VirtualDPad input={input} side={side} />
      <ActionButtons input={input} side={side} />
    </div>
  );
}

/** 仮想十字キー（タップ・スライド対応） */
function VirtualDPad({ input, side }: { input: InputManager; side: Side }) {
  const [activeDir, setActiveDir] = useState<{ up: boolean; down: boolean; left: boolean; right: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerIdRef = useRef<number | null>(null);

  const applyDir = (up: boolean, down: boolean, left: boolean, right: boolean) => {
    setActiveDir({ up, down, left, right });
    input.setDirections(side, { up, down, left, right });
  };

  const updateFromCoords = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const radius = rect.width / 2;

    if (dist < radius * 0.15) {
      applyDir(false, false, false, false);
      return;
    }

    const angle = Math.atan2(dy, dx);
    const isRight = Math.abs(dx) > radius * 0.2 && dx > 0 && Math.abs(angle) < (Math.PI * 3) / 8;
    const isLeft = Math.abs(dx) > radius * 0.2 && dx < 0 && (angle > (Math.PI * 5) / 8 || angle < (-Math.PI * 5) / 8);
    const isDown = Math.abs(dy) > radius * 0.2 && dy > 0 && angle > Math.PI / 8 && angle < (Math.PI * 7) / 8;
    const isUp = Math.abs(dy) > radius * 0.2 && dy < 0 && angle < -Math.PI / 8 && angle > (-Math.PI * 7) / 8;

    applyDir(isUp, isDown, isLeft, isRight);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    pointerIdRef.current = e.pointerId;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    updateFromCoords(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointerIdRef.current === e.pointerId) {
      e.preventDefault();
      updateFromCoords(e.clientX, e.clientY);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (pointerIdRef.current === e.pointerId) {
      pointerIdRef.current = null;
      applyDir(false, false, false, false);
    }
  };

  const baseBtn = 'flex items-center justify-center rounded-lg text-sm font-bold transition-colors select-none md:text-lg';

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="pointer-events-auto relative grid h-32 w-32 grid-cols-3 grid-rows-3 gap-1 rounded-2xl border-2 border-white/40 bg-black/55 p-1.5 shadow-[4px_4px_0_#000] backdrop-blur-sm touch-none md:h-40 md:w-40"
    >
      <span />
      <div className={`${baseBtn} ${activeDir.up ? 'bg-amber-300 text-slate-950 shadow-inner' : 'bg-slate-800/80 text-white'}`}>
        ▲
      </div>
      <span />
      <div className={`${baseBtn} ${activeDir.left ? 'bg-amber-300 text-slate-950 shadow-inner' : 'bg-slate-800/80 text-white'}`}>
        ◀
      </div>
      <div className="flex items-center justify-center text-[10px] text-slate-400 font-bold">
        ✝
      </div>
      <div className={`${baseBtn} ${activeDir.right ? 'bg-amber-300 text-slate-950 shadow-inner' : 'bg-slate-800/80 text-white'}`}>
        ▶
      </div>
      <span />
      <div className={`${baseBtn} ${activeDir.down ? 'bg-amber-300 text-slate-950 shadow-inner' : 'bg-slate-800/80 text-white'}`}>
        ▼
      </div>
      <span />
    </div>
  );
}

/** 仮想アクションボタン（弱・強・必殺・超必殺） */
function ActionButtons({ input, side }: { input: InputManager; side: Side }) {
  const bind = (key: keyof InputState) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      input.touch(side, key, true);
    },
    onPointerUp: () => input.touch(side, key, false),
    onPointerCancel: () => input.touch(side, key, false),
  });

  const btnBase =
    'flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold select-none shadow-[2px_2px_0_#000] active:scale-95 touch-none md:h-16 md:w-16 md:text-lg';

  return (
    <div className="pointer-events-auto grid grid-cols-2 gap-1.5 rounded-2xl border-2 border-white/40 bg-black/55 p-1.5 shadow-[4px_4px_0_#000] backdrop-blur-sm touch-none md:gap-2 md:p-2">
      <button
        {...bind('light')}
        className={`${btnBase} border-sky-400/80 bg-sky-950/80 text-sky-200 active:bg-sky-400 active:text-slate-950`}
        aria-label="弱攻撃"
      >
        弱
      </button>
      <button
        {...bind('heavy')}
        className={`${btnBase} border-rose-400/80 bg-rose-950/80 text-rose-200 active:bg-rose-400 active:text-slate-950`}
        aria-label="強攻撃"
      >
        強
      </button>
      <button
        {...bind('special')}
        className={`${btnBase} border-emerald-400/80 bg-emerald-950/80 text-emerald-200 active:bg-emerald-400 active:text-slate-950`}
        aria-label="必殺技"
      >
        必
      </button>
      <button
        {...bind('super')}
        className={`${btnBase} border-amber-300 bg-amber-950/80 text-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.4)] active:bg-amber-300 active:text-slate-950`}
        aria-label="超必殺技"
      >
        ✝
      </button>
    </div>
  );
}
