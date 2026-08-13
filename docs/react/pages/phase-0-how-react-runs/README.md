---
title: "Phase 0 — How React runs"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8 and react-dom 19.2.8 — the `latest` dist-tag as of
> August 2026.** Every console block on these pages was produced by a script in
> `sandbox/react-p0/`, run on **Node 24.19.0** with browser experiments in
> **Firefox 153.0**. Nothing is written from memory.

The mental model everything else hangs off. Nothing here is a hook and nothing
here is JSX — this is the machine underneath both.

The load-bearing pages are **01**, **03**, **04** and **07**. If you read only
four, read those; the rest are context you will want when something breaks.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[What React is](01-what-react-is.md)** | <span className="db-tier t-master">Master</span> | React computes a description of the UI; a renderer makes it real |
| 02 | **[The element](02-the-element.md)** | <span className="db-tier t-understand">Understand</span> | A frozen plain object. Creating one runs nothing |
| 03 | **[Render, reconcile, commit](03-render-reconcile-commit.md)** | <span className="db-tier t-master">Master</span> | Render can be repeated or thrown away; commit cannot |
| 04 | **[Reconciliation](04-reconciliation.md)** | <span className="db-tier t-master">Master</span> | Type and position decide which components keep their state |
| 05 | **[Fiber](05-fiber.md)** | <span className="db-tier t-understand">Understand</span> | The linked structure that made rendering interruptible |
| 06 | **[createRoot](06-createroot.md)** | <span className="db-tier t-understand">Understand</span> | The only way in, and the React 17 API that no longer exists |
| 07 | **[StrictMode](07-strictmode.md)** | <span className="db-tier t-master">Master</span> | Doubling is a bug detector, and it stops in production |
| 08 | **[Versions and channels](08-versions-and-channels.md)** | <span className="db-tier t-understand">Understand</span> | 614 canaries, 3 stable minors, and why patches land on three lines at once |
| 09 | **[What changed in React 19](09-what-changed-in-19.md)** | <span className="db-tier t-understand">Understand</span> | The real export diff across 18.3.1 → 19.0.8 → 19.2.8 |
| 10 | **[Starting a project](10-starting-a-project.md)** | <span className="db-tier t-understand">Understand</span> | Vite, a framework, or neither — and why not CRA |
| 11 | **[The React Compiler](11-the-compiler.md)** | <span className="db-tier t-understand">Understand</span> | Automatic memoization, stable at 1.0 — and not a linter |
| 12 | **[DevTools and the Profiler](12-devtools-and-profiler.md)** | <span className="db-tier t-understand">Understand</span> | Measure before optimising, and know what is compiled out of production |
| 13 | **[React on other renderers](13-other-renderers.md)** | <span className="db-tier t-know">Know</span> | Native, WebGL and terminals drive the same reconciler |
| 14 | **[React vs the alternatives](14-react-vs-alternatives.md)** | <span className="db-tier t-know">Know</span> | Re-render and diff vs signals, with a measured size table |

## Coverage

The syllabus lists **17 topics** for this phase; they become **14 pages**. Three
pairs are merged because you would never read one without the other. Nothing is
dropped.

| Syllabus topic | Page |
|---|---|
| What React is: `react` vs `react-dom` | 01 |
| Declarative vs imperative | 01 |
| The element | 02 |
| Render → reconcile → commit | 03 |
| Reconciliation and the diffing rules | 04 |
| Fiber | 05 |
| `createRoot` and `root.render` | 06 |
| `StrictMode` | 07 |
| Release channels | 08 |
| Governance and cadence | 08 |
| What React 19 changed | 09 |
| What React 19.2 added | 09 |
| Starting a React project in 2026 | 10 |
| The React Compiler exists | 11 |
| React DevTools | 12 |
| React on other renderers | 13 |
| React vs Vue, Svelte and Solid | 14 |

## How these pages were verified

Every page carries a `> Verified:` line naming the script behind it. The sandbox
is `sandbox/react-p0/`:

| Script | Produces |
|---|---|
| `ex01-two-packages.mjs` | Export lists, the `document.createElement` search, package sizes |
| `ex02-the-element.mjs` | JSX compile output (both runtimes), the element object, the frozen-props error |
| `ex03-render-commit.mjs` | The render/commit ordering log, in a browser |
| `ex04-reconciliation.mjs` | State survival across four structural changes |
| `ex05-fiber.mjs` | The fiber tree read off a live DOM node, and double buffering |
| `ex06-createroot.mjs` | Every `createRoot` error string |
| `ex07-strictmode.mjs` | The same app bundled dev and prod, with counts and byte sizes |
| `ex08-versions-channels.mjs` | dist-tags, publish dates, canary counts |
| `ex09-what-changed.mjs` | Export diffs across three installed React versions |
| `ex10-starting-a-project.mjs` | A real Vite scaffold, install and production build |
| `ex11-compiler.mjs` | Real React Compiler transform output |
| `ex12-profiler.mjs` | `<Profiler>` timings and Performance Tracks marks, dev vs prod |
| `ex13-renderers-and-alternatives.mjs` | Renderer versions, and the React/Preact size comparison |

**React 19 ships no UMD build**, so browser experiments are bundled with esbuild
and served to a real Firefox over `puppeteer-core`. Two measurements were
corrected during this phase after they contradicted themselves — a fiber child
count that disagreed with the DOM, and a Profiler result that appeared to show
`memo` being slower. Both corrections are on the pages.

## Gate

Move on to Phase 1 when you can:

1. Explain why changing a parent `<div>` to a `<span>` resets a grandchild's
   state, without using the phrase "virtual DOM".
2. Say what the DOM contains during the render phase, and why reading it there
   is a bug.
3. Explain what StrictMode's double effect mount is testing, and why a `useRef`
   guard is the wrong fix.

---

← Index: [React](../../README.md) · Start → [What React is](01-what-react-is.md)
