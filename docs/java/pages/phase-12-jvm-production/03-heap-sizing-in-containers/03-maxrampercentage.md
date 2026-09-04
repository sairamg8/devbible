---
title: "MaxRAMPercentage is the only heap setting that is still correct after somebody changes the container limit, and its default of 25 percent is wrong for almost every service in both directions"
sidebar_label: "03 · MaxRAMPercentage"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `java` tool reference** — `-XX:MaxRAMPercentage`,
> `-XX:MinRAMPercentage`, `-XX:InitialRAMPercentage`, `-XX:MaxRAM`, `-Xmx`, `-Xms`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)),
> and the JDK 25 HotSpot source at tag `jdk-25+36`:
> [`gc/shared/gc_globals.hpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gc_globals.hpp).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**There are three RAM-percentage flags, they do not mean what their names suggest, only one of
them is the knob you want, and the default value of that one is 25 percent — a figure chosen for
a world of shared multi-tenant machines, not for a container that exists to run exactly one JVM.
Getting this right is the difference between an image that is correct at every deployment size
and a number that has to be re-derived by hand every time somebody edits a manifest.**

## The three flags, verbatim

> *"`-XX:MaxRAMPercentage=percent` — Sets the maximum amount of memory that the JVM may use for
> the Java heap before applying ergonomics heuristics as a percentage of the maximum amount
> determined as described in the `-XX:MaxRAM` option. **The default value is 25 percent.**"*

> *"`-XX:MinRAMPercentage=percent` — Sets the maximum amount of memory that the JVM may use for
> the Java heap before applying ergonomics heuristics as a percentage of the maximum amount
> determined as described in the `-XX:MaxRAM` option **for small heaps. A small heap is a heap of
> approximately 125 MB. The default value is 50 percent.**"*

> *"`-XX:InitialRAMPercentage=percent` — Sets the initial amount of memory that the JVM will use
> for the Java heap before applying ergonomics heuristics as a percentage of the maximum amount
> determined as described in the `-XX:MaxRAM` option. **The default value is 1.5625 percent.**"*

Read the second one again. **`MinRAMPercentage` is not a floor.** It is `MaxRAMPercentage`'s
replacement in the small-heap regime, and its default is double the other one. The source
confirms the shape — `gc_globals.hpp` at `jdk-25+36`:

```cpp
product(double, MaxRAMPercentage, 25.0,
        "Maximum percentage of real memory used for maximum heap size")
        range(0.0, 100.0)

product(double, MinRAMPercentage, 50.0,
        "Minimum percentage of real memory used for maximum heap"
        "size on systems with small physical memory size")
        range(0.0, 100.0)

product(double, InitialRAMPercentage, 1.5625,
        "Percentage of real memory used for initial heap size")
        range(0.0, 100.0)
```

They are `double`, not integers, so `-XX:MaxRAMPercentage=68.75` is legal and meaningful. The
range is 0 to 100 inclusive, and `-XX:MaxRAMPercentage=100` will be accepted — see the gotchas.

## A percentage of what?

Of `MaxRAM`, whose own default is the sentence that ties the whole mechanism to the container:

> *"`-XX:MaxRAM=size` — Sets the maximum amount of memory that the JVM may use for the Java heap
> before applying ergonomics heuristics. The default value is the maximum amount of available
> memory to the JVM process or 128 GB, whichever is lower. **The maximum amount of available
> memory to the JVM process is the minimum of the machine's physical memory and any constraints
> set by the environment (e.g. container).**"*

That last sentence is the man page conceding, in parentheses, that this is the container flag.
Mechanically it is `os::physical_memory()`, which
[02 · Container awareness](02-container-awareness.md) showed returns the cgroup limit. So:

```
heap ceiling  =  cgroup memory limit  ×  MaxRAMPercentage / 100
```

with the qualifications that [03b · The ergonomics algorithm](03b-the-ergonomics-algorithm.md)
spells out.

## Why 25 percent is wrong for a container

25 percent is a sensible default for a JVM sharing a machine with other things — a developer
laptop, a build agent, a 2010-era application server host. A container exists to run one JVM.
Everything else in it is the JVM's own native footprint, which is real but nowhere near 75
percent of the limit.

The result is that the out-of-the-box behaviour surprises people in **both** directions:

- On a 4 GiB container you get a 1 GiB heap, three quarters of your paid-for memory sits unused,
  and someone concludes Java is wasteful.
- On a 512 MiB container you get a 128 MiB heap, the service garbage-collects constantly under
  load, and someone concludes Java is slow.

Neither observation is about Java. Both are about a default that assumed the machine was shared.

## What to set instead

There is no correct universal number, and any page that gives you one is guessing on your
behalf. What there is, is a correct *procedure*:

1. **Start at 70 percent** for an ordinary Spring Boot service on a container of 1 GiB or more.
   This is a starting point for measurement, not a recommendation to ship.
2. **Measure the native side under representative load** with
   `-XX:NativeMemoryTracking=summary` and `jcmd <pid> VM.native_memory summary`, after the
   process has been warm for hours rather than minutes —
   [11b · The NMT baseline workflow](../01-memory-layout/11b-the-nmt-baseline-workflow.md).
3. **Do the subtraction** in [04 · The memory budget](04-the-memory-budget.md), which is where
   the numbers that are not heap get counted.
4. **Validate against RSS**, not against the heap graph, for a full deployment cycle.

```bash
# the whole container-sizing configuration, in one line
JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+ExitOnOutOfMemoryError"
```

Two flags. Everything else in a typical `JAVA_OPTS` is either a default, a flag the setter cannot
explain, or something removed three releases ago —
**13 · JVM flags that matter in 2026** *(not written yet)*.

## Setting it does more than set it

One non-obvious consequence, from the man page's own note on both `MaxRAM` and
`MaxRAMPercentage`:

> *"Specifying this option disables automatic use of compressed oops if the combined result of
> this and other options influencing the maximum amount of memory is larger than the range of
> memory addressable by compressed oops."*

In other words, on a large container, *explicitly* setting `MaxRAMPercentage` can produce a heap
above the compressed-oops threshold where leaving it at the default would have clamped the heap
to stay under it. That is usually what you want — you asked for the memory — but it changes
object layout and therefore footprint. The mechanism is in
[03b · The ergonomics algorithm](03b-the-ergonomics-algorithm.md); the layout consequences are
[09 · Compressed oops](../01-memory-layout/09-compressed-oops.md).

## Gotchas

**★ `MinRAMPercentage` is not a minimum and has never been one.**
It is the percentage used when the resulting heap would be small — roughly 125 MB, a number
derived in [03b](03b-the-ergonomics-algorithm.md). Setting `-XX:MinRAMPercentage=80` on a 4 GiB
container does nothing at all, because that container is not in the small-heap regime. People set
it expecting a floor, observe no change, and conclude the flag is broken.

**★ `-Xmx` beats all three percentage flags, silently.**
The ergonomic sizing block runs only `if (FLAG_IS_DEFAULT(MaxHeapSize))`. If anything anywhere —
the Dockerfile, `JAVA_TOOL_OPTIONS`, a buildpack, a Helm chart's `JAVA_OPTS`, a wrapper script —
sets `-Xmx`, every percentage on the command line is ignored without a warning.
[03c · Why not `-Xmx`](03c-why-not-xmx.md) is the whole story.

**★ `-XX:MaxRAMPercentage=100` is accepted and is always wrong.**
The range is `(0.0, 100.0)` inclusive, so the JVM will not stop you. It means "the Java heap
alone may grow to the entire container limit", leaving nothing for metaspace, the code cache,
thread stacks, GC structures or direct buffers. The process is killed before the heap ever fills.

**★ Setting `-XX:MaxRAM` by hand usually breaks something that was already right.**
Under container support, `MaxRAM`'s default is *already* the cgroup limit. Overriding it replaces
a correct, automatically-tracking value with a hard-coded one — and it does so in the one place
nobody thinks to look, because the flag does not have "heap" in its name. The legitimate uses are
narrow: deliberately reserving headroom on a host where the JVM is not the only process, or
reproducing a smaller machine for testing.

**★ `InitialRAMPercentage`'s default of 1.5625 percent means the heap starts tiny.**
1.5625 is 1/64. On a 4 GiB container that is a 64 MiB initial heap growing toward a 2.8 GiB
ceiling, which means a burst of early collections and heap expansions during exactly the window
when a readiness probe is watching. Raising it — or setting `-Xms` — trades startup memory for
startup latency, and pairs with [09 · `AlwaysPreTouch`](09-alwayspretouch.md).

**★ A percentage of a limit that is not set is a percentage of the node.**
`MaxRAMPercentage=70` in a pod with no `limits.memory` is 70 percent of the *node's* RAM. The
flag is not a safety net; it needs the limit to exist. Always set a memory limit on a Java pod.

**★ These are `double`s, and a typo is not caught.**
`-XX:MaxRAMPercentage=7.5` when you meant `75` parses cleanly and produces a heap one tenth of
the intended size. Because the failure mode is "constant GC" rather than "will not start", it can
survive a deploy. Verify with `-XX:+PrintFlagsFinal` and check `MaxHeapSize` in bytes, not the
percentage you typed.

**★ The percentage is applied to the limit, not to the limit minus the JVM's own overhead.**
There is no hidden reserve. Whatever percentage you leave unused is the *entire* budget for
metaspace, the code cache, every thread stack, all GC metadata, direct and mapped buffers, the
native allocator's slack, and anything the container runs besides the JVM. If a sidecar shares
the container, it comes out of the same 30 percent.

**★ The three flags are read in `Arguments::set_heap_size()`, which runs before the collector is
chosen.**
So there is no "ZGC needs more headroom, so ergonomics gives it less heap" adjustment. Collector
footprint differences are your problem, not ergonomics'. That comparison belongs to
**02 · GC in practice** *(not written yet)*.

## Interview questions

**★ What is `-XX:MaxRAMPercentage` a percentage of?**
Of `-XX:MaxRAM`, whose default the man page defines as "the maximum amount of available memory to
the JVM process or 128 GB, whichever is lower" — and it then defines *available memory to the
process* as the minimum of the machine's physical memory and any constraint set by the
environment, explicitly naming containers. Mechanically that is `os::physical_memory()`, which on
Linux with container support returns the cgroup memory limit. So in a container it is a
percentage of your pod's memory limit, and on a bare host it is a percentage of the machine's
RAM, and the same flag is correct in both places.

**★ Why is the default 25 percent, and should you keep it?**
Because it was chosen for a JVM sharing a machine, where taking a quarter of RAM is polite. In a
container, where the JVM is the only tenant, it wastes three quarters of what you are paying for.
You should not keep it — but you should not replace it with a number from a blog either. Measure
the native footprint with NMT under sustained realistic load, subtract it and a growth margin
from the limit, and express the remainder as a percentage. For a typical Spring Boot service that
lands somewhere in the 60 to 75 percent band, but the number is an output of the measurement, not
an input.

**★ What is `MinRAMPercentage` and when does it apply?**
It is not a minimum heap. It is the percentage the ergonomics uses instead of `MaxRAMPercentage`
when the machine — or container — is small, which the man page pins at "a heap of approximately
125 MB", and its default is 50 percent. The intent is that a very small container should not be
left with a heap so tiny that the JVM cannot function; taking half of 200 MB is more useful than
taking a quarter. On anything above roughly half a gigabyte it never applies, which is why
setting it is almost always a no-op.

**★ Someone sets both `-Xmx2g` and `-XX:MaxRAMPercentage=75` on a 4 GiB container. What heap do
they get?**
2 GiB. The ergonomic percentage path is guarded by `FLAG_IS_DEFAULT(MaxHeapSize)`, so an explicit
`-Xmx` disables it entirely, with no warning and no log line at default verbosity. This is the
single most common way a carefully chosen percentage turns out to have had no effect — usually
because the `-Xmx` is coming from somewhere the person did not write, like a base image's
`JAVA_TOOL_OPTIONS` or a buildpack's memory calculator.

**★ Is there a case for setting `-Xmx` rather than a percentage?**
Yes, one: when you have measured this specific service on this specific limit and you want the
value pinned so that an accidental change to the container limit produces an obvious failure
rather than a silent resize. That is a real argument, and it is why buildpacks compute an
absolute `-Xmx` at launch. The distinction that matters is *when* the absolute value is computed.
Computed at container start from the observed limit, it is fine. Baked into an image at build
time, it is a bug waiting for the first redeploy at a different size.

{/* FOOTER */}
