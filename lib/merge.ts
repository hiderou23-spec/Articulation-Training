import type { Analysis, Attempt, Question } from "./types";
import { clampScore, isWeaknessTag, overallScore } from "./rubric";
import { deliveryScore } from "./metrics";
import { demoAnalysis } from "./demo";

const str = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim() : fallback);

/**
 * Turn raw model JSON into a safe Analysis. Anything missing falls back to the
 * heuristic result, and delivery is always the audio-measured score.
 */
export function mergeAiAnalysis(raw: Record<string, unknown> | null, q: Question, a: Attempt, targetSec: number, previous?: Attempt): Analysis {
  const fallback = demoAnalysis(q, a, targetSec, previous);
  if (!raw) return fallback;
  const s = (raw.scores ?? {}) as Record<string, unknown>;
  const del = deliveryScore(a.audio, a.text);
  const scores = {
    clarity: s.clarity !== undefined ? clampScore(s.clarity) : fallback.scores.clarity,
    structure: s.structure !== undefined ? clampScore(s.structure) : fallback.scores.structure,
    conciseness: s.conciseness !== undefined ? clampScore(s.conciseness) : fallback.scores.conciseness,
    vocabulary: s.vocabulary !== undefined ? clampScore(s.vocabulary) : fallback.scores.vocabulary,
    delivery: del.score,
  };
  const st = (raw.structure ?? {}) as Record<string, unknown>;
  const imp = (raw.improvement ?? {}) as Record<string, unknown>;
  return {
    scores,
    overall: overallScore(scores),
    strength: str(raw.strength, fallback.strength),
    improvement: {
      tag: isWeaknessTag(imp.tag) ? imp.tag : fallback.improvement.tag,
      text: str(imp.text, fallback.improvement.text),
    },
    improvedVersion: str(raw.improvedVersion, fallback.improvedVersion),
    whyBetter: str(raw.whyBetter, ""),
    retryChallenge: str(raw.retryChallenge, fallback.retryChallenge),
    structure: {
      mainPoint: typeof st.mainPoint === "boolean" ? st.mainPoint : fallback.structure.mainPoint,
      reasons: typeof st.reasons === "boolean" ? st.reasons : fallback.structure.reasons,
      example: typeof st.example === "boolean" ? st.example : fallback.structure.example,
      conclusion: typeof st.conclusion === "boolean" ? st.conclusion : fallback.structure.conclusion,
    },
    deliveryNote: del.note,
    progressNote: previous ? str(raw.progressNote, fallback.progressNote ?? "") || undefined : undefined,
    followUp: str(raw.followUp, fallback.followUp ?? ""),
    source: "ai",
  };
}
