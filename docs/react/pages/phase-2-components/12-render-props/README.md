---
title: "Render props and function-as-children"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-17 against **react 19.2.8**, from documentation — the legacy
> [Render Props](https://legacy.reactjs.org/docs/render-props.html) guide,
> react.dev [`Children`](https://react.dev/reference/react/Children),
> [Reusing Logic with Custom Hooks](https://react.dev/learn/reusing-logic-with-custom-hooks),
> [`memo`](https://react.dev/reference/react/memo),
> [`useCallback`](https://react.dev/reference/react/useCallback), and
> [`'use client'`](https://react.dev/reference/rsc/use-client) for the
> serializable-props list quoted in chunk 03.
> No sandbox script backs this topic; claims are cited, not measured.

**A function prop a component calls to decide what to render. Hooks replaced it
for logic sharing — and there are exactly five things hooks structurally cannot
do, which is why it is still in every library you use.**

## The chunks

| # | Chunk | What it settles |
|---|---|---|
| 01 | **[The pattern, and why hooks replaced it](01-the-pattern.md)** | The shape, `children` vs a named prop, wrapper hell, and the traps around how often the function runs |
| 02 | **[Where it still wins](02-where-it-still-wins.md)** | The one rule that decides it, the five structural cases, and the argument boundary between a render prop and a slot |
| 03 | **[The costs and the limits](03-the-costs-and-limits.md)** | Memoization, typing, testing, migrating to a hook — and 🔴 **the Server Component boundary a render prop cannot cross** |

**Three chunks, ~740 lines.** Tier stays **Know**: you read these far more often
than you write them. The depth is here because reading them badly is how people
introduce the bugs in chunk 01.

## The one rule

**A hook cannot render anything.** So the moment the *component* must decide
**where**, **how many times**, or **inside what** the caller's markup appears, a
hook is structurally incapable. Everything in chunk 02 follows from that
sentence; everything else is better as a hook.

## The modern limit, in one line

Props crossing the Server/Client boundary must be serializable, and **a plain
function is not** — while **JSX elements are**. In an RSC application a
render-prop API is therefore a Client Component API, and converting it to a slot
is often the actual fix rather than a stylistic preference.
[Chunk 03](03-the-costs-and-limits.md) quotes the documented list.

## Where this connects

- **→ [Custom hooks](../../phase-7-custom-hooks/02-writing-a-custom-hook.md)** —
  what replaced this for logic sharing, and what chunk 03's migration recipe
  converts to.
- **→ [Children patterns](../08-children-patterns.md)** — function-as-children as
  one of the four ways to pass content.
- **→ [Slots and children](../03-composition/02-slots-and-children.md)** — the
  element-prop alternative, which is what you want when the hole takes no
  arguments.
- **→ [Higher-order components](../13-higher-order-components.md)** — the other
  pre-hooks sharing pattern, with its own three caveats.
- **→ [Headless components](../../patterns/06-headless-components/05-the-delivery-shapes.md)** —
  children-as-a-function is one of the four ways to deliver a headless widget.
- **→ [Function components](../01-function-components/02-identity-and-nesting.md)** —
  the identity rule behind the "component defined inside the render prop" bug.
- **→ [Composition rules](../../phase-10-server-components/10-composition-rules.md)** —
  the boundary chunk 03 runs into.

---

Index: [Phase 2](../README.md) · Start → [01 · The pattern](01-the-pattern.md)
