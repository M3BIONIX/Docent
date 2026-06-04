/** Shape returned by the per-turn evaluator. Ported + extended from predint's
 *  SessionIntentEvaluation (added `understandingScore`). */
export interface TurnEvaluation {
  /** Is the user staying on the active teaching topic? */
  onTrack: boolean;
  /** Has the active topic been sufficiently understood / covered? */
  shouldEnd: boolean;
  /** Internal planning note used to steer the model when it drifts. Never shown to the user. */
  realignmentNote: string | null;
  /** Internal next-turn teaching direction. Never shown verbatim to the user. */
  nextBestQuestion: string | null;
  /** 0-100 estimate of how well the user demonstrated understanding this turn. null when unknown. */
  understandingScore: number | null;
}

export const DEFAULT_TURN_EVALUATION: TurnEvaluation = {
  onTrack: true,
  shouldEnd: false,
  realignmentNote: null,
  nextBestQuestion: null,
  understandingScore: null,
};

export interface EvaluatorHistoryEntry {
  role: "assistant" | "user";
  text: string;
}

export interface ActiveIntent {
  /** e.g. "Teach <doc title> and verify the user understands <key points>." */
  intentSummary: string;
  openingQuestion: string | null;
}
