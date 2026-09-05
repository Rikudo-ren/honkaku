import { listen } from "@colyseus/tools";
import appConfig from "./app.config";

// PORT 環境変数があればそれを使用（デフォルト 2567）
listen(appConfig);
