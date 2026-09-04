---
title: "A jqwik property is a package-scoped method annotated @Property whose every generated parameter carries @ForAll, which either returns boolean or asserts, and which runs a thousand times by default — and the choice between returning a boolean and asserting is the one that decides how much you learn the day it goes red"
sidebar_label: "03 · Writing a property"
sidebar_position: 10
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *Creating a
> Property*, *Failure Reporting*, *Creating an Example-based Test* and *Assertions*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); and the **AssertJ 3.27.7**
> API for the assertions used in the examples.
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — ⚠️ read
> [02b · The version collision](02b-the-version-collision.md) before adding it to a Boot 4.1
> build.
> ⚠️ **No sandbox and no test run on this machine.** Java source and documented behaviour
> only; the report fields below are described from the guide's documentation of them, never
> reproduced from a run here.

**A property is four decisions, and three of them are made for you. You annotate a method
`@Property`, you annotate every parameter you want generated with `@ForAll`, and you either
return a `boolean` or assert — that is the whole surface. The fourth decision — whether a
returned `boolean` or an assertion carries the failure — is the only one worth arguing about,
and it decides how much you learn when the property goes red. Once it does go red, the report
jqwik prints is a structured document rather than a stack trace, and reading it is
[03b · Reading the failure report](03b-reading-the-failure-report.md).**

## The method

```java
package com.example.domain;

import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.IntRange;

import static org.assertj.core.api.Assertions.assertThat;

class SlugPropertyTests {

    @Property
    void slugsAreAlwaysLowercase(@ForAll String input) {
        assertThat(Slug.of(input).value()).isLowerCase();
    }

    @Property
    boolean slugsNeverStartOrEndWithADash(@ForAll String input) {
        String slug = Slug.of(input).value();
        return !slug.startsWith("-") && !slug.endsWith("-");
    }

    @Property
    void slugsAreIdempotent(@ForAll String input) {
        String once  = Slug.of(input).value();
        String twice = Slug.of(once).value();
        assertThat(twice).isEqualTo(once);
    }

    @Property
    void slugsAreNeverLongerThanTheLimit(@ForAll String input, @ForAll @IntRange(min = 1, max = 200) int limit) {
        assertThat(Slug.of(input, limit).value().length()).isLessThanOrEqualTo(limit);
    }
}
```

Four rules govern all of these, and the guide states each of them:

1. **The method must be `public`, `protected` or package-scoped.** Private does not work; the
   guide says *"You create a Property by annotating a public, protected or package-scoped
   method with `@Property`."* Package-scoped is the idiomatic choice and what every example
   above uses.
2. **A property is supposed to have parameters, and each generated one must carry `@ForAll`.**
   *"In contrast to examples a property method is supposed to have one or more parameters, all
   of which must be annotated with `@ForAll`."* And, separately and importantly: *"Mind that
   only parameters that are annotated with '@ForAll' are considered for value generation.
   Other kinds of parameters can be injected through the resolve parameter hook."*
3. **The return type is `boolean` or `void`.** A returned `true` means success and `false`
   means failure; a `void` method is expected to assert. Both forms are first-class.
4. **It runs 1000 times unless you say otherwise.** *"If not specified differently, jqwik will
   run 1000 tries, i.e. a 1000 different sets of parameter values and execute the property
   method with each of those parameter sets."* And: *"The first failed execution will stop
   value generation and be reported as failure - usually followed by an attempt to shrink the
   falsified parameter set."*

## `boolean` or assertions — and why it is not a style choice

Both work. They fail differently, and the difference is the whole argument.

```java
@Property
boolean asBoolean(@ForAll String input) {
    return Slug.of(input).value().length() <= 80;
}

@Property
void asAssertion(@ForAll String input) {
    assertThat(Slug.of(input).value()).hasSizeLessThanOrEqualTo(80);
}
```

The boolean form fails with jqwik's own message — the property was falsified with such-and-such
a sample — and nothing about *why*. The assertion form fails with AssertJ's message, which
names the actual length and the expected bound, and jqwik reports that `AssertionError`
verbatim: the guide lists *"Report the relevant exception, usually a subtype of
`AssertionError`"* as the first thing failure reporting does.

Use `boolean` when the predicate is genuinely self-describing at a glance —
`return decode(encode(x)).equals(x);` — and assertions everywhere else. The rule of thumb
that survives review is: **if reading the returned expression would not tell you what went
wrong, it should be an assertion.** With a shrunk sample and a good AssertJ message you often
do not need the debugger at all; with a bare `false` you always do.

⚠️ jqwik ships no assertions of its own. The guide: *"jqwik does not come with any assertions,
so you have to use one of the third-party assertion libraries, e.g. Hamcrest or AssertJ. If
you have Jupiter in your test dependencies anyway, you can also use the static methods in
`org.junit.jupiter.api.Assertions`."* AssertJ is what the rest of this phase uses
([02 · AssertJ](../02-assertj/README.md)) and it is the right choice here for the same
reason — its failure messages carry the values.

## `@Example` is a property with one try

jqwik has its own example-test annotation, and it is not a separate mechanism:

```java
import net.jqwik.api.Example;

@Example
void theEmptyStringSlugsToTheEmptyString() {
    assertThat(Slug.of("").value()).isEmpty();
}
```

The guide is explicit about the implementation: *"Internally jqwik treats examples as
properties with the number of tries hardcoded to 1. Thus, everything that works for property
methods also works for example methods – including random generation of parameters annotated
with `@ForAll`."*

That last clause is worth pausing on. `@Example void x(@ForAll int i)` is legal and runs
**once** with one generated value — which is almost never what anyone means and is a
first-class way to write a test that passes for the wrong reason. `@Example` is for methods
with no generated parameters. If you have `@ForAll` parameters, you want `@Property`.

Whether to use `@Example` at all in a jqwik class is a real decision. Its advantage is that
your regression cases live next to the property they came from, in the same file, with the
same imports. Its disadvantage is that they now only run when the jqwik engine runs — which,
after everything in [02c3](02c3-wiring-it-into-the-build.md), is a thing you have to keep
working. Keeping regression examples in Jupiter `@ParameterizedTest` tables and properties in
jqwik is the more conservative split.

## When it fails

Falsification is where the tool earns its keep, and jqwik's output at that moment is not a
one-line message — it is a header block of a dozen key/value fields plus a shrunk sample and
the original sample, each of which answers a specific question. Learning to read it is worth
a page of its own: [03b · Reading the failure report](03b-reading-the-failure-report.md).

## Where this connects

- Whether the engine will run at all on Boot 4.1 is
  [02b · The version collision](02b-the-version-collision.md); getting it discovered by the
  build is [02c3 · Wiring it into the build](02c3-wiring-it-into-the-build.md).
- The failure report, field by field, is
  [03b · Reading the failure report](03b-reading-the-failure-report.md).
- The `@Property` attributes that change tries, seed, shrinking and generation, plus
  `@PropertyDefaults` and the extra reporting switches, are
  [03c · Attributes and defaults](03c-attributes-and-defaults.md).
- What runs before and after a property, a try, and a container is
  [03d · The jqwik lifecycle](03d-the-jqwik-lifecycle.md).
- *What* to assert — the catalogue of relations that make good properties — is
  [04 · Finding properties](04-finding-properties.md).
- Assertion style and failure messages belong to
  [02 · AssertJ](../02-assertj/README.md); the hand-written case table is
  [03 · Parameterized tests](../03-parameterized-tests/README.md).

## Gotchas

**★ A `private` property method is silently not a test.**
The guide requires public, protected or package-scoped. A `private @Property` compiles, is
never discovered, and contributes a green build. Java developers reach for `private` on
helper-looking methods by reflex, and a property that takes parameters and returns `void`
looks a lot like a helper. If a property "isn't running", check the modifier before checking
anything else.

**★ Forgetting `@ForAll` on one parameter of three does not fail the way you expect.**
jqwik does not treat an unannotated parameter as an error at discovery time; it tries to
resolve it through the parameter-resolution hook, and what you get is a resolution failure
whose message is about hooks rather than about a missing annotation. On a four-parameter
property this is genuinely hard to read. The habit that prevents it: write the annotation
first, then the type, then the name — `@ForAll String s` — as one token in your head.

**★ `@Example` with `@ForAll` parameters runs exactly once, and looks like a passing test.**
It is legal, documented and almost never what you meant. One randomly generated value, one
execution, green. Because `@Example` is implemented as a property with `tries = 1`, nothing
warns you. If you see `@ForAll` inside an `@Example`, it is a typo for `@Property` until
proven otherwise.

**★ A returned `boolean` throws away your failure message, and you only notice when it fails.**
`return a.equals(b);` gives you "falsified with sample …" and nothing about *how* `a` and `b`
differed. On a `String` of 200 characters differing at index 137, that is the difference
between a two-minute fix and a twenty-minute one. The boolean form is fine for genuinely
self-evident predicates and a false economy everywhere else.

**★ A property method returning something other than `boolean` or `void` is a discovery-time error, not a compile error.**
`@Property int somethingUseful(@ForAll int i)` compiles fine — Java has no opinion about it —
and the failure surfaces when the engine tries to interpret the return value. This bites most
often when somebody refactors a `void` property into a helper that returns a value and forgets
to remove the annotation. The two legal shapes are `boolean` and `void`, and there is no third.

**★ Naming a property after the implementation instead of the law is how a property suite stops being readable.**
`testSlugOf` tells the next reader nothing; `slugsAreIdempotent` tells them the law and can be
checked against the specification without opening the body. This matters more here than for
example tests, because a property has no expected value to fall back on — the name is the only
statement of intent in the file. jqwik helps: underscores in identifiers are rendered as
spaces in reports, so `a_slug_never_starts_or_ends_with_a_dash` reads as a sentence with no
annotation at all.

## Interview questions

**★ Walk me through everything that happens when jqwik runs one `@Property` method.**
Discovery first: the engine, registered through `ServiceLoader`, scans the classes the build
handed it, finds methods annotated `@Property`, and builds a descriptor for each — a property
is a container with 1..n tries beneath it. Then, for each try, it asks each `@ForAll`
parameter's arbitrary for a value, using a random source seeded from either the property's
`seed` attribute, the previous run's recorded seed, or a fresh random seed, and deliberately
mixing in edge cases rather than sampling uniformly. It invokes the method; a returned `false`
or a thrown `AssertionError` falsifies it. On falsification, generation stops immediately and
shrinking starts — jqwik searches for a smaller input that still fails, bounded to ten seconds
by default. Finally it reports: the exception, the header block with `tries`, `checks`,
`generation`, `seed` and edge-case counts, then the shrunk sample and the original sample, and
it records the failure in `.jqwik-database` so the next run replays it.

**★ When would you return a `boolean` from a property and when would you assert?**
Return a `boolean` when the expression *is* the specification and reads as one:
`return decode(encode(x)).equals(x);` or `return Math.abs(n) >= 0;`. The reader gets the law in
one line and the failure message adds nothing they do not already have. Assert whenever the
failure needs values in it — a length, an index, a difference, an element that should not have
been in a collection — because jqwik reports the `AssertionError` verbatim and AssertJ's
messages carry that information, whereas a `false` carries none of it. The practical test I
apply in review: cover the sample values in the report and ask whether the reader could still
say what went wrong. If not, it should have been an assertion.

**★ Your property takes a `List<Integer>` and calls `Collections.sort` on it. What is wrong, and what would you write instead?**
Two things, one of which is a bug in the test and one of which is a bug in the report. The
test bug is that you are mutating a value the framework owns; jqwik generated it, may reuse
structures across tries, and certainly did not promise you a mutable list you may destroy —
several arbitraries can hand back immutable or view-backed collections, so the sort may throw
`UnsupportedOperationException` on some inputs and not others, which reads as flakiness. The
report bug is documented: samples are printed after the property method has run, so the report
shows the *sorted* list, and pasting that value into a regression test will not reproduce the
failure, because sorting is idempotent. The fix is one line —
`List<Integer> working = new ArrayList<>(input);` — and then assert on `working`. As a general
rule, treat every `@ForAll` parameter as immutable input.

{/* FOOTER */}
