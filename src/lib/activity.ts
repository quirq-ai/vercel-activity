import "server-only";
import { cacheLife } from "next/cache";

// Everything in this file runs on the server. The Vercel token is read here and
// never leaves it: the page only receives the allowlisted shapes below.

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

const API = process.env.VERCEL_API_BASE ?? "https://api.vercel.com";
const DAY = 86_400_000;
const FEED_SIZE = 40;
const MAX_PAGES = 20;

function list(name: string): Set<string> {
  return new Set(
    (process.env[name] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

async function vercel<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const url = new URL(path, API);
  const team = process.env.VERCEL_TEAM_ID;
  if (team) url.searchParams.set("teamId", team);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
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

async function allProjects(): Promise<RawProject[]> {
  const out: RawProject[] = [];
  let from: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await vercel<{ projects: RawProject[]; pagination?: { next?: number | null } }>(
      "/v10/projects",
      { limit: 100, ...(from ? { from } : {}) },
    );
    out.push(...page.projects);
    if (!page.pagination?.next) break;
    from = String(page.pagination.next);
  }
  return out;
}

async function deploymentsSince(since: number): Promise<RawDeployment[]> {
  const out: RawDeployment[] = [];
  let until: number | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await vercel<{ deployments: RawDeployment[]; pagination?: { next?: number | null } }>(
      "/v6/deployments",
      { limit: 100, since, ...(until ? { until } : {}) },
    );
    out.push(...page.deployments);
    if (!page.pagination?.next) break;
    until = page.pagination.next;
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

// Only a custom domain is shown: *.vercel.app aliases can carry the team slug
// and are often behind Vercel Authentication.
function publicDomain(p: RawProject): string | null {
  const candidates = [
    ...(p.targets?.production?.alias ?? []),
    ...(p.alias ?? []).map((a) => a.domain ?? ""),
  ];
  const custom = candidates.filter((d) => d && !d.endsWith(".vercel.app"));
  custom.sort((a, b) => a.length - b.length);
  return custom[0] ?? null;
}

function firstLine(s: string | undefined): string | null {
  const line = s?.split("\n")[0]?.trim();
  if (!line) return null;
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}

export async function getActivity(): Promise<Activity> {
  "use cache";
  cacheLife({ stale: 60, revalidate: 300, expire: 3600 });

  const generatedAt = Date.now();
  if (!process.env.VERCEL_TOKEN) {
    return { ok: false, reason: "VERCEL_TOKEN is not configured yet.", generatedAt };
  }

  const windowDays = Number(process.env.ACTIVE_DAYS) || 30;
  const visible = list("VISIBLE_PROJECTS");
  const hidden = list("HIDDEN_PROJECTS");
  const privateMessages = process.env.SHOW_PRIVATE_COMMIT_MESSAGES === "true";
  const since = generatedAt - windowDays * DAY;

  let rawProjects: RawProject[];
  let rawDeployments: RawDeployment[];
  try {
    [rawProjects, rawDeployments] = await Promise.all([allProjects(), deploymentsSince(since)]);
  } catch (err) {
    console.error(err);
    return { ok: false, reason: "Could not reach the Vercel API.", generatedAt };
  }

  const shown = (name: string) =>
    !hidden.has(name) && (visible.size === 0 || visible.has(name));

  const byId = new Map(rawProjects.map((p) => [p.id, p]));
  const byName = new Map(rawProjects.map((p) => [p.name, p]));
  const projectOf = (d: RawDeployment) =>
    (d.projectId && byId.get(d.projectId)) || byName.get(d.name);

  // With no allowlist, a project appears only if it deployed inside the window.
  const active = new Set<string>();
  for (const d of rawDeployments) {
    const p = projectOf(d);
    if (p && shown(p.name)) active.add(p.name);
  }

  const repoPublic = new Map<string, boolean>();
  await Promise.all(
    rawProjects
      .filter((p) => active.has(p.name) && p.link?.type === "github" && p.link.org && p.link.repo)
      .map(async (p) => {
        repoPublic.set(p.name, await isPublicRepo(p.link!.org!, p.link!.repo!));
      }),
  );

  const toPublic = (d: RawDeployment, p: RawProject): PublicDeployment => {
    const meta = d.meta ?? {};
    const sha = meta.githubCommitSha ?? meta.gitlabCommitSha ?? meta.bitbucketCommitSha;
    const message =
      meta.githubCommitMessage ?? meta.gitlabCommitMessage ?? meta.bitbucketCommitMessage;
    const start = d.buildingAt ?? d.created;
    return {
      project: p.name,
      state: normalizeState(d.readyState ?? d.state),
      production: d.target === "production",
      createdAt: d.created,
      durationMs: d.ready && d.ready >= start ? d.ready - start : null,
      branch: meta.githubCommitRef ?? meta.gitlabCommitRef ?? meta.bitbucketCommitRef ?? null,
      sha: sha ? sha.slice(0, 7) : null,
      message: privateMessages || repoPublic.get(p.name) ? firstLine(message) : null,
    };
  };

  const deployments: PublicDeployment[] = [];
  for (const d of rawDeployments) {
    const p = projectOf(d);
    if (p && active.has(p.name)) deployments.push(toPublic(d, p));
  }
  deployments.sort((a, b) => b.createdAt - a.createdAt);

  const projects: PublicProject[] = [...active].map((name) => {
    const p = byName.get(name)!;
    const own = deployments.filter((d) => d.project === name);
    const repoUrl =
      repoPublic.get(name) && p.link ? `https://github.com/${p.link.org}/${p.link.repo}` : null;
    return {
      name,
      framework: p.framework ?? null,
      domain: publicDomain(p),
      repoUrl,
      last: own[0] ?? null,
      deploys: own.length,
      errors: own.filter((d) => d.state === "ERROR").length,
    };
  });
  projects.sort((a, b) => (b.last?.createdAt ?? 0) - (a.last?.createdAt ?? 0));

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
    windowDays,
    projects,
    feed: deployments.slice(0, FEED_SIZE),
    days,
  };
}
