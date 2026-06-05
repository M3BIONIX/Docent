import { z } from "zod";

export const turnSchema = z.object({
  role: z.enum(["assistant", "user"]),
  content: z.string().min(1).max(8000),
});

export const scoreSchema = z.object({
  score: z.number().int().min(0).max(100),
  onTrack: z.boolean().default(true),
});

export const endSchema = z.object({
  finalScore: z.number().int().min(0).max(100),
  mastery: z.boolean().default(false),
  rationale: z.string().max(500).nullable().default(null),
});
