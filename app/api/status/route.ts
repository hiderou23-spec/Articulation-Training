import { NextResponse } from "next/server";
import { coachProvider, hasServerSTT, hasServerTTS } from "@/lib/ai";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ coach: coachProvider(), serverStt: hasServerSTT(), serverTts: hasServerTTS() });
}
