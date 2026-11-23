import { NextResponse } from "next/server";
import { coachProvider, complete } from "@/lib/ai";
import { parseJsonObject } from "@/lib/json";
import { questionPrompt } from "@/lib/prompts";
import { MODULE_INFO } from "@/lib/questions";
import type { ModuleId } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Optional: generate a fresh AI question. The client always has the local bank as fallback. */
export async function POST(req: Request) {
  if (coachProvider() === "demo") return NextResponse.json({ question: null });
  try {
    const b = await req.json();
    const module = (b.module as ModuleId) in MODULE_INFO ? (b.module as ModuleId) : "spontaneous";
    const text = await complete(
      "You write concise, realistic speaking-practice questions. Output only JSON.",
      questionPrompt({ module: MODULE_INFO[module].name, focus: String(b.focus ?? "business"), difficulty: Number(b.difficulty ?? 2), weakness: b.weakness, avoid: Array.isArray(b.avoid) ? b.avoid : [] }),
      300,
    );
    const raw = parseJsonObject(text);
    if (!raw || typeof raw.text !== "string") return NextResponse.json({ question: null });
    const clean = (v: unknown) => (typeof v === "string" && v && v !== "null" ? v : undefined);
    return NextResponse.json({
      question: { id: `ai-${Date.now()}`, module, difficulty: Number(b.difficulty ?? 2), text: raw.text, framework: clean(raw.framework), context: clean(raw.context), targets: b.weakness ? [b.weakness] : [] },
    });
  } catch (e) {
    console.error("question failed", e);
    return NextResponse.json({ question: null });
  }
}
