---
title: "Stateful ops, bounding ops, and peek"
sidebar_label: "2 · Stateful, bounding, peek"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the JDK 25 API documentation for
> `Stream#sorted`, `Stream#distinct`, `Stream#limit`, `Stream#skip`,
> `Stream#peek`, and the `java.util.stream` package documentation
> (stateful intermediate operations, short-circuiting, encounter order).

**"Streams are lazy" is only true of stateless operations. `sorted` and
`distinct` are what the package documentation calls *stateful* intermediate
operations: `sorted` cannot emit a single element until it has seen them
all, and `distinct` must remember every element it has passed. They are
where a pipeline stops being a conveyor belt and grows a warehouse. The
bounding pair `limit`/`skip` is the opposite kind of special —
*short-circuiting*, able to stop the whole pipeline early — and `peek` is
the op that does nothing to the data and therefore only makes sense for
watching it go by.**

## `sorted` — the buffer in the middle of your pipeline

```java
List<Order> latestFirst = orders.stream()
    .sorted(Comparator.comparing(Order::placedAt).reversed())
    .limit(3)
    .toList();
```

- `sorted` **buffers the entire stream** before emitting anything — the
  Javadoc classifies it as a stateful intermediate operation. Everything
  upstream runs to completion for all elements before anything downstream
  sees the first one. Laziness effectively ends at `sorted`.
- Consequence: **filter before you sort.** `filter(...).sorted(...)` sorts
  the survivors; `sorted(...).filter(...)` sorts everything, then throws
  most of it away.
- The no-arg `sorted()` requires elements to be `Comparable` — if they're
  not, you get a `ClassCastException` **at terminal-op time**, not where
  you wrote `sorted()`. Prefer the explicit-`Comparator` overload; building
  good comparators is a Phase 3 topic
  ([Comparable vs Comparator](../../phase-3-generics-collections/10-comparable-comparator/README.md)).
- Sorting an already-sorted source: `sorted` on a `TreeSet`-backed stream
  may still buffer — don't rely on the runtime detecting sortedness; keep
  data in the right structure instead.

## `distinct` — dedup by `equals`, remember everything

```java
Stream.of("a", "b", "a").distinct()    // "a", "b"
```

- Uniqueness is decided by **`equals`** — so your element type's
  [`equals`/`hashCode` contract](../../phase-2-classes-objects/06-equals-hashcode/README.md)
  is load-bearing here. Records get this right for free; hand-written
  classes that skip `hashCode` make `distinct` quietly keep duplicates.
- `distinct` is stateful: it holds the set of seen elements for the life of
  the pipeline. A `distinct` over millions of large objects is a memory
  decision, not a one-liner.
- For an ordered stream the Javadoc guarantees the **first** occurrence
  wins; for unordered streams any duplicate may be the survivor. "Dedupe by
  a key, keeping the newest" is **not** `distinct` — that's a
  `toMap(key, identity, mergeFunction)` job (next topic,
  [Collectors](../05-collectors/README.md)).

## `limit` and `skip` — the bounding pair

```java
orders.stream().skip(20).limit(10)     // page 3 of a page-size-10 listing
```

- `limit(n)` is **short-circuiting**: once n elements have passed, upstream
  simply stops being pulled. `findFirst`, `anyMatch` and friends share this
  property — it's what makes infinite streams usable at all.
- `skip(n)` still has to *produce and discard* n elements — skipping is not
  seeking. Paging with `skip` over an expensive source re-does the work of
  every earlier page (the same reason SQL `OFFSET` gets slow).
- Order matters and is not commutative: `skip(2).limit(3)` takes elements
  3–5; `limit(3).skip(2)` takes element 3 only.
- On **parallel** ordered streams, `limit`/`skip` must respect encounter
  order, which the package doc warns can make them expensive rather than
  cheap — another entry in the "parallel isn't free" ledger (topic 09,
  [Parallel streams](../09-parallel-streams.md)).

## `peek` — debugging, and honestly nothing else

```java
.peek(o -> log.debug("after filter: {}", o))
```

- The Javadoc says it plainly: `peek` "exists mainly to support debugging".
  It receives each element *as it flows past* and must not modify anything.
- **`peek` is not guaranteed to run per element of the source.** Downstream
  short-circuiting (`limit`, `findFirst`) means upstream elements may never
  be pulled — and their `peek` never fires. A count kept in a `peek` is
  wrong the day someone adds a `limit`.
- Since the operation is only executed "when required for the correctness
  of the computation" in optimized pipelines, side effects in `peek` (and
  the counting trick) are unreliable by specification, not by accident.
- Using `peek` to *mutate* elements ("set a field on the way through") is
  the classic abuse: it works until the pipeline is parallelized or
  reordered, and it hides a write where readers expect observation. Do the
  mutation in `map` (returning a new value) or in the terminal `forEach`.

## The cost model in one table

| Op | Category | Laziness impact |
|---|---|---|
| `map` / `filter` / `flatMap` | stateless intermediate | fully lazy, streams element-by-element |
| `sorted` | **stateful** intermediate | buffers *everything* before emitting |
| `distinct` | **stateful** intermediate | remembers all seen elements |
| `limit` | short-circuiting intermediate | can stop upstream early |
| `skip` | intermediate | discards — upstream still runs for skipped elements |
| `peek` | intermediate, side-effect | may not run under short-circuiting |

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Pipeline over a huge source is slow/OOMs at `sorted` | `sorted` buffers the entire stream — laziness ends there | Filter first; sort the smallest possible set; or keep data pre-sorted (`TreeMap`/`TreeSet`) |
| `ClassCastException: X cannot be cast to Comparable` at the terminal op | No-arg `sorted()` on non-`Comparable` elements | Pass a `Comparator`; the failure point is far from the cause, so prefer explicit comparators always |
| `distinct` doesn't remove "obvious" duplicates | Element type doesn't override `equals`/`hashCode` (identity comparison) | Fix the contract (record, or implement both) — see [equals/hashCode](../../phase-2-classes-objects/06-equals-hashcode/README.md) |
| Memory climbs linearly during a long pipeline with `distinct` | `distinct` retains every seen element until the pipeline ends | Dedupe by key into a `Map` instead, or bound the stream first |
| Log lines from `peek` missing for some elements | Downstream `limit`/`findFirst` short-circuited — those elements were never pulled | Expected behaviour; never rely on `peek` running per source element |
| Counter incremented in `peek` disagrees with `count()` | Side effects in `peek` are unreliable under optimization and short-circuiting by spec | Count with the terminal op; keep `peek` side-effect-free except logging |
| Paging with `skip(n)` gets slower page by page | `skip` discards after producing — upstream work still happens for skipped elements | Page at the source (query/index), not in the stream |
| `limit`+`skip` return the wrong window | The two don't commute: `skip` then `limit` ≠ `limit` then `skip` | Write `skip(offset).limit(pageSize)` for paging |

## Interview questions

1. **"Which stream operations are *stateful*, and why does it matter?"** —
   `sorted` and `distinct` (also `limit`/`skip` in the parallel-ordered
   case). Stateful ops must see or remember elements beyond the current one,
   so they buffer or retain state — ending effective laziness and adding
   memory cost. The package documentation defines the category.
2. **"Why should `filter` come before `sorted`?"** — `sorted` buffers and
   sorts everything it receives; filtering first shrinks the buffered set.
   Same result, strictly less work — the optimizer will not reorder them
   for you.
3. **"What decides uniqueness in `distinct`?"** — `equals` (with `hashCode`
   backing the internal set). Broken contract → broken dedup. Ordered
   streams keep the first occurrence by contract.
4. **"Is `peek` guaranteed to see every element of the source?"** — No.
   Short-circuiting downstream (`limit`, `findFirst`, `anyMatch`) means
   elements may never be pulled, and the spec allows eliding the op when
   not required for correctness. It's for debugging observation only.
5. **"How do you take elements 21–30 of a stream, and what does it cost?"**
   — `skip(20).limit(10)`. The first 20 elements are still produced and
   discarded — `skip` is not a seek. For real paging, push the offset into
   the data source.
6. **"Dedupe a list of events by `eventId`, keeping the latest — is that
   `distinct`?"** — No: `distinct` uses whole-object `equals` and keeps the
   *first*. Keying and merging is `Collectors.toMap(Event::eventId,
   identity, pickLatest)` — next topic.
7. **"Someone uses `peek(o -> o.setProcessed(true))` — review comment?"** —
   Mutation hidden in an observation op: unreliable under short-circuiting
   (some elements never peeked), order-sensitive under parallelism, and
   misleading to readers. Return an updated value from `map`, or mutate in
   the terminal `forEach` where side effects are expected.

---

← Prev: [The transforming trio](01-the-transforming-trio.md) · Index: [map, filter, flatMap and friends](README.md)
