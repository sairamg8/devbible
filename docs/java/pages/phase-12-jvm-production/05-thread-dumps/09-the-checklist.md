---
title: "From \"it is hung\" to a named cause in eight questions, in the order that eliminates the most possibilities per step — and with the three commands to run before you do anything else, because a restart destroys every piece of evidence this topic depends on"
sidebar_label: "09 · The checklist"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 Troubleshooting Guide**, "Troubleshoot Process Hangs
> and Loops"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)),
> the **JDK 25 `jcmd` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> the **JDK 25 `jstack` tool reference** (*"This command is experimental and unsupported"*)
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jstack.html)),
> and the **`java.lang.Thread.State` API documentation**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.State.html)).
> 🔴 **No sandbox** — this page prescribes commands; it does not report their output.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**This is the page to open during the incident. Everything above it is the reasoning; this is the
order. It is arranged so each step eliminates as much as possible — CPU splits the problem in
half, the deadlock section is free, and the count of threads sharing a frame answers most cases
before anyone reads a stack.**

## 🔴 Step 0 — before anything else

```bash
for i in 1 2 3; do jcmd <pid> Thread.print -l > dump-$i.txt; sleep 5; done
```

**Three dumps, `-l`, to files, copied off the host.** Fifteen seconds, and it is unrecoverable if
skipped, because the pressure to restart during an incident is enormous and a restart destroys
every piece of evidence in this topic.

⚠️ **If the service uses virtual threads**, use `Thread.dump_to_file -format=json` instead —
`Thread.print` will silently omit the application's threads ([07](07-virtual-threads.md)).
⚠️ **If `jcmd` is not in the image or does not return**, fall back to `kill -QUIT <pid>` and read
the container log, or escalate to `jhsdb jstack --pid <pid>` ([02](02-taking-one.md)).

## The eight questions

### 1 · Is CPU idle or pinned?

**Idle** → a hang; continue down this list, the dump likely contains the answer.
**Pinned** → a loop; three dumps will identify the thread, then hand off to a profiler
([08](08-what-a-dump-cannot-tell-you.md)).

This single check splits the problem in half and costs nothing. The Troubleshooting Guide keeps
the two procedures separate for exactly this reason.

### 2 · Did the JVM report a deadlock?

```bash
grep -A40 "Found one Java-level deadlock" dump-1.txt
```

The JVM runs detection after every dump. If the section is present, the cycle, the monitors and
the stacks are all there — read each thread's `- locked` and `- waiting to lock` frames to recover
the acquisition orders, and the inconsistency between them is the bug ([05b](05b-deadlock.md)).

🔴 **If absent, that means no ownership cycle exists right now** — not that the service is not
deadlocked. Pool-permit deadlocks, missed notifications and distributed deadlocks all produce
nothing here.

### 3 · What is the distribution?

Group threads by name prefix, then by top frame, and count. Do not read thread blocks yet.

**Compare each count against that pool's configured maximum.** N threads sharing a prefix and a
frame, where N is the limit, is saturation ([06](06-pool-exhaustion.md)) — and it is the most
common answer in this topic.

⚠️ Have the maximums to hand: `server.tomcat.threads.max`, executor `maximumPoolSize`, the
connection pool's `maximumPoolSize`, HTTP client connection limits.

### 4 · Are the same threads in the same frames across all three dumps?

Match by name and id, not by position.

**Same** → stuck. These are your candidates.
**Different** → working. Not your problem, whatever their state says.

This is the step that makes every state reading meaningful, and it is why step 0 takes three dumps
([02b](02b-take-three-of-them.md)).

### 5 · What are the stuck threads waiting for?

Read the top frames of the stuck group only:

| Top frames | Means | Go to |
|---|---|---|
| Native socket read, `RUNNABLE` | A remote dependency — 🔴 **and a missing read timeout** | [04b](04b-runnable-does-not-mean-running.md) |
| `ConcurrentBag.borrow` / `HikariPool.getConnection` | No database connection free | [06b](06b-the-connection-pool-in-a-dump.md) |
| `- waiting to lock`, `BLOCKED` | A monitor someone holds | step 6 |
| `LockSupport.park` under a queue `take()` | ⚠️ Usually idle workers, not a problem | — |
| `Object.wait()`, no timeout | A notification that never came | [05](05-locks-in-a-dump.md) |
| Application code, unchanged, CPU busy | A loop | a profiler |

### 6 · If threads are blocked, who holds the lock?

Take the hex identity from `- waiting to lock <0x…>` and find the same identity annotated
`- locked` elsewhere in the **same** dump. **Read the holder's stack — that is where the bug is**,
and it is nearly always I/O or an unexpectedly slow operation inside the lock
([05](05-locks-in-a-dump.md)).

🔴 **If you see no `BLOCKED` threads at all, check that you used `-l`.** Without it,
`java.util.concurrent` lock ownership is invisible and severe contention looks like idle threads.

### 7 · Follow the exhaustion inward

Pools chain. If the request pool is saturated waiting on the connection pool, which is saturated
waiting on the database, **the outermost pool's exhaustion is true and useless**. Keep following
the frames until you reach the pool whose holders are waiting on something outside the JVM
([06](06-pool-exhaustion.md)).

### 8 · If nothing looks thread-shaped, leave

Four exits, and taking one promptly is a skill:

- **`VMThread` stuck in `SafepointSynchronize::begin`** → a safepoint problem, not an application
  one. More application dumps will not help.
- **Dumps look healthy** → check the GC log; a long pause presents as a hang and is invisible
  here. Then memory ([topic 01](../01-memory-layout/12-the-checklist.md)).
- **Threads are working** → a profiler, for where the time goes.
- **Nothing in the JVM is wrong** → the load balancer, the network, the dependency, the database.

## The findings, and what each one actually means

| Finding | The real cause is usually |
|---|---|
| Request pool saturated on a socket read | A slow dependency **plus your missing timeout** |
| Connection pool saturated | A slow query, a leak, or a transaction held across a remote call |
| Many `BLOCKED` on one monitor | I/O or a slow operation inside a `synchronized` block |
| Deadlock reported | Inconsistent lock acquisition order between two paths |
| `Object.wait()` never notified | A logic or timing bug in the notifying code |
| `RUNNABLE`, busy, same frames | A loop — profile it |
| Threads look fine | Not a thread problem; go to GC or memory |

🔴 **The recurring theme is worth stating once.** In most of these rows there are two causes: a
remote one (something is slow) and a local one (nothing bounded how long you would wait for it).
The remote cause explains today's incident. **The local one — the missing timeout, the absent
bulkhead, the unbounded pool — is why it became an outage**, and it is the one you control.

## Before the next incident

Five things, each cheap, that make this checklist far faster:

1. **Name your thread pools.** `pool-3-thread-1` identifies nothing;
   `payment-client-*` identifies everything ([03](03-anatomy-of-a-dump.md)).
2. **Record the configured maximums** in the runbook. A count without a limit to compare it
   against is not a finding.
3. **Verify `jcmd` exists in the image** and runs as the right user — discovering it does not,
   during an incident, costs you the dump.
4. **Update the runbook off `jstack`.** It is experimental and unsupported on JDK 25, and the
   Troubleshooting Guide says to use `jcmd` or `jhsdb jstack` instead.
5. **Run JFR continuously**, so the questions a dump cannot answer — where time went, what
   happened five minutes ago — already have evidence.

## Gotchas

**★ Take the dumps before anything else.**
Fifteen seconds, and unrecoverable if skipped. A restart destroys every piece of evidence this
topic depends on, and the pressure to restart is at its highest exactly when the evidence matters
most.

**★ Check CPU first.**
It splits the problem in half for free. Idle means the dump probably contains the answer; pinned
means the dump narrows it and a profiler finishes it.

**★ "No deadlock found" is much narrower than "not deadlocked".**
It means no monitor or `j.u.c.` ownership cycle at that instant. Pool-permit deadlocks, missed
notifications and distributed deadlocks all hang identically and report nothing.

**★ Count before you read.**
The distribution — threads per pool, per top frame, against the configured maximum — answers most
cases before any thread block is read in full.

**★ A count without a configured maximum is not a finding.**
Two hundred threads in one frame means nothing until you know the limit is two hundred. Keep the
pool sizes in the runbook.

**★ No `BLOCKED` threads may mean you forgot `-l`.**
Without it, `java.util.concurrent` ownership is invisible, and severe `ReentrantLock` contention
presents as a set of idle-looking parked threads.

**★ On a virtual-thread service, `Thread.print` silently omits the application.**
It succeeds, it looks complete, and it shows you carriers. Use `Thread.dump_to_file`
([07](07-virtual-threads.md)).

**★ The outermost saturated pool is the least informative one.**
Exhaustion cascades outward from the slowest point, so every layer reports the same symptom.
Follow the frames inward until you leave the JVM.

**★ Two causes, and only one of them is yours.**
A slow dependency explains the incident; the missing timeout or bulkhead explains why it became an
outage. Fixing only the first guarantees a repeat with a different dependency.

**★ Know when to leave.**
Healthy-looking dumps, a `VMThread` safepoint problem, or threads that are plainly working all
mean the answer is elsewhere. Continuing to take dumps is the most common way to spend an
afternoon on this.

## Interview questions

**★ Walk me through diagnosing a hung service.**
Take three dumps five seconds apart with `-l`, to files, before anything else — a restart destroys
the evidence. Check CPU: idle means a hang, pinned means a loop. Grep for the JVM's deadlock
section, which is free. Then count the distribution — threads per pool per top frame against the
configured maximums — which usually identifies saturation immediately. Confirm the candidates are
in the same frames across all three dumps, read their top frames to see what they wait on, and if
they are blocked, find the lock holder and read its stack. Then follow any pool chain inward to
the innermost saturated pool.

**★ Why is checking CPU the first step rather than reading the dump?**
Because it eliminates half the possibilities at zero cost and determines which tool finishes the
job. Idle CPU means threads are waiting and the dump likely contains the whole answer. Pinned CPU
means threads are executing, the dump can only identify which ones, and a sampling profiler is
needed for where the time goes. Oracle's own troubleshooting guide separates the two procedures
for the same reason.

**★ The JVM reports no deadlock but the service is hung. What does that rule out?**
Only a monitor or `java.util.concurrent` ownership cycle at that instant. It leaves open a wait
that is never notified, a resource deadlock through a pool — two threads each holding one
connection and needing a second from a pool of two — and a distributed deadlock across services,
where each JVM sees only a socket read. All three hang exactly like a deadlock and produce no
detection output.

**★ You find the request pool saturated with every thread in a socket read. What do you fix?**
Two things, and it is important to name both. The dependency is slow, which is one investigation
run on that service. But your service fell over because nothing bounded how long it would wait: no
read timeout, and no bulkhead isolating that dependency from the rest of the pool. Fixing the
dependency restores service today; fixing the timeout is what stops the next slow dependency doing
the same thing.

**★ How do you avoid spending an afternoon taking dumps that cannot help?**
Know the exits. If threads are moving between dumps they are working, and the question is where
time goes — a profiler's job. If the dumps look healthy the failure is not thread-shaped, so go to
the GC log and then memory. If `VMThread` is stuck in `SafepointSynchronize::begin` it is a
safepoint problem and more application dumps are worthless. A dump has no time axis, so any
question about duration, rate or history is out of scope no matter how many you take.

**★ What would you change in a service to make this checklist faster next time?**
Name every thread pool, so the most valuable field in the dump identifies a subsystem instead of
saying `pool-3-thread-1`. Record the configured maximums in the runbook, since a count is
meaningless without them. Verify `jcmd` is present in the image and runs as the right user. Replace
`jstack` in the runbook, since it is experimental and unsupported on JDK 25. And run JFR
continuously, so the questions a dump structurally cannot answer already have evidence.

**★ What is the single most common outcome of this checklist?**
Pool exhaustion caused by a slow downstream dependency with no timeout on the call. The dump shows
N threads at the pool's configured maximum, all `RUNNABLE` in a native socket read, unchanged
across all three dumps — and the fix that matters long-term is local, not remote.

{/* FOOTER */}
