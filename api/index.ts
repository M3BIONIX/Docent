/**
 * Vercel serverless entry for the Docent API.
 *
 * Vercel does not run long-lived `app.listen()` servers — it invokes a handler
 * per request. An Express app instance IS a (req, res) handler, so we export the
 * app built by createApp(). A rewrite in vercel.json funnels every /api/* request
 * (including nested paths like /api/realtime/session) into this single function;
 * Express then routes on the original URL.
 *
 * Local dev still uses server/src/index.ts (app.listen on :4000); this file is
 * only used by Vercel.
 */
import { createApp } from "../server/src/app.js";

// maxDuration is configured in vercel.json (functions). Node is the default runtime.
export default createApp();
