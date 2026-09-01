---
title: "Benchmarking with JMH: the harness exists because the JVM is an adaptive optimising system that will happily delete the code you are timing, and every feature in it is a defence against one specific way your measurement was already wrong"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **OpenJDK JMH repository** on `master` — the `README.md`,
> the annotation sources (`Benchmark`, `Warmup`, `Measurement`, `Fork`, `Mode`, `State`,
> `Scope`, `Level`, `Setup`), `Blackhole`, `CompilerHints`, `Result`, `Statistics` and
> `CommandLineOptions` — and the **JMH samples** 01, 02, 03–06, 08–13, 26, 34, 35, 38
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh)). JVM behaviour is verified
> against the **HotSpot compilation policy** header at tag `jdk-25+36` and the **JDK 25
> `java` man page**. Latest released JMH on Maven Central: **1.37**.
> 🔴 **No sandbox** — no benchmark in this topic was built or run. Every number and every
> output block is quoted from JMH's own sources and attributed where it appears.

**The reason to learn JMH is not that benchmarking is hard to do accurately. It is that
benchmarking is easy to do *confidently* and wrong: a hand-written timing loop produces a
number with three decimal places that is systematically optimistic, and nothing in the output
suggests a problem. This topic is a tour of the mechanisms that make that happen, and of the
harness built to neutralise each of them.**

Topic 06 owns finding *where* time goes in a running service. This topic owns deciding *which*
of two implementations is cheaper. It is not a load-testing topic, and
[09](09-what-a-microbenchmark-cannot-tell-you.md) is the page that says so at length.

**19 chunks.** Read in order; each links to the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[The benchmark that measured nothing](01-the-benchmark-that-measured-nothing.md)** | <span className="db-tier t-know">Know</span> | `nanoTime` around a loop, and the four other things it actually measured |
| 2 | **[Why the JVM defeats naive timing](02-why-the-jvm-defeats-naive-timing.md)** | <span className="db-tier t-know">Know</span> | Five execution levels, load-dependent thresholds, OSR and speculation |
| 3 | **[Dead-code elimination](02b-dead-code-elimination.md)** | <span className="db-tier t-know">Know</span> | The compiler deleted your benchmark because nothing read the result |
| 4 | **[Constant folding and hoisting](02c-constant-folding-and-loop-hoisting.md)** | <span className="db-tier t-know">Know</span> | A literal input turns your method into a literal — and `final` makes it worse |
| 5 | **[What JMH is](03-what-jmh-is.md)** | <span className="db-tier t-know">Know</span> | A code generator, not a library: adding the jar does nothing |
| 6 | **[Project setup](03b-project-setup.md)** | <span className="db-tier t-know">Know</span> | The archetype is the supported configuration, and `-jar` is the supported run |
| 7 | **[The annotations](04-the-annotations.md)** | <span className="db-tier t-know">Know</span> | Method, class, command line — three layers of defaults, and the last one wins |
| 8 | **[Modes](04b-modes.md)** | <span className="db-tier t-know">Know</span> | Time-based versus work-based, and the workload with no steady state |
| 9 | **[State](05-state.md)** | <span className="db-tier t-know">Know</span> | `Scope` is a concurrency declaration, not a convenience |
| 10 | **[Fixture levels](05b-fixture-levels.md)** | <span className="db-tier t-know">Know</span> | The four documented warnings on `Level.Invocation`, and the 800× error |
| 11 | **[Blackholes](06-blackholes.md)** | <span className="db-tier t-know">Know</span> | 545 lines of padding and volatile reads, and why yours would be worse |
| 12 | **[Compiler blackholes](06b-compiler-blackholes.md)** | <span className="db-tier t-know">Know</span> | JMH probes your JVM and silently switches mode — including on your machine |
| 13 | **[Forks and warmup](07-forks-and-warmup.md)** | <span className="db-tier t-know">Know</span> | Profile pollution and run-to-run variance: two problems, two defences |
| 14 | **[Reading the error bars](07b-reading-the-error-bars.md)** | <span className="db-tier t-know">Know</span> | `±(99.9%)`, "assumes normal distribution", and the overlap rule |
| 15 | **[Profilers in JMH](08-profilers-in-jmh.md)** | <span className="db-tier t-know">Know</span> | `-prof gc`, `stack`, `cl`, `comp` — allocation per op is the honest metric |
| 16 | **[The perf family](08b-the-perf-family.md)** | <span className="db-tier t-know">Know</span> | Hardware counters, counters per operation, and the hottest assembly |
| 17 | **[What it cannot tell you](09-what-a-microbenchmark-cannot-tell-you.md)** | <span className="db-tier t-know">Know</span> | Critical path, input distribution, memory, hours, threads, hardware |
| 18 | **[Benchmarks in CI](10-benchmarks-in-ci.md)** | <span className="db-tier t-know">Know</span> | The flags, the noise floor, and a gate that does not flake |
| 19 | **[The checklist](11-the-checklist.md)** | <span className="db-tier t-know">Know</span> | Writing it, running it, and deciding whether to believe it |

## The five things this topic is really about

**1 · The error in a naive benchmark is systematic, not random.** Dead-code elimination,
constant folding and loop hoisting all *remove* work, so the measured time is biased low —
which is why hand-rolled benchmarks so reliably "prove" large speed-ups. There is no matching
mechanism that inflates the number.

**2 · The JVM has no single version of your method.** HotSpot's compilation policy defines five
execution levels, chooses between them using thresholds scaled by compiler load, and enters
long-running loops mid-flight via OSR. A benchmark that does not control *when* measurement
starts has not said which of those versions it timed.

**3 · The harness's value is that its defences are structural.** JMH generates the loop, the
sink, the forks and the statistics. You cannot forget to consume a result you never had to
consume. This is also the reason adding `jmh-core` to a JUnit test achieves nothing: without
the annotation processor there is no generated harness at all.

**4 · A score without an error bar is not a result.** JMH prints `±(99.9%)` and says it assumes
a normal distribution. Overlapping intervals mean no demonstrated difference, and precision
from a single fork is precision about one JVM launch — the quantity you should trust least.

**5 · The harness cannot make the experiment relevant.** JMH's own README asks for peer review
and promises only *"to make avoiding [pitfalls] easier, not avoiding them completely"*. Whether
the code is on the critical path, whether the input distribution is realistic, and whether the
difference matters are questions no harness answers.

## The phase gate this topic serves

For *"p99 latency doubled after the deploy"*, this topic supplies the last step: once a
profile has identified a candidate and a change has been written, JMH is how you establish
that the new implementation is actually cheaper — with enough forks to have an error bar, with
`gc.alloc.rate.norm` recorded, and with the honesty to say "no measurable difference" when the
intervals overlap.

{/* FOOTER */}
