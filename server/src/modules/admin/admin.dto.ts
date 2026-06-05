import { z } from "zod";

export const createLearnerSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().min(1).max(120),
  password: z.string().min(6).max(200),
});

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(300),
  // Extracted client-side via pdf.js, sent as plain text.
  text: z.string().min(1).max(200_000),
});

export const assignmentsSchema = z.object({
  documentIds: z.array(z.string().uuid()).max(100),
});
