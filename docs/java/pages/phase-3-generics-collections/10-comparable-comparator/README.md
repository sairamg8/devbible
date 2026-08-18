---
title: "Comparable vs Comparator"
sidebar_label: "10 · Comparable vs Comparator"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.lang.Comparable`, `java.util.Comparator`, `java.util.Arrays#sort` and
> `java.util.TreeMap`, and the JLS SE 25 §5.1.2 (widening) for the
> subtraction-overflow chunk.

**Ordering in Java is one method — "is `a` before, equal to, or after `b`?" —
with two homes: `Comparable` when the type itself owns one *natural* order,
`Comparator` when the order belongs to the use site. Every sorted thing in
the platform (`sort`, `TreeMap`, `TreeSet`, `PriorityQueue`, `max`,
`binarySearch`) consumes this one contract — and when an implementation
breaks its rules, the failure is not a wrong order but a
`"Comparison method violates its general contract!"` crash from inside the
sort, or an element that silently vanishes from a `TreeSet`.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Two kinds of order](01-two-orders.md)** | `Comparable` and natural order, the `compareTo` contract, `Comparator` as external order, and which of the two each API consumes |
| 2 | **[Building comparators](02-building-comparators.md)** | `Comparator.comparing`, `thenComparing`, `reversed`, `nullsFirst`/`nullsLast` — and the int-subtraction overflow bug in hand-written comparators |
| 3 | ****The contract, and what breaks it** *(not written yet)*** | The TimSort `IllegalArgumentException`, what "inconsistent" concretely means, and consistency-with-`equals` — the `TreeSet` that disagrees with the `HashSet` |

## Why this is a Master topic

- **Every sorted collection and every sort call** routes through exactly this
  contract — **`TreeMap`/`TreeSet`, topics 06 and 08** *(not written yet)*, sorting for display,
  [`PriorityQueue`](../09-queues-deques.md) scheduling.
- **The failure modes ship.** An overflow comparator or a
  double-compared-with-`<` comparator passes every small test and crashes in
  production, from *inside* `Arrays.sort`, on data you didn't write down.
- **`compare` vs `equals` inconsistency** makes two standard collections give
  different answers to "is this element present?" — the kind of bug that
  costs a day the first time you meet it.

## Phase gate contribution

The gate's "dedupe emails case-insensitively" answer —
`TreeSet` with `String.CASE_INSENSITIVE_ORDER` — is chunk 3's worked
example, including the way it *diverges from* `equals`.

---

← Prev: [Queues and deques](../09-queues-deques.md) · Index: [Phase 3 — Generics and collections](../README.md) · Next → **Iteration and `ConcurrentModificationException`** *(not written yet)*
