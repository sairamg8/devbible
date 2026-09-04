---
title: "High CPU with no errors, nothing in the logs and a thread dump that shows threads doing perfectly reasonable things is the failure that thread dumps cannot close — because the question has changed from what is blocked to where the time goes, and only one of those has an answer with three samples"
sidebar_label: "01 · The regex that ate a core"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 509 "JFR CPU-Time Profiling (Experimental)"** (Release 25,
> `Closed/Delivered`), whose Motivation section states the case for profiling and the deficiencies
> of sample-based approaches ([openjdk.org](https://openjdk.org/jeps/509)), and the **JDK 25
> Troubleshooting Guide**, "Troubleshoot Process Hangs and Loops → Diagnose a Loop Process"
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/troubleshoot/troubleshoot-process-hangs-loops.html)).
> 🔴 **No sandbox.** There is no JVM behind these pages: no flame graph, event table, timing or
> percentage here is a measurement. Quoted figures are the documentation's own and are attributed.
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**[Topic 05](../05-thread-dumps/README.md) answered "what is blocked". This topic answers "what is
busy", and they need different tools for a reason that is structural rather than cultural: a
thread dump has no time axis, so three samples can prove a thread is *stuck* and can never
establish that a method is *hot*. This page is the incident that makes the difference concrete,
and the argument for why profiling has to be a sampling problem.**

## The incident

A service is slow. Latency has roughly doubled. And every signal you would normally use is
unhelpful:

- **No errors.** Nothing is failing; everything is just late.
- **Nothing in the logs.** The slow path logs the same lines it always did.
- **The heap is flat and GC is quiet.** Not a memory problem.
- **CPU is high** — one or two cores pinned, which rules out the entire hang investigation.
- **A thread dump shows threads in application code**, in different frames each time, doing things
  that look completely reasonable.

That last point is the one that matters. **The dump is working correctly and telling you nothing**,
because every thread it shows you is legitimately executing. The Troubleshooting Guide separates
"Diagnose a Loop Process" from "Diagnose a Hung Process" for exactly this reason: they need
different evidence.

**The cause, in this class of incident, is usually mundane and invisible**: a regular expression
whose backtracking is exponential on a particular input shape, a `String.format` in a loop that
runs a hundred times more often than anyone thought, a serialisation path that got slower when a
field became a collection, an `equals` on a big object graph called inside a `contains`. Each of
these is ordinary code doing exactly what it was written to do, at a volume nobody measured.

## Why the dump cannot close it

A dump records **position**, not **duration**.

Suppose `Pattern.matches` appears in all three dumps. That is consistent with three completely
different worlds:

1. It consumes 99% of the CPU — the hotspot you are looking for.
2. It is on the stack of a long outer call that spends its time elsewhere.
3. Coincidence. Three samples is three samples.

🔴 **There is no way to distinguish these from three observations.** For the *stuck* case that
distinction did not matter — a stuck thread is not being sampled, it genuinely is not moving, so
presence in all three dumps is decisive. For the *hot* case, presence is not proportion, and
proportion is the entire question.

⚠️ **And scripting dumps every few seconds does not fix it.** That is hand-building a profiler out
of an expensive tool that was not designed for it — with a documented impact rating that scales
with thread count, no aggregation, and a sample rate orders of magnitude too low.

## What a profiler does differently

A profiler takes **thousands** of samples and aggregates them. That single change converts
presence into proportion: if `Pattern.matches` appears in 62% of samples, it accounts for
approximately 62% of the sampled resource, and the confidence comes from the sample count.

JEP 509 states the value plainly in its Motivation:

> *"Profiling can help make a program more efficient, and developers more productive, by
> identifying which program elements to optimize. Without profiling, we might optimize a method
> that consumes few resources to begin with, having little impact on the program's overall
> performance while wasting effort."*

and quantifies why the *proportion* is the thing that matters:

> *"For example, optimizing a method that takes up 0.1% of the program's total execution time to
> run ten times faster will only reduce the program's execution time by 0.09%."*

🔴 **That sentence is the whole argument for profiling before optimising.** Effort spent on a
method is repaid in proportion to the share of the resource it consumes, and intuition about that
share is unreliable — which is why the answer to "where should I optimise" is always a measurement
and never a guess.

## Two resources, two profiles, and they disagree

The distinction that catches people is that "slow" and "using CPU" are different measurements.
JEP 509 draws it precisely:

> *"A CPU profile shows the relative amount of CPU cycles consumed by different methods. This is
> not necessarily related to the relative amount of total execution time it consumes. A method
> that sorts an array, for example, spends all of its time on the CPU. Its execution time
> corresponds to the number of CPU cycles it consumes. In contrast, a method that reads from a
> network socket might spend most of its time idly waiting for bytes to arrive over the wire. Of
> the time it consumes, only a small portion is spent on the CPU."*

So there are two questions and they have different answers:

| Question | The profile you want | The method that dominates |
|---|---|---|
| **What is burning CPU?** | CPU-time profile | The sort, the regex, the serialisation |
| **What is making requests slow?** | Wall-clock profile | The socket read, the lock wait, the disk |

⚠️ **Bringing a CPU profile to a latency problem is the standard mistake**, and it produces a
profile in which the actual cause — waiting — barely appears, because waiting consumes no CPU.
[07](07-execution-sampling.md) and [09](09-async-profiler.md) return to this, because the tools
differ in which one they give you by default.

**And the reverse matters too**, as the JEP notes: *"a CPU profile is important even for server
applications that perform a lot of IO, as the throughput of such applications may be bound by CPU
usage when under heavy workloads."* An I/O-bound service still has a CPU ceiling.

## Where this topic goes

The rest of the topic is: what JFR is and why it can be always-on
([02](02-what-jfr-is.md)), how to record ([03](03-starting-a-recording.md)), what the events are
([04](04-the-event-model.md)), how to analyse without a GUI
([05](05-the-jfr-command-line-tool.md)) and with one ([06](06-jdk-mission-control.md)), how
sampling actually works and where it lies ([07](07-execution-sampling.md)), what JDK 25 changed
([08](08-jdk-25-jfr.md)), where async-profiler still wins ([09](09-async-profiler.md)), and how to
choose ([10](10-choosing-between-them.md)).

🔴 **The one thing to take from this page:** when the dumps show threads *working*, stop taking
dumps. The tool has told you everything it can, and the next question needs a sample count that
only a profiler can produce.

## Gotchas

**★ A thread dump records position, not duration.**
A frame's presence says nothing about time spent in it. That is decisive evidence for a stuck
thread — it genuinely is not moving — and weak evidence for a hot method, where presence is not
proportion.

**★ High CPU with no errors is the signature that you need a profiler, not a dump.**
Errors point at code paths; logs point at events; dumps point at blockage. A service that is
merely *slow while working* leaves none of those traces, which is exactly the gap profiling fills.

**★ Scripting thread dumps in a loop is hand-building a bad profiler.**
No aggregation, a sample rate orders of magnitude too low, and a documented impact that scales
with thread count. If you are taking dumps to find where time goes, you have the wrong tool.

**★ CPU time and wall-clock time are different profiles with different answers.**
JEP 509: a method reading from a socket spends most of its time idle, so *"only a small portion is
spent on the CPU"*. A CPU profile of a latency problem can show almost nothing about the cause.

**★ An I/O-bound service still has a CPU ceiling.**
The same JEP notes that throughput for such applications *"may be bound by CPU usage when under
heavy workloads"*. "We are I/O bound" is not a reason to skip CPU profiling.

**★ Optimising without profiling is repaid in proportion to a share you guessed.**
JEP 509's arithmetic: making a method that takes 0.1% of execution time ten times faster improves
the program by 0.09%. The share, not the speedup, sets the ceiling on the payoff.

**★ The cause of this class of incident is usually ordinary code.**
Catastrophic regex backtracking, formatting in a hot loop, an `equals` over a large graph inside a
`contains`. Nothing looks wrong in review because nothing *is* wrong, except the volume — which is
precisely what a profile measures and reading cannot.

**★ Nothing in the standard dashboards distinguishes "slow" from "broken".**
Error rate, heap and GC are all normal during a CPU-bound slowdown. The absence of a signal reads
as the absence of a problem, which is the same trap [topic 05](../05-thread-dumps/01-the-service-that-stopped-responding.md)
describes for hangs.

## Interview questions

**★ When does a thread dump stop being the right tool?**
When threads are moving between dumps. Different frames each time means they are working, so the
question has changed from "what is blocked" to "where does the time go" — and a dump has no time
axis. Three samples can prove a thread is stuck, because a stuck thread genuinely is not moving,
but they cannot establish that a method is hot, because presence is not proportion.

**★ Why can't you just take more thread dumps to find a hot method?**
Because you would be building a profiler badly. A useful profile needs thousands of samples to
turn presence into proportion, aggregation to summarise them, and low enough overhead to run at
that rate — none of which a hand-driven dump loop provides. `Thread.print` is rated Impact:
Medium depending on thread count, so the sample rate you would need is exactly the rate you cannot
afford.

**★ What is the difference between a CPU profile and a wall-clock profile?**
A CPU profile attributes CPU cycles; a wall-clock profile attributes elapsed time. JEP 509 gives
the canonical example: a method sorting an array spends all its time on the CPU, so the two
coincide, while a method reading from a socket spends most of its time idle and consumes very
little CPU. A latency problem caused by waiting is nearly invisible in a CPU profile, and bringing
the wrong one is the standard mistake.

**★ Your service is I/O bound. Is CPU profiling still worth doing?**
Yes. JEP 509 makes the point directly: throughput for I/O-heavy server applications *"may be bound
by CPU usage when under heavy workloads"*. The service waits most of the time per request, but
across many concurrent requests the CPU work — deserialisation, mapping, logging, TLS — can become
the ceiling. "We are I/O bound" describes the latency profile, not the throughput limit.

**★ Why profile before optimising, rather than optimising the code that looks slow?**
Because the payoff is bounded by the share of the resource the method consumes, and intuition
about that share is unreliable. JEP 509's arithmetic makes it concrete: a tenfold speedup of a
method accounting for 0.1% of execution time buys 0.09%. Profiling is what tells you which methods
are worth the effort, and it very often disagrees with the code that "looks" expensive.

**★ Describe an incident that only a profiler would resolve.**
A service whose latency doubles with no errors, nothing new in the logs, a flat heap, quiet GC and
one or two cores pinned — while thread dumps show threads in different application frames each
time, all doing reasonable things. Every thread is legitimately executing, so there is nothing to
find in a dump. The cause is typically ordinary code running far more often or far longer than
anyone assumed: catastrophic regex backtracking, formatting in a hot loop, or an expensive
`equals` called from inside a collection lookup.

{/* FOOTER */}
