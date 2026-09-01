---
title: "\"About one percent overhead\" is a real number from a real JEP, and it is an aim rather than a measurement, applies to the default settings rather than to every feature, and is explicitly waived for the two newest events — which is the difference between a defensible default and a claim you cannot support"
sidebar_label: "02b · The overhead argument"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 520 "JFR Method Timing & Tracing"** (Release 25,
> `Closed/Delivered`), which states the overhead aim and its exception
> ([openjdk.org](https://openjdk.org/jeps/520)), **JEP 509 "JFR CPU-Time Profiling
> (Experimental)"** for the configurable-detail argument
> ([openjdk.org](https://openjdk.org/jeps/509)), and the **JDK 25 `jfr` tool reference** for
> `configure` ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jfr.html)).
> 🔴 **No sandbox** — no overhead figure below is a measurement taken here. Every number is quoted
> from the JDK's documentation and attributed.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Whether to run JFR continuously in production is the one decision in this topic that has an
organisational answer as well as a technical one, and it is usually settled by somebody quoting
"about 1% overhead" from a blog post. The number is real and it comes from the JDK. What is
usually dropped is every qualifier attached to it, and the qualifiers are what make the difference
between a defensible default and a claim you cannot support when it turns out to be wrong.**

## What the JDK actually says

**JEP 520**, verbatim:

> *"JFR generally aims to impose a CPU overhead of less than one percent."*

Three words in that sentence are doing work that the popular paraphrase throws away.

**"Aims to."** This is a design constraint the JDK holds itself to, not a measurement of your
application. It says the engineering target for JFR's ordinary event collection is under one
percent; it does not promise that number on your workload, your hardware, or your settings.

**"Generally."** With the default configuration and the default settings profile. Enable enough
high-frequency events and you leave the regime the aim describes.

**"CPU."** The aim is about CPU. It says nothing about disk throughput for a
continuously-written recording, nothing about the memory the recorder uses, and nothing about the
allocation an application's own custom events might cause.

🔴 **And the very same JEP immediately carves out an exception**, for the feature it is
introducing:

> *"It is not a goal to remain within this constraint when timing and tracing methods."*

So `jdk.MethodTiming` and `jdk.MethodTrace` are **explicitly outside the budget**, by the
document that states the budget. Any policy of the form "JFR is under 1%, so we can turn on
anything" is contradicted by the JEP that supplies the number.

## Why the design supports always-on anyway

The qualifiers narrow the claim; they do not undermine the practice. The architectural argument
for continuous recording is separate and stronger:

**Detail is configurable, so cost is a choice.** JEP 509:

> *"The various JFR events can be turned on or off, allowing a more detailed, higher-overhead
> collection of information during development and a less detailed, lower-overhead collection of
> information in production."*

That is the design intent stated outright: **the same recorder is meant to run at two different
cost points**, and production is the cheap one.

**The recorder is inside the JVM**, so it is not paying the cost of an external agent
instrumenting bytecode or attaching over a socket ([02](02-what-jfr-is.md)).

**Events are cheap by construction.** Most of what a low-detail profile records is either
something the JVM was going to notice anyway — a GC, a class load, a compilation — or a periodic
sample.

## The argument that actually wins

The overhead debate is usually framed as *cost of running it* versus *nothing*, which is the
wrong comparison. The right one is **cost of running it versus cost of not having it during an
incident.**

Without a continuous recording:

- The evidence for an incident **exists only if somebody was recording at the time**. Most
  incidents are noticed after they start and understood after they end.
- Reproducing means **restarting with profiling enabled**, which destroys the state that caused
  the problem and frequently fails to reproduce it — the same argument
  [topic 05](../05-thread-dumps/02b-take-three-of-them.md) makes about taking dumps before
  restarting.
- The questions a thread dump structurally cannot answer
  ([08](../05-thread-dumps/08-what-a-dump-cannot-tell-you.md)) — where time went, what allocated,
  what happened five minutes ago — have **no answer at all**.

🔴 **A percent of CPU is cheap. A repeat incident with no evidence is not.** That is the argument
to make, and it does not depend on defending a number.

## Being honest about what it costs

If you are going to run it continuously, the defensible position is to know the terms rather than
recite a figure:

| Cost | What decides it |
|---|---|
| **CPU** | The settings profile and which events are enabled. The stated aim covers the default regime |
| **Disk** | Continuous recording writes to a repository — bounded by `maxsize`, aged out by `maxage` ([03c](03c-continuous-recording-in-production.md)) |
| **Memory** | Buffers and the in-memory portion of the recording |
| **Application allocation** | Your own custom events, if written carelessly ([04b](04b-custom-events.md)) |

⚠️ **The disk one is the one people forget.** A continuously written recording is a file on a
container's filesystem, and an unbounded one is a disk-full incident caused by your diagnostics.
`maxsize` and `maxage` are not optional.

## How to answer "what does it cost us" properly

**Measure it, once, on your own service.** Run a representative load test with and without the
production settings profile and compare throughput and latency. That takes an afternoon and
replaces every argument in this page with a number that applies to you.

**Then keep the settings under review**, because the cost follows the configuration rather than
the tool. A team that measured 0.5% two years ago and has since enabled a dozen extra events has a
number that no longer describes anything.

⚠️ **Do not measure it by enabling everything.** `profile.jfc` is the development profile
([03b](03b-settings-profiles.md)); measuring its cost and reporting it as "JFR's overhead" is how
JFR gets banned from production on the strength of a number that was never claimed for it.

## Gotchas

**★ "About 1%" is an aim, not a measurement.**
JEP 520: *"JFR generally aims to impose a CPU overhead of less than one percent."* It is the
JDK's engineering target for the ordinary regime, not a guarantee about your workload, hardware
or settings.

**★ The same JEP that gives the number excludes its own feature from it.**
*"It is not a goal to remain within this constraint when timing and tracing methods."* So
`jdk.MethodTiming` and `jdk.MethodTrace` are outside the budget by definition, and a blanket
"JFR is under 1%" policy is contradicted by its own source.

**★ The aim is about CPU only.**
It says nothing about disk for a continuous recording, memory for buffers, or allocation caused by
custom events. Those are separate budgets with separate failure modes.

**★ Measuring `profile.jfc` and calling it "JFR's overhead" is how JFR gets banned.**
That is the high-detail development profile. Benchmarking it and reporting the result as the cost
of running JFR in production misattributes a cost the JDK never claimed.

**★ An unbounded continuous recording is a disk-full incident you caused.**
`maxsize` and `maxage` bound the repository. Diagnostics that take a service down are worse than
no diagnostics.

**★ The comparison is not "cost versus nothing".**
It is cost versus having no evidence during an incident. Most incidents are noticed after they
start, and restarting with profiling enabled destroys the state and often fails to reproduce the
problem.

**★ Cost follows configuration, so a measurement ages.**
A number measured before a dozen extra events were enabled describes a configuration that no
longer exists. Re-measure when the settings change, not when somebody asks.

**★ Custom events can cost more than JFR does.**
The framework is careful; an event allocated and committed in a hot loop without a
`shouldCommit()` guard is not. That cost is yours, not JFR's —
[04b](04b-custom-events.md).

**★ The strongest argument does not depend on the number.**
Configurable detail, in-JVM recording and the value of having evidence already recorded are the
case for always-on. Anchoring the argument to a percentage invites a debate about the percentage.

## Interview questions

**★ What is JFR's overhead?**
The JDK states an aim rather than a measurement: JEP 520 says *"JFR generally aims to impose a CPU
overhead of less than one percent"*. Three qualifiers matter — it is an aim, it is *generally*
(that is, the default configuration), and it is *CPU*, so disk and memory are separate. The same
JEP then excludes method timing and tracing from the constraint explicitly.

**★ Would you run JFR continuously in production?**
Yes, with a conservative settings profile and bounded `maxsize` and `maxage`. The design supports
it — JEP 509 describes exactly this split between higher-overhead development collection and
lower-overhead production collection — and the alternative is having no evidence for incidents
that are noticed after they begin. But I would measure the cost once on our own service under
representative load rather than quoting a JEP at anyone.

**★ Someone benchmarks JFR, finds 8% overhead, and wants it removed. What do you check first?**
Which settings profile they used. `profile.jfc` is the high-detail development configuration, and
measuring its cost is not measuring the cost of production JFR. I would also check whether method
timing or tracing events were enabled, since JEP 520 explicitly places those outside the overhead
aim, and whether the application defines custom events without `shouldCommit()` guards — that cost
belongs to the application rather than to JFR.

**★ What does the overhead figure not cover?**
Disk and memory. It is a CPU aim. A continuously written recording consumes disk in a repository,
which must be bounded with `maxsize` and `maxage` or it becomes a disk-full incident, and the
recorder uses memory for buffers. It also does not cover the cost of an application's own custom
events, which is under the application's control rather than JFR's.

**★ How would you justify always-on recording to a team that is nervous about it?**
By reframing the comparison. The question is not "what does a percent of CPU cost" but "what does
it cost to have no evidence during an incident". Most incidents are recognised after they begin, so
a recording started in response to one has already missed the cause; and restarting with profiling
enabled destroys the state and often does not reproduce the problem. Then I would settle it with a
measurement on our own service rather than an argument.

**★ Why does the JDK state an aim rather than publish a benchmark?**
Because the cost is a function of configuration and workload, not of the tool. Which events are
enabled, at what thresholds, on what hardware, under what allocation rate all change the answer, so
a single published number would be misleading for almost everyone. An engineering target for the
default regime is the honest form of the claim, and it is why the right response to "what does it
cost us" is a measurement on your own service.

{/* FOOTER */}
