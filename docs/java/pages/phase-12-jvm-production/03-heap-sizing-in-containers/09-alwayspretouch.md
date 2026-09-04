---
title: "AlwaysPreTouch buys you nothing at steady state and one thing that is worth a great deal in a container: it moves the whole cost of your heap to the first second, where a sizing mistake is a failed rollout instead of an OOMKill on Thursday"
sidebar_label: "09 · AlwaysPreTouch"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** — `-XX:+AlwaysPreTouch`,
> `-Xms`, `-Xmx`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); and the
> JDK 25 HotSpot source at tag `jdk-25+36` —
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp)
> and
> [`gc/z/z_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/z_globals.hpp).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**The most dangerous property of a container-sized JVM is that a wrong number does not fail
immediately. `-Xmx` reserves address space, the heap commits lazily, committed pages become
resident only when they are first written, and so a heap ceiling that does not fit the container
produces a process that starts cleanly, passes every probe, serves traffic, and dies days later at
an unrelated moment. `AlwaysPreTouch` — with `-Xms` equal to `-Xmx` — collapses that timeline to
the first second of the first start. That is a deployment-safety argument, not a performance one,
and it is why the flag belongs in a container-sizing topic.**

## What it does

> *"`-XX:+AlwaysPreTouch` — Requests the VM to touch every page on the Java heap after requesting
> it from the operating system and before handing memory out to the application. **By default, this
> option is disabled and all pages are committed as the application uses the heap space.**"*

The source's description is broader than the man page's and worth noting:

```cpp
product(bool, AlwaysPreTouch, false,
        "Force all freshly committed pages to be pre-touched")
```

*"all freshly committed pages"* — not only the pages committed at startup. A collector that
uncommits and later re-commits heap memory will pre-touch again.

There are two neighbours:

```cpp
product(bool, AlwaysPreTouchStacks, false, DIAGNOSTIC,
        "Force java thread stacks to be fully pre-touched")
product_pd(size_t, PreTouchParallelChunkSize,
        "Per-thread chunk size for parallel memory pre-touch.")
```

`AlwaysPreTouchStacks` is `DIAGNOSTIC`, so it needs `-XX:+UnlockDiagnosticVMOptions`, and it
addresses a different region — thread stacks, whose resident-versus-reserved gap is
[06 · Thread stacks](../01-memory-layout/06-thread-stacks.md). `PreTouchParallelChunkSize` exists
because pre-touching a large heap serially would be slow; the work is parallelised.

## The three states, and which one the kernel bills you for

This is the whole argument, and it is
[01f · Reserved, committed and resident](../01-memory-layout/01f-reserved-committed-and-resident.md)
applied to one decision.

| | Reserved | Committed | Resident |
|---|---|---|---|
| Set by | `-Xmx` | `-Xms`, then heap expansion | first write to each page |
| Costs address space | yes | yes | yes |
| Costs physical memory | no | no | **yes** |
| Counted by the cgroup | no | no | **yes** |

Without pre-touch, a 2 GiB heap with `-Xms2g` is *committed* at startup but resident only as pages
are written. RSS therefore climbs for hours or days after the deploy, entirely invisibly, until it
crosses the limit. **The graph everyone reads as "a slow memory leak" is very often just a heap
being touched.**

With `-Xms` equal to `-Xmx` and `AlwaysPreTouch` on, all of it is resident before the first
request. RSS is flat from second one, at its true value.

## The configuration

```bash
# a deliberately front-loaded container
-Xms2g -Xmx2g -XX:+AlwaysPreTouch
```

or, keeping the percentage form:

```bash
-XX:InitialRAMPercentage=70 -XX:MaxRAMPercentage=70 -XX:+AlwaysPreTouch
```

`AlwaysPreTouch` without `-Xms` equal to `-Xmx` is much weaker: it only touches what has actually
been committed, so a heap that starts at the 1.5625 percent `InitialRAMPercentage` default has
almost nothing to touch and the deferred cost remains.

## What it costs

**Startup time**, proportional to heap size — the JVM writes to every page before running any
application code. On a large heap this is seconds, and it is added to the window your readiness
probe is watching. Raise `initialDelaySeconds` and `failureThreshold` accordingly, or you have
traded an obscure failure for an obvious one you did not intend.

**Memory, immediately.** The container's full heap footprint is charged from the first second.
Any bin-packing or autoscaling strategy that relied on pods growing gradually into their limits
stops working — which is a feature if you were about to be surprised by it later, and a real cost
if your cluster was deliberately overcommitted.

**Startup-sensitive deployments.** If you are optimising cold start — serverless, scale-to-zero,
CRaC, AOT caches, GraalVM native image — pre-touching is directly antagonistic to the goal. Those
topics are **10 · Packaging for deploy**, **11 · GraalVM native image** and **15 · CRaC**
*(none written yet)*.

## Gotchas

**★ It touches the heap. Nothing else.**
Metaspace, the code cache, thread stacks, GC structures and direct buffers all still grow lazily.
So RSS still climbs after startup, just by much less. Do not read a flat post-startup RSS as a
guarantee; read it as having removed the largest single contributor.
`AlwaysPreTouchStacks` covers one more region and is diagnostic-only.

**★ Without `-Xms` equal to `-Xmx` it does far less than people think.**
The default `InitialRAMPercentage` is 1.5625 percent. Pre-touching 1.5 percent of the heap at
startup does not change the RSS curve in any useful way. The two flags are a pair.

**★ It is a startup cost that lands inside your readiness window.**
Rolling deployments with tight readiness settings will start failing on services where they used
to pass, and the symptom — pods never becoming ready after a flag change — looks nothing like
"pre-touch is slow". Adjust the probe at the same time as the flag.

**★ Under ZGC, uncommit can undo it, and re-commit will re-touch.**
`z_globals.hpp` declares `product(bool, ZUncommit, true, ...)` and
`product(uintx, ZUncommitDelay, 5 * 60, ...)`, so ZGC returns unused heap memory to the operating
system after five minutes by default. The source's own description of `AlwaysPreTouch` is *"all
freshly committed pages"*, so the pages will be touched again when re-committed. A quiet period
followed by a traffic spike therefore reintroduces pre-touch work at exactly the wrong time.
Consider `-XX:-ZUncommit` if you are pre-touching under ZGC and want the footprint to stay put.

**★ Pre-touching does not stop the heap from being too big.**
It makes the mistake visible on day one instead of day five. That is enormously valuable and it is
not a fix. The fix is the subtraction in [04 · The memory budget](04-the-memory-budget.md).

**★ It changes what "memory used" means on your dashboards.**
Every pod jumps to its full heap footprint at startup, so a panel showing RSS across the fleet
will step up sharply on the deploy that introduces the flag. Warn whoever owns the alert
thresholds, or you will spend the rollout explaining a graph.

**★ It interacts with huge pages and NUMA, and the interactions are platform-specific.**
Pre-touch is often recommended alongside large pages, on the reasoning that faulting in a large
page later is more disruptive than faulting in a 4 KiB one. ⚠️ The details are platform- and
kernel-dependent and were not verified for this page; treat large-page configuration as a separate
exercise with its own measurement.

**★ It is not a latency optimisation for steady state.**
Once every page has been touched, a JVM with and without the flag are identical. The occasional
claim that pre-touch "improves GC performance" is really a claim about the first collection after
startup. Everything after that is unaffected.

## Interview questions

**★ What does `-XX:+AlwaysPreTouch` actually do, and why would you use it in a container?**
It makes the JVM write to every page of the heap when that memory is committed, before the
application gets it — the man page says *"touch every page on the Java heap after requesting it
from the operating system and before handing memory out to the application"*, and the flag is
disabled by default. The container argument has nothing to do with throughput: without it,
committed heap pages become resident only as they are first written, so the process's real memory
footprint climbs quietly for hours or days after the deploy. Combined with `-Xms` equal to `-Xmx`,
pre-touch makes the whole heap resident immediately, which means a heap ceiling that does not fit
the container limit fails at rollout rather than in the middle of a Thursday night.

**★ What is the cost, and when would you not use it?**
Startup time proportional to the heap, which lands inside the readiness window and can make a
rolling deploy fail if the probe was tuned tightly; and the full heap footprint charged from the
first second, which breaks any bin-packing that assumed gradual growth. I would not use it where
cold start is the product — serverless, scale-to-zero, CRaC restores, native images — because it is
directly opposed to the goal. I would also think twice on very large heaps, where the startup delay
becomes minutes rather than seconds.

**★ RSS on a pod climbs steadily for two days after every deploy and then plateaus just below the
limit. Leak or not?**
Probably not a leak. That shape is the signature of committed heap pages gradually becoming
resident, plus metaspace and the code cache filling as more of the application is exercised. The
test is cheap: set `-Xms` equal to `-Xmx` with `AlwaysPreTouch` and redeploy. If RSS is flat from
startup at roughly the level it used to reach after two days, the growth was page-touching and the
service is correctly sized but uncomfortably close to its limit. If it still climbs after that, the
growth is in a region pre-touch does not cover, and NMT will name it.

**★ Does `AlwaysPreTouch` help with the direct-memory or metaspace side of the budget?**
No. It applies to the Java heap only. Metaspace, the compressed class space, the code cache,
thread stacks, GC structures and direct buffers all still commit and become resident lazily.
`AlwaysPreTouchStacks` extends the idea to thread stacks but is a diagnostic flag requiring
`-XX:+UnlockDiagnosticVMOptions`, and there is no equivalent for the rest. So pre-touch removes the
largest single source of post-startup RSS growth and leaves the others intact — which is still the
best single-flag improvement available to the "is it a leak or is it just warming up?" problem.

{/* FOOTER */}
