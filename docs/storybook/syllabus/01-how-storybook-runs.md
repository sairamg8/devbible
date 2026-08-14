---
title: "Part 1 — How Storybook runs"
sidebar_label: "1 · How Storybook runs"
sidebar_position: 1
---

> Phases 0–2 · The two processes, the story format, and the args machine

Storybook looks like a documentation site and is actually a **second build of your
application** with a different entry point. Almost every confusing failure —
a style that only breaks in Storybook, an env var that reads as `undefined`, a
decorator that runs twice — comes from not knowing which of its two processes you
are looking at.

---

## Phase 0 — What Storybook is and how it runs

The mental model. Six topics, and the last one will save you an afternoon.

| Topic | Tier |
|---|---|
| **What Storybook is**: an isolated component workshop — every state of every component addressable by URL, without booting the app | <span className="db-tier t-master">Master</span> |
| **Two processes, not one** — the **manager** (the outer UI: sidebar, toolbar, panels) and the **preview iframe** (your component, your app's CSS); which one an error belongs to | <span className="db-tier t-understand">Understand</span> |
| The renderer architecture — one core, swappable renderers for React, Vue, Svelte, Angular and Web Components, and why the story format is identical across them | <span className="db-tier t-know">Know</span> |
| **Builders** — Vite (`@storybook/react-vite`) vs Webpack 5 (`@storybook/react-webpack5`); you get whichever your app already uses, and it decides how your aliases and env vars resolve | <span className="db-tier t-understand">Understand</span> |
| **`storybook init` into an existing app** — what it detects, the files it writes, and the three things it gets wrong in a monorepo | <span className="db-tier t-master">Master</span> |
| 🔴 **Storybook 10 and the 9.0 package consolidation** — ESM-only config, Node 20.19+/22.12+, and the `@storybook/*` → `storybook/*` map; `addon-essentials` and `addon-interactions` **no longer exist** | <span className="db-tier t-master">Master</span> |

**Gate — move on when:** you can say which process a given error came from, and
you can look at any pre-2025 Storybook snippet and name every import in it that
will fail to resolve on 10.x.

---

## Phase 1 — The story format

CSF is the whole API surface. Six topics.

| Topic | Tier |
|---|---|
| **Component Story Format (CSF)** — the default export is *metadata about a component*, every named export is *one state of it*; why this is a module and not a config file | <span className="db-tier t-master">Master</span> |
| **File structure and colocation** — `Button.stories.tsx` beside `Button.tsx`, what the `stories` glob in `main.ts` actually matches, and why a story file outside the glob silently does not exist | <span className="db-tier t-master">Master</span> |
| Typing stories — `Meta<typeof Component>` and `StoryObj<typeof meta>`, and what `satisfies` buys you over a plain annotation | <span className="db-tier t-understand">Understand</span> |
| **CSF factories** — `defineMeta`, the typed alternative introduced in the 9.x/10.x line and extended to Vue, Angular and Web Components in 10.3; when it is worth adopting mid-project | <span className="db-tier t-understand">Understand</span> |
| Naming, `title` and the sidebar hierarchy — slash-separated paths, `tags`, and `storySort` for an order that is not alphabetical | <span className="db-tier t-understand">Understand</span> |
| Reusing stories — composing one story's args into another, and importing a story into a test | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can write a story file from memory, with types, and
explain why a new `.stories.tsx` did not appear in the sidebar.

---

## Phase 2 — Args, argTypes and controls

The args machine is what makes a story *interactive* rather than a static render.
Six topics.

| Topic | Tier |
|---|---|
| **Args are the single source of truth** — a story's inputs as data, not JSX; why `args` beats hardcoding props in `render` | <span className="db-tier t-master">Master</span> |
| **`argTypes`** — control types, options, ranges, and the three cases where inference is not enough (unions, callbacks, anything from a `.d.ts`) | <span className="db-tier t-understand">Understand</span> |
| Controls in the UI — the panel that was an addon and is now core; `control: false`, `table.disable`, and hiding noise from a design reviewer | <span className="db-tier t-understand">Understand</span> |
| **Actions** — logging callbacks in the Actions panel via the `argTypesRegex` / `on*` convention, and **`fn()` from `storybook/test`** for a spy you can assert on later | <span className="db-tier t-master">Master</span> |
| Globals and toolbars — a theme or locale switcher that applies to *every* story, and where its state lives | <span className="db-tier t-understand">Understand</span> |
| **Parameters** — the merge order (global → component → story) that explains why your override "did not apply" | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can build a story whose every prop is editable in the
Controls panel, whose callbacks log to Actions, and you can predict which of three
conflicting `parameters` blocks wins.

---

## Deliberately not here

| Left out | Why |
|---|---|
| Angular, Svelte and Web Components renderers | The bible's stack is React; the story format is identical, the setup is not |
| Addon **authoring** | A Storybook-maintainer skill, not a product-team one |
| `@storybook/builder-webpack5` tuning | The Webpack track covers the loader/plugin model; here it is only "which builder am I on" |

---

**Next →** [Part 2 — Composing stories](02-composing-stories.md)
