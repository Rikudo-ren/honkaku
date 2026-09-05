import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import cors from "cors";
import { BattleRoom } from "./rooms/BattleRoom";

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define("battle", BattleRoom);
  },

  initializeExpress: (app) => {
    // Vercel（別オリジン）のクライアントからマッチメイキング HTTP を叩けるように CORS を全許可
    app.use(cors());

    app.get("/hello", (_req, res) => {
      res.json({ ok: true, game: "honkaku-fighters", time: Date.now() });
    });

    // 開発時のみ管理モニター（本番で使う場合はパスワード保護推奨）
    if (process.env.NODE_ENV !== "production") {
      app.use("/monitor", monitor());
    }
  },
});
