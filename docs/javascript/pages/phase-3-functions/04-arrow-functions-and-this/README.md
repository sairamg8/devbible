---
title: "04 · Arrow functions and this"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Script:
> `sandbox/js-p3/ex4-arrows.mjs`.

**An arrow function is not "shorter function syntax".** It is a different kind of
callable: it has no binding of its own for `this`, `arguments`, `super` or
`new.target`, and no `prototype` at all.

That makes it exactly right for callbacks and exactly wrong for methods — a
distinction that costs an hour of debugging the first time you get it backwards.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Lexical `this` and the missing bindings](./01-lexical-this.md)** | Why `this` resolves through the scope chain, why `call`/`bind` cannot change it, and what `arguments`, `super`, `new.target` and `prototype` actually do |
| 2 | **[Syntax, and when not to use one](./02-syntax-and-when-not-to.md)** | Implicit return and the object-literal trap, what a concise body cannot contain, methods vs class-field arrows, and the decision table |

## Phase gate

You are done with this topic when you can say why
`obj = { m: () => this.x }` is broken, why `arrow.call(other)` does nothing, and
what `n => { value: n }` returns.

## Where this connects

- [03 · `this`](../03-this/README.md) — the four binding rules an arrow opts out of
- [05 · `call`, `apply` and `bind`](../05-call-apply-bind.md) — the methods that arrows ignore for `this` but still honour for arguments
- [01 · Declarations, expressions and arrow functions](../01-declarations-expressions-arrows.md) — which form to reach for by default

---

Start → [Lexical `this` and the missing bindings](./01-lexical-this.md)
