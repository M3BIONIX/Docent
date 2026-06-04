import { z } from "zod";

export const embedRequestSchema = z.object({
  texts: z
    .array(z.string().min(1).max(8000))
    .min(1)
    .max(256),
});

export type EmbedRequest = z.infer<typeof embedRequestSchema>;

export interface EmbedResponse {
  /** One vector per input text, in the same order. */
  vectors: number[][];
}
