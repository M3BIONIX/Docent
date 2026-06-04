import { generateText } from "ai";
import { evaluatorModel } from "../openai/openai.factory.js";
import { buildEvaluationPrompt, buildHistoryBlock } from "./evaluator.prompt.js";
import { parseEvaluationResponse } from "./evaluator.parse.js";
import {
  DEFAULT_TURN_EVALUATION,
  type ActiveIntent,
  type EvaluatorHistoryEntry,
  type TurnEvaluation,
} from "./evaluator.types.js";

export interface EvaluateInput {
  intent: ActiveIntent;
  latestUserMessage: string;
  history: EvaluatorHistoryEntry[];
  context: string[];
}

/**
 * Runs first, on the fast model, and gates the streamed reply.
 *
 *   ┌── empty intent? ──► DEFAULT (onTrack, no steer)
 *   │
 *   ├── build prompt (intent + RAG context + last 10 turns + latest msg)
 *   │
 *   └── generateText ──► parse loose JSON ──► TurnEvaluation
 *           │ on any error ──► DEFAULT (safe degrade to L0 for this turn)
 */
export async function evaluateTurn(input: EvaluateInput): Promise<TurnEvaluation> {
  const intentSummary = input.intent.intentSummary?.trim() || "";
  if (!intentSummary) return DEFAULT_TURN_EVALUATION;

  const prompt = buildEvaluationPrompt({
    intent: input.intent,
    context: input.context,
    historyBlock: buildHistoryBlock(input.history),
    latestUserMessage: input.latestUserMessage,
  });

  try {
    const { text } = await generateText({ model: evaluatorModel(), prompt });
    return parseEvaluationResponse(text);
  } catch (error) {
    console.error("[evaluator] evaluation failed, degrading to default", {
      error: error instanceof Error ? error.message : String(error),
    });
    return DEFAULT_TURN_EVALUATION;
  }
}
