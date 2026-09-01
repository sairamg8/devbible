---
title: "Throughput and AverageTime are the same measurement with different arithmetic, SampleTime is a different measurement entirely, and SingleShotTime is the only one that is honest about a workload with no steady state"
sidebar_label: "04b · Modes"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH `Mode` enum javadoc**
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/jmh-core/src/main/java/org/openjdk/jmh/annotations/Mode.java))
> and the samples `JMHSample_02_BenchmarkModes` and `JMHSample_26_BatchSize`.
> JMH 1.37, JDK 25. 🔴 **No sandbox** — no benchmark was run; every characterisation below
> is quoted from the enum's own documentation or the samples' commentary.

**Picking a mode is picking a question. Most benchmark disputes are two people answering
different questions correctly and comparing the answers.**

## The four real modes

| Mode | Short label | Time- or work-based | The question it answers |
|---|---|---|---|
| `Throughput` | `thrpt` | time-based | How many operations per unit of time? |
| `AverageTime` | `avgt` | time-based | What does one operation cost on average? |
| `SampleTime` | `sample` | time-based | What does the *distribution* of operation times look like? |
| `SingleShotTime` | `ss` | **work-based** | What did one invocation cost, cold? |

(`Mode.All` also exists; its javadoc calls it a meta-mode *"mostly useful for internal JMH
testing"*.)

### `Throughput` — *"operations per unit of time"*

> *"Runs by continuously calling `Benchmark` methods, counting the total throughput over all
> worker threads. This mode is time-based, and it will run until the iteration time expires."*

🔴 **"over all worker threads" is the point.** Throughput aggregates, so it is the mode that
answers a capacity question. It is also the mode where adding threads can make the number go
up while every individual operation gets slower.

### `AverageTime` — *"average time per operation"*

> *"This is the inverse of `Throughput`, but with different aggregation policy. This mode is
> time-based, and it will run until the iteration time expires."*

⚠️ **"Inverse … but with different aggregation policy" is a real caveat, not a formality.**
The reciprocal of an average is not the average of reciprocals. Throughput and AverageTime on
the same code will not be exact reciprocals of one another, and neither is wrong.

### `SampleTime` — the distribution

> *"Runs by continuously calling `Benchmark` methods, and randomly samples the time needed for
> the call. This mode automatically adjusts the sampling frequency, but may omit some pauses
> which missed the sampling measurement."*

🔴 **This is the only mode that gives you percentiles, and it is the honest one for anything
with pauses** — GC, lock contention, allocation spikes. ⚠️ And it carries its own warning:
*"may omit some pauses which missed the sampling measurement"*, so an extreme tail can be
under-reported. Sampling is not a complete census of your latencies.

The samples add that JMH *"tries to auto-adjust sampling frequency: if the method is long
enough, you will end up capturing all the samples."*

### `SingleShotTime` — one invocation, cold

> *"Runs by calling `Benchmark` once and measuring its time. This mode is useful to estimate
> the "cold" performance when you don't want to hide the warmup invocations, or if you want to
> see the progress from call to call, or you want to record every single sample. This mode is
> work-based, and will run only for a single invocation of `Benchmark` method."*

The caveats are in the javadoc too:

> *"More warmup/measurement iterations are generally required."* ·
> *"Timers overhead might be significant if benchmarks are small; switch to `SampleTime` mode
> if that is a problem."*

🔴 **"Work-based" versus "time-based" is the distinction that matters.** Every other mode runs
until the clock says stop. `SingleShotTime` runs until the work is done. That is what makes it
the right mode for [class loading, first-call and startup costs](../10-packaging-for-deploy/01-the-fat-jar.md)
— the very things every other mode is designed to warm away.

## The workload with no steady state

`JMHSample_26_BatchSize` is the case people most often benchmark wrongly, because a
time-based mode gives an answer that depends on how long you ran:

> *"Sometimes you need to evaluate operation which doesn't have the steady state. The cost of a
> benchmarked operation may significantly vary from invocation to invocation. In this case,
> using the timed measurements is not a good idea, and the only acceptable benchmark mode is a
> single shot. On the other hand, the operation may be too small for reliable single shot
> measurement."*

The example is insertion into the middle of a `LinkedList`, where each insertion is more
expensive than the last:

```java
List<String> list = new LinkedList<>();

@Benchmark
@Warmup(iterations = 5, batchSize = 5000)
@Measurement(iterations = 5, batchSize = 5000)
@BenchmarkMode(Mode.SingleShotTime)
public List<String> measureRight() {
    list.add(list.size() / 2, "something");
    return list;
}

@Setup(Level.Iteration)
public void setup() {
    list.clear();
}
```

and the resolution:

> *"We can use "batch size" parameter to describe the number of `@Benchmark` invocations to do
> per one "shot" without looping the method manually and protect from problems described in
> `JMHSample_11_Loops`."*

> *"You can see completely different results for `measureWrong_1` and `measureWrong_5`; this is
> because the workload has no steady state. The result of the workload is dependent on the
> measurement time."*

🔴 **The tell for a missing steady state: change the iteration time and the score changes.**
Two time-based runs at 1s and 5s that disagree are not noisy — they are measuring a workload
whose cost grows, and the answer is `SingleShotTime` with a `batchSize`, plus a
`@Setup(Level.Iteration)` that restores the starting condition.

⚠️ **`batchSize` is not the hand-written loop in disguise.** The harness performs the N
invocations itself, so the loop is still JMH's and the protections still apply. The sample is
explicit that this is what saves you from the loops sample's problems. Also:
*"If there are any `@Setup`/`@TearDown(Level.Invocation)`, they still run per each `@Benchmark`
invocation."* — see [State](05-state.md).

## Choosing, in one paragraph

Ask what decision the number will drive. Capacity planning or "how much can this box do" →
`Throughput`. "Which of these two implementations is cheaper per call" → `AverageTime`.
"Does this occasionally take 200 ms" → `SampleTime`, and read the percentiles, not the mean.
"How long does the first call cost" or "this gets slower as it goes" → `SingleShotTime`, with
`batchSize` if the unit is too small to time.

## Gotchas

🔴 **A mean is the wrong statistic for anything with pauses.** `AverageTime` will happily
average a GC pause into ten thousand fast calls and report a number that describes neither.
If tail behaviour matters, the mode must be `SampleTime`.

🔴 **`SampleTime` may omit pauses** by its own documentation. Do not present its p99.9 as a
guarantee; present it as a sampled estimate.

⚠️ **Comparing a `Throughput` score with an `AverageTime` score by taking a reciprocal is not
sound.** The aggregation policies differ; the two are answers to different questions that
happen to use the same units when inverted.

⚠️ **`SingleShotTime` with a tiny method measures the timer.** The javadoc says timer overhead
*"might be significant if benchmarks are small"* and directs you to `SampleTime` — or use
`batchSize` so one shot is a meaningful amount of work.

⚠️ **`SingleShotTime` needs *more* iterations, not fewer.** One shot per iteration means the
variance across iterations is all the data you have.

⚠️ **A batch measured as one operation reports per-batch time unless you say otherwise.**
Know whether you are quoting time per batch or per element, and label it — this is the same
trap `@OperationsPerInvocation` sits in.

⚠️ **Multi-threaded `Throughput` hides per-operation regression.** Doubling threads can raise
aggregate throughput while every individual call gets slower; if latency is the SLO, measure
`SampleTime` too.

⚠️ **Do not chase a "steady state" that does not exist by warming up longer.** If the cost
grows with the number of prior invocations, more warm-up simply moves you further along the
curve, and the measurement will keep drifting.

## Interview questions

**★ Name JMH's four benchmark modes and what each measures.**
`Throughput` (operations per unit time, aggregated over worker threads), `AverageTime`
(average cost per operation), `SampleTime` (samples individual call times so you can see a
distribution), and `SingleShotTime` (one invocation, work-based, for cold performance).

**★ Which modes are time-based and which is work-based, and why does it matter?**
The first three are time-based — they run until the iteration time expires. `SingleShotTime`
is work-based: it runs one invocation. That is what makes it the right mode for cold-start and
for workloads whose cost depends on how many operations have already happened.

**★ Are `Throughput` and `AverageTime` reciprocals?**
Conceptually inverse, but the javadoc notes a *different aggregation policy*, so the numbers
will not be exact reciprocals. Report whichever answers your question rather than converting.

**★ When must you use `SampleTime`?**
When the distribution matters — pauses, tails, SLOs. It is the only mode that samples
individual invocation times. Its documented limitation is that it *"may omit some pauses which
missed the sampling measurement"*, so treat extreme percentiles as estimates.

**★ You get very different scores at 1-second and 5-second iterations. What does that tell
you?**
That the workload has no steady state — its cost depends on how many operations have already
run, so a time-based mode's answer depends on the measurement time. The batch-size sample
demonstrates this with insertion into the middle of a `LinkedList`.

**★ What is `batchSize` and how does it differ from writing a loop in the benchmark?**
It tells JMH to perform N invocations per shot, so the repetition happens inside the harness
rather than in code the optimiser can unroll and hoist. The sample says it exists precisely to
protect you from the problems in the loops sample.

**★ Why does `SingleShotTime` need more iterations than the other modes?**
Because each iteration yields exactly one sample. All of your variance information comes from
across iterations and forks, so a handful of shots gives you no confidence interval worth
quoting.

**★ Your throughput improves when you add threads, but users report worse latency. Is the
benchmark wrong?**
No — it answered a capacity question. `Throughput` counts total operations across worker
threads, so aggregate throughput can rise while per-operation time degrades. Measure
`SampleTime` as well when latency is the property you care about.

Next: [State](05-state.md).

{/* FOOTER */}
