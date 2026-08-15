---
title: "18 · A virtual-DOM diff in outline"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against the React documentation — [Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html) and [Rendering lists](https://react.dev/learn/rendering-lists) — and MDN [`Element.setAttribute()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute), [`Node.insertBefore()`](https://developer.mozilla.org/en-US/docs/Web/API/Node/insertBefore), [`Element.moveBefore()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map). Documentation-validated; **no timings, nothing was run**.

**Render a tree of plain objects, compare it with the last one, patch the difference.** The
interesting part is not the tree — it is the two assumptions that make the comparison linear, and
what each one costs you when it is wrong.

> *"Two elements of different types will produce different trees."*
>
> *"The developer can hint at which child elements may be stable across different renders with a
> `key` prop."*

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The diff](./01-the-diff.md)** | Why an exact tree diff is *"in the order of O(n3)"* and what the linear heuristic trades away; the diff function branch by branch — create, remove, replace on a type change, text, props, children; diffing props over the **union of both key sets** and the three kinds of prop (attribute, property, listener) with the `value`/caret trap; patching, and why index addressing is fragile; and the honest account of what a virtual DOM is **not** |
| 2 | **[Keys, and the cost](./02-keys-and-the-cost.md)** | Positional matching and the one-insertion-rewrites-everything failure; the keyed diff as one `Map` and one pass, with removals falling out of the leftovers; the two-ended walk and the LIS refinement; the rules of keys verbatim, and the two that get broken — **the index** and **generated keys**; keys as identity (and how to use that to reset state deliberately); the cost of the model, and the three approaches that avoid it |

## Four facts worth carrying out of this topic

- **A changed element type destroys the subtree** — DOM nodes, focus, scroll and state. Keeping
  types stable is a design decision, not a detail.
- **A prop diff must walk both objects**, or removed props leave stale attributes behind.
- **The index is not a key**; it *is* the position, so it reproduces the unkeyed bug while looking
  fixed.
- **A virtual DOM is not faster than the DOM.** It is predictably good, and it is one of several
  ways to get there.

## Phase gate

You are done with this topic when you can sketch the diff and the keyed-children pass from an
empty file, say what happens when an element type changes, explain why index keys and generated
keys are bugs, and name what you would use instead of a virtual DOM.

## Where this connects

- [17 · A tiny pub/sub and a reactive `signal`](../17-pubsub-and-signals/README.md) — the same problem solved by tracking dependencies instead of comparing outcomes
- [Phase 9 · 11 · Batching DOM work](../../phase-9-dom/11-batching-dom-work/README.md) — fragments, `replaceChildren`, and why `innerHTML +=` is the thing a diff exists to avoid
- [Phase 9 · 12 · Layout thrashing](../../phase-9-dom/12-layout-thrashing/README.md) — why a patch phase separated from a read phase matters
- [Phase 10 · 05 · A controlled input](../../phase-10-events/05-form-and-input-events/02-a-controlled-input.md) — the caret rule any patcher has to obey
- [12 · Deep equality](../12-deep-equality/README.md) — the comparison a memoisation opt-out is built on

---

Start → [The diff](./01-the-diff.md)
