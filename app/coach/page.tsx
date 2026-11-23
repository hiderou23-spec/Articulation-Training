"use client";
import Link from "next/link";
import { useAppData } from "@/lib/useApp";
import { dueWeaknesses, isMastered, rankWeaknesses } from "@/lib/srs";
import { DIMENSION_LABEL, WEAKNESS_INFO } from "@/lib/rubric";
import { FOCUS_LABEL, MODULE_INFO } from "@/lib/questions";
import { dimensionAverages, minutesByDay } from "@/lib/stats";
import type { DimensionKey } from "@/lib/types";
import { Icon } from "@/components/Icon";

function when(t: number) {
  const days = Math.round((t - Date.now()) / 86_400_000);
  if (days <= 0) return "due now";
  return days === 1 ? "in 1 day" : `in ${days} days`;
}

export default function CoachPage() {
  const { ready, weaknesses, sessions, settings } = useAppData();
  if (!ready) return null;
  const due = dueWeaknesses(weaknesses);
  const ranked = rankWeaknesses(weaknesses);
  const dims = dimensionAverages(sessions);
  const weakestDim = dims ? (Object.keys(dims) as DimensionKey[]).sort((a, b) => dims[a].recent - dims[b].recent)[0] : null;
  const activeDays = minutesByDay(sessions, 7).filter((d) => d.minutes > 0).length;
  const top = ranked[0];

  const recommendation = !sessions.length
    ? "Start with three 5-minute sessions this week. The coach will learn your patterns from them."
    : `${activeDays >= 5 ? "Strong consistency this week." : `You practised on ${activeDays} of the last 7 days — aim for 5.`} ${
        top ? `Your most persistent pattern is “${WEAKNESS_INFO[top.tag].label.toLowerCase()}”. ${WEAKNESS_INFO[top.tag].drill}` : ""
      } ${weakestDim ? `Your lowest-scoring dimension is ${DIMENSION_LABEL[weakestDim].toLowerCase()}.` : ""}`;

  return (
    <div className="space-y-5 pt-4">
      <h1 className="text-2xl font-semibold tracking-tight">Your coach</h1>

      <section className="card p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">This week&apos;s recommendation</p>
        <p className="mt-2 text-[15px] leading-relaxed">{recommendation}</p>
        <p className="mt-3 text-xs text-ink-3">Goal: {FOCUS_LABEL[settings.focus]} · {settings.dailyGoalMin} min/day · change in Settings</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold">Due for review {due.length ? `(${due.length})` : ""}</h2>
        {due.length === 0 ? (
          <p className="card p-4 text-sm text-ink-2">{weaknesses.length ? "Nothing due. Your next session will pick a fresh challenge." : "Weaknesses the coach spots will appear here and come back on a spaced schedule — like flashcards for your speaking habits."}</p>
        ) : (
          <ul className="space-y-2">
            {due.map((c) => (
              <li key={c.tag} className="card flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="font-medium">{WEAKNESS_INFO[c.tag].label}</p>
                  <p className="text-sm text-ink-2">{WEAKNESS_INFO[c.tag].drill}</p>
                </div>
                <Link href={`/practice?d=5`} className="shrink-0 rounded-full bg-accent p-3 text-accent-ink" aria-label={`Practise ${WEAKNESS_INFO[c.tag].label}`}><Icon name="mic" size={18} /></Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {ranked.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">Patterns the coach is tracking</h2>
          <ul className="card divide-y divide-line">
            {ranked.map((c) => (
              <li key={c.tag} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{WEAKNESS_INFO[c.tag].label}</p>
                  <p className="text-xs text-ink-3">Seen {c.seen}× · next review {when(c.due)}</p>
                </div>
                {isMastered(c) ? <span className="pill bg-good/15 px-2.5 py-1 text-xs text-good">Improving</span> : c.lapses >= 2 ? <span className="pill bg-warn/15 px-2.5 py-1 text-xs text-warn">Recurring</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-semibold">Recommended exercises</h2>
        <div className="grid grid-cols-2 gap-2">
          {(top ? [WEAKNESS_INFO[top.tag].module] : []).concat((["structure", "concise", "persuasive", "spontaneous", "story", "delivery"] as const).filter((m) => !top || m !== WEAKNESS_INFO[top.tag].module)).slice(0, 4).map((m) => (
            <Link key={m} href={`/practice?d=5&m=${m}`} className="card p-4">
              <p className="text-sm font-semibold">{MODULE_INFO[m].short}</p>
              <p className="mt-1 text-xs text-ink-3">{MODULE_INFO[m].tip}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
