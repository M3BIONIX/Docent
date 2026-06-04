import { z } from "zod";

export const evaluateRequestSchema = z.object({
  transcript: z
    .array(
      z.object({
        role: z.enum(["assistant", "user"]),
        text: z.string().max(8000),
      }),
    )
    .max(200)
    .default([]),
  /** Topic titles spanning the whole corpus (from /api/plan). */
  topics: z.array(z.string().max(300)).max(60).default([]),
  /** The previous global score, so the evaluator can move it up or down. */
  priorScore: z.number().min(0).max(100).nullable().default(null),
});

export type EvaluateRequest = z.infer<typeof evaluateRequestSchema>;

export interface EvaluateResponse {
  /** Single global understanding score for the WHOLE corpus, 0-100. */
  understandingScore: number;
  /** Is the learner engaging with the material (vs drifting / stalling)? */
  onTrack: boolean;
  /** Internal steering note for the voice agent when off-track. Never spoken verbatim. */
  realignmentNote: string | null;
  /** Internal next probing direction for the agent. */
  nextProbe: string | null;
  /** True only when broad, genuine understanding has been demonstrated. */
  masteryReached: boolean;
  /** One-line reason for the score (shown to the learner at the end). */
  rationale: string | null;
}
