---
title: "03 · this"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6) — **sandbox-proven**. Script: `sandbox/js-p3/ex3-this.mjs`.

**`this` is an argument, not a variable.** It is decided by *how a function is
called*, not where it was written — which is why the same function body returns
four different things depending on the call site, and why extracting a method
into a variable breaks it.

Learn the decision tree once and every `this` question becomes mechanical:
look at the call site, not the definition.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The four binding rules](./01-the-four-rules.md)** | Default, implicit, explicit and `new` binding, the precedence order measured, and what `new` actually does |
| 2 | **[Losing `this`, and getting it back](./02-losing-and-fixing-this.md)** | The detached-method bug, callbacks and `thisArg`, class fields, and picking a fix |

## Phase gate

You are done with this topic when you can look at any call site and name which
of the four rules applies before running it — and explain why
`const f = obj.method; f()` throws.

## Where this connects

- [04 · Arrow functions and `this`](../04-arrow-functions-and-this/README.md) — the fifth case: no binding of its own at all
- [05 · `call`, `apply` and `bind`](../05-call-apply-bind.md) — the explicit rule in full
- [01 · Declarations, expressions and arrow functions](../01-declarations-expressions-arrows.md) — which form to reach for
- Phase 4 · Objects, prototypes and classes — where `new` and the prototype chain are covered in depth

---

Start → [The four binding rules](./01-the-four-rules.md)
