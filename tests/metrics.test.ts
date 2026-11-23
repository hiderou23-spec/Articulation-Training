import { describe, expect, it } from "vitest";
import { deliveryScore, transcriptMetrics } from "@/lib/metrics";

describe("transcriptMetrics", () => {
  it("counts fillers and hedges as whole words", () => {
    const m = transcriptMetrics("Um, I think maybe we should, uh, likely revisit the umbrella deal. You know, basically.", 10);
    expect(m.fillers.um).toBe(1);
    expect(m.fillers.uh).toBe(1);
    expect(m.fillers["you know"]).toBe(1);
    expect(m.fillerCount).toBe(4);
    expect(m.hedgeCount).toBe(2); // "i think", "maybe" — not "likely"
  });
  it("computes words per minute from speaking time", () => {
    const m = transcriptMetrics(Array(150).fill("word").join(" "), 60);
    expect(m.wpm).toBe(150);
  });
  it("chunks unpunctuated speech-recognition output", () => {
    const m = transcriptMetrics(Array(54).fill("word").join(" "), 30);
    expect(m.avgSentenceWords).toBe(18);
  });
});

describe("deliveryScore", () => {
  const text = transcriptMetrics(Array(140).fill("word").join(" "), 60);
  it("never scores delivery without audio analysis", () => {
    const d = deliveryScore({ durationSec: 60, speakingSec: 0, longestPauseSec: 0, pauseCount: 0, available: false }, text);
    expect(d.score).toBe(5);
    expect(d.note).toMatch(/not assessed/);
  });
  it("penalises long hesitations", () => {
    const good = deliveryScore({ durationSec: 60, speakingSec: 60, longestPauseSec: 1, pauseCount: 0, available: true }, text);
    const hesitant = deliveryScore({ durationSec: 60, speakingSec: 60, longestPauseSec: 5, pauseCount: 3, available: true }, text);
    expect(hesitant.score).toBeLessThan(good.score);
    expect(good.note).toMatch(/Pronunciation is not scored/);
  });
});
