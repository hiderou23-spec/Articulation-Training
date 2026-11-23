import type { FocusArea, ModuleId, Question, WeaknessTag } from "./types";
import { WEAKNESS_INFO } from "./rubric";

export const MODULE_INFO: Record<ModuleId, { name: string; short: string; tip: string }> = {
  structure: { name: "Think Clearly, Speak Clearly", short: "Structure", tip: "Use PREP: Point → Reason → Example → Point." },
  spontaneous: { name: "Spontaneous Speaking", short: "Spontaneous", tip: "Start with “The short answer is…”, then explain." },
  concise: { name: "Concise Communication", short: "Concise", tip: "One message. Cut every word that doesn't carry it." },
  persuasive: { name: "Persuasive Executive Communication", short: "Persuasive", tip: "Recommendation first, then the trade-off you accept." },
  delivery: { name: "Natural English Delivery", short: "Delivery", tip: "Chunk phrases. Stress the new information. Pause, don't fill." },
  story: { name: "Storytelling & Conversation", short: "Story", tip: "Moment → tension → turning point → lesson." },
};

const q = (id: string, module: ModuleId, difficulty: 1 | 2 | 3, text: string, extra: Partial<Question> = {}): Question => ({ id, module, difficulty, text, ...extra });

export const QUESTIONS: Question[] = [
  // A — Structure
  q("a1", "structure", 2, "What is the biggest challenge facing digital payments in Japan?", { framework: "PREP", targets: ["buried_lead", "missing_example"] }),
  q("a2", "structure", 1, "Why is a strong partner ecosystem important for a product company?", { framework: "PREP", targets: ["missing_reasons"] }),
  q("a3", "structure", 2, "Explain why a payment partnership could be strategically important for your company.", { framework: "Claim → Evidence → Implication", targets: ["missing_reasons", "weak_conclusion"] }),
  q("a4", "structure", 3, "Our customer churn rose 15% last quarter. Walk me through how you would diagnose and address it.", { framework: "Problem → Analysis → Recommendation", targets: ["rambling", "buried_lead"] }),
  q("a5", "structure", 2, "What is one trend that will reshape your industry in the next five years?", { framework: "SCQA", targets: ["no_clear_point", "missing_example"] }),
  q("a6", "structure", 1, "What makes a meeting productive?", { framework: "PREP", targets: ["weak_conclusion"] }),
  q("a7", "structure", 3, "Should Japanese companies adopt more English in internal communication? Give your position.", { framework: "Pyramid Principle", targets: ["no_clear_point", "missing_reasons"] }),
  q("a8", "structure", 2, "How should a company decide which markets to enter first?", { framework: "Pyramid Principle", targets: ["rambling"] }),
  // B — Spontaneous
  q("b1", "spontaneous", 2, "What would you change about your company's strategy?", { targets: ["long_pauses", "rambling"] }),
  q("b2", "spontaneous", 2, "What is one decision you regret, and what did it teach you?", { targets: ["long_pauses"] }),
  q("b3", "spontaneous", 2, "Should companies prioritize growth or profitability?", { targets: ["hedging", "no_clear_point"] }),
  q("b4", "spontaneous", 1, "What is a tool or habit that makes you more productive?", { targets: ["long_pauses"] }),
  q("b5", "spontaneous", 3, "If your budget were cut by 30% tomorrow, what would you stop doing first?", { targets: ["hedging", "long_pauses"] }),
  q("b6", "spontaneous", 1, "What do you enjoy most about your job?", { targets: ["vague_wording"] }),
  q("b7", "spontaneous", 3, "Is AI more likely to increase or decrease the value of middle managers?", { targets: ["no_clear_point"] }),
  q("b8", "spontaneous", 2, "What's the best piece of career advice you've received?", { targets: ["missing_example"] }),
  // C — Concise
  q("c1", "concise", 1, "Explain what your team does, as if to a new executive in an elevator.", { targets: ["verbose"] }),
  q("c2", "concise", 2, "Summarize your current top project: goal, status, and what you need.", { targets: ["verbose", "buried_lead"] }),
  q("c3", "concise", 2, "We should revisit our partnership strategy. Explain why in plain words.", { targets: ["hedging", "verbose"] }),
  q("c4", "concise", 3, "Explain the difference between a platform business and a product business.", { targets: ["verbose", "vague_wording"] }),
  q("c5", "concise", 1, "Give a status update on something you worked on this week.", { targets: ["verbose"] }),
  q("c6", "concise", 2, "What problem does your product solve, and for whom?", { targets: ["vague_wording", "verbose"] }),
  // D — Persuasive (role-play)
  q("d1", "persuasive", 2, "Present a proposal to launch a new product feature. Your CFO is skeptical about cost.", { context: "Stakeholder: skeptical CFO focused on ROI.", targets: ["hedging", "missing_reasons"] }),
  q("d2", "persuasive", 3, "Explain to the board why you are choosing speed-to-market over feature completeness.", { context: "Stakeholder: board member worried about quality risk.", targets: ["hedging", "buried_lead"] }),
  q("d3", "persuasive", 3, "A key partner wants a bigger revenue share. Respond and protect your position.", { context: "Stakeholder: partner's head of business development.", targets: ["hedging"] }),
  q("d4", "persuasive", 2, "Your VP says: “This plan is too risky.” Defend your recommendation.", { context: "Stakeholder: risk-averse VP.", targets: ["missing_reasons", "hedging"] }),
  q("d5", "persuasive", 2, "Deliver difficult feedback to a team member whose deadlines keep slipping.", { context: "Listener: a capable but overloaded team member.", targets: ["hedging", "vague_wording"] }),
  q("d6", "persuasive", 3, "Explain a trade-off: we can enter Southeast Asia this year, or strengthen Japan first. Recommend one.", { framework: "Recommendation → Trade-off → Next step", targets: ["no_clear_point", "buried_lead"] }),
  q("d7", "persuasive", 1, "Ask your manager for additional headcount for your team.", { context: "Stakeholder: supportive but budget-constrained manager.", targets: ["missing_reasons"] }),
  // E — Delivery
  q("e1", "delivery", 1, "Introduce yourself and your role, as you would at the start of an international meeting.", { targets: ["pace_too_fast", "filler_words"] }),
  q("e2", "delivery", 2, "Describe your city to someone who has never visited Japan.", { targets: ["pace_too_fast", "long_pauses"] }),
  q("e3", "delivery", 2, "Open a meeting: state the purpose, the agenda, and the decision you need today.", { targets: ["filler_words", "pace_too_fast"] }),
  q("e4", "delivery", 1, "Explain your weekend plans in a relaxed, conversational tone.", { targets: ["pace_too_slow"] }),
  q("e5", "delivery", 3, "Present three key numbers from your business and explain what each one means.", { targets: ["pace_too_fast", "filler_words"] }),
  // F — Story
  q("f1", "story", 2, "Tell a short story about a time a project almost failed.", { framework: "Moment → Tension → Turn → Lesson", targets: ["missing_example", "rambling"] }),
  q("f2", "story", 1, "Explain a complex concept from your work to a 12-year-old.", { targets: ["vague_wording", "verbose"] }),
  q("f3", "story", 2, "Share an opinion about remote work, naturally, as if over coffee.", { targets: ["hedging"] }),
  q("f4", "story", 2, "Tell me about someone who influenced how you work.", { framework: "Moment → Tension → Turn → Lesson", targets: ["missing_example"] }),
  q("f5", "story", 3, "Describe a cultural misunderstanding at work and how it was resolved.", { targets: ["rambling", "weak_conclusion"] }),
  q("f6", "story", 1, "What's something you changed your mind about recently?", { targets: ["missing_example"] }),
];

export const FOCUS_MODULES: Record<FocusArea, ModuleId[]> = {
  business: ["structure", "concise", "persuasive", "spontaneous"],
  everyday: ["story", "spontaneous", "delivery"],
  executive: ["persuasive", "structure", "concise"],
  debate: ["persuasive", "spontaneous", "structure"],
  storytelling: ["story", "spontaneous"],
  delivery: ["delivery", "spontaneous"],
};

export const FOCUS_LABEL: Record<FocusArea, string> = {
  business: "Business communication",
  everyday: "Everyday conversation",
  executive: "Executive presentations",
  debate: "Debate & persuasion",
  storytelling: "Storytelling",
  delivery: "Pronunciation & delivery",
};

/**
 * Pick the next question.
 * Priority: a due weakness (spaced repetition) → focus-area modules → difficulty fit → not recently used.
 */
export function pickQuestion(opts: {
  focus: FocusArea;
  difficulty: 1 | 2 | 3;
  dueTag?: WeaknessTag;
  recentIds: string[];
  module?: ModuleId;
  random?: () => number;
}): Question {
  const rand = opts.random ?? Math.random;
  const recent = new Set(opts.recentIds.slice(0, 12));
  let pool = QUESTIONS.filter((x) => !recent.has(x.id));
  if (pool.length === 0) pool = QUESTIONS;

  const scored = pool.map((x) => {
    let s = rand() * 2;
    if (opts.module) s += x.module === opts.module ? 10 : -10;
    if (opts.dueTag) {
      if (x.targets?.includes(opts.dueTag)) s += 6;
      if (x.module === WEAKNESS_INFO[opts.dueTag].module) s += 3;
    }
    if (FOCUS_MODULES[opts.focus].includes(x.module)) s += 3;
    s -= Math.abs(x.difficulty - opts.difficulty) * 1.5;
    return { x, s };
  });
  scored.sort((a, b) => b.s - a.s);
  return scored[0].x;
}

/** Short warm-ups: a delivery phrase (stress in CAPS, pauses as “|”) plus a framework reminder. */
export const WARMUPS: { phrase: string; reduced?: string; focus: string }[] = [
  { phrase: "The SHORT answer is | YES. | Let me exPLAIN why.", focus: "Stress the key word, pause at each bar." },
  { phrase: "I reCOMmend we | reVISit our PARTnership strategy.", focus: "Lead with the verb: recommend." },
  { phrase: "What I'm GOING to do | is walk you through THREE points.", reduced: "What I'm gonna do…", focus: "“going to” → “gonna” is fine in conversation, not in a formal pitch." },
  { phrase: "There are TWO reasons. | FIRST, | COST. | SECOND, | SPEED.", focus: "Short chunks sound confident." },
  { phrase: "Let me put it ANother way.", reduced: "Lemme put it another way.", focus: "Linking: put‿it, another‿way." },
  { phrase: "That's a FAIR point, | AND | here's what I'd ADD.", focus: "Use “and”, not “but”, to sound collaborative." },
  { phrase: "The BOTTOM line is | we need a deCIsion by FRIday.", focus: "Bottom line first. Stress the deadline." },
  { phrase: "Would you be OPEN to | a SMALLer PIlot first?", focus: "Rising intonation at the end of a yes/no question." },
];

export function pickWarmup(seed: number) {
  return WARMUPS[Math.abs(Math.floor(seed)) % WARMUPS.length];
}
