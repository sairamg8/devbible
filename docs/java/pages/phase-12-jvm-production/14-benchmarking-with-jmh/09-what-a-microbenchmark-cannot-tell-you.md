---
title: "A microbenchmark answers 'which of these two is cheaper in isolation, on a warm JVM, with this input, on this machine' — and every clause in that sentence is a thing production will not honour"
sidebar_label: "09 · What it cannot tell you"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH `README.md`** on `master`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/README.md)) — the
> peer-review and "we only promise to make avoiding them easier" statement — and the samples'
> commentary on profile pollution (`JMHSample_12_Forking`), run-to-run variance
> (`JMHSample_13_RunToRun`) and non-steady-state workloads (`JMHSample_26_BatchSize`,
> `JMHSample_38_PerInvokeSetup`). JMH 1.37, JDK 25. 🔴 **No sandbox.**

**Everything so far has been about making a benchmark *valid*. This page is about what a
valid benchmark still does not say. The failure it guards against is not a broken measurement
— it is a correct measurement used to justify a decision it does not support.**

The harness authors say it themselves:

> *"Do not assume that a nice harness will magically free you from considering benchmarking
> pitfalls. We only promise to make avoiding them easier, not avoiding them completely."*

## 1 · It cannot tell you the code matters

A benchmark measures the thing you pointed it at. It has no opinion about whether that thing
is on the critical path. 🔴 **A 40% improvement in a method that accounts for 0.5% of request
time is a 0.2% improvement**, and no amount of harness rigour converts one number into the
other.

The ordering that avoids this: profile the running service first (topic 06), find where the
time goes, *then* microbenchmark the candidate. Reversing those two steps is the most
expensive mistake in this topic, because it is invisible — the work is real, the measurement
is sound, and the outcome is nothing.

## 2 · It cannot reproduce your input distribution

Benchmarks use one input, or a `@Param` sweep over a handful. Production has a distribution,
usually with a long tail and often adversarial. Three specific consequences:

- **Branch prediction.** A benchmark that always takes the same branch trains the predictor
  perfectly. Mixed inputs do not.
- **Call-site shape.** One implementation class keeps a call site monomorphic and lets C2
  speculate; four implementations do not. This is
  [profile pollution](07-forks-and-warmup.md) turned inside out — the benchmark's isolation is
  the unrealistic part.
- **Size effects.** Cheap-per-element algorithms with poor asymptotics win at benchmark sizes
  and lose at production sizes, and vice versa.

⚠️ **`@Param` is the cheapest defence available**: sweep sizes and shapes and check that the
ranking is stable across them. A ranking that flips at 10,000 elements is the finding.

## 3 · It cannot reproduce your memory behaviour

A benchmark's working set is small, hot and cache-resident; production's is large, cold and
shared with everything else on the machine. A benchmark also runs its data structures at a
fixed occupancy while production grows and fragments them.

🔴 **Allocation is the exception that partly survives.** `gc.alloc.rate.norm`
([08](08-profilers-in-jmh.md)) is a property of the code and does transfer: allocating 2 KB per
operation in a benchmark means allocating 2 KB per operation in production. What does *not*
transfer is the cost of that allocation, which depends on the collector, the heap size and
what else is live.

## 4 · It cannot show you steady-state behaviour over hours

GC behaviour, memory fragmentation, cache eviction, connection pool churn, and slow leaks all
operate on timescales a benchmark never reaches. A ten-second measurement window cannot see a
promotion pattern that only matters after an hour of uptime.

⚠️ **And it cannot see the interactions**: in production your code shares CPU caches, memory
bandwidth and a GC with everything else in the process. A change that reduces CPU while
doubling allocation may be a net loss that no microbenchmark of it will show.

## 5 · It cannot tell you about concurrency at your scale

A benchmark at one or four threads says little about sixty-four. Contention, false sharing and
lock convoying are strongly non-linear, and `@State(Scope.Benchmark)` on a scratch field can
manufacture contention that does not exist in production ([05](05-state.md)) just as easily as
`Scope.Thread` can hide contention that does.

⚠️ **Coordinated omission** ([05b](05b-fixture-levels.md)) is a specifically concurrent trap:
a benchmark that measures only the requests it managed to issue reports optimistic throughput
and latency.

## 6 · It cannot survive its own environment

The score belongs to a machine: its CPU model, core count, frequency governor, NUMA layout,
container CPU quota, and what else was running. This is why
[Benchmarks in CI](10-benchmarks-in-ci.md) is hard, and why cross-machine comparisons need to
be framed as different experiments rather than different results.

## What to do instead — the pairing

A microbenchmark is one instrument, and it is at its best when paired:

| Question | Instrument |
|---|---|
| Where does the time go in a real request? | Profiler on the running service (topic 06) |
| Which of two implementations is cheaper? | JMH |
| Did the change help the service? | Load test against a realistic workload, plus production metrics (topic 08) |
| Did the change increase garbage? | `-prof gc`, then GC logs in staging (topic 02) |
| Is the improvement worth the complexity? | Not a measurement question |

🔴 **The chain that actually works: profile → microbenchmark the candidate → load test the
change → verify in production metrics.** A JMH number alone justifies writing the change, not
shipping it.

## Gotchas

🔴 **"Twice as fast in JMH" is not "twice as fast in production", and it is usually not even
"faster in production".** Amdahl's law applies to the fraction of time the code occupies.

🔴 **Benchmarks reward the thing you can measure.** Teams that microbenchmark heavily tend to
optimise leaf methods and ignore architecture, because leaf methods are what a harness can
hold.

⚠️ **A benchmark that is faster and allocates more is a coin flip in production.** Under a
concurrent collector, allocation moves cost into GC threads and shows up as a throughput
change elsewhere.

⚠️ **Do not extrapolate a single-threaded score to a thread pool.** Scaling behaviour is a
separate measurement, and the failure modes are non-linear.

⚠️ **A benchmark on your laptop with a hot cache and no other load is the best case for every
variant, and it is not uniformly the best case** — variants that depend on memory bandwidth or
speculation benefit disproportionately.

⚠️ **Removing a benchmark's realism to remove its noise usually removes the finding.** Fixed
seeds, single sizes and monomorphic call sites give beautifully repeatable numbers about a
world that does not exist.

⚠️ **The absence of a regression in a microbenchmark is not evidence of no regression.** It is
evidence about the thing benchmarked, in isolation, and nothing else.

## Interview questions

**★ Your JMH benchmark shows a 40% improvement. What do you check before claiming a 40%
improvement?**
What fraction of production time that code accounts for. Amdahl's law bounds the end-to-end
effect: 40% off 0.5% of the request is 0.2%. The profile of the running service, not the
benchmark, answers this.

**★ Which benchmark result generalises best to production, and why?**
Allocation per operation (`gc.alloc.rate.norm`). It is a property of the code rather than of
the machine or the run. The *cost* of that allocation still depends on the collector and heap,
but the quantity transfers.

**★ Why can a benchmark's isolation make it unrepresentative?**
Because isolation keeps call sites monomorphic, branches perfectly predicted and the working
set cache-resident. C2 speculates on all three, so the benchmark measures a specialisation
production never receives.

**★ Name three things a ten-second measurement window cannot observe.**
Long-horizon GC and promotion behaviour, memory fragmentation and slow leaks, and cache or
pool churn under sustained real traffic. Also anything with a duty cycle longer than the run.

**★ Why is a single-threaded benchmark a poor guide to behaviour at 64 threads?**
Contention, false sharing and lock convoying are strongly non-linear. A `@State` scope choice
can also manufacture or hide contention, so the benchmark's threading model is part of the
result.

**★ What is the correct sequence of tools around a performance change?**
Profile the running service to find where time goes; microbenchmark the candidate change; load
test the change against a realistic workload; confirm with production metrics. JMH sits in the
middle and justifies attempting the change, not shipping it.

**★ Why does removing noise from a benchmark sometimes remove the result?**
Because much of the noise is realism — variable input, mixed types, cold caches. A benchmark
tuned for repeatability can become a measurement of an idealised world in which the difference
you care about does not appear.

**★ Is "no regression in the benchmark suite" sufficient to ship a change?**
No. It says the benchmarked operations did not regress in isolation. Everything unbenchmarked,
every interaction and every long-horizon effect is outside its scope — which is why the suite
is a gate, not a proof.

Next: [Benchmarks in CI](10-benchmarks-in-ci.md).

{/* FOOTER */}
