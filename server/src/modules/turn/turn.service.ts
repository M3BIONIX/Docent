import { evaluateTurn } from "../../services/evaluator/evaluator.service.js";
import { streamResponse } from "../../services/response/response.service.js";
import type {
  EvaluatorHistoryEntry,
  TurnEvaluation,
} from "../../services/evaluator/evaluator.types.js";
import { InterventionTracker, interventionTracker } from "./intervention-tracker.js";
import type { TurnRequest } from "./turn.dto.js";

/**
 * Decide whether a verdict warrants steering the next reply.
 * Mirrors predint's: intervene when the topic is done, or when off-track with a note.
 */
export function shouldIntervene(evaluation: TurnEvaluation): boolean {
  return (
    evaluation.shouldEnd ||
    (!evaluation.onTrack &&
      Boolean(evaluation.realignmentNote?.trim() || evaluation.nextBestQuestion?.trim()))
  );
}

/**
 * The evaluation actually fed to the prompt builder. If a drift-steer is a
 * duplicate of the previous turn (within cooldown), suppress the steering block
 * so the model is not nagged with the identical note again. A shouldEnd verdict
 * is never suppressed (wrap-up must happen).
 */
export function resolveEffectiveEvaluation(
  evaluation: TurnEvaluation,
  isDuplicate: boolean,
): TurnEvaluation {
  const isDriftSteer = !evaluation.shouldEnd && !evaluation.onTrack;
  if (isDuplicate && isDriftSteer) {
    return { ...evaluation, onTrack: true, realignmentNote: null, nextBestQuestion: null };
  }
  return evaluation;
}

export interface TurnResult {
  /** Raw verdict, emitted to the client for scoring + UI. */
  evaluation: TurnEvaluation;
  /** True when the active topic is mastered; client advances to the next document. */
  advanceToNextDoc: boolean;
  /** AI SDK streaming result; the controller pipes textStream over SSE. */
  stream: ReturnType<typeof streamResponse>;
}

/**
 *  user turn
 *      │
 *      ▼  evaluateTurn (fast model, gates the reply)
 *  verdict ── isDuplicate? (cooldown) ──► resolveEffectiveEvaluation
 *      │
 *      ▼  streamResponse (main model, steering applied if drift & not duplicate)
 *  { evaluation, advanceToNextDoc, stream }
 */
export async function runTurn(
  req: TurnRequest,
  tracker: InterventionTracker = interventionTracker,
): Promise<TurnResult> {
  const intent = {
    intentSummary: req.intent.summary,
    openingQuestion: req.intent.openingQuestion,
  };

  // Normalize history to the strict evaluator shape (the zod .default([]) makes
  // entry fields look optional to some type-checkers; coerce explicitly).
  const history: EvaluatorHistoryEntry[] = req.history.map((h) => ({
    role: h.role === "assistant" ? "assistant" : "user",
    text: h.text ?? "",
  }));

  const evaluation = await evaluateTurn({
    intent,
    latestUserMessage: req.latestUserMessage,
    history,
    context: req.context,
  });

  const isDuplicate = shouldIntervene(evaluation)
    ? tracker.isDuplicate(req.sessionId, evaluation)
    : false;
  const effective = resolveEffectiveEvaluation(evaluation, isDuplicate);

  const stream = streamResponse({
    intent,
    evaluation: effective,
    history,
    latestUserMessage: req.latestUserMessage,
    context: req.context,
  });

  return { evaluation, advanceToNextDoc: evaluation.shouldEnd, stream };
}
