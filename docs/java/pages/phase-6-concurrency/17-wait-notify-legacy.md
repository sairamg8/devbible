---
title: "wait/notify — the legacy protocol"
sidebar_label: "17 · wait/notify (legacy)"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Object.wait`,
> `Object.notify` and `Object.notifyAll` (including the spurious-wakeup
> and `IllegalMonitorStateException` clauses), JLS SE 25 §17.2 (wait
> sets and notification), and the JDK 25 Javadoc for `BlockingQueue` and
> `Condition`.

**Every object has a wait set, and `wait`/`notify`/`notifyAll` are the
raw controls over it — the mechanism `BlockingQueue`, latches and
barriers are built from. In 2026 the skill is *archaeological*: you will
meet this protocol in code older than `java.util.concurrent` (2004) and
in the JDK's own internals, and you need to read it, verify it, and
know what to replace it with. What you should not do is start a new
design with it — every one of its uses has a higher-level tool that
encodes the hard-won rules so you can't forget them.**

## The protocol — all of it is mandatory

```java
private final Object lock = new Object();
private Queue<Task> buffer = new ArrayDeque<>();   // guarded by lock

// consumer
Task take() throws InterruptedException {
    synchronized (lock) {
        while (buffer.isEmpty()) {     // 1. WHILE, never if
            lock.wait();               // 2. inside synchronized, on the same lock
        }
        return buffer.poll();          // condition true AND lock held
    }
}

// producer
void put(Task t) {
    synchronized (lock) {
        buffer.add(t);
        lock.notifyAll();              // 3. notifyAll, and while holding the lock
    }
}
```

Three interlocking rules, none optional:

1. **Hold the monitor.** `wait`/`notify`/`notifyAll` throw
   `IllegalMonitorStateException` unless the calling thread owns the
   monitor of the object they're invoked on. Not "a" lock — *that*
   object's monitor.
2. **`wait` in a `while` loop re-testing the condition.** Never `if`.
3. **Prefer `notifyAll`** unless a narrow, documented exception applies.

**What `wait` does, precisely** (JLS §17.2): atomically releases the
monitor and parks the thread in the object's wait set; on wakeup —
notify, interrupt, timeout, or spuriously — the thread must **reacquire
the monitor before `wait` returns**. So the code after `wait` always
runs with the lock held, but the condition may have changed between the
notify and the reacquisition: another thread can have taken the lock in
that gap and consumed the state. That gap is why the `while` loop is
structural, not stylistic.

## Why `while` — the three independent reasons

- **Spurious wakeups.** The Javadoc states threads can wake "without
  being notified, interrupted, or timing out" — permitted for the sake
  of the underlying OS primitives. Rare, real, and specified.
- **Stolen wakeups.** Between the notify and the waiter's reacquisition
  of the monitor, a third thread can barge in, take the lock, and
  consume the item. The waiter resumes with the condition false again.
- **Multiple conditions, one wait set.** Every object has exactly *one*
  wait set — producers waiting for space and consumers waiting for items
  wait in the same place. A notification for "space available" can wake
  a consumer. The `while` makes the wrong-recipient case harmless.

The third reason also decides **`notify` vs `notifyAll`**: `notify`
wakes one *arbitrary* waiter (JLS: the choice is at the discretion of
the implementation). If the wrong category is chosen — a producer when
only consumers can make progress — the signal dies with it and the
system hangs. `notify` is only safe when every waiter waits for the
same condition *and* any single one can complete the state change.
`notifyAll` costs a thundering herd of reacquisitions; correctness-first
says pay it.

## The other fine print

- **`wait` releases only *that* monitor.** A thread holding two nested
  locks that waits on the inner one still holds the outer — a classic
  hidden-deadlock shape in legacy code.
- **`sleep` releases nothing** — the visible cousin confusion:
  `Thread.sleep` inside `synchronized` keeps the monitor and blocks
  everyone else out for the duration.
- **Timed `wait(millis)` cannot tell you why it returned.** No boolean
  result — timeout and notification look identical; only the re-tested
  condition (plus your own clock if you need to distinguish) carries
  information.
- **Interruption**: `wait` throws `InterruptedException` (clearing the
  flag) — the full protocol is
  [topic 01's interruption chunk](01-threads-lifecycle-interrupt/02-interruption.md).
- The wait-set operations live on `Object`, which is *why* they can't
  be overloaded per-condition — and why `Condition` (from
  `ReentrantLock.newCondition()`, **topic 09** *(not written yet)*)
  exists: multiple wait sets per lock, one per condition, so "not full"
  and "not empty" waiters stop sharing a room.

## What replaced each use

| Legacy shape (recognize it) | Modern replacement |
|---|---|
| Buffer + wait-for-items / wait-for-space | `BlockingQueue` — `take`/`put` *are* this protocol, debugged (**topic 11** *(not written yet)*) |
| Wait until initialization/event done | `CountDownLatch` ([topic 16](16-coordination-primitives.md)) |
| Threads meeting in rounds | `CyclicBarrier`/`Phaser` ([topic 16](16-coordination-primitives.md)) |
| Wait for a computed result | futures — **topic 07** *(not written yet)* |
| Distinct not-full / not-empty conditions | `Condition` per state, one lock — **topic 09** *(not written yet)* |

Reading legacy code, audit against the three rules: monitor held? `while`
loop? `notifyAll` (or a justified `notify`)? A violated rule is not
proof of a bug you can trigger — it is proof nobody could have reasoned
it correct, which in concurrent code is the same finding.

## Gotchas

**Symptom:** `IllegalMonitorStateException` from a `wait()` that sits right next to a `synchronized` block
**Cause:** synchronized on one object, waiting on another (`synchronized (this) { queue.wait(); }`)
**Fix:** lock object and wait object must be the *same* object — that's the protocol's grammar

**Symptom:** consumer occasionally polls an empty buffer and crashes, "impossible" per the notify logic
**Cause:** `if (buffer.isEmpty()) wait();` — spurious or stolen wakeup resumed it with the condition false
**Fix:** `while` — re-test after every return from `wait`, no exceptions to this rule exist

**Symptom:** system with producers and consumers deadlocks rarely, always under load, all threads WAITING
**Cause:** `notify()` woke a same-category waiter (producer woke producer); the only thread that could progress never heard
**Fix:** `notifyAll()`, or migrate to `Condition` so each category has its own wait set

**Symptom:** everything stalls for exactly N seconds at a time behind one thread
**Cause:** `Thread.sleep` inside `synchronized` — holds the monitor while pausing, unlike `wait`
**Fix:** never sleep holding a lock; if the intent was "wait for state", it's `wait`; if "poll later", leave the block first

**Symptom:** notification "lost" — producer notified before the consumer ever reached `wait`, consumer blocks forever
**Cause:** signal state lived only in the notification itself; wait sets don't queue signals for future waiters
**Fix:** the condition must be *state* (`buffer.isEmpty()`), checked before waiting — then a pre-arrival notify is invisible because the state test already passes; or use a `CountDownLatch`, which records the event

**Symptom:** migration to `ReentrantLock` compiles but throws `IllegalMonitorStateException` at the old `wait()` calls
**Cause:** `lock.lock()` acquires the `Lock`, not the object's *monitor* — `Object.wait` still demands the monitor
**Fix:** with `Lock`, the counterpart is `newCondition()` + `condition.await()`/`signalAll()` — the pairs don't mix

## Interview questions

**★ Why must `wait` be called in a loop?**
Three separate hazards make the resumed condition untrustworthy: spec-
permitted spurious wakeups; the gap between notify and monitor
reacquisition in which another thread consumes the state; and the single
per-object wait set mixing waiters of different conditions. The loop
re-tests, converting all three from bugs into a harmless extra
iteration.

**★ `wait` vs `sleep` — all the differences that matter.**
`wait`: on `Object`, requires holding that monitor, *releases it* while
parked, resumes by notify/interrupt/timeout/spuriously, then reacquires.
`sleep`: static on `Thread`, no lock requirement, releases nothing,
resumes by timeout/interrupt. Confusing them holds locks through pauses
or throws `IllegalMonitorStateException`.

**★ When is bare `notify` defensible?**
When both hold by design, documented: every possible waiter waits on the
same condition, and any one waiter can fully handle the state change.
One wait set, one waiter category, one-in-one-out semantics — e.g. a
single-slot handoff. Anything less and an arbitrary-choice wakeup can
strand the only thread that could progress.

**★ How does `Condition` fix what `notifyAll` papers over?**
`notifyAll` compensates for one shared wait set by waking everyone and
letting the `while` loops sort it out — correct, wasteful. A
`ReentrantLock` can mint one `Condition` per predicate (`notFull`,
`notEmpty`); signaling targets exactly the category that can proceed.
Same protocol — `await` in a loop, signal with lock held — better
addressing.

**★ You inherit a wait/notify buffer that "works". What do you check, and do you rewrite it?**
Audit the grammar: waits inside `synchronized` on the same object;
`while` re-tests; `notifyAll` or a justified `notify`; no waits while
holding *other* locks; interruption not swallowed. If it passes, it
works — schedule a `BlockingQueue` migration for maintainability, not as
an emergency. Any rule violated: it's not verifiable — replace rather
than patch, because the replacement encodes the rules structurally.

---

← Prev: [Coordination primitives](16-coordination-primitives.md) · Index: [Phase 6 — Concurrency](README.md) · Next → [Phase 7 — I/O, time and the everyday stdlib](../phase-7-io-time-stdlib/README.md)
