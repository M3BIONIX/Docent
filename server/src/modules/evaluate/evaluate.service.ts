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
    '  "revealedMisunderstanding" (boolean): true ONLY if the learner actively said something incorrect or self-contradictory in their latest turns; false for silence, brevity, agreement, or unintelligible input.',
    '  "rationale" (string|null): one short sentence justifying the score.',
    "",
    "SCORING RULES (critical):",
    "- Agreement is NOT understanding. 'yes', 'ok', 'got it', 'makes sense', nodding along => NO credit. These must not raise the score.",
    "- Credit is earned ONLY when the learner explains an idea in their own words, gives a correct example, or correctly applies it.",
    "- Understanding is CUMULATIVE. Once the learner has genuinely demonstrated an idea, it stays credited. NEVER lower the score for silence, brief replies, filler, or garbled/unintelligible transcription — absence of new evidence is not a mistake.",
    "- Lower the score ONLY when the learner actively states something factually incorrect or contradicts an idea they previously got right. When unsure whether something is a genuine error, do NOT lower the score.",
    "- The score reflects the WHOLE corpus. If only 2 of 8 topics have been genuinely demonstrated, the score must be low even if those 2 were perfect.",
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
  revealedMisunderstanding: false,
  rationale: null,
};

export async function evaluateUnderstanding(req: EvaluateRequest): Promise<EvaluateResponse> {
  try {
    const { text } = await generateText({ model: evaluatorModel(), prompt: buildEvaluatePrompt(req) });
    const json = extractJsonObjectString(text);
    if (!json) return { ...DEFAULT_EVALUATION, understandingScore: req.priorScore ?? 0 };

    const parsed = JSON.parse(json) as Record<string, unknown>;
    const prior = req.priorScore ?? 0;
    const revealedMisunderstanding = normalizeLooseBoolean(parsed.revealedMisunderstanding, false);
    let understandingScore = normalizeScore(parsed.understandingScore) ?? prior;
    if (!revealedMisunderstanding) understandingScore = Math.max(understandingScore, prior);
    return {
      understandingScore,
      onTrack: normalizeLooseBoolean(parsed.onTrack, true),
      realignmentNote: normalizeLooseText(parsed.realignmentNote, 220),
      nextProbe: normalizeLooseText(parsed.nextProbe, 220),
      masteryReached: normalizeLooseBoolean(parsed.masteryReached, false),
      revealedMisunderstanding,
      rationale: normalizeLooseText(parsed.rationale, 280),
    };
  } catch (error) {
    console.error("[evaluate] failed, holding prior score", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ...DEFAULT_EVALUATION, understandingScore: req.priorScore ?? 0 };
  }
}
