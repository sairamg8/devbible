---
title: "Queues and deques"
sidebar_label: "09 · Queues and deques"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 API documentation for `java.util.Queue`,
> `java.util.Deque`, `java.util.ArrayDeque`, `java.util.PriorityQueue` and the
> `java.util.Stack` class Javadoc (which itself recommends `Deque`).

**Java has one queue *interface* pair — `Queue` for one end, `Deque` for both —
and two everyday implementations: `ArrayDeque` when you need FIFO or LIFO
order, `PriorityQueue` when you need "most urgent next" order. The
classic mistakes are using the legacy `java.util.Stack` class (its own Javadoc
tells you not to), and iterating a `PriorityQueue` expecting sorted order —
it only promises the *head* is smallest, never the iteration sequence.**

## The interfaces: two verbs per operation, on purpose

`Queue` defines every operation twice — one form throws when it can't comply,
one reports with a return value:

| Operation | Throws | Returns special value |
|---|---|---|
| Insert | `add(e)` — `IllegalStateException` if full | `offer(e)` — `false` if full |
| Remove head | `remove()` — `NoSuchElementException` if empty | `poll()` — `null` if empty |
| Examine head | `element()` — `NoSuchElementException` if empty | `peek()` — `null` if empty |

For the unbounded collections in this page (`ArrayDeque` grows,
`PriorityQueue` grows) the insert forms behave identically — the split matters
at the *empty* end and for the bounded blocking queues you meet in
**Phase 6 · Concurrency** *(not written yet)*, which reuse exactly this
vocabulary. Day-to-day rule: **`offer`/`poll`/`peek`** and check for `null`,
or `remove()`/`element()` when an empty queue is a bug you *want* thrown.

One consequence of `poll()` returning `null` for "empty": these collections
reject `null` elements — `ArrayDeque` and `PriorityQueue` both throw
`NullPointerException` on insertion, because a stored `null` would be
indistinguishable from "nothing there".

`Deque` extends `Queue` with the `First`/`Last` families (`addFirst`,
`pollLast`, …) so one type serves both disciplines:

- **Queue (FIFO)** — insert at tail, remove at head: `offer` + `poll`.
- **Stack (LIFO)** — insert and remove at the same end: `push` + `pop`
  (aliases for `addFirst`/`removeFirst`).

## `ArrayDeque` — the default for both stacks and queues

```java
Deque<Task> queue = new ArrayDeque<>();   // FIFO work queue
queue.offer(t1);
Task next = queue.poll();                 // t1 — first in, first out

Deque<Frame> stack = new ArrayDeque<>();  // LIFO undo stack
stack.push(f1);
Frame top = stack.pop();                  // f1 — last in, first out
```

A resizable circular array: both ends are O(1) amortized, elements are
contiguous (cache-friendly, no per-node allocation — the same reason
[`ArrayList` beats `LinkedList`, topic 05](05-arraylist/02-arraylist-vs-linkedlist.md)), and it has no capacity
limit. The Javadoc states it plainly: *likely faster than `Stack` when used
as a stack, and faster than `LinkedList` when used as a queue*.

**Why not `java.util.Stack`?** It extends `Vector` (see
[topic 16 — legacy types](16-legacy-types.md)): every method synchronized,
and — worse — it *is-a* `List`, so `stack.add(2, x)` can insert into the
middle of your "stack". The `Stack` Javadoc itself says a `Deque` should be
used in preference. Same reasoning as
[composition over inheritance](../phase-2-classes-objects/13-composition-over-inheritance.md):
`Stack extends Vector` leaks the whole `Vector` API into the abstraction.

What `ArrayDeque` gives up: no index access (`get(i)` doesn't exist — if you
need it you wanted a `List`), no `null`s, and its iterator is fail-fast
([topic 11](11-concurrent-modification/README.md)).

## `PriorityQueue` — "next most urgent", not "sorted"

```java
record Job(String id, int priority, Instant enqueued) {}

Queue<Job> jobs = new PriorityQueue<>(
    Comparator.comparingInt(Job::priority)          // lower number = first
              .thenComparing(Job::enqueued));       // FIFO among equals

jobs.offer(new Job("a", 5, Instant.now()));
jobs.offer(new Job("b", 1, Instant.now()));
Job next = jobs.poll();                             // "b" — smallest first
```

A binary min-heap over an array: the element the comparator ranks *smallest*
is always at the head. `offer` and `poll` are O(log n), `peek` is O(1).
Elements must be comparable — either implementing `Comparable` or via a
`Comparator` given at construction ([topic 10](10-comparable-comparator/README.md));
inserting an element it can't compare throws `ClassCastException`.

**The trap: only the head is ordered.** The backing array is a heap, not a
sorted list, and the Javadoc is explicit that the iterator *is not guaranteed
to traverse the elements in any particular order*. So:

```java
for (Job j : jobs) { ... }        // heap order — looks shuffled. NOT a bug.
jobs.stream().toList();           // same arbitrary order
```

To consume in priority order, **drain it**: `while ((j = jobs.poll()) != null)`.
To get a sorted snapshot without draining, copy and sort. Note the asymmetry:
draining n elements is O(n log n) — there is no free sorted view.

Two more properties worth knowing before you build a scheduler on it:
equal-priority elements have **no FIFO guarantee** (ties are arbitrary — add a
timestamp tiebreaker as above if arrival order matters), and `remove(Object)` /
`contains` are O(n) linear scans. It is also unbounded and not thread-safe —
the concurrent, blocking variant is **Phase 6's `PriorityBlockingQueue`**
*(not written yet)*.

## Choosing the shape

| Need | Type |
|---|---|
| Process in arrival order (work queue, BFS frontier) | `ArrayDeque` as FIFO |
| Undo/redo, matching brackets, depth-first traversal | `ArrayDeque` as stack |
| Always take the most urgent / smallest / soonest | `PriorityQueue` |
| Sliding window over both ends | `ArrayDeque` (that's the "deque" case) |
| Hand work between threads | Phase 6's `BlockingQueue` family — not these |

Scheduling-shaped work is where `PriorityQueue` earns its name: retry queues
ordered by next-attempt time, merging n sorted streams (offer the head of
each, poll, offer that stream's next), top-k selection (keep a k-sized heap
of the *worst* accepted so far). If you catch yourself calling
`Collections.sort` inside a loop that only ever consumes the first element,
you are hand-rolling a worse `PriorityQueue`.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Iterating a `PriorityQueue` prints "random" order | Heap array order, not sorted order — iterator order is explicitly unspecified | Drain with `poll()` in a loop, or copy-and-sort for a snapshot |
| Equal-priority jobs run in unpredictable order | `PriorityQueue` does not promise FIFO among ties | Add a tiebreaker: `.thenComparing(Job::enqueued)` or a monotonic sequence number |
| `NullPointerException` from `queue.offer(null)` | `ArrayDeque` and `PriorityQueue` reject `null` — it's the "empty" sentinel for `poll`/`peek` | Never store `null`; use an explicit sentinel object or `Optional` at the boundary |
| `poll()` returns `null` and code NPEs later | Empty queue reported by value, not exception | Check for `null`, or use `remove()` if empty-here is a bug worth throwing |
| `ClassCastException` on the *second* `offer` | Elements not `Comparable` and no `Comparator` supplied — first insert has nothing to compare against | Pass a `Comparator` at construction, or implement `Comparable` |
| Stack built on `java.util.Stack` corrupts under load | It extends `Vector`: full `List` API exposed, per-method locking that still doesn't make compound ops atomic | `ArrayDeque` with `push`/`pop`; for cross-thread hand-off use Phase 6's queues |
| Priority changes after insertion are ignored | The heap ordered the element at `offer` time; mutating the field doesn't re-heapify | Remove and re-offer the element — or store immutable jobs ([records](../phase-2-classes-objects/08-records/README.md)) and replace |
| `remove(Object)` on a big `PriorityQueue` is slow | O(n) scan — a heap has no lookup index | If you need cancel-by-key, pair the heap with a `HashMap`, or mark-cancelled and skip on poll |

## Interview questions

1. **Why does `Queue` define both `add`/`offer` and `remove`/`poll`?**
   One family throws on failure, the other reports by return value. For
   bounded queues "full" and for all queues "empty" can be normal conditions
   (poll and check `null`) or bugs (let `remove()` throw) — the API lets you
   pick per call site.
2. **Why should `ArrayDeque` replace `java.util.Stack`?** `Stack` extends
   `Vector`: it inherits index-based insertion that can violate LIFO,
   synchronizes every method whether needed or not, and its own Javadoc
   recommends `Deque`. `ArrayDeque` is faster and exposes only end
   operations.
3. **Is a `PriorityQueue` sorted?** No. It's a binary heap: only the head is
   guaranteed to be the smallest per the comparator. Iteration order is
   unspecified; getting everything in order requires draining (O(n log n)).
4. **How do you make a `PriorityQueue` FIFO among equal priorities?** It
   doesn't do that itself — extend the comparator with a tiebreaker
   (`thenComparing` an enqueue timestamp or monotonically increasing
   sequence number).
5. **Why do `ArrayDeque` and `PriorityQueue` forbid `null`?** `poll()` and
   `peek()` return `null` to mean "empty" — a stored `null` would make that
   ambiguous. (`LinkedList`, which permits `null`, has exactly that
   ambiguity.)
6. **What happens when you mutate a field that a queued element's priority
   depends on?** Nothing, until too late: the heap doesn't watch fields. The
   element sits where the old priority put it. Remove and re-insert, or use
   immutable elements.
7. **You need the 10 largest of a million values without sorting them all —
   what's the shape?** A min-heap of size 10: offer each value, and when
   size exceeds 10, poll (evicting the smallest of the kept). O(n log k)
   instead of O(n log n).
8. **When is `LinkedList` the right queue?** Almost never — `ArrayDeque` is
   faster for both stack and queue use (contiguous memory, no per-node
   allocation). `LinkedList`'s remaining niche is O(1) removal *via a
   `ListIterator` you're already holding* mid-list, which queue use doesn't do.

---

[← Prev: `LinkedHashMap` and `TreeMap`](08-linkedhashmap-treemap.md) · Index: [Phase 3 — Generics and collections](README.md) · Next → [`Comparable` vs `Comparator`](10-comparable-comparator/README.md)
