---
title: "Abstract classes vs interfaces"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §8.1.1.1 (abstract classes),
> §9 (interfaces), §9.4 (default, static and private interface methods),
> §9.4.1 and §8.4.8 (inheritance of defaults and the diamond rules), and
> the JDK 25 API documentation (`Collection`, `Comparator`, `AbstractList`
> — the JDK's own evolution and skeleton examples).

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
| 1 | **[The decision line](01-the-decision-line.md)** | What each construct actually provides, the three things only abstract classes give (state, constructors, enforced skeletons), the tests that decide, markers vs annotations |
| 2 | **[Default methods and the diamond](02-default-methods-and-the-diamond.md)** | Why defaults exist (API evolution), `static` and `private` interface methods, the constant-interface antipattern, the three diamond-resolution rules, `X.super.m()`, what breaks binary compatibility |
| 3 | **[Skeletons, sealed types and API design](03-skeletons-sealed-and-api-design.md)** | The interface-plus-skeleton pairing (`AbstractList`), template method as enforcement, how sealed interfaces changed the calculus, functional interfaces, a full API-evolution walkthrough |

## Why this is a Master topic

Every API you publish and every library you consume takes a position on
this choice. Get it wrong one way and your users burn their single
`extends` slot on you; get it wrong the other way and a minor version bump
breaks every implementor on Earth. The diamond rules, default-method
discipline and the skeleton pattern are what let `Collection` gain
`stream()` in Java 8 without breaking twenty years of implementations —
the same mechanics decide whether *your* interfaces can evolve.

## Phase gate contribution

The gate's `PaymentProcessor` is an interface on purpose — chunk 3 walks
the design from first method to sealed hierarchy and shows where an
abstract skeleton earns its place beside it.

---

← Prev: [Polymorphism and dynamic dispatch](../04-polymorphism-dispatch/README.md) · Index: [Phase 2 — Classes and objects](../README.md) · Next → [`equals` and `hashCode`](../06-equals-hashcode/README.md)
