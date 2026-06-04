import { createApp } from "./app.js";
import { env, isOpenAiConfigured } from "./config/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.info(`[docent-server] listening on :${env.PORT}`);
  if (!isOpenAiConfigured()) {
    console.warn(
      "[docent-server] OPENAI_API_KEY not set — /embed and /turn will return 503 until configured",
    );
  }
});
