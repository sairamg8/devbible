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
| **React** — `docs/react/`, SPLIT A/B       | **A:** session `bfcb390b` · **B:** session `05921047` | 2026-08-14 | ✅ **BOTH PARTS COMPLETE.** The `react-phase-7` worktree was **merged** (`d74e74f`), nothing is stranded. **Phases 0–10 COMPLETE.** **Part A** = Phase 11 topics 08–17 + close (✅ **17/17**). **Part B** = Phase 14 · Testing React (✅ **14/14**, written on branch `react-phase-14`, worktree `devbible-react-p14`). Split rules: `devbible/project_react_split_parts_ab.md`; handoff: `devbible/progress_react_phase7.md`. |
| **PostgreSQL** — all of `docs/postgresql/` | session `052a10c2` | 2026-08-13 | ✅ **COMPLETE — RELEASED, free to pick up.** Phase 13 finished 18/18 (every stamp gone), plus new phase-2 topic 17 (money) and phase-3 topic 20 (multi-tenancy). **298 pages, 298 carrying `> Verified:`, 0 files over 300 lines, 0 broken links.** Topics 07–18 are documentation-validated under the no-new-sandboxes rule and say so inline. Remaining PG work is *review only* — the rubric pass and `/code-review ultra`.                                                                                       |
| **JavaScript · lane A** — phases **3–8** (the language) | session `edbfba95` | 2026-08-14 | 🔴 **Active — LANE A of a two-way split (2026-08-14): functions, objects, built-ins, iteration, async, modules. 53 topics left. TIER-LOCKED to Understand and Know.** 🔴 **Every Master tier is COMPLETE, phases 0–18 (99 of 99 topics)** and is not to be reopened for depth. **154 of 316 in-scope topics written (49%)**; **128 remain — Understand 88 · Know 37 · When Needed 3**. 🔴 **Scope cut 2026-08-14 — language focus:** the DSA block parked (13, 14, 15), Dynamic programming **dropped**, storefront trimmed to three. **21 dropped, 34 parked, nothing written deleted**; the original syllabus is preserved as `*.md.bak`. Order is phase by phase, and inside a phase Understand → Know → When Needed. ✅ **Phases 3 AND 4 are COMPLETE at every tier (20/20 each).** ✅ **PHASE 4 IS COMPLETE at every tier (20/20)** — next: **phase 5 · The built-in library, 18 topics left**, the biggest remaining in the lane. 🔴 **Lane A writes in the worktree `devbible-js-lane-a` (branch `js-lane-a`), merged back to `main` at each phase boundary.** Phases 0–2 are complete at every tier. Thinnest: phase 12 (2/21), 16 (3/16), 13 (3/10), 6 (3/13). See the [JavaScript claim notice](javascript/pages/README.md) |
| **JavaScript · lane B** — phases **9–12, 17, 18** (platform + applied) | session `75e511e6` | 2026-08-14 | 🔴 **Active — LANE B of the two-way split**, and written in the worktree `devbible-js-lane-b`, branch `js-lane-b` (user's instruction, 2026-08-14) — ✅ **MERGED INTO `main` 2026-08-15**, 0 unique commits left, `main` rebuilt clean. DOM, events, network/storage, browser platform, machine coding, and the three kept storefront topics. **50 topics left**. 🎉 ✅ **PHASE 9 · THE DOM IS COMPLETE — 19 of 19 at every tier, 59 files** (Master 01–06, Understand 07–15, Know 16–18, When Needed 19); this lane wrote 46 of those files, every topic chunked, every file under the 300-line cap. 🎉 ✅ **PHASE 10 · EVENTS AND USER INPUT IS ALSO COMPLETE — 14 of 14 at every tier, 35 files** (Master 01–04, Understand 05–11, Know 12–14); this lane wrote topics 05–14. 🚧 **Now in phase 11 · Network, storage and data transfer — topics 06–07 ✅** (Request/Response/Headers, Reading responses), 08 · Aborting and timing out next. Same rules as lane A: tier-locked to Understand+Know, Master is closed and not to be reopened, the scope cut applies, per-file save cadence. ✅ **Build-verified 2026-08-15** after merging `main` (which carried React's MDX fix): clean isolated rebuild with **0 broken links under `docs/javascript/`, 0 files over 300 lines**. See the [JavaScript claim notice](javascript/pages/README.md) for the lane table and the shared-file rules |
| **TypeScript** — all of `docs/typescript/` | session `713ec3db` | 2026-08-14 | 🔴 **Active — held WHOLE, the A/B split is closed.** Part A (phases 2–6) was claimed by session `3bbe364c`, which wrote the phase-2 index and topic 08 and then went quiet; Part B (phases 7–12) was never picked up. One session now owns all of it. **Baseline at takeover: 38 of 187 topics** — phases 0–1 complete (30), phase 2 at 8/13. ✅ **Phase 2 is now COMPLETE, 13/13** (22 files, 4,261 lines, 0 over the 300-line cap) — TypeScript is at **43 of 187**, and phase 3 (Generics, 14 topics) is next. **144 topics pending.** 🔴 **Work is in the worktree `devbible-typescript`, branch `typescript-pages`** — ⚠️ **not merged into `main`**; it merges at each phase boundary. Documentation-validated against the TypeScript handbook and release notes under the no-new-sandboxes rule; phases 0–2 reuse the recorded `sandbox/ts-p{0,1,2}/` runs and carry **no fabricated console output**. Resume point: `devbible/progress_typescript_build.md`. |
| **CSS** — all of `docs/css/`               | session `6f020813` | 2026-08-14 | ✅ **COMPLETE — RELEASED, free to pick up.** Syllabus re-scoped to the critical path (119 → 74 topics; SCSS is usage-only, the architecture phase was cut). **All 11 phases written — 74 topics, 81 pages, 17,359 lines, 0 files over 300 lines.** Flexbox and Grid at full Master depth on the user's instruction. Doc-validated under the no-new-sandboxes rule with sources named per page; **no fabricated console blocks.**                                                                                     |
| **Node.js** — all of `docs/nodejs/`        | session `8679dc8c` | 2026-08-14 | ✅ **COMPLETE — audited, free to pick up.** All 13 phases written, **all 248 syllabus topics covered** (231 pages; six phases merge pairs of rows and each says so in a Coverage table). **232 files, 232 carrying `> Verified:`, 0 files over 300 lines, 0 broken links in a clean rebuild.**                                                                                                                                                                                                                       |
| **Express** — all of `docs/expressjs/`     | session `b7f137c4` (continues `ffadd057`) | 2026-08-14 | ✅ **Master-tier depth pass COMPLETE — 28 of 28**, plus **new Phase 5 topic 08 "Every error that arrives"** (the full catalogue: driver, network, library and programmer errors) written on request. Locked to this session by *"Lock it in express js"*; the claim moved rather than a second Express claim being opened. **183 files, 30,731 lines**, 11 phases, **115 of 115 topics**, every page carrying `> Verified:`, a tier badge, Gotchas, a Trade-off and Interview questions; Coverage tables on all 11 phase READMEs; **0 files over the 300-line cap** and **0 broken links** in a clean isolated rebuild. The depth pass fixed a flat tier curve — 28 Master topics had been 63–200 lines and none chunked; they now run 2–5 chunks each, 3,829 → 21,190 lines. **Parked at the user's request (written, complete, not on the reading path): Phase 9/01 trust proxy and Phase 8/07 resource ownership.** Additive and **nothing was run** — new material validated against the Express 5 docs, PostgreSQL/MongoDB error-code references, Node docs, MDN and RFCs 9110/6749/6750/6585/7519/7239, each named in the page's `> Verified:` line. |
| **MongoDB** — all of `docs/mongodb/`       | session `05921047` | 2026-08-14 | 🔴 **CLAIMED and active** — written in worktree `devbible-mongodb`, branch `mongodb-pages`. **Phases 0–5 COMPLETE — 34/82.** Next: Phase 6 · The aggregation pipeline. Syllabus **cut to the critical path: 204 → 82 topics** (Master tier only, capped at 6 per phase). **Phase 0 COMPLETE (5/5)**; phase 1 not started. The session stopped without writing `pages/README.md` or committing two phase-0 pages — repaired by session `632ebd35`, which did **not** take the claim. Next: **Phase 1 · Documents, BSON types and `_id` (6 topics)**. Documentation-validated against the MongoDB Manual under the no-new-sandboxes rule. |
| **Redis** — all of `docs/redis/`           | session `8679dc8c` | 2026-08-14 | 🔴 **Active.** Picked up on finishing Express. **Syllabus complete — 11 phases, 74 topics**, scoped to the critical path (Search/JSON/time-series/vector-sets and cluster admin are deliberately out). No pages yet; next unit is **Phase 0 · How Redis runs (6 topics)**. Claimed because **Node and Express defer to this track on 39 pages** — sessions, shared rate-limiter state, denylists, idempotency keys, queues.                                                                                         |
| **Frontend toolchain** — 12 **new** folders: `docs/storybook/` `docs/vite/` `docs/webpack/` `docs/babel/` `docs/eslint-oxlint/` `docs/jest-rtl/` `docs/playwright/` `docs/redux-toolkit/` `docs/tanstack-query/` `docs/framer-motion/` `docs/web-vitals-performance/` `docs/frontend-architecture/` | session `0fe4e7e0` | 2026-08-14 | 🔴 **Active — corpus moved in.** **204 pages** brought over from the separate `frontend-bible` repo, in their original section structure, on 2026-08-14. Work happens in worktree `devbible-frontend`, branch **`frontend-merge`**. **This lane touches no existing technology** — React, JavaScript, TypeScript, CSS and Git belong to other live sessions and are out of scope here, as are Next.js and every backup directory in the source repo. **Status: moved, not validated.** The imported pages have **no `> Verified:` line, no tier badge and no Interview section**, and 12 cross-references to non-imported technologies were de-linked during the move. **Storybook is the exception** — phases 0–3 (23 topics, 5,488 lines) were written to full devbible depth and are build-verified. Next step to be agreed with the user. |
| **Git** — all of `docs/git/`               | session `45e775dc` | 2026-08-14 | ✅ **COMPLETE — released, free to pick up.** Was 🔴 locked (*"There was git course yet to complete the explanations can you pick it up ? and lock it in ?"*). Syllabus complete (13 phases, **191 topics**, 4 parts, 55 Master). **Phase 0 COMPLETE — 14 pages**, sandbox-proven from `sandbox/git-p0/ex1`+`ex2`. 🔴 **RE-SCOPED 2026-08-14 to daily-driver Git — 191 topics cut to 52** (*"I just need to know about the git to work daily tasks not more than that"*). In scope: phases **0, 1, 2, 4, 5** — how Git stores things, the everyday loop, branching and merging, remotes, undo and recover. **Parked:** phase 3 (history in depth), phase 6 (team workflow), and Parts 3 and 4 entirely (repo design, hooks/CI, speed, plumbing, history surgery). ✅ **COMPLETE — all 52 in-scope topics written**, 62 files. Phase 0 how Git stores things (14) · 1 the everyday loop (12) · 2 branching and merging (10) · 4 remotes (8) · 5 undo and recover (8). Phases 3, 6 and 7–12 remain deliberately parked. Phase 0 is sandbox-proven from `sandbox/git-p0/`; phases 1–5 are documentation-validated against git 2.55.0's own manuals with no fabricated console output. Topics 03 onward drop the interview-question block on the user's instruction, keeping gotchas and command tables. ⚠️ Phase 1 onward is **documentation-validated, not sandbox-proven** — the no-new-sandboxes rule closed the `ex3` plan the old memory carried; pages reuse the recorded `ex1`/`ex2` output where it genuinely covers a claim and otherwise carry **no console block**. Resume point: `devbible/progress_git_pages.md`. |
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
| **[JavaScript](./javascript/README.md)** | 5 parts · 337 rows, **316 in scope** | Pending — **137 of 316 in scope / [236 pages](./javascript/pages/README.md)**; phases 0–2 complete at every tier, and the **Master tier of every phase 0–18 complete (99/99)**. Understand and Know tiers under way — 145 topics remain in the active queue |
| **[TypeScript](./typescript/README.md)** | 4 parts · 187 topics | 🚧 In progress — **43 of 187 topics**, [55 files](./typescript/pages/README.md); phases 0, 1 and 2 complete                              |
| **[CSS](./css/README.md)**               | 4 parts · 74 topics  | **✅ COMPLETE** — [81 pages](./css/pages/README.md) across 11 phases; critical-path scope                                                   |
| **[React](./react/README.md)**           | 4 parts · 210 topics | Pending — [255 pages](./react/pages/README.md), **phases 0–11 and 14 complete**; 12/13 dropped                     |
| **[Git](./git/README.md)**               | 5 phases · 52 topics (re-scoped) | 🔴 In progress — [52 topics](./git/pages/README.md) (62 files) — daily-driver scope COMPLETE                                                                                       |
| **[Express](./expressjs/README.md)**     | 4 parts · 115 topics | ✅ **Complete, Master tier at full depth** — [183 files](./expressjs/pages/README.md) across 11 phases, 30,731 lines; all 115 topics covered and verified, the 28 Master topics chunked into `NN-topic/` directories; 0 over the cap, 0 broken links |
| **[MongoDB](./mongodb/README.md)**       | 4 parts · 82 topics  | Pending — [34 pages](./mongodb/pages/README.md), **phases 0–5 complete**, phase 6 next                                                         |
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
