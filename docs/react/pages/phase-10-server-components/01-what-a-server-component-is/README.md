---
title: "What a Server Component is"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Server Components](https://react.dev/reference/rsc/server-components) and
> [`'use client'`](https://react.dev/reference/rsc/use-client).
> No sandbox script backs this topic; claims are cited, not measured.

**A Server Component is a component that runs in a different environment from both your
browser bundle and your SSR server, at a different time, and whose code is never sent to
the browser at all.** Everything that feels strange about them — no state, no effects, no
`onClick`, but `await` works — falls out of that one sentence.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The definition, clause by clause](01-the-definition.md)** | "Renders ahead of time, before bundling, in a separate environment" — and the two modes that phrase allows: build time with no web server, or per request |
| 02 | **[The default, the limits, and the stability line](02-defaults-and-limits.md)** | What a Server Component cannot do and why, what it can do that a Client Component cannot, why there is **no directive**, and what "stable in React 19" actually covers |

## Why this is two files

Because it is two questions. The first is *what is this thing and when does it run* — a
definition and an architecture. The second is *what can I write inside one* — a set of
restrictions and capabilities that only make sense once the first is settled. Splitting
there keeps each answer whole.

## Where this connects

- **[Topic 02 · The two module graphs](../02-two-module-graphs.md)** — the mechanism behind
  "Server Components are the default".
- **[Topic 05 · What crosses the boundary](../05-what-crosses-the-boundary.md)** — why an
  `onClick` prop fails as a *serialization* error rather than a hooks error.
- **[Topic 08 · Async components](../08-async-components.md)** — the one capability that is
  strictly a gain, not a trade.
- **Phase 11 — SSR and hydration** *(not yet written)* — where the RSC-versus-SSR
  distinction is taken apart properly.

---

← Index: [Phase 10](../README.md) ·
Next → [The definition, clause by clause](01-the-definition.md)
