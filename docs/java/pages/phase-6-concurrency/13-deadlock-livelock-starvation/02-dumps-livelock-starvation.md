---
title: "Reading the dump; livelock and starvation"
sidebar_label: "2 · Dumps, livelock, starvation"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Thread.State` and
> `ThreadMXBean.findDeadlockedThreads`, the JDK Troubleshooting Guide
> (jstack, `jcmd Thread.print`, `jcmd Thread.dump_to_file`), and the
> Oracle concurrency tutorial's liveness pages.

**A thread dump is a stack trace per thread plus each thread's state and
the monitors it holds or wants — everything a deadlock diagnosis needs,
captured in one command. The skill is knowing which two states matter
(`BLOCKED`: wants a monitor someone holds; `WAITING`: parked until
signalled), and that for monitor cycles the JVM does the analysis for you,
printing the deadlocked threads by name. Livelock and starvation never
appear in that summary — for those, the dump shows *busy* or *runnable*
threads, and the evidence is that nothing downstream ever finishes.**

## Taking the dump

```bash
jcmd <pid> Thread.print          # platform threads, with lock info
jstack <pid>                     # the older equivalent
kill -3 <pid>                    # to stdout, no tools needed (Unix)

jcmd <pid> Thread.dump_to_file -format=json dump.json   # includes VIRTUAL threads
```

The first three list **platform threads only** — a virtual-thread service
can look almost idle in `jstack` while a million virtual threads wait.
`Thread.dump_to_file` (JDK 21+) captures virtual threads too, grouped by
their scope. Take **two or three dumps ~10 s apart**: deadlocked threads
are identical across dumps; merely busy ones move.

## The two states that matter

| `Thread.State` | Means | Typical frame |
|---|---|---|
| `BLOCKED` | wants an **intrinsic monitor** another thread owns | entering a `synchronized` block |
| `WAITING` / `TIMED_WAITING` | parked until **signalled** (or timeout) | `Object.wait`, `LockSupport.park`, `Future.get`, pool `await` |

The distinction carries the diagnosis: `BLOCKED` always names a *lock*
problem, and the dump prints which monitor is wanted and who holds it.
`WAITING` names a *coordination* problem — the thread is waiting for an
event that (in a hang) never comes, and you must find the party that was
supposed to produce it. `ReentrantLock` waiters show as `WAITING` (they
park), not `BLOCKED` — only intrinsic monitors produce `BLOCKED`
([topic 04](../04-synchronized-intrinsic-locks/01-the-monitor.md); state
definitions: [topic 01](../01-threads-lifecycle-interrupt/01-lifecycle-start-daemons.md)).

## The JVM finds monitor cycles for you

At the bottom of a dump containing a monitor deadlock, the JVM prints a
section shaped like this — a *schematic*, placeholder names, per this
corpus's no-fabricated-output rule ([the convention](../../phase-5-exceptions/05-reading-stack-traces/01-anatomy-and-the-scan.md)):

```text
Found one Java-level deadlock:
=============================
"transfer-worker-1":
  waiting to lock monitor <id> (object <addr>, a com.shop.Account$Lock),
  which is held by "transfer-worker-2"
"transfer-worker-2":
  waiting to lock monitor <id> (object <addr>, a com.shop.Account$Lock),
  which is held by "transfer-worker-1"

Java stack information for the threads listed above: …
```

Read it as a sentence: who waits, for what, held by whom — the cycle is
spelled out, and the stacks that follow show the acquisition path each
thread took (compare them against your intended lock order; the inversion
is usually visible in two frames). The same analysis is available in-process:

```java
long[] ids = ManagementFactory.getThreadMXBean().findDeadlockedThreads();
// non-null → deadlock; getThreadInfo(ids, true, true) names locks and owners
```

`findDeadlockedThreads` covers monitors **and** j.u.c ownable
synchronizers (`ReentrantLock`); it's what APM agents call on a schedule.
What *no* detector covers: cycles through pools, `Future.get`, semaphores
— resource waits with no registered owner
([chunk 1](01-deadlock-and-lock-ordering.md)). Those you reconstruct by
hand from `WAITING` frames.

## Livelock: busy, polite, stuck

Livelock is deadlock's inverse presentation: states say `RUNNABLE`, CPU
burns, progress is zero — threads *respond* to each other forever.
The canonical shapes:

- **Mutual retry.** Two transactions detect conflict, both roll back, both
  retry on the same schedule, collide again — indefinitely.
- **Corridor politeness.** Each thread yields on seeing the other's
  claim, then both re-claim simultaneously.
- **Retry loops without backoff** around `tryLock` or optimistic
  operations — the escape hatch from deadlock, misused, becomes livelock.

The fix is asymmetry: **randomized, exponential backoff** before retry
(each colliding party waits a different, growing time), or an ordering
that lets one side win deterministically. In dumps, suspect livelock when
the same retry frames appear in every sample but counters don't move.

## Starvation: progress for some

Starvation is a fairness failure — some threads make progress while
others wait indefinitely:

- **Greedy lock traffic.** A hot, frequently re-acquired lock can be
  re-taken by recent releasers before a long-parked thread wins it;
  intrinsic monitors make **no fairness guarantee** at all.
- **Read-heavy `ReadWriteLock`** — a stream of readers can starve writers
  (policy-dependent; [topic 09](../09-explicit-locks.md)).
- **Priority myths.** `Thread.setPriority` is a *hint* mapped
  platform-dependently — often ignored entirely; designs that rely on
  priorities for correctness starve on some OS/JVM combinations and are
  wrong on all of them. (Virtual threads: priority is fixed at
  `NORM_PRIORITY`; `setPriority` is a no-op.)
- **Tiny pools + unfair queues** — one slow tenant's tasks monopolize the
  workers ([sizing](../06-executorservice-pools/03-scheduling-and-sizing.md)).

Fixes are structural: fair-mode explicit locks where fairness is a
requirement (paying their throughput cost knowingly), bounded work per
holder, per-tenant pools or semaphores. Starvation in a dump is
undramatic — the victim is just `WAITING`/`BLOCKED` in every sample while
siblings churn; you need timestamps (how long parked) more than stacks,
which is what `ThreadInfo.getWaitedTime`/JFR thread-park events add.

## Gotchas

**Symptom:** "the service is hung" but the dump shows every thread `RUNNABLE`
**Cause:** not a deadlock — livelock or a spin; states are healthy, progress isn't
**Fix:** diff two dumps 10 s apart: identical retry frames + non-advancing application counters = livelock; add randomized backoff to the colliding retry

**Symptom:** deadlock suspected, but `jstack` shows a handful of idle platform threads
**Cause:** the waiting threads are virtual — invisible to classic dump commands
**Fix:** `jcmd <pid> Thread.dump_to_file -format=json` and search it for your task names / `java.lang.VirtualThread` entries

**Symptom:** thousands of threads `WAITING` in pool `await`, "no Java-level deadlock found", traffic at zero
**Cause:** resource cycle (pool ↔ pool, or thread-starvation deadlock) — no monitor ownership for the detector to walk
**Fix:** group `WAITING` threads by awaited resource from their frames; find who holds each resource and what *they* await; the cycle is manual but mechanical

**Symptom:** writer thread starves for minutes on a read-mostly cache lock
**Cause:** reader-preferring lock policy under continuous read traffic
**Fix:** fair mode / writer-preference where supported, or restructure to immutable snapshot + `volatile` swap ([the cures](../03-race-conditions/03-the-cures.md)) so writers never queue behind readers

**Symptom:** raising a background job's thread priority "fixed" starvation in staging, production unchanged
**Cause:** priorities are platform-mapped hints — different OS, different (non-)effect
**Fix:** remove the priority dependence; give the job its own executor or a semaphore-reserved permit — capacity, not priority, guarantees progress

**Symptom:** monitoring pages "deadlock detected" but the app looks fine
**Cause:** APM calls `findDeadlockedThreads`, which also flags cycles among *ownable synchronizers* — e.g. two rarely-used admin paths deadlocked while user traffic flows
**Fix:** it's real — a partial deadlock; capture `getThreadInfo` for the ids, fix the ordering; "the app looks fine" just means the frozen paths aren't hot yet

**Symptom:** dump taken with `kill -3` shows nothing in the log pipeline
**Cause:** the JVM writes it to *stdout*, which containers often route elsewhere (or drop)
**Fix:** use `jcmd` into a file; in containers, know where stdout lands *before* the incident

## Interview questions

**★ `BLOCKED` vs `WAITING` — what does each mean and what does each tell you in a hang?**
`BLOCKED`: trying to enter a `synchronized` region whose monitor another
thread owns — a lock problem; the dump names the monitor and owner, so
you can walk the ownership chain. `WAITING`: parked
(`wait`/`park`/`join`) until another thread signals — a coordination
problem; nothing is "held", so you must identify the missing signaller.
`ReentrantLock` contention appears as `WAITING` (it parks), which
surprises people expecting `BLOCKED`.

**★ How does the JVM's deadlock detector work, and name a deadlock it cannot see.**
On demand (dump time, or `ThreadMXBean.findDeadlockedThreads`) it builds
the waits-for graph over intrinsic monitors and ownable synchronizers —
resources with a registered owning thread — and reports cycles with
threads, locks and stacks. It cannot see waits with no owner: bounded-pool
acquisition, `Future.get` on a task that will never run
(thread-starvation deadlock), semaphore permits, or any cycle crossing
process boundaries (JVM ↔ database).

**★ Why take several dumps rather than one?**
One dump is a photo; a hang diagnosis needs to know what *isn't moving*.
Deadlocked/starved threads are byte-identical across dumps; busy threads
show different frames; livelocked threads show the same retry frames while
being `RUNNABLE`. The diff — not any single dump — separates the three.

**★ How do you get a useful dump from a virtual-thread service, and what's missing from the classic one?**
Classic `jstack`/`Thread.print` lists platform threads only — carriers
and pinned cases, not the million parked virtual threads where the actual
work is stuck. `jcmd <pid> Thread.dump_to_file` (plain or JSON) includes
virtual threads with their stacks. JFR events fill the timing side.

**★ Distinguish livelock from deadlock from starvation by their dump signatures.**
Deadlock: threads frozen `BLOCKED`/`WAITING`, identical across samples,
detector may name the cycle. Livelock: `RUNNABLE`, CPU busy, same
collision/retry frames every sample, zero progress. Starvation: *some*
threads progress normally while specific others stay parked/blocked across
all samples — a fairness asymmetry, not a freeze.

**★ Your retry-on-conflict code eliminated a deadlock but CPU now spikes with no throughput under contention. What happened and what's the fix?**
`tryLock`-and-retry removed hold-and-wait but every contender retries in
lockstep — livelock. Add randomized exponential backoff (jitter breaks
the symmetry), cap retries with a real failure path, and consider a
deterministic winner (ordering) so someone always progresses.

---

← Prev: [Deadlock and lock ordering](01-deadlock-and-lock-ordering.md) · Index: [Deadlock, livelock, starvation](README.md) · Next → [Virtual-thread pinning](../14-virtual-thread-pinning.md)
