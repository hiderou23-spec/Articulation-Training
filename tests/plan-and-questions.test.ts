import { describe, expect, it } from "vitest";
import { PLANS, Stopwatch, totalTargetSec } from "@/lib/plan";
import { pickQuestion, QUESTIONS } from "@/lib/questions";
import { WEAKNESS_INFO } from "@/lib/rubric";

describe("session plans", () => {
  it("match the 5/10/15 minute budgets", () => {
    expect(totalTargetSec(5)).toBe(300);
    expect(totalTargetSec(10)).toBe(600);
    expect(totalTargetSec(15)).toBe(900);
  });
  it("retry is half the initial speaking time", () => {
    for (const p of Object.values(PLANS)) expect(p.retrySec).toBe(p.speakSec / 2);
  });
});

describe("Stopwatch", () => {
  it("excludes paused time", () => {
    let now = 0;
    const w = new Stopwatch(() => now);
    w.start(); now = 1000; w.pause(); now = 61000; w.start(); now = 63000;
    expect(w.elapsedMs()).toBe(3000);
  });
});

describe("pickQuestion", () => {
  it("targets a due weakness", () => {
    const q = pickQuestion({ focus: "everyday", difficulty: 2, dueTag: "hedging", recentIds: [], random: () => 0 });
    expect(q.targets?.includes("hedging") || q.module === WEAKNESS_INFO.hedging.module).toBe(true);
  });
  it("honours a forced module and avoids recent questions", () => {
    const recent = QUESTIONS.filter((q) => q.module === "concise").slice(0, 3).map((q) => q.id);
    const q = pickQuestion({ focus: "business", difficulty: 2, module: "concise", recentIds: recent, random: () => 0.5 });
    expect(q.module).toBe("concise");
    expect(recent).not.toContain(q.id);
  });
});
