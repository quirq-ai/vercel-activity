import type { Metadata } from "next";
import { getAccount } from "@/lib/activity";
import { TimeAgo } from "@/components/TimeAgo";

export const metadata: Metadata = {
  title: "Account & domains · Vercel activity",
};

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default async function AccountPage() {
  const data = await getAccount();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-secondary">
          The Vercel account these projects deploy to, and the domains on it.
        </p>
        <p className="text-xs text-muted">
          Updated <TimeAgo ts={data.generatedAt} /> · refreshes every 15 min
        </p>
      </div>

      {!data.ok ? (
        <div className="rounded-lg border border-grid bg-card p-6 text-sm text-secondary">
          Account details are unavailable right now. {data.reason}
        </div>
      ) : (
        <>
          <section className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr]">
            <div className="rounded-lg border border-grid bg-card p-4">
              <div className="text-xs text-muted">Connected Vercel account</div>
              <div className="mt-1 text-2xl font-semibold">{data.name}</div>
              {data.createdAt && (
                <div className="mt-0.5 text-xs text-secondary">
                  Team since {fmtDate(data.createdAt)}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-grid bg-card p-4">
              <div className="text-xs text-muted">Projects from this workspace</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {data.workspaceProjects.length}
              </div>
              <div className="mt-0.5 text-xs text-secondary">
                of {data.totalProjects} on the account
              </div>
            </div>
            <div className="rounded-lg border border-grid bg-card p-4">
              <div className="text-xs text-muted">Active domains</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">
                {data.domains.filter((d) => d.active).length}
              </div>
              <div className="mt-0.5 text-xs text-secondary">
                of {data.domains.length} on the account
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-secondary">Domains</h2>
            <div className="overflow-x-auto rounded-lg border border-grid bg-card px-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-2.5 pr-3 font-normal">Domain</th>
                    <th className="py-2.5 pr-3 font-normal">Status</th>
                    <th className="py-2.5 pr-3 font-normal">DNS</th>
                    <th className="py-2.5 pr-3 font-normal">Used by</th>
                    <th className="py-2.5 text-right font-normal">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {data.domains.map((d) => (
                    <tr key={d.name} className="border-t border-grid">
                      <td className="py-2.5 pr-3 font-medium whitespace-nowrap">
                        {d.active ? (
                          <a
                            href={`https://${d.name}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {d.name} ↗
                          </a>
                        ) : (
                          d.name
                        )}
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">
                        {d.active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-good">
                            <span aria-hidden>●</span>Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted">
                            <span aria-hidden>○</span>Not configured
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-secondary whitespace-nowrap">
                        {d.dns}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-secondary">
                        {d.usedBy.length ? d.usedBy.join(", ") : <span className="text-muted">—</span>}
                      </td>
                      <td className="py-2.5 text-right text-xs text-muted whitespace-nowrap">
                        {fmtDate(d.addedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-secondary">Workspace projects on this account</h2>
            <ul className="flex flex-wrap gap-2">
              {data.workspaceProjects.map((name) => (
                <li
                  key={name}
                  className="rounded-md border border-grid bg-card px-2.5 py-1 text-sm text-secondary"
                >
                  {name}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </>
  );
}
