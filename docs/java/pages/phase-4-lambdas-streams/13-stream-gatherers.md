---
title: "Stream gatherers: custom intermediate operations"
sidebar_label: "13 · Stream gatherers"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against JEP 485 (Stream Gatherers, final in JDK 24),
> and the JDK 25 API documentation (docs.oracle.com/en/java/javase/25/) for
> `java.util.stream.Gatherer`, `java.util.stream.Gatherers` and
> `Stream.gather`.

**For a decade the stream API had a closed set of intermediate operations:
if `map`/`filter`/`flatMap`/`sorted` couldn't express your transformation —
"group into batches of 100", "emit running totals", "compare each element
with the previous one" — you fell back to loops or a third-party library.
`Stream.gather(Gatherer)` (final in JDK 24, JEP 485) closes that gap: a
`Gatherer` is to intermediate operations what a `Collector` is to terminal
ones — a user-definable, composable transformation that can be stateful,
one-to-many, many-to-one, and can short-circuit.**

## The shape: Collector's sibling

A `Collector` consumes a whole stream into one result. A `Gatherer` sits
*mid-pipeline*: it consumes elements and **pushes** any number of elements
onward. Its four functions mirror the collector's:

| Function | Collector | Gatherer |
|---|---|---|
| `initializer()` | create the container | create private per-run **state** |
| `accumulator()` / **`integrator()`** | fold element into container | consume one element, **push 0..n** elements downstream; return `false` to stop the stream |
| `combiner()` | merge two containers (parallel) | merge two states (parallel; optional) |
| `finisher()` | final transform | emit any last elements when input ends (the incomplete final batch, a grand total) |

Only the integrator is mandatory. A gatherer built with
`Gatherer.ofSequential(...)` declares itself sequential — under
`.parallel()` the surrounding pipeline stages still parallelize, the
gathering stage itself runs in order.

## The built-ins in `Gatherers`

**`windowFixed(n)` — the one everyone was waiting for.** Fixed-size
batches without Guava's `Lists.partition` or a hand-rolled loop:

```java
// insert 10k rows in batches of 500
orderRows.stream()
        .gather(Gatherers.windowFixed(500))       // Stream<List<Row>>
        .forEach(batch -> jdbc.batchInsert(batch));
```

The windows are unmodifiable lists; the last one is smaller if the input
doesn't divide evenly (that final partial window is the finisher doing its
job). Same shape for chunking API calls against a rate-limited endpoint or
paginating outbound requests.

**`windowSliding(n)`** — overlapping windows, each dropping the first
element of the previous and appending the next: pairwise comparison and
moving averages.

```java
// flag any two consecutive readings that jumped more than 10 degrees
readings.stream()
        .gather(Gatherers.windowSliding(2))
        .filter(w -> Math.abs(w.get(1).temp() - w.get(0).temp()) > 10)
        .toList();
```

**`scan(initial, folder)`** — running accumulation, one output per input
(the "running balance" column):

```java
transactions.stream()
        .gather(Gatherers.scan(() -> BigDecimal.ZERO, BigDecimal::add))
        .toList();      // balance after each transaction
```

**`fold(initial, folder)`** — like `scan` but emits only the final value,
as a one-element stream: an ordered, sequential reduce for cases the
associative `reduce` can't express ([topic 06](06-reduce-primitive-streams.md)).

**`mapConcurrent(maxConcurrency, mapper)`** — `map`, but each mapper call
runs in its own **virtual thread**, at most `maxConcurrency` in flight,
with encounter order preserved on output:

```java
// enrich 200 orders against a remote service, 10 requests in flight
orders.stream()
        .gather(Gatherers.mapConcurrent(10, o -> enrichmentClient.lookup(o)))
        .toList();
```

That is the sane replacement for the `parallelStream()`-for-blocking-IO
mistake: explicit concurrency cap, virtual threads instead of the shared
`ForkJoinPool` (the argument of [topic 09](09-parallel-streams.md)).

## Writing your own

"Distinct by key, keeping the first" — the stateful-filter trick that
[the stateful-lambdas topic](10-stateful-lambdas.md) bans becomes a
*legal* stateful operation, because the state now lives inside the
gatherer where the library manages it:

```java
static <T, K> Gatherer<T, ?, T> distinctBy(Function<T, K> key) {
    return Gatherer.ofSequential(
        HashSet<K>::new,                                  // initializer: state
        (seen, element, downstream) -> {                  // integrator
            if (seen.add(key.apply(element))) {
                return downstream.push(element);          // forward, note the return
            }
            return true;                                  // swallow, keep consuming
        }
    );
}

var firstPerCustomer = orders.stream()
        .gather(distinctBy(Order::customerId))
        .toList();
```

Two contract details carry the design:

- **`downstream.push` returns a boolean** — `false` means downstream has
  short-circuited (a later `limit` is full) and wants no more; a
  well-behaved integrator returns that `false` upward.
- **The integrator's own return value is the stop signal** — return
  `false` and the whole upstream stops producing. That is how you write
  `limit`-like and `takeWhile`-like operations, and why gatherers work on
  infinite streams ([previous topic](12-infinite-streams.md)).

A finisher version (`Gatherer.ofSequential(init, integrator, finisher)`)
gets a last callback when input is exhausted — where a batching gatherer
pushes its final partial batch.

Gatherers also **compose**: `g1.andThen(g2)` fuses two into one, and
`stream.gather(g1).gather(g2)` is equivalent — small gatherers chain like
any other intermediate op.

## Gotchas

**Symptom:** processing 10 million rows, `windowFixed` batches show up but memory climbs anyway
**Cause:** the gatherer is fine — the *terminal* op accumulates (`toList()` of all batches); the windows themselves are only materialized per batch
**Fix:** consume batches as they come (`forEach(batch -> ...)`) so each window is garbage after use

**Symptom:** custom gatherer works with `toList()` but streams past a downstream `limit`, doing wasted work
**Cause:** the integrator ignores `downstream.push`'s boolean and always returns `true` — the short-circuit signal never propagates upstream
**Fix:** return `downstream.push(...)`'s result (or `false` on your own stop condition); treat the boolean as load-bearing, never fire-and-forget

**Symptom:** batches lose their tail — the last 37 of 537 rows never processed
**Cause:** a hand-rolled batching gatherer without a finisher: the final partial window is still sitting in state when input ends
**Fix:** supply the finisher and push the remainder there (the built-in `windowFixed` already does)

**Symptom:** `mapConcurrent` with blocking calls is no faster than sequential
**Cause:** blocking inside `synchronized` (which pinned virtual threads before JDK 24's JEP 491 work landed), or the bottleneck is the remote service's own limit, not client concurrency
**Fix:** verify the blocking call is virtual-thread-friendly on your JDK, and size `maxConcurrency` against what the downstream service actually tolerates

**Symptom:** parallel pipeline with a custom gatherer runs the gathering stage on one thread
**Cause:** `Gatherer.ofSequential` declares exactly that — sequential evaluation of the stage, regardless of the pipeline's parallelism
**Fix:** that's usually correct (ordered, stateful logic); only provide a real combiner via `Gatherer.of(...)` when the state genuinely merges

**Symptom:** running on JDK 21/22 the code doesn't compile — `gather` not found
**Cause:** gatherers previewed in 22/23 (JEP 461/473) and are final only from JDK 24 (JEP 485)
**Fix:** JDK 24+, or backport the logic to a loop; don't ship `--enable-preview` for this

## Interview questions

**★ What problem do gatherers solve that the original stream API couldn't?**
Custom *intermediate* operations. The built-in set was closed — stateful,
windowing, or prefix-dependent transformations (batching, running totals,
pairwise comparison, distinct-by-key) had no home and forced loops,
collectors abuse, or third-party libraries. `Gatherer` makes the
intermediate stage user-definable the way `Collector` did for terminals.

**★ Map the four parts of a `Gatherer` onto a `Collector`. Where do they differ fundamentally?**
Initializer↔supplier, integrator↔accumulator, combiner↔combiner,
finisher↔finisher. The fundamental difference is output: a collector folds
everything into *one* result object; a gatherer *pushes* elements onward —
0, 1 or many per input — and can signal short-circuit in both directions
(integrator returns false; `push` returns false).

**★ How would you batch a stream of rows into inserts of 500 without any library?**
`rows.stream().gather(Gatherers.windowFixed(500)).forEach(jdbc::batchInsert)`
— unmodifiable `List` windows, final partial batch emitted by the
finisher. Pre-24, this exact shape was the standard argument for Guava.

**★ Why is `Gatherers.mapConcurrent` a better answer than `parallelStream()` for calling a remote service per element?**
Explicit, bounded concurrency (`maxConcurrency`) instead of "whatever the
common pool allows"; virtual threads instead of blocking scarce
`ForkJoinPool` workers shared by the whole JVM; and preserved encounter
order. It makes the IO-bound case a first-class citizen instead of a
misuse of a CPU-parallelism tool.

**What does returning `false` from an integrator do, and what operation does that let you build?**
It tells upstream to stop producing — the gatherer version of
short-circuiting. That is precisely how `limit`, `takeWhile` and
first-match-wins operations are expressible as gatherers, and what makes
custom gatherers safe on infinite streams.

**When do you write `Gatherer.of` instead of `Gatherer.ofSequential`?**
Only when the per-run state can genuinely be split and merged — you then
supply a real combiner and the stage can evaluate in parallel. Ordered or
merge-hostile state (running totals, seen-sets with first-wins semantics)
belongs in `ofSequential`, which stays correct inside a parallel pipeline
by evaluating the stage sequentially.

---

← Prev: [Infinite streams](12-infinite-streams.md) · Next → [Phase 5 — Exceptions](../phase-5-exceptions/README.md)
