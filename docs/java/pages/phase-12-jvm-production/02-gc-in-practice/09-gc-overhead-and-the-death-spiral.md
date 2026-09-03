---
title: "The death spiral is a service that is technically still running: every request times out, CPU sits at 100%, the heap is full of live objects the collector cannot reclaim, and the JVM keeps trying — the 98% rule exists to end that state, and it has five preconditions that almost nobody knows about"
sidebar_label: "09 · GC overhead and the death spiral"
sidebar_position: 36
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "The Parallel Collector → Excessive Parallel Collector Time and OutOfMemoryError"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/parallel-collector1.html));
> and the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp)
> for `UseGCOverheadLimit`, `GCTimeLimit`, `GCHeapFreeLimit` and `GCOverheadLimitThreshold`, and
> [`gc/shared/gcOverheadChecker.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcOverheadChecker.cpp)
> for the exact conditions under which the limit fires.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A heap that is nearly full of *live* objects does not fail cleanly. The collector runs, reclaims
almost nothing, the application allocates again within milliseconds, and the collector runs again
— forever. The process stays up, the port stays open, the health check may even pass, and every
request times out. The JVM has a mechanism designed to end this state by converting it into an
`OutOfMemoryError`, and the single most important thing to know about that mechanism is how
narrow its preconditions are.**

## What the spiral actually is

The generational design assumes most objects die young and a collection is therefore cheap
relative to what it reclaims. The death spiral is what happens when that assumption inverts:
almost everything in the heap is live, so a collection costs the full price of tracing and
copying and returns almost nothing.

The feedback loop closes because the application is still running. Reclaim 20 MB, and the
application — which is servicing requests, or trying to — allocates 20 MB back immediately. The
next collection starts. The JVM is not malfunctioning; it is doing exactly what it was asked to
do, at the only speed available, and the result is a process that consumes an entire machine's
CPU to make no progress at all.

Two properties make this worse than a crash:

- **It does not stop on its own.** A leak that hits the heap ceiling and throws is over in a
  moment; a spiral can persist for hours, and the process keeps its port bound the whole time.
- **It looks alive to everything that checks.** The process exists, so the orchestrator is
  satisfied. The TCP listener is open, so a connection-level probe succeeds. Only an actual
  request notices, and by then the caller has timed out. Health checks that do not exercise the
  application are exactly the ones that pass here —
  [16 · Health checks that don't lie](../../phase-16-resilience-operations/README.md) is the
  general argument, and this is its sharpest instance.

## The 98% rule, quoted

The tuning guide states the mechanism in one sentence:

> *"If more than 98% of the total time is spent in garbage collection and less than 2% of the heap
> is recovered, then an `OutOfMemoryError`, is thrown. This feature is designed to prevent
> applications from running for an extended period of time while making little or no progress
> because the heap is too small. If necessary, this feature can be disabled by adding the option
> `-XX:-UseGCOverheadLimit` to the command line."*

Note what the two numbers are: **98% is a time proportion, 2% is a space proportion, and both must
be true.** Almost every summary of this rule quotes only the 98% and drops the conjunction, which
makes the rule sound far more trigger-happy than it is. A collector spending 98% of its time
collecting while still freeing 10% of the heap each cycle is thrashing badly and will not trip
this limit — correctly, because it *is* making progress.

The resulting error message is `java.lang.OutOfMemoryError: GC overhead limit exceeded`, and it is
one of the documented `OutOfMemoryError` messages catalogued in
[04 · OutOfMemoryError](../04-out-of-memory-error/README.md).

## The flags, from the source

From `gc_globals.hpp` at `jdk-25+36`, with the source's own descriptions:

| Flag | Default | The source's description |
|---|---|---|
| `-XX:+UseGCOverheadLimit` | `true` | *"Use policy to limit of proportion of time spent in GC before an OutOfMemory error is thrown"* |
| `-XX:GCTimeLimit` | `98` | *"Limit of the proportion of time spent in GC before an OutOfMemoryError is thrown (used with GCHeapFreeLimit)"* |
| `-XX:GCHeapFreeLimit` | `2` | *"Minimum percentage of free space after a full GC before an OutOfMemoryError is thrown (used with GCTimeLimit)"* |
| `GCOverheadLimitThreshold` | `5` | *"Number of consecutive collections before gc time limit fires"* — 🔴 a `develop` flag, **not settable on a product build** |

Both threshold flags carry *"used with"* in their own descriptions, which is the source telling
you the conjunction is deliberate. And `GCOverheadLimitThreshold` being a `develop` flag is worth
dwelling on: the "five consecutive collections" requirement is real, it materially changes when
the error fires, and **you cannot tune it on a production JVM** — a `develop` flag does not exist
in a product build, so setting it is not a no-op, it is a failed launch. The live/retired flag
inventory is **13 · JVM flags that matter** *(not written yet)*.

## The five preconditions, from `gcOverheadChecker.cpp`

The guide's sentence is accurate but incomplete. The source shows the check is considerably more
conservative than the documentation suggests. Every one of these must hold:

1. **It is a full GC.** The whole check is inside `if (is_full_gc)`. Young collections, however
   frequent or however useless, never advance the counter.
2. **Both testers are exceeded.** `time_overhead->is_exceeded() && space_overhead->is_exceeded()`
   — the conjunction, in code.
3. **It has happened `GCOverheadLimitThreshold` times consecutively.** The counter increments on a
   qualifying full GC and is **reset to zero** by any full GC that does not qualify. One lucky
   collection that frees 3% of the heap restarts the count from scratch.
4. **The GC was not user-requested.** The function returns early for
   `GCCause::is_user_requested_gc(gc_cause) || GCCause::is_serviceability_requested_gc(gc_cause)`,
   and the comment is explicit — *"Ignore explicit GC's. Exiting here does not set the flag and
   does not reset the count."* So a `System.gc()` or a `jcmd GC.run` neither triggers the limit
   nor resets it.
5. **`UseGCOverheadLimit` is on** — it is by default, but it is one of the flags people disable in
   a panic, and disabling it removes the only thing that ends the spiral.

Before it gives up, the JVM makes one last attempt to save the process. As the counter approaches
the threshold, the checker sets the soft-reference policy to clear everything:

> `soft_ref_policy->set_should_clear_all_soft_refs(true);`
> `log_trace(gc, ergo)("Nearing GC overhead limit, will be clearing all SoftReference");`

That is the mechanism behind a behaviour operators observe and rarely explain: **a soft-reference
cache empties itself entirely just before the process throws.** It is not a bug and it is not the
cache misbehaving — it is the JVM sacrificing every soft reference in the heap as a last-ditch
attempt to avoid the `OutOfMemoryError`, and the log message that says so is at `trace` level
under `gc+ergo`, which nobody has enabled. The practical consequence is that a soft-reference
cache is worthless as a memory-pressure safety valve at exactly the moment you needed it, because
it does not degrade gracefully — it goes to zero, all at once, and takes the hit rate with it.

The two other diagnostic messages are also `trace` under `gc+ergo`:
`GC is exceeding overhead limit of %u%%` and
`GC would exceed overhead limit of %u%% %d consecutive time(s)`. That second one is the genuinely
valuable one — it fires while the JVM is *approaching* the limit, which makes
`-Xlog:gc+ergo=trace` an early-warning channel for a spiral in progress. It is verbose, so it
belongs in the "turn it on with `jcmd VM.log` when you suspect something" category rather than in
a permanent configuration — [07b](07b-decorators-and-runtime-control.md).

## Distinguishing a spiral from ordinary GC pressure

They look similar on a CPU graph and they are not the same problem:

| | Ordinary pressure | Death spiral |
|---|---|---|
| Heap after collection | Drops substantially | Barely moves |
| Live data size | Flat | At or near `-Xmx` |
| Collection frequency | High | Continuous, back-to-back |
| Reclaimed per cycle | Meaningful | Near zero |
| Application throughput | Reduced | Effectively zero |
| Ends by itself | Yes, when load drops | No |

The distinguishing measurement is **occupancy after collection**, not peak occupancy and not
pause time. A service under heavy allocation has a sawtooth that returns to a low baseline; a
service in a spiral has a flat line pressed against the ceiling with collection activity on top
of it. That is [07c · Reading a GC log](07c-reading-a-gc-log.md) applied to the one case where
the log's answer is unambiguous.

## Gotchas

**★ It is 98% of time AND less than 2% of heap recovered — both, not either.**
Nearly every summary quotes the 98% and drops the conjunction. A collector burning 98% of wall
clock while still freeing 10% per cycle does not trip the limit, and should not: it is making
progress, badly. The `GCHeapFreeLimit` half is what distinguishes "slow" from "stuck".

**★ Only full GCs count. A storm of useless young collections never trips it.**
The entire check lives inside `if (is_full_gc)` in `gcOverheadChecker.cpp`. A service thrashing
its young generation into uselessness can do so indefinitely without the limit noticing.

**★ It takes five consecutive qualifying full GCs, and one good collection resets the counter.**
`GCOverheadLimitThreshold` defaults to 5 and the counter is reset by any full GC that does not
qualify. A heap that is *almost* exhausted can oscillate across the threshold for a long time
without ever accumulating five in a row — which is why the spiral often persists far longer than
the rule's description suggests it should.

**★ `GCOverheadLimitThreshold` is a `develop` flag — you cannot set it on a production JVM.**
It is not merely unsupported; a `develop` flag does not exist in a product build, so passing it
fails the launch rather than being ignored. The one number that most directly controls how fast
the limit fires is the one you have no access to.

**★ `System.gc()` neither triggers the limit nor resets the counter.**
The checker returns early for user-requested and serviceability-requested collections, and the
source comment says so explicitly. So a monitoring agent politely calling `System.gc()` does not
mask the problem — but it also does not help, and anyone reasoning about the counter has to
exclude those collections from the tally.

**★ All soft references are cleared just before the error is thrown.**
As the counter nears the threshold the JVM sets `should_clear_all_soft_refs`. A soft-reference
cache therefore empties completely — not gradually — moments before the process dies, which
destroys its hit rate at exactly the wrong time and makes soft references a poor memory-pressure
valve for anything that matters.

**★ The early-warning message exists and is invisible by default.**
`GC would exceed overhead limit of 98% N consecutive time(s)` is logged at `trace` under
`gc+ergo`. It fires while the JVM is still approaching the limit. Nobody has that tag on, so the
one signal that would let you catch a spiral before it kills the process is routinely unread.

**★ `-XX:-UseGCOverheadLimit` does not fix anything; it removes the ending.**
Disabling it is a common reaction to seeing the error, and it converts a process that dies with a
diagnosable `OutOfMemoryError` and a heap dump into a process that spirals indefinitely with no
error at all. It is occasionally correct — for a batch job that legitimately runs a nearly-full
heap to completion — and almost never correct for a service.

**★ The error names the symptom, not the cause.**
`GC overhead limit exceeded` tells you the heap could not be freed; it says nothing about *why*
the live set is that large. The cause is a leak, an undersized heap, or a cache without a bound,
and the next step is a heap dump, not a GC flag.

**★ A spiralling process passes most health checks.**
The process exists and the socket is bound, so anything short of a real request succeeds. This is
the strongest practical argument for a readiness probe that exercises the application rather than
the port, because the orchestrator's default behaviour here is to leave a dead service in the
load-balancer rotation.

**★ CPU at 100% with no throughput is the spiral's signature, and it looks like an infinite loop.**
A thread dump distinguishes them in seconds: an application-level infinite loop shows your code
on the stack across several threads, while a spiral shows GC threads busy and application threads
idle or blocked in allocation. That is [05 · Thread dumps](../05-thread-dumps/README.md), and it
is worth taking the dump before restarting, because the restart destroys the evidence.

## Interview questions

**★ What exactly does `OutOfMemoryError: GC overhead limit exceeded` mean, and what are the
conditions?**
It means the JVM concluded it was spending nearly all of its time collecting and reclaiming
almost nothing, so continuing was pointless. The documented rule is that more than 98% of total
time is spent in garbage collection *and* less than 2% of the heap is recovered — a conjunction
that most summaries drop, which matters, because a collector that is burning 98% of the clock but
still freeing 10% of the heap each cycle is making progress and correctly does not trip it. The
source adds conditions the documentation does not: only full GCs are examined, the condition must
hold for five consecutive qualifying full GCs, any full GC that does not qualify resets the
counter to zero, and user-requested collections like `System.gc()` are ignored entirely — they
neither trigger nor reset it. The numbers are `GCTimeLimit` (98) and `GCHeapFreeLimit` (2), and
the consecutive count is `GCOverheadLimitThreshold`, which is a `develop` flag and therefore not
settable on a production build.

**★ Why is a death spiral operationally worse than an outright `OutOfMemoryError`?**
Because it does not end, and because it looks healthy to everything that checks. A process that
throws is over: it dies, it can be configured to leave a heap dump, the orchestrator restarts it,
and the outage is measured in seconds. A spiral keeps the process alive with its port bound and
its CPU pegged, serving nothing. Liveness probes that check the process, and readiness probes
that check the socket, both pass — so the orchestrator keeps the instance in rotation and the
load balancer keeps sending it traffic that will time out. It can also take an entire node's CPU
with it, degrading co-located workloads. The remedy is partly configuration —
`-XX:+ExitOnOutOfMemoryError` or `-XX:+CrashOnOutOfMemoryError` so the error becomes a
termination — and partly probe design, because a probe that does not exercise the application
cannot distinguish a working service from this one.

**★ Someone hits this error and disables `-XX:-UseGCOverheadLimit`. What happens next?**
The error stops appearing and the underlying condition does not change. What was a process dying
with a specific, diagnosable message — and, if `HeapDumpOnOutOfMemoryError` was set, with a heap
dump naming the retained objects — becomes a process that spirals indefinitely: full CPU, no
throughput, no error, no dump, and no natural end. Every diagnostic signal has been removed and
none of the memory pressure has. There is one legitimate use: a batch job that genuinely needs to
run with a nearly-full heap to completion, where the limit would abort useful work and there is
no service-level consequence to a slow finish. For a request-serving application it is close to
never right, and the correct responses are to find the retention with a heap dump, bound the
cache, or size the heap for the real live set.

**★ How would you tell a GC death spiral apart from an application-level infinite loop, given a
production JVM you cannot restart yet?**
Both present as 100% CPU with no throughput, so start with a thread dump — `jcmd <pid>
Thread.print`. An infinite loop shows application code on the stack in one or more runnable
threads, and repeated dumps show it at the same place. A spiral shows GC threads doing the work
while application threads sit blocked in allocation or idle in the pool. If that is ambiguous,
the GC log settles it: back-to-back full collections with heap occupancy after collection barely
moving is the spiral, and it is unmistakable because the post-collection line is the one that
does not come down. A third confirmation is memory-pool metrics — old-generation occupancy after
collection flat against `-Xmx`. It matters to take these before restarting, because the restart
destroys the only evidence of which objects were retained, and a spiral almost always recurs.

**★ Why does the JVM clear all soft references before throwing this error, and what does that
imply for using them as a cache?**
Because the specification allows soft references to be cleared under memory pressure, and this is
the JVM's last opportunity to avoid an `OutOfMemoryError` — it sets `should_clear_all_soft_refs`
as the overhead counter approaches its threshold, so the next collection drops every soft
reference in the heap. The implication for cache design is unfortunate: a soft-reference cache
does not degrade gracefully under pressure, it collapses. Right up to the edge it holds
everything and provides no relief; at the edge it discards everything at once, so the hit rate
goes to zero in a single collection and the application's load on whatever the cache was
protecting — a database, a downstream service — spikes at the exact moment the JVM is already in
trouble. That is the opposite of what you want from a pressure valve, and it is the main argument
for an explicitly bounded cache with a real eviction policy instead. The JVM's behaviour here is
correct; it is soft references as a caching strategy that is wrong.

**★ Your GC log shows continuous full collections but the overhead limit never fires. Explain how
that is possible.**
Several ways, all from the source's conditions. The most likely is that the collections are
recovering more than 2% of the heap: the space test is not exceeded, so the counter never
increments, and the process thrashes forever while technically making progress — this is the
common case, and it is why "the limit will save us" is a bad assumption. Second, the counter
requires five *consecutive* qualifying full GCs and is reset by any that does not qualify, so a
heap oscillating across the boundary can run indefinitely without accumulating five in a row.
Third, if something is calling `System.gc()` — a monitoring agent, an RMI distributed-GC timer —
those collections are skipped by the checker entirely. And fourth, the collector may not
implement the check at all, which on JDK 25's default collector is precisely the situation, and
is the subject of [09b](09b-why-g1-never-throws-it.md).

{/* FOOTER */}
