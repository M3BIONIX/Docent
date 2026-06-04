import { z } from "zod";

export const planRequestSchema = z.object({
  docs: z
    .array(
      z.object({
        title: z.string().min(1).max(300),
        text: z.string().min(1).max(60_000),
      }),
    )
    .min(1)
    .max(40),
});

export type PlanRequest = z.infer<typeof planRequestSchema>;

export interface PlanResponse {
  /** The whole-corpus teaching brief used as the realtime agent's instructions. */
  instructions: string;
  /** Ordered topic titles spanning all documents (for the UI). */
  topics: string[];
}
