"use client";
import { useEffect, useRef, useState } from "react";
import { getAudio } from "@/lib/storage";
import { Icon } from "./Icon";

/** Plays a recording from an in-memory object URL or a stored IndexedDB key. */
export function Player({ url, audioKey, label = "Play recording" }: { url?: string; audioKey?: string; label?: string }) {
  const [src, setSrc] = useState<string | undefined>(url);
  const [playing, setPlaying] = useState(false);
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (url) { setSrc(url); return; }
    let revoke: string | undefined;
    if (audioKey) getAudio(audioKey).then((b) => { if (b) { revoke = URL.createObjectURL(b); setSrc(revoke); } });
    return () => { if (revoke) URL.revokeObjectURL(revoke); };
  }, [url, audioKey]);

  if (!src) return null;
  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {}); else el.pause();
  };
  return (
    <>
      <audio ref={ref} src={src} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
      <button onClick={toggle} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-ink-2">
        <Icon name={playing ? "pause" : "play"} size={14} /> {playing ? "Pause" : label}
      </button>
    </>
  );
}
