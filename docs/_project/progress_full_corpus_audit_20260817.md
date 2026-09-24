---
name: devbible-full-corpus-audit-20260817
description: Disk-verified board across all 25 technologies on 2026-08-17, plus three measurement traps that make the usual checks lie — syllabus-row counting, fixlinks.py's README-only blind spot, and Docusaurus stripping numeric prefixes from routes
metadata:
  type: progress
---

# devbible — full corpus audit, 2026-08-17 (session `ab508775`)

Crawled every syllabus and every page tree on disk, cross-read the store's memories,
and checked UI wiring. **Supersedes the numbers in [[devbible-overall-snapshot]]**,
which self-warns to recompute after a day and was two days old.

## 🔴 Three measurement traps — read before quoting any number

These each produced a **false finding** during this audit, caught before it shipped.

### 1. Never compare syllabus rows to files on disk

Doing that says Node.js is 17 topics short, Express 28 short, Docker 1 short, Nginx
phases 0–2 badly short. **All four are wrong.** Those corpora deliberately **merge**
syllabus rows onto one page where you would never read one without the other, and each
merge is documented in a **Coverage table** in the phase `README.md`.

- Node.js merges: phase 0 (13→10), 1 (16→14), 2 (26→22), 3 (21→19), 4 (16→14), 5 (30→26)
  = exactly the 17 "gap". Recorded in [[devbible-nodejs-completeness-audit]].
- Express: 11 of 11 phase READMEs carry a Coverage table; the "missing" phase-0 row
  *Reading Express docs and source shape* is folded into topic 01's chunks 02/03 and topic 07.

**Verify against the Coverage tables, never against a page count.** Coverage-table
coverage today: expressjs 11/11 · nginx 3/3 · nodejs 6/13 · postgresql 1/14 · javascript 1/19.

### 2. `shared/scripts/fixlinks.py` only opens `README.md` files

It reports **0 unresolved across all of `docs/`** while the site build reports real broken
links. That is not a bug — the script exists to fix the *index-page* slug trap and its
docstring says so — but it means **a clean fixlinks run is NOT a link check.** Broken links
in leaf content pages are invisible to it. Every "0 broken links" claim resting on fixlinks
alone is unverified.

### 3. Docusaurus STRIPS numeric prefixes from routes

Proved from a real build's `sitemap.xml`: `phase-5-joins/01-inner-join/01-matching-pairs.md`
serves at `/phase-5-joins/inner-join/matching-pairs`. So a link like `../left-join/` from a
**leaf** page resolves correctly even though the directory is `02-left-join`.

⚠️ A parallel audit flagged **123 "unresolvable" links** (100 in PostgreSQL) on the
assumption that routes keep their prefixes. **That finding is false.** Rule 2 in
`~/.claude/CLAUDE.md` is right as written: the slug form fails **in README.md index pages
only**, because an index page's file path carries one level more than its URL.

**The build log is the only authority on broken links.**

## The real broken links: 4, all in Real World — FIXED

From another session's fresh build log (`build-search.log`, 2026-08-17):

| File | Was | Now |
|---|---|---|
| `phase-2-node-services/04-outbox-relay-and-email.md:45` | `../../phase-0-the-app/…` | `../phase-0-the-app/…` |
| `phase-2-node-services/08-the-cache-layer.md:129` | same | same fix |
| `phase-4-react-ui/09-auth-in-the-client.md:166` | `../../phase-0-the-app/01-…` | `../phase-0-the-app/01-…` |
| `phase-4-react-ui/02-usedebounce-and-search.md:13` | `…/06-designing-a-hooks-api.md` | `…/06-designing-a-hooks-api/README.md` (it is a chunk dir) |

Fixed and committed `2a99ed7c`. **The whole site now has zero known broken links.**

## 🔴 Rule 13 (set 2026-08-17) measured across the corpus

[[devbible-feedback-never-compress-to-fit-cap]]'s sibling: uniform section counts prove a
topic was templated, not exhausted. Measured `**Symptom:**` blocks and interview questions
per page:

| Technology | Gotchas: median (range) | Verdict |
|---|---|---|
| **Docker** | **4 (3–5) — 90% of 225 pages have exactly 4** | 🔴 **worst; a template** |
| Storybook | 0 — **100% of pages have none** | 🔴 imported, never converted |
| CSS | 0 (0–5), 65% have zero | 🔴 |
| MongoDB | 6, 74% of Q&A on exactly 6 | 🟡 |
| Express / TypeScript / React | 5–6, Q&A 61–69% on one value | 🟡 |
| **JavaScript** | **6 (0–10), Q&A 4–9, no clustering** | ✅ **the healthy example** |

Docker spot-check: six random pages, **all exactly 4 gotchas**. JavaScript for contrast:
8, 5, 4, 5, 7, 8. Docker Q&A: 207 of 225 pages have exactly 5 or 6.

⚠️ **Git's 63% zero-Q&A is CORRECT, not a defect** — the Git scope cut specified
"practical depth, no interview sections".

Method caveat: this counts `**Symptom:**` and numbered items after `## Interview`. It is
evidence of *clustering*, not proof any single page is thin.

## Board — disk-verified 2026-08-17

Topics = syllabus rows covered (merges counted as covered).

| Technology | State | Next |
|---|---|---|
| Node.js 248/248 · PostgreSQL 233/233 · Express 114/114 · Docker 192/192 · JavaScript (active queue) · React · CSS 74/74 · Git 52/52 | ✅ complete | — |
| **Real World 54/79** | 🚧 active, this session | **5·06 Money and dates with `Intl`** |
| **TypeScript 79/187** | ⏸ paused | Part A **phase 4 topic 14 · Mixins**; Part B **phase 10 topic 05** |
| **MongoDB 34/82** | ⏸ paused | **phase 6 aggregation — sources already fetched, do not re-fetch** |
| **Nginx 26 pages / 48 topics of 210** | ⏸ paused | **phase 3 · static files and SPAs** |
| **Storybook 44 pages** | ⚪ half-imported | phases 4–10 — but see the duplication below |
| **Redis 0/77** | ⚪ never started | **cleanest cold start; 39 published Node/Express pages already link to it** |

## UI wiring defects found

1. 🔴 **MongoDB and Redis have NO sidebar.** `sidebars.js` declares 23 sidebars and omits
   both; they were never added. **46 MongoDB pages + 6 Redis pages have no navigation at
   all** — reachable only from the homepage card, then inline links. Every other surface
   (progress.js, docs/README, homepage) claims they are wired. **Highest-impact, two-line fix.**
2. 🔴 **Storybook has two parallel page trees**: 4 `phase-*` dirs (22 topics, in progress.js)
   and **17 imported `NN-*` dirs (22 pages, in NO index page and NOT in progress.js)**. They
   overlap in subject (`phase-3-decorators` vs `09-decorators`), and `pages/README.md` marks
   7 phases "not started" whose content already exists under the imported names. **All 7
   files over the 300-line cap in the whole repo are here** (up to 596 lines).
3. **11 topic directories lack `_category_.json`** → sidebar shows the raw directory name
   (`01-daemonless`, not `01 · Daemonless`): docker phase-11 ×4 (phase is CLOSED, so this is
   finished work rendering wrong), typescript ×5, javascript ×2.
4. **3 orphan `_category_.json` committed at doubled paths** —
   `docs/javascript/pages/docs/javascript/pages/phase-7-async/{07-async-await,12-timers}/`
   and `docs/react/pages/docs/react/pages/phase-14-correctness/02-the-rtl-model/`. A write ran
   from the wrong cwd. **For the two JavaScript ones these ARE the missing files from item 3** —
   the label `{"label":"07 · async/await"}` is sitting in the doubled path while the real
   directory has none. Move, don't just delete.
5. **PostgreSQL's `pages` numbers in progress.js are wrong** — they sum to **298**, which is
   neither its 233 topics nor its 356 files (phase-6 says 40 with 57 files and 16 topics).
   The percentage is safe (it derives from `topics` + `phaseStatus`) but the displayed
   page count is invented.
6. **The 11 imported toolchain tracks all render "100% Complete"** directly beneath a
   `:::caution not yet validated` banner, because their rows model 1 page = 1 topic = done.

## Cross-session state at audit time

- 62 commits unpushed to `origin/main`; the last Actions run covered 2026-08-16. **Nothing is
  failing — CI simply has not run on any of it.** Only failure ever was 2026-08-13, fixed.
- Another session (`f49e21d6`) holds the build registry row for site-search work and has
  `docusaurus.config.js`, `package.json`, `yarn.lock` modified-uncommitted. Its build
  artefacts (`build-search/`) are what made this audit's route check possible.
- Related open work nobody owns: the Node.js gaps worklist
  ([[devbible-nodejs-improve-review]], P1 = inverted at-least-once claim in
  `phase-7-background-work/06-transactional-outbox.md`), and the 636-page provenance
  validation plan with zero lanes claimed.
