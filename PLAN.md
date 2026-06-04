# Docent — Engineering Plan

A document-driven teaching + understanding-evaluation agent. The agent reads a set of
documents (~20), teaches them to a user through conversation, keeps itself from drifting
off-topic, and continuously scores how well the user understands each topic.

Forked-in-spirit from `predint-voice-ai`: we reuse its **intent-evaluator** pattern (the
real anti-drift engine) and its clean Express folder conventions, but drop voice, Supabase,
Mem0, and Twilio.

---

## 1. The framing that resolves the "MVP without intent layer, but no drift" contradiction

Anti-drift in a text chat *is* the lightweight evaluator. You cannot deliver "the LLM
doesn't drift" without it, and the same evaluator emits the "evaluate the user's
understanding" score that is the actual product. So the capability ladder is:

```
L0  Docs in system prompt. Persists each turn. Weak drift control. No evaluation.        (NOT enough)
L1  L0 + per-turn evaluator -> {onTrack, shouldEnd, realignmentNote,                      (THE MVP)
    nextBestQuestion, understandingScore}. Real anti-drift. Detects mastery.
    Emits the understanding score. THIS is the product.
L2  HyperMem + AOLM + knowledge graph + context graph. Cross-session memory,             (DEFERRED)
    deep cognitive assessment. The Python/FastAPI spec in
    knowledge-context-intent-execution-plan/ (not built yet).
```

**MVP = L1.** What we defer is L2, not the evaluator. This also corrects the "5 days from
scratch vs 3-4 days fork" framing: those are not alternatives. The MVP is the simple shell
(A) **plus the cheap evaluator** (the only portable part of B). It is ~A's timeline plus a
half day, not two projects.

### Why the evaluator (intent layer) beats pure scratch — the answer you asked for

| Dimension | Pure scratch (L0: docs-in-prompt only) | With evaluator (L1) |
|---|---|---|
| Drift control | Model wanders; system prompt alone decays over a long chat | Each turn re-checks against intent, injects realignment when off |
| "Evaluate understanding" | Not delivered — no score exists | `understandingScore` per topic falls straight out of the eval |
| Topic progression | Manual / vibes; model decides when to move on | `shouldEnd` is a real signal -> advance to next doc on mastery |
| Knowing when to stop | Never converges cleanly | `shouldEnd` ends the session deliberately |
| Reuse | Build everything | Port `session-intent-evaluator.service.ts` (~half day, clean) |
| Path to L2 | Rewrite | Evaluator output is the seam HyperMem/AOLM plug into later |

The evaluator is not polish. It is the mechanic that (1) detects drift, (2) decides when a
topic is mastered, and (3) produces the score. Pure scratch ships the "teach" half and
silently drops the "evaluate" half — which is the half that makes this a product.

---

## 2. Decisions locked

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Anti-drift | **Evaluator L1** | It is the anti-drift requirement and the evaluation deliverable in one |
| D2 | Doc retrieval | **RAG, no vector DB** | OpenAI `text-embedding-3-small`, vectors in IndexedDB, cosine in JS |
| D3 | Embedding provider | **OpenAI** via `/embed` proxy | Fastest to build, ~free at this scale, vectors stored client-side |
| D4 | PDF | **Client-side pdf.js** | One lib = viewer + extraction; raw files never leave the browser |
| D5 | Browser store | **Dexie / IndexedDB** | Docs, chunks+vectors, transcript, scores; no server DB |
| D6 | Server DB / ORM | **None** (no Prisma/Drizzle/Supabase) | Backend is a stateless proxy; all state is client-side |
| D7 | Repo name | **`docent`** | A docent guides you through material; contains "doc" |

---

## 3. System architecture

The backend is a **stateless proxy**. It holds the OpenAI key (never shipped to the
browser), runs the eval-then-respond loop, and computes embeddings. Everything stateful
lives in the browser.

```
 BROWSER (React + Vite + Zustand + shadcn, black/white)            EXPRESS (stateless proxy)        OpenAI
 ┌───────────────────────────────────────────────┐               ┌──────────────────────────┐
 │  Upload + pdf.js viewer ──extract text──┐      │               │                          │
 │                                         v      │  POST /embed  │  EmbedController         │  embeddings
 │  Dexie (IndexedDB)                  Ingest:    │ ─────────────>│   -> EmbedService ───────┼──> /v1/embeddings
 │   • documents {id,title,text}       chunk +    │ <─────────────│   (zod DTO in/out)       │
 │   • chunks {id,docId,text,emb:F32}  embed      │   vectors     │                          │
 │   • messages {sessionId,role,text}             │               │                          │
 │   • topicScores {docId,score,...}              │  POST /turn   │  TurnController          │
 │   • intents {docId,summary,opening}            │ ─────────────>│   -> TurnService:        │
 │                                                │               │     1 EvaluatorService ──┼──> chat (cheap/fast)
 │  Zustand store (UI + session state)            │ <─────────────│     2 (if drift) inject  │      = JSON verdict
 │  Chat panel  <── stream ──────────────┐        │   SSE stream  │     3 ResponseService ───┼──> chat (stream)
 │  Progress/score panel                 │        │   {verdict,   │        (RAG ctx + intent)│
 └───────────────────────────────────────┴────────┘    reply}     └──────────────────────────┘

 Retrieval (RAG) happens IN THE BROWSER: top-k cosine over Dexie chunks for the active
 doc, then the chosen chunk texts are sent to /turn as `context`. The server never stores
 or sees the corpus beyond the current turn's context.
```

Why retrieval is client-side: the vectors already live in Dexie, the corpus is tiny, and
keeping it browser-side preserves the "docs never leave the device" property that the
client-side pdf.js choice already buys us. The server stays a pure, replaceable proxy.

---

## 4. The anti-drift turn loop (core mechanic, ported from predint)

Predint's rule: **evaluate first, then respond.** The evaluator runs on a cheap/fast model
and gates the expensive streamed reply. We keep that ordering.

```
 user sends message
        │
        ▼
 [browser] RAG: embed-free local cosine -> top-k chunks for active doc
        │
        ▼  POST /turn { intent, history, latestUserMessage, context: chunks }
 [server] EvaluatorService.evaluate()                       (fast model, ~1 cheap call)
        │   -> { onTrack, shouldEnd, realignmentNote, nextBestQuestion, understandingScore }
        │
        ├─ shouldEnd? ─yes─► reply = warm wrap-up for this doc; signal advanceToNextDoc
        │
        ├─ !onTrack && (realignmentNote || nextBestQuestion)?
        │        └─yes─► prepend a STEERING system message:
        │                 "Internal realignment (do not quote): <note>. Next goal: <q>.
        │                  Rephrase naturally; teach toward the active topic."
        │
        ▼
 [server] ResponseService.stream()  (main model, streamed)
        │   system = teaching prompt + active doc intent + RAG context (+ steering if any)
        ▼  SSE: { verdict, reply-tokens... }
 [browser] render reply; persist message; update topicScore from understandingScore;
           if advanceToNextDoc -> load next doc's intent
```

This is the literal port of `native-realtime-sideband.service.ts`'s decision logic
(`shouldIntervene = shouldEnd || (!onTrack && (realignmentNote || nextBestQuestion))`),
minus the WebSocket/`call_id`/`session.update` plumbing that only the Realtime voice API
needs. In text we don't steer a live audio stream — we just prepend a system message to
the next completion. Same brain, simpler nervous system.

We also keep predint's **intervention cooldown** (skip a re-steer if the same verdict
fires within ~8s / same turn signature) to avoid nagging the model on consecutive turns.

---

## 5. Repository structure

Mirrors predint's clean conventions (modules / services / interfaces / constants / dtos /
factories). Monorepo with two workspaces.

```
docent/
├─ package.json                 # workspaces: ["web","server"]; root scripts: dev, lint, typecheck
├─ .env.example                 # OPENAI_API_KEY, PORT, CLIENT_ORIGIN, models
├─ README.md
├─ web/                         # React + Vite
│  ├─ index.html
│  ├─ vite.config.ts
│  ├─ src/
│  │  ├─ main.tsx
│  │  ├─ App.tsx
│  │  ├─ components/ui/         # shadcn (button, card, dialog, scroll-area, progress…)
│  │  ├─ features/
│  │  │  ├─ documents/          # upload, DocViewer (react-pdf/pdf.js), ingest pipeline
│  │  │  ├─ chat/               # ChatPanel, MessageList, Composer, SSE client
│  │  │  └─ progress/           # ScorePanel, per-doc mastery bars
│  │  ├─ lib/
│  │  │  ├─ db.ts               # Dexie schema (documents, chunks, messages, topicScores, intents)
│  │  │  ├─ pdf.ts              # pdf.js: render + extractText
│  │  │  ├─ rag.ts              # chunk(), cosineTopK()  (retrieval in browser)
│  │  │  └─ api.ts              # typed fetch to /embed, /turn (SSE)
│  │  ├─ store/                 # Zustand: sessionStore, docStore, uiStore
│  │  └─ theme/                 # black/white tokens
│  └─ tests/                    # vitest + @testing-library/react
└─ server/                      # Express (TypeScript, ESM)
   ├─ src/
   │  ├─ index.ts               # bootstrap, CORS(CLIENT_ORIGIN), routes, error handler
   │  ├─ config/env.ts          # zod-validated env; 503 if OPENAI_API_KEY missing
   │  ├─ modules/
   │  │  ├─ embed/
   │  │  │  ├─ embed.controller.ts
   │  │  │  ├─ embed.service.ts
   │  │  │  ├─ embed.dto.ts          # zod: EmbedRequest{texts[]}, EmbedResponse{vectors[][]}
   │  │  │  └─ interfaces/
   │  │  └─ turn/
   │  │     ├─ turn.controller.ts    # SSE
   │  │     ├─ turn.service.ts       # orchestrates evaluate -> (steer) -> stream
   │  │     ├─ turn.dto.ts           # zod: TurnRequest, TurnVerdict, stream events
   │  │     └─ interfaces/
   │  ├─ services/
   │  │  ├─ evaluator/
   │  │  │  ├─ evaluator.service.ts  # PORT of session-intent-evaluator (+ understandingScore)
   │  │  │  └─ evaluator.prompt.ts
   │  │  ├─ response/response.service.ts   # builds teaching system prompt; streams reply
   │  │  └─ openai/openai.factory.ts       # single place that constructs the AI SDK model
   │  ├─ middleware/             # error, request-id, zod-validate
   │  └─ helpers/
   └─ tests/                    # vitest + supertest
```

`openai.factory.ts` replaces predint's `session-intent-model.service.ts` (which loaded
model config from Supabase admin settings). One factory, env-driven: fast model for the
evaluator, main model for responses.

---

## 6. Data model (Dexie / IndexedDB)

```ts
// web/src/lib/db.ts
class DocentDB extends Dexie {
  documents!:   Table<{ id: string; title: string; text: string; order: number; createdAt: number }>;
  chunks!:      Table<{ id: string; docId: string; idx: number; text: string; embedding: Float32Array }>;
  messages!:    Table<{ id: string; sessionId: string; docId: string; role: 'user'|'assistant'; text: string; ts: number }>;
  topicScores!: Table<{ docId: string; understanding: number; turns: number; mastered: boolean; updatedAt: number }>;
  intents!:     Table<{ docId: string; intentSummary: string; openingQuestion: string }>;
}
// stores: 'id', 'docId+idx', 'sessionId', 'docId', 'docId'
```

`embedding` is a `Float32Array` (1536 dims) stored inline — IndexedDB persists typed
arrays natively, ~6KB/chunk. ~20 docs ≈ a few hundred chunks ≈ a few MB. No vector DB.

---

## 7. RAG design (free, no infra)

```
INGEST (once per doc, at upload):
  pdf.js extractText(file)  ->  chunk(text, ~800 tokens, ~100 overlap)  ->
  POST /embed { texts: chunks }  ->  vectors  ->  Dexie.chunks.bulkAdd({text, embedding})
  Also: generate the doc's teaching intent (1 LLM call) -> Dexie.intents

QUERY (each user turn):
  POST /embed { texts: [userMessage] } -> qVec     (or: include in /turn to save a round-trip)
  cosineTopK(qVec, chunks.where(docId = active), k=4) -> context chunks  ->  send to /turn
```

Cost: embedding ~20 docs once is a fraction of a cent. Query embeddings are one tiny call
per turn (can be folded into `/turn` so a turn is one HTTP request). Brute-force cosine
over a few hundred 1536-d vectors is sub-millisecond in JS.

Note (Layer-1 reuse): `text-embedding-3-small` returns L2-normalized vectors, so cosine =
dot product. `cosineTopK` is a dot-product + partial sort. No library needed.

---

## 8. Backend API contracts (zod DTOs)

```
POST /embed
  req:  { texts: string[] }                          # max N, each <= M chars (zod)
  res:  { vectors: number[][] }                      # one 1536-vec per text

POST /turn   (Server-Sent Events)
  req:  {
          sessionId, docId,
          intent: { summary: string, openingQuestion: string|null },
          history: { role, text }[],                 # last ~10, server-trims
          latestUserMessage: string,
          context: string[]                          # top-k chunk texts from browser RAG
        }
  stream events:
    event: verdict  data: { onTrack, shouldEnd, realignmentNote, nextBestQuestion, understandingScore }
    event: token    data: { delta: string }          # streamed reply
    event: done     data: { advanceToNextDoc: boolean }

GET  /health  -> { status:'ok', uptime }
```

All bodies validated by a `zod-validate` middleware; `env.ts` zod-validates config and
returns `503 OPENAI_NOT_CONFIGURED` when the key is absent (predint's behavior).

---

## 9. The evaluator port (predint -> docent)

Source: `predint-voice-ai/server/src/services/session-intent/session-intent-evaluator.service.ts`.
It is a clean `generateText` (Vercel AI SDK) call: build prompt -> parse loose JSON ->
normalize. Zero Supabase, zero Mem0. We lift it almost verbatim and extend it:

- **Swap** `createSessionIntentModel(...)` for `openai.factory.ts` (env-driven fast model).
- **Add** one field to the schema, prompt, and normalizer: `understandingScore` (0-100,
  default null) — "how well has the user demonstrated understanding of the active topic
  this turn." Keep the existing loose-boolean / loose-text / fenced-JSON parsing as-is
  (it is already robust to model formatting noise).
- **Keep** `realignmentNote` / `nextBestQuestion` as internal-only planning notes, never
  quoted to the user (predint's instruction block already enforces this).
- **Reframe** intent text from "founder call" to "teach + evaluate this document": the
  intent summary becomes "Teach <doc title> and verify the user understands <key points>."

The `intents` records are generated once per doc at ingest by a small planner prompt
(mirrors predint's `session-intent-planner` but doc-scoped, no DB).

---

## 10. Test coverage plan

```
SERVER (vitest + supertest)
[+] modules/embed/embed.service
    ├── [★★★] maps texts->vectors, preserves order
    └── [★★★] propagates OpenAI error -> 502; empty texts -> 400 (zod)
[+] modules/turn/turn.service                                   ← highest-value
    ├── [★★★] onTrack=true  -> no steering message in response prompt
    ├── [★★★] !onTrack+note -> steering system message prepended
    ├── [★★★] shouldEnd     -> wrap-up reply + advanceToNextDoc=true
    ├── [★★★] duplicate verdict within cooldown -> no re-steer   (port predint cooldown)
    └── [★★★] evaluator throws -> falls back to DEFAULT verdict (onTrack=true), still replies
[+] services/evaluator/evaluator.service
    ├── [★★★] parses fenced ```json, bare object, loose booleans, null-ish text
    ├── [★★★] understandingScore clamps to 0-100; missing -> null
    └── [★★★] malformed model output -> DEFAULT_EVALUATION (no throw)
[+] config/env  [★★★] missing OPENAI_API_KEY -> 503 path; bad PORT -> startup error
[+] /turn SSE   [★★★ →E2E] full happy turn emits verdict, tokens, done in order

WEB (vitest + @testing-library)
[+] lib/rag       [★★★] chunk() overlap/sizing; cosineTopK() ranking + k cutoff
[+] lib/db        [★★★] Float32Array round-trips through Dexie; topicScore upsert
[+] lib/pdf       [★★  ] extractText returns text; bad PDF -> typed error
[+] features/chat [★★  ] SSE client renders streamed tokens; verdict updates score panel
[+] features/documents [★★] upload -> ingest -> chunks+intent persisted (mocked /embed)
[+] store         [★★  ] advanceToNextDoc moves active doc; mastered hides doc from queue

COVERAGE TARGET: every branch in turn.service + evaluator parsing (the drift logic) at ★★★.
GAPS to write alongside code: SSE ordering E2E; Dexie typed-array persistence.
```

---

## 11. Failure modes (each: test? handled? visible?)

| Failure | Test | Handled | User sees |
|---|---|---|---|
| OpenAI down / 5xx mid-turn | ✓ | retry once then SSE `error` event | "Lost the thread, resend" toast (not a white screen) |
| Evaluator returns garbage JSON | ✓ | falls back to DEFAULT verdict, reply still streams | nothing — degrades to L0 for that turn |
| Embedding call fails at ingest | ✓ | doc marked `ingestFailed`, retry button | "Couldn't process <doc>, retry" |
| pdf.js fails on scanned/encrypted PDF | ✓ | typed error, doc rejected | "This PDF has no extractable text" |
| Dexie quota exceeded (many big docs) | ✓ | catch QuotaExceeded, surface | "Storage full, remove a document" |
| SSE connection drops mid-stream | ✓ | client detects, marks message incomplete | "reply interrupted, retry" |
| Model drifts despite steering | partial | cooldown prevents nag; next turn re-evaluates | self-corrects within a turn or two |

**Critical-gap check:** no failure mode is both untested AND silent. The evaluator-garbage
path is the riskiest (it silently degrades to L0) — it is tested and is a *safe* degrade
(you still get a teaching reply), so acceptable for MVP. Flagged here so it's not a surprise.

---

## 12. NOT in scope (deferred, with reason)

- **L2: HyperMem / AOLM / knowledge graph / context graph** — the heavy cognitive layer.
  Deferred; the evaluator output is the seam it plugs into later. (It's also an unbuilt
  Python/FastAPI spec — wrong stack to fork now.)
- **Voice / Realtime / sideband-over-`call_id`** — needs the Realtime API; text MVP has no
  `call_id`. The portable half (evaluator) is in scope; the audio plumbing is not.
- **Auth / multi-user / server persistence** — single-user local MVP; all state in Dexie.
  Prisma/Drizzle/Supabase explicitly out.
- **Cross-session long-term memory** — each run starts fresh from the loaded docs. (L2.)
- **Cross-doc free-jump RAG** — retrieval is scoped to the active doc for the MVP teaching
  flow. Whole-corpus retrieval is a v2 toggle once sequential teaching is proven.
- **Distribution/packaging** — local `npm run dev`; no deploy pipeline in the MVP. (Railway
  later, like predint, if it goes multi-user.)

## 13. What already exists (reuse map)

| Need | Existing asset | Action |
|---|---|---|
| Anti-drift evaluator | `predint/.../session-intent-evaluator.service.ts` | **Port** (+`understandingScore`) |
| Steer/intervene decision logic | `predint/.../native-realtime-sideband.service.ts` | **Port the logic**, drop the WebSocket |
| Per-doc intent generation | `predint/.../session-intent-planner.service.ts` | **Adapt** doc-scoped, no DB |
| Intent/eval type shapes | `predint/.../interfaces/session-intent.interface.ts` | **Copy + extend** |
| Express module conventions | `predint/server/src/modules/*` | **Mirror** structure |
| Env validation / 503 pattern | predint `config/env.ts` | **Mirror** |
| OpenAI key | `predint-voice-ai/.env` → `OPENAI_API_KEY` | **Copy** into `docent/.env` |

Nothing is rebuilt that predint already solves; we drop only what's voice/Supabase/Mem0-specific.

---

## 14. Build sequence & estimate

```
Lane A (server)                         Lane B (web)                  depends
1 scaffold server + env + /health       1 scaffold vite+shadcn+theme   —          ~0.5d
2 openai.factory + /embed               2 Dexie schema + pdf.js viewer  —          ~0.5d
3 evaluator port + understandingScore   3 RAG (chunk/cosine) + ingest   —          ~0.5d
4 turn.service (eval->steer->stream)     4 chat SSE + score panel        A3,B3      ~1.0d
5 tests (turn branches, evaluator)      5 tests (rag, db, chat)         A4,B4      ~1.0d
                                         6 wire end-to-end + polish      A4,B4      ~0.5d
```

Lanes A and B are independent until step 4 (the `/turn` contract is the join). Realistic
**~4 days** for a tested L1 MVP. The evaluator port is the cheap, high-leverage piece.

**First win to target:** upload one PDF → see it in the viewer → chat where the agent
teaches it, refuses to drift off-topic, and the score bar moves as you demonstrate
understanding. That single flow exercises every layer (pdf.js, Dexie, RAG, evaluator,
steering, streaming, scoring).
