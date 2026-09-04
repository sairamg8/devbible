---
title: "Reserved, committed and resident are three different numbers that all get called memory, and only the third one can get your process killed"
sidebar_label: "01f · Reserved / committed / resident"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 Troubleshooting Guide**, "Diagnostic Tools →
> Native Memory Tracking → How to Monitor VM Internal Memory"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html)),
> and the **JDK 25 `java` tool reference** — `-XX:+AlwaysPreTouch`, `-Xms`, `-Xmx`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Reading an NMT report, a `top` output and a container metric in the same conversation
requires knowing that they measure three different things. Reserved is address space and is
free. Committed is intent and is nearly free. Resident is physical pages and is the only one
the kernel's OOM killer counts. Almost every "the JVM is using 12 GB" claim is a `VIRT`
reading, and almost every "we sized it from the load test and it died in production" story is
the gap between committed and resident closing over hours.**

## Reserved, committed, resident — three numbers that are never equal


Every footprint conversation goes wrong at exactly this point, because three different
numbers all get called "memory".

- **Reserved** — address space the JVM has claimed with `mmap(PROT_NONE)` or equivalent.
  Costs no physical memory. Appears in `VIRT` in `top` and as `reserved=` in NMT.
- **Committed** — address space the JVM has told the OS it intends to use. On Linux with
  default overcommit this still costs no physical memory *until a page is touched*. Appears
  as `committed=` in NMT.
- **Resident** — pages actually present in physical memory. This is `RSS`, this is what the
  cgroup counts, and this is the only one of the three that can get you OOMKilled.

The Troubleshooting Guide states the reserved/committed half of this outright:

> *"From the following sample output, you will see reserved and committed memory. Note that
> only committed memory is actually used. For example, if you run with `-Xms100m -Xmx1000m`,
> then the JVM will reserve 1000 MB for the Java heap. Because the initial heap size is only
> 100 MB, only 100 MB will be committed to begin with. For a 64-bit machine where address
> space is almost unlimited, there is no problem if a JVM reserves a lot of memory. The
> problem arises if more and more memory gets committed, which may lead to swapping or
> native out of memory (OOM) situations."*

That is why a JVM's `VIRT` in `top` is routinely a terrifying and completely meaningless
number, and why the 240 MB default code cache reservation costs nothing on a small service:
it is reserved address space, committed lazily as methods are compiled.

The gap between committed and resident is the one people miss. A JVM can commit a 4 GB heap
and have an RSS of 800 MB, because the pages it has never written to have never been faulted
in. That gap closes over time as the collector touches more of the heap, which is why a
service's RSS can climb for hours after start with no leak at all — and why the same service
can be fine in a load test that ran for ten minutes.

`-XX:+AlwaysPreTouch` collapses the gap deliberately at startup:

> *"Requests the VM to touch every page on the Java heap after requesting it from the
> operating system and before handing memory out to the application. By default, this option
> is disabled and all pages are committed as the application uses the heap space."*

It buys predictability — RSS reaches its steady state before the first request, so a
container that is going to be too small fails immediately instead of at hour six — at the
cost of a materially longer startup, because the JVM writes to every page of the heap. In a
Kubernetes deployment with a startup probe, that trade is often worth making; with `-Xms`
equal to `-Xmx` and `AlwaysPreTouch` on, the heap's contribution to RSS becomes a constant.

## Where each number is reported

| Number | JVM tool | OS tool | Counted by the cgroup? |
|---|---|---|---|
| Reserved | `reserved=` in NMT | `VIRT` in `top`, `Size` in `smaps` | no |
| Committed | `committed=` in NMT; `jcmd GC.heap_info` | — | no (not until touched) |
| Resident | not reported by the JVM | `RSS` in `top`/`ps`, `Rss` in `smaps` | **yes** |

The JVM cannot see the third row. Nothing inside a JVM reports RSS, because RSS is a property
the kernel maintains about the process, not a property the JVM maintains about itself. That
is the structural reason "the JVM said it was fine" and "the kernel killed it" are both true
statements about the same instant.

The Troubleshooting Guide's own sample NMT output shows the first two columns side by side —
this is the documentation's example, not a run of anything:

```
Native Memory Tracking:
Total: reserved=5699702KB, committed=351098KB
-                 Java Heap (reserved=4153344KB, committed=260096KB)
                            (mmap: reserved=4153344KB, committed=260096KB)
-                     Class (reserved=1069839KB, committed=22543KB)
                            (  Class space:)
                            (    reserved=1048576KB, committed=2816KB)
-                      Code (reserved=248022KB, committed=7890KB)
```

Read the ratios rather than the numbers. Reserved is 5.7 GB and committed is 351 MB — a
factor of sixteen. The `Class` line reserves a gigabyte for the compressed class space and
has committed under three megabytes of it. The `Code` line reserves the 240-megabyte code
cache and has committed under eight. A tool that reports the reserved column as "memory
usage" will tell you this JVM is using 5.7 GB; the process's RSS at that moment is lower
still than the 351 MB committed figure, because not all committed pages have been touched.


## Gotchas

**★ `VIRT` in `top` is not a number you can act on.**
It is reserved address space, and a 64-bit JVM reserves generously by design — the code cache
alone reserves 240 MB it may never commit, and some collectors reserve multiples of the heap
size in address space. Alerting on `VIRT` produces pure noise. `RSS` is the number the cgroup
counts and the only one that can kill you.

**★ Committed is not resident, so a JVM's RSS climbs for hours after startup with no leak.**
Pages that have been committed but never written are not in physical memory. As the collector
works its way across the heap, more of it gets faulted in, and RSS rises to meet committed.
A ten-minute load test will not show this; a six-hour soak test will. Size from a soak.

**★ `-XX:+AlwaysPreTouch` trades startup time for predictability, and both halves are real.**
It makes the heap's RSS contribution constant from the first request, so an undersized
container fails immediately instead of at 3 a.m. It also writes every page of the heap before
the application starts, which on a large heap is a startup delay long enough to trip a
startup probe that was tuned without it.

**★ Reserving is free; committing is nearly free; touching is not.**
This is why "the JVM reserved 240 MB for the code cache" is not a reason to lower
`ReservedCodeCacheSize` in a small container, and why lowering it can still help: the
reservation costs nothing, but a smaller reservation also means smaller segments, and the
segments *are* committed as they fill. Judge by NMT's `committed`, not by `reserved`.

**★ NMT itself is not free.**
The Troubleshooting Guide is specific: *"Enabling NMT will result in a 5-10 percent JVM
performance drop, and memory usage for NMT adds 2 machine words to all malloc memory as a
malloc header. NMT memory usage is also tracked by NMT."* That is an acceptable price to
diagnose an incident and a debatable one to leave on permanently; measure it on your own
workload before deciding.

**★ Adding up NMT's committed numbers will not equal RSS, in either direction.**
It can be lower, because committed pages that were never touched are not resident. It can be
higher, because the C allocator, JNI libraries and the executable's own mappings are not
tracked. Two independent sources of discrepancy pointing opposite ways is why "NMT total
minus RSS" is a diagnosis, not an error.

**★ `MALLOC_ARENA_MAX` is a glibc setting, not a JVM one, and it is invisible to NMT.**
glibc creates per-thread `malloc` arenas — up to eight times the core count by default — and
memory freed into an arena is not necessarily returned to the kernel. On a JVM with hundreds
of threads this can be hundreds of megabytes of RSS that no JVM tool will ever account for.
`MALLOC_ARENA_MAX=2` in the container environment is the usual mitigation, and
[11c · The footprint that is not in any region](11c-the-footprint-that-is-not-in-any-region.md)
is where it is worked through.

**★ Swap turns an OOMKill into a latency incident, which is worse.**
If the node has swap enabled and the cgroup permits it, an oversized JVM does not die — it
swaps, and a garbage collector walking a swapped heap produces pause times measured in
seconds. A clean kill is a better failure than a JVM that is technically alive and
tracing a heap through disk.

## Interview questions

**★ Explain reserved, committed and resident to someone reading an NMT report for the first
time.**
Reserved is address space the JVM has claimed but may never use — free on a 64-bit machine
and the reason `VIRT` is meaningless. Committed is what the JVM has told the OS it intends to
use; on Linux this still costs nothing until a page is written. Resident is what is actually
in physical memory, which is what the cgroup counts and what can get the process killed. The
documentation puts the first two plainly: *"only committed memory is actually used … there is
no problem if a JVM reserves a lot of memory. The problem arises if more and more memory gets
committed."* The third gap — committed to resident — is why RSS keeps rising for hours after
a service starts, with no leak involved.

**★ Why might you enable `-XX:+AlwaysPreTouch` in Kubernetes?**
To move the failure forward in time. Without it, the heap's contribution to RSS grows as
pages are touched, so a container that is 200 MB too small passes its load test and dies at
hour six. With `-Xms` equal to `-Xmx` and `AlwaysPreTouch` on, the heap reaches its full
resident size before the first request, so an undersized pod fails on the first rollout,
loudly, in front of the person who changed it. The cost is startup latency proportional to
heap size, which is why it pairs with a generous startup probe rather than a liveness probe.

**★ Your NMT total is 1.4 GB and RSS is 1.9 GB. What is the 500 MB?**
Something NMT does not track. In order of likelihood: glibc `malloc` arena fragmentation
(freed by the JVM, not returned to the kernel), a JNI library allocating with plain `malloc`,
the mapped executable and shared libraries themselves, and page cache attributable to
memory-mapped files. The Troubleshooting Guide is explicit that NMT covers only JVM
allocations: *"Since NMT doesn't track memory allocations by non-JVM code, you may have to use
tools supported by the operating system to detect memory leaks in native code."* `pmap -x` and
`/proc/<pid>/smaps` are the next tools.

{/* FOOTER */}
