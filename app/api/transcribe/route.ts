import { NextResponse } from "next/server";
import { hasServerSTT, transcribe } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!hasServerSTT()) return NextResponse.json({ error: "Server transcription not configured" }, { status: 501 });
  try {
    const form = await req.formData();
    const file = form.get("audio");
    if (!(file instanceof Blob)) return NextResponse.json({ error: "audio missing" }, { status: 400 });
    if (file.size > 24 * 1024 * 1024) return NextResponse.json({ error: "Recording too large" }, { status: 413 });
    const type = file.type || "audio/webm";
    const ext = type.includes("mp4") || type.includes("aac") ? "mp4" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
    const text = await transcribe(file, `answer.${ext}`);
    return NextResponse.json({ text });
  } catch (e) {
    console.error("transcribe failed", e);
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
  }
}
