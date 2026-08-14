---
title: "Storybook — Explanations"
sidebar_label: "Explanations"
sidebar_position: 0
---

> Verified: 2026-08-14 against the [npm registry](https://registry.npmjs.org/storybook/latest)
> (`storybook@10.5.8`) and the [Storybook 9.0 addon migration guide](https://storybook.js.org/docs/9/addons/addon-migration-guide).
> **No sandbox run.**

One page per topic, with runnable code, gotchas and interview questions. The
inventory and the reading order live in the [Syllabus](../README.md).

## Status

🚧 **23 of 58 topics — Phases 0–3 complete.** Pages follow phase by phase.

| Phase | Part | Topics | Status |
|---|---|---|---|
| [0 · How Storybook runs](./phase-0-how-storybook-runs/README.md) | 1 | 6 | ✅ **Complete** — 5 pages, 1,175 lines |
| [1 · The story format](./phase-1-story-format/README.md) | 1 | 6 | ✅ **Complete** — 6 pages, 1,352 lines |
| [2 · Args, argTypes and controls](./phase-2-args-and-controls/README.md) | 1 | 6 | ✅ **Complete** — 6 pages, 1,234 lines |
| [3 · Decorators and context](./phase-3-decorators/README.md) | 2 | 5 | ✅ **Complete** — 5 pages, 1,095 lines |
| 4 · Documentation | 2 | 5 | 🚧 Not started |
| 5 · Theming, colors and fonts | 2 | 6 | 🚧 Not started |
| 6 · Interaction testing | 3 | 5 | 🚧 Not started |
| 7 · Accessibility testing | 3 | 4 | 🚧 Not started |
| 8 · Visual regression testing | 3 | 4 | 🚧 Not started |
| 9 · Configuration, builders and CI | 4 | 6 | 🚧 Not started |
| 10 · Design systems and shipping | 4 | 5 | 🚧 Not started |
| **Total** | | **58** | |

import Progress from '@site/src/components/Progress';

<Progress lang="storybook" compact />

## 🔴 A note on where this track's raw material comes from

This track is being **imported and rewritten** from a separate corpus (the
`frontend-bible` repo), not written from scratch. That corpus has genuinely dense
mechanics sections, and they are being kept — but it was authored against
**Storybook 8/9**, and **12 of its 22 source files import packages that no longer
exist in 10.x**.

Nothing lands on a page here until its API surface has been re-checked against the
current documentation. Concretely, every one of these has to be corrected on the
way in:

| Appears in the source | Correct on 10.x |
|---|---|
| `@storybook/test` | `storybook/test` |
| `@storybook/addon-actions` | `storybook/actions` |
| `@storybook/theming` · `@storybook/manager-api` | `storybook/theming` · `storybook/manager-api` |
| `@storybook/addon-essentials` | **deleted** — features are core |
| `@storybook/addon-interactions` | **deleted** — folded into core |
| `@storybook/blocks` | `@storybook/addon-docs/blocks` |

The imported prose also predates **CSF factories** entirely, so Phase 1 topic 04
is net-new writing rather than a rewrite.

## Rules these pages follow

- Every page carries a **tier badge** and a **`> Verified:`** line naming the
  documentation it was checked against and the date.
- **No invented output.** There is no Storybook sandbox in this repo and none will
  be built, so a page with no real run carries **no console block** — the
  explanation is written without it.
- **300 lines per file, hard.** A topic needing more becomes a `NN-topic/`
  directory with its own `README.md` index and `NN-chunk.md` parts, each repeating
  the tier badge and `> Verified:` line and carrying its own Gotchas and Interview
  sections.
- Gotchas are written **symptom → cause → fix**, leading with the symptom.
- 3–8 interview questions per topic, **with answers**, `★` on the frequently-asked.

## Prerequisites

**React through Phase 6.** See the [syllabus overview](../README.md#prerequisites)
for the full gate, and for what this track deliberately leaves out.
