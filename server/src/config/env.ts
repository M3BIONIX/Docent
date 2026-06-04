import "dotenv/config";
import { z } from "zod";

/**
 * Zod-validated process configuration.
 *
 * The OpenAI key is intentionally optional at boot: the server still starts so
 * /health works, but any route that needs OpenAI returns 503 OPENAI_NOT_CONFIGURED.
 * (Mirrors predint-voice-ai's boot behavior.)
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  EVALUATOR_MODEL: z.string().default("gpt-4o-mini"),
  RESPONSE_MODEL: z.string().default("gpt-4o-mini"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  PLAN_MODEL: z.string().default("gpt-4o-mini"),
  // OpenAI Realtime (voice) — used by the SDP proxy in /api/realtime/session
  REALTIME_MODEL: z.string().default("gpt-realtime"),
  REALTIME_VOICE: z.string().default("cedar"),
  REALTIME_TRANSCRIBE_MODEL: z.string().default("gpt-4o-mini-transcribe"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Environment validation failed:", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment configuration");
}

export const env = parsed.data;

export function isOpenAiConfigured(): boolean {
  return Boolean(env.OPENAI_API_KEY);
}
