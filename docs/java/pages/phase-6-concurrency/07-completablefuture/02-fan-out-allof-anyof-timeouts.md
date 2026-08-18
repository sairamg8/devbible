---
title: "Fan-out: allOf, anyOf, timeouts"
sidebar_label: "2 · Fan-out and timeouts"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `CompletableFuture`
> (`allOf`, `anyOf`, `orTimeout`, `completeOnTimeout`, `delayedExecutor`,
> `join`).

**The reason this API exists in service code: a request needs profile,
orders and recommendations from three downstreams, and calling them in
sequence stacks three latencies. Start all three, then join. `allOf` is
the tool, and its two sharp edges — a `Void` result that forces a re-join
idiom, and fail-fast-on-any-exception semantics — are exactly the parts
the Javadoc states and tutorials skip.**

## The three-services join

```java
CompletableFuture<Profile>  profile = client.profileAsync(userId, ioPool);
CompletableFuture<Orders>   orders  = client.ordersAsync(userId, ioPool);
CompletableFuture<Recs>     recs    = client.recsAsync(userId, ioPool);

CompletableFuture<PageData> page =
    CompletableFuture.allOf(profile, orders, recs)          // CF<Void>!
        .thenApply(v -> new PageData(
            profile.join(),        // completed — join() returns instantly
            orders.join(),
            recs.join()));
```

The idiom in three facts:

- **All three calls start before `allOf` is ever mentioned.** The fan-out
  happens at *creation*; `allOf` only observes. Total latency ≈ the
  slowest call, not the sum.
- **`allOf` returns `CompletableFuture<Void>`** — with heterogeneous
  result types there is no `List<T>` it could give you. The re-join
  inside `thenApply` is the sanctioned pattern: those `join()` calls
  cannot block, because the stage only runs after all inputs completed.
- **If any input fails, the `allOf` future completes exceptionally** —
  the dependent stage never runs, and the first-registered failure
  surfaces (wrapped in `CompletionException`) when you join the result.
  "Give me the two that succeeded" needs per-future recovery *before*
  `allOf` ([chunk 3](03-failure-cancellation-when-not.md)).

For a homogeneous fan-out (same result type, dynamic count):

```java
List<CompletableFuture<Quote>> calls =
        providers.stream().map(p -> p.quoteAsync(req, ioPool)).toList();

CompletableFuture<List<Quote>> quotes =
    CompletableFuture.allOf(calls.toArray(CompletableFuture[]::new))
        .thenApply(v -> calls.stream().map(CompletableFuture::join).toList());
```

## `anyOf` — first settled wins, including failures

```java
CompletableFuture<Object> fastest =
        CompletableFuture.anyOf(primary, replica1, replica2);
```

Three properties to hold in mind together:

- The result type is `CompletableFuture<Object>` — the compiler gives up
  on heterogeneous inputs; you cast. For same-type racing,
  `applyToEither` chains keep the type but only take two at a time.
- **First *completion* wins, not first *success*.** A fast failure beats
  a slow success — `anyOf` completes exceptionally even though another
  branch would have delivered. Hedged-request patterns that want
  first-*success* need per-branch `exceptionally` guards or a manual
  `CompletableFuture` completed by whichever branch succeeds first.
- The losers keep running. `anyOf` does not cancel the other calls —
  they occupy their threads/connections to completion. Cancellation is
  yours to arrange, and even then it doesn't interrupt
  ([chunk 3](03-failure-cancellation-when-not.md)). Fan-outs whose
  losers must actually stop are what structured concurrency's
  any-success joiner is for — [topic 08](../08-structured-concurrency.md).

## Timeouts — `orTimeout` and `completeOnTimeout`

Before JDK 9 a `CompletableFuture` could wait forever unless you raced it
by hand. Two instance methods fixed it:

```java
client.recsAsync(userId, ioPool)
      .completeOnTimeout(Recs.empty(), 150, TimeUnit.MILLISECONDS);
                                            // degrade: default value

client.paymentAsync(order, ioPool)
      .orTimeout(2, TimeUnit.SECONDS);      // fail: TimeoutException
```

- `orTimeout` completes the future exceptionally with `TimeoutException`
  if it isn't done by the deadline; `completeOnTimeout` completes it
  *normally* with the fallback value. Degradable data (recommendations)
  gets `completeOnTimeout`; must-succeed operations (payment) get
  `orTimeout` plus a handler.
- Both are implemented on a **single shared scheduler thread** for the
  whole JVM (the Javadoc: one thread services all `orTimeout` /
  `completeOnTimeout` triggers). The timeout *action* is trivial and
  cheap by design — but any dependent non-`Async` stage of a timed-out
  future may run **on that scheduler thread**. Blocking it delays every
  other timeout in the process: dependents of a timeout must be
  `-Async`.
- The timeout completes the *future*; the underlying work keeps running
  unless separately cancelled — same story as `anyOf`'s losers.
- `delayedExecutor(delay, unit, executor)` is the general tool: an
  executor that queues the task after a delay — useful for retry
  backoff without a `ScheduledExecutorService`
  ([pools chunk 3](../06-executorservice-pools/03-scheduling-and-sizing.md)).

## Gotchas

**Symptom:** "parallel" fan-out is exactly as slow as the sequential version
**Cause:** the async calls are created inside a `thenCompose` chain — each starts only when the previous completes
**Fix:** create all futures first (they start immediately), compose afterwards; fan-out lives at creation time

**Symptom:** `allOf(...).thenApply(v -> ...)` — and the lambda's `v` is useless, so someone "simplifies" by joining futures that aren't inputs of the `allOf`
**Cause:** the re-join idiom only works because `allOf` gates the stage; joining a future *not* in the `allOf` set can block a pool thread
**Fix:** every future joined inside the dependent stage must be an argument of the `allOf`

**Symptom:** fan-out page renders blank whenever the recommendations service has a bad minute
**Cause:** one failed input fails the whole `allOf`; the page-building stage never runs
**Fix:** attach per-future fallbacks *before* `allOf` — `recs.exceptionally(e -> Recs.empty())` — so the join sees defaults, not failure

**Symptom:** a dynamic fan-out "completes" instantly and downstream code reads an empty result set as "no data anywhere"
**Cause:** the provider list was empty — `allOf()` of zero futures is already complete, so the dependent stage runs immediately
**Fix:** an empty fan-out is a distinct business case; check the list before fanning out instead of letting vacuous completion impersonate an answer

**Symptom:** `anyOf` used for hedged reads returns an exception although a replica answered 5 ms later
**Cause:** first *completion* wins — a fast connection-refused beats a slow success
**Fix:** guard each branch with `exceptionally` → sentinel + filter, or complete a fresh future only on success from each branch

**Symptom:** after adding `orTimeout` everywhere, timeouts fire late in bursts
**Cause:** a dependent non-`Async` stage of a timed-out future blocked the JVM-wide single timeout-scheduler thread
**Fix:** stages downstream of `orTimeout`/`completeOnTimeout` are `-Async` with a real executor; the scheduler thread must only ever flip completion state

**Symptom:** memory climbs during a downstream outage; thread dump shows the calls all completed
**Cause:** `orTimeout` completed the futures, but the underlying HTTP calls keep running and holding connections — nothing cancelled them
**Fix:** on timeout, also cancel/close the underlying operation via its own handle (HTTP client cancellation, JDBC statement cancel); the future's timeout is bookkeeping, not enforcement

## Interview questions

**★ Fan out to three services and join — write the shape and name the trap.**
Create all three futures first, `allOf(a, b, c)`, then `thenApply` that
re-`join`s each (instant — they're done). Trap: `allOf` is
`CompletableFuture<Void>`, and any single failure fails the whole gate —
per-future `exceptionally` fallbacks go on before the `allOf` if partial
results are acceptable.

**★ Why does `allOf` return `CompletableFuture<Void>`?**
Heterogeneous inputs: there's no useful common result type for
`CF<Profile>, CF<Orders>, CF<Recs>`. The API gives you the completion
signal; you re-join the (already-completed) inputs for values.
Homogeneous fan-outs wrap it into a `CF<List<T>>` with a stream of
joins.

**★ `anyOf` semantics — first success?**
No — first *settled*, success or failure. A fast failure wins over a
slow success, and the losing branches keep running unbought. Both facts
disqualify raw `anyOf` for hedged requests; guard branches or manage a
result future by hand.

**★ `orTimeout` vs `completeOnTimeout`?**
`orTimeout` → exceptional completion with `TimeoutException`: for
operations that must succeed or visibly fail. `completeOnTimeout` →
normal completion with a fallback: graceful degradation. Both leave the
underlying work running, and both trigger from one JVM-wide scheduler
thread — keep dependents async.

**★ Does a timeout stop the underlying call?**
No. It completes the future object; the supplier keeps executing and
holding its resources. Real cancellation needs the underlying client's
own mechanism — or structured concurrency, where the scope interrupts
abandoned subtasks.

---

← Prev: [Creating and composing](01-creating-and-composing.md) · Index: [CompletableFuture](README.md) · Next → [Failure, cancellation, and when not to](03-failure-cancellation-when-not.md)
