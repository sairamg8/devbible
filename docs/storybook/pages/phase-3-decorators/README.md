---
title: "Phase 3 — Decorators and context"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against the [decorators](https://storybook.js.org/docs/writing-stories/decorators)
> and [loaders](https://storybook.js.org/docs/writing-stories/loaders/) documentation, and
> [`storybook@10.5.8`](https://registry.npmjs.org/storybook/latest).
> **No sandbox run** — no page in this phase carries a console block.

**5 topics · 5 pages.** This phase decides whether adding a story costs two lines
or twenty, for the rest of the project's life.

Isolation is Storybook's point — but a component that legitimately needs a theme,
a router or a store still needs them. Everything here is about **supplying what a
component cannot supply itself, once, somewhere else.**

| # | Page | Tier | One line |
|---|---|---|---|
| 01 | [What a decorator is](./01-what-a-decorator-is.md) | <span className="db-tier t-master">Master</span> | `(Story, context) => ReactNode`; use the **narrowest** level, because a crash is information |
| 02 | [Decorator order](./02-decorator-order.md) | <span className="db-tier t-understand">Understand</span> | Global outermost → story innermost; **array order is not documented — don't depend on it** |
| 03 | [Providers in decorators](./03-providers-in-decorators.md) | <span className="db-tier t-master">Master</span> | Fresh instances **per render**; configure for isolation, not production |
| 04 | [The story context](./04-the-story-context.md) | <span className="db-tier t-understand">Understand</span> | Read `globals` and `parameters`; reading `args` couples the wrapper to one component |
| 05 | [Loaders and `beforeEach`](./05-loaders-and-beforeeach.md) | <span className="db-tier t-know">Know</span> | Markup vs data vs environment — three tools, and `beforeEach` is the one with cleanup |

## The three tools

| Need | Tool | Has cleanup? |
|---|---|---|
| wrap the story in markup or a provider | **decorator** | no — needs a wrapper component + `useEffect` |
| async data before render | **loader** | no |
| set up and tear down environment state | **`beforeEach`** | **yes** |

Choosing wrong is behind most of this phase's gotchas. A mocked clock in a
decorator leaks; in `beforeEach` it does not.

## The two rules worth memorising

**1. Fresh instances per render.** A `QueryClient` or store built at module scope
is shared by every story, so state leaks between them. The result is
order-dependent behaviour that no URL reproduces, and test-runner failures that do
not reproduce locally. Build them **inside** the decorator.

**2. The narrowest level that works.** A `Provider` applied globally when only six
of ninety components are connected removes a signal you want: a component that
quietly starts reading from the store *should* crash in isolation. Global
decorators mirror your app's real root and stop there.

## 🔴 One thing the documentation does not settle

The hierarchy is documented — **global outermost, then component, then story
innermost**, so a story-level provider beats a global one by ordinary React
nearest-provider resolution.

**Within a single `decorators` array, whether the first element is the innermost or
outermost wrapper is not stated in the documentation, and this bible does not
assert it.** The practical rule that avoids the question entirely:

> Independent decorators may share an array. **Dependent ones go in one decorator
> with the nesting written out in JSX.**

That also documents the dependency for the next reader, which the array form never
does.

## Where this connects

| Track | Relationship |
|---|---|
| **React** | A decorator *is* the provider tree from React's context phase, lifted out of the app |
| **TanStack Query** | Topic 03 — `retry: false`, `gcTime: 0`, and a fresh client per story |
| **Redux Toolkit** | Topic 03 — a scoped `Provider` with `preloadedState` driven by a parameter |
| **CSS** | Topic 03's global stylesheet import is why components look right at all |

## Phase gate

Move on when you can:

- add Storybook to an app with a router, a store and a theme provider, and have a
  connected component's story file contain **no providers at all**;
- say why the store must be constructed inside the decorator rather than beside it;
- parameterise one global decorator so stories vary it with `parameters` instead of
  writing their own decorators;
- pick correctly between a decorator, a loader and `beforeEach` for a given need.

---

**Start →** [01 · What a decorator is](./01-what-a-decorator-is.md) ·
**← Prev phase** [Phase 2 · Args, argTypes and controls](../phase-2-args-and-controls/README.md)
