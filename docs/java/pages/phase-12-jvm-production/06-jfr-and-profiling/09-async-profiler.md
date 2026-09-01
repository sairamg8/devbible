---
title: "async-profiler exists because it shows you the frames JFR structurally cannot — native, kernel, and the GC and JIT threads that are not your application at all — and the JDK's own position is that it obtains them through interfaces that can crash the process"
sidebar_label: "09 · async-profiler"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **async-profiler project README** (stable release **4.5**) and
> its `docs/CpuSamplingEngines.md`, quoted verbatim
> ([github.com/async-profiler/async-profiler](https://github.com/async-profiler/async-profiler)),
> and **JEP 509** and **JEP 518** (Release 25) for the JDK's own assessment of third-party
> profilers and of `AsyncGetCallTrace` ([openjdk.org](https://openjdk.org/jeps/518)).
> 🔴 **No sandbox** — no flame graph, sample count or measurement below is a captured run. The
> command forms are the project's own documented examples.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**JFR is the supported, built-in, always-on option and it is the right default. async-profiler is
the one that sees what JFR cannot, and the honest comparison is not "which is better" but "which
blind spot are you currently in". This page is what it does differently, what it costs, and the
safety argument the JDK itself makes against it — which JDK 25 has narrowed but not closed.**

## What it claims, in its own words

From the project README:

> *"This project is a low overhead sampling profiler for Java that does not suffer from the
> Safepoint bias problem. It features HotSpot-specific API to collect stack traces and to track
> memory allocations."*

and the sentence that is the whole reason it still matters:

> *"Unlike traditional Java profilers, async-profiler monitors non-Java threads (e.g., GC and JIT
> compiler threads) and shows native and kernel frames in stack traces."*

🔴 **Non-Java threads and kernel frames.** That is a genuinely different picture. JFR profiles the
application's Java threads; async-profiler will show you that the time is going into GC worker
threads, or JIT compilation, or a kernel call — none of which is your code, all of which is your
latency.

**What it can profile**, from the README:

- CPU time
- Allocations in Java Heap
- Native memory allocations and leaks
- Contended locks
- Hardware and software performance counters like cache misses, page faults, context switches

⚠️ **Native memory allocations and leaks** is worth noting: that is the question
[topic 01](../01-memory-layout/11c-the-footprint-that-is-not-in-any-region.md) reaches NMT for, and
async-profiler attacks it from the allocation side.

## Running it

The launcher is **`asprof`**, and the README's quick start is one line:

```bash
asprof -d 30 -f flamegraph.html <PID>
```

> *"run profiler for 30 seconds and save results to `flamegraph.html` as an interactive Flame Graph
> that can be viewed in a browser."*

**Like JFR, it attaches to a running process** — no restart, no agent configured yesterday. That is
the property that makes either tool usable during an incident.

⚠️ **`asprof` is the current launcher.** Older material refers to `profiler.sh`; if a runbook names
that, it predates the current releases.

## 🔴 The three CPU engines, and why the choice matters

`docs/CpuSamplingEngines.md`: *"Async-profiler has three options for CPU profiling: `-e cpu`,
`-e itimer` and `-e ctimer`."* The distinction decides whether it works in your container at all.

### `cpu` — the accurate one, and the restricted one

> *"On Linux, `cpu` mode relies on perf_events. One `perf_event` descriptor is created for each
> running thread and configured to generate a signal every `N` nanoseconds of CPU time. **This is
> the most accurate CPU sampler available in async-profiler and the only one that can obtain kernel
> stack traces.** It, however, comes with certain restrictions."*

Its own worked explanation of what a sample means:

> *"if an application uses 2 cpu cores, each with 30% utilization, and the sampling interval is
> 10ms, then the profiler will collect about `2 * 0.3 * 100 = 60` samples per second. In other
> words, 1 profiling sample means that one CPU core was actively running for N nanoseconds, where N
> is the profiling interval."*

**Two documented restrictions:**

🔴 **Access is often blocked.** *"OS configuration may limit access to `perf_events` API, e.g., by
`kernel.perf_event_paranoid` sysctl or by seccomp (which is often the case in a Docker
container)."* — [9c](9c-running-it-in-a-container.md).

⚠️ **A descriptor per thread.** *"if an application has too many threads and OS limit for the
maximum number of open descriptors (`ulimit -n`) is too low, an application may run out of file
descriptors."* On a service with a large thread count this is a real failure mode, and the fix is
*"simply increase file descriptor limit"*.

⚠️ And if kernel symbols are hidden by `kernel.kptr_restrict`, it *"continues to use `perf_events`,
emits a warning and does not show kernel stack traces"* — so you get a degraded result with a
warning rather than a failure.

### `itimer` — the one that works in containers

> *"`itimer` mode is based on `setitimer(ITIMER_PROF)` syscall … Ideally, both `itimer` and `cpu`
> should collect the same number of samples. Typically, profiles indeed look very similar."*

**Its documented limitations:**

> - *"Only one `itimer` signal can be delivered to a process at a time."*
> - *"Signals are not distributed evenly between running threads."*
> - *"Sampling resolution is limited by the size of jiffies."*

and *"`itimer` profiles may be even less accurate on macOS, where `itimer` signals are often biased
towards system calls."*

🔴 **But: *"The main advantage of `itimer` is that it works in containers and does not consume file
descriptors."*** That is why it is frequently the engine you actually get.

### `ctimer` — the container fallback

The container documentation lists it as the third way to profile without relaxing seccomp:
*"you may fall back to `-e ctimer` profiling mode"*.

**The practical rule:** try `cpu` for accuracy and kernel frames; fall back to `itimer` or `ctimer`
when the container will not permit `perf_events`, and **note in your findings which engine
produced them**, because they are not equally accurate.

## 🔴 The safety argument, from the JDK

This has to be stated because the JDK states it. JEP 509:

> *"Some popular third-party Java tools, including async-profiler, use Linux's CPU timer to produce
> CPU-time profiles of Java programs. However, to do so, such tools interact with the Java runtime
> through unsupported internal interfaces. This is inherently unsafe and can lead to process
> crashes."*

and JEP 518, on the specific mechanism:

> *"The HotSpot JVM does have an existing internal but unsupported mechanism, `AsyncGetCallTrace`,
> which is used by some third-party tools. Unfortunately, this mechanism relies on the same kind of
> risky stack-parsing heuristics that JFR uses today, but without any crash protection, thus it is
> even riskier."*

**Three things make that fair rather than territorial:**

1. **JEP 518 says the same about the JVM's own mechanism** — which it replaced precisely because
   the heuristics *"can crash the JVM"*. This is a criticism of an approach, not of a competitor.
2. **"Unsupported" is a factual statement about interface stability**, not a claim that it is
   badly built.
3. **JEP 509's stated purpose is to close the gap** — to give safely, in JFR, the CPU-time
   profiling that previously required going outside the supported surface.

⚠️ **JEP 518 also notes `AsyncGetCallTrace` is *"based on the POSIX SIGPROF signal, an equivalent
of which does not exist on Windows"*** — and the README's supported platforms confirm the
consequence: **Linux x64/arm64 and macOS x64/arm64 are the maintained builds. There is no
Windows.**

## So which do you use

**Default to JFR.** Supported, built in, safe to run continuously, and it gives you the timeline
correlation nothing else does ([04](04-the-event-model.md)).

**Reach for async-profiler when JFR's picture is missing the answer:**

- **Time is in native or kernel code** and you need to see it. On JDK 25, try
  `jdk.CPUTimeSample` first ([08](08-jdk-25-jfr.md)) — it is Linux-only and experimental, but it is
  the supported route to the same information.
- **The cost is in non-Java threads** — GC or JIT compiler threads. async-profiler shows them
  directly; JFR shows their effects.
- **You need hardware counters** — cache misses, page faults, context switches. No JFR equivalent.
- **You want native allocation profiling** to complement NMT.

🔴 **The JDK 25 answer to the classic "async-profiler because of safepoint bias" argument is
weaker than it was**: JEP 518's cooperative sampling removed the crash-risky heuristics and
*"adjust[s] for safepoint bias"*, while conceding it *"does not entirely avoid"* it for intrinsics.
**Safepoint bias is no longer the strongest reason to reach for async-profiler. Native, kernel and
non-Java threads are.**

## Gotchas

**★ It shows non-Java threads and kernel frames; JFR does not.**
The README's own distinguishing claim. GC and JIT compiler threads, native frames, kernel stacks —
that is a different picture, and it is the reason the tool remains necessary.

**★ The JDK says it reaches that data through unsupported interfaces.**
JEP 509: *"inherently unsafe and can lead to process crashes."* JEP 518 calls
`AsyncGetCallTrace` *"even riskier"* than the JVM's own former mechanism. That is a statement about
interface stability, and the JDK levels the same criticism at its own old implementation.

**★ There is no Windows support.**
Maintained builds are Linux x64/arm64 and macOS x64/arm64. `AsyncGetCallTrace` is SIGPROF-based,
and JEP 518 notes no Windows equivalent exists.

**★ The launcher is `asprof`, not `profiler.sh`.**
A runbook naming the old script predates current releases.

**★ `-e cpu` is the accurate engine and the one containers usually block.**
It relies on `perf_events`, which seccomp restricts by default in Docker. Accuracy and availability
pull in opposite directions here.

**★ `-e cpu` allocates a file descriptor per thread.**
On a service with a large thread count, a low `ulimit -n` means the *application* can run out of
descriptors. The documented fix is to raise the limit — but the failure lands on the application,
not the profiler.

**★ Hidden kernel symbols degrade silently-ish.**
With `kernel.kptr_restrict` set it keeps using `perf_events`, warns, and omits kernel stacks. You
get a lesser result plus a warning, which is easy to miss.

**★ `-e itimer` works in containers and is less accurate.**
Only one signal per process at a time, signals not distributed evenly between threads, and
resolution limited by jiffies — and worse on macOS, where they are *"often biased towards system
calls"*.

**★ Record which engine produced a profile.**
`cpu`, `itimer` and `ctimer` are not equally accurate, and a profile compared against one taken
with a different engine is not a like-for-like comparison.

**★ Safepoint bias is a weaker argument than it was.**
JEP 518's cooperative sampling adjusts for it, conceding only that intrinsics remain. The durable
reasons to use async-profiler are native, kernel and non-Java thread visibility.

**★ On JDK 25, try `jdk.CPUTimeSample` before reaching outside the JDK.**
It is experimental and Linux-only, but it is the supported route to CPU-time profiling that
includes native code — which was previously the main reason to go outside.

## Interview questions

**★ What does async-profiler give you that JFR does not?**
Visibility outside the application's Java threads. Its README states it *"monitors non-Java threads
(e.g., GC and JIT compiler threads) and shows native and kernel frames in stack traces"*. It also
profiles hardware and software performance counters — cache misses, page faults, context switches —
and native memory allocations, none of which JFR covers.

**★ What is the JDK's stated objection to it?**
That it reaches the data through unsupported internal interfaces. JEP 509 says such tools are
*"inherently unsafe and can lead to process crashes"*, and JEP 518 describes `AsyncGetCallTrace` as
relying on risky stack-parsing heuristics *"without any crash protection, thus it is even riskier"*.
It is fair rather than territorial: JEP 518 makes the same criticism of the JVM's own former
mechanism, which is why it was replaced.

**★ What are async-profiler's three CPU engines and how do you choose?**
`cpu`, `itimer` and `ctimer`. `cpu` uses `perf_events` and is *"the most accurate CPU sampler …
and the only one that can obtain kernel stack traces"*, but containers usually block `perf_events`
by seccomp, and it allocates a file descriptor per thread. `itimer` *"works in containers and does
not consume file descriptors"* at the cost of accuracy — one signal per process at a time, uneven
distribution across threads, jiffy-limited resolution. `ctimer` is the other container fallback.

**★ Why might `-e cpu` cause a problem for the application itself?**
Because it creates a `perf_event` descriptor per running thread. On a service with many threads and
a low `ulimit -n`, the documentation warns the application *"may run out of file descriptors"* —
so the profiler's resource use lands on the process being profiled. Raising the descriptor limit is
the documented fix.

**★ Has JDK 25 changed the case for async-profiler?**
Yes, in two ways. JEP 518's cooperative sampling removed the crash-risky heuristics from JFR and
adjusts for safepoint bias, so "JFR suffers from safepoint bias" is a much weaker argument than it
was — though the JEP concedes intrinsics still bias it. And JEP 509's `jdk.CPUTimeSample` gives
CPU-time profiling that covers native code through a supported interface, which was previously the
main reason to go outside the JDK. What remains distinctly async-profiler's is non-Java threads,
kernel frames and hardware counters.

**★ Can you use it on Windows?**
No. The maintained builds are Linux x64/arm64 and macOS x64/arm64. The underlying mechanism is
SIGPROF-based, and JEP 518 notes that an equivalent does not exist on Windows — which is a real
consideration for a team whose developers profile locally on Windows and whose production is Linux.

**★ Your profile shows most time in GC worker threads. Which tool told you that, and what next?**
async-profiler, because it profiles non-Java threads — JFR profiles the application's Java threads
and would show you the effects rather than the frames. What comes next is not a profiling question
though: time in GC threads points at allocation rate or heap configuration, which is topic 02's GC
log and the allocation profile, not more CPU sampling.

{/* FOOTER */}
