import { useCallback, useEffect, useRef, useState } from 'react';
import LoadingScreen from '@/components/LoadingScreen';
import TitleScreen from '@/components/TitleScreen';
import CharacterSelect from '@/components/CharacterSelect';
import VersusScreen from '@/components/VersusScreen';
import BattleScreen from '@/components/BattleScreen';
import ResultScreen from '@/components/ResultScreen';
import { preloadPortraits } from '@/components/Portrait';
import { STAGES } from '@/game/characters';
import { audio } from '@/game/audio';
import type { CharId, Difficulty, Mode, Setup, Side, StageId } from '@/game/types';

type Screen = 'loading' | 'title' | 'select' | 'versus' | 'battle' | 'result';

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
    setSetup((s) => ({ ...s, mode, difficulty }));
    setScreen('select');
  }, []);

  const chosen = useCallback((p1: CharId, p2: CharId) => {
    setSetup((s) => ({ ...s, p1, p2, stage: randomStage() }));
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
    setSetup((s) => ({ ...s, stage: randomStage() }));
    setBattleKey((k) => k + 1);
    setScreen('versus');
  }, []);

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
    setScreen('title');
  }, [tryUnlock]);

  const handleResultToSelect = useCallback(() => {
    if (tryUnlock()) {
      setScreen('title');
      return;
    }
    setScreen('select');
  }, [tryUnlock]);

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
      {screen === 'versus' && <VersusScreen setup={setup} onDone={toBattle} />}
      {screen === 'battle' && <BattleScreen key={battleKey} setup={setup} onEnd={onEnd} onQuit={(to) => setScreen(to)} />}
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
