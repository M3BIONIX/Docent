import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { env } from "../../config/env.js";
import { OpenAiNotConfiguredError } from "../../services/openai/openai.factory.js";
import {
  extractJsonObjectString,
  normalizeLooseBoolean,
  normalizeLooseText,
  normalizeScore,
} from "../../services/evaluator/evaluator.parse.js";
import type { EvaluateRequest, EvaluateResponse } from "./evaluate.dto.js";

function evaluatorModel() {
  if (!env.OPENAI_API_KEY) throw new OpenAiNotConfiguredError();
  return createOpenAI({ apiKey: env.OPENAI_API_KEY })(env.EVALUATOR_MODEL);
}

function buildTranscriptBlock(transcript: EvaluateRequest["transcript"]): string {
  return transcript
    .slice(-40)
    .map((t) => `${t.role === "assistant" ? "Tutor" : "Learner"}: ${t.text.replace(/\s+/g, " ").trim()}`)
    .filter((line) => line.length > 7)
    .join("\n");
}

/**
 * The anti-gaming scorer. Returns ONE global understanding score for the whole
 * corpus. Key rule: agreement is not understanding. Saying "yes" must not move
 * the score; only the learner explaining/applying ideas in their own words does,
 * and the score can DROP if they reveal a misunderstanding.
 */
function buildEvaluatePrompt(req: EvaluateRequest): string {
  return [
    "You are a strict examiner scoring how well a learner understands a body of material, based ONLY on what they have demonstrated in the conversation so far.",
    "Return exactly one JSON object, no markdown, with keys:",
    '  "understandingScore" (integer 0-100): overall demonstrated understanding across ALL topics.',
    '  "onTrack" (boolean): is the learner engaging with the material rather than drifting, stalling, or refusing?',
    '  "realignmentNote" (string|null): if off-track, a short internal note telling the tutor how to steer back.',
    '  "nextProbe" (string|null): a short internal suggestion for what the tutor should check next.',
    '  "masteryReached" (boolean): true ONLY if the learner has demonstrated genuine understanding across essentially all topics.',
    '  "rationale" (string|null): one short sentence justifying the score.',
    "",
    "SCORING RULES (critical):",
    "- Agreement is NOT understanding. 'yes', 'ok', 'got it', 'makes sense', nodding along => NO credit. These must not raise the score.",
    "- Credit is earned ONLY when the learner explains an idea in their own words, gives a correct example, or correctly applies it.",
    "- If the learner reveals a misunderstanding or gets something wrong, LOWER the score.",
    "- The score reflects the WHOLE corpus. If only 2 of 8 topics have been genuinely demonstrated, the score must be low even if those 2 were perfect.",
    "- Be conservative. When in doubt, score lower. Do not reward confident-sounding but empty answers.",
    "",
    `Prior score: ${req.priorScore === null ? "none yet" : req.priorScore}`,
    `Topics to be understood (the full corpus): ${req.topics.length ? req.topics.join("; ") : "unspecified"}`,
    "",
    "Conversation so far:",
    buildTranscriptBlock(req.transcript) || "none yet",
  ].join("\n");
}

const DEFAULT_EVALUATION: EvaluateResponse = {
  understandingScore: 0,
  onTrack: true,
  realignmentNote: null,
  nextProbe: null,
  masteryReached: false,
  rationale: null,
};

export async function evaluateUnderstanding(req: EvaluateRequest): Promise<EvaluateResponse> {
  try {
    const { text } = await generateText({ model: evaluatorModel(), prompt: buildEvaluatePrompt(req) });
    const json = extractJsonObjectString(text);
    if (!json) return { ...DEFAULT_EVALUATION, understandingScore: req.priorScore ?? 0 };

    const parsed = JSON.parse(json) as Record<string, unknown>;
    return {
      understandingScore: normalizeScore(parsed.understandingScore) ?? req.priorScore ?? 0,
      onTrack: normalizeLooseBoolean(parsed.onTrack, true),
      realignmentNote: normalizeLooseText(parsed.realignmentNote, 220),
      nextProbe: normalizeLooseText(parsed.nextProbe, 220),
      masteryReached: normalizeLooseBoolean(parsed.masteryReached, false),
      rationale: normalizeLooseText(parsed.rationale, 280),
    };
  } catch (error) {
    console.error("[evaluate] failed, holding prior score", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ...DEFAULT_EVALUATION, understandingScore: req.priorScore ?? 0 };
  }
}
