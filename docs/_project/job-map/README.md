# job-map

Open-role finder across companies and countries. Private tracker (`docs/_project/` is not in the site build).
Browsable page: the published Artifact. Login app: `app/` (Express + SQLite jobs + Postgres users).

## Pipeline (run in this order; each step reads the previous step's files)

```bash
npm i                                    # playwright; set CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome if it can't find its browser
node find-companies.mjs                  # discover companies: Wikidata (28 countries), Y Combinator hiring list, job APIs -> discovered.json, unresolved.json, jobs-agg.json
node crawl-careers.mjs --limit 700       # open careers sites of companies with no readable job board -> careers-results.json  (resumable)
node build-db.mjs                        # read every job board, classify (function/position/stack/level/country) -> db.json
node build-sqlite.mjs                    # db.json -> jobs.sqlite (FTS5, first_seen carried over)
node make-page.mjs                       # page.html + data-meta.json + jobs-<COUNTRY>.json (publish these as the Artifact)
```

Single-company lookups: `node jobs.mjs "Razorpay" --region india --track java`, or `--preset fintech|t1|all`.

## Files
- `companies.json` hand-picked list (`seed.txt` is its source; tiers are judgement). `discovered.json` crawler-found companies (tier from employee count).
- `lib.mjs` function / position / stack / level / country rules. `ats.mjs` readers for Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Workday, Atlassian.
- Generated and git-ignored: `db.json`, `jobs.sqlite`, `jobs-*.json`, `data-meta.json`.

## Known limits
Boards that block automated reading (e.g. Welcome to the Jungle, hence Natixis) and logged-in or custom ATS (Taleo, SuccessFactors, Oracle) are linked, not read.
Function and position come from job titles; "Stack not stated" covers most generic engineer titles.
