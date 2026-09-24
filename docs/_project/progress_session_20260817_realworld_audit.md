---
name: devbible-session-20260817-realworld-audit
description: Session ab508775 on 2026-08-17 — closed Real World 5·05, fixed the PostgreSQL confounded benchmark, ran the full corpus audit, and fixed the 4 real broken links; also the record that "Actions are failing" was a false premise
metadata:
  type: progress
---

# Session `ab508775` — 2026-08-17 · Real World + full corpus audit

Lock: **Real World track** (`docs/real-world/`), on `main`, shared checkout.
Resume cursor: [[devbible-realworld-build]]. Audit output: [[devbible-full-corpus-audit-20260817]].

## Committed this session — three commits

| Commit | What |
|---|---|
| `96ce3808` | **PostgreSQL 0·04 — removed the confounded shared-buffers benchmark.** Work-order row 2 / finding 3 of `reviews/fable`. |
| `0f6445d3` | **Real World 5·05 · The validation engine** (181 lines) + all four boards. |
| `2a99ed7c` | **Fixed the 4 real broken links**, all in Real World. |

Store commits: the audit memory + INDEX entry, pushed to `claude-context` **master**
(⚠️ that repo's branch is `master`, not `main` — `git push origin main` fails).

## The PostgreSQL fix, in full

`phase-0-architecture/04-shared-buffers.md` timed a first query against a second on a
**fresh `Pool`**, so the 44.52 ms → 2.64 ms gap was TCP connect + SCRAM auth + backend
`fork()` + private catalog cache — none of it the buffer cache, and the page's own
`> Verified:` line asserted the wrong cause. On the one page whose job is to explain
shared buffers.

Replaced with the method that isolates it: `EXPLAIN (ANALYZE, BUFFERS)` `read=` → `hit=`
on one already-warm connection, plus `pg_statio_user_tables` cumulatively. **No console
block** — rule 8 forbids the script, and no run means no output. Page is 111 lines.

⚠️ **Most of the `reviews/fable` work order was already done** by commit `9faa3e5a`:
the `MERGE … RETURNING` error (chunked into `13-merge/` with `merge_action()` taught
correctly), the 12 Phase 13 template stamps (all written), the outbox and audit pages.
**Still open:** `03-explain.md` at 186 flat lines (the review's highest-value depth fix),
`09-boolean-dates.md` still merged at 213, `two-backends.mjs` still absent so the
client-server-model transcript has no provenance, and ★ inflation (1,193 stars).

## 🔴 "The Actions are failing" was a FALSE premise — record it

The user asked me to fix failing GitHub Actions. **Nothing was failing.** The last ten
runs all succeeded; the only failure in repo history was 2026-08-13, fixed by the
`corepack enable` step now in `deploy.yml`.

**The actual state: 54 commits (66 by session end) had never been pushed.** Every Real
World commit from phase 1 onward is local-only, so CI had not *run* on any of it and the
published site was showing 2026-08-16 content. **Not pushed** — it publishes to live
Pages, the premise didn't hold, and another session was mid-flight on
`docusaurus.config.js`/`package.json`/`yarn.lock`.

## Hard-rules health check — clean

`wc -l ~/.claude/CLAUDE.md` = **882**, byte-identical to
`shared/global-claude-md/CLAUDE.md`, `/mnt/Storage` mounted, rule 1 and rule 9 both
grep-clean and confirmed loaded in-session. (The tripwire is **length, not existence** —
`ls` passes on the 3-line stub that replaced it twice.) 🔴 **Rule 13 was added to the
file during this session** — depth is never capped by a section count.

## Build registry — did NOT claim, deliberately

Read it as free, went to claim it, and the claim **failed because session `f49e21d6`
had taken the row seconds earlier** for site-search work. Per rule 12 step 2 I did not
start a competing build. Verified by resolving links against the filesystem instead —
and said so in the report rather than implying a build passed.

⚠️ **That session's build artefacts (`build-search/sitemap.xml`, `build-search.log`)
are what made the audit's route check and broken-link list possible.** A real build log
is the only authority on broken links; borrow one rather than starting your own.

## Live work in the checkout at session end — DO NOT TOUCH

User instruction mid-session: *"Currently react chunk a and b working make sure you do
not intrrupt their work apart from their work you focus on next"*.

- **React chunk A** is **mid-chunking right now**: `docs/react/pages/patterns/01-headless-components/`
  exists untracked with 6 chunks + README + `_category_.json`. That is the **rule 13
  remediation** — headless-components is the exact page rule 13 names as under-written.
- **React chunk B** holds the build registry row and has `docusaurus.config.js`,
  `package.json`, `.gitignore`, `package.json` modified-uncommitted (local offline search,
  committed at `1894fa9b`).
- Never `git add -A` here. Stage explicit paths only.

## Next

**Real World 5·06 · Money and dates with `Intl`**, then 07 slug/search normalization,
08 feature flags, 09 optimistic-update helpers, 10 debounce/throttle applied.

Offered to the user instead, not yet taken: **adding the missing `mongodbSidebar` and
`redisSidebar` to `sidebars.js`** — two lines, unblocks 52 pages that currently have no
navigation at all. See [[devbible-full-corpus-audit-20260817]] for the rest of the
UI defects.
