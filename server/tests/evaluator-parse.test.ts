import { describe, expect, it } from "vitest";
import {
  extractJsonObjectString,
  normalizeLooseBoolean,
  normalizeLooseText,
  normalizeScore,
} from "../src/services/evaluator/evaluator.parse.js";

describe("loose JSON parsing primitives", () => {
  it("extracts a fenced ```json block", () => {
    const raw = '```json\n{"understandingScore": 80}\n```';
    expect(extractJsonObjectString(raw)).toBe('{"understandingScore": 80}');
  });

  it("extracts a bare object from surrounding prose", () => {
    const raw = 'Here: {"onTrack": false, "rationale": "vague"} thanks';
    expect(extractJsonObjectString(raw)).toBe('{"onTrack": false, "rationale": "vague"}');
  });

  it("returns null for non-JSON", () => {
    expect(extractJsonObjectString("no json here")).toBeNull();
    expect(extractJsonObjectString("")).toBeNull();
  });

  it("normalizes loose booleans", () => {
    expect(normalizeLooseBoolean("yes", false)).toBe(true);
    expect(normalizeLooseBoolean("0", true)).toBe(false);
    expect(normalizeLooseBoolean("maybe", true)).toBe(true); // fallback
  });

  it("clamps scores to 0-100 and rounds", () => {
    expect(normalizeScore(140)).toBe(100);
    expect(normalizeScore(-5)).toBe(0);
    expect(normalizeScore("72.6")).toBe(73);
    expect(normalizeScore("null")).toBeNull();
    expect(normalizeScore(undefined)).toBeNull();
  });

  it("treats null-ish text as null", () => {
    expect(normalizeLooseText("none", 100)).toBeNull();
    expect(normalizeLooseText("n/a", 100)).toBeNull();
    expect(normalizeLooseText("  steer back  ", 100)).toBe("steer back");
  });
});
