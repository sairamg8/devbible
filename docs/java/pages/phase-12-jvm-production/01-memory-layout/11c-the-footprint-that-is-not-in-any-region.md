---
title: "When Native Memory Tracking accounts for 1.2 GB and the kernel says the process is using 1.8 GB, the missing 600 MB is not an error in either number — it is everything the JVM did not allocate itself, and finding it means leaving the JVM's tooling behind entirely"
sidebar_label: "11c · The footprint outside every region"
sidebar_position: 44
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 Troubleshooting Guide** — the Native Memory Tracking
> scope statement quoted below
> ([docs.oracle.com/en/java/javase/25/troubleshoot/](https://docs.oracle.com/en/java/javase/25/troubleshoot/)) —
> the **JDK 25 `java` tool reference** for `-XX:MaxDirectMemorySize` and the Linux `proc(5)`,
> `pmap(1)` and `mallopt(3)` manual pages for the operating-system side. glibc arena behaviour
> checked against the glibc manual's malloc tunables documentation.
> JDK 25 · Spring Boot 4.1.0 · Linux containers assumed.
> **No sandbox and no container here** — commands and their documented behaviour only.
> **No captured `pmap`, `smaps` or NMT output**, and no invented byte counts.

**This is the last chunk of the memory map, and it is about the part of the map that has no
region on it. [11](11-native-memory-tracking.md) accounts for every byte the JVM allocated.
The kernel accounts for every byte the process holds. Those two numbers do not match, they are
not supposed to match, and the difference between them is where an entire class of production
incident lives — the one where the heap is flat, GC is healthy, NMT is unremarkable, and the
container is killed anyway.**

The troubleshooting guide draws the boundary in one sentence, and it is worth treating as the
thesis of this page:

> Native Memory Tracking *"tracks internal memory usage for a Java HotSpot VM. It does not track
> memory allocations by non-JVM code."*

Everything below is that second sentence, expanded.

## What is in the gap

When RSS exceeds NMT's committed total, the difference is drawn from a fairly short list. In
rough order of how often each one turns out to be the answer:

| Source | Why NMT cannot see it | How you confirm it |
|---|---|---|
| **The allocator's own overhead** — arenas, fragmentation, freed-but-unreturned pages | It is `malloc`'s bookkeeping, not the JVM's | Arena count, `MALLOC_ARENA_MAX`, or switching allocator |
| **Native libraries** — JDBC native drivers, compression, crypto, image and video codecs, ML runtimes | The library calls `malloc` directly | `pmap` for the mapping; the library's own knobs |
| **Memory-mapped files** — `FileChannel.map`, mapped index files, some embedded stores | Mapped pages are file-backed, not JVM-allocated | `pmap` shows the file backing the mapping |
| **JNI allocations by your own code or a dependency** | `malloc` from native code | Same as native libraries; often the hardest to attribute |
| **A native agent** — profiler, APM, security agent | Allocates outside the JVM's accounting | Check what is attached; `Internal` in NMT may also move |
| **The executable and its shared libraries** | Not allocation at all — mapped text and data | `pmap`; small and constant, so rarely the answer |
| **Something else in the container** — a sidecar, a shell, a log shipper | Not this process at all | The container's own accounting, not the JVM's |

🔴 **Rule out the last row first.** "The JVM is using too much memory" is asserted far more often
than it is checked, and a cgroup limit is shared by everything in the container. Establishing
which process was actually killed costs one command and is the single most common way this
investigation goes wrong at step one.

## The allocator is usually the answer, and it is the least intuitive one

The most frequent explanation for an unexplained gap is not a leak at all. It is that the C
library's allocator is holding memory it is not using.

The mechanism matters because it makes the behaviour predictable rather than mysterious.
**glibc's `malloc` uses multiple arenas** — independent pools — so that threads allocating
concurrently do not contend on a single lock. It creates them on demand, up to a limit derived
from the core count, and each arena grows independently. Two consequences follow:

- **A highly threaded process can hold many arenas**, each with its own free space, and the sum
  of that free space is real committed memory that is not in use.
- **Freed memory is often not returned to the kernel.** The allocator keeps it for the next
  allocation, which is the right call for performance and the wrong-looking result on a memory
  graph. RSS goes up under load and does not come back down after.

That second point is the shape people misread as a leak: memory rises during a traffic spike and
plateaus. A leak keeps rising. **Allocator retention plateaus.** Distinguishing the two is mostly
a matter of watching long enough across more than one spike.

The environment variable that bounds arena count is documented by glibc:

```bash
MALLOC_ARENA_MAX=2      # bound the number of malloc arenas
```

⚠️ **This is a trade, not a fix.** Fewer arenas means less retained memory and more lock
contention between allocating threads. It is a common recommendation for JVM containers and it
is frequently applied without measuring the throughput side. Set it, then measure both numbers.

The other move is to change allocator entirely — **jemalloc** or **tcmalloc** via `LD_PRELOAD`.
Both have different retention behaviour from glibc, and jemalloc in particular has built-in
allocation profiling, which turns "something native is allocating" into "*this* call stack is
allocating". When the gap is large and its source is genuinely unknown, that profiling is often
the only thing that will name it.

## Direct and mapped buffers sit on the boundary

Direct `ByteBuffer`s are the confusing case, because they are half in and half out of the JVM's
accounting: allocated through a Java API, held by a Java object, but living in native memory
rather than the heap. They are one of the few things in this chapter that NMT *can* see, which is
why checking NMT before concluding "native library" matters.

⚠️ **Which category they land in is the weakest claim on this page.** `Other` is the usual answer,
but the troubleshooting guide defines `Other` only as *"Memory not covered by another category"*
and does not name direct buffers. **Confirm against your own NMT report rather than trusting the
category name here.** The reliable instrument for direct buffers specifically is
`BufferPoolMXBean` — or Micrometer's `jvm.buffer.*` meters, which are built on it — whose pool
names (`"direct"`, `"mapped"`) come straight from the JDK source.

They are bounded by `-XX:MaxDirectMemorySize` — and 🔴 **its default is not a fraction of the
heap, it is the whole heap size again.** The `java` man page does not document this; the JDK
source does. `jdk/internal/misc/VM.java`, verbatim: *"The initial value of this field is
arbitrary; during JRE initialization it will be reset to the value specified on the command line,
if any, **otherwise to `Runtime.getRuntime().maxMemory()`**."* So an unset
`MaxDirectMemorySize` gives you a **second budget equal to `-Xmx`**, and raising `-Xmx` or
`MaxRAMPercentage` silently raises the worst-case native ceiling with it. This is the single most
consequential fact for container sizing in this chapter.

⚠️ Note also, from `Bits.tryReserveMemory`: *"-XX:MaxDirectMemorySize limits the total **capacity**
rather than the actual memory usage, which will differ when buffers are page aligned."*

Direct buffers are reclaimed only when the `ByteBuffer` object
itself becomes unreachable and its `Cleaner` runs. That indirection is the whole problem: **the
native memory's lifetime is tied to a Java object's collection**, so a heap with plenty of room
has no pressure to collect, and the native side can exhaust while the heap looks idle.
[07 · Direct and mapped buffers](07-direct-and-mapped-buffers.md) owns the mechanism.

🔴 **Memory-mapped files are NOT bounded by `MaxDirectMemorySize`, or by anything else.**
`FileChannelImpl` contains no call to `Bits.reserveMemory` at all, and exposes its own pools —
`"mapped"` and `"mapped - 'non-volatile memory'"` — entirely separate from the `"direct"` pool
that `MaxDirectMemorySize` governs. **No JVM flag caps mapped memory.** This is widely assumed
otherwise, and it means a service that memory-maps large files has an unbounded native footprint
by design.

Beyond being unbounded, mapped files are routinely misread. `FileChannel.map` maps file pages
into the address space; the resident portion counts toward RSS, but those pages are **file-backed
and reclaimable** — the kernel can drop them under pressure and read them again from disk. A
process with a large mapped index looks enormous in RSS and is not, in the sense that matters.
Whether the container's memory controller agrees with that distinction is a question about the
cgroup version and configuration, and is worth establishing rather than assuming.

Knowing *what* can be in the gap is half of it. **How to go and look — the four commands, in the
order that eliminates the most first — is [11d · Finding it outside the JVM](11d-finding-it-outside-the-jvm.md).**

## Gotchas

**★ `-XX:MaxDirectMemorySize` defaults to the value of `-Xmx`, not to a share of it.** The man
page hides this behind "the JVM chooses the size automatically"; `VM.java` sets it to
`Runtime.getRuntime().maxMemory()`. So the worst-case native budget tracks the heap budget, and
raising `-Xmx` raises both. Size containers for heap **plus** a direct budget of the same size
unless you set the flag explicitly.

**★ Nothing at all bounds memory-mapped files.** `MaxDirectMemorySize` governs the `"direct"`
pool; mapped buffers use separate pools and never call `Bits.reserveMemory`. If a service maps
large files, its native footprint has no JVM-level ceiling and the only control is how much you
map.

**★ NMT's total will never equal RSS, and that is not a bug.** They measure different things:
JVM-committed bytes versus resident pages. Treating the difference as an error rather than as a
category of memory leads people to distrust a tool that is working correctly.

**★ RSS that rises and plateaus is allocator retention, not a leak.** glibc keeps freed memory for
reuse rather than returning it to the kernel. A leak keeps rising; retention flattens. Telling
them apart requires watching across more than one load spike, and the fixes are unrelated.

**★ `MALLOC_ARENA_MAX` trades memory for lock contention.** It is widely recommended for JVM
containers and widely applied without measuring the other side. Fewer arenas means allocating
threads contend more. Measure throughput as well as RSS.

**★ Check `Other` in NMT before blaming a native library.** Direct `ByteBuffer`s land there, and
they are a far more common cause of "native" growth in a Java service than an actual native
library is. The category's uninformative name is why people skip it.

**★ A direct buffer's native memory is freed when a Java object is collected.** So a heap under no
pressure creates no pressure to reclaim native memory, and `OutOfMemoryError: Direct buffer
memory` can happen while the heap is nearly empty. The two budgets are separate and only one of
them has a collector watching it.

**★ Memory-mapped files inflate RSS with reclaimable pages.** They are file-backed; the kernel can
drop them and re-read from disk. A process with a large mapping is not using that memory in the
way an anonymous allocation uses it. Whether the cgroup agrees depends on its configuration —
check rather than assume.

## Interview questions

**★ NMT reports 1.2 GB committed and the container's RSS is 1.8 GB. What do you conclude?**
That roughly 600 MB is memory the JVM did not allocate, because the troubleshooting guide is
explicit that NMT *"does not track memory allocations by non-JVM code"*. That is a finding rather
than a discrepancy, and it redirects the whole investigation outside the JVM: the C allocator's
arenas and retained free space, native libraries called through JNI, memory-mapped files, an
attached native agent, or another process sharing the container. The next tools are `pmap -X` and
`/proc/<pid>/smaps_rollup`, not `jcmd`. I would also check NMT's `Other` category first, because
direct byte buffers are the most common "native" growth that is in fact visible to NMT.

**★ A service's RSS climbs during every traffic spike and never comes back down, but the heap is
flat and NMT shows nothing growing. Leak or not?**
Most likely not a leak — most likely glibc's allocator retaining freed memory. It keeps freed
blocks in its arenas for reuse rather than returning pages to the kernel, so RSS ratchets up with
peak load and stays there. The distinguishing test is shape over time: allocator retention
plateaus at the high-water mark of demand, while a leak keeps rising across spikes even when load
returns to baseline. If it is retention, the levers are `MALLOC_ARENA_MAX` to bound the number of
arenas — accepting more allocator lock contention — or switching to jemalloc or tcmalloc, whose
retention behaviour differs and which can also profile allocations by call stack.

**★ Why can an `OutOfMemoryError` reading `Cannot reserve N bytes of direct buffer memory` happen while the heap is almost empty?**
Because a direct `ByteBuffer`'s native memory is reclaimed only when the Java `ByteBuffer` object
becomes unreachable and its `Cleaner` runs — and collection is driven by *heap* pressure. A heap
with plenty of free space has no reason to collect, so the small Java objects holding large
native allocations survive, and the native budget bounded by `-XX:MaxDirectMemorySize` exhausts
while the heap sits idle. It is a lifetime-coupling problem: two budgets, one collector, watching
the wrong one.

**★ Someone proposes setting `MALLOC_ARENA_MAX=1` on every Java container in the fleet. React.**
The direction is defensible and the value is aggressive. Bounding arenas genuinely reduces
retained free memory, and it is a common recommendation for JVM containers precisely because the
JVM is highly threaded and therefore creates many arenas. But arenas exist to stop allocating
threads contending on one lock, so setting it to 1 maximises that contention, and the cost lands
on exactly the workloads that motivated the change. I would treat it as a per-service measured
change — RSS *and* throughput, before and after — rather than a fleet-wide default, and I would
compare it against simply switching allocator, which addresses the same problem without
serialising allocation.

{/* FOOTER */}
