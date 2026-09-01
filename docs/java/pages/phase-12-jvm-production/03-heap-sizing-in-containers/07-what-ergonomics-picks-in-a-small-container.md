---
title: "A container with one CPU or less than 1792 MB of memory is not a server-class machine as far as HotSpot is concerned, so the JVM quietly selects the Serial collector — and the thresholds are read from the cgroup, which means your pod spec chooses your garbage collector"
sidebar_label: "07 · Ergonomics in a small container"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the JDK 25 HotSpot source at tag `jdk-25+36` —
> [`runtime/os.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/runtime/os.cpp)
> (`os::is_server_class_machine`) and
> [`gc/shared/gcConfig.cpp`](https://github.com/openjdk/jdk/blob/jdk-25%2B36/src/hotspot/share/gc/shared/gcConfig.cpp)
> (`GCConfig::select_gc_ergonomically`); the **JDK 25 `java` tool reference** for
> `-XX:+NeverActAsServerClassMachine`
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/java.html)); and the
> **HotSpot GC Tuning Guide for JDK 25**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/gctuning/)).
> Collector *choice* is owned by **02 · GC in practice** *(not written yet)*; this page covers only
> what the container makes ergonomics decide for you.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**"G1 is the default collector" is true on the machines people benchmark on and not true in a
small pod. HotSpot decides between G1 and Serial by asking whether it is running on a
"server-class machine", and under container support both inputs to that question — processor
count and physical memory — are read from your cgroup. So a `resources` block in a YAML file,
written by someone thinking about cost, is what selects your garbage collector.**

## The test

`os::is_server_class_machine()`, with its own comment, verbatim from `jdk-25+36`:

```cpp
// This is the working definition of a server class machine:
// >= 2 physical CPU's and >=2GB of memory, with some fuzz
// because the graphics memory (?) sometimes masks physical memory.
```

and the code:

```cpp
  const unsigned int    server_processors = 2;
  const julong server_memory     = 2UL * G;
  // We seem not to get our full complement of memory.
  //     We allow some part (1/8?) of the memory to be "missing",
  //     based on the sizes of DIMMs, and maybe graphics cards.
  const julong missing_memory   = 256UL * M;

  /* Is this a server class machine? */
  if ((os::active_processor_count() >= (int)server_processors) &&
      (os::physical_memory() >= (server_memory - missing_memory))) {
```

**Both calls are the container-aware ones.** `os::active_processor_count()` is the quota-derived
count from [05](05-cpu-limits-and-ergonomics.md); `os::physical_memory()` is the cgroup memory
limit from [02](02-container-awareness.md). So the thresholds, expressed in Kubernetes terms:

- **`limits.cpu` must yield at least 2**, i.e. more than `1000m` — because `ceil(1.0)` is 1.
- **`limits.memory` must be at least 2 GiB − 256 MiB = 1792 MiB.**

There is a further refinement in the source involving logical processors per package, which
narrows the test on some hardware. ⚠️ I could not determine from the source alone what
`VM_Version::logical_processors_per_package()` returns on a given container host, so **do not
predict the outcome of that branch** — verify on the platform you actually run on rather than
reasoning about it.

## What it selects

`GCConfig::select_gc_ergonomically`, verbatim:

```cpp
void GCConfig::select_gc_ergonomically() {
  if (os::is_server_class_machine()) {
#if INCLUDE_G1GC
    FLAG_SET_ERGO_IF_DEFAULT(UseG1GC, true);
#elif INCLUDE_PARALLELGC
    FLAG_SET_ERGO_IF_DEFAULT(UseParallelGC, true);
#elif INCLUDE_SERIALGC
    FLAG_SET_ERGO_IF_DEFAULT(UseSerialGC, true);
#endif
  } else {
#if INCLUDE_SERIALGC
    FLAG_SET_ERGO_IF_DEFAULT(UseSerialGC, true);
#endif
  }
}
```

Two branches, no middle ground. Server class gives G1 in any normal build; anything else gives
**Serial**. There is no log line at default verbosity announcing the choice, and no warning.

The GC Tuning Guide's *"G1 is selected by default on most hardware and operating system
configurations"* is exactly right, and "most" is carrying the weight.

## Is Serial actually wrong here?

Often, no — which is why this is a surprise rather than an outage. On a single-CPU container
Serial is a defensible choice: parallel collection needs CPUs you do not have, and a
stop-the-world single-threaded collector on a small heap has short pauses and the lowest footprint
of any collector, with no GC worker threads and no concurrent-marking data structures.

It becomes wrong when the container is small on one axis and busy on the other — a 1 CPU pod with
a 1.5 GiB limit serving real traffic — because Serial's pause scales with live-set size and it has
no concurrent phase at all. That is the configuration where a `resources` block chose a collector
nobody evaluated.

The decision itself is **02 · GC in practice** *(not written yet)*. What belongs here is: **know
that a choice was made for you, and check which one.**

```bash
java -XX:+PrintFlagsFinal -version | grep -E 'UseSerialGC|UseParallelGC|UseG1GC|UseZGC'
```

The `{ergonomic}` marker on the true one tells you it was ergonomics rather than configuration.

## The explicit small-machine mode, and why it is not this

The man page documents a separate feature that people confuse with the above:

> *"`-XX:+NeverActAsServerClassMachine` — Enable the "Client VM emulation" mode which only uses the
> C1 JIT compiler, a 32Mb CodeCache and the Serial GC. The maximum amount of memory that the JVM
> may use (controlled by the `-XX:MaxRAM=n` flag) is set to 1GB by default. … **By default the flag
> is set to true only on Windows in 32-bit mode and false in all other cases.**"*

So on Linux this is off, and reaching Serial in a container is the *ergonomic* path above, not
this mode. The flag is nonetheless interesting as a coherent "this is a small machine" preset: C1
only, a 32 MB code cache instead of 240 MB, Serial GC, and `MaxRAM` clamped to 1 GB. If you are
deliberately running a tiny sidecar-scale JVM, it is one flag that sets four sensible things —
with the caveat that C1-only compilation costs peak throughput, and that the man page lists the
compilation flags that disable the mode if present.

The source comment in `os.cpp` notes the counterpart: *"If you want some platform to always or
never behave as a server class machine, change the setting of `AlwaysActAsServerClassMachine` and
`NeverActAsServerClassMachine`"*.

## Gotchas

**★ `limits.cpu: 1` is not two processors, so a 1-CPU pod is never server class.**
`ceil(100000/100000)` is 1, and the test needs 2. Every pod with a whole-CPU limit of 1 or less
gets Serial GC regardless of how much memory it has. Going to `limits.cpu: 1100m` crosses the
threshold, because `ceil(1.1)` is 2 — which is a startling amount of behaviour change for 100
millicores.

**★ 1792 MiB is the memory threshold, not 2 GiB.**
`2 GB − 256 MB`. A pod at `limits.memory: 1792Mi` or above passes; one at `1.5Gi` does not.
Because the number is not round, it is easy to sit just below it and never realise.

**★ Nothing in the default log tells you the collector changed.**
Adding `-Xlog:gc` to a service and finding Serial where you expected G1 is the usual way people
discover this — after the fact. `-XX:+PrintFlagsFinal` at deploy time is the cheap preventative.

**★ The choice is made from the *initial* processor count and the startup memory limit.**
Both are read once. A container resized later keeps the collector it was given.

**★ Explicitly selecting a collector removes the surprise but not the constraint.**
`-XX:+UseG1GC` in a 1-CPU pod gives you G1, running its parallel phases with very few workers on a
throttled CPU. That may still be the right call, but it is a decision to make on latency grounds,
not a way to get more CPU.

**★ Serial changes the shape of the memory budget too.**
No GC worker threads means no worker stacks and much smaller GC-internal structures — G1's
remembered sets and card tables are a real fraction of a small container's budget. So a service
that "just works" on Serial at 1 GiB may not fit at the same limit on G1, and a forced collector
change is also a budget change ([04 · The memory budget](04-the-memory-budget.md)).

**★ `NeverActAsServerClassMachine` clamps `MaxRAM` to 1 GB, which changes heap sizing.**
If you enable it on a 4 GiB container, `MaxRAMPercentage` is then a percentage of 1 GB rather than
of 4 GiB. That is almost certainly not what you intended. It is a preset for genuinely tiny JVMs,
not a general small-container switch.

**★ Some builds do not contain every collector.**
The `#if INCLUDE_G1GC` guards are real: a JDK built without G1 falls through to Parallel and then
Serial. Shenandoah in particular is an OpenJDK collector that is not present in every vendor's
build. Do not assume a collector exists because an article names it.

## Interview questions

**★ Which garbage collector does an unconfigured JVM use in a 1 CPU, 1 GiB container on JDK 25?**
Serial. `GCConfig::select_gc_ergonomically` picks G1 only when `os::is_server_class_machine()` is
true, and that test requires at least 2 active processors and at least 2 GB minus 256 MB — 1792 MB
— of physical memory. Under container support both of those come from the cgroup, so a 1 CPU
1 GiB pod fails both conditions and lands in the else branch, which is Serial. Nothing is logged
about it at default verbosity, which is why "G1 is the default" persists as a belief in teams
running small pods.

**★ Is that a problem?**
Not necessarily, and often it is the right collector for that shape. On one CPU there is no
parallelism to exploit, Serial has the smallest footprint of any collector — no worker threads, no
concurrent marking structures — and on a small heap its pauses are short. It becomes a problem
when the container is small but the workload is not: a latency-sensitive service on 1 CPU and
1.5 GiB gets stop-the-world pauses proportional to its live set with no concurrent phase to hide
them. The real issue is that nobody chose it.

**★ How would you find out which collector a running pod is using without restarting it?**
`jcmd <pid> VM.flags` shows the resolved flags with their provenance, so the collector flag set
`{ergonomic}` is visible immediately; `jcmd <pid> VM.info` prints the container block alongside it,
so you can see the processor count and memory limit that produced the decision in the same output.
For a fresh process, `java -XX:+PrintFlagsFinal -version` inside the same image and the same
resource limits reproduces the decision without touching production.

**★ You bump `limits.cpu` from `1` to `1100m` and throughput changes noticeably. What happened?**
`ceil(1.1)` is 2, which crosses the server-class processor threshold. If the memory limit is also
at or above 1792 MiB, the JVM has switched from Serial to G1, and it has simultaneously doubled the
processor count feeding GC worker sizing, compiler threads, the common ForkJoinPool and
virtual-thread carriers. That is a large behavioural change for a 10 percent CPU increase, and it
is the kind of discontinuity that makes capacity tuning by trial and error so confusing in
containers.

{/* FOOTER */}
