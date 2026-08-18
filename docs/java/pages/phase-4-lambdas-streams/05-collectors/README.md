---
title: "Collectors — how pipelines become data structures"
sidebar_label: "05 · Collectors"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.util.stream.Collectors` (all factory methods), the
> `java.util.stream.Collector` interface (supplier / accumulator / combiner /
> finisher / characteristics), and `Stream#collect`.

**A collector is the answer to "and now what do I do with this stream?" —
the terminal step that folds elements into a list, a map, a grouped
`Map<K, List<V>>`, a joined string, or any accumulation you can describe
with four functions. Most days you compose from the `Collectors` factory
methods and never write one; but one of those factories — `toMap` without a
merge function — carries the most famous production crash in the stream API
(`IllegalStateException: Duplicate key`), and `groupingBy` with downstream
collectors is the single most expressive tool in the library. Master the
factories, know the crash, and understand the four-function machine
underneath so custom accumulation holds no fear.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The everyday collectors](01-everyday-collectors.md)** | `toList`/`toSet`/`toUnmodifiableList` and their mutability fine print, `toMap` and the duplicate-key `IllegalStateException` — the crash, the merge function, the map-supplier overloads — and `joining` |
| 2 | **[Grouping and partitioning](02-grouping-partitioning.md)** | `groupingBy` alone and with downstream collectors (`counting`, `mapping`, `summingLong`, `filtering`, `teeing`), multi-level grouping, `partitioningBy` and when it beats a boolean `groupingBy` |
| 3 | **[The machine underneath](03-the-machine-underneath.md)** | What a `Collector` actually is — supplier, accumulator, combiner, finisher, characteristics — `Collector.of`, the three-arg `collect`, and mutable reduction vs `reduce` |

## Why this is a Master topic

`toMap`'s duplicate-key crash is the stream bug that *ships*: it passes every
test written against tidy fixture data and detonates the first time
production data contains two rows with the same key. `groupingBy` +
downstream is how experienced Java reads — "count orders per customer" is one
line, not a loop with a `merge` call — and interviewers use it as the
dividing line between "has seen streams" and "thinks in them". The
`Collector` contract underneath explains behaviours that otherwise look like
magic: why parallel collection is safe with an unsynchronized `ArrayList`,
and why `groupingByConcurrent` exists at all.

## Phase gate contribution

The gate pipeline — "group orders by customer, keep the three most recent
each" — is `groupingBy` with a downstream that sorts and limits; chunk 2
builds exactly that shape. The "sum revenue per product" half is
`groupingBy(product, summingLong(price))`.

---

← Prev: [map, filter, flatMap and friends](../04-map-filter-flatmap/README.md) · Index: [Phase 4 — Lambdas, streams and Optional](../README.md) · Next → [reduce and primitive streams](../06-reduce-primitive-streams.md)
