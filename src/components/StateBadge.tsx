import type { DeployState } from "@/lib/activity";

const STYLE: Record<DeployState, { label: string; icon: string; cls: string }> = {
  READY: { label: "Ready", icon: "●", cls: "text-good" },
  ERROR: { label: "Error", icon: "✕", cls: "text-critical" },
  BUILDING: { label: "Building", icon: "◐", cls: "text-warning" },
  QUEUED: { label: "Queued", icon: "○", cls: "text-muted" },
  CANCELED: { label: "Canceled", icon: "–", cls: "text-muted" },
  OTHER: { label: "Unknown", icon: "?", cls: "text-muted" },
};

export function StateBadge({ state }: { state: DeployState }) {
  const s = STYLE[state];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}
