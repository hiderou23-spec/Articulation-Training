// Optional access code. When ACCESS_CODE is set, the app and its API require an unlock
// cookie, so a public deployment can't be used by strangers on your API credits.
// Edge- and Node-safe (Web Crypto only).

export const ACCESS_COOKIE = "aai_access";

export async function accessToken(code: string): Promise<string> {
  const data = new TextEncoder().encode(`articulate-ai:v1:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isAuthorized(cookieValue: string | undefined, code: string | undefined): Promise<boolean> {
  if (!code) return true; // no code configured → open
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await accessToken(code));
}

/** Paths reachable without unlocking (the unlock screen itself and PWA/static assets). */
export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/unlock" ||
    pathname === "/api/unlock" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/")
  );
}
