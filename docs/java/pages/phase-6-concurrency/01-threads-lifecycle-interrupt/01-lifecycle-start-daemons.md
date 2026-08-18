---
title: "Lifecycle, start, daemons"
sidebar_label: "1 · Lifecycle, start, daemons"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `java.lang.Thread`,
> `Thread.State`, `Runnable` and `Thread.UncaughtExceptionHandler`, and the
> `java` launcher documentation (JVM exit conditions).

**A thread is born `NEW`, becomes schedulable exactly once via `start()`,
spends its life bouncing between `RUNNABLE` and the three blocked-ish
states, and ends `TERMINATED` — permanently. The state names matter because
they are precisely what a thread dump prints: read them correctly and a
hung service tells you *what kind* of waiting it is doing, which is most of
the diagnosis.**

## Creating and starting

```java
Runnable work = () -> process(order);          // the task — WHAT to run

Thread t = new Thread(work, "order-worker-1"); // the worker — WHERE to run it
t.start();                                     // schedule it; start() returns immediately
```

Two rules the API can't stop you from breaking:

- **`start()`, never `run()`.** `run()` is an ordinary method call — it
  executes the task on the *calling* thread, no concurrency at all. The
  program still "works", just serially, which is why this bug survives
  code review. `start()` is the JVM call that creates the schedulable
  entity and invokes `run()` on it.
- **`start()` works once.** A second `start()` on any `Thread` — even a
  `TERMINATED` one — throws `IllegalThreadStateException`. Threads are not
  reusable; *pools* exist so the reuse happens one level up (**topic 06**
  *(not written yet)*).

Prefer passing a `Runnable` to subclassing `Thread`: the task/worker split
is what every executor API is built on, and a subclass couples the two for
no benefit.

## The six states

`Thread.getState()` returns one of six `Thread.State` values — and thread
dumps label every stack with them, which is where you'll actually meet
them:

| State | Meaning | You see it when |
|---|---|---|
| `NEW` | created, `start()` not yet called | rarely — a constructed but unstarted thread |
| `RUNNABLE` | executing **or ready and waiting for a CPU** — the JVM does not distinguish | busy code, spinning code, and (historically) some blocking native I/O |
| `BLOCKED` | waiting to *enter* a `synchronized` block/method — contending for a monitor | lock contention (**topic 04** *(not written yet)*) |
| `WAITING` | parked indefinitely — `Object.wait()`, `Thread.join()`, `LockSupport.park()` | idle pool workers, threads waiting on conditions |
| `TIMED_WAITING` | as above but with a deadline — `sleep(ms)`, `wait(ms)`, `join(ms)`, timed park | backoff sleeps, timed waits |
| `TERMINATED` | `run()` returned or threw | finished workers |

Three readings that pay for the table:

- **`BLOCKED` vs `WAITING` is the money distinction.** `BLOCKED` means
  monitor contention — someone else holds a lock this thread wants.
  `WAITING` means the thread chose to park and expects a wake-up. A dump
  full of `BLOCKED` says "lock bottleneck"; a dump full of `WAITING` says
  "idle or lost wake-up". **Topic 13** *(not written yet)* builds the
  deadlock diagnosis on exactly this.
- **`RUNNABLE` does not mean "on a CPU".** Ten `RUNNABLE` threads on two
  cores: all ten report `RUNNABLE`, eight are queued. The JVM state
  machine doesn't model the OS scheduler's run queue.
- **There is no "restart".** `TERMINATED` is terminal; the object remains
  (joinable, state-queryable) but never runs again.

## `join` — waiting for a thread to finish

```java
t.start();
t.join();          // caller parks (WAITING) until t is TERMINATED
t.join(5_000);     // or TIMED_WAITING with a deadline — then check t.isAlive()
```

`join` throws `InterruptedException` — the caller's own interruption
matters while it waits ([chunk 2](02-interruption.md)). A timed `join`
returning tells you nothing by itself: check `isAlive()` to learn whether
it returned because the thread died or because the clock ran out.

## Daemon threads and JVM exit

**The JVM exits when the last non-daemon thread terminates** — not when
`main` returns. `main` returning while your worker runs leaves the process
alive until the worker finishes; that is why a forgotten executor keeps a
"finished" program running forever.

```java
Thread reporter = new Thread(this::reportMetricsLoop, "metrics-reporter");
reporter.setDaemon(true);   // BEFORE start() — afterwards it throws IllegalThreadStateException
reporter.start();
```

Daemon threads are the inverse deal: they never keep the JVM alive, and
when the last user thread exits, **daemons are abandoned mid-instruction —
no `InterruptedException`, no `finally` blocks, nothing runs**. That makes
daemon status a statement about the work: safe only for tasks whose sudden
disappearance at any point loses nothing you care about (cache eviction,
periodic metrics). A daemon flushing a file buffer is a data-loss bug that
fires only at shutdown — the worst time to debug anything.

Daemon status is inherited: threads created by a daemon are daemons by
default. Note for [topic 02](../02-platform-vs-virtual-threads/README.md):
virtual threads are *always* daemons — you cannot make one hold the JVM
open.

## When a thread dies by exception

An exception escaping `run()` terminates that thread **silently by
default** as far as your other threads are concerned — nothing propagates
anywhere, because there is no caller stack to propagate into. What happens
instead is the uncaught-exception ladder from
[the global handler page](../../phase-5-exceptions/08-global-handler.md):
per-thread handler → thread group → `Thread.setDefaultUncaughtExceptionHandler`
→ the JVM's print-and-continue default. Set the default handler in `main`
before starting anything; a worker dying with one stack trace in a log
nobody tails is how scheduled jobs stop running for a week unnoticed.

## The API you should ignore

- **`setPriority`** — a *hint* mapped onto OS scheduling in
  platform-specific, often negligible ways. Correctness may never depend
  on it; ordering comes from coordination (**topic 16** *(not written
  yet)*), not priorities.
- **`Thread.yield()`** — a hint with no guarantees at all; the Javadoc
  itself says it is rarely appropriate. Occasionally useful in
  benchmarking harnesses, not in application code.
- **`ThreadGroup`** — largely degraded API kept for compatibility; the
  useful survivor is its role in the uncaught-exception ladder above.

## Gotchas

**Symptom:** "multithreaded" batch takes exactly as long as the serial version; the code calls `worker.run()`
**Cause:** `run()` is a plain method call on the current thread — no thread was ever started
**Fix:** `start()`; if the compiler-level distinction keeps biting the team, pass tasks to an `ExecutorService` instead of touching `Thread` directly

**Symptom:** `IllegalThreadStateException` from code that "recycles" a finished thread
**Cause:** `start()` is once-per-object; `TERMINATED` is permanent
**Fix:** create a new `Thread`, or — the real answer — use a pool, which reuses threads internally without reusing `Thread` objects in your code

**Symptom:** program's `main` finished minutes ago; the process is still in `ps`
**Cause:** a non-daemon thread (often a bare `new Thread` or an executor's workers) is still alive — the JVM waits for all user threads
**Fix:** shut down executors explicitly; mark genuinely-disposable background loops as daemons before `start()`

**Symptom:** file written by a background thread is truncated, but only when the app shuts down
**Cause:** the writer was a daemon — at last-user-thread exit it was abandoned mid-write, `finally`/close never ran
**Fix:** work that must complete or clean up belongs on a user thread with orderly shutdown (interrupt + join), never on a daemon

**Symptom:** `IllegalThreadStateException` from `setDaemon(true)`
**Cause:** daemon status can only be set before `start()`
**Fix:** set it at construction time; `Thread.ofPlatform().daemon()` (the builder, [topic 02](../02-platform-vs-virtual-threads/README.md)) makes it un-forgettable

**Symptom:** thread dump shows 200 threads `RUNNABLE`, CPU is at 15%, service is slow
**Cause:** `RUNNABLE` includes threads executing blocking native operations (classic socket reads live here) — the state does not prove CPU work
**Fix:** read the *stacks*, not just the states: 200 identical stacks parked in a native read mean a slow downstream, not a busy CPU

**Symptom:** scheduled job silently stopped running six days ago; one stack trace in an unwatched log
**Cause:** the task threw, the thread died to the default print handler, and nothing restarted or alerted
**Fix:** default uncaught-exception handler that alerts (phase 5, [topic 08](../../phase-5-exceptions/08-global-handler.md)); in pools, catch-and-report inside the task wrapper

**Symptom:** code sets `MAX_PRIORITY` on the "important" thread; behavior unchanged in production on Linux
**Cause:** priorities are hints the OS may compress or ignore entirely
**Fix:** delete the priority calls; express importance structurally — dedicated pools, queues, backpressure

## Interview questions

**★ `start()` vs `run()` — what actually happens in each?**
`run()` is an ordinary virtual method call executing the body on the
calling thread. `start()` asks the JVM to create a new schedulable thread,
which then invokes `run()`; `start()` itself returns immediately. Calling
`start()` twice throws `IllegalThreadStateException` even after the thread
finished.

**★ Walk the six `Thread.State` values and say what a dump full of each suggests.**
`NEW` unstarted; `RUNNABLE` running *or* CPU-queued (or in some blocking
native calls); `BLOCKED` contending for a `synchronized` monitor — lock
bottleneck; `WAITING` parked indefinitely (`wait`/`join`/`park`) — idle or
missing wake-up; `TIMED_WAITING` parked with deadline (`sleep`, timed
waits); `TERMINATED` done forever. Many `BLOCKED` → contention; many
`WAITING` on the same condition → lost signal or starved producer.

**★ When exactly does the JVM exit, and where do daemons fit?**
When the last non-daemon thread terminates (or `System.exit` is called).
Daemon threads don't count toward keeping the process alive and are
abandoned without cleanup — no interrupts, no `finally` — when the last
user thread ends. Hence: daemons only for work that can vanish
mid-instruction losslessly.

**★ A task submitted to a thread throws `RuntimeException`. What does the rest of the program observe?**
Nothing, by default. The exception has no caller to reach; the thread runs
the uncaught-exception ladder (per-thread handler → group →
default handler → print to stderr) and dies. Other threads continue. This
is why long-lived services install a default handler that alerts, and why
pool tasks wrap their bodies.

**★ Why is `BLOCKED` vs `WAITING` the first thing to check in a hung-service dump?**
Because they have different causes and different fixes. `BLOCKED` names a
monitor the thread wants — some other thread holds it: go find the holder
(deadlock or a long critical section). `WAITING` means the thread parked
itself expecting a signal: go find why the signal never came (dead
producer, lost `notify`, empty queue). The state line alone routes the
investigation.

**★ Is a `Thread` object garbage-collected while its thread runs?**
No — a live thread is a GC root; the `Thread` object (and everything its
stack references) stays reachable regardless of your references to it.
After `TERMINATED`, the object is collectable like any other once
unreferenced. This is also why leaked threads leak everything their stacks
and thread-locals point at.

---

← Prev: [Topic index](README.md) · Next → [Interruption — the cancellation protocol](02-interruption.md)
