import { describe, expect, it } from "vitest";
import { overallScore, WEIGHTS, clampScore } from "@/lib/rubric";

describe("rubric", () => {
  it("weights sum to 1", () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
  it("computes a weighted 0–100 overall", () => {
    expect(overallScore({ clarity: 10, structure: 10, conciseness: 10, vocabulary: 10, delivery: 10 })).toBe(100);
    expect(overallScore({ clarity: 10, structure: 0, conciseness: 0, vocabulary: 0, delivery: 0 })).toBe(25);
    expect(overallScore({ clarity: 0, structure: 0, conciseness: 0, vocabulary: 0, delivery: 10 })).toBe(15);
  });
  it("clamps bad model output", () => {
    expect(clampScore(14)).toBe(10);
    expect(clampScore(-2)).toBe(0);
    expect(clampScore("7")).toBe(5);
  });
});
