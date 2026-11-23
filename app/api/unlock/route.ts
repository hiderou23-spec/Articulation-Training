import { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessToken, safeEqual } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const code = process.env.ACCESS_CODE;
  if (!code) return NextResponse.json({ ok: true });
  let given = "";
  try {
    given = String((await req.json()).code ?? "").trim();
  } catch {
    /* empty */
  }
  if (!given || !safeEqual(await accessToken(given), await accessToken(code))) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return NextResponse.json({ ok: false, error: "That code isn't right." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, await accessToken(code), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // remember this device for a year
  });
  return res;
}
