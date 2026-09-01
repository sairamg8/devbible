---
title: "Level.Invocation is the only place in JMH's documentation that shouts in capital letters, and the reason is that per-invocation setup is not a neutral wrapper — it changes the thing you are measuring, usually by more than the thing you are measuring costs"
sidebar_label: "05b · Fixture levels"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH `Level` enum javadoc**
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/jmh-core/src/main/java/org/openjdk/jmh/annotations/Level.java)),
> which carries the four warnings quoted below verbatim, and the samples
> `JMHSample_06_FixtureLevel` and `JMHSample_38_PerInvokeSetup`. The results table on this
> page is **quoted from the `JMHSample_38_PerInvokeSetup` source comment**, not measured here.
> JMH 1.37, JDK 25. 🔴 **No sandbox.**

**Fixture levels answer "how often does setup run". Two of the three are unremarkable. The
third comes with four numbered warnings and an all-caps preamble, and understanding why is
worth more than most of the rest of this topic.**

## The three levels

The sample states them plainly:

> *"Level.Trial: before or after the entire benchmark run (the sequence of iterations)*
> *Level.Iteration: before or after the benchmark iteration (the sequence of invocations)*
> *Level.Invocation; before or after the benchmark method invocation (WARNING: read the Javadoc before using)"*

and adds the property that makes fixtures useful at all:

> *"Time spent in fixture methods does not count into the performance metrics, so you can use
> this to do some heavy-lifting."*

🔴 **That exemption is what makes `Level.Invocation` so tempting** — "put the expensive
preparation in a fixture and it becomes free" — and it is exactly the promise the four
warnings withdraw.

`JMHSample_06_FixtureLevel` also shows a use for `@TearDown(Level.Iteration)` that has nothing
to do with timing: asserting the benchmark did something. Its `measureWrong()` increments a
*local* variable, the teardown's assertion fires, and *"This will not generate the results for
`measureWrong()`"*. ⚠️ **An assertion in a teardown is a cheap guard against benchmarking
nothing** — and note it needs assertions enabled to run at all.

## The four warnings, verbatim

The javadoc's preamble is unique in the API:

> ***"WARNING: HERE BE DRAGONS! THIS IS A SHARP TOOL. MAKE SURE YOU UNDERSTAND THE REASONING
> AND THE IMPLICATIONS OF THE WARNINGS BELOW BEFORE EVEN CONSIDERING USING THIS LEVEL."***

with a hard applicability bound: *"This level is only usable for benchmarks taking more than a
millisecond per single `Benchmark` method invocation."*

**Warning 1 — timestamping every invocation.**
> *"Since we have to subtract the setup/teardown costs from the benchmark time, on this level,
> we have to timestamp *each* benchmark invocation. If the benchmarked method is small, then we
> saturate the system with timestamp requests, which introduce artificial latency, throughput,
> and scalability bottlenecks."*

**Warning 2 — coordinated omission.**
> *"Since we measure individual invocation timings with this level, we probably set ourselves
> up for (coordinated) omission. That means the hiccups in measurement can be hidden from
> timing measurement, and can introduce surprising results. For example, when we use timings to
> understand the benchmark throughput, the omitted timing measurement will result in lower
> aggregate time, and fictionally *larger* throughput."*

🔴 **Read that consequence twice: the artefact makes things look *better*.** A benchmark
suffering coordinated omission reports higher throughput than reality, which is the direction
nobody questions.

**Warning 3 — synchronisation on the critical path.**
> *"In order to maintain the same sharing behavior as other Levels, we sometimes have to
> synchronize (arbitrage) the access to `State` objects. Other levels do this outside the
> measurement, but at this level, we have to synchronize on *critical path*, further offsetting
> the measurement."*

**Warning 4 — overlap with the benchmark itself.**
> *"Current implementation allows the helper method execution at this Level to overlap with the
> benchmark invocation itself in order to simplify arbitrage. That matters in multi-threaded
> benchmarks, when one worker thread executing `Benchmark` method may observe other worker
> thread already calling `TearDown` for the same object."*

⚠️ **Warning 4 is a correctness warning, not a measurement one.** A teardown may run against
state another thread is still using.

## The canonical case, and the right answer

`JMHSample_38_PerInvokeSetup` sorts an array. The naive benchmark sorts it once and then
"sorts" an already-sorted array forever:

> *"The method above is subtly wrong: it sorts the random array on the first invocation only.
> Every subsequent call will "sort" the already sorted array. With bubble sort, that operation
> would be significantly faster!"*

The `Level.Invocation` fix works and is described as *"neutral"*, with the caveat repeated in
capitals: *"this is susceptible to the problems described in Level.Invocation Javadocs, READ
AND UNDERSTAND THOSE DOCS BEFORE USING THIS APPROACH."*

The recommended answer is the third one:

> *"In an overwhelming majority of cases, the only sensible thing to do is to suck up the
> per-invocation setup costs into a benchmark itself. This work well in practice, especially
> when the payload costs dominate the setup costs."*

```java
@Benchmark
public byte[] measureRight(Data d) {
    byte[] c = Arrays.copyOf(d.arr, d.arr.length);   // setup, inside the measurement
    bubbleSort(c);
    return c;
}
```

🔴 **You pay the copy in every measurement and accept it as part of the operation.** That is
honest and stable; a fixture that pretends the copy is free is neither.

## The numbers the sample itself publishes

Quoted from the sample's source comment — **these are JMH's numbers, not a run performed
here**:

```
Benchmark                                   (count)  Mode  Cnt      Score     Error  Units
JMHSample_38_PerInvokeSetup.measureWrong          1  avgt   25      2.408 ±   0.011  ns/op
JMHSample_38_PerInvokeSetup.measureWrong         16  avgt   25      8.286 ±   0.023  ns/op
JMHSample_38_PerInvokeSetup.measureWrong        256  avgt   25     73.405 ±   0.018  ns/op

JMHSample_38_PerInvokeSetup.measureNeutral        1  avgt   25     15.835 ±   0.470  ns/op
JMHSample_38_PerInvokeSetup.measureNeutral       16  avgt   25    112.552 ±   0.787  ns/op
JMHSample_38_PerInvokeSetup.measureNeutral      256  avgt   25  58343.848 ± 991.202  ns/op

JMHSample_38_PerInvokeSetup.measureRight          1  avgt   25      6.075 ±   0.018  ns/op
JMHSample_38_PerInvokeSetup.measureRight         16  avgt   25    102.390 ±   0.676  ns/op
JMHSample_38_PerInvokeSetup.measureRight        256  avgt   25  58812.411 ± 997.951  ns/op
```

with the sample's own reading:

> *"We can clearly see that "measureWrong" provides a very weird result: it "sorts" way too
> fast. "measureNeutral" is neither good or bad: while it prepares the data for each invocation
> correctly, the timing overheads are clearly visible. These overheads can be overwhelming,
> depending on the thread count and/or OS flavor."*

🔴 **Look at the 256-element rows: the broken benchmark reports 73 ns and the honest one
58,812 ns — roughly 800× apart.** That is the scale of error available from a fixture mistake
nobody would notice in review. And look at the 1-element rows to see the other half of the
story: `measureNeutral` costs 15.8 ns where `measureRight` costs 6.1 ns, which is the
per-invocation timestamping overhead showing up as pure tax.

## Gotchas

🔴 **`Level.Invocation` on a sub-millisecond benchmark is documented as out of scope.** The
javadoc's *"only usable for benchmarks taking more than a millisecond"* is a precondition, and
the sample's 1-element row shows what ignoring it costs.

🔴 **Fixture time is exempt from the score, which is exactly why misplacing work in a fixture
is so distorting.** Anything that is genuinely part of the operation must be inside the
benchmark method, not in a fixture, no matter how convenient.

⚠️ **Coordinated omission flatters throughput.** Because omitted hiccups reduce measured
aggregate time, the reported throughput is *higher* than the truth — an error in the direction
you are least likely to challenge.

⚠️ **A `@TearDown(Level.Invocation)` may overlap another thread's benchmark invocation.** In
multi-threaded benchmarks this is a documented implementation behaviour, so teardown code must
tolerate concurrent use of the state.

⚠️ **Assertions in fixtures only run with `-ea`.** The fixture-level sample relies on `assert`
to catch a benchmark that changes nothing; without assertions enabled it silently passes.

⚠️ **`Level.Iteration` setup that resets a data structure changes the steady state.** It is the
right tool for the no-steady-state case ([Modes](04b-modes.md)), but it means each iteration
starts cold — expect higher variance between iterations, not less.

⚠️ **Heavy `Level.Trial` setup is free in the score and not free in reality.** A five-minute
setup multiplied by every fork and every `@Param` value is a suite that runs overnight.

⚠️ **"Suck the setup into the benchmark" is only sound while the payload dominates.** If the
copy costs more than the sort, you are benchmarking `Arrays.copyOf`. Vary the size — the
sample's `@Param({"1", "16", "256"})` sweep exists for exactly this reason.

## Interview questions

**★ What are JMH's three fixture levels?**
`Trial` (once around the whole benchmark run), `Iteration` (around each iteration), and
`Invocation` (around each benchmark method call). `Trial` is the default for `@Setup` and
`@TearDown`.

**★ Why does time spent in fixtures not count towards the score, and why is that dangerous?**
So you can do heavy preparation without polluting the measurement. It is dangerous because
anything you move into a fixture becomes free in the reported number — including work that is
genuinely part of the operation.

**★ Give two of the four documented problems with `Level.Invocation`.**
Per-invocation timestamping, which saturates the system with timer requests on small
benchmarks; and coordinated omission, where hidden hiccups lower aggregate time and
fictionally raise throughput. The other two are synchronisation moving onto the critical path,
and teardown overlapping a concurrent invocation.

**★ What is the documented lower bound for using `Level.Invocation`?**
Benchmarks taking more than a millisecond per invocation, and the javadoc advises validating
the impact for your own case on an ad-hoc basis.

**★ A benchmark bubble-sorts an array held in `@State`. What is wrong and what are the three
options?**
It sorts only on the first invocation; afterwards it re-sorts sorted data. The options are:
`Level.Invocation` setup that copies the array (correct but subject to the invocation-level
warnings), or copying inside the benchmark method and accepting the cost — which the sample
calls the sensible choice in an overwhelming majority of cases.

**★ Why does coordinated omission produce optimistic results?**
Because the measurement misses the pauses. Time that was not recorded does not appear in the
aggregate, so the computed throughput is higher and the latency lower than what actually
happened.

**★ How can a teardown catch a benchmark that measures nothing?**
By asserting that the state actually changed — the fixture-level sample uses
`@TearDown(Level.Iteration)` with `assert x > 1` and the wrong benchmark, which increments a
local, fires it and produces no results. It requires `-ea`.

**★ You must include per-invocation preparation and the payload is small. What now?**
Change the unit of measurement rather than the fixture level: batch the work with
`SingleShotTime` and `batchSize`, or benchmark a larger operation that contains the
preparation naturally. Per-invocation fixtures on small payloads measure the harness.

Next: [Blackholes](06-blackholes.md).

{/* FOOTER */}
