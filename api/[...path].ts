/**
 * Vercel serverless entry for the Docent API.
 *
 * Vercel does not run long-lived `app.listen()` servers — it invokes a handler
 * per request. An Express app instance IS a (req, res) handler, so we export the
 * app built by createApp(). This catch-all file ([...path]) receives every
 * /api/* request; Express routes it internally (/api/health, /api/embed, /api/turn).
 *
 * Local dev still uses server/src/index.ts (app.listen on :4000); this file is
 * only used by Vercel.
 */
import { createApp } from "../server/src/app.js";

export const config = {
  runtime: "nodejs",
  maxDuration: 60, // teaching turns stream an LLM reply; allow up to 60s
};

export default createApp();
