---
title: "Abstract classes vs interfaces"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §9 (interfaces), §9.4.1 and
> §8.4.8 (inheritance of default methods and the diamond rules), §9.4.1.1
> (no defaults for `Object` methods), §8.1.1.1 (abstract classes), and the
> JDK 25 API documentation (`Collection`, `Comparator`, `AbstractList` —
> default-method and skeleton-class evolution examples).

**The choice is not stylistic. An abstract class shares *implementation and
state* down one single-inheritance channel; an interface shares *contract*
across unlimited implementors — and, since default methods, a limited slice
of behaviour too. The decision rule that survives contact with real code:
model "is-a with shared state" as an abstract class, "can-do capability" as
an interface — and when in doubt, interface, because it spends no
inheritance budget and couples to no representation.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[What each construct provides](01-what-each-provides.md)** | The capability table, abstract-class mechanics (constructors, template method, protected state), interface members, the constants trap, marker interfaces |
| 2 | **[Evolution and the diamond](02-evolution-and-the-diamond.md)** | Why `default` exists, `static`/`private` interface methods, binary compatibility, the three diamond rules, `X.super.m()`, re-abstraction |
| 3 | **[Choosing, and designing APIs](03-choosing-and-designing.md)** | The decision tests, contract + skeleton pairing, sealed interfaces, markers vs annotations, evolution-first API design |

## Why this is a Master topic

This is the fork in every domain model: which half of the type system a new
abstraction lives in. Get it wrong one way and unrelated classes can't take
the capability; get it wrong the other and the contract can never evolve
without breaking every implementor. The diamond rules, default-method
discipline, and the skeleton-class pattern are what let the JDK itself add
`Collection.stream()` twenty years in without breaking anyone — the same
moves your own published interfaces will need.

## Phase gate contribution

The gate's sealed `PaymentResult` is an interface with record implementors —
chunk 3 explains why the contract side of this choice took over closed
hierarchies once `sealed` arrived.

---

← Prev: [Polymorphism and dispatch](../04-polymorphism-dispatch/README.md) · Index: [Phase 2 — Classes and objects](../README.md) · Next → [`equals`/`hashCode` — the contract](../06-equals-hashcode/README.md)
