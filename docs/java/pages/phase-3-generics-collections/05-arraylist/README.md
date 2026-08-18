---
title: "ArrayList — the default list"
sidebar_label: "05 · ArrayList"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.util.ArrayList`, `java.util.LinkedList`, `java.util.List` (`of`,
> `copyOf`, `subList`) and `java.util.Arrays.asList`, plus the OpenJDK
> `ArrayList` implementation for the growth detail the Javadoc deliberately
> leaves unspecified.

**When the answer to "which collection?" is "a list" — and in application code
it usually is — the answer to "which list?" is `ArrayList`, essentially
always. It is a resizable array: contiguous storage, constant-time indexed
access, amortized constant-time append, and the cache behaviour that makes it
beat `LinkedList` even at the games the big-O table says `LinkedList` should
win. The skill in this topic is knowing its cost model well enough to defend
that default — and knowing the construction and view traps
(`Arrays.asList`, `subList`) that produce the phase's most common
`UnsupportedOperationException` and `ConcurrentModificationException`.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The default list](01-the-default-list.md)** | The backing array, size vs capacity, the unspecified-on-purpose growth policy, what `remove` really costs, nulls and duplicates |
| 2 | **[vs LinkedList — the honest comparison](02-arraylist-vs-linkedlist.md)** | What the Javadoc itself promises for each, why cache locality beats pointer surgery, the few places `LinkedList`/`ArrayDeque` genuinely win |
| 3 | **[Construction, copies and views](03-construction-copies-views.md)** | `new ArrayList<>(...)` vs `Arrays.asList` vs `List.of` vs `List.copyOf`, shallow copies, `subList` as a live view, `toArray` |

## Why this is a Master topic

Every request handler that returns rows, every DTO with a list field, every
loop that accumulates results is this class. The production bugs it causes
are never "ArrayList is broken" — they are a fixed-size view mutated
(`Arrays.asList`), a `subList` outliving a structural change, an O(n²) loop
built out of innocent-looking `remove(0)` calls, or a shared mutable list
handed to a caller. All four are cost-model and ownership questions, which is
exactly what the chunks cover.

## Phase gate contribution

The gate asks you to name types and *the cost of each operation* — chunk 1 is
the `ArrayList` half of that answer, and chunk 2 is why "`LinkedList` for
lots of inserts" fails the follow-up question.

---

[← Prev: The collection hierarchy](../04-collection-hierarchy.md) · Index: [Phase 3 — Generics and collections](../README.md) · Next → [Sets](../06-sets.md)
