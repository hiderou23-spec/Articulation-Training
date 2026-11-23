// Server-only: model provider abstraction. API keys never leave the server.
import "server-only";

export type Provider = "anthropic" | "openai" | "demo";

export function coachProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "demo";
}

export function hasServerSTT(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function hasServerTTS(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

const openaiBase = () => (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(t);
  }
}

/** Send a single-turn prompt and return the model's text. */
export async function complete(system: string, user: string, maxTokens = 1500): Promise<string> {
  const provider = coachProvider();
  if (provider === "anthropic") {
    return withTimeout(45_000, async (signal) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal,
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      return (data.content || []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("");
    });
  }
  if (provider === "openai") {
    return withTimeout(45_000, async (signal) => {
      const res = await fetch(`${openaiBase()}/chat/completions`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? "";
    });
  }
  throw new Error("No AI provider configured");
}

export async function transcribe(audio: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", process.env.STT_MODEL || "whisper-1");
  form.append("language", "en");
  return withTimeout(60_000, async (signal) => {
    const res = await fetch(`${openaiBase()}/audio/transcriptions`, {
      method: "POST",
      signal,
      headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
    });
    if (!res.ok) throw new Error(`STT ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const data = await res.json();
    return String(data.text ?? "");
  });
}

export async function speak(text: string): Promise<ArrayBuffer> {
  return withTimeout(30_000, async (signal) => {
    const res = await fetch(`${openaiBase()}/audio/speech`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: process.env.TTS_MODEL || "tts-1", voice: process.env.TTS_VOICE || "alloy", input: text.slice(0, 1500), format: "mp3" }),
    });
    if (!res.ok) throw new Error(`TTS ${res.status}`);
    return res.arrayBuffer();
  });
}

