"use client";
import type { Session, Settings, WeaknessCard } from "./types";

// Local-first storage. Sessions/settings/weaknesses → localStorage; audio blobs → IndexedDB.
// Everything stays on this device unless the user exports it.

const K = { sessions: "aai.sessions.v1", settings: "aai.settings.v1", weak: "aai.weaknesses.v1" };

export const DEFAULT_SETTINGS: Settings = {
  focus: "business",
  difficulty: 2,
  defaultDuration: 5,
  storeAudio: false,
  speakQuestions: true,
  handsFree: false,
  notesLanguage: "en",
  dailyGoalMin: 5,
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch (e) {
    console.warn("storage write failed", e);
  }
}

export const getSettings = (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>(K.settings, {}) });
export const saveSettings = (s: Settings) => write(K.settings, s);

export const getSessions = (): Session[] => read<Session[]>(K.sessions, []);
export function saveSession(s: Session) {
  const all = getSessions().filter((x) => x.id !== s.id);
  all.unshift(s);
  write(K.sessions, all.slice(0, 500));
}
export function deleteSession(id: string) {
  const s = getSessions().find((x) => x.id === id);
  s?.attempts.forEach((a) => a.audioKey && deleteAudio(a.audioKey));
  write(K.sessions, getSessions().filter((x) => x.id !== id));
}

export const getWeaknesses = (): WeaknessCard[] => read<WeaknessCard[]>(K.weak, []);
export const saveWeaknesses = (w: WeaknessCard[]) => write(K.weak, w);

// ---------- IndexedDB audio ----------
const DB = "aai-audio";
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("audio");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("audio", mode);
    const req = fn(t.objectStore("audio"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export const putAudio = (key: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, key)).then(() => key);
export const getAudio = (key: string) => tx<Blob | undefined>("readonly", (s) => s.get(key)).catch(() => undefined);
export const deleteAudio = (key: string) => tx("readwrite", (s) => s.delete(key)).catch(() => undefined);
export const clearAudio = () => tx("readwrite", (s) => s.clear()).catch(() => undefined);

export async function deleteAllData() {
  Object.values(K).forEach((k) => localStorage.removeItem(k));
  await clearAudio();
}

export function exportData(): string {
  return JSON.stringify(
    { app: "Articulate AI", exportedAt: new Date().toISOString(), settings: getSettings(), weaknesses: getWeaknesses(), sessions: getSessions() },
    null,
    2,
  );
}

export function importData(json: string) {
  const d = JSON.parse(json);
  if (!Array.isArray(d.sessions)) throw new Error("Not an Articulate AI export");
  write(K.sessions, d.sessions);
  if (Array.isArray(d.weaknesses)) write(K.weak, d.weaknesses);
  if (d.settings) write(K.settings, d.settings);
}
