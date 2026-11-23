import type { Analysis, Attempt, Question, StructureCheck, WeaknessTag } from "./types";
import { heuristicScores, splitSentences, deliveryScore } from "./metrics";
import { overallScore, WEAKNESS_INFO } from "./rubric";

const POINT_RE = /\b(i recommend|i believe|i'd argue|my point|the (short )?answer|we should|the (biggest|main|key)|my view|i'd say|in my opinion|the bottom line|yes|no)\b/i;
const REASON_RE = /\b(because|first(ly)?|second(ly)?|the reason|since|due to|that's why|another reason)\b/i;
const EXAMPLE_RE = /\b(for example|for instance|such as|e\.g\.|last (year|month|quarter|week)|when we|at my company|in my experience|\d+ ?%|\d{2,})\b/i;
const CONCL_RE = /\b(so|therefore|in short|that's why|to sum up|in conclusion|bottom line|overall|which is why|ultimately)\b/i;

export function detectCues(transcript: string) {
  const sentences = splitSentences(transcript);
  const first = (sentences[0] || transcript).split(/\s+/).slice(0, 25).join(" ");
  const words = transcript.split(/\s+/);
  const tail = words.slice(Math.floor(words.length * 0.7)).join(" ");
  return {
    pointFirst: POINT_RE.test(first),
    reasons: REASON_RE.test(transcript),
    example: EXAMPLE_RE.test(transcript),
    conclusion: CONCL_RE.test(tail) && words.length > 20,
  };
}

const CLEAN_RE = /\b(um+|uh+|erm|er|ah|you know|i mean|sort of|kind of|basically|i guess|i think that maybe|i think maybe|maybe|perhaps|potentially|actually)\b[,]?\s*/gi;

function tidy(s: string) {
  const t = s.replace(CLEAN_RE, "").replace(/\s{2,}/g, " ").replace(/\s+([,.!?])/g, "$1").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

export function demoAnalysis(q: Question, a: Attempt, targetSec: number, previous?: Attempt): Analysis {
  const cues = detectCues(a.transcript);
  const base = heuristicScores(a.transcript, a.text, targetSec, a.audio, cues);
  const del = deliveryScore(a.audio, a.text);
  const scores = { ...base, delivery: del.score };
  const structure: StructureCheck = { mainPoint: cues.pointFirst, reasons: cues.reasons, example: cues.example, conclusion: cues.conclusion };

  // Choose the single biggest weakness.
  let tag: WeaknessTag;
  if (a.text.wordCount < 25) tag = "no_clear_point";
  else if (!cues.pointFirst) tag = "buried_lead";
  else if (a.text.fillerCount >= 5) tag = "filler_words";
  else if (a.text.hedgeCount >= 4) tag = "hedging";
  else if (!cues.example) tag = "missing_example";
  else if (!cues.reasons) tag = "missing_reasons";
  else if (a.text.avgSentenceWords > 24) tag = "verbose";
  else if (a.audio.available && a.audio.longestPauseSec > 3.5) tag = "long_pauses";
  else if (a.text.wpm && a.text.wpm > 175) tag = "pace_too_fast";
  else if (!cues.conclusion) tag = "weak_conclusion";
  else tag = "verbose";

  const strengths: string[] = [];
  if (cues.pointFirst) strengths.push("You stated a position early, so the listener knew where you were going.");
  if (cues.example) strengths.push("You grounded your answer in a concrete example.");
  if (cues.reasons) strengths.push("You signposted your reasoning (e.g. “because”, “first”).");
  if (a.text.fillerCount <= 1 && a.text.wordCount > 30) strengths.push("Very few filler words.");
  const strength = strengths[0] ?? "You kept going and completed an answer under time pressure — that's the raw material we can shape.";

  const sentences = splitSentences(a.transcript).map(tidy).filter(Boolean);
  const pointIdx = sentences.findIndex((s) => POINT_RE.test(s) || CONCL_RE.test(s));
  const lead = pointIdx >= 0 ? sentences[pointIdx] : sentences[sentences.length - 1] || "";
  const rest = sentences.filter((_, i) => i !== pointIdx).slice(0, 3);
  const improvedVersion =
    a.text.wordCount < 8
      ? "(Demo mode needs a longer answer to rewrite. Connect an AI provider for full rewrites.)"
      : [lead, ...rest, lead && rest.length ? "That's why this matters." : ""].filter(Boolean).join(" ");

  const fix = WEAKNESS_INFO[tag];
  const half = Math.max(15, Math.round(targetSec / 2));
  let progressNote: string | undefined;
  if (previous?.analysis) {
    const delta = overallScore(scores) - previous.analysis.overall;
    const wordsDelta = a.text.wordCount - previous.text.wordCount;
    progressNote = `${delta >= 0 ? "+" : ""}${delta} points vs your first attempt; ${Math.abs(wordsDelta)} ${wordsDelta <= 0 ? "fewer" : "more"} words. ${
      previous.analysis.improvement.tag === tag ? `“${fix.label}” is still the main thing to fix.` : `You addressed “${WEAKNESS_INFO[previous.analysis.improvement.tag].label}”.`
    }`;
  }

  return {
    scores,
    overall: overallScore(scores),
    strength,
    improvement: { tag, text: `${fix.label}. ${fix.drill}` },
    improvedVersion,
    whyBetter: "Simulated rewrite: fillers and hedges removed, main point moved to the front. A real AI coach will rewrite in polished English while keeping your meaning.",
    retryChallenge: `Say it again in ${half} seconds. ${fix.drill} Don't read the rewrite — use your own words.`,
    structure,
    deliveryNote: del.note,
    progressNote,
    followUp: q.module === "persuasive" ? "What's the biggest risk in your plan, and how would you mitigate it?" : "Can you give me one concrete example that supports your main point?",
    source: "demo",
  };
}
