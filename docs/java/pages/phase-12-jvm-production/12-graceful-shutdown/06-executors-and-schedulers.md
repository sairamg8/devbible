---
title: "An executor has three ways to stop and only one of them waits — shutdown refuses new work, shutdownNow interrupts and hopes, awaitTermination is the only call that blocks — and the pools you did not create are daemon threads nothing waits for at all"
sidebar_label: "06 · Executors and schedulers"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **JDK 25 javadoc** for `ExecutorService`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ExecutorService.html)),
> `ScheduledThreadPoolExecutor`, `ThreadPoolExecutor`, `ForkJoinPool`, `Executors` and `Thread`
> (same javadoc tree), and the **Spring Framework 7.0 javadoc** for `ThreadPoolTaskScheduler`
> ([docs.spring.io](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/scheduling/concurrent/ThreadPoolTaskScheduler.html))
> for the two scheduler policy defaults. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.
> 🔴 **No sandbox** — no executor was run for this page.

**Graceful shutdown of the web server ([04](04-spring-graceful-shutdown.md)) finishes the request.
It does nothing for the work that request handed to a thread pool, or for the scheduled job that was
halfway through its loop when the signal arrived. That work has its own three-method API, and the
API's most important property is that two of the three methods return immediately.**

## The contract, in the JDK's words

> *"An `ExecutorService` can be shut down, which will cause it to reject new tasks. Two different
> methods are provided for shutting down an `ExecutorService`. The `shutdown()` method will allow
> previously submitted tasks to execute before terminating, while the `shutdownNow()` method prevents
> waiting tasks from starting and attempts to stop currently executing tasks."*

Three methods carry the whole model, and the trap is that the first two return immediately:

| Method | Refuses new work | Queued tasks | Running tasks | Blocks? |
|---|---|---|---|---|
| `shutdown()` | yes | still run | untouched | **no** |
| `shutdownNow()` | yes | returned to you, never run | interrupted (best effort) | **no** |
| `awaitTermination(t, unit)` | — | — | — | **yes**, until terminated or `t` elapses |
| `close()` (Java 19+) | yes | still run | untouched | **yes**, effectively unbounded |

`shutdown()`: *"Initiates an orderly shutdown in which previously submitted tasks are executed, but no
new tasks will be accepted … This method does not wait for previously submitted tasks to complete
execution. Use `awaitTermination` to do that."*

`shutdownNow()`: *"Attempts to stop all actively executing tasks, halts the processing of waiting
tasks, and returns a list of the tasks that were awaiting execution … There are no guarantees beyond
best-effort attempts to stop processing actively executing tasks. For example, typical
implementations will cancel via `Thread.interrupt()`, so any task that fails to respond to interrupts
may never terminate."*

🔴 **So `shutdownNow()` is a request delivered as an interrupt.** A task in a tight computation, a
task blocked in a non-interruptible I/O call, or a task that catches `InterruptedException` and
carries on, does not stop. The list it returns is the work you have just chosen to lose — log it or
persist it, because nothing else will.

`isTerminated()` closes the loop: *"Note that `isTerminated` is never `true` unless either `shutdown`
or `shutdownNow` was called first."* An executor nobody shut down is never finished, however idle.

## `close()` — the `AutoCloseable` form and its hidden wait

`ExecutorService` is `AutoCloseable` since Java 19, and the default `close()` is a full drain:

> *"Initiates an orderly shutdown in which previously submitted tasks are executed, but no new tasks
> will be accepted. This method waits until all tasks have completed execution and the executor has
> terminated. If interrupted while waiting, this method stops all executing tasks as if by invoking
> `shutdownNow()`. It then continues to wait until all actively executing tasks have completed."*

⚠️ **There is no timeout parameter.** `try (var pool = Executors.newFixedThreadPool(8))` at the end of
its block waits for every submitted task to finish — correct for a structured batch, and a silent
hang inside a shutdown hook if one task never returns ([03](03-shutdown-hooks.md) — the JVM waits
forever for a hook). Inside a Spring-managed shutdown the phase timeout bounds it
([06a](06a-spring-executors-on-context-close.md)); in a raw hook nothing does.

## The pattern the javadoc ships

The `ExecutorService` javadoc supplies the canonical bounded shutdown, reproduced verbatim:

```java
void shutdownAndAwaitTermination(ExecutorService pool) {
  pool.shutdown(); // Disable new tasks from being submitted
  try {
    // Wait a while for existing tasks to terminate
    if (!pool.awaitTermination(60, TimeUnit.SECONDS)) {
      pool.shutdownNow(); // Cancel currently executing tasks
      // Wait a while for tasks to respond to being cancelled
      if (!pool.awaitTermination(60, TimeUnit.SECONDS))
          System.err.println("Pool did not terminate");
    }
  } catch (InterruptedException ex) {
    // (Re-)Cancel if current thread also interrupted
    pool.shutdownNow();
    // Preserve interrupt status
    Thread.currentThread().interrupt();
  }
}
```

Three things about it matter in a container: the two waits are **sequential**, so its worst case is
120 seconds — four times Kubernetes' default grace period ([02](02-signals.md)); `shutdownNow()` is
the *second* step, not the first; and the interrupt of the calling thread is preserved rather than
swallowed. Copy the shape, size the numbers to your grace budget.

## Rejection after shutdown

`ThreadPoolExecutor`'s javadoc: *"New tasks submitted in method `execute(Runnable)` will be rejected
when the Executor has been shut down"* — via the `RejectedExecutionHandler`, whose default
`AbortPolicy` throws `RejectedExecutionException`. ⚠️ **`CallerRunsPolicy` changes behaviour after
shutdown, not just under saturation**: it *"runs the rejected task directly in the calling thread of
the `execute` method, unless the executor has been shut down, in which case the task is discarded."*
A submission made during teardown that you assumed would run inline silently vanishes.

## Scheduled executors: two policies decide what survives `shutdown()`

`ScheduledThreadPoolExecutor` adds two flags that answer "what happens to a task scheduled for
later?":

- **Periodic tasks** — `setContinueExistingPeriodicTasksAfterShutdownPolicy`: *"In this case,
  executions will continue until `shutdownNow` or the policy is set to `false` when already
  shutdown. This value is by default `false`."* So by default a `scheduleAtFixedRate` job is
  cancelled at `shutdown()` — the javadoc lists *"Method `shutdown()` is called and the policy on
  whether to continue after shutdown is not set true"* among the things that end the sequence.
- **Delayed one-shot tasks** — `setExecuteExistingDelayedTasksAfterShutdownPolicy`: Spring's
  `ThreadPoolTaskScheduler` documents its default as *"Default is `true`. If set to `false`, the
  target executor will be switched into dropping remaining tasks."*

🔴 **The asymmetry is the trap.** After `shutdown()`, a job scheduled with a 10-minute delay is still
going to run — and `awaitTermination` waits for it — while a periodic job stops. An executor that
"will not terminate" during shutdown is often holding a delayed task.

⚠️ **A periodic task that is *running* at `shutdown()` is not interrupted** — that only happens on
`shutdownNow()`. It completes its current execution and is not rescheduled.

## The pools nothing shuts down

- **`ForkJoinPool.commonPool()`** — *"All worker threads are initialized with `Thread.isDaemon()`
  set true"* and the pool *"never shuts down"*. Every `CompletableFuture.supplyAsync(x)` and parallel
  stream without an explicit executor runs here. 🔴 **When the JVM's last non-daemon thread exits,
  that work is simply cut.**
- **Virtual threads** — `Thread` javadoc: *"Virtual threads are daemon threads and so do not prevent
  the shutdown sequence from beginning."* `Executors.newVirtualThreadPerTaskExecutor()` gives you an
  `ExecutorService` whose `close()` waits — use it — but a bare `Thread.startVirtualThread(...)` is
  as untracked as `new Thread(...)` ([04b](04b-what-graceful-actually-drains.md)).
- **`Executors.newCachedThreadPool()` and friends** created in a field and never registered as a
  bean: non-daemon threads, so the JVM's own exit *waits* for their queue to drain — but Spring's
  shutdown does not know they exist, and `SIGKILL` at the grace period will end the wait.

## Writing a task that can be stopped

Everything above delivers, at most, an interrupt. A task that ignores it wins every argument with
every timeout. The minimum:

```java
while (!Thread.currentThread().isInterrupted() && iterator.hasNext()) {
    process(iterator.next());        // one unit of work — small enough to abandon cleanly
}
```

and never this:

```java
catch (InterruptedException e) { /* ignored */ }   // 🔴 the interrupt is gone; nothing can stop you now
```

Restore it — `Thread.currentThread().interrupt()` — or let it propagate. The unit of work should be
the unit you can afford to repeat, because after `SIGKILL` it will be
(**09** *(not written yet)*).

## Gotchas

**★ `shutdown()` does not wait.** Nor does `shutdownNow()`. Only `awaitTermination` blocks; a
shutdown routine without it has merely *asked*.

**★ `shutdownNow()` is best effort by contract.** *"any task that fails to respond to interrupts may
never terminate."* The returned list is the queued work you abandoned.

**★ `close()` has no timeout.** In a try-with-resources it waits for every task; in a shutdown hook
that is an unbounded hang until `SIGKILL`.

**★ Delayed tasks survive `shutdown()`; periodic tasks do not.** `executeExistingDelayedTasksAfterShutdown`
defaults `true`, `continueExistingPeriodicTasksAfterShutdown` defaults `false`. An executor that
refuses to terminate is often holding a long delay.

**★ The common pool and virtual threads are daemon and untracked.** `CompletableFuture.supplyAsync`
without an executor, parallel streams and `Thread.startVirtualThread` are cut at JVM exit.

**★ The javadoc pattern's worst case is 120 seconds.** Two sequential 60-second waits. Size them to
the grace budget.

**★ `CallerRunsPolicy` discards after shutdown.** *"unless the executor has been shut down, in which
case the task is discarded"*. Inline fallback you relied on during teardown is not there.

**★ `isTerminated()` is never true without a shutdown call.** Polling it on a pool nobody shut down
waits forever.

**★ A pool created with `Executors.*` and held in a field is invisible to every framework mechanism.**
Make it a bean, or shut it down yourself in a bounded, named hook.

## Interview questions

**★ What is the difference between `shutdown()`, `shutdownNow()` and `awaitTermination()`?**
`shutdown()` stops accepting new tasks and lets queued and running tasks finish; `shutdownNow()`
stops accepting, discards the queue (returning it) and interrupts running tasks on a best-effort
basis; neither blocks. `awaitTermination` is the only call that waits, bounded by its timeout.

**★ Why might `shutdownNow()` not stop a task?**
Because it delivers a `Thread.interrupt()`, and the javadoc promises nothing beyond best effort. A
task in a CPU loop that never checks the flag, blocked in a non-interruptible call, or swallowing
`InterruptedException` keeps running.

**★ What does `ExecutorService.close()` do, and what is the risk?**
It performs `shutdown()` and then waits until every task has completed — with no timeout. Inside a
shutdown hook a stuck task makes the JVM hang until the container's `SIGKILL`.

**★ What happens to scheduled tasks when a `ScheduledThreadPoolExecutor` is shut down?**
By default periodic tasks are cancelled (`continueExistingPeriodicTasksAfterShutdown` is `false`)
while delayed one-shot tasks still execute (`executeExistingDelayedTasksAfterShutdown` is `true`),
and `awaitTermination` waits for them.

**★ Why do `CompletableFuture.supplyAsync` tasks disappear at shutdown?**
Without an explicit executor they run on `ForkJoinPool.commonPool()`, whose threads are daemon and
which *"never shuts down"*. Nothing waits for daemon threads; the work is cut when the JVM exits.

**★ How should a long-running task be written so it can be stopped?**
Do one unit of work per loop iteration, check `Thread.currentThread().isInterrupted()` between
units, and never swallow `InterruptedException` — restore the interrupt or propagate it.

**★ What does the javadoc's `shutdownAndAwaitTermination` pattern get right, and what must you
change?**
Order — `shutdown()`, bounded wait, only then `shutdownNow()` and a second bounded wait — and it
preserves the caller's interrupt status. Its two 60-second waits are illustrative; in a container
they must fit inside the grace period.

Next: [Spring's executors on context close](06a-spring-executors-on-context-close.md).

{/* FOOTER */}
