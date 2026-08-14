---
title: "09 · `extends` and `super`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`extends`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends), [`super`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super), [Classes guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_classes). Documentation-validated; **no timings**.

**`super` is two different operators that share a keyword**, and most confusion about
inheritance in JavaScript is the two being treated as one thing.

- **`super(...)`** — a *call*, legal only in a derived constructor. It runs the base constructor,
  and in a derived class **it is what creates `this`**.
- **`super.x`** — a *lookup*, legal in any method. It starts at the prototype of the method's home
  object and invokes what it finds with the current `this`.

[06 · `class`](../06-class/README.md) covers what the syntax desugars to, and
[05 · The prototype chain](../05-the-prototype-chain/README.md) covers the lookup mechanism. **This
topic is what inheritance does at runtime**: the order things are constructed in, and where a
`super` call actually resolves.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The two chains, and constructing a derived instance](./01-the-two-chains-and-construction.md)** | `extends` wires the instance *and* static chains, why `this` is unavailable before `super()`, the implicit constructor, field-initialisation order, and `new.target` down the chain |
| 2 | **[`super.method()` and overriding safely](./02-super-method-and-overriding.md)** | The home-object rule, why `super` is a `SyntaxError` in a function expression, the four overriding rules, and extending `Error` and `Array` |

## Phase gate

You are done with this topic when you can say **what creates `this` in a derived class**, and
explain why a field read inside a method called from the base constructor comes back `undefined`.

## Where this connects

- [05 · The prototype chain](../05-the-prototype-chain/README.md) — the lookup both chains use
- [06 · `class`](../06-class/README.md) — fields, `static`, `#private`, and the desugaring
- [07 · `this` inside methods, and losing it](../07-this-in-methods/README.md) — the other half of dynamic dispatch
- [Phase 3 · 20 · `new.target` and constructor guards](../../phase-3-functions/20-new-target-and-constructor-guards.md) — abstract base classes, which depend on `new.target` travelling down the chain
- [Phase 8 · 03 · Errors and subclasses](../../phase-8-modules-errors/03-error-and-subclasses/README.md) — subclassing a built-in in anger
- **18 · Mixins and composition over inheritance** *(not written yet)* — the argument for stopping at two levels

---

Start → [The two chains, and constructing a derived instance](./01-the-two-chains-and-construction.md)
