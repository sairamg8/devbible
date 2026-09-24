---
name: devbible-session-8679dc8c-handoff
description: Full handoff for session 8679dc8c (2026-08-14) — Node audited, Express completed, Redis syllabus written; what is committed, what is not, and exactly where to resume
metadata:
  type: progress
---

# Session `8679dc8c` handoff — 2026-08-14

Saved at the user's request near the usage limit. **This is the resume point for
everything this session touched.** Read this first, then the per-track files it links.

## What this session did, in order

1. **Node.js — audited, COMPLETE.** 248/248 topics, 13/13 phases, 231 pages / 232
   files, 232 verified, 0 over cap, 0 broken links. Added the 5 missing phase-0
   `> Verified:` lines. → [[progress_nodejs_completeness_audit]]
2. **Express — COMPLETE.** 114/114 topics, 85 pages, 85 verified, 0 over cap, 0
   broken links. **Nine syllabus topics had no page at all** and were written.
   → [[progress_expressjs_completion]]
3. **Redis — claimed, syllabus written.** 11 phases, 74 topics, 4 parts. **No
   explanation pages yet.** → [[project_redis_syllabus]]
4. **UI** — added a `done: true` "Complete" pill (`src/pages/index.js` +
   `.pillDone` in `index.module.css`); Node, Express and PostgreSQL carry it.
   Express's `progress.js` rows were changed to count **topics brought to
   standard, not files** — a comment in the file says so; do not revert it.

## ⚠️ COMMITTED vs NOT

| Where | State |
|---|---|
| **Memory store** (`/mnt/Storage/my-learning/claude/`) | ✅ **All committed and pushed.** Every progress file and the INDEX entry |
| **devbible working tree** | ⚠️ **~86 files modified/untracked and NOT committed** — this session never committed to devbible |

**Why not committed:** the standing scope rule is that project repos need an
explicit instruction naming the change, and none was given. **A fresh session
should ask before committing devbible**, and if asked to, must stage explicit
paths (`docs/expressjs`, `docs/redis`, `docs/README.md`, `src/data/progress.js`,
`src/pages/index.js`, `src/pages/index.module.css`, `docs/nodejs`) — **never
`git add -A`**, because several other sessions are writing in the same checkout.

Nothing is half-written: every file on disk is complete and the build is clean.

## RESUME HERE

**Redis · Phase 0 — How Redis runs (6 topics).** The syllabus row list is in
`docs/redis/syllabus/01-how-redis-works.md`. Nothing else in Redis is started.

Bindings for that work, all confirmed by the user during this session:

- **NO SANDBOX AT ALL.** Documentation and the web only; name the source in every
  `> Verified:` line; **no console block unless a run produced it**.
- **Do not rewrite anything already written.** Additive work only.
- **Update the UI after EVERY topic** — `src/data/progress.js` (mid-phase needs
  *both* `pages` and `pagesPlanned`), the phase README, `docs/<lang>/pages/README.md`,
  and both `docs/README.md` rows.
- **Save progress to memory every 3 topics**, committed.
- **Only grep the build log for your own language.** Other sessions' warnings are
  theirs — the user said explicitly not to spend time on them.

## Traps this session hit — do not repeat

1. 🔴 **A phase README with no Coverage table hides missing topics.** Four phases in
   a row concealed nine of them. **Count the syllabus rows, map them to pages, and
   write the Coverage table before writing anything else.**
2. 🔴 **Appending a section that already exists creates duplicate `##` headings.**
   It happened on 9 Express pages; the build does not catch it. Replace the existing
   block instead, and run the duplicate scan (recorded in
   [[progress_expressjs_completion]]) before declaring a phase done.
3. **Appending a new page shifts nothing — but cross-links written against a
   *renumbered* layout break.** One link pointed at `05-type-inference.md` after the
   page was appended as `09`. Prefer appending; then fix the links you wrote.
4. **Concurrent `yarn build` in a shared checkout clobbers `build/`** (`ENOENT` on
   `server.bundle.js`). Build to a private out-dir instead:
   `yarn build --out-dir build-<session>` and delete it afterwards.
5. **`git push` intermittently failed with a DNS error** under the default sandbox;
   retrying with the sandbox disabled worked every time.
6. **A web search gave three different "current" Redis versions.** Only the vendor's
   own release index settled it. Do not trust search results for version facts.

## Corpus state at save time

| Track | State |
|---|---|
| Node.js | ✅ complete, audited |
| Express | ✅ complete |
| PostgreSQL | ✅ complete (session `052a10c2`) |
| CSS | ✅ complete (session `6f020813`) |
| React | 🔴 active, phases 0–5 done (session `6ffd754d`) |
| JavaScript | 🔴 active, Master tiers through phase 9 (session `01ECVvH5`) |
| MongoDB | 🔴 active, phase 0 done (session `6f020813`) |
| **Redis** | 🔴 **this session — syllabus only** |
| TypeScript · Git | idle, partial |
| Docker & Podman · Nginx | unclaimed, zero pages |
