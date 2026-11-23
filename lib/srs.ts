import type { WeaknessCard, WeaknessTag } from "./types";

const DAY = 86_400_000;

/**
 * Spaced repetition for communication weaknesses (SM-2 style, simplified).
 * - A weakness flagged by the coach becomes (or re-becomes) due in ~1 day.
 * - When a session targets a due weakness and the user does NOT repeat it, the interval grows.
 * - Repeating it is a lapse: interval resets and ease drops.
 */
export function flagWeakness(cards: WeaknessCard[], tag: WeaknessTag, now = Date.now()): WeaknessCard[] {
  const existing = cards.find((c) => c.tag === tag);
  if (!existing) {
    return [...cards, { tag, ease: 2.3, intervalDays: 1, due: now + DAY, seen: 1, lapses: 0, lastSeen: now }];
  }
  return cards.map((c) =>
    c.tag === tag
      ? { ...c, ease: Math.max(1.3, c.ease - 0.2), intervalDays: 1, due: now + DAY, seen: c.seen + 1, lapses: c.lapses + 1, lastSeen: now }
      : c,
  );
}

export function passWeakness(cards: WeaknessCard[], tag: WeaknessTag, now = Date.now()): WeaknessCard[] {
  return cards.map((c) => {
    if (c.tag !== tag) return c;
    const intervalDays = Math.min(60, Math.max(2, Math.round(c.intervalDays * c.ease)));
    return { ...c, ease: Math.min(3, c.ease + 0.1), intervalDays, due: now + intervalDays * DAY, lastSeen: now };
  });
}

export function dueWeaknesses(cards: WeaknessCard[], now = Date.now()): WeaknessCard[] {
  return cards.filter((c) => c.due <= now).sort((a, b) => a.due - b.due || b.lapses - a.lapses);
}

/** Weaknesses ranked by how persistent they are (for the Coach screen). */
export function rankWeaknesses(cards: WeaknessCard[]): WeaknessCard[] {
  return [...cards].sort((a, b) => b.lapses + b.seen - (a.lapses + a.seen) || a.intervalDays - b.intervalDays);
}

/** "Mastered" once it has survived a few growing intervals without lapsing. */
export function isMastered(c: WeaknessCard): boolean {
  return c.intervalDays >= 14;
}
