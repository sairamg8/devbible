---
title: "Phase 0 — How Storybook runs"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against the [Storybook documentation](https://storybook.js.org/docs),
> the [9.0 addon migration guide](https://storybook.js.org/docs/9/addons/addon-migration-guide),
> the [10 migration guide](https://storybook.js.org/docs/releases/migration-guide) and
> [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest) on npm.
> **No sandbox run** — no page in this phase carries a console block.

**6 syllabus topics · 5 pages.** The mental model: what Storybook is for, the two
documents it runs in, what actually renders your component, how it gets into an
existing app, and which half of the internet's Storybook advice is now wrong.

Nothing here is about writing stories. That is
[Phase 1](../../syllabus/01-how-storybook-runs.md).

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [What Storybook is](./01-what-storybook-is.md) | <span className="db-tier t-master">Master</span> | States are *declared*, not reproduced — so they become addressable, reviewable and testable |
| 02 | [The manager and the preview](./02-manager-and-preview.md) | <span className="db-tier t-understand">Understand</span> | Two documents, two config files; `iframe.html` is the debugging escape hatch |
| 03 | [The renderer architecture](./03-renderers-and-builders.md) | <span className="db-tier t-know">Know</span> | Core / renderer / builder — and why the builder must match your app's |
| 04 | [Installing into an existing app](./04-installing-into-an-existing-app.md) | <span className="db-tier t-master">Master</span> | `init` is a third of the job; the provider tree and the aliases are the rest |
| 05 | [Storybook 10 and the package consolidation](./05-storybook-10-and-package-consolidation.md) | <span className="db-tier t-master">Master</span> | `@storybook/test` → `storybook/test`, and the addons that were deleted, not moved |

## Coverage

This phase merges two syllabus rows into one page, because the renderer and the
builder are only meaningful against each other — the whole point of the
architecture is that the two are chosen independently, which cannot be explained
one at a time.

| Syllabus topic | Page |
|---|---|
| What Storybook is | 01 |
| Two processes, not one | 02 |
| The renderer architecture | **03** |
| Builders — Vite vs Webpack 5 | **03** |
| `storybook init` into an existing app | 04 |
| Storybook 10 and the 9.0 package consolidation | 05 |

## The five things this phase exists to prevent

1. **"Storybook doesn't work with our stack."** It does. `init` simply knows
   nothing about your providers or your aliases, and both are manual (04).
2. **"It looks wrong but there's no error."** Your app's global stylesheet is
   imported by the app's entry file, which Storybook never runs (02, 04).
3. **"Cannot find module `@storybook/addon-essentials`."** It was deleted, not
   moved. There is no replacement because the features are core (05).
4. **"One story changed what another story renders."** A store or `QueryClient`
   built at module scope is shared by every story (04).
5. **"`$0` is undefined."** Your console is attached to the manager; your element
   is in the preview iframe (02).

## Where this connects

| Track | Relationship |
|---|---|
| **React** | Stories are components; page 04's decorators are the provider tree from React's context phase |
| **Vite** / **Webpack** | Page 03 — whichever builds your app should build your Storybook, and it decides how aliases and env vars resolve |
| **CSS** | The "unstyled in Storybook" failure is a delivery problem, not a CSS one |
| **Jest & RTL** | Page 01's comparison table — same queries, jsdom instead of a real browser |

## Phase gate

Move on when you can:

- say which of the two documents a given error came from, and open a story
  directly at `iframe.html?id=…`;
- add Storybook to an app with a router, a store and a theme provider, and have a
  connected component's story render with **no providers in the story file**;
- look at any Storybook snippet dated before 2025 and name every import in it that
  will fail on 10.x.

---

**Start →** [01 · What Storybook is](./01-what-storybook-is.md)
