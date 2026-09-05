# ✝本質✝ FIGHTERS ── オンライン対戦セットアップ手順

オンライン対戦は **Colyseus** で実装されています。

- **クライアント（このリポジトリのルート）** … Vercel にそのままデプロイ（今まで通り）
- **サーバー（`server/` ディレクトリ）** … Colyseus サーバー。**Vercel では動きません**（WebSocket 常駐サーバーが必要）。別途ホスティングが必要です。

## 仕組み（概要）

- 方式は「ディレイ方式ロックステップ」。サーバーは**マッチメイキング＋入力のリレーだけ**を行い、ゲームロジックは全プレイヤーのブラウザが**同じシードで決定論的に**実行します。
- そのため通信量は毎フレーム数バイトで、サーバーは激安インスタンスで十分です。
- モードは「クイックマッチ（1対1）」「部屋を作る（合言葉発行・チーム戦OK）」「合言葉で入る」の3つ。
- **プレイヤー名**はオンラインのロビー画面で自分で設定できます（ブラウザに保存・最大12文字・未設定は「名無しの本質」・同名なら自動で連番）。ロビーの参加者一覧・VS画面・対戦中のHUD（自分は金色）・リザルトに表示されます。
- チーム戦は**同時乱戦**（全員が同じ画面で戦う、最大8人）。部屋主（ホスト）がチーム分け・AI追加（キャラと強さ指定可）・試合開始を操作します。2対2はもちろん、3対1や5人以上も自由に編成できます。

---

## 既存サーバーに今回の修正を反映する

サーバーのコードを手で書き換える必要はありません。修正PRを取り込み、**最新コードのビルドを伴う再デプロイ**を行います。古いデプロイの単なる再起動では反映されません。

1. **修正PRを `main` にマージ**する。サーバー側の修正は `server/src/rooms/BattleRoom.ts` と、新規の `server/src/rooms/InputRelay.ts` に入っています。
2. **現在使っているホスティング先で、更新後の `main` をデプロイ**する。
   - **Render**：既存の Web Service を開き、Branch が `main`、Root Directory が `server`、Build Command が `npm ci --include=dev && npm run build`、Start Command が `npm start` であることを確認。自動デプロイされていなければ **Manual Deploy → Deploy latest commit** を実行し、完了ログを確認します。TypeScriptのビルドに必要な開発依存もインストールするため `--include=dev` を付けています。
   - **Colyseus Cloud**：GitHub連携済みなら更新後の `main` のデプロイ完了を確認。CLIで更新する場合は、既存アプリを設定済みのリポジトリで次を実行します（デプロイ先は既存のアプリを使います）。

     ```bash
     cd server
     npx @colyseus/cloud deploy --branch main
     ```

     CLIはGitHub上のコードを使います。ローカルファイルを変更するだけでは反映されないため、先にPRをマージしてください。
   - **その他のホスティング／VPS**：マージ済みのコードを取得し、`server/` で `npm ci --include=dev && npm run build` を実行してから、既存の常駐プロセスを再起動します。起動コマンドは `npm start` です。
3. **Vercel側も更新後の `main` をデプロイ**する。自動デプロイが完了していれば追加操作は不要です。サーバーのURLが同じなら `VITE_COLYSEUS_URL` は変更不要。URLを変更した場合は `wss://…` を設定してからゲーム本体を再ビルドします。
4. サーバーのデプロイ履歴で新しいコミットが使われていることを確認し、`https://＜サーバーURL＞/hello` が `{"ok":true,...}` を返すことを確認。ゲームを再読み込み・再入室し、人間＋AIの対戦や通常のオンライン対戦が進むことを確認します。

更新中の対戦は切断されることがあるので、対戦していない時間に実施してください。

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
（開発時に `VITE_COLYSEUS_URL` が未設定なら、同一オリジンの `/colyseus` を Vite がローカルの2567番へプロキシします。スマホやプレビューから開いても、ブラウザ自身の `localhost` には接続しません）

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

**今回の同期処理の修正は、ゲーム本体と `server/` の両方を再デプロイしてください。** フロントだけを更新すると、古いサーバーが未来の入力を補完し続ける不具合は残ります。

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

- **「オンライン対戦サーバーが未設定です」** … 本番の `VITE_COLYSEUS_URL` を設定して再デプロイしてください。未設定時に利用者の `localhost` へ接続することはありません。
- **「対戦相手の準備を待っています…」** … 全員がVS画面を抜けてから入力監視が始まります。先にスキップした人だけが進んで、他の人の入力を捨てることはありません。
- **「入力遅延」** … 実際に届かなかった入力をサーバーが補完しています。描画落ちやタブ停止でも起こるため、回線不良とは限りません。復帰すると警告が消え、受信済みのフレームへ追いついて操作が戻ります。
- **「接続が切れました」** … 入力待ちのまま固めず、タイトルへ戻るボタンを表示します。再度入室してください。
- **「接続できませんでした」** … サーバーが起動しているか、URL が `wss://`（本番）か確認。Render 無料枠はスリープ復帰に時間がかかる
- **「その合言葉の部屋が見つかりません」** … 合言葉の打ち間違い、または部屋主が退室済み
- **「⚠ 同期ずれを検出」が出る** … まれにブラウザ差で発生する可能性あり。再戦すれば直ります（発生報告があれば調査します）
- **ラグい** … 方式上、通常の入力予約は5フレーム（人数に応じて最大10フレーム）。入力は自分の分もサーバーを往復し、届いていないフレームは待機します。サーバーは対戦する2人から近いリージョンに置くのが吉（Colyseus Cloud はリージョン選択可）

## 技術メモ（コードを触る人向け）

- `server/src/rooms/BattleRoom.ts` … 対戦ルーム（マッチング・入力リレー・シード発行）。公開部屋=1対1クイック、私室=チーム戦（ホスト制・AI枠あり）
- `src/game/net.ts` … クライアントのネットワーク層（colyseus.js）。入力は `[matchId, frame, slot, mask]` で送信元も含め全員へリレー。退室済みの古い部屋からの通知は無視。
- `server/src/rooms/InputRelay.ts` … 全人間の初回入力後に監視開始。実時間からフレームを生成せず、実際に要求されたフレームの不足分だけを250msの猶予後に補完。確定値は上書きせず、回復時は空の `lag` リストも送る。
- `src/game/lockstep.ts` … 正規入力バッファとオンライン時計。入力待ちの時間を捨てず、長い停止後は1描画につき最大12フレームずつ順番に再生して追いつく。
- `src/game/onlineSetup.ts` … サーバーの編成を画面設定へ変換。2人編成でもAIやチーム入れ替えを維持し、存在しない人間の入力を待たない。
- `src/components/OnlineLobby.tsx` … オンラインロビーUI（クイック用＋チーム戦用）。プレイヤー名の入力欄もここ
- `server/src/rooms/BattleRoom.ts` … プレイヤー名は参加オプション（`name`）か `name` メッセージで受け取り、制御文字の除去・12文字制限・同名の連番付与をサーバー側で担保（クライアントから来る値は信用しない）
- `src/components/TeamSetup.tsx` … オフライン・チーム戦の編成画面
- `src/components/BattleScreen.tsx` … `mode === 'online'` のときロックステップ実行（人間スロット全員分の入力を収集）
- `src/game/engine.ts` … `Math.random` を全廃してシード付き乱数（mulberry32）化。`stateHash()` で同期検証。N人同時乱戦対応（敵=別チーム、味方への攻撃は無効、AIは最寄りの敵を狙う）

## 回帰テスト

```bash
npm ci
npm test                     # 入力リレー・編成変換・仮想回線を使った対戦テスト
npm run typecheck
npm run build
npm --prefix server ci
npm --prefix server run build
```

テストは通常対戦、人間＋AIの2人対戦、チーム入れ替え、VS画面のスキップ差、20〜144Hzの描画、短い描画停止、数秒のタブ停止、通信遅延からの復帰、最大8人対戦を含みます。仮想回線テストでは全クライアントの `Battle.stateHash()` を同じフレームで比較します。

実画面での確認：
1. 部屋を作り、キャラを選び、反対チームにAIを1人追加して開始。操作でき、AIも動くこと。
2. 2つのブラウザでクイックマッチし、片方だけVS画面をスキップ。もう片方が入る前に入力遅延扱いされないこと。
3. 一方の描画を数秒停止して復帰。相手の試合は進み、復帰側が追いついて操作でき、警告が消えること。
4. 対戦中にWebSocketを切断。無限待機ではなく、タイトルに戻れる切断画面になること。
