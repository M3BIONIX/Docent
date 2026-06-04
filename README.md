# Docent

A **voice-first** tutor for your documents. Upload a set of PDFs and Docent teaches **all
of them as one connected subject**, by voice, and tracks how well you *actually* understand
the material with a single live score.

- **Voice agent + orb.** A real spoken tutor (OpenAI Realtime over WebRTC) with an
  audio-reactive orb that moves with the conversation.
- **Whole-corpus teaching.** The agent builds one curriculum across every document and
  decides the order — you don't pick what to learn first.
- **One honest score.** A single 0–100 understanding score for the whole corpus, judged by
  an LLM. Saying "yes" earns nothing — you have to explain ideas in your own words, and the
  score can go *down* if you reveal a misunderstanding.

## How it works

```
 Browser (React + Vite + Zustand, B&W)              Express proxy (/api, stateless)        OpenAI
   upload PDFs → pdf.js extracts text → Dexie
        │
        │  POST /api/plan (all doc texts)  ───────►  plan.service ───────────────────────►  chat
        │  ◄── teaching brief + ordered topics
        │
        │  WebRTC offer ─ POST /api/realtime/session ─► SDP proxy ─► /v1/realtime/calls
        │  ◄── answer SDP ;  then audio streams browser ⇄ OpenAI directly (mic ⇄ voice)
        │
        │  data channel: transcripts, speaking state, end_session
        │      └─ each learner turn ─ POST /api/evaluate ─► evaluate.service ─────────────►  chat
        │         ◄── single global score (+ steer the agent if you drift)
        ▼
   audio-reactive orb + live understanding score
```

- **No Supabase, no server DB.** The backend is a stateless proxy: it holds the OpenAI key,
  builds the teaching brief, scores understanding, and proxies the voice SDP handshake. The
  audio itself never flows through the server — it's a direct browser⇄OpenAI WebRTC stream,
  which is what makes voice work on Vercel's serverless model.
- **Documents** live in the browser (Dexie/IndexedDB). All state is client-side.

## API surface (`/api`)

| Route | Purpose |
|---|---|
| `GET /health` | liveness |
| `POST /plan` | turn ALL documents into one teaching brief + ordered topic list |
| `POST /realtime/session` | SDP proxy → OpenAI Realtime (injects the teaching brief as instructions) |
| `POST /evaluate` | the single, global, anti-gaming understanding score |

## Layout

```
docent/
├─ api/index.ts   Vercel serverless entry (exports the Express app)
├─ server/        Express + TS (zod DTOs, plan/evaluate/realtime modules)
└─ web/           React + Vite + Zustand (upload → voice session: orb + score)
```

## Run locally

```bash
npm install
cp .env.example server/.env      # set OPENAI_API_KEY
npm run dev                      # server :4000, web :5173 (Vite proxies /api)
```

Open http://localhost:5173, add PDFs, click **Start learning by voice**, and allow the mic.

## Quality

```bash
npm run typecheck && npm run test && npm run build
```

## Deploy to Vercel

One project serves the SPA (static `web/dist`) and the Express API (serverless at
`api/index.ts`). A rewrite funnels every `/api/*` request into the function; the SPA
fallback handles everything else. Config is in [`vercel.json`](vercel.json).

1. Import the repo in Vercel. **Root Directory must be the repo root** (`./`), framework
   **Other** — `vercel.json` provides the rest.
2. Set env vars: `OPENAI_API_KEY` (required). Optional: `REALTIME_MODEL` (default
   `gpt-realtime`), `REALTIME_VOICE` (default `cedar`), `PLAN_MODEL`, `EVALUATOR_MODEL`.
3. Deploy. Verify `https://<app>.vercel.app/api/health` → `{"status":"ok"}`.

Notes:
- **Realtime voice on Vercel works** because audio is browser⇄OpenAI; only the short SDP
  handshake and the per-turn scoring touch the serverless function (well under `maxDuration`).
- Voice requires HTTPS + microphone permission (both satisfied on Vercel).

## Scope notes

- The original text-chat MVP design is preserved in [`PLAN.md`](PLAN.md) for history; the
  app is now voice-first (this README is the source of truth).
- Sideband steering is done client-side (the browser injects a `session.update` correction
  when the evaluator flags drift), which keeps the server stateless for Vercel.
