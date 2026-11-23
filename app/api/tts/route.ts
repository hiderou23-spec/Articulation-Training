import { hasServerTTS, speak } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!hasServerTTS()) return new Response("TTS not configured", { status: 501 });
  try {
    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim()) return new Response("text required", { status: 400 });
    const audio = await speak(text);
    return new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "private, max-age=86400" } });
  } catch (e) {
    console.error("tts failed", e);
    return new Response("TTS failed", { status: 502 });
  }
}
