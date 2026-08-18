---
title: "Designing immutable classes"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JLS SE 25 §17.5 (final field semantics),
> the JDK 25 Javadoc for `List.copyOf`/`Map.copyOf` and
> `Collections.unmodifiableList`, JEP 395 (records), and Effective Java
> 3rd ed. Items 17, 50 and 83 where cited.

**An immutable object cannot change after construction — which means it can
be shared between threads, used as a map key, cached, and aliased freely,
with an entire class of bugs gone by construction. But immutability is a
*whole-object property that must be engineered*, not a keyword: `final` on a
field stops reassignment, not mutation of what it points to. The recipe has
five parts, and skipping any one of them silently produces a mutable class
that everyone treats as immutable — the worst of both worlds.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The recipe and defensive copies](01-the-recipe-and-defensive-copies.md)** | The five parts, copy-in and copy-out in full, `copyOf` vs `unmodifiableList`, copy-before-validate (TOCTOU), the leaked-`this` rule |
| 2 | **[What it buys — threads, keys, records](02-what-it-buys-threads-keys-records.md)** | Free thread-safety, the JLS §17.5 final-field guarantee, safe hash keys, aliasing freedom, records as the recipe-in-one-line and their shallowness |
| 3 | **[Builders, laziness and cost honesty](03-builders-laziness-and-cost.md)** | The builder implemented in full, lazy fields inside immutable classes (the racy single-check idiom), what updates really cost, where the pattern stops |

## Why this is a Master topic

Immutability is the cheapest concurrency strategy Java has — Phase 6
builds its whole first answer on it — and the most common *silent
failure*: a class that looks immutable, is documented immutable, and
mutates in production because one list was stored without a copy. The
recipe is mechanical; knowing which part was skipped when a "constant"
changes is the debugging skill.

## Where this connects

- **[`equals`/`hashCode`](../06-equals-hashcode/README.md)** — immutable
  keys are what make hash containers safe; the mutated-key walkthrough
  lives there.
- **[Records](../08-records/README.md)** — the language feature that
  automates three of the five parts, and exactly which two it doesn't.
- **[Composition over inheritance](../13-composition-over-inheritance.md)** —
  closing the class (part 1) is the same move as preferring composition.
- **Phase 6 — Concurrency** *(not written yet)* — safe publication and the
  JMM own the deep version of the §17.5 guarantee.

---

← Prev: [Nested classes](../11-nested-classes.md) · Index: [Phase 2 — Classes and objects](../README.md) · Next → [Composition over inheritance](../13-composition-over-inheritance.md)
