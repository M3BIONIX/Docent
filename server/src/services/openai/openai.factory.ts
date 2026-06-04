import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../../config/env.js";

/**
 * Single place that constructs OpenAI models. Replaces predint's
 * session-intent-model.service.ts (which loaded config from Supabase admin
 * settings). Here it is purely env-driven.
 *
 *   evaluator -> fast/cheap model, runs first and gates the reply
 *   response  -> main model, streams the user-facing teaching reply
 *   embedding -> text-embedding-3-small (L2-normalized => cosine == dot product)
 */
function client() {
  if (!env.OPENAI_API_KEY) {
    throw new OpenAiNotConfiguredError();
  }
  return createOpenAI({ apiKey: env.OPENAI_API_KEY });
}

export class OpenAiNotConfiguredError extends Error {
  readonly code = "OPENAI_NOT_CONFIGURED";
  constructor() {
    super("OpenAI API key is not configured");
    this.name = "OpenAiNotConfiguredError";
  }
}

export function evaluatorModel() {
  return client()(env.EVALUATOR_MODEL);
}

export function responseModel() {
  return client()(env.RESPONSE_MODEL);
}

export function embeddingModel() {
  return client().embedding(env.EMBEDDING_MODEL);
}
