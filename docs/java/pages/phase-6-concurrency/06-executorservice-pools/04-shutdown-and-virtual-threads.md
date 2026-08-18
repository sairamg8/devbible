---
title: "Shutdown, and what virtual threads change"
sidebar_label: "4 · Shutdown and virtual threads"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `ExecutorService`
> (`shutdown`, `shutdownNow`, `awaitTermination`, `close` — the
> `AutoCloseable` behaviour added in JDK 19) and `Executors.
> newVirtualThreadPerTaskExecutor`, plus JEP 444 (Virtual Threads,
> final in JDK 21).

**An executor owns non-daemon threads, so a service that never shuts its
pools down doesn't exit — and one that shuts them down carelessly either
hangs the deploy or SIGKILLs tasks mid-write. The protocol is three
methods with precise meanings, one standard drain pattern, and — since
JDK 19 — a `close()` that makes executors work with try-with-resources.
Virtual threads then remove the *pooling* rationale entirely for I/O work:
the executor stops being a scarce resource and becomes a lifecycle
scope.**

## The three methods

| Method | Running tasks | Queued tasks | New submissions |
|---|---|---|---|
| `shutdown()` | finish normally | still executed | rejected |
| `shutdownNow()` | **interrupted** | **returned as a `List<Runnable>`**, never run | rejected |
| `awaitTermination(t, u)` | *(observes)* — blocks until all done, timeout, or interrupt | | |

Notes the table can't hold: `shutdown()` returns immediately — it stops
intake, nothing more; termination is what `awaitTermination` watches for.
`shutdownNow()`'s "stop" is only ever an interrupt — a task that ignores
interruption keeps running (cooperative cancellation again, topic 01
*(not written yet)*). The returned list of never-started tasks is your
chance to log or persist what was abandoned.

## The drain pattern

The Javadoc's own recommended shape — graceful first, forceful second,
never hang forever:

```java
void stop(ExecutorService pool) {
    pool.shutdown();                                      // no new work
    try {
        if (!pool.awaitTermination(30, TimeUnit.SECONDS)) {
            List<Runnable> dropped = pool.shutdownNow();  // interrupt stragglers
            log.warn("forced shutdown, {} queued tasks dropped", dropped.size());
            if (!pool.awaitTermination(5, TimeUnit.SECONDS)) {
                log.error("pool did not terminate — tasks ignore interruption");
            }
        }
    } catch (InterruptedException e) {
        pool.shutdownNow();                               // we were told to hurry
        Thread.currentThread().interrupt();               // preserve the signal
    }
}
```

Pick the first timeout from your deploy budget (Kubernetes
`terminationGracePeriodSeconds`, systemd `TimeoutStopSec`) — the drain
must finish *inside* it, or the platform's SIGKILL wins and no code runs
at all.

## `close()` — executors meet try-with-resources

Since JDK 19, `ExecutorService` extends `AutoCloseable`. `close()` calls
`shutdown()`, then waits **without limit** for termination (interrupting
the waiting thread triggers a `shutdownNow` and re-asserts the interrupt).
That makes scoped, task-shaped usage clean
([try-with-resources](../../phase-5-exceptions/03-try-with-resources/README.md)):

```java
try (ExecutorService ex = Executors.newVirtualThreadPerTaskExecutor()) {
    for (Item item : batch) {
        ex.submit(() -> process(item));
    }
}   // close(): waits for every task, then the executor is gone
```

Two cautions: the wait is *unbounded* — a stuck task holds `close()`
hostage, so long-lived server pools still deserve the explicit timed
drain; and tasks submitted with `submit` still swallow their exceptions
into unread futures ([chunk 2](02-submit-and-futures.md)) — `close()`
waits for them, it does not report on them.

## What virtual threads change

`Executors.newVirtualThreadPerTaskExecutor()` (JEP 444, final in 21) is
an `ExecutorService` with **no pool at all**: every submitted task gets a
fresh virtual thread; there is no queue, no core/max, no rejection under
load. The economics that justified pooling — thread creation is expensive,
so amortize it — do not apply to virtual threads, whose creation is cheap
and whose blocked state costs a small heap footprint, not an OS thread
(the full model is topic 02's, *(not written yet)*).

What this rewrites, and what it doesn't:

- **I/O-bound work:** the sizing formula from
  [chunk 3](03-scheduling-and-sizing.md) becomes unnecessary — one
  virtual thread per concurrent operation, thousands at once, blocking
  freely. Thread-starvation deadlock (chunk 2's gotcha) evaporates: a
  blocked virtual thread releases its carrier.
- **CPU-bound work:** unchanged. Parallelism is still bounded by cores;
  a compute-heavy job still wants a sized platform pool (or the common
  `ForkJoinPool` via parallel streams —
  [phase 4's pipeline chunk](../../phase-4-lambdas-streams/03-stream-pipeline/03-pipelines-in-practice.md)).
- **Bounding concurrency:** the pool used to *be* the limiter ("at most
  20 against that API"). With per-task executors, the limit must be
  explicit — a `Semaphore` around the calls (**topic 16 · Coordination
  primitives** *(not written yet)*), not a pool.
- **Never pool virtual threads.** A fixed pool *of* virtual threads
  reinstates the ceiling that virtual threads exist to remove, and costs
  the pool's bookkeeping for nothing.

## Gotchas

**Symptom:** JVM refuses to exit after `main` completes; jstack shows idle `pool-1-thread-*` parked
**Cause:** executor threads are non-daemon by default and the pool was never shut down
**Fix:** shutdown in a lifecycle hook (framework `@PreDestroy`, `Runtime.addShutdownHook`, or try-with-resources for scoped executors)

**Symptom:** deploys take exactly the grace period, then the process is SIGKILLed with tasks half-done
**Cause:** `shutdown()` alone — queued work kept draining past the platform's patience, or a task ignores interruption entirely
**Fix:** the timed drain pattern with budgets inside the grace period; make long tasks interruptible so `shutdownNow` means something

**Symptom:** `close()` (or the end of a try-with-resources block) hangs forever
**Cause:** `close` waits unbounded for termination and a task is stuck (deadlock, endless retry loop, uninterruptible I/O)
**Fix:** reserve try-with-resources executors for bounded, well-behaved workloads; long-lived pools get the explicit drain with timeouts

**Symptom:** after `shutdownNow`, "cancelled" tasks are still visibly running minutes later
**Cause:** `shutdownNow` only interrupts; the tasks never check interrupt status and swallow `InterruptedException`
**Fix:** write tasks to honour interruption — propagate the exception, or poll `Thread.interrupted()` in compute loops and exit cleanly

**Symptom:** tasks submitted during shutdown disappear (caller assumed acceptance)
**Cause:** after `shutdown()`, submissions go to the rejection handler — with the default `AbortPolicy` that's an exception, but a custom/discard handler makes it silent
**Fix:** treat `RejectedExecutionException` during shutdown as backpressure — fail the request or persist the work; never discard silently

**Symptom:** migrated to virtual threads, downstream service now falls over under load
**Cause:** the old 20-thread pool was the de facto rate limiter; per-task virtual threads happily open 5,000 concurrent calls
**Fix:** make the limit explicit — `Semaphore(20)` acquired around the downstream call — concurrency policy belongs in code now, not in pool sizing

**Symptom:** virtual-thread executor wrapped in a fixed-size pool "for safety"
**Cause:** habit — pooling applied to a resource that is cheap by design
**Fix:** one virtual thread per task, always; bound specific resources with semaphores, not the thread supply

## Interview questions

**★ `shutdown` vs `shutdownNow` — exact semantics?**
`shutdown`: stop intake, run everything already accepted (running *and*
queued), return immediately. `shutdownNow`: stop intake, interrupt running
tasks, never start queued ones and return them as a `List<Runnable>`.
Neither guarantees termination — that's `awaitTermination`'s job, and
`shutdownNow`'s force is only as real as the tasks' interruption handling.

**★ Recite the graceful-shutdown pattern and why each step exists.**
`shutdown()` (no new work) → timed `awaitTermination` (bounded grace) →
if timeout, `shutdownNow()` (interrupt + capture dropped tasks) → short
second await (verify) → on `InterruptedException`, `shutdownNow` and
re-interrupt (someone above wants us gone *now*). Bounded at every step so
the deploy can't hang.

**★ What does JDK 19+ `close()` do, and when is it the wrong tool?**
`shutdown()` then an **unbounded** wait for termination (interrupt ⇒
`shutdownNow` + re-assert interrupt). Perfect for scoped, batch-shaped
executors in try-with-resources; wrong for server pools where a stuck
task would hold shutdown hostage — those need the timed drain.

**★ Why don't you pool virtual threads, and what replaces the pool's two jobs?**
Pooling amortizes creation cost and caps concurrency. Virtual-thread
creation is too cheap to amortize, so job one is moot; job two —
limiting — moves to explicit `Semaphore`s around the actual scarce
resource. The per-task executor keeps only the lifecycle/scoping role.

**★ A service does 90% I/O-waiting per request. Compare the platform-pool answer and the virtual-thread answer.**
Platform: size by the JCiP wait/compute reasoning (large pool), tune
queue and rejection, watch for starvation deadlock. Virtual: one thread
per request, no sizing, blocking is fine; concurrency limits become
semaphores at the bottlenecks. Same JMM, same interruption rules — the
scheduling economics changed, not the semantics.

**★ Where do dropped tasks go on forced shutdown, and what should you do with them?**
`shutdownNow` returns the queued-never-started tasks. Log the count at
minimum; for work that must not be lost, persist them (or design
submissions as replayable — an outbox/queue upstream) so restart resumes
them.

---

← Prev: [Scheduling and sizing](03-scheduling-and-sizing.md) · Next → **07 · `CompletableFuture`** *(not written yet)*
