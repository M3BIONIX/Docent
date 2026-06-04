import type { TurnEvaluation } from "../../services/evaluator/evaluator.types.js";

/**
 * Ports predint's intervention cooldown: avoid re-steering with an identical
 * verdict on back-to-back turns within a short window (prevents nagging the
 * model with the same realignment note every turn).
 *
 *   signature = (onTrack, shouldEnd, realignmentNote, nextBestQuestion)
 *   if same signature as last turn AND within cooldown -> suppress the steer
 *   (the reply still streams; only the steering block is withheld)
 */
const COOLDOWN_MS = 8_000;

interface Entry {
  signature: string;
  at: number;
}

function signatureOf(evaluation: TurnEvaluation): string {
  return JSON.stringify({
    onTrack: evaluation.onTrack,
    shouldEnd: evaluation.shouldEnd,
    realignmentNote: evaluation.realignmentNote,
    nextBestQuestion: evaluation.nextBestQuestion,
  });
}

export class InterventionTracker {
  private readonly last = new Map<string, Entry>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** Returns true if this verdict is a duplicate of the previous one within the cooldown. */
  isDuplicate(sessionId: string, evaluation: TurnEvaluation): boolean {
    const signature = signatureOf(evaluation);
    const previous = this.last.get(sessionId);
    const now = this.now();
    const duplicate =
      previous !== undefined &&
      previous.signature === signature &&
      now - previous.at < COOLDOWN_MS;
    this.last.set(sessionId, { signature, at: now });
    return duplicate;
  }

  reset(sessionId: string): void {
    this.last.delete(sessionId);
  }
}

/** Singleton used by the live turn service. Tests construct their own with a fake clock. */
export const interventionTracker = new InterventionTracker();
