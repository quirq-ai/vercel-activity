import "server-only";
import { cacheLife } from "next/cache";
import workspace from "../../workspace.json";

// Everything in this file runs on the server. The Vercel token is read here and
// never leaves it: pages only receive the allowlisted shapes below.

export type DeployState = "READY" | "ERROR" | "BUILDING" | "QUEUED" | "CANCELED" | "OTHER";

export type PublicDeployment = {
  project: string;
  state: DeployState;
  production: boolean;
  createdAt: number;
  durationMs: number | null;
  branch: string | null;
  sha: string | null;
  message: string | null;
};

export type PublicProject = {
  name: string;
  framework: string | null;
  domain: string | null;
  repoUrl: string | null;
  last: PublicDeployment | null;
  deploys: number;
  errors: number;
};

export type DayBucket = { day: string; ready: number; error: number; other: number };

export type Activity =
  | { ok: false; reason: string; generatedAt: number }
  | {
      ok: true;
      generatedAt: number;
      windowDays: number;
      projects: PublicProject[];
      feed: PublicDeployment[];
      days: DayBucket[];
    };

export type PublicDomain = {
  name: string;
  active: boolean;
  dns: "Vercel DNS" | "External DNS";
  addedAt: number;
  usedBy: string[];
};

export type Account =
  | { ok: false; reason: string; generatedAt: number }
  | {
      ok: true;
      generatedAt: number;
      name: string;
      createdAt: number | null;
      totalProjects: number;
      workspaceProjects: string[];
      domains: PublicDomain[];
    };

const API = process.env.VERCEL_API_BASE ?? "https://api.vercel.com";
const DAY = 86_400_000;
const WINDOW_DAYS = 30;
const FEED_SIZE = 40;
const MAX_PAGES = 20;
const WORKSPACE_REPOS = new Set(workspace.repos.map((r) => r.toLowerCase()));

type Params = Record<string, string | number | string[] | undefined>;

async function vercel<T>(path: string, params: Params = {}): Promise<T> {
  const url = new URL(path, API);
  const team = process.env.VERCEL_TEAM_ID;
  if (team) url.searchParams.set("teamId", team);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => url.searchParams.append(k, x));
    else url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  });
  // Don't echo the response body: it could carry account details.
  if (!res.ok) throw new Error(`Vercel API ${path} returned ${res.status}`);
  return res.json() as Promise<T>;
}

type RawProject = {
  id: string;
  name: string;
  framework?: string | null;
  link?: { type?: string; org?: string; repo?: string };
  targets?: { production?: { alias?: string[] } };
  alias?: { domain?: string }[];
};

type RawDeployment = {
  name: string;
  projectId?: string;
  created: number;
  state?: string;
  readyState?: string;
  target?: string | null;
  buildingAt?: number;
  ready?: number;
  meta?: Record<string, string | undefined>;
};

type RawDomain = {
  name: string;
  verified?: boolean;
  configVerifiedAt?: number | null;
  nameservers?: string[];
  createdAt: number;
};

async function allProjects(): Promise<RawProject[]> {
  const out: RawProject[] = [];
  let from: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await vercel<{ projects: RawProject[]; pagination?: { next?: number | null } }>(
      "/v10/projects",
      { limit: 100, from },
    );
    out.push(...page.projects);
    if (!page.pagination?.next) break;
    from = String(page.pagination.next);
  }
  return out;
}

// Only projects linked to a repo listed in workspace.json are ever shown.
function inWorkspace(p: RawProject): boolean {
  if (p.link?.type !== "github" || !p.link.org || !p.link.repo) return false;
  return WORKSPACE_REPOS.has(`${p.link.org}/${p.link.repo}`.toLowerCase());
}

async function deploymentsSince(projectIds: string[], since: number): Promise<RawDeployment[]> {
  const out: RawDeployment[] = [];
  // The API accepts at most 20 project IDs per request.
  for (let c = 0; c < projectIds.length; c += 20) {
    const chunk = projectIds.slice(c, c + 20);
    let until: number | undefined;
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await vercel<{
        deployments: RawDeployment[];
        pagination?: { next?: number | null };
      }>("/v6/deployments", { limit: 100, since, until, projectIds: chunk });
      out.push(...page.deployments);
      if (!page.pagination?.next) break;
      until = page.pagination.next;
    }
  }
  return out;
}

// A repo counts as public only if GitHub says so to an anonymous request.
// Any failure (private → 404, rate limit, network) fails closed.
async function isPublicRepo(org: string, repo: string): Promise<boolean> {
  "use cache";
  cacheLife("hours");
  try {
    const res = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(org)}/${encodeURIComponent(repo)}`,
      { headers: { Accept: "application/vnd.github+json", "User-Agent": "vercel-activity" } },
    );
    if (!res.ok) return false;
    const body = (await res.json()) as { private?: boolean };
    return body.private === false;
  } catch {
    return false;
  }
}

function normalizeState(s: string | undefined): DeployState {
  switch (s) {
    case "READY":
    case "ERROR":
    case "BUILDING":
    case "QUEUED":
    case "CANCELED":
      return s;
    case "INITIALIZING":
      return "QUEUED";
    default:
      return "OTHER";
  }
}

// Only custom domains are shown: *.vercel.app aliases carry the team slug and
// are often behind Vercel Authentication.
function customDomains(p: RawProject): string[] {
  const all = [
    ...(p.targets?.production?.alias ?? []),
    ...(p.alias ?? []).map((a) => a.domain ?? ""),
  ];
  const custom = [...new Set(all.filter((d) => d && !d.endsWith(".vercel.app")))];
  return custom.sort((a, b) => a.length - b.length);
}

function firstLine(s: string | undefined): string | null {
  const line = s?.split("\n")[0]?.trim();
  if (!line) return null;
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}

function notConfigured(generatedAt: number) {
  return { ok: false as const, reason: "VERCEL_TOKEN is not configured yet.", generatedAt };
}

export async function getActivity(): Promise<Activity> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const generatedAt = Date.now();
  if (!process.env.VERCEL_TOKEN) return notConfigured(generatedAt);

  const privateMessages = process.env.SHOW_PRIVATE_COMMIT_MESSAGES === "true";
  const since = generatedAt - WINDOW_DAYS * DAY;

  let rawProjects: RawProject[];
  let rawDeployments: RawDeployment[];
  try {
    rawProjects = (await allProjects()).filter(inWorkspace);
    rawDeployments = rawProjects.length
      ? await deploymentsSince(
          rawProjects.map((p) => p.id),
          since,
        )
      : [];
  } catch (err) {
    console.error(err);
    return { ok: false, reason: "Could not reach the Vercel API.", generatedAt };
  }

  const byId = new Map(rawProjects.map((p) => [p.id, p]));
  const byName = new Map(rawProjects.map((p) => [p.name, p]));
  const projectOf = (d: RawDeployment) =>
    (d.projectId && byId.get(d.projectId)) || byName.get(d.name);

  const repoPublic = new Map<string, boolean>();
  await Promise.all(
    rawProjects.map(async (p) => {
      repoPublic.set(p.name, await isPublicRepo(p.link!.org!, p.link!.repo!));
    }),
  );

  const toPublic = (d: RawDeployment, p: RawProject): PublicDeployment => {
    const meta = d.meta ?? {};
    const sha = meta.githubCommitSha;
    const start = d.buildingAt ?? d.created;
    return {
      project: p.name,
      state: normalizeState(d.readyState ?? d.state),
      production: d.target === "production",
      createdAt: d.created,
      durationMs: d.ready && d.ready >= start ? d.ready - start : null,
      branch: meta.githubCommitRef ?? null,
      sha: sha ? sha.slice(0, 7) : null,
      message:
        privateMessages || repoPublic.get(p.name) ? firstLine(meta.githubCommitMessage) : null,
    };
  };

  const deployments: PublicDeployment[] = [];
  for (const d of rawDeployments) {
    const p = projectOf(d);
    if (p) deployments.push(toPublic(d, p));
  }
  deployments.sort((a, b) => b.createdAt - a.createdAt);

  const projects: PublicProject[] = rawProjects.map((p) => {
    const own = deployments.filter((d) => d.project === p.name);
    return {
      name: p.name,
      framework: p.framework ?? null,
      domain: customDomains(p)[0] ?? null,
      repoUrl: repoPublic.get(p.name) ? `https://github.com/${p.link!.org}/${p.link!.repo}` : null,
      last: own[0] ?? null,
      deploys: own.length,
      errors: own.filter((d) => d.state === "ERROR").length,
    };
  });
  projects.sort(
    (a, b) => (b.last?.createdAt ?? 0) - (a.last?.createdAt ?? 0) || a.name.localeCompare(b.name),
  );

  const days: DayBucket[] = [];
  const startDay = Math.floor(since / DAY) * DAY;
  for (let t = startDay + DAY; t <= generatedAt; t += DAY) {
    days.push({ day: new Date(t).toISOString().slice(0, 10), ready: 0, error: 0, other: 0 });
  }
  const index = new Map(days.map((b, i) => [b.day, i]));
  for (const d of deployments) {
    const i = index.get(new Date(d.createdAt).toISOString().slice(0, 10));
    if (i === undefined) continue;
    const b = days[i];
    if (d.state === "READY") b.ready++;
    else if (d.state === "ERROR") b.error++;
    else b.other++;
  }

  return {
    ok: true,
    generatedAt,
    windowDays: WINDOW_DAYS,
    projects,
    feed: deployments.slice(0, FEED_SIZE),
    days,
  };
}

export async function getAccount(): Promise<Account> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 900, expire: 86400 });

  const generatedAt = Date.now();
  const team = process.env.VERCEL_TEAM_ID;
  if (!process.env.VERCEL_TOKEN || !team) return notConfigured(generatedAt);

  try {
    const [info, projects, domainPage] = await Promise.all([
      vercel<{ name?: string; createdAt?: number }>(`/v2/teams/${encodeURIComponent(team)}`),
      allProjects(),
      vercel<{ domains: RawDomain[] }>("/v5/domains", { limit: 100 }),
    ]);

    // Only workspace project names are revealed next to a domain.
    const ws = projects.filter(inWorkspace);
    const domains: PublicDomain[] = domainPage.domains.map((d) => ({
      name: d.name,
      active: Boolean(d.verified && d.configVerifiedAt),
      dns: d.nameservers?.some((n) => n.endsWith("vercel-dns.com")) ? "Vercel DNS" : "External DNS",
      addedAt: d.createdAt,
      usedBy: ws
        .filter((p) => customDomains(p).some((h) => h === d.name || h.endsWith(`.${d.name}`)))
        .map((p) => p.name),
    }));
    domains.sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

    return {
      ok: true,
      generatedAt,
      name: info.name ?? "Vercel account",
      createdAt: info.createdAt ?? null,
      totalProjects: projects.length,
      workspaceProjects: ws.map((p) => p.name).sort(),
      domains,
    };
  } catch (err) {
    console.error(err);
    return { ok: false, reason: "Could not reach the Vercel API.", generatedAt };
  }
}
