import { describe, expect, it } from "vitest";
import {
  normalizeLooseBoolean,
  normalizeScore,
  parseEvaluationResponse,
} from "../src/services/evaluator/evaluator.parse.js";
import { DEFAULT_TURN_EVALUATION } from "../src/services/evaluator/evaluator.types.js";

describe("evaluator parsing", () => {
  it("parses a fenced ```json block", () => {
    const raw = '```json\n{"onTrack": true, "shouldEnd": false, "understandingScore": 80}\n```';
    const result = parseEvaluationResponse(raw);
    expect(result.onTrack).toBe(true);
    expect(result.shouldEnd).toBe(false);
    expect(result.understandingScore).toBe(80);
  });

  it("parses a bare object with surrounding prose", () => {
    const raw = 'Here you go: {"onTrack": false, "realignmentNote": "back to topic"} thanks';
    const result = parseEvaluationResponse(raw);
    expect(result.onTrack).toBe(false);
    expect(result.realignmentNote).toBe("back to topic");
  });

  it("normalizes loose booleans", () => {
    expect(normalizeLooseBoolean("yes", false)).toBe(true);
    expect(normalizeLooseBoolean("0", true)).toBe(false);
    expect(normalizeLooseBoolean("maybe", true)).toBe(true); // fallback
  });

  it("clamps understandingScore to 0-100 and rounds", () => {
    expect(normalizeScore(140)).toBe(100);
    expect(normalizeScore(-5)).toBe(0);
    expect(normalizeScore("72.6")).toBe(73);
    expect(normalizeScore("null")).toBeNull();
    expect(normalizeScore(undefined)).toBeNull();
  });

  it("treats null-ish text as null", () => {
    const result = parseEvaluationResponse('{"realignmentNote": "none", "nextBestQuestion": "n/a"}');
    expect(result.realignmentNote).toBeNull();
    expect(result.nextBestQuestion).toBeNull();
  });

  it("falls back to DEFAULT on malformed output (never throws)", () => {
    expect(parseEvaluationResponse("not json at all")).toEqual(DEFAULT_TURN_EVALUATION);
    expect(parseEvaluationResponse("{ broken json ")).toEqual(DEFAULT_TURN_EVALUATION);
    expect(parseEvaluationResponse("")).toEqual(DEFAULT_TURN_EVALUATION);
  });
});
