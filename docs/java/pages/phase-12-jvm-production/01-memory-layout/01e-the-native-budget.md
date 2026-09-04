---
title: "The native side of a JVM is not a rounding error but a budget of its own, and the only honest way to size a container is to measure it rather than to guess a percentage"
sidebar_label: "01e · The native budget"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JDK 25 `java` tool reference** — `-Xmx`,
> `-XX:MaxRAMPercentage`, `-XX:MinRAMPercentage`, `-XX:MaxRAM`, `-XX:-UseContainerSupport`,
> `-Xss`, `-XX:ReservedCodeCacheSize`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the **JDK 25 Troubleshooting Guide**, "Diagnostic Tools → Native Memory Tracking"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/diagnostic-tools.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**Container sizing policy belongs to `03 · Heap sizing in containers` *(not written yet)*.
What belongs here, in the memory-layout topic, is the arithmetic underneath it: what the
non-heap regions of a JVM actually cost, why a percentage beats an absolute number, and the
ordered set of questions that turns "the process is too big" into "this region grew". Get
the arithmetic and the ordering right and the sizing policy becomes a one-line decision;
get them wrong and no `-Xmx` value is correct for long.**

## The arithmetic nobody does before setting `-Xmx`

Take the single most common production misconfiguration: a container with a 1 GB memory
limit and `JAVA_OPTS=-Xmx1g`. The reasoning is "the container has a gigabyte, give the JVM a
gigabyte". What that actually says is: *the Java object heap alone may grow to the entire
container limit, and everything else is on top of it*.

Everything else, for an ordinary Spring Boot service, is not small:

| Region | Rough scale | Set by |
|---|---|---|
| Metaspace | grows with class count; a Boot app loads many thousands | unbounded by default |
| Code cache | **240 MB reserved** under tiered compilation | `-XX:ReservedCodeCacheSize` |
| Thread stacks | **1024 KB** each on Linux/x64, **2048 KB** on Linux/AArch64 | `-Xss` × platform threads |
| GC metadata | scales with heap size and cross-region reference density | the collector |
| Direct buffers | every NIO channel, every Netty arena | `-XX:MaxDirectMemorySize` |
| Allocator slack | glibc per-thread arenas, never returned | `MALLOC_ARENA_MAX` |

The thread-stack line alone is instructive. The `java` man page gives the platform defaults
verbatim — Linux/x64 1024 KB, Linux/AArch64 2048 KB, macOS/x64 1024 KB, macOS/AArch64
2048 KB — and a 200-thread Tomcat pool on AArch64 reserves 400 MB of stack address space
before a single request arrives. That is not committed memory, but the pages that *are*
touched are, and the arithmetic is [06 · Thread stacks](06-thread-stacks.md).

The 1 GB container will be killed, and the heap graph will show it comfortably under `-Xmx`
at the moment of death, because it was.

One caveat before you multiply those numbers together: most of them are *reservations*, not
physical memory. The 240 MB code cache is reserved address space committed lazily; the
thread-stack figures are per-thread address-space reservations of which only the touched
pages are resident. That distinction is the subject of
[01f · Reserved, committed and resident](01f-reserved-committed-and-resident.md), and getting
it wrong in the other direction — assuming every reservation is a real cost — leads to
services sized far too generously.

## The knob that actually works in a container

Not a smaller `-Xmx`. A percentage, so the same image is correct at every deployment size.
The man page's own wording:

> *"`-XX:MaxRAMPercentage=percent` — Sets the maximum amount of memory that the JVM may use
> for the Java heap before applying ergonomics heuristics as a percentage of the maximum
> amount determined as described in the `-XX:MaxRAM` option. The default value is 25
> percent."*

There is a second, less-known knob for small containers:

> *"`-XX:MinRAMPercentage=percent` — Sets the maximum amount of memory that the JVM may use
> for the Java heap … for small heaps. A small heap is a heap of approximately 125 MB. The
> default value is 50 percent."*

Read that carefully: `MinRAMPercentage` is not a floor, it is `MaxRAMPercentage`'s
counterpart for small containers, and its default is 50 percent, not 25. Two defaults, and
which one applies depends on how much memory the container has. That is exactly the kind of
detail that makes "we set `-Xmx` so we know what we get" feel attractive and still be the
wrong answer.

And container detection is on by default, so the percentage is a percentage of the *cgroup*
limit, not of the host's RAM:

> *"`-XX:-UseContainerSupport` — Linux only: The VM now provides automatic container
> detection support, which allows the VM to determine the amount of memory and number of
> processors that are available to a Java process running in docker containers. It uses this
> information to allocate system resources. The default for this flag is true."*

Choosing the percentage is a measurement, not a rule of thumb, and container sizing in full
is **03 · Heap sizing in containers** *(not written yet)*.

## The ordered questions at 03:00

When a JVM's memory looks wrong, ask these in order. Each eliminates a family of causes.

1. **Did the JVM throw, or did something kill it?** An exception with a stack trace in the
   application log, versus exit code 137 / `dmesg` OOM lines / the orchestrator's
   `OOMKilled` reason. This single question splits the whole problem space.
2. **If it threw, what was the detail message?** `Java heap space` and `GC Overhead limit
   exceeded` are heap. `Metaspace` and `Compressed class space` are class metadata.
   `Out of swap space?` and `(Native method)` are native. `Direct buffer memory` is NIO.
   `unable to create native thread` is threads or an OS limit.
3. **Is the heap actually full?** Committed versus used *after* a full collection, from
   `-Xlog:gc*` or `jcmd <pid> GC.heap_info`. A heap that empties on every collection is not
   the leak.
4. **Is RSS above `-Xmx` plus a plausible native budget?** If yes, the question is *which
   native region*, and the answer comes from `-XX:NativeMemoryTracking=summary` plus
   `jcmd <pid> VM.native_memory summary` — not from a heap dump.
5. **Is the growth in a region NMT tracks, or outside it?** NMT tracks what the *JVM*
   allocates. The Troubleshooting Guide is explicit: *"Since NMT doesn't track memory
   allocations by non-JVM code, you may have to use tools supported by the operating system
   to detect memory leaks in native code."* That case is
   [11c · The footprint that is not in any region](11c-the-footprint-that-is-not-in-any-region.md).

The mechanics of steps 4 and 5 are [11 · Native Memory Tracking](11-native-memory-tracking.md);
the whole sequence is written out as a runnable checklist in
[12 · The checklist](12-the-checklist.md).

## Gotchas

**★ The default `-XX:MaxRAMPercentage` is 25 percent, and it surprises people in both
directions.**
On a 4 GB container an unconfigured JVM takes a 1 GB heap and someone complains it is wasting
memory; on a 512 MB container it takes a small heap and someone complains it collects
constantly. Same default, both times.

**★ `-XX:MinRAMPercentage` is not a minimum.**
It is `MaxRAMPercentage` for heaps below roughly 125 MB, and its default is 50 percent. Two
different defaults apply depending on container size, and reading the name as "floor" leads
to configurations that do the opposite of what was intended.

**★ `-XX:MaxRAM` and the cgroup limit are not the same knob.**
`MaxRAM` is documented as *"the maximum amount of memory that the JVM may use for the Java
heap before applying ergonomics heuristics. The default value is the maximum amount of
available memory to the JVM process or 128 GB"*. With container support on, "available memory
to the JVM process" already means the cgroup limit; setting `MaxRAM` by hand overrides a
value that was already correct, and is a common way to break a working image.

**★ A container's memory metric is not the JVM's RSS.**
`container_memory_working_set_bytes` includes page cache attributable to the cgroup. A JVM
that memory-maps a large file, or a sidecar writing logs into the same cgroup, can push the
working set toward the limit without the JVM's own anonymous memory moving at all. Compare
like with like before concluding the JVM grew.

## Interview questions

**★ A pod running your Spring Boot service is OOMKilled every few hours. The heap graph is a
flat, healthy sawtooth well below `-Xmx`. Where do you look?**
Nowhere near the heap. OOMKilled means the kernel killed the *process* for exceeding its
cgroup limit, so the total resident set — not the heap — crossed the line, and the heap being
flat actively narrows it: the growth is in a native region. I would restart with
`-XX:NativeMemoryTracking=summary`, take a baseline once warm with
`jcmd <pid> VM.native_memory baseline`, and diff with `summary.diff` across the growth
window. The category that moved names the cause: `Class`/`Metaspace` is a classloader leak,
`Thread` is unbounded thread creation, `Code` is the code cache, and a total that does not
account for RSS points at the allocator or a JNI library, which NMT does not track. The one
thing I would not do first is take a heap dump, because it serialises the region I have
already ruled out.

**★ You have a 2 GB container. What do you set, and why not `-Xmx2g`?**
`-XX:MaxRAMPercentage`, with the percentage chosen after measuring the native footprint —
starting somewhere around 60–70 percent for a typical Spring Boot service and validating with
NMT. Not `-Xmx2g`, because that permits the heap alone to consume the entire limit, leaving
nothing for metaspace, the code cache, thread stacks and GC structures; the process is killed
before the heap ever fills. And not a hard-coded `-Xmx1200m` either, because the moment
someone runs the same image with a 4 GB limit the number is wrong again. A percentage is the
only setting that survives being redeployed at a different size.

**★ RSS keeps climbing across full GCs even though the live set is constant. What does that
tell you?**
That the growth is not live Java objects, because a full collection would have reclaimed
anything unreachable and the live set is flat by assumption. Candidates in rough order of
likelihood: a classloader leak inflating metaspace, direct `ByteBuffer`s whose `Cleaner`s
have not run because the heap is roomy enough that GC is rare, thread stacks from an
unbounded executor, and glibc `malloc` arena fragmentation, where the memory was freed by the
JVM but never returned to the kernel. NMT distinguishes the first three; the fourth shows up
as RSS exceeding NMT's own total, which is the tell.

**★ How would you decide a `MaxRAMPercentage` value for a service you have never seen?**
Measure the native side and subtract. Run it under representative load with
`-XX:NativeMemoryTracking=summary`, let it reach steady state — hours, not minutes, because
of the committed-to-resident gap described in
[01f](01f-reserved-committed-and-resident.md) — and read the committed totals for everything
that is not `Java Heap`. Add headroom for growth in metaspace and the code cache, subtract
the sum from the container limit, and express what is left as a percentage. Then validate by
running at that setting and watching RSS against the limit for a full deployment cycle. A
number derived this way survives a redeploy at a different size; a number from a blog post
does not.

**★ Why is a load test a bad way to size a JVM container?**
Because two of the biggest contributors move on a timescale a load test does not cover. RSS
rises as committed heap pages are gradually touched, which takes hours. The code cache fills
as more methods reach the C2 compilation threshold, which takes sustained traffic rather than
a burst. And metaspace grows with lazily loaded classes, while a load test typically
exercises a narrow set of code paths. A ten-minute test at full throughput can show a
footprint half of the eventual steady state.

**★ Which single number would you put on a dashboard to catch container-sizing problems
early?**
RSS as a fraction of the container's memory limit, with the heap's committed size plotted on
the same axis. The ratio catches the problem regardless of which region is growing, and
plotting the heap alongside it immediately classifies the incident: if both rise together it
is a heap problem, and if RSS rises while committed heap is flat it is native. A heap-usage
percentage on its own — which is what most default dashboards show — cannot distinguish those
two cases at all.

**★ A service works at 512 MB in staging and is OOMKilled at 512 MB in production. Same
image, same flags. What differs?**
Almost always thread count and class count, both of which are load-dependent and neither of
which is on the heap. Production drives more concurrent requests, so the servlet or WebFlux
pool grows and each platform thread costs a stack; production exercises more code paths, so
more classes are loaded into metaspace and more methods reach C2 and land in the code cache.
The heap may well be identical. NMT baselines taken in both environments and diffed against
each other identify the region in one step.

{/* FOOTER */}
