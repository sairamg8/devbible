---
name: devbible-dashboard-reconcile-20260906
description: The 2026-09-06 dashboard reconciliation — `yarn status` had been THROWING since page-counts.json landed, so static/status.json froze on 2026-09-05 and silently held back two corrections. Open on "the dashboard is wrong", "update progress", "status.json stale", or before trusting any number on the homepage.
metadata:
  type: project
---

# devbible — the dashboard reconciliation, 2026-09-06 (commit `e61a15b5`)

Order: *"Review the memories and existing completed work on disk update the dashboard with
correct progress please"* — plus *"Do not deploy any agents please work on your self"*, so this
was done by hand, no subagents.

## 🔴 THE KEEPER FINDING — `yarn status` had been failing silently for a day

`static/status.json` is the file the dashboard **fetches** (Docusaurus serves `static/` at the
site root, so it lands on `/devbible/status.json`). It is generated from `src/data/progress.js`
by `scripts/status.mjs`, which copies progress.js into a temp `.mjs` and `import()`s the copy.

**The day `import PAGE_COUNTS from './page-counts.json'` was added to progress.js (the
ui-redesign work), that copy started failing TWICE over:**

| Failure | Why |
|---|---|
| `ERR_MODULE_NOT_FOUND` | the copy sits in `os.tmpdir()`, so `./page-counts.json` resolves to a path that does not exist |
| `ERR_IMPORT_ATTRIBUTE_MISSING` | even next to the JSON, Node ≥22 refuses a bare JSON import without `with {type: 'json'}` — **bundlers allow it, Node does not** |

Both are hard throws. `yarn status` exited non-zero, **`status.json` simply stopped updating**,
and nothing anywhere said so. It sat frozen at `"updated": "2026-09-05 10:15"`.

🔴 **The generalisable trap: a file that is BOTH bundled and read by a plain Node script has
two different module resolvers, and only one of them is exercised by `yarn build`.** Adding a
JSON import to `progress.js` passed every Docusaurus check and broke every script that loads it
outside the bundler.

**The other two loaders were checked, and the split is instructive:**

| Script | Verdict |
|---|---|
| `scripts/validate.mjs` | ✅ **already immune — and it knew.** Its `--drift` path carries the comment *"Read the numbers, do not import the module"* and regexes `verified:` straight out of the source text |
| `scripts/currency.mjs` | ✅ **unaffected** — despite being written as *"a copy of status.mjs"* ([[devbible-currency-system]]) it copies `src/data/pins.js`, which has no JSON import. Runs clean |

🔴 **So one script had already hit this and worked around it locally instead of fixing the
shared cause.** A workaround buried in one consumer leaves every other consumer broken; the
comment at `scripts/validate.mjs:309` was the existing evidence nobody carried across.

**The fix** (in `scripts/status.mjs`): rewrite that one import line on the way into the temp
copy, to a `createRequire` pointed at the **real** `src/data/progress.js` URL. That kills both
failures at once — no attribute needed, and the relative path resolves against the real
directory.

```js
fs.writeFileSync(tmp, fs.readFileSync(realProgressJs, 'utf8').replace(
  /^import PAGE_COUNTS from '\.\/page-counts\.json';$/m,
  "import {createRequire} from 'node:module';\n" +
  `const PAGE_COUNTS = createRequire(${JSON.stringify(realUrl)})('./page-counts.json');`));
```

⚠️ **The same transform is what you need to inspect `progress.js` from any ad-hoc script** —
`sed` the import line, write to a scratch `.mjs`, import that. Do not try to `node` it directly.

## What the frozen feed was hiding

Unblocking the script published two corrections that had been sitting **correct in
progress.js since the 2026-09-05 audit** and had never reached the dashboard:

- **Java** 13/17 phases → **12/17**, 83% → **80%**
- **MongoDB** 7/15 → **6/15**, 49% → **48%**

Both are the `pagesPlanned` over-crediting that audit found. 🔴 **So "progress.js is right" is
not the same as "the dashboard is right" — there are two artefacts and the second one can be
stale on its own.** `yarn status --check` is the only thing that tells you.

## The two tracks that had actually drifted

A disk-vs-declared sweep over all 29 tracks found **exactly two**. Everything else agreed.

### Angular — phase 0 declared `pages: 0` against 47 files

Measured, not estimated: `phase-0-how-angular-runs/` holds three topic directories —
**02 `standalone-by-default` content-complete and wired (32 files)**, 01 (7 files) and 03
(8 files) at roughly 5 of 17 chunks each, topics 04–12 unstarted.

So `pages: 1, pagesPlanned: 12`. 🔴 **`pagesPlanned` is the load-bearing half** — without it
`phaseStatus` reads any phase with `pages > 0` as `'written'` and `summarise` credits it all
twelve topics, which is exactly the bug the MongoDB and Java rows above were.

The phase README's `🚧 Scaffolded — 0 of 12 written.` badge was the same stale claim in a second
place; it now names what is written and links the three topic READMEs that exist.
🔴 **`progress.js` is not the only progress surface — every phase README carries a badge too.**

### Framer Motion — validation batch 1 was never recorded

Chapters 01–08 were stamped on 2026-09-06 and `progress.js` still had all sixteen at
`verified: 0`, `updated: '2026-08-14 13:35'`.

Counted off disk with the corpus definition — a page counts only when it carries **BOTH a tier
badge AND a dated `> Verified:` line**: **21 of 29 pages**.

🔴 **`topics`/`pages` had to move too, not just `verified`.** On an imported track the unit
**is** the page (`topics: 1, pages: 1` per chapter was "one chapter, one page"), and five of
those chapters were **split** when the rewrite took them over the 300-line cap — 02 → 3 files,
03 → 2, 05 → 4, 06 → 4, 07 → 4, 08 → 2. Leaving `topics: 1` would have capped a fully-validated
4-file chapter at 1 and made `pagesValidated` under-report by 13.

Card: imported 0% → **validating 72% · 29 pages · 21 validated · phases 8/16**, and `next`
resolves to **`09 · Motion values`** — which is exactly where the lane cursor in
[[devbible-locks]] points, so the two agree without anyone wiring them together.

⚠️ **Known consequence, do not read it as a bug:** the denominator GROWS as the lane proceeds,
because each remaining chapter splits into several pages when it is validated. The percentage
can go **down** after a productive batch. That is the honest behaviour of a page-unit measure on
a corpus that is still discovering how many pages it has.

## The sweep, reproducible

```bash
node scripts/page-counts.mjs        # disk truth for page counts
yarn status --check                 # 🔴 the check nobody was running
node scripts/page-counts.mjs --check
yarn linkcheck                      # 6,880 files, 0 problems
```

Plus an ad-hoc disk-vs-declared diff: for every phase, flag `phaseStatus === 'planned'` with
files on disk, and any `verified:` that disagrees with a grep for badge + `> Verified:`.
`yarn validate --drift` does the second half already.

Related: [[devbible-homepage-imported-track-status]] (where `verified`/`pagesValidated` came
from), [[devbible-validation-ledger]] (the lane feeding framer-motion), [[cursor-angular]],
[[devbible-currency-system]] (checked, unaffected).
