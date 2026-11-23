import type { DimensionKey, Session } from "./types";

export const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function minutesByDay(sessions: Session[], days: number, now = Date.now()) {
  const map = new Map<string, number>();
  for (const s of sessions) map.set(dayKey(s.startedAt), (map.get(dayKey(s.startedAt)) ?? 0) + s.activeSec / 60);
  const out: { day: string; label: string; minutes: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = now - i * 86_400_000;
    const k = dayKey(t);
    out.push({ day: k, label: new Date(t).toLocaleDateString("en", { weekday: "narrow" }), minutes: Math.round((map.get(k) ?? 0) * 10) / 10 });
  }
  return out;
}

/** Consecutive days with at least one completed session, counting today or yesterday as the head. */
export function streak(sessions: Session[], now = Date.now()): number {
  const days = new Set(sessions.filter((s) => s.finishedAt).map((s) => dayKey(s.startedAt)));
  let n = 0;
  let t = now;
  if (!days.has(dayKey(t))) t -= 86_400_000; // today not done yet: streak still alive
  while (days.has(dayKey(t))) {
    n++;
    t -= 86_400_000;
  }
  return n;
}

export function todayMinutes(sessions: Session[], now = Date.now()) {
  const k = dayKey(now);
  return sessions.filter((s) => dayKey(s.startedAt) === k).reduce((a, s) => a + s.activeSec / 60, 0);
}

/** Per-session first-attempt scores (comparable rubric), oldest → newest. */
export function scoreSeries(sessions: Session[]) {
  return [...sessions]
    .filter((s) => s.attempts[0]?.analysis)
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => ({ t: s.startedAt, first: s.attempts[0].analysis!.overall, retry: s.attempts[1]?.analysis?.overall ?? null, scores: s.attempts[0].analysis!.scores }));
}

export function dimensionAverages(sessions: Session[], lastN = 7): Record<DimensionKey, { recent: number; earlier: number | null }> | null {
  const series = scoreSeries(sessions);
  if (!series.length) return null;
  const recent = series.slice(-lastN);
  const earlier = series.slice(0, -lastN).slice(-lastN);
  const avg = (arr: typeof series, k: DimensionKey) => (arr.length ? Math.round((arr.reduce((a, x) => a + x.scores[k], 0) / arr.length) * 10) / 10 : null);
  const keys: DimensionKey[] = ["clarity", "structure", "conciseness", "vocabulary", "delivery"];
  return Object.fromEntries(keys.map((k) => [k, { recent: avg(recent, k)!, earlier: avg(earlier, k) }])) as Record<DimensionKey, { recent: number; earlier: number | null }>;
}

export function personalBest(sessions: Session[]) {
  let best: { session: Session; score: number } | null = null;
  for (const s of sessions) for (const a of s.attempts) if (a.analysis && (!best || a.analysis.overall > best.score)) best = { session: s, score: a.analysis.overall };
  return best;
}
