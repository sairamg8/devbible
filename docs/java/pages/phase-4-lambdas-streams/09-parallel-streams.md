---
title: "Parallel streams"
sidebar_label: "09 · Parallel streams"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 API documentation — the
> `java.util.stream` package summary (parallelism, ordering), the
> `ForkJoinPool.commonPool` Javadoc, the `Spliterator` Javadoc — and the
> `java.util.concurrent` package documentation. The NQ heuristic is from
> Oracle's own parallel-streams guidance in the Java tutorials.

**`.parallel()` is one method call that swaps the entire execution model:
the pipeline is split via its `Spliterator` and executed as fork/join tasks
on the JVM-wide `ForkJoinPool.commonPool()`. That sentence contains all
three reasons it is usually a mistake in a web application: the splitting
has overhead that small workloads never pay back, the pool is *shared by the
whole process*, and anything blocking inside the pipeline starves that pool
for everyone. Parallel streams are a batch-computation tool that happens to
be one keystroke away in request-handling code.**

## What actually happens when you call `.parallel()`

1. The source's **`Spliterator`** recursively `trySplit`s the data into
   chunks — an `ArrayList` splits perfectly (index halving), a `HashSet`
   reasonably, an iterator-based or `Stream.iterate` source barely at all.
2. Chunks become **fork/join tasks** submitted to
   **`ForkJoinPool.commonPool()`** — one static pool per JVM, default
   parallelism **`availableProcessors() - 1`** (the caller thread itself
   participates in the work, which is why one is subtracted; a parallel
   terminal op does not return until the result is complete).
3. Per-chunk results are **combined** — cheap for a sum, expensive for
   merging maps or preserving order.

None of this is free: task objects, work-stealing coordination, combining.
The parallel version starts *behind* the sequential one and must win the
race on the work itself.

## The three conditions that must all hold

Parallelism pays only when **N × Q is large** — Oracle's own tutorial
heuristic, where N is the element count and Q the per-element cost:

1. **Enough elements** — thousands-to-millions, not the 20-item list a
   request typically holds.
2. **Enough per-element work** — real CPU per element (parsing, scoring,
   image ops). `s -> s.length() > 3` per element is dominated by the
   framework's own overhead.
3. **A splittable, sized source** — `ArrayList`, arrays, `IntStream.range`
   split cleanly; `LinkedList`, iterator sources and `Stream.iterate`
   split terribly, so workers sit idle behind a sequential producer.

Miss any one and parallel is a slowdown with extra threads. This is the
anatomy of "the benchmark that lied": a microbenchmark over a pre-built
million-element `int[]` with CPU-heavy math satisfies all three and shows a
near-linear win; the production copy of that code ran over a 40-element
list of DTOs doing a cheap map — conditions 1 and 2 gone — and shipped a
regression. Same API, different N and Q.

## Why a web app is the wrong host

**The pool is process-wide.** Every parallel stream in the JVM — yours,
your teammate's, a library's — shares one `commonPool`. Consequences that
matter under request load:

- **Cross-request interference.** One endpoint's parallel stream over a
  large dataset occupies the pool; every other request's parallel work
  queues behind it. You have built an invisible, unconfigurable,
  JVM-global bottleneck — while your web server's own thread pool sits
  there, deliberately sized and monitored, being bypassed.
- **Blocking I/O starves the pool.** A repository or HTTP call inside a
  parallel pipeline parks a common-pool worker for the I/O's full
  duration. With parallelism ~cores−1, a handful of concurrent requests
  doing this leaves *zero* workers for the whole JVM's CPU-bound parallel
  work. (Fork/join's `ManagedBlocker` can compensate, but nothing in a
  stream pipeline arranges that for you.)
- **You already have concurrency.** A servlet container runs many requests
  in parallel; the cores are busy. Adding data-parallelism *inside* each
  request multiplies contention without adding capacity — the throughput
  ceiling is the same cores, now with more coordination.

The folklore workaround — submitting the stream from inside your own
`ForkJoinPool` so tasks run there instead:

```java
ForkJoinPool pool = new ForkJoinPool(4);
var result = pool.submit(() -> data.parallelStream().map(...).toList()).get();
```

— relies on an implementation detail (fork/join tasks forking into the
pool of the calling worker) that the stream specification does not
promise. It mostly works, is not part of any contract, and couples
correctness to undocumented behaviour. If you need controlled parallelism
with your own pool, an `ExecutorService` with explicit tasks (phase 6) —
or structured concurrency — states it honestly.

## Ordering costs parallelism

The stream keeps **encounter order** through ordered sources and ops
unless told otherwise, and paying for it in parallel is real:

- `findFirst()` must coordinate to return the *first* match —
  `findAny()` is the parallel-friendly version when any witness will do.
- `forEachOrdered` serializes the terminal effect; `forEach` gives up
  order (and is documented as nondeterministic in parallel —
  [topic 10](10-stateful-lambdas.md)).
- `limit`/`skip` on an ordered parallel stream buffer and coordinate;
  on an `unordered()` stream they are free to take *any* n.
- `distinct` and `sorted` are stateful ops that need cross-chunk
  coordination regardless.

And correctness-wise: every lambda in a parallel pipeline must actually
honor the statelessness rules — a pipeline that "worked" sequentially with
a sneaky shared-state capture becomes wrong, not slow, in parallel
(topic 10's whole subject).

## Where parallel streams are right

The design center exists: **batch and offline computation** — ETL steps,
report generation, scientific/numeric work, anything that owns the machine
while it runs:

```java
// A nightly job that owns the JVM: all three conditions hold
double[] scores = new double[models.size()];
var stats = IntStream.range(0, features.length)   // sized, perfectly splittable
        .parallel()
        .mapToObj(i -> scoreExpensively(features[i]))   // heavy CPU per element
        .collect(teeing(averagingDouble(Score::value),
                        maxBy(comparing(Score::value)),
                        Stats::new));
```

CPU-bound, big-N, splittable source, no blocking, nobody else needs the
pool — `.parallel()` is then exactly the one-keystroke win it advertises.
Even there: measure with JMH against the sequential version; the combining
step or an unsplittable source can erase wins in ways inspection misses.

## Gotchas

**Symptom:** endpoint latencies across *unrelated* endpoints spike together under load
**Cause:** some request handler's parallel stream monopolizing the JVM-wide `commonPool`
**Fix:** remove `.parallel()` from request paths; parallelize batch work only, or use an owned executor with explicit tasks

**Symptom:** parallel stream with a DB call per element is slower than sequential and the whole app degrades
**Cause:** blocking I/O parking common-pool workers — the pool is sized for CPU (cores−1), not for waiting
**Fix:** never block in a parallel pipeline; bulk-fetch first, or use an `ExecutorService` sized for I/O concurrency

**Symptom:** `.parallel()` made a small-collection pipeline slower
**Cause:** N×Q too small — split/combine overhead exceeds the work
**Fix:** sequential by default; consider parallel only at thousands of elements with real per-element CPU, then benchmark

**Symptom:** parallel pipeline over `Stream.iterate` or a `LinkedList` shows no speedup
**Cause:** unsplittable source — spliterator can't partition, workers starve behind sequential element production
**Fix:** materialize into an `ArrayList`/array first, or use `IntStream.range`/`Stream.iterate` with the sized three-arg form

**Symptom:** results differ run to run after adding `.parallel()`
**Cause:** a stateful lambda or order-sensitive merge that sequential execution masked
**Fix:** topic 10's audit: pure lambdas, deterministic merge functions, `forEachOrdered` where order is contractual

**Symptom:** `findFirst`/`limit` parallel pipeline is barely faster than sequential
**Cause:** encounter-order coordination — first-ness and prefix-ness are inherently sequential constraints
**Fix:** `findAny`, or `.unordered()` before `limit`/`skip` when any n elements satisfy the requirement

**Symptom:** custom-pool `submit(() -> parallelStream()...)` trick behaves differently after a JDK upgrade
**Cause:** it was never specified — task-forking into the enclosing pool is an implementation detail
**Fix:** owned parallelism via `ExecutorService`/structured concurrency; parallel streams only on the common pool as designed

**Symptom:** parallel `collect(toMap(...))` noticeably slower than expected
**Cause:** map merging across chunks is expensive; `toMap`'s combiner does real work per merge
**Fix:** `toConcurrentMap`/`groupingByConcurrent` for unordered concurrent collection — when ordering doesn't matter

## Interview questions

**★ Where do parallel-stream tasks run, and why does that make `.parallel()` in a web app dangerous?**
On `ForkJoinPool.commonPool()` — one static pool per JVM, parallelism
defaulting to cores−1. Every parallel stream in the process shares it, so
one heavy or blocking pipeline degrades all others and bypasses the
container's deliberately sized request pool. Request-path code should
leave it alone.

**★ State the three conditions for a parallel stream to pay off.**
Large element count, real per-element CPU work, and a splittable sized
source (array/`ArrayList`/`range`, not `LinkedList`/iterators). Oracle's
NQ heuristic compresses the first two: N×Q must be large. All three, or
sequential wins.

**★ Why is blocking I/O inside a parallel stream categorically worse than the same I/O in a plain loop?**
The loop blocks its own thread. The parallel stream blocks *common-pool
workers* — a shared, cores-sized resource the whole JVM depends on. A few
concurrent requests doing per-element I/O can park the entire pool, halting
unrelated parallel work everywhere in the process.

**★ `findFirst` vs `findAny` in parallel — what's the difference and when does it matter?**
`findFirst` honors encounter order: chunks must coordinate so the earliest
match wins, which throttles parallelism. `findAny` returns any witness and
lets the first-finishing chunk answer. Use `findAny` whenever "some
matching element" is the actual requirement.

**★ A benchmark shows parallel 6× faster, production shows it slower. Reconcile.**
The benchmark satisfied the conditions (big pre-built splittable dataset,
CPU-heavy op, idle pool); production ran small N, cheap Q, on a pool
contended by other requests — overhead dominated. The API is the same; the
economics are workload-shaped. Benchmark the production shape, not the
demo shape.

**★ How does encounter order interact with parallel performance, and what's the escape hatch?**
Ordered sources force parallel ops to track and reassemble order —
`limit`, `skip`, `findFirst`, `forEachOrdered`, ordered collection all pay
coordination costs. `.unordered()` (or order-free terminals like
`findAny`, `forEach`, `groupingByConcurrent`) releases the constraint when
the contract genuinely doesn't need order.

**★ You need parallelism with your own thread budget. Why not the submit-to-own-ForkJoinPool trick?**
It exploits an unspecified detail — parallel-stream tasks forking into the
submitting worker's pool. It's unsupported folklore: no spec guarantees
it, JDK changes may alter it, and pool-sizing assumptions become invisible.
Owned `ExecutorService` tasks (or structured concurrency, phase 6) express
the same intent inside documented contracts.

**★ Does `parallelStream()` differ from `stream().parallel()`?**
No — both produce a parallel pipeline; `parallel()` just flips the mode on
an existing stream (the whole pipeline executes in the mode set when the
terminal starts; the last `parallel()`/`sequential()` call wins).

---

← Prev: [Streams vs loops](08-streams-vs-loops.md) · Next → [Stateful lambdas and side effects](10-stateful-lambdas.md)
