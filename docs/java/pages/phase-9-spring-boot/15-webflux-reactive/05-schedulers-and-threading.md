---
title: "Schedulers, subscribeOn and publishOn"
sidebar_label: "5 · Schedulers and threading"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Reactor 3 reference guide — *Reactor Core
> Features → Threading and Schedulers*
> (projectreactor.io/docs/core/release/reference/coreFeatures/schedulers.html):
> the `Schedulers` factory methods, `boundedElastic`'s default cap of
> "number of CPU cores × 10" backing threads and 100 000 queued tasks, the
> `reactor.schedulers.defaultBoundedElasticOnVirtualThreads` property for Java
> 21+, and the `publishOn`/`subscribeOn` semantics — and the Spring Framework
> reference *Web on Reactive Stack → WebFlux → Concurrency Model*.
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Reactor is concurrency-agnostic: an operator chain does not, by itself,
introduce any threading at all. Every stage runs on whatever thread delivered
the previous signal, which in a WebFlux application means the event-loop worker
that read the request — and that is precisely why a single blocking call in the
middle of a chain is a whole-application problem rather than a slow request.
Two operators, and only two, change threads.**

## The default: no threads at all

Reactor adds no concurrency of its own. Subscribe on the calling thread and,
absent any scheduler operator, every `map`, `filter` and `doOnNext` runs on
that same thread. What actually moves work between threads is either an
explicit `publishOn`/`subscribeOn`, or an *asynchronous source* — a network
client that completes its `Mono` on an I/O thread, a `Mono.delay` that
completes on a timer thread.

In WebFlux, the thread that starts everything is a Reactor Netty event-loop
worker (its threads carry an `http-nio`-style name prefix, which is how you
recognise them in a thread dump). There are as many as there are cores. That is
the entire budget for the whole application.

## The Schedulers

`Schedulers` is the factory for execution contexts:

| Factory | Backing | Intended for |
|---|---|---|
| `Schedulers.immediate()` | the current thread | a no-op placeholder where an API demands a scheduler |
| `Schedulers.single()` | one reused thread | low-latency serial work; `newSingle()` for a dedicated one |
| `Schedulers.parallel()` | fixed pool, one per core | **CPU-bound** work |
| `Schedulers.boundedElastic()` | elastic pool, capped | **blocking** calls that have no non-blocking alternative |
| `Schedulers.fromExecutorService(es)` | your executor | adapting an existing pool |

Two of these deserve their numbers spelled out, because the numbers are the
argument:

- **`parallel()`** is sized to the number of available processors. It is for
  computation, and putting a blocking call on it starves exactly the pool your
  CPU work needs.
- **`boundedElastic()`** creates threads on demand and reuses idle ones, up to
  a cap the Reactor reference documents as **the number of CPU cores × 10**,
  with up to **100 000 tasks queued** beyond that. It exists specifically so
  that legacy blocking calls have somewhere to go that is not the event loop.
  On Java 21+ it can be switched to create a virtual thread per task instead of
  maintaining a pool, with the
  `reactor.schedulers.defaultBoundedElasticOnVirtualThreads` system property —
  which is a striking admission of where the industry ended up, and chunk 8
  takes that argument up properly.

## `subscribeOn` versus `publishOn`

This is the distinction that separates people who have read reactive code from
people who have written it, and it is a fair interview question because the
names are genuinely unhelpful.

**`publishOn(scheduler)`** — affects everything **downstream** of it. When a
signal passes through, it is re-dispatched onto the given scheduler, and every
operator after that point runs there until another `publishOn` changes it
again. Its position in the chain is what matters.

**`subscribeOn(scheduler)`** — affects the **subscription**, and therefore the
*source*. It determines which thread performs the subscribe call that starts
the work, so it influences where the source emits from and consequently where
the earliest operators run. Its position barely matters: it applies to the
whole chain regardless of where you put it, and multiple `subscribeOn` calls
are pointless because only the one closest to the source has an effect.

```java
return Mono.fromCallable(() -> jdbcTemplate.queryForObject(sql, Long.class))
           .subscribeOn(Schedulers.boundedElastic())    // the blocking call runs here
           .map(this::toView)                           // still on boundedElastic
           .publishOn(Schedulers.parallel())            // from here on...
           .map(this::expensivePureComputation);        // ...runs on a parallel worker
```

A useful shorthand: **`subscribeOn` chooses where the work *starts*;
`publishOn` chooses where the work *continues*.**

## Why this is the chunk everything else hangs on

Note what the example above had to do. To call one piece of blocking JDBC, it
needed a scheduler, a `fromCallable`, and a deliberate decision about pool
sizing — and the moment that pool is bounded, the number of concurrent blocking
calls is bounded, which is exactly the thread-pool ceiling the whole reactive
model was adopted to escape. That is not a criticism of `boundedElastic`; it is
doing precisely what it says. It is the mechanism behind the argument in
chunk 6, and it is why "we will just wrap the blocking bits" is a bigger
concession than it sounds.

## Gotchas

### Putting a blocking call on `parallel()`

**Symptom.** CPU-bound endpoints slow down after someone offloads a blocking
call "onto another scheduler", and the effect is worse than leaving it inline.

**Cause.** `Schedulers.parallel()` has one thread per core and is sized on the
assumption that its threads never park. Blocking one is the same mistake as
blocking an event-loop worker, in a smaller pool.

**Fix.** Blocking goes on `boundedElastic()`, computation on `parallel()`.
The names describe the *workload*, not the amount of parallelism you want.

### Expecting `subscribeOn` in the middle of a chain to move only what follows

**Symptom.** Someone inserts `subscribeOn` after three operators expecting the
first three to stay put, and the whole chain moves.

**Cause.** `subscribeOn` acts on the subscription signal, which travels upward
to the source. It is not positional in the way `publishOn` is.

**Fix.** Use `publishOn` when you mean "from here downwards", and treat
`subscribeOn` as a property of the whole pipeline, conventionally written next
to the source so the code says what it does.

### Assuming `boundedElastic` is unbounded

**Symptom.** Under load, offloaded blocking work develops a growing queue and
latency climbs while CPU sits idle.

**Cause.** It is called *bounded* for a reason: cores × 10 threads, then tasks
queue — up to 100 000 of them. A queue that deep hides the problem for a long
time before it fails.

**Fix.** Treat it as the thread pool it is. Size it deliberately with
`Schedulers.newBoundedElastic(...)` for known workloads, and recognise that if
your steady-state load needs a large one, the reactive stack is not buying you
what you thought.

### Losing a `ThreadLocal` across a scheduler boundary

**Symptom.** MDC log fields, tenant ids or the security principal are present
before a `publishOn` and gone after it.

**Cause.** `ThreadLocal` is per thread, and the chain has just changed threads.

**Fix.** Reactor `Context` and the context-propagation library, covered in
chunk 7 — this is one of the topic's headline costs, not a small detail.

### One slow `boundedElastic` task starving the others

**Symptom.** Unrelated blocking calls start queueing behind a report generator.

**Cause.** They share one global scheduler. `Schedulers.boundedElastic()`
returns the same instance to everybody, so a slow tenant of it affects
everybody.

**Fix.** Give distinct workloads distinct schedulers, exactly as you would give
them distinct thread pools — that is the bulkhead pattern, and the reasoning is
identical in
[Phase 6 · ExecutorService and pools](../../phase-6-concurrency/06-executorservice-pools/README.md).

## Interview questions

**★ What is the difference between `subscribeOn` and `publishOn`?**
`publishOn` switches the thread for everything downstream of where it appears,
so its position in the chain is exactly what it affects. `subscribeOn` affects
the subscription itself, which travels upstream to the source, so it determines
which thread the work starts on and applies to the whole chain regardless of
where it is written. Multiple `subscribeOn` calls are wasteful because only the
one nearest the source matters, whereas multiple `publishOn` calls are
meaningful — each one moves the remainder of the chain again.

**★ Which scheduler do you use for a blocking call, and why not the others?**
`Schedulers.boundedElastic()`. It exists precisely to absorb blocking work:
threads are created on demand, reused when idle, and capped at cores × 10 with
a large task queue behind that. `parallel()` is sized one thread per core for
computation, so blocking it starves CPU work; `single()` is one thread, so one
blocking call serialises everything; and `immediate()` runs on the caller,
which in WebFlux is the event loop — the thing you were avoiding.

**★ If Reactor is asynchronous, why do people say it is "concurrency-agnostic"?**
Because the operators themselves introduce no threads. Signals are processed on
whatever thread delivered them, so a chain subscribed on the calling thread
runs entirely on the calling thread. Concurrency enters only from asynchronous
*sources* — a network client completing on an I/O thread — or from an explicit
`publishOn`/`subscribeOn`. This is why reactive code is not automatically
parallel, and why `flatMap` rather than the threading model is what makes two
downstream calls overlap.

**★ How many threads does a WebFlux application have for handling requests?**
Roughly one event-loop worker per core, and that is the whole budget. This is
the design's central bet: those threads never block, so a small number of them
can service very many concurrent requests. It is also the design's central
hazard, because blocking one of them removes a measurable fraction of the
application's entire capacity, not just the capacity for that request.

**★ What does it tell you that `boundedElastic` can now be backed by virtual threads?**
That the escape hatch and the alternative have converged. `boundedElastic`
exists to hold blocking calls off the event loop, and the cheapest way to do
that on a modern JDK is one virtual thread per task —
`reactor.schedulers.defaultBoundedElasticOnVirtualThreads` switches it to
exactly that on Java 21+. If the best home for your blocking calls is virtual
threads, it is worth asking why the rest of the application is not simply
running on them, which is the argument of chunk 8.

---

← Prev: [Errors, retries and cancellation](04-errors-retries-cancellation.md) · Index: [WebFlux and reactive](README.md) · Next → [Annotated controllers and streaming responses](06-annotated-controllers.md)
