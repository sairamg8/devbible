---
title: "A property that passes tells you nothing about what it tested, and the commonest way for property-based testing to waste a team's time is a generator that has quietly been producing the same shape of value for months — statistics are how you make the distribution visible, and coverage checks are how you make the build fail when it drifts"
sidebar_label: "09 · Statistics: what did it actually generate?"
sidebar_position: 41
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Collecting and
> Reporting Statistics*, *Checking Coverage of Collected Statistics* and *Statistics Report
> Formatting* ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no test run on this machine** — no statistics table below was produced by
> an execution; the report shapes are described from the guide, and every percentage in the
> prose is an illustration, never an observed figure.
> ⚠️ **The coverage-checking builder chain is described here at the level of what it does, not
> as a copy-paste signature.** The published guide renders that fluent API in more than one
> form across versions, and this page will not print a method chain it cannot pin to the
> version in the spine. **Check `Statistics.coverage`'s exact chain against the guide for your
> jqwik version before writing it** — the argument on this page does not depend on the spelling.

**Every chunk before this one has been about generating values. This one is about the question
nobody asks until they have been burned: what did the generator actually produce? A property
test reports a pass and a try count, and those two facts are compatible with a generator that
has been emitting the empty list nine hundred times out of a thousand. The test was green the
whole time. It was also testing almost nothing.**

Three facts drive this chunk:

1. **A passing property is not evidence about coverage of the input space.** It is evidence
   about the values that were drawn, and you cannot see those values.
2. 🔴 **Generator drift is silent and permanent.** Nothing fails when a `filter` starts
   rejecting 95% of candidates or a constraint narrows after a refactor. The suite stays green
   and the property quietly stops earning its runtime.
3. **Statistics turn an invisible distribution into a printed table — and coverage checks turn
   that table into a build failure.** The second half is what makes this more than a debugging
   aid.

## Collecting: making the distribution visible

The entry point is `Statistics.collect`, called inside the property body with whatever you want
counted:

```java
@Property
void discountsNeverExceedTheOrderTotal(@ForAll("orders") Order order) {
    Statistics.collect(order.lineItems().isEmpty() ? "empty" : "non-empty");

    Money discount = pricing.discountFor(order);

    assertThat(discount).isLessThanOrEqualTo(order.total());
}
```

jqwik counts each distinct collected value across the run and prints a table of labels with
their counts and percentages when the property finishes. That is the whole mechanism, and it is
deliberately cheap: one call, no configuration, and you can delete it again once you have
looked.

You can classify by more than one dimension at once by collecting a combination, and you can
keep several independent collectors apart with `Statistics.label(...)`, which tags a collector
so its table is reported separately rather than merged into one set of counts. Use the second
when "how many orders were empty" and "how many customers were on a legacy tariff" are
genuinely different questions — merging them produces a cross-product table that is harder to
read than two small ones.

**What to collect is the skill, and the useful answer is almost always a classification, not a
value.** Collecting `order.total()` gives you a table with a thousand distinct rows and tells
you nothing. Collecting `total.isZero() ? "zero" : total.isNegative() ? "negative" : "positive"`
gives you three rows and answers the question you actually had.

## Report formatting

`@StatisticsReport` controls how the table is rendered:

```java
@Property
@StatisticsReport(format = Histogram.class)
void shippingCostGrowsWithWeight(@ForAll @IntRange(min = 0, max = 30000) int grams) {
    Statistics.collect(grams / 1000);
    // ...
}
```

`Histogram.class` renders the distribution as a bar chart, which is the right choice the moment
your labels have a natural order — you are looking for a shape, and a shape is much easier to
see than a column of percentages. `NumberRangeHistogram.class` is the variant for numeric
statistics, bucketing values into ranges rather than treating each number as its own label,
which is what you want when you collected a raw quantity rather than a classification.

There is also an `onFailureOnly` attribute, which suppresses the report unless the property
fails. That is the setting to reach for when you want statistics permanently in the code as
diagnostics for a future failure, without adding noise to every green run — and it is a better
answer than deleting the `collect` call and re-adding it the next time something breaks.

## Coverage checking: turning the table into a gate

Printing a distribution helps a human who is looking. The problem is that nobody looks at a
green test.

`Statistics.coverage(...)` closes that gap: it takes a checker over the collected statistics and
**fails the property** when the distribution does not meet the condition you state. You assert
things like "at least 5% of generated orders were empty" or "the `legacy-tariff` case occurred
at least fifty times", and from then on the build tells you when the generator drifts instead of
you noticing eight months later.

Conceptually there are two things you can assert about a collected label — how many times it
occurred, and what percentage of tries it represented — and the fluent chain gives you
comparisons over each. ⚠️ **As noted at the top of this page, pin the exact chain against the
guide for your jqwik version before writing it.** What matters architecturally is the shape:
a lambda receives a checker, you name a label, and you state a minimum.

**This is the feature that converts property testing from a technique into a discipline.**
Without it, a generator is an unverified assumption sitting underneath every property that uses
it. With it, the assumption is asserted, in the same run, by the same test.

### What to gate, and what not to

Gate the cases you are relying on being generated:

- The empty collection, when the property is partly about emptiness.
- The boundary bucket, when you constrained a range and want the ends actually visited.
- The rare branch — the retry path, the legacy tariff, the expired token — when the whole point
  of generating was to reach it.

Do not gate the ordinary interior of the distribution. A coverage check asserting that between
48% and 52% of booleans were `true` is a test of jqwik's random number generator, and it will
eventually fail on an unlucky seed for no reason anybody can act on. **The threshold should be
the level below which the property stops being meaningful, not the level you happened to
observe.**

## Gotchas

**`Statistics.collect` inside a filtered or assumed-away try still counts, or does not, in a way
you need to think about.** If you `assume()` early and then collect, you are measuring the
post-assumption distribution — which is the useful one for "what did I actually test" but the
wrong one for "how much am I throwing away". If the question is discard rate, collect *before*
the assumption.

**Collecting a value with a large or unbounded range produces a useless table and slows the
report.** A thousand distinct labels is not a distribution, it is a list. Classify first.

**A coverage threshold tuned to an observed percentage is a flaky test waiting to happen.**
Random generation varies run to run. Set the bound where the property genuinely stops proving
anything — often much lower than the number you saw — and treat the gap between the two as
headroom, not waste.

**Statistics are per-property, not per-suite.** There is no aggregate view across your whole
test run. If three properties share a generator and you want to know that generator is healthy,
the check belongs on the generator's own property — or you accept three separate tables.

**Edge cases skew the early distribution.** With the default mixin mode the boundaries are
injected deliberately, so a low try count will over-represent them relative to what pure random
sampling would give. That is a feature for finding bugs and a distortion for reading
distributions; be careful about drawing conclusions from a property with a small `tries`
setting.

**A histogram of a classification with unordered labels is worse than a plain table.** The bar
chart implies an ordering along its axis. If your labels are `"empty"`, `"legacy"`, `"eu-vat"`,
the ordering is meaningless and the shape invites a conclusion that is not there.

**Leaving `collect` calls in permanently is fine; leaving them in *unformatted* is what makes
people delete them.** Reach for `onFailureOnly` rather than removing the instrumentation you
will want again.

**★ A property has passed every night for a year. What is the argument that it might be testing nothing?**
That a pass reports the try count and nothing about the values. The failure mode I have actually
seen is a `filter` on a generator that became far more restrictive after the domain model
changed — the generator now rejects almost every candidate and the surviving values are all the
same narrow shape, so the property exercises one path a thousand times. Nothing fails, because
the property is still true of that path. The way to know is to collect a classification and
look, and the way to keep knowing is a coverage check, so the next drift fails the build rather
than surviving another year.

**★ You add a coverage check requiring 5% empty lists and it fails on some seeds and not others. What went wrong?**
Almost certainly the threshold was set from an observation rather than from the requirement. If
the true generation rate hovers around 5%, then run-to-run variance will cross the line
regularly and the test is flaky by construction. The question to ask is what the property needs:
if it needs the empty case reached *at all*, assert a small absolute count rather than a
percentage, which is far more stable at low frequencies. If it genuinely needs 5% for the
property to be meaningful, then the generator should be built to produce that — with an explicit
`frequency`-weighted arbitrary — rather than the check hoping randomness supplies it.

**★ What is the difference between this and code coverage from topic 09 of this phase?**
They answer opposite questions and neither substitutes for the other. JaCoCo tells you which
lines of *production code* executed. jqwik statistics tell you which shapes of *input* were
generated. You can have 100% line coverage from a generator that only ever produces one kind of
value, and you can have a beautifully distributed generator over code paths that are never
reached. The pairing that actually informs you is: line coverage says the branch ran, statistics
say the interesting inputs were produced, and mutation testing — the next topic — asks whether
any assertion would have noticed if the behaviour changed.

**★ Would you gate a coverage check in CI, or just print the statistics?**
Gate it, for the specific cases the property depends on, and print for everything else. The
asymmetry is that a printed table only helps someone who reads it, and nobody reads the output
of a passing test — so an un-gated statistic is documentation of an assumption, not a check of
it. But I would gate narrowly: two or three named cases with generous bounds, chosen because the
property is worthless without them. Gating the general shape of the distribution buys nothing
and costs you a flaky suite.

**★ Where would you put the `collect` call in a property that uses `assume()`?**
It depends on which question I am asking, and I would often want both. Collecting after the
assumption measures what was actually tested, which is the number that tells me whether the
property is doing useful work. Collecting before it measures the discard rate, which is the
number that tells me whether the generator is wasting tries — and a high discard rate is the
signal to replace filtering with generation that constructs valid values directly. Two labelled
collectors give both tables in one run.

{/* FOOTER */}
