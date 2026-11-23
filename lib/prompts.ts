import type { Attempt, Question } from "./types";
import { WEAKNESS_TAGS } from "./rubric";
import { MODULE_INFO } from "./questions";

export const COACH_SYSTEM = `You are "Articulate", an executive communication coach for an experienced Japanese business professional who uses English in international meetings. You coach ARTICULATION OF IDEAS first (clarity, structure, concision, persuasion), English expression second.

Personality: encouraging but direct, concise, specific, professional. Never give generic praise ("Great job!"). Reference what the speaker actually said, with timing or wording details.

Rules:
- Exactly ONE strength and ONE biggest improvement — the single change that would help most.
- The improved version must preserve the speaker's meaning and ideas; do not invent facts. Natural, polished spoken English a senior executive would say. Keep it shorter than the original when possible.
- The transcript comes from speech recognition: ignore missing punctuation and obvious recognition errors. NEVER judge pronunciation from text.
- Scores are coaching estimates on 0–10 for clarity, structure, conciseness, vocabulary (word choice & expression). Do not score delivery — it is measured from audio separately.
- Output ONLY a JSON object, no prose, no markdown fences.`;

export function analysisPrompt(opts: { question: Question; attempt: Attempt; targetSec: number; previous?: Attempt; notesLanguage: "en" | "ja"; isFollowUp?: boolean }) {
  const { question, attempt, previous } = opts;
  const mod = MODULE_INFO[question.module];
  const lines = [
    `Module: ${mod.name}. ${question.framework ? `Suggested framework: ${question.framework}.` : ""}`,
    question.context ? `Role-play context: ${question.context}` : "",
    `Question: "${question.text}"`,
    `Time limit: ${opts.targetSec}s. Actual: ${Math.round(attempt.durationSec)}s, ${attempt.text.wordCount} words, ${attempt.text.fillerCount} fillers, ${attempt.text.hedgeCount} hedges.`,
    `Transcript: """${attempt.transcript.slice(0, 6000)}"""`,
  ];
  if (previous) {
    lines.push(
      `This is a RETRY. First attempt transcript: """${previous.transcript.slice(0, 4000)}"""`,
      `First attempt's main weakness was: ${previous.analysis?.improvement.tag} — ${previous.analysis?.improvement.text}`,
      `In "progressNote", say concretely what improved and what didn't (one or two sentences).`,
    );
  }
  if (opts.isFollowUp) lines.push(`This answer responds to a follow-up question from a stakeholder. Judge whether it answered directly.`);
  lines.push(
    "",
    `Return JSON with exactly these keys:
{
 "scores": {"clarity": n, "structure": n, "conciseness": n, "vocabulary": n},
 "structure": {"mainPoint": bool, "reasons": bool, "example": bool, "conclusion": bool},
 "strength": "one specific strength",
 "improvement": {"tag": one of [${WEAKNESS_TAGS.join(", ")}], "text": "the single most important fix, specific and actionable"},
 "improvedVersion": "rewritten answer",
 "whyBetter": "1–2 sentences",
 "retryChallenge": "instruction for the next attempt, ideally with a tighter time limit, telling them not to read the rewrite",
 "followUp": "a realistic, probing follow-up question a stakeholder would ask next",
 "progressNote": ${previous ? '"what changed vs first attempt"' : "null"}
}`,
    opts.notesLanguage === "ja"
      ? `Write "strength", "improvement.text", "whyBetter" and "retryChallenge" in Japanese with key English phrases kept in English. "improvedVersion" and "followUp" MUST be English.`
      : `Write everything in English.`,
  );
  return lines.filter(Boolean).join("\n");
}

export function questionPrompt(opts: { module: string; focus: string; difficulty: number; weakness?: string; avoid: string[] }) {
  return `Write ONE fresh speaking question for articulation practice.
Module: ${opts.module}. Focus area: ${opts.focus}. Difficulty ${opts.difficulty}/3.
${opts.weakness ? `It should give the speaker a chance to practise fixing: ${opts.weakness}.` : ""}
The speaker is a Japanese professional working on product strategy, partnerships, payments and executive meetings.
Avoid these questions: ${opts.avoid.slice(0, 8).map((a) => `"${a}"`).join("; ")}
Return ONLY JSON: {"text": "...", "framework": "PREP|SCQA|Pyramid Principle|Problem → Analysis → Recommendation|Claim → Evidence → Implication|null", "context": "role-play stakeholder description or null"}`;
}
