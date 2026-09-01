---
title: "Deadlock is the failure the JVM finds for you; livelock and lock convoys are the ones where every thread is running, no thread is blocked, the detector reports nothing, and the service is making no progress anyway"
sidebar_label: "05c · Livelock and lock convoys"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Troubleshoot Process Hangs
> and Loops" — both the "Diagnose a Loop Process" procedure and the "Deadlock Not Detected"
> section
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)),
> and the **`java.lang.Thread.State` API documentation**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.State.html)).
> 🔴 **No sandbox** — every dump fragment below is a marked schematic.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[05b](05b-deadlock.md) covered the failure the JVM hands you on a plate. This page covers its
two neighbours, which it will never report: livelock, where threads are running and undoing each
other's work, and the lock convoy, where every thread eventually gets the lock and the throughput
collapses anyway. Both produce dumps that look busy and healthy, and both are diagnosed by
comparison across dumps rather than by anything in a single one.**

## Livelock: everybody is running, nobody is progressing

A deadlock is threads stopped. A **livelock** is threads *moving* — acquiring, failing,
releasing, retrying — in a pattern that never completes. The classic shape is two threads
politely backing off for each other forever.

**The way it usually arrives in real code is a `tryLock` retry loop.** Somebody hits the deadlock
in [05b](05b-deadlock.md), applies the mitigation without the fix, and writes:

```java
while (true) {
    if (lockA.tryLock()) {
        try {
            if (lockB.tryLock()) {
                try { doWork(); return; }
                finally { lockB.unlock(); }
            }
        } finally { lockA.unlock(); }
    }
    // retry immediately
}
```

*(Illustrative — this is the anti-pattern, not a recommendation.)*

Two threads running that with opposite lock orders can each take their first lock, fail on the
second, release, and retry — in lockstep, indefinitely. **No thread is ever blocked, so no thread
is ever `BLOCKED`.** The deadlock detector finds no cycle because at every instant somebody is
releasing.

### What it looks like in a dump

```text
"worker-1" ... 
   java.lang.Thread.State: RUNNABLE
        at java.base/java.util.concurrent.locks.ReentrantLock.tryLock(...)
        at com.example.TransferService.transfer(TransferService.java:52)

"worker-2" ...
   java.lang.Thread.State: RUNNABLE
        at java.base/java.util.concurrent.locks.ReentrantLock.tryLock(...)
        at com.example.TransferService.transfer(TransferService.java:52)
```

*(Schematic.)*

🔴 **The signature is: `RUNNABLE`, CPU is being consumed, the same small set of frames appears
across all three dumps, and no application-level work is completing.** That last clause is the
one that has to come from outside the dump — from the request completion rate, the queue depth,
or the log going quiet.

**A dump alone cannot distinguish livelock from a hot loop doing useful work.** Both are
`RUNNABLE`, both burn CPU, both show stable frames. The distinguishing evidence is that the
application's own counters are flat.

## Lock convoys: everybody gets the lock, and it still collapses

A convoy is subtler and far more common in production than livelock.

The mechanism: a lock is held briefly but acquired very frequently. A thread holding it gets
descheduled — a timeslice ends, a page fault, a GC safepoint — and every other thread piles up
waiting. When it resumes and releases, the waiters wake, one wins, and the rest go back to
sleep. **The queue never drains**, and the system spends its time on context switches and wakeups
rather than work.

The costs are indirect and that is why convoys are missed:

- **Throughput falls off a cliff** at a load level slightly above where it was fine, rather than
  degrading smoothly.
- **CPU looks moderate** — the machine is context-switching, not computing.
- **The lock's hold time is genuinely short**, so profiling the critical section shows nothing
  wrong. The cost is in the queueing, not in the work.
- **The dump shows many threads `BLOCKED` or parked on one lock** — which looks like ordinary
  contention, because it is ordinary contention taken past a threshold.

⚠️ **A convoy and plain contention are the same phenomenon at different intensities**, so the
useful question is not "is this a convoy" but "why is this lock acquired so often". The answer is
usually a shared counter, a cache guarded by a single lock, or a logger.

## Telling the three apart

| | **Deadlock** | **Livelock** | **Convoy** |
|---|---|---|---|
| Thread states | `BLOCKED` / `WAITING` | `RUNNABLE` | Many `BLOCKED` or parked on one lock |
| CPU | Idle | **Consumed** | Moderate, high context switching |
| JVM detects it | ✅ Yes | ❌ No | ❌ No |
| Same frames across dumps | Yes, identical | Yes, a small cycling set | Waiters change; the lock stays hot |
| Work completing | None | **None** | Some, far below capacity |
| The distinguishing evidence | The dump itself | Application counters flat | Throughput cliff, context switches |

🔴 **Two of the three need evidence from outside the thread dump.** That is the honest summary of
this page: the dump narrows it, and the application's own metrics decide it.

## Diagnosing them

**For livelock:**

1. Confirm CPU is being consumed — this rules out a hang.
2. Take three dumps. A small, repeating set of frames involving lock acquisition across all three
   is the signature.
3. Check that application work is not completing — request counters, queue depth, log volume.
4. Look for `tryLock` in a retry loop, or any retry with no backoff and no bound.

**For a convoy:**

1. Identify the hot lock: the dump shows many threads waiting on one identity
   ([05](05-locks-in-a-dump.md)) — remembering `-l` for `java.util.concurrent` locks.
2. Look at *acquisition frequency*, not hold time. The holder's stack usually shows something
   short and unremarkable, which is the point.
3. Check context-switch rate at the OS level, which is where the cost actually lands.
4. Ask what the lock protects and whether it needs to be one lock at all.

## Fixing them

**Livelock** — the fix is almost always **randomised backoff with a bound**. If retry is
immediate and symmetric, two threads stay in lockstep; adding jitter breaks the symmetry, and a
retry limit converts an infinite livelock into a failed operation you can see and report. But the
real fix, as in [05b](05b-deadlock.md), is a consistent lock order that removes the need to retry
at all.

**Convoys** — reduce acquisition frequency rather than hold time:

- **Shard the lock.** One lock per bucket instead of one lock for the structure — which is what
  `ConcurrentHashMap` does, and why it does not convoy.
- **Remove the lock.** An atomic, a `LongAdder` for a hot counter
  ([topic 01](../01-memory-layout/08c2-false-sharing-and-contended.md)), or an immutable snapshot
  read without synchronisation.
- **Batch.** Take the lock once for a hundred items rather than a hundred times for one.
- **Consider a read-write lock** where reads dominate — with the caveat that
  `ReentrantReadWriteLock` has its own contention characteristics and is not automatically better.

⚠️ **Shortening the critical section is the intuitive fix and often does not help**, because the
cost is queueing and wakeups rather than the work done under the lock. Halving a hold time that is
already microseconds changes very little; halving the number of acquisitions changes everything.

## Gotchas

**★ The JVM detects neither livelock nor convoys.**
Its algorithm finds cycles in lock ownership. A livelock has no cycle because locks are constantly
being released, and a convoy is not a cycle at all. `Found one Java-level deadlock` will never
appear for either.

**★ Livelock threads are `RUNNABLE` and consume CPU.**
Which makes them look like a healthy busy service. The only thing that distinguishes livelock from
useful work is that the application's own counters are flat — evidence the dump does not contain.

**★ An immediate `tryLock` retry loop is the standard way to create a livelock.**
It is what people write when they apply the deadlock mitigation without the fix. Symmetric
immediate retry keeps threads in lockstep; jitter and a retry bound are the minimum.

**★ A convoy shows short hold times, so profiling the critical section finds nothing.**
The cost is in queueing and context switching, not in the work under the lock. Optimising the
critical section is the intuitive move and usually the wrong one.

**★ Shortening a hold time does not fix a convoy; reducing acquisitions does.**
Halving microseconds of work changes little. Halving the number of times the lock is taken —
sharding, batching, removing it — changes the queueing behaviour entirely.

**★ Convoys present as a throughput cliff, not a gradual slowdown.**
The system is fine, then at slightly higher load it collapses. Anything with that shape is worth
checking for a single hot lock.

**★ Moderate CPU during a throughput collapse points at context switching.**
The machine is busy managing threads rather than running them. That combination — collapse
without CPU saturation — is characteristic.

**★ A convoy is just contention past a threshold.**
There is no clean line between them, so do not spend time classifying. The actionable question is
always which lock is acquired most often and why.

**★ Two of the three failures need evidence from outside the dump.**
Deadlock is self-evident in the file. Livelock needs application counters; convoys need throughput
and context-switch data. A thread dump narrows the possibilities and does not close either case.

**★ `ReentrantReadWriteLock` is not automatically the answer.**
It helps when reads genuinely dominate and the read sections are long enough to matter. It has its
own overhead and its own contention behaviour, and swapping it in reflexively can make things
worse.

## Interview questions

**★ What is the difference between deadlock and livelock?**
In a deadlock threads are stopped, each waiting for a lock another holds, forming a cycle the JVM
can detect. In a livelock threads are running — acquiring, failing, releasing, retrying — so no
cycle ever exists and nothing is blocked. The JVM reports nothing, the threads are `RUNNABLE`, CPU
is consumed, and no work completes. Deadlock looks like a hang; livelock looks like a busy,
healthy service.

**★ How would you diagnose a livelock?**
Confirm CPU is being consumed, which rules out a hang. Take three dumps and look for a small
repeating set of frames involving lock acquisition — typically `tryLock` in a retry loop. Then
check the application's own counters: if requests are not completing and queue depth is not
falling while CPU is busy, the work is being undone as fast as it is done. The dump alone cannot
distinguish livelock from a useful hot loop; the flat counters are what decide it.

**★ What is a lock convoy, and why is it hard to spot?**
A lock held briefly but acquired very frequently, where a holder being descheduled causes every
other thread to queue behind it, and the queue never drains. It is hard to spot because everything
looks reasonable individually: hold times are short, so profiling the critical section shows
nothing; CPU is moderate, because the machine is context-switching rather than computing; and the
dump just shows contention on one lock, which looks ordinary. The signature is a throughput cliff
without CPU saturation.

**★ Your service's throughput collapses at slightly higher load and CPU is only at 40%. Where do
you look?**
At a single hot lock and at context-switch rate. Moderate CPU during a throughput collapse means
the machine is managing threads rather than running them, which is the convoy signature. A dump —
with `-l`, since the lock is likely a `java.util.concurrent` one — will show many threads waiting
on one identity. The question then is acquisition frequency, not hold time.

**★ You have a convoy on a lock guarding a shared counter. What do you change?**
Remove the lock rather than shorten it. A hot counter is exactly what `LongAdder` is for — it
stripes across padded cells so threads increment different memory rather than contending on one
location. More generally the convoy fixes are about reducing acquisitions: shard the lock, batch
the work under it, or replace it with an atomic or an immutable snapshot. Shortening the critical
section addresses the wrong term.

**★ Someone fixes a deadlock with `tryLock` and a retry loop. What is your concern?**
Two things. First, the inconsistent lock ordering that caused the deadlock is still there — this
is a mitigation, not a fix. Second, if the retry is immediate and symmetric it can produce a
livelock: both threads take their first lock, fail on the second, release and retry in lockstep
forever, consuming CPU while completing nothing. At minimum the retry needs randomised backoff and
a bound, and preferably the lock order gets fixed so no retry is needed.

**★ Why does the JVM's deadlock detection not help with either of these?**
Because it looks for cycles in lock ownership at the instant of the dump. In a livelock, locks are
constantly being acquired and released, so at any instant there is no cycle. In a convoy there is
no cycle at all — every thread does eventually get the lock; the problem is queueing throughput,
not mutual waiting. Both are outside what the algorithm is defined to find.

{/* FOOTER */}
