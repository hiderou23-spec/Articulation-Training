import { NextResponse } from "next/server";
import { coachProvider, complete } from "@/lib/ai";
import { parseJsonObject } from "@/lib/json";
import { mergeAiAnalysis } from "@/lib/merge";
import { demoAnalysis } from "@/lib/demo";
import { analysisPrompt, COACH_SYSTEM } from "@/lib/prompts";
import type { Attempt, Question } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Body {
  question: Question;
  attempt: Attempt;
  previous?: Attempt;
  targetSec: number;
  notesLanguage?: "en" | "ja";
  isFollowUp?: boolean;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.question?.text || typeof body?.attempt?.transcript !== "string") {
    return NextResponse.json({ error: "question and attempt are required" }, { status: 400 });
  }
  const { question, attempt, previous, targetSec } = body;

  if (coachProvider() === "demo" || attempt.transcript.trim().split(/\s+/).length < 3) {
    return NextResponse.json({ analysis: demoAnalysis(question, attempt, targetSec, previous) });
  }
  try {
    const text = await complete(
      COACH_SYSTEM,
      analysisPrompt({ question, attempt, previous, targetSec, notesLanguage: body.notesLanguage ?? "en", isFollowUp: body.isFollowUp }),
    );
    return NextResponse.json({ analysis: mergeAiAnalysis(parseJsonObject(text), question, attempt, targetSec, previous) });
  } catch (e) {
    console.error("analyze failed", e);
    // Degrade gracefully: the loop must never dead-end.
    const analysis = demoAnalysis(question, attempt, targetSec, previous);
    return NextResponse.json({ analysis, warning: "AI coach unavailable — showing offline estimate." });
  }
}
