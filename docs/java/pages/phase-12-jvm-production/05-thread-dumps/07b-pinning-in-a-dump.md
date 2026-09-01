---
title: "Every runbook for diagnosing virtual-thread pinning tells you to set `jdk.tracePinnedThreads` — a system property that JEP 491 removed, so setting it on the command line now has no effect and produces no output, silently"
sidebar_label: "07b · Pinning in a dump"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 491 "Synchronize Virtual Threads without Pinning"**
> (Release 24, `Closed/Delivered`), from which every quotation below is taken
> ([openjdk.org](https://openjdk.org/jeps/491)), **JEP 444 "Virtual Threads"** for the carrier
> pool limit ([openjdk.org](https://openjdk.org/jeps/444)), and the **JDK 25 `jcmd` tool
> reference** for `Thread.vthread_scheduler` and `Thread.print`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)).
> 🔴 **No sandbox** — no dump fragment below is a captured run.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Pinning is what happens when a virtual thread cannot be unmounted from its carrier while it
blocks, so a platform thread is consumed for the duration — reintroducing exactly the scarcity
virtual threads were adopted to remove. On JDK 25 both the causes and the tooling have changed
substantially from the JDK 21 accounts still in circulation, and the change to the tooling is
silent: the diagnostic property everybody names no longer exists.**

## 🔴 `jdk.tracePinnedThreads` was removed

JEP 491, verbatim:

> *"We will therefore remove this system property; setting it on the command line will have no
> effect"*

**This is the single most important operational fact on the page.** A runbook that says "restart
with `-Djdk.tracePinnedThreads=full` and read the output" now produces **no output and no error**.
The JVM accepts the property — it is a system property, not an `-XX:` flag, so it does not fail
the launch the way an unrecognised VM option would ([04b](../01-memory-layout/04b-the-metaspace-flags.md)
covers that distinction) — and simply ignores it.

The result is worse than having no tool: you have a procedure that runs, completes, and produces
silence, which reads as "no pinning found".

⚠️ **A second removal in the same area:** JEP 491 also records that **JVM TI's
`GetObjectMonitorUsage` no longer reports monitors owned by virtual threads** (a specification
change in Java 23). Profilers and agents that relied on it to attribute monitor ownership will not
see virtual threads either.

## Why most of the reason for pinning is gone

The JDK 21 story was that a virtual thread blocking inside a `synchronized` block or method could
not be unmounted, so `synchronized` was the main cause of pinning and the standard advice was to
migrate to `ReentrantLock`.

**JEP 491 changed that, in Release 24.** Verbatim:

> *"This will eliminate nearly all cases of virtual threads being pinned."*

and, explicitly retiring the old advice:

> *"We previously recommended solving frequent and long-lived pinning problems by migrating code
> from using `synchronized` to using `ReentrantLock`. Once the `synchronized` keyword no longer
> pins virtual threads, such migration will no longer be necessary."*

🔴 **So on JDK 25, `synchronized` is no longer a pinning cause**, and the most widely repeated
piece of virtual-thread advice in existence — "replace `synchronized` with `ReentrantLock`" — is
obsolete. Migrating for that reason now buys nothing and costs a refactor.

**What still pins on JDK 25**, per the JEP's own remaining cases:

- **Native frames and FFM downcalls** that call back into blocking Java code. A virtual thread
  cannot be unmounted while native frames are on its stack.
- **The class-loading and initialization cases** listed in the JEP's Future Work.

Both are far narrower than `synchronized` ever was, which is why pinning went from a routine
concern to an occasional one.

## What it looks like without the removed property

You are left with the dump and the scheduler view. Three signals, in order of directness:

**1 · The carrier pool is fully occupied while work is not progressing.**

```bash
jcmd <pid> Thread.vthread_scheduler
```

Rated *"Impact: Low"*. It prints the scheduler, so you can see the carrier pool's parallelism and
its queue. **From JEP 444, the default ceiling is meaningful:**

> *"The maximum number of platform threads available to the scheduler is limited, with a default
> limit of 256 threads."*

⚠️ Note that the *default parallelism* is the number of available processors; 256 is the maximum
the scheduler may grow to. Either way, the number is small and finite — which is exactly why
pinning matters: a few hundred pinned carriers is a hard ceiling on a service that believed it had
none.

**2 · Carriers in `Thread.print` stuck in native frames.**

[07](07-virtual-threads.md) established that `Thread.print` shows the carriers rather than the
application's virtual threads. That limitation becomes useful here — the carriers are precisely
what pinning consumes:

```text
"ForkJoinPool-1-worker-3" ... 
   java.lang.Thread.State: RUNNABLE
        at <native frame>
        ...
        at com.example.LegacyNativeBridge.call(LegacyNativeBridge.java:88)
```

*(Schematic.)*

**A carrier that is not free, across three dumps, with native frames on the stack** is the
signature. The same three-dump discipline from [02b](02b-take-three-of-them.md) applies.

**3 · The symptom, from the application's own metrics.** Throughput capped at a number
suspiciously close to the carrier count, while request concurrency is far higher. That is the
shape of a hidden ceiling, and pinning is one of the few things that produces it in a
virtual-thread service.

## Why it matters more than it sounds

Pinning is not a slowdown. **It converts an unbounded resource back into a bounded one, without
anybody having chosen the bound.**

A service designed around virtual threads has no request pool, no configured maximum, and no
bulkhead where the pool used to be ([07](07-virtual-threads.md)). If enough virtual threads pin,
the carrier pool becomes the limit — and it is a limit nobody sized, nobody monitors, and nobody
documented. The service behaves as though it has a thread pool of a few hundred that appears only
under specific conditions.

🔴 **That is the worst kind of capacity limit: invisible, undocumented, and load-dependent.**

## What to do about it

1. **Check the JDK version first.** If it is 24 or later, `synchronized` is not the cause and the
   `ReentrantLock` migration is not the fix. If it is 21–23, the old advice still applies and the
   removed property still exists there — this page's warning is specifically about 24+.
2. **Look for native and FFM code**, which is what remains. A JNI bridge or an FFM downcall that
   calls back into blocking Java is the modern cause.
3. **Watch the carrier pool** with `Thread.vthread_scheduler` rather than reaching for a property
   that no longer exists.
4. **Bound the dependency explicitly.** Whether or not pinning is occurring, a virtual-thread
   service needs deliberate limits, because it has none by default. A semaphore around each
   dependency is the replacement for what the thread pool used to do by accident.

## Gotchas

**★ `jdk.tracePinnedThreads` was removed and fails silently.**
JEP 491: *"We will therefore remove this system property; setting it on the command line will have
no effect."* It is a system property, so it does not fail the launch — the procedure runs,
produces nothing, and reads as "no pinning found".

**★ "Replace `synchronized` with `ReentrantLock`" is obsolete advice on JDK 24+.**
JEP 491 eliminated *"nearly all cases of virtual threads being pinned"* and says the migration
*"will no longer be necessary"*. It is still the most repeated virtual-thread recommendation in
circulation, and following it now costs a refactor and buys nothing.

**★ Pinning advice is version-specific in a way most articles do not state.**
On 21–23 the old story holds. On 24+ both the main cause and the diagnostic tool are gone. An
article that does not name its JDK version is unusable on this subject.

**★ Native frames and FFM downcalls are what still pins.**
A virtual thread cannot unmount while native frames are on its stack. Plus the class-loading and
initialization cases in JEP 491's Future Work. Both are far narrower than `synchronized` was.

**★ JVM TI's `GetObjectMonitorUsage` no longer reports monitors owned by virtual threads.**
A specification change in Java 23. Profilers and agents that used it to attribute monitor
ownership are blind to virtual threads, which affects tooling beyond the removed property.

**★ Pinning reinstates a bound nobody chose.**
A virtual-thread service has no request pool and no configured maximum. Pinned carriers become a
hard ceiling that is undocumented, unmonitored and appears only under specific load — the worst
kind of capacity limit.

**★ The carrier limit is small and finite.**
JEP 444 gives a default maximum of 256 platform threads for the scheduler, with default
parallelism at the processor count. Either number is tiny next to the concurrency a
virtual-thread service assumes it has.

**★ `Thread.print`'s limitation becomes an advantage here.**
It shows the carriers, which is exactly what pinning consumes. For once, the command that misses
the application's threads is showing you the right ones.

**★ Throughput capped near the carrier count is the symptom to watch for.**
High request concurrency with throughput plateauing at a few hundred is the shape of a hidden
ceiling. In a virtual-thread service, pinning is one of the few things that produces it.

**★ Bound your dependencies whether or not you are pinning.**
Virtual threads removed the accidental bulkhead the thread pool provided. Explicit semaphores are
required regardless, and their absence is a design gap rather than a pinning symptom.

## Interview questions

**★ What is pinning, and why does it matter?**
A virtual thread that cannot be unmounted from its carrier while it blocks, so a platform thread is
consumed for the duration. It matters because it silently reinstates a bound the service was
designed without: with no request pool and no configured maximum, the carrier pool — default
parallelism at processor count, maximum 256 — becomes an undocumented, unmonitored capacity
ceiling that only appears under certain conditions.

**★ How do you diagnose pinning on JDK 25?**
Not with `jdk.tracePinnedThreads` — JEP 491 removed it, and because it is a system property rather
than a VM option, setting it produces no output and no error. Instead: `jcmd Thread.vthread_scheduler`
to see the carrier pool's state, `Thread.print` across three dumps to look for carriers stuck with
native frames on the stack, and the application's own metrics for throughput plateauing near the
carrier count.

**★ Should you migrate `synchronized` blocks to `ReentrantLock` for virtual threads?**
On JDK 24 or later, no. JEP 491 eliminated *"nearly all cases of virtual threads being pinned"* and
states that the migration *"will no longer be necessary"*. On 21 to 23 the advice still holds. This
is the most widely repeated virtual-thread recommendation in existence and it is now version-
specific, so the first question about any pinning advice is which JDK it was written for.

**★ What still causes pinning on JDK 25?**
Native frames — a virtual thread cannot unmount while they are on its stack — including FFM
downcalls that call back into blocking Java, plus the class-loading and initialization cases JEP
491 lists under Future Work. Both are much narrower than `synchronized` was, which is why pinning
moved from a routine design concern to an occasional diagnosis.

**★ Your virtual-thread service's throughput plateaus at about 200 requests per second while
thousands are in flight. What do you suspect?**
A hidden ceiling, and pinning is a leading candidate since 200 is suspiciously close to a carrier
pool bound. I would run `jcmd Thread.vthread_scheduler` to look at the scheduler's state, then take
three `Thread.print` dumps and look for carriers occupied across all three with native frames on
their stacks. If it is not pinning, the next candidate is a downstream bound — a connection pool or
a semaphore — since virtual threads move the constraint rather than removing it.

**★ Why is the removal of `jdk.tracePinnedThreads` worse than if the property had never existed?**
Because the procedure still appears to work. The property is accepted and ignored, so a runbook
step runs to completion and produces nothing, which a person under incident pressure reads as
evidence of absence rather than absence of evidence. A flag that failed the launch would at least
announce itself; a silently ignored property produces false confidence.

**★ If pinning is nearly eliminated on JDK 25, is it still worth understanding?**
Yes, for two reasons. The remaining causes — native and FFM code — are exactly the kind found in
older integrations, which are also the systems most likely to be adopting virtual threads late.
And the broader lesson survives the specific bug: a virtual-thread service has no accidental
bulkhead, so any mechanism that bounds carriers becomes a capacity limit nobody chose. That is a
design consideration whether or not pinning is the mechanism that day.

{/* FOOTER */}
