import { describe, expect, it } from "vitest";
import { applySessionOutcome, dueWeaknesses, flagWeakness, passWeakness } from "@/lib/srs";

const DAY = 86_400_000;
const t0 = 1_700_000_000_000;

describe("weakness spaced repetition", () => {
  it("new weakness is due tomorrow", () => {
    const c = flagWeakness([], "buried_lead", t0);
    expect(c[0].due).toBe(t0 + DAY);
    expect(dueWeaknesses(c, t0)).toHaveLength(0);
    expect(dueWeaknesses(c, t0 + DAY)).toHaveLength(1);
  });
  it("passing grows the interval, repeating resets it", () => {
    let c = flagWeakness([], "hedging", t0);
    c = passWeakness(c, "hedging", t0 + DAY);
    expect(c[0].intervalDays).toBeGreaterThanOrEqual(2);
    const grown = c[0].intervalDays;
    c = passWeakness(c, "hedging", t0 + 5 * DAY);
    expect(c[0].intervalDays).toBeGreaterThan(grown);
    c = flagWeakness(c, "hedging", t0 + 20 * DAY);
    expect(c[0].intervalDays).toBe(1);
    expect(c[0].lapses).toBe(1);
  });
  it("session outcome passes the targeted weakness when it didn't recur", () => {
    let c = flagWeakness([], "verbose", t0);
    c = applySessionOutcome(c, { targetedTag: "verbose", firstTag: "missing_example" }, t0 + DAY);
    const verbose = c.find((x) => x.tag === "verbose")!;
    expect(verbose.intervalDays).toBeGreaterThan(1);
    expect(c.find((x) => x.tag === "missing_example")).toBeTruthy();
  });
  it("session outcome lapses the targeted weakness when it recurred", () => {
    let c = flagWeakness([], "verbose", t0);
    c = applySessionOutcome(c, { targetedTag: "verbose", firstTag: "verbose" }, t0 + DAY);
    expect(c[0].lapses).toBe(1);
    expect(c[0].intervalDays).toBe(1);
  });
});
