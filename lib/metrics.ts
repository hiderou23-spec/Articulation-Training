import type { AudioMetrics, TranscriptMetrics, Scores } from "./types";

const FILLERS = ["um", "uh", "erm", "er", "ah", "like", "you know", "i mean", "sort of", "kind of", "basically", "actually", "so yeah"];
const HEDGES = ["i think", "maybe", "perhaps", "probably", "might", "i guess", "possibly", "potentially", "somewhat", "a little bit", "i feel like"];

function countPhrase(text: string, phrase: string): number {
  const re = new RegExp(`(^|[^a-z'])${phrase.replace(/ /g, "\\s+")}(?=$|[^a-z'])`, "g");
  return (text.match(re) || []).length;
}

export function splitSentences(t: string): string[] {
  return t
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length > 0);
}

export function wordCount(t: string): number {
  return t.trim() ? t.trim().split(/\s+/).length : 0;
}

export function transcriptMetrics(transcript: string, speakingSec: number | null): TranscriptMetrics {
  const lower = ` ${transcript.toLowerCase()} `;
  const fillers: Record<string, number> = {};
  let fillerCount = 0;
  for (const f of FILLERS) {
    const n = countPhrase(lower, f);
    // "like" / "actually" / "kind of" are also legitimate words; only count when frequent-ish
    if (n > 0) {
      fillers[f] = n;
      fillerCount += n;
    }
  }
  let hedgeCount = 0;
  for (const h of HEDGES) hedgeCount += countPhrase(lower, h);
  const words = wordCount(transcript);
  // Browser STT rarely adds punctuation: fall back to ~18-word chunks so sentence stats stay meaningful.
  let sentences = splitSentences(transcript);
  if (sentences.length <= 1 && words > 30) {
    const w = transcript.trim().split(/\s+/);
    sentences = [];
    for (let i = 0; i < w.length; i += 18) sentences.push(w.slice(i, i + 18).join(" "));
  }
  const lens = sentences.map(wordCount);
  return {
    wordCount: words,
    wpm: speakingSec && speakingSec > 3 ? Math.round((words / speakingSec) * 60) : null,
    fillerCount,
    fillers,
    hedgeCount,
    avgSentenceWords: lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 0,
    longestSentenceWords: lens.length ? Math.max(...lens) : 0,
    firstSentenceWords: lens[0] ?? 0,
  };
}

/**
 * Delivery is estimated ONLY from measured audio timing (pace, pauses) plus disfluency markers.
 * Pronunciation quality is never inferred from text.
 */
export function deliveryScore(audio: AudioMetrics, text: TranscriptMetrics): { score: number; note: string } {
  if (!audio.available) {
    return { score: 5, note: "Delivery not assessed: audio analysis unavailable on this device." };
  }
  let score = 8;
  const notes: string[] = [];
  const wpm = text.wpm;
  if (wpm !== null) {
    if (wpm > 185) { score -= 2; notes.push(`fast pace (~${wpm} wpm)`); }
    else if (wpm > 165) { score -= 1; notes.push(`slightly fast (~${wpm} wpm)`); }
    else if (wpm < 95) { score -= 2; notes.push(`slow pace (~${wpm} wpm)`); }
    else if (wpm < 115) { score -= 1; notes.push(`slightly slow (~${wpm} wpm)`); }
    else notes.push(`comfortable pace (~${wpm} wpm)`);
  }
  if (audio.longestPauseSec > 4) { score -= 2; notes.push(`a ${audio.longestPauseSec.toFixed(1)}s hesitation`); }
  else if (audio.longestPauseSec > 2.5) { score -= 1; notes.push(`a ${audio.longestPauseSec.toFixed(1)}s pause`); }
  const perMin = audio.durationSec > 0 ? (text.fillerCount / audio.durationSec) * 60 : 0;
  if (perMin > 6) { score -= 2; notes.push(`${text.fillerCount} filler words`); }
  else if (perMin > 3) { score -= 1; notes.push(`${text.fillerCount} filler words`); }
  if (audio.pauseCount >= 2 && audio.longestPauseSec <= 2.5 && perMin <= 3) { score += 1; notes.push("good use of short pauses"); }
  return {
    score: Math.max(1, Math.min(10, score)),
    note: `Measured from audio timing: ${notes.join(", ") || "no issues detected"}. Pronunciation is not scored.`,
  };
}

const VAGUE = ["thing", "things", "stuff", "good", "bad", "very", "really", "a lot", "something"];

export function vagueWordCount(transcript: string): number {
  const lower = ` ${transcript.toLowerCase()} `;
  return VAGUE.reduce((n, w) => n + countPhrase(lower, w), 0);
}

/** Transcript-only heuristic scores used in demo mode (clearly labelled as simulated). */
export function heuristicScores(
  transcript: string,
  text: TranscriptMetrics,
  targetSec: number,
  audio: AudioMetrics,
  cues: { conclusion: boolean; example: boolean; reasons: boolean; pointFirst: boolean },
): Omit<Scores, "delivery"> {
  const tooShort = text.wordCount < 25;
  let clarity = 6 + (cues.pointFirst ? 2 : 0);
  if (text.firstSentenceWords > 30) clarity -= 1.5;
  if (text.hedgeCount > 3) clarity -= 1;
  if (tooShort) clarity -= 2;
  let structure = 4 + (cues.pointFirst ? 1.5 : 0) + (cues.reasons ? 1.5 : 0) + (cues.example ? 1.5 : 0) + (cues.conclusion ? 1.5 : 0);
  if (tooShort) structure -= 2;
  let conciseness = 7.5;
  if (text.avgSentenceWords > 25) conciseness -= 2;
  else if (text.avgSentenceWords > 18) conciseness -= 1;
  if (audio.durationSec > targetSec * 1.15) conciseness -= 1;
  if (text.fillerCount + text.hedgeCount > 6) conciseness -= 1.5;
  const vaguePer100 = text.wordCount ? (vagueWordCount(transcript) / text.wordCount) * 100 : 0;
  let vocabulary = 7 - Math.min(3, vaguePer100 / 2);
  if (tooShort) vocabulary -= 1;
  const r = (n: number) => Math.max(1, Math.min(10, Math.round(n * 10) / 10));
  return { clarity: r(clarity), structure: r(structure), conciseness: r(conciseness), vocabulary: r(vocabulary) };
}
