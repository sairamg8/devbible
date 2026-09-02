---
title: "An executor has three ways to stop and only one of them waits — shutdown refuses new work, shutdownNow interrupts and hopes, awaitTermination is the only call that blocks"
sidebar_label: "06 · Executors: the shutdown contract"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **JDK 25 javadoc** for `ExecutorService`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/util/concurrent/ExecutorService.html))
> and `ThreadPoolExecutor` (same javadoc tree). JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.
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
forever for a hook). Inside a Spring-managed shutdown the phase timeout bounds it instead.

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

## Gotchas

**★ `shutdown()` does not wait.** Nor does `shutdownNow()`. Only `awaitTermination` blocks; a
shutdown routine without it has merely *asked*.

**★ `shutdownNow()` is best effort by contract.** *"any task that fails to respond to interrupts may
never terminate."* The returned list is the queued work you abandoned.

**★ `close()` has no timeout.** In a try-with-resources it waits for every task; in a shutdown hook
that is an unbounded hang until `SIGKILL`.

**★ The javadoc pattern's worst case is 120 seconds.** Two sequential 60-second waits. Size them to
the grace budget.

**★ `CallerRunsPolicy` discards after shutdown.** *"unless the executor has been shut down, in which
case the task is discarded"*. Inline fallback you relied on during teardown is not there.

**★ `isTerminated()` is never true without a shutdown call.** Polling it on a pool nobody shut down
waits forever.

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

**★ What does the javadoc's `shutdownAndAwaitTermination` pattern get right, and what must you
change?**
Order — `shutdown()`, bounded wait, only then `shutdownNow()` and a second bounded wait — and it
preserves the caller's interrupt status. Its two 60-second waits are illustrative; in a container
they must fit inside the grace period.

Next: [Scheduled tasks and the pools nothing shuts down](06b-scheduled-tasks-and-untracked-pools.md).

{/* FOOTER */}
