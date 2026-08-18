---
title: "Coordination primitives"
sidebar_label: "16 · Coordination primitives"
sidebar_position: 16
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `CountDownLatch`,
> `CyclicBarrier`, `Semaphore`, `Phaser` and `Exchanger` (including each
> class's memory-consistency-effects paragraphs).

**Locks answer "who may touch this data"; coordination primitives answer
"who may proceed, and when". Waiting for N startup tasks, letting at most
20 requests hit a fragile downstream, marching worker threads through
phases in step — none of that is mutual exclusion, and forcing it into
locks and flags reinvents, badly, what `java.util.concurrent` ships
tested. The Know-tier goal: recognize each shape on sight and pick the
right one without ceremony.**

## `CountDownLatch` — the one-shot gate

A counter initialized to N; `await()` blocks until it reaches zero;
`countDown()` decrements (never below zero, never blocking). **One-shot:
it cannot be reset** — that single limitation is also its safety: no
reuse means no "which cycle am I in" bugs.

```java
var ready = new CountDownLatch(tasks.size());
for (var t : tasks) {
    executor.submit(() -> {
        try { t.warmUp(); }
        finally { ready.countDown(); }   // count down even on failure
    });
}
if (!ready.await(30, TimeUnit.SECONDS))  // always the timed form in servers
    throw new IllegalStateException("warm-up incomplete");
```

Properties worth stating precisely:

- **Lost signals are impossible.** A `countDown()` before any `await()`
  is simply recorded in the count — unlike `wait`/`notify`, where a
  notify with no waiter evaporates ([topic 17](17-wait-notify-legacy.md)).
- **Latch-at-zero is permeable**: every later `await()` returns
  immediately.
- **Memory effects**: actions before `countDown()` happen-before return
  from the corresponding `await()` — the warm-up results are *visible*,
  not just finished.
- Waiting for task **completion values**, not just the event? That's
  `invokeAll` or `CompletableFuture.allOf` — **topic 07** *(not written
  yet)* — before it's a hand-rolled latch.

The two canonical uses: N-services-ready-before-serving, and the
start-gate in concurrency tests (`new CountDownLatch(1)`; workers
`await()`; the test thread `countDown()`s to release all threads at
once). In tests it replaces `Thread.sleep` guessing: a latch proves the
event happened; a sleep hopes it did. Sleep-synchronized tests are the
flaky-suite generator — too short flakes, too long is waste, and neither
establishes ordering.

## `CyclicBarrier` — the reusable meeting point

N parties call `await()`; all block until the Nth arrives; then all
release together and **the barrier resets for the next cycle** — the
"cyclic". An optional *barrier action* runs once per generation, by the
last-arriving thread, before anyone is released:

```java
var barrier = new CyclicBarrier(workers, () -> mergePartials());
// each worker, per iteration:
computeMyPartial();
barrier.await();          // merge runs once, then all proceed together
```

The shape: iterative fork-join by hand — simulation steps, staged batch
pipelines where phase k+1 must not start until every worker finished
phase k. **Breakage semantics** are the part people miss: if any waiter
is interrupted or times out, the barrier *breaks* — every current and
future `await()` throws `BrokenBarrierException` until `reset()`. That
is a feature: one dead party would otherwise deadlock the rest silently.

Latch vs barrier in one line: a latch is *events* counted down toward
zero, one-shot, anyone can count; a barrier is *threads* meeting, all
parties must arrive, reusable.

## `Semaphore` — permits for a scarce resource

N permits; `acquire()` takes one or blocks; `release()` returns one.
Nothing about data — pure admission control:

```java
private final Semaphore slots = new Semaphore(20);  // downstream tolerates 20

Response call(Request r) throws InterruptedException {
    if (!slots.tryAcquire(2, TimeUnit.SECONDS))
        throw new UpstreamBusyException();           // shed load, don't pile up
    try { return client.send(r); }
    finally { slots.release(); }
}
```

- This is **the** virtual-thread rate-limiting idiom: with no pool to
  bound concurrency, the semaphore at the resource is the limit
  ([using virtual threads well](02-platform-vs-virtual-threads/03-using-them-well.md)).
- **Permits are not owned.** Any thread may `release()` — which enables
  handoff designs and also means a double-release quietly *grows*
  capacity; the class cannot detect it (contrast a lock's
  `IllegalMonitorStateException`).
- `tryAcquire()` (untimed) **barges** — takes an available permit even
  with fair-mode waiters queued; the timed form honors fairness.
- Fairness (`new Semaphore(n, true)`) trades throughput for
  starvation-freedom; default unfair is right until proven otherwise.
- A binary semaphore is *not* a mutex: no owner, no reentrancy — prefer
  `synchronized`/`ReentrantLock` (**topic 09** *(not written yet)*) for
  exclusion.

## `Phaser` and `Exchanger` — know they exist

- **`Phaser`**: a barrier whose party count can change mid-flight —
  `register()`/`arriveAndDeregister()` — with numbered phases and
  optional termination. Reach for it when barrier parties are dynamic
  (workers join/leave between generations); otherwise its flexibility is
  just surface area.
- **`Exchanger`**: two threads meet and swap objects — the classic use
  is double-buffering (filler hands a full buffer, drainer hands back an
  empty). Two parties exactly; more wants a queue.

## Choosing

| Need | Tool |
|---|---|
| Wait until N things have happened, once | `CountDownLatch` |
| N threads repeatedly proceed in lockstep | `CyclicBarrier` |
| At most N concurrently past this point | `Semaphore` |
| Lockstep with parties joining/leaving | `Phaser` |
| Two threads swap payloads at a rendezvous | `Exchanger` |
| Wait for results (not just completion) | futures — **topic 07** *(not written yet)* |
| Hand items between producers/consumers | `BlockingQueue` (**topic 11** *(not written yet)*) |

## Gotchas

**Symptom:** startup hangs forever on `latch.await()` after one warm-up task throws
**Cause:** `countDown()` sat after the work, not in `finally` — the failing path never counted
**Fix:** `try { work(); } finally { latch.countDown(); }`, and a timed `await` so the hang becomes a diagnosable failure

**Symptom:** second batch cycle hangs on a latch that worked for the first
**Cause:** latches are one-shot; count stayed at zero and... the *new* cycle awaited a fresh event that a stale latch can't represent
**Fix:** new latch per cycle, or a `CyclicBarrier`/`Phaser` if the shape is truly cyclic

**Symptom:** all barrier workers die with `BrokenBarrierException` after one was interrupted
**Cause:** designed behavior — a missing party would deadlock the generation, so the barrier breaks loudly
**Fix:** treat it as "the team is incomplete": tear down or `reset()` deliberately; don't catch-and-retry per thread

**Symptom:** semaphore-guarded downstream still gets overwhelmed — capacity crept upward over weeks
**Cause:** a code path released without acquiring (or released twice in a retry loop); permits have no owner so nothing threw
**Fix:** acquire/release strictly paired in `try`/`finally` in one method; grep audits for bare `release()` calls

**Symptom:** fair semaphore added "for correctness", p99 got worse and starvation never existed
**Cause:** fairness serializes handoff through the queue; it is a starvation remedy, not a correctness fix
**Fix:** default unfair unless a real starvation observation says otherwise

**Symptom:** test asserts after `Thread.sleep(500)` and flakes in CI
**Cause:** sleep is a guess about scheduling, not synchronization — no happens-before with the worker's completion
**Fix:** worker counts down a latch at the assertion point; test does `assertTrue(latch.await(5, SECONDS))` — ordering *and* visibility, deterministic

## Interview questions

**★ Latch vs barrier — when is each the only right answer?**
Latch: one-shot, counting *events*, waiters and counters can be
different threads — "serve traffic after all N caches load". Barrier:
reusable, counting *threads*, all parties both wait and arrive —
"simulation workers may not start step k+1 until all finish k". Reusing
the shape wrongly shows immediately: latches can't cycle; barriers can't
let a non-participant wait.

**★ Why does a `Semaphore` bound concurrency for virtual threads where pool size no longer does?**
`newVirtualThreadPerTaskExecutor` creates a thread per task — there is
no pool whose size throttles anything. The semaphore moves the limit to
the scarce resource itself: N permits around the downstream call bounds
concurrent calls regardless of how many threads exist. Same limit,
relocated from the worker supply to the resource demand.

**★ What does "memory consistency effects" in these classes' Javadoc buy you?**
A happens-before edge: e.g. everything a thread did before
`countDown()`/`release()`/barrier arrival is visible to threads
returning from the paired `await()`/`acquire()`. So results computed
before the signal can be read without extra synchronization — the
primitive is also the publication mechanism.

**★ Why is a binary `Semaphore` a poor mutex?**
No ownership: any thread can release, so the runtime can't detect a
release-without-acquire, and there's no reentrancy — a thread
re-acquiring its own "mutex" deadlocks on itself. Locks carry owner
semantics and throw on misuse; use them for exclusion, semaphores for
admission.

**★ Your latch-based test hangs forever when the code under test has the bug it's hunting. Improve it.**
`await()` untimed converts the bug into a stuck CI job. Use
`assertTrue(latch.await(timeout))` — the assertion failure *is* the
test failing, with a stack instead of a kill -9, and the timeout bounds
suite time. Rule: production and test `await`s are always the timed
overloads.

---

← Prev: [Change as replacement](15-immutability-first-strategy/03-change-as-replacement.md) · Index: [Phase 6 — Concurrency](README.md) · Next → [`wait`/`notify` — the legacy protocol](17-wait-notify-legacy.md)
