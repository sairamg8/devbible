---
title: "If the engine will not run you can still use jqwik's arbitraries as a plain generator library inside ordinary Jupiter tests, which keeps the inputs you did not choose and gives up shrinking, seeds and the report — a real fallback and a genuine downgrade, and you should write down both halves of that sentence"
sidebar_label: "02c2 · jqwik without its engine"
sidebar_position: 7
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, section *Using Arbitraries
> Directly* ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)), for
> `Arbitrary.sample()`, `sampleStream()`, `allValues()`, `forEachValue()` and the
> `JqwikSession` API; and against **Maven Central** for `net.jqwik:jqwik-spring`'s
> `maven-metadata.xml` and `jqwik-spring-0.12.0.pom`
> ([repo1.maven.org](https://repo1.maven.org/maven2/net/jqwik/jqwik-spring/)).
> Version spine: JDK 25, Spring Boot 4.1.1, Spring Framework 7.0.9, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7.
> ⚠️ **No sandbox and no test run on this machine** — Java source and documented behaviour
> only.

**[02c](02c-what-to-do-about-it.md) covered the three options that keep `@Property`: prove
it, isolate the module, or (do not) downgrade. This chunk is the fallback for when none of
those is available — jqwik's arbitraries are ordinary objects and the guide documents using
them outside the engine entirely, from an ordinary Jupiter `@Test`. It works. It also throws
away shrinking, seed reproducibility and the report block, which is most of what
distinguishes property-based testing from a `for` loop over random numbers. This page shows
the code, states precisely what is lost, and closes off the two things people suggest
instead.**

## Using jqwik as a generator library, without its engine

If the engine will not run and you cannot split the build, you can still have the
generators. jqwik's arbitraries are ordinary objects and the guide documents using them
outside a property:

> *"Getting a single random value out of an arbitrary is easy and can be done with
> `Arbitrary.sample()` … Among other things, this allows you to use jqwik's generation
> functionality with other test engines like Jupiter."*

```java
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.sessions.JqwikSession;
import org.junit.jupiter.api.Test;

class BillGeneratedDataTests {                 // an ordinary Jupiter test

    @Test
    void sharesAddUpToTheTotal() {
        Arbitrary<BigDecimal> totals = Arbitraries.bigDecimals()
                .between(BigDecimal.ZERO, new BigDecimal("10000"))
                .ofScale(2);
        Arbitrary<Integer> ways = Arbitraries.integers().between(1, 20);

        JqwikSession.run(() -> {
            totals.sampleStream().limit(200).forEach(total -> {
                int n = ways.sample();
                BigDecimal sum = Bill.split(total, n).stream()
                        .reduce(BigDecimal.ZERO, BigDecimal::add);
                assertThat(sum)
                        .as("total=%s ways=%s", total, n)
                        .isEqualByComparingTo(total);
            });
        });
    }
}
```

`JqwikSession` is not optional decoration here. The guide is explicit that generators are
cached and some *"require some data persistence across generation iterations"*, that this
memory is *"never released, because jqwik cannot know, if you're done with using a specific
generator or not"*, and that `JqwikSession` exists *"to simulate a small part of jqwik's
property lifecycle"*, with `JqwikSession.run(Runnable)` wrapping code in implicit `start()`
and `finish()`. The API is marked experimental in the guide and there is *"currently no way
to use nested sessions, spread the same session across threads or use more than one session
concurrently"* — so do not reach for it in a parallel Jupiter suite.

Be clear-eyed about what this loses, because it is most of the value:

| | Engine mode (`@Property`) | Generator-only mode |
|---|---|---|
| Shrinking to a minimal failing case | Yes | **No** — you get whatever value failed |
| Seed reported and reused after failure | Yes | Only if you pass one to `JqwikSession.start(String)` |
| Falsified sample remembered across runs | Yes, via `.jqwik-database` | No |
| Edge cases mixed in deliberately | Yes | Yes — arbitraries still carry edge cases |
| Exhaustive generation when the space is small | Yes | No |
| Failure message names the parameter | Yes | Only what your `as(...)` says |

The missing row that hurts most is shrinking. A Jupiter test that fails on
`total = 7823.41, ways = 17` tells you far less than a jqwik report that shrinks it to
`total = 0.01, ways = 3` — see [06 · Shrinking](06-shrinking.md). Treat this option as a
degraded mode you adopt knowingly, not as an equivalent.

⚠️ Note the residual risk: `jqwik-api` itself declares `junit-platform-commons:1.14.4` at
compile scope, so generator-only mode does **not** escape the version question entirely. It
escapes the *engine* question, which is the larger surface — `jqwik-api` uses
`AnnotationSupport`, `ReflectionSupport` and `Try` and nothing from the engine SPI — but
"escapes it entirely" would be a stronger claim than the evidence supports.

## jqwik-spring is not available on this stack

For completeness, because somebody will suggest it. `net.jqwik:jqwik-spring` is a real
project that provides a jqwik-side equivalent of `SpringExtension`. Its latest published
version on Maven Central is **0.12.0**; the artifact's `maven-metadata.xml` records a
last-updated timestamp in January 2024, and `jqwik-spring-0.12.0.pom` depends on
`net.jqwik:jqwik:1.8.2`. The project's own compatibility table tops out at Spring Framework
**6.1.0** and Spring Boot **3.2.0**. Against Framework 7.0.8 and Boot 4.1.0 that is a major
version behind on the thing it integrates with, on top of every Platform problem the other
options have. It is not a route.

## What I could not settle: is there an alternative library?

I could **not** confirm a maintained property-based testing library for Java that targets
the JUnit Platform 6 line. The candidates people name — `junit-quickcheck`, QuickTheories,
Vavr's test module — are either JUnit 4-based or long dormant, and I am not going to assert
a maintenance status from a blog post. If you need this on Boot 4 and option 0 fails, the
honest shortlist is option 1 (isolate the module) and option 3 (generators only), and the
research task of "is there a Platform 6 native library" is one to do yourself against Maven
Central release dates rather than to take from this page.

## Where this connects

- The three options that keep `@Property` working are
  [02c · What to do about it](02c-what-to-do-about-it.md).
- The build wiring both modes need is
  [02c3 · Wiring it into the build](02c3-wiring-it-into-the-build.md).
- The arbitraries this page calls `sample()` on are the subject of
  [05 · Generators](05-generators.md) and
  [05b · Constraining generation](05b-constraining-generation.md).
- What shrinking actually does for you, and therefore what this mode gives up, is
  [06 · Shrinking](06-shrinking.md); the seed machinery is
  [07 · Reproducibility](07-reproducibility.md).

## Gotchas

**★ Generator-only mode without `JqwikSession` leaks, and the leak is documented rather than theoretical.**
The guide states that generators are cached, that some require persistence across iterations,
and that *"all this data will fill up your heap space and never be released"* outside a
session. In a suite with a handful of such tests you may never notice; in one with hundreds,
you have introduced a memory profile nobody attributes to a test library. `JqwikSession.run`
is one line and there is no reason to skip it.

**★ `Arbitrary.sample()` outside a property uses a fresh `Random` you did not choose, so a generator-only failure is not reproducible unless you seed the session.**
The guide notes that the `Random` is *"either taken from the current property's context or
freshly instantiated if used outside a property"*. Freshly instantiated means the failing
values are gone the moment the JVM exits. `JqwikSession.start(String randomSeed)` and
`JqwikSession.run(String randomSeed, Runnable)` exist precisely for this; if you use option 3
at all, use the seeded form and log the seed, or you have built a flaky test with no forensic
trail.

**★ Option 3 changes the failure semantics: one bad value ends the loop, and you learn nothing about the rest.**
`sampleStream().limit(200).forEach(...)` throws on the first assertion failure, so you see one
failing value out of two hundred and no information about whether it is an isolated case or
half the range. The engine's report distinguishes `tries` from `checks` and shrinks toward a
boundary, which usually tells you the shape of the defect. If you are stuck in generator-only
mode, consider collecting failures into a list and asserting on the list at the end, so at
least the failure message shows you several.

**★ The comparison table above is a checklist for a decision record, not a reason to avoid option 3.**
Generated data with no shrinking still finds the `100.00 / 3` class of defect — finding it is
the hard part; minimising it is a convenience. A team that writes off option 3 because it
lacks shrinking has thrown away most of the benefit to avoid losing some of it. Write the
decision down with the table, adopt option 3 knowingly, and revisit if a Platform 6 jqwik
ever ships.

**★ Generator-only mode is a `for` loop with a good distribution, and calling it "property-based testing" in a design document will mislead the next reader.**
The distribution is the part worth having — arbitraries mix in edge cases, respect
constraints and compose — and it is genuinely most of the bug-finding power. But a reader who
sees "we do property-based testing" will assume minimal counter-examples, reproducible seeds
and a `tries`/`checks` report, none of which exist here. Name it accurately in the decision
record: *generated-input testing without shrinking*. The accuracy costs one line and saves a
misunderstanding in six months.

**★ `Arbitrary.allValues()` returns an `Optional` and returns empty rather than failing when exhaustive generation is impossible.**
The guide is explicit that the return type is `Optional<Stream<T>>` *"because jqwik can only
perform this task if exhaustive generation is doable"*. A caller that writes
`arbitrary.allValues().get().forEach(...)` gets a `NoSuchElementException` from the
`Optional`, which reads like a bug in your test rather than "this arbitrary cannot be
enumerated". `forEachValue(Consumer)` has the same precondition and the guide says that in
other cases *"the attempt to iterate will result in an exception"*. If you use either, handle
the not-enumerable case explicitly.

## Interview questions

**★ What exactly do you lose by using `Arbitrary.sample()` inside a Jupiter test instead of writing a `@Property`?**
Shrinking, reproducibility and reporting, in that order of importance. Shrinking is the big
one: the engine narrows a failing case down to a minimal one, so instead of "it broke on
`total = 7823.41, ways = 17`" you get "it broke on `total = 0.01, ways = 3`", which usually
names the defect outright. Reproducibility goes because a bare `sample()` call outside a
property builds a fresh `Random`, so the failing values vanish on exit unless you use
`JqwikSession.start(seed)`; the engine reports a seed on every run and, by default, reuses the
failing sample next time. Reporting goes because the engine's block tells you `tries` versus
`checks` — how many generated values were actually accepted after assumptions — and your
hand-rolled loop tells you nothing. What you keep is the thing that finds bugs: a distribution
that is engineered to include edge cases, and a hundred inputs you did not choose. It is a
real fallback and a genuine downgrade, and I would write both halves of that sentence in the
decision record.

**★ A colleague proposes `net.jqwik:jqwik-spring` so the team can write properties against Spring beans. What do you say?**
That I checked the version before answering, and it does not reach this stack. The latest
published `net.jqwik:jqwik-spring` on Maven Central is 0.12.0, its `maven-metadata.xml`
records a last-updated stamp in January 2024, its POM depends on `net.jqwik:jqwik:1.8.2`, and
its own compatibility table tops out at Spring Framework 6.1.0 and Spring Boot 3.2.0. We are
on Framework 7.0.8 and Boot 4.1.0 — a major version ahead of the newest thing it claims to
integrate with, on top of every JUnit Platform question the plain library already has. Beyond
the version, I would push back on the goal: a property that needs a Spring context is almost
always a property about logic that should have been extracted from the bean, and extracting
it is both cheaper than this dependency and a better outcome.

**★ How would you decide, six months from now, whether to move off the generator-only fallback?**
Two triggers, and I would write both into the decision record so the review is scheduled
rather than remembered. First: a jqwik release built on JUnit Platform 6 — at which point the
fallback becomes unnecessary and the migration is mechanical, since the arbitraries and the
`@Provide` methods are the same objects either way; only the test method shape changes.
Second: evidence that the missing shrinking is actually costing us — specifically, a count of
how many times somebody had to hand-minimise a failing generated value to understand a
defect. If that number is zero after six months, the fallback is fine and the migration is
not urgent. If it is five, that is five debugging sessions the engine would have shortened,
and it justifies the module split that option 1 wanted in the first place.

{/* FOOTER */}
