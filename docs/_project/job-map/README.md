# job-map

Search company careers pages for UI / Node / Java roles. Private tracker (`docs/_project/` is not in the site build).

```bash
cd docs/_project/job-map && npm i
export CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome   # only if Playwright can't find its browser

node jobs.mjs "Razorpay"                     # one company, any name
node jobs.mjs Notion Hotstar --track java    # several, one track
node jobs.mjs --preset fintech               # every preset in a category (fintech|saas|unicorn|bigtech|gcc|services)
node jobs.mjs --preset t1 --region us        # by tier; regions: india|us|canada|europe|any
node crawl.mjs india                         # batch run over all presets -> JOBS-INDIA.md
```

How a name is resolved: preset list → guessed Greenhouse/Lever/Ashby/SmartRecruiters board → render the
careers page and spot the job system (incl. Workday) → fall back to listing engineer-looking links.
Companies on custom or login-gated sites (e.g. Postman, Zepto) return just the careers URL.
Add a company permanently by putting `{name, category, tier, ats, slug}` in `companies.json`.
