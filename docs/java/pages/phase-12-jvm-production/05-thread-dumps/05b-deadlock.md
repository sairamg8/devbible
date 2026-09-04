---
title: "The JVM runs a deadlock detection algorithm after every thread dump and prints the whole cycle for you, which makes deadlock the one production failure where the tool hands you the answer — and the reason people still spend hours on it is that they never took the dump"
sidebar_label: "05b · Deadlock"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Troubleshoot Process Hangs
> and Loops → Diagnose a Hung Process → Deadlock Detected", from which the entire example output
> and the analysis quotation below are taken verbatim
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)).
> 🔴 **No sandbox** — the dump below is Oracle's published example, reproduced with attribution,
> not a captured run.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Deadlock is the failure this whole topic makes easy. The JVM does the analysis itself — the
Troubleshooting Guide: *"After printing the thread dump, the HotSpot VM executes a deadlock
detection algorithm"* — and prints the cycle, the threads, the monitors and the stacks. There is
no inference to perform. This page is how to read what it gives you, what it covers, and the far
more interesting question of what it cannot see.**

## What the JVM prints

The following is quoted verbatim from the JDK 25 Troubleshooting Guide:

> ```
> Found one Java-level deadlock:
> =============================
> "AWT-EventQueue-0":
>   waiting to lock monitor 0x000ffbf8 (object 0xf0c30560, a java.awt.Component$AWTTreeLock),
>   which is held by "main"
> "main":
>   waiting to lock monitor 0x000ffe38 (object 0xf0c41ec8, a java.util.Vector),
>   which is held by "AWT-EventQueue-0"
>
> Java stack information for the threads listed above:
> ===================================================
> "AWT-EventQueue-0":
>         at java.awt.Container.removeNotify(Container.java:2503)
>         - waiting to lock <0xf0c30560> (a java.awt.Component$AWTTreeLock)
>         at java.awt.Window$1DisposeAction.run(Window.java:604)
>         ...
>         - locked <0xf0c41ec8> (a java.util.Vector)
>         ...
> "main":
>         at java.awt.Window.getOwnedWindows(Window.java:844)
>         - waiting to lock <0xf0c41ec8> (a java.util.Vector)
>         ...
>         - locked <0xf0c30560> (a java.awt.Component$AWTTreeLock)
>         ...
>
> Found 1 deadlock.
> ```

And the guide's own reading of it:

> *"the thread `main` is locking object `0xf0c30560` and is waiting to enter `0xf0c41ec8`, which
> is locked by thread `AWT-EventQueue-0`. However, thread `AWT-EventQueue-0` is waiting to enter
> `0xf0c30560`, which is locked by `main`."*

## Reading it in three steps

**1 · The summary block names the cycle.** Each entry is one thread, the monitor it wants, and —
crucially — `which is held by "<other thread>"`. The JVM has already done the matching that
[05](05-locks-in-a-dump.md) teaches you to do by hand. Follow the `held by` chain and it closes on
itself; that closure is the deadlock.

**2 · The stacks tell you where in your code.** The summary gives the *what*; the stack section
gives the *where*. For each thread, find its `- locked` line and its `- waiting to lock` line —
those two frames are the two acquisitions, in the order that thread performed them.

**3 · The lock order is the bug.** Read the acquisition order of each thread:

- Thread A: locked X, then wants Y.
- Thread B: locked Y, then wants X.

**That inconsistency *is* the defect.** The fix is almost never to remove a lock; it is to make
every path acquire them in the same global order. In the example, one thread takes the
`AWTTreeLock` then the `Vector`, and the other takes them in the opposite order.

## Deadlock detection covers both lock families

The guide states it explicitly:

> *"The default deadlock detection works with locks that are obtained using the synchronized
> keyword, as well as with locks that are obtained using the `java.util.concurrent` package."*

🔴 **This is worth knowing precisely because `Thread.print` does not print `j.u.c.` ownership
without `-l`** ([05](05-locks-in-a-dump.md)). The *detection* is not limited by the *printing*
option — so a `ReentrantLock` deadlock is reported even in a dump that would not otherwise have
shown you who held what. Take the dump with `-l` anyway, so you can read the surrounding
contention, but do not assume a missing flag suppressed the detection.

The guide also notes that with `-XX:+PrintConcurrentLocks` set, *"the stack trace also shows a
list of lock owners"* — the startup-flag route to the same information.

## What detection cannot see

The algorithm finds cycles in lock ownership. Anything that hangs without forming such a cycle is
invisible to it, and these are the cases that consume the hours:

**A wait that is never notified.** The guide's own "Deadlock Not Detected" section: *"the issue
might be a bug in which a thread is waiting for a monitor that is never notified. This could be a
timing issue or a general logic bug."* No cycle exists — one thread is waiting and no thread is
holding anything. Its advice is to examine each thread blocked in `Object.wait()` and read the
caller frame, which *"indicates the class and method that is invoking the `wait()` method"*.

**Resource deadlock through a pool.** Thread A holds connection 1 and waits for connection 2;
thread B holds 2 and waits for 1; the pool has two connections. That is a genuine deadlock in
every meaningful sense, and the JVM sees only threads parked in a pool
([06b](06b-the-connection-pool-in-a-dump.md)) — the "locks" are pool permits, not monitors.

**A distributed deadlock.** Service A waits on a call to B, which waits on a call back to A. Each
JVM's detector sees only threads in a socket read ([04b](04b-runnable-does-not-mean-running.md)).
No single JVM has the whole cycle.

**A lock ordering problem that has not deadlocked yet.** Detection reports what *is*, not what
*could be*. A codebase with inconsistent lock ordering is a deadlock waiting for the right
interleaving, and no dump will report it until the day it happens.

🔴 **So "the JVM found no deadlock" means "no monitor or `j.u.c.` ownership cycle exists right
now"** — a much narrower statement than "the service is not deadlocked". Every case above hangs
exactly like a deadlock and produces no `Found one Java-level deadlock` line.

## Fixing it

**Impose a global lock order.** Every code path that takes both locks takes them in the same
sequence. This is the real fix and it is a design constraint, not a code change in one place — it
has to be documented and maintained, because the next person to add a path can reintroduce the
bug.

**Reduce the number of locks held at once.** A path that only ever holds one lock cannot
participate in a cycle. Often the second lock is protecting something that could be copied,
computed before the lock, or published after it.

**Use `tryLock` with a timeout** where a global order genuinely cannot be established.
`ReentrantLock.tryLock(timeout, unit)` converts a permanent deadlock into a failed operation you
can retry or report. ⚠️ This is a mitigation, not a fix — it makes the failure recoverable and
visible rather than making it impossible, and it introduces livelock risk if every thread just
retries immediately ([05c](05c-livelock-and-lock-convoys.md)).

**Do not hold a lock across a call you do not control.** Callbacks, listeners and remote calls
inside a lock are how one team's lock ends up interleaved with another team's, which is how
orders become inconsistent without anybody writing an obviously wrong line.

## Gotchas

**★ The JVM runs deadlock detection after every dump, for free.**
*"After printing the thread dump, the HotSpot VM executes a deadlock detection algorithm."* If a
monitor cycle exists it is named, with the threads, the monitors and the stacks. Nobody needs to
reason it out — and yet the common failure is never having taken the dump.

**★ "No deadlock found" is much narrower than "not deadlocked".**
It means no ownership cycle in monitors or `j.u.c.` locks at that instant. Missed notifications,
pool-permit deadlocks and distributed deadlocks all hang identically and are all invisible to it.

**★ Detection covers `java.util.concurrent`, but printing ownership does not.**
The guide says detection works for both lock families. `Thread.print` needs `-l` to *show*
`j.u.c.` ownership. So a `ReentrantLock` deadlock can be reported in a dump that otherwise shows
you nothing about who holds what.

**★ The bug is the acquisition order, not either lock.**
Each thread's `- locked` and `- waiting to lock` lines give the order it used. The defect is that
two paths disagree. The fix is a consistent global order, not removing a lock.

**★ A deadlock is permanent, so one dump is proof.**
Unlike almost everything else in this topic, no second dump is needed to confirm it. Take three
anyway — you did not know it was a deadlock before you looked.

**★ Two threads is the textbook case; more is common.**
The `Found one Java-level deadlock` block lists however many threads are in the cycle, and
`Found N deadlocks` can report several independent cycles. A three-way cycle reads the same way:
follow `held by` until it closes.

**★ A pool-permit deadlock is real and undetectable.**
Two threads each holding one connection and waiting for a second, from a pool of two, is deadlock
in every practical sense. The JVM sees threads parked in a pool and reports nothing.

**★ `tryLock` with a timeout is a mitigation, not a fix.**
It converts a permanent hang into a recoverable failure, which is genuinely valuable, but the
inconsistent lock order is still there. Left alone, it becomes contention and possibly livelock.

**★ Detection cannot warn you about a deadlock that has not happened.**
Inconsistent lock ordering is latent until the right interleaving occurs, often under production
load and not under test. Absence from every dump you have ever taken is not evidence of
correctness.

**★ Holding a lock across a call you do not control is how orders become inconsistent.**
Callbacks, listeners and remote calls inside a lock let unrelated code acquire locks in an order
nobody designed. It rarely looks wrong at the call site.

## Interview questions

**★ How do you detect a deadlock in a running Java application?**
Take a thread dump. The JVM runs its own deadlock detection afterwards and prints a
`Found one Java-level deadlock` section naming each thread in the cycle, the monitor it wants and
which thread holds it, followed by the stacks. There is no manual inference required, and it works
for both `synchronized` monitors and `java.util.concurrent` locks.

**★ You have the deadlock output. What do you actually change?**
Read each thread's `- locked` and `- waiting to lock` frames to recover the order in which it
acquired locks. The defect is that the two paths acquire in opposite orders. The fix is a
consistent global ordering for those locks across every path, or restructuring so no path holds
both at once. Removing a lock is almost never the right answer, because the locks are protecting
something.

**★ The dump says no deadlock, but the service is definitely hung. What could it be?**
Several things detection cannot see. A thread waiting on a monitor that is never notified — no
ownership cycle exists, so nothing to detect. A resource deadlock through a pool, where two
threads each hold one connection and need a second from a pool of two; the JVM sees parked threads,
not locks. Or a distributed deadlock across services, where each JVM sees only a socket read. All
three hang exactly like a deadlock.

**★ Does deadlock detection work for `ReentrantLock`?**
Yes — the Troubleshooting Guide says detection covers locks obtained with `synchronized` and with
the `java.util.concurrent` package. What differs is *display*: `Thread.print` shows `j.u.c.`
ownership only with `-l`, so a dump can report a `ReentrantLock` deadlock while showing you no
ownership information anywhere else in the file.

**★ Would you use `tryLock` with a timeout to solve a deadlock?**
As a mitigation, yes; as the fix, no. It converts a permanent hang into a failed operation that
can be logged, retried or surfaced, which is a real improvement in availability. But the
inconsistent lock ordering that caused it is still present, now manifesting as contention and
failed operations — and if every thread retries immediately you can trade deadlock for livelock.
The durable fix is the consistent ordering.

**★ Why is one dump enough for a deadlock when three are needed for everything else?**
Because a deadlock is permanent by definition — the cycle cannot resolve itself, so it will be in
every dump you take. For every other condition, a single dump cannot distinguish stuck from
transient. In practice you still take three, because you do not know which case you are in until
you have read the first one.

**★ Your team's codebase has locks acquired in inconsistent orders but has never deadlocked. Is
that a problem?**
Yes, and it is a particularly dangerous one, because detection reports what is rather than what
could be. The deadlock is latent and will surface under the right interleaving — typically under
production load, typically not under test, and typically at the worst time. Absence from every
dump ever taken is not evidence of correctness; a documented lock ordering is.

{/* FOOTER */}
