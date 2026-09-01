---
title: "\"CPU is at 100%\" in nine ordered questions, arranged so the cheap eliminations come first — and with the two commands that decide whether this is even a profiling problem before you spend anything on one"
sidebar_label: "11 · The checklist"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **JDK 25 `jcmd` and `jfr` tool references**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)),
> **JEPs 509, 518 and 520** (Release 25)
> ([openjdk.org](https://openjdk.org/jeps/509)), the **JDK 25 Troubleshooting Guide**'s
> loop-versus-hang procedures
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)),
> and the **async-profiler 4.5** documentation
> ([github.com/async-profiler/async-profiler](https://github.com/async-profiler/async-profiler)).
> 🔴 **No sandbox** — this page prescribes commands; it does not report their output.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**This is the page to open when something is burning CPU or has got slower. It is ordered so the
questions that eliminate the most, for the least cost, come first — and the first two are about
whether this is a profiling problem at all, because the most expensive mistake in this topic is
profiling something that was never CPU-bound.**

## 🔴 Step 0 — is this even a profiling problem?

**Check CPU.** Near-zero CPU with an unresponsive service is a *hang*, not a slowdown. Stop here
and go to [topic 05](../05-thread-dumps/README.md) — the Troubleshooting Guide keeps "Diagnose a
Loop Process" and "Diagnose a Hung Process" separate for this reason, and a profiler on a hang tells
you nothing.

**Check GC.** A long pause presents as a slowdown and is diagnosed from the GC log, not a profile.
Topic 02 owns it. ⚠️ If GC threads are what is consuming CPU, this is an allocation or heap-sizing
problem wearing a profiling costume.

**Only if CPU is high in application threads and GC is healthy does the rest of this page apply.**

## The nine questions

### 1 · Is a recording already running?

```bash
jcmd <pid> JFR.check
```

If a continuous recording exists ([03c](03c-continuous-recording-in-production.md)), you can get the
minutes *before* anyone noticed:

```bash
jcmd <pid> JFR.dump name=continuous maxage=15m filename=/tmp/incident-%p-%t.jfr
```

🔴 **`dump`, not `stop`** — stopping without a `filename` discards the data.

If nothing is recording, start one and accept that it only covers from now:

```bash
jcmd <pid> JFR.start name=incident settings=profile duration=2m filename=/tmp/incident-%p-%t.jfr
```

### 2 · What is actually in the file?

```bash
jfr summary incident.jfr
```

**Always first.** If the event you intend to analyse has a count of zero it was never enabled — a
settings problem, not a finding ([03b](03b-settings-profiles.md)). Every viewer renders "did not
happen" and "was not recorded" identically.

### 3 · What does the aggregate say?

```bash
jfr view hot-methods incident.jfr
jfr view --verbose hot-methods incident.jfr     # what did that actually compute?
```

Or against the live JVM with no file at all — `jcmd <pid> JFR.view hot-methods`.

⚠️ **Read this as a ranking, not a measurement** ([07](07-execution-sampling.md)).

### 4 · Compare against a baseline

🔴 **The highest-value step on this page.** Dump an equivalent window from a healthy period, or from
another instance, and compare. Anything present in both is what your application does, not what went
wrong. Without a baseline you are interpreting a profile in isolation, which is much harder and
much less reliable.

### 5 · Self time or total time?

A method with high total and low self is a **path** — the cost is below it, and optimising it does
nothing. In a flame graph, look at the **top edge**, and ignore wide blocks with wide children
([09b](09b-flame-graphs.md)).

### 6 · Is the time CPU, or is it waiting?

If the profile is dominated by something that does not consume CPU, you are reading a wall-clock
profile of a *waiting* problem. On Linux, collect both — JEP 509 confirms `jdk.CPUTimeSample` and
`jdk.ExecutionSample` *"can be collected simultaneously"*:

```bash
jcmd <pid> JFR.start name=cpu settings=profile jdk.CPUTimeSample#enabled=true duration=2m filename=/tmp/cpu.jfr
```

🔴 **The disagreement between the two is the finding.** Large wall-clock share with small CPU share
means blocked, and points at a dependency rather than an algorithm.

### 7 · Is the answer outside Java?

If the wide frames are native, or if CPU is going to GC or JIT threads, JFR's classic sampler cannot
attribute it ([07](07-execution-sampling.md)). Two routes:

- **`jdk.CPUTimeSample`** — supported, but experimental and Linux-only.
- **async-profiler** — for kernel frames, non-Java threads and hardware counters
  ([09](09-async-profiler.md)), accepting the container work in
  [09c](09c-running-it-in-a-container.md).

### 8 · Confirm the specific method exactly

Once sampling implicates two or three methods:

```bash
java -XX:StartFlightRecording:jdk.MethodTiming#filter=com.example.Service::process,filename=timing.jfr ...
jfr print --events jdk.MethodTiming timing.jfr
```

Exact counts and durations rather than a sampled estimate ([08](08-jdk-25-jfr.md)).
⚠️ **A few named methods, briefly** — JEP 520 warns that tracing many at once *"would significantly
degrade performance"*.

### 9 · Did the fix work?

🔴 **Not from two flame graphs.** Profiling ranks; it does not measure, and a modest difference is
within the sampling error. Use `jdk.MethodTiming`, a benchmark (topic 14), or the service's own
latency metrics (topic 08).

## What the answer usually is

| Profile shows | Usually |
|---|---|
| Regex / `Pattern` frames | Catastrophic backtracking on an input shape |
| Serialisation / JSON frames | Payload size, or serialising more than the response needs |
| Logging frames | String building on a disabled level, or synchronous appenders — topic 07 |
| `HashMap.get` / collection frames | A caller doing far more lookups than intended — read the tree |
| String formatting | Concatenation in a hot loop |
| `equals` / `hashCode` | An expensive one called from inside a collection lookup |
| GC threads | Allocation rate — an allocation profile, then topic 02 |
| Native frames | A library doing real work; needs [09](09-async-profiler.md) |

🔴 **It is nearly always boring, and it is nearly never the code you suspected.** That is the entire
reason to measure rather than reason.

## Before the next one

1. **Run a continuous recording** — the only way to have evidence from before you looked.
2. **Keep a baseline recording** from a healthy period, somewhere findable.
3. **Check `stackdepth`** if your framework stacks are deep; the default of 64 truncates silently
   and misattributes cost ([04](04-the-event-model.md)).
4. **Decide the container story in advance** ([09c](09c-running-it-in-a-container.md)) — during an
   incident is the wrong time to discover `perf_events` is blocked.
5. **Record what normal looks like.** A profile is a ranking, and a ranking needs something to be
   ranked against.

## Gotchas

**★ Check CPU and GC before profiling anything.**
Idle CPU is a hang — a thread dump, not a profile. GC threads consuming CPU is an allocation or
sizing problem. Profiling a workload that was never CPU-bound is the most expensive mistake here.

**★ Run `jfr summary` first, every time.**
A zero count for the event you came to analyse means it was never enabled. Every viewer shows that
identically to "it did not happen".

**★ `JFR.dump`, never `JFR.stop`, on a continuous recording.**
`stop` ends it, and without a filename the documentation says the data *"is discarded"*.

**★ A profile without a baseline is much harder to read.**
Anything present in both a healthy and an incident recording is what your application does. That
comparison removes most false leads in one step.

**★ Wide with wide children is a path, not a hotspot.**
The cost is above it, nearer the top edge. Optimising it changes nothing.

**★ Wall clock and CPU answer different questions.**
A CPU profile of a latency problem shows almost nothing, because waiting consumes no CPU. Collect
both where you can; their disagreement is the diagnosis.

**★ The classic sampler cannot attribute native code.**
JEP 509 says it *"only samples threads that are currently executing Java code"*. A Java method whose
cost is in a native call looks cheap.

**★ Short recordings produce weaker conclusions.**
JEP 509 names about a minute as the regime where inaccuracies are likely greater. Profile over a
representative period, not over the ninety seconds you had.

**★ Do not verify a fix with two flame graphs.**
Sampling error is comparable to the improvement you are looking for. `jdk.MethodTiming`, a
benchmark, or production latency metrics.

**★ Trace a few methods, not many.**
JEP 520's non-goal is explicit: tracing many methods at once *"would significantly degrade
performance. Use method sampling in such cases."*

**★ Sort out the container story before the incident.**
Whether `perf_events` is available, whether `jcmd` is in the image, whether anyone can run a
privileged process. All are cheap to establish in advance and expensive to discover at 03:00.

**★ The answer is boring and is not the code you suspected.**
Regex backtracking, serialisation, logging, a lookup in the wrong place. Which is exactly why the
measurement beats the intuition.

## Interview questions

**★ "CPU is at 100%." Walk me through it.**
First establish it is a profiling problem: high CPU in *application* threads, not GC threads, and
not an unresponsive service with idle CPU — that would be a thread dump. Then dump the continuous
JFR recording for the window, or start a short high-detail one. `jfr summary` to see what is in it,
`jfr view` for the aggregate, and compare against a healthy baseline. Read the top edge of the flame
graph rather than the widest block. If the frames are native or in non-Java threads, escalate to
`jdk.CPUTimeSample` or async-profiler. Then confirm the implicated method exactly with
`jdk.MethodTiming`.

**★ Why check GC before profiling?**
Because a long GC pause presents as a slowdown and is diagnosed from the GC log rather than a
profile, and because CPU consumed by GC threads is an allocation-rate or heap-sizing problem wearing
a profiling costume. Profiling in either case produces a profile of the symptom. It is a two-minute
check that prevents a day of misdirected work.

**★ What is the single highest-value step in a profiling investigation?**
Comparing against a baseline from a healthy period. A profile in isolation shows what the program
does, which requires you to already know what is normal; against a baseline it shows what changed.
Anything appearing in both is a property of the application rather than a cause of the incident. It
is also the practical argument for continuous recording, since the baseline has to already exist.

**★ Your profile is dominated by a method that consumes no CPU. What does that mean?**
That you are reading a wall-clock profile of a waiting problem. Wall-clock sampling attributes
elapsed time, so a blocking socket read dominates while consuming almost no CPU. Collecting both
`jdk.ExecutionSample` and `jdk.CPUTimeSample` — which JEP 509 confirms can run simultaneously —
makes it explicit: a large wall-clock share with a small CPU share means the time is spent blocked,
which points at a dependency rather than an algorithm.

**★ How do you confirm an optimisation worked?**
Not by comparing flame graphs — sampling error is comparable to the improvement, so a modest
difference is not evidence. `jdk.MethodTiming` on the specific method gives exact per-invocation
statistics, JMH gives a controlled benchmark, and the service's own latency metrics give the
end-to-end answer under real load. Profiling identified where to look; it is the wrong instrument
for measuring the result.

**★ What would you put in place before the next incident?**
A continuous JFR recording with bounded `maxage` and `maxsize`, so evidence from before the incident
exists at all. A baseline recording from a healthy period, kept somewhere findable. A `stackdepth`
raised if the framework stacks are deep, since the default of 64 truncates silently. And a decided
container story — whether `perf_events` is available and whether `jcmd` is even in the image —
because all of that is cheap to answer in advance and expensive to discover during an incident.

**★ In your experience what does the profile usually show?**
Something boring, and rarely the code anyone suspected: catastrophic regex backtracking,
serialisation of more than the response needs, string formatting in a hot loop, an expensive
`equals` invoked from inside a collection lookup, or logging that builds strings for a disabled
level. The consistency of that is the argument for measuring — intuition about where time goes is
unreliable, and the payoff from optimising is bounded by the share of the resource the method
actually consumes.

{/* FOOTER */}
