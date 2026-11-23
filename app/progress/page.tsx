"use client";
import { useState } from "react";
import { useAppData } from "@/lib/useApp";
import { dimensionAverages, minutesByDay, personalBest, scoreSeries, streak } from "@/lib/stats";
import { DIMENSION_LABEL, WEAKNESS_INFO } from "@/lib/rubric";
import { MODULE_INFO } from "@/lib/questions";
import { deleteSession } from "@/lib/storage";
import { MinutesBars, ScoreLines } from "@/components/Charts";
import { Player } from "@/components/Player";
import type { DimensionKey, Session } from "@/lib/types";

export default function ProgressPage() {
  const { ready, sessions, settings, reload } = useAppData();
  const [open, setOpen] = useState<string | null>(null);
  if (!ready) return null;

  const week = minutesByDay(sessions, 7);
  const weekMin = week.reduce((a, d) => a + d.minutes, 0);
  const activeDays = week.filter((d) => d.minutes > 0).length;
  const series = scoreSeries(sessions).slice(-30);
  const dims = dimensionAverages(sessions);
  const best = personalBest(sessions);
  const tagCounts = new Map<string, number>();
  sessions.forEach((s) => { const t = s.attempts[0]?.analysis?.improvement.tag; if (t) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1); });
  const recurring = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <div className="space-y-5 pt-4">
      <h1 className="text-2xl font-semibold tracking-tight">Progress</h1>
      {!sessions.length && <p className="card p-5 text-ink-2">No sessions yet. Your first 5-minute session will start your history.</p>}

      <div className="grid grid-cols-2 gap-3">
        <Tile label="Minutes this week" value={weekMin.toFixed(0)} />
        <Tile label="Active days (7)" value={`${activeDays}/7`} />
        <Tile label="Sessions" value={String(sessions.length)} />
        <Tile label="Streak" value={`${streak(sessions)} d`} />
      </div>

      <section className="card p-4">
        <h2 className="mb-2 text-sm font-semibold">Daily practice · last 14 days</h2>
        <MinutesBars data={minutesByDay(sessions, 14)} goal={settings.dailyGoalMin} />
      </section>

      <section className="card p-4">
        <h2 className="text-sm font-semibold">Overall score per session</h2>
        <p className="mb-2 text-[11px] text-ink-3">AI coaching estimates on a consistent rubric — a direction, not a precise measurement.</p>
        <ScoreLines data={series} />
      </section>

      {dims && (
        <section className="card p-4">
          <h2 className="mb-3 text-sm font-semibold">Skills · last 7 sessions{Object.values(dims).some((d) => d.earlier !== null) ? " vs the 7 before" : ""}</h2>
          <ul className="space-y-2 text-sm">
            {(Object.keys(dims) as DimensionKey[]).map((k) => {
              const d = dims[k];
              const delta = d.earlier !== null ? Math.round((d.recent - d.earlier) * 10) / 10 : null;
              return (
                <li key={k} className="flex items-center justify-between">
                  <span className="text-ink-2">{DIMENSION_LABEL[k]}</span>
                  <span className="tabular">{d.recent.toFixed(1)}{delta !== null && <span className={`ml-2 text-xs ${delta >= 0 ? "text-good" : "text-warn"}`}>{delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}</span>}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(recurring.length > 0 || best) && (
        <section className="card space-y-3 p-4">
          {best && <p className="text-sm"><span className="text-ink-3">Personal best: </span><b className="tabular">{best.score}</b> on “{best.session.question.text}”</p>}
          {recurring.length > 0 && (
            <div>
              <p className="mb-1 text-sm text-ink-3">Most frequent focus areas</p>
              <ul className="flex flex-wrap gap-2">{recurring.map(([t, n]) => <li key={t} className="pill bg-surface-2 px-3 py-1 text-xs">{WEAKNESS_INFO[t as keyof typeof WEAKNESS_INFO].label} · {n}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {sessions.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold">History</h2>
          <ul className="space-y-2">
            {sessions.map((s) => <HistoryItem key={s.id} s={s} open={open === s.id} onToggle={() => setOpen(open === s.id ? null : s.id)} onDelete={() => { if (confirm("Delete this session, its transcripts and recordings?")) { deleteSession(s.id); reload(); } }} />)}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-semibold tabular">{value}</p>
      <p className="text-xs text-ink-3">{label}</p>
    </div>
  );
}

function HistoryItem({ s, open, onToggle, onDelete }: { s: Session; open: boolean; onToggle: () => void; onDelete: () => void }) {
  const a0 = s.attempts[0]?.analysis;
  const a1 = s.attempts[1]?.analysis;
  return (
    <li className="card overflow-hidden">
      <button onClick={onToggle} className="flex w-full items-center justify-between gap-3 p-4 text-left" aria-expanded={open}>
        <div className="min-w-0">
          <p className="text-xs text-ink-3">{new Date(s.startedAt).toLocaleDateString()} · {MODULE_INFO[s.question.module].short} · {Math.round(s.activeSec / 60)} min{s.demo ? " · demo" : ""}</p>
          <p className="truncate text-sm font-medium">{s.question.text}</p>
        </div>
        <span className="shrink-0 text-sm tabular text-ink-2">{a0?.overall ?? "–"}{a1 ? ` → ${a1.overall}` : ""}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-4 text-sm">
          {s.attempts.map((at, i) => (
            <div key={i} className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{["First attempt", "Retry", "Follow-up"][i]} · {at.analysis?.overall ?? "–"}</p>
              <p className="text-ink-2">{at.transcript}</p>
              {at.audioKey && <Player audioKey={at.audioKey} />}
              {i === 0 && at.analysis && <p className="text-ink-3"><span className="text-ink-2">Improved: </span>{at.analysis.improvedVersion}</p>}
            </div>
          ))}
          {s.reflection?.takeaway && <p className="text-ink-2">Takeaway: “{s.reflection.takeaway}”</p>}
          <button onClick={onDelete} className="text-xs font-medium text-rec">Delete session</button>
        </div>
      )}
    </li>
  );
}
