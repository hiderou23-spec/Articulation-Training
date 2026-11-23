"use client";
import { useEffect, useState } from "react";
import type { Session, Settings, WeaknessCard } from "./types";
import { DEFAULT_SETTINGS, getSessions, getSettings, getWeaknesses } from "./storage";

export interface Status { coach: "anthropic" | "openai" | "demo"; serverStt: boolean; serverTts: boolean }

let statusCache: Status | null = null;
export async function fetchStatus(): Promise<Status> {
  if (statusCache) return statusCache;
  try {
    const r = await fetch("/api/status", { cache: "no-store" });
    statusCache = await r.json();
  } catch {
    statusCache = { coach: "demo", serverStt: false, serverTts: false }; // offline
  }
  return statusCache!;
}

/** Load local data after mount (localStorage isn't available during SSR). */
export function useAppData() {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weaknesses, setWeaknesses] = useState<WeaknessCard[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const reload = () => {
    setSettings(getSettings());
    setSessions(getSessions());
    setWeaknesses(getWeaknesses());
  };
  useEffect(() => {
    reload();
    setReady(true);
    fetchStatus().then(setStatus);
  }, []);
  return { ready, settings, setSettings, sessions, weaknesses, status, reload };
}
