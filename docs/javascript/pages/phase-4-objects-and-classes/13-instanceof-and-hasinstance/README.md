---
title: "13 · `instanceof` and `Symbol.hasInstance`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`instanceof`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/instanceof), [`Symbol.hasInstance`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/hasInstance), [`Array.isArray()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/isArray), [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain). Documentation-validated; **no timings**.

**`x instanceof C` asks whether `C.prototype` is somewhere in `x`'s prototype chain.** Not whether
`C` built it, not whether `x` is "a C" in any conceptual sense — just whether one specific object
appears in a chain of objects.

Both halves of this topic fall out of that. The mechanism explains the surprising `true`s and
`false`s you can produce on purpose; the identity comparison explains why the check fails on values
that are correct in every way that matters, and what to use instead.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What `instanceof` really asks](./01-what-it-really-asks.md)** | The chain walk written out, why reassigning `.prototype` breaks it, `Symbol.hasInstance` as a real method call, the two `TypeError`s, primitives, `Object.create(null)`, bound functions, and `isPrototypeOf` |
| 2 | **[Where it fails, and what to use instead](./02-where-it-fails.md)** | Cross-realm failure (iframes, workers, `vm`, jsdom), two copies of a package, `Array.isArray` and the internal-slot checks, why `Symbol.toStringTag` can lie, duck typing and the thenable protocol, and branding with `Symbol.for` |

## Phase gate

You are done with this topic when you can explain **why an array from an iframe is not
`instanceof Array`**, and say what `await` checks instead of `instanceof Promise`.

## Where this connects

- [05 · The prototype chain](../05-the-prototype-chain/README.md) — the walk `instanceof` performs
- [06 · `class`](../06-class/README.md) — where `.prototype` comes from
- [09 · `extends` and `super`](../09-extends-and-super/README.md) — why a subclass instance satisfies every ancestor
- [Phase 8 · 03 · Errors and subclasses](../../phase-8-modules-errors/03-error-and-subclasses/README.md) — the most common place the cross-realm failure shows up
- **14 · Object creation patterns** *(not written yet)* — factories, which have no meaningful `instanceof` at all
- **16 · Prototype patterns to avoid** *(not written yet)* — the other half of "do not reassign `.prototype`"

---

Start → [What `instanceof` really asks](./01-what-it-really-asks.md)
