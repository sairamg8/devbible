---
title: "Container and presentational components"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation and source —
> Dan Abramov, *Presentational and Container Components*, **23 March 2015**, with
> the **2019 update** retracting the recommendation, fetched from the original
> article on 2026-08-17 and quoted in chunk 01. react.dev
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks),
> [Server Components](https://react.dev/reference/rsc/server-components) and
> [`'use client'`](https://react.dev/reference/rsc/use-client).
> No sandbox script backs this topic; claims are cited, not measured.

**The pattern hooks retired — and the one that came back with a compiler behind
it.**

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | **[What it was, and why its author withdrew it](01-what-it-was.md)** | The split, the 2015 economics that justified it, the 2019 retraction verbatim, and what hooks replaced it with |
| 02 | **[What survived](02-what-survived.md)** | Server Components as the enforced revival, the four cases where the split is still right, why it went wrong in practice, and how to read and modernise code that uses it |

**Two chunks, ~490 lines.** Two, not three — this is a historical pattern with a
narrow live remainder, and padding it to match the other topics would be
dishonest about how much there is to say.

## The short version

Split each feature into a **container** that owns state and data and renders no
markup, and a **presentational** component that takes props and returns JSX. In
2015 that was sound, because the only sharing tools — HOCs and render props —
added a wrapper component anyway, so making the wrapper the data layer was free.

Hooks removed that cost, and the author withdrew the recommendation in 2019:

> **I don't *suggest* splitting your components like this anymore.**

🔴 **A retraction of the mechanism, not the goal.** Separating data from
rendering is still right; a custom hook is now the seam.

## The two things worth remembering

**The test for whether the split is still right:** is the presentational half
used **more than once, or by someone else**? One caller forever means the split
bought a file and a prop-drilling hop.

**It came back as RSC.** A server component fetches, a client component renders —
the same shape, enforced by the bundler instead of by convention, and motivated
by bundle size rather than by re-renders. Same picture, different reason; chunk
02 sets the two side by side.

## Where this connects

- **→ [Custom hooks](../../phase-7-custom-hooks/02-writing-a-custom-hook.md)** —
  what replaced it, and the seam that survived.
- **→ [Higher-order components](../../phase-2-components/13-higher-order-components/README.md)** —
  `connect()` is this pattern as a HOC, and the retirement recipes match.
- **→ [Render props](../../phase-2-components/12-render-props/README.md)** — the
  other 2015 sharing tool whose wrapper cost made this pattern cheap.
- **→ [Component boundaries](../../phase-2-components/10-component-boundaries.md)** —
  splitting by responsibility rather than by mechanism, which is the underlying
  error.
- **→ [Server Components as `children`](../../phase-10-server-components/07-server-components-as-children.md)**
  and [where interactivity goes](../../phase-10-server-components/11-where-interactivity-goes.md) —
  the enforced version.
- **→ [Wrappers and providers](../../phase-14-correctness/10-wrappers-and-providers.md)** —
  the testing cost that is one of the four surviving reasons to split.

---

Index: [React patterns](../README.md) · Start → [01 · What it was](01-what-it-was.md)
