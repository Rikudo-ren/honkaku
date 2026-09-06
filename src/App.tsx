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
import { makeOnlineSetup } from '@/game/onlineSetup';
import { EXTREME_UNLOCK_KEY, SAKURA_UNLOCK_KEY, isExtremeUnlockMatch, isSakuraUnlockMatch, loadUnlocked, saveUnlocked } from '@/game/unlock';
import type { CharId, Difficulty, FighterSetup, Mode, Setup, Side, StageId } from '@/game/types';

type Screen = 'loading' | 'title' | 'select' | 'teamsetup' | 'online' | 'versus' | 'battle' | 'result';

const randomStage = (): StageId => STAGES[Math.floor(Math.random() * STAGES.length)].id;

const MIN_LOADING_MS = 500;

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [loadProgress, setLoadProgress] = useState(0);
  const [setup, setSetup] = useState<Setup>({ mode: '1p', difficulty: 'normal', p1: 'mie', p2: 'ryoma', stage: 'classroom' });
  const [result, setResult] = useState<{ winner: Side; wins: [number, number] } | null>(null);
  const [battleKey, setBattleKey] = useState(0);
  const [muted, setMuted] = useState(false);
  const [extremeUnlocked, setExtremeUnlocked] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const [sakuraUnlocked, setSakuraUnlocked] = useState(false);
  const [sakuraJustUnlocked, setSakuraJustUnlocked] = useState(false);
  /** 直前の試合で解禁が発生したか（リザルト画面の予告バナー用） */
  const [unlockedThisMatch, setUnlockedThisMatch] = useState<{ extreme: boolean; sakura: boolean }>({ extreme: false, sakura: false });
  const bgmRef = useRef<'title' | 'battle'>('title');

  useEffect(() => {
    setExtremeUnlocked(loadUnlocked(EXTREME_UNLOCK_KEY));
    setSakuraUnlocked(loadUnlocked(SAKURA_UNLOCK_KEY));
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
    setSetup(makeOnlineSetup(data, net.sessionId));
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

  const onEnd = useCallback(
    (winner: Side, wins: [number, number]) => {
      setResult({ winner, wins });
      // 解禁判定は試合終了の時点で確定して保存する（再戦で負けても解禁が消えないように）。
      // 演出はタイトルに戻ったときに流す。
      const got = { extreme: false, sakura: false };
      if (isExtremeUnlockMatch(setup, winner) && !extremeUnlocked) {
        saveUnlocked(EXTREME_UNLOCK_KEY);
        setExtremeUnlocked(true);
        setJustUnlocked(true);
        got.extreme = true;
      }
      if (isSakuraUnlockMatch(setup, winner) && !sakuraUnlocked) {
        saveUnlocked(SAKURA_UNLOCK_KEY);
        setSakuraUnlocked(true);
        setSakuraJustUnlocked(true);
        got.sakura = true;
      }
      setUnlockedThisMatch(got);
      setScreen('result');
    },
    [setup, extremeUnlocked, sakuraUnlocked]
  );

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

  const handleResultToTitle = useCallback(() => {
    if (setup.mode === 'online') net.leave();
    setScreen('title');
  }, [setup.mode]);

  const handleResultToSelect = useCallback(() => {
    if (setup.mode === 'online') {
      setScreen(net.connected ? 'online' : 'title');
      return;
    }
    if (setup.mode === 'team') {
      setScreen('teamsetup');
      return;
    }
    // 解禁が発生した試合の直後は、演出を見せるためにタイトルへ
    if (unlockedThisMatch.extreme || unlockedThisMatch.sakura) {
      setUnlockedThisMatch({ extreme: false, sakura: false });
      setScreen('title');
      return;
    }
    setScreen('select');
  }, [setup.mode, unlockedThisMatch]);

  return (
    <div className="min-h-screen w-full bg-[#05050c] text-slate-100">
      {screen === 'loading' && <LoadingScreen progress={loadProgress} />}
      {screen === 'title' && (
        <TitleScreen
          onStart={start}
          extremeUnlocked={extremeUnlocked}
          justUnlocked={justUnlocked}
          onUnlockSeen={() => setJustUnlocked(false)}
          sakuraUnlocked={sakuraUnlocked}
          sakuraJustUnlocked={sakuraJustUnlocked}
          onSakuraUnlockSeen={() => setSakuraJustUnlocked(false)}
        />
      )}
      {screen === 'select' && (
        <CharacterSelect mode={setup.mode} difficulty={setup.difficulty} sakuraUnlocked={sakuraUnlocked} onDone={chosen} onBack={() => setScreen('title')} />
      )}
      {screen === 'teamsetup' && (
        <TeamSetup defaultDifficulty={setup.difficulty} sakuraUnlocked={sakuraUnlocked} onDone={teamChosen} onBack={() => setScreen('title')} />
      )}
      {screen === 'online' && <OnlineLobby sakuraUnlocked={sakuraUnlocked} onStart={onlineStart} onBack={() => setScreen('title')} />}
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
          willUnlockExtreme={unlockedThisMatch.extreme}
          willUnlockSakura={unlockedThisMatch.sakura}
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
