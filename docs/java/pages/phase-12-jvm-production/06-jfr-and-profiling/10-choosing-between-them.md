---
title: "The choice is not which profiler is better but which question you are asking, because the tools have different blind spots — and on JDK 25 the boundary moved, so the reasoning most teams inherited is one release out of date"
sidebar_label: "10 · Choosing between them"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEPs 509, 518 and 520** (all Release 25, `Closed/Delivered`)
> ([openjdk.org](https://openjdk.org/jeps/509)), the **JDK 25 `jcmd` and `jfr` tool references**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)), the
> **async-profiler 4.5 README** and its `CpuSamplingEngines` and `ProfilingInContainer` docs
> ([github.com/async-profiler/async-profiler](https://github.com/async-profiler/async-profiler)),
> and the **OpenJDK Mission Control README** ([github.com/openjdk/jmc](https://github.com/openjdk/jmc)).
> 🔴 **No sandbox** — no benchmark or measurement below is a captured run.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Every tool in this topic has a blind spot, and they are different blind spots. That is the whole
basis for choosing: not which is best, but which one cannot see the thing you are looking for. This
page is the decision, and the JDK 25 changes that move it.**

## The decision table

| Question | Tool | Why |
|---|---|---|
| **Where is wall-clock time going?** | JFR `jdk.ExecutionSample` | Samples at intervals of elapsed time |
| **Where is CPU going, including native?** | JFR `jdk.CPUTimeSample` (Linux, experimental) → else async-profiler `-e cpu` | JEP 509 tracks CPU cycles *"even when they're running native code"* |
| **What is allocating?** | JFR allocation events | On the same timeline as everything else |
| **What is happening in GC or JIT threads?** | 🔴 **async-profiler only** | It *"monitors non-Java threads"*; JFR profiles the application's |
| **Kernel frames?** | 🔴 **async-profiler `-e cpu` only** | *"the only one that can obtain kernel stack traces"* |
| **Cache misses, page faults, context switches?** | 🔴 **async-profiler only** | Hardware and software counters; no JFR equivalent |
| **Exactly how many times did method X run, and how long?** | JFR `jdk.MethodTrace` / `jdk.MethodTiming` | *"complete and exact statistics rather than … sample-based"* |
| **Did the spike coincide with a GC pause / class load / deopt?** | 🔴 **JFR only** | One timeline across every subsystem |
| **What happened before I noticed?** | 🔴 **JFR continuous recording only** | Nothing else was running |
| **Why is nothing happening?** | A thread dump — [topic 05](../05-thread-dumps/README.md) | Complete state and lock ownership, not a sample |
| **What is retaining memory?** | A heap dump — [topic 04](../04-out-of-memory-error/README.md) | Allocation ≠ retention |
| **Is this change faster?** | JMH — topic 14 | Profiling ranks; benchmarking measures |

## The three questions that decide it

**1 · Is the answer inside Java code?**

If yes, JFR is almost certainly enough and is the easier tool by a wide margin — no install, no
seccomp change, no privileged user, and it may already be recording. If the answer is in native
code, kernel code, or threads that are not your application's, that is async-profiler's territory
([09](09-async-profiler.md)).

**2 · Do you need history, or only the present?**

A continuous JFR recording is the only thing on this page that can answer a question about a moment
that has already passed ([03c](03c-continuous-recording-in-production.md)). Every other tool starts
recording when you start it, which is always after the incident began.

**3 · Do you need a ranking or a number?**

Profiling ranks. JEP 509 is candid that sampled profiles *"may be inaccurate"*, more so over short
periods, and [07](07-execution-sampling.md) works through why widths do not measure. If the question
is "is this change faster", the answer is a benchmark (topic 14) or `jdk.MethodTiming`, not a
profile.

## 🔴 What JDK 25 moved

Two long-standing reasons to reach outside the JDK are weaker than they were, and a runbook written
before JDK 25 encodes the old boundary:

**"async-profiler because JFR suffers from safepoint bias."** JEP 518's cooperative sampling
reconstructs stacks at safepoints *"adjusting for safepoint bias"*, and removed the heuristics that
*"can crash the JVM"*. ⚠️ It does not fully solve it — the JEP's Future Work concedes intrinsics
still bias it — but this is no longer the strong argument it was.

**"async-profiler because JFR cannot see native code."** JEP 509's `jdk.CPUTimeSample` tracks CPU
cycles *"even when they're running native code"* — through the supported interface. ⚠️ Experimental,
Linux-only, off by default, so not a universal answer.

**What has not moved**, and is now the durable case for async-profiler: **non-Java threads, kernel
frames, and hardware counters.** Nothing in JDK 25 addresses those.

## A workable escalation

1. **Metrics say something is wrong.** Topic 08's territory, not this one.
2. **Dump the continuous JFR recording** for the window ([03c](03c-continuous-recording-in-production.md)).
   `jfr summary`, then `jfr view`.
3. **If threads are stuck rather than busy**, this is the wrong topic —
   [topic 05](../05-thread-dumps/README.md).
4. **If the profile is inconclusive**, take a short high-detail recording with `settings=profile`
   *alongside* the continuous one ([03b](03b-settings-profiles.md)).
5. **On Linux, enable `jdk.CPUTimeSample`** if native attribution is the gap
   ([08](08-jdk-25-jfr.md)).
6. **Only then reach for async-profiler**, for kernel frames, non-Java threads or hardware counters
   — accepting the container work in [09c](09c-running-it-in-a-container.md).
7. **Once a method is implicated, confirm exactly** with `jdk.MethodTiming` on that method, briefly.

🔴 **Each step is cheaper than the next, and most investigations end at step 2 or 4.**

## Using them together

They are not exclusive, and the combinations are the point:

- **JFR continuous + JFR profile**, simultaneously — history plus detail.
- **`jdk.ExecutionSample` + `jdk.CPUTimeSample`**: JEP 509 confirms *"the two can be collected
  simultaneously"*, giving wall-clock and CPU views of the same period. The **difference** between
  them is itself the finding: large wall-clock and small CPU means waiting.
- **JFR for correlation, async-profiler for depth** on whatever JFR implicated.
- **Sampling to find the method, `jdk.MethodTiming` to measure it.**
- **async-profiler's own JFR output**, which lets its data be read with JFR tooling — the project
  ships converters for exactly this.

## What none of them tells you

⚠️ **Whether the thing you found is worth fixing.** Every tool here reports what the program does.
Whether a method consuming 20% of CPU matters depends on your SLO, your headroom and what else you
could be doing — and [06b](06b-reading-the-automated-analysis.md) makes the same point about
automated analysis. **The tools rank causes; they do not prioritise work.**

## Gotchas

**★ The question decides the tool, not a general ranking.**
Each has a different blind spot. JFR cannot see non-Java threads or kernel frames; async-profiler
cannot correlate across a timeline; neither measures reliably enough to answer "is this faster".

**★ "JFR has safepoint bias" is a weaker argument on JDK 25.**
JEP 518's cooperative sampling adjusts for it and removed the crash-risky heuristics, conceding only
that intrinsics still bias it. A runbook resting on this predates the change.

**★ "JFR cannot see native code" is also weaker on JDK 25.**
`jdk.CPUTimeSample` tracks CPU cycles through native code — experimental, Linux-only, off by
default, but through the supported interface.

**★ Non-Java threads and kernel frames are the durable case for async-profiler.**
Nothing in JDK 25 addresses them. If the time is in GC or JIT threads, or below the JVM entirely,
JFR will not show it.

**★ Only a continuous recording answers a question about the past.**
Every other tool starts when you start it, which is always after the incident began.

**★ Profiling ranks; benchmarking measures.**
A profile cannot tell you whether a change made things faster — the sampling error is comparable to
the effect you are looking for. That is JMH's job.

**★ Allocation is not retention.**
A profiler shows what allocates, which is a rate. What is retained is a heap-dump question, and
sending allocation profiling at a leak wastes the effort.

**★ Wall clock and CPU disagreeing *is* the finding.**
Large wall-clock time with small CPU means waiting. Running both samplers together — which JEP 509
says is supported — makes that visible directly instead of by inference.

**★ Stuck is not slow.**
If threads are blocked rather than busy, no profiler is the right tool. That is a thread dump, and
reaching for a profiler is how an hour goes missing.

**★ None of them tells you whether to care.**
They report what the program does. Whether 20% of CPU in one method is worth a week depends on the
SLO and the alternatives, which is a judgement no tool makes.

## Interview questions

**★ JFR or async-profiler?**
Depends on the question. JFR for anything inside Java code, for correlation across subsystems on a
single timeline, and for history — it is supported, built in, needs no privileges, and may already
be recording. async-profiler when you need what JFR structurally cannot show: non-Java threads such
as GC and JIT workers, kernel frames, hardware counters, or native allocation profiling. They are
complementary, and async-profiler can emit JFR-format output so its data can be read with JFR
tooling.

**★ How has JDK 25 changed that answer?**
It weakened two of the classic reasons to reach outside the JDK. JEP 518's cooperative sampling
adjusts for safepoint bias and removed heuristics that could crash the JVM, so "JFR has safepoint
bias" is much weaker — though intrinsics still bias it. And JEP 509's `jdk.CPUTimeSample` gives
CPU-time profiling that covers native code through a supported interface, though it is experimental
and Linux-only. What has not changed is non-Java threads, kernel frames and hardware counters.

**★ You have a latency problem. Which sampler do you use?**
Wall-clock — `jdk.ExecutionSample` — because latency includes waiting and a CPU profile makes
waiting nearly invisible. Ideally both together, which JEP 509 confirms is supported: a large
wall-clock share with a small CPU share is itself the diagnosis, telling you the time is spent
blocked rather than computing, and pointing at a dependency rather than an algorithm.

**★ Walk me through escalating a "the service got slower" investigation.**
Metrics first to establish what changed. Then dump the continuous JFR recording for the window and
run `jfr summary` and `jfr view`. If threads are stuck rather than busy, stop — that is a thread
dump, not a profiler. If the profile is inconclusive, add a short `settings=profile` recording
alongside the continuous one. On Linux add `jdk.CPUTimeSample` if native attribution is the gap.
Only then async-profiler, for kernel or non-Java-thread visibility. Finally `jdk.MethodTiming` on
the implicated method for exact numbers. Each step costs more than the last, and most stop early.

**★ Can a profiler tell you whether your optimisation worked?**
Not reliably. Sampled profiles rank rather than measure — JEP 509 says they *"may be inaccurate"*,
particularly over short periods — so a modest before-and-after difference is within the instrument's
error. `jdk.MethodTiming` gives exact per-invocation statistics for named methods, and JMH gives a
controlled benchmark. Comparing two flame graphs is the wrong instrument for that question.

**★ When is none of these tools the right one?**
When threads are blocked rather than executing, which is a thread dump. When the question is what
retains memory rather than what allocates it, which is a heap dump. When the question is whether a
change is faster, which is a benchmark. And when the question is whether the finding is worth
fixing — every tool here reports what the program does, and none of them knows your SLO or what else
you could be doing with the week.

{/* FOOTER */}
