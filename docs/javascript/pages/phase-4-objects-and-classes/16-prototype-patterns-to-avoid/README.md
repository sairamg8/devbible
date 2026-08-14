---
title: "16 · Prototype patterns to avoid"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain), [`Object.prototype.__proto__`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/proto), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [`Array.prototype.flat()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat). Documentation-validated; **no timings**.

**The prototype chain is shared state.** Everything on this page follows from that: a write to a
prototype is visible to every object that inherits from it, including objects created before the
write and objects in code that has never heard of yours.

Two ways that goes wrong. **On purpose** — extending built-ins and monkey-patching, where the cost
is collisions and undebuggable behaviour. **By accident** — prototype pollution, where the write
comes from data and it is a security vulnerability.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Extending built-ins and monkey patching](./01-extending-and-patching.md)** | Why an added method shows up in `for...in`, the renames of `flatten`→`flat` and `contains`→`includes` and what they prove, load-order collisions, what makes a polyfill legitimate, how to patch a function survivably, and why reassigning `.prototype` breaks `instanceof` |
| 2 | **[Prototype pollution](./02-prototype-pollution.md)** | The mechanism precisely — including why `JSON.parse` is *not* the vulnerability — all three key routes, where the sink usually is, what an attacker gets, and six defences in the order to apply them |

## Phase gate

You are done with this topic when you can explain **why `Array.prototype.flatten` had to be
renamed**, and **write a deep merge that cannot pollute** — including why `for...in` is part of the
bug.

## Where this connects

- [05 · The prototype chain](../05-the-prototype-chain/README.md) — the shared state all of this is about
- [11 · Property descriptors](../11-property-descriptors.md) — `enumerable: false`, the minimum bar for any prototype addition
- [12 · `Object.freeze` and `seal`](../12-freeze-and-seal/01-the-three-levels.md) — freezing `Object.prototype` as hardening
- [13 · `instanceof` and `Symbol.hasInstance`](../13-instanceof-and-hasinstance/01-what-it-really-asks.md) — why reassigning `.prototype` breaks existing instances
- [14 · Object creation patterns](../14-object-creation-patterns/02-object-create-and-dictionaries.md) — `Object.create(null)` and `Map` as prototype-less targets
- [15 · Normalising untrusted shapes](../15-normalising-untrusted-shapes/02-normalising-at-the-boundary.md) — the defence that is immune by construction

---

Start → [Extending built-ins and monkey patching](./01-extending-and-patching.md)
