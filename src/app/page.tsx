import { getActivity, type PublicDeployment, type PublicProject } from "@/lib/activity";
import { DeployChart } from "@/components/DeployChart";
import { StateBadge } from "@/components/StateBadge";
import { TimeAgo } from "@/components/TimeAgo";

function duration(ms: number | null) {
  if (ms === null) return "—";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-grid bg-card p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-secondary">{hint}</div>}
    </div>
  );
}

function ProjectCard({ p }: { p: PublicProject }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-grid bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-medium">{p.name}</div>
          <div className="text-xs text-muted">{p.framework ?? "static"}</div>
        </div>
        {p.last && <StateBadge state={p.last.state} />}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
        {p.domain && (
          <a
            href={`https://${p.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-secondary hover:text-primary"
          >
            {p.domain} ↗
          </a>
        )}
        {p.repoUrl && (
          <a
            href={p.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-secondary hover:text-primary"
          >
            GitHub ↗
          </a>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between text-xs text-muted">
        <span>
          <span className="tabular-nums text-secondary">{p.deploys}</span> deploys
          {p.errors > 0 && (
            <>
              {" · "}
              <span className="tabular-nums text-critical">{p.errors}</span> failed
            </>
          )}
        </span>
        {p.last && <TimeAgo ts={p.last.createdAt} />}
      </div>
    </li>
  );
}

function FeedRow({ d }: { d: PublicDeployment }) {
  return (
    <tr className="border-t border-grid align-top">
      <td className="py-2 pr-3 whitespace-nowrap">
        <StateBadge state={d.state} />
      </td>
      <td className="py-2 pr-3 font-medium whitespace-nowrap">{d.project}</td>
      <td className="py-2 pr-3 whitespace-nowrap">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
            d.production ? "bg-primary text-surface" : "border border-grid text-muted"
          }`}
        >
          {d.production ? "prod" : "preview"}
        </span>
      </td>
      <td className="py-2 pr-3 text-secondary">
        <div className="max-w-md truncate">
          {d.message ?? (d.sha ? `commit ${d.sha}` : "manual deploy")}
        </div>
        {(d.branch || d.sha) && (
          <div className="font-mono text-[11px] text-muted">
            {d.branch}
            {d.branch && d.sha && " · "}
            {d.sha}
          </div>
        )}
      </td>
      <td className="py-2 pr-3 text-right tabular-nums text-muted whitespace-nowrap">
        {duration(d.durationMs)}
      </td>
      <td className="py-2 text-right text-muted whitespace-nowrap">
        <TimeAgo ts={d.createdAt} />
      </td>
    </tr>
  );
}

export default async function Home() {
  const data = await getActivity();

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <svg viewBox="0 0 76 65" className="size-5 fill-current" aria-hidden>
              <path d="M37.5 0 75 65H0z" />
            </svg>
            Vercel activity
          </h1>
          <p className="mt-1 text-sm text-secondary">
            What&apos;s shipping across our Vercel projects.
          </p>
        </div>
        <p className="text-xs text-muted">
          Updated <TimeAgo ts={data.generatedAt} /> · refreshes every 5 min
        </p>
      </header>

      {!data.ok ? (
        <div className="rounded-lg border border-grid bg-card p-6 text-sm text-secondary">
          Activity is unavailable right now. {data.reason}
        </div>
      ) : (
        <Dashboard data={data} />
      )}

      <footer className="mt-4 text-xs text-muted">
        Showing projects deployed in the last {data.ok ? data.windowDays : 30} days. Preview
        URLs, private repos and account details are never shown.
      </footer>
    </main>
  );
}

function Dashboard({ data }: { data: Extract<Awaited<ReturnType<typeof getActivity>>, { ok: true }> }) {
  const all = data.days.reduce(
    (acc, d) => ({ ready: acc.ready + d.ready, error: acc.error + d.error, other: acc.other + d.other }),
    { ready: 0, error: 0, other: 0 },
  );
  const total = all.ready + all.error + all.other;
  const finished = all.ready + all.error;
  const week = data.days.slice(-7).reduce((n, d) => n + d.ready + d.error + d.other, 0);
  const failing = data.projects.filter((p) => p.last?.state === "ERROR").length;

  return (
    <>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active projects" value={String(data.projects.length)} />
        <Stat label="Deploys, last 7 days" value={String(week)} hint={`${total} in ${data.windowDays} days`} />
        <Stat
          label="Success rate"
          value={finished ? `${Math.round((all.ready / finished) * 100)}%` : "—"}
          hint={`${all.error} failed`}
        />
        <Stat
          label="Currently failing"
          value={String(failing)}
          hint={failing ? "latest deploy errored" : "all green"}
        />
      </section>

      <section className="rounded-lg border border-grid bg-card p-5">
        <DeployChart days={data.days} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-secondary">Projects</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.projects.map((p) => (
            <ProjectCard key={p.name} p={p} />
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-secondary">Latest deployments</h2>
        <div className="overflow-x-auto rounded-lg border border-grid bg-card px-4">
          <table className="w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th>State</th>
                <th>Project</th>
                <th>Environment</th>
                <th>Commit</th>
                <th>Build time</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {data.feed.map((d, i) => (
                <FeedRow key={`${d.project}-${d.createdAt}-${i}`} d={d} />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
