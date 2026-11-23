export type ModuleId =
  | "structure" // A: Think Clearly, Speak Clearly
  | "spontaneous" // B
  | "concise" // C
  | "persuasive" // D
  | "delivery" // E
  | "story"; // F

export type FocusArea =
  | "business"
  | "everyday"
  | "executive"
  | "debate"
  | "storytelling"
  | "delivery";

export type Duration = 5 | 10 | 15;

export type DimensionKey = "clarity" | "structure" | "conciseness" | "vocabulary" | "delivery";

export type Scores = Record<DimensionKey, number>; // each 0–10

/** Fixed taxonomy so weaknesses can be tracked and scheduled with spaced repetition. */
export type WeaknessTag =
  | "buried_lead"
  | "no_clear_point"
  | "missing_reasons"
  | "missing_example"
  | "weak_conclusion"
  | "rambling"
  | "verbose"
  | "hedging"
  | "filler_words"
  | "vague_wording"
  | "grammar_pattern"
  | "pace_too_fast"
  | "pace_too_slow"
  | "long_pauses";

export interface Question {
  id: string;
  module: ModuleId;
  text: string;
  framework?: string; // e.g. "PREP"
  context?: string; // role-play setup
  targets?: WeaknessTag[];
  difficulty: 1 | 2 | 3;
}

export interface AudioMetrics {
  durationSec: number;
  speakingSec: number; // voiced time from audio energy
  longestPauseSec: number;
  pauseCount: number; // pauses > 1.2s
  available: boolean; // false if audio analysis wasn't possible
}

export interface TranscriptMetrics {
  wordCount: number;
  wpm: number | null;
  fillerCount: number;
  fillers: Record<string, number>;
  hedgeCount: number;
  avgSentenceWords: number;
  longestSentenceWords: number;
  firstSentenceWords: number;
}

export interface StructureCheck {
  mainPoint: boolean;
  reasons: boolean;
  example: boolean;
  conclusion: boolean;
}

export interface Analysis {
  scores: Scores;
  overall: number; // weighted 0–100
  strength: string;
  improvement: { tag: WeaknessTag; text: string };
  improvedVersion: string;
  whyBetter: string;
  retryChallenge: string;
  structure: StructureCheck;
  deliveryNote: string;
  progressNote?: string; // only on retry: what changed vs attempt 1
  followUp?: string; // stakeholder-style follow-up question
  source: "ai" | "demo";
}

export interface Attempt {
  transcript: string;
  durationSec: number;
  audioKey?: string; // IndexedDB key when audio stored with consent
  audio: AudioMetrics;
  text: TranscriptMetrics;
  analysis?: Analysis;
}

export interface Session {
  id: string;
  startedAt: number;
  finishedAt?: number;
  activeSec: number; // excludes paused time
  duration: Duration;
  question: Question;
  attempts: Attempt[]; // [initial, retry, (follow-up)]
  reflection?: { feeling: 1 | 2 | 3; takeaway: string };
  demo: boolean;
}

export interface WeaknessCard {
  tag: WeaknessTag;
  ease: number;
  intervalDays: number;
  due: number; // epoch ms
  seen: number;
  lapses: number;
  lastSeen: number;
}

export interface Settings {
  focus: FocusArea;
  difficulty: 1 | 2 | 3;
  defaultDuration: Duration;
  storeAudio: boolean; // explicit consent
  speakQuestions: boolean;
  handsFree: boolean;
  notesLanguage: "en" | "ja";
  voiceName?: string;
  dailyGoalMin: number;
}
