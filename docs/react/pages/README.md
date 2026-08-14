---
title: "React — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

:::caution 🔒 CLAIMED — React is being actively written by another session

**Owner:** session `6ffd754d` · **Since:** 2026-08-14 · **Scope:** the whole of
`docs/react/`, straight through to Phase 14.

| Phase | State |
|---|---|
| 0, 1 | ✅ Done (measured, `sandbox/react-p0` and `react-p1`) |
| 2 | ✅ Done — 16 topics |
| 3 | ✅ Done — 17 topics, 19 files |
| 4 | ✅ **Done — 18 topics, 27 files, 0 broken links, 0 over cap** |
| 5 | 🔴 **In progress** — Refs, context and reducers (16 topics) |
| 6–14 | ⬜ Claimed by this session |

**If you are a different session, do not write React pages.** Pick something with
no owner — **MongoDB now has a complete 204-topic syllabus and zero pages**, and
Docker, Redis and Nginx have neither. See the claims table in
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
| **[5 — Refs, context and reducers](./phase-5-refs-context-reducers/README.md)** | 🚧 **Writing** | 4 of 16 topics, 6 files |
| 6 — Rendering performance and the Compiler | Not started | — |
| 7 — Custom hooks and the Rules of React | Not started | — |
| 8 — Concurrent rendering, Suspense, transitions | Not started | — |
| 9 — Forms, Actions and optimistic UI | Not started | — |
| 10 — Server Components and Server Functions | Not started | — |
| 11 — Server rendering, hydration and the DOM APIs | Not started | — |
| 12 — Data and state in a real app | Not started | — |
| 13 — Routing, structure and the app shell | Not started | — |
| 14 — Correctness, testing and delivery | Not started | — |

## Progress

import Progress from '@site/src/components/Progress';

<Progress lang="react" />

## Reading order

Phases are sequential through Phase 7. Phase 0 is not optional: every "React is
weird" complaint — the state that reset, the effect that ran twice, the value
that was one update behind — traces back to it.

---

← Index: [React](../README.md) · Start → [Phase 0 — How React runs](./phase-0-how-react-runs/README.md)
