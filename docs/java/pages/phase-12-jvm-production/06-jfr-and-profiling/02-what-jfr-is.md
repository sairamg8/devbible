---
title: "JFR is an event recorder built into the JVM rather than an agent bolted onto it, which is why it can see things no external profiler can reach and why the JDK publishes a CPU overhead target rather than a benchmark"
sidebar_label: "02 · What JFR is"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 509 "JFR CPU-Time Profiling (Experimental)"** and **JEP 518
> "JFR Cooperative Sampling"**, both Release 25 `Closed/Delivered`, for the description of JFR's
> core mechanism ([openjdk.org](https://openjdk.org/jeps/509)), **JEP 520 "JFR Method Timing &
> Tracing"** (Release 25, `Closed/Delivered`) for the stated overhead target
> ([openjdk.org](https://openjdk.org/jeps/520)), and the **JDK 25 `jfr` tool reference**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jfr.html)).
> 🔴 **No sandbox** — no recording, event table or measurement below is a captured run.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**JFR is not a profiler that happens to ship with the JDK. It is an event recording framework
inside the JVM, of which profiling is one use — and that architectural fact explains everything
that follows: why it can record class loading and GC and JIT activity that no external tool can
observe, why its overhead target is a design constraint rather than a benchmark result, and why
JEP 518 could change how sampling works without changing a single API.**

## An event recorder, not a profiler

JEP 518 describes the core in one sentence:

> *"JFR, the JDK Flight Recorder, is the JDK's profiling and monitoring facility. The core of JFR
> is a low-overhead mechanism for recording events emitted by the HotSpot JVM or by program
> code."*

Read that carefully: **the core is a mechanism for recording events.** Profiling is one thing you
do with it. The same machinery records a class being loaded, a garbage collection, a JIT
compilation, a socket read, a thread parking, a `SecurityManager` check and a method you asked to
trace — all as events, all in one file, all on one timeline.

That last clause is the underrated part. **Because everything shares a timeline, a JFR recording
answers questions that require correlating subsystems** — was the latency spike at 14:03 a GC
pause, a lock, or a slow query? An external CPU profiler cannot answer that, because it only ever
had one kind of data.

JEP 509 adds the two ways events arise:

> *"Some events, such as loading a class, are recorded whenever an action occurs. Others, such as
> those used for profiling, are recorded by statistically sampling the program's activity as it
> consumes a resource."*

🔴 **That distinction — actual events versus statistical samples — is the single most important
thing to understand about reading a recording**, and [04](04-the-event-model.md) develops it. A
class-load event *happened*. A sampled stack trace is an *estimate*. Treating the second like the
first is how people over-interpret profiles.

## Built in, not bolted on

The practical consequences of living inside the JVM rather than attaching to it:

**It sees JVM internals.** GC phases, JIT compilation and deoptimisation, safepoints, class
loading, metaspace, TLAB allocation. An external profiler sees the process from outside and cannot
attribute any of it.

**It needs no agent, no library and no dependency.** No `-javaagent`, no jar to add, no version to
keep in step with your JDK. It is in the JVM you are already running.

**It can be turned on without a restart.** `jcmd JFR.start` on a running process
([03](03-starting-a-recording.md)). This matters enormously during an incident, where "restart
with a profiler attached" both destroys the evidence and often fails to reproduce the problem.

**It is a supported interface.** This turns out to matter more than it sounds, because the
alternative is not. JEP 509, on how third-party tools obtain the same data:

> *"Some popular third-party Java tools, including async-profiler, use Linux's CPU timer to produce
> CPU-time profiles of Java programs. However, to do so, such tools interact with the Java runtime
> through unsupported internal interfaces. This is inherently unsafe and can lead to process
> crashes."*

⚠️ **That is the JDK's own characterisation, and it is fair rather than territorial** — JEP 518
says the same about the JVM's *own* older mechanism, which it replaced precisely because the
heuristics *"can crash the JVM"*. [09](09-async-profiler.md) gives async-profiler its due; the
point here is that "supported" is a real distinction, not marketing.

## The overhead figure, from the JDK rather than from a blog

The number everyone quotes as "about 1%" has an actual source. **JEP 520**, stating it as a design
constraint:

> *"JFR generally aims to impose a CPU overhead of less than one percent."*

🔴 **Note the wording: *aims to impose*.** It is a target the JDK holds itself to, not a measured
result for your application, and it applies to JFR's ordinary event collection. The same JEP
immediately carves out an exception for its own feature:

> *"It is not a goal to remain within this constraint when timing and tracing methods."*

So the honest statement is: **JFR's default configuration is designed to be affordable
continuously; specific high-detail features are explicitly outside that budget.** Quoting "1%
overhead" without the qualifier attributes a guarantee the JDK does not make —
[02b](02b-the-overhead-argument.md) works through what that means in practice.

## Configurable detail, which is why one tool covers dev and prod

JEP 509 again:

> *"The various JFR events can be turned on or off, allowing a more detailed, higher-overhead
> collection of information during development and a less detailed, lower-overhead collection of
> information in production."*

**This is the design that makes always-on viable.** The same recorder runs at low detail in
production and high detail on a developer's machine, and the difference is a settings file rather
than a different tool. [03b](03b-settings-profiles.md) covers `default.jfc` and `profile.jfc`, and
how to build your own.

## A recording is a file, and a file is analysable

A recording is a self-contained binary file, and the JDK ships `jfr` to work with it. From the
tool reference, the subcommands are **`print`**, **`view`**, **`configure`**, **`metadata`**,
**`summary`**, **`scrub`**, **`assemble`** and **`disassemble`**.

Two consequences worth stating early:

**Analysis is offline and reproducible.** You copy a file off the host and analyse it anywhere,
repeatedly, with different questions. Nothing about the analysis touches the running service —
unlike attaching a profiler, which is a live intervention.

**The data is self-describing.** `jfr metadata` prints the event types and their fields, so a
recording carries its own schema. That is why tooling can display events the tool author never
heard of, and why custom events ([04b](04b-custom-events.md)) appear in analysis tools without
those tools being updated.

⚠️ 🔴 **`jfr scrub` exists because recordings contain real data** — file paths, class names, thread
names, and whatever your custom events chose to record. Its documented purpose is to *"remove
sensitive contents or reduce size"*. **Think before attaching a production recording to a ticket
or sending it to a vendor**, and use `scrub` when in doubt.

## What it is not

- **It is not a heap analyser.** It records allocation *events* and can tell you what allocates,
  but "what is retaining this object" is a heap dump question — [topic 04](../04-out-of-memory-error/_plan.md).
- **It is not a debugger.** No breakpoints, no variable inspection. JEP 520's non-goals are
  explicit that recording method arguments and non-static field values is out of scope.
- **It is not a tracing system.** It records within one JVM. Correlating a request across services
  is distributed tracing — topic 09.
- **It is not a metrics backend.** It produces files for investigation, not time series for
  dashboards — topic 08 owns that.

## Gotchas

**★ JFR is an event recorder; profiling is one use of it.**
The core, in JEP 518's words, is *"a low-overhead mechanism for recording events emitted by the
HotSpot JVM or by program code"*. Treating it as "the JDK's profiler" undersells what a recording
contains and hides its real advantage — one timeline across every subsystem.

**★ Some events are facts and some are estimates.**
Class loading is recorded *"whenever an action occurs"*; profiling events are recorded *"by
statistically sampling"*. Reading a sampled stack trace as a thing that definitely happened is the
most common over-interpretation of a recording.

**★ "About 1% overhead" has a source and a qualifier.**
JEP 520: *"JFR generally aims to impose a CPU overhead of less than one percent."* It is a design
aim rather than a measurement of your workload, and the same JEP excludes method timing and
tracing from it explicitly.

**★ Being inside the JVM is what lets it see JVM internals.**
GC phases, JIT compilation, safepoints, class loading, TLAB allocation. No external profiler can
attribute those, which is why a JFR recording answers correlation questions a CPU profile cannot.

**★ It can be started on a running process.**
`jcmd JFR.start` needs no restart. During an incident that is decisive, because restarting both
destroys the evidence and often stops the problem reproducing.

**★ "Supported interface" is a real distinction here.**
JEP 509 says third-party tools reaching the same data through internal interfaces are
*"inherently unsafe and can lead to process crashes"*, and JEP 518 says the JVM's own older
mechanism could crash it too. This is a documented stability property, not a marketing claim.

**★ Recordings contain real data.**
File paths, class names, thread names and anything your custom events record. `jfr scrub` exists
to *"remove sensitive contents"*, and a production recording attached to a public ticket is a
disclosure decision.

**★ The file is self-describing, which is why unknown events still display.**
`jfr metadata` prints event types and fields from the recording itself, so custom events appear in
analysis tools that have never heard of them.

**★ It is not a heap analyser.**
It tells you what *allocates*, which is a rate question. What *retains* is a heap dump question,
and confusing the two sends allocation-profiling effort at a leak.

**★ Detail is a settings file, not a different tool.**
The same recorder covers production and development, differing only in which events are enabled
and at what thresholds. That is the design decision that makes continuous recording practical.

## Interview questions

**★ What is JFR, in one sentence?**
An event recording framework built into the JVM — JEP 518 calls it *"a low-overhead mechanism for
recording events emitted by the HotSpot JVM or by program code"* — of which profiling is one
application. It records JVM internals, application events and sampled stacks onto a single
timeline in a self-contained file.

**★ Why does being built into the JVM matter?**
Three reasons. It can observe things no external tool can attribute — GC phases, JIT compilation,
safepoints, class loading. It needs no agent and no dependency, and can be started on a running
process without a restart, which is decisive during an incident. And it is a supported interface,
where JEP 509 notes that third-party tools reaching similar data through internal interfaces are
*"inherently unsafe and can lead to process crashes"*.

**★ What is JFR's overhead?**
The JDK states a design aim rather than a measurement: JEP 520 says *"JFR generally aims to impose
a CPU overhead of less than one percent"*. Two qualifiers matter — it is an aim for the ordinary
event collection, not a guarantee for your workload, and the same JEP explicitly excludes method
timing and tracing from the constraint. Quoting "1%" without them attributes a promise the JDK
does not make.

**★ What is the difference between the two kinds of JFR event?**
Some record actual occurrences — a class was loaded, a GC ran, a socket read completed. Others are
statistical samples of a thread's stack, taken periodically. The first is a fact; the second is an
estimate whose reliability depends on the sample count. Conflating them leads to reading a single
sampled stack trace as evidence that a specific call happened at a specific time.

**★ How does the same tool serve production and development?**
Through configurable event settings. JEP 509: the events *"can be turned on or off, allowing a
more detailed, higher-overhead collection of information during development and a less detailed,
lower-overhead collection of information in production"*. Production runs a conservative settings
file continuously; development enables high-detail events. It is one recorder with two
configurations, not two tools.

**★ What can a JFR recording answer that a CPU profiler cannot?**
Correlation questions, because everything shares a timeline. Whether the latency spike coincided
with a GC pause, a burst of class loading, a JIT deoptimisation or a lock — a CPU profiler has one
kind of data and cannot relate it to anything else. That breadth, rather than sampling quality, is
JFR's structural advantage.

**★ Would you attach a production JFR recording to a support ticket?**
Not without thought. Recordings contain file paths, class names, thread names and whatever custom
events record, which can include business data. The `jfr scrub` subcommand exists precisely to
*"remove sensitive contents or reduce size"* and takes include and exclude filters for events,
categories and threads. Scrubbing before sharing should be the default rather than the exception.

{/* FOOTER */}
