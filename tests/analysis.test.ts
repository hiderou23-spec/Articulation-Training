import { describe, expect, it } from "vitest";
import { demoAnalysis, detectCues } from "@/lib/demo";
import { mergeAiAnalysis } from "@/lib/merge";
import { parseJsonObject } from "@/lib/json";
import { transcriptMetrics } from "@/lib/metrics";
import { QUESTIONS } from "@/lib/questions";
import type { Attempt } from "@/lib/types";

const q = QUESTIONS[0];
const mk = (t: string, sec = 50): Attempt => ({
  transcript: t,
  durationSec: sec,
  audio: { durationSec: sec, speakingSec: sec * 0.8, longestPauseSec: 1.5, pauseCount: 2, available: true },
  text: transcriptMetrics(t, sec * 0.8),
});

const buried = "Um so there are a lot of things happening in the market and you know many companies are doing different stuff with QR codes and cards and so on and the regulators are also involved so I think maybe the biggest challenge is fragmentation.";
const strong = "The biggest challenge is fragmentation. First, there are over twenty QR payment brands, so merchants and users are confused. For example, a small shop in Osaka may need five terminals. That's why consolidation will decide the winners.";

describe("demo analysis", () => {
  it("detects structure cues", () => {
    expect(detectCues(strong)).toMatchObject({ pointFirst: true, reasons: true, example: true, conclusion: true });
    expect(detectCues(buried).pointFirst).toBe(false);
  });
  it("flags a buried lead and scores the structured answer higher", () => {
    const a = demoAnalysis(q, mk(buried), 60);
    const b = demoAnalysis(q, mk(strong), 60);
    expect(a.improvement.tag).toBe("buried_lead");
    expect(b.overall).toBeGreaterThan(a.overall);
    expect(a.source).toBe("demo");
  });
  it("reports progress on a retry", () => {
    const first = mk(buried);
    first.analysis = demoAnalysis(q, first, 60);
    const r = demoAnalysis(q, mk(strong, 28), 30, first);
    expect(r.progressNote).toMatch(/vs your first attempt/);
  });
});

describe("AI output handling", () => {
  it("extracts JSON from fenced / chatty output", () => {
    expect(parseJsonObject('Sure!\n```json\n{"a": {"b": "c}"}}\n```')).toEqual({ a: { b: "c}" } });
    expect(parseJsonObject("no json")).toBeNull();
  });
  it("merges model JSON safely and keeps measured delivery", () => {
    const at = mk(strong);
    const merged = mergeAiAnalysis({ scores: { clarity: 9, structure: 12, conciseness: "x", vocabulary: 7, delivery: 1 }, improvement: { tag: "not_a_tag", text: "Lead with the number." }, strength: "Clear opening." }, q, at, 60);
    expect(merged.scores.clarity).toBe(9);
    expect(merged.scores.structure).toBe(10);
    expect(merged.scores.delivery).not.toBe(1); // model can't set delivery
    expect(merged.improvement.text).toBe("Lead with the number.");
    expect(merged.improvement.tag).not.toBe("not_a_tag");
    expect(merged.source).toBe("ai");
  });
});
