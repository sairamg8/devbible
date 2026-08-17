---
title: "React — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

:::tip Consolidated 2026-08-15 — all work is on `main`
Every worktree and branch in this repo was **merged into `main` and deleted** on
2026-08-15. Any "worktree `devbible-…`", "branch `…`" or "not merged" note below is
**historical** — nothing is stranded, and all of it is on `main`. Work in
`/mnt/Storage/Backup/Knowledge/devbible` on `main`, and keep staging
explicit paths (never `git add -A`) since everyone shares the checkout again.
:::

:::caution 🔒 CLAIMED — React patterns (chunk A) is being written by session `02b2af2d`

**Claimed 2026-08-17.** The user asked for **React patterns for better development** and
for **site search**, and asked for the task to be split. It is split **two ways**, and the
two chunks share no file:

| Chunk | Scope | Owner | Since |
|---|---|---|---|
| **A · React patterns** | **`docs/react/` only** — consolidate the pattern topics into a hub | session `02b2af2d` | 2026-08-17 — ✅ **COMPLETE** |
| **B · Local search** | `docusaurus.config.js`, `package.json`, `yarn.lock` — **nothing under `docs/`** | unclaimed | — |

**Chunk A consolidates; it does not add a phase.** The patterns are already written and
scattered — compound components in phase 2 topic 8, render props in topic 12, HOCs in
topic 13, composition in topic 3, controlled/uncontrolled in topic 4, context + reducer in
phase 5 topic 12, hooks-API design in phase 7 topic 6. A reader looking for "compound
components" has to already know which phase it hides in, and that is the problem being
fixed. The hub teaches **selection** — problem, when it is right, when it is not — and
**links** to the page that implements each pattern. **No pattern is re-implemented.**

🔴 **Phases 12 (Data and state) and 13 (Routing) stay DROPPED.** This chunk does not
reopen them; that needs a new instruction.

⚠️ **`docs/frontend-architecture/pages/02-component-architecture/01-composition-patterns.md`
already covers compound components, headless UI and composition over configuration.**
Cross-link it — **never edit or duplicate it.** It is a different technology with a
different owner.

Split rules and both paste-ready prompts:
`/mnt/Storage/my-learning/claude/devbible/project_react_patterns_and_search_split.md`.

### Phase state — unchanged by this chunk

| Phase | State |
|---|---|
| 0, 1 | ✅ Done (measured, `sandbox/react-p0` and `react-p1`) |
| 2 | ✅ Done — 16 topics |
| 3 | ✅ Done — 17 topics, 19 files |
| 4 | ✅ Done — 18 topics, 27 files |
| 5 | ✅ Done — 16 topics, 18 files |
| 6 | ✅ Done — 17 topics, 18 files |
| 7 | ✅ Done — 12 topics, 25 files, 7,084 lines |
| 8 | ✅ Done — 18 topics, 20 files, 4,827 lines |
| 9 | ✅ Done — 14 topics, 15 files, 3,411 lines |
| 10 | ✅ Done — 19 topics, 21 files, 4,780 lines |
| 11 | ✅ Done — 17 topics, 24 files (Part A, session `bfcb390b`) |
| 12, 13 | 🚫 **Dropped** — not written, not reopened |
| 14 | ✅ Done — 14 topics, 28 files, 4,986 lines (Part B, session `05921047`) |
| **Patterns** | ✅ **The canonical TEN, all rebuilt to depth.** 4 topics live here (03 Compound · 06 Headless · 08 State reducer · 09 Container/presentational), 6 in their phases — 07 Render props and 10 HOCs deepened **in place** in phase 2. Plus 3 supporting techniques. See [Patterns](patterns/README.md) |

Earlier owners of the whole of `docs/react/`: `33f8be33`, from `2ee7a9a3`, from `6ffd754d`.
All React work is on `main`; the old `react-phase-7` worktree was merged as `d74e74f` and
nothing is stranded.

Concepts for each finished phase are in the memory store at
`/mnt/Storage/my-learning/claude/devbible/` — see `reference_react_concepts_*`.

**Shared-checkout rules:** never `git add -A` — stage explicit paths only.
`src/data/progress.js` is edited by every session; change only your own language's rows.
:::

> **Target: React 19.2.8 / react-dom 19.2.8**, the `latest` dist-tag as of
> August 2026. Browser experiments run in **Firefox 153.0**; Node work on
> **Node 24.19.0** (Active LTS).

The explanations behind the [syllabus](../README.md) — one page per topic or
tight group, each with runnable code, gotchas written symptom → cause → fix, and
interview questions with answers.

**Every console block on every page came from a script that was actually run.**
Phases 0 and 1 are measured — their scripts live in `sandbox/react-p0/` and
`sandbox/react-p1/`, and each page names the one behind it in its `> Verified:`
line.

**From Phase 2 onward there are no sandboxes and no console blocks.** Those
pages are validated against primary documentation — react.dev, the React 19
release notes and upgrade guide, MDN — and each `> Verified:` line names the
sources instead of a script. A claim documentation cannot settle is stated as
uncertain or left out; nothing is reconstructed from memory.

## Phases

| Phase | Status | Pages |
|---|---|---|
| **[0 — How React runs](./phase-0-how-react-runs/README.md)** | ✅ **Written** | 14 pages, 17 topics |
| **[1 — JSX and what a component returns](./phase-1-jsx/README.md)** | ✅ **Written** | 15 pages, 15 topics |
| **[2 — Components, props and composition](./phase-2-components/README.md)** | ✅ **Written** | 16 pages, 16 topics |
| **[3 — State and the render cycle](./phase-3-state/README.md)** | ✅ **Written** | 17 pages, 17 topics |
| **[4 — Effects and synchronization](./phase-4-effects/README.md)** | ✅ **Written** | 18 topics, 27 files |
| **[5 — Refs, context and reducers](./phase-5-refs-context-reducers/README.md)** | ✅ **Written** | 16 topics, 18 files |
| **[6 — Rendering performance and the Compiler](./phase-6-performance/README.md)** | ✅ **Written** | 17 topics, 18 files |
| **[7 — Custom hooks and the Rules of React](./phase-7-custom-hooks/README.md)** | ✅ **Written** | 12 topics, 25 files |
| **[8 — Concurrent rendering, Suspense, transitions](./phase-8-concurrent-suspense/README.md)** | ✅ **Written** | 18 topics, 20 files |
| **[9 — Forms, Actions and optimistic UI](./phase-9-forms-actions/README.md)** | ✅ **Written** | 14 topics, 15 files |
| **[10 — Server Components and Server Functions](./phase-10-server-components/README.md)** | ✅ **Written** | 19 topics, 21 files |
| **[11 — Server rendering, hydration and the DOM APIs](./phase-11-ssr-hydration/README.md)** | ✅ **Complete** | 17 of 17 topics, 24 files |
| **[14 — Testing React](./phase-14-correctness/README.md)** | ✅ **Written** | 14 topics, 28 files |

## Progress

import Progress from '@site/src/components/Progress';

<Progress lang="react" />

## Reading order

Phases are sequential through Phase 9. Phase 0 is not optional: every "React is
weird" complaint — the state that reset, the effect that ran twice, the value
that was one update behind — traces back to it.

---

← Index: [React](../README.md) · Start → [Phase 0 — How React runs](./phase-0-how-react-runs/README.md)
