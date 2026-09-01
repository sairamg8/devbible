---
title: "Property-based testing: an example test checks the cases you thought of, which is a statement about your imagination rather than about your code — and the whole technique is the attempt to state what must be true for every input instead, which is harder to write, catches a different class of bug, and is worth doing to a surprisingly small fraction of any codebase"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 to 2026-09-01 against the **jqwik 1.10.1 user guide** and javadoc
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)) — the sections on properties,
> arbitraries, combinators, recursion, shrinking, reproducibility, edge cases, statistics and
> configuration; the **JUnit 5 / Jupiter** platform documentation for the engine question; the
> **JDK 25 javadoc** for `java.util.Comparator`, `java.util.List.sort` and `java.math.BigDecimal`;
> and Maven Central for the version facts.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring
> Framework 7.0.8, **JUnit Jupiter 6.0.3**, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox, no Docker and no build on this machine.** Every chunk carries Java source and
> documented behaviour. **There is no run output anywhere in this topic** — no seeds from a real
> failure, no timings, no suite durations. The two report blocks that appear are reproduced from
> the guide's own published examples and labelled as such.

**An example-based test asserts that `add(2, 2)` is `4`. It is a fact about one input, chosen by
a person, and the person chose it because they had already thought of it. Property-based testing
asks a different question — *what is true for every input?* — and then has a machine look for a
counter-example. The gap between those two questions is where a specific class of bug lives: the
empty list, the duplicate key, the amount that does not divide evenly, the string containing the
delimiter, the hour that happens twice. This topic is about writing that second kind of test in
Java with jqwik, and — equally — about recognising the majority of code where the attempt
produces a test that cannot fail.**

**40 chunks, ~9,469 lines, 389 gotchas and interview questions.**

## Three things that shape the whole topic

1. 🔴 **jqwik is a JUnit Platform *engine*, not a Jupiter extension.** It does not run inside
   Jupiter — it runs beside it, and on a Boot 4.1 project that resolves **Jupiter 6.0.3** the
   version relationship is the first thing to establish, not the last. Chunks `02` through `02c4`
   are about that, and about what to do if the versions do not line up.
2. 🔴 **Shrinking is what makes the technique usable.** A randomly generated counter-example is
   too large to read; the minimal one is a bug report. jqwik's *integrated* shrinking simplifies
   the generator rather than the value, which is why it keeps working through `filter`, `map` and
   `combine` where type-based shrinking gives up.
3. 🔴 **The generator decides what the test proves.** Defaults you did not choose — string
   alphabets, collection sizes, `null` never being generated — silently bound the input space, and
   a property is only ever as good as the distribution behind it.

## The chunks

### Getting it running

| # | Chunk | What it argues |
|---|---|---|
| 01 | [The case you did not think of](01-the-case-you-did-not-think-of.md) | Example tests test your imagination |
| 01b | [What a table cannot contain](01b-what-a-table-cannot-contain.md) | Where parameterized tests stop |
| 02 | [An engine, not an extension](02-the-stack-problem.md) | jqwik's relationship to the JUnit Platform |
| 02b | [The version collision](02b-the-version-collision.md) | jqwik 1.10.1 against Jupiter 6.0.3 |
| 02b2 | [What the evidence shows](02b2-what-the-evidence-shows.md) | What the published facts actually settle |
| 02c | [What to do about it](02c-what-to-do-about-it.md) | The options, ranked |
| 02c2 | [jqwik without its engine](02c2-jqwik-without-its-engine.md) | Using the generators alone |
| 02c3 | [Wiring it into the build](02c3-wiring-it-into-the-build.md) | Maven and Gradle |
| 02c4 | [The configuration surface](02c4-jqwiks-configuration-surface.md) | `junit-platform.properties`, key by key |

### Writing properties

| # | Chunk | What it argues |
|---|---|---|
| 03 | [Writing a property](03-a-property.md) | `@Property`, `@ForAll`, and the first real one |
| 03b | [Reading the failure report](03b-reading-the-failure-report.md) | `tries` vs `checks`, and the two sample blocks |
| 03c | [Attributes and defaults](03c-attributes-and-defaults.md) | Every `@Property` attribute and its default |
| 03d | [The jqwik lifecycle](03d-the-jqwik-lifecycle.md) | Per-try and per-property hooks |
| 04 | [Finding properties](04-finding-properties.md) | The catalogue of law shapes |
| 04b | [Invariants and order-independence](04b-invariants-and-order-independence.md) | The two that apply most often |
| 04c | [When no law is obvious](04c-when-no-law-is-obvious.md) | A decision procedure, and when to stop |
| 04d | [Models and oracles](04d-models-and-oracles.md) | Checking against an obviously correct version |
| 04e | [Metamorphic relations and contract tests](04e-metamorphic-and-contract-tests.md) | Laws that relate two runs |

### Generators

| # | Chunk | What it argues |
|---|---|---|
| 05 | [Generators](05-generators.md) | Built-in arbitraries and `@Provide` |
| 05a | [The defaults nobody chooses](05a-the-defaults-you-inherit.md) | What the built-ins quietly decide for you |
| 05b | [Constraining generation](05b-constraining-generation.md) | Ranges, sizes, alphabets |
| 05b2 | [Filtering, assumptions and discards](05b2-filtering-assumptions-and-discards.md) | `maxDiscardRatio`, and why filtering is a last resort |
| 05c | [Composing arbitraries](05c-composing-arbitraries.md) | `Combinators.combine` |
| 05c2 | [Builders and optional parts](05c2-builders-and-optional-parts.md) | Aggregates with optional fields |
| 05c3 | [Dependent generation](05c3-dependent-generation.md) | `flatMap`, and its cost to shrinking |
| 05c4 | [A generator for an aggregate](05c4-a-generator-for-an-aggregate.md) | A realistic domain object end to end |
| 05c5 | [Choice among arbitraries](05c5-choosing-among-arbitraries.md) | `oneOf`, `frequency`, and shrink order |
| 05c6 | [Recursive arbitraries](05c6-recursive-arbitraries.md) | `lazy`, `lazyOf`, `recursive` — two different stack overflows |
| 05c7 | [A recursive generator you would actually write](05c7-a-recursive-generator-you-would-actually-write.md) | A bounded JSON tree, and why every number in it matters |

### When it fails

| # | Chunk | What it argues |
|---|---|---|
| 06 | [Shrinking](06-shrinking.md) | Integrated shrinking, and which way each generator shrinks |
| 06b | [What shrinking costs you](06b-what-shrinking-costs-you.md) | Every candidate re-runs your property |
| 06c | [Controlling the shrinker](06c-controlling-the-shrinker.md) | `ShrinkingMode`, the bound, `shrinkTowards` |
| 07 | [Reproducibility](07-reproducibility.md) | The seed, and the one condition under which it stops working |
| 07b | [The failure database](07b-the-failure-database.md) | `.jqwik-database`, and why CI behaves differently |
| 08 | [Edge cases, exhaustive generation and data](08-edge-cases-exhaustive-and-data.md) | Pinning a case; when generation is unnecessary |
| 09 | [Statistics: what did it actually generate?](09-statistics.md) | Checking the distribution you assumed |

### The verdict

| # | Chunk | What it argues |
|---|---|---|
| 10 | [Where it pays](10-where-it-pays.md) | Round trips, money, dates, escaping |
| 10b | [Where it pays: ordering and state](10b-where-it-pays-ordering-and-state.md) | Comparators, caches, reference implementations, state machines |
| 11 | [Where it does not pay](11-where-it-does-not-pay.md) | 🔴 The tautological property, and six places to stop |
| 12 | [The cost](12-the-cost.md) | The bill, itemised, and the levers in the right order |

## The four things this topic is really about

1. **A property is a claim you can finish without exceptions.** *"For every input, …"* — if the
   honest version of that sentence needs "except for gold customers in their first ninety days",
   it is business policy and belongs in a table of examples. This one test decides more than any
   API detail in the topic.
2. **Shrinking is the feature, not the generation.** Generation finds the bug; shrinking is what
   makes the finding actionable. A tool that found the same bugs and reported the raw random
   input would not survive contact with a real team.
3. **The defaults decide what you proved.** String alphabets, collection sizes, numeric ranges,
   `null` never appearing, `Arbitraries.of` argument order doubling as shrink order — none of
   these is visible in the property, and all of them bound what it checked.
4. 🔴 **The failure mode is a test that cannot fail.** A property whose assertion recomputes the
   implementation passes forever, costs a thousand executions per build, shows as covered, and is
   indistinguishable in review from the good ones. More of this topic is spent guarding against
   that than teaching the API.

## Where it sits in the phase

- **[03 · Parameterized tests](../03-parameterized-tests/README.md)** owns the hand-written table
  of cases. This topic is the argument for the cases that are not in it — and, in `11`, the
  argument for going back to the table.
- **[09 · Coverage with JaCoCo](../09-jacoco/README.md)** can prove code never ran. It cannot
  prove a *combination* of inputs was never walked, which is the blindness generated inputs
  attack.
- [11 · Mutation testing](../11-mutation-testing/README.md) attacks the same blindness from
  the other side — it changes the code and asks whether a test notices. It is also the only
  reliable way to detect the tautological property this topic warns about.

## Two things the documentation could not settle — flagged in-page, not invented

1. **The `BOUNDED` shrinking limit** is documented as **10 seconds** in the `@Property` attribute
   reference and in `jqwik.shrinking.bounded.seconds`, and as **1000 steps** in the message the
   guide tells you to look for. Both are recorded in
   [06c](06c-controlling-the-shrinker.md), which tells the reader to act on the message text
   rather than on the unit.
2. **The after-failure default** is given as `PREVIOUS_SEED` in the guide's prose and in one
   published report header, and as `SAMPLE_FIRST` in the attribute reference, the configuration
   file and a second header. [07b](07b-the-failure-database.md) says so and tells the reader to
   read the `after-failure` line in their own report.

{/* FOOTER */}
