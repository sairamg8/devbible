---
title: "Creating and composing"
sidebar_label: "1 · Creating and composing"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `CompletableFuture`
> (class-level threading policy, `supplyAsync`, `thenApply`,
> `thenCompose`, `thenCombine`, `defaultExecutor`) and
> `ForkJoinPool.commonPool`.

**Every `thenXxx` method answers three questions: what shape is the next
step (value → value? value → future? two values → one?), what runs it
(same-thread, common pool, or your executor), and what happens on failure
(skip, by default). Get the first question wrong and you hold a
`CompletableFuture<CompletableFuture<Quote>>`; get the second wrong and
your I/O runs on a pool sized for CPU work.**

## Creating one

```java
CompletableFuture<Quote> f1 = CompletableFuture.supplyAsync(
        () -> pricingClient.quote(request));            // commonPool — careful

CompletableFuture<Quote> f2 = CompletableFuture.supplyAsync(
        () -> pricingClient.quote(request), ioExecutor); // your executor — right
```

- `supplyAsync(Supplier)` (and `runAsync(Runnable)`) without an executor
  run on **`ForkJoinPool.commonPool()`** — a small, JVM-wide pool sized
  to `availableProcessors() - 1` and shared with parallel streams. It is
  sized for CPU-bound work; blocking I/O tasks parked on it starve every
  other user of the pool. If common-pool parallelism is < 2, the Javadoc
  specifies each task gets a **new thread** instead.
- The overload taking an `Executor` is the production form for I/O:
  pass a dedicated pool, or a virtual-thread-per-task executor
  ([topic 02](../02-platform-vs-virtual-threads/03-using-them-well.md)).
- `CompletableFuture.completedFuture(value)` /
  `failedFuture(ex)` (JDK 9) make already-settled futures — the standard
  way to satisfy an async signature from a cache hit or a validation
  failure.
- `new CompletableFuture<>()` plus `complete(value)` /
  `completeExceptionally(ex)` adapts callback APIs: complete it from the
  callback, hand the future to the caller.

## `thenApply` vs `thenCompose` — map vs flatMap

```java
// thenApply: the function returns a VALUE
CompletableFuture<BigDecimal> total =
        quote.thenApply(q -> q.price().add(q.tax()));

// thenCompose: the function returns ANOTHER FUTURE — and gets flattened
CompletableFuture<Receipt> receipt =
        quote.thenCompose(q -> paymentClient.charge(q));   // returns CF<Receipt>
```

`thenApply` with a future-returning function *nests*:
`CompletableFuture<CompletableFuture<Receipt>>` — a type that compiles
and then forces a `join` inside a callback downstream. The rule is the
`map`/`flatMap` split from streams and `Optional`
([phase 4](../../phase-4-lambdas-streams/07-optional/README.md)): the
next step is itself async → `thenCompose`.

## `thenCombine` — two independent futures, one result

```java
CompletableFuture<Offer> offer =
        price.thenCombine(inventory, (p, stock) -> new Offer(p, stock));
```

`thenCombine` waits for **both** (they run concurrently — neither waits
for the other to start), then applies the two-arg function. For more than
two, the fan-out tool is `allOf`
([chunk 2](02-fan-out-allof-anyof-timeouts.md)). `thenAcceptBoth` /
`runAfterBoth` are the consuming/void variants; `applyToEither` /
`acceptEither` take whichever of two settles first.

## Which thread runs the callback

The class Javadoc pins this down, and it is the least-known rule in the
API:

| Variant | Runs on |
|---|---|
| `thenApply(fn)` | the thread that **completed** the previous stage — or the **calling** thread, if the stage was already complete when the callback was attached |
| `thenApplyAsync(fn)` | the future's default executor (commonPool, unless created with one) |
| `thenApplyAsync(fn, executor)` | the executor you pass |

Two consequences:

- A non-`Async` callback attached to a slow network future runs on the
  **I/O/completion thread** — put a blocking call or a heavy computation
  in it and you have hijacked a thread that was never sized for that
  work.
- Timing decides the thread: attach before completion → completer's
  thread; attach after → your thread, synchronously, before `thenApply`
  even returns. Code that works in tests (future already done) can
  behave differently under load. Never rely on *which* thread runs a
  non-`Async` callback.

Default policy that keeps you honest: **non-`Async` for cheap, non-blocking
transformations; explicit-executor `-Async` for anything that blocks or
computes.** Bare `-Async` (no executor) is the commonPool caveat again.

## Gotchas

**Symptom:** type is `CompletableFuture<CompletableFuture<User>>` and the code "fixes" it with `.join()` inside a callback
**Cause:** `thenApply` used where the function returns a future
**Fix:** `thenCompose` — it exists precisely to flatten; a `join` inside a callback blocks a pool thread and invites starvation deadlock

**Symptom:** whole service slows when one endpoint fans out; parallel streams elsewhere crawl too
**Cause:** blocking I/O on `supplyAsync`'s default commonPool — shared, CPU-sized, JVM-wide
**Fix:** every async call that blocks takes an explicit executor (I/O pool or virtual-thread-per-task)

**Symptom:** the same pipeline's callback runs on a Netty event-loop thread in prod and the main thread in tests
**Cause:** non-`Async` callbacks run on the completing thread — or the attaching thread when already complete
**Fix:** treat the executing thread of non-`Async` stages as unspecified; anything thread-sensitive or blocking goes in an `-Async` variant with an executor

**Symptom:** `thenApplyAsync` everywhere "to be safe", and a trivial five-stage pipeline shows five thread hops
**Cause:** cargo-cult `-Async`; each hop is a queue-and-dispatch
**Fix:** `-Async` only where the callback blocks or is heavy; cheap pure transforms stay non-`Async`

**Symptom:** `supplyAsync` on a container with 1 CPU behaves wildly differently from the 8-CPU laptop
**Cause:** commonPool parallelism follows `availableProcessors()`; at parallelism < 2 the Javadoc's fallback runs a new thread per task
**Fix:** explicit executors in anything containerized; never let the deployment environment size an implicit pool

**Symptom:** a callback mutates a field and another thread reads it "after completion" but sees stale state
**Cause:** results must flow *through* the future; side-channel mutation is an ordinary data race
**Fix:** completion establishes happens-before for the *result value path* — pass data as stage results, or synchronize the side channel ([JMM chunk 2](../05-java-memory-model/02-happens-before.md))

## Interview questions

**★ `thenApply` vs `thenCompose`?**
`thenApply` maps a value with a plain function — future of the function's
return type. `thenCompose` takes a function that itself returns a
`CompletionStage` and flattens it. Same relationship as `map` vs
`flatMap`. If you ever see a nested `CompletableFuture` type, someone
answered this wrong in code.

**★ What executor does `supplyAsync` use if you don't pass one, and why does it matter?**
`ForkJoinPool.commonPool()` — JVM-wide, sized for CPU count, shared with
parallel streams. Blocking I/O on it starves every other user; container
CPU limits shrink it further; at parallelism < 2 it falls back to a
thread per task. Production async I/O passes an explicit executor.

**★ Which thread runs a non-`Async` callback?**
Unspecified by design: the thread that completes the stage, or the
attaching thread if the stage was already complete. So it can be an I/O
completion thread under load and your own thread in a warm-cache path.
Only `-Async` with an explicit executor gives a guarantee.

**★ You have futures for price and inventory and need both to build an offer. Which method?**
`thenCombine` — both run concurrently, the two-arg function fires when
both complete. `thenCompose` would serialize them (start the second in
the first's callback); `allOf` is the n-ary generalization when the
count grows past two.

**★ `CompletionStage` vs `CompletableFuture`?**
`CompletionStage` is the composition *interface* — the `thenXxx`
vocabulary with no way to complete, join or block. `CompletableFuture`
is the JDK's implementation adding completion (`complete`,
`completeExceptionally`) and blocking reads (`get`, `join`). APIs should
*return* `CompletionStage` when callers must not be able to complete or
block it; `minimalCompletionStage()` produces exactly that restricted
view, and `toCompletableFuture()` crosses back.

**★ When is `new CompletableFuture<>()` the right constructor?**
Adapting callback- or listener-style APIs: create it, return it, and
`complete`/`completeExceptionally` from the callback. It is the bridge
between push APIs and composable stages — with the caveat that *you* now
own completing it on every path, including timeouts.

---

← Prev: [Overview](README.md) · Index: [CompletableFuture](README.md) · Next → [Fan-out: `allOf`, `anyOf`, timeouts](02-fan-out-allof-anyof-timeouts.md)
