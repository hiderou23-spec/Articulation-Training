"use client";
import type { AudioMetrics } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;

export interface RecorderResult {
  blob: Blob | null;
  mimeType: string;
  liveTranscript: string;
  metrics: AudioMetrics;
}

export interface RecorderEvents {
  onLevel?: (level: number) => void; // 0..1
  onTranscript?: (text: string) => void;
  onSilence?: (silentSec: number, hasSpoken: boolean) => void;
}

export function speechRecognitionSupported(): boolean {
  return typeof window !== "undefined" && Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
}

export function recordingSupported(): boolean {
  return typeof window !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined";
}

function pickMime(): string {
  const options = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  for (const m of options) if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) return m;
  return "";
}

export class MicError extends Error {
  constructor(public kind: "denied" | "unavailable" | "unsupported", msg: string) {
    super(msg);
  }
}

/**
 * Records audio, measures speech/pause timing from the signal energy, and (when
 * the browser supports it) streams live speech recognition in parallel.
 */
export class Recorder {
  private stream: MediaStream | null = null;
  private rec: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private ctx: AudioContext | null = null;
  private raf: ReturnType<typeof setInterval> | null = null;
  private sr: SR = null;
  private finalText = "";
  private interim = "";
  private startedAt = 0;
  private stopped = false;
  // timing analysis
  private voicedMs = 0;
  private silenceMs = 0;
  private hasSpoken = false;
  private longestPause = 0;
  private pauseCount = 0;
  private noiseFloor = 0.01;
  private analysisOk = false;
  private paused = false;
  private pausedTotal = 0;
  private pausedAt = 0;

  constructor(private ev: RecorderEvents = {}) {}

  async start(useLiveRecognition: boolean) {
    if (!recordingSupported()) throw new MicError("unsupported", "This browser can't record audio.");
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch (e: any) {
      if (e?.name === "NotAllowedError" || e?.name === "SecurityError") throw new MicError("denied", "Microphone permission was denied.");
      throw new MicError("unavailable", "No microphone available.");
    }
    const mimeType = pickMime();
    this.rec = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
    this.chunks = [];
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(1000);
    this.startedAt = performance.now();
    this.setupAnalysis();
    if (useLiveRecognition) this.startRecognition();
  }

  private setupAnalysis() {
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      const src = this.ctx.createMediaStreamSource(this.stream!);
      const an = this.ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      const STEP = 50;
      let calib = 0;
      this.raf = setInterval(() => {
        if (this.paused) return;
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        const rms = Math.sqrt(sum / buf.length);
        if (calib < 10) { this.noiseFloor = Math.max(0.004, (this.noiseFloor * calib + rms) / (calib + 1)); calib++; }
        const threshold = Math.max(0.012, this.noiseFloor * 2.5);
        const voiced = rms > threshold;
        if (voiced) {
          if (this.hasSpoken && this.silenceMs > 1200) {
            this.pauseCount++;
            this.longestPause = Math.max(this.longestPause, this.silenceMs / 1000);
          }
          this.hasSpoken = true;
          this.voicedMs += STEP;
          this.silenceMs = 0;
        } else {
          this.silenceMs += STEP;
          if (!voiced && this.noiseFloor > rms) this.noiseFloor = this.noiseFloor * 0.98 + rms * 0.02;
        }
        this.ev.onLevel?.(Math.min(1, rms * 8));
        this.ev.onSilence?.(this.silenceMs / 1000, this.hasSpoken);
      }, STEP);
      this.analysisOk = true;
    } catch {
      this.analysisOk = false;
    }
  }

  private startRecognition() {
    const C = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!C) return;
    const sr = new C();
    sr.lang = "en-US";
    sr.continuous = true;
    sr.interimResults = true;
    sr.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) this.finalText += (this.finalText ? " " : "") + r[0].transcript.trim();
        else interim += r[0].transcript;
      }
      this.interim = interim.trim();
      this.ev.onTranscript?.(this.transcript());
    };
    // Recognition ends on its own after silence on some browsers: restart while still recording.
    sr.onend = () => {
      if (!this.stopped && !this.paused) {
        try { sr.start(); } catch { /* already started */ }
      }
    };
    sr.onerror = () => {};
    try { sr.start(); this.sr = sr; } catch { this.sr = null; }
  }

  transcript() {
    return [this.finalText, this.interim].filter(Boolean).join(" ").trim();
  }

  elapsedSec() {
    const now = this.paused ? this.pausedAt : performance.now();
    return Math.max(0, (now - this.startedAt - this.pausedTotal) / 1000);
  }

  pause() {
    if (this.paused || !this.rec) return;
    this.paused = true;
    this.pausedAt = performance.now();
    if (this.rec.state === "recording") this.rec.pause();
    try { this.sr?.stop(); } catch {}
  }

  resume() {
    if (!this.paused || !this.rec) return;
    this.pausedTotal += performance.now() - this.pausedAt;
    this.paused = false;
    this.silenceMs = 0;
    if (this.rec.state === "paused") this.rec.resume();
    try { this.sr?.start(); } catch {}
  }

  async stop(): Promise<RecorderResult> {
    if (this.paused) this.resume();
    this.stopped = true;
    const durationSec = this.elapsedSec();
    if (this.raf) clearInterval(this.raf);
    try { this.sr?.stop(); } catch {}
    const rec = this.rec;
    const blob = await new Promise<Blob | null>((resolve) => {
      if (!rec || rec.state === "inactive") return resolve(this.chunks.length ? new Blob(this.chunks, { type: rec?.mimeType }) : null);
      rec.onstop = () => resolve(this.chunks.length ? new Blob(this.chunks, { type: rec.mimeType }) : null);
      rec.stop();
    });
    // Give recognition a moment to flush its final result.
    await new Promise((r) => setTimeout(r, 350));
    this.cleanup();
    return {
      blob,
      mimeType: rec?.mimeType || "",
      liveTranscript: this.transcript(),
      metrics: {
        durationSec: Math.round(durationSec * 10) / 10,
        speakingSec: Math.round((this.voicedMs / 1000) * 10) / 10,
        longestPauseSec: Math.round(this.longestPause * 10) / 10,
        pauseCount: this.pauseCount,
        available: this.analysisOk && this.hasSpoken,
      },
    };
  }

  cancel() {
    this.stopped = true;
    if (this.raf) clearInterval(this.raf);
    try { this.sr?.abort?.(); } catch {}
    try { if (this.rec && this.rec.state !== "inactive") this.rec.stop(); } catch {}
    this.cleanup();
  }

  private cleanup() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
  }
}
