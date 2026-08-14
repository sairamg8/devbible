---
title: "Part 4 — Configuration and shipping"
sidebar_label: "4 · Configuration and shipping"
sidebar_position: 4
---

> Phases 9–10 · `main.ts`, builders, CI, publishing, and Storybook as a design system

Two phases. The first is the config surface you will edit perhaps six times a year
and need to get right each time; the second is what Storybook is *for* once more
than one person depends on it.

---

## Phase 9 — Configuration, builders and CI

Six topics.

| Topic | Tier |
|---|---|
| **`main.ts`** — `stories`, `addons`, `framework`, `staticDirs`; and the 10.x rule that **this file must be valid ESM**, so a `require()` that worked on 8.x now fails to load | <span className="db-tier t-master">Master</span> |
| **`preview.ts`** — global decorators, parameters, globals and `initialGlobals`; the file that makes every story cheap | <span className="db-tier t-understand">Understand</span> |
| `manager.ts` — branding the outer UI, and the small set of things only it can change | <span className="db-tier t-know">Know</span> |
| **Environment variables** — how they resolve differently under Vite (`import.meta.env`) and Webpack (`process.env`), why your app's `.env` is not automatically the preview's, and the `undefined` that follows | <span className="db-tier t-understand">Understand</span> |
| **`@storybook/test-runner`** — every story with a `play` function becomes a CI test, driven by a real Playwright browser; one authored artifact, not two | <span className="db-tier t-understand">Understand</span> |
| Build performance — what actually makes a Storybook slow (glob breadth, docgen, a heavy `preview.ts`), and measuring before tuning | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** `storybook build` succeeds from a clean checkout in CI,
your env vars resolve in the preview, and the test runner reports your play
functions as passes and failures.

---

## Phase 10 — Design systems and shipping

Five topics.

| Topic | Tier |
|---|---|
| Storybook as the design system hub — the shared vocabulary between design, engineering and QA, and what it replaces | <span className="db-tier t-understand">Understand</span> |
| **Composition** — one Storybook embedding another's stories via `refs`, for a design system consumed by several apps | <span className="db-tier t-know">Know</span> |
| Building and publishing a static Storybook — `storybook build`, hosting it, and previewing it per pull request | <span className="db-tier t-understand">Understand</span> |
| **Bootstrapping into an existing app** — the realistic path: which components to story first, how to avoid a six-month "we'll add stories later", and the monorepo adjustments `init` does not make | <span className="db-tier t-master">Master</span> |
| The component-driven workflow end to end — build in isolation, review the static build, assemble into the app last | <span className="db-tier t-know">Know</span> |

**Gate — the track is done when:** a teammate can open a URL, see every state of
your component, change its props, read its docs, and see it pass its own
interaction and accessibility checks — without cloning your branch.

---

## Deliberately not here

| Left out | Why |
|---|---|
| Hosting-provider specifics (Vercel / Netlify / S3 config) | A static directory is a static directory; the deployment track owns the rest |
| Addon authoring and the manager API surface | Maintainer skill, not product-team skill |
| Storybook MCP (10.3) beyond naming it | Too new to write load-bearing guidance on; flagged in the overview, revisit when it settles |

---

## Where this connects

| Track | Relationship |
|---|---|
| **React** | Stories are components; Phase 3's decorators are the provider tree from React's context phase |
| **Jest & RTL** | Same queries, same `userEvent`. RTL is jsdom and cheap; Part 3 here is a real browser |
| **Playwright** | The test runner drives Playwright under the hood; the Playwright track owns end-to-end as a layer |
| **Vite** / **Webpack** | Whichever builds your app builds your Storybook, and decides how aliases and env vars resolve |
| **CSS** | Phase 5 delivers the tokens that the CSS track's custom-properties and theming phases define |
| **TypeScript** | Docgen reads your prop types; a badly-shaped type produces a badly-shaped prop table |

---

**← Prev** [Part 3 — Testing with Storybook](03-testing-with-storybook.md)
