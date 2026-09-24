---
name: resume-a2
description: 🔴 COLD-START FILE. Say the keyword "RESUME-A2" and read this file first. Written 2026-09-06 at the end of session 4e8d4393. Carries the exact state of the devbible audit, what is committed, what is stamped WITHOUT a report, and the one next action.
metadata:
  type: project
---

# ⛔ SUPERSEDED 2026-09-08 — go to [CURSOR-A2-TOOLCHAIN.md](CURSOR-A2-TOOLCHAIN.md)

🔴 **Everything below is the state as of 2026-09-06 and its "one next action" is DONE.** It says
to finish `tanstack-query`; that track was **completed 2026-09-08** (16/16 topics, 68 pages, zero
forward references). `vite` and `redux-toolkit` are complete too.

**The live cursor for this lane is [CURSOR-A2-TOOLCHAIN.md](CURSOR-A2-TOOLCHAIN.md)**, and the next
unit is the **ORM track (Prisma + Mongoose) — RULE 5, syllabus + card only, then STOP AND ASK.**

Kept below for the history and the standing instructions, **not as a start point.**

---

# 🔴 RESUME-A2 — say this keyword and start here

**Written 2026-09-06, end of session `4e8d4393`.** Everything below is **committed and pushed**
in both repositories. The working tree was clean at wind-down; `git status --porcelain docs/`
returned nothing.

---

## THE ONE NEXT ACTION

**Pick ONE track and finish it.** The recommended one is **tanstack-query**, because the user
named it as the lane and it is the only track with a banked quote bank and a full agent report:

```bash
cd /mnt/Storage/Backup/Knowledge/devbible
yarn validate --unit docs/tanstack-query/pages/05-mutations       # or whatever `--queue` puts first
```

🔴 **Read [research_tanstack_query_v5_quotes.md](research_tanstack_query_v5_quotes.md) BEFORE
fetching anything** — 10 fetches' worth of verbatim quotes and URLs are already banked, covering
query keys, important defaults, status vs fetchStatus, gcTime, invalidation and the v5 migration.
Topics 05–16 would otherwise re-derive all of it.

**First thing to fetch, and the only known open question:** how often `select` re-runs. No page
read so far settles it; topic 02 currently states it as explicitly uncertain. Start at
`https://tanstack.com/query/latest/docs/framework/react/guides/render-optimizations`.

---

## STANDING INSTRUCTIONS FROM THE USER — all given 2026-09-06, all still in force

| | |
|---|---|
| 🔴 **ONE language per session** | Broken this session — four tracks were opened at once and the user pulled it up. Recurrence recorded in [[devbible-feedback-one-topic-at-a-time]]. **Parallelism goes inside one track, never across tracks.** |
| 🔴 **Deploy NO agents unless asked** | Said twice. If agents are later authorised: **one track, disjoint slices of it**, and the ceiling is 3 including the coordinator |
| ⏸️ **The build is deprioritised** | *"Do not care about build for now… focus on validating and content checking."* ⚠️ This makes the LOCAL gates the only protection — run them per file |
| 🔴 **mdxcheck WITHOUT `--no-rawtag`** | The documented command uses `--no-rawtag`, which is exactly the flag that hides the class that breaks the build. It cost a red deploy this session — [[devbible-feedback-mdxcheck-no-rawtag-hides-a-build-breaker]] |
| **Save progress per file** | Commit explicit paths, never `git add -A` |

---

## WHAT IS DONE — do not redo any of this

| Item | State |
|---|---|
| **Angular phase 0 topic 01** | ✅ CLOSED — all 17 chunks, 70 files, 17,807 lines, 421 ★. [[devbible-angular-topic01-closed-20260906]] |
| **Dashboard** | ✅ Angular phase 0 `pages: 1 → 2`; `page-counts.json` regenerated (angular 47 → 125) |
| **Audit A1** — git interview questions | ✅ CLOSED — all 36 pages; the whole 57-page track now carries the section. [[devbible-git-a1-interview-questions-20260906]] |
| **Audit A3** — TanStack | ✅ FIXED — `prefetchQuery` → `queryClient.query()`, deprecation confirmed verbatim, and 🔴 the behavioural half recorded: `prefetchQuery` swallowed errors, `query()` throws |
| **Audit A2** — imported tracks | 🚧 **19 of 164 pages stamped.** babel 5 units (one split into 01 + 01b), vite 6, playwright 6, tanstack-query 4 |

## ⚠️ THE ONE THING TO DISTRUST

**babel, vite and playwright pages are stamped `> Validated:` but their agents were stopped
before they reported.** Their provenance exists only in each page's own `> Verified:` line, and
there is **no ledger row** for them. Only tanstack-query has a full report.

🔴 **Before building on those three tracks, sample a few of their claims against the sources
their `> Verified:` lines name.** A stamp with no ledger row is weaker than an unstamped page,
because it looks checked.

Known gap: **babel `04-presets/01b`** and the vite/playwright pages were written by agents whose
house-style output I verified mechanically (cap, mdx, links, no shrinkage) but not line by line.

---

## THE REST OF THE AUDIT BOARD — untouched

- **A2 remainder:** ~145 of 164 pages. eslint-oxlint (22 units), webpack (17), frontend-architecture
  (16), web-vitals-performance (12) have had **nothing**; babel/vite/playwright/tanstack are partial
- **B1 · Node 26 LTS sweep** — 311 pages say "Node 24 Active LTS". 🔴 **Hard date 2026-10-28**
- **B2 · Next.js `io()`** — 1 new page + 1 pointer. Do not sweep the ~50 `connection()` files
- **Tier C — four decisions waiting on the user:** TypeScript 7.0.2 vs 363 pages · Flyway 12→13.5.0 ·
  is B1 scriptable · the 834 unattributed output blocks
- **Tier D — 715 unwritten topics:** Angular 211 · Nginx 164 · Python 143 · Redis 73 · Java 46 ·
  MongoDB 43 · Storybook 35

## Other lanes, so you do not collide

**Angular** → topic 03 `the-provider-array`, next file `05e-provide-check-no-changes-config.md`
(`sidebar_position: 5.4`), README row 44 waiting for it. See [[cursor-angular]].
**framer-motion** validation lane is live for a different session — do not touch it.

Boards: [[cursor-audit]] (the ranked plan) · [[devbible-locks]] (lanes) ·
[[devbible-validation-ledger]] (what was checked) ·
[[devbible-session-20260906-angular-close-and-tier-a]] (the full session record)
