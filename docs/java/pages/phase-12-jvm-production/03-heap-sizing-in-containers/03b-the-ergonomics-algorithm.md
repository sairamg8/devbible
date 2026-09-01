---
title: "The heap-sizing ergonomics is thirty lines of C++ with three branches, and reading it explains the two behaviours nobody predicts: a band of container sizes where extra memory buys you no heap at all, and a percentage flag that silently turns compressed oops off"
sidebar_label: "03b · The ergonomics algorithm"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot source at tag `jdk-25+36` —
> [`runtime/arguments.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/arguments.cpp)
> (`Arguments::set_heap_size`, `Arguments::limit_heap_by_allocatable_memory`,
> `Arguments::max_heap_for_compressed_oops`),
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp),
> [`runtime/globals_shared.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/globals_shared.hpp)
> (`ScaleForWordSize`),
> [`gc/z/zGlobals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/zGlobals.hpp),
> [`os/posix/os_posix.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/os/posix/os_posix.cpp);
> and the **JDK 25 `java` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> All arithmetic below is derived by hand from that source and is labelled as such — it is not
> the output of running anything.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**The man page tells you the defaults. It does not tell you how they combine, and the combination
has two consequences that look like bugs until you read the code: between roughly 250 MB and
500 MB of container memory the ergonomic heap is a flat constant regardless of how much memory
you add, and merely *mentioning* `MaxRAMPercentage` on the command line changes the JVM's
compressed-oops decision on a large container. Both fall straight out of `set_heap_size()`.**

## The code

`Arguments::set_heap_size()`, the part that matters, verbatim from `jdk-25+36`:

```cpp
  // If the maximum heap size has not been set with -Xmx,
  // then set it as fraction of the size of physical memory,
  // respecting the maximum and minimum sizes of the heap.
  if (FLAG_IS_DEFAULT(MaxHeapSize)) {
    julong reasonable_max = (julong)(((double)phys_mem * MaxRAMPercentage) / 100);
    const julong reasonable_min = (julong)(((double)phys_mem * MinRAMPercentage) / 100);
    if (reasonable_min < MaxHeapSize) {
      // Small physical memory, so use a minimum fraction of it for the heap
      reasonable_max = reasonable_min;
    } else {
      // Not-small physical memory, so require a heap at least
      // as large as MaxHeapSize
      reasonable_max = MAX2(reasonable_max, (julong)MaxHeapSize);
    }
```

Everything hinges on `MaxHeapSize`'s *default value*, which is being used here as a constant
rather than as the flag it will later become. From `gc_globals.hpp`:

```cpp
product(size_t, MaxHeapSize, ScaleForWordSize(96*M), "Maximum heap size (in bytes)")
```

and `ScaleForWordSize` in `globals_shared.hpp`:

```cpp
#ifdef _LP64
#define ScaleForWordSize(x) align_down((x) * 13 / 10, HeapWordSize)
#else
#define ScaleForWordSize(x) (x)
#endif
```

96 MiB × 13/10, aligned down to a heap word, is **≈ 124.8 MiB** on any 64-bit platform. That is
the provenance of the man page's otherwise mysterious *"A small heap is a heap of approximately
125 MB"* — it is not a tuning constant somebody picked for containers, it is the JVM's ancient
default maximum heap, scaled for 64-bit pointers.

## The three regimes, worked out

Let *P* be the container memory limit (what `os::physical_memory()` returns), and *D* ≈ 124.8 MiB.
With the default 25 / 50 percentages, the code says:

- if `0.5 P < D` → heap = `0.5 P`
- else → heap = `max(0.25 P, D)`

**Arithmetic, derived here by hand from the code above, not measured:**

| Container limit | Regime | Ergonomic max heap | Effective share |
|---|---|---|---|
| 128 MiB | small | 64 MiB | 50% |
| 200 MiB | small | 100 MiB | 50% |
| 249.6 MiB | boundary | 124.8 MiB | 50% |
| 256 MiB | flat | **124.8 MiB** | 48.8% |
| 320 MiB | flat | **124.8 MiB** | 39.0% |
| 448 MiB | flat | **124.8 MiB** | 27.9% |
| 499.2 MiB | boundary | 124.8 MiB | 25% |
| 512 MiB | percentage | 128 MiB | 25% |
| 1 GiB | percentage | 256 MiB | 25% |
| 4 GiB | percentage | 1 GiB | 25% |

The middle band is the surprise. **Between roughly 250 MiB and 500 MiB of container memory, an
unconfigured JVM's heap ceiling does not move.** Going from 256 MiB to 448 MiB — nearly doubling
what you pay for — buys the heap exactly nothing. The extra memory is not wasted, since the
native side has more room, but a team that raised the limit expecting a bigger heap and measured
no change in GC behaviour has just met this branch.

Set `MaxRAMPercentage` explicitly and the whole table collapses to a single line: heap =
`P × percentage / 100`, floored at *D* whenever `0.5 P ≥ D`.

## `InitialRAMPercentage` and the starting heap

Further down the same function:

```cpp
julong reasonable_initial = (julong)(((double)phys_mem * InitialRAMPercentage) / 100);
reasonable_initial = limit_heap_by_allocatable_memory(reasonable_initial);
reasonable_initial = MAX3(reasonable_initial, reasonable_minimum, (julong)MinHeapSize);
reasonable_initial = MIN2(reasonable_initial, (julong)MaxHeapSize);
```

`InitialRAMPercentage` defaults to 1.5625, which is exactly 1/64. On a 4 GiB container that is a
64 MiB starting heap under a 1 GiB (or, at 70 percent, 2.8 GiB) ceiling. The heap then expands
under GC pressure, and every expansion is a commit that the container is charged for and that the
GC log records. If your service does heavy work during startup — cache warming, a schema
migration, Spring's context refresh with a large classpath — the expansions land inside the
readiness window.

`MinHeapSize` is synchronised to `InitialHeapSize` when it was not set, which is why `-Xms` and
`-XX:InitialHeapSize` behave interchangeably in most configurations.

## The compressed-oops branch that fires because you named a flag

This is the most surprising thing in the function. Right at the top:

```cpp
  bool override_coop_limit = (!FLAG_IS_DEFAULT(MaxRAMPercentage) ||
                           !FLAG_IS_DEFAULT(MinRAMPercentage) ||
                           !FLAG_IS_DEFAULT(InitialRAMPercentage) ||
                           !FLAG_IS_DEFAULT(MaxRAM));
```

and further down, once the heap size is computed:

```cpp
      if (reasonable_max > max_coop_heap) {
        if (FLAG_IS_ERGO(UseCompressedOops) && override_coop_limit) {
          aot_log_info(aot)("UseCompressedOops and UseCompressedClassPointers have been disabled due to"
            " max heap %zu > compressed oop heap %zu. "
            "Please check the setting of MaxRAMPercentage %5.2f."
            ,(size_t)reasonable_max, (size_t)max_coop_heap, MaxRAMPercentage);
          FLAG_SET_ERGO(UseCompressedOops, false);
        } else {
          reasonable_max = MIN2(reasonable_max, max_coop_heap);
        }
      }
```

Two different behaviours, chosen by whether you touched one of those four flags:

- **You did not.** The ergonomic heap is **clamped** to `max_heap_for_compressed_oops()` —
  roughly 32 GiB with the default 8-byte object alignment — and compressed oops stay on. On a
  256 GiB container, default ergonomics gives you 32 GiB, not 64 GiB.
- **You did.** The JVM assumes you meant it, lets the heap exceed the threshold, and **turns
  compressed oops (and compressed class pointers) off**, logging a line under the `aot` tag that
  you will not see at default verbosity.

The practical consequence: on a very large container, `-XX:MaxRAMPercentage=75` can make every
reference in the heap 8 bytes instead of 4. Object footprint rises across the board, and the
extra heap you asked for is partly consumed by the change in representation. The layout side is
[09 · Compressed oops](../01-memory-layout/09-compressed-oops.md) and
[09b · Alignment and class pointers](../01-memory-layout/09b-alignment-and-class-pointers.md).

## The two clamps you will almost never hit

`ErgoHeapSizeLimit` (default 0, meaning "no extra limit") caps the ergonomic result if you set
it; `gc_globals.hpp` describes it as *"Maximum ergonomically set heap size (in bytes); zero means
use MaxRAM * MaxRAMPercentage / 100"*.

`limit_heap_by_allocatable_memory` divides the process's allocatable address space by
`MaxVirtMemFraction` (a `develop` flag, so a compile-time 2 on any production build) multiplied
by the collector's virtual-to-physical ratio. On 64-bit Linux, `os::has_allocatable_memory_limit`
returns true **only if `RLIMIT_AS` is finite**, so with no address-space rlimit this is a no-op.
Where it does apply, the collector's ratio matters: `GCArguments::heap_virtual_to_physical_ratio()`
returns 1 for everything except ZGC, and `zGlobals.hpp` declares

```cpp
// Virtual memory to physical memory ratio
const size_t      ZVirtualToPhysicalRatio       = 16; // 16:1
```

so under an `RLIMIT_AS`, ZGC's ergonomic heap is bounded by allocatable address space divided by
32 rather than by 2. ZGC reserving sixteen times the heap in *address space* is also worth
knowing for `vm.max_map_count` and for reading `VIRT` in `top`, which is
[01f · Reserved, committed and resident](../01-memory-layout/01f-reserved-committed-and-resident.md).

## Gotchas

**★ The whole block is skipped if `-Xmx` was set.**
`if (FLAG_IS_DEFAULT(MaxHeapSize))` guards everything above. No warning, no log line, no
diagnostic. [03c · Why not `-Xmx`](03c-why-not-xmx.md).

**★ The "approximately 125 MB" in the man page is a floor as well as a threshold.**
`MAX2(reasonable_max, MaxHeapSize)` means that once you are out of the small regime, the
ergonomic heap is never below ≈124.8 MiB even if your percentage says it should be. Setting
`-XX:MaxRAMPercentage=10` on a 512 MiB container asks for 51 MiB and gets 124.8 MiB.

**★ `phys_mem` is computed differently depending on whether you set a flag.**
When `override_coop_limit` is true and `MaxRAM` is default, the code sets `MaxRAM` ergonomically
to `os::physical_memory()`; when it is false, `phys_mem` is `MIN2(os::physical_memory(), MaxRAM)`.
The values coincide in the ordinary container case, but it means `MaxRAM` shows a different value
in `-XX:+PrintFlagsFinal` depending on whether you named a percentage flag.

**★ The compressed-oops disable is logged under the `aot` tag.**
`aot_log_info(aot)(...)` — not `gc`, not `os`. If you are hunting for why your object footprint
grew after a heap increase, `-Xlog:aot=info` is where the explanation is, which is not a place
anyone would think to look. Confirm the outcome directly instead:
`java -XX:+PrintFlagsFinal -version | grep UseCompressedOops`.

**★ `MaxHeapSize` is both a constant and a flag inside this function, in the same expression.**
`if (reasonable_min < MaxHeapSize)` compares against the *default*; two lines later
`FLAG_SET_ERGO(MaxHeapSize, ...)` writes the *result*. This is why grepping the source for a
"125 MB" constant finds nothing.

**★ The heap ceiling is fixed at startup and never revisited.**
Nothing in this function runs again. A cgroup limit changed under a running JVM — an in-place pod
resize, a systemd reload — changes what `jcmd VM.info` reports and changes nothing about
`MaxHeapSize`. [02 · Container awareness](02-container-awareness.md) covers the consequence.

**★ Percentages are applied to the limit, then rounded by heap alignment.**
The collector's heap alignment (region size for G1, granule for ZGC) rounds the final figure. A
computed 2.8 GiB does not appear as 2.8 GiB in `PrintFlagsFinal`; it appears as the nearest
aligned value below or at it. Do not read a small discrepancy as a bug.

**★ On a machine with a finite `RLIMIT_AS`, ZGC may get a much smaller heap than you asked for
and will not say why.**
This is rare in Kubernetes but common in tightly locked-down environments and in some CI
sandboxes. If ZGC's chosen heap looks inexplicably small, check `ulimit -v` before checking
anything else.

## Interview questions

**★ Where does "a small heap is approximately 125 MB" come from?**
From `ScaleForWordSize(96*M)`, the default value of the `MaxHeapSize` flag: 96 MiB scaled by
13/10 for 64-bit word size, which is 124.8 MiB. The ergonomics compares
`phys_mem × MinRAMPercentage / 100` against that constant to decide whether the machine is
"small". So the threshold is not a container-era decision at all — it is the JVM's traditional
default heap, and the small-heap rule is really "if half the memory would not even reach the old
default heap size, use half the memory".

**★ You raise a container's memory limit from 256 MiB to 448 MiB and GC behaviour does not
change. Why?**
Because with default flags that entire range sits in the flat band. Half of 256 MiB is 128 MiB,
which is already at or above the ≈124.8 MiB threshold, so the JVM takes
`max(0.25 × P, 124.8 MiB)` — and 25 percent of 448 MiB is 112 MiB, still below the floor. The
heap ceiling is 124.8 MiB at both limits. The extra memory went to the native side, which may
genuinely have needed it, but the heap did not move. Setting `MaxRAMPercentage` explicitly
removes the band.

**★ Does setting `-XX:MaxRAMPercentage` ever change something other than the heap size?**
Yes, and it is easy to miss. Naming any of `MaxRAMPercentage`, `MinRAMPercentage`,
`InitialRAMPercentage` or `MaxRAM` on the command line sets an internal
`override_coop_limit` flag. With it set, a heap that would exceed the compressed-oops addressable
range causes the JVM to **disable compressed oops** rather than clamp the heap; without it, the
JVM clamps the heap and keeps compressed oops. So on a very large container the same intended
heap size can produce two different object layouts depending on whether you got there by flag or
by default, and the explanation is logged under the `aot` tag.

**★ How would you prove which branch of the ergonomics your container took?**
`java -XX:+PrintFlagsFinal -version` inside the container, filtered for `MaxHeapSize`,
`InitialHeapSize`, `MinHeapSize`, `MaxRAM`, `MaxRAMPercentage` and `UseCompressedOops`. The
`{ergonomic}` versus `{command line}` versus `{default}` annotation on each line tells you who set
it. Pair that with `-Xlog:os+container=trace` for the input side — the cgroup limit the JVM
read — and you have the complete derivation from cgroup file to heap ceiling, with no guessing.

**★ Why does ZGC's reservation ratio appear in heap sizing at all?**
Because the ergonomic heap is bounded by *allocatable address space*, not just by physical
memory, and different collectors need wildly different amounts of address space per byte of heap.
`limit_heap_by_allocatable_memory` divides the allocatable limit by `MaxVirtMemFraction` times
`heap_virtual_to_physical_ratio()`, which is 1 for Serial, Parallel and G1 and 16 for ZGC. On
64-bit Linux the bound only exists when `RLIMIT_AS` is finite, so most containers never see it —
but where an address-space rlimit is imposed, ZGC is affected thirty-two times more strongly than
G1.

{/* FOOTER */}
