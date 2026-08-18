---
title: "Polymorphism and dynamic dispatch"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §15.12 (method invocation
> expressions, compile-time and run-time steps), the JVMS SE 25 §6.5
> (`invokevirtual`, `invokeinterface`, `invokespecial`, `invokestatic`,
> `invokedynamic`) and §5.4.3.3–5.4.3.4 (method resolution), and the HotSpot
> inlining and deoptimization notes in the JDK documentation.

**One line — `repository.save(order)` — and two different machines decide what
runs. At compile time, the *static* types pick which method signature (which
overload). At run time, the *dynamic* type of the receiver picks which
implementation (which override). Every framework you will use — Spring
proxies, servlet containers, JDBC drivers, listeners — is an industrial
application of that second step: code written against an interface, behaviour
supplied by whatever object actually arrives.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The two machines](01-the-two-machines.md)** | Compile-time overload selection vs run-time override selection, what dispatches and what never does, field hiding, `super`, constructors calling overridables, covariant returns and bridge methods |
| 2 | **[The machinery and the JIT](02-the-machinery-and-the-jit.md)** | The five `invoke*` instructions, vtables and itables, devirtualization and inlining, deoptimization, mono/bi/megamorphic call sites, the performance myths |
| 3 | **[Dispatch in the wild](03-dispatch-in-the-wild.md)** | Spring DI and AOP proxies, self-invocation, template method and callbacks, the `equals` dispatch question, single dispatch → visitor, sealed types + pattern `switch` as the modern alternative |

## Why this is a Master topic

"Framework magic" stops being magic once you see the dispatch. Spring
injecting an implementation, `@Transactional` wrapping your method, JUnit
calling your test class, a servlet container calling `doGet` — all of it is
one mechanism: a virtual call through a table the receiver object carries.
The bugs are equally mechanical: overload picked by a static type you forgot
you had, a field read that ignores the object's real class, a proxy silently
bypassed by `this.method()`.

## Phase gate contribution

The gate's sealed `PaymentResult` is handled two ways — classic virtual
dispatch and pattern-matching `switch` — and chunk 3 is where you learn to
choose between them.

---

← Prev: [Inheritance](../03-inheritance.md) · Index: [Phase 2 — Classes and objects](../README.md) · Next → [Abstract classes vs interfaces](../05-abstract-vs-interfaces.md)
