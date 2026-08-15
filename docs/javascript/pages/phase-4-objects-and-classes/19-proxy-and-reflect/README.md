---
title: "19 · `Proxy` and `Reflect`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy), [`Reflect`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect), [`Object.defineProperty()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty), [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties). Documentation-validated; **no timings**.

**A `Proxy` intercepts the operations the engine performs on an object** — reading a property,
writing one, asking whether a key exists, listing keys, calling, constructing. **`Reflect` is those
same operations as ordinary functions**, which is what a trap calls to do the normal thing.

You will read this far more often than you write it, because it is what reactivity systems,
validation layers and dynamic API clients are built from. This topic is about recognising it,
knowing the three failures that cost real time, and knowing when something simpler is the answer.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The traps, and why `Reflect` exists](./01-the-traps-and-reflect.md)** | The trap table and what each fires on, why `ownKeys` alone does not control `Object.keys`, why forwarding with `Reflect` (and the `receiver`) is not optional, the invariants that stop a proxy lying, the internal-slot failure on `Map`/`#private`, identity, and `revocable` |
| 2 | **[What they are actually for](./02-what-they-are-for.md)** | Reactivity and precisely why `Proxy` displaced `defineProperty`, validation of properties that do not exist yet, the small useful ones, the costs stated plainly, and when a setter or `Object.seal` is the better answer |

## Phase gate

You are done with this topic when you can say **why Vue 3 uses `Proxy` where Vue 2 used
`Object.defineProperty`**, and **why `new Proxy(new Map(), {}).get(k)` throws**.

## Where this connects

- [11 · Property descriptors](../11-property-descriptors.md) — `defineProperty`'s limitation, which is the reactivity story
- [10 · Getters and setters](../10-getters-and-setters.md) — the simpler tool for a *known* property
- [12 · `Object.freeze` and `seal`](../12-freeze-and-seal/01-the-three-levels.md) — the invariants, and why proxying a frozen object achieves nothing
- [13 · `instanceof` and `Symbol.hasInstance`](../13-instanceof-and-hasinstance/02-where-it-fails.md) — `Array.isArray` following a proxy to its target
- [06 · `class`](../06-class/README.md) — `#private` fields, which do not forward through a proxy
- [16 · Prototype patterns to avoid](../16-prototype-patterns-to-avoid/01-extending-and-patching.md) — the same argument against invisible behaviour

---

Start → [The traps, and why `Reflect` exists](./01-the-traps-and-reflect.md)
