---
title: "Stateful lambdas and side effects in pipelines"
sidebar_label: "10 · Stateful lambdas"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the JDK 25 API documentation for the
> `java.util.stream` package (the "Non-interference", "Stateless behaviors"
> and "Side-effects" sections of the package summary), and the Javadoc for
> `Stream.forEach`, `Stream.forEachOrdered`, `Stream.peek` and `Collectors`.

**The stream API's contract has two halves, and the compiler enforces
neither: the *library* promises correct results only if your *lambdas*
promise to be stateless and non-interfering. Break that quietly — mutate a
captured list inside `map`, read a variable another element's lambda wrote,
modify the source mid-pipeline — and the code still compiles, still passes
the small sequential test, and produces wrong or nondeterministic results
later, usually the day someone adds `.parallel()`. This page is the list of
what the package documentation actually forbids, why, and the safe pattern
for each temptation.**

## The three rules the package doc states

1. **Non-interference** — behavioral parameters (the lambdas you pass to
   `map`, `filter`, etc.) must not modify the stream's *source* while the
   pipeline runs. For non-concurrent sources this is a hard rule: the
   pipeline may throw `ConcurrentModificationException`, or worse, produce a
   result quietly computed over a half-mutated source.
2. **Stateless behaviors** — a behavioral parameter's result must not depend
   on state that might change during execution, and it should not write
   shared state. The doc's own example is a lambda reading/writing an
   external `ArrayList` — legal Java, undefined stream behaviour.
3. **Side-effects discouraged** — side effects in behavioral parameters are
   "in general, discouraged"; the documented escape hatches are `forEach`,
   `forEachOrdered`, and `peek` for debugging. Everything else should be a
   pure function whose only output is its return value.

The reason is the execution model: a pipeline is a *description*, and the
library chooses evaluation order, thread assignment, and even whether an
operation runs at all (an element `filter`ed out never reaches your `map`;
a short-circuiting `findFirst` stops early; some operations can be elided
entirely — see the `peek` gotcha). Any lambda that cares *when* or *on which
thread* it runs is coupling itself to decisions the library never promised
to make the same way twice.

## The classic bug: accumulating into an external collection

```java
List<String> results = new ArrayList<>();
orders.stream()
      .map(Order::customerName)
      .forEach(results::add);          // works sequentially — by luck
```

Sequentially this happens to work. In parallel it is a data race:
`ArrayList.add` is not thread-safe, so the outcome ranges from lost elements
to `ArrayIndexOutOfBoundsException` to a corrupted list — and the order is
nondeterministic even when nothing crashes. The same shape hides inside
`map`:

```java
List<Audit> audit = new ArrayList<>();
var names = orders.stream()
      .map(o -> { audit.add(o.audit()); return o.name(); })  // side effect in map
      .toList();
```

Now correctness depends on `map` running exactly once per element, in order,
on one thread — none of which is promised.

**The safe pattern is always the same: move the accumulation into the
terminal operation.**

```java
List<String> results = orders.stream()
      .map(Order::customerName)
      .toList();                       // or .collect(Collectors.toList())
```

A `Collector` is *designed* mutation: the library creates one container per
thread, accumulates without contention, and merges — that is why
`collect(toList())` is correct in parallel while `forEach(list::add)` is
not. If you need two results from one pass, use `Collectors.teeing` or
collect into a richer object; don't smuggle the second result out through a
captured variable.

## `forEach` vs `forEachOrdered`

`forEach`'s Javadoc is blunt: the behaviour is "explicitly
nondeterministic" — for parallel pipelines it does not respect encounter
order and runs the action on whatever thread the library chooses.
`forEachOrdered` restores encounter order (at the cost of the parallelism
you presumably wanted). Two consequences:

- Printing inside `parallelStream().forEach(...)` interleaves arbitrarily —
  the classic "parallel streams shuffled my output" report.
- Even *sequential* `forEach` order is only the stream's encounter order —
  a `HashSet` source never had a meaningful one to begin with.

## Stateful lambdas that don't look stateful

- **`distinct`-by-key via a captured `Set`** —
  `filter(e -> seen.add(e.key()))` is a stateful predicate. Sequentially it
  implements "distinct by key"; in parallel, `seen` needs to be concurrent
  *and* the surviving element per key becomes arbitrary. Prefer
  `Collectors.toMap(keyFn, fn, (a, b) -> a)` or `groupingBy`.
- **Counters and indices** — `map(x -> i++ + ": " + x)` doesn't compile with
  a local `int` (captures must be effectively final,
  [phase 1's topic on `final`](../phase-1-language-core/12-final.md)), so
  people reach for an `AtomicInteger` — which compiles and is exactly the
  statefulness the doc forbids: the "index" no longer matches the encounter
  position under parallelism or reordering. Stream over indices instead
  (`IntStream.range(0, list.size())`).
- **Reading state another lambda writes** — one `map` writing a field that a
  later `filter` reads couples two operations through hidden state; fusion
  and reordering break it. Carry the value *in the element*: map to a small
  record holding both pieces.
- **`sorted().forEach(...)` assumptions** — statefulness in the comparator
  (a comparator that consults mutable state) breaks the sort's contract the
  same way; comparators are behavioral parameters too.

## `peek` is for debugging — and may not run

`peek`'s Javadoc says it "exists mainly to support debugging". It is not a
reliable side-effect hook: since the library may optimize away traversal
when the result doesn't require it (the documented example: `count()` on a
sized stream can skip traversing — and skip your `peek`), any *load-bearing*
side effect in `peek` is a latent bug. Log in it, never mutate in it.

## When you genuinely need side effects

Real pipelines do eventually write to the world — a repository, a message
queue. The honest options, in order of preference:

1. **Collect first, then act**: build the list, then loop over it with a
   plain `for` — effects happen outside the stream machinery, in a defined
   order, with normal exception handling
   (**topic 08** *(not written yet)* is this argument in full).
2. **`forEach` as the terminal op** — acceptable for independent,
   order-irrelevant, thread-safe effects, and it *says* "effects here" to
   the reader.
3. Never inside `map`/`filter`/intermediate ops — those are the library's
   to schedule, elide and reorder.

## Gotchas

**Symptom:** list built inside `forEach` is missing elements, only under load or only in production
**Cause:** `.parallel()` (or a later refactor added it) + non-thread-safe accumulation — a data race, so small tests pass
**Fix:** accumulate with the terminal op: `toList()`, `collect(...)`; never `forEach(list::add)`

**Symptom:** `ConcurrentModificationException` from a stream over a collection nobody else touches
**Cause:** the pipeline itself mutates the source — `list.stream().filter(...).forEach(list::remove)` interferes with its own source
**Fix:** `list.removeIf(...)` for removal; otherwise collect the changes and apply after the pipeline ends

**Symptom:** output of `parallelStream().forEach(System.out::println)` is shuffled
**Cause:** `forEach` is documented not to respect encounter order in parallel
**Fix:** `forEachOrdered` if order matters (accepting the serialization cost), or collect then print

**Symptom:** "distinct by property" via `filter(e -> seen.add(...))` keeps different elements run to run
**Cause:** stateful predicate — which element of each key group survives depends on scheduling
**Fix:** `toMap(key, identity(), (a, b) -> a)` or `groupingBy` — deterministic merge functions instead of hidden state

**Symptom:** `AtomicInteger`-based index inside `map` disagrees with element positions
**Cause:** increment order is execution order, not encounter order — they differ under parallelism and short-circuiting
**Fix:** `IntStream.range(0, n).mapToObj(i -> ...)` — derive the index from the stream, don't count on the side

**Symptom:** side effect in `peek` never happens, though the pipeline "ran"
**Cause:** the library elided traversal (e.g. `count()` on a sized pipeline with no other work) — `peek` is documented as a debugging aid
**Fix:** never make `peek` load-bearing; move required effects to the terminal operation

**Symptom:** the same pipeline gives different results sequential vs parallel, with no exception anywhere
**Cause:** some lambda depends on shared mutable state — the result was never *defined*, sequential execution just happened to be consistent
**Fix:** audit every behavioral parameter for reads/writes of anything non-local; make each a pure function of its argument

**Symptom:** exception from deep inside a pipeline lost the context of *which element* failed
**Cause:** effects and transformations interleaved inside lambdas — stack traces show stream plumbing, not your loop
**Fix:** the collect-then-loop pattern for effectful stages; plain loops give plain stack traces and normal try/catch shapes

## Interview questions

**★ Why is `stream().forEach(list::add)` wrong when `collect(toList())` does the same thing?**
It's only "the same" sequentially. The collector protocol gives each thread
its own container and merges them — mutation is *contained by design*.
`forEach(list::add)` shares one unsynchronized `ArrayList` across whatever
threads the library uses: a data race in parallel, and a habit that couples
code to sequential execution even when it currently works.

**★ What exactly does "non-interference" mean in the stream docs?**
Behavioral parameters must not modify the stream's source during pipeline
execution (for non-concurrent sources). Violating it may throw
`ConcurrentModificationException` or silently compute over inconsistent
data. Concurrent sources (`ConcurrentHashMap` views) are the documented
exception — their spliterators tolerate concurrent modification.

**★ Why does the `AtomicInteger`-as-index trick produce wrong numbering in parallel?**
The atomic guarantees each increment is *unique*, not that increments happen
in encounter order. Under parallel execution, element 40 may grab index 3.
The index must be derived from the stream (`IntStream.range`), not
manufactured as execution-order state.

**★ When is a side effect inside a stream acceptable?**
In the terminal `forEach`/`forEachOrdered`, when the effect is independent
per element, thread-safe, and order-tolerant (or `forEachOrdered` is used) —
and in `peek` for logging only. The package doc treats everything else as
undefined-behaviour territory; the robust alternative is collect first, then
apply effects in a plain loop.

**★ Sequential and parallel runs of the same pipeline disagree and nothing throws. Where do you look first?**
At every lambda's captures: anything read or written that isn't the lambda's
own parameter — collections, fields, `Atomic*` values, `ThreadLocal`s. The
disagreement means some behavioral parameter is stateful; the sequential
result was coincidence, not the "correct" one.

**Why is `peek` documented as "mainly to support debugging"?**
Because the library may elide it: optimizations can skip traversal (or parts
of it) when the terminal result doesn't need every element to flow through.
An effect the program *requires* can therefore silently not happen — fine
for a debug log, unacceptable for anything load-bearing.

**How do you return two results from one stream pass without a side channel?**
`Collectors.teeing(c1, c2, merger)` runs two collectors over one pass;
`partitioningBy`/`groupingBy` split by predicate/key; or map elements into a
record carrying both values and collect that. All keep mutation inside the
collector protocol.

---

← Prev: **Parallel streams** *(not written yet)* · [Next → `toList()` vs `collect(toList())`](11-tolist-vs-collectors.md)
