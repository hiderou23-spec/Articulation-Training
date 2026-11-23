"use client";
import { useState } from "react";

/** Single-series bar chart (practice minutes per day) with per-bar hover/tap tooltip. */
export function MinutesBars({ data, goal }: { data: { day: string; label: string; minutes: number }[]; goal: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320, H = 120, pad = { t: 14, b: 18, l: 4, r: 4 };
  const max = Math.max(goal * 1.5, ...data.map((d) => d.minutes), 1);
  const bw = (W - pad.l - pad.r) / data.length;
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const gy = y(goal);
  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Practice minutes per day">
        <line x1={pad.l} x2={W - pad.r} y1={gy} y2={gy} stroke="var(--ink-3)" strokeDasharray="3 3" strokeWidth="1" opacity="0.6" />
        <text x={W - pad.r} y={gy - 3} textAnchor="end" fontSize="9" fill="var(--ink-3)">goal {goal}m</text>
        {data.map((d, i) => {
          const x = pad.l + i * bw + 2; // 2px gap between bars
          const h = Math.max(0, H - pad.b - y(d.minutes));
          const r = Math.min(4, h / 2);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}>
              <rect x={pad.l + i * bw} y={pad.t} width={bw} height={H - pad.t - pad.b} fill="transparent" />
              {h > 0 && <path d={`M${x},${H - pad.b} V${H - pad.b - h + r} Q${x},${H - pad.b - h} ${x + r},${H - pad.b - h} H${x + bw - 4 - r} Q${x + bw - 4},${H - pad.b - h} ${x + bw - 4},${H - pad.b - h + r} V${H - pad.b} Z`} fill="var(--series-1)" opacity={hover === null || hover === i ? 1 : 0.55} />}
              <text x={x + (bw - 4) / 2} y={H - 5} textAnchor="middle" fontSize="9" fill="var(--ink-3)">{d.label}</text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-0 rounded-lg border border-line bg-surface px-2 py-1 text-xs shadow" style={{ left: `${Math.min(75, (hover / data.length) * 100)}%` }}>
          <span className="text-ink-3">{data[hover].day}</span> <span className="font-semibold tabular">{data[hover].minutes} min</span>
        </div>
      )}
    </figure>
  );
}

/** Two-series line chart: first-attempt vs retry overall score per session. */
export function ScoreLines({ data }: { data: { t: number; first: number; retry: number | null }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320, H = 150, pad = { t: 10, b: 18, l: 24, r: 50 };
  if (data.length < 2) return <p className="py-6 text-center text-sm text-ink-3">Complete two sessions to see your trend.</p>;
  const xs = (i: number) => pad.l + (i / (data.length - 1)) * (W - pad.l - pad.r);
  const ys = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / 100);
  const path = (key: "first" | "retry") => {
    let d = "";
    data.forEach((p, i) => { const v = p[key]; if (v === null) return; d += `${d ? "L" : "M"}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`; });
    return d;
  };
  const last = data[data.length - 1];
  const lastRetryIdx = [...data].map((d) => d.retry).lastIndexOf(data.filter((d) => d.retry !== null).slice(-1)[0]?.retry ?? null);
  return (
    <figure className="relative">
      <div className="mb-2 flex gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: "var(--series-1)" }} />First attempt</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: "var(--series-2)" }} />After retry</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Overall score per session, first attempt and retry" onMouseLeave={() => setHover(null)}>
        {[0, 50, 100].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={W - pad.r} y1={ys(v)} y2={ys(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={pad.l - 4} y={ys(v) + 3} textAnchor="end" fontSize="9" fill="var(--ink-3)">{v}</text>
          </g>
        ))}
        {hover !== null && <line x1={xs(hover)} x2={xs(hover)} y1={pad.t} y2={H - pad.b} stroke="var(--ink-3)" strokeWidth="1" />}
        <path d={path("first")} fill="none" stroke="var(--series-1)" strokeWidth="2" strokeLinejoin="round" />
        <path d={path("retry")} fill="none" stroke="var(--series-2)" strokeWidth="2" strokeLinejoin="round" />
        <text x={xs(data.length - 1) + 6} y={ys(last.first) + 3} fontSize="10" fill="var(--ink-2)">First {last.first}</text>
        {lastRetryIdx >= 0 && data[lastRetryIdx].retry !== null && (
          <text x={xs(lastRetryIdx) + 6} y={ys(data[lastRetryIdx].retry!) + (Math.abs(data[lastRetryIdx].retry! - last.first) < 8 ? -6 : 3)} fontSize="10" fill="var(--ink-2)">Retry {data[lastRetryIdx].retry}</text>
        )}
        {hover !== null && (
          <>
            <circle cx={xs(hover)} cy={ys(data[hover].first)} r="4" fill="var(--series-1)" stroke="var(--surface)" strokeWidth="2" />
            {data[hover].retry !== null && <circle cx={xs(hover)} cy={ys(data[hover].retry!)} r="4" fill="var(--series-2)" stroke="var(--surface)" strokeWidth="2" />}
          </>
        )}
        {data.map((_, i) => (
          <rect key={i} x={xs(i) - (W - pad.l - pad.r) / data.length / 2} y={0} width={(W - pad.l - pad.r) / Math.max(1, data.length - 1)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-6 rounded-lg border border-line bg-surface px-2 py-1 text-xs shadow" style={{ left: `${Math.min(70, (hover / (data.length - 1)) * 80)}%` }}>
          <p className="text-ink-3">{new Date(data[hover].t).toLocaleDateString()}</p>
          <p className="tabular">First <b>{data[hover].first}</b>{data[hover].retry !== null && <> · Retry <b>{data[hover].retry}</b></>}</p>
        </div>
      )}
    </figure>
  );
}
