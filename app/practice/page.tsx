"use client";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Analysis, Attempt, Duration, ModuleId, Question, Session, Settings, WeaknessTag } from "@/lib/types";
import { PLANS, Stopwatch, type PhaseId } from "@/lib/plan";
import { MODULE_INFO, pickQuestion, pickWarmup } from "@/lib/questions";
import { transcriptMetrics } from "@/lib/metrics";
import { demoAnalysis } from "@/lib/demo";
import { WEAKNESS_INFO } from "@/lib/rubric";
import { applySessionOutcome, dueWeaknesses } from "@/lib/srs";
import { getSessions, getSettings, getWeaknesses, putAudio, saveSession, saveWeaknesses } from "@/lib/storage";
import { fetchStatus, type Status } from "@/lib/useApp";
import { MicError, Recorder, speechRecognitionSupported } from "@/lib/recorder";
import { say, stopSpeaking } from "@/lib/voice";
import { streak } from "@/lib/stats";
import { Icon } from "@/components/Icon";
import { AttemptStats, EstimateLabel, FeedbackCards, ScoreBars, StructureChecks } from "@/components/Feedback";
import { Player } from "@/components/Player";

type Stage = "warmup" | "prompt" | "recording" | "processing" | "noinput" | "feedback" | "reflect" | "done";

const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, "0")}`;

export default function PracticePage() {
  return (
    <Suspense fallback={null}>
      <Practice />
    </Suspense>
  );
}

function Practice() {
  const params = useSearchParams();
  const duration = ([5, 10, 15].includes(Number(params.get("d"))) ? Number(params.get("d")) : 5) as Duration;
  const forcedModule = (params.get("m") as ModuleId | null) ?? undefined;
  const plan = PLANS[duration];

  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [targetedTag, setTargetedTag] = useState<WeaknessTag | undefined>();
  const [stage, setStage] = useState<Stage>("warmup");
  const [k, setK] = useState(0); // attempt index: 0 initial, 1 retry, 2 follow-up
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  const [live, setLive] = useState("");
  const [level, setLevel] = useState(0);
  const [recSec, setRecSec] = useState(0);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [typed, setTyped] = useState<string | null>(null); // typing fallback
  const [showRewrite, setShowRewrite] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reflection, setReflection] = useState<{ feeling: 1 | 2 | 3; takeaway: string }>({ feeling: 2, takeaway: "" });
  const [, tick] = useState(0);

  const sessionId = useRef(`s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`);
  const startedAt = useRef(Date.now());
  const watch = useRef(new Stopwatch());
  const recorder = useRef<Recorder | null>(null);
  const silenceRef = useRef({ sec: 0, spoken: false });
  const warm = useMemo(() => pickWarmup(Date.now() / 86_400_000), []);

  // ---- setup ----
  useEffect(() => {
    const s = getSettings();
    setSettings(s);
    const due = dueWeaknesses(getWeaknesses())[0]?.tag;
    const recentIds = getSessions().map((x) => x.question.id);
    const q = pickQuestion({ focus: s.focus, difficulty: s.difficulty, dueTag: forcedModule ? undefined : due, recentIds, module: forcedModule });
    setQuestion(q);
    setTargetedTag(forcedModule ? undefined : due);
    watch.current.start();
    fetchStatus().then((st) => {
      setStatus(st);
      if (st.coach === "demo") return;
      // Try a fresh AI-generated question during the warm-up; the curated one stays if this is slow.
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      fetch("/api/question", {
        method: "POST",
        signal: ctrl.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ module: q.module, focus: s.focus, difficulty: s.difficulty, weakness: forcedModule ? undefined : due, avoid: getSessions().slice(0, 8).map((x) => x.question.text) }),
      })
        .then((r) => r.json())
        .then((d) => { if (d.question) setQuestion((cur) => (stageRef.current === "warmup" ? d.question : cur)); })
        .catch(() => {})
        .finally(() => clearTimeout(t));
    });
    const iv = setInterval(() => tick((n) => n + 1), 250);
    return () => { clearInterval(iv); recorder.current?.cancel(); stopSpeaking(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageRef = useRef(stage);
  stageRef.current = stage;

  const limitSec = k === 0 ? plan.speakSec : k === 1 ? plan.retrySec : plan.followUpSec;
  const hardLimit = Math.round(limitSec * 1.5);
  const current = attempts[k];
  const first = attempts[0];
  const hasFollowUp = plan.followUpSec > 0;

  const promptText = !question ? "" : k === 0 ? question.text : k === 1 ? first?.analysis?.retryChallenge ?? "Say it again, more concisely." : first?.analysis?.followUp ?? "What would you do first?";

  const phase: PhaseId = stage === "warmup" ? "warmup" : stage === "reflect" || stage === "done" ? "summary" : stage === "feedback" ? "feedback" : k === 0 ? "speak" : k === 1 ? "retry" : "followup";

  const speakText = useCallback((t: string) => { if (settings) return say(t, { serverTts: !!status?.serverTts, voiceName: settings.voiceName }); }, [settings, status]);

  // ---- recording ----
  const startRecording = useCallback(async () => {
    stopSpeaking();
    setError(null);
    setLive("");
    setRecSec(0);
    silenceRef.current = { sec: 0, spoken: false };
    const r = new Recorder({
      onLevel: setLevel,
      onTranscript: setLive,
      onSilence: (sec, spoken) => { silenceRef.current = { sec, spoken }; },
    });
    try {
      // Live browser recognition is used for the on-screen transcript; server STT (if configured) produces the final one.
      await r.start(speechRecognitionSupported());
      recorder.current = r;
      setStage("recording");
    } catch (e) {
      const msg = e instanceof MicError
        ? e.kind === "denied" ? "Microphone access is blocked. Allow it in your browser settings (iPhone: Settings → Safari → Microphone), or type your answer below." : e.message
        : "Couldn't start the microphone.";
      setError(msg);
      setTyped("");
    }
  }, []);

  const finishAttempt = useCallback(async (transcript: string, metrics: Attempt["audio"], blob: Blob | null, url?: string, existingKey?: string) => {
    if (!question || !settings) return;
    const text = transcriptMetrics(transcript, metrics.available ? metrics.speakingSec : metrics.durationSec);
    let audioKey: string | undefined = existingKey;
    if (blob && settings.storeAudio) audioKey = await putAudio(`${sessionId.current}-${k}`, blob).catch(() => undefined);
    const attempt: Attempt = { transcript, durationSec: metrics.durationSec, audio: metrics, text, audioKey };
    const previous = k === 1 ? attempts[0] : undefined;
    const target = k === 0 ? plan.speakSec : k === 1 ? plan.retrySec : plan.followUpSec;
    let analysis: Analysis;
    setWarning(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: k === 2 ? { ...question, text: promptText } : question, attempt, previous, targetSec: target, notesLanguage: settings.notesLanguage, isFollowUp: k === 2 }),
      });
      if (res.status === 401) { window.location.href = "/unlock?next=/"; return; }
      if (!res.ok) throw new Error(String(res.status));
      const d = await res.json();
      analysis = d.analysis;
      if (d.warning) setWarning(d.warning);
    } catch {
      analysis = demoAnalysis(question, attempt, target, previous);
      setWarning("You're offline — showing an on-device estimate.");
    }
    attempt.analysis = analysis;
    setAttempts((a) => { const n = [...a]; n[k] = attempt; return n; });
    if (url) setUrls((u) => { const n = [...u]; n[k] = url; return n; });
    setShowRewrite(false);
    setStage("feedback");
    if (settings.handsFree) {
      const brief = `${analysis.strength} ${analysis.improvement.text} ${k === 0 ? analysis.retryChallenge : ""}`;
      speakText(brief.replace(/[“”]/g, ""));
    }
  }, [question, settings, k, attempts, plan, promptText, speakText]);

  const stopRecording = useCallback(async () => {
    const r = recorder.current;
    if (!r) return;
    recorder.current = null;
    setStage("processing");
    const res = await r.stop();
    let transcript = res.liveTranscript;
    if (status?.serverStt && res.blob) {
      try {
        const form = new FormData();
        form.append("audio", res.blob, "answer");
        const t = await fetch("/api/transcribe", { method: "POST", body: form });
        if (t.ok) transcript = (await t.json()).text || transcript;
      } catch { /* keep live transcript */ }
    }
    const url = res.blob ? URL.createObjectURL(res.blob) : undefined;
    if (!transcript.trim()) {
      setStage("noinput");
      setTyped("");
      pendingAudio.current = { metrics: res.metrics, blob: res.blob, url };
      return;
    }
    await finishAttempt(transcript.trim(), res.metrics, res.blob, url);
  }, [status, finishAttempt]);

  const pendingAudio = useRef<{ metrics: Attempt["audio"]; blob: Blob | null; url?: string } | null>(null);

  // timer, hard limit, hands-free auto stop
  useEffect(() => {
    if (stage !== "recording" || !recorder.current) return;
    const iv = setInterval(() => {
      const r = recorder.current;
      if (!r) return;
      const s = r.elapsedSec();
      setRecSec(s);
      if (s >= hardLimit) stopRecording();
      else if (settings?.handsFree && silenceRef.current.spoken && silenceRef.current.sec > 5 && !paused) stopRecording();
    }, 200);
    return () => clearInterval(iv);
  }, [stage, hardLimit, stopRecording, settings, paused]);

  // hands-free: read the prompt aloud, then start recording automatically
  useEffect(() => {
    if (stage !== "prompt" || !settings || !question) return;
    let cancelled = false;
    (async () => {
      if (settings.speakQuestions || settings.handsFree) await speakText(promptText);
      if (!cancelled && settings.handsFree && stageRef.current === "prompt") startRecording();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, k, question?.id]);

  const togglePause = () => {
    if (paused) {
      watch.current.start();
      recorder.current?.resume();
      setPaused(false);
    } else {
      watch.current.pause();
      recorder.current?.pause();
      stopSpeaking();
      setPaused(true);
    }
  };

  const nextAfterFeedback = () => {
    stopSpeaking();
    if (k === 0) { setK(1); setStage("prompt"); }
    else if (k === 1 && hasFollowUp) { setK(2); setStage("prompt"); }
    else goReflect();
  };

  const goReflect = () => {
    stopSpeaking();
    setReflection((r) => ({ ...r, takeaway: r.takeaway || (first?.analysis ? WEAKNESS_INFO[first.analysis.improvement.tag].drill : "") }));
    setStage("reflect");
  };

  const finish = () => {
    if (!question || !settings) return;
    watch.current.pause();
    const session: Session = {
      id: sessionId.current,
      startedAt: startedAt.current,
      finishedAt: Date.now(),
      activeSec: Math.round(watch.current.elapsedMs() / 1000),
      duration,
      question,
      attempts: attempts.filter(Boolean),
      reflection,
      demo: status?.coach === "demo",
    };
    saveSession(session);
    saveWeaknesses(applySessionOutcome(getWeaknesses(), { targetedTag, firstTag: attempts[0]?.analysis?.improvement.tag, retryTag: attempts[1]?.analysis?.improvement.tag }));
    setStage("done");
  };

  const submitTyped = async () => {
    if (!typed?.trim()) return;
    const p = pendingAudio.current;
    pendingAudio.current = null;
    setTyped(null);
    setError(null);
    setStage("processing");
    const words = typed.trim().split(/\s+/).length;
    await finishAttempt(typed.trim(), p?.metrics ?? { durationSec: Math.round(words / 2.3), speakingSec: 0, longestPauseSec: 0, pauseCount: 0, available: false }, p?.blob ?? null, p?.url);
  };

  const reanalyze = async (newText: string) => {
    const cur = attempts[k];
    if (!cur) return;
    setEditing(false);
    setStage("processing");
    await finishAttempt(newText, cur.audio, null, urls[k], cur.audioKey);
  };

  if (!question || !settings) return <div className="pt-20 text-center text-ink-3">Preparing your session…</div>;

  const elapsed = watch.current.elapsedMs() / 1000;
  const phases = plan.phases.filter((p) => p.id !== "followup" || hasFollowUp);

  return (
    <div className="flex min-h-[calc(100dvh-24px)] flex-col pt-2">
      {/* Top bar: phases + real elapsed time + pause */}
      <header className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="flex items-center justify-between">
          <Link href="/" onClick={() => { recorder.current?.cancel(); stopSpeaking(); }} className="-ml-2 p-2 text-ink-3" aria-label="End session"><Icon name="x" /></Link>
          <span className="text-sm tabular text-ink-2" aria-label="Elapsed time">{fmt(elapsed)} <span className="text-ink-3">/ {duration}:00</span></span>
          {stage !== "done" ? (
            <button onClick={togglePause} className="-mr-2 p-2 text-ink-2" aria-label={paused ? "Resume" : "Pause"}><Icon name={paused ? "play" : "pause"} /></button>
          ) : <span className="w-10" />}
        </div>
        <ol className="mt-2 flex gap-1" aria-label="Session phases">
          {phases.map((p) => {
            const idx = phases.findIndex((x) => x.id === phase);
            const i = phases.indexOf(p);
            return (
              <li key={p.id} className="flex-1">
                <div className={`h-1 rounded-full ${i < idx ? "bg-accent" : i === idx ? "bg-accent/60" : "bg-surface-2"}`} />
                <span className={`mt-1 block truncate text-[10px] ${i === idx ? "font-semibold text-ink" : "text-ink-3"}`}>{p.label}</span>
              </li>
            );
          })}
        </ol>
      </header>

      {paused && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-bg/95 px-8 text-center">
          <p className="text-xl font-semibold">Paused</p>
          <p className="text-sm text-ink-2">Timer and recording are stopped. Pick up where you left off.</p>
          <button onClick={togglePause} className="rounded-2xl bg-accent px-8 py-4 font-semibold text-accent-ink">Resume</button>
        </div>
      )}

      <div className="flex-1 space-y-4 pt-2">
        {stage === "warmup" && (
          <section className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Warm-up · say it aloud twice</p>
            <div className="card p-5">
              <p className="text-xl leading-relaxed">
                {warm.phrase.split(/(\s+)/).map((w, i) => /[A-Z]{2,}/.test(w) ? <strong key={i} className="text-accent">{w.toLowerCase()}</strong> : <span key={i} className={w.trim() === "|" ? "text-ink-3" : ""}>{w}</span>)}
              </p>
              {warm.reduced && <p className="mt-2 text-sm text-ink-3">Casual: “{warm.reduced}”</p>}
              <p className="mt-3 text-sm text-ink-2">{warm.focus}</p>
              <button onClick={() => speakText(warm.phrase.replace(/\|/g, ",").toLowerCase())} className="mt-3 flex items-center gap-1.5 text-sm font-medium text-accent"><Icon name="speaker" size={18} /> Listen</button>
            </div>
            <div className="card p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">{MODULE_INFO[question.module].name}</p>
              <p className="mt-1 text-sm text-ink-2">{question.framework ? `Today's framework: ${question.framework}. ` : ""}{MODULE_INFO[question.module].tip}</p>
            </div>
          </section>
        )}

        {(stage === "prompt" || stage === "recording" || stage === "processing" || stage === "noinput") && (
          <section className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              {k === 0 ? `${MODULE_INFO[question.module].short} · ${plan.speakSec}s` : k === 1 ? `Speak again · ${plan.retrySec}s` : `Follow-up question · ${plan.followUpSec}s`}
            </p>
            {question.context && k !== 1 && <p className="text-sm text-ink-3">{question.context}</p>}
            <h2 className="text-2xl font-semibold leading-snug tracking-tight">{promptText}</h2>
            {k === 0 && question.framework && <p className="text-sm text-ink-2">Try: {question.framework}</p>}
            {k === 1 && first?.analysis && (
              <div className="card p-4 text-sm">
                <p className="text-ink-2"><span className="font-medium text-ink">Focus: </span>{WEAKNESS_INFO[first.analysis.improvement.tag].drill}</p>
                <button onClick={() => setShowRewrite((v) => !v)} className="mt-2 text-xs font-medium text-accent">{showRewrite ? "Hide" : "Peek at"} the improved version</button>
                {showRewrite && <p className="mt-2 text-ink-2">{first.analysis.improvedVersion}</p>}
                <p className="mt-2 text-xs text-ink-3">Use your own words — don&apos;t read it.</p>
              </div>
            )}
            {stage === "recording" && (
              <div className="min-h-24 rounded-2xl bg-surface-2 p-4 text-[15px] leading-relaxed text-ink-2" aria-live="polite">
                {live || <span className="text-ink-3">{speechRecognitionSupported() ? "Listening… your words will appear here." : "Recording… (live transcript isn't supported in this browser)"}</span>}
              </div>
            )}
            {stage === "processing" && <p className="py-6 text-center text-ink-2" role="status">Analyzing your answer…</p>}
            {stage === "noinput" && <p className="text-sm text-warn">We didn&apos;t catch any words. Try again, or type what you said.</p>}
            {error && <p className="text-sm text-warn" role="alert">{error}</p>}
            {typed !== null && (
              <div className="space-y-2">
                <textarea value={typed} onChange={(e) => setTyped(e.target.value)} rows={5} placeholder="Type your answer as you would say it…" className="w-full rounded-2xl border border-line bg-surface p-3 text-[15px]" />
                <button onClick={submitTyped} disabled={!typed.trim()} className="w-full rounded-2xl bg-accent py-3 font-semibold text-accent-ink disabled:opacity-40">Get feedback</button>
              </div>
            )}
          </section>
        )}

        {stage === "feedback" && current?.analysis && (
          <section className="space-y-4">
            {warning && <p className="text-xs text-warn">{warning}</p>}
            <div className="card p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-medium text-ink-2">{k === 0 ? "First attempt" : k === 1 ? "Second attempt" : "Follow-up"}</p>
                <p className="text-3xl font-semibold tabular">{current.analysis.overall}<span className="text-base text-ink-3">/100</span></p>
              </div>
              <EstimateLabel source={current.analysis.source} />
              <div className="mt-3"><ScoreBars a={current.analysis} before={k === 1 ? first?.analysis : undefined} /></div>
              {k !== 2 && <div className="mt-4"><StructureChecks a={current.analysis} /></div>}
            </div>

            {k === 1 && first?.analysis && (
              <div className="card space-y-3 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-3">Before → after</p>
                {current.analysis.progressNote && <p className="text-[15px]">{current.analysis.progressNote}</p>}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="mb-1 text-ink-3">First · {first.analysis.overall}</p><AttemptMini at={first} url={urls[0]} /></div>
                  <div><p className="mb-1 text-ink-3">Second · {current.analysis.overall}</p><AttemptMini at={current} url={urls[1]} /></div>
                </div>
              </div>
            )}

            <FeedbackCards a={current.analysis} onListen={(t) => speakText(t)} />

            <details className="card p-4">
              <summary className="cursor-pointer text-sm font-medium text-ink-2">Your transcript</summary>
              {editing ? (
                <EditTranscript initial={current.transcript} onSave={reanalyze} onCancel={() => setEditing(false)} />
              ) : (
                <>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{current.transcript}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Player url={urls[k]} audioKey={current.audioKey} />
                    <button onClick={() => setEditing(true)} className="flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-2"><Icon name="edit" size={14} /> Fix transcript</button>
                  </div>
                  <div className="mt-3"><AttemptStats at={current} /></div>
                </>
              )}
            </details>
          </section>
        )}

        {stage === "reflect" && (
          <section className="space-y-5">
            <h2 className="text-2xl font-semibold tracking-tight">Reflect</h2>
            {first?.analysis && (
              <div className="card p-4">
                <p className="text-sm text-ink-3">This session</p>
                <p className="mt-1 text-lg font-semibold tabular">{first.analysis.overall}{attempts[1]?.analysis ? ` → ${attempts[1].analysis.overall}` : ""}</p>
                <p className="mt-1 text-sm text-ink-2">Focus: {WEAKNESS_INFO[first.analysis.improvement.tag].label}. It will come back for review on a spaced schedule.</p>
              </div>
            )}
            <div>
              <p className="mb-2 text-sm font-medium">How did that feel?</p>
              <div className="grid grid-cols-3 gap-2">
                {([[1, "Hard"], [2, "OK"], [3, "Confident"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setReflection((r) => ({ ...r, feeling: v }))} aria-pressed={reflection.feeling === v} className={`rounded-xl border py-3 text-sm font-medium ${reflection.feeling === v ? "border-accent bg-accent-soft text-accent" : "border-line text-ink-2"}`}>{l}</button>
                ))}
              </div>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-medium">One thing to remember next time</span>
              <textarea value={reflection.takeaway} onChange={(e) => setReflection((r) => ({ ...r, takeaway: e.target.value }))} rows={3} className="w-full rounded-2xl border border-line bg-surface p-3 text-[15px]" />
            </label>
          </section>
        )}

        {stage === "done" && (
          <section className="space-y-4 pt-8 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-good/15 text-good"><Icon name="check" size={32} /></div>
            <h2 className="text-2xl font-semibold tracking-tight">Session complete</h2>
            <p className="text-ink-2">{fmt(watch.current.elapsedMs() / 1000)} of focused practice · {streak(getSessions())}-day streak</p>
            {reflection.takeaway && <p className="card mx-auto p-4 text-left text-[15px]">“{reflection.takeaway}”</p>}
          </section>
        )}
      </div>

      {/* Bottom action area: one primary action at a time, thumb-reachable */}
      <footer className="safe-bottom sticky bottom-0 -mx-4 mt-4 bg-gradient-to-t from-bg via-bg to-bg/0 px-4 pt-6">
        {stage === "warmup" && (
          <div className="space-y-2">
            <button onClick={() => setStage("prompt")} className="w-full rounded-2xl bg-accent py-4 text-lg font-semibold text-accent-ink">I&apos;m ready — show the question</button>
          </div>
        )}
        {(stage === "prompt" || stage === "noinput") && typed === null && (
          <MicButton state="idle" onClick={startRecording} label={`Tap to answer · ${limitSec}s`} />
        )}
        {stage === "noinput" && typed !== null && (
          <button onClick={() => { setTyped(null); setStage("prompt"); }} className="w-full py-3 text-sm font-medium text-ink-2">Try speaking again</button>
        )}
        {stage === "recording" && (
          <div className="space-y-2">
            <p className={`text-center text-3xl font-semibold tabular ${recSec > limitSec ? "text-warn" : ""}`}>{recSec > limitSec ? `+${fmt(recSec - limitSec)}` : fmt(limitSec - recSec)}</p>
            <p className="text-center text-xs text-ink-3">{recSec > limitSec ? "Time's up — wrap up your point" : settings.handsFree ? "Stops automatically when you finish" : "Tap when you're done"}</p>
            <MicButton state="recording" level={level} onClick={stopRecording} label="Done" />
          </div>
        )}
        {stage === "feedback" && (
          <div className="space-y-2">
            <button onClick={nextAfterFeedback} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-4 text-lg font-semibold text-accent-ink">
              {k === 0 ? <><Icon name="refresh" /> Speak again · {plan.retrySec}s</> : k === 1 && hasFollowUp ? <>Answer a follow-up <Icon name="arrow" /></> : <>Reflect <Icon name="arrow" /></>}
            </button>
            {k > 0 && <button onClick={() => { setStage("prompt"); }} className="w-full py-2 text-sm font-medium text-ink-2">Try this one again</button>}
            {k === 1 && hasFollowUp && <button onClick={goReflect} className="w-full py-1 text-sm text-ink-3">Skip to reflect</button>}
          </div>
        )}
        {stage === "reflect" && <button onClick={finish} className="w-full rounded-2xl bg-accent py-4 text-lg font-semibold text-accent-ink">Save session</button>}
        {stage === "done" && (
          <div className="grid grid-cols-2 gap-2">
            <Link href="/" className="rounded-2xl border border-line py-4 text-center font-semibold">Home</Link>
            <button onClick={() => { window.location.href = `/practice?d=${duration}`; }} className="rounded-2xl bg-accent py-4 font-semibold text-accent-ink">One more</button>
          </div>
        )}
      </footer>
    </div>
  );
}

function MicButton({ state, onClick, label, level = 0 }: { state: "idle" | "recording"; onClick: () => void; label: string; level?: number }) {
  const rec = state === "recording";
  return (
    <div className="flex flex-col items-center gap-2 pb-2">
      <button onClick={onClick} aria-label={rec ? "Stop recording" : "Start recording"} className={`relative flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg ${rec ? "bg-rec" : "bg-accent"}`}>
        {rec && <span className="pulse-ring absolute inset-0 rounded-full bg-rec" />}
        {rec && <span className="absolute inset-0 rounded-full bg-rec/40 transition-transform duration-100" style={{ transform: `scale(${1 + level * 0.5})` }} />}
        <Icon name={rec ? "stop" : "mic"} size={32} fill={rec} className="relative" />
      </button>
      <span className="text-sm font-medium text-ink-2">{label}</span>
    </div>
  );
}

function AttemptMini({ at, url }: { at: Attempt; url?: string }) {
  return (
    <div className="space-y-1.5 rounded-xl bg-surface-2 p-2.5">
      <p className="tabular text-xs text-ink-2">{Math.round(at.durationSec)}s · {at.text.wordCount} words · {at.text.fillerCount} fillers</p>
      <p className="line-clamp-4 text-xs text-ink-3">{at.transcript}</p>
      <Player url={url} audioKey={at.audioKey} label="Play" />
    </div>
  );
}

function EditTranscript({ initial, onSave, onCancel }: { initial: string; onSave: (t: string) => void; onCancel: () => void }) {
  const [t, setT] = useState(initial);
  return (
    <div className="mt-2 space-y-2">
      <p className="text-xs text-ink-3">Fix recognition mistakes only, so the feedback reflects what you actually said.</p>
      <textarea value={t} onChange={(e) => setT(e.target.value)} rows={6} className="w-full rounded-xl border border-line bg-surface p-3 text-[15px]" />
      <div className="flex gap-2">
        <button onClick={() => onSave(t.trim())} disabled={!t.trim()} className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-accent-ink">Re-analyze</button>
        <button onClick={onCancel} className="rounded-xl border border-line px-4 text-sm">Cancel</button>
      </div>
    </div>
  );
}
