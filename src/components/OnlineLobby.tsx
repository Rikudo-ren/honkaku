import { useEffect, useRef, useState } from 'react';
import { CHARS, DIFFICULTY_SHORT } from '@/game/characters';
import { Portrait } from '@/components/Portrait';
import { audio } from '@/game/audio';
import { DEFAULT_NAME, MAX_NAME, net, sanitizeName, type LobbyAi, type LobbyInfo, type StartData } from '@/game/net';
import type { CharId, Difficulty, Team } from '@/game/types';
import { MAX_FIGHTERS, TEAM_COLORS, TEAM_NAMES } from '@/game/types';

interface Props {
  /** 解放済みキャラのID一覧（隠しキャラは含まれない） */
  unlocked: CharId[];
  onStart: (data: StartData) => void;
  onBack: () => void;
}

type Stage = 'menu' | 'code-input' | 'connecting' | 'lobby' | 'error';

const DIFFS: Difficulty[] = ['easy', 'normal', 'hard', 'extreme'];

export default function OnlineLobby({ unlocked, onStart, onBack }: Props) {
  // 選べるのは解放済みキャラだけ（隠しキャラは条件を満たすと選べるようになる）
  const LIST: CharId[] = unlocked.length ? unlocked : ['mie'];
  // 再戦時：既に部屋に入っているならロビー画面から始める
  const [stage, setStage] = useState<Stage>(net.connected ? 'lobby' : 'menu');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [lobby, setLobby] = useState<LobbyInfo | null>(net.lobby);
  const [sel, setSel] = useState<CharId>('mie');
  const [name, setName] = useState(net.name);
  const [ready, setReady] = useState(false);
  const [ping, setPing] = useState(net.latency);
  const startedRef = useRef(false);

  useEffect(() => {
    const offLobby = net.on('lobby', (d) => setLobby(d as LobbyInfo));
    const offStart = net.on('start', (d) => {
      if (startedRef.current) return;
      startedRef.current = true;
      audio.sfx('confirm');
      onStart(d as StartData);
    });
    const offErr = net.on('error', (m) => {
      setError(String(m ?? '通信エラー'));
      setStage('error');
    });
    const offDisconnect = net.on('disconnected', (m) => {
      setError(String(m));
      setStage('error');
    });
    const offLeft = net.on('opponent-left', () => {
      setReady(false);
    });
    const offPing = net.on('ping', (p) => setPing(p as number));
    // 再戦でロビーへ戻ってきた場合は最新のロビー情報を要求
    if (net.connected) {
      net.refreshLobby();
      // 再戦後は ready 状態をリセット
      setReady(false);
    }
    return () => {
      offLobby();
      offStart();
      offErr();
      offDisconnect();
      offLeft();
      offPing();
    };
  }, [onStart]);

  const connect = async (fn: () => Promise<void>) => {
    setStage('connecting');
    setError('');
    try {
      await fn();
      setStage('lobby');
      audio.sfx('confirm');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /not found|no rooms/i.test(msg)
          ? 'その合言葉の部屋が見つかりません。'
          : /locked|full/i.test(msg)
            ? 'その部屋は満員です。'
            : `接続できませんでした：${msg}`
      );
      setStage('error');
      audio.sfx('back');
    }
  };

  const pickChara = (id: CharId) => {
    if (ready) return;
    if (!LIST.includes(id)) {
      audio.sfx('back');
      return;
    }
    setSel(id);
    net.setChara(id);
    audio.sfx('move');
  };

  const toggleReady = () => {
    const next = !ready;
    setReady(next);
    net.setChara(sel);
    net.setReady(next);
    audio.sfx(next ? 'confirm' : 'back');
  };

  /** 名前を保存（ブラウザに記憶＋入室中ならサーバーにも通知） */
  const changeName = (raw: string) => {
    setName(net.setName(raw));
  };

  const leave = () => {
    net.leave();
    setLobby(null);
    setReady(false);
    setStage('menu');
    audio.sfx('back');
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#0b0b18] px-4 py-6 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fde68a 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="scanlines pointer-events-none absolute inset-0" />

      <div className="relative z-10 w-full max-w-4xl">
        <header className="flex items-center justify-between">
          <button
            className="border-2 border-slate-500 px-2 py-1 text-xs hover:bg-slate-800"
            onClick={() => {
              net.leave();
              onBack();
            }}
          >
            ◀ タイトル
          </button>
          <div className="text-center">
            <div className="pixel-text-shadow text-3xl text-amber-300 md:text-4xl">ONLINE ✝ MATCH</div>
            <div className="text-xs text-slate-400">ネットの向こうにも✝本質✝はある</div>
          </div>
          <div className="w-24 text-right text-xs text-slate-500">{ping >= 0 && stage === 'lobby' ? `PING ${ping}ms` : ''}</div>
        </header>

        {stage === 'menu' && (
          <>
            <div className="mx-auto mt-6 w-full max-w-md border-2 border-slate-600 bg-slate-950/90 p-3">
              <div className="flex items-baseline justify-between">
                <label htmlFor="player-name" className="text-xs text-slate-300">
                  あなたの名前（相手の画面にも表示されます）
                </label>
                <span className="text-[10px] text-slate-500">
                  {name.length}/{MAX_NAME}
                </span>
              </div>
              <input
                id="player-name"
                value={name}
                onChange={(e) => changeName(e.target.value)}
                onBlur={(e) => changeName(sanitizeName(e.target.value))}
                maxLength={MAX_NAME}
                placeholder={DEFAULT_NAME}
                className="mt-1 w-full border-2 border-slate-500 bg-black px-3 py-1.5 text-center text-lg tracking-wide text-amber-200 outline-none focus:border-amber-300"
              />
              <div className="mt-1 text-[10px] text-slate-500">ブラウザに保存されるので、次回からは自動で入ります</div>
            </div>

            <div className="mx-auto mt-4 flex w-full max-w-md flex-col gap-3">
              <button
                className="border-4 border-amber-300 bg-slate-950/90 p-4 text-left shadow-[6px_6px_0_#000] hover:bg-slate-900"
                onClick={() => connect(() => net.quickMatch())}
              >
                <div className="text-xl text-amber-200">クイックマッチ（1対1）</div>
                <div className="mt-1 text-xs text-slate-400">世界のどこかの✝本質✝と自動マッチング</div>
              </button>
              <button
                className="border-4 border-sky-400 bg-slate-950/90 p-4 text-left shadow-[6px_6px_0_#000] hover:bg-slate-900"
                onClick={() => connect(() => net.createPrivate())}
              >
                <div className="text-xl text-sky-200">部屋を作る（チーム戦OK）</div>
                <div className="mt-1 text-xs text-slate-400">最大{MAX_FIGHTERS}人まで入室可・2対2も3対1も自由・AI追加可・合言葉発行</div>
              </button>
              <button
                className="border-4 border-emerald-400 bg-slate-950/90 p-4 text-left shadow-[6px_6px_0_#000] hover:bg-slate-900"
                onClick={() => {
                  setStage('code-input');
                  audio.sfx('confirm');
                }}
              >
                <div className="text-xl text-emerald-200">合言葉で入る</div>
                <div className="mt-1 text-xs text-slate-400">友達に教えてもらった合言葉を入力</div>
              </button>
            </div>
          </>
        )}

        {stage === 'code-input' && (
          <div className="mx-auto mt-8 w-full max-w-md border-4 border-emerald-400 bg-slate-950/90 p-5 shadow-[6px_6px_0_#000]">
            <div className="text-lg text-emerald-200">合言葉を入力</div>
            <input
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && code.trim()) connect(() => net.joinByCode(code));
                if (e.key === 'Escape') setStage('menu');
              }}
              maxLength={8}
              placeholder="例：AB3CD"
              className="mt-3 w-full border-2 border-slate-500 bg-black px-3 py-2 text-center text-2xl tracking-[0.4em] text-amber-200 outline-none focus:border-amber-300"
            />
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 border-2 border-emerald-400 bg-emerald-400 py-2 text-slate-950 hover:bg-emerald-300 disabled:opacity-40"
                disabled={!code.trim()}
                onClick={() => connect(() => net.joinByCode(code))}
              >
                入室
              </button>
              <button className="flex-1 border-2 border-slate-500 py-2 hover:bg-slate-800" onClick={() => setStage('menu')}>
                戻る
              </button>
            </div>
          </div>
        )}

        {stage === 'connecting' && (
          <div className="mt-16 text-center">
            <div className="pixel-text-shadow animate-blink text-2xl text-amber-200">接続中…</div>
            <div className="mt-2 text-xs text-slate-400">✝本質✝サーバーに問い合わせています</div>
          </div>
        )}

        {stage === 'error' && (
          <div className="mx-auto mt-8 w-full max-w-md border-4 border-rose-400 bg-slate-950/90 p-5 text-center shadow-[6px_6px_0_#000]">
            <div className="text-lg text-rose-300">接続エラー</div>
            <div className="mt-2 break-all text-xs text-slate-300">{error}</div>
            <div className="mt-1 text-[10px] text-slate-500">サーバーが起動しているか・VITE_COLYSEUS_URL の設定を確認してください</div>
            <button className="mt-4 w-full border-2 border-amber-300 bg-amber-300 py-2 text-slate-950 hover:bg-amber-200" onClick={() => setStage('menu')}>
              戻る
            </button>
          </div>
        )}

        {stage === 'lobby' && lobby && !lobby.teamMode && (
          <QuickLobbyView lobby={lobby} sel={sel} ready={ready} pickChara={pickChara} toggleReady={toggleReady} leave={leave} chars={LIST} />
        )}

        {stage === 'lobby' && lobby && lobby.teamMode && (
          <TeamLobbyView lobby={lobby} sel={sel} ready={ready} pickChara={pickChara} toggleReady={toggleReady} leave={leave} chars={LIST} />
        )}
      </div>
    </div>
  );
}

/* ───────────────── 1対1クイック用ロビー ───────────────── */

function QuickLobbyView({
  lobby,
  sel,
  ready,
  pickChara,
  toggleReady,
  leave,
  chars,
}: {
  lobby: LobbyInfo;
  sel: CharId;
  ready: boolean;
  pickChara: (id: CharId) => void;
  toggleReady: () => void;
  leave: () => void;
  chars: CharId[];
}) {
  const me = lobby.players.find((p) => p.id === net.sessionId);
  const opp = lobby.players.find((p) => p.id !== net.sessionId);
  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-4">
        {/* 自分 */}
        <div className={`border-4 p-3 ${ready ? 'border-amber-300 bg-amber-950/30' : 'border-sky-400 bg-slate-950/80'}`}>
          <div className="truncate text-sm text-amber-100">{me?.name || net.name || DEFAULT_NAME}</div>
          <div className="text-xs text-sky-300">あなた（{me?.team === 1 ? '2P側' : '1P側'}）</div>
          <div className="mt-1 text-lg" style={{ color: CHARS[sel].color }}>
            {CHARS[sel].name}
          </div>
          <div className="text-[10px] text-slate-400">{CHARS[sel].title}</div>
          <div className="mt-2 grid grid-cols-3 gap-1">
            {chars.map((id) => (
              <button
                key={id}
                onClick={() => pickChara(id)}
                disabled={ready}
                className={`relative aspect-[3/4] overflow-hidden border-2 transition-transform ${sel === id ? 'scale-105 border-amber-300' : 'border-slate-600 opacity-70 hover:opacity-100'} disabled:cursor-not-allowed`}
                style={{ background: `linear-gradient(160deg,#fff, ${CHARS[id].light})` }}
              >
                <Portrait id={id} alt={CHARS[id].name} className="h-full w-full object-contain object-bottom" />
              </button>
            ))}
          </div>
          <button
            className={`mt-3 w-full border-2 py-2 text-sm ${ready ? 'border-slate-500 text-slate-300 hover:bg-slate-800' : 'border-amber-300 bg-amber-300 text-slate-950 hover:bg-amber-200'}`}
            onClick={toggleReady}
          >
            {ready ? '準備解除' : '準備完了 ✝'}
          </button>
        </div>

        {/* 相手 */}
        <div className="border-4 border-rose-400/70 bg-slate-950/80 p-3">
          <div className="truncate text-sm text-amber-100">{opp?.name || '──'}</div>
          <div className="text-xs text-rose-300">相手</div>
          {opp ? (
            <>
              <div className="mt-1 text-lg" style={{ color: opp.char ? CHARS[opp.char].color : undefined }}>
                {opp.char ? CHARS[opp.char].name : '選択中…'}
              </div>
              <div className="text-[10px] text-slate-400">{opp.char ? CHARS[opp.char].title : ''}</div>
              {opp.char && (
                <div className="mx-auto mt-2 aspect-[3/4] w-2/3 overflow-hidden border-2 border-slate-600" style={{ background: `linear-gradient(160deg,#fff, ${CHARS[opp.char].light})` }}>
                  <Portrait id={opp.char} alt={CHARS[opp.char].name} className="h-full w-full object-contain object-bottom" />
                </div>
              )}
              <div className={`mt-3 border-2 py-2 text-center text-sm ${opp.ready ? 'border-amber-300 text-amber-200' : 'border-slate-600 text-slate-500'}`}>
                {opp.ready ? '準備完了 ✝' : '準備中…'}
              </div>
            </>
          ) : (
            <div className="flex h-4/5 flex-col items-center justify-center text-center">
              <div className="animate-blink text-slate-400">対戦相手を待っています…</div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {me?.ready && opp?.ready ? '両者準備完了 ── まもなく試合開始…' : '両者が準備完了すると自動で試合が始まります'}
        </div>
        <button className="border-2 border-slate-500 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800" onClick={leave}>
          退室する
        </button>
      </div>
    </div>
  );
}

/* ───────────────── チーム戦ルーム用ロビー ───────────────── */

function TeamLobbyView({
  lobby,
  sel,
  ready,
  pickChara,
  toggleReady,
  leave,
  chars,
}: {
  lobby: LobbyInfo;
  sel: CharId;
  ready: boolean;
  pickChara: (id: CharId) => void;
  toggleReady: () => void;
  leave: () => void;
  chars: CharId[];
}) {
  const myId = net.sessionId;
  const isHost = lobby.players.find((p) => p.id === myId)?.host ?? false;
  const total = lobby.players.length + lobby.ai.length;
  const full = total >= MAX_FIGHTERS;

  const teamOf = (t: Team) => ({
    humans: lobby.players.filter((p) => p.team === t),
    ai: lobby.ai.map((a, i) => ({ ...a, index: i })).filter((a) => a.team === t),
  });

  const canStart = (() => {
    if (!isHost) return false;
    if (total < 2) return false;
    if (!lobby.players.every((p) => p.char)) return false;
    if (!lobby.players.filter((p) => !p.host).every((p) => p.ready)) return false;
    const teams = new Set<number>();
    lobby.players.forEach((p) => teams.add(p.team));
    lobby.ai.forEach((a) => teams.add(a.team));
    return teams.size >= 2;
  })();

  const startHint = (() => {
    if (total < 2) return '対戦には合計2人以上が必要です（AI追加可）';
    if (!lobby.players.every((p) => p.char)) return 'キャラ未選択のプレイヤーがいます';
    const notReady = lobby.players.filter((p) => !p.host && !p.ready).length;
    if (notReady > 0) return `あと${notReady}人の準備待ち…`;
    const teams = new Set<number>();
    lobby.players.forEach((p) => teams.add(p.team));
    lobby.ai.forEach((a) => teams.add(a.team));
    if (teams.size < 2) return '両チームに1人以上配置してください（ホストがチーム変更可）';
    return '開始できます ✝';
  })();

  const addAi = (team: Team) => {
    if (full) return;
    const ai: LobbyAi = { team, char: chars[Math.floor(Math.random() * chars.length)], difficulty: 'normal' };
    net.addAi(ai);
    audio.sfx('confirm');
  };

  return (
    <div className="mt-4">
      {/* 合言葉 */}
      <div className="mx-auto mb-3 w-fit border-2 border-sky-400 bg-black/70 px-4 py-1.5 text-center">
        <div className="text-[10px] tracking-widest text-sky-300">あいことば（友達に伝える）</div>
        <div className="flex items-center gap-3">
          <span className="pixel-text-shadow text-3xl tracking-[0.3em] text-amber-200">{lobby.code}</span>
          <button
            className="border border-slate-500 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
            onClick={() => {
              navigator.clipboard?.writeText(lobby.code).catch(() => undefined);
              audio.sfx('confirm');
            }}
          >
            コピー
          </button>
        </div>
      </div>
      <div className="text-center text-xs text-slate-400">
        {isHost ? 'あなたはホスト（部屋主）です：チーム分け・AI追加・開始を操作できます' : 'チーム分けはホスト（部屋主）が行います'} ／ {total}/{MAX_FIGHTERS}人
      </div>

      {/* 自分のキャラ選択 */}
      <div className={`mx-auto mt-3 w-full max-w-2xl border-2 p-2 ${ready ? 'border-amber-300 bg-amber-950/20' : 'border-slate-600 bg-slate-950/80'}`}>
        <div className="flex items-center justify-between px-1">
          <div className="text-xs text-sky-300">
            あなたのキャラ：<span style={{ color: CHARS[sel].color }}>{CHARS[sel].name}</span>
            <span className="ml-2 text-slate-400">{CHARS[sel].title}</span>
          </div>
          {!isHost && (
            <button
              className={`border-2 px-4 py-1 text-xs ${ready ? 'border-slate-500 text-slate-300 hover:bg-slate-800' : 'border-amber-300 bg-amber-300 text-slate-950 hover:bg-amber-200'}`}
              onClick={toggleReady}
            >
              {ready ? '準備解除' : '準備完了 ✝'}
            </button>
          )}
          {isHost && <div className="text-[10px] text-slate-500">ホストは準備ボタン不要（開始ボタンで開戦）</div>}
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1">
          {chars.map((id) => (
            <button
              key={id}
              onClick={() => pickChara(id)}
              disabled={ready}
              title={CHARS[id].name}
              className={`relative aspect-[3/4] overflow-hidden border-2 transition-transform ${sel === id ? 'scale-105 border-amber-300' : 'border-slate-600 opacity-70 hover:opacity-100'} disabled:cursor-not-allowed`}
              style={{ background: `linear-gradient(160deg,#fff, ${CHARS[id].light})` }}
            >
              <Portrait id={id} alt={CHARS[id].name} className="h-full w-full object-contain object-bottom" />
            </button>
          ))}
        </div>
        {isHost && (
          <div className="mt-1 px-1 text-[10px] text-slate-500">※ホストのキャラは選択した時点で確定（部屋にいる全員に見えています）</div>
        )}
      </div>

      {/* チーム表 */}
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {([0, 1] as Team[]).map((t) => {
          const { humans, ai } = teamOf(t);
          return (
            <div key={t} className="border-4 bg-slate-950/80 p-2" style={{ borderColor: TEAM_COLORS[t] }}>
              <div className="flex items-center justify-between px-1">
                <div className="text-sm font-bold" style={{ color: TEAM_COLORS[t] }}>
                  {TEAM_NAMES[t]}（{humans.length + ai.length}人）
                </div>
                {isHost && (
                  <button
                    disabled={full}
                    onClick={() => addAi(t)}
                    className="border border-slate-500 px-2 py-0.5 text-[10px] text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                  >
                    ＋AI追加
                  </button>
                )}
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {humans.map((p) => {
                  const isMe = p.id === myId;
                  return (
                    <div key={p.id} className="flex items-center gap-2 border border-slate-700 bg-black/50 p-1">
                      <div className="h-10 w-8 shrink-0 overflow-hidden border border-slate-600" style={{ background: p.char ? `linear-gradient(160deg,#fff, ${CHARS[p.char].light})` : '#111' }}>
                        {p.char && <Portrait id={p.char} alt="" className="h-full w-full object-contain object-bottom" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs text-amber-100">
                          {p.name || DEFAULT_NAME}
                          {p.host && <span className="ml-1 text-amber-300">👑</span>}
                          {isMe && <span className="ml-1 text-sky-300">（あなた）</span>}
                        </div>
                        <div className="truncate text-[10px]" style={{ color: p.char ? CHARS[p.char].color : '#64748b' }}>
                          {p.char ? CHARS[p.char].name : '選択中…'} ／ {p.ready || p.host ? (p.host ? 'ホスト' : '準備OK ✝') : '準備中…'}
                        </div>
                      </div>
                      {isHost && (
                        <button
                          onClick={() => {
                            net.setTeam(p.id, t === 0 ? 1 : 0);
                            audio.sfx('move');
                          }}
                          title="反対チームへ移動"
                          className="border border-slate-500 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                        >
                          {t === 0 ? '赤へ▶' : '◀青へ'}
                        </button>
                      )}
                    </div>
                  );
                })}
                {ai.map((a) => (
                  <div key={`ai-${a.index}`} className="flex items-center gap-2 border border-dashed border-slate-600 bg-black/30 p-1">
                    <div className="h-10 w-8 shrink-0 overflow-hidden border border-slate-600" style={{ background: `linear-gradient(160deg,#fff, ${CHARS[a.char].light})` }}>
                      <Portrait id={a.char} alt="" className="h-full w-full object-contain object-bottom" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs text-slate-200">
                        {CHARS[a.char].name} <span className="text-slate-500">🤖CPU</span>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        強さ：<span className={a.difficulty === 'extreme' ? 'text-fuchsia-300' : a.difficulty === 'hard' ? 'text-rose-300' : 'text-amber-200'}>{DIFFICULTY_SHORT[a.difficulty]}</span>
                      </div>
                    </div>
                    {isHost && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => {
                            const i = chars.indexOf(a.char);
                            net.updateAi(a.index, { char: chars[(i + 1) % chars.length] });
                            audio.sfx('move');
                          }}
                          title="キャラ変更"
                          className="border border-slate-500 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                        >
                          変更
                        </button>
                        <button
                          onClick={() => {
                            const i = DIFFS.indexOf(a.difficulty);
                            net.updateAi(a.index, { difficulty: DIFFS[(i + 1) % DIFFS.length] });
                            audio.sfx('move');
                          }}
                          title="強さ変更"
                          className="border border-slate-500 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                        >
                          強さ
                        </button>
                        <button
                          onClick={() => {
                            net.updateAi(a.index, { team: t === 0 ? 1 : 0 });
                            audio.sfx('move');
                          }}
                          title="反対チームへ移動"
                          className="border border-slate-500 px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                        >
                          {t === 0 ? '赤へ▶' : '◀青へ'}
                        </button>
                        <button
                          onClick={() => {
                            net.removeAi(a.index);
                            audio.sfx('back');
                          }}
                          title="削除"
                          className="border border-rose-500 px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-950"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {humans.length + ai.length === 0 && <div className="p-2 text-center text-xs text-slate-600">── 空き ──</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* 開始／退室 */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs text-slate-500">{isHost ? startHint : ready ? 'ホストの開始を待っています…' : 'キャラを選んで「準備完了」を押してください'}</div>
        <div className="flex gap-2">
          <button className="border-2 border-slate-500 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800" onClick={leave}>
            退室する
          </button>
          {isHost && (
            <button
              disabled={!canStart}
              onClick={() => {
                net.setChara(sel);
                net.startGame();
                audio.sfx('confirm');
              }}
              className="border-2 border-amber-300 bg-amber-300 px-6 py-1.5 text-sm font-bold text-slate-950 hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              試合開始 ✝
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
