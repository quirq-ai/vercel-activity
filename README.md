# vercel-activity

A small public site showing deployment activity for the Vercel projects
deployed from our workspace, plus an `/account` page with the connected Vercel
account and its domains.

Which projects appear is decided by `workspace.json`: a Vercel project is shown
only if it is linked to one of the GitHub repos listed there. Add a repo to that
file when the workspace starts deploying it.

The page is a Next.js server component. `src/lib/activity.ts` calls the Vercel
REST API with a server-only token, keeps only an allowlist of public-safe
fields, and caches the result for 5 minutes (`"use cache"` + `cacheLife`).
The token never reaches the browser.

## Environment

| Variable | Required | Meaning |
|---|---|---|
| `VERCEL_TOKEN` | yes | Read token for the team (mark it Sensitive) |
| `VERCEL_TEAM_ID` | yes | Team whose projects are shown |
| `SHOW_PRIVATE_COMMIT_MESSAGES` | no | `true` to show commit titles for private repos (default: only public repos) |

## What is public

Project name, framework, custom production domain, GitHub link (public repos
only), deploy state, prod/preview, time, build duration, branch, short SHA, and
the first line of the commit message (public repos only unless enabled above).

The account page shows the account (team) name, when it was created, project
counts, and each domain's name, status, DNS provider and which workspace
projects use it.

Never shown: env vars, preview/`*.vercel.app` URLs, inspector links, team or
user IDs, creator usernames, commit authors/emails, private repo names, logs.

## Develop

```bash
npm install
VERCEL_TOKEN=... VERCEL_TEAM_ID=... npm run dev
```
