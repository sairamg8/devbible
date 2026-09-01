---
title: "JFR and profiling: a thread dump tells you why nothing is happening, and nothing in it can tell you where the time goes — because three samples can prove a thread is stuck and can never establish that a method is hot"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against **JEP 509 "JFR CPU-Time Profiling (Experimental)"**, **JEP 518 "JFR
> Cooperative Sampling"** and **JEP 520 "JFR Method Timing & Tracing"** — all Release 25,
> `Closed/Delivered` ([openjdk.org](https://openjdk.org/jeps/509)); the **JDK 25 `jcmd` and `jfr`
> tool references** ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/specs/man/jcmd.html));
> the **`jdk.jfr.Event` API documentation**
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/jdk.jfr/jdk/jfr/Event.html));
> the **OpenJDK Mission Control project README** ([github.com/openjdk/jmc](https://github.com/openjdk/jmc));
> and the **async-profiler 4.5** README, `CpuSamplingEngines`, `FlamegraphInterpretation` and
> `ProfilingInContainer` docs
> ([github.com/async-profiler/async-profiler](https://github.com/async-profiler/async-profiler)).
> 🔴 **No sandbox.** There is no JVM, container or profiler run behind these pages. Every figure is
> quoted from documentation and attributed, or labelled a schematic. No flame graph, event table,
> percentage or timing here is a measurement.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**[Topic 05](../05-thread-dumps/README.md) answered "what is blocked". This topic answers "what is
busy", and they need different tools for a structural reason: a thread dump has no time axis. Three
samples can prove a thread is stuck — a stuck thread genuinely is not moving — and can never
establish that a method is hot, because presence is not proportion. This topic is the tooling that
turns presence into proportion, and the honest account of how far you can trust the result.**

JDK 25 changed profiling in three ways that most published material predates, and each gets argued
from the JEP rather than asserted: **`jdk.CPUTimeSample`** finally attributes CPU spent in native
code — experimental, Linux-only, off by default; **cooperative sampling** removed stack-parsing
heuristics the JDK says *"can crash the JVM"*, while conceding it *"does not entirely avoid"*
safepoint bias; and **`jdk.MethodTiming`/`jdk.MethodTrace`** give exact per-invocation numbers,
explicitly outside JFR's own overhead aim.

**19 chunks, ~4,500 lines, 320 gotchas and interview questions.** Read in order.
[11 · The checklist](11-the-checklist.md) is the page to open during an incident.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The regex that ate a core](01-the-regex-that-ate-a-core.md)** | <span className="db-tier t-understand">Understand</span> | The incident a dump cannot close, and why profiling is a sampling problem |
| 2 | **[What JFR is](02-what-jfr-is.md)** | <span className="db-tier t-understand">Understand</span> | An event recorder inside the JVM; profiling is one use of it |
| 3 | **[The overhead argument](02b-the-overhead-argument.md)** | <span className="db-tier t-understand">Understand</span> | "About 1%" has a source, and three qualifiers everyone drops |
| 4 | **[Starting a recording](03-starting-a-recording.md)** | <span className="db-tier t-understand">Understand</span> | `jcmd JFR.start` on a live JVM, and the options that matter |
| 5 | **[Settings profiles](03b-settings-profiles.md)** | <span className="db-tier t-understand">Understand</span> | `default.jfc` vs `profile.jfc` — where most overhead disputes come from |
| 6 | **[Continuous recording in production](03c-continuous-recording-in-production.md)** | <span className="db-tier t-understand">Understand</span> | The only way to have evidence from before you looked |
| 7 | **[The event model](04-the-event-model.md)** | <span className="db-tier t-understand">Understand</span> | Facts vs samples, and why thresholds forbid totals |
| 8 | **[Custom events](04b-custom-events.md)** | <span className="db-tier t-understand">Understand</span> | Subclass, set, commit — and the field types silently dropped |
| 9 | **[Custom events in production](04b2-custom-events-in-production.md)** | <span className="db-tier t-understand">Understand</span> | `shouldCommit()` guards your cost, not JFR's |
| 10 | **[The jfr command-line tool](05-the-jfr-command-line-tool.md)** | <span className="db-tier t-understand">Understand</span> | Analysis with no GUI, and `JFR.view` against a live JVM |
| 11 | **[JDK Mission Control](06-jdk-mission-control.md)** | <span className="db-tier t-understand">Understand</span> | Not in every JDK; what a GUI is genuinely better at |
| 12 | **[Reading the automated analysis](06b-reading-the-automated-analysis.md)** | <span className="db-tier t-understand">Understand</span> | A systematic sweep, not an expert opinion |
| 13 | **[Execution sampling](07-execution-sampling.md)** | <span className="db-tier t-understand">Understand</span> | The three deficiencies the JDK enumerates, and safepoint bias |
| 14 | **[What JDK 25 changed](08-jdk-25-jfr.md)** | <span className="db-tier t-understand">Understand</span> | JEPs 509, 518 and 520 — with the qualifiers summaries drop |
| 15 | **[async-profiler](09-async-profiler.md)** | <span className="db-tier t-understand">Understand</span> | Kernel frames and non-Java threads; the JDK's safety objection |
| 16 | **[Flame graphs](09b-flame-graphs.md)** | <span className="db-tier t-understand">Understand</span> | The x-axis is alphabetical, not time |
| 17 | **[Running it in a container](09c-running-it-in-a-container.md)** | <span className="db-tier t-understand">Understand</span> | Docker blocks `perf_event_open`, and the three ways round it |
| 18 | **[Choosing between them](10-choosing-between-them.md)** | <span className="db-tier t-understand">Understand</span> | Which blind spot are you in — and what JDK 25 moved |
| 19 | **[The checklist](11-the-checklist.md)** | <span className="db-tier t-understand">Understand</span> | "CPU is at 100%" in nine ordered questions |

## The eight things this topic is really about

1. **Presence is not proportion.** A frame appearing in every sample is decisive for a *stuck*
   thread and weak for a *hot* one. Turning presence into proportion needs thousands of samples,
   which is what a profiler is and what a dump loop is not.

2. **Profiles rank; they do not measure.** JEP 509 states that sampled profiles *"may be
   inaccurate"* and that inaccuracies *"are likely to be greater when collecting the samples over a
   relatively short period"*. Use them to prioritise and compare. A 3% difference between two
   profiles is not a finding, and verifying an optimisation from two flame graphs is the wrong
   instrument.

3. **CPU time and wall-clock time are different profiles with different answers.** A method reading
   from a socket spends most of its time idle and almost no CPU, so a CPU profile of a latency
   problem shows nothing. Collect both where you can — their *disagreement* is itself the
   diagnosis.

4. **The evidence has to already exist.** Incidents are recognised after they begin, so a recording
   started in response has missed the cause. A continuous recording plus `JFR.dump maxage=15m` is
   the only thing here that returns the minutes before anyone looked — and its three bounding
   options all default to unlimited.

5. **A settings file decides what you can ever answer.** `default.jfc` is documented as safe to run
   continuously; `profile.jfc` is documented as being for short periods. Most disagreements about
   JFR's overhead are disagreements about which was measured, and most empty analyses are events
   that were never enabled.

6. **The tools have different blind spots, and JDK 25 moved two of them.** JFR cannot see non-Java
   threads, kernel frames or hardware counters. async-profiler cannot correlate across a timeline
   and reaches its data through interfaces the JDK calls *"inherently unsafe"*. Safepoint bias and
   native invisibility were the classic reasons to leave the JDK, and both are weaker on 25.

7. **Everything is on one timeline, and that is the structural advantage.** Whether the spike
   coincided with a GC pause, a class-loading burst or a deoptimisation is a question only a
   recording that holds all of them can answer. No CPU profiler can.

8. **The answer is boring and is not the code you suspected.** Regex backtracking, serialisation,
   logging, string formatting, an expensive `equals` inside a collection lookup. The reliability of
   that is the whole argument for measuring rather than reasoning — and JEP 509's arithmetic is the
   reason it pays: a tenfold speedup of a method taking 0.1% of the time buys 0.09%.

## Where this connects

- **[05 · Thread dumps](../05-thread-dumps/README.md)** owns the other half of the split. Idle CPU
  is a hang and belongs there; busy CPU is here. Its
  [08 · What a dump cannot tell you](../05-thread-dumps/08-what-a-dump-cannot-tell-you.md) is the
  handoff, and every exit in it points at this topic.
- **02 · GC in practice** owns the GC log. A long pause presents as a slowdown and is diagnosed
  there — and CPU consumed by GC threads is an allocation problem, not a profiling one.
- **[04 · `OutOfMemoryError`](../04-out-of-memory-error/README.md)** owns heap dumps. Profiling
  shows what *allocates*, which is a rate; what is *retained* is a different question and a
  different dump.
- **[01 · Memory layout](../01-memory-layout/README.md)** owns NMT and the native footprint, which
  is where async-profiler's native allocation profiling complements
  [11c](../01-memory-layout/11c-the-footprint-that-is-not-in-any-region.md).
- **07 · Logging** and **08 · Metrics** *(neither written yet)* own the signals that tell you to
  start looking. **14 · Benchmarking with JMH** *(not written yet)* owns the question profiling
  cannot answer: whether a change is actually faster.

{/* FOOTER */}
