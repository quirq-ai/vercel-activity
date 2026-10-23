"use client";

import { useSyncExternalStore } from "react";

// One shared ticking clock so every TimeAgo re-renders together, once a minute.
let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 60_000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

export function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function TimeAgo({ ts }: { ts: number }) {
  const current = useSyncExternalStore(
    subscribe,
    () => now,
    () => null,
  );
  const iso = new Date(ts).toISOString();
  return (
    <time dateTime={iso} title={iso.replace("T", " ").slice(0, 16) + " UTC"}>
      {current === null ? iso.slice(0, 10) : ago(current - ts)}
    </time>
  );
}
