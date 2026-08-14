---
title: "The Rules of React beyond hooks"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against **react 19.2.8**, from documentation — react.dev
> [Rules of React](https://react.dev/reference/rules),
> [Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure),
> [React calls Components and Hooks](https://react.dev/reference/rules/react-calls-components-and-hooks),
> and [`useRef`](https://react.dev/reference/react/useRef).
> No sandbox script backs this topic; claims are cited, not measured.

**The Rules of Hooks are one of three rule families, and the smallest.** The other two
say what your code may *do* while rendering, and who is allowed to *call* your
components and hooks. React's own framing:

> They are **rules – and not just guidelines** – in the sense that if they are broken,
> **your app likely has bugs.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Purity and idempotence](01-purity-and-idempotence.md)** | Same inputs, same output; no side effects in render; and why *local* mutation is explicitly fine |
| 02 | **[What is immutable, and when](02-immutability.md)** | Props, state, context, hook arguments, hook return values — and the deadline that JSX imposes |
| 03 | **[React calls components and hooks](03-react-calls-components-and-hooks.md)** | `{Article()}` is not `<Article />`; never store, pass or wrap a hook |
| 04 | **[Refs and the DOM during render](04-refs-and-the-dom-in-render.md)** | No reading *or* writing `ref.current`, no touching the DOM — and the one blessed exception |

**Split at 300 lines on concept boundaries.** Chunks 01–02 are the purity family (what
render may do, and what it may not change); chunk 03 is the calling family; chunk 04 is
the two escape hatches where purity is easiest to break.

## The whole topic in one test

**Would running this render twice, or throwing this render away, change anything
outside the value it returns?** If yes, the code is in the wrong place. Every rule in
these four chunks is a specific answer to that question — and React can and does render
components multiple times, discard renders, and retry them.

## Where this connects

- **← [The Rules of Hooks](../01-the-rules-of-hooks.md)** — the third family, and the
  only one a linter catches reliably.
- **← [Share logic, not state](../03-share-logic-not-state/README.md)** — module-level
  mutable state is a purity violation as well as a tearing one.
- **→ [Why the rules exist](../05-why-the-rules-exist/README.md)** — the implementation
  underneath, from positional hook storage upward.
- **↔ [Phase 3 · Immutable updates](../../phase-3-state/05-immutable-updates/README.md)**
  — the practical half of chunk 02.
- **↔ [Phase 4 · `StrictMode` double invocation](../../phase-4-effects/05-strictmode-double-invocation.md)**
  — the smoke test for chunk 01, and what it does and does not catch.
- **↔ [Phase 6 · How the Compiler bails out](../../phase-6-performance/09-how-the-compiler-bails-out.md)**
  — the cost of breaking any of this, paid silently.

---

← Index: [Phase 7](../README.md) · Start → [Purity and idempotence](01-purity-and-idempotence.md)
