---
title: "The server/client split is one rule with a long tail of consequences — this chapter is the tail: the decision procedure, the composition catalogue, the primitives that exist because of the boundary, and how to enforce it at build time"
sidebar_label: "01 · Overview: the server/client split"
sidebar_position: 0
description: "Chapter 3 overview: what each page settles, how this chapter divides from chapter 1, and the three corrections made to this page's own earlier content."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components) (page header `version: 16.3.4`, `lastUpdated` 2026-08-25), via research banked for this track on 2026-09-04.
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9. Documentation-verified; **no sandbox run**.

**Chapter 1 establishes the rule: `'use client'` marks a boundary between two module graphs, imports cross it and children do not. That rule is short. Its consequences are not, and this chapter is where they live — when to opt in at all, the full catalogue of composition patterns, the React primitives that exist because components now live on both sides of a boundary, how to make a boundary violation a build error rather than a silent leak, and how the whole thing shows up in your Core Web Vitals.**

## Read chapter 1 first

This chapter deliberately does **not** restate the mechanics. If any of the following is unfamiliar, start there:

- [**ch1 · 03 · Core philosophy**](../01-introduction-to-next-js/03-core-philosophy-server-first-rendering.md) — the module-graph rule, the children exception, the RSC payload, prop serializability, the empty-string env var trap, provider placement.
- [**ch1 · 03b · Hybrid static/dynamic**](../01-introduction-to-next-js/03b-hybrid-static-dynamic-and-the-cost-model.md) — how rendering strategy is acquired rather than declared, and the cost asymmetry.

## What each page settles

| Page | What it owns |
|---|---|
| [**01 · Default architecture (RSC)**](01-default-architecture-everything-is-a-server-component-rsc.md) | What a Server Component *is* — why it is a security boundary and not only a performance one, why it can be `async`, and why it is not SSR |
| [**02 · `'use client'`: when to opt in**](02-use-client-when-and-why-to-opt-in-interactivity-browser-apis.md) | The decision procedure: the four reasons, the reflex to resist, and why placement matters more than permission |
| [**03 · Composition patterns**](03-composition-patterns-server-to-client-boundaries.md) | Slots, named slots, providers, unlimited interleaving, the serializable-props rule, and the cases no pattern solves |
| [**04 · React 19.2 primitives**](04-react-192-primitives-useeffectevent-for-non-reactive-side-ef.md) | `useEffectEvent` and `Activity` — additions that exist because of the boundary |
| [**05 · Enforcing boundaries**](05-enforcing-boundaries-with-server-only-client-only-packages.md) | `server-only` / `client-only`: turning a silent leak into a build-time error |
| [**06 · Bundle size and Core Web Vitals**](06-bundle-size-implications-and-core-web-vitals-impact.md) | The measurement side — how a boundary decision shows up in the metrics |

## The one-paragraph version

Every component is a Server Component until something marks it otherwise. A Server Component renders once on the server, ships none of its own code to the browser, and can therefore hold secrets and query a database directly — but it has no state, no effects, no event handlers and no context, all for the same reason: it renders once and never reaches the browser. `'use client'` opts a subtree out, and because everything that file *imports* joins the client bundle, the directive belongs on the smallest component that needs it. Server Components can still appear *inside* Client Components, as long as they arrive as props rather than imports.

## ⚠️ Three corrections to this page's own earlier content

This overview previously contained three claims that were checked on 2026-09-04 and did not hold. They are recorded rather than quietly removed, because all three are common enough to be worth naming:

**1 · "React context that a Server Component needs to read".** This was listed as a reason to reach for `'use client'`, implying a Server Component can read context given a client provider. **It cannot. React context is not supported in Server Components at all.** The correct statement is that context requires both the provider *and* its consumers to be Client Components — the provider's `children` are unaffected and still render on the server. The four genuine reasons are state and event handlers, lifecycle logic, browser-only APIs, and custom hooks built on those.

**2 · "importing a Server Component from inside a Client Component (which isn't even allowed)".** Nothing is disallowed and nothing errors. The import **silently pulls the component into the client module graph**, so it stops being a Server Component — and the failure surfaces later, at whatever server-only code it touches. Describing it as forbidden sends people looking for an error message that never appears. See [03 · Composition patterns](03-composition-patterns-server-to-client-boundaries.md).

**3 · "not functions, class instances, or `Date` objects passed directly without conversion".** Functions and class instances are correct. **`Date` is not** — React serializes `Date`, along with `Map` and `Set`, in the RSC payload. Converting dates to strings before passing them is unnecessary, and doing it costs you type fidelity on the other side.

## The workflow this chapter argues for

Build the page as Server Components. Run it. Add `'use client'` only when you hit something that genuinely needs one of the four reasons — and add it to the smallest leaf that needs it, never to a page or layout, and never preemptively.

The default is the performance-correct choice, which inverts the Pages Router's model where everything shipped as client JavaScript unless you worked to avoid it. **The lazy path and the right path are now the same path**, which is the strongest argument for the design and the reason the burden of proof sits on the client boundary rather than on staying server-side.

---

Next → [01 · Default architecture: everything is a Server Component](01-default-architecture-everything-is-a-server-component-rsc.md)
