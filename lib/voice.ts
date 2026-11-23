"use client";

let current: HTMLAudioElement | null = null;

/** Speak text: server TTS if configured, otherwise the device's built-in voice. */
export async function say(text: string, opts: { serverTts: boolean; voiceName?: string; rate?: number } = { serverTts: false }): Promise<void> {
  stopSpeaking();
  if (opts.serverTts) {
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      if (res.ok) {
        const url = URL.createObjectURL(await res.blob());
        current = new Audio(url);
        await new Promise<void>((resolve) => {
          current!.onended = () => resolve();
          current!.onerror = () => resolve();
          current!.play().catch(() => resolve());
        });
        URL.revokeObjectURL(url);
        return;
      }
    } catch {
      /* fall through to device voice */
    }
  }
  if (typeof speechSynthesis === "undefined") return;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = opts.rate ?? 1;
    const voices = speechSynthesis.getVoices();
    const v = voices.find((x) => x.name === opts.voiceName) || voices.find((x) => x.lang === "en-US" && /natural|premium|enhanced|samantha|google/i.test(x.name)) || voices.find((x) => x.lang.startsWith("en"));
    if (v) u.voice = v;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
    // Safari sometimes never fires onend.
    setTimeout(resolve, Math.min(30000, 1500 + text.length * 90));
  });
}

export function stopSpeaking() {
  try { speechSynthesis?.cancel(); } catch {}
  if (current) { current.pause(); current = null; }
}

export function englishVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === "undefined") return [];
  return speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
}
