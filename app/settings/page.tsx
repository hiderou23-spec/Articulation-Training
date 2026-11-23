"use client";
import { useEffect, useRef, useState } from "react";
import { useAppData } from "@/lib/useApp";
import { deleteAllData, exportData, importData, saveSettings } from "@/lib/storage";
import { FOCUS_LABEL } from "@/lib/questions";
import { englishVoices, say } from "@/lib/voice";
import type { Duration, FocusArea, Settings } from "@/lib/types";

export default function SettingsPage() {
  const { ready, settings, setSettings, status, reload } = useAppData();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const load = () => setVoices(englishVoices());
    load();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.onvoiceschanged = load;
  }, []);
  if (!ready) return null;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    const next = { ...settings, [k]: v };
    setSettings(next);
    saveSettings(next);
  };

  const download = () => {
    const blob = new Blob([exportData()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `articulate-ai-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

      <Group title="Training">
        <Row label="Focus area">
          <select value={settings.focus} onChange={(e) => set("focus", e.target.value as FocusArea)} className="rounded-lg bg-surface-2 px-2 py-1.5 text-sm">
            {(Object.keys(FOCUS_LABEL) as FocusArea[]).map((f) => <option key={f} value={f}>{FOCUS_LABEL[f]}</option>)}
          </select>
        </Row>
        <Row label="Difficulty">
          <Segment value={settings.difficulty} options={[[1, "Easy"], [2, "Medium"], [3, "Hard"]]} onChange={(v) => set("difficulty", v as 1 | 2 | 3)} />
        </Row>
        <Row label="Default session">
          <Segment value={settings.defaultDuration} options={[[5, "5"], [10, "10"], [15, "15"]]} onChange={(v) => set("defaultDuration", v as Duration)} />
        </Row>
        <Row label="Daily goal (min)">
          <Segment value={settings.dailyGoalMin} options={[[5, "5"], [10, "10"], [15, "15"]]} onChange={(v) => set("dailyGoalMin", v)} />
        </Row>
        <Row label="Coaching notes">
          <Segment value={settings.notesLanguage} options={[["en", "English"], ["ja", "日本語"]]} onChange={(v) => set("notesLanguage", v as "en" | "ja")} />
        </Row>
      </Group>

      <Group title="Voice">
        <Toggle label="Read questions aloud" checked={settings.speakQuestions} onChange={(v) => set("speakQuestions", v)} />
        <Toggle label="Hands-free mode" hint="Reads prompts and feedback aloud, starts recording automatically, and stops after 5s of silence. For walking or commuting." checked={settings.handsFree} onChange={(v) => set("handsFree", v)} />
        {!status?.serverTts && voices.length > 0 && (
          <Row label="Coach voice">
            <select value={settings.voiceName ?? ""} onChange={(e) => { set("voiceName", e.target.value || undefined); say("Let's make your point clear.", { serverTts: false, voiceName: e.target.value }); }} className="max-w-44 rounded-lg bg-surface-2 px-2 py-1.5 text-sm">
              <option value="">Automatic</option>
              {voices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
            </select>
          </Row>
        )}
      </Group>

      <Group title="Privacy & data">
        <Toggle label="Save my recordings on this device" hint="Off by default. When on, audio is stored only in this browser so you can replay past answers. Transcripts are sent to the AI provider for feedback; audio is sent only if server transcription is configured." checked={settings.storeAudio} onChange={(v) => set("storeAudio", v)} />
        <div className="flex flex-wrap gap-2 px-4 py-3">
          <button onClick={download} className="rounded-full border border-line px-3 py-1.5 text-sm">Export data (JSON)</button>
          <button onClick={() => fileRef.current?.click()} className="rounded-full border border-line px-3 py-1.5 text-sm">Import</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; try { importData(await f.text()); reload(); alert("Imported."); } catch (err) { alert(String(err)); } }} />
          <button onClick={async () => { if (confirm("Delete ALL sessions, transcripts, recordings and progress from this device? This can't be undone.")) { await deleteAllData(); reload(); } }} className="rounded-full border border-rec/40 px-3 py-1.5 text-sm text-rec">Delete all data</button>
        </div>
      </Group>

      <Group title="About">
        <p className="px-4 py-3 text-sm text-ink-2">
          Coach: <b>{status?.coach === "demo" ? "Demo (simulated)" : status?.coach === "anthropic" ? "Claude" : status?.coach === "openai" ? "OpenAI-compatible" : "…"}</b> · Transcription: <b>{status?.serverStt ? "Server" : "On-device"}</b>
          <br />
          <span className="text-xs text-ink-3">Scores are AI coaching estimates, not validated measurements. Pronunciation is never judged from text.</span>
        </p>
      </Group>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-ink-3">{title}</h2>
      <div className="card divide-y divide-line">{children}</div>
    </section>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3 px-4 py-3"><span className="text-sm">{label}</span>{children}</div>;
}
function Segment<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg bg-surface-2 p-0.5">
      {options.map(([v, l]) => <button key={String(v)} onClick={() => onChange(v)} aria-pressed={value === v} className={`rounded-md px-2.5 py-1 text-sm ${value === v ? "bg-surface font-medium shadow-sm" : "text-ink-3"}`}>{l}</button>)}
    </div>
  );
}
function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 px-4 py-3">
      <span><span className="text-sm">{label}</span>{hint && <span className="mt-0.5 block text-xs text-ink-3">{hint}</span>}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-surface-2 transition before:block before:h-4 before:w-4 before:translate-x-0.5 before:translate-y-0.5 before:rounded-full before:bg-ink-3 before:transition checked:bg-accent checked:before:translate-x-[18px] checked:before:bg-white" />
    </label>
  );
}
