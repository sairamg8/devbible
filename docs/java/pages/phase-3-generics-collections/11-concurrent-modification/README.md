---
title: "Iteration and ConcurrentModificationException"
sidebar_label: "11 · Iteration and CME"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.util.ConcurrentModificationException`, `java.util.ArrayList`,
> `java.util.Iterator`, `java.util.Collection#removeIf`,
> `java.util.concurrent.CopyOnWriteArrayList` and
> `java.util.concurrent.ConcurrentHashMap`.

**Removing from a list while iterating it is the first collections bug
everyone writes — and `ConcurrentModificationException` is the platform
doing you a favor: failing fast on a traversal whose cursor no longer
means anything, instead of silently skipping or repeating elements. The
exception is mostly a *single-threaded* phenomenon, the detection is
best-effort by contract, and every safe alternative — `Iterator.remove`,
`removeIf`, two-pass mutation, snapshot iteration, the concurrent
collections — exists precisely to make the mutation explicit.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The fail-fast machinery](01-fail-fast-machinery.md)** | What "structural modification" means, `modCount`/`expectedModCount`, why the check lives in `next()` — including the case that *silently skips* instead of throwing — and why fail-fast is best-effort, never a correctness tool |
| 2 | **[The safe patterns](02-safe-patterns.md)** | `Iterator.remove`, `removeIf` (and its O(n) vs O(n²) win on `ArrayList`), `ListIterator.set`/`add`, `entry.setValue`, collect-then-mutate, snapshot iteration — and how to choose |
| 3 | **[The boundaries](03-the-boundaries.md)** | Where fail-fast ends: `CopyOnWriteArrayList` snapshots, `ConcurrentHashMap`'s weakly consistent views, why `synchronizedList` still throws, stream non-interference, and the immutable edge |

## Why this is a Master topic

- **Everyone writes the bug.** `list.remove(...)` inside a `for`-each is
  in every codebase's history — and the *worse* version doesn't throw: it
  silently skips an element depending on which index was removed.
- **The fix is a vocabulary**, not a trick: iterator-owned removal, bulk
  `removeIf`, two-pass mutation, snapshots. Choosing among them is daily
  collections work, and one of them changes the asymptotics.
- **The exception's name misleads** — most CMEs have no concurrency in
  them, and where real concurrency exists, CME is a tripwire rather than
  protection. Knowing what fail-fast does and doesn't promise is what
  makes the `java.util.concurrent` collections' contracts legible.

## Phase gate contribution

The gate's "expire stale sessions from a shared map" shape is chunk 2's
`values().removeIf(Session::isExpired)` — and chunk 3 explains when that
map should have been a `ConcurrentHashMap`, and what its sweep then sees.

---

← Prev: [`Comparable` vs `Comparator`](../10-comparable-comparator/README.md) · Index: [Phase 3 — Generics and collections](../README.md) · Next → [Immutable collections](../12-immutable-collections.md)
