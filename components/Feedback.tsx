"use client";
import type { Analysis, Attempt, DimensionKey } from "@/lib/types";
import { DIMENSION_LABEL, WEAKNESS_INFO } from "@/lib/rubric";
import { Icon } from "./Icon";

const DIMS: DimensionKey[] = ["clarity", "structure", "conciseness", "vocabulary", "delivery"];

export function EstimateLabel({ source }: { source: Analysis["source"] }) {
  return <span className="text-[11px] text-ink-3">{source === "demo" ? "Simulated estimate (demo mode)" : "AI coaching estimate — not a validated measurement"}</span>;
}

export function ScoreBars({ a, before }: { a: Analysis; before?: Analysis }) {
  return (
    <ul className="space-y-2.5">
      {DIMS.map((k) => {
        const v = a.scores[k];
        const b = before?.scores[k];
        const d = b !== undefined ? Math.round((v - b) * 10) / 10 : null;
        return (
          <li key={k} className="grid grid-cols-[92px_1fr_56px] items-center gap-3 text-sm">
            <span className="text-ink-2">{DIMENSION_LABEL[k]}</span>
            <span className="relative h-2 rounded-full bg-surface-2" aria-hidden="true">
              {b !== undefined && <span className="absolute inset-y-0 left-0 rounded-full bg-ink-3/30" style={{ width: `${b * 10}%` }} />}
              <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${v * 10}%` }} />
            </span>
            <span className="text-right tabular">
              {v.toFixed(1)}
              {d !== null && d !== 0 && <span className={`ml-1 text-xs ${d > 0 ? "text-good" : "text-warn"}`}>{d > 0 ? "+" : ""}{d}</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function StructureChecks({ a }: { a: Analysis }) {
  const items: [keyof Analysis["structure"], string][] = [["mainPoint", "Main point"], ["reasons", "Reasons"], ["example", "Example"], ["conclusion", "Conclusion"]];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(([k, label]) => {
        const ok = a.structure[k];
        return (
          <div key={k} className={`rounded-xl px-1 py-2 text-center text-xs ${ok ? "bg-good/10 text-good" : "bg-surface-2 text-ink-3"}`}>
            <Icon name={ok ? "check" : "x"} size={16} className="mx-auto mb-0.5" />
            {label}
            <span className="sr-only">{ok ? "present" : "missing"}</span>
          </div>
        );
      })}
    </div>
  );
}

export function FeedbackCards({ a, onListen }: { a: Analysis; onListen?: (t: string) => void }) {
  return (
    <div className="space-y-3">
      <section className="card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-good">What worked</p>
        <p className="mt-1 text-[15px] leading-relaxed">{a.strength}</p>
      </section>
      <section className="card border-accent/40 bg-accent-soft p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">Biggest opportunity · {WEAKNESS_INFO[a.improvement.tag].label}</p>
        <p className="mt-1 text-[15px] leading-relaxed">{a.improvement.text}</p>
      </section>
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Improved version</p>
          {onListen && (
            <button onClick={() => onListen(a.improvedVersion)} className="flex items-center gap-1 text-xs font-medium text-accent">
              <Icon name="speaker" size={16} /> Listen
            </button>
          )}
        </div>
        <p className="mt-1 text-[15px] leading-relaxed">{a.improvedVersion}</p>
        {a.whyBetter && <p className="mt-2 text-sm text-ink-2"><span className="font-medium">Why it&apos;s better: </span>{a.whyBetter}</p>}
      </section>
      <p className="px-1 text-xs text-ink-3">{a.deliveryNote}</p>
    </div>
  );
}

export function AttemptStats({ at }: { at: Attempt }) {
  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      <Stat label="Seconds" v={Math.round(at.durationSec)} />
      <Stat label="Words" v={at.text.wordCount} />
      <Stat label="Fillers" v={at.text.fillerCount} />
      <Stat label="WPM" v={at.text.wpm ?? "–"} />
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="rounded-xl bg-surface-2 py-2">
      <p className="text-base font-semibold tabular">{v}</p>
      <p className="text-[11px] text-ink-3">{label}</p>
    </div>
  );
}
