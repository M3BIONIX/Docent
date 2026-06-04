import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "../src/services/response/response.service.js";
import { DEFAULT_TURN_EVALUATION } from "../src/services/evaluator/evaluator.types.js";

const base = {
  intent: { intentSummary: "Teach Doc A and verify understanding", openingQuestion: null },
  history: [],
  latestUserMessage: "ok",
  context: ["Photosynthesis converts light into chemical energy."],
};

describe("buildSystemPrompt", () => {
  it("does NOT add a steering block when on track", () => {
    const prompt = buildSystemPrompt({ ...base, evaluation: DEFAULT_TURN_EVALUATION });
    expect(prompt).not.toContain("Internal realignment");
    expect(prompt).toContain("Active teaching topic");
    expect(prompt).toContain("Photosynthesis");
  });

  it("adds a steering block when off track with a note", () => {
    const prompt = buildSystemPrompt({
      ...base,
      evaluation: {
        ...DEFAULT_TURN_EVALUATION,
        onTrack: false,
        realignmentNote: "Learner drifted to sports; steer back to photosynthesis",
        nextBestQuestion: "Ask what the inputs of photosynthesis are",
      },
    });
    expect(prompt).toContain("Internal realignment");
    expect(prompt).toContain("steer back to photosynthesis");
    expect(prompt).toContain("Next goal");
  });

  it("adds a wrap-up instruction when shouldEnd", () => {
    const prompt = buildSystemPrompt({
      ...base,
      evaluation: { ...DEFAULT_TURN_EVALUATION, shouldEnd: true },
    });
    expect(prompt).toContain("move on to the next document");
    expect(prompt).not.toContain("exactly one concise question");
  });
});
