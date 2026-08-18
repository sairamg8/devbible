---
title: "Failure, cancellation, and when not to"
sidebar_label: "3 · Failure and when not to"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `CompletableFuture`
> (`exceptionally`, `handle`, `whenComplete`, `cancel`, `join`, `get`,
> exceptional-completion rules), `CompletionException`, and the JDK 25
> Core Libraries virtual-threads guide.

**A `CompletableFuture` pipeline has a second, parallel pipeline inside
it: the exception path. Failures skip over `thenApply` stages until
something catches them, every callback-thrown exception is wrapped in
`CompletionException`, and `cancel` — despite its signature — never
interrupts anything. Then the last question: now that virtual threads
make blocking cheap, does this pipeline deserve to be a pipeline at
all?**

## The three recovery operators

```java
cf.exceptionally(ex -> Fallback.of(ex));      // failure → value (success skips)
cf.handle((val, ex) -> ex == null ? val : fb); // both paths, always runs
cf.whenComplete((val, ex) -> log(val, ex));    // observe both, change nothing
```

| Operator | Runs on success | Runs on failure | Can change the result |
|---|---|---|---|
| `exceptionally` | skipped | yes | replaces failure with a value |
| `handle` | yes | yes | full control of both paths |
| `whenComplete` | yes | yes | no — passes the outcome through |

Details the table hides:

- A failure **propagates past** every value stage (`thenApply`,
  `thenCompose`, …) untouched — they simply don't run — until an
  `exceptionally`/`handle` absorbs it. Placement is semantics: a fallback
  *before* `allOf` rescues one input; *after*, it rescues the whole
  fan-out.
- `whenComplete` passes the original outcome through — but if its
  *action* throws while the source succeeded, the returned stage fails
  with the action's exception; if the source already failed, the source
  exception wins and the action's is added as **suppressed**
  ([phase 5's suppression model](../../phase-5-exceptions/03-try-with-resources/02-suppressed-exceptions.md)).
- All three have `-Async` variants (`exceptionallyAsync` since JDK 12),
  and `exceptionallyCompose` covers "recover by calling another async
  fallback service".

## `CompletionException` vs `ExecutionException`

The same failure wears different coats depending on the door you exit
through:

- **`join()`** throws the cause wrapped in **`CompletionException`**
  (unchecked).
- **`get()`** throws it wrapped in checked **`ExecutionException`**
  ([the `Future` contract](../06-executorservice-pools/02-submit-and-futures.md)).
- **Inside callbacks** (`handle`, `exceptionally`, `whenComplete`) you
  usually receive the `CompletionException` wrapper for upstream
  callback failures — but a future completed directly via
  `completeExceptionally(ex)` hands your callback the bare `ex`.
  Recovery code therefore unwraps defensively:

```java
static Throwable rootOf(Throwable ex) {
    return (ex instanceof CompletionException || ex instanceof ExecutionException)
            && ex.getCause() != null ? ex.getCause() : ex;
}
```

Translate the unwrapped cause into a domain exception at the boundary —
the same discipline as
[phase 5's layer translation](../../phase-5-exceptions/04-custom-exceptions-translation.md).

## `cancel` — weaker than it reads

```java
cf.cancel(true);   // the boolean is IGNORED
```

The Javadoc is explicit: `mayInterruptIfRunning` **has no effect** in
`CompletableFuture` — cancellation just completes the future with a
`CancellationException`. Nobody interrupts the thread running the
supplier; downstream stages see the cancellation, the *work* does not.
Consequences:

- Cancelling a fan-out abandons results, it does not reclaim capacity.
  The HTTP calls finish; the connections stay busy.
- Real cooperative cancellation needs the interruption protocol
  ([topic 01](../01-threads-lifecycle-interrupt/02-interruption.md)) —
  which plain `ExecutorService.submit` + `Future.cancel(true)` *does*
  deliver, and `CompletableFuture` deliberately does not.
- Scope-owned lifetimes — where abandoning the operation genuinely
  interrupts and reaps every subtask — are structured concurrency's
  contract: **topic 08** *(not written yet at this chunk's writing)*.

## When *not* to: virtual threads and the readable alternative

The chain exists to avoid parking a scarce platform thread. With
virtual threads ([topic 02](../02-platform-vs-virtual-threads/02-what-changed-what-didnt.md))
parking is cheap, and the JDK's own guidance is to write blocking code:

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    Future<Profile> profile = executor.submit(() -> client.profile(userId));
    Future<Orders>  orders  = executor.submit(() -> client.orders(userId));
    return new PageData(profile.get(), orders.get());   // blocking is fine now
}
```

Same fan-out, same latency, ordinary exceptions (no wrapper taxonomy),
ordinary stack traces, debuggable with a thread dump. Keep
`CompletableFuture` when the *API you consume* speaks it, when you need
its combinators (`thenCombine`, `completeOnTimeout` degradation,
`exceptionallyCompose` fallbacks) as vocabulary, or when integrating
event-driven completion sources. Prefer blocking-on-virtual-threads for
straight-line request logic — and structured concurrency once the
fan-out needs owned lifetimes.

## Gotchas

**Symptom:** fallback in `exceptionally` never fires though the downstream clearly failed
**Cause:** it was attached to a *branch* the failure doesn't flow through (e.g. on `allOf`'s result while the failure was replaced per-input, or on a sibling)
**Fix:** recovery attaches to the stage whose failure it should absorb; draw the DAG — exceptions flow along edges, not across them

**Symptom:** `catch (MyServiceException e)` around `join()` never matches
**Cause:** `join` throws `CompletionException` wrapping it
**Fix:** catch `CompletionException` and translate `getCause()`, or unwrap with a `rootOf` helper at every boundary

**Symptom:** retry logic re-invokes the whole pipeline although only the last stage failed
**Cause:** recovery placed at the pipeline tail sees one merged failure; nothing recorded *which* stage threw
**Fix:** `exceptionallyCompose` at the stage that owns the retryable call; tail recovery is for whole-operation fallbacks only

**Symptom:** `whenComplete` added "just for logging" turns successes into failures
**Cause:** the logging action itself threw (null-unsafe formatting of the failure path); on a successful source, the action's exception becomes the result
**Fix:** `whenComplete` actions must be exception-proof; wrap their body or make them trivially safe

**Symptom:** load-shedding calls `cancel(true)` on in-flight work, yet downstream QPS doesn't drop
**Cause:** `CompletableFuture.cancel` ignores the interrupt flag; suppliers run to completion
**Fix:** shed by cancelling at the *client* (HTTP request abort), by interruptible `Future.cancel(true)` on an executor task, or by structured-concurrency scopes

**Symptom:** errors vanish: pipeline "succeeds" with `null` results after a downstream failure
**Cause:** a `handle((v, ex) -> ...)` that returns `null` on the exception path — recovery by silence; `handle` *always* absorbs the failure, whether or not you meant it to
**Fix:** `handle` must either produce a real fallback or rethrow (wrap in `CompletionException`); if only the failure path needs work, `exceptionally` states that intent

**Symptom:** a future never completes; its consumers wait forever with no error anywhere
**Cause:** hand-completed future (`new CompletableFuture<>()`) with a code path — usually an error callback — that forgets to complete it
**Fix:** every adapter completes on *all* paths (success, failure, timeout — `orTimeout` as the backstop); audit callbacks for early returns

## Interview questions

**★ `exceptionally` vs `handle` vs `whenComplete`?**
`exceptionally`: failure-only, maps it to a recovery value.
`handle`: always runs, receives `(value, exception)`, produces the
result either way. `whenComplete`: always runs but cannot change the
outcome — observation (logging, metrics) only, with the caveat that its
own thrown exceptions can fail a successful source.

**★ What does `join()` throw, and how does it differ from `get()`?**
`join` wraps failure causes in unchecked `CompletionException`; `get`
wraps in checked `ExecutionException` (plus `InterruptedException`).
Same cause underneath — which is why boundary code unwraps before
translating, and why utility `rootOf` helpers handle both wrappers.

**★ Why is `CompletableFuture.cancel(true)` weaker than `Future.cancel(true)` on an executor task?**
The Javadoc specifies `mayInterruptIfRunning` has no effect: cancel just
completes the future with `CancellationException`. An executor's
`FutureTask.cancel(true)` interrupts the running thread. So a
`CompletableFuture` chain abandons work; it cannot stop it.

**★ Where does a failure "go" in a ten-stage pipeline where stage 2 throws?**
It completes stage 2's future exceptionally (wrapped in
`CompletionException` if thrown from a callback); stages 3–10 that are
value transformations are skipped, each completing exceptionally with
the same cause, until a recovery operator absorbs it — or it reaches
the terminal `join`/`get`.

**★ Recover from a failed call by trying a *different async* fallback — which operator?**
`exceptionallyCompose` (JDK 12): like `exceptionally` but the recovery
function returns a `CompletionStage` — call the secondary service, don't
block computing a value. `exceptionally` is for locally-computable
fallbacks; using it to call-and-`join` a backup service blocks a thread
inside a callback.

**★ When would you still choose a CompletableFuture chain over blocking virtual-thread code?**
When the surrounding API already trades in `CompletionStage` (async
drivers, frameworks), when combinator vocabulary carries the logic
(`thenCombine`, `completeOnTimeout` degradation, either-racing), or for
event-completed sources with no thread to block. For straight-line
request fan-out, blocking on virtual threads wins on exceptions, traces
and debuggability — per the JDK's own virtual-threads guidance.

---

← Prev: [Fan-out: `allOf`, `anyOf`, timeouts](02-fan-out-allof-anyof-timeouts.md) · Index: [CompletableFuture](README.md) · Next → [Structured concurrency](../08-structured-concurrency.md)
