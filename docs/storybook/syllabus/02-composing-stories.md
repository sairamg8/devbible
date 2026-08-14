---
title: "Part 2 — Composing stories"
sidebar_label: "2 · Composing stories"
sidebar_position: 2
---

> Phases 3–5 · Decorators, documentation, and making Storybook look like your app

A story renders one component. Real components are never alone — they need a
router, a theme, a query client, a store, a font. **Everything in this part is
about supplying what the component cannot supply itself**, and doing it once
rather than in forty story files.

---

## Phase 3 — Decorators and context

Five topics. This is the phase that decides whether adding a story is cheap or
expensive for the rest of the project's life.

| Topic | Tier |
|---|---|
| **What a decorator is** — a function that wraps a story in more markup; the same idea as a provider tree, scoped to the workshop | <span className="db-tier t-master">Master</span> |
| The three levels and their order — story → component → global, applied **inside-out**, and how to reason about a double-wrapped story | <span className="db-tier t-understand">Understand</span> |
| **Providers in decorators** — router, theme, i18n, Redux store, TanStack Query client; the one-time setup in `preview.ts` that makes every future story a two-line file | <span className="db-tier t-master">Master</span> |
| The story context — `args`, `parameters`, `globals` and `id` as the second decorator argument, and using it to branch on a toolbar global | <span className="db-tier t-understand">Understand</span> |
| `loaders` and `beforeEach` — async setup before render, and why a decorator is the wrong place for a `fetch` | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** a new story for a component that needs the router, the
theme *and* the query client is a file with no providers in it.

---

## Phase 4 — Documentation

Storybook's docs are generated from the same stories you already wrote. Five
topics.

| Topic | Tier |
|---|---|
| **Autodocs** — what `tags: ['autodocs']` generates, and the two sources it pulls from (the component's types, and your stories) | <span className="db-tier t-master">Master</span> |
| Doc blocks — `Meta`, `Story`, `Canvas`, `Controls`, `ArgTypes`, `Source`; note the import moved to **`@storybook/addon-docs/blocks`** | <span className="db-tier t-understand">Understand</span> |
| MDX pages — prose and live stories in one file, and when a hand-written page beats autodocs | <span className="db-tier t-understand">Understand</span> |
| **Docgen and the missing prop description** — how props are extracted from TypeScript, and the four reasons a prop shows up with no docs (re-exported type, intersection, generic, `React.ComponentProps` spread) | <span className="db-tier t-understand">Understand</span> |
| Writing docs a designer will actually read — usage/don't-use pairs over prop tables | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain why one prop in your table has a
description and the one next to it does not.

---

## Phase 5 — Theming, colors and fonts

Six topics, and the first one is the confusion that costs people the most time.

| Topic | Tier |
|---|---|
| 🔴 **Two different things are called "theme"** — your **app's** design tokens (inside the preview iframe) and **Storybook's own UI** chrome (the manager). They are configured in different files and never share a variable | <span className="db-tier t-master">Master</span> |
| Theming the manager — `storybook/theming` (**not** `@storybook/theming`), `manager.ts`, brand title and logo | <span className="db-tier t-understand">Understand</span> |
| **Getting your design tokens into every story** — importing the global stylesheet in `preview.ts` vs a decorator vs `preview-head.html`, and what each does to hot reload | <span className="db-tier t-understand">Understand</span> |
| **A working theme switcher** — a toolbar global plus one global decorator, so every story can be viewed light and dark without a per-story prop | <span className="db-tier t-understand">Understand</span> |
| **Custom fonts** — self-hosted vs CDN, `staticDirs`, `preview-head.html`, and why the font loads in your app but not in the iframe | <span className="db-tier t-understand">Understand</span> |
| Dark mode across both processes — matching the manager to the preview so the chrome does not fight the component | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can toggle your app's theme from the Storybook
toolbar, your fonts render in the preview, and you can say which config file owns
each half.

---

## Deliberately not here

| Left out | Why |
|---|---|
| Designing a token system | That is the CSS track's custom-properties and color-theming phases; here we only *deliver* the tokens |
| Figma / design-tool sync addons | Vendor-specific and changes fast |
| Storybook's own MDX v2 → v3 internals | You consume MDX here, you do not configure its compiler |

---

**← Prev** [Part 1 — How Storybook runs](01-how-storybook-runs.md) ·
**Next →** [Part 3 — Testing with Storybook](03-testing-with-storybook.md)
