"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function UnlockPage() {
  return (
    <Suspense fallback={null}>
      <Unlock />
    </Suspense>
  );
}

function Unlock() {
  const params = useSearchParams();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }) });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "That code isn't right.");
      const next = params.get("next");
      window.location.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check the code. Are you online?");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[80dvh] flex-col justify-center gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Articulate AI</h1>
        <p className="mt-1 text-ink-2">Enter your access code. This device will be remembered.</p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="code" className="sr-only">Access code</label>
        <input id="code" type="password" autoComplete="current-password" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Access code" className="w-full rounded-2xl border border-line bg-surface px-4 py-4 text-lg" />
        {error && <p className="text-sm text-warn" role="alert">{error}</p>}
        <button type="submit" disabled={busy || !code.trim()} className="w-full rounded-2xl bg-accent py-4 text-lg font-semibold text-accent-ink disabled:opacity-40">
          {busy ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
