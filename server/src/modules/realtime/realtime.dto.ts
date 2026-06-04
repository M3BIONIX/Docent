import { z } from "zod";

export const realtimeSessionRequestSchema = z.object({
  /** The browser's WebRTC SDP offer. */
  sdp: z.string().min(1).max(200_000),
  /** Whole-corpus teaching brief (from /api/plan) used as the agent's instructions. */
  instructions: z.string().min(1).max(120_000),
});

export type RealtimeSessionRequest = z.infer<typeof realtimeSessionRequestSchema>;
