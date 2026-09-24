---
name: cursor-a2-toolchain
description: 🔴 START HERE for the A2 toolchain lane. tanstack-query and vite are COMPLETE; the lane's next unit is the ORM track (Prisma + Mongoose), which is RULE 5 — syllabus + card only, then STOP AND ASK. Carries the standing orders verbatim, the dispatch rules bought at cost, the house style and the known defect classes. Rewritten 2026-09-08 by session bc194850.
metadata:
  type: project
---

# 🔴🔴 COLD START — read this block, then act

**Save point 2026-09-08 evening (end of session `8b9ca9ad`).** Working tree **CLEAN**
apart from `graphify-out/cache/last_query_stamp`, which is not ours. Everything **committed
AND pushed** — devbible `origin/main` = `098d4888f`, memory store = `b0b4c11`.
(Earlier save that day: session `bc194850`, `554f769c` / `99ab2cb`.)

🔴 **Two different orders exist on this lane and they are NOT the same list.** Do not let one
overwrite the other:

| | What ranks it | Next |
|---|---|---|
| **Authoring** — writing tracks that are thin or unwritten | the **user's** order, 2026-09-07 | **ORM** (rule 5 below), then CI/CD → webpack → babel |
| **Validation** — A2, checking the 164 imported pages that are live and unverified | `yarn validate --queue --scope imported`, computed from disk | **`docs/eslint-oxlint/pages/02-eslint-core-architecture`** |

**Validation position: 70 units pending** (was 71). `docs/eslint-oxlint/pages/01-linting-landscape-and-tooling-decisions`
is done — risk 85 → 0, marks `BV✓`, repo `098d4888f`, row banked in
[VALIDATION-LEDGER.md](VALIDATION-LEDGER.md).

🔴 **Units 02–21 of eslint-oxlint are the same shape as 01** — 1 page each, risk 85, never
sourced, no badge, no Gotchas, no Interview questions. Their sources are **already banked** in
[[research-eslint-oxlint-01-landscape]]: quote from it, do not re-fetch oxc.rs per page. That
bank is the whole saving — 20 pages resting on four documents.

⛔ **Do not run `yarn build`, and do not go read CI.** Standing order 2026-09-08, given while a
local build was running: [[devbible-feedback-never-run-local-build-or-check-ci]]. The owed gates
are `yarn linkcheck` and `yarn mdxcheck` (raw-tag detection **ON**), per file.

## Do these three things first

1. **`git status --porcelain docs/`** — must be clean. `docs/graphify-out/cache/stat-index.json`
   and bulk `graphify-out/` churn are **permanently dirty and NOT ours**. Ignore them; never
   commit them.
2. **`yarn linkcheck docs/tanstack-query`** — was **70 files, 0 problems**. If it is not clean,
   a sibling session touched the track.
3. 🔴 **Read [DISPATCH-ANTI-STALL.md](DISPATCH-ANTI-STALL.md) before writing any agent brief.**
   It is short and every line in it was paid for with a dead agent or destroyed content.

## ✅ Nothing is owed on the finished tracks

| Track | State |
|---|---|
| `redux-toolkit` | ✅ 22 / 22 — complete 2026-09-06. **Report it; do not re-run it.** |
| `tanstack-query` | ✅ **COMPLETE 2026-09-08 — 16/16 topics, 68 pages, ZERO `*(not written yet)*` markers.** |
| `vite` | ✅ 17 / 17 topics, 164 pages — complete 2026-09-08. Cursor: [CURSOR-VITE.md](CURSOR-VITE.md) |
| `webpack` | ⬜ 0 / 22 — later in the order |
| `babel` | ⬜ 5 / 18 — later in the order |

A session told *"continue tanstack"* or *"continue vite"* should **say the track is finished**
rather than invent work.

## 🔴 THE NEXT UNIT — the ORM track, and it is RULE 5

**Order (user, 2026-09-07): ORM → CI/CD → webpack → babel.** ORM and CI/CD are both **un-started**.

🔴 **RULE 5 APPLIES: SYLLABUS AND CARD ONLY, THEN STOP AND ASK.** No explanation pages until the
user approves the syllabus. Build the same shape `docs/dsa/` and `docs/system-design/` got on
2026-09-06: the directory, `README.md` syllabus, `pages/` stub, `_category_.json`, then the wiring
— `sidebars.js`, `src/data/progress.js`, `src/data/stack.js`, a row in `docs/README.md`,
`node scripts/page-counts.mjs`, `node scripts/status.mjs`.

**🔴 START HERE → create `docs/orm/README.md` as a syllabus, then STOP and ask.**

🔴 **SCOPE IS FIXED BY THE USER: Prisma + Mongoose ONLY.** Drizzle was offered as a third library
and **explicitly cut** — do not reintroduce it, and do not let a "compare the alternatives" section
grow into de-facto Drizzle coverage. One card, two libraries, organised around the seam: schema and
migrations · query building · relations and the N+1 · transactions · connection pooling in
serverless · when to drop to raw SQL. Each library gets its own pin in `src/data/pins.js`
(`references/library-scope.md` in the topic skill governs that).

Why these two tracks were chosen, measured 2026-09-07: **`prisma` returns ZERO hits across every
track README**; `mongoose` returns 2, both incidental; **`github actions` returns ZERO hits**,
even though this repo deploys on Actions and has a hard project rule about that pipeline.

⛔ **Java's JPA/Hibernate stays in `docs/java/`** — different runtime, different idioms.
⛔ **Deliberately NOT new cards** — Kubernetes, Kafka, Terraform, OpenTelemetry are planned as
parts *inside* `docs/system-design/` ([PLAN-SYSTEM-DESIGN.md](PLAN-SYSTEM-DESIGN.md)); cards would
fragment them. GraphQL was offered and not taken up.

---

# 🔴 Dispatch rules, QC, and the five boards — moved

**These were hoisted to [reference_agent_dispatch_and_boards.md](reference_agent_dispatch_and_boards.md)
on 2026-09-08** because none of them are toolchain-specific: the measured dispatch rules, the
QC check to run on every agent's output, and the **five** board surfaces a finished topic must
update (`progress.js`, `page-counts.json`, `status.json`, **`docs/<track>/pages/README.md` —
two tables**, `docs/README.md`). Read that file before dispatching an agent or closing a topic
on **any** track. Anti-stall line: [DISPATCH-ANTI-STALL.md](DISPATCH-ANTI-STALL.md).


# 🔴 Standing orders — the user's own words, do not paraphrase

**2026-09-07, session `352cf446`:**
1. *"Ok take tanstack query first validate it and then lets pick then redux toolkit, vite, webpack, babel"*
2. *"we need to pick per language and per phase and only one phase complete then only next phase"*
3. *"please deploy 3 agents make sure they follow Devbible Skill and make sure validated"*
4. *"your job is to qc or re validate do any of the recommendation you suggest"*
5. *"Before deploying agents i want you to save the session progress and after completing current
   phase or agents revert back need to save the session progress"*
6. *"add ORM and CI/CD tracks after tanstack is done"* — this **reorders the lane**; the new tracks
   come BEFORE vite/webpack/babel.

**2026-09-08, session `bc194850`:** *"deploy agents max 4 n u monitor"* · *"save the current session
progress push everything"* · *"Please kill all and save sesion progress"*.

**Division of labour:** agents write, **the session QCs and re-validates.** The session gates every
returned file (`wc -l`, `grep -c '^\*\*★'`, the per-block loss diff above, `yarn mdxcheck <dir>`,
`yarn linkcheck docs/<track>`), fixes what it disagrees with, commits explicit paths, and banks the
ledger row.

## The pipeline, not a plan
`.agents/references/validation-pipeline.md` owns the loop; `.agents/skills/devbible-topic/SKILL.md`
owns the depth bar. 🔴 **S5 — wording, ordering, heading style — is LEDGER-ONLY.** A validation
pass that rewrites prose that was already true stops being a validation pass.

## 🔴 Bank before fetching
[research_tanstack_query_v5_quotes.md](research_tanstack_query_v5_quotes.md) covers keys, Important
Defaults, status vs fetchStatus, gcTime, invalidation, the whole mutation surface, suspense, the
**full v4→v5 breaking-change list**, `initial-query-data`, and **render-optimizations**.

🟢 **The `select` re-run question, open since 2026-09-06, is CLOSED** — render-optimizations settled
it and additionally settled **structural sharing** and **tracked properties**/`notifyOnChangeProps`.

⚠️ **Dead doc URLs — do NOT spend a fetch on these:** `…/docs/reference/QueryClient` and
`…/framework/react/reference/useQuery` both return `{"isNotFound":true}`. Source from the guides.

## ⚠️ Left OPEN on the pages rather than guessed — do not "resolve" these from memory
1. Whether the **result of `select`** is structurally shared. Marked open on **both** pages that
   touch it (`02/01f`, `04/01g2`), cross-linked so they agree rather than each guessing.
2. Non-JSON values inside the structural-sharing walk; whether `setQueryData` uses the same
   comparison; infinite queries + structural sharing.
3. Two observers mounting one key with **different** `initialData`; what `dataUpdatedAt` reports
   while `isPlaceholderData` is true.
4. 🔴 **Six `queryOptions` type signatures are marked "⚠️ Extrapolated"** — the reference pages 404,
   so nothing was quoted. Includes `infiniteQueryOptions` and `queryClient.query()` + `skipToken`.

---

# House style for the tanstack track — measured off the finished units
Frontmatter → `<span className="db-tier t-master">Master</span>` → `> Verified:` → `> Validated:`
→ H1 with a leading emoji → **bold lede** → numbered `## N.` sections → `## Gotchas` →
`## Interview questions` → `---` → footer. Every gotcha opens `**★ Symptom: … ** Cause: … Fix: …`;
every interview entry opens `**★ …?**`. Chunks run **150–296 lines and 9–23 ★**.
⛔ **No `{/* FOOTER */}` markers** — and note one can sit *after* a real, correct footer; only the
dedicated grep catches it.

# Known defect classes in this track — check every unit
1. 🔴 **`setQueryData` updater dereferencing `old`** — it is handed `T | undefined`
   (*"If the query does not exist, it will be created"*).
2. 🔴 **Unguarded `onMutateResult` / `context`** in a rollback — typed `| undefined`.
3. **v4-shaped API** — positional `useQuery([key], fn)`, `cacheTime`, `isLoading` for pending,
   `keepPreviousData` as an option rather than a `placeholderData` function.
4. **Deprecated `prefetchQuery` / `ensureQueryData`** → `queryClient.query()`.
5. **Pre-rename mutation callback params** — third arg is `onMutateResult`, `context` is fourth.

⛔ **Do not re-open audit item A3 on a grep hit.** `prefetchQuery`, `keepPreviousData`, `cacheTime`,
`isInitialLoading` and `ensureQueryData` all still appear in `docs/tanstack-query/` and **every
occurrence is deliberate v4-was/deprecated teaching.**

# Cadence — per file, never per wave
write/receive a file → session gates → session fixes → `git add` **explicit paths** → commit →
ledger row in [VALIDATION-LEDGER.md](VALIDATION-LEDGER.md) → repoint this file.
🔴 **Never `git add -A`** — several sessions share this checkout.

⚠️ **`yarn validate --queue --scope docs/<track>` does NOT filter to that track** — it returns ~998
units and lists unrelated tracks first. Use `--scope imported`, or measure off disk.

# ⚠️ Small and open, not blocking
- **`src/data/pins.js`: `@tanstack/react-query-devtools` has no pin**, though topic 11 teaches it
  across 6 pages. Still `pin: null` and nobody's lane: eslint, oxlint, jest, rtl, playwright,
  motion, web-vitals.
- ✅ **Six single-page tanstack topics remain (01, 03, 05, 09, 12, 13) and are NOT debt** — measured
  **214–277 lines, 13–18 ★**, dead centre of the house band. **Do not "deepen" them on the
  assumption that one file means thin.**
- `06-background-refetching/01b-refetch-render-cost.md` overlaps `04/01g` on structural sharing; the
  newer page extended and cross-linked it three times. Worth a duplication-policy glance.

Related: [[devbible-locks]] · [[dispatch-anti-stall]] · [[devbible-validation-ledger]] ·
[[cursor-audit]] · [[research-tanstack-query-v5-quotes]] · [[cursor-vite]]
