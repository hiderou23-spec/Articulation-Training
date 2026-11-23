"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAppData } from "@/lib/useApp";
import { streak, todayMinutes } from "@/lib/stats";
import { dueWeaknesses } from "@/lib/srs";
import { WEAKNESS_INFO } from "@/lib/rubric";
import { FOCUS_LABEL, MODULE_INFO } from "@/lib/questions";
import { totalTargetSec } from "@/lib/plan";
import type { Duration, ModuleId } from "@/lib/types";
import { Icon } from "@/components/Icon";
import { DemoBanner } from "@/components/DemoBanner";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const { ready, settings, sessions, weaknesses, status } = useAppData();
  const [dur, setDur] = useState<Duration>(5);
  const [module, setModule] = useState<ModuleId | "">("");
  useEffect(() => { if (ready) setDur(settings.defaultDuration); }, [ready, settings.defaultDuration]);

  const due = dueWeaknesses(weaknesses)[0];
  const mins = todayMinutes(sessions);
  const goal = settings.dailyGoalMin;
  const pct = Math.min(1, mins / goal);
  const st = streak(sessions);
  const href = `/practice?d=${dur}${module ? `&m=${module}` : ""}`;

  return (
    <div className="space-y-4 pt-4">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-sm text-ink-3">{greeting()}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s practice</h1>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium tabular" aria-label={`${st} day streak`}>
          <Icon name="flame" size={16} className={st ? "text-[var(--series-2)]" : "text-ink-3"} />
          {ready ? st : "–"} day{st === 1 ? "" : "s"}
        </div>
      </header>

      <DemoBanner status={status} />

      <section className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{due ? "Due for review" : "Today's focus"}</p>
        <p className="mt-1 text-lg font-semibold">{due ? WEAKNESS_INFO[due.tag].label : module ? MODULE_INFO[module].name : FOCUS_LABEL[settings.focus]}</p>
        <p className="mt-1 text-sm text-ink-2">{due ? WEAKNESS_INFO[due.tag].drill : module ? MODULE_INFO[module].tip : "The coach picks a question and targets your weakest skill."}</p>
      </section>

      <section aria-label="Session length">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface-2 p-1">
          {([5, 10, 15] as Duration[]).map((d) => (
            <button key={d} onClick={() => setDur(d)} aria-pressed={dur === d} className={`rounded-xl py-2.5 text-sm font-semibold transition ${dur === d ? "bg-surface text-ink shadow-sm" : "text-ink-3"}`}>
              {d} min
              <span className="block text-[11px] font-normal text-ink-3">{d === 5 ? "Quick" : d === 10 ? "Standard" : "Deep"}</span>
            </button>
          ))}
        </div>
      </section>

      <Link href={href} className="flex items-center justify-center gap-3 rounded-2xl bg-accent py-5 text-lg font-semibold text-accent-ink shadow-lg shadow-accent/20 active:scale-[0.99]">
        <Icon name="mic" size={24} /> Start {dur}-minute session
      </Link>
      <p className="-mt-2 text-center text-xs text-ink-3">Speak → Feedback → Speak again → Reflect · ~{Math.round(totalTargetSec(dur) / 60)} min</p>

      <details className="group">
        <summary className="cursor-pointer list-none text-center text-sm font-medium text-ink-2">Choose a training module <span className="text-ink-3 group-open:hidden">▾</span></summary>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <Chip active={module === ""} onClick={() => setModule("")}>Recommended</Chip>
          {(Object.keys(MODULE_INFO) as ModuleId[]).map((m) => (
            <Chip key={m} active={module === m} onClick={() => setModule(m)}>{MODULE_INFO[m].short}</Chip>
          ))}
        </div>
      </details>

      <section className="card p-4">
        <div className="flex items-center gap-4">
          <Ring pct={ready ? pct : 0} />
          <div className="min-w-0">
            <p className="text-sm text-ink-3">Daily goal</p>
            <p className="text-lg font-semibold tabular">{ready ? `${mins.toFixed(1)} / ${goal} min` : "—"}</p>
            <p className="text-sm text-ink-2">{pct >= 1 ? "Goal reached. Another round is a bonus." : "One short session is enough."}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Chip({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={`pill border px-3 py-1.5 text-sm ${active ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2"}`}>
      {children}
    </button>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${Math.round(pct * 100)}% of daily goal`}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="7" />
      {pct > 0 && <circle cx="32" cy="32" r={r} fill="none" stroke="var(--accent)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} transform="rotate(-90 32 32)" />}
    </svg>
  );
}
