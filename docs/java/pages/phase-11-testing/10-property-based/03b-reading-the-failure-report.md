---
title: "jqwik's falsification output is a structured document, not a stack trace: a header block whose tries-versus-checks gap and edge-case counters tell you whether the property tested anything, followed by a shrunk sample and an original sample that occasionally disagree — and the disagreement is information"
sidebar_label: "03b · Reading the failure report"
sidebar_position: 11
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *Failure Reporting*,
> *Optional @Property Attributes*, *Result Shrinking* and *Assumptions*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> 🔴 **No sandbox and no test run on this machine.** The report fields below are described
> from the guide's documentation of them; no report on this page is the output of a run here,
> and no seed, count or timing on this page came from an execution.

**Everything about property-based testing that is worth having happens at the moment a
property is falsified, and jqwik spends that moment handing you a document. It is not a
message with a stack trace attached — it is a header block of a dozen named fields, then a
minimised failing input, then the input that actually failed first. Most people read the
exception and the shrunk sample and ignore the rest, and the rest is where you find out
whether the property was testing anything at all.**

## Reading the failure report

This is the part that repays study, because it is where the tool talks to you. When a
property is falsified, the guide documents that jqwik reports three things: the exception,
the property's parameters, and — *"Report both the original failing sample and the shrunk
sample"*.

The header block is a set of key/value lines. Each one answers a specific question:

| Field | What it tells you |
|---|---|
| `tries` | How many times the property method was called. Less than your `tries` setting means it stopped early — on the first falsification, or because generation was exhaustive and the space was smaller. |
| `checks` | How many of those calls were *not rejected* by an assumption. `checks` far below `tries` means your `Assume.that` is discarding most inputs — see [05b · Constraining generation](05b-constraining-generation.md). |
| `generation` | `RANDOMIZED`, `EXHAUSTIVE` or `DATA_DRIVEN`. If this says `EXHAUSTIVE`, jqwik enumerated the whole space and the result is a proof over that space rather than a sample. |
| `after-failure` | Which after-failure mode applied — `SAMPLE_FIRST`, `SAMPLE_ONLY`, `PREVIOUS_SEED` or `RANDOM_SEED`. This tells you whether the values you just saw were freshly generated or replayed from the last run. |
| `when-fixed-seed` | `ALLOW`, `WARN` or `FAIL` — the policy on hard-coded seeds. |
| `edge-cases#mode` | `MIXIN`, `FIRST` or `NONE`. |
| `edge-cases#total` | How many edge-case *combinations* exist across the parameters. |
| `edge-cases#tried` | How many of them this run actually used. A `total` of 40 and a `tried` of 0 says the run never reached the edge cases. |
| `seed` | The random seed. **This is the field you copy into a bug report.** See [07 · Reproducibility](07-reproducibility.md). |

Below the header come two sections whose names are worth memorising: **`Shrunk Sample`**,
with a step count, and **`Original Sample`** with its own `Original Error`. The first is the
minimal failing input jqwik could find; the second is the input it actually stumbled on.
Almost always you read the shrunk one and ignore the original — but when the two tell
different stories, that difference is information, and [06 · Shrinking](06-shrinking.md)
explains why.

⚠️ **A caveat the guide states and everyone trips over once.** *"The samples are reported
after their use in the property method. That means that mutable objects that are being changed
during a property show their final state, not the state in which the arbitrary generated
them."* If your property mutates its input — sorts a list in place, calls a setter — the
report shows you the *post-mutation* value, and you will spend a while wondering how that
value could possibly have failed. Property methods on mutable inputs should defensively copy
before acting, both to make the report honest and because a shrunk sample you cannot feed
back into the code is not much use.

## Where this connects

- Writing the property whose report this is is
  [03 · Writing a property](03-a-property.md).
- The attributes that change what the header block says — `tries`, `shrinking`,
  `generation`, `edgeCases`, `afterFailure` — are
  [03c · Attributes and defaults](03c-attributes-and-defaults.md).
- Why the shrunk sample is minimal and what bounded shrinking gives up is
  [06 · Shrinking](06-shrinking.md).
- The `seed` field, the `.jqwik-database` and reproducing a CI failure are
  [07 · Reproducibility](07-reproducibility.md).
- Making `checks` and the distribution visible on purpose is
  [09 · Statistics](09-statistics.md).
- Where the report is written and why the seed may not reach your CI report is
  [02c4 · The configuration surface](02c4-jqwiks-configuration-surface.md).

## Gotchas

**★ A property that mutates its generated input reports the mutated value, so the sample in the report may not reproduce the failure.**
Documented behaviour: samples are reported after use. A property that does
`list.sort(comparator)` and then asserts reports the *sorted* list, and feeding that back in
will not fail, because sorting is idempotent. This produces the specific, memorable
experience of a report that contradicts itself. Copy before you mutate:
`List<Integer> working = new ArrayList<>(generated);`.

**★ `tries` and `checks` are different numbers and the gap is the most under-read line in the report.**
`tries` is calls; `checks` is calls that survived assumptions. A property with
`tries = 1000, checks = 12` ran twelve meaningful times and passed — and it will keep passing,
and it is testing almost nothing. Nothing goes red about that until the discard ratio is
exceeded. Whenever you write an `Assume.that`, read those two numbers on the next run.

**★ jqwik reports the exception it caught, so an exception you did not intend looks the same as an assertion failure.**
If `Slug.of(null)` throws a `NullPointerException` because the generator produced a null you
did not expect, the property is reported as failed with an `NPE` — which is correct behaviour
and easy to misread as "my assertion failed". Read the exception type first. An `NPE` or an
`ArrayIndexOutOfBoundsException` in a property report usually means the *generator* found an
input class the code does not handle, which is a finding, not a test bug.

**★ Only the first falsifying sample is reported — a property does not tell you how many inputs would have failed.**
Execution stops at the first failure so that shrinking can begin. That means you cannot
distinguish "one input in a thousand fails" from "nine hundred fail" from the report, and you
should not read a single falsification as a rare edge case. If the distinction matters, use
`Statistics` ([09 · Statistics](09-statistics.md)) or temporarily catch and count inside the
property.

**★ The header block is printed on success too, and nobody reads it — which is why properties stay decorative for months.**
`tries`, `checks`, `generation`, `edge-cases#tried` and `seed` are reported after *each* run
property, not only failures. That means the evidence that a property is vacuous is on your
screen every single build and you are scrolling past it. Under Gradle you will not even see it
without `--info`, because jqwik does its own reporting by default. Reading the block once,
deliberately, the day you write a property is the cheapest quality gate in this topic.

**★ `edge-cases#total` counts permutations across parameters, so it explodes with parameter count and can exceed what the run will ever reach.**
Edge cases are combined and permuted across a property's parameters. Three parameters with
eight, four and six edge cases give nearly two hundred combinations, and with the default
`MIXIN` mode they are interleaved with random generation rather than run first. A property
with `tries = 100` and `edge-cases#total = 192` will, structurally, never see most of them.
That is either fine or the whole problem, depending on the code — and `EdgeCasesMode.FIRST`
exists to settle it. See [08 · Edge cases, exhaustive generation and data](08-edge-cases-exhaustive-and-data.md).

## Interview questions

**★ A teammate's property is green and you suspect it is not really testing anything. What do you look at, in order?**
Four things, none of which requires reading the assertion. First, `checks` versus `tries` in
the report: if `checks` is a small fraction of `tries`, assumptions are discarding nearly
everything and the property is running on a handful of inputs. Second, `edge-cases#tried`: if
it is zero while `edge-cases#total` is large, the run never got to the interesting values.
Third, the generator's constraints — `@IntRange(min = 1, max = 5)` on something production
allows to be zero or a million is the commonest way a property is green by construction.
Fourth, add a `Statistics.collect(...)` line classifying the inputs and look at the
distribution; that turns "I suspect" into a number. Only after all four would I read the law
itself and ask whether it is a tautology — and that is a different failure, covered in
[12 · The cost](12-the-cost.md).

**★ Why does the report contain both a shrunk sample and an original sample? Isn't the shrunk one enough?**
Usually yes, and occasionally the difference is the point. The shrunk sample is the smallest
input jqwik could find that still fails, so it is the one you debug with. The original is what
generation actually produced. Two situations make the original worth reading. First, when the
original error and the shrunk error are *different exceptions* — that means shrinking walked
into a neighbouring defect and the minimal case is not the case you were originally looking
at. Second, when the shrunk sample looks absurd (`""`, `0`, an empty list) and the original
looks realistic — that tells you the defect is at a boundary you may have deliberately excluded
in production, which changes whether it is worth fixing. The guide also warns that samples are
printed after the property ran, so on mutable inputs neither sample is necessarily the value
the arbitrary produced.

**★ A CI failure report shows an `AssertionError` from a jqwik property, and the property passes when you run it locally. Walk me through it.**
The first thing I want is the `seed` line from the CI log, because that is what makes the run
reproducible — and the first thing I would check is whether it is even in the report artifact,
since `jqwik.reporting.usejunitplatform` defaults to `false`, which means jqwik's block goes to
stdout rather than into the structured report. With the seed I set `@Property(seed = "…")`
locally, reproduce, fix, and remove the seed before committing. The reason it did not reproduce
without the seed is the second half of the explanation: locally the `.jqwik-database` file
would normally replay the last failing sample, but the failure happened on a CI agent whose
working directory no longer exists, so nothing was recorded on my machine and my run started
from a fresh random seed. If the seed was not captured, the honest position is that the failure
is currently unreproducible, and the fix is to the reporting configuration before it is to the
code — that is [07 · Reproducibility](07-reproducibility.md).

{/* FOOTER */}
