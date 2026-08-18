---
title: "The machine underneath: the Collector contract"
sidebar_label: "3 · The machine underneath"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for the
> `java.util.stream.Collector` interface (including its characteristics
> enum and the associativity/identity constraints), `Collector.of`,
> `Stream#collect(Supplier, BiConsumer, BiConsumer)`, and the
> `java.util.stream` package documentation's "Mutable reduction" section.

**Every collector is four functions and a set of flags: a `supplier` that
creates an empty result container, an `accumulator` that folds one element
in, a `combiner` that merges two containers (parallel needs it), and a
`finisher` that converts the container to the final result. That's the whole
machine — `toList` is `ArrayList::new` / `List::add` / `addAll` / identity.
Knowing the contract tells you exactly what a parallel `collect` may do with
your code, when writing a custom collector is justified, and why *mutable
reduction* into an unsynchronized `ArrayList` is safe where the same list as
a `forEach` target is a data race.**

## The four functions, concretely

```java
public interface Collector<T, A, R> {
    Supplier<A>          supplier();      // () -> new ArrayList<>()
    BiConsumer<A, T>     accumulator();   // (list, item) -> list.add(item)
    BinaryOperator<A>    combiner();      // (a, b) -> { a.addAll(b); return a; }
    Function<A, R>       finisher();      // identity, or e.g. List::copyOf
    Set<Characteristics> characteristics();
}
```

`T` = element type, `A` = the (often hidden) accumulation type, `R` = the
result. `A ≠ R` is what makes `joining` work: it accumulates into a
`StringBuilder` and finishes with `toString()`; `averagingLong` accumulates
`long[2]` (sum + count) and finishes with the division.

The three characteristics:

- `IDENTITY_FINISH` — the finisher is identity; the framework may skip it
  and cast `A` to `R`.
- `UNORDERED` — the collector doesn't promise encounter order (e.g.
  `toSet`); the framework may drop ordering constraints.
- `CONCURRENT` — one shared container, all threads accumulate into it
  (`groupingByConcurrent`, `toConcurrentMap`). Without it, parallel
  collection uses per-thread containers + combiner.

## Why parallel `collect` into `ArrayList` is safe

The mutable-reduction section of the package doc is the answer to a
question topic 10 raised: `forEach(list::add)` in parallel is a race, yet
`collect(toList())` in parallel is correct — same `ArrayList`, why?

Because **the framework never shares an unsynchronized container across
threads**. Each parallel subtask calls `supplier()` for its *own* container,
accumulates locally, and the results meet only through `combiner()` — a
handoff with proper synchronization at the fork/join boundaries. The
contract you must uphold in exchange:

- The combiner must be **associative**, and folding via
  supplier/accumulator/combiner in any split must produce an equivalent
  result.
- Accumulator and combiner must not depend on *which* thread runs them, and
  must not mutate anything except the container.

Break associativity (say, an order-dependent merge) and sequential runs
stay right while parallel runs go quietly wrong — the worst failure shape.

## `Collector.of` — custom collectors without a class

Most "custom" collectors should first be attempted as compositions
(`mapping` + `filtering` + `collectingAndThen` go far). When composition
genuinely can't express it, `Collector.of` takes the four functions:

```java
// Collect into an immutable bit set of user ids:
Collector<Integer, BitSet, BitSet> toBitSet = Collector.of(
    BitSet::new,                       // supplier
    BitSet::set,                       // accumulator (bs, id) -> bs.set(id)
    (a, b) -> { a.or(b); return a; },  // combiner
    Collector.Characteristics.IDENTITY_FINISH);

// With a finisher — top-3 via a bounded PriorityQueue, finished as a List:
Collector<Order, PriorityQueue<Order>, List<Order>> top3 = Collector.of(
    () -> new PriorityQueue<>(Comparator.comparing(Order::placedAt)),
    (pq, o) -> { pq.add(o); if (pq.size() > 3) pq.poll(); },
    (a, b) -> { b.forEach(o -> { a.add(o); if (a.size() > 3) a.poll(); }); return a; },
    pq -> pq.stream().sorted(Comparator.comparing(Order::placedAt).reversed()).toList());
```

The second example is the honest version of chunk 2's "top N per group" for
large groups: memory stays at N per group instead of the whole group.

## The three-argument `collect` — the primitive underneath

```java
List<String> list = stream.collect(ArrayList::new, ArrayList::add, ArrayList::addAll);
```

`collect(supplier, accumulator, combiner)` is mutable reduction without a
`Collector` object — no finisher, no characteristics, container is the
result. You'll meet it in two places: older code, and **null-tolerant map
accumulation** where `toMap` refuses:

```java
Map<String, String> nullable = users.stream().collect(
    HashMap::new,
    (m, u) -> m.put(u.id(), u.nickname()),   // nickname may be null — put, not merge
    HashMap::putAll);
```

## Mutable reduction vs `reduce`

`reduce` folds **immutably**: each step produces a *new* value from two
inputs. Reducing 10,000 strings by `(a, b) -> a + b` allocates 10,000
intermediate strings — quadratic character copying. `collect` folds
**mutably**: one container per thread, elements folded *in*. The package
doc's own guidance: when the result is a collection or builder, mutable
reduction; `reduce` is for genuinely scalar folds (sum, max, product). The
next page — [reduce and primitive streams](../06-reduce-primitive-streams.md)
— picks up that half.

## Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| Custom collector right sequentially, wrong or varying in parallel | Non-associative combiner, or accumulator depending on encounter position | Make the fold order-free, or accept sequential-only and document it (the framework will still *call* your combiner in parallel — there's no "sequential-only" flag) |
| `ClassCastException` deep in the framework after `Collector.of` | Declared `IDENTITY_FINISH` while `A` and `R` differ — the framework cast the container to the result type | Only claim `IDENTITY_FINISH` when the finisher truly is identity |
| Custom collector 10× slower than the composed version | Rebuilt `groupingBy`-plus-downstream logic by hand with boxing/copying inside the accumulator | Compose factories first; `Collector.of` is the last resort, not the first |
| `toMap`-style NPE wanted gone, nulls are legitimate values | `toMap` merges via `Map.merge`; null values are contractually rejected | Three-arg `collect` with `HashMap::new` and a plain `put` accumulator |
| Parallel result order scrambled after adding `UNORDERED` | The flag *permits* the framework to ignore encounter order | Drop the characteristic when order matters |
| Combiner never seems to run in tests | Sequential streams never call it — but parallel will | Unit-test the combiner directly; don't infer coverage from sequential runs |
| Quadratic time concatenating strings/lists via `reduce` | Immutable fold copies the accumulated value every step | Mutable reduction: `joining()`, `toList()`, or three-arg `collect` |

## Interview questions

1. **"What are the parts of a `Collector`?"** — Supplier, accumulator,
   combiner, finisher, characteristics — and be able to give `toList`'s
   instantiation of each from memory.
2. **"Why is parallel `collect(toList())` safe when parallel
   `forEach(list::add)` isn't?"** — Mutable reduction gives each subtask its
   own container from `supplier()` and merges via `combiner()` at
   synchronized boundaries; `forEach` hammers one shared unsynchronized
   list from many threads.
3. **"What must be true of the combiner?"** — Associative, and consistent
   with the accumulator (any split then merge ≡ sequential fold). Violations
   only surface in parallel — the nastiest test-escape shape.
4. **"When `A` differs from `R`, what bridges them?"** — The finisher.
   `joining`: `StringBuilder` → `String`; `averaging*`: `long[2]`/`double[2]`
   → the mean. `IDENTITY_FINISH` advertises "no bridge needed".
5. **"Write a collector for the top-N elements."** — Bounded
   `PriorityQueue` supplier, add-then-trim accumulator, merge-then-trim
   combiner, sort-and-list finisher (code above). The point being tested is
   the combiner — most candidates forget parallel merging entirely.
6. **"`reduce` vs `collect` — how do you choose?"** — Immutable scalar fold
   vs mutable container fold. Result is a number → `reduce` (or a primitive
   stream); result is a collection/string/map → `collect`. Concatenating
   collections via `reduce` is the canonical accidental-quadratic.
7. **"What does `CONCURRENT` change?"** — One shared, concurrent container
   instead of per-thread containers + merge; requires an `UNORDERED`-ish
   situation to be a win and a genuinely concurrent container to be correct
   at all.
8. **"Can you use three-arg `collect` to bypass `toMap`'s null-value
   rejection?"** — Yes — `HashMap::new` + `put` accumulator + `putAll`
   combiner; `Map.merge` never enters the picture. Say out loud that you're
   also giving up the duplicate-key detection `toMap` gave you.

---

← Prev: [Grouping and partitioning](02-grouping-partitioning.md) · Index: [Collectors](README.md) · Next → [reduce and primitive streams](../06-reduce-primitive-streams.md)
