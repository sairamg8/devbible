---
title: "CSS — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08 in **Firefox 153.0.3**, with feature-availability data from
> **`web-features` 3.34.3**.

The explanation pages for the [CSS syllabus](../README.md) — one page per topic,
each with runnable code, real measured output, gotchas written as
symptom → cause → fix, and interview questions with answers.

## Progress

import Progress from '@site/src/components/Progress';

<Progress lang="css" />

## Phases

| Phase | Topics | State |
|---|---|---|
| [0 · How CSS runs](./phase-0-how-css-runs/README.md) | 12 | ✅ written |
| [1 · Selectors](./phase-1-selectors/README.md) | 16 | ✅ written |
| [2 · Cascade control](./phase-2-cascade/README.md) | 4 | ✅ written |
| [3 · Custom properties and modern values](./phase-3-custom-properties/README.md) | 4 | ✅ written |
| [4 · **Flexbox, deeply**](./phase-4-flexbox/README.md) | 7 | ✅ written |
| [5 · **Grid, deeply**](./phase-5-grid/README.md) | 10 | ✅ written |
| [6 · Container queries](./phase-6-container-queries/README.md) | 3 | ✅ written |
| [7 · Positioning, stacking and overlay](./phase-7-positioning/README.md) | 4 | ✅ written |
| [8 · Colour and theming](./phase-8-color-theming/README.md) | 3 | ✅ written |
| [9 · Motion and the cost model](./phase-9-motion/README.md) | 3 | ✅ written |
| [10 · **SCSS, practically**](./phase-10-scss/README.md) | 8 | ✅ written |

**✅ ALL 74 topics written** (81 pages — deep topics are chunked). Every phase is
complete.

**Scope:** the critical path only. Basic syntax, the box model, typography,
print and form-control styling are assumed, not taught — and CSS *architecture*
(design tokens, CSS Modules, Tailwind, CSS-in-JS) was cut on the user's
instruction, leaving SCSS as a practical usage phase. See the
[syllabus overview](../README.md).

## How these pages are verified

Every number, computed value and console block comes from a script in
`sandbox/css/`, run against a real render — never from recollection. The
harness drives the system Firefox over WebDriver BiDi, so `getComputedStyle`,
`getBoundingClientRect()` and `CSS.supports()` results are what the engine
actually produced.

**Two sources, deliberately kept apart:**

| Question | Source |
|---|---|
| *What does this do?* | measured in Firefox 153.0.3, and labelled with the engine |
| *Is it safe to ship?* | `web-features` Baseline data, covering all core browsers |

Only Firefox is installed on this machine, so no page claims a cross-engine
result from a local measurement. Where a topic's whole point is an engine
difference, the page says it could not be verified here rather than inventing
the other engine's answer.

---

Start → [Phase 0 · How CSS runs](./phase-0-how-css-runs/README.md)
