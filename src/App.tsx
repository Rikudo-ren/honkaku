import { useCallback, useEffect, useRef, useState } from 'react';
import LoadingScreen from '@/components/LoadingScreen';
import TitleScreen from '@/components/TitleScreen';
import CharacterSelect from '@/components/CharacterSelect';
import TeamSetup from '@/components/TeamSetup';
import OnlineLobby from '@/components/OnlineLobby';
import VersusScreen from '@/components/VersusScreen';
import BattleScreen from '@/components/BattleScreen';
import ResultScreen from '@/components/ResultScreen';
import { preloadPortraits } from '@/components/Portrait';
import { STAGES } from '@/game/characters';
import { audio } from '@/game/audio';
import { net, type StartData } from '@/game/net';
import type { CharId, Difficulty, FighterSetup, Mode, Setup, Side, StageId } from '@/game/types';

type Screen = 'loading' | 'title' | 'select' | 'teamsetup' | 'online' | 'versus' | 'battle' | 'result';

const randomStage = (): StageId => STAGES[Math.floor(Math.random() * STAGES.length)].id;

const UNLOCK_KEY = 'honkaku_extreme_unlocked';

const MIN_LOADING_MS = 500;

function loadUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

function saveUnlocked() {
  try {
    localStorage.setItem(UNLOCK_KEY, '1');
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [setup, setSetup] = useState<Setup>({ mode: '1p', difficulty: 'normal', p1: 'mie', p2: 'ryoma', stage: 'classroom' });
  const [result, setResult] = useState<{ winner: Side; wins: [number, number] } | null>(null);
  const [battleKey, setBattleKey] = useState(0);
  const [muted, setMuted] = useState(false);
  const [extremeUnlocked, setExtremeUnlocked] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const bgmRef = useRef<'title' | 'battle'>('title');

  useEffect(() => {
    setExtremeUnlocked(loadUnlocked());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    preloadPortraits((done, total) => {
      if (cancelled) return;
      setLoadProgress(total === 0 ? 1 : done / total);
    }).then(() => {
      if (cancelled) return;
      const elapsed = performance.now() - started;
      const wait = Math.max(0, MIN_LOADING_MS - elapsed);
      window.setTimeout(() => {
        if (cancelled) return;
        setLoadProgress(1);
        setScreen('title');
      }, wait);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unlock = () => {
      audio.init();
      audio.playBgm(bgmRef.current);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') setMuted(audio.toggleMute());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const kind = screen === 'battle' ? 'battle' : 'title';
    bgmRef.current = kind;
    audio.playBgm(kind);
  }, [screen]);

  const start = useCallback((mode: Mode, difficulty: Difficulty) => {
    setSetup((s) => ({
      ...s,
      mode,
      difficulty,
      teamMode: false,
      fighters: undefined,
      mySlot: undefined,
      onlineMatchId: undefined,
      netInputDelay: undefined,
    }));
    setScreen(mode === 'online' ? 'online' : mode === 'team' ? 'teamsetup' : 'select');
  }, []);

  const onlineStart = useCallback((data: StartData) => {
    const myId = net.sessionId;
    let mySlot = data.fighters.findIndex((f) => f.sessionId !== null && f.sessionId === myId);
    if (mySlot < 0) mySlot = 0;
    if (data.fighters.length === 2) {
      // 1対1クイック：従来通りのセットアップ
      const mySide = (mySlot === 1 ? 1 : 0) as Side;
      setSetup((s) => ({
        ...s,
        mode: 'online',
        teamMode: false,
        fighters: undefined,
        mySlot: undefined,
        p1: data.fighters[0].char,
        p2: data.fighters[1].char,
        stage: data.stage,
        seed: data.seed,
        onlineMatchId: data.matchId,
        netInputDelay: data.inputDelay,
        onlineSide: mySide,
        onlineNames: data.fighters.map((f) => f.name ?? null),
      }));
    } else {
      // チーム戦：全ファイター設定＋自分のスロット
      const fighters: FighterSetup[] = data.fighters.map((f, i) => ({
        char: f.char,
        team: f.team,
        ai: f.sessionId === null,
        aiDifficulty: f.aiDifficulty,
        // オンラインの人間枠はプレイヤー名をタグに使う（未設定なら従来表示）
        tag: f.sessionId === null ? 'CPU' : f.name || (i === mySlot ? 'あなた' : 'NET'),
        you: i === mySlot,
      }));
      const rep0 = fighters.find((f) => f.team === 0)?.char ?? 'mie';
      const rep1 = fighters.find((f) => f.team === 1)?.char ?? 'ryoma';
      setSetup((s) => ({
        ...s,
        mode: 'online',
        teamMode: true,
        fighters,
        mySlot,
        p1: rep0,
        p2: rep1,
        stage: data.stage,
        seed: data.seed,
        onlineMatchId: data.matchId,
        netInputDelay: data.inputDelay,
        onlineSide: (fighters[mySlot]?.team ?? 0) as Side,
        onlineNames: data.fighters.map((f) => f.name ?? null),
      }));
    }
    setScreen('versus');
  }, []);

  const chosen = useCallback((p1: CharId, p2: CharId) => {
    setSetup((s) => ({
      ...s,
      p1,
      p2,
      stage: randomStage(),
      teamMode: false,
      fighters: undefined,
      mySlot: undefined,
      onlineMatchId: undefined,
      netInputDelay: undefined,
    }));
    setScreen('versus');
  }, []);

  const teamChosen = useCallback((fighters: FighterSetup[]) => {
    const rep0 = fighters.find((f) => f.team === 0)?.char ?? 'mie';
    const rep1 = fighters.find((f) => f.team === 1)?.char ?? 'ryoma';
    setSetup((s) => ({
      ...s,
      mode: 'team',
      teamMode: true,
      fighters,
      mySlot: undefined,
      p1: rep0,
      p2: rep1,
      stage: randomStage(),
      onlineMatchId: undefined,
      netInputDelay: undefined,
    }));
    setScreen('versus');
  }, []);

  const toBattle = useCallback(() => {
    setBattleKey((k) => k + 1);
    setScreen('battle');
  }, []);

  const onEnd = useCallback((winner: Side, wins: [number, number]) => {
    setResult({ winner, wins });
    setScreen('result');
  }, []);

  const rematch = useCallback(() => {
    if (setup.mode === 'online') {
      // オンラインは同じ部屋のロビーに戻って再戦（シードはサーバーが再発行）
      setScreen(net.connected ? 'online' : 'title');
      return;
    }
    setSetup((s) => ({ ...s, stage: randomStage(), onlineMatchId: undefined, netInputDelay: undefined }));
    setBattleKey((k) => k + 1);
    setScreen('versus');
  }, [setup.mode]);

  const tryUnlock = useCallback(() => {
    if (result && result.winner === 0 && setup.mode === '1p' && setup.difficulty === 'hard' && !extremeUnlocked) {
      saveUnlocked();
      setExtremeUnlocked(true);
      setJustUnlocked(true);
      return true;
    }
    return false;
  }, [result, setup, extremeUnlocked]);

  const handleResultToTitle = useCallback(() => {
    tryUnlock();
    if (setup.mode === 'online') net.leave();
    setScreen('title');
  }, [tryUnlock, setup.mode]);

  const handleResultToSelect = useCallback(() => {
    if (setup.mode === 'online') {
      setScreen(net.connected ? 'online' : 'title');
      return;
    }
    if (setup.mode === 'team') {
      setScreen('teamsetup');
      return;
    }
    if (tryUnlock()) {
      setScreen('title');
      return;
    }
    setScreen('select');
  }, [tryUnlock, setup.mode]);

  return (
    <div className="min-h-screen w-full bg-[#05050c] text-slate-100">
      {screen === 'loading' && <LoadingScreen progress={loadProgress} />}
      {screen === 'title' && (
        <TitleScreen
          onStart={start}
          extremeUnlocked={extremeUnlocked}
          justUnlocked={justUnlocked}
          onUnlockSeen={() => setJustUnlocked(false)}
        />
      )}
      {screen === 'select' && (
        <CharacterSelect mode={setup.mode} difficulty={setup.difficulty} onDone={chosen} onBack={() => setScreen('title')} />
      )}
      {screen === 'teamsetup' && <TeamSetup defaultDifficulty={setup.difficulty} onDone={teamChosen} onBack={() => setScreen('title')} />}
      {screen === 'online' && <OnlineLobby onStart={onlineStart} onBack={() => setScreen('title')} />}
      {screen === 'versus' && <VersusScreen setup={setup} onDone={toBattle} />}
      {screen === 'battle' && (
        <BattleScreen
          key={battleKey}
          setup={setup}
          onEnd={onEnd}
          onQuit={(to) => setScreen(to === 'select' && setup.mode === 'team' ? 'teamsetup' : to)}
        />
      )}
      {screen === 'result' && result && (
        <ResultScreen
          setup={setup}
          result={result}
          onRematch={rematch}
          onSelect={handleResultToSelect}
          onTitle={handleResultToTitle}
          willUnlockExtreme={result.winner === 0 && setup.mode === '1p' && setup.difficulty === 'hard' && !extremeUnlocked}
        />
      )}
      {screen !== 'loading' && (
        <button
          className="fixed right-2 top-2 z-50 border-2 border-slate-600 bg-black/60 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
          onClick={() => {
            audio.init();
            setMuted(audio.toggleMute());
          }}
          title="M キーでも切替"
        >
          {muted ? '🔇 MUTE' : '🔊 SOUND'}
        </button>
      )}
    </div>
  );
}
