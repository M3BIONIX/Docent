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

## What's intentionally out of MVP scope

- The heavy memory/cognitive layer (HyperMem / AOLM / knowledge graph) — the evaluator
  output is the seam it plugs into later.
- Voice / Realtime sideband (needs the OpenAI Realtime `call_id`; text has none).
- Auth / multi-user / cross-session memory. Single-user, local.
- Canvas PDF page rendering in the viewer (text reading pane for MVP;
  `lib/pdf.ts:renderPdfPage` is ready for the upgrade).
