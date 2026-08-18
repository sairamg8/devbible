---
title: "Interruption — the cancellation protocol"
sidebar_label: "2 · Interruption"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Thread.interrupt`,
> `Thread.interrupted`, `Thread.isInterrupted`, `InterruptedException`,
> `java.nio.channels.InterruptibleChannel` and
> `ClosedByInterruptException`, and the JDK 20 release notes /
> `Thread.stop` Javadoc (degraded to `UnsupportedOperationException`).

**`interrupt()` does not stop a thread. It sets one boolean — the interrupt
status — and wakes the thread if it is parked in a method that promised to
notice. Everything else is the target thread's job: check the flag, honor
it, and — the rule people break — never leave the request swallowed. Java
deleted the kill switch on purpose: `Thread.stop` released monitors
mid-mutation, leaving shared objects in half-updated states, so the
platform now throws `UnsupportedOperationException` if you call it. What
remains is a *request* protocol, and every cancellation you'll ever use —
`Future.cancel(true)`, pool shutdown, structured scopes — is this protocol
wearing a framework.**

## What `interrupt()` actually does

Per the Javadoc, `t.interrupt()`:

1. **If `t` is parked** in `Object.wait`, `Thread.sleep`, `Thread.join`
   (and their timed forms): the interrupt status is **cleared** and the
   method throws `InterruptedException` in `t`.
2. **If `t` is blocked on an `InterruptibleChannel`**: the channel is
   *closed*, the status is **set**, and `t` gets `ClosedByInterruptException`.
3. **If `t` is blocked in a `Selector`**: the status is **set** and the
   select returns immediately.
4. **Otherwise: the status is set.** Nothing else happens — a thread
   crunching numbers keeps crunching until it checks.

Case 4 is the heart of the model: interruption of running code is
*polling*, not preemption.

```java
public void run() {
    while (!Thread.currentThread().isInterrupted()) {   // the poll
        drainOneBatch();                                // bounded units of work
    }
    // fall out: flush, close, release — cooperative shutdown
}
```

## The two query methods — one clears, one doesn't

| Method | Static? | Effect on the flag |
|---|---|---|
| `t.isInterrupted()` | instance | **leaves it set** — use for loop conditions |
| `Thread.interrupted()` | static, current thread only | **clears it** — use only when you are *consuming* the request |

`Thread.interrupted()` in a log line or an assertion is a classic
self-inflicted bug: the check itself erases the request, and the loop that
should have exited keeps running.

## `InterruptedException`: the flag is now *cleared*

When a blocking method throws `InterruptedException`, the JVM has already
cleared the status — the assumption is you're handling it. If you are not
(and usually you are not, in the method that caught it), you must put the
request back. The whole discipline in one table:

| You are | Correct handling |
|---|---|
| A library/utility method | declare `throws InterruptedException` — propagate, don't decide |
| Wrapping in a runnable/framework callback that can't throw it | catch → `Thread.currentThread().interrupt()` → stop working (return / break) |
| The thread's own top-level loop | catch → exit the loop → run your cleanup path |
| Genuinely uninterruptible (rare, e.g. brief must-finish handoff) | catch in a loop, remember the interrupt happened, **re-interrupt before returning** |

```java
@Override public void run() {
    try {
        while (running) {
            var task = queue.take();        // blocks; interruptible
            handle(task);
        }
    } catch (InterruptedException e) {
        Thread.currentThread().interrupt(); // restore — for anyone above us
        // fall through to cleanup; the loop is over
    } finally {
        closeResources();
    }
}
```

The restore matters because interruption is *shared state*: pool workers
([the global handler page](../../phase-5-exceptions/08-global-handler.md)
neighbors this), `try`/`finally` stacks and framework wrappers above you
all may check the flag. Swallowing it makes *their* cancellation silently
stop working.

**The one-line anti-pattern:** `catch (InterruptedException e) {}` — the
thread was asked to stop, the request is now destroyed, and the enclosing
retry loop spins forever. It is the concurrency version of swallowing an
exception, with the extra property that it usually only misbehaves during
shutdown, so tests never see it.

## What doesn't respond

- **`synchronized` monitor acquisition** — a thread `BLOCKED` on a
  monitor sets the flag and keeps waiting; the lock wait itself is
  uninterruptible. The escape is `ReentrantLock.lockInterruptibly()`
  (**topic 09** *(not written yet)*).
- **Classic stream I/O** — a thread deep in `InputStream.read()` on a
  file generally does not notice interrupts; the flag sets, the read
  continues. Interrupt-aware I/O means NIO channels
  (`InterruptibleChannel` — the read *fails* and the channel closes) or
  designing with timeouts.
- **Third-party native calls** — anything the JDK doesn't control ignores
  the protocol entirely; cancellation there means the library's own
  mechanism or process-level measures.

Design consequence: cancellable work is *structured* as interruptible
waits plus bounded compute slices with polls between them. If a task can
disappear into a 40-minute uninterruptible call, no protocol saves you.

## Where you'll meet it dressed up

- `Future.cancel(true)` → `interrupt()` on the running worker
  (**topic 06** *(not written yet)*).
- `ExecutorService.shutdownNow()` → interrupts all workers, returns the
  queue.
- Structured scopes cancel siblings by interruption when one fails
  (**topic 08** *(not written yet)*).
- Virtual threads use the same protocol unchanged
  ([topic 02](../02-platform-vs-virtual-threads/README.md)).

The framework never removes your half: the *task code* still has to poll,
propagate, or restore.

## Why `stop` and `suspend` are gone

`Thread.stop` injected `ThreadDeath` at an arbitrary bytecode, **releasing
every monitor the thread held** — whatever those monitors guarded was left
mid-mutation for every other thread to observe. `suspend` parked a thread
*while it kept its locks*, so any thread needing those locks deadlocked —
including, typically, the thread that intended to call `resume`. Both were
deprecated for decades and finally degraded: since JDK 20 they throw
`UnsupportedOperationException` unconditionally. The removal is the
platform stating the design result: **there is no safe preemptive stop;
cancellation must be cooperative.**

## Gotchas

**Symptom:** worker keeps processing after `shutdownNow()`; pool never terminates
**Cause:** task body is a compute loop that never checks `isInterrupted()` — case 4 sets the flag and nothing reads it
**Fix:** poll the flag at each unit-of-work boundary; make units bounded

**Symptom:** `while (!Thread.interrupted())` loop exits — but the `finally` that inspects the flag sees `false` and skips the "was cancelled" branch
**Cause:** `Thread.interrupted()` *cleared* the status as the loop condition consumed it
**Fix:** `isInterrupted()` in conditions you'll re-check; or capture the boolean once and pass it along

**Symptom:** cancellation "works locally, not in prod": tasks stop mid-batch under `Future.cancel(true)` in tests but hang in production
**Cause:** prod path blocks in classic stream I/O / a JDBC driver call that ignores interrupts; the test path blocked in `sleep`
**Fix:** timeouts on the underlying socket/driver (`setQueryTimeout`, socket timeouts); interruptible channels where you own the I/O

**Symptom:** `catch (InterruptedException e) { log.warn("interrupted", e); }` and the service takes minutes to shut down
**Cause:** request swallowed — the enclosing loop retries the blocking call, which now blocks afresh with a clear flag
**Fix:** restore (`Thread.currentThread().interrupt()`) *and* exit the loop; logging is fine, continuing is the bug

**Symptom:** thread interrupted while `BLOCKED` on `synchronized` doesn't wake
**Cause:** monitor acquisition is not an interruption point — only the flag is set
**Fix:** if interruptible lock waits are a requirement, that critical section needs `ReentrantLock.lockInterruptibly` (**topic 09** *(not written yet)*)

**Symptom:** `ClosedByInterruptException` and now the *channel is unusable* even though the task decided to continue
**Cause:** interrupting a thread blocked on an `InterruptibleChannel` closes the channel by contract — the interrupt is not "undoable"
**Fix:** treat channel interruption as task cancellation, not a retryable hiccup; reopen deliberately if continue-after-cancel is genuinely the design

**Symptom:** sleep-based retry backoff ignores cancellation for up to 30 s per retry
**Cause:** `catch (InterruptedException e) { /* keep retrying */ }` inside the backoff sleep
**Fix:** on interrupt during backoff, abandon the retry loop — restore the flag and return; cancellation outranks retry policy

**Symptom:** migrating old code, `Thread.stop()` now throws `UnsupportedOperationException`
**Cause:** JDK 20 degraded `stop`/`suspend`/`resume` from deprecated to unconditionally-throwing
**Fix:** re-express as interruption: replace "stop it" call sites with `interrupt()` and give the target a cooperative exit path

## Interview questions

**★ What does `interrupt()` do to a thread that is (a) sleeping, (b) computing, (c) blocked on `synchronized`?**
(a) `sleep` throws `InterruptedException` with the status *cleared*.
(b) status is set; nothing else — the code must poll. (c) status is set;
the monitor wait continues — `synchronized` acquisition is not an
interruption point.

**★ Why does `InterruptedException` clear the flag, and what must you do about it?**
The throw *is* the delivery — the JVM assumes the catcher now owns the
request. If your catch block doesn't complete the cancellation itself, it
must restore the status (`Thread.currentThread().interrupt()`) so callers,
wrappers and pool machinery above still see it. Swallow it and every
higher-level cancellation silently breaks.

**★ `Thread.interrupted()` vs `isInterrupted()` — when is each correct?**
The static `interrupted()` reports *and clears* — correct only at the
single point that consumes the request (a top-level loop deciding to
exit). `isInterrupted()` just reports — correct for conditions, logging,
and anywhere the request must survive the check.

**★ Why were `Thread.stop` and `suspend` removed rather than fixed?**
`stop` throws an async exception at an arbitrary point and releases the
thread's monitors — objects guarded by those monitors are exposed
mid-mutation, and no general fix exists because the JVM can't know which
states are consistent. `suspend` parks the thread while it *holds* its
locks — a deadlock machine. The unfixability is the lesson: safe
cancellation needs the target's cooperation, so the platform only offers
the cooperative protocol.

**★ You call `future.cancel(true)` and the task keeps running to completion. List the plausible reasons.**
The task ignores the protocol (no polls, compute-bound); it's blocked in
non-interruptible I/O or a native/driver call; it swallowed
`InterruptedException` and looped; it already finished its interruptible
waits and the remaining work never checks; or the executor wrapper caught
and dropped the interrupt. `cancel(true)` only delivers an interrupt —
delivery is not compliance.

**★ How do you write a worker loop that shuts down cleanly under both `shutdown()` and `shutdownNow()`?**
Structure the loop around an interruptible wait (`queue.take()` or a timed
poll). Graceful `shutdown()` ends it via a poison pill / completed-queue
condition; `shutdownNow()` ends it via `InterruptedException` from the
wait. Catch it, restore the flag, break to a shared `finally` that
releases resources. Both paths converge on one cleanup.

**★ Does any of this change on virtual threads?**
No — same flag, same methods, same `InterruptedException` contract. What
changes is economics (blocking is cheap, so the interruptible-wait style
gets *more* natural), not semantics. [Topic 02](../02-platform-vs-virtual-threads/README.md).

---

← Prev: [Lifecycle, `start`, daemons](01-lifecycle-start-daemons.md) · Index: [Threads: lifecycle, interrupt](README.md) · Next → [Platform vs virtual threads](../02-platform-vs-virtual-threads/README.md)
