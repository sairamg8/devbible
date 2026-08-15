---
title: "20 · Private state before `#`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties), [Closures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`Symbol`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol), [`in` operator](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in). Documentation-validated; **no timings**.

**`#private` fields are recent, and most JavaScript is older than they are.** Four other patterns
carry private state in existing code, and knowing which of them actually *is* private — two of the
four — is the point of this topic.

It closes phase 4 by tying together what the phase has been circling: `#` fields are not properties,
which is why `Object.freeze`, `JSON.stringify`, `Proxy` and every reflection API miss them.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The three older patterns](./01-the-three-older-patterns.md)** | The underscore convention and its silent subclass collision, TypeScript's `private` being the same category, closure privacy and what it costs, the module-scoped `WeakMap` (and why `Weak` is load-bearing), and why a `Symbol` key is collision avoidance rather than privacy |
| 2 | **[`#` today, and choosing](./02-hash-today-and-choosing.md)** | `SyntaxError` vs `TypeError`, the `#x in obj` brand check that beats `instanceof`, the full table of what `#` is invisible to, when to use which pattern, why not to migrate as a sweep, and the two real limits — serialisation and no `protected` |

## Phase gate

You are done with this topic — and with phase 4 — when you can say **why a symbol-keyed field is
not private**, and **why a class with only `#` state serialises to `{}`**.

## Where this connects

- [06 · `class`](../06-class/README.md) — where `#` fields are declared
- [12 · `Object.freeze` and `seal`](../12-freeze-and-seal/02-what-freeze-cannot-reach.md) — freezing cannot reach them
- [17 · `toString`, `valueOf`, `Symbol.toPrimitive`](../17-tostring-valueof-toprimitive/02-implementing-and-the-neighbours.md) — the `{}` serialisation bug and its `toJSON` fix
- [19 · `Proxy` and `Reflect`](../19-proxy-and-reflect/01-the-traps-and-reflect.md) — why a proxied instance throws on private access
- [13 · `instanceof` and `Symbol.hasInstance`](../13-instanceof-and-hasinstance/02-where-it-fails.md) — the brand-check problem `#x in obj` solves
- [14 · Object creation patterns](../14-object-creation-patterns/01-factory-constructor-class.md) — closure privacy as the factory's version
- [Phase 3 · 06 · Closures](../../phase-3-functions/06-closures/README.md) — the mechanism behind pattern 2

---

Start → [The three older patterns](./01-the-three-older-patterns.md)
