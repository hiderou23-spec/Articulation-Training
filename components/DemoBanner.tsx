import type { Status } from "@/lib/useApp";

export function DemoBanner({ status }: { status: Status | null }) {
  if (!status || status.coach !== "demo") return null;
  return (
    <div className="rounded-xl border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-ink-2" role="status">
      <strong className="text-warn">Demo mode.</strong> Feedback is a simulated, rule-based estimate — no AI provider is configured. Add an API key to enable real coaching.
    </div>
  );
}
