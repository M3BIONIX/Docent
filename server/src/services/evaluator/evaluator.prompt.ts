import type { ActiveIntent, EvaluatorHistoryEntry } from "./evaluator.types.js";

export function buildHistoryBlock(entries: EvaluatorHistoryEntry[]): string {
  return entries
    .slice(-10)
    .map((entry) => {
      const cleaned = entry.text.replace(/\s+/g, " ").trim();
      if (!cleaned) return null;
      return `${entry.role === "assistant" ? "Tutor" : "Learner"}: ${cleaned}`;
    })
    .filter((entry): entry is string => Boolean(entry))
    .join("\n");
}

export function buildEvaluationPrompt(input: {
  intent: ActiveIntent;
  context: string[];
  historyBlock: string;
  latestUserMessage: string;
}): string {
  const contextBlock = input.context.length
    ? input.context.map((c, i) => `[${i + 1}] ${c.replace(/\s+/g, " ").trim()}`).join("\n")
    : "none";

  return [
    "You are evaluating whether a teaching conversation is progressing against its active teaching intent,",
    "and how well the learner understands the current topic.",
    "Return exactly one JSON object. Do not include markdown. Do not explain your answer.",
    'The JSON object must contain these keys: "onTrack", "shouldEnd", "realignmentNote", "nextBestQuestion", "understandingScore".',
    'Use booleans for "onTrack" and "shouldEnd".',
    'Use null for "realignmentNote" or "nextBestQuestion" when unsure or unnecessary.',
    'Use an integer 0-100 for "understandingScore" (0 = no understanding shown, 100 = mastery), or null if the learner has not yet demonstrated anything to score.',
    '"realignmentNote" and "nextBestQuestion" are internal planning notes for another system, not user-facing copy. Always write them in plain English.',
    "Set onTrack=false when the learner has drifted away from the active topic, and give a short realignment note.",
    "Be conservative about ending: only set shouldEnd=true when the learner has clearly demonstrated solid understanding of the active topic, or explicitly wants to move on.",
    "If useful, provide one concise next-best teaching question that deepens or checks understanding of the active topic.",
    "",
    `Active teaching intent: ${input.intent.intentSummary}`,
    `Preferred opening question: ${input.intent.openingQuestion || "none"}`,
    "",
    "Relevant source material (retrieved for this turn):",
    contextBlock,
    "",
    "Recent conversation:",
    input.historyBlock || "none",
    "",
    `Latest learner message: ${input.latestUserMessage.replace(/\s+/g, " ").trim()}`,
  ].join("\n");
}
