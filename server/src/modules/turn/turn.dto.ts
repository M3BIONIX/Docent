import { z } from "zod";

const historyEntrySchema = z.object({
  role: z.enum(["assistant", "user"]),
  text: z.string().max(8000),
});

export const turnRequestSchema = z.object({
  sessionId: z.string().min(1).max(128),
  docId: z.string().min(1).max(128),
  intent: z.object({
    summary: z.string().min(1).max(2000),
    openingQuestion: z.string().max(2000).nullable().default(null),
  }),
  history: z.array(historyEntrySchema).max(50).default([]),
  latestUserMessage: z.string().min(1).max(8000),
  /** Top-k chunk texts retrieved client-side from Dexie for the active doc. */
  context: z.array(z.string().max(8000)).max(12).default([]),
});

export type TurnRequest = z.infer<typeof turnRequestSchema>;

/** SSE event names emitted by POST /turn. */
export const TURN_EVENT = {
  VERDICT: "verdict",
  TOKEN: "token",
  DONE: "done",
  ERROR: "error",
} as const;
