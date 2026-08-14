---
title: "Contents"
sidebar_label: "Contents"
sidebar_position: 0
slug: /
---

:::info 🔒 Active work — who is writing what

Several Claude sessions work in this repo at once. **Check here before you start,
and add your own row when you claim something.**

| Area                                       | Claimed by         | Since      | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **React** — all of `docs/react/`           | session `6ffd754d` | 2026-08-14 | 🔴 **Active.** **Phases 0–6 COMPLETE** — 142 files, 0 broken links, 0 files over 300 lines, build-verified. **Phases 7–14 remain (128 topics).** Next: **Phase 7 · Custom hooks and the Rules of React**. Handoff: `devbible/progress_session_20260814_react.md` in the memory store.                                                                                                                                                                                                                               |
| **PostgreSQL** — all of `docs/postgresql/` | session `052a10c2` | 2026-08-13 | ✅ **COMPLETE — RELEASED, free to pick up.** Phase 13 finished 18/18 (every stamp gone), plus new phase-2 topic 17 (money) and phase-3 topic 20 (multi-tenancy). **298 pages, 298 carrying `> Verified:`, 0 files over 300 lines, 0 broken links.** Topics 07–18 are documentation-validated under the no-new-sandboxes rule and say so inline. Remaining PG work is *review only* — the rubric pass and `/code-review ultra`.                                                                                       |
| **JavaScript** — all of `docs/javascript/` | session `016cfc46` | 2026-08-14 | 🔴 **Active — TIER-LOCKED to Understand and Know.** 🔴 **Every Master tier is COMPLETE, phases 0–18 (99 of 99 topics)** and is not to be reopened for depth. **134 of 337 topics written (40%)**; **203 remain — Understand 145 · Know 55 · When Needed 3**. Order is phase by phase, and inside a phase Understand → Know → When Needed. Next: **Phase 3 topic 14 · Recursion**. Phases 0–2 are complete at every tier. Thinnest: phase 12 (2/21), 16 (3/16), 13 (3/10), 6 (3/13). See the [JavaScript claim notice](javascript/pages/README.md) |
| **CSS** — all of `docs/css/`               | session `6f020813` | 2026-08-14 | ✅ **COMPLETE — RELEASED, free to pick up.** Syllabus re-scoped to the critical path (119 → 74 topics; SCSS is usage-only, the architecture phase was cut). **All 11 phases written — 74 topics, 81 pages, 17,359 lines, 0 files over 300 lines.** Flexbox and Grid at full Master depth on the user's instruction. Doc-validated under the no-new-sandboxes rule with sources named per page; **no fabricated console blocks.**                                                                                     |
| **Node.js** — all of `docs/nodejs/`        | session `8679dc8c` | 2026-08-14 | ✅ **COMPLETE — audited, free to pick up.** All 13 phases written, **all 248 syllabus topics covered** (231 pages; six phases merge pairs of rows and each says so in a Coverage table). **232 files, 232 carrying `> Verified:`, 0 files over 300 lines, 0 broken links in a clean rebuild.**                                                                                                                                                                                                                       |
| **Express** — all of `docs/expressjs/`     | session `b7f137c4` (continues `ffadd057`) | 2026-08-14 | 🔴 **Active — Master-tier depth pass, and LOCKED** (*"Lock it in express js"*) — the claim moved rather than a second Express claim being opened; 🔴 **DEPTH PASS COMPLETE — 28 of 28 Master topics rewritten to full depth**, all chunked into `NN-topic/` directories. Structurally complete (11 phases, **114 of 114 topics**, 86 pages, all carrying `> Verified:`, a tier badge, Gotchas, Trade-off and Interview sections; every phase README has a Coverage table; 0 duplicate headings). **But depth does not follow tier**: all 28 Master topics sit between 63 and 200 lines and **not one is chunked**, against a corpus where PostgreSQL Master topics median 530 lines. The corpus was sized to the 300-line cap instead of to the topic. This pass rewrites all **28 Master topics to full depth**, chunking into `NN-topic/` directories past 300 lines. Additive — existing prose and console blocks are kept, never re-run, never invented.                                                                                                           |
| **MongoDB** — all of `docs/mongodb/`       | session `6f020813` | 2026-08-14 | 🟠 **Claim stale — session gone, free to pick up.** Syllabus **cut to the critical path: 204 → 82 topics** (Master tier only, capped at 6 per phase). **Phase 0 COMPLETE (5/5)**; phase 1 not started. The session stopped without writing `pages/README.md` or committing two phase-0 pages — repaired by session `632ebd35`, which did **not** take the claim. Next: **Phase 1 · Documents, BSON types and `_id` (6 topics)**. Documentation-validated against the MongoDB Manual under the no-new-sandboxes rule. |
| **Redis** — all of `docs/redis/`           | session `8679dc8c` | 2026-08-14 | 🔴 **Active.** Picked up on finishing Express. **Syllabus complete — 11 phases, 74 topics**, scoped to the critical path (Search/JSON/time-series/vector-sets and cluster admin are deliberately out). No pages yet; next unit is **Phase 0 · How Redis runs (6 topics)**. Claimed because **Node and Express defer to this track on 39 pages** — sessions, shared rate-limiter state, denylists, idempotency keys, queues.                                                                                         |
| **Frontend toolchain** — 12 **new** folders: `docs/storybook/` `docs/vite/` `docs/webpack/` `docs/babel/` `docs/eslint-oxlint/` `docs/jest-rtl/` `docs/playwright/` `docs/redux-toolkit/` `docs/tanstack-query/` `docs/framer-motion/` `docs/web-vitals-performance/` `docs/frontend-architecture/` | session `0fe4e7e0` | 2026-08-14 | 🔴 **Active — corpus moved in.** **204 pages** brought over from the separate `frontend-bible` repo, in their original section structure, on 2026-08-14. Work happens in worktree `devbible-frontend`, branch **`frontend-merge`**. **This lane touches no existing technology** — React, JavaScript, TypeScript, CSS and Git belong to other live sessions and are out of scope here, as are Next.js and every backup directory in the source repo. **Status: moved, not validated.** The imported pages have **no `> Verified:` line, no tier badge and no Interview section**, and 12 cross-references to non-imported technologies were de-linked during the move. **Storybook is the exception** — phases 0–3 (23 topics, 5,488 lines) were written to full devbible depth and are build-verified. Next step to be agreed with the user. |
| **Git** — all of `docs/git/`               | session `45e775dc` | 2026-08-14 | 🔴 **Active — LOCKED** (*"There was git course yet to complete the explanations can you pick it up ? and lock it in ?"*). Syllabus complete (13 phases, **191 topics**, 4 parts, 55 Master). **Phase 0 COMPLETE — 14 pages**, sandbox-proven from `sandbox/git-p0/ex1`+`ex2`. **Phase 1 in progress — topic 01 (`git status`) done as 5 files, 1,106 lines; topics 02–16 remain.** Phases 2–12 untouched — 161 topics. ⚠️ Phase 1 onward is **documentation-validated, not sandbox-proven** — the no-new-sandboxes rule closed the `ex3` plan the old memory carried; pages reuse the recorded `ex1`/`ex2` output where it genuinely covers a claim and otherwise carry **no console block**. Resume point: `devbible/progress_git_pages.md`. |
| **Unclaimed**                              | —                  | —          | **Docker & Podman and Nginx have zero pages** — good places to start                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Rules for a shared checkout:** never `git add -A` — stage explicit paths only.
`src/data/progress.js` is edited by everyone; touch only your language's rows.
`yarn build` exits 0 with broken links, so grep the log — but a **duplicate doc
id exits 1**, and that failure is often another session mid-write, so wait and
retry before investigating.

:::

Every technology in the bible sits in its own folder, holding two things in this
order:

1. **Syllabus** — the topic inventory. What to learn, in what order, and **how
   hard to work on each item**. No explanations, no code.
2. **Explanations** — the actual pages, one per topic, with runnable code,
   gotchas and interview questions. Written phase by phase once the syllabus is
   approved.

## 🔴 The critical rule — do not violate this

**The 300-line cap is a FILE-SIZE rule, never a content budget.**

It caps how much lives in one *file*. It says **nothing** about how much a
*topic* gets explained. A topic may run 1000+ lines in total — that is normal and
expected for a Master-tier topic.

- **Write the explanation the topic deserves FIRST, then split.** Never size a
  page to fit the cap. Never trim a section, drop a gotcha, or shorten interview
  answers to save lines. Coverage is fixed; file count is the variable.
- At 301 lines, **split on a concept boundary** into a topic directory:
  `NN-topic/` with `_category_.json`, a `README.md` index, and `NN-chunk.md`
  parts. Each chunk repeats the tier badge and `> Verified:` line and carries its
  **own** Gotchas and Interview questions.
- **The tell that you got this wrong:** a run of pages all landing in a narrow
  band just under the cap. Real topic lengths vary widely; clustering at ~200–290
  is evidence of budgeting, not of topics that happened to be that size.

Two rules that pair with it:

- **Never invent output.** Every number, timing and error string comes from a run
  that actually happened. No run means **no console block** — write the
  explanation without it rather than reconstructing one from memory.
- **No new sandboxes.** Validate against the official documentation or the web
  and **name the source** in the `> Verified:` line. Pages backed by an existing
  script are marked **sandbox-measured** so a reader can tell measured evidence
  from cited evidence.

**Link form:** every link ends in `.md` and keeps every numeric prefix —
`../01-inner-join/README.md` for a directory index,
`../01-inner-join/02-fan-out.md` for a file inside it. The directory-slug form
broke 188 links; never bulk-`sed` these.

## Priority tiers

Every topic carries exactly one tier. The tier answers *"how much effort does this
deserve right now?"* — it is about **effort allocation**, not importance.

| Badge                                                    | Tier                | Bar to clear                                                                                       |
| -------------------------------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| <span className="db-tier t-master">Master</span>         | Must Learn & Master | Use it confidently **without opening documentation**. If you look it up mid-task, you're not done. |
| <span className="db-tier t-understand">Understand</span> | Must Understand     | Know **how it works**, use it correctly. Looking up exact signatures is fine.                      |
| <span className="db-tier t-know">Know</span>             | Should Know         | Know **what it is, why it exists, when it's the right tool**. Details when needed.                 |
| <span className="db-tier t-when">When Needed</span>      | Learn When Needed   | **Don't study upfront.** Learn it the day a project demands it.                                    |

Tiers are assigned **for fullstack application development** — this bible's
purpose. `worker_threads` is <span className="db-tier t-know">Know</span> for a CRUD API and would be <span className="db-tier t-master">Master</span> at a
media-processing company. Where a tier is context-dependent, the syllabus says so.

## Coverage

Ordered by how far the explanations have got, not alphabetically.

| Technology                               | Syllabus             | Explanations                                                                                                                               |
| ---------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **[Node.js](./nodejs/README.md)**        | 4 parts · 248 topics | **✅ COMPLETE** — [231 pages](./nodejs/pages/README.md) across 13 phases; all 248 topics covered, every page carries a `> Verified:` line   |
| **[PostgreSQL](./postgresql/README.md)** | 4 parts · 233 topics | **✅ COMPLETE** — [298 pages](./postgresql/pages/README.md) across 14 phases; every page carries a `> Verified:` line                       |
| **[JavaScript](./javascript/README.md)** | 5 parts · 337 topics | Pending — **134 topics / [233 pages](./javascript/pages/README.md)**; phases 0–2 complete at every tier, and the **Master tier of every phase 0–18 complete (99/99)**. Understand and Know tiers under way — 203 topics remain |
| **[TypeScript](./typescript/README.md)** | 4 parts · 187 topics | Pending — [37 pages](./typescript/pages/README.md), phases 0–2                                                                             |
| **[CSS](./css/README.md)**               | 4 parts · 74 topics  | **✅ COMPLETE** — [81 pages](./css/pages/README.md) across 11 phases; critical-path scope                                                   |
| **[React](./react/README.md)**           | 4 parts · 244 topics | Pending — [142 pages](./react/pages/README.md), **phases 0–6 complete**, phase 7 next                                                      |
| **[Git](./git/README.md)**               | 4 parts · 191 topics | 🔴 In progress — [15 topics](./git/pages/README.md) (19 files), phase 0 complete, phase 1 writing                                                                                       |
| **[Express](./expressjs/README.md)**     | 4 parts · 114 topics | 🔴 **Master-tier depth pass** — [86 pages](./expressjs/pages/README.md) across 11 phases; all 114 topics covered and verified, but the 28 Master topics were sized to the cap (63–200 lines, none chunked) and are being rewritten to full depth. 🔴 **DEPTH PASS COMPLETE — all 28 Master topics at full depth**, phases 0–10 |
| **[MongoDB](./mongodb/README.md)**       | 4 parts · 82 topics  | Pending — [5 pages](./mongodb/pages/README.md), **phase 0 complete**, phase 1 next                                                         |
| Docker & Podman                          | Not started          | —                                                                                                                                          |
| **[Redis](./redis/README.md)**           | 4 parts · 74 topics  | Syllabus only — [no pages yet](./redis/pages/README.md); next is phase 0                                                                   |
| Nginx                                    | Not started          | —                                                                                                                                          |

### Imported from the frontend-bible corpus (2026-08-14)

**204 pages moved in across 12 new technologies.** They are complete and readable but were
written to a different standard — see each overview for what is still outstanding.

| Technology | Syllabus | Explanations |
|---|---|---|
| **[Storybook](./storybook/README.md)** | 4 parts · 58 topics | Mixed — [23 topics written and build-verified](./storybook/pages/README.md) (phases 0–3, 5,488 lines) **plus 22 imported pages moved in as-is**. **Phases 0–3 written to full depth (23 topics)** plus the imported corpus (22 pages) — the only imported track with verified pages |
| **[Vite](./vite/README.md)** | Imported corpus | ⚠️ **Moved in as-is** — [16 pages](./vite/pages/README.md); no `> Verified:` line, no tier badges, no interview questions yet. Imported as-is |
| **[Webpack](./webpack/README.md)** | Imported corpus | ⚠️ **Moved in as-is** — [21 pages](./webpack/pages/README.md); no `> Verified:` line, no tier badges, no interview questions yet. Imported as-is |
| **[Babel](./babel/README.md)** | Imported corpus | ⚠️ **Moved in as-is** — [16 pages](./babel/pages/README.md); no `> Verified:` line, no tier badges, no interview questions yet. Imported as-is |
| **[ESLint & Oxlint](./eslint-oxlint/README.md)** | Imported corpus | ⚠️ **Moved in as-is** — [21 pages](./eslint-oxlint/pages/README.md); no `> Verified:` line, no tier badges, no interview questions yet. Imported as-is |
| **[Jest & RTL](./jest-rtl/README.md)** | Imported corpus | ⚠️ **Moved in as-is** — [16 pages](./jest-rtl/pages/README.md); no `> Verified:` line, no tier badges, no interview questions yet. Imported as-is |
| **[Playwright](./playwright/README.md)** | Imported corpus | ⚠️ **Moved in as-is** — [16 pages](./playwright/pages/README.md); no `> Verified:` line, no tier badges, no interview questions yet. Imported as-is |
| **[Redux Toolkit](./redux-toolkit/README.md)** | Imported corpus | ⚠️ **Moved in as-is** — [16 pages](./redux-toolkit/pages/README.md); no `> Verified:` line, no tier badges, no interview questions yet. Imported as-is |
| **[TanStack Query](./tanstack-query/README.md)** | Imported corpus | ⚠️ **Moved in as-is** — [16 pages](./tanstack-query/pages/README.md); no `> Verified:` line, no tier badges, no interview questions yet. Imported as-is |
| **[Framer Motion](./framer-motion/README.md)** | Imported corpus | ⚠️ **Moved in as-is** — [16 pages](./framer-motion/pages/README.md); no `> Verified:` line, no tier badges, no interview questions yet. Imported as-is |
| **[Web Vitals & Performance](./web-vitals-performance/README.md)** | Imported corpus | ⚠️ **Moved in as-is** — [11 pages](./web-vitals-performance/pages/README.md); no `> Verified:` line, no tier badges, no interview questions yet. Imported as-is |
| **[Frontend Architecture](./frontend-architecture/README.md)** | Imported corpus | ⚠️ **Moved in as-is** — [15 pages](./frontend-architecture/pages/README.md); no `> Verified:` line, no tier badges, no interview questions yet. Imported as-is |

Express was previously listed last with the note that its pages "average a third the
depth of the rest". **That was resolved on 2026-08-14**: every topic was brought to
depth, nine syllabus topics that had no page were written, and all 85 pages carry a
`> Verified:` line. Phases 1–10 are documentation-validated with **no sandbox runs**,
which their Verified lines state explicitly.

## What "Verified" means

Every number, timing, error string and console block on a page comes from a script
that was actually executed — never from memory or plausibility. A page that has
been through that carries a `> Verified:` line under its title naming the versions
it was measured on. A page without one has not cleared that bar yet.
