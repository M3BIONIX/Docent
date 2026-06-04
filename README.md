# Docent

A document-driven teaching agent. Upload PDFs, and a tutor teaches them to you one at a
time, stays on topic (it won't drift), and tracks how well you understand each document.

Built on the anti-drift **intent-evaluator** pattern lifted from `predint-voice-ai`: after
every learner turn a fast model returns a verdict — `{onTrack, shouldEnd, realignmentNote,
nextBestQuestion, understandingScore}` — which steers the teaching reply and scores
understanding. See [`PLAN.md`](PLAN.md) for the full design.

## Architecture (MVP)

```
 Browser (React + Vite + Zustand + shadcn, B&W)          Express proxy (stateless)        OpenAI
   pdf.js: view + extract text ──────────────┐
   Dexie/IndexedDB: docs, chunks+vectors,     │  POST /embed   embed.service ───────────►  embeddings
     transcript, scores                       │  POST /turn    turn.service:
   RAG: cosine top-k over Dexie (in browser)  │                  1) evaluator (fast) ────►  chat
   SSE client                                 │                  2) steer on drift
                                              │                  3) response (stream) ───►  chat
```

- **No Supabase, no server database.** The backend holds the OpenAI key, parses nothing
  server-side, and is fully stateless. All state lives in the browser (Dexie/IndexedDB).
- **RAG with no vector DB.** Chunks are embedded once via OpenAI `text-embedding-3-small`;
  vectors are stored as `Float32Array` in IndexedDB; retrieval is brute-force cosine in JS.

## Layout

```
docent/
├─ server/   Express + TS (zod DTOs, factories, evaluator/response services)
└─ web/      React + Vite + Zustand + shadcn + Dexie + pdf.js
```

## Run locally

```bash
npm install

# server config
cp .env.example server/.env      # set OPENAI_API_KEY
cp .env.example web/.env         # VITE_API_ORIGIN=http://localhost:4000

npm run dev        # server on :4000, web on :5173
```

Open http://localhost:5173, add a PDF, click **Start teaching**.

## Quality

```bash
npm run typecheck
npm run test
npm run build
```

## Deploy to Vercel

One Vercel project serves both the SPA and the API:

- The Vite app builds to `web/dist` and is served as static files.
- The Express app runs as a **serverless function** at `api/[...path].ts` — every
  `/api/*` request is routed into it. (Vercel does not run `app.listen()`; the
  function exports the Express app as a request handler.) `server/src/index.ts` is
  only used for local `npm run dev`.
- The client calls `/api/*` same-origin, so there is no CORS config to manage in prod.

Config lives in [`vercel.json`](vercel.json): build command, static output, the
function's `maxDuration: 60` (teaching turns stream an LLM reply), and the SPA
fallback rewrite.

### Steps

1. Push this repo to GitHub (already at `M3BIONIX/Docent`).
2. In Vercel: **New Project → import the repo.** The settings in `vercel.json` are
   picked up automatically (framework preset: Other).
3. Add environment variables (Project → Settings → Environment Variables):
   - `OPENAI_API_KEY` — **required** for `/api/embed` and `/api/turn`.
   - `EVALUATOR_MODEL`, `RESPONSE_MODEL`, `EMBEDDING_MODEL` — optional overrides.
   - Leave `VITE_API_ORIGIN` unset (same-origin).
4. Deploy. Verify: `https://<your-app>.vercel.app/api/health` → `{"status":"ok"}`.

Or via CLI:

```bash
npm i -g vercel
vercel            # link + preview deploy
vercel --prod     # production
```

### Notes / limits

- **Streaming (SSE):** supported on Vercel Node functions. `maxDuration` is capped at
  60s on Hobby (300s on Pro) — long teaching turns must finish within that window.
- **Stateless by design:** no server DB, so there is nothing to provision. All user
  state stays in the browser (Dexie/IndexedDB), which suits Vercel's serverless model.

## What's intentionally out of MVP scope

- The heavy memory/cognitive layer (HyperMem / AOLM / knowledge graph) — the evaluator
  output is the seam it plugs into later.
- Voice / Realtime sideband (needs the OpenAI Realtime `call_id`; text has none).
- Auth / multi-user / cross-session memory. Single-user, local.
- Canvas PDF page rendering in the viewer (text reading pane for MVP;
  `lib/pdf.ts:renderPdfPage` is ready for the upgrade).
