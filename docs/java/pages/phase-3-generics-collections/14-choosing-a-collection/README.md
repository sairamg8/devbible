---
title: "Choosing a collection — the decision table"
sidebar_label: "14 · Choosing a collection"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for the
> `java.util` collection implementations (class-level Javadoc, which states
> each type's documented cost model) and the Collections Framework overview.

**Every "which type do I use?" question resolves on three axes: how you look
things up, what order you need back, and how the data mutates. Answer those
three and the type names itself — and in an API-design interview, naming the
type *with its documented costs* is the difference between "knows Java" and
"has the Javadoc's cost model in their head".**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The decision table](01-the-decision-table.md)** | The three axes, the table itself, the documented cost of every operation you'll name, the defaults that win 90% of the time |
| 2 | **[Worked scenarios](02-worked-scenarios.md)** | The phase-gate scenario and five more real shapes — LRU, scheduling, range queries, dedupe with case rules — each argued from the axes |
| 3 | **[API shape and sizing](03-api-shape-and-sizing.md)** | Interface-typed fields and returns, what to hand callers, capacity and load-factor hints, when arrays or `EnumSet`/`EnumMap` beat the general types |

## Why this is a Master topic

The individual types were topics 05–09; this is where they become one
decision. It is also the topic every design interview actually tests: the
question is never "what is a `TreeMap`" but "users by id, signup order
preserved, emails deduped case-insensitively — what do you hold and what
does each operation cost?"

## Phase gate contribution

The gate's scenario is chunk 2's first worked example, argued line by line.

---

← Prev: [Collections and Arrays utilities](../13-collections-arrays-utilities.md) · Index: [Phase 3 — Generics and collections](../README.md) · Next → [Writing an Iterable](../15-writing-an-iterable.md)
