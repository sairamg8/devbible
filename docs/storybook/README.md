---
title: "Storybook — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against the [npm registry](https://registry.npmjs.org/storybook/latest)
> (`storybook@10.5.8`), the [Storybook 10 release notes](https://storybook.js.org/releases/10.0),
> the [10.3 release post](https://storybook.js.org/blog/storybook-10-3/) and the
> [9.0 addon migration guide](https://storybook.js.org/docs/9/addons/addon-migration-guide).
> **No sandbox run** — this is an inventory, not an explanation.

The topic inventory for Storybook, scoped to **what a fullstack MERN/PERN
developer actually needs**. 11 phases, 58 topics, split into 4 parts.

Storybook is the first technology in this bible that is neither a language nor a
runtime — it is a **workshop**. You render one component, in isolation, in every
state it can reach, without booting the app or clicking three screens deep to get
there. Everything else it does — the docs site, the interaction tests, the
accessibility audit, the visual diffs — is a consequence of already having every
state addressable by URL.

## Why it earns a track here

The React track teaches you to build a component. It does not teach you where the
component's states live once there are forty of them. Three problems appear at
that point, and Storybook is the mainstream answer to all three at once:

| Problem | Without Storybook | What Storybook does |
|---|---|---|
| **The empty/loading/error state is unreachable** | You comment out the fetch, or throw in a `throw new Error` and remember to remove it | Each state is a named export you can link to |
| **The design review needs a running app** | Deploy a branch, or screen-share | A static build anyone can open |
| **A test and a demo are written twice** | An RTL file and a demo page drift apart | The `play` function *is* the test |

Cross-track: this syllabus assumes the React track's component model, and defers
component **unit** testing to the Jest & RTL track. Where the two overlap —
`userEvent`, queries by role — Storybook wins for anything that needs a real
browser, and RTL wins for anything that does not need rendering at all.

## Version facts

| | |
|---|---|
| Latest on npm | **`storybook@10.5.8`** (checked 2026-08-14) |
| Storybook 10 shipped | **October 2025** — the headline change is **ESM-only** |
| Node required | **20.19+ or 22.12+** |
| `.storybook/main.ts` | must be **valid ESM** — a `require()` in a config that worked on 8.x will not load |
| 10.3 (April 2026) | Storybook MCP for React, an accessibility overhaul, CLI rework, CSF factories extended to Vue / Angular / Web Components |
| 10.4 | first-class TanStack React support, change-scoped sidebar, experimental React Component Meta |

### 🔴 The package consolidation — read this before copying any older example

Storybook **9.0 folded most `@storybook/*` packages into the single `storybook`
package**, and deleted others outright. Almost every tutorial and answer written
before mid-2025 imports from paths that no longer exist. The mapping, from the
official addon migration guide:

| Pre-9.0 package | 10.x path |
|---|---|
| `@storybook/test` | **`storybook/test`** |
| `@storybook/addon-actions` | **`storybook/actions`** |
| `@storybook/theming` | **`storybook/theming`** |
| `@storybook/manager-api` | **`storybook/manager-api`** |
| `@storybook/preview-api` | **`storybook/preview-api`** |
| `@storybook/addon-viewport` | **`storybook/viewport`** |
| `@storybook/addon-highlight` | **`storybook/highlight`** |
| `@storybook/addon-essentials` | **deleted** — its features are core, install nothing |
| `@storybook/addon-interactions` | **deleted** — folded into core |
| `@storybook/addon-controls` · `-backgrounds` · `-measure` · `-outline` · `-toolbars` | **deleted** — all core |
| `@storybook/blocks` | **`@storybook/addon-docs/blocks`** |

`@storybook/react`, `@storybook/react-vite`, `@storybook/addon-a11y`,
`@storybook/addon-docs` and `@storybook/test-runner` are still their own
packages. Phase 0 topic 06 covers this in full, because it is the single most
common reason a copied snippet fails to resolve.

## Parts

| # | Part | Covers | Phases |
|---|---|---|---|
| 1 | **[How Storybook runs](syllabus/01-how-storybook-runs.md)** | The two processes, CSF, args and controls | 0–2 |
| 2 | **[Composing stories](syllabus/02-composing-stories.md)** | Decorators, docs, theming and fonts | 3–5 |
| 3 | **[Testing with Storybook](syllabus/03-testing-with-storybook.md)** | Play functions, accessibility, visual regression | 6–8 |
| 4 | **[Configuration and shipping](syllabus/04-configuration-and-shipping.md)** | `main.ts`, builders, CI, publishing, design systems | 9–10 |

## Explanations

Not written yet. When they are, they will live in
**[Explanations](pages/README.md)** — one page per topic, with runnable code,
gotchas and interview questions.

## Tier legend

| Badge | Meaning |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; look up signatures freely |
| <span className="db-tier t-know">Know</span> | Know what/why/when; details on demand |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 15 | 26% |
| <span className="db-tier t-understand">Understand</span> | 34 | 59% |
| <span className="db-tier t-know">Know</span> | 9 | 15% |
| **Total** | **58** | |

No <span className="db-tier t-when">When Needed</span> tier here — the scope was
cut to the critical path instead. Storybook's Angular / Svelte / Web Components
renderers, addon **authoring**, the Vue-specific docgen, and Chromatic's
enterprise workflow features are all real and all **out of brief**; each part
lists what it deliberately leaves out.

## Prerequisites

**React through Phase 6 (performance).** Stories are components, decorators are
components wrapping components, and the args machine only makes sense once props
and re-render behaviour do. Phase 5 (theming) additionally assumes the CSS track's
custom-properties phase.

Part 3 pairs with the **Jest & RTL** track — it uses the same queries and the same
`userEvent`, in a real browser rather than jsdom.

## Reading order

Parts 1 and 2 are sequential. Everything in Storybook is "a story plus something
wrapped around it", so the story format and the args machine are load-bearing for
every later part.

Part 3 can be read the day you have stories worth protecting, and Part 4 the day
you need it in CI — but **read Phase 0 topic 06 first, whatever you skip.** Half
the Storybook material on the web predates the 9.0 consolidation, and you will
lose an afternoon to an import path before you realise the package was deleted.

## Sources

- [Storybook documentation](https://storybook.js.org/docs) · [Releases](https://storybook.js.org/releases)
- [Migration guide for Storybook 10](https://storybook.js.org/docs/releases/migration-guide) · [8.x → 9.1 migration](https://storybook.js.org/docs/releases/migration-guide-from-older-version)
- [Addon migration guide 9.0](https://storybook.js.org/docs/9/addons/addon-migration-guide) — the package consolidation table
- [Storybook 10.3](https://storybook.js.org/blog/storybook-10-3/) · [npm `storybook`](https://www.npmjs.com/package/storybook)
