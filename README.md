# vercel-activity

A small public page showing deployment activity across our Vercel projects.

The page is a Next.js server component. `src/lib/activity.ts` calls the Vercel
REST API with a server-only token, keeps only an allowlist of public-safe
fields, and caches the result for 5 minutes (`"use cache"` + `cacheLife`).
The token never reaches the browser.

## Environment

| Variable | Required | Meaning |
|---|---|---|
| `VERCEL_TOKEN` | yes | Read token for the team (mark it Sensitive) |
| `VERCEL_TEAM_ID` | yes | Team whose projects are shown |
| `ACTIVE_DAYS` | no | Window for "active" projects and the chart (default 30) |
| `VISIBLE_PROJECTS` | no | Comma list; if set, only these projects are shown |
| `HIDDEN_PROJECTS` | no | Comma list of projects never shown |
| `SHOW_PRIVATE_COMMIT_MESSAGES` | no | `true` to show commit titles for private repos (default: only public repos) |

## What is public

Project name, framework, custom production domain, GitHub link (public repos
only), deploy state, prod/preview, time, build duration, branch, short SHA, and
the first line of the commit message (public repos only unless enabled above).

Never shown: env vars, preview/`*.vercel.app` URLs, inspector links, team or
user IDs, creator usernames, commit authors/emails, private repo names, logs.

## Develop

```bash
npm install
VERCEL_TOKEN=... VERCEL_TEAM_ID=... npm run dev
```
