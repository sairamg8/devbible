---
title: "React — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

:::caution 🔒 CLAIMED — React is being actively written by another session

**The remaining React work is SPLIT ACROSS TWO SESSIONS.** Their page directories
are disjoint; neither writes in the other's.

| Part | Scope | Owner | Since |
|---|---|---|---|
| **A** | **Phase 11 topics 08–17 + the phase close** — `phase-11-ssr-hydration/` | session `bfcb390b` | 2026-08-14 |
| **B** | **Phase 14 · Testing React** — `phase-14-correctness/`, 14 topics | session `05921047` | 2026-08-14 |

Previous owner of the whole of `docs/react/`: session `33f8be33`, itself taken
over from `2ee7a9a3` (from `6ffd754d`).

**All React work is now on `main` in this checkout.** The old worktree
`/mnt/Storage/Backup/Knowledge/devbible-react` (branch `react-phase-7`) was
**merged into `main`** as `d74e74f`; nothing React is stranded on a branch.

| Phase | State |
|---|---|
| 0, 1 | ✅ Done (measured, `sandbox/react-p0` and `react-p1`) |
| 2 | ✅ Done — 16 topics |
| 3 | ✅ Done — 17 topics, 19 files |
| 4 | ✅ Done — 18 topics, 27 files |
| 5 | ✅ Done — 16 topics, 18 files |
| 6 | ✅ **Done — 17 topics, 18 files, 0 broken links, 0 over cap** |
| 7 | ✅ **Done — 12 topics, 25 files, 7,084 lines, 0 over cap, build-verified** |
| 8 | ✅ **Done — 18 topics, 20 files, 4,827 lines, 0 over cap** |
| 9 | ✅ **Done — 14 topics, 15 files, 3,411 lines, 0 over cap** |
| 10 | ✅ **Done — 19 topics, 21 files, 4,780 lines, 0 over cap** |
| 11 | 🚧 **In progress — 10 of 17 topics, 15 files** (Part A) |
| 14 | 🚧 **Part B — in progress, 12 of 14 topics, 28 files** (session `05921047`, worktree `devbible-react-p14`, branch `react-phase-14`) |

**If you are a different session, do not write React pages.** Pick something with
no owner — **TypeScript, Git and MongoDB are all idle**, and Docker & Podman and
Nginx have no syllabus at all. See the claims table in
[`docs/README.md`](../../README.md).

Concepts for each finished phase are in the memory store at
`/mnt/Storage/my-learning/claude/devbible/` — see `reference_react_concepts_*`.

**Shared-checkout rules:** never `git add -A` — stage explicit paths only.
`src/data/progress.js` is edited by every session; change only your own
language's rows.

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
| **[11 — Server rendering, hydration and the DOM APIs](./phase-11-ssr-hydration/README.md)** | 🚧 **Writing** | 10 of 17 topics, 15 files |
| **[14 — Testing React](./phase-14-correctness/README.md)** | 🚧 **Writing** | 12 of 14 topics, 28 files |

## Progress

import Progress from '@site/src/components/Progress';

<Progress lang="react" />

## Reading order

Phases are sequential through Phase 9. Phase 0 is not optional: every "React is
weird" complaint — the state that reset, the effect that ran twice, the value
that was one update behind — traces back to it.

---

← Index: [React](../README.md) · Start → [Phase 0 — How React runs](./phase-0-how-react-runs/README.md)
