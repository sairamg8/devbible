---
title: "The boundaries"
sidebar_label: "3 · The boundaries"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `java.util.concurrent.CopyOnWriteArrayList`,
> `java.util.concurrent.ConcurrentHashMap` (weakly consistent views),
> `java.util.concurrent.ConcurrentModificationException` cross-references,
> `java.util.stream.Stream` (non-interference section) and
> `java.util.Arrays#asList`.

**Fail-fast is one design point, not a law of nature. The
`java.util.concurrent` collections choose differently: their iterators
*never* throw `ConcurrentModificationException`, because each defines a
real answer to "what does a reader see while a writer writes" — a frozen
snapshot (`CopyOnWriteArrayList`) or a weakly consistent live view
(`ConcurrentHashMap`). Knowing which behavior you're holding is the
difference between a listener list that just works and a cache traversal
that quietly reports a mix of old and new state.**

## `CopyOnWriteArrayList` — iterate the past, mutate the present

Every mutation copies the entire backing array; every iterator keeps a
reference to the array that existed **when the iterator was created**.
Consequences, straight from its Javadoc:

- Iteration is CME-free and lock-free — you're walking an immutable
  snapshot no writer can touch.
- The iterator **never sees** additions or removals made after its
  creation, including your own.
- `iterator().remove()`, `set` and `add` throw
  `UnsupportedOperationException` — you can't edit history.
- Writes are O(n) *and* allocate; reads are cheap. The class doc scopes
  it honestly: efficient when traversals **vastly outnumber** mutations.

```java
private final List<Listener> listeners = new CopyOnWriteArrayList<>();

void fire(Event e) {
    for (Listener l : listeners) l.onEvent(e);   // snapshot — handlers may
}                                                 // subscribe/unsubscribe freely
```

Listener/observer registries are the canonical fit: tiny, read-heavy,
mutated by re-entrant callbacks. A 10k-element hot-write list is the
canonical misfit — every `add` copies 10k references.

## `ConcurrentHashMap` — weakly consistent views

`ConcurrentHashMap`'s iterators (over `keySet()`, `values()`,
`entrySet()`) and its streams are **weakly consistent**: they never throw
CME, they traverse elements as they existed **at some point** during the
walk, and they **may or may not** reflect modifications made after the
iterator was created. Same for `forEach`, `search` and the bulk methods.

That's a real contract, not a bug: a cache-eviction sweep over a live map
sees a self-consistent-enough view without stopping writers. But it means
**a traversal is not a snapshot** — two walks during heavy writes can
report different sizes, and an entry `put` mid-walk may or may not appear.
If you need a moment-in-time picture, copy: `Map.copyOf(chm)` (itself a
walk with the same caveat) or design for it upstream.

The same weakly-consistent promise covers `ConcurrentLinkedQueue`,
`ConcurrentSkipListMap`/`Set`, and the `BlockingQueue` implementations'
iterators.

## `Collections.synchronizedX` — the one that still throws

The synchronized wrappers make each *method call* atomic, nothing more.
Their iterators are the plain fail-fast ones, and the Javadoc requires the
caller to hold the wrapper's own monitor for the whole traversal:

```java
List<Task> tasks = Collections.synchronizedList(new ArrayList<>());
synchronized (tasks) {                    // mandatory — the doc's own idiom
    for (Task t : tasks) { process(t); }  // otherwise: CME or worse under writes
}
```

Forgetting the manual `synchronized` block is the classic
"synchronizedList still gave me CME" surprise. If iteration under
concurrency is the common case, this wrapper is the wrong tool — that's
what the concurrent collections are for.

## Streams — non-interference, and laziness widening the window

A stream over a fail-fast collection inherits fail-fast behavior, with a
twist: **pipelines are lazy**, so the modification can happen *between*
building the stream and running it, and the CME arrives at the terminal
operation — a line that looks innocent:

```java
Stream<Order> pending = orders.stream().filter(Order::isPending);
orders.add(newOrder);                 // structural modification...
List<Order> result = pending.toList(); // ...throws CME here, at the terminal op
```

The `Stream` package doc names the rule **non-interference**: the source
must not be structurally modified while the pipeline runs (and for
fail-fast sources, from creation to completion). Mutating the source from
*inside* a pipeline stage — `forEach(o -> orders.remove(o))` — is the same
violation with a shorter fuse. Streams over concurrent collections are the
sanctioned exception: their sources permit concurrent modification, at
weak-consistency semantics.

## The fixed-size and immutable edges

Not every non-throwing collection is safe to mutate — some just refuse:

- **`Arrays.asList(array)`** — fixed-size live view of the array: `set`
  works (writes through to the array), `add`/`remove` throw
  `UnsupportedOperationException`. Iteration never CMEs for `set`, because
  replacement isn't structural.
- **`List.of` / `Map.of` / `List.copyOf`** — fully immutable: every
  mutator throws, so there is nothing to modify concurrently and iteration
  is trivially safe to share across threads. Immutability is the *third*
  answer to concurrent iteration, and often the best one
  ([Immutable collections](../12-immutable-collections.md)).
- **`Map.of` iteration order is deliberately randomized** per JVM run —
  not a concurrency effect, but regularly mistaken for one when a test
  "sometimes" sees a different order.

## Choosing the boundary behavior

| Situation | Reach for | Iteration semantics |
|---|---|---|
| Read-mostly list, re-entrant/concurrent mutation (listeners, routes) | `CopyOnWriteArrayList` | frozen snapshot, never CME |
| Shared map, concurrent readers and writers | `ConcurrentHashMap` | weakly consistent, never CME |
| Shared queue between producer/consumer threads | `ConcurrentLinkedQueue` / `BlockingQueue` | weakly consistent |
| Data that never changes after construction | `List.of` / `Map.copyOf` | trivially safe, immutable |
| Single-threaded mutation during iteration | fail-fast + [chunk 2's patterns](02-safe-patterns.md) | fail-fast |
| Legacy code already on synchronized wrappers | keep, but `synchronized` around every traversal | fail-fast |

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `UnsupportedOperationException` from `it.remove()` on a `CopyOnWriteArrayList` | COW iterators are read-only snapshots | Call `list.remove(...)` directly — it's thread-safe — or collect-then-`removeAll` |
| Elements added during a COW iteration "don't show up" | By design: the iterator holds the array from creation time | If the walk must see them, re-iterate; if not, this is the feature you chose |
| `ConcurrentHashMap` sweep reports a size/state that was never true at any instant | Weakly consistent traversal overlapped writes | Accept it (usually fine for sweeps/metrics), or snapshot first, or quiesce writers |
| `synchronizedList` throws CME "despite being synchronized" | Wrapper locks per call; traversal has gaps | Hold `synchronized (list)` across the whole iteration — or migrate to a concurrent collection |
| CME at `.toList()`/`.forEach(...)`, far from any visible loop | Lazy pipeline; source structurally modified between stream creation and terminal op | Keep creation and terminal op adjacent; never mutate the source mid-pipeline (non-interference) |
| Write throughput collapses after "fixing" CME with `CopyOnWriteArrayList` | Every write copies the whole array — wrong read/write ratio | COW is for read-mostly; use `ConcurrentHashMap`-backed structures or confinement for write-heavy data |
| Test asserts `Map.of(...)` iteration order and fails on another JVM/run | Immutable maps randomize iteration order per run, on purpose | Never assert order on unordered maps; use `LinkedHashMap` or sort at the point of use |

## Interview questions

1. **Why do `ConcurrentHashMap` iterators never throw CME?** They're
   weakly consistent by contract: they traverse a live structure that
   tolerates concurrent updates, reflecting each update or not — there's
   no `modCount` tripwire because concurrent modification isn't a contract
   violation there.
2. **"Weakly consistent" vs "snapshot" — what's the practical
   difference?** COW iterators see a frozen moment (nothing after
   creation, guaranteed). Weakly consistent iterators see a moving window
   — no CME and no torn elements, but updates during the walk may or may
   not appear, so aggregate views (counts, sums) can correspond to no
   single instant.
3. **When is `CopyOnWriteArrayList` the right call, and what does it
   cost?** Traversals vastly outnumber writes and iteration must tolerate
   concurrent (often re-entrant) mutation — listener registries. Cost:
   O(n) copy + allocation per write, and iterators that can't `remove`.
4. **Does `Collections.synchronizedList` make iteration safe?** No — only
   individual calls. The traversal must be wrapped in
   `synchronized (list) { ... }` manually (its Javadoc says exactly this),
   or you get fail-fast behavior with concurrent writers.
5. **A stream threw CME at the terminal operation, three lines after the
   stream was built — what happened?** Laziness: the source was
   structurally modified between pipeline construction and execution. The
   non-interference rule covers the whole span, not just the visible loop.
6. **Are immutable collections "thread-safe"?** Yes, trivially, for what
   they are: no mutation exists to race with, so any number of threads may
   iterate freely. The concurrency question moves to how the *reference*
   is published — a `volatile`/`final` field holding successive immutable
   snapshots is a lock-free pattern of its own.
7. **You need a point-in-time report over a hot `ConcurrentHashMap` — the
   sums must be from one instant. Options?** A weakly consistent walk
   can't promise that. Either quiesce/partition writers, maintain the
   aggregate transactionally alongside the writes (e.g., `LongAdder` per
   bucket), or version the data so readers walk an immutable snapshot —
   the CHM itself can't give an instantaneous cut.

---

← Prev: [The safe patterns](02-safe-patterns.md) · Index: [Iteration and `ConcurrentModificationException`](README.md)
