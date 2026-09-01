---
title: "Cloud Native Buildpacks solve container sizing by computing an absolute -Xmx at container start from the cgroup limit minus five named regions, which is a better model than a single percentage — and it ships a 10 MiB direct-memory limit that breaks Netty applications"
sidebar_label: "04c · The memory calculator"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **Paketo Buildpacks** Java how-to
> ([paketo.io](https://paketo.io/docs/howto/java/)), the **BellSoft Liberica buildpack** README
> ([github.com](https://github.com/paketo-buildpacks/bellsoft-liberica)), and the
> **`paketo-buildpacks/libjvm`** source on `main` —
> [`calc/calculator.go`](https://github.com/paketo-buildpacks/libjvm/blob/main/calc/calculator.go),
> [`calc/memory_regions.go`](https://github.com/paketo-buildpacks/libjvm/blob/main/calc/memory_regions.go),
> [`calc/direct_memory.go`](https://github.com/paketo-buildpacks/libjvm/blob/main/calc/direct_memory.go),
> [`calc/reserved_code_cache.go`](https://github.com/paketo-buildpacks/libjvm/blob/main/calc/reserved_code_cache.go),
> [`calc/stack.go`](https://github.com/paketo-buildpacks/libjvm/blob/main/calc/stack.go),
> [`helper/memory_calculator.go`](https://github.com/paketo-buildpacks/libjvm/blob/main/helper/memory_calculator.go).
> Arithmetic below is derived here from those constants and labelled as such.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**If you built your image with `mvn spring-boot:build-image`, `pack build` or Spring Boot's Gradle
`bootBuildImage`, you are already using a container-sizing strategy — you just did not write it.
It is not `MaxRAMPercentage`. It reads the cgroup limit at container start, subtracts five named
regions, and writes an absolute `-Xmx` into `JAVA_TOOL_OPTIONS`. That is a *better* model than a
single percentage, because it names its assumptions. It is also opinionated, and two of its
defaults break real applications.**

## What it actually does

At container start, a launch helper reads the memory limit and computes a heap size by
subtraction. From `helper/memory_calculator.go`, the constants:

```go
ClassLoadFactor          = 0.35
DefaultHeadroom          = 0
DefaultMemoryLimitPathV1 = "/sys/fs/cgroup/memory/memory.limit_in_bytes"
DefaultMemoryLimitPathV2 = "/sys/fs/cgroup/memory.max"
DefaultMemoryInfoPath    = "/proc/meminfo"
DefaultThreadCount       = 250
MaxJVMSize               = 64 * calc.Tebi
```

and from `calc/`, the per-region defaults:

| Region | Default in `libjvm` | Emitted as |
|---|---|---|
| Direct memory | **10 MiB** | `-XX:MaxDirectMemorySize=` |
| Reserved code cache | 240 MiB | `-XX:ReservedCodeCacheSize=` |
| Stack | 1 MiB, × `ThreadCount` (250) | `-Xss` |
| Metaspace | `14,000,000 + 5,800 × loadedClassCount` | `-XX:MaxMetaspaceSize=` |
| Head room | 0 % of total | — |
| Heap | **whatever is left** | `-Xmx` |

The subtraction, from `calc/memory_regions.go`:

```go
return Size{
    Value: m.DirectMemory.Value + m.Metaspace.Value + m.ReservedCodeCache.Value +
           (m.Stack.Value * int64(threadCount)),
    Provenance: Calculated,
}, nil
```

and in `calc/calculator.go`, `Heap = TotalMemory − NonHeapRegions`. Every region whose value the
user did **not** supply is emitted as an explicit flag appended to `JAVA_TOOL_OPTIONS`. So a
buildpack-built image runs with an absolute `-Xmx`, an absolute `-XX:MaxMetaspaceSize`, an
absolute `-XX:MaxDirectMemorySize`, an absolute `-XX:ReservedCodeCacheSize` and an explicit
`-Xss` — five flags you did not write and will not find in your Dockerfile, because there is no
Dockerfile.

## The same 2 GiB container, calculated their way

**Arithmetic derived here from the constants above; no measurement.** Assume 25,000 loaded
classes (the calculator's own estimate is 35 percent of the classes it counted at build time,
across the JDK, your application and any agents):

```
metaspace   = 14,000,000 + 5,800 × 25,000  = 159,000,000 B  ≈ 151.6 MiB
direct                                                      =  10.0 MiB
code cache                                                  = 240.0 MiB
stacks      = 250 threads × 1 MiB                           = 250.0 MiB
head room   = 0 %                                           =   0.0 MiB
                                                              ----------
non-heap                                                    = 651.6 MiB

heap = 2048 − 651.6                                         = 1396 MiB  (68.2 % of the limit)
```

68 percent — within a couple of points of the 70 percent that
[04 · The memory budget](04-the-memory-budget.md) reached by an entirely different route. That
convergence is the useful takeaway: **for an ordinary Spring Boot service on a 2 GiB container,
roughly 70 percent is where a defensible calculation lands**, and two independent models
agreeing is worth more than either model's authority.

Note *what* the calculator charges, though. It budgets the **reserved** 240 MiB code cache and the
**reserved** 250 MiB of stacks, not their committed portions. That is deliberately conservative,
and it is why the calculator's heap is a little smaller than a committed-memory budget would
allow. It is trading heap for a hard guarantee that the worst case fits.

## Tuning it

The buildpack exposes the assumptions as environment variables rather than as flags, documented
in the Liberica buildpack README:

| Variable | Meaning | Default |
|---|---|---|
| `BPL_JVM_THREAD_COUNT` | *"the number of user threads at runtime"* | `250` |
| `BPL_JVM_LOADED_CLASS_COUNT` | *"the number of classes that will be loaded at runtime"* | *"35% of the number of classes"* |
| `BPL_JVM_HEAD_ROOM` | *"the percentage of headroom the memory calculator will allocated"* | `0` |
| `BPL_JVM_CLASS_ADJUSTMENT` | *"Absolute or percentage based adjustment of the memory calculator's class count"* | `100%` |

`BPL_JVM_CLASS_ADJUSTMENT` exists, in the README's own words, *"when the number of classes cannot
be reliably determined during build-time and workloads run into OOM situations"* — which is the
buildpack telling you that its metaspace estimate is a build-time guess about a runtime quantity.

To override a *region* rather than an assumption, put the flag in `JAVA_TOOL_OPTIONS` yourself:
the calculator parses `JAVA_TOOL_OPTIONS` first, marks any region it finds there as
`UserConfigured`, and does not emit its own value for it. Paketo's own documentation states the
precedence: *"User-provided flags will be appended to buildpack-provided flags. If the user and a
buildpack set the same flag, user-provided flags take precedence."*

```bash
# raise the direct-memory ceiling; everything else stays calculated
--env JAVA_TOOL_OPTIONS='-XX:MaxDirectMemorySize=256M'
```

## Gotchas

**★ The default direct-memory limit is 10 MiB, and it is an *explicit flag*, not a JVM default.**
`DefaultDirectMemory = DirectMemory{Value: 10 * Mebi}`, emitted as
`-XX:MaxDirectMemorySize=10M`. For a Spring MVC service that is generous. For anything on Netty —
WebFlux, gRPC, Reactor Netty's HTTP client, the modern Cassandra and Elasticsearch drivers — it is
a hard ceiling roughly an order of magnitude below what the stack wants, and the failure is
`OutOfMemoryError: Cannot reserve N bytes of direct buffer memory` rather than an OOMKill. Set
`-XX:MaxDirectMemorySize` yourself for any reactive or NIO-heavy service.
[04b · The direct-memory doubling](04b-the-direct-memory-doubling.md) is the JVM-side story; note
that the buildpack's 10 MiB and the JVM's "equal to `-Xmx`" are the two extremes of the same
setting.

**★ It sets `-Xmx`, which means `MaxRAMPercentage` in your chart does nothing.**
Exactly the mechanism in [03c](03c-why-not-xmx.md), but arrived at legitimately. If you add
`-XX:MaxRAMPercentage=75` to a buildpack image and nothing changes, this is why. Change
`BPL_JVM_*` or override the region in `JAVA_TOOL_OPTIONS` instead.

**★ The thread count is an assumption, not an observation.**
250 is a guess. A service with a 400-thread pool is under-budgeted by 150 MiB of stack; a
virtual-thread service with 20 platform threads has 230 MiB of budget it will never use, which
comes straight out of the heap. `BPL_JVM_THREAD_COUNT` is the knob, and getting it right is worth
more than most JVM tuning.

**★ The metaspace estimate is a build-time class count times 0.35.**
`ClassLoadFactor = 0.35`, applied to the classes the buildpack counted in the JDK, the
application and any agents. Dynamic class generation at runtime — heavy proxying, scripting, code
generation, a JPA provider that weaves — is not in that count. The result is a hard
`-XX:MaxMetaspaceSize` that can be too small, producing `OutOfMemoryError: Metaspace` in
production and nowhere else. That is what `BPL_JVM_CLASS_ADJUSTMENT` is for.

**★ Head room defaults to 0 percent.**
The calculator allocates the *entire* limit across the five regions with nothing left over. Every
byte it did not name — GC structures, JVM internal, symbol tables, the native allocator's slack,
NMT if you enable it, mapped buffers, page cache — has to come out of the gap between reserved and
committed in the regions it did name. That usually works, because it charges reservations. It
stops working the moment you shrink one of the reservations by hand.

**★ With no memory limit it falls back to `MemAvailable` from `/proc/meminfo`, which is the
host's.**
`/proc/meminfo` is not namespaced. A buildpack container with no memory limit therefore sizes
itself against the node's *available* memory at that instant — a number that depends on what else
happens to be running. If that read fails too, it logs *"WARNING: Unable to determine memory limit.
Configuring JVM for 1G container."* and assumes 1 GiB. Always set a memory limit.

**★ It reads the cgroup v1 path first, then v2.**
`memory.limit_in_bytes` before `memory.max`, and the literal string `max` is treated as unset. On
a v2-only node the v1 read simply misses and it moves on, so the ordering is harmless — but it is
the opposite of what a v2-first script would do, and worth knowing when you read the launch log.

**★ If the fixed regions do not fit, it refuses to start rather than producing a bad heap.**
`calculator.go` returns *"fixed memory regions require %s which is greater than %s available for
allocation"*. A container too small for 240 MiB of code cache plus 250 MiB of stacks plus
metaspace fails at launch with a message naming the arithmetic. This is good behaviour and the
opposite of what a bare `-Xmx` does.

**★ Buildpack images are not the only thing that sets `JAVA_TOOL_OPTIONS`.**
The calculator *appends* to whatever is already there and honours what it finds. An APM agent's
install script that overwrites the variable rather than appending will silently discard the
calculated flags — which is exactly the failure mode the JVM TI specification warns about when it
says the variable *"should not be overwritten, instead, options should be appended"*.

## Interview questions

**★ Your image is built with `spring-boot:build-image` and someone asks you to set
`MaxRAMPercentage`. What do you tell them?**
That it will have no effect, and why. The buildpack's memory calculator runs at container start,
reads the cgroup limit, subtracts direct memory, metaspace, the reserved code cache and
`threads × -Xss`, and writes the remainder as an absolute `-Xmx` into `JAVA_TOOL_OPTIONS`. Since
`-Xmx` is set, HotSpot's percentage ergonomics is disabled. The equivalent knobs are the
`BPL_JVM_*` environment variables — thread count, loaded class count, head room — or overriding a
specific region by putting the flag in `JAVA_TOOL_OPTIONS`, which the calculator detects and
respects.

**★ Is the buildpack's model better or worse than `MaxRAMPercentage`?**
Better in principle, because it names its assumptions. A percentage compresses "how many threads,
how many classes, how much direct memory, how big is the code cache" into one number that nobody
can audit; the calculator makes each a separate, overridable term and fails loudly when they do
not fit. It is worse in practice when its defaults do not match your service — 10 MiB of direct
memory for a Netty application, 250 threads for a virtual-thread service, a build-time class count
for an application that generates classes at runtime. The right posture is to use it and then set
the two or three terms you actually know something about.

**★ A WebFlux service works as a plain jar and throws
`Cannot reserve … bytes of direct buffer memory` as a buildpack image. Explain.**
The buildpack sets `-XX:MaxDirectMemorySize=10M` explicitly, because `libjvm`'s
`DefaultDirectMemory` is 10 MiB. As a plain jar there was no such flag, so the JVM's own default
applied — which is `Runtime.getRuntime().maxMemory()`, that is, the whole heap ceiling. Netty
happily allocated hundreds of megabytes of pooled direct buffers under the second regime and hits
a wall almost immediately under the first. The fix is to set `MaxDirectMemorySize` to a measured
value in `JAVA_TOOL_OPTIONS`, which the calculator will then leave alone.

**★ Why does the calculator charge the *reserved* code cache and stacks rather than the committed
amounts?**
Because it is computing a bound, not an estimate. Committed code cache and committed stack pages
grow over a process's lifetime and there is no runtime signal it could use at container start, so
it charges the worst case it can bound and gives the heap the remainder. The cost is a smaller
heap than a committed-memory budget would justify; the benefit is that the configuration cannot
be invalidated later by the code cache filling up or by every thread touching its whole stack.
That is a defensible trade for a general-purpose tool, and a slightly conservative one for a
service you have measured.

{/* FOOTER */}
