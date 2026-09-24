---
name: cursor-version-coverage
description: 🔴 START HERE for the corpus-wide VERSION-COVERAGE audit (opened 2026-09-24) — for every track, up to which upstream version the content is applicable, compared against the supported LTS lines first, and what is missing. Batch table, run IDs, report files, next batch by name.
metadata:
  type: project
---

# 🔴 START HERE — version-coverage audit (all tracks vs LTS)

## The standing order — 2026-09-24, the user's words

> *"We need to revisit everything i mean all existing languages we need to identiffy the content
> explanation upto which version they are applicable first compare LTS versions what was missing.
> create a task for this and work on please N you have ultracode"*

> *"continue with the next batches, don't wait for me"* — 2026-09-24. **Chain the batches with no
> check-in**: the moment one Workflow returns, bank it, repoint this table, commit, launch the next.
> Still one Workflow at a time (usage), never two in parallel.

**This file is that task.** It takes **no language lock** — it is a read-only audit. No agent in
this lane edits `docs/`; every finding is banked here and handed to the owning lane.

## What each unit answers

1. **Content applies up to** — the newest upstream version whose notable changes the pages
   actually teach, with evidence (pins, `> Verified:` spines, feature probes). Plus the floor.
2. **Upstream release lines** — supported LTS lines first (current + previous), then latest
   stable and the next LTS with its date. Sourced from endoflife.date / vendor pages fetched
   in-session, never memory.
3. **The delta** — every notable, teachable change (new / changed default / deprecated /
   removed) from the content baseline through current LTS and latest, each graded
   `COVERED` · `PARTIAL` · `MISSING` · `CONTRADICTED` (a page teaches the old behaviour as current),
   with the file:line or the grep terms tried.
4. **Adversarial verify** — a second agent re-checks every MISSING/PARTIAL/CONTRADICTED row:
   is the feature real and in that version (primary source), and does coverage exist under
   another name or in another track. Refuted rows are marked, never deleted.

**Reports:** `docs/_project/version-coverage/<unit>.md` in the devbible repo (moved from the store 2026-09-24; `claude/devbible/…` is a symlink to it, so batch 1's paths still resolve) (300-line cap; overflow continues in
`<unit>-02.md`, never trimmed). Each agent commits its own file via
`shared/scripts/store-commit.sh`, section by section, so a kill loses at most one section.

## The batches — one Workflow at a time, 4 units each (standing orders, see below)

| # | Units | Run ID | State |
|---|---|---|---|
| 1 | nodejs · java-jdk · java-spring · python | `wf_af3cc5c0-4c5` (8 agents, 4 at once) | 🔴 dispatched 2026-09-24 ~13:00 |
| 2 | postgresql · angular · mongodb · redis | — | — |
| 3 | nginx · docker · git · typescript | — | — |
| 4 | javascript · react · nextjs · expressjs | — | — |
| 5 | css · vite · webpack · babel | — | — |
| 6 | eslint-oxlint · jest-rtl · playwright · storybook | — | — |
| 7 | framer-motion · tanstack-query · redux-toolkit · web-vitals-performance | — | — |
| 8 | real-world · dsa · system-design · frontend-architecture | — | — |
| 9 | **synthesis** — one master table + ranked gap list across all 32 units | — | — |

LTS-bearing products go first (batches 1–2), as the order asked.

## If a run dies mid-batch

- Nothing in `docs/` was touched. The devbible repo is left exactly as found.
- Each unit's report is on disk in `version-coverage/` and committed up to its last finished
  section. A unit whose file lacks `## 6 · Verification` never finished its verify pass —
  re-run **only the verify stage** for it.
- `Workflow(resumeFromRunId:)` is same-session only — a new session re-dispatches the unfinished
  units of that batch, nothing else.
- The script used is copied to `version-coverage/_workflow-batch.js` at dispatch.

## Rules this lane carries (why: the linked feedback)

- **One Workflow in flight, ≤4 research agents at once** — 6 at once hit the account limit in
  44 min on 2026-09-14. [[feedback-one-workflow-at-a-time]] · [[feedback-workflow-cannot-drain]]
- **Save at dispatch**: repoint the table above with the run ID and commit before waiting.
- **Every chunk on disk before the next** — [[dispatch-anti-stall]].
- Known pin state at open (`node scripts/currency.mjs --check`, 2026-09-24): 22 current ·
  15 patch · 18 minor · 2 major (Flyway 12→13.7.0, Jotai 2→3) · 7 unanchored (ESLint, Oxlint,
  Jest, RTL, Playwright, Motion, web-vitals) · 2 inconsistent (TypeScript pages say 5.9.3 vs
  pin 7.0.2; TanStack 5.40.0 floors — a known false positive) · 📅 Node 26 LTS 2026-10-28.

## Next action

Batch 1 in flight (`wf_af3cc5c0-4c5`). If this session died: check which of `version-coverage/{nodejs,java-jdk,java-spring,python}.md` lack `## 6 · Verification` and re-dispatch only those, reusing `version-coverage/_workflow-batch.js` (repointed at docs/_project/ 2026-09-24 — pass it as `scriptPath`) with the args in `version-coverage/_batch-01-args.json` (filter `units` to the unfinished ones). Then **batch 2**.
