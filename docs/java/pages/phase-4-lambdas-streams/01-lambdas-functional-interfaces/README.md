---
title: "Lambdas and functional interfaces"
sidebar_label: "01 · Lambdas and functional interfaces"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §15.27 (lambda expressions) and
> §9.8 (functional interfaces), the `java.util.function` package Javadoc
> (JDK 25 API documentation), and JEP 126 (lambda expressions, Java 8).

**A lambda is not "a shorter anonymous class" — it is an expression whose
type is borrowed from a *functional interface*: any interface with exactly
one abstract method. That one rule is the whole design. It is why every
modern Java API speaks the `java.util.function` vocabulary
(`Function`, `Supplier`, `Consumer`, `Predicate`), why lambdas can only
capture *effectively final* locals, and why `this` inside a lambda means
the enclosing object — three facts that between them explain nearly every
lambda compile error and lambda bug you will meet.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Syntax, capture and `this`](01-syntax-capture-and-this.md)** | Every syntax form, target typing, effectively final capture, `this`-binding vs anonymous classes, how lambdas are compiled (`invokedynamic`) |
| 2 | **[The `java.util.function` vocabulary](02-the-function-vocabulary.md)** | `Function`/`BiFunction`/`Supplier`/`Consumer`/`Predicate`/operators, the primitive variants and why they exist, `@FunctionalInterface`, writing your own |
| 3 | **[Composition and checked exceptions](03-composition-checked-exceptions.md)** | `andThen`/`compose`/`negate`/`and`/`or`, why checked exceptions and lambdas fight, and the patterns that resolve it |

## Why this is a Master topic

Every phase after this one *assumes* fluency here:

- **Streams (this phase)** — every `map`/`filter`/`collect` argument is a
  functional-interface instance; misreading a signature like
  `Function<? super T, ? extends R>` blocks you from reading the Javadoc
  at all.
- **Spring and testing (phases 9, 11)** — callbacks, `Supplier`-based lazy
  config, Mockito answers: all lambdas against framework-defined
  functional interfaces.
- **Concurrency (phase 6)** — `Runnable`, `Callable`, `CompletableFuture`
  chains are the same machinery under load.

## Phase gate contribution

The gate's "group orders by customer" pipeline is unreadable until
`Function.identity()`, method-reference equivalence, and `Comparator`
composition (phase 3) are automatic — chunks 1 and 3 build exactly that.

---

← Index: [Phase 4 — Lambdas, streams and `Optional`](../README.md) · [Next → Method references](../02-method-references.md)
