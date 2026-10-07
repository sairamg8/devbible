---
name: devbible-resume-job-map
description: COLD-START file for the job-map project — say "RESUME-JOB-MAP" and read this first; exact commands to resume on a laptop, state as of 2026-10-07, and the next steps in order
metadata:
  type: project
---

# RESUME-JOB-MAP — cold start (written 2026-10-07)

Say **"RESUME-JOB-MAP"** and read this file first, then [project_job_map.md](project_job_map.md). This project is not a devbible track: it takes no LOCKS entry and does not touch the site build.

## Get the code (laptop)
```bash
git fetch origin ccr-1555475c-8lxaf2 && git checkout ccr-1555475c-8lxaf2
cd docs/_project/job-map && npm i                 # playwright (set CHROME=<path to chromium> if it cannot find one)
```
Needs Node 22.5+ (uses the built-in `node:sqlite`) and, for the login app, Postgres 14+.

## State on 2026-10-07
- 3,036 companies, ~54,000 roles, 60 countries. All functions, not just engineering.
- Crawl inputs/outputs are committed: `companies.json`, `discovered.json`, `unresolved.json`, `careers-results.json`, `jobs-agg.json`.
- **Not in git** (rebuild them): `db.json`, `jobs.sqlite` (25 MB), `jobs-*.json` + `data-meta.json` (page data).
- Published page: Artifact `SToJj7kX7hxtm9vqbzRFMG` (private). Update by republishing `page.html` with the shard files (see below).
- Login app `job-map/app/`: built and tested (29 checks), **not deployed**.

## Rebuild without re-crawling the web search parts (~15 min)
```bash
cd docs/_project/job-map
node build-db.mjs        # re-reads every company's job board
node build-sqlite.mjs    # -> jobs.sqlite
node make-page.mjs       # -> page.html, data-meta.json, jobs-<COUNTRY>.json
```
Full refresh (~1.5 h): `node find-companies.mjs`, then `node crawl-careers.mjs --limit 700` (resumable), then the three above.

## Run the login app
```bash
cd app && npm i
createdb jobmap && psql jobmap -f schema.sql
DATABASE_URL=postgres:///jobmap JWT_SECRET=$(openssl rand -base64 48) npm start    # http://localhost:3000
DATABASE_URL=postgres://user:pass@localhost/jobmap_test npm test                    # 29 checks; wipes the test DB's three tables
```

## Next steps, in order
1. **Deploy** the app: pick a host for Express and a free Postgres (Neon/Supabase). Ship `jobs.sqlite` with the app or download it at start. Set `NODE_ENV=production` behind HTTPS.
2. **Weekly refresh** as a GitHub Action: run the pipeline, publish `jobs.sqlite` as a release asset, restart the app.
3. **Better tagging**: read job descriptions (Greenhouse/Lever/Ashby give them) so "Stack not stated" shrinks and Java/Node/Frontend counts grow.
4. **More coverage**: ~3,900 large Wikidata companies still have no readable board; add adapters (Taleo, SuccessFactors, Oracle) or crawl more careers sites.

## Traps already hit (do not repeat)
- `pkill -f <name>` run inside a command that contains `<name>` kills your own shell; use the PID.
- A container restart kills background jobs; scripts that only write at the end lose everything — checkpoint.
- Wikimedia APIs rate-limit (429) after bursts; Wikidata SPARQL needs POST and a descriptive User-Agent.
- Welcome to the Jungle (Natixis's job host) blocks automated access — link to it, do not scrape.
- `el.onfocusout = …` does nothing in browsers; use `addEventListener('focusout', …)`.
- Playwright's bundled browser version may not match `/opt/pw-browsers`; pass `executablePath`.
