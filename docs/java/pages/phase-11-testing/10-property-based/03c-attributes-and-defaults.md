---
title: "@Property carries eight attributes that between them decide how many inputs a property sees, whether it can find the smallest failing one, and whether it is reproducible — and because @PropertyDefaults, the configuration file and the annotation form a five-level precedence chain, the effective value is frequently not the one anyone wrote"
sidebar_label: "03c · Attributes and defaults"
sidebar_position: 12
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *Optional @Property
> Attributes*, *Setting Defaults for @Property Attributes*, *Additional Reporting Options*,
> *Platform Reporting with Reporter Object*, *Adding Footnotes to Failure Reports* and
> *jqwik Configuration* ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine** — documented attribute semantics and
> defaults only.

**`@Property` is not a marker annotation. It has eight attributes, six of them enums, and
each one moves a dial that matters: how many inputs the property sees, whether it enumerates
or samples, whether it can shrink, and whether the failure can be reproduced tomorrow. Worse
— or better, once you know it — every one of them has a default that can be overridden in a
configuration file, overridden again by a `@PropertyDefaults` on the class, overridden again
by one on a superclass, and overridden a final time on the method. So the value in force is
rarely the value anyone wrote down, and jqwik prints the effective values after every run
precisely because of that.**

## The eight attributes

| Attribute | Type | Default | What it does |
|---|---|---|---|
| `tries` | `int` | **1000** | How many parameter sets to generate. *"The default is 1000 which can be overridden in `junit-platform.properties`."* |
| `seed` | `String` | random | The random seed. *"If you do not specify a value jqwik will use a random random seed. The actual seed used is being reported by each run property."* |
| `whenFixedSeed` | `FixedSeedMode` | `ALLOW` | What to do when `seed` is set: `ALLOW` uses it, `WARN` logs, `FAIL` fails the property. *"This can be useful to prevent accidental commits of fixed seeds into source control."* |
| `maxDiscardRatio` | `int` | **5** | The maximum ratio of tried to actually-checked runs when using assumptions. *"If the ratio is exceeded jqwik will report this property as a failure."* |
| `shrinking` | `ShrinkingMode` | `BOUNDED` | `OFF`, `FULL`, or `BOUNDED` — *"Shrinking is tried for 10 seconds maximum and then times out."* |
| `generation` | `GenerationMode` | `AUTO` | `AUTO`, `RANDOMIZED`, `EXHAUSTIVE`, `DATA_DRIVEN`. |
| `afterFailure` | `AfterFailureMode` | `SAMPLE_FIRST` | `SAMPLE_FIRST`, `SAMPLE_ONLY`, `PREVIOUS_SEED`, `RANDOM_SEED`. |
| `edgeCases` | `EdgeCasesMode` | `MIXIN` | `MIXIN`, `FIRST`, `NONE`. |

Four of these get a chunk of their own because the argument matters more than the syntax:
`shrinking` is [06 · Shrinking](06-shrinking.md); `seed`, `whenFixedSeed` and `afterFailure`
are [07 · Reproducibility](07-reproducibility.md); `generation` and `edgeCases` are
[08 · Edge cases, exhaustive generation and data](08-edge-cases-exhaustive-and-data.md);
`maxDiscardRatio` is [05b · Constraining generation](05b-constraining-generation.md). What
follows here is the part that is genuinely about the annotation.

## `generation = AUTO` does something clever, and it changes what a green build means

The default is worth understanding because it silently changes the *epistemic status* of a
passing property. The guide:

> *"`GenerationMode.AUTO` is the default. This will choose exhaustive generation whenever this
> is deemed sensible, i.e., when the maximum number of generated values is equal or less thant
> the configured `tries` attribute."*

So a property over `@ForAll @IntRange(min = 1, max = 12) int month` — twelve possible values,
well under 1000 tries — is not sampled at all. jqwik enumerates all twelve. That property is
not "probably true"; over that domain it is **proved**. The `generation` field in the report
tells you which happened, and the difference between `RANDOMIZED` and `EXHAUSTIVE` is the
difference between evidence and proof.

The trap is the other direction. Add one `@ForAll boolean` parameter to that property and the
space is 24 — still exhaustive. Add an unconstrained `@ForAll String` and the space is
effectively infinite, generation silently falls back to `RANDOMIZED`, and a property that used
to be a proof is now a sample. Nothing about that change is announced except the one word in
the report.

## `@PropertyDefaults` and the five-level precedence chain

```java
import net.jqwik.api.*;

@PropertyDefaults(tries = 200, shrinking = ShrinkingMode.FULL)
class MoneyPropertyTests {

    @Property                                  // tries = 200, shrinking = FULL
    void sharesAddUpToTheTotal(@ForAll BigDecimal total) { }

    @Property(tries = 5_000)                   // tries = 5000, shrinking = FULL
    void roundingIsNeverBiased(@ForAll BigDecimal amount) { }
}
```

The guide states the resolution order exactly, and it is five levels deep:

> *"Use jqwik's built-in defaults, which can be overridden in the configuration file, which
> can be changed in a container class' `@PropertyDefaults` annotation, which override
> `@PropertyDefaults` attributes in a container's superclass or implemented interfaces, which
> can be overridden by a method's `@Property` annotation attributes."*

Read the third and fourth levels together, because they are the surprising pair: a
`@PropertyDefaults` on a **subclass** wins over one on its superclass, which is the opposite
of how annotation inheritance behaves in several other frameworks. A shared abstract base for
property tests — a perfectly reasonable thing to write — is therefore the weakest place to put
a default, not the strongest.

`@PropertyDefaults` also applies to `@Group`s nested inside the class, so a class-level
`tries = 10` quietly governs every group in the file.

## `@Report`, the `Reporter`, and footnotes — three different reporting mechanisms

They are genuinely different and people reach for the wrong one.

**`@Report(Reporting.GENERATED)` / `@Report(Reporting.FALSIFIED)`** is a debugging switch on a
property. `GENERATED` prints every generated parameter set; `FALSIFIED` prints every set
falsified during shrinking. The guide notes an important difference from sample reporting:
*"Unlike sample reporting these reports will show the freshly generated parameters, i.e.
potential changes to mutable objects during property execution cannot be seen here."* That
makes `@Report(Reporting.GENERATED)` the correct tool for the mutable-input problem in
[03b](03b-reading-the-failure-report.md) — it shows you what the arbitrary actually produced.
It also prints a thousand lines, so it is a temporary annotation, never a committed one.

**The `Reporter` parameter** is the platform mechanism. Inject `net.jqwik.api.Reporter` into
a property method and call `publishReport(key, value)` or `publishValue(key, String)`:

```java
import net.jqwik.api.*;

@Property
void ratesAreMonotonic(Reporter reporter, @ForAll @IntRange(min = 0, max = 120) int months) {
    reporter.publishValue("months", Integer.toString(months));
    // ...
}
```

The guide's reason for preferring it to `System.out.println` is that these pairs *"will not
only printed to stdout but are also available to downstream tools like test report generators
in continue integration"*. Note that `Reporter` is **not** annotated `@ForAll` — it is one of
the non-generated parameters jqwik resolves for you.

**Footnotes** are the one to reach for when the extra information is only interesting on
failure, and they must be switched on:

```java
import net.jqwik.api.*;
import net.jqwik.api.footnotes.*;

@EnableFootnotes
class DifferenceProperties {

    @Property
    void differenceShouldBeBelow42(@ForAll int a, @ForAll int b, Footnotes footnotes) {
        int difference = Math.abs(a - b);
        footnotes.addFootnote(Integer.toString(difference));
        assertThat(difference).isLessThan(42);
    }
}
```

The footnote text becomes part of the sample report, for both the shrunk and the original
sample. For anything expensive to compute there is `Footnotes.addAfterFailure(Supplier<String>)`,
and the guide is careful about what that buys you: *"Those suppliers will only be evaluated if
the property fails, and then as early as possible. Mind that this evaluation can still happen
quite often during shrinking."* — so "only on failure" does not mean "once".

⚠️ `@EnableFootnotes` is mandatory. Without it, a `Footnotes` parameter is not resolved and the
property fails for a reason that has nothing to do with the code under test.

## Where this connects

- The method these attributes decorate is [03 · Writing a property](03-a-property.md); the
  report that prints their effective values is
  [03b · Reading the failure report](03b-reading-the-failure-report.md).
- `shrinking` in full is [06 · Shrinking](06-shrinking.md); `seed`, `whenFixedSeed` and
  `afterFailure` are [07 · Reproducibility](07-reproducibility.md); `generation` and
  `edgeCases` are
  [08 · Edge cases, exhaustive generation and data](08-edge-cases-exhaustive-and-data.md);
  `maxDiscardRatio` is [05b · Constraining generation](05b-constraining-generation.md).
- The configuration file that sets every default is
  [02c4 · The configuration surface](02c4-jqwiks-configuration-surface.md).
- `tries` as the main lever on suite runtime is [12 · The cost](12-the-cost.md).

## Gotchas

**★ `tries` is a ceiling on generated parameter sets, not a promise, and three separate things lower it.**
Falsification stops generation immediately, so a failing property reports fewer tries than you
set. Exhaustive generation stops when the space is exhausted, so a property over an enum with
five constants reports `tries = 5` however large the attribute is. And data-driven properties
are limited by the size of the data table. A `tries` value in an annotation is an upper bound;
the `tries` field in the report is what happened.

**★ A `@PropertyDefaults` on a shared abstract test base is the weakest place you can put a setting, not the strongest.**
The documented order puts a container's own `@PropertyDefaults` *above* the one on its
superclass or implemented interfaces. So a base class saying `tries = 10_000` for a nightly
suite is overridden by any subclass that has its own `@PropertyDefaults` for an entirely
unrelated reason — say `shrinking = FULL` — because the subclass annotation supplies defaults
for every attribute, not only the one it mentions. If you rely on a base-class default, do not
put `@PropertyDefaults` on the subclasses at all.

**★ `@PropertyDefaults` reaches into `@Group`s, which is easy to forget when a file grows.**
The guide says the annotation sets defaults *"for all property methods in a container class
(and all the groups in it)"*. A `tries = 10` added at the top of a file to make one slow
property bearable during development quietly applies to the twelve properties in the three
nested groups below it, and stays applied after the commit. Prefer the method-level attribute
for a temporary change.

**★ `generation = AUTO` can silently downgrade a proof to a sample when somebody adds a parameter.**
A property over two small enums is enumerated exhaustively and is therefore true over its
whole domain. Add a `@ForAll String` and it becomes a random sample of an infinite space, with
no warning, no annotation change, and no diff that mentions generation. The only evidence is
the word `RANDOMIZED` appearing where `EXHAUSTIVE` used to be. If exhaustiveness is what you
are relying on, set `generation = GenerationMode.EXHAUSTIVE` explicitly — the guide says jqwik
will then *"throw an exception if in exhaustive mode"* when it cannot enumerate, which turns a
silent downgrade into a build failure.

**★ `@Report(Reporting.GENERATED)` on a 1000-try property produces 1000 report blocks and will be committed by accident.**
It is a debugging annotation with the ergonomics of a permanent one — nothing about it fails,
and the only symptom is a CI log ten times its normal size. Pair it with a lowered `tries` when
you add it, and grep for `@Report(` before opening the PR.

**★ `Footnotes` without `@EnableFootnotes` fails the property, and the failure is about parameter resolution rather than about your code.**
The guide states the annotation *"must be explicitly enabled"* and can go on the container or
the method. Because the symptom is a resolution error, it reads like the "forgot `@ForAll`"
failure from [03](03-a-property.md), and people chase the wrong annotation. If a parameter type
is `Footnotes`, check the class for `@EnableFootnotes` first.

**★ `addAfterFailure(Supplier)` is evaluated repeatedly during shrinking, so "expensive but only on failure" can still be expensive.**
The guide says so explicitly. A supplier that formats a large object graph, or queries
something, runs once per shrinking step — and bounded shrinking runs for up to ten seconds by
default. If the computation is genuinely heavy, cap it yourself rather than assuming failure
means "once".

**★ `Reporter` is a resolved parameter, not a generated one, so it must not be annotated `@ForAll` — and putting it last is a readability convention, not a rule.**
jqwik resolves `Reporter` and `Footnotes` through the parameter-resolution hook. Annotating
either with `@ForAll` asks jqwik to *generate* a `Reporter`, which it cannot do, and the error
message talks about missing arbitraries. Conventionally these go first or last in the
signature; what matters is that they carry no annotation.

## Interview questions

**★ A property in your codebase is annotated `@Property(tries = 10)`. What questions do you ask?**
Why ten, and against what baseline. The default is 1000, so somebody dropped it by two orders
of magnitude, and the two honest reasons are very different. If the property is genuinely
expensive — it builds a large structure, or the code under test is slow — then ten is a
deliberate trade and should carry a comment, and the property probably belongs in a nightly
job with a higher value rather than in the per-commit build with a token one. If it was
lowered while debugging and never restored, the property is now sampling ten inputs out of an
infinite space and is close to decorative. The third question is whether the number is even in
force: a class-level `@PropertyDefaults` or `jqwik.tries.default` in `junit-platform.properties`
may be setting something else for everything around it, and the report's `tries` field is the
only authority.

**★ Explain the precedence order for `@Property` attributes, and name the level that surprises people.**
Five levels, lowest to highest: jqwik's built-in defaults; `junit-platform.properties`;
`@PropertyDefaults` on the container class; `@PropertyDefaults` on a superclass or implemented
interface; and the method's own `@Property` attributes. The surprising one is the pair in the
middle — the container's own `@PropertyDefaults` *overrides* the superclass's, so inheritance
runs the way you would want for configuration and the opposite way from how people expect
annotations to be "inherited". The practical consequence is that a shared abstract base for
property tests is the weakest place to configure anything, and any subclass that adds
`@PropertyDefaults` for one attribute silently supplies defaults for all of them.

**★ When would you set `generation = GenerationMode.EXHAUSTIVE` explicitly rather than leaving it on `AUTO`?**
When exhaustiveness is part of the claim I am making, rather than an accident of the current
parameter list. If the property is "every enum constant round-trips through the serialiser",
the value of that test is that it covers *all* of them, and `AUTO` gives me that today and
silently stops giving it the moment somebody adds a parameter whose space is unbounded. Setting
it explicitly converts that silent downgrade into a build failure, because the guide says
jqwik will throw when it cannot do exhaustive generation in exhaustive mode. The cost is that
the failure is at test time rather than review time, and that some legitimate widening of the
property now forces a conversation — which is exactly the conversation you want to have.

**★ You want to know why a property is failing but the shrunk sample looks unremarkable. What is in your toolbox?**
Three tools, in increasing order of noise. Footnotes first: `@EnableFootnotes`, a `Footnotes`
parameter, and one `addFootnote` call with the intermediate value the assertion depends on —
the footnote appears attached to both the shrunk and the original sample, which is usually
enough to see what the code computed. Second, `@Report(Reporting.FALSIFIED)`, which prints
every sample that failed during the shrinking search; that shows you the *shape* of the failing
region rather than one point, which is what "unremarkable sample" usually means — the property
is failing broadly and you shrank into an uninformative corner. Third, `@Report(Reporting.GENERATED)`
with `tries` lowered, which shows every value the arbitrary produced and, importantly, shows
them *before* the property could mutate them.

{/* FOOTER */}
