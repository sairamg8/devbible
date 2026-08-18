---
title: "Explicit locks"
sidebar_label: "09 · Explicit locks"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against the JDK 25 API documentation for
> `java.util.concurrent.locks` — `Lock`, `ReentrantLock`, `Condition`,
> `ReadWriteLock`, `ReentrantReadWriteLock`, `StampedLock` — including the
> package documentation's memory-synchronization section and each class's
> fairness and reentrancy notes.

**`synchronized` has no timeout, cannot be interrupted while waiting, and
offers no choice about fairness — a thread that blocks on a monitor is
committed until it gets the lock. `java.util.concurrent.locks` exists for
the cases where that commitment is the bug: `tryLock` turns "wait forever"
into "wait this long, then do something else", which is the practical
escape hatch from deadlock. The price is that nothing is automatic anymore
— *you* release the lock, in a `finally`, every time, or the lock is held
until the thread dies.**

## The non-negotiable shape

`synchronized` releases its monitor on every exit path by construction. A
`Lock` releases nothing by itself:

```java
private final ReentrantLock lock = new ReentrantLock();

void transfer(Account to, long amount) {
    lock.lock();
    try {
        balance -= amount;
        to.deposit(amount);
    } finally {
        lock.unlock();          // every path — return, throw, everything
    }
}
```

Two details of the shape matter:

- **`lock()` goes *before* the `try`.** If the acquire itself throws (it
  can, e.g. on interrupt in `lockInterruptibly`), a `try` that already
  started would `unlock()` a lock this thread never got —
  `ReentrantLock.unlock` then throws `IllegalMonitorStateException`.
- **One `unlock` per successful acquire.** `ReentrantLock` is reentrant
  exactly like a monitor: a hold count goes up on each `lock()` by the
  owning thread and the lock frees only when the count reaches zero.

Visibility comes with the deal: the `Lock` interface specifies the same
memory semantics as monitors — a successful `unlock` happens-before a
subsequent `lock` of the same lock object
([happens-before](05-java-memory-model/02-happens-before.md)).

## `tryLock` — the deadlock escape hatch

A monitor acquisition is all-or-nothing-forever; `tryLock` makes it a
decision:

```java
if (lock.tryLock()) {                    // immediate: got it or didn't
    try { doWork(); } finally { lock.unlock(); }
} else {
    scheduleRetry();                     // do NOT just spin
}

if (lock.tryLock(2, TimeUnit.SECONDS)) { // bounded wait, interruptible
    try { doWork(); } finally { lock.unlock(); }
} else {
    throw new ServiceBusyException("ledger lock not acquired in 2s");
}
```

This is the standard cure for lock-ordering deadlock when a global order
is impossible (**topic 13 · Deadlock** *(not written yet)*):
acquire the first lock, `tryLock` the second, and on failure **release the
first, back off, retry** — the cycle cannot hold because no thread waits
while holding. Two caveats the Javadoc states plainly:

- The zero-argument `tryLock()` **ignores fairness** — it barges in if
  the lock happens to be free, even when other threads have waited
  longer. Use `tryLock(0, unit)` to respect fairness.
- A failed timed `tryLock` still counts as a wait for interruption
  purposes: it throws `InterruptedException` if the thread is interrupted
  while waiting, so the [interruption protocol](01-threads-lifecycle-interrupt/02-interruption.md)
  applies.

## `lockInterruptibly` — cancellable waiting

`lock()` waits deaf to interruption, exactly like `synchronized`.
`lockInterruptibly()` waits listening: an interrupt while queued throws
`InterruptedException` instead of leaving the thread stuck behind a
wedged lock holder. Worker pools that must shut down promptly acquire
long-contended locks this way — it is what lets
`shutdownNow`-style cancellation reach a thread that is *waiting for a
lock* rather than running.

## Fairness

`new ReentrantLock(true)` grants the lock in roughly arrival order. The
Javadoc is unusually direct about the cost: fair locks have **lower
throughput** (every handoff forces a queue transfer instead of letting a
running thread barge), and fairness does not extend to `tryLock()`'s
zero-argument barge. Default to unfair (the no-argument constructor);
reach for fairness only when starvation of a particular waiter is an
observed, real problem — it buys predictable ordering, not speed.

## `Condition` — `wait`/`notify` with more than one wait-set

A monitor has exactly one wait set, so producers and consumers parked on
the same object wake each other spuriously. A `Lock` can mint any number
of `Condition`s:

```java
private final ReentrantLock lock = new ReentrantLock();
private final Condition notFull  = lock.newCondition();
private final Condition notEmpty = lock.newCondition();

void put(T item) throws InterruptedException {
    lock.lock();
    try {
        while (count == capacity) notFull.await();   // while, never if
        enqueue(item);
        notEmpty.signal();                           // wake a taker only
    } finally { lock.unlock(); }
}
```

The rules carry over from the monitor protocol
(**topic 17 · `wait`/`notify`** *(not written yet)*): hold the lock to `await`/`signal`, and
always re-check the predicate in a `while` loop — `Condition.await` is
documented to permit spurious wakeup. This is how `ArrayBlockingQueue` is
built; write it yourself only when the
[`BlockingQueue` family](11-concurrent-collections.md) doesn't fit.

## `ReentrantReadWriteLock` — many readers or one writer

Read-heavy, rarely-written state (a config map, a routing table) can admit
concurrent readers safely:

```java
private final ReentrantReadWriteLock rw = new ReentrantReadWriteLock();

Config read()             { rw.readLock().lock();  try { return snapshot(); } finally { rw.readLock().unlock(); } }
void   update(Config c)   { rw.writeLock().lock(); try { apply(c); }          finally { rw.writeLock().unlock(); } }
```

The fine print, all from the class Javadoc:

- **No upgrade.** A thread holding the read lock that requests the write
  lock deadlocks itself — release read, then acquire write, then
  re-validate. *Downgrade* (write → acquire read → release write) is
  supported and documented.
- **Writer starvation** is possible in the default non-fair mode under
  constant reader traffic; fair mode queues readers behind a waiting
  writer at the cost above.
- It only pays when reads vastly outnumber writes *and* the critical
  section is long enough to matter; for a rarely-swapped reference, a
  `volatile` snapshot ([safe publication](05-java-memory-model/03-volatile-and-safe-publication.md))
  or an immutable copy-on-write value is simpler and faster.

## `StampedLock` — optimistic reading, expert tier

`StampedLock` adds a third mode: `tryOptimisticRead()` returns a stamp
without blocking writers at all; the reader copies state, then calls
`validate(stamp)` — `false` means a writer intervened, fall back to a
real read lock. Its Javadoc carries the warnings that keep it out of
everyday code: it is **not reentrant**, stamps must be threaded through by
hand, its modes don't interoperate with `Condition`, and misuse (using a
stale stamp) is unchecked. It exists for measured hot read paths in
library-grade code; `ReentrantReadWriteLock` or `volatile` snapshots are
the right first answers.

## When `synchronized` is still the right default

Everything above is capability, not superiority. `synchronized` cannot
leak a lock (release is structural), reads better, shows up first-class in
thread dumps and `IllegalMonitorStateException`-free by construction, and
since JEP 491 (JDK 24) no longer pins virtual threads
(**topic 14 · Virtual-thread pinning** *(not written yet)*). The JDK's own guidance in the
`ReentrantLock` Javadoc is to use it *"when you actually need something
it provides"* — timeout, interruptible acquisition, fairness, multiple
conditions, non-block-structured locking — and `synchronized` otherwise.

## Gotchas

**Symptom:** lock permanently held; every later caller parks forever; heap dump shows the owner thread finished its work long ago
**Cause:** an exception took an exit path with no `unlock()` — the release is manual
**Fix:** the shape is law: `lock(); try { … } finally { unlock(); }` — nothing between `lock()` and `try`, the unlock in `finally`, always

**Symptom:** `IllegalMonitorStateException` from the `finally` block itself
**Cause:** `lock()` inside the `try` — the acquire failed or was skipped, and `finally` unlocked a lock the thread never held
**Fix:** acquire *before* the `try`; only a successful acquire may be paired with the `finally` unlock

**Symptom:** deadlock "fixed" with `tryLock` still wedges under load
**Cause:** the failure branch retries immediately while still holding the first lock — the cycle is intact, just spinning
**Fix:** on `tryLock` failure release *everything* already held, back off (ideally with jitter), then retry from the start

**Symptom:** fair lock installed to fix ordering; throughput drops sharply; ordering *still* occasionally violated
**Cause:** both documented: fair handoff costs throughput, and zero-argument `tryLock()` barges regardless of fairness
**Fix:** confirm starvation is real before paying for fairness; use `tryLock(0, unit)` where the fair queue must be respected

**Symptom:** consumer thread wakes and processes an empty queue element → `NoSuchElementException`
**Cause:** `if (empty) await();` — spurious wakeup or a competing consumer consumed the element between signal and wake
**Fix:** `while (empty) condition.await();` — the predicate re-check loop is part of the protocol, for `Condition` exactly as for `wait`

**Symptom:** thread deadlocks against itself inside a read→write "upgrade"
**Cause:** `ReentrantReadWriteLock` does not support upgrade — the write acquire waits for all readers, including the requester
**Fix:** release the read lock, acquire the write lock, re-validate the state you read; or restructure to a downgrade (write→read), which is supported

**Symptom:** `StampedLock`-guarded reader intermittently returns torn or nonsense values
**Cause:** state copied under `tryOptimisticRead` was used without `validate(stamp)`, or after validate returned false
**Fix:** copy fields to locals → `validate` → only then use; on false, fall back to `readLock()`; if this feels fiddly, that is the documented signal to use a simpler lock

## Interview questions

**★ What can a `ReentrantLock` do that `synchronized` cannot?**
Bounded/immediate acquisition (`tryLock`), interruptible waiting
(`lockInterruptibly`), optional fairness, multiple `Condition` wait-sets
per lock, and locking that need not be block-structured (acquire in one
method, release in another). If none of those is needed, the Javadoc's own
advice is to stay with `synchronized`.

**★ Why is `lock(); try { … } finally { unlock(); }` written in exactly that order?**
`unlock` must run on every exit path, hence `finally`; but it must run
*only* if the acquire succeeded, hence `lock()` before the `try` — an
acquire that throws must not be followed by an unlock the thread doesn't
own, which would itself throw `IllegalMonitorStateException` and mask the
original failure.

**★ How does `tryLock` break the deadlock cycle?**
Deadlock needs threads that *hold* one lock while *waiting* indefinitely
for another. A timed or immediate `tryLock` converts the indefinite wait
into a failure branch; the protocol — release everything held, back off,
retry — removes the hold-and-wait condition, so no cycle can persist.

**★ A thread holding a read lock calls `writeLock().lock()`. What happens?**
Self-deadlock: the write acquire waits for all read holds to clear,
including the caller's own — `ReentrantReadWriteLock` has no upgrade path.
The fix is release-then-acquire with re-validation; downgrading
(write → read) is the direction that works.

**★ Why does `Condition.await` sit in a `while` loop when `signal` seems precise?**
Three documented reasons: spurious wakeup is permitted; `signalAll` (or a
shared condition) can wake threads whose predicate is already false again;
and between wake and lock re-acquisition another thread may have consumed
the state. The loop re-checks under the lock, which is the only view that
counts.

**★ When is a fair lock the wrong answer even though waiters are ordered "unfairly"?**
Almost always at first: unfair barging exists because it keeps a running
thread running and skips a queue handoff — the Javadoc warns fair mode has
notably lower throughput. Fairness is a fix for *demonstrated starvation*,
not for aesthetic ordering discomfort.

---

← Prev: **08 · Structured concurrency** *(not written yet)* · Index: [Phase 6 — Concurrency](README.md) · Next → [Atomics](10-atomics.md)
