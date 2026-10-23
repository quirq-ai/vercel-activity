"use client";

import { useState } from "react";
import type { DayBucket } from "@/lib/activity";

const SERIES = [
  { key: "ready", label: "Ready", cls: "bg-good" },
  { key: "error", label: "Error", cls: "bg-critical" },
  { key: "other", label: "Canceled / other", cls: "bg-neutral" },
] as const;

function fmtDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function DeployChart({ days }: { days: DayBucket[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.ready + d.error + d.other));
  const h = days[hover ?? -1];

  return (
    <figure className="flex flex-col gap-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-primary">Deployments per day</span>
        <ul className="flex gap-4 text-xs text-secondary">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className={`size-2.5 rounded-sm ${s.cls}`} aria-hidden />
              {s.label}
            </li>
          ))}
        </ul>
      </figcaption>

      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-grid" />
        <span className="pointer-events-none absolute -top-2 right-0 bg-card pl-1 text-[10px] tabular-nums text-muted">
          {max}
        </span>
        <div
          className="flex h-40 items-end gap-[2px] border-b border-axis"
          onMouseLeave={() => setHover(null)}
          role="img"
          aria-label="Stacked bar chart of deployments per day"
        >
          {days.map((d, i) => {
            const total = d.ready + d.error + d.other;
            return (
              <div
                key={d.day}
                className="flex h-full flex-1 cursor-default flex-col justify-end"
                onMouseEnter={() => setHover(i)}
              >
                <div
                  className={`flex w-full flex-col-reverse gap-[2px] overflow-hidden rounded-t-[4px] transition-opacity ${
                    hover !== null && hover !== i ? "opacity-50" : ""
                  }`}
                  style={{ height: `${(total / max) * 100}%` }}
                >
                  {SERIES.map((s) =>
                    d[s.key] ? (
                      <div key={s.key} className={s.cls} style={{ flexGrow: d[s.key] }} />
                    ) : null,
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {h && (
          <div
            className="pointer-events-none absolute -top-2 z-10 w-40 -translate-x-1/2 -translate-y-full rounded-md border border-grid bg-raised p-2 text-xs shadow-lg"
            style={{ left: `${((hover! + 0.5) / days.length) * 100}%` }}
          >
            <div className="mb-1 font-medium text-primary">{fmtDay(h.day)}</div>
            {SERIES.map((s) => (
              <div key={s.key} className="flex items-center justify-between text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className={`size-2 rounded-sm ${s.cls}`} aria-hidden />
                  {s.label}
                </span>
                <span className="tabular-nums text-primary">{h[s.key]}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-1.5 flex justify-between text-[10px] text-muted">
          <span>{days[0] && fmtDay(days[0].day)}</span>
          <span>{days.at(-1) && fmtDay(days.at(-1)!.day)}</span>
        </div>
      </div>
    </figure>
  );
}
