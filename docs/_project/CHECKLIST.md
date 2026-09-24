---
name: devbible-checklist
description: 🔴 THE ONE CHECKLIST (2026-09-24) — every pending and upcoming devbible task, bug fix and feature in one place, each line pointing at the file that holds the detail. Start here for "what is pending".
metadata:
  type: project
---

# ✅ devbible — master checklist (pending · upcoming · bugs · features)

**As of 2026-09-24 ~13:45.** One line per item, with a pointer to the file that holds the detail.
Legend: `[ ]` open · `[~]` in progress · `⏸` held by the user · `❓` needs your decision.
Paths are relative to `docs/_project/` unless they start with `docs/`, `src/` or `scripts/`.

> ⏸ **Everything is on HOLD (user, 2026-09-24).** Only the running batch-1 audit continues. Nothing
> below starts until you say which item.

---

## 1 · Right now

- [~] **Version-coverage audit, batch 1** (Node.js · Java JDK · Java Spring · Python), run
      `wf_af3cc5c0-4c5`. All 4 audit reports are written; the verify stage (`## 6 · Verification`) is
      still running. → [CURSOR-VERSION-COVERAGE.md](CURSOR-VERSION-COVERAGE.md)
- ⏸ **Batches 2–8 the new way:** official LTS syllabus × our pages × free content → LINK / KEEP / WRITE.
      Batch 2 = PostgreSQL · Angular · MongoDB · Redis, first to launch. → same cursor
- ⏸ **Batch 9:** the new-way map for the four batch-1 tracks, then **batch 10: synthesis** (one table +
      ranked WRITE / OUTDATED / LINK lists).

## 2 · ❓ Decisions waiting on you

- [ ] ❓ **TypeScript:** the pin says 7.0.2, but ~120 pages say 5.9.3. Bump the pages, keep 5.9 as an
      LTS-style line, or change the policy? → [CURSOR-AUDIT.md](CURSOR-AUDIT.md) §3
- [ ] ❓ **Flyway 12 → 13.7.0** is a major version, touching ~50 Java pages. Update the pages, or freeze at 12? → CURSOR-AUDIT §3
- [ ] ❓ **Jotai 2 → 3.0.0** is a major version, touching 4 pages (nextjs, react). → `node scripts/currency.mjs --check`
- [ ] ❓ **834 output blocks with no source** (run output nobody attributed): urgent, or fix as pages are touched (Tier E)? → CURSOR-AUDIT §3
- [ ] ❓ **Firefox 153 is frozen** as the measuring browser; 156 is out. Re-measure CSS/React on 156? → `src/data/pins.js`
- [ ] ❓ **Delete the pre-move backup** `/mnt/Storage/my-learning/.devbible-premove-20260924/`? (the move is
      verified byte-identical) → [reference_tracking_moved_to_docs_project_20260924.md](reference_tracking_moved_to_docs_project_20260924.md)

## 3 · 🐞 Bugs — live pages teaching something wrong (fix first)

Found by the batch-1 audit. **Unverified until each report's §6 lands**, since the verify stage may overturn rows.

- [ ] **Node.js — 16 contradicted (11 live, 5 latent) + 21 stale claims.** Examples: AsyncLocalStorage
      mechanism (24.0 moved it onto AsyncContextFrame), `permission.drop()` (24-permission-model.md:193), Corepack /
      SEA-ESM / transform-types / FFI stated in their 24-only shape. → [version-coverage/nodejs.md](version-coverage/nodejs.md) §5 (+ `-02…-05`)
- [ ] **Java JDK — 5 contradicted.** → [version-coverage/java-jdk.md](version-coverage/java-jdk.md) §5
- [ ] **Java Spring — 7 contradicted.** → [version-coverage/java-spring.md](version-coverage/java-spring.md) §5
- [ ] **Python — 5 contradicted.** → [version-coverage/python.md](version-coverage/python.md) §5
- [ ] **Motion (framer-motion) — 13 pages import the old `framer-motion` package name.** → validation lane, `yarn validate --queue --track framer-motion`
- [ ] **Angular:** the pin says 22.1.4, the pages say 22.1.5 / CLI 22.1.7. Fix the pin. → `src/data/pins.js`
- [ ] *To check in batches 5/7:* Vite topic 05 is named `build-system-rollup` (Vite 8 bundles with
      Rolldown). Web Vitals pages may still teach FID, which INP replaced.

## 4 · 🐞 Tooling bugs

- [ ] **ruff is wrong in `static/currency.json`:** it shows `latest: 0.4.10` with drift `none`, but the real latest is 0.16.8.
      A GitHub tag-page resolution bug in `scripts/currency.mjs`. → version-coverage/python.md §1 (row S6)
- [ ] `scripts/currency.mjs` computes each pin's file list, then drops it; only the page count survives.
      → `.agents/skills/devbible-currency/SKILL.md` "Known gaps"
- [ ] **7 pins have no version (`null`):** ESLint, Oxlint, Jest, Testing Library, Playwright, Motion, web-vitals.
      The batch 6/7 maps will propose values. → `src/data/pins.js`
- [ ] **No pin at all** for 2 tracks: `frontend-architecture`, `real-world`. → `src/data/pins.js` `UNGOVERNED`
- [ ] `mdxcheck` flags 2 RAW-TAG hits that build fine: `docs/python/pages/phase-3-collections/01-list-internals/07-timsort.md:126`,
      `…/09b-sorting-text.md:107`. Either a false positive (fix the checker) or a latent build risk.
- [ ] **memcheck:** `INDEX-backend.md` has 1 entry over 240 B; 88 tracking files are over 300 lines (content debt).
      → `/mnt/Storage/my-learning/claude/shared/scripts/memcheck.sh devbible`
- [ ] ~10 index/board files in `docs/_project/` carry dangling `../shared/…` links since the move.
      Cosmetic, because the folder is never built. → reference_tracking_moved_to_docs_project_20260924.md
- [ ] **Version drift:** 15 patch, 18 minor, 2 major (Flyway, Jotai), 2 inconsistent (TypeScript;
      TanStack 5.40.0 is a known false positive). → `node scripts/currency.mjs --check` + the triage ladder

## 5 · 📅 Upcoming — dated

- [ ] **2026-10-01** — Python **3.15.0** GA (per its schedule; rc2 is out). The corpus targets 3.14. → python.md §1
- [ ] **2026-10-19** — GitHub `ubuntu-latest` becomes Ubuntu 26 (an annotation on every deploy). Watch the first deploy after it.
- [ ] **2026-10-20** — Node 24 moves to Maintenance LTS.
- [ ] **2026-10-28** — **Node 26 becomes Active LTS:** change the `node` pin to cycle 26 in `src/data/pins.js`. The
      pages were already de-expired (B1), so this is a pin edit, not a page sweep. Node 27 alpha opens the same day
      (new model: one major a year, every release LTS).
- [ ] **2026-10-31** — Python **3.10 EOL**, the corpus's floor version.
- [ ] Every Monday 06:00 UTC, the `currency` workflow opens an issue. Triage it with the devbible-currency skill.

## 6 · 📚 Content backlog, by track

Pick one track per session. The lock is whatever you name. Status is from [LOCKS.md](LOCKS.md), 2026-09-24.

| Track | State | Next | Resume file |
|---|---|---|---|
| Python ph3 | ⏸ 7/12 wired | wire **08 copy-and-deepcopy** (12 chunks committed, unwired) + **09 iteration-idioms** (2 chunks; README row for chunk 02 owed), resume mode | progress_python_pages.md |
| Python ph7 | ⏸ 6/12 | **07 wheels-and-sdists**: research done (19-chunk plan), 0 pages | CURSOR-PYTHON-PHASE7.md |
| Angular | topics 01–07 closed, 387 pages | topic **08** scaffolded; the research stops at 08.04 | CURSOR-ANGULAR.md |
| Java | 🟡 parked 160/232 | claim a row on the board first | JAVA-BOARD.md |
| JavaScript | 4 chunks A/B/C/D | 94 topics left | progress_javascript_split_4way.md |
| Docker & Podman | 4 chunks A/B/C/D | 129 topics left | progress_docker_split_4way.md |
| Redis | 3 chunks A/B/C | 74 topics, 0 written past phase 0 | progress_redis_split_3way.md |
| TypeScript | parts A/B/C | 136 in scope, 90 done (blocked by the ❓ pin decision) | progress_typescript_build.md |
| Nginx | phases 0–2 done | phase 3 next, 210 topics | progress_nginx_build.md |
| MongoDB | 🟡 34/82 | paused cleanly | progress_mongodb_pages.md |
| DSA + System Design | DSA ph2 closed | **SD phase 3 (caching)** scaffolded, not started | CURSOR-DSA-SYSTEM-DESIGN.md + BRIEF-sd-phase3-caching.md |
| Storybook | imported, not in house style | bring to house style; 7 files over cap; 35 topics unwritten | CURSOR-STORYBOOK.md |
| React | 🟡 parked | phases 12–13 open | progress_react_phase7.md |
| CSS | 🟡 | — | progress_css_pages.md |
| Real World | 🔵 | storefront scenarios | progress_realworld_run_20260901.md |
| Toolchain authoring | 🔵 | **ORM (Prisma + Mongoose)**: syllabus + card only | CURSOR-A2-TOOLCHAIN.md |
| Interview prep | ⏸ step 1 paused | batch 1 of 4 (🔒 kept in the private store) | CURSOR-INTERVIEW.md (symlink) |
| Done ✅ | vite · tanstack-query · redux-toolkit · express · git · next.js | — | — |

## 7 · ✨ Features and improvements (planned, not built)

- [ ] **Hub + delta on live pages:** once the maps land, add the LINK-outs to the best free page at the top of
      each LINK page and keep our words for the delta. → feedback_hub_plus_delta_20260914.md
- [ ] **A2: validate the 164 imported toolchain pages** (70 units pending; eslint-oxlint 01 done).
      → `yarn validate --queue --scope imported` · VALIDATION-LEDGER.md
- [ ] **framer-motion validation** (8 of 18 units done). → `yarn validate --queue --track framer-motion --limit 5`
- [ ] **Next.js `io()` page (B2)**, a Master-tier gap. Upstream says prefer `io()` over `connection()`.
      → CURSOR-AUDIT §4 (start beside `docs/nextjs/pages/05-caching-ppr-and-cache-components/01c-…md`)
- [ ] **Rspack**: zero mentions corpus-wide, but it's the drop-in successor to a webpack config. → batch 5 map
- [ ] **Per-track `reviewMonth`** to spread re-verification across 12 months (the "freshness cliff": almost every
      page says 2026-08). Proposed, not built. → devbible-currency SKILL "Known gaps"
- [ ] **Pins for taught libraries** that still have none (the bcrypt / helmet / multer / passport class).
      → `.agents/references/` library-scope rule
- [ ] **Tier E, opportunistic:** split tracking and doc files over the 300-line cap on a concept boundary when next
      touched (both totals must go UP); attribute output blocks as pages are touched.

## 8 · Done today (2026-09-24), for the record

- [x] The version-coverage task was opened and batch 1 dispatched (4 audit reports written).
- [x] All devbible tracking moved into `docs/_project/`. The store's `devbible/` is a symlink; tools, hooks and
      CI were adapted; deploy is green.
- [x] The interview bank was kept private; the public push was squashed so it never entered public history.
- [x] Rule saved: never build or test locally; commit, push, and verify in GitHub Actions.
- [x] 29 commits pushed earlier (Python ph3 work in progress); deploy green.
