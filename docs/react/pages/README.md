---
title: "React — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8 / react-dom 19.2.8**, the `latest` dist-tag as of
> August 2026. Browser experiments run in **Firefox 153.0**; Node work on
> **Node 24.19.0** (Active LTS).

The explanations behind the [syllabus](../README.md) — one page per topic or
tight group, each with runnable code, gotchas written symptom → cause → fix, and
interview questions with answers.

**Every console block on every page came from a script that was actually run.**
The scripts live in `sandbox/react-p0/` and each page names the one behind it in
its `> Verified:` line.

## Phases

| Phase | Status | Pages |
|---|---|---|
| **[0 — How React runs](./phase-0-how-react-runs/README.md)** | ✅ **Written** | 14 pages, 17 topics |
| 1 — JSX and what a component returns | Not started | — |
| 2 — Components, props and composition | Not started | — |
| 3 — State and the render cycle | Not started | — |
| 4 — Effects and synchronization | Not started | — |
| 5 — Refs, context and reducers | Not started | — |
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
