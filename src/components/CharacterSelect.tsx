import { useEffect, useRef, useState } from 'react';
import { CHARS, CHAR_ORDER, DIFFICULTY_SHORT, HIDDEN_CHAR } from '@/game/characters';
import { Portrait } from '@/components/Portrait';
import { audio } from '@/game/audio';
import type { CharDef, CharId, Difficulty, Mode } from '@/game/types';

interface Props {
  mode: Mode;
  difficulty: Difficulty;
  sakuraUnlocked: boolean;
  onDone: (p1: CharId, p2: CharId) => void;
  onBack: () => void;
}

const COLS = 3;
const ROWS = Math.ceil(CHAR_ORDER.length / COLS);

export default function CharacterSelect({ mode, difficulty, sakuraUnlocked, onDone, onBack }: Props) {
  const [cur, setCur] = useState<[number, number]>([0, 1]);
  const [locked, setLocked] = useState<[boolean, boolean]>([false, false]);
  const [turn, setTurn] = useState<0 | 1>(0);
  const [rouletting, setRouletting] = useState(false);
  const [hiddenHint, setHiddenHint] = useState(false);
  const ref = useRef({ cur, locked, turn, rouletting, sakuraUnlocked });
  ref.current = { cur, locked, turn, rouletting, sakuraUnlocked };
  const isHiddenLocked = (id: CharId) => id === HIDDEN_CHAR && !sakuraUnlocked;
  // 1Pモードでも相手CPUはプレイヤーが選べる（ランダムは自己対話のみ）
  const isAi: [boolean, boolean] = [mode === 'cpu', mode === 'cpu'];
  const cpuSelectable = mode === '1p';

  const move = (side: 0 | 1, dx: number, dy: number) => {
    const c = ref.current.cur[side];
    let col = c % COLS;
    let row = Math.floor(c / COLS);
    col = (col + dx + COLS) % COLS;
    row = (row + dy + ROWS) % ROWS;
    let next = row * COLS + col;
    if (next >= CHAR_ORDER.length) next = CHAR_ORDER.length - 1;
    const nextCur: [number, number] = [...ref.current.cur] as [number, number];
    nextCur[side] = next;
    setCur(nextCur);
    audio.sfx('move');
  };

  const lock = (side: 0 | 1) => {
    if (ref.current.locked[side]) return;
    // 未解禁の隠しキャラは選べない（ヒントを出す）
    if (CHAR_ORDER[ref.current.cur[side]] === HIDDEN_CHAR && !ref.current.sakuraUnlocked) {
      setHiddenHint(true);
      window.setTimeout(() => setHiddenHint(false), 2200);
      audio.sfx('back');
      return;
    }
    const nl: [boolean, boolean] = [...ref.current.locked] as [boolean, boolean];
    nl[side] = true;
    setLocked(nl);
    audio.sfx('confirm');
    if (side === 0) setTurn(1);
  };

  const unlock = (side: 0 | 1) => {
    if (!ref.current.locked[side]) {
      if (side === 0) onBack();
      return;
    }
    const nl: [boolean, boolean] = [...ref.current.locked] as [boolean, boolean];
    nl[side] = false;
    setLocked(nl);
    setTurn(side);
    audio.sfx('back');
  };

  // CPU roulette only for 自己対話 mode
  useEffect(() => {
    const side = turn;
    if (!isAi[side] || locked[side] || rouletting) return;
    if (side === 1 && !locked[0]) return;
    setRouletting(true);
    let n = 0;
    const total = 14 + Math.floor(Math.random() * 6);
    // 未解禁の隠しキャラはルーレットの対象外
    const pool = CHAR_ORDER.map((cid, i) => ({ cid, i })).filter(({ cid }) => !(cid === HIDDEN_CHAR && !ref.current.sakuraUnlocked));
    const id = window.setInterval(() => {
      n++;
      const next: [number, number] = [...ref.current.cur] as [number, number];
      next[side] = pool[Math.floor(Math.random() * pool.length)].i;
      setCur(next);
      audio.sfx('move');
      if (n >= total) {
        window.clearInterval(id);
        setRouletting(false);
        lock(side);
      }
    }, 90);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn, locked]);

  useEffect(() => {
    if (locked[0] && locked[1]) {
      const t = window.setTimeout(() => onDone(CHAR_ORDER[cur[0]], CHAR_ORDER[cur[1]]), 700);
      return () => window.clearTimeout(t);
    }
  }, [locked, cur, onDone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { locked: lk, rouletting: rl } = ref.current;
      if (rl) return;
      const p1 = !isAi[0];
      const p2 = !isAi[1] || cpuSelectable;
      switch (e.code) {
        case 'KeyA':
          if (p1 && !lk[0]) move(0, -1, 0);
          break;
        case 'KeyD':
          if (p1 && !lk[0]) move(0, 1, 0);
          break;
        case 'KeyW':
          if (p1 && !lk[0]) move(0, 0, -1);
          break;
        case 'KeyS':
          if (p1 && !lk[0]) move(0, 0, 1);
          break;
        case 'KeyF':
        case 'Space':
          e.preventDefault();
          if (!lk[0] && p1) lock(0);
          else if (lk[0] && !lk[1] && (p2 || cpuSelectable)) lock(1);
          break;
        case 'KeyG':
          if (lk[1] && (p2 || cpuSelectable)) unlock(1);
          else if (p1) unlock(0);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (lk[0] && !lk[1] && (p2 || cpuSelectable)) move(1, -1, 0);
          else if (!lk[0] && p1) move(0, -1, 0);
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (lk[0] && !lk[1] && (p2 || cpuSelectable)) move(1, 1, 0);
          else if (!lk[0] && p1) move(0, 1, 0);
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (lk[0] && !lk[1] && (p2 || cpuSelectable)) move(1, 0, -1);
          else if (!lk[0] && p1) move(0, 0, -1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (lk[0] && !lk[1] && (p2 || cpuSelectable)) move(1, 0, 1);
          else if (!lk[0] && p1) move(0, 0, 1);
          break;
        case 'KeyK':
        case 'Enter':
          e.preventDefault();
          if (!lk[0] && p1) lock(0);
          else if (lk[0] && !lk[1] && (p2 || cpuSelectable)) lock(1);
          break;
        case 'KeyL':
          if (lk[1] && (p2 || cpuSelectable)) unlock(1);
          break;
        case 'Escape':
          if (lk[1] && (p2 || cpuSelectable)) unlock(1);
          else if (lk[0]) unlock(0);
          else onBack();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCardClick = (idx: number) => {
    const { locked: lk, rouletting: rl } = ref.current;
    if (rl) return;
    const side: 0 | 1 = !lk[0] ? 0 : 1;
    if (isAi[side] && !cpuSelectable) return;
    if (side === 1 && !cpuSelectable && isAi[1]) return;
    const next: [number, number] = [...ref.current.cur] as [number, number];
    if (next[side] === idx) lock(side);
    else {
      next[side] = idx;
      setCur(next);
      audio.sfx('move');
    }
  };

  const c1 = CHARS[CHAR_ORDER[cur[0]]];
  const c2 = CHARS[CHAR_ORDER[cur[1]]];
  const status =
    locked[0] && locked[1]
      ? '決定！ ✝'
      : !locked[0]
        ? isAi[0]
          ? 'CPUが✝本質✝に導かれて選択中…'
          : '1P：自分のキャラクターを選べ'
        : isAi[1] && !cpuSelectable
          ? 'CPUが✝本質✝に導かれて選択中…'
          : mode === '1p'
            ? `CPU相手を選べ（${DIFFICULTY_SHORT[difficulty]}）`
            : '2P：キャラクターを選べ';

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center overflow-hidden bg-[#0b0b18] px-3 py-4 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fde68a 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="scanlines pointer-events-none absolute inset-0" />
      <header className="relative z-10 flex w-full max-w-6xl items-center justify-between">
        <button className="border-2 border-slate-500 px-2 py-1 text-xs hover:bg-slate-800" onClick={onBack}>
          ◀ タイトル
        </button>
        <div className="text-center">
          <div className="pixel-text-shadow text-2xl text-amber-300 md:text-4xl">CHARACTER SELECT</div>
          <div className="text-xs text-slate-300 md:text-sm">
            {mode === '1p' ? (
              <>
                相手の強さ：<span className="font-bold text-amber-200">{DIFFICULTY_SHORT[difficulty]}</span>
                {difficulty === 'hard' || difficulty === 'extreme' ? '（ガードガチ）' : ''}
              </>
            ) : (
              '生徒を選べ ── 偏差値は関係ない。地面を見ろ。'
            )}
          </div>
        </div>
        <div className="w-28 text-right text-xs text-slate-400">
          {mode === '1p' ? '1P vs CPU' : mode === '2p' ? '2P 対戦' : '自己対話'}
        </div>
      </header>

      <div className={`relative z-10 mt-3 border-2 px-4 py-1 text-sm md:text-base ${locked[0] && locked[1] ? 'border-amber-300 bg-amber-300 text-slate-950' : 'border-slate-600 bg-slate-950/70'}`}>
        <span className="animate-blink">▶</span> {status}
      </div>

      {hiddenHint && (
        <div className="animate-pop relative z-20 mt-2 border-2 border-fuchsia-400 bg-fuchsia-950/90 px-4 py-1 text-xs text-fuchsia-100 md:text-sm">
          ？？？ ── 偏差値100の「あの人」に勝った者だけが観測できる…
        </div>
      )}

      <div className="relative z-10 mt-4 grid w-full max-w-6xl grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <DetailPanel def={c1} side={0} label={isAi[0] ? 'CPU' : '1P'} locked={locked[0]} mystery={isHiddenLocked(c1.id)} />
        <div className="order-first grid grid-cols-3 gap-2 self-center lg:order-none">
          {CHAR_ORDER.map((id, i) => {
            const d = CHARS[id];
            const s1 = cur[0] === i;
            const s2 = cur[1] === i && (locked[0] || isAi[0] || cpuSelectable);
            return (
              <button
                key={id}
                onClick={() => onCardClick(i)}
                onMouseEnter={() => {
                  const { locked: lk, rouletting: rl } = ref.current;
                  if (rl) return;
                  const side: 0 | 1 = !lk[0] ? 0 : 1;
                  if (isAi[side] && !cpuSelectable) return;
                  if (lk[side]) return;
                  if (ref.current.cur[side] !== i) {
                    const next: [number, number] = [...ref.current.cur] as [number, number];
                    next[side] = i;
                    setCur(next);
                    audio.sfx('move');
                  }
                }}
                className={`group relative aspect-[3/4] w-[26vw] max-w-[150px] overflow-hidden border-4 bg-white text-left transition-transform lg:w-[150px] ${
                  s1 && s2 ? 'border-fuchsia-400' : s1 ? 'border-sky-400' : s2 ? 'border-rose-400' : 'border-slate-700'
                } ${s1 || s2 ? 'scale-105 shadow-[4px_4px_0_#000]' : 'hover:border-slate-400'}`}
                style={{ background: `linear-gradient(180deg, #fff 0%, ${d.light} 100%)` }}
              >
                {isHiddenLocked(id) ? (
                  <>
                    <div className="flex h-full w-full flex-col items-center justify-center bg-slate-950 px-1 pb-7">
                      <div className="pixel-text-shadow text-4xl text-slate-600">？</div>
                      <div className="mt-1 text-[9px] leading-tight text-slate-500">？？？</div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-slate-950/95 px-1.5 py-1">
                      <div className="text-sm leading-tight text-slate-500 md:text-base">？？？</div>
                      <div className="truncate text-[10px] text-slate-600">観測されていない</div>
                    </div>
                    <div className="absolute left-0 top-0 h-full w-1.5 bg-slate-700" />
                  </>
                ) : (
                  <>
                    <Portrait id={id} alt={d.name} className="h-full w-full object-contain object-bottom px-1 pb-7" />
                    <div className="absolute inset-x-0 bottom-0 bg-slate-950/85 px-1.5 py-1">
                      <div className="text-sm leading-tight text-white md:text-base">{d.name}</div>
                      <div className="truncate text-[10px] text-slate-300">{d.title}</div>
                    </div>
                    <div className="absolute left-0 top-0 h-full w-1.5" style={{ background: d.tieColor }} />
                  </>
                )}
                {s1 && <Tag text={isAi[0] ? 'CPU' : '1P'} color="bg-sky-400" side="left" locked={locked[0]} />}
                {s2 && <Tag text={isAi[1] && !cpuSelectable ? 'CPU' : mode === '1p' ? 'CPU' : '2P'} color="bg-rose-400" side="right" locked={locked[1]} />}
              </button>
            );
          })}
        </div>
        <DetailPanel
          def={c2}
          side={1}
          label={mode === '1p' ? 'CPU' : isAi[1] ? 'CPU' : '2P'}
          locked={locked[1]}
          dim={!locked[0] && !isAi[0]}
          difficulty={mode === '1p' ? difficulty : undefined}
          mystery={isHiddenLocked(c2.id)}
        />
      </div>

      <div className="relative z-10 mt-3 flex items-center justify-center gap-3">
        {!locked[0] && !isAi[0] ? (
          <button
            onClick={() => lock(0)}
            className="border-2 border-amber-300 bg-amber-300 px-6 py-1.5 text-sm font-bold text-slate-950 shadow-[3px_3px_0_#000] hover:bg-amber-200 active:scale-95"
          >
            1P 決定 ✝
          </button>
        ) : locked[0] && !locked[1] && (mode === '1p' || mode === '2p' || !isAi[1]) ? (
          <div className="flex gap-2">
            <button
              onClick={() => lock(1)}
              className="border-2 border-amber-300 bg-amber-300 px-6 py-1.5 text-sm font-bold text-slate-950 shadow-[3px_3px_0_#000] hover:bg-amber-200 active:scale-95"
            >
              {mode === '1p' ? '対戦相手（CPU）決定 ✝' : '2P 決定 ✝'}
            </button>
            <button
              onClick={() => unlock(0)}
              className="border-2 border-slate-500 bg-slate-900 px-4 py-1.5 text-sm text-slate-200 shadow-[3px_3px_0_#000] hover:bg-slate-800"
            >
              1P 再選択
            </button>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 mt-2 text-center text-xs text-slate-400 md:text-sm">
        {mode === '1p'
          ? '1P：WASD／矢印で移動・F/Enter 決定・G/Esc 戻る　※自分→相手の順で両方選べます'
          : '1P：WASD 移動・F 決定・G 戻る ／ 2P：矢印 移動・K 決定・L 戻る ／ クリックでも選べる'}
      </div>
    </div>
  );
}

function Tag({ text, color, side, locked }: { text: string; color: string; side: 'left' | 'right'; locked: boolean }) {
  return (
    <div className={`absolute top-1 ${side === 'left' ? 'left-2' : 'right-1'} ${color} px-1.5 py-0.5 text-xs text-slate-950 shadow-[2px_2px_0_#000] ${locked ? '' : 'animate-blink'}`}>
      {text}
      {locked ? ' ✓' : ''}
    </div>
  );
}

function Stat({ label, v, color }: { label: string; v: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-14 text-slate-300">{label}</span>
      <span className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="inline-block h-3 w-4 border border-slate-700" style={{ background: i <= v ? color : '#1e293b' }} />
        ))}
      </span>
    </div>
  );
}

function DetailPanel({
  def,
  side,
  label,
  locked,
  dim,
  difficulty,
  mystery,
}: {
  def: CharDef;
  side: 0 | 1;
  label: string;
  locked: boolean;
  dim?: boolean;
  difficulty?: Difficulty;
  mystery?: boolean;
}) {
  const right = side === 1;
  if (mystery) {
    return (
      <div className={`flex gap-3 border-4 bg-slate-950/80 p-3 shadow-[6px_6px_0_#000] ${right ? 'border-rose-400 lg:flex-row-reverse' : 'border-sky-400'} ${dim ? 'opacity-40' : ''}`}>
        <div className="relative flex aspect-[3/4] w-28 shrink-0 items-center justify-center self-start border-2 border-slate-700 bg-slate-900 md:w-36">
          <div className="pixel-text-shadow text-5xl text-slate-600">？</div>
          <div className={`absolute top-1 ${right ? 'right-1' : 'left-1'} px-1.5 text-xs text-slate-950 ${right ? 'bg-rose-400' : 'bg-sky-400'}`}>{label}</div>
        </div>
        <div className={`min-w-0 flex-1 ${right ? 'text-right' : ''}`}>
          <div className="text-xs text-slate-600">？？？</div>
          <div className="text-2xl leading-tight text-slate-500">？？？</div>
          <div className="text-xs text-slate-600">観測されていない存在</div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">紺のネクタイの気配だけがする。偏差値100の「あの人」に勝てば、姿を観測できるかもしれない…</p>
        </div>
      </div>
    );
  }
  return (
    <div className={`flex gap-3 border-4 bg-slate-950/80 p-3 shadow-[6px_6px_0_#000] transition-opacity ${right ? 'border-rose-400 lg:flex-row-reverse' : 'border-sky-400'} ${dim ? 'opacity-40' : ''}`}>
      <div
        className="relative aspect-[3/4] w-28 shrink-0 self-start overflow-hidden border-2 border-slate-700 md:w-36"
        style={{ background: `linear-gradient(180deg,#fff,${def.light})` }}
      >
        <Portrait id={def.id} alt={def.name} className="h-full w-full object-contain object-bottom" />
        <div className={`absolute top-1 ${right ? 'right-1' : 'left-1'} px-1.5 text-xs text-slate-950 ${right ? 'bg-rose-400' : 'bg-sky-400'}`}>{label}</div>
        {locked && <div className="absolute inset-x-0 bottom-0 bg-amber-300 py-0.5 text-center text-xs text-slate-950">決定 ✝</div>}
      </div>
      <div className={`min-w-0 flex-1 ${right ? 'text-right' : ''}`}>
        <div className="text-xs text-slate-400">{def.kana}</div>
        <div className="text-2xl leading-tight" style={{ color: def.color }}>
          {def.name}
        </div>
        <div className="text-xs text-amber-200">{def.title}</div>
        {difficulty && (
          <div className={`mt-1 text-sm font-bold ${difficulty === 'extreme' ? 'text-fuchsia-300' : difficulty === 'hard' ? 'text-rose-300' : 'text-amber-200'}`}>
            相手の強さ：{DIFFICULTY_SHORT[difficulty]}
          </div>
        )}
        <div className={`mt-1 flex items-center gap-2 text-[11px] ${right ? 'justify-end' : ''}`}>
          <span className="inline-block h-3 w-3 border border-white/40" style={{ background: def.tieColor }} />
          <span className="text-slate-300">
            {def.affiliation}（ネクタイ：{def.tie}）
          </span>
        </div>
        <div className={`mt-2 space-y-0.5 ${right ? 'flex flex-col items-end' : ''}`}>
          <Stat label="パワー" v={def.stats.power} color="#f87171" />
          <Stat label="スピード" v={def.stats.speed} color="#60a5fa" />
          <Stat label="✝本質✝" v={def.stats.honshitsu} color="#fbbf24" />
          <Stat label="常識" v={def.stats.joushiki} color="#4ade80" />
        </div>
        <div className="mt-2 space-y-0.5 text-[11px] leading-snug">
          <MoveRow k="弱" name={def.moves.light.name} />
          <MoveRow k="強" name={def.moves.heavy.name} />
          <MoveRow k="必殺" name={def.moves.special.name} desc={def.moves.special.desc} />
          <MoveRow k="超必殺" name={def.superName} desc={def.superDesc} accent />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-400">{def.desc}</p>
      </div>
    </div>
  );
}

function MoveRow({ k, name, desc, accent }: { k: string; name: string; desc?: string; accent?: boolean }) {
  return (
    <div>
      <span className={`mr-1 inline-block min-w-[3rem] border px-1 text-center ${accent ? 'border-amber-300 text-amber-300' : 'border-slate-600 text-slate-300'}`}>{k}</span>
      <span className={accent ? 'text-amber-100' : 'text-slate-100'}>{name}</span>
      {desc && <div className="text-[10px] text-slate-500">{desc}</div>}
    </div>
  );
}
