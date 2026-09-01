---
title: "JMH prints ±(99.9%) and assumes a normal distribution, which means the error bar is a statement about the mean and not about your operation — and two scores whose intervals overlap are not two different numbers"
sidebar_label: "07b · Reading the error bars"
sidebar_position: 14
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-01 against the **JMH `Result` source** on `master`
> ([github.com/openjdk/jmh](https://github.com/openjdk/jmh/blob/master/jmh-core/src/main/java/org/openjdk/jmh/results/Result.java)) —
> which formats scores as `%s ±(99.9%%) %s %s`, computes `getConfidenceIntervalAt(0.999)`,
> prints `CI (99.9%): [.., ..] (assumes normal distribution)` and the percentile ladder — and
> the `Statistics` interface, which exposes `getConfidenceIntervalAt`, `getMeanErrorAt`,
> `isDifferent` and `compareTo` at a caller-supplied confidence level. JMH 1.37, JDK 25.
> 🔴 **No sandbox** — no results were produced here; the format strings are quoted from source.

**Every JMH score comes with an error, and the error is the part most readers skip. It is also
the only part that tells you whether the comparison you are about to make is legitimate.**

## What the printed line actually says

The result's `toString` is, verbatim from the source:

```java
String.format("%s ±(99.9%%) %s %s", score, error, unit)
```

so a line reading `123.456 ±(99.9%) 4.567 ns/op` means: **the mean is 123.456, and the 99.9%
confidence interval for the mean is 123.456 ± 4.567.** The extended output makes the
assumption explicit:

```
  (min, avg, max) = (…, …, …), stdev = …
  CI (99.9%): [.., ..] (assumes normal distribution)
```

🔴 **"Assumes normal distribution" is printed by JMH itself.** Latency distributions are
routinely not normal — they are right-skewed with a long tail — so the interval is a
reasonable summary of *the mean* and a poor summary of *what a call costs*.

⚠️ **99.9%, not 95%.** JMH picks a deliberately conservative level (`0.999` in the source), so
the intervals look wide compared to what people expect from other tools. Wide is honest here.

⚠️ **The error is only computed when there is enough data.** The extended info requires
`stats.getN() > 2`; with fewer samples JMH prints the bare mean. A result with no `±` is not a
precise result — it is one with no confidence information at all.

## Comparing two scores

The rule that follows from the above, and the one people break constantly:

🔴 **If the intervals overlap, you have not demonstrated a difference.** Report "no measurable
difference at this sample size", and if you need an answer, buy more data: more forks first
([07](07-forks-and-warmup.md)), then more iterations.

The `Statistics` interface exposes exactly this question — `isDifferent(other, confidence)`
returns *"whether the mean of this statistics is different from the other, with the given
confidence level"*, and `compareTo(other, confidence)` orders two results at a confidence
level. ⚠️ **These take the confidence level as a parameter**, which is a reminder that "is it
different" has no answer until you name one.

Two further cautions when comparing:

- **Non-overlap is necessary, not sufficient.** Two runs on different days on a shared CI
  machine can differ for reasons that have nothing to do with the code.
- **Statistical significance is not practical significance.** A 0.3% regression can be
  statistically solid and completely irrelevant; decide the threshold that matters *before*
  you look.

## The distribution output, and when you need it

For `SampleTime` ([04b](04b-modes.md)) JMH prints a histogram and a percentile ladder over
`0.00, 0.50, 0.90, 0.95, 0.99, 0.999, 0.9999, 0.99999, 0.999999, 1.0`.

🔴 **`p(100.0000)` is the maximum observed, not "the worst case".** It is a single
observation, it is the least reproducible number in the output, and it is the one that ends up
in slides.

⚠️ **Percentiles far into the tail need enormous sample counts to mean anything.** A p99.999
estimated from a few hundred thousand samples rests on a handful of observations. And recall
`SampleTime`'s own documented limitation: it *"may omit some pauses which missed the sampling
measurement"*.

⚠️ **Mean, min, max and stdev summarise a multi-modal distribution badly.** If a benchmark has
two regimes — inline cache hit and miss, buffer resize and no resize — the histogram shows two
humps and every scalar summary sits in the empty space between them.

## A checklist for reading a results table

1. Is there an error term at all? (No `±` means too few samples.)
2. Are the intervals disjoint for the comparison you are making?
3. How many forks produced this? A tight interval from one fork is precision without accuracy.
4. Did the per-iteration output slope? Sloping means warm-up was too short and the mean is
   contaminated.
5. Is the mean the right statistic for the question, or do you need percentiles?
6. Is the difference big enough to act on, independent of significance?

## Gotchas

🔴 **Quoting a score without its error is the most common benchmark reporting error.** The
number alone is unfalsifiable; the pair is a claim.

🔴 **"It's 3% faster" from single-fork runs is usually noise.** Run-to-run variance between JVM
launches routinely exceeds a few percent, and one fork cannot see it at all.

⚠️ **The error term shrinks with more iterations even when the benchmark is wrong.** Precision
and correctness are independent: a dead-code-eliminated benchmark produces beautifully tight
intervals around a meaningless number.

⚠️ **Comparing scores taken with different JMH options is not a comparison.** Mode, threads,
fork count, iteration time, JVM args and even blackhole mode
([06b](06b-compiler-blackholes.md)) all belong with the number.

⚠️ **`ScoreFormatter` may mark a score approximate**, in which case JMH suppresses the ± form
entirely. An "approximate" score is a hint about the measurement, not a formatting quirk.

⚠️ **Confidence intervals assume independent samples.** Iterations within one fork share a JIT
state, a heap layout and a CPU frequency history, so they are not fully independent — another
reason the fork count matters more than the iteration count.

⚠️ **Do not average across forks by hand.** JMH aggregates with a defined policy; recomputing
a mean from printed per-fork numbers discards the sample counts behind them.

## Interview questions

**★ What does `±(99.9%)` in a JMH result mean?**
That the printed interval is a 99.9% confidence interval for the *mean* score, computed by
`getConfidenceIntervalAt(0.999)`. JMH also prints that it assumes a normal distribution.

**★ Two implementations score 100 ± 8 and 104 ± 7 ns/op. What do you conclude?**
Nothing about which is faster — the intervals overlap, so the difference is not demonstrated
at this sample size. Gather more data (more forks first), or report no measurable difference.

**★ Why is the confidence interval a poor description of what one call costs?**
Because it describes the uncertainty of the mean, under a normality assumption that latency
distributions usually violate. For per-call behaviour you need the distribution — `SampleTime`
with its percentile ladder.

**★ A JMH line has no ± term. Why?**
Too few samples — the extended output requires more than two — or the score was formatted as
approximate. Either way, there is no confidence information attached to it.

**★ Is a tighter error bar always better?**
No. It means the samples were consistent, not that the benchmark measured the right thing.
Broken benchmarks can be extremely repeatable, and a tight interval from a single fork hides
run-to-run variance entirely.

**★ What is `p(100.0000)` in the sample-mode output?**
The maximum observed value — one observation, the least reproducible figure in the table.
Treat it as an anecdote; use p99 or p99.9 for claims, remembering `SampleTime` may miss some
pauses.

**★ How does JMH let you ask "are these two results different" programmatically?**
`Statistics.isDifferent(other, confidence)` and `compareTo(other, confidence)`. Both require
you to state a confidence level, because the question is meaningless without one.

**★ Why is statistical significance not enough to act on a regression?**
Because significance says a difference is unlikely to be chance; it says nothing about size.
With enough samples a 0.3% change becomes significant, so decide the practically meaningful
threshold before reading the table.

Next: [Profilers in JMH](08-profilers-in-jmh.md).

{/* FOOTER */}
