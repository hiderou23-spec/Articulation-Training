import type { Duration } from "./types";

export type PhaseId = "warmup" | "speak" | "feedback" | "retry" | "followup" | "summary";

export interface Phase {
  id: PhaseId;
  label: string;
  targetSec: number;
}

/** Session timing from the product spec. Retry is half the initial speaking time (concise drill). */
export const PLANS: Record<Duration, { phases: Phase[]; speakSec: number; retrySec: number; followUpSec: number }> = {
  5: {
    speakSec: 60,
    retrySec: 30,
    followUpSec: 0,
    phases: [
      { id: "warmup", label: "Warm-up", targetSec: 30 },
      { id: "speak", label: "Speak", targetSec: 60 },
      { id: "feedback", label: "Feedback", targetSec: 90 },
      { id: "retry", label: "Speak again", targetSec: 90 },
      { id: "summary", label: "Reflect", targetSec: 30 },
    ],
  },
  10: {
    speakSec: 120,
    retrySec: 60,
    followUpSec: 60,
    phases: [
      { id: "warmup", label: "Warm-up", targetSec: 60 },
      { id: "speak", label: "Speak", targetSec: 120 },
      { id: "feedback", label: "Coaching", targetSec: 120 },
      { id: "retry", label: "Speak again", targetSec: 120 },
      { id: "followup", label: "Follow-up", targetSec: 60 },
      { id: "summary", label: "Reflect", targetSec: 120 },
    ],
  },
  15: {
    speakSec: 180,
    retrySec: 90,
    followUpSec: 90,
    phases: [
      { id: "warmup", label: "Warm-up", targetSec: 120 },
      { id: "speak", label: "Speak", targetSec: 180 },
      { id: "feedback", label: "Deep feedback", targetSec: 180 },
      { id: "retry", label: "Speak again", targetSec: 150 },
      { id: "followup", label: "Follow-up", targetSec: 90 },
      { id: "summary", label: "Reflect", targetSec: 180 },
    ],
  },
};

export function totalTargetSec(d: Duration): number {
  return PLANS[d].phases.reduce((a, p) => a + p.targetSec, 0);
}

/**
 * Pause-aware stopwatch based on real elapsed time (performance.now / Date.now),
 * so background tabs and throttled timers can't drift.
 */
export class Stopwatch {
  private startedAt: number | null = null;
  private accumulated = 0;
  constructor(private now: () => number = () => Date.now()) {}
  start() { if (this.startedAt === null) this.startedAt = this.now(); }
  pause() { if (this.startedAt !== null) { this.accumulated += this.now() - this.startedAt; this.startedAt = null; } }
  get running() { return this.startedAt !== null; }
  elapsedMs() { return this.accumulated + (this.startedAt !== null ? this.now() - this.startedAt : 0); }
}
