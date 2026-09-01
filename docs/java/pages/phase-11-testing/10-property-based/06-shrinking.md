---
title: "Shrinking is the feature that makes property-based testing usable rather than merely clever, because a randomly generated counter-example is almost always too big to read — and jqwik's approach, integrated shrinking, is why it keeps working through filters, maps and combinators that would defeat the type-based shrinking most other tools use"
sidebar_label: "06 · Shrinking"
sidebar_position: 30
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Result Shrinking*,
> *Integrated Shrinking*, *Switch Shrinking Off*, *Switch Shrinking to Full Mode*, *Change the
> Shrinking Target*, *Combining Arbitraries vs Flat Mapping*, *Optional @Property Attributes*
> and *Data Driven Properties*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); and the **jqwik 1.10.1 javadoc**
> for `Arbitraries.of`, `Arbitraries.create`, `Arbitraries.shuffle` and `Arbitraries.fromGenerator`
> ([jqwik.net](https://jqwik.net/docs/1.10.1/javadoc/net/jqwik/api/Arbitraries.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** The two report blocks below are reproduced
> from the user guide's own published examples and are labelled as such; nothing here is the
> output of a run performed here.

**A property that fails hands you a value the random generator happened to draw. On a
thousand-try run over a realistic generator, that value is a 200-character string, or a list of
nine records each with eleven populated fields, and the bug is one character or one field of it.
Nobody debugs that. Shrinking is the search that runs after the failure and before the report:
jqwik takes the falsifying sample and looks for a smaller one that still falsifies, over and
over, and reports what it lands on. Without it, property-based testing produces failures nobody
can act on, and a failure nobody can act on eventually gets deleted.**

## What jqwik actually does after a failure

The guide states the loop plainly:

> *"If a property could be falsified with a generated set of values, jqwik will try to 'shrink'
> this sample in order to find a 'smaller' sample that also falsifies the property."*

Two things in that sentence carry the whole feature. **"Smaller" is defined per arbitrary**, not
globally — each generator knows what a simpler value of its own type looks like. And the search
is a *re-run*: every candidate is fed back through your property method. Shrinking is not
post-processing of a value, it is repeated execution of your test.

The guide's own example is the clearest statement of the goal:

```java
@Property
boolean stringShouldBeShrunkToAA(@ForAll @AlphaChars String aString) {
    return aString.length() > 5 || aString.length() < 2;
}
```

and the report it publishes for it — quoted from the guide, not run here:

```text
AssertionFailedError: Property [stringShouldBeShrunkToAA] falsified with sample {0="aa"}

tries = 38
checks = 38
...
Shrunk Sample (5 steps)
-------------------------
  aString: "AA"

Original Sample
---------------
  aString: "RzZ"
```

The guide's explanation of *why* `"AA"` is the answer is the most useful sentence in the section,
because it tells you what "smaller" means for a string:

> *"the original sample could be any string between 2 and 5 chars, whereas the final sample
> should be exactly `AA` since this is the shortest failing string and `A` has the lowest numeric
> value of all allowed characters."*

Length first, then character value. That is a *lexical* notion of simplicity, and it is why a
shrunk string is usually a run of `a`s or `A`s rather than anything meaningful — which trips
people up the first time, because the shrunk value looks like a jqwik artefact rather than a
real input. It is a real input; it is the least interesting real input that still breaks the code.

## Which way each generator shrinks

There is no single rule, and the per-type direction is worth knowing because it determines what
your failure reports will look like.

| Generator | Shrinks toward |
|---|---|
| Numbers | **Zero.** If zero is outside the generated range, the guide says the target is *"the closest number to zero - either the min or max value"* |
| `shrinkTowards(target)` | Whatever you name — the target is *"supposed to be the 'center' of all possible values used for shrinking and as a mean for random distributions"* |
| Strings | Shorter first, then the lowest-valued character in the allowed alphabet |
| Collections | Fewer elements, then simpler elements |
| `Arbitraries.of(U... values)` | *"Shrink towards the first one"* — the order you wrote the arguments in is a shrinking decision |
| `Arbitraries.of(SomeEnum.class)` | *"Shrink towards first enum value"* — the declaration order of the enum |
| `Arbitraries.frequency(...)` | *"Shrinking moves towards the start of the frequency list"* |
| Generated functions | *"constant functions, i.e. functions that always return the same value"* |

Three of those rows are the same fact wearing different clothes: **for anything chosen from an
ordered set, the first element is the simplest one.** That makes argument order in
`Arbitraries.of` and member order in an enum load-bearing for readability of failures. Put the
boring, canonical, most-likely-to-be-correct case first and every failure report starts from it.

Two entries in the API shrink not at all, by design:

- `Arbitraries.create(Supplier<T>)` — *"In each try use a new unshrinkable instance of type `T`
  using supplier to freshly create it."*
- `Arbitraries.shuffle(...)` — *"Return unshrinkable permutations of the values handed in."*

And `Arbitraries.fromGenerator(...)` opts out unless you do the work: *"If the number of tries
influences value generation or if you want to allow for shrinking you have to provide your own
`RandomGenerator` implementation."*

## Integrated shrinking — the thing jqwik does differently

> *"jqwik's shrinking approach is called integrated shrinking, as opposed to type-based shrinking
> which most property-based testing tools use."*

The distinction matters more than the name suggests. **Type-based shrinking** shrinks the final
value by its type: it sees a `String` and tries shorter strings. That works until the value came
out of a pipeline — a `String` that was filtered to end in `h`, or mapped from an `Integer`, or
combined from two other arbitraries. A shorter string is very likely no longer a *legal* value of
that generator, so a type-based shrinker either produces invalid inputs or gives up.

**Integrated shrinking** shrinks the *generator*, not the value. Each arbitrary knows how to
produce a simpler version of itself, and `map`, `filter` and `combine` compose that knowledge
along with the generation. The constraint survives the shrink because the shrink happens on the
same side of the pipeline as the constraint.

The guide demonstrates it on a case built to be hostile — two filtered string generators
concatenated inside the property:

```java
@Property
boolean shrinkingCanTakeAWhile(@ForAll("first") String first, @ForAll("second") String second) {
    String aString = first + second;
    return aString.length() > 5 || aString.length() < 2;
}

@Provide
Arbitrary<String> first() {
    return Arbitraries.strings()
        .withCharRange('a', 'z')
        .ofMinLength(1).ofMaxLength(10)
        .filter(string -> string.endsWith("h"));
}

@Provide
Arbitrary<String> second() {
    return Arbitraries.strings()
        .withCharRange('0', '9')
        .ofMinLength(0).ofMaxLength(10)
        .filter(string -> string.length() >= 1);
}
```

> *"Shrinking still works, although there's quite a bit of filtering and string concatenation
> happening"*

This is the practical payoff, and it is why the advice in [05b](05b-constraining-generation.md)
to constrain generation with the builder API rather than by post-filtering does **not** cost you
shrinkability: `filter` is inside the arbitrary, so the shrinker respects it.

## There is often no single smallest example

The same section carries a warning most readers skim, and it changes how you write assertions
about a failure:

> *"This example also shows that sometimes there is no single 'smallest example'. Depending on
> the starting random seed, this property will shrink to either `{0="a", 1="000"}`,
> `{0="ah", 1="00"}` or `{0="aah", 1="0"}`, all of which are considered to be the smallest
> possible for jqwik's current way of measuring a sample's size."*

Three different reports, all correct, all minimal, chosen by the seed. So the shrunk sample is
**a** minimal counter-example, not **the** minimal counter-example — and a regression test that
hard-codes yesterday's shrunk value is pinning one arbitrary member of an equivalence class. Pin
it anyway (that is what [08 · Edge cases, exhaustive and data](08-edge-cases-exhaustive-and-data.md)
is for), but pin it because it is a real failing case, not because it is canonical.

## Where this connects

- Reading the two-block failure report the shrinker produces — and why the sample is printed
  *after* use — is [03b · Reading the failure report](03b-reading-the-failure-report.md).
- What the shrinker costs you at runtime, and why a property with a side effect can report the
  wrong exception entirely, is [06b · What shrinking costs you](06b-what-shrinking-costs-you.md).
- Turning the shrinker's behaviour into settings you choose deliberately — the three
  `ShrinkingMode` values, the ten-second bound and `shrinkTowards` — is
  [06c · Controlling the shrinker](06c-controlling-the-shrinker.md).
- Making the failure come back on the next run at all is
  [07 · Reproducibility](07-reproducibility.md).
- Pinning a shrunk sample as a permanent regression test is
  [08 · Edge cases, exhaustive and data](08-edge-cases-exhaustive-and-data.md).
- Why `combine` shrinks better than nested `flatMap` is
  [05c · Composing arbitraries](05c-composing-arbitraries.md); the dependent-generation case is
  [05c3 · Dependent generation](05c3-dependent-generation.md).

## Gotchas

**★ A shrunk value that looks like nonsense — `""`, `0`, `"AA"`, `[null]` — is usually the correct answer, and the instinct to distrust it wastes an afternoon.**
Shrinking drives toward the simplest input in the generator's own ordering, so the report is
*supposed* to look degenerate. `""` and `0` failing is the finding, not an artefact: it means the
bug is in an empty-input or zero path, which is exactly the path a hand-written test suite omits.
Read the shrunk value as a specification of the bug's boundary, not as a sample of realistic
traffic.

**★ `Arbitraries.create(Supplier)` and `Arbitraries.shuffle(...)` produce values the shrinker cannot touch, so any failure involving them reports the full random original.**
Both are documented as unshrinkable — `create` gives *"a new unshrinkable instance"* per try,
`shuffle` returns *"unshrinkable permutations"*. If your aggregate is built from either, the whole
aggregate stops shrinking usefully, because the un-simplifiable part keeps the sample big. When a
report is stubbornly large, look for these two before blaming the shrinker. Where you needed
`create` only to avoid the reused-instance hazard of `just`, `Arbitraries.ofSuppliers(...)` is
the shrinkable alternative for choosing among fresh mutable objects.

**★ Nested `flatMap` silently degrades shrinking, and nothing in the failure report says so.**
The guide is explicit: *"Since flat mapping is about the dependency of one arbitrary on values
generated by another, shrinking cannot be as aggressive. That means that in many cases using
`combine(..)` will lead to better shrinking behaviour than nested `flatMap(..)` calls."* The
symptom is a shrunk sample that is only slightly smaller than the original, on a generator that
looks like it should collapse to something tiny. The fix is a generator refactor — `combine`
where there is no real dependency — not a shrinking setting.

**★ `Arbitraries.of(...)` argument order and enum declaration order are shrinking configuration, and nobody treats them as such.**
Both shrink toward the first element. So an enum declared `{ FAILED, PENDING, ACTIVE }` will make
every failure report start from `FAILED`, and a reviewer reading a dozen such reports will
conclude the bug is about failure states when it is about all states equally. Declare the neutral
or canonical value first — for an enum you control, and via `Arbitraries.of(ACTIVE, PENDING,
FAILED)` for one you do not.

**★ Numeric shrinking targets zero even when zero is meaningless for your domain, producing minimal counter-examples that are legal for the generator and absurd for the business.**
The guide's own example is the fix: signals with a standard frequency of 50 hz varying by ±5
should shrink toward 50, not toward 45. Without `shrinkTowards(50)` every report reads as a
boundary bug at the bottom of the range. The setting exists precisely because *"the default value
of a number is not 0"* in most domains. It is covered in full in
[06c](06c-controlling-the-shrinker.md), and it belongs on almost every constrained numeric
arbitrary you write.

**★ Data-driven properties do not shrink at all, and the guide gives the reason rather than treating it as a limitation.**
> *"There is also no shrinking being done for data-driven properties since jqwik has no
> information about the constraints under which the external data was conceived or generated."*
So `@FromData` gives you parameterized-test ergonomics inside jqwik and none of the shrinking
value. It also reports *"only the first falsified data point"*, which means fixing one failure can
reveal another. Reach for it to pin known cases, never as a substitute for a generator.

**★ Choosing a generator by how easy it is to write can change the shrinking target without any warning.**
The guide's illustration: generating a five-digit numeric string via
`Arbitraries.integers(10000, 99999).map(String::valueOf)` versus constraining and filtering a
generated `String` produces the same values and different reports — *"shrinking will move towards
the lowest allowed number, that is 10000"* in the first case. Two generators, same distribution,
different minimal counter-example. When a failure report's minimum looks arbitrary, the generator
construction is where to look.

## Interview questions

**★ What is shrinking, and what would property-based testing be like without it?**
After a property is falsified, the framework searches for a simpler input that still falsifies it
and reports that instead of the raw random draw. Without it the tool still finds bugs — the
generation is what finds bugs — but every finding arrives as a wall of random data with the
signal buried in it, and the cost of triaging a failure exceeds the value of having found it. In
practice teams respond to unshrinkable failures by deleting or quarantining the property, so the
honest answer is that without shrinking property-based testing does not survive contact with a
real codebase. The secondary effect matters too: because the shrunk value is minimal, it is
usually *readable as a specification of the bug* — "fails on the empty list", "fails at zero" —
which is a much better bug report than "fails on this 300-character string".

**★ jqwik calls its approach "integrated shrinking" and contrasts it with type-based shrinking. What is the difference and why does it matter?**
Type-based shrinking looks at the final value and simplifies it according to its type: given a
`String`, try shorter strings. Integrated shrinking simplifies the *generator*, so every `map`,
`filter` and `combine` in the pipeline is applied again to the simplified value. It matters
because real generators are pipelines. If a generator produces strings that must end in `h`,
type-based shrinking will happily propose `"a"` — which the generator could never have produced —
and either report an invalid input or stall. The guide demonstrates jqwik shrinking through two
filtered generators concatenated inside the property and notes it still works. The practical
consequence for how I write code is that I can constrain generation with `filter` and
assumptions without worrying that I have traded away readable failures.

**★ Why does argument order in `Arbitraries.of(...)` matter?**
Because it is the shrinking order: the javadoc says values shrink *"towards the first one"*, and
the same holds for enum constants and for `frequency`, where *"shrinking moves towards the start
of the frequency list"*. Every failure report over that arbitrary therefore starts from element
zero, so element zero should be the canonical, boring, most-likely-correct case. Put an
exceptional value first and every minimal counter-example in the suite will feature it, which
misdirects whoever reads the reports — they will form a theory about that value when it is simply
the shrinker's floor. It is a one-line decision that shapes the readability of every future
failure, which is why it is worth noticing in review.

**★ Is the shrunk sample the smallest failing input?**
No — it is *a* smallest failing input under jqwik's ordering, and the guide is explicit that for
some properties several equally-small samples exist and which one you get depends on the seed. It
gives a case that shrinks to `{0="a", 1="000"}`, `{0="ah", 1="00"}` or `{0="aah", 1="0"}`
depending on where the run started. This matters in two places. It means a test that asserts on
the exact shrunk value is asserting on a seed-dependent choice among equivalent answers, so pin a
shrunk sample as a regression case by all means, but do not build tooling that expects it to be
stable. And it means two engineers debugging "the same" failure can be looking at different
minimal inputs, which is worth saying out loud before the two of you spend an hour reconciling
reports.

{/* FOOTER */}
