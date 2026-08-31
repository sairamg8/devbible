---
title: "A filter throws away generated values until it finds one that fits and abandons the property after ten thousand failures for a single value; an assumption throws them away after generation and fails the property once the discard ratio passes five — so the skill is rewriting both into a map or a flatMap that constructs only valid inputs"
sidebar_label: "05b2 · Filtering, assumptions and discards"
sidebar_position: 22
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *Filtering*,
> *Mapping*, *Assumptions*, *Optional @Property Attributes* (`maxDiscardRatio`), *Ignoring
> Exceptions During Generation*, *Result Shrinking* and *jqwik Configuration*
> (`jqwik.maxdiscardratio.default`) ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** The thresholds and the shape of the
> "exhausted" message below are quoted from the guide, never observed from a run here.

**[05b](05b-constraining-generation.md) covered the annotations, which cost nothing because
they build a generator that only produces valid values. This page is about the other two
mechanisms, the ones that generate and then throw away — and about the two documented
thresholds at which jqwik stops tolerating that. A filter abandons the property after ten
thousand failed attempts *for a single value*. An assumption fails the property once the ratio
of generated to accepted inputs passes five. Both thresholds exist to stop you shipping a
property that reports a thousand tries and checked twelve inputs, and the usual fix is not to
raise the threshold but to construct the input differently.**

## Filtering: the tool everyone reaches for, and its hard limit

`Arbitrary.filter(predicate)` produces an arbitrary that only emits matching values, by
generating and discarding. It is legitimate for a *cheap* restriction — the guide's own example
is odd numbers — and it has a documented cliff:

> *"Keep in mind that your filter condition should not be too restrictive. If the generator
> fails to find a suitable value after 10000 trials, the current property will be abandoned by
> throwing an exception."*

Ten thousand trials per value. A filter that accepts one value in a thousand does not fail
quickly and obviously; it makes generation a thousand times more expensive and *then* fails,
somewhere, at some future `tries` count, on some seeds and not others. That is why filtering is
third on the list rather than first.

```java
// filter: generate everything, throw most of it away
Arbitraries.strings().filter(s -> s.length() == 5 && s.chars().allMatch(Character::isDigit));

// constrain: generate only what you want, at full speed
Arbitraries.strings().numeric().ofLength(5);
```

Both produce five-digit strings. The first asks jqwik to keep rolling dice until it hits one;
the second never rolls a bad one.

## Mapping beats filtering, and it changes shrinking

Where a constraint cannot express the restriction, a `map` usually can, and the guide points
out the consequence that matters:

> *"You could generate the same kind of values by constraining and filtering a generated
> String. However, the shrinking target would probably be different. In the example above,
> shrinking will move towards the lowest allowed number, that is 10000."*

```java
// five-digit numeric strings, shrinking toward "10000"
Arbitraries.integers().between(10_000, 99_999).map(String::valueOf);

// even numbers, without discarding half of everything generated
Arbitraries.integers().between(0, 5_000).map(n -> n * 2);
```

That second line is the pattern worth internalising: **a filter that rejects a fixed fraction of
values can nearly always be rewritten as a map that constructs them.** "Even" is `n * 2`. "A
multiple of the page size" is `n * pageSize`. "A date in the same month" is a day-of-month
generated between 1 and the month's length. Each rewrite removes a discard *and* gives shrinking
a sensible target.

## Assumptions: for constraints that span two parameters

Filtering works on one arbitrary. When the restriction relates two or more parameters, the
documented tool is `Assume.that`, executed inside the property:

```java
@Property
boolean comparingUnequalStrings(
        @ForAll @StringLength(min = 1, max = 10) String string1,
        @ForAll @StringLength(min = 1, max = 10) String string2) {
    Assume.that(!string1.equals(string2));
    return string1.compareTo(string2) != 0;
}
```

The guide calls this *"a reasonable use of `Assume.that(boolean condition)` because most
generated value sets will pass through"* — and immediately contrasts it with a case that looks
identical and is not: assuming one generated string contains another, where *"only in very few
cases one string will be contained in the other."*

That second property fails. Not falsified — **exhausted**:

> *"jqwik will report a property as exhausted if the ratio between generated and accepted
> parameters is higher than 5. You can change the maximum discard ratio by specifying a
> parameter `maxDiscardRatio` in the `@Property` annotation."*

The report shows it as a `tries` count far above `checks`, and the guide's documented message
for the exhausted case reads *"Property [findingContainedStrings] exhausted after [1000] tries
and [980] rejections"*.

And the guide's advice about the obvious fix is worth quoting because it is the opposite of
what most people do:

> *"In many cases turning up the accepted discard ration is a bad idea. With some creativity we
> can often avoid the problem by generating out test data a bit differently."*

Its own rewrite generates a container string, a length and a start index, and *derives* the
contained string by `substring` — so the relationship holds by construction and the only
assumption left (`length + startIndex <= container.length()`) passes most of the time.

## The order of preference, and how to apply it

1. **Annotation** — `@IntRange`, `@Size`, `@NotBlank`. Zero waste, shrinks well, readable in
   the signature.
2. **Constrained arbitrary in a `@Provide`** — `Arbitraries.strings().numeric().ofLength(5)`.
   Same properties, more expressive.
3. **`map`** — construct the valid value from a generated one. No waste; changes the shrinking
   target, usually for the better.
4. **`flatMap` / `Combinators`** — when one value depends on another. Generate the container,
   then an index inside it ([05c](05c-composing-arbitraries.md)).
5. **`filter`** — only when the rejection rate is low and there is no constructive route.
6. **`Assume.that`** — only for cross-parameter constraints that pass most of the time.
7. **`maxDiscardRatio`** — last, deliberately, with a comment saying why the other six failed.
## Where this connects

- The annotations that avoid all of this by constraining generation directly are
  [05b · Constraining generation](05b-constraining-generation.md).
- `map`, `flatMap`, `Combinators` and `ignoreException` in full — the constructive
  alternatives — are [05c · Composing arbitraries](05c-composing-arbitraries.md).
- `maxDiscardRatio` as a `@Property` attribute, its default of 5, and the five-level precedence
  chain that can change it behind your back are
  [03c · Attributes and defaults](03c-attributes-and-defaults.md); the configuration key
  `jqwik.maxdiscardratio.default` is
  [02c4 · The configuration surface](02c4-jqwiks-configuration-surface.md).
- `tries` versus `checks` in the report — the number that tells you an assumption is eating
  your inputs — is [03b · Reading the failure report](03b-reading-the-failure-report.md).
- Why heavy filtering degrades the minimal failing case is [06 · Shrinking](06-shrinking.md).
- Proving the surviving inputs are the interesting ones is
  [09 · Statistics](09-statistics.md).

## Gotchas

**★ A filter that rejects most values does not fail fast; it fails after ten thousand trials, intermittently.**
The documented threshold is per value: *"if the generator fails to find a suitable value after
10000 trials, the current property will be abandoned by throwing an exception."* A filter with a
0.1% acceptance rate will usually succeed — slowly — and occasionally blow up, so it presents as
a flaky, slow property rather than as a bad generator. If you must filter, know roughly what
fraction you are keeping.

**★ `Assume.that` does not narrow generation; it throws away work already done, and the default discard ratio of 5 fails the property rather than warning about it.**
Assumptions run inside the property, after values are generated. The failure they cause is
reported as *exhausted*, which reads like a tool malfunction rather than a test-design problem —
and the honest reading is "this property tested `checks` inputs, not `tries` inputs". Whenever
you add an assumption, read `checks` on the next run.

**★ Raising `maxDiscardRatio` to 100 makes the red build green and leaves the property testing twenty inputs out of a thousand.**
It is the most tempting one-token fix in this topic, and the guide explicitly warns against it:
*"In many cases turning up the accepted discard ration is a bad idea."* A property with
`maxDiscardRatio = 100` and `tries = 1000` may be checking a handful of cases while reporting a
thousand tries, and nothing about the build tells you. If you genuinely need it, raise `tries`
in the same commit so the number of *checks* stays meaningful.
**★ `.filter(...)` before `.list()` filters elements; after `.list()` it filters whole lists, and the second one hits the ten-thousand-trial cliff almost immediately.**
`Arbitraries.integers().filter(n -> n % 2 == 0).list()` rejects roughly half of each *element*
and always succeeds. `Arbitraries.integers().list().filter(l -> l.stream().allMatch(even))`
rejects any list containing a single odd number, which for a list of twenty elements is
essentially all of them — so the generator burns ten thousand trials and abandons the property.
The two lines look almost identical in a diff. Filter at the deepest level the condition
applies to.

**★ Shrinking has to re-satisfy every filter, so a heavily filtered arbitrary gives you a worse minimal case as well as slower generation.**
The guide's integrated-shrinking example is deliberately built from two filtered string
arbitraries and notes that shrinking *"still works, although there's quite a bit of filtering
and string concatenation happening"* — the point being that it is doing extra work. Each
candidate the shrinker proposes must pass the filter or be discarded, so a restrictive filter
narrows the path toward a smaller value and the reported `Shrunk Sample` is often less minimal
than it would otherwise be. This is a second, quieter cost on top of the generation cost.

**★ `maxDiscardRatio` also has a global default in `junit-platform.properties`, so the number in force may not be the number in the annotation — or in any annotation.**
`jqwik.maxdiscardratio.default = 5` is one of the documented configuration keys, and the
five-level precedence chain from [03c](03c-attributes-and-defaults.md) applies: file, then class
`@PropertyDefaults`, then superclass, then the method. A team that raised the global default to
silence one noisy property has raised it for every property in the module, including the ones
where a rising discard rate was the only signal that a generator had drifted.

**★ An assumption that references a mutable field, rather than only the generated parameters, makes the discard rate depend on try order.**
`Assume.that(!seen.contains(value))` with `seen` as an instance field looks like a
de-duplication guard. Because one instance of the test class serves every try of a property
([03d](03d-the-jqwik-lifecycle.md)), `seen` grows monotonically and the discard rate climbs
during the run — so the property passes at `tries = 100` and reports exhausted at
`tries = 1000`, which reads as a threshold bug in jqwik. Assumptions should be pure functions of
the generated parameters.

**★ `ignoreException` turns an invalid combination into a discard, which means it has the same accounting problem as a filter and none of the visibility.**
`Combinators.combine(years, months, days).as(LocalDate::of).ignoreException(DateTimeException.class)`
is the documented way to let the domain object reject February 31st — and it is a filter wearing
different clothes: a few percent of combinations are thrown away. That is fine at a few percent.
It is not fine if the constructor rejects most inputs, and because the discards happen inside
generation rather than inside the property, they do not show up in the `tries`-versus-`checks`
gap. If a constructor is doing heavy validation, generate the parts so they are valid by
construction.

## Interview questions

**★ Explain why filtering is usually the wrong way to constrain a generator, and what you would do instead.**
Three reasons, in increasing order of importance. It is slow, because every rejected value was
fully generated first. It is fragile, because jqwik abandons the property after ten thousand
failed trials for a single value, so a filter that is merely restrictive today becomes a broken
build when someone widens the underlying arbitrary. And it damages shrinking, because the
shrinker has to keep re-checking the filter as it searches for smaller values, so the minimal
case it finds is often less minimal than it could be. What I do instead depends on the shape of
the restriction: if it is expressible as a range, size or character set, it is an annotation; if
the valid values can be *constructed* from arbitrary ones — even numbers are `n * 2`, five-digit
strings are integers mapped to strings — it is a `map`, which also gives shrinking a meaningful
target; and if one value depends on another, it is a `flatMap`. Filtering is what is left when
none of those work, and then only if it rejects a small fraction.

**★ A property in CI fails with "exhausted after 1000 tries and 980 rejections". What has happened and what do you do?**
An assumption inside the property rejected 98% of generated inputs, and jqwik's documented
default discard ratio is 5 — one rejection per accepted case is fine, four is the edge, this is
forty-nine. It is not a bug in the code under test; the property only ever checked twenty inputs
and jqwik is telling me it cannot regard that as a test. The wrong fix is
`maxDiscardRatio = 100`, which converts a loud problem into a silent one: the build goes green
and the property still checks twenty cases. The right fix is to generate the data so that the
assumption holds by construction — the guide's own example is exactly this, replacing "generate
two strings and assume one contains the other" with "generate a string, a start index and a
length, and take the substring". That gets the discard rate near zero and the property back to a
thousand real checks.

**★ You need a property over a `LocalDate` that must be a valid date between 1900 and 2099. Walk through the options in order.**
First choice is an annotation, because the bundled time module has one: `@DateRange(min =
"1900-01-01", max = "2099-12-31")` on a `@ForAll LocalDate` generates only valid dates in range,
with no waste and correct shrinking. If I were building the date from parts — because the code
under test takes year, month and day separately — the naive version generates three integers and
filters out February 31st, which discards a few percent of values for no reason. The documented
alternative is to let the domain object validate: `Combinators.combine(years, months, days).as(
LocalDate::of).ignoreException(DateTimeException.class)`, which the guide presents precisely for
this case, or `@Provide(ignoreExceptions = DateTimeException.class)` on the method. The last
resort is generating year and month and then flat-mapping the day into the correct range for
that month — more code, no discards, and the best shrinking of the three.
**★ Is there ever a good reason to raise `maxDiscardRatio`?**
Yes, and it is narrow. The legitimate case is a property whose precondition is genuinely rare in
the input space, cannot be constructed directly, and matters enough to test anyway — something
like "when two independently generated transactions collide on the same account", where the
collision is the whole point and building it by construction would defeat the test by removing
the randomness that makes it interesting. In that case I would raise `maxDiscardRatio`, raise
`tries` proportionally so the number of real *checks* stays meaningful, and put a comment on the
annotation saying which of those two numbers is the one that matters. What makes it defensible
is that the ratio was raised *with* the try count; what makes the usual case indefensible is
raising the ratio alone, which leaves the property checking the same handful of inputs and only
silences the tool that was telling you so. I would also add a `Statistics.coverage` check
asserting the interesting case appears at least so many times, so the property fails if the
discard rate ever gets worse rather than silently testing nothing.

**★ How do assumptions interact with shrinking?**
An assumption is evaluated inside the property body, so a value that fails it is not a
counter-example — it is a non-result. During shrinking, the shrinker proposes smaller candidate
inputs and any candidate that trips the assumption tells it nothing, so the search has to keep
looking. The practical consequence is that a property with a restrictive assumption shrinks
worse: the minimal failing case it reports may be some way from the true minimum, because much
of the neighbourhood around the failing value is unreachable. That is one more reason the
documented advice is to generate the data differently rather than to assume — a property that
constructs valid inputs has the whole space available to shrink through, and the sample you get
in the report is correspondingly smaller and easier to read.

{/* FOOTER */}
