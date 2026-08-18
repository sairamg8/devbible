---
title: "Choosing the lock object — and the limits"
sidebar_label: "3 · The lock object, the limits"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against JLS SE 25 §14.19, the JDK 25 Javadoc for
> `Integer.valueOf`/`String.intern`, JEP 390 (Warnings for Value-Based
> Classes, JDK 16 — including the `-XX:DiagnoseSyncOnValueBasedClasses`
> runtime flag), and JEP 491 (Synchronize Virtual Threads without
> Pinning, delivered in JDK 24).

**Any object's monitor will do mechanically; almost none of them are good
*choices*. The lock object is part of your class's contract with itself —
who can acquire it, whether outsiders can interfere with it, whether two
unrelated pieces of code can collide on it by accident. The professional
default is boring on purpose: `private final Object lock = new Object()`.
Everything else in this chunk is the argument for that default, plus the
honest list of what `synchronized` cannot do at all.**

## `this` is a leaked lock

`synchronized` methods lock `this` — convenient, and it publishes your
lock to the world, because every caller holds a reference to it:

```java
// your class                          // someone else's code
class Ledger {                         Ledger ledger = ...;
    synchronized void post(Entry e)    synchronized (ledger) {
    { ... }                                slowReport(ledger);   // your post()
}                                      }                        // is blocked
```

That outside block is *client-side locking* — sometimes done deliberately
(the old synchronized-wrapper collections required it for compound
operations), but done *to* you it means: any code holding your reference
can stall your synchronized methods, deadlock against you, or take your
lock and never intend to. A `private final` lock field removes the
possibility instead of documenting it away:

```java
class Ledger {
    private final Object lock = new Object();
    void post(Entry e) { synchronized (lock) { ... } }
}
```

The same argument applies to `static synchronized` and its
publicly-reachable `Class` object — prefer a
`private static final Object` for static state. And within the class,
one lock per *invariant*: unrelated states behind one lock is false
contention; one invariant behind two locks is no guard at all.

## Objects you must never lock on

- **String literals.** Interned and shared JVM-wide — two unrelated
  classes locking `"CACHE"` are locking the *same object* and can
  deadlock each other across the codebase.
- **Boxed primitives.** `Integer.valueOf` caches −128..127 by
  specification; autoboxing routes through it — `synchronized (userId)`
  on a boxed id may share a monitor with every other small-integer lock
  in the process.
- **Value-based classes generally.** `Optional`, `LocalDateTime`,
  `Duration`, the wrapper classes: their Javadoc declares instances
  identity-free, and JEP 390 made synchronizing on them a javac warning
  (and a runtime-detectable event via
  `-XX:DiagnoseSyncOnValueBasedClasses`) precisely because future
  JVM evolution may not give them usable monitors at all.
- **Anything reassignable.** `synchronized (currentConfig)` where
  `currentConfig` is swapped on reload means old and new readers hold
  *different* monitors — the guard silently forks. Lock objects are
  `final`.
- **The object you're about to mutate the reference of** — the special
  case of the above that appears in double-checked-init attempts.

The common thread: a monitor is only a guard if *exactly the
coordinating parties, and nobody else,* can reach the object — and if
"the object" is one stable identity. Interning, caching and
reassignment all break that quietly.

## What `synchronized` does not give you

The missing features are the syllabus for the rest of the phase:

- **No timeout, no try.** A thread that wants the monitor waits
  indefinitely; there is no "give up after 50 ms". `ReentrantLock`'s
  `tryLock` exists for exactly this — it is the deadlock escape hatch of
  **topic 09** *(not written yet)*.
- **No interruptible acquisition.** A thread blocked entering a
  `synchronized` block does not respond to `Thread.interrupt` — it
  parks until the monitor is free (interruption and its cooperative
  protocol are **topic 01** *(not written yet)*).
- **No fairness.** Monitor handoff order is unspecified; a hot lock can
  starve an unlucky thread indefinitely. Explicit locks offer an
  optional fairness mode, at a cost.
- **No shared-read mode.** One writer excludes readers *and* readers
  exclude each other; read-mostly structures want `ReadWriteLock` /
  `StampedLock` or, better, the immutable-snapshot pattern from
  [the cures](../03-race-conditions/03-the-cures.md).
- **No cross-process reach.** A monitor lives in one JVM; races between
  service instances need store-level guards
  ([the double-charge layering](../03-race-conditions/02-the-shapes.md)).

None of this makes `synchronized` second-choice. When you need none of
the above — the overwhelmingly common case — the block form is shorter,
impossible to forget to unlock, and JIT-optimized.

## What the JIT does to your locks

Two documented optimizations worth knowing as *facts about compiled
code* (not things to design for):

- **Lock elision.** When escape analysis proves an object never leaves
  one thread, its monitor operations can be removed entirely — e.g.
  synchronized methods of a purely-local object.
- **Lock coarsening.** Adjacent acquire/release pairs on the same
  monitor (a synchronized call in a tight loop) can be merged into one
  wider hold, trading fairness windows for fewer atomic operations.

The practical takeaway is one sentence: uncontended `synchronized` is
cheap and getting cheaper, so measure contention before architecting
around imagined lock cost — and keep critical sections small for the
*contended* case, which no JIT can optimize away.

## Virtual threads: pinning, and JEP 491

When virtual threads arrived (JDK 21), a virtual thread blocking inside a
`synchronized` region *pinned* its carrier platform thread — the
scheduler could not reuse the carrier, and enough simultaneously-pinned
threads starved the scheduler. Guidance of that era said: convert
hot `synchronized` blocks that park (I/O, lock waits) to `ReentrantLock`.

**JEP 491, delivered in JDK 24, removed the limitation**: virtual
threads now unmount inside `synchronized` blocks like anywhere else, and
the JDK 24 release notes retire the rewrite advice. On JDK 25 the
choice between `synchronized` and explicit locks is back to being about
*features* (timeout, interruptibility, fairness, read/write modes), not
about virtual-thread compatibility. Pinning itself — what remains of it
and how to observe it — is **topic 14** *(not written yet)*.

## Gotchas

**Symptom:** two unrelated subsystems deadlock; neither references the other's classes
**Cause:** both synchronized on the same interned `String` constant (or the same cached boxed `Integer`)
**Fix:** lock only on objects you constructed and control — `private final Object lock = new Object()`; javac's JEP 390 warning flags part of this class of mistake

**Symptom:** guard "stops working" after config reload — two threads inside the critical section
**Cause:** locked on a reassignable field; post-reload acquirers took the new object's monitor while old holders held the old one
**Fix:** the lock object is `final` and dedicated; reload swaps the *data* reference, never the lock

**Symptom:** framework wrapping your service occasionally stalls your synchronized methods for seconds
**Cause:** synchronized methods lock `this`, and the framework (or any caller) client-side-locks your instance
**Fix:** internal `private final` lock — your monitor stops being part of your public surface

**Symptom:** `synchronized (Boolean.TRUE)`-style lock shared across the whole JVM
**Cause:** there are exactly two cached `Boolean` instances; every such block shares them
**Fix:** value-based classes are not locks (JEP 390); dedicated lock object

**Symptom:** worker refuses to die: `interrupt()` has no effect during shutdown
**Cause:** the thread is blocked *entering* a synchronized block — monitor acquisition is not interruptible
**Fix:** if cancellable blocking matters, use `ReentrantLock.lockInterruptibly` (**topic 09** *(not written yet)*) or restructure so shutdown doesn't race the lock

**Symptom:** readers contend with each other on a read-mostly cache, though nobody writes for hours
**Cause:** intrinsic locks have one exclusive mode — fifty readers serialize
**Fix:** immutable snapshot behind a `volatile` reference for read-mostly data; `ReadWriteLock`/`StampedLock` when in-place mutation is unavoidable

**Symptom:** 2023-era code review demands `ReentrantLock` "because virtual threads pin on synchronized"
**Cause:** stale guidance — true on JDK 21, removed by JEP 491 in JDK 24
**Fix:** on JDK 25, choose by feature need; rewrite only if you need timeout/interruptible/fair/shared acquisition modes

**Symptom:** microbenchmark "proves" synchronized is free; production shows convoying on the same code
**Cause:** the benchmark ran uncontended (elision/coarsening territory); production runs contended, where cost is queueing, not the atomic op
**Fix:** measure with realistic thread counts and hold times; optimize by shrinking hold time and splitting locks per invariant, not by trusting either extreme

## Interview questions

**★ Why prefer a `private final Object` lock over `synchronized(this)`?**
Because `this` is public: every reference holder can synchronize on it,
stalling your methods, deadlocking against you, or coupling to your
locking accidentally (client-side locking). A private final lock makes
the monitor an implementation detail — the set of acquirers is exactly
the code you wrote. It also survives refactors that expose the object
more widely.

**★ What's wrong with `synchronized ("lock-" + tenantId)`?**
Everything at once: string concatenation makes a *new* object per call
(no two threads ever exclude), while interning the literal parts shares
monitors JVM-wide (unrelated code can collide). Per-key locking needs a
canonical object per key — e.g. a `ConcurrentHashMap<K, Object>` of lock
objects via `computeIfAbsent`, or better, the map's own atomic compound
operations.

**★ Name the capabilities `synchronized` lacks compared to `ReentrantLock`.**
Try/timed acquisition (`tryLock`), interruptible acquisition
(`lockInterruptibly`), optional fairness, multiple wait-sets
(`newCondition`), and non-block-structured locking (hand-over-hand).
Plus, via other lock types, shared-read modes. The trade: explicit
locks demand a `finally` for unlock and lose the syntactic guarantee.

**★ Is locking on an `Integer` id safe if ids are always large?**
No — it's fragile even when the −128..127 `valueOf` cache doesn't bite,
because two boxes of the *same* large id are different objects (no
exclusion where you expected it), while deduplicated/cached boxes share
identity where you didn't. Identity of value-based instances is exactly
what JEP 390 tells you not to rely on. Use a dedicated per-key lock
object.

**★ What did JEP 491 change, and what should you do about old advice?**
Before JDK 24, a virtual thread blocking inside `synchronized` pinned
its carrier, so hot guarded I/O paths were rewritten to `ReentrantLock`.
JEP 491 made monitor operations virtual-thread-friendly — blocked
virtual threads unmount. On 24+, `synchronized` is fully compatible
with virtual threads; evaluate old "must rewrite" comments against the
running JDK and delete the ones that no longer hold.

**★ When does lock granularity become a design question?**
When one lock guards several independent invariants (false contention —
split it) or several locks guard one invariant (no guard — merge them).
The unit is the invariant: one lock per set of fields that must change
together. Coarser is simpler and slower under load; finer is faster and
easier to get wrong — start coarse, split only where contention is
measured.

---

← Prev: [Visibility and happens-before](02-visibility-and-happens-before.md) · Index: [`synchronized` and intrinsic locks](README.md) · Next → [The Java Memory Model](../05-java-memory-model/README.md)
