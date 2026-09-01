---
title: "The JIT's output lives in native memory outside the heap, it defaults to 240 MB, and on a default JDK 25 it is not one region but three — which is why the famous \"CodeCache is full\" message is one your JVM will almost certainly never print"
sidebar_label: "05 · The code cache"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** for
> `-XX:ReservedCodeCacheSize`, `-XX:+SegmentedCodeCache`, `-XX:-TieredCompilation`, `-Xint` and
> the code-heap size flags
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the JDK 25 HotSpot source at tag `jdk-25+36` —
> `src/hotspot/share/compiler/compilerDefinitions.cpp` and `compilerDefinitions.hpp` for the
> ergonomic sizing and the tier levels, and `src/hotspot/share/code/codeCache.cpp` for
> `initialize_heaps` and the segment layout
> ([github.com/openjdk/jdk](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/code/codeCache.cpp)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Every method the JIT compiles produces machine code, and that machine code has to live
somewhere. It is not on the heap, it is not in metaspace, and it is not bounded by `-Xmx` — it
is the code cache, a native region of its own with its own default, its own segmentation and its
own failure mode. This page is the region and its structure. What happens when it fills, and why
the behaviour everyone describes is a JDK-14-era description, is
[05b · When the code cache fills](05b-when-the-code-cache-fills.md).**

## Where compiled code lives

A Java method begins life interpreted. When it gets hot, the JIT compiles it to native machine
code, and that code — an *nmethod*, in HotSpot's vocabulary — is written into the code cache.
Alongside the nmethods, the region holds the interpreter itself, stubs, adapters and the
compilers' own working buffers.

Three properties matter, and each of them surprises somebody:

**It is native memory, outside the heap.** `-Xmx` does not bound it, a heap dump does not
contain it, and it does not appear in heap-usage metrics. In NMT it is the **Code** category —
[02](02-the-process-map.md) has it on the map, [11](11-native-memory-tracking.md) has the
command.

**It is sized in hundreds of megabytes by default.** Which is a substantial fraction of a small
container's memory limit, and it is reserved address space regardless.

**It is not, on a modern JVM, one region.** That is the part with the most practical
consequences, and the rest of this page.

## The default is 240 MB, and where that number comes from

The man page, verbatim:

> *"**The default maximum code cache size is 240 MB; if you disable tiered compilation with the
> option `-XX:-TieredCompilation`, then the default size is 48 MB.** This option has a limit of
> 2 GB."*

The mechanism is in `compilerDefinitions.cpp`, and it explains the otherwise arbitrary pair of
numbers:

```cpp
FLAG_SET_ERGO(ReservedCodeCacheSize,
              MIN2(CODE_CACHE_DEFAULT_LIMIT, (size_t)ReservedCodeCacheSize * 5));
```

The platform default is `48*M`. With tiered compilation on — which it is by default — the JVM
multiplies it by five: **48 × 5 = 240 MB**. The 48 MB figure is not a separate constant chosen
for the non-tiered case; it is the base value that the tiered case scales up from.

The reason tiered compilation needs five times the space is the subject of the next section: it
produces more compiled code, because most methods get compiled more than once.

⚠️ **240 MB is *reserved*, not committed.** The JVM claims the address space up front and commits
as compilation proceeds. A service that compiles 20 MB of code has 240 MB of virtual reservation
and 20 MB of resident cost — the distinction [01f](01f-reserved-committed-and-resident.md) draws,
and the reason this region alarms people reading `pmap` far more often than it actually causes
problems.

## Tiers: why the same method is compiled twice

HotSpot has two compilers and five tier levels. From `compilerDefinitions.hpp`:

| Tier | What runs | Purpose |
|---|---|---|
| **0** | Interpreter | Everything starts here |
| **1** | C1, no profiling | Fast compilation, final code for methods deemed trivial |
| **2** | C1 with invocation and back-edge counters | Transitional |
| **3** | C1 with counters and full profiling (MDO) | **Gathers the profile C2 will use** |
| **4** | C2 (or JVMCI) | Fully optimised, profile-guided |

The normal path for a hot method is **0 → 3 → 4**: interpret, compile with C1 while collecting a
profile, then recompile with C2 using that profile. So a hot method occupies the code cache
*twice* — once as profiled C1 code and once as optimised C2 code — until the C1 version is
eventually made non-entrant and unloaded.

That is the whole reason tiered compilation multiplies the default by five, and it is also why
the region is segmented.

## Three heaps, not one

🔴 **`SegmentedCodeCache` is on by default on a normal JDK 25 JVM**, and this is easy to get
wrong, because `globals.hpp` declares it `false`. It is switched on **ergonomically**, and the
man page states the condition:

> *"enabled by default if tiered compilation is enabled and the reserved code cache size is at
> least 240 MB."*

The source adds a third condition the man page omits:

```cpp
// ... and the code cache contains at least 8 pages (segmentation disables advantage of huge pages).
if (FLAG_IS_DEFAULT(SegmentedCodeCache) && ReservedCodeCacheSize >= 240*M &&
    8 * CodeCache::page_size() <= ReservedCodeCacheSize) {
  FLAG_SET_ERGO(SegmentedCodeCache, true);
}
```

So the default configuration — tiered compilation on, 240 MB reserved — satisfies all three
conditions and segmentation is on.

The three segments, from `codeCache.cpp::initialize_heaps` and its own comments:

| Segment | Holds | Reclaimed? |
|---|---|---|
| `CodeHeap 'non-nmethods'` | The interpreter, stubs, adapters, compiler working buffers | **Never freed** |
| `CodeHeap 'profiled nmethods'` | **Tiers 2 and 3** — C1 code with counters and profiling | Yes, and often — this code is transitional by design |
| `CodeHeap 'non-profiled nmethods'` | **Tiers 1 and 4** — C1 without profiling, and C2/JVMCI output, plus native wrappers | Yes, when methods become cold or are made non-entrant |

The point of the split is lifetime. Profiled C1 code is *expected* to be discarded once C2 has
replaced it; fully optimised C2 code is expected to survive; the interpreter and stubs are
permanent. Mixing three populations with completely different lifetimes in one contiguous region
fragments it. Separating them means the churn happens in its own heap and does not scatter holes
through the long-lived code.

### ⚠️ Do not quote fixed per-segment defaults

There are numbers in circulation — 21 MB, 22 MB, 5 MB — presented as the segment sizes. Those
platform values apply only when the segment flags are set explicitly on the command line.

With defaults, `initialize_heaps()` computes them: **non-nmethod gets about 5 MB plus compiler
buffer space that scales with the C1 and C2 thread count**, and the remaining ~235 MB is split
**evenly between the profiled and non-profiled heaps**. The exact division therefore depends on
the machine's core count, because that determines the compiler thread count.

🔴 **If you set the segment sizes explicitly and they do not sum to `ReservedCodeCacheSize`, the
JVM refuses to start** — `vm_exit_during_initialization("Invalid code heap sizes", message)`.
This is the trap in hand-tuning this region: three flags that must add up, checked at launch,
with a hard failure rather than a warning.

⚠️ **`-Xint` forcibly disables segmentation**, with the source's own warning:
*"SegmentedCodeCache has no meaningful effect with -Xint"*. Reasonable — with no compilation
there are no nmethods to separate.

## What this means for a container

The code cache is a real line item in a memory budget and is routinely left out of one.

- **240 MB reserved** shows up in virtual size and in NMT's `reserved` column. It is not
  resident, and treating it as if it were leads people to shrink a region that has never been a
  problem for them.
- **Committed** grows with the amount of code compiled, which grows with the amount of code that
  is *hot*, which is a function of the application's size rather than its load. A large Spring
  application with a lot of proxies, generated accessors and lambdas commits substantially more
  than a small service.
- It is **not** covered by `-Xmx`, so heap-based capacity planning misses it entirely. This is
  the same point [01](01-heap-is-not-the-process.md) makes about the process as a whole, and the
  code cache is one of its larger terms.

**Frameworks that generate code multiply this.** Every dynamic proxy method, every generated
accessor, every lambda that becomes a hot call site is a method the JIT may compile — sometimes
twice. A service with tens of thousands of generated methods can commit a substantial fraction
of 240 MB without anything being wrong.

## Reading it

```bash
jcmd <pid> Compiler.codecache
```

*"Impact: Low"* — prints the code cache layout and, on a segmented JVM, each heap's size, used
and free figures. This is the first command for any code-cache question and it is safe on a
production JVM.

```bash
jcmd <pid> Compiler.codelist
```

*"Impact: Medium"* — lists every compiled method currently in the cache with its tier and
address. Useful when the question is *what* is in there rather than *how much*.

```bash
jcmd <pid> VM.native_memory summary
```

The **Code** category, described by the guide as *"Generated code"*, gives reserved and committed
figures alongside every other region — which is the right framing when the real question is
where the process's memory went.

⚠️ **The code cache is not in a heap dump**, for the same reason metaspace is not: it is native
memory holding machine code, not objects.

## Gotchas

**★ The code cache is native memory and `-Xmx` does not bound it.**
It is NMT's `Code` category. Heap-based capacity planning misses it entirely, and on a small
container its 240 MB reservation is a meaningful share of the address space even though most of
it is never committed.

**★ `SegmentedCodeCache` is `false` in `globals.hpp` and `true` on your JVM.**
It is set ergonomically when tiered compilation is on, `ReservedCodeCacheSize` is at least
240 MB, and the cache holds at least eight pages. Reading the declared default and concluding
segmentation is off is a specific, common mistake — and it changes what the failure message says
([05b](05b-when-the-code-cache-fills.md)).

**★ 240 MB is 48 MB × 5, not an independent constant.**
`ReservedCodeCacheSize` is scaled by five when tiered compilation is on, from a platform default
of 48 MB. This is why disabling tiered compilation drops the default to 48 MB rather than to some
unrelated figure.

**★ The published per-segment defaults are wrong for a default JVM.**
21 MB / 22 MB / 5 MB are the values used when the segment flags are set explicitly.
Ergonomically the JVM gives non-nmethod about 5 MB plus compiler buffers and splits the rest
evenly between profiled and non-profiled — a division that varies with core count.

**★ Setting the three segment sizes by hand can stop the JVM from starting.**
If they do not sum to `ReservedCodeCacheSize`, HotSpot calls
`vm_exit_during_initialization("Invalid code heap sizes", …)`. Three interdependent flags,
validated at launch, failing hard.

**★ A hot method occupies the cache twice for a while.**
Tier 3 profiled C1 code and tier 4 C2 code coexist until the C1 version is made non-entrant and
unloaded. This is normal, it is why tiered compilation needs five times the space, and it means
instantaneous usage figures during warm-up overstate the steady state.

**★ 240 MB reserved is not 240 MB used.**
The region is reserved address space committed on demand. `pmap` and NMT's `reserved` column both
show the reservation, and reading it as consumption is the same misreading that makes the
compressed class space look alarming ([04](04-metaspace.md)).

**★ Generated code is the reason a small service can have a large code cache.**
Proxies, generated accessors, lambdas and bytecode-generating frameworks all produce methods the
JIT may compile. Code cache usage tracks the amount of *code* that gets hot, not the request
rate.

## Interview questions

**★ Where does JIT-compiled code live, and what bounds it?**
In the code cache — native memory outside the Java heap, bounded by `-XX:ReservedCodeCacheSize`,
which defaults to 240 MB with tiered compilation enabled and 48 MB without it. `-Xmx` has no
effect on it and a heap dump does not contain it; it appears as the `Code` category in Native
Memory Tracking.

**★ Why is the default 240 MB with tiered compilation and 48 MB without?**
Because 240 is 48 × 5 — the source multiplies the platform default by five when tiered
compilation is on. Tiered compilation compiles most hot methods twice, once by C1 with profiling
at tier 3 and again by C2 at tier 4, and both versions occupy the cache until the C1 version is
unloaded. More compiled code needs more room.

**★ What is the segmented code cache, and why does it exist?**
On a default JDK 25 JVM the cache is split into three heaps: non-nmethods (interpreter, stubs,
adapters, compiler buffers, never freed), profiled nmethods (tiers 2 and 3), and non-profiled
nmethods (tiers 1 and 4, plus native wrappers). The three populations have completely different
lifetimes — permanent, transitional, and long-lived — and mixing them in one region fragments it.
Separating them keeps the churn contained.

**★ Is `SegmentedCodeCache` on by default?**
Yes, on a normal JVM, even though `globals.hpp` declares it `false`. It is enabled ergonomically
when tiered compilation is on, the reserved size is at least 240 MB, and the cache is at least
eight pages — which the default configuration satisfies. This is a good example of why reading a
declared default from the source is not the same as knowing the effective default.

**★ Your container is being OOMKilled and the heap is flat. Could the code cache be involved?**
It can contribute, and it is worth checking with `jcmd Compiler.codecache` and NMT's `Code`
category, but it is bounded by `ReservedCodeCacheSize`, so it cannot grow without limit the way
metaspace can. The more likely reading of a flat heap with a growing process is metaspace,
threads or direct buffers. What the code cache *does* explain is a large constant native
footprint on a service whose heap is small — 240 MB of reservation with tens of megabytes
committed is normal and is often missing from the memory budget.

**★ What is the difference between reserved and committed for this region, and which should you
plan against?**
Reserved is address space claimed at startup — the full 240 MB — and it shows in `pmap` and in
NMT's `reserved` column. Committed is memory actually backed, growing as methods are compiled.
Plan against committed for RSS and against reserved only for address-space concerns, which on
64-bit are essentially never a problem.

**★ Why is code cache usage related to the size of the application rather than to its load?**
Because a method is compiled once when it becomes hot, not once per invocation. Ten times the
traffic through the same code path adds nothing to the cache; ten thousand additional generated
methods that all get warm adds a great deal. That is why large frameworks with heavy code
generation are the ones that approach the limit.

{/* FOOTER */}
