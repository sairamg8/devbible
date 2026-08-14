---
title: "14 · Object creation patterns"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes), [`new`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/new), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [Private properties](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_properties), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map). Documentation-validated; **no timings**.

**Every way of making an object comes down to one question: where do the methods live, and what is
above the object in the chain?**

A factory gives each instance its own copies and no prototype worth naming. A class puts one copy
on a shared prototype. `Object.create` lets you name the prototype directly — including `null`,
which is the point of the second half of this topic.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Factory, constructor, class](./01-factory-constructor-class.md)** | Why 2 and 3 are the same mechanism, the method-identity difference everything else follows from, why `#private` ended the privacy argument, forgetting `new`, static factory methods, and composition over deep `extends` |
| 2 | **[`Object.create` and null-prototype dictionaries](./02-object-create-and-dictionaries.md)** | The descriptor-map second argument, `{ __proto__: null }`, the `"toString"` key bug, prototype pollution, exactly what you give up, and the table that says when `Map` wins instead |

## Phase gate

You are done with this topic when you can say **what a factory costs and what it buys versus a
class**, and **why a dictionary keyed by user input should not be a plain `{}`**.

## Where this connects

- [06 · `class`](../06-class/README.md) — what `class` desugars to, and `#private`
- [05 · The prototype chain](../05-the-prototype-chain/README.md) — what `Object.create` is setting
- [11 · Property descriptors](../11-property-descriptors.md) — `Object.create`'s second argument
- [03 · Existence checks and `delete`](../03-existence-checks-and-delete/README.md) — `Object.hasOwn`, which a null-prototype object forces you to use
- [13 · `instanceof` and `Symbol.hasInstance`](../13-instanceof-and-hasinstance/README.md) — why factories need a branded `is()` instead
- [Phase 3 · 20 · `new.target` and constructor guards](../../phase-3-functions/20-new-target-and-constructor-guards.md) — guarding a constructor function
- **16 · Prototype patterns to avoid** *(not written yet)* — prototype pollution in full
- **18 · Mixins and composition over inheritance** *(not written yet)* — the argument against deep chains

---

Start → [Factory, constructor, class](./01-factory-constructor-class.md)
