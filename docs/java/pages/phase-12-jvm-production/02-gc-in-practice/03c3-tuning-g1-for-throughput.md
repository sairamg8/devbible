---
title: "The documented way to get more throughput out of G1 is to raise the pause-time goal, which feels like the wrong direction until you notice that G1's only lever is collection frequency — and the second lever, pinning the heap so it never resizes, changes three unrelated things at once"
sidebar_label: "03c3 · Tuning G1 for throughput"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **HotSpot Virtual Machine Garbage Collection Tuning Guide,
> Release 25**, "Garbage-First Garbage Collector Tuning → Tuning for Throughput" and "Tuning
> for Heap Size", plus Table 8-1
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-garbage-collector-tuning.html)),
> and "Garbage-First (G1) Garbage Collector → Comparison to Other Collectors"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/garbage-first-g1-garbage-collector1.html));
> the JDK 25 `java` tool reference for `-XX:+UseStringDeduplication`,
> `-XX:StringDeduplicationAgeThreshold`, `-XX:+AlwaysPreTouch`, `-XX:+UseLargePages` and
> `-XX:GCTimeRatio`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html));
> and [`runtime/globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/globals.hpp)
> at tag `jdk-25+36` for `UseStringDeduplication` and `StringDeduplicationAgeThreshold`.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**G1's defaults are aimed at *"relatively small, uniform pauses at high throughput"* — a
compromise, not a maximum of either. When throughput is what you are judged on, the guide's
recommendations run in the opposite direction from every instinct: raise the pause goal,
enlarge the young generation, and stop the heap from resizing. This page is each of those,
what it actually does, and the specific cases where it makes things worse.**

## Tuning for throughput and for heap size

The guide's directions, which are the pause-time lever pushed the other way:

> *"G1's default policy tries to maintain a balance between throughput and latency; however,
> there are situations where higher throughput is desirable. Apart from decreasing the overall
> pause-times as described in the previous sections, the frequency of the pauses could be
> decreased. The main idea is to increase the maximum pause time by using
> `-XX:MaxGCPauseMillis`. The generation sizing heuristics will automatically adapt the size of
> the young generation, which directly determines the frequency of pauses. If that does not
> result in expected behavior, particularly during the Space-Reclamation phase, increasing the
> minimum young generation size using `-XX:G1NewSizePercent` will force G1 to do that."*

The chain is: bigger pause budget → G1 permits a bigger young generation → eden fills less
often → fewer collections → less total GC time. **The number of collections, not the length of
each one, is what determines GC overhead**, and the pause goal is the only thing bounding the
young generation upward.

> *"In some cases, `-XX:G1MaxNewSizePercent`, the maximum allowed young generation size, may
> limit throughput by limiting young generation size. This can be diagnosed by looking at
> region summary output of `gc+heap=info` logging. In this case the combined percentage of Eden
> regions and Survivor regions is close to `-XX:G1MaxNewSizePercent` percent of the total number
> of regions. Consider increasing `-XX:G1MaxNewSizePercent` in this case."*

That is a real, checkable diagnosis rather than a guess: count Eden plus Survivor regions in
the `gc+heap=info` summary, divide by total regions, and compare against 60. If you are at the
ceiling, no amount of raising `MaxGCPauseMillis` will help, because a different flag is
binding. (`G1NewSizePercent` and `G1MaxNewSizePercent` are both `EXPERIMENTAL` — see
[03c2 · The G1 flag table](03c2-the-g1-flag-table.md).)

Then the concurrent-work levers, which trade latency for throughput directly:

> *"Another option to increase throughput is to decrease the amount of concurrent work. In
> particular, concurrent remembered set updates often require a lot of CPU resources. The
> option `-XX:G1RSetUpdatingPauseTimePercent` can be used to move work from concurrent
> operation into the garbage collection pause."*
>
> *"An alternative to completely disabling concurrent refinement can be limiting the maximum
> number of refinement threads by changing the value of `-XX:G1ConcRefinementThreads`. By
> default, the heuristics allow G1 to use up to the number of parallel GC threads. Work
> exceeding the capacity of the refinement threads will spill over into the garbage collection
> pause."*

Both of those are covered in
[03b · The collection set and remembered sets](03b-the-collection-set-and-remembered-sets.md),
including the fact that `-XX:-G1UseConcRefinement` is a `DIAGNOSTIC` flag the guide recommends
without saying so.

And finally the heap-stability levers:

> *"Enabling the use of large pages by using `-XX:+UseLargePages` may also improve throughput.
> Refer to your operating system documentation on how to set up large pages."*
>
> *"You can minimize heap resizing work by disabling it; set the options `-Xms` and `-Xmx` to
> the same value. In addition, you can use `-XX:+AlwaysPreTouch` to move the operating system
> work to back virtual memory with physical memory to VM startup time. Both of these measures
> can be particularly desirable in order to make pause times more consistent."*
>
> *"Like other collectors, G1 aims to size the heap so that the time spent in garbage collection
> is below the ratio determined by the `-XX:GCTimeRatio` option. Adjust this option to make G1
> meet your requirements."*

`AlwaysPreTouch`, from the man page: *"Requests the VM to touch every page on the Java heap
after requesting it from the operating system and before handing memory out to the
application. By default, this option is disabled and all pages are committed as the
application uses the heap space."* It converts a distributed cost into a startup cost — which
is a straight win for a long-lived service and a straight loss for anything measured on
startup time, including a serverless function and a Kubernetes readiness probe with a short
`initialDelaySeconds`.

`GCTimeRatio` under G1 is ergonomically **12**, meaning a target of about 8% of time in GC
before the heap is grown — not the 99 (1%) that the shared default and every Parallel-oriented
article suggest. Lowering it makes G1 grow the heap more eagerly; raising it makes G1 tolerate
more GC time before growing. It is a heap-*sizing* control that people mistake for a
throughput throttle. See [01](01-what-a-collector-actually-promises.md).

## String deduplication, which is G1-only

> *"G1 can optionally try to deduplicate duplicate strings on the Java heap concurrently. …
> String deduplication is disabled by default. You can enable it using the option
> `-XX:+UseStringDeduplication`."*

The man page adds the requirement and the mechanism:

> *"`-XX:+UseStringDeduplication` — Enables string deduplication. By default, this option is
> disabled. To use this option, you must enable the garbage-first (G1) garbage collector.
> String deduplication reduces the memory footprint of `String` objects on the Java heap by
> taking advantage of the fact that many `String` objects are identical. Instead of each
> `String` object pointing to its own character array, identical `String` objects can point to
> and share the same character array."*

and the age gate, from `globals.hpp`: `StringDeduplicationAgeThreshold` defaults to **3**, with
the man page noting *"String objects that are promoted to an old heap region before this age
has been reached are always considered candidates for deduplication."*

Note the shape of the trade: deduplication is a **footprint** optimisation paid for in
concurrent CPU, so it belongs in a throughput discussion only as something to *turn off* when
CPU is the constraint. The full treatment is
[01 · Memory layout → 10c · String deduplication](../01-memory-layout/10c-string-deduplication.md).

## What the guide says G1 is not, one more time

The comparison section is worth re-reading in the context of a throughput problem, because it
says plainly that some of what you might be trying to tune away is inherent:

> *"Parallel GC can compact and reclaim space in the old generation only as a whole. G1
> incrementally distributes this work across multiple much shorter collections. This
> substantially shortens pause time at the potential expense of throughput."*
>
> *"G1 may exhibit higher overhead than the above collectors, affecting throughput due to its
> concurrent nature."*
>
> *"ZGC aims to provide significantly smaller pause times at further cost of throughput."*

If a flag search has run for a week and throughput is the metric, the honest reading is that
**the collector, not the flag set, is the variable**. Parallel exists for this case, is fully
supported on JDK 25, and is one flag away — [05 · Parallel and Serial](05-parallel-and-serial.md)
and [06 · Choosing](06-choosing.md).

## Gotchas

**★ Raising `MaxGCPauseMillis` is the documented way to increase throughput, and it feels
wrong.**
A longer permitted pause lets G1 grow the young generation, which reduces collection
*frequency*, which reduces total GC overhead. The guide's throughput section leads with
exactly this. Teams tend to only ever move that number downwards.

**★ If Eden plus Survivor regions sit at 60% of the heap, `G1MaxNewSizePercent` is the
constraint.**
The guide gives the diagnosis explicitly: look at `gc+heap=info` region summaries, and if the
combined Eden and Survivor share is close to `G1MaxNewSizePercent`, the young generation is
being capped rather than sized. That is a throughput ceiling with no other symptom, and
raising the pause goal will not move it.

**★ Setting `-Xms` equal to `-Xmx` changes three things at once.**
It removes heap resizing work (a `Sys`-time source in `gc+cpu`), it fixes the meaning of every
"percentage of heap in use" flag such as `G1NewSizePercent`, and it disables ZGC's uncommit
behaviour if you later switch collectors. Only the first is usually intended; all three happen.

**★ `-XX:+AlwaysPreTouch` moves cost to startup, which is not always where you want it.**
It touches every heap page before the application runs. On a long-lived service that removes
page-fault jitter from the steady state. On anything judged by startup time — a serverless
function, a pod with a short readiness delay, a CLI — it is a straight regression, and the
larger the heap the larger the regression.

**★ `-XX:+UseStringDeduplication` requires G1 and does nothing anywhere else.**
Man page: *"To use this option, you must enable the garbage-first (G1) garbage collector."*
It is one of the flags people carry when moving from G1 to ZGC, where it is inert.

**★ String deduplication buys footprint and costs CPU, so it is the wrong lever for a
throughput problem.**
It runs concurrently, comparing and merging character arrays. On a memory-constrained service
with many duplicate strings it is a real win; on a CPU-constrained one it is another
concurrent consumer competing with the application. If throughput is the metric, this flag
goes off, not on.

**★ `GCTimeRatio` under G1 is 12, not 99, and it controls heap growth rather than throughput
directly.**
The shared default is 99 (1% of time in GC); G1 sets 12 (about 8%) ergonomically. It is the
threshold at which G1 decides the heap is too small, so lowering it makes the heap grow
sooner. People reach for it expecting a throughput throttle and get a heap-sizing change.

**★ Large pages are an operating-system setup task, not a JVM flag you can just add.**
The guide says *"Refer to your operating system documentation on how to set up large pages"*,
and ZGC's chapter is blunter: the setup *"typically requires root privileges, which is why
it's not enabled by default"*. `-XX:+UseLargePages` on a host with no huge page pool does not
give you large pages.

**★ Moving refinement work into the pause raises latency by exactly as much as it lowers
concurrent CPU.**
`G1RSetUpdatingPauseTimePercent` and `G1ConcRefinementThreads` relocate a fixed amount of
work. The guide is explicit that anything the refinement threads cannot keep up with *"will
spill over into the garbage collection pause"*. There is no setting at which the work goes
away.

**★ The throughput ceiling may be the collector.**
The guide states it directly: G1 *"may exhibit higher overhead than the above collectors,
affecting throughput due to its concurrent nature"*, and Parallel *"can compact and reclaim
space in the old generation only as a whole"*, which is cheaper per byte. If a service has no
pause requirement and throughput is the metric, `-XX:+UseParallelGC` is a one-flag experiment
worth running before a week of G1 tuning.

## Interview questions

**★ You want more throughput out of a G1 service. What is the first flag you change and why?**
`-XX:MaxGCPauseMillis`, upwards. It reads backwards, but it is the guide's own first
recommendation: a larger permitted pause lets G1's sizing heuristics grow the young
generation, which directly reduces the *frequency* of collections and therefore total GC
overhead. If that does not help and the region summary in `gc+heap=info` shows Eden plus
Survivor sitting near 60% of regions, the constraint is `G1MaxNewSizePercent` rather than the
pause goal. Beyond that the guide points at reducing concurrent work — the refinement flags —
and at pinning `-Xms` to `-Xmx` with `AlwaysPreTouch` to remove resizing work. And if none of
that moves the number, the right experiment is `-XX:+UseParallelGC`, because the guide itself
says G1's concurrency costs throughput.

**★ Should you set `-XX:+AlwaysPreTouch`?**
It depends entirely on whether startup time is judged. What it does is commit and touch every
heap page before the application starts, moving page-fault and zeroing work out of the steady
state. On a long-lived service with a fixed heap, especially one where consistent pause times
matter, it is a clear win, and the guide recommends it alongside `-Xms` equal to `-Xmx` for
exactly that reason — high `Sys` time in `gc+cpu` is one of the symptoms it removes. On
anything where startup is measured — a serverless function, a pod whose readiness probe has a
short initial delay, a CLI tool — it is a regression proportional to heap size, because the
JVM now writes to every page before serving a request.

**★ Explain why fewer, longer pauses can be better than more, shorter ones.**
Because total GC overhead is dominated by the number of collections, not by the length of any
one of them. Each young collection has fixed costs that do not scale with the amount collected
— reaching a safepoint, disconnecting every thread's TLAB, merging remembered sets, scanning
external roots — so halving the collection count removes half of all of that. The variable
cost, copying live objects, is roughly proportional to survivors and barely changes if you
collect the same total volume in half as many passes. Under G1 the way to ask for this is to
*raise* `MaxGCPauseMillis`, because the pause goal is the constraint that keeps the young
generation small. The trade is exactly what you would expect: better throughput, worse tail
latency.

**★ When would you turn string deduplication off?**
When CPU is the constraint rather than memory. Deduplication runs concurrently, hashing and
comparing character arrays to merge identical ones, so it is another consumer of the same
cores the application and the concurrent marking threads are using. It is a footprint
optimisation: worth enabling on a memory-limited service that holds many duplicate strings —
parsed identifiers, repeated headers, enum-like values from a database — and worth disabling
anywhere throughput is the metric. It also only works under G1, so it silently becomes a
no-op if the service moves to ZGC, and a command line still carrying it is a signal that
nobody re-examined the flags after the collector changed.

**★ `-XX:+UseLargePages` appears in the tuning guide's throughput section. What has to be true
before it does anything?**
The operating system has to have a huge page pool configured, which the guide leaves to
*"your operating system documentation"* and ZGC's chapter describes as requiring root
privileges — on Linux, writing a page count to
`/sys/kernel/mm/hugepages/hugepages-2048kB/nr_hugepages`. Without that, the flag is accepted
and the JVM does not get large pages. There is also a related trap the ZGC chapter documents:
transparent huge pages are *"usually not recommended for latency sensitive applications
because it tends to cause unwanted latency spikes"*, and the G1 tuning chapter names THP
coalescing as a cause of high system time in `gc+cpu`. So "large pages" is two different
features with opposite recommendations, and the flag name does not distinguish them.

{/* FOOTER */}
