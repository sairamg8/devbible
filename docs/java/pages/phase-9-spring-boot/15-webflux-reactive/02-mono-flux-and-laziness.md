---
title: "Mono, Flux, and nothing happening until you subscribe"
sidebar_label: "2 · Mono, Flux and laziness"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Reactor 3 reference guide — *Introduction to
> Reactive Programming* and *Reactor Core Features* (`Mono`, `Flux`, "nothing
> happens until you subscribe", the `Publisher`/`Subscriber` contract)
> (projectreactor.io/docs/core/release/reference/coreFeatures.html) — and the
> Spring Framework reference *Web on Reactive Stack → Reactive Core*.
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**A reactive pipeline is not a sequence of statements that runs; it is a value
you assemble that *describes* work, and which does nothing at all until someone
subscribes to it. Every confusing thing about reading reactive code follows
from that one inversion — why a method that "calls the database" performs no
query, why a log line in the middle prints at a surprising moment, why a save
whose `Mono` you forgot to return silently does not happen.**

## The two types

Reactor supplies two `Publisher` implementations, and the only difference
between them is cardinality:

| Type | Emits | Rough analogue |
|---|---|---|
| `Mono<T>` | 0 or 1 element, then completes — or errors | `Optional<T>` crossed with `CompletableFuture<T>` |
| `Flux<T>` | 0..N elements, then completes — or errors | a `Stream<T>` whose elements arrive over time |

A `Mono<Void>` is the reactive way of saying "a task that finishes but produces
nothing" — the return type of a delete, or of a controller method that only
sets a status.

## The signal contract

Both types obey the Reactive Streams contract: a publisher emits **zero or more
`onNext`** signals, followed by **exactly one terminal signal** — either
`onComplete` or `onError`. Never both, and nothing after.

Three things fall out of that, and each surprises people once:

- **An error is a value travelling downstream**, not an exception travelling up
  a stack. Nothing throws where you would expect it to, so a `try`/`catch`
  wrapped around a chain catches nothing useful.
- **Empty is a success.** A source that finds nothing emits no `onNext` and
  then `onComplete`. Every downstream operator that maps elements simply has
  nothing to map, so the tail of the pipeline is skipped and the overall result
  is a successful, empty response.
- **A terminal signal ends the sequence for good.** There is no resuming after
  `onError`; operators like `onErrorResume` do not resume the failed sequence,
  they *replace* it with a different one.

## Nothing happens until you subscribe

This is the sentence the Reactor reference repeats, and it is the one that
matters most when reading unfamiliar code:

```java
Mono<Order> order = repository.findById(id)                    // no query runs here
        .map(this::applyDiscount)                              // no discount applied here
        .doOnNext(o -> log.info("loaded {}", o.id()));         // nothing logged here
```

At this point nothing has touched the database. What exists is a small object
graph describing three stages. The work begins only when something calls
`subscribe()` — and in a Spring application **you almost never call it
yourself**: returning the `Mono` from a controller method hands it to the
framework, which subscribes when it is ready to write the response.

## Assembly time and subscription time are different times

Because the chain is a value, the code that builds it and the code that runs
inside it execute at completely different moments — and in a log they look
identical.

```java
public Mono<Report> build(String id) {
    log.info("A");                                     // assembly time: once, now
    return loader.load(id)
        .doOnSubscribe(s -> log.info("B"))             // subscription time
        .map(r -> { log.info("C"); return enrich(r); }) // per element, later, maybe another thread
        .doFinally(sig -> log.info("D"));              // on terminate or cancel
}
```

`A` runs on the calling thread as the method executes and returns. `B`, `C` and
`D` run when — and *if* — a subscriber arrives, on whatever thread the runtime
happens to be delivering signals on at that moment. If the caller drops the
returned `Mono`, only `A` ever runs.

The other half of the same coin: **a pipeline assembled and dropped is a
no-op.** Calling `repository.save(entity)` and ignoring the returned `Mono`
saves nothing. It is the single most common bug written in a developer's first
reactive week, and it fails silently — no exception, no log, just an update
that did not happen.

## Cold and hot, briefly

Most publishers you meet are **cold**: each subscriber triggers the work
afresh, so subscribing twice to `repository.findById(id)` runs two queries.
A few are **hot** — a `Sinks.Many`, a shared event stream, the result of
`.share()` or `.cache()` — and emit to whoever is currently listening,
regardless of subscribers. The practical rule when reading code: if you see a
publisher stored in a field and handed to several consumers, check which kind
it is, because "does subscribing again repeat the work?" has opposite answers.

## The trade-off

Laziness is what makes retry, timeout and fan-out expressible as operators at
all — you can only re-run work that is described rather than already done. What
it costs is that the compiler stops helping you: a method returning `Mono<Void>`
that you never used compiles perfectly and does nothing, where the blocking
version would at least have executed.

## Gotchas

### The pipeline you never subscribed to

**Symptom.** A save, delete or audit call appears to run — no error, no log —
but nothing is written.

**Cause.** The returned `Mono` was discarded. Nothing happens until you
subscribe, and nobody did.

**Fix.** Return it, or compose it into something that is returned:

```java
// ❌ silently does nothing
public Mono<Void> deactivate(String id) {
    accounts.findById(id).flatMap(a -> accounts.save(a.deactivated()));
    return Mono.empty();
}

// ✅ the save is part of the returned pipeline
public Mono<Void> deactivate(String id) {
    return accounts.findById(id)
                   .flatMap(a -> accounts.save(a.deactivated()))
                   .then();
}
```

Reactor's return types are annotated for static analysis, so an IDE or a
build-time analyser can flag the ignored return value. Turning that inspection
into an error is worth doing on the first day of a reactive project.

### `Mono.just` evaluating too early

**Symptom.** An expensive call runs once at startup, or runs even on a branch
that is never taken.

**Cause.** `Mono.just(expensive())` evaluates `expensive()` immediately, during
assembly; only the *wrapping* is deferred.

**Fix.** Defer the computation as well:

```java
Mono.just(loadFromDisk())            // ❌ runs now, on the assembling thread
Mono.fromCallable(this::loadFromDisk)  // ✅ runs at subscription, once per subscriber
Mono.defer(() -> pipelineFor(id))      // ✅ defers assembly of a whole sub-chain
```

### Calling `subscribe()` yourself inside a handler

**Symptom.** An endpoint returns 200 immediately, and the work it triggered
sometimes completes, sometimes vanishes when the request finishes.

**Cause.** `subscribe()` starts the work and returns straight away. The
framework is no longer connected to it, so it cannot apply backpressure, cannot
propagate cancellation when the client disconnects, and will not report a
failure — an error in a manually-subscribed chain with no error consumer is
simply dropped to a hook.

**Fix.** Return the publisher and let the framework subscribe. If you genuinely
want fire-and-forget, say so explicitly and give it somewhere to run and
somewhere to report:

```java
return service.record(event)
              .subscribeOn(Schedulers.boundedElastic())
              .doOnError(e -> log.error("audit failed", e))
              .then();     // ✅ still returned, still cancellable
```

### Expecting `try`/`catch` to catch a pipeline failure

**Symptom.** A `try`/`catch` around a chain never fires; the failure surfaces
later, often as an unhandled `onError` in a log.

**Cause.** Assembly does not throw. The exception is delivered later, as an
`onError` signal to the subscriber, on whichever thread the failure occurred.

**Fix.** Handle it in the pipeline with `onErrorResume`, `onErrorMap` or
`onErrorReturn` — covered in the next chunk — or let it reach the framework,
which maps it to a response through the usual exception handling.

### Reusing a `Mono` and running the work twice

**Symptom.** Two database queries, or two charges against a payment API, for
what looks like one call.

**Cause.** Cold publishers re-execute per subscription. Storing a `Mono` and
subscribing to it from two places runs it twice.

**Fix.** Either build it twice deliberately, or make the sharing explicit with
`.cache()`, which replays the first result to every later subscriber.

## Interview questions

**★ What is the difference between `Mono` and `Flux`?**
Cardinality only. `Mono<T>` emits at most one element before completing;
`Flux<T>` emits zero to many. Both are `Publisher` implementations with the same
signal contract — any number of `onNext` followed by exactly one `onComplete`
or `onError`. `Mono<Void>` is the idiomatic "completes with no value", used for
deletes and for handlers that produce only a status code.

**★ What does "nothing happens until you subscribe" mean in practice?**
Assembling a chain builds a description of work, not the work itself. No query
runs, no HTTP call is made and no `map` function is invoked until a subscriber
arrives and requests elements. In a Spring application the framework subscribes
when it writes the response, which is why "always return your publisher" is an
absolute rule — a `Mono` that is assembled and dropped performs nothing at all,
silently and without a warning at runtime.

**★ Why is `Mono.just(someCall())` usually wrong?**
Because `someCall()` is evaluated eagerly during assembly, not at subscription.
If it is expensive it runs even for subscribers that never arrive; if it blocks
it blocks the assembling thread, quite possibly an event-loop worker; and if it
needs to run once per subscription, it will not.
`Mono.fromCallable(this::someCall)` defers it to subscription time, and
`Mono.defer` does the same for an entire sub-chain.

**★ A log statement sits between two operators and prints at a strange time. Why?**
Because it runs at assembly time — once, when the method builds the chain —
rather than when data flows. Anything that must run per element or per
subscription has to be inside an operator: `doOnSubscribe`, `doOnNext`,
`doFinally`. This assembly/subscription split is also why a stack trace taken
inside an operator shows the subscription path rather than the code that built
the chain, which is the subject of chunk 5.

**★ Why does a repository lookup that finds nothing return 200 with an empty body rather than 404?**
Because an empty completion is a *successful* outcome under Reactive Streams.
The source emits no elements and completes, so every downstream mapping
operator is skipped and the framework serialises an empty result. Nothing has
failed from the pipeline's point of view. You have to say what empty means —
`switchIfEmpty(Mono.error(new NotFound(id)))` is the idiomatic translation of
`orElseThrow`.

---

← Prev: [The problem reactive solved](01-the-problem-reactive-solved.md) · Index: [WebFlux and reactive](README.md) · Next → [The operator vocabulary](03-the-operator-vocabulary.md)
