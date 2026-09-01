---
title: "Some JFR events record something that definitely happened and others are statistical samples of something that might have, and reading the second kind like the first is the most common way to draw a confident wrong conclusion from a recording"
sidebar_label: "04 · The event model"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 509 "JFR CPU-Time Profiling (Experimental)"** for the
> distinction between recorded actions and statistical samples, and for `jdk.CPUTimeSample` and
> `jdk.ExecutionSample` ([openjdk.org](https://openjdk.org/jeps/509)), **JEP 520 "JFR Method
> Timing & Tracing"** for `jdk.MethodTiming` and `jdk.MethodTrace`
> ([openjdk.org](https://openjdk.org/jeps/520)), the **JDK 25 `jfr` tool reference** for
> `metadata` ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jfr.html)),
> and the **JDK 25 `jcmd` tool reference** for `JFR.configure`'s `stackdepth` default
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html)).
> 🔴 **No sandbox** — no event table, count or measurement below is a captured run.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**A recording is a stream of typed events on one timeline. Understanding two things about that
stream — how the events differ in kind, and that the schema travels with the file — is what
separates reading a recording from guessing at one. The first distinction is the important one and
JEP 509 states it in a single sentence.**

## The distinction that governs everything

JEP 509:

> *"Some events, such as loading a class, are recorded whenever an action occurs. Others, such as
> those used for profiling, are recorded by statistically sampling the program's activity as it
> consumes a resource."*

🔴 **Those are two fundamentally different kinds of claim, and they license different
conclusions:**

| | **Recorded actions** | **Statistical samples** |
|---|---|---|
| What it means | This happened, at this time | The thread was here when we looked |
| Examples | Class loaded, GC ran, method compiled, socket read completed | `jdk.ExecutionSample`, `jdk.CPUTimeSample`, allocation samples |
| A single one proves | The thing occurred | **Almost nothing** |
| Reading them | Individually, as facts | **Only in aggregate, as proportions** |
| Completeness | Every occurrence (subject to thresholds) | A subset by construction |

**The failure mode is reading a sample as a fact.** A single `jdk.ExecutionSample` showing
`Pattern.matches` does not mean a regex ran at that moment in any meaningful sense — it means that
when the sampler looked, that thread's stack had that frame. One sample is noise. Sixty percent of
samples is a finding.

⚠️ **And the reverse mistake exists too:** treating an aggregate of recorded actions as a sample.
If a recording contains four hundred `GarbageCollection` events, that is four hundred garbage
collections, not an estimate of a rate. Those you can count.

## The third kind: thresholded duration events

Many action events have a **threshold** — record only occurrences longer than N — which produces a
third reading rule that catches people out.

A thresholded event is **complete above its threshold and blind below it**. So:

🔴 **You cannot compute a total from a thresholded event.** If socket reads are recorded above
10 ms, the recording contains the slow ones and none of the fast ones. Summing them gives the time
spent in slow reads, not the time spent reading — and using it as the latter overstates the average
enormously while understating the total.

**What thresholded events are good for is exactly what they are designed for:** finding the
outliers. "Show me every socket read over 10 ms with its stack" is the question they answer well,
and it is usually the question worth asking.

⚠️ Thresholds are also the main lever between the shipped settings profiles
([03b](03b-settings-profiles.md)) — which means the *same* event answers different questions
depending on the profile the recording used, and `JFR.check verbose=true` is how you find out
which.

## The events worth knowing by name

Not an inventory — `jfr metadata` prints the full list ([05](05-the-jfr-command-line-tool.md)).
These are the ones that answer the questions this phase asks:

**Profiling (samples — read as proportions):**

- **`jdk.ExecutionSample`** — the classic wall-clock-interval stack sample. JEP 509 describes its
  limitations candidly ([07](07-execution-sampling.md)).
- **`jdk.CPUTimeSample`** — 🔴 JDK 25, **experimental, Linux only, not enabled by default**. Samples
  at fixed intervals of *CPU time* rather than elapsed time. JEP 509: *"Enabling CPU-time events
  does not affect execution-time events in any way, so the two can be collected simultaneously."*
- **Allocation sampling events** — what is allocating, and where. The allocation counterpart to
  execution sampling, and the reason "what is producing garbage" is answerable at all.

**Actions (facts — countable):**

- **Garbage collection events**, including phases. Cross-checked against the GC log, which topic 02
  owns.
- **Class loading**, which is how a metaspace or classloader question
  ([topic 01](../01-memory-layout/04c-the-classloader-leak.md)) gets a timeline.
- **JIT compilation and deoptimisation**, which is how a code-cache or warm-up question gets one.
- **Thread park/block events**, which are the JFR view of what
  [topic 05](../05-thread-dumps/README.md) reads from a dump.
- **Socket and file I/O events**, thresholded — the outlier finder above.
- **Exception events**, which are cheap to leave off and revealing when on: a hot path throwing
  and swallowing exceptions is invisible in every other tool.

**Instrumentation (JDK 25, exact by construction):**

- **`jdk.MethodTiming`** and **`jdk.MethodTrace`** — JEP 520. These are neither samples nor
  ordinary actions: they are **bytecode instrumentation of named methods**, so their goal is
  *"complete and exact statistics rather than incomplete and inexact sample-based statistics"*.
  🔴 Outside the overhead aim, and its non-goals warn against tracing many methods at once
  ([08](08-jdk-25-jfr.md)).

## Every event has a stack trace, and it may be truncated

Most events carry a stack trace, which is what makes them actionable — an allocation event without
a stack tells you allocation happened, which you knew.

🔴 **The depth is capped.** `JFR.configure`'s `stackdepth` is documented as *"Stack depth for stack
traces. Setting this value greater than the default of 64 may cause a performance degradation."*

**64 frames is not many for a modern framework stack.** A request through a servlet container,
security filters, a proxy chain, an ORM and a driver can exceed it — and when it does, the trace is
truncated, so the cost is attributed to whatever frame survives. **The profile is silently wrong
rather than obviously incomplete.**

⚠️ And it *"cannot be changed once JFR has been initialized"*, so raising it is a launch-time
decision made before you know you need it. If your stacks are deep, raise it deliberately and
accept the documented cost.

## The schema travels with the file

```bash
jfr metadata recording.jfr
jfr metadata --events jdk.CPUTimeSample recording.jfr
```

The tool reference: *"Print metadata information about flight recording events"*, filterable by
`--categories` and `--events`.

**A recording describes its own event types and their fields.** Three consequences:

1. **Tools display events they have never heard of**, including your custom ones
   ([04b](04b-custom-events.md)), because the file explains them.
2. **The recording is self-contained** — analysable years later, on a different machine, without
   the JDK that produced it.
3. 🔴 **`jfr metadata` is how you find out what an event actually contains** rather than guessing
   from its name. Field names and types are in the file; before writing a query
   ([05](05-the-jfr-command-line-tool.md)), look.

## One timeline, which is the real advantage

Everything shares a clock. That is what lets a recording answer questions no single-purpose tool
can:

- Did the latency spike coincide with a GC pause, or with a burst of class loading, or with a JIT
  deoptimisation?
- Was the allocation spike before or after the thread pool saturated?
- Did the slow requests cluster around one event, or spread evenly?

🔴 **A CPU profiler has one kind of data and cannot relate it to anything.** JFR's breadth —
rather than its sampling quality, where async-profiler competes seriously
([09](09-async-profiler.md)) — is its structural advantage.

## Gotchas

**★ Samples are not facts.**
JEP 509 distinguishes events *"recorded whenever an action occurs"* from those *"recorded by
statistically sampling"*. A single sampled stack means the thread was there when the sampler
looked, nothing more. Read samples in aggregate, as proportions.

**★ Recorded actions *are* countable, and treating them as estimates is the opposite error.**
Four hundred GC events is four hundred collections. Class loads, compilations and exceptions can
be counted directly.

**★ A thresholded event cannot give you a total.**
It is complete above the threshold and blind below it. Summing thresholded socket-read durations
gives time spent in *slow* reads, not time spent reading — a number that is wrong in a direction
that looks plausible.

**★ The same event answers different questions in different profiles.**
Thresholds are the main difference between `default.jfc` and `profile.jfc`, so a recording's
threshold determines what its events mean. `JFR.check verbose=true` is how you find out which
settings were in force.

**★ Stack traces cap at 64 frames by default.**
Deep framework stacks exceed that, and a truncated stack attributes cost to the surviving frame —
so the profile is silently wrong rather than visibly incomplete.

**★ `stackdepth` cannot be changed after JFR initialises.**
It is a launch-time decision, made before you know whether you need it, and raising it is
documented as possibly causing *"a performance degradation"*.

**★ `jdk.CPUTimeSample` is off by default, experimental, and Linux-only.**
Three qualifiers that all matter. It also coexists with `jdk.ExecutionSample` rather than replacing
it — JEP 509 says the two *"can be collected simultaneously"*.

**★ `jdk.MethodTiming` and `jdk.MethodTrace` are a third kind of event.**
Bytecode instrumentation, aiming at *"complete and exact statistics"* rather than samples — and
correspondingly outside the overhead aim, with an explicit warning against tracing many methods at
once.

**★ Read `jfr metadata` before writing a query.**
Event field names and types are in the recording. Guessing them from the event name is how a query
returns nothing and gets mistaken for an absence of data.

**★ The single timeline is the thing a CPU profiler cannot replicate.**
Correlating a latency spike with a GC pause, a class-loading burst or a deoptimisation requires
having all of them on one clock. That breadth is JFR's structural advantage.

## Interview questions

**★ What are the two kinds of JFR event, and why does the distinction matter?**
JEP 509 puts it directly: some events are *"recorded whenever an action occurs"* — a class load, a
GC, a compilation — and others are *"recorded by statistically sampling"*. The first are facts you
can count individually. The second are estimates that only mean something in aggregate. Reading a
single sampled stack as evidence that a specific call happened is the most common way to draw a
confident wrong conclusion from a recording.

**★ Your recording has socket read events with a 10 ms threshold. Can you compute total time spent
in socket reads?**
No. A thresholded event is complete above the threshold and blind below it, so summing gives the
time spent in *slow* reads only. The number looks like a total and is not one — it understates the
aggregate while overstating the typical duration. Thresholded events answer "show me the outliers
and their stacks", which is what they exist for.

**★ Why might a JFR profile attribute cost to the wrong method?**
Stack depth truncation. `stackdepth` defaults to 64 frames, and a request through a servlet
container, security filters, a proxy and an ORM can exceed that. When the trace is truncated the
cost is attributed to whatever frame survives, so the profile is silently wrong. Raising it is
documented as possibly degrading performance and cannot be changed after JFR initialises.

**★ What is `jdk.CPUTimeSample` and how does it differ from `jdk.ExecutionSample`?**
It samples at fixed intervals of CPU time rather than elapsed real time, using the Linux kernel's
CPU timer, which gives a more accurate CPU profile — including for threads running native code,
which the older sampler misses. It is new in JDK 25 (JEP 509), experimental, Linux-only, and not
enabled by default. It does not replace the execution sampler: the JEP notes that enabling it
*"does not affect execution-time events in any way, so the two can be collected simultaneously"*.

**★ How do you find out what fields an event has?**
`jfr metadata recording.jfr`, optionally filtered with `--events` or `--categories`. The recording
carries its own schema, which is also why analysis tools can display custom events they have never
heard of, and why a recording remains analysable years later without the JDK that produced it.
Guessing field names from an event's name is how a query silently returns nothing.

**★ What can a JFR recording answer that a dedicated CPU profiler cannot?**
Correlation questions, because every event shares one timeline. Whether a latency spike coincided
with a GC pause, a burst of class loading or a JIT deoptimisation; whether allocation rose before or
after a pool saturated. A CPU profiler has one kind of data and no way to relate it to anything
else. That breadth, rather than sampling fidelity, is JFR's structural advantage.

**★ How are `jdk.MethodTiming` and `jdk.MethodTrace` different in kind from the profiling events?**
They are bytecode instrumentation of specifically named methods rather than sampling, so JEP 520's
stated goal is *"complete and exact statistics rather than incomplete and inexact sample-based
statistics"*. Every invocation is recorded, not a subset. The cost of that exactness is that they
sit outside JFR's overhead aim by the JEP's own statement, and its non-goals warn against applying
them to many methods at once — for which the answer is sampling.

{/* FOOTER */}
