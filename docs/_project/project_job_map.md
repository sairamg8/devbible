---
name: devbible-project-job-map
description: The job-map side project (2026-10-06/07) — crawler + database + browsable page + login app that lists open roles at companies in any country; where everything is, how to rebuild it, what was decided and what is still open
metadata:
  type: project
---

# Job Map — open roles across companies, any country, any function

**Why:** the user wants one place to see which companies are hiring, first for UI/frontend, Node (MERN/PERN) and Java Spring Boot,
then widened (same day) to **any role in any country** because a family member works in AML/KYC at a bank (Natixis).
It lives **inside this repo**, at `docs/_project/job-map/` — private, not in the site build. Branch used: `ccr-1555475c-8lxaf2`.

**Browsable page:** claude.ai Artifact `SToJj7kX7hxtm9vqbzRFMG` (private; republish the same path to update). Phone is the main device — mobile layout matters.

## Pipeline (details in `job-map/README.md`)
`find-companies.mjs` (Wikidata 28 countries + YC hiring list + job APIs) → `crawl-careers.mjs` (browser, careers sites with no readable board)
→ `build-db.mjs` → `build-sqlite.mjs` (jobs.sqlite, FTS5) → `make-page.mjs` (page + per-country shards). The login app is `job-map/app/` (Express; jobs from SQLite, users/saved jobs in Postgres; 29-check `npm test`).
Generated files (`db.json`, `jobs.sqlite`, `jobs-*.json`) are git-ignored; crawl inputs/outputs are committed. A full refresh is ~1.5 h.

## Decisions the user made or accepted
- **SQLite for job data, Postgres for login/user data** — user liked the "serverless single file" idea for the read-only job data.
- Companies are **discovered automatically**, not only a hand list; tiers for discovered companies come from employee count, curated tiers are judgement.
- The "Check manually / Google search" fallback was **rejected** — show the company's real careers URL and position links instead.
- Do **not** scrape sites that block bots (Welcome to the Jungle returned 403 for Natixis) — link to the careers page.

## Open / not done
Deploy the app (host + free Postgres not chosen); weekly refresh job (GitHub Action) not set up; 4,372 Wikidata companies still have no readable board (only the top ~700 by size were crawled);
function/position come from titles only, so many generic "Software Engineer" roles say "stack not stated" — reading job descriptions would fix it.

**Search on:** job map, hiring, careers, crawler, jobs.sqlite, wikidata, AML KYC, natixis.
