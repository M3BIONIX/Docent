import { describe, expect, it } from "vitest";
import {
  resolveEffectiveEvaluation,
  shouldIntervene,
} from "../src/modules/turn/turn.service.js";
import { InterventionTracker } from "../src/modules/turn/intervention-tracker.js";
import {
  DEFAULT_TURN_EVALUATION,
  type TurnEvaluation,
} from "../src/services/evaluator/evaluator.types.js";

const drift: TurnEvaluation = {
  ...DEFAULT_TURN_EVALUATION,
  onTrack: false,
  realignmentNote: "steer back",
  nextBestQuestion: "ask X",
};

describe("shouldIntervene", () => {
  it("true when shouldEnd", () => {
    expect(shouldIntervene({ ...DEFAULT_TURN_EVALUATION, shouldEnd: true })).toBe(true);
  });
  it("true when off-track with a note", () => {
    expect(shouldIntervene(drift)).toBe(true);
  });
  it("false when on-track", () => {
    expect(shouldIntervene(DEFAULT_TURN_EVALUATION)).toBe(false);
  });
  it("false when off-track but no note", () => {
    expect(
      shouldIntervene({ ...DEFAULT_TURN_EVALUATION, onTrack: false }),
    ).toBe(false);
  });
});

describe("resolveEffectiveEvaluation", () => {
  it("suppresses a duplicate drift-steer", () => {
    const effective = resolveEffectiveEvaluation(drift, true);
    expect(effective.onTrack).toBe(true);
    expect(effective.realignmentNote).toBeNull();
  });
  it("keeps a non-duplicate drift-steer", () => {
    const effective = resolveEffectiveEvaluation(drift, false);
    expect(effective.onTrack).toBe(false);
    expect(effective.realignmentNote).toBe("steer back");
  });
  it("never suppresses a shouldEnd verdict", () => {
    const end = { ...DEFAULT_TURN_EVALUATION, shouldEnd: true };
    expect(resolveEffectiveEvaluation(end, true).shouldEnd).toBe(true);
  });
});

describe("InterventionTracker cooldown", () => {
  it("flags identical back-to-back verdicts within the window", () => {
    let now = 1_000;
    const tracker = new InterventionTracker(() => now);
    expect(tracker.isDuplicate("s1", drift)).toBe(false); // first time
    now += 1_000;
    expect(tracker.isDuplicate("s1", drift)).toBe(true); // duplicate within 8s
  });

  it("does not flag after the cooldown elapses", () => {
    let now = 1_000;
    const tracker = new InterventionTracker(() => now);
    tracker.isDuplicate("s1", drift);
    now += 9_000;
    expect(tracker.isDuplicate("s1", drift)).toBe(false);
  });

  it("tracks sessions independently", () => {
    let now = 1_000;
    const tracker = new InterventionTracker(() => now);
    tracker.isDuplicate("s1", drift);
    expect(tracker.isDuplicate("s2", drift)).toBe(false);
  });
});
