import { streamText, type CoreMessage } from "ai";
import { responseModel } from "../openai/openai.factory.js";
import type {
  ActiveIntent,
  EvaluatorHistoryEntry,
  TurnEvaluation,
} from "../evaluator/evaluator.types.js";

export interface ResponseInput {
  intent: ActiveIntent;
  evaluation: TurnEvaluation;
  history: EvaluatorHistoryEntry[];
  latestUserMessage: string;
  context: string[];
}

/**
 * Builds the teaching system prompt. When the evaluator flags drift, a STEERING
 * line is appended (internal note, never quoted) — this is the text-mode
 * equivalent of predint's sideband session.update.
 */
export function buildSystemPrompt(input: ResponseInput): string {
  const { intent, evaluation, context } = input;
  const lines: string[] = [
    "You are Docent, a patient tutor that teaches the learner from the provided source material and checks their understanding as you go.",
    "Teach in small, clear steps. Explain one idea at a time, then ask one short question that checks understanding. Never ask more than one question per turn.",
    "Stay strictly on the active teaching topic. Do not wander into unrelated material.",
    "Use only the source material below as ground truth. If the answer is not in it, say so plainly rather than inventing facts.",
    "",
    `Active teaching topic: ${intent.intentSummary}`,
  ];

  if (context.length) {
    lines.push("", "Source material for this topic:");
    context.forEach((c, i) => lines.push(`[${i + 1}] ${c.replace(/\s+/g, " ").trim()}`));
  }

  const isDrifting =
    !evaluation.onTrack &&
    Boolean(evaluation.realignmentNote?.trim() || evaluation.nextBestQuestion?.trim());

  if (isDrifting) {
    lines.push(
      "",
      "Internal realignment (do NOT quote this to the learner; rephrase naturally):",
      evaluation.realignmentNote ? `- Realign: ${evaluation.realignmentNote}` : "",
      evaluation.nextBestQuestion ? `- Next goal: ${evaluation.nextBestQuestion}` : "",
      "Gently guide the conversation back to the active teaching topic.",
    );
  }

  if (evaluation.shouldEnd) {
    lines.push(
      "",
      "The learner has shown solid understanding of this topic. Give a brief, warm summary of what they learned. Do not introduce a new topic. Let them know they can move on to the next document.",
    );
  } else {
    lines.push("", "End your turn with exactly one concise question that moves understanding forward.");
  }

  return lines.filter((l) => l.length > 0).join("\n");
}

function toCoreMessages(history: EvaluatorHistoryEntry[], latestUserMessage: string): CoreMessage[] {
  const trimmed = history.slice(-10).map<CoreMessage>((h) => ({
    role: h.role === "assistant" ? "assistant" : "user",
    content: h.text,
  }));
  return [...trimmed, { role: "user", content: latestUserMessage }];
}

/** Returns an AI SDK streaming result; the controller pipes its textStream over SSE. */
export function streamResponse(input: ResponseInput) {
  return streamText({
    model: responseModel(),
    system: buildSystemPrompt(input),
    messages: toCoreMessages(input.history, input.latestUserMessage),
  });
}
