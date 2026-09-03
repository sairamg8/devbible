---
title: "The overhead limit is implemented by the adaptive size policy that G1 does not use, so on JDK 25's default collector the error that exists to end a death spiral is never thrown — G1 has a different escape hatch, it only fires when an allocation actually fails, and a spiral where allocations keep barely succeeding never reaches it"
sidebar_label: "09b · Why G1 never throws it"
sidebar_position: 37
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/shared/gcOverheadChecker.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcOverheadChecker.cpp)
> and
> [`gc/shared/adaptiveSizePolicy.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/adaptiveSizePolicy.hpp),
> which declare and implement the overhead check, and
> [`gc/g1/g1CollectedHeap.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1CollectedHeap.cpp),
> whose `satisfy_failed_allocation` escalation ladder and `mem_allocate` signature are quoted
> here — G1 carries the `gc_overhead_limit_was_exceeded` parameter because it is part of the
> shared `CollectedHeap` interface, and never calls `check_gc_overhead_limit`.
> Also the **HotSpot GC Tuning Guide, Release 25**, whose overhead-limit text appears **only**
> under "The Parallel Collector"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/parallel-collector1.html)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[09](09-gc-overhead-and-the-death-spiral.md) described the mechanism that ends a death spiral.
This page is the part that changes what you actually do about it: that mechanism belongs to the
Parallel and Serial collectors, and G1 — the default on every server-class machine since JDK 9 —
does not implement it. Neither does ZGC. So on a default JDK 25 deployment, the safety net most
people believe is underneath them is not there, and the responsibility for ending a spiral moves
out of the JVM entirely.**

## Where the check lives, and where it does not

The overhead limit is not a property of "the JVM". It is a method on `AdaptiveSizePolicy` —
`check_gc_overhead_limit`, backed by a `GCOverheadChecker` that owns the consecutive-collection
counter. That policy object is the Parallel collector's sizing machinery, shared with Serial.

G1 has its own heuristics and does not use it. Searching `g1CollectedHeap.cpp` for
`check_gc_overhead_limit` returns nothing; the only related identifier in the file is the
parameter in:

```cpp
HeapWord*
G1CollectedHeap::mem_allocate(size_t word_size,
                              bool*  gc_overhead_limit_was_exceeded) {
```

That parameter exists because `mem_allocate` is declared on the shared `CollectedHeap` base
class, so every collector must accept it. G1 never sets it to `true`. It is interface baggage,
and it is exactly the kind of thing that makes a casual source search suggest the opposite of the
truth.

The documentation agrees, if you read where the text is placed rather than what it says: the
98%/2% rule appears in the tuning guide under **"The Parallel Collector → Excessive Parallel
Collector Time and OutOfMemoryError"**. The section heading has the collector's name in it twice.
There is no equivalent section for G1 or ZGC, and the absence is the specification.

So the honest statement of the rule is: **`OutOfMemoryError: GC overhead limit exceeded` is a
Parallel/Serial diagnosis.** If you have never seen it in production on a modern service, that is
not because your heaps are healthy — it is because you are running G1.

## What G1 does instead

G1 has an escape, but it is triggered by a different condition. When an allocation cannot be
satisfied, `satisfy_failed_allocation` runs a three-step escalation, and the source comment
explains the philosophy behind it:

> *"In a G1 heap, we're supposed to keep allocation from failing by incremental pauses. Therefore,
> at least for now, we'll favor expansion over collection."*

The ladder, each rung being "try to allocate, and if that fails do something more drastic":

1. **Allocate at safepoint → expand the heap → Full GC → allocate.**
2. **Full GC with maximal compaction**, which the source describes as clearing all soft
   references and not allowing *"any dead wood to be left on the heap"*.
3. **Allocate with no GC** — one last attempt against whatever step 2 produced.

If all three fail, the allocation returns null and you get
`java.lang.OutOfMemoryError: Java heap space`.

Two things follow, and they are the whole point of this page:

**The trigger is a failed allocation, not wasted time.** G1 will never conclude "I am spending
98% of my time achieving nothing, I should stop". It has no such notion. It stops when it cannot
satisfy a specific allocation request after doing everything available to it.

**A spiral in which allocations keep succeeding therefore never terminates.** This is the case
that matters. If the live set is large enough to make every collection nearly useless, but each
individual allocation still finds a home — because a full GC did free a few megabytes, because
the request is small, because the heap can still expand a little — then no allocation fails, the
ladder is never climbed to the end, and G1 will collect back-to-back indefinitely. The process
burns CPU at 100%, serves nothing, and never throws. **On Parallel that state has a five-full-GC
fuse. On G1 it has none.**

ZGC is in the same position for the same reason, with the additional wrinkle that its concurrent
design means application threads are stalled in allocation rather than stopped at a safepoint, so
the symptom on a thread dump looks different again — [04c2](04c2-zgc-memory-and-when-not-to.md).

## What has to replace it

Because the JVM will not end the state, something outside it must. In rough order of how reliably
they work:

- **A container memory limit.** This is the one that genuinely works, and it works by accident:
  the JVM's footprint does not shrink during a spiral, and if anything is still expanding the
  heap, the cgroup limit is reached and the kernel kills the process. An OOMKill is a blunt
  ending — no heap dump, no stack trace, exit code 137 — but it is an ending, and it is why
  containerised services suffer less from this than the JVMs on long-lived VMs where the spiral
  was first named. The arithmetic and the OOMKilled-vs-`OutOfMemoryError` distinction are
  [03 · Heap sizing in containers](../03-heap-sizing-in-containers/README.md).
- **A readiness probe that exercises the application.** A probe that opens a socket or checks the
  process passes throughout a spiral. A probe that performs work — even trivially — times out,
  which takes the instance out of rotation and, if it is also the liveness probe, restarts it.
  This is the specific failure that makes "the health check just checks the port" indefensible.
- **An alert on GC time fraction, not on pause duration.** The metric that identifies a spiral is
  the proportion of wall clock spent collecting, approaching 1. Pause-duration percentiles do not
  show it well, because the individual collections may not be unusually long — there are simply
  no gaps between them. Micrometer's GC metrics and the derived time fraction are
  **08 · Metrics with Micrometer** *(not written yet)*.
- **`-Xlog:gc+ergo=trace` as an early-warning channel** — but note the asymmetry this page is
  about: on G1 the "would exceed overhead limit" message from
  [09](09-gc-overhead-and-the-death-spiral.md) is never emitted either, because the code that
  emits it is the code G1 does not run. On G1 the log signal is repeated full collections with
  post-collection occupancy flat against the ceiling, read per
  [07c](07c-reading-a-gc-log.md).
- **`-XX:+ExitOnOutOfMemoryError` — necessary, and not sufficient here.** It converts an
  `OutOfMemoryError` into an immediate process exit, which is usually the right policy for a
  service. But it only acts on an error that was actually thrown, and the entire problem on this
  page is that no error is thrown. It protects you from the case where G1 *does* reach the end of
  its ladder; it does nothing for the case where it never does.

## Should you switch collectors for this?

No — and it is worth saying why, because the reasoning generalises. The overhead limit is a
crash-faster mechanism, not a correctness or performance feature; choosing Parallel over G1 to
obtain it would mean accepting Parallel's full-heap pauses for every collection in order to get a
better failure mode in a state you should be preventing rather than terminating. The collector
choice is made on latency, throughput and footprint —
[06 · Choosing](06-choosing.md) — and this consideration does not belong in it.

What the asymmetry should change is your **monitoring**, not your collector. The Parallel-era
assumption "a runaway heap eventually throws and the process dies" is false on the default
collector, so the detection that used to be free must now be built. That is the actionable
conclusion, and it is the one most teams have not drawn because the error's disappearance from
their logs read like an improvement.

## Gotchas

**★ `GC overhead limit exceeded` is a Parallel/Serial error and G1 never throws it.**
The check is a method on `AdaptiveSizePolicy`, which G1 does not use; `g1CollectedHeap.cpp`
contains no call to `check_gc_overhead_limit`. Since G1 has been the default on server-class
machines since JDK 9, most modern services have never had this safety net — and its absence from
the logs reads like health rather than like a missing mechanism.

**★ G1's `mem_allocate` takes a `gc_overhead_limit_was_exceeded` parameter and never sets it.**
It is part of the shared `CollectedHeap` interface, so every collector accepts it. A source
search that finds the identifier in `g1CollectedHeap.cpp` and concludes G1 implements the check
has found interface baggage, not an implementation.

**★ The tuning guide documents the rule only under "The Parallel Collector".**
The section is titled *Excessive Parallel Collector Time and OutOfMemoryError*, and there is no
G1 or ZGC equivalent. The placement is the specification; quoting the sentence without its
section heading is how the rule got a reputation for being universal.

**★ G1 stops on a failed allocation, not on wasted time — so a spiral that never fails an
allocation never ends.**
This is the operationally important consequence. Back-to-back full collections reclaiming almost
nothing, with every individual allocation still succeeding, is a stable state on G1. Parallel
gives that state a five-full-GC fuse; G1 gives it none.

**★ G1's last-ditch full GC clears all soft references too — same cache collapse, different
trigger.**
Step two of `satisfy_failed_allocation` is a maximal compaction that clears all soft references
and leaves no dead wood. So the "cache empties itself just before the end" behaviour from
[09](09-gc-overhead-and-the-death-spiral.md) happens on G1 as well; it is simply driven by a
failed allocation rather than by an overhead counter.

**★ G1 favours expanding the heap over collecting, by explicit design.**
The source says so: *"we'll favor expansion over collection"*. Under memory pressure that means
G1 reaches for more memory before it reaches for a full GC — which is what you want for pause
times, and is also what makes the cgroup limit the effective terminator in a container.

**★ ZGC has no overhead limit either, and its spiral looks different on a thread dump.**
Concurrent collection means application threads stall in allocation rather than being stopped at
a safepoint, so the "GC threads busy, application threads idle" pattern that identifies a G1
spiral does not read the same way. The absence of the limit is the same; the symptom is not.

**★ `-XX:+ExitOnOutOfMemoryError` cannot help with an error that is never thrown.**
It is still worth setting — a service should die rather than continue after an
`OutOfMemoryError` — but it is a policy for handling the error, not a detector. On G1 the spiral
produces no error to act on.

**★ Alert on the fraction of time spent in GC, not on pause duration.**
In a spiral the individual pauses need not be unusually long; there are simply no gaps between
them. A p99-pause alert can stay green throughout. Time-in-GC over wall clock approaching 1 is
the signal, and almost no default dashboard computes it.

**★ The container memory limit is doing work you probably credited to the JVM.**
On a containerised service, a spiral usually ends as an OOMKill rather than as an
`OutOfMemoryError`, because the footprint stays high and the kernel intervenes. That is a real
ending with no diagnostics attached — exit code 137, no heap dump — and teams frequently
misattribute it to a memory leak in the strict sense rather than to a heap that could not be
freed.

## Interview questions

**★ Why have you probably never seen `GC overhead limit exceeded` on a modern service?**
Because it is implemented by the adaptive size policy used by the Parallel and Serial collectors,
and the default collector on server-class machines has been G1 since JDK 9. G1 does not call
`check_gc_overhead_limit` at all — the only trace of the mechanism in `g1CollectedHeap.cpp` is a
parameter inherited from the shared `CollectedHeap` interface that G1 never sets. The tuning
guide reflects this: the 98%/2% rule appears only under "The Parallel Collector", with no G1 or
ZGC equivalent. So the error's absence is not evidence that heaps are healthier than they used to
be; it is evidence that the mechanism which reported the condition is not running. That matters,
because the operational assumption it supported — that a runaway heap eventually throws and the
process dies — is no longer true by default.

**★ On G1, what actually ends a death spiral?**
Frequently nothing inside the JVM. G1's termination path is `satisfy_failed_allocation`, which
runs when a specific allocation cannot be satisfied: it tries to allocate, expands the heap, runs
a full GC, tries again, then runs a full GC with maximal compaction that clears all soft
references and leaves no dead wood, tries again, and finally tries once more without collecting.
If all of that fails you get `OutOfMemoryError: Java heap space`. But the trigger is a *failed
allocation*, not wasted time — so a heap whose live set makes every collection nearly useless,
while individual allocations keep succeeding, is a stable state that G1 will sustain
indefinitely. In practice what ends it is external: a container memory limit producing an
OOMKill, a readiness probe that actually exercises the application taking the instance out of
rotation, or a human. Which is why, on G1, detection has to be built rather than assumed.

**★ You are asked to make a G1 service fail fast under memory exhaustion. What do you configure?**
Several things, and it is worth being clear that none of them is a GC flag that restores the
overhead limit, because no such flag exists. First, `-XX:+ExitOnOutOfMemoryError` so that if an
error *is* thrown the process terminates rather than limping on with a corrupted state — paired
with `-XX:+HeapDumpOnOutOfMemoryError` and a writable dump path, remembering that the dump only
covers heap exhaustion. Second, a container memory limit sized against the real footprint, which
is what actually terminates the case where no error is thrown; the trade is that you get an
OOMKill with no diagnostics, so the limit is a backstop rather than a plan. Third, and most
important, a readiness probe that performs real work with a timeout, so a spiralling instance
leaves the load-balancer rotation instead of absorbing traffic it cannot serve. Fourth, an alert
on the fraction of wall clock spent in GC rather than on pause percentiles, because a spiral's
individual pauses may look ordinary. The honest framing for the interview is that "fail fast" on
G1 is an operational property assembled from probes, limits and metrics — not a JVM setting.

**★ Would you switch to the Parallel collector to get the overhead limit back?**
No. The limit is a failure-mode improvement, not a performance or correctness feature, and
Parallel's cost is that every collection is a stop-the-world full-heap pause — a permanent,
continuous latency penalty accepted in exchange for a better ending to a state you should be
detecting and preventing. The collector decision is driven by latency target, throughput
requirement and footprint, and this consideration is far too small to enter it. The right
response to the asymmetry is to notice what it invalidates in your monitoring: alerting that
assumed a runaway heap would announce itself with an `OutOfMemoryError` needs replacing with
alerting on time spent in GC and on post-collection occupancy, because on G1 nothing announces
it. Switching collectors to restore a diagnostic is treating the instrument as the goal.

**★ Why does a container memory limit end a spiral that the JVM will not?**
Because the two mechanisms watch different things. The JVM's overhead limit — where it exists —
watches the ratio of time spent collecting to progress made, which is a question about
usefulness. The kernel watches resident memory against the cgroup limit, which is a question
about footprint. During a spiral the footprint stays at its maximum and G1 is documented as
favouring expansion over collection, so if there is any headroom left the heap grows into it and
the limit is reached. The kernel then kills the process, which is an ending — exit code 137, no
heap dump, no stack trace, and typically a restart by the orchestrator. It is worth being clear
that this is a backstop rather than a design: it destroys the evidence you need to fix the cause,
and it is frequently misread as a leak in the narrow sense when the real condition was a heap
that could not be freed. But it is the reason containerised services experience this pathology as
a restart loop rather than as the hours-long hang that gave the death spiral its name.

{/* FOOTER */}
