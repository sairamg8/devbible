---
title: "Submitting work and getting results"
sidebar_label: "2 · Submit and Futures"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `ExecutorService`
> (`submit`, `invokeAll`, `invokeAny`), `Future`, `FutureTask`,
> `CancellationException`, `ExecutionException` and the
> `java.util.concurrent` package documentation (memory-consistency
> section).

**`execute` and `submit` look interchangeable and differ in the one way
that produces silent production failures: what happens to an exception the
task throws. `execute` lets it hit the thread's uncaught-exception
handler; `submit` captures it inside the returned `Future`, where it
waits — forever, if nobody calls `get`. Half of "the job just stopped
running and nothing was logged" incidents are this paragraph.**

## `execute` vs `submit`

```java
executor.execute(() -> risky());          // Runnable; exception → thread's
                                          // UncaughtExceptionHandler → usually a log

Future<?> f = executor.submit(() -> risky());   // exception CAPTURED in f,
                                                // rethrown only from f.get()
```

- **`execute(Runnable)`** — fire-and-forget. An escaping exception
  reaches the worker thread's `UncaughtExceptionHandler` (set one in the
  `ThreadFactory` — [chunk 1](01-anatomy-of-a-pool.md)); the pool replaces
  the thread and moves on.
- **`submit(...)`** — wraps the task in a `FutureTask`; *any* exception is
  caught and stored. The task "succeeds" from the pool's point of view.
  If the code path that submitted it never calls `get()`, the failure is
  invisible: no log, no handler, nothing.

Rule of thumb: **submit only if some code will actually consume the
`Future`**. For fire-and-forget, use `execute`, or wrap the body in its
own try/catch that logs — the pattern the global-handler page calls the
compartment boundary
([phase 5, topic 08](../../phase-5-exceptions/08-global-handler.md)).

## `Future` — the four questions you can ask

```java
Future<Report> f = executor.submit(this::buildReport);

Report r = f.get();                        // block until done (or throw)
Report r2 = f.get(2, TimeUnit.SECONDS);    // block with timeout → TimeoutException
boolean gone = f.cancel(true);             // try to cancel; true = interrupt if running
boolean done = f.isDone();                 // completed, failed OR cancelled
```

What `get` throws tells you what happened:

| Thrown | Meaning |
|---|---|
| `ExecutionException` | the task threw — the real failure is `getCause()` |
| `CancellationException` | the future was cancelled (unchecked!) |
| `InterruptedException` | *your* waiting thread was interrupted — the task may still be running |
| `TimeoutException` | timed `get` expired — the task is still running; decide whether to `cancel` |

Unwrapping `ExecutionException.getCause()` and rethrowing it as your
domain exception is standard translation — the phase 5 pattern
([topic 04](../../phase-5-exceptions/04-custom-exceptions-translation.md)).
`cancel(true)` delivers an interrupt; whether the task stops depends
entirely on it honouring interruption — cooperative cancellation, [topic 01](../01-threads-lifecycle-interrupt/README.md).

## Batches: `invokeAll` and `invokeAny`

```java
List<Callable<Quote>> calls = providers.stream()
        .map(p -> (Callable<Quote>) () -> p.quote(request))
        .toList();

List<Future<Quote>> all = executor.invokeAll(calls, 2, TimeUnit.SECONDS);
// blocks until all complete OR timeout; timed-out tasks are CANCELLED

Quote first = executor.invokeAny(calls, 2, TimeUnit.SECONDS);
// first successful result; the REST ARE CANCELLED; throws if none succeed
```

- `invokeAll` returns only when every future is done — check each with
  `get()` (which no longer blocks) and expect a mix of results,
  `ExecutionException`s and `CancellationException`s in the timed form.
- `invokeAny` is racing redundant work: first success wins, losers are
  cancelled. No partial results — if all fail it throws
  `ExecutionException` (the last failure).

For richer fan-out — combining, racing with fallbacks, non-blocking
composition — the tool is **topic 07 · `CompletableFuture`** *(not written
yet)*; for fan-outs whose subtasks must never outlive the operation,
[topic 08 · Structured concurrency](../08-structured-concurrency.md).

## The memory edges you get for free

Documented in the `java.util.concurrent` package Javadoc, in
happens-before terms ([JMM chunk 2](../05-java-memory-model/02-happens-before.md)):

- everything the submitter did **before** `submit`/`execute` is visible
  to the task;
- everything the task did is visible to whoever observes completion via
  `Future.get`.

So tasks can read the request objects they were built from, and callers
can read task results, with no `volatile`, no locks. What is *not*
covered: peeking at side-channel mutable state while the task runs —
that's an ordinary data race.

## Gotchas

**Symptom:** nightly job "ran" (pool healthy, no errors logged) but produced nothing for weeks
**Cause:** `submit` captured the NPE thrown on the first record; the scheduler never called `get`, so the exception lived and died inside the Future
**Fix:** consume every Future, or use `execute` with a logging try/catch inside the task; for periodic jobs see the scheduling variant of this trap in [chunk 3](03-scheduling-and-sizing.md)

**Symptom:** `f.get()` hangs a request thread indefinitely
**Cause:** untimed `get` on a task stuck on a dead downstream — the wait has no bound
**Fix:** always the timed overload at service boundaries; on `TimeoutException`, decide explicitly between `cancel(true)` and abandoning the result

**Symptom:** `cancel(true)` returns true but the task keeps running to completion
**Cause:** cancellation is an interrupt, and the task never checks its interrupt status (CPU loop, or it swallows `InterruptedException`)
**Fix:** tasks that should be cancellable must poll `Thread.interrupted()` / let `InterruptedException` propagate — cancellation is cooperative ([topic 01](../01-threads-lifecycle-interrupt/README.md))

**Symptom:** `catch (Exception e)` around `f.get()` logs `java.util.concurrent.ExecutionException` with a useless message
**Cause:** the real failure is wrapped; the catch logged the wrapper
**Fix:** unwrap `getCause()` and translate to a domain exception; keep the cause chain ([phase 5, topic 04](../../phase-5-exceptions/04-custom-exceptions-translation.md))

**Symptom:** after `invokeAll` with a timeout, iterating results throws `CancellationException` mid-loop and skips the tally of what *did* finish
**Cause:** timed `invokeAll` cancels unfinished tasks; `CancellationException` is unchecked and escapes a loop that only catches `ExecutionException`
**Fix:** per-future `try/catch` handling both: completed → result, cancelled → count as timed out, failed → cause

**Symptom:** work submitted from inside a task to the same bounded single/small pool deadlocks
**Cause:** parent task blocks on child's `get`; child sits in the queue waiting for the thread the parent occupies — thread-starvation deadlock
**Fix:** never block a pool thread on work queued to the same pool; use `CompletableFuture` composition, a separate pool, or virtual threads

**Symptom:** `Future.isDone()` used as "did it succeed"
**Cause:** `isDone` is true for success, failure *and* cancellation
**Fix:** completion state comes from calling `get` (or JDK 19+ `state()`/`resultNow()`/`exceptionNow()` on a done future) — not from `isDone`

## Interview questions

**★ `execute` vs `submit` — the difference that matters in production?**
Exception routing. `execute`: escaping exceptions hit the thread's
`UncaughtExceptionHandler` — at least a log by default. `submit`: they're
stored in the Future and only rethrown from `get`; an unconsumed Future
means a silently swallowed failure. Choose by whether anyone will read
the result.

**★ What can `Future.get` throw and what does each mean?**
`ExecutionException` (task threw — unwrap `getCause`),
`CancellationException` (unchecked — future cancelled),
`InterruptedException` (the *waiter* was interrupted, task unaffected),
`TimeoutException` (timed form — task still running). Four different
failures, three different parties.

**★ What does `cancel(true)` actually do?**
Marks the future cancelled (waiters get `CancellationException`), and if
the task already runs, interrupts its thread. Nothing forcibly stops;
the task must cooperate by honouring the interrupt. `cancel(false)` only
prevents a not-yet-started task from starting.

**★ `invokeAll` vs `invokeAny`?**
`invokeAll`: run everything, block until all done (or timeout, which
cancels stragglers), return all futures — you inspect each. `invokeAny`:
redundant racing — first successful result returns, everything else is
cancelled; throws only if *no* task succeeds.

**★ Describe thread-starvation deadlock with a bounded pool.**
A task blocks on `get` of a subtask queued to the same pool. With all
threads occupied by blocked parents, subtasks can never start — permanent
deadlock with an empty-looking CPU. Fixes: don't block pool threads on
same-pool work; compose asynchronously; separate pools per dependency
layer; or virtual threads, which make blocking cheap and pool exhaustion
a non-event.

**★ What visibility guarantees does an executor give without any synchronization in your code?**
Submitter's prior writes happen-before the task's start; the task's writes
happen-before `Future.get` returning. Handoff through the executor is
safe publication in both directions — as long as data actually travels
through submission and results, not through shared mutable fields read
mid-flight.

---

← Prev: [Anatomy of a pool](01-anatomy-of-a-pool.md) · Next → [Scheduling and sizing](03-scheduling-and-sizing.md)
