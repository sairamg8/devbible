---
title: "The monitor"
sidebar_label: "1 · The monitor"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §14.19 (The `synchronized`
> Statement), §8.4.3.6 (synchronized Methods), §17.1 (Synchronization),
> and the JVMS SE 25 description of `monitorenter`/`monitorexit`.

**Every object — every one, from `new Object()` to your `OrderService` —
has exactly one monitor: a lock that at most one thread can hold, plus a
wait set used by `wait`/`notify` (**topic 17** *(not written yet)*).
`synchronized` acquires that monitor on entry and releases it on *every*
exit — normal return, exception, anything. Which object's monitor you
acquire is the entire meaning of the construct: two threads exclude each
other only when they synchronize on the *same object*.**

## Statement form and method form

The block form names its lock explicitly; the method forms pick one for
you:

```java
class Counter {
    private final Object lock = new Object();
    private long count;

    void incrementBlock() {
        synchronized (lock) {        // lock: the named object's monitor
            count++;
        }
    }

    synchronized void increment() {  // lock: this
        count++;
    }

    static synchronized void resetAll() {  // lock: Counter.class
        // ...
    }
}
```

- **`synchronized (expr) { ... }`** — evaluates `expr` to a reference,
  acquires that object's monitor. If `expr` is null, the statement throws
  `NullPointerException` (JLS §14.19). The compiled form brackets the
  body with `monitorenter`/`monitorexit`, with an implicit handler
  guaranteeing the exit runs when the body throws.
- **`synchronized` instance method** — sugar for wrapping the body in
  `synchronized (this)`.
- **`static synchronized` method** — locks the `Class` object
  (`Counter.class`). Two consequences worth saying aloud: static and
  instance synchronized methods do **not** exclude each other (different
  monitors), and every instance shares the one static lock.

Which object to choose — and why `this` is usually the wrong answer — is
[chunk 3](03-choosing-the-lock-object.md); this chunk needs only the
mechanics.

## Reentrancy

Intrinsic locks are *reentrant*: a thread that holds a monitor can
acquire it again without blocking (JLS §17.1 — a thread may lock the
same monitor multiple times; it unlocks when the count of unlocks
matches). This is what lets a synchronized method call another
synchronized method on the same object:

```java
synchronized void transferIn(long amount) {
    deposit(amount);                 // also synchronized(this) — no deadlock
}
synchronized void deposit(long amount) { balance += amount; }
```

Without reentrancy, `transferIn` would deadlock against itself. The
corollary: reentrancy is per *thread*, not per call site — a callback
invoked while you hold the lock runs with your lock, which is how
"foreign code called under my monitor" bugs arise
([chunk 3](03-choosing-the-lock-object.md)).

## You guard data, not code

The most load-bearing sentence in this topic: **a lock protects nothing
by itself — it protects data only if *every* access to that data happens
under the same lock.** `synchronized` marks a region of code, and it is
easy to mistake the region for the protection. The protection is the
*convention* that all reads and writes of `count` go through blocks
synchronized on the same monitor.

The classic half-guard:

```java
class Broken {
    private long count;
    synchronized void increment() { count++; }   // guarded write
    long value() { return count; }               // UNGUARDED read — bug
}
```

The unguarded read is both a data race (no happens-before edge —
[chunk 2](02-visibility-and-happens-before.md)) and, for compound reads,
a torn view of invariants. Every access path, reads included, or the
guard is fiction. This is also why the guarded fields should be
`private`: a `public` field cannot be guarded, because you cannot see
its access paths.

Scope follows the invariant, in both directions:

- **Too narrow** re-opens the race: `synchronized` on `get` and on `put`
  separately still leaves the check-then-act gap between them — the
  block must span the *whole* compound step
  ([the shapes](../03-race-conditions/02-the-shapes.md)).
- **Too wide** serializes work that needed no guard — I/O or slow
  computation inside the block extends the critical section and every
  waiter's queue time. Compute first into locals, lock only around the
  shared-state touch.

## Gotchas

**Symptom:** two threads observed inside the "same" critical section
**Cause:** they synchronized on different objects — e.g. each on its own instance via `synchronized(this)`, or one on the instance and one on the class
**Fix:** exclusion requires one shared monitor; identify the data, pick the one lock object that guards it, route every access through it

**Symptom:** `static synchronized` methods still interleave with instance methods on shared static state
**Cause:** instance methods lock `this`, static methods lock the `Class` object — different monitors, no exclusion between them
**Fix:** never touch static mutable state from instance-locked code; guard static state only via the class lock (or better, a dedicated `private static final Object lock`)

**Symptom:** synchronized getter added "for safety", race remains in `if (map.isEmpty()) rebuild()`
**Cause:** each call is atomic; the *pair* is not — the monitor was released between check and act
**Fix:** one synchronized block spanning the whole compound decision, not per-call synchronization

**Symptom:** throughput collapses after adding one lock; profiler shows threads parked at `monitorenter`
**Cause:** critical section includes a network call — every caller queues behind the slowest I/O
**Fix:** shrink the section: do I/O and computation outside, lock only the read/write of shared state; or remove sharing entirely ([the cures](../03-race-conditions/03-the-cures.md))

**Symptom:** `NullPointerException` at a `synchronized (config.getLock())` line
**Cause:** the lock expression evaluated to null — JLS §14.19 mandates NPE
**Fix:** lock objects are `private final Object lock = new Object()` — created eagerly, never null, never reassigned

**Symptom:** deadlock introduced by refactoring a synchronized method to call a helper on *another* object that calls back
**Cause:** reentrancy saves you only on the *same* monitor; A-locked code calling B-locked code that calls back into A is the classic two-lock cycle
**Fix:** never call foreign/overridable code while holding a lock; keep critical sections self-contained (**topic 13 · Deadlock** *(not written yet)* has the ordering discipline)

## Interview questions

**★ What two things does `synchronized` give you?**
Mutual exclusion — at most one thread holds a given monitor, so guarded
regions on the same lock never interleave — and visibility: an unlock
happens-before every subsequent lock of the same monitor, so writes made
under the lock are seen by the next holder. Half the bugs come from
knowing only the first.

**★ What does a synchronized instance method lock? A static one? Do they exclude each other?**
Instance method: `this`. Static method: the `Class` object. No — they
are different monitors, so an instance method and a static method can run
simultaneously. Shared static state touched from instance methods is
therefore unguarded even if "everything is synchronized".

**★ What is reentrancy and why does it exist?**
A thread holding a monitor may re-acquire it without blocking; the
monitor counts acquisitions and releases at the matching unlock. It
exists so that guarded code can call other guarded code on the same
object — without it, `synchronized` methods could never compose and a
method calling itself recursively under a lock would self-deadlock.

**★ Is `synchronized void get()` + `synchronized void put()` enough to make a check-then-act safe?**
No. Each call is individually atomic, but the monitor is released between
them — another thread's `put` can land in the gap. Atomicity must span
the compound operation: one block around check *and* act, on the one lock
that guards the data.

**★ Why must the read path synchronize too, if reads "don't change anything"?**
Two reasons. Visibility: an unsynchronized read has no happens-before
edge, so it may see a stale value indefinitely. Consistency: a
multi-field read can observe an invariant mid-update. Guarding writes
only produces code that looks safe and reads garbage — the
[chunk 2](02-visibility-and-happens-before.md) demonstration.

**★ What should live inside a critical section, and what must not?**
Inside: the reads and writes of the shared state forming one invariant-
preserving step — as little as that. Outside: computation that can use
locals, and especially I/O — a remote call under a lock turns the lock
into a queue for the whole service. Exception: when the I/O *is* the
guarded resource (one shared connection), in which case own it with a
dedicated worker instead ([confinement](../03-race-conditions/03-the-cures.md)).

---

← Index: [`synchronized` and intrinsic locks](README.md) · Next → [Visibility and happens-before](02-visibility-and-happens-before.md)
