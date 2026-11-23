import type { DimensionKey, Scores, WeaknessTag, ModuleId } from "./types";

export const WEIGHTS: Record<DimensionKey, number> = {
  clarity: 0.25,
  structure: 0.25,
  conciseness: 0.2,
  vocabulary: 0.15,
  delivery: 0.15,
};

export const DIMENSION_LABEL: Record<DimensionKey, string> = {
  clarity: "Clarity",
  structure: "Structure",
  conciseness: "Conciseness",
  vocabulary: "Expression",
  delivery: "Delivery",
};

export function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 5;
  return Math.max(0, Math.min(10, Math.round(v * 10) / 10));
}

/** Weighted overall on a 0–100 scale. */
export function overallScore(s: Scores): number {
  let total = 0;
  for (const k of Object.keys(WEIGHTS) as DimensionKey[]) total += clampScore(s[k]) * WEIGHTS[k];
  return Math.round(total * 10);
}

export const WEAKNESS_INFO: Record<WeaknessTag, { label: string; drill: string; module: ModuleId }> = {
  buried_lead: { label: "Conclusion comes too late", drill: "State your answer in the first sentence.", module: "structure" },
  no_clear_point: { label: "No single main point", drill: "Finish the sentence: “My point is…” before anything else.", module: "structure" },
  missing_reasons: { label: "Reasons are thin", drill: "Give exactly two reasons: “First… Second…”.", module: "structure" },
  missing_example: { label: "No concrete example", drill: "Add one specific example: a number, a name, or a moment.", module: "story" },
  weak_conclusion: { label: "Ending fades out", drill: "Close by restating your point in one short sentence.", module: "structure" },
  rambling: { label: "Ideas drift", drill: "Use a framework (PREP) and stop when you reach the last P.", module: "spontaneous" },
  verbose: { label: "Too many words", drill: "Say it again in half the time.", module: "concise" },
  hedging: { label: "Over-hedging", drill: "Replace “I think maybe…” with “I recommend…”.", module: "persuasive" },
  filler_words: { label: "Frequent fillers", drill: "Pause silently instead of saying “um” or “like”.", module: "delivery" },
  vague_wording: { label: "Vague word choice", drill: "Swap general words (thing, stuff, good) for precise ones.", module: "concise" },
  grammar_pattern: { label: "Recurring grammar slip", drill: "Slow down on the pattern flagged in your last session.", module: "spontaneous" },
  pace_too_fast: { label: "Speaking too fast", drill: "Pause after each key phrase. Aim for 130–160 wpm.", module: "delivery" },
  pace_too_slow: { label: "Pace drags", drill: "Chunk phrases and keep momentum between them.", module: "delivery" },
  long_pauses: { label: "Long hesitations", drill: "Buy time with a bridge: “The short answer is…”.", module: "spontaneous" },
};

export const WEAKNESS_TAGS = Object.keys(WEAKNESS_INFO) as WeaknessTag[];

export function isWeaknessTag(t: unknown): t is WeaknessTag {
  return typeof t === "string" && (WEAKNESS_TAGS as string[]).includes(t);
}
