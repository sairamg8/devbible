---
title: "DOM refs"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Manipulating the DOM with Refs](https://react.dev/learn/manipulating-the-dom-with-refs)
> and [`useRef`](https://react.dev/reference/react/useRef).
> Effect timing and ref-callback lifetime are owned by
> [Phase 4 · 15](../../phase-4-effects/15-effects-and-refs.md) and cross-linked
> rather than restated. No sandbox script backs this topic.

The case `useRef` has dedicated support for: a handle to a real DOM node, so you
can do the handful of things React deliberately does not expose.

> Refs are an escape hatch. You should only use them when you have to "step
> outside React". Common examples of this include **managing focus, scroll
> position, or calling browser APIs that React does not expose.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Getting and using a ref](01-attaching-and-using.md)** | Attaching, why `.current` is `null` during render, focus and scroll, and a ref per list item |
| 02 | **[Crossing component boundaries](02-crossing-boundaries.md)** | `ref` as a regular prop in React 19, what you may and may not do to a node, and `flushSync` |

**Split at 300 lines on a concept boundary.** Chunk 01 is getting hold of a node;
chunk 02 is passing them around and the rules once you have one.

## Where this connects

- **← [`useRef`](../01-useref.md)** — the box itself, and the initialization idiom
  the list-of-refs `Map` uses.
- **← [Phase 4 · 15](../../phase-4-effects/15-effects-and-refs.md)** — why a ref is
  usable in an effect but cannot be *reacted to*, and React 19 ref cleanup.
- **→ [Ref callbacks](../06-ref-callbacks.md)** — the full treatment of the form
  chunk 01 uses for lists.
- **→ [`useImperativeHandle`](../07-useimperativehandle.md)** — narrowing what a
  parent can reach.
- **→ [When a ref is the wrong tool](../08-when-a-ref-is-wrong.md)** — the "it
  works but the UI is stale" failure.

---

← Index: [Phase 5](../README.md) · Start → [Getting and using a ref](01-attaching-and-using.md)
