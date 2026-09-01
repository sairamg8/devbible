---
title: "ZGC gives memory back to the operating system by default and stops doing so the moment you set `-Xms` equal to `-Xmx`, which is exactly the pairing every latency runbook recommends — and on a common Linux configuration a G1-versus-ZGC benchmark quietly gives huge pages to G1 only"
sidebar_label: "04c2 · ZGC memory and when not to"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, chapter "The Z Garbage Collector" — Setting the Heap Size, Returning Unused
> Memory to the Operating System, Using Large Pages, Enabling Large Pages On Linux, Enabling
> Transparent Huge Pages On Linux
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/z-garbage-collector1.html)),
> and "Available Collectors → Selecting a Collector"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/available-collectors.html));
> the JDK 25 `java` tool reference for `-XX:+ZUncommit`, `-XX:ZUncommitDelay`,
> `-XX:ZFragmentationLimit`, `-XX:+AlwaysPreTouch` and `-XX:+UseLargePages`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> and [`gc/z/z_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/z/z_globals.hpp)
> at tag `jdk-25+36`, where `ZUncommitDelay` is `5 * 60` and **`ZFragmentationLimit` is 5.0,
> which contradicts the man page's stated 25**.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Two of ZGC's most consequential behaviours are governed by flags people set for unrelated
reasons. Uncommitting unused memory — the feature that makes ZGC a good citizen in a
container — is switched off implicitly by the `-Xms` equals `-Xmx` pairing that every
latency-tuning guide recommends. And large pages, which the documentation says come with "no
real disadvantage", are configured differently for ZGC than for every other collector, in a way
that silently invalidates cross-collector benchmarks on common Linux defaults. This page is
both, plus a man-page default that the source contradicts, and the five situations where the
right answer is a different collector.**

## Returning memory, and the flag interaction that silences it

> *"By default, ZGC uncommits unused memory, returning it to the operating system. This is useful
> for applications and environments where memory footprint is a concern, but might have a
> negative impact on the latency of Java threads. You can disable this feature with the
> command-line option `-XX:-ZUncommit`. Furthermore, **memory will not be uncommitted so that the
> heap size shrinks below the minimum heap size, `-Xms`. This means this feature will be
> implicitly disabled if the minimum heap size, `-Xms`, is configured to be equal to the maximum
> heap size, `-Xmx`.**"*
>
> *"You can configure an uncommit delay by using `-XX:ZUncommitDelay=<seconds>`. The default is
> 300 seconds. This delay specifies for how long memory should have been unused before it's
> eligible for uncommit."*

confirmed in the source as `product(uintx, ZUncommitDelay, 5 * 60, ...)`.

**`-Xms` equal to `-Xmx` silently disables uncommit.** That pairing is standard advice for
latency-sensitive services and is repeated in the G1 chapter, so it arrives on ZGC command lines
by habit — and the tuning guide agrees it is right *for latency*:

> *"Allowing the GC to commit and uncommit memory while the application is running could have a
> negative impact on the latency of Java threads. If extremely low latency is the main reason for
> running with ZGC, consider running with the same value for `-Xmx` and `-Xms`, and use
> `-XX:+AlwaysPreTouch` to page in memory before the application starts."*

So the decision is explicit rather than accidental: **fixed heap plus pre-touch for latency, or
a floating heap for footprint.** What you must not do is set `-Xms` equal to `-Xmx` and then
wonder why the pod never gives memory back. In a container the usually-better third option is
`-XX:SoftMaxHeapSize` ([04c · What ZGC costs](04c-zgc-costs.md)), which gives ZGC a target to
aim at while keeping `-Xmx` as a reserve and leaving uncommit enabled.

`ZUncommitDelay` at 300 seconds also means the feature is slow by design — memory must have been
unused for five minutes. A service with a five-minute traffic cycle will never uncommit anything.

## Large pages, and the comparison trap

> *"Configuring ZGC to use large pages will generally yield better performance (in terms of
> throughput, latency and start up time) and comes with no real disadvantage, except that it's
> slightly more complicated to setup. The setup process typically requires root privileges, which
> is why it's not enabled by default."*

The guide's own worked setup, for a 16 GB heap on Linux x86 with 2 MB pages:

```
$ echo 9216 > /sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages
$ cat /sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages
$ java -XX:+UseZGC -Xms16G -Xmx16G -XX:+UseLargePages MyApplication
```

with the reasoning stated: 16 GB needs 8192 pages, and the example reserves 9216 *"to allow for
2GB of non-Java heap allocations to use large pages"* — because *"the heap along with other
parts of the JVM will use large pages for various internal data structures (such as code heap
and marking bitmaps)"*. Note also the warning that the `echo` *"is not guaranteed to be
successful if the kernel cannot find enough free huge pages"*, which is why the guide reads the
value back before starting the JVM.

The transparent alternative, and its two cautions:

> *"An alternative to using explicit large pages … is to use transparent huge pages. Use of
> transparent huge pages is usually not recommended for latency sensitive applications because it
> tends to cause unwanted latency spikes. However, it might be worth experimenting with to see if
> or how your workload is affected by it."*
>
> *"On Linux, using ZGC with transparent huge pages enabled requires kernel version 4.7 or
> later."*
>
> *"**ZGC uses shmem huge pages for the heap**, so the following kernel setting also needs to be
> configured: `echo advise > /sys/kernel/mm/transparent_hugepage/shmem_enabled`"*

and then the paragraph that should be printed on the wall of anyone running collector
comparisons:

> *"It is important to check these kernel settings when comparing the performance of different
> GCs. Some Linux distributions forcefully enable transparent huge pages for private pages by
> configuring `/sys/kernel/mm/transparent_hugepage/enabled` to be set to `always`, while leaving
> `/sys/kernel/mm/transparent_hugepage/shmem_enabled` at the default `never`. In this case, **all
> GCs but ZGC will make use of transparent huge pages for the heap**."*

On a distribution with that default, a G1-versus-ZGC comparison silently gives G1 huge pages and
denies them to ZGC, and the resulting numbers are about kernel configuration rather than about
collectors.

⚠️ The G1 tuning chapter, meanwhile, names THP as a *cause* of high system time: *"Particularly
in Linux, coalescing of small pages into huge pages by the Transparent Huge Pages (THP) feature
tends to stall random processes."* So "large pages" is two different features with opposite
recommendations, distinguished only by which sysctl you set, and the flag name
`-XX:+UseLargePages` does not tell them apart.

## A documentation conflict worth knowing

The man page says:

> *"`-XX:ZFragmentationLimit=percent` — Sets the maximum acceptable heap fragmentation (in
> percent) for ZGC. By default, this option is set to 25. Using a lower value will cause the heap
> to be compacted more aggressively, to reclaim more memory at the cost of using more CPU time."*

`z_globals.hpp` at tag `jdk-25+36` says:

```cpp
product(double, ZFragmentationLimit, 5.0,
        "Maximum allowed heap fragmentation")
        range(0, 100)

product(double, ZYoungCompactionLimit, 25.0,
        "Maximum allowed garbage in young pages")
        range(0, 100)
```

⚠️ **The man page's 25 appears to be stale**; the shipped default is 5.0, and 25.0 now belongs
to a different, generational-only flag that the man page does not document at all. I have not
found a release note that settles when the value moved, so the honest statement is: **trust the
source, verify with `-XX:+PrintFlagsFinal`, and do not quote the man page's number.** The same
caution applies to the man page's other ZGC entries, several of which describe the
non-generational collector.

## When ZGC is the wrong choice

- **A small heap.** The tuning guide's own useful range starts at *"a few hundred megabytes"*,
  and below 32 GB you are trading compressed oops away for a pause guarantee you may not need.
- **A CPU-limited container.** Barriers plus concurrent threads plus no spare cores equals worse
  latency than G1, not better.
- **Throughput is the metric.** *"At the cost of some throughput"* is in the first sentence of
  the chapter, and the honest comparison in that case is G1 versus Parallel, not G1 versus ZGC.
- **The heap is tightly sized.** Concurrent collection needs headroom; without it you get
  allocation stalls, which are harder to see than pauses.
- **The pause budget is already met.** If G1's p99 pause is 30 ms against a 200 ms budget,
  ZGC's improvement is unobservable and its costs are not.

The guide's own selection rule is narrower than the enthusiasm around it: *"If response time is
a high priority, then select a fully concurrent collector with `-XX:+UseZGC`."* High priority,
not "would be nice". See [06 · Choosing](06-choosing.md).

## Gotchas

**★ `-Xms` equal to `-Xmx` silently disables `ZUncommit`.**
The guide states it directly: memory is never uncommitted below `-Xms`, so equal values disable
the feature implicitly. That pairing arrives on ZGC command lines out of G1 habit, and the
result is a service that never returns memory while its operators believe it does.

**★ Uncommit is slow by design: 300 seconds of disuse before a page is eligible.**
`ZUncommitDelay` defaults to `5 * 60`. A workload whose idle troughs are shorter than five
minutes will never uncommit anything, and lowering the delay costs commit/uncommit churn, which
the guide warns *"could have a negative impact on the latency of Java threads"*.

**★ On many Linux distributions a G1-vs-ZGC benchmark gives huge pages to G1 only.**
ZGC uses shmem huge pages, and the common default leaves `shmem_enabled` at `never` while
`enabled` is `always`. The guide states the consequence: *"all GCs but ZGC will make use of
transparent huge pages for the heap"*. Check both sysctl values before believing any comparison.

**★ Transparent huge pages are recommended against for latency-sensitive work by the same
document that explains how to enable them.**
*"Use of transparent huge pages is usually not recommended for latency sensitive applications
because it tends to cause unwanted latency spikes."* Explicit large pages are the recommended
form, and they need root and a pre-configured pool. The G1 chapter goes further and names THP
as a cause of high system time in `gc+cpu`.

**★ Sizing the huge page pool to exactly `-Xmx` is not enough.**
The guide's example reserves 9216 pages for a 16 GB heap — 2 GB of slack — because *"the heap
along with other parts of the JVM will use large pages for various internal data structures
(such as code heap and marking bitmaps)"*. Reserve for the process, not for the heap.

**★ Writing to `nr_hugepages` can silently fail.**
*"Note that the above command is not guaranteed to be successful if the kernel cannot find
enough free huge pages to satisfy the request."* The guide reads the value back before starting
the JVM, and so should any automation that sets it.

**★ The man page's `ZFragmentationLimit` default of 25 does not match the source's 5.0.**
`z_globals.hpp` at `jdk-25+36` declares `ZFragmentationLimit` as 5.0; the 25.0 is
`ZYoungCompactionLimit`, a flag the man page does not mention. Verify with
`-XX:+PrintFlagsFinal` rather than quoting either document.

**★ `ZYoungGCThreads` and `ZOldGCThreads` are diagnostic flags.**
They need `-XX:+UnlockDiagnosticVMOptions` first, and ZGC is designed to size its own thread
counts. Reaching for them is nearly always a sign that the actual constraint is CPU quota.

**★ Switching to ZGC without measuring throughput is switching on one axis and hoping about
two others.**
The chapter's first paragraph says *"at the cost of some throughput"*; JEP 439's risk section
names barrier overhead; compressed oops are lost; headroom must grow. A change that improves
p99.9 pause time and costs 15% of peak requests per second may still be right — but it should
be a decision, not a discovery.

**★ Several ZGC entries in the `java` man page describe the collector that was removed.**
The man page still carries `ZGenerational`-era wording and at least one stale default. The
tuning guide's ZGC chapter has been updated for generational ZGC — it carries the *"As of JDK 24"*
note — so prefer it, and prefer the source over both.

## Interview questions

**★ Why is `-Xms` equal to `-Xmx` a more consequential choice under ZGC than under G1?**
Because it disables a feature ZGC has and G1 does not. ZGC uncommits unused memory by default,
returning it to the operating system after `ZUncommitDelay` seconds — but never below `-Xms`,
so setting the two equal disables uncommit implicitly. Under G1 the same setting only removes
resize work. The pairing is standard latency advice and the ZGC chapter endorses it for that
purpose — *"if extremely low latency is the main reason for running with ZGC, consider running
with the same value for `-Xmx` and `-Xms`, and use `-XX:+AlwaysPreTouch`"* — but it should be a
deliberate trade of footprint for latency, not something inherited from a G1 command line.
`-XX:SoftMaxHeapSize` is usually the better answer in a container, since it gives ZGC a target
without giving up the reserve or the uncommit behaviour.

**★ When would you *not* use ZGC?**
When the pause budget is already met — if G1's p99 pause is 30 ms against a 200 ms requirement,
ZGC improves a number nobody is measuring and costs throughput, footprint and headroom that
somebody is. When CPU is constrained, because barriers and concurrent threads have to be paid
for and a 1- or 2-CPU container has nothing to pay with. When the heap is small, since below
32 GB you give up compressed oops for a guarantee you may not need, and the guide's own useful
range starts at *"a few hundred megabytes"*. When the heap is tightly sized, because a
concurrent collector without headroom stalls threads instead of pausing. And when throughput is
the metric being optimised, in which case the honest comparison is not G1 versus ZGC but G1
versus Parallel.

**★ You are asked to benchmark G1 against ZGC on Linux. What do you check before you start?**
The transparent huge page settings, because they can decide the result on their own. ZGC uses
shmem huge pages for the heap, and many distributions ship with
`/sys/kernel/mm/transparent_hugepage/enabled` set to `always` while `shmem_enabled` stays at the
default `never` — in which case, in the guide's own words, *"all GCs but ZGC will make use of
transparent huge pages for the heap"*. That is a comparison of kernel configuration wearing a
collector's clothes. I would also equalise `-Xms` and `-Xmx` across both runs (which
incidentally disables ZGC's uncommit, so state it), give both the same CPU allocation, and
measure throughput and allocation stalls as well as pause times — because measuring only pauses
guarantees ZGC wins and tells you nothing about whether it should.

**★ How would you set up explicit large pages for a 16 GB ZGC heap, and what would you get
wrong the first time?**
The guide's procedure is to compute the page count — 16 GB divided by the 2 MB Linux x86 huge
page size is 8192 — reserve them by writing to
`/sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages` as root, read the value back to confirm
the kernel actually satisfied the request, and then start the JVM with `-XX:+UseLargePages`. The
thing to get wrong is reserving exactly 8192: the guide reserves 9216 because the JVM uses large
pages for non-heap structures too — *"code heap and marking bitmaps"* are its examples — so you
need slack for the process, not just for the heap. The second thing to get wrong is assuming
the `echo` succeeded; it can fail silently if the kernel cannot find contiguous free pages,
which is why the read-back is part of the documented procedure and not an optional check.

**★ ZGC is described as returning memory to the OS. Why does that not solve container
right-sizing on its own?**
Three reasons. The delay: pages must have been unused for `ZUncommitDelay`, 300 seconds by
default, so a workload with shorter troughs never uncommits. The floor: memory is never
uncommitted below `-Xms`, so the feature is only as useful as the gap between `-Xms` and
`-Xmx`, and is entirely disabled when they are equal. And the direction: uncommit reduces
*resident* memory but does nothing about the peak, and a container is killed on its peak. The
flag that actually shapes the peak is `-XX:SoftMaxHeapSize`, which gives the collector a target
below `-Xmx` and reserves the remainder for spikes. Container sizing as a whole is
[03 · Heap sizing in containers](../03-heap-sizing-in-containers/README.md).

{/* FOOTER */}
