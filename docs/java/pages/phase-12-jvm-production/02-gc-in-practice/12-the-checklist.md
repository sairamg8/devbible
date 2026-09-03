---
title: "\"GC pauses went up\" is not a diagnosis, it is a report of a symptom that has at least six unrelated causes — this is the ordered set of questions that distinguishes them, arranged so that the cheap ones that rule out the most come first and the ones requiring a restart come last"
sidebar_label: "12 · The checklist"
sidebar_position: 42
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 — this page assembles conclusions established and sourced in the preceding
> chunks of this topic rather than introducing new claims; each step links to the page carrying
> its evidence. The underlying sources are the **HotSpot Virtual Machine Garbage Collection
> Tuning Guide, Release 25**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/)) and the JDK 25 HotSpot
> sources at tag `jdk-25+36`. JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Somebody says "GC pauses went up after the deploy". This page is the order in which to ask
questions about that sentence. The ordering is not arbitrary: each step is cheaper than the one
after it, and each rules out more than it costs. The most common outcome of running it properly
is discovering that the problem was not garbage collection.**

## Step 0 — Is it actually GC?

Before anything else, establish correlation rather than assuming it. Compare collection
timestamps against the latency histogram. If the spikes do not line up with collections, stop
here: the causes that masquerade as GC are a lock, a slow dependency, connection-pool exhaustion,
CPU throttling, and time-to-safepoint. GC is over-blamed because it is the best-instrumented
subsystem in the JVM, which is a poor reason to suspect it — the argument in
[11 · When tuning is the wrong answer](11-when-tuning-is-the-wrong-answer.md).

Cost: minutes, no restart. This step eliminates more investigations than every step below it
combined.

## Step 1 — Is the pause the collection, or the wait to reach the safepoint?

🔴 **Ask this before looking at a single collector setting.** The GC log's figure is the work done
*at* the safepoint. The application lost `Total`, which also includes `Reaching safepoint` — and
that number appears in no GC metric anywhere.

Enable `-Xlog:safepoint` (`info`, one line per safepoint, cheap enough to leave on) and compare
the columns. If `Reaching safepoint` dominates, this is not a collector problem at all and no
collector flag will touch it: go to [10 · Safepoints](10-safepoints.md),
[10b · The counted loop](10b-what-makes-time-to-safepoint-long.md) and
[10c · Diagnosing it](10c-diagnosing-time-to-safepoint.md).

Also check *what the safepoint was for* — the record names the VM operation. Regular pauses with
a clean GC log are frequently an agent redefining classes, not a collection.

## Step 2 — What changed?

A pause regression that starts at a deploy has a cause in that deploy. In rough order of
likelihood:

- **Allocation rate**, compared against yesterday — the single most actionable GC signal there
  is, because it points at a change rather than a configuration
  ([08 · Allocation rate](08-allocation-rate.md), [08b](08b-where-allocation-comes-from.md)).
- **Live set** — a new cache, a larger working set, a bigger batch.
- **The JVM itself** — a JDK upgrade changes ergonomics, and a base-image change can change the
  JDK without anybody saying so.
- **The container's limits** — a memory or CPU limit edited in a chart is a JVM configuration
  change, because the JVM sizes itself from them.
- **An agent** — APM, profiler or security agent added to the base image.

## Step 3 — Churn or retention?

The discriminator that decides everything downstream, and it is one measurement: **live data size
after collection.**

| Allocation rate | Live data size | What it is | Where to go |
|---|---|---|---|
| Up | Flat | Churn — the collector is coping with more garbage | [08b](08b-where-allocation-comes-from.md) |
| Flat | Rising | Retention — a leak | [04 · OutOfMemoryError](../04-out-of-memory-error/README.md) |
| Up | Rising | Both, and the leak is the urgent one | [04](../04-out-of-memory-error/README.md) |
| Flat | Flat | Not a heap problem — re-check step 0 | [11](11-when-tuning-is-the-wrong-answer.md) |

Rising live data means a heap dump, not a flag. Everything in the rest of this checklist assumes
you have ruled it out.

## Step 4 — Read the log, in this order

[07c · Reading a GC log](07c-reading-a-gc-log.md) is the detail; this is the sequence.

1. **Occupancy after collection.** Flat and near the ceiling with collection activity on top of
   it is the death spiral — [09](09-gc-overhead-and-the-death-spiral.md), and note that on G1 it
   will never announce itself ([09b](09b-why-g1-never-throws-it.md)).
2. **Collection frequency.** Continuous back-to-back collections is a different problem from
   long individual ones.
3. **Pause cause.** Young, concurrent-cycle, mixed, or full. A **Full GC on G1 is always a
   finding** — [03e2 · The road to a Full GC](03e2-the-road-to-a-full-gc.md).
4. **Evacuation failure / to-space exhaustion** — [03e](03e-g1-when-it-goes-wrong.md).
5. **Humongous allocations** — a single large array can fragment the heap
   ([03d](03d-humongous-allocations.md), [03d2](03d2-humongous-fragmentation.md)).
6. **The tenuring threshold**, via `-Xlog:gc+age=trace`. Collapsed to 1 or 2 means premature
   promotion — [08c](08c-premature-promotion.md), [08c2](08c2-fixing-premature-promotion.md).
7. **Reference processing time**, which is a distinct phase and can dominate a pause
   ([03b3](03b3-reference-processing.md), [03b4](03b4-finalization-and-cleaners.md)).

## Step 5 — Is the collector right for the shape?

Only now. Large heap plus strict latency target is ZGC's case; throughput-only batch work is
Parallel's; a tiny container is Serial's; everything else is G1, which is the default for good
reasons. [06 · Choosing](06-choosing.md).

🔴 **Check the pause goal before changing the collector.** An aggressive `MaxGCPauseMillis` makes
G1 keep the young generation small, which shrinks survivor space, which causes premature
promotion, which eventually causes the long collection the goal existed to prevent
([08c2](08c2-fixing-premature-promotion.md), [03c3](03c3-tuning-g1-for-throughput.md)).
Relaxing it is counter-intuitive and is frequently the fix.

## Step 6 — Only now, a flag

And only with an answer to: *what measurement will move, and by roughly how much?* Prefer, in
order:

1. **Nothing** — the fix is in the code ([11](11-when-tuning-is-the-wrong-answer.md)).
2. **A ratio**, not a total. Free of container arithmetic and targeted at the constraint.
3. **A heap size that reflects the measured live set** — in a container,
   `-XX:MaxRAMPercentage` rather than `-Xmx` ([03](../03-heap-sizing-in-containers/README.md)).
4. **A collector change**, deliberately, with its cost accepted.

Verify against [02c2 · Flags that still work](02c2-flags-that-still-work.md) and
**13 · JVM flags that matter** *(not written yet)* — an unrecognised `-XX:`
option fails the launch on JDK 25.

## The configuration to have in place beforehand

None of this changes behaviour under load; all of it decides whether the next incident is
diagnosable.

- GC logging with rotation, so the log survives the failure
  ([07d](07d-rotating-and-shipping-gc-logs.md)).
- `-Xlog:safepoint`, for the one number nothing else reports ([10](10-safepoints.md)).
- `-XX:+HeapDumpOnOutOfMemoryError` with a writable path — heap exhaustion only
  ([04](../04-out-of-memory-error/README.md)).
- `-XX:+ExitOnOutOfMemoryError` for a service, so the process dies rather than limping.
- Graphs of **allocation rate, promotion rate, live data size and pause distribution** — in that
  order of importance, which is the opposite of how most dashboards are built
  ([08b](08b-where-allocation-comes-from.md)).
- A **time-in-GC fraction** alert, because a death spiral's individual pauses can look ordinary
  ([09b](09b-why-g1-never-throws-it.md)).
- A readiness probe that exercises the application, because a spiralling JVM passes every probe
  that does not.

## Gotchas

**★ The most common correct answer to "GC pauses went up" is "these are not GC pauses".**
Locks, slow dependencies, CPU throttling and time-to-safepoint all produce the same symptom with
none of the logging. Establishing correlation with collection timestamps is minutes of work and
eliminates more investigations than everything after it.

**★ Step 1 comes before every collector question, and almost nobody does it first.**
Time-to-safepoint appears in no GC metric. Skipping it means potentially spending a day tuning a
collector whose pauses were never the problem.

**★ A Full GC on G1 is always a finding.**
G1 is designed not to need one. Its presence in a log is information regardless of how long it
took, and it should never be normalised as "we get a few of those".

**★ Live data size after collection is the one measurement the whole checklist pivots on.**
Churn and leak look identical everywhere else. Getting this backwards sends the entire
investigation down the wrong branch, and the branches share no steps.

**★ Peak occupancy is the wrong gauge; post-collection occupancy is the right one.**
The peak includes everything not yet reclaimed and is dominated by allocation rate. Dashboards
built on the raw pool gauge routinely show the wrong one.

**★ A tighter pause goal can cause the long pauses it was set to prevent.**
Small young generation, small survivors, premature promotion, a filling old generation, a long
collection. Relaxing `MaxGCPauseMillis` is a real fix that reads like a mistake.

**★ Check what the safepoint was for, not only how long it took.**
The record names the VM operation. Regular pauses with a clean GC log are often class
redefinition by an agent — a diagnosis unreachable from the GC log alone.

**★ A container limit change is a JVM configuration change.**
The JVM sizes its heap and its GC thread count from the cgroup. Editing a limit in a chart with
no JVM flags touched is a tuning change made by somebody who did not know they were making one.

**★ Every "before" number you need must have been graphed before the incident.**
Allocation rate's value is almost entirely in its trend. Starting to graph it during an
investigation gives you the "after" and never the "before".

**★ The checklist is ordered by what it rules out per unit of cost, not by topic.**
Running it out of order — starting with flags, or with the collector choice — is how a
straightforward investigation becomes a week.

## Interview questions

**★ Walk me through diagnosing "p99 latency doubled after the deploy".**
I would not assume it is GC. First, correlation: do the latency spikes line up with collection
timestamps? If not, the suspects are a lock, a slow downstream dependency, pool exhaustion or CPU
throttling, and the GC log is a distraction. If they do correlate, the next question is whether
the pause is the collection or the wait to reach the safepoint — `-Xlog:safepoint` splits
"Reaching safepoint" from "At safepoint", and the GC log only reports the second, so a stall
dominated by the first will never be explained by a collector setting. Then: what changed in the
deploy? Allocation rate against yesterday is the most actionable signal, because it points at a
change rather than a configuration. Then the discriminator — live data size after collection —
which separates churn from retention and decides whether the rest of this is a GC investigation
or a heap dump. Only after all of that do I read the log properly: occupancy after collection,
frequency, pause cause, evacuation failures, humongous allocations, the tenuring threshold. And
only after *that* is a flag on the table, with a prediction of what will move attached to it.

**★ Why is "is it the collection or the time to reach the safepoint" the first technical question
rather than a late one?**
Because it is cheap, it is decisive, and getting it wrong invalidates everything downstream. The
GC log's pause figure measures work done at the safepoint; the application also lost the time
spent waiting for the last thread to arrive, and that number appears nowhere in the GC log, in GC
notifications, or in the Micrometer metrics derived from them. So a service losing 400 ms per
collection can show 8 ms pauses on every dashboard, and every subsequent step — reading the log,
comparing collectors, changing flags — is addressed to a subsystem that is behaving correctly.
Answering it costs one log tag at `info` level emitting one line per safepoint, which is cheap
enough to leave on permanently. The asymmetry between the cost of asking and the cost of not
asking is about as large as it gets in this area.

**★ What single measurement separates a GC problem from a leak, and why that one?**
Live data size after collection — the bytes still reachable once the collector has finished. It
works because it is the only number that isolates *retention* from *activity*. Heap occupancy is
dominated by allocation rate and tells you almost nothing; pause times respond to both; promotion
rate responds to object lifetime as well as to volume. Live data after collection responds to one
thing: how much the application is holding. If it is flat while allocation rate climbs, the
application is producing more garbage and the collector is keeping up — a throughput cost, fixed
in code or absorbed. If it climbs, the application is retaining more, and no collector setting
addresses that; the next tool is a heap dump. The two conditions look identical on every other
graph, and they share no remediation steps, which is why this measurement decides the shape of
the whole investigation.

**★ You are handed a service with none of this instrumentation during an incident. What do you
turn on, and in what order?**
The things obtainable without a restart first, because a restart destroys the evidence. `jcmd
<pid> VM.log` can add `-Xlog` output to a running JVM, so safepoint and GC logging can be
switched on in place — that is the single highest-value action and it costs nothing. `jcmd
Thread.print` for a thread dump, accepting that it is itself a safepoint operation and will
perturb what I am measuring, so deliberately rather than in a loop. `jcmd GC.heap_info` and the
memory-pool metrics for occupancy. JFR can be started on a live JVM too, which gives allocation
sampling with stack traces — usually the fastest route to naming the call site. Only if the
process must be restarted anyway would I add flags, and then the diagnostic set rather than any
tuning: GC logging with rotation, `-Xlog:safepoint`, heap dump on OOM with a writable path, and
exit on OOM. The general point is that during an incident the ordering constraint is not cost but
*reversibility* — anything requiring a restart is last, because the restart is the one action that
guarantees you cannot diagnose what just happened.

**★ Why is the checklist ordered the way it is?**
By how much each step rules out relative to what it costs, which turns out not to match how the
topics are usually taught. The cheapest steps eliminate the largest number of possible worlds:
asking whether the pauses correlate with collections at all costs minutes and eliminates every
non-GC cause; asking whether the pause is the safepoint wait costs one log tag and eliminates the
entire collector-tuning branch; asking whether live data is rising costs one metric and splits the
remaining space in half along a line where the two halves share no remediation. Reading the GC
log in detail is more expensive and more specific, so it comes after the cheap eliminations.
Changing flags is last because it is the only step that alters the system's behaviour — it is
both the most expensive to get wrong and the one whose effect is hardest to attribute. Running
the list in the order people usually run it, which is roughly reversed, is how a two-hour
investigation becomes a week: you change something early, the system's behaviour changes, and
every measurement taken afterwards is of a different system.

**★ What would you put in place before an incident, and why does none of it involve tuning?**
GC logging with rotation so the log survives the failure that produced it; `-Xlog:safepoint`,
because time-to-safepoint is reported nowhere else; heap dump on `OutOfMemoryError` with a
writable path, remembering that it only fires for heap exhaustion; exit on `OutOfMemoryError` so
a service dies rather than continuing in an undefined state; graphs of allocation rate, promotion
rate, live data size and pause distribution, in that order of importance; an alert on the
fraction of wall clock spent in GC rather than on pause percentiles, because a death spiral's
individual pauses can look ordinary; and a readiness probe that does real work, because a JVM in
a spiral passes every probe that only checks the port. None of it is tuning because none of it
constrains the JVM's behaviour under load — which is exactly why it is all defensible without a
measurement justifying it, whereas every actual tuning flag needs one. The other reason is
timing: every "before" value you will want during an incident has to have been recorded before the
incident, and allocation rate in particular is a metric whose entire value is its trend.

{/* FOOTER */}
