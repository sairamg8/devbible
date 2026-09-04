---
title: "A virtual thread's frames only live on the heap while it is unmounted, so the carrier pool, the cost of the copy and every remaining cause of pinning are all still native-memory questions on JDK 25"
sidebar_label: "06c · Carriers, mounting, pinning"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against **JEP 444: Virtual Threads**, sections *"Scheduling virtual
> threads"*, *"Pinning"* and *"Memory use and interaction with garbage collection"*
> ([openjdk.org](https://openjdk.org/jeps/444)); **JEP 491: Synchronize Virtual Threads without
> Pinning**, delivered in **JDK 24** — Summary, Description, *"Diagnosing remaining cases of
> pinning"*, *"The system property `jdk.tracePinnedThreads` is no longer needed"*, *"Choosing
> between `synchronized` and `java.util.concurrent.locks`"*, *"Future Work"* and *"Alternatives"*
> ([openjdk.org](https://openjdk.org/jeps/491)); and the **JDK 25 core-libraries "Virtual
> Threads" guide** ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/core/virtual-threads.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[06b](06b-virtual-thread-stacks.md) established that a virtual thread's stack is a heap
object. This chunk covers the half of the story that is still native: the carrier platform
threads the scheduler runs virtual threads on, the frame copying that moves a stack between the
carrier and the heap, and pinning — which on JDK 25 no longer means what the 2023 blog posts say
it means, because JEP 491 removed the `synchronized` case in JDK 24 and removed the diagnostic
flag everyone's runbook still starts with.**

## Mounting, unmounting, and where the frames physically are

A virtual thread runs on a **carrier**, which is a real platform thread with a real OS stack.
JEP 444:

> *"The JDK's virtual thread scheduler is a work-stealing `ForkJoinPool` that operates in FIFO
> mode. The parallelism of the scheduler is the number of platform threads available for the
> purpose of scheduling virtual threads. By default it is equal to the number of available
> processors, but it can be tuned with the system property
> `jdk.virtualThreadScheduler.parallelism`."*

While a virtual thread is **mounted**, its live frames are on the carrier's OS stack — a normal
native stack, sized by `-Xss` like any other platform thread. When it **unmounts** on a blocking
operation, the frames it still needs are copied into its stack chunk object on the heap and the
carrier is released. When it is rescheduled, the frames are copied back, possibly onto a
different carrier.

That copy is the cost model nobody quotes: **unmount and remount are proportional to the depth
of the stack that has to move**, not to the number of virtual threads. A thread-per-request
service whose handler blocks at depth 12 pays a small copy per block; one that blocks at depth
600 inside a chain of framework interceptors pays a much larger one, on every block. This is why
JEP 444 makes a point of saying:

> *"Most virtual threads will thus be short-lived and have shallow call stacks, performing as
> little as a single HTTP client call or a single JDBC query."*

Deep stacks are not forbidden, they are simply the thing that makes virtual threads less cheap
than the headline suggests.

## Pinning in JDK 25: the advice you have read is probably two versions stale

🔴 **`synchronized` no longer pins.** JEP 491 was delivered in **JDK 24**, and its summary is:

> *"Improve the scalability of Java code that uses `synchronized` methods and statements by
> arranging for virtual threads that block in such constructs to release their underlying
> platform threads for use by other virtual threads. This will eliminate nearly all cases of
> virtual threads being pinned to platform threads."*

The JEP is equally direct about what that means for the migration advice everyone published in
2023:

> *"We previously recommended solving frequent and long-lived pinning problems by migrating code
> from using `synchronized` to using `ReentrantLock`. Once the `synchronized` keyword no longer
> pins virtual threads, such migration will no longer be necessary. You need not revert code
> that has been migrated to use `ReentrantLock` back to using `synchronized`."*

And on which to choose for new code:

> *"If you are writing new code, we agree with the recommendation in Java Concurrency in
> Practice §13.4: Use `synchronized` where practical, since it is more convenient and less
> error prone, and use `ReentrantLock` and the other APIs in `java.util.concurrent.locks` when
> more flexibility is required."*

Two collateral changes you will trip over on JDK 25:

- **`jdk.tracePinnedThreads` is gone.** *"We will therefore remove this system property; setting
  it on the command line will have no effect."* A runbook that says "start with
  `-Djdk.tracePinnedThreads=full`" now silently does nothing. The replacement is the
  `jdk.VirtualThreadPinned` JFR event, which was *retained* and enhanced *"to convey both the
  reason why the virtual thread is pinned and the identity of the carrier thread"*.
- **What still pins.** JEP 491 lists them: a virtual thread that *"calls native code, either
  through a native method or the Foreign Function & Memory API, and that native code calls back
  to Java code that performs a blocking operation or blocks on a monitor"*. Its Future Work
  section adds three more — blocking while loading a class during symbolic resolution, blocking
  inside a class initializer, and waiting for a class to be initialized by another thread —
  noting *"These cases should rarely cause issues but we will revisit them if they prove to be
  problematic."*

Why this belongs on a *memory* page: a pinned virtual thread's frames stay on the carrier's
native stack instead of being copied to the heap, and the carrier is not returned to the pool.
Pinning therefore converts heap-resident stacks back into native-resident stacks and, when it
lasts, forces the scheduler to grow its pool of carriers — each of which is a platform thread
with a full `-Xss` reservation. The concurrency-side treatment is
[Phase 6 · 14 · Virtual thread pinning](../../phase-6-concurrency/14-virtual-thread-pinning.md).

## Where the remaining native cost lives

Adopting virtual threads does not delete the native thread-stack term from your memory budget;
it changes what multiplies it. Before, it was *concurrent requests* × `-Xss`. After, it is
*carriers* × `-Xss`, plus every platform thread your libraries still start directly — JDBC
driver cleanup threads, Netty event loops that were configured explicitly, timer threads,
anything built on `Executors.newFixedThreadPool`. The budgeting arithmetic for both is
[06d · The thread-count arithmetic](06d-the-thread-count-arithmetic.md).

The scheduler-side knobs, for completeness:

| Property | What it sets | Default per JEP 444 / JEP 491 |
|---|---|---|
| `jdk.virtualThreadScheduler.parallelism` | platform threads used to schedule virtual threads | number of available processors |
| `jdk.virtualThreadScheduler.maxPoolSize` | ceiling on the scheduler's platform threads | 256 |

JEP 491 states the maximum in the course of rejecting "just add more carriers" as a fix for
pinning: *"The maximum number of platform threads available to the scheduler is limited, with a
default limit of 256 threads. If many virtual threads were to block inside a synchronized method
then no value of parallelism would help."* On Linux/AArch64 at the 2048 KB `-Xss` default, a
fully grown scheduler pool is on the order of half a gigabyte of reserved address space on its
own. That is a far better number than one megabyte per in-flight request, and it is not zero.

## Gotchas

**★ `-Djdk.tracePinnedThreads` does nothing on JDK 25.**
JEP 491 removed it outright: *"setting it on the command line will have no effect."* If your
pinning runbook starts with that flag, it has been quietly broken since JDK 24. Use the
`jdk.VirtualThreadPinned` JFR event.

**★ Advice to replace `synchronized` with `ReentrantLock` for virtual threads is stale on
JDK 24 and later.** JEP 491 says the migration *"will no longer be necessary"*. Blanket
refactors of `synchronized` in a JDK 25 codebase are churn with a real risk of introducing a
missing `unlock` in a `finally`.

**★ Pinning still exists — through native code and the FFM API.**
JEP 491 eliminated *"nearly all"* cases, not all of them. Native downcalls that call back into
blocking Java code still pin, and the JEP's Future Work section names class loading, class
initializers and waiting for another thread's class initialization as further cases.

**★ Deep call stacks make mounting and unmounting expensive.**
The frames are copied between the carrier's native stack and the heap chunk on every block and
resume. Cost is proportional to depth, so a framework stack 600 frames deep pays that copy on
every blocking call. Virtual threads are cheap to *create*; they are not free to *park*.

**★ Carriers are ordinary platform threads with ordinary `-Xss` reservations.**
The default carrier pool parallelism is the number of available processors and the pool's
maximum is 256 platform threads by default. Adopting virtual threads moves the native stack
term from "one per concurrent request" to "one per carrier"; it does not delete it.

**★ Thread-per-request plus `ThreadLocal` multiplies by the number of virtual threads.**
Each virtual thread has its own thread-local map. That is fine at a few thousand and expensive
at a million, and it is heap. `ScopedValue` exists partly for this reason — see
[Phase 6 · 12 · ThreadLocal and ScopedValue](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md).

**★ `jdk.virtualThreadScheduler.parallelism` defaults to the number of available processors — in
the container's view.** On a JDK that is container-aware, "available processors" is derived from
the cgroup CPU limit, so the same image gets a different carrier count in different deployments,
and therefore a different native stack footprint. Raising the CPU limit of a virtual-thread
service also raises its baseline memory.

**★ Growing the carrier pool is not a fix for pinning.**
JEP 491 rejects it explicitly: the pool has a default maximum of 256 platform threads and
*"If many virtual threads were to block inside a synchronized method then no value of parallelism
would help."* Every extra carrier is also another full `-Xss` reservation, so the workaround
costs native memory to buy time against a problem it cannot solve.

**★ Object.wait() used to pin twice over, and the fix is not backportable by configuration.**
JEP 491 describes the pre-JDK-24 behaviour: a virtual thread inside a synchronized method that
calls `Object.wait()` *"is pinned because it is executing inside a synchronized method, and
further pinned because its carrier is blocked in the JVM."* There is no flag that changes this on
JDK 21 or 23 — the only fix is the JDK 24+ implementation of `synchronized`. If you are stuck on
JDK 21, the old `ReentrantLock`/`Condition` migration advice is still the right advice *for that
runtime*.

**★ JVM TI `GetObjectMonitorUsage` no longer reports monitors owned by virtual threads.**
JEP 491's Dependencies section: the specification changed in Java 23 and the function *"no longer
supports returning information about monitors owned by virtual threads."* Profilers and
lock-analysis agents that relied on it will report incomplete ownership on a virtual-thread
service, which reads as "nobody holds this lock".

## Interview questions

**★ Someone hands you a 2023 blog post that says to replace `synchronized` with `ReentrantLock`
before adopting virtual threads. What do you tell them?**
That it was correct advice for JDK 21 and is stale for JDK 24 and later. JEP 491, delivered in
JDK 24, changed the JVM's implementation of `synchronized` so that a virtual thread can acquire,
hold and release monitors independently of its carrier, and the JEP says explicitly that the
migration *"will no longer be necessary"* and that already-migrated code need not be reverted.
For new code its recommendation is `synchronized` where practical and
`java.util.concurrent.locks` where more flexibility is needed. Pinning has not disappeared
entirely — native methods and FFM downcalls that call back into blocking Java code still pin —
but `synchronized` is no longer a reason to avoid it.

**★ How would you find remaining pinning on JDK 25?**
With the `jdk.VirtualThreadPinned` JFR event, which JEP 491 explicitly retained and enhanced to
report both the reason for the pinning and the identity of the carrier thread. Not with
`-Djdk.tracePinnedThreads`: that system property was removed by the same JEP and setting it now
has no effect, which makes it a silently broken step in a lot of runbooks.

**★ Virtual threads are cheap. Where does the cost actually reappear?**
Four places. The stack chunk is heap, so deep stacks cost `-Xmx` and add to the live set.
Mounting and unmounting copy frames between the carrier's native stack and the heap, at a cost
proportional to depth, paid on every block. Anything a parked virtual thread references in a
local variable is strongly reachable and cannot be collected. And the carriers themselves are
still platform threads with full `-Xss` reservations, with the scheduler's pool defaulting to a
maximum of 256 of them.

**★ What physically happens when a virtual thread blocks on I/O?**
The blocking operation is intercepted by the JDK rather than passed straight to the OS. The
virtual thread's live frames are copied off the carrier's native stack into its stack chunk
object on the heap, the carrier platform thread is released back to the scheduler's
`ForkJoinPool` and immediately picks up another virtual thread, and the original virtual thread
is resubmitted when the operation is ready to complete. On resumption the frames are copied back
onto a carrier — not necessarily the same one, because JEP 444 says the scheduler *"does not
maintain affinity between a virtual thread and any particular platform thread"*. The cost of that
round trip is proportional to how many frames had to move.

**★ Why is deep framework nesting worse for virtual threads than for platform threads?**
Because a platform thread that blocks leaves its frames exactly where they are — the OS
deschedules the thread and the stack is untouched — whereas a virtual thread that blocks has its
frames copied to the heap and copied back on resume. Depth is therefore free on a platform thread
and paid per-block on a virtual thread. A handler that blocks at depth 12 and one that blocks at
depth 600 behind a stack of interceptors, filters and proxies cost the same on platform threads
and very different amounts on virtual ones. It is also why JEP 444 emphasises that most virtual
threads *"have shallow call stacks"*.

**★ Is `synchronized` still a problem for virtual threads on JDK 25?**
No, and saying otherwise is the most common way to sound two releases out of date. JEP 491,
delivered in JDK 24, changed the JVM so that virtual threads *"can acquire, hold, and release
monitors, independently of their carriers"*: blocking to acquire a monitor unmounts the virtual
thread, and `Object.wait()` and its timed variants unmount it too. Pinning is not gone entirely —
native methods and Foreign Function & Memory downcalls that call back into blocking Java code
still pin, and JEP 491's Future Work names class loading, class initializers and waiting on
another thread's class initialization — but none of those are `synchronized`.

**★ What is the memory consequence of a virtual thread being pinned?**
Its frames stay on the carrier's native stack rather than being copied to the heap, and the
carrier is not returned to the pool. So pinning converts heap-resident stacks back into
native-resident ones and holds a platform thread hostage for the duration. If it happens widely,
the scheduler grows its pool towards its 256-thread maximum, and each of those carriers is a full
`-Xss` reservation. That is the memory-layout reason a pinning problem shows up as native
footprint growth rather than as heap growth.

{/* FOOTER */}
