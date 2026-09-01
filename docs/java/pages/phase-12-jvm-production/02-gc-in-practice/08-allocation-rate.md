---
title: "Allocation rate predicts garbage collection behaviour better than heap size does, because collection frequency is eden size divided by allocation rate and collection cost is proportional to what survives — so the two numbers you actually need are how fast you allocate and what fraction of it lives"
sidebar_label: "08 · Allocation rate"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "Garbage Collector Implementation → Generations" and "Factors Affecting Garbage
> Collection Performance → The Young Generation"
> ([garbage-collector-implementation](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-collector-implementation.html),
> [factors-affecting](https://docs.oracle.com/en/java/javase/25/gctuning/factors-affecting-garbage-collection-performance.html));
> the JDK 25 HotSpot sources at tag `jdk-25+36` —
> [`jfr/metadata/metadata.xml`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/jfr/metadata/metadata.xml)
> for the `ObjectAllocationSample`, `ObjectAllocationInNewTLAB` and `ObjectAllocationOutsideTLAB`
> event definitions, and
> [`gc/g1/g1HeapTransition.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/g1/g1HeapTransition.cpp)
> for the region summary the arithmetic below uses; and the Micrometer `JvmGcMetrics` binder
> source on GitHub (`micrometer-core`, `main` branch as of this date) for the meter names and
> their verbatim descriptions.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Almost every GC conversation starts with heap size, and heap size is the least predictive
number in the system. What determines how a collector behaves is how fast the application
produces garbage and how much of it survives — the first sets how often collections happen, the
second sets how much each one costs. Both are measurable, neither is usually measured, and a
service that knows them can reason about its GC behaviour without changing a single flag.**

## The two numbers, and the arithmetic that connects them

The tuning guide gives the cost model in one sentence:

> *"The costs of such collections are, to the first order, proportional to the number of live
> objects being collected; a young generation full of dead objects is collected very quickly."*

and the frequency model follows from how allocation works: objects are born in eden, eden fills,
a young collection happens. So:

```
collection frequency  ≈  allocation rate / eden size
collection cost       ≈  survivor volume  (not eden size, not heap size)
GC overhead           ≈  frequency × cost
```

**Three consequences, all counter-intuitive to somebody:**

1. **A high allocation rate with a low survival rate is nearly free.** Ten thousand short-lived
   objects per request cost almost nothing at collection time, because the collector copies
   survivors and never touches the dead. This is the whole point of the generational design —
   see [01 · Memory layout → 03b](../01-memory-layout/03b-the-weak-generational-hypothesis.md).
2. **A low allocation rate with a high survival rate is expensive.** Fewer collections, but each
   one copies a lot, and objects that survive repeatedly get promoted into the old generation
   where they must be found by concurrent marking rather than by a cheap young collection.
3. **Doubling eden halves the collection count and roughly doubles the survivors per
   collection.** That is why "just make the young generation bigger" is not a free win: total
   copying is roughly unchanged, and each individual pause grows.

The number that actually matters, and that nobody computes, is **allocation rate divided by
survival rate** — how much garbage you produce per byte of live data you create.

## Measuring it: four ways, in increasing effort

### 1 · Micrometer, if you already have it

The `JvmGcMetrics` binder publishes a counter whose description states the mechanism exactly:

- `jvm.gc.memory.allocated` — *"Incremented for an increase in the size of the (young) heap
  memory pool after one GC to before the next"*, base unit bytes.
- `jvm.gc.memory.promoted` — *"Count of positive increases in the size of the old generation
  memory pool before GC to after GC"*, base unit bytes, published only for generational
  collectors.
- `jvm.gc.live.data.size` — *"Size of long-lived heap memory pool after reclamation"*.
- `jvm.gc.max.data.size` — *"Max size of long-lived heap memory pool"*.
- `jvm.gc.pause` — *"Time spent in GC pause"*, tagged with `gc`, `action` and `cause`.
- `jvm.gc.concurrent.phase.time` — *"Time spent in concurrent phase"*.

**`rate(jvm_gc_memory_allocated_bytes_total[5m])` is your allocation rate**, and
`rate(jvm_gc_memory_promoted_bytes_total[5m])` is your promotion rate. Together with
`jvm.gc.live.data.size` those three panels answer more GC questions than any pause histogram.
Micrometer itself is [08 · Metrics with Micrometer](../08-metrics-with-micrometer/README.md).

⚠️ Note the definition of `jvm.gc.memory.allocated`: it is derived from young-pool size deltas
observed at collection boundaries, so it is an *estimate* sampled at collection frequency, not a
byte counter. It is more than accurate enough for a rate, and it will not agree exactly with a
JFR total.

### 2 · Arithmetic from the GC log

With `-Xlog:gc+heap=info` and `-Xlog:gc` you have everything you need:

```
allocation rate  ≈  (eden regions consumed × region size) / interval between collections
```

The `Eden regions: X->Y(Z)` line gives the count before and after, the region size is printed at
startup, and the interval comes from the timestamps. This works on any JVM with GC logging on and
requires no agent, no dependency and no restart — which makes it the technique to know for a
machine you have just been handed.

For a non-region collector, the equivalent is the whole-heap `usedBefore->usedAfter` figures from
consecutive lines: the heap grew from one collection's *after* value to the next one's *before*
value, and that growth is allocation.

### 3 · JFR, for where the allocation comes from

Rate tells you there is a problem; JFR tells you which line of code. Three events, from
`metadata.xml`:

```xml
<Event name="ObjectAllocationSample" category="Java Application" label="Object Allocation Sample"
       thread="true" stackTrace="true" startTime="false" throttle="true">
  <Field type="Class" name="objectClass" label="Object Class" />
  <Field type="long" contentType="bytes" name="weight" label="Sample Weight"
    description="The relative weight of the sample. Aggregating the weights for a large number
    of samples, for a particular class, thread or stack trace, gives a statistically accurate
    representation of the allocation pressure" />
</Event>
```

`jdk.ObjectAllocationSample` is **throttled** and carries a `weight`, which is the design that
makes it safe to leave on in production: you get a statistically accurate picture of allocation
pressure by class, thread or stack trace, at a bounded event rate. The two older events,
`jdk.ObjectAllocationInNewTLAB` and `jdk.ObjectAllocationOutsideTLAB`, are unthrottled and
per-allocation-ish; they are higher fidelity and much more expensive. JFR is
[06 · JFR and profiling](../06-jfr-and-profiling/README.md).

`ObjectAllocationOutsideTLAB` deserves separate attention: an allocation that did not fit in a
thread-local buffer took the slow path, and a high rate of those is either very large objects or
badly sized TLABs —
[01 · Memory layout → 03c2](../01-memory-layout/03c2-tlab-sizing-and-the-flags.md).

### 4 · Epsilon, for the total

Run the workload under `-XX:+UnlockExperimentalVMOptions -XX:+UseEpsilonGC` with a fixed heap and
it will exit when the heap is exhausted. The heap size divided by the time to exhaustion is the
allocation rate, uncontaminated by any collector's behaviour, and the total allocated for a
fixed unit of work is a single number you can put in a regression test.
[02c2 · Flags that still work](02c2-flags-that-still-work.md).

## What the number means, and where it comes from

There is no universal "too high" allocation rate — only comparisons against eden size, promotion
rate, the live set and yesterday — and the sources of allocation in a real service are almost
never the code that looks wasteful. Both are
[08b · Reading the rate, and where allocation comes from](08b-where-allocation-comes-from.md).

## Gotchas

**★ Collection *cost* is proportional to survivors; collection *frequency* is proportional to
allocation rate. They are different numbers with different fixes.**
The tuning guide: costs are *"proportional to the number of live objects being collected; a
young generation full of dead objects is collected very quickly."* A high allocation rate with a
low survival rate produces many cheap collections; a low allocation rate with a high survival
rate produces few expensive ones. Reading only one of the two numbers gets the diagnosis
backwards half the time.

**★ Doubling eden does not halve GC work.**
It halves the collection *count* and roughly doubles the survivors per collection, so total
copying is about the same and each pause is longer. It is a trade between frequency and
duration, not a reduction.

**★ `jvm.gc.memory.allocated` is an estimate sampled at collection boundaries.**
Micrometer's own description is *"Incremented for an increase in the size of the (young) heap
memory pool after one GC to before the next"* — it observes pool sizes at collection events
rather than counting bytes. Excellent for a rate, not authoritative for a total, and it will not
match JFR exactly.

**★ `jvm.gc.memory.promoted` is only published for generational collectors.**
The binder registers it conditionally. Its absence on a dashboard is not necessarily a bug.

**★ You can compute allocation rate from a GC log with no agent and no restart.**
Eden regions consumed times region size, divided by the interval between collections. That is
the technique for a machine somebody just handed you, and it works on any JVM that has
`-Xlog:gc` and `-Xlog:gc+heap=info` enabled.

**★ `jdk.ObjectAllocationSample` is throttled and weighted; the older TLAB events are not.**
The `weight` field's own description says aggregating weights *"gives a statistically accurate
representation of the allocation pressure"*. That design is what makes it safe in production.
`ObjectAllocationInNewTLAB` and `ObjectAllocationOutsideTLAB` are far more expensive and are for
short investigations.

**★ A high `ObjectAllocationOutsideTLAB` rate is a different problem from a high allocation
rate.**
It means allocations are bypassing the thread-local fast path — usually because the objects are
large. That is a TLAB sizing or an object size question, not a collector question.

**★ Why is allocation rate a better predictor of GC behaviour than heap size?**
Because it drives the variable that actually determines GC overhead. Collection frequency is
roughly eden size divided by allocation rate, and collection cost is roughly proportional to
what survives — the tuning guide states the second half explicitly: costs are *"proportional to
the number of live objects being collected; a young generation full of dead objects is collected
very quickly"*. Heap size only enters as the denominator of the frequency term and as a bound on
the live set. Two services with the same heap can have wildly different GC profiles because one
allocates ten times faster, and two services with the same allocation rate can differ just as
much because one keeps its objects. Those two numbers, allocation rate and survival, describe
the behaviour; the heap size mostly describes the headroom.

**★ How would you measure allocation rate on a JVM you have just been handed?**
Cheapest first. If Micrometer or an equivalent is already exporting metrics, the rate of the
`jvm.gc.memory.allocated` counter is the answer, alongside `jvm.gc.memory.promoted` and
`jvm.gc.live.data.size`. If not, and GC logging is on, it is arithmetic from the log: eden
regions consumed between two collections times the region size, divided by the elapsed time —
region size is printed at startup and the eden counts come from `gc+heap=info`. If I need to
know *where* the allocation comes from rather than how much, JFR's `jdk.ObjectAllocationSample`
gives class, thread and stack trace with a weight that aggregates into an accurate picture of
pressure, and it is throttled so it is safe to leave on. And if I can run the workload offline,
Epsilon with a fixed heap turns total allocation into one number.

**★ Someone proposes doubling `-Xmn` to reduce GC overhead. What do you say?**
That it will halve the number of collections and roughly double the survivors in each one, so
total copying work is about unchanged and individual pauses get longer. It is a trade between
frequency and duration, not a reduction — worth making if the problem is collection *frequency*
eating throughput, and harmful if the problem is pause duration. Under G1 specifically it is
worse than that: `-Xmn` sets `NewSize` and `MaxNewSize` to the same value, which the tuning
guide says *"overrides and practically disables pause-time control"*, so you also lose the
mechanism that was meeting your latency target. The measurement that decides it is whether GC
overhead is dominated by many short pauses or by few long ones, which `-Xlog:gc` answers
directly.

**★ What is the difference between `jdk.ObjectAllocationSample` and
`jdk.ObjectAllocationOutsideTLAB`?**
They answer different questions. `ObjectAllocationSample` is a throttled, weighted sample of
allocation in general — it is designed to be left on and to give a statistically accurate
picture of pressure by class, thread and stack. `ObjectAllocationOutsideTLAB` fires when an
allocation could not be satisfied from the thread's local allocation buffer and had to take the
slow path, which usually means the object was large relative to the TLAB. So a high rate of the
first is "this service allocates a lot"; a high rate of the second is "this service allocates
large things", which is a TLAB sizing question and, if the objects are large enough, a humongous
allocation question. They are also very different in cost: the first is throttled by design, the
second is not.

{/* FOOTER */}
