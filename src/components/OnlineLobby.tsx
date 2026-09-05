import { useEffect, useRef, useState } from 'react';
import { CHARS, CHAR_ORDER } from '@/game/characters';
import { Portrait } from '@/components/Portrait';
import { audio } from '@/game/audio';
import { net, type LobbyInfo, type StartData } from '@/game/net';
import type { CharId, Side } from '@/game/types';

interface Props {
  onStart: (data: StartData, mySide: Side) => void;
  onBack: () => void;
}

type Stage = 'menu' | 'code-input' | 'connecting' | 'lobby' | 'error';

export default function OnlineLobby({ onStart, onBack }: Props) {
  // 再戦時：既に部屋に入っているならロビー画面から始める
  const [stage, setStage] = useState<Stage>(net.connected ? 'lobby' : 'menu');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [lobby, setLobby] = useState<LobbyInfo | null>(net.lobby);
  const [sel, setSel] = useState<CharId>('mie');
  const [ready, setReady] = useState(false);
  const [ping, setPing] = useState(net.latency);
  const startedRef = useRef(false);

  useEffect(() => {
    const offLobby = net.on('lobby', (d) => setLobby(d as LobbyInfo));
    const offStart = net.on('start', (d) => {
      if (startedRef.current) return;
      startedRef.current = true;
      audio.sfx('confirm');
      onStart(d as StartData, net.side);
    });
    const offErr = net.on('error', (m) => {
      setError(String(m ?? '通信エラー'));
      setStage('error');
    });
    const offLeft = net.on('opponent-left', () => {
      setReady(false);
    });
    const offPing = net.on('ping', (p) => setPing(p as number));
    // 再戦でロビーへ戻ってきた場合は最新のロビー情報を要求
    if (net.connected) net.refreshLobby();
    return () => {
      offLobby();
      offStart();
      offErr();
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

  const leave = () => {
    net.leave();
    setLobby(null);
    setReady(false);
    setStage('menu');
    audio.sfx('back');
  };

  const me = lobby?.players.find((p) => p.side === net.side);
  const opp = lobby?.players.find((p) => p.side !== net.side);

  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#0b0b18] px-4 py-6 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(#fde68a 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
      <div className="scanlines pointer-events-none absolute inset-0" />

      <div className="relative z-10 w-full max-w-3xl">
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
          <div className="mx-auto mt-8 flex w-full max-w-md flex-col gap-3">
            <button
              className="border-4 border-amber-300 bg-slate-950/90 p-4 text-left shadow-[6px_6px_0_#000] hover:bg-slate-900"
              onClick={() => connect(() => net.quickMatch())}
            >
              <div className="text-xl text-amber-200">クイックマッチ</div>
              <div className="mt-1 text-xs text-slate-400">世界のどこかの✝本質✝と自動マッチング</div>
            </button>
            <button
              className="border-4 border-sky-400 bg-slate-950/90 p-4 text-left shadow-[6px_6px_0_#000] hover:bg-slate-900"
              onClick={() => connect(() => net.createPrivate())}
            >
              <div className="text-xl text-sky-200">部屋を作る（友達対戦）</div>
              <div className="mt-1 text-xs text-slate-400">合言葉が発行されるので友達に伝える</div>
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

        {stage === 'lobby' && (
          <div className="mt-6">
            {lobby?.private && (
              <div className="mx-auto mb-4 w-fit border-2 border-sky-400 bg-black/70 px-4 py-2 text-center">
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
            )}

            <div className="grid grid-cols-2 gap-4">
              {/* 自分 */}
              <div className={`border-4 p-3 ${ready ? 'border-amber-300 bg-amber-950/30' : 'border-sky-400 bg-slate-950/80'}`}>
                <div className="text-xs text-sky-300">あなた（{net.side === 0 ? '1P側' : '2P側'}）</div>
                <div className="mt-1 text-lg" style={{ color: CHARS[sel].color }}>
                  {CHARS[sel].name}
                </div>
                <div className="text-[10px] text-slate-400">{CHARS[sel].title}</div>
                <div className="mt-2 grid grid-cols-3 gap-1">
                  {CHAR_ORDER.map((id) => (
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
                    {lobby?.private && <div className="mt-2 text-[10px] text-slate-500">合言葉を友達に伝えよう</div>}
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
        )}
      </div>
    </div>
  );
}
