---
title: "A parameterized test is not a loop inside a test method — it is one template the engine expands into N independent tests, each with its own lifecycle, its own result and its own name"
sidebar_label: "01 · One test, many cases"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Parameterized Classes and Tests"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html))
> and the `@ParameterizedTest` javadoc
> ([docs.junit.org](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedTest.html)),
> plus `spring-boot-dependencies:4.1.0` and `spring-boot-starter-test:4.1.0` from Maven Central.
> JDK 25, Spring Boot 4.1.0, **JUnit Jupiter 6.0.3** (via `org.junit:junit-bom:6.0.3`, which
> `spring-boot-dependencies:4.1.0` imports).

**Six test methods that differ only in a literal are one test method with a missing
parameter. `@ParameterizedTest` supplies that parameter — but the reason to reach for it is
not that it is shorter. It is that a `for` loop inside a `@Test` reports one result and stops
at the first failure, while a parameterized test reports one result per case and runs every
case regardless. The unit of reporting is the thing you are buying.**

## The loop you were about to write

Here is the version people write first, and it is the wrong shape:

```java
@Test
void rejectsInvalidIbans() {
    for (String iban : List.of("", "DE00", "XX8937040044053201300", "DE893704004405320130X")) {
        assertThat(validator.isValid(iban)).isFalse();
    }
}
```

One test node in the report. If the third string fails, the fourth never runs, and the
failure message tells you a boolean was `true` when it should have been `false` — not
*which* IBAN did it. You have to read the loop to find out.

The parameterized form:

```java
@ParameterizedTest
@ValueSource(strings = { "", "DE00", "XX8937040044053201300", "DE893704004405320130X" })
void rejectsInvalidIbans(String iban) {
    assertThat(validator.isValid(iban)).isFalse();
}
```

Four test nodes. All four run. Each carries the offending value in its display name. That is
the entire argument for the feature, and everything else in this topic is detail underneath
it.

## What the engine actually does

`@ParameterizedTest` is not a special kind of `@Test`. Its own declaration says so:

```java
@Target({ ANNOTATION_TYPE, METHOD })
@Retention(RUNTIME)
@Documented
@API(status = STABLE, since = "5.7")
@TestTemplate
@ExtendWith(org.junit.jupiter.params.ParameterizedTestExtension.class)
public @interface ParameterizedTest
```

It is meta-annotated `@TestTemplate` and carries an extension. The user guide is explicit
about where that puts it in the model:

> *"Repeated Tests and Parameterized Tests are built-in specializations of test
> templates."*

A test template is a container that produces invocation contexts. The extension reads your
argument source, produces one context per set of arguments, and the engine executes each
context as if it were a test method. Consequently:

> *"Each invocation of a parameterized test has the same lifecycle as a regular `@Test`
> method. For example, `@BeforeEach` methods will be executed before each invocation. Similar
> to Dynamic Tests, invocations will appear one by one in the test tree of an IDE. You may at
> will mix regular `@Test` methods and `@ParameterizedTest` methods within the same test
> class."*

"The same lifecycle" is doing real work in that sentence. With the default
`Lifecycle.PER_METHOD` test-instance mode, **each invocation gets a fresh test-class
instance**, `@BeforeEach` and `@AfterEach` run around each one, and any extension that hooks
those callbacks fires N times. Ten CSV rows against a `@SpringBootTest` is ten context
lookups, ten `@BeforeEach` runs and ten `@Transactional` rollbacks — the annotation is
cheap, the invocation is not. Lifecycle itself belongs to
[01 · JUnit 5](../01-junit-5/README.md); this topic only relies on it.

## The two hard requirements

**The method must not be `private` or `static`.**

> *"Such methods must not be `private` or `static`."*

**It must have at least one source.**

> *"`@ParameterizedTest` methods must specify at least one `ArgumentsProvider` via
> `@ArgumentsSource` or a corresponding composed annotation (e.g., `@ValueSource`,
> `@CsvSource`, etc.). The provider is responsible for providing a `Stream` of `Arguments`
> that will be used to invoke the parameterized test method."*

Every source annotation in this topic — `@ValueSource`, `@EnumSource`, `@CsvSource`,
`@CsvFileSource`, `@MethodSource`, `@FieldSource`, `@NullSource`, `@EmptySource` — is
*itself* meta-annotated `@ArgumentsSource(SomeProvider.class)`. There is one mechanism and
eight front doors onto it. That is why [06 · a custom `ArgumentsProvider`](06-argumentssource.md)
is not an exotic escape hatch: it is the thing the built-ins are made of.

## The parameter list has a fixed order

A parameterized method may take more than the arguments a source supplies — a `TestInfo`, a
`TestReporter`, anything a `ParameterResolver` provides. The order is not negotiable:

> *"Zero or more indexed parameters must be declared first. Zero or more aggregators must be
> declared next. Zero or more parameters supplied by other `ParameterResolver`
> implementations must be declared last."*

```java
@ParameterizedTest
@ValueSource(strings = "apple")
void testWithRegularParameterResolver(String argument, TestReporter testReporter) {
    testReporter.publishEntry("argument", argument);
}
```

An *indexed parameter* is one matched positionally against the `Arguments` the provider
returned. An *aggregator* is a parameter of type `ArgumentsAccessor` or one annotated
`@AggregateWith` — [08b](08b-aggregation.md). Put the `TestReporter` first and the engine
tries to fill it from the source.

## Arguments do not reach lifecycle methods

This is the constraint people trip over when they try to move setup out of the test body:

> *"Since a test class may contain regular tests as well as parameterized tests with
> different parameter lists, values from argument sources are not resolved for lifecycle
> methods (e.g. `@BeforeEach`) and test class constructors."*

`@BeforeEach void setUp(String iban)` does not compile a mental model that works — the
engine has no argument to give it, because the same `@BeforeEach` also runs before the plain
`@Test` methods in the class. If setup genuinely depends on the argument, either do it in the
test body, or promote the whole class to a
[`@ParameterizedClass`](08c-parameterized-classes.md), which has its own invocation-scoped
lifecycle hooks.

## Zero invocations is a failure, on purpose

If a `@MethodSource` factory returns an empty stream — because the file it reads moved, or a
filter matched nothing — the test does not quietly pass. The `allowZeroInvocations` attribute
exists precisely to make that a choice:

> *"Configure whether zero invocations are allowed for this parameterized test. Set this
> attribute to `true` if the absence of invocations is expected in some cases and should not
> cause a test failure. Defaults to `false`."*

Leave it at `false`. A green suite whose data source silently emptied is the exact failure
mode a parameterized test invites, and this default is the guard against it.

## Getting the dependency

`junit-jupiter-params` is a separate artifact:

> *"In order to use parameterized classes or tests you need to add a dependency on the
> `junit-jupiter-params` artifact."*

On Spring Boot 4.1.0 you already have it. `spring-boot-starter-test` depends on
`org.junit.jupiter:junit-jupiter`, and the guide describes that aggregator as one that
*"transitively pulls in dependencies on `junit-jupiter-api`, `junit-jupiter-params`, and
`junit-jupiter-engine`"*. Version 6.0.3, fixed by the `junit-bom` that
`spring-boot-dependencies:4.1.0` imports.

⚠️ **The managed version is JUnit 6, not JUnit 5.** The programming model is still called
Jupiter and the annotations are still `org.junit.jupiter.params.*`, but 6.0 changed real
behaviour in this exact area — display-name quoting, the CSV parser, a removed
`@CsvFileSource` attribute, a new `ArgumentsProvider` signature. Each of those is flagged
where it appears. A tutorial written against 5.9 will be *mostly* right and wrong in the
places that matter.

## Where this topic stops

- **The engine** — lifecycle, `assertThrows`, `@Nested`, `@TempDir`, extensions, ordering,
  parallel execution — is [01 · JUnit 5](../01-junit-5/README.md).
- **Assertion style and failure messages** are [02 · AssertJ](../02-assertj/README.md). Every
  example here uses AssertJ without arguing for it.
- **Property-based testing** is **topic 10 · jqwik** *(not written yet)*, and the boundary is
  sharp: a parameterized test runs *the cases you chose*, listed in your source; a property
  test *generates* cases from a specification and shrinks a counterexample when it finds one.
  If you can write the table, you want this topic. If you cannot write the table because you
  do not know which inputs are interesting, you want jqwik.
- **Builders, object mothers and fixtures** — how to construct the objects a case needs — are
  **topic 08 · test data patterns** *(not written yet)*. This topic owns the table of cases,
  not the construction of each row.

## Gotchas

**★ A `for` loop in a `@Test` is not a cheap parameterized test.** It reports one result,
aborts at the first failed assertion, and hides which input broke. If you catch yourself
adding a message argument to every assertion so you can tell the iterations apart, you have
rebuilt display names badly — use a source.

**★ Making the method `static` to "share" it does not work.** The javadoc says parameterized
test methods must not be `private` or `static`. The *factory* method for `@MethodSource` is
the one that has to be `static`; the test method must not be.

**★ Adding `@Test` alongside `@ParameterizedTest`.** They are different template mechanisms.
The method now claims to be both a test and a test template, which is a configuration error,
not a method that runs twice.

**★ Assuming one test-class instance is shared across invocations.** Under the default
`PER_METHOD` lifecycle each invocation gets a new instance, so a field you mutate in
invocation 1 is gone in invocation 2. Under `@TestInstance(PER_CLASS)` it is not — and that
is a shared-state bug waiting for whoever adds `PER_CLASS` later to escape the `static`
requirement on `@MethodSource`.

**★ Putting a `TestInfo` or `TestReporter` parameter before the source-supplied ones.** The
declared order is indexed parameters, then aggregators, then resolver-supplied parameters.
The compiler is happy; the engine is not.

**★ Expecting `@BeforeEach` to see the arguments.** It never does, by design, because the
same `@BeforeEach` also serves plain `@Test` methods in the class. Argument-dependent setup
goes in the test body or in a `@ParameterizedClass`.

**★ A source that can legitimately be empty, left at the default.** `allowZeroInvocations`
defaults to `false` so an empty source fails loudly. Setting it to `true` to silence a
flaky build converts "my data disappeared" into "everything is green".

**★ Attaching a ten-row `@CsvSource` to a `@SpringBootTest`.** Each row is a full test
invocation with the full lifecycle. Parameterizing an expensive test multiplies the expense
by the number of rows; parameterize the cheapest layer that can express the case. That
trade-off is **topic 05 · the test pyramid** *(not written yet)*.

**★ Treating "one test, many cases" as licence to widen the table.** Every row costs suite
time forever. Rows should be *distinct behaviours*, not a sampling of the input space —
sampling the input space is what jqwik is for.

## Interview questions

**★ What does `@ParameterizedTest` actually do, mechanically?**
It is meta-annotated `@TestTemplate` and registers `ParameterizedTestExtension`. The
extension reads the declared argument sources, produces one `TestTemplateInvocationContext`
per set of arguments, and the engine executes each context with the same lifecycle as a
regular `@Test` method — fresh instance under `PER_METHOD`, `@BeforeEach`/`@AfterEach` around
each invocation, one node per invocation in the test tree.

**★ Why is that better than looping inside a single `@Test`?**
Reporting granularity and independence. A loop yields one pass/fail for the whole set and
stops at the first assertion failure, so you learn that *something* is wrong and have to
re-run to find out what. N invocations yield N results, all of which run, each named after
its input. When case 7 of 12 breaks, the report says so.

**★ What are the requirements on a parameterized test method?**
It must not be `private` or `static`, and it must declare at least one `ArgumentsProvider`
via `@ArgumentsSource` or a composed annotation such as `@ValueSource` or `@CsvSource`. Its
formal parameters must be ordered: indexed parameters, then aggregators, then anything a
`ParameterResolver` supplies.

**★ Can a `@BeforeEach` method take the current argument?**
No. The user guide states that values from argument sources are not resolved for lifecycle
methods or test-class constructors, because a class can mix parameterized tests with
different signatures and plain `@Test` methods that share the same callbacks. If setup truly
depends on the argument, use a `@ParameterizedClass` with
`@BeforeParameterizedClassInvocation`, or do it inside the test.

**★ What happens if the source produces nothing?**
The test fails. `allowZeroInvocations` defaults to `false`, so an empty stream is treated as
a problem rather than a vacuous pass. You can opt out per method when emptiness is genuinely
legitimate, but doing it globally hides the most common way a data-driven test rots.

**★ Which artifact do you need, and do you have it on Spring Boot?**
`org.junit.jupiter:junit-jupiter-params`. On Boot 4.1.0 you do:
`spring-boot-starter-test` pulls the `junit-jupiter` aggregator, which transitively brings
`junit-jupiter-api`, `junit-jupiter-params` and `junit-jupiter-engine`, all at 6.0.3 via the
imported `junit-bom`.

**★ When is a parameterized test the wrong answer?**
When the cases differ in more than their data — different arrangement, different assertion,
different reason for existing. A source with a boolean "and if this flag is set, assert
something else instead" column is five tests wearing one name. That argument gets its own
chunk: [09 · when not to parameterize](09-when-not-to-parameterize.md).

**★ How is this different from property-based testing?**
A parameterized test enumerates cases *you* chose and is only as good as your imagination. A
property test states an invariant and lets a generator produce inputs, including ones you
never considered, then shrinks any failure to a minimal counterexample. They answer different
questions and coexist happily: the parameterized test pins the regressions you know about,
the property hunts the ones you do not.

{/* FOOTER */}
