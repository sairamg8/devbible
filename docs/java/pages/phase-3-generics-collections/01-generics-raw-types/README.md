---
title: "Generics and raw types"
sidebar_label: "01 · Generics and raw types"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JLS SE 25 §4.5 (parameterized types), §4.8
> (raw types), §5.1.9 (unchecked conversion), §8.1.2 (generic classes) and
> the JDK 25 API documentation for the collections framework.

**Generics move a whole category of bug — the wrong type in a container —
from a `ClassCastException` at 2am to a red squiggle at compile time. A
`List<Order>` is a contract the compiler enforces at every `add` and
delivers on at every `get`. A raw `List` is the same class with the contract
torn up: every read needs a cast, every write is unchecked, and the compiler
that could have caught the mix-up has been told not to look. Raw types exist
only so 2004-era code still compiles — in new code they are a bug factory,
and every `unchecked` warning is the factory floor.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The contract with the compiler](01-the-contract-with-the-compiler.md)** | What a type parameter is, declaring and using generic classes, the diamond `<>`, why `List<String>` beats casts |
| 2 | **[Raw types — the bug factory](02-raw-types-the-bug-factory.md)** | What a raw type actually is, heap pollution in slow motion, every `unchecked` warning decoded, `List` vs `List<Object>` vs `List<?>` |
| 3 | **[Generic methods and invariance](03-generic-methods-and-invariance.md)** | Writing your own generic methods, bounds (`<T extends Comparable<T>>`), inference, and why `List<String>` is not a `List<Object>` |

## Why this is a Master topic

Every collection you declare, every DTO list a controller returns, every
`Map<String, List<Order>>` in a service — the syntax is daily; the
understanding is what keeps it honest:

- **Reading library signatures** — from `Collections.sort` to every Spring
  and Jackson API, the vocabulary is type parameters and bounds.
- **The `unchecked` warning** appears in real codebases weekly; knowing
  which are benign and which are heap pollution is a working skill.
- **Invariance** is the single most-asked generics interview question, and
  chunk 3's answer sets up wildcards ([topic 03](../03-wildcards-pecs.md)).

## Phase gate contribution

The gate asks you to name exact collection types for a requirements
sentence — that answer starts with type parameters chosen correctly, and
never a raw type.

---

← Index: [Phase 3 — Generics and collections](../README.md) · Next → [Type erasure](../02-type-erasure.md)
