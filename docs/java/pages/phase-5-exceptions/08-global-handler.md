---
title: "Where the global handler lives"
sidebar_label: "08 · The global handler"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against the JDK 25 API documentation
> (docs.oracle.com/en/java/javase/25/) for `Thread.UncaughtExceptionHandler`,
> `Thread.setDefaultUncaughtExceptionHandler`, `ThreadGroup.uncaughtException`,
> `ThreadPoolExecutor` (the `execute`/`submit`/`afterExecute` Javadoc) and
> `Future.get`.

**Every service needs exactly one place where "we didn't plan for this"
becomes a clean 500, a log line with a stack trace, and a metric — and that
place is at the *top* of the stack, not the middle. Java gives you a ladder
of last resorts: the framework's handler for request threads, per-thread and
default `UncaughtExceptionHandler`s for everything else, and a printed
trace as the final fallback. The classic failure is not a missing rung —
it's a `catch (Exception e) {}` five frames down that stops the exception
from ever reaching one.**

## The ladder, from nearest to last resort

1. **A `catch` on the stack** — nearest enclosing handler wins; nothing
   below applies unless every frame declines.
2. **The framework's request-level handler** — in a Spring service that is
   `@ControllerAdvice`/`@ExceptionHandler` (**Phase 9** *(not written
   yet)*): it owns translating uncaught exceptions into HTTP responses, so
   controller code mostly shouldn't catch at all.
3. **The thread's own handler** — `thread.setUncaughtExceptionHandler(...)`,
   consulted when a `Runnable` ends by throwing.
4. **The default handler** —
   `Thread.setDefaultUncaughtExceptionHandler(...)`, process-wide fallback
   for threads without their own. Set this once at startup in every real
   service: log with the thread name, increment a metric, decide whether to
   exit.
5. **The `ThreadGroup`** — for platform threads with no handler at all,
   `ThreadGroup.uncaughtException` runs; its inherited behavior is the
   familiar `Exception in thread "..."` trace printed to `System.err`. That
   printout is what "no error handling strategy" looks like in production:
   stderr, no metric, no alert.

An uncaught exception kills only its own thread. The process keeps running
— which is worse than a crash when the dead thread was a consumer loop
nobody restarts: the service looks healthy and quietly stops working.

## The executor split: `execute` swallows nothing, `submit` swallows everything

The single most common way exceptions vanish in services:

```java
ExecutorService pool = Executors.newFixedThreadPool(4);

pool.execute(task);                    // throw → reaches the thread's
                                       // UncaughtExceptionHandler; worker is
                                       // replaced by the pool

Future<?> f = pool.submit(task);       // throw → CAPTURED into the Future.
                                       // No handler runs. Nothing is logged.
```

`submit` wraps the task in a `FutureTask`; a thrown exception becomes the
task's *result*, surfaced only when someone calls `f.get()` — as an
`ExecutionException` wrapping the real one. Fire-and-forget code that calls
`submit` and drops the `Future` has built a silent failure mode: the task
died, no log line exists, and the uncaught-exception handler never heard
about it. The honest options:

- use `execute` for fire-and-forget — failures reach the handler;
- keep the `Future` and `get()` it somewhere that logs;
- or override `afterExecute(Runnable r, Throwable t)` on a
  `ThreadPoolExecutor` — the documented hook that can inspect both the
  `execute` throwable and (with the Javadoc's own unwrapping recipe) a
  `FutureTask`'s captured one.

`CompletableFuture` has the same shape with different spelling: an
exception parks in the future until a stage (`exceptionally`, `handle`,
`whenComplete`) or a `join()` observes it.

## Virtual threads

Virtual threads (JDK 21+) follow the same two rungs — per-thread handler,
then the process default — so the startup-time
`setDefaultUncaughtExceptionHandler` covers them too. What changes
operationally is scale and lifecycle: a virtual thread per task means an
uncaught throw kills a thread nobody tracks by name, and
thread-per-task executors surface failures through the same
`submit`-captures-it rule above. The default handler plus a metric is your
only aggregate view of "tasks dying that nobody `get()`s".

## Why the mid-stack swallow hides incidents

```java
try {
    reserveInventory(order);
    chargeCard(order);
} catch (Exception e) {            // "so one bad order doesn't kill the batch"
    log.warn("order failed");       // no stack, no id, no rethrow
}
shipOrder(order);                  // runs anyway — inventory maybe reserved,
                                   // card maybe not charged
```

Two separate sins compound here:

- **The catch is too wide.** `Exception` catches the NPE that marks a bug,
  the `SQLTransientException` that wanted a retry, and the interrupt that
  wanted shutdown — one policy for three different situations.
- **Execution continues past corrupted state.** The method's own
  invariant — "charged implies reserved" — is now unknown, and everything
  downstream runs on that unknown. Multiply by a loop and one poisoned
  element becomes a batch of inconsistent records *plus* a log file with
  nothing but `order failed` — the incident with no evidence.

A mid-stack `catch` is legitimate in exactly three shapes: **handle fully**
(the fallback genuinely restores the contract — cache miss → recompute);
**translate** at a layer boundary (`SQLException` →
`RepositoryException(cause)` — [topic 04](04-custom-exceptions-translation.md)); or
**enrich and rethrow** (attach the order ID, keep the cause). All three end
with the invariant intact or the exception still moving up. What is never
legitimate mid-stack is *ending* the exception without restoring the
contract — that decision belongs to the top of the ladder, which knows what
the operation as a whole means.

## Fail fast vs degrade — decided per dependency, at the top

The global handler is also where honesty about failure modes lives:

- **Fail the request** when the failed step was the point — a payment
  service that can't reach the processor returns 502/503, it does not
  "degrade" into pretending.
- **Degrade explicitly** when the feature is genuinely optional —
  recommendations down → render without the panel, *and* emit the metric.
  Degrading is a product decision recorded in code, not a `catch {}`
  someone forgot.
- **Crash the process** when state may be globally corrupt (an `Error`
  like `OutOfMemoryError`, a failed static initializer): the default
  handler logs and calls `System.exit`, and the orchestrator restarts a
  clean instance. A supervised restart beats a wounded survivor.

## Gotchas

**Symptom:** background tasks fail for days with zero log output; the pool looks healthy
**Cause:** tasks started with `submit(...)` and the `Future` discarded — throws are captured into the future, and no handler or log ever runs
**Fix:** `execute` for fire-and-forget, or always consume the `Future`, or an `afterExecute` override that logs both paths

**Symptom:** `Exception in thread "..."` traces on stderr but nothing in the log aggregator, no alerts
**Cause:** no default `UncaughtExceptionHandler` — the `ThreadGroup` fallback printed to `System.err`, which isn't shipped anywhere
**Fix:** `Thread.setDefaultUncaughtExceptionHandler` at startup: structured log + metric; treat its firing as a bug to fix, since something bypassed the nearer rungs

**Symptom:** a consumer/polling loop thread died hours ago; the service passes health checks while processing nothing
**Cause:** an uncaught exception kills only its thread — the process survives, and nobody restarts the loop
**Fix:** catch-log-continue *inside* the loop body for per-item failures; a supervisor (or health check) watching loop liveness for the rest

**Symptom:** `ExecutionException` stack traces point into executor plumbing, not the failing code
**Cause:** `Future.get` wraps the task's exception — the real failure is the `getCause()`
**Fix:** unwrap and log the cause (and its own cause chain — [topic 05](05-reading-stack-traces/README.md) reads them fast); rethrow a translation, not the wrapper

**Symptom:** after "hardening", a service returns 200s with half-done work during incidents
**Cause:** mid-stack `catch (Exception e) { log; continue; }` added to stop crashes — it also stopped the framework handler from turning failures into error responses
**Fix:** let it propagate; hardening means the *top* handler maps failures to correct statuses, not that lower layers pretend success

**Symptom:** interrupting a stuck worker does nothing; shutdown hangs
**Cause:** the wide mid-stack catch swallowed `InterruptedException` along with everything else, clearing the only stop signal
**Fix:** catch `InterruptedException` separately — restore the flag (`Thread.currentThread().interrupt()`) and exit the loop

**Symptom:** the default handler was set, but exceptions from one subsystem never reach it
**Cause:** that subsystem's threads were built with their *own* per-thread handler (or a framework installed one) — the nearer rung wins
**Fix:** intended: fine. Not intended: audit thread factories; per-thread handlers should delegate to the default after their local concern

## Interview questions

**★ Walk the full path of an exception nobody catches, from throw to console.**
Unwind to the top of the thread's stack looking for a handler; none found →
the thread's own `UncaughtExceptionHandler` if set; else the process-wide
default handler if set; else (platform threads) the `ThreadGroup`'s
`uncaughtException`, whose inherited implementation prints
`Exception in thread "name"` plus the trace to `System.err`. Then the
thread terminates — only the thread, not the process.

**★ Why does `submit` hide exceptions that `execute` surfaces?**
`submit` wraps the task in a `FutureTask`, and a `FutureTask` *is* the
handler — it captures any throw as the task's outcome, delivered only via
`Future.get` as an `ExecutionException`. The thread ends normally, so no
uncaught-exception machinery runs. `execute` runs the `Runnable` bare; a
throw actually terminates the worker, reaching the handler chain (and the
pool replaces the worker).

**★ Your teammate wraps every service method in `try { ... } catch (Exception e) { log.error(e); return null; }`. Argue against it.**
It converts every failure into a `null` that resurfaces as an NPE far from
the cause; it flattens bugs, transient faults and interrupts into one
non-policy; it silently violates the method's contract (caller proceeds on
half-done state); and it starves the top-level handler that would have
produced the correct 500 and alert. Catch mid-stack only to handle fully,
translate, or enrich-and-rethrow.

**★ Where do uncaught exceptions in virtual threads end up?**
Same ladder, minus the group rung that matters: per-thread handler, then
the process default handler. With thread-per-task concurrency the default
handler plus a metric is the only aggregate signal — individual virtual
threads are too numerous and anonymous to watch by name — and
executor-submitted tasks still capture into their `Future` instead.

**★ When is crashing the process the correct "handling"?**
When correctness of shared state is no longer knowable: `OutOfMemoryError`
(any allocation may have failed anywhere), failed class initialization,
a corrupted critical singleton. Log from the default handler and exit
non-zero; the orchestrator's restart gives a clean state, which no
in-process recovery can promise at that point. Degrading is for *scoped*,
understood failures — not for wounded JVMs.

---

← Prev: [Exceptions as control flow](07-exceptions-as-control-flow.md) · Next → [Phase 6 — Concurrency](../phase-6-concurrency/README.md)
