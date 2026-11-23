import { describe, expect, it } from "vitest";
import { accessToken, isAuthorized, isPublicPath, safeEqual } from "@/lib/access";

describe("access code", () => {
  it("is open when no code is configured", async () => {
    expect(await isAuthorized(undefined, undefined)).toBe(true);
    expect(await isAuthorized(undefined, "")).toBe(true);
  });
  it("requires the matching cookie when a code is set", async () => {
    const token = await accessToken("sakura-2026");
    expect(await isAuthorized(undefined, "sakura-2026")).toBe(false);
    expect(await isAuthorized("wrong", "sakura-2026")).toBe(false);
    expect(await isAuthorized(await accessToken("other"), "sakura-2026")).toBe(false);
    expect(await isAuthorized(token, "sakura-2026")).toBe(true);
  });
  it("token never contains the code itself", async () => {
    const t = await accessToken("sakura-2026");
    expect(t).toMatch(/^[0-9a-f]{64}$/);
    expect(t).not.toContain("sakura");
  });
  it("safeEqual compares exactly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
  it("keeps the unlock screen and PWA assets public, everything else gated", () => {
    for (const p of ["/unlock", "/api/unlock", "/manifest.webmanifest", "/sw.js", "/icons/icon-192.png", "/_next/static/x.js"]) expect(isPublicPath(p)).toBe(true);
    for (const p of ["/", "/practice", "/settings", "/api/analyze", "/api/status", "/api/transcribe", "/unlockx"]) expect(isPublicPath(p)).toBe(false);
  });
});
