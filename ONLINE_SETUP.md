# ✝本質✝ FIGHTERS ── オンライン対戦セットアップ手順

オンライン対戦は **Colyseus** で実装されています。

- **クライアント（このリポジトリのルート）** … Vercel にそのままデプロイ（今まで通り）
- **サーバー（`server/` ディレクトリ）** … Colyseus サーバー。**Vercel では動きません**（WebSocket 常駐サーバーが必要）。別途ホスティングが必要です。

## 仕組み（概要）

- 方式は「ディレイ方式ロックステップ」。サーバーは**マッチメイキング＋入力のリレーだけ**を行い、ゲームロジックは全プレイヤーのブラウザが**同じシードで決定論的に**実行します。
- そのため通信量は毎フレーム数バイトで、サーバーは激安インスタンスで十分です。
- モードは「クイックマッチ（1対1）」「部屋を作る（合言葉発行・チーム戦OK）」「合言葉で入る」の3つ。
- チーム戦は**同時乱戦**（全員が同じ画面で戦う、最大8人）。部屋主（ホスト）がチーム分け・AI追加（キャラと強さ指定可）・試合開始を操作します。2対2はもちろん、3対1や5人以上も自由に編成できます。

---

## こっちで（あなたが）やる操作 一覧

### 1. ローカルで動作確認する

```bash
# ターミナル1：Colyseusサーバー
cd server
npm install
npm run dev        # → ws://localhost:2567 で起動

# ターミナル2：ゲーム本体
npm install
npm run dev        # → http://localhost:5173
```

ブラウザのタブを2つ開いて、両方で「オンライン対戦 ✝」→ 片方「部屋を作る」→ もう片方「合言葉で入る」で対戦できます。
（`VITE_COLYSEUS_URL` 未設定のときは自動で `ws://localhost:2567` に繋がります）

### 2. サーバーを本番ホスティングする

いずれか1つでOK。

#### 案A：Colyseus Cloud（公式・一番簡単）

1. https://cloud.colyseus.io/ でアカウント作成
2. ダッシュボードで「New Application」を作成
3. このリポジトリの `server/` ディレクトリからデプロイ：

```bash
cd server
npm install @colyseus/cloud --save-dev
npx @colyseus/cloud deploy
# 初回はブラウザが開いて認証 → アプリを選択 → デプロイされる
# server/.colyseus-cloud.json が生成される（gitignore済み）
```

4. デプロイ完了後に表示される URL（例 `https://xxxx.colyseus.cloud`）を控える
   → クライアントに設定するのは `wss://xxxx.colyseus.cloud`

以後の更新も `npx @colyseus/cloud deploy` を打つだけ。GitHub連携（push で自動デプロイ）もダッシュボードの Settings → Build & Deployment から設定できます。

#### 案B：Render（無料枠あり）

1. https://render.com/ → New → Web Service → このGitHubリポジトリを接続
2. 設定：
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. デプロイ後の URL が `https://honkaku-server.onrender.com` なら、クライアントには `wss://honkaku-server.onrender.com` を設定

※無料プランは15分アクセスがないとスリープし、起動に数十秒かかります。対戦ゲームには有料プラン（月$7〜）推奨。

#### 案C：Railway / fly.io / VPS

- Root を `server/` にして `npm install && npm run build` → `npm start` が動けばどこでもOK
- `PORT` 環境変数は自動で読みます（デフォルト2567）
- 必ず **HTTPS/WSS対応**（Vercel が https なので、ws:// は混在コンテンツでブロックされます）

### 3. Vercel に接続先を設定する

1. Vercel ダッシュボード → プロジェクト（honkaku-online）→ **Settings → Environment Variables**
2. 追加：
   - **Name**: `VITE_COLYSEUS_URL`
   - **Value**: `wss://＜手順2で取得したサーバーURL＞`（`wss://` で始めること！）
   - Environment: Production（PreviewもあればPreviewにも）
3. **Redeploy**（Vite の env はビルド時埋め込みなので再デプロイ必須）

これで https://honkaku-online.vercel.app/ のタイトル画面に「オンライン対戦 ✝」が出て、世界中の誰とでも対戦できます。

---

## 運用でよく使う操作

| やりたいこと | 操作 |
| --- | --- |
| サーバー更新（Colyseus Cloud） | `cd server && npx @colyseus/cloud deploy` |
| サーバーの動作確認 | `https://＜サーバーURL＞/hello` を開いて `{"ok":true,...}` が返ればOK |
| 接続状況モニター（開発時） | `http://localhost:2567/monitor` （本番では無効化済み） |
| 接続先の切り替え | Vercel の `VITE_COLYSEUS_URL` を変更 → Redeploy |

## トラブルシューティング

- **「接続できませんでした」** … サーバーが起動しているか、URL が `wss://`（本番）か確認。Render 無料枠はスリープ復帰に時間がかかる
- **「その合言葉の部屋が見つかりません」** … 合言葉の打ち間違い、または部屋主が退室済み
- **「⚠ 同期ずれを検出」が出る** … まれにブラウザ差で発生する可能性あり。再戦すれば直ります（発生報告があれば調査します）
- **ラグい** … 方式上、表示遅延は約4フレーム＋片道通信時間。サーバーは対戦する2人から近いリージョンに置くのが吉（Colyseus Cloud はリージョン選択可）

## 技術メモ（コードを触る人向け）

- `server/src/rooms/BattleRoom.ts` … 対戦ルーム（マッチング・入力リレー・シード発行）。公開部屋=1対1クイック、私室=チーム戦（ホスト制・AI枠あり）
- `src/game/net.ts` … クライアントのネットワーク層（colyseus.js）。入力は `[frame, slot, mask]` で全員へリレー
- `src/components/OnlineLobby.tsx` … オンラインロビーUI（クイック用＋チーム戦用）
- `src/components/TeamSetup.tsx` … オフライン・チーム戦の編成画面
- `src/components/BattleScreen.tsx` … `mode === 'online'` のときロックステップ実行（人間スロット全員分の入力を収集）
- `src/game/engine.ts` … `Math.random` を全廃してシード付き乱数（mulberry32）化。`stateHash()` で同期検証。N人同時乱戦対応（敵=別チーム、味方への攻撃は無効、AIは最寄りの敵を狙う）
