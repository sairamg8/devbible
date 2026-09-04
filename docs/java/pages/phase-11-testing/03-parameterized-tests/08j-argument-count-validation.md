---
title: "By default a source that supplies more arguments than the method declares has the extras silently discarded, which means deleting a parameter leaves a green test that no longer checks what that parameter carried — and the one properties line that turns this into an error is the highest-value setting in the whole topic"
sidebar_label: "08j · Argument count validation"
sidebar_position: 25
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Argument Count Validation"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `ArgumentCountValidationMode`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ArgumentCountValidationMode.html))
> and `@ParameterizedTest.argumentCountValidation`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedTest.html))
> pages. JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**A parameterized test is the only construct in Java where a source and a signature agree by
convention rather than by type. Nothing checks that a four-column table feeds a four-parameter
method — by default a fifth column is dropped and the test runs green. That default exists for
backwards compatibility, the documentation says so, and one configuration line replaces it with
the check the compiler cannot do.**

## The default is lenient, and the documentation admits why that is a problem

> *"By default, when an arguments source provides more arguments than the test method needs,
> those additional arguments are ignored and the test executes as usual. **This can lead to bugs
> where arguments are never passed to the parameterized class or method.**"*
>
> *"To prevent this, you can set argument count validation to 'strict'. Then, any additional
> arguments will cause an error instead."*

The `ArgumentCountValidationMode` javadoc restates the motivation as a diagnosis:

> *"When an `ArgumentsSource` provides more arguments than declared by the parameterized class
> or method, there might be a bug in the class/method or the `ArgumentsSource`.
> `ArgumentCountValidationMode` allows you to control how additional arguments are handled."*

**"There might be a bug in the class/method or the `ArgumentsSource`"** is the honest framing.
Extra arguments are never *intentional*; they mean one side of the agreement moved.

## Turning it on

Per method or class:

```java
@ParameterizedTest(argumentCountValidation = ArgumentCountValidationMode.STRICT)
@CsvSource({ "42, -666" })
void testWithArgumentCountValidation(int number) {
    assertTrue(number > 0);
}
```

Project-wide, which is where it belongs:

```properties
# src/test/resources/junit-platform.properties
junit.jupiter.params.argumentCountValidation = strict
```

> *"To change this behavior for all tests, set the
> `junit.jupiter.params.argumentCountValidation` configuration parameter to `strict`. To change
> this behavior for a single parameterized class or test method, use the
> `argumentCountValidation` attribute of the `@ParameterizedClass` or `@ParameterizedTest`
> annotation"*

The three modes:

| Mode | Javadoc |
|---|---|
| `DEFAULT` | *"Use the default validation mode."* |
| `NONE` | *"Use the 'none' argument count validation mode."* |
| `STRICT` | *"Use the strict argument count validation mode."* |

`DEFAULT` is the attribute's default value and means "defer to the configuration parameter";
`NONE` is the explicit opt-out, which is how a single legacy method escapes a project-wide
`strict` without anyone changing the properties file. The attribute and the enum are both
`@API(status = MAINTAINED, since = "5.13.3")`, with `@since 5.12`.

## What it actually catches

```java
@ParameterizedTest
@CsvSource({
    "DE89370400440532013000, DE, true",
    "FR1420041010050500013M02606, FR, true"
})
void validates(String iban, String country) {          // someone deleted `boolean expected`
    assertThat(validator.countryOf(iban)).isEqualTo(country);
}
```

That test passes. It also no longer checks validity at all — the third column is silently
dropped, and the assertion that used it went with the parameter. Nothing is red, the table still
*documents* an expectation the test does not verify, and a reviewer scanning the table sees a
column that looks used.

Under `strict`, the third column is an error and the deletion has to be finished properly.

The other direction it protects, from [04b](04b-methodsource-return-types.md): a
`@MethodSource` factory and the method it feeds drift apart over time because nothing ties them
together. Add a field to the `Arguments` in the factory, forget the method, and the new field is
discarded.

⚠️ It is only the *extra* direction. A source supplying **fewer** arguments than the method
declares is already a failure without any configuration — there is no argument to resolve for
the missing parameter — so `strict` adds nothing there. It closes the silent half.

## Where it does not help

**Aggregated signatures.** A method whose only parameter is an `ArgumentsAccessor` or an
`@AggregateWith` parameter declares *zero* indexed parameters ([08b](08b-aggregation.md)), so
there is no declared count to compare the source against. An aggregator that reads indices 0
through 3 out of a five-column row ignores column five exactly as before, and `strict` has
nothing to say about it.

The substitute is an explicit assertion inside the aggregator or the test:

```java
@ParameterizedTest
@CsvSource({ "Jane, Doe, F, 1990-05-20, EXTRA" })
void aggregated(ArgumentsAccessor arguments) {
    assertThat(arguments.size()).isEqualTo(4);   // the check strict mode cannot do for you
    …
}
```

That is uglier than a configuration flag and it is the only thing that works. It is also an
argument for not aggregating a table you have not stabilised.

**`ParameterResolver`-supplied parameters.** A trailing `TestReporter` is not an indexed
parameter either. The count being compared is source arguments against *indexed* parameters, not
against the full signature.

## Gotchas

**★ Leaving argument count validation at the default.** Extra arguments are silently ignored, so
a table with a stale column and a method that stopped reading it both stay green. `strict` is
one properties line and it is the single highest-value setting in this topic.

**★ Expecting strict validation to protect an aggregated test.** It compares the source's
argument count against the *indexed* parameters, and an aggregated method has none. The column
your aggregator forgot to read stays invisible.

**★ Assuming it catches too-few arguments as well.** Those already fail — there is nothing to
resolve for the missing parameter. `strict` exists for the surplus direction, which is the one
that is silent.

**★ Turning it on and finding dozens of failures.** That is the feature working: every one of
them is a table column no test reads. Fix them; do not set the mode back. If you need to stage
it, put `NONE` on the specific methods and remove them one by one.

**★ Confusing `DEFAULT` with `NONE`.** `DEFAULT` means "use whatever the configuration parameter
says", so under a project-wide `strict` a method annotated `DEFAULT` is strict. `NONE` is the
explicit opt-out that survives the project setting.

**★ Setting the configuration parameter and expecting per-method attributes to yield to it.**
They do not — the attribute is checked first, exactly as with the display name pattern
([07d](07d-project-wide-display-names.md)). A method that says `NONE` stays lenient.

**★ Putting the property in `src/main/resources`.** `junit-platform.properties` is read from the
root of the *test* classpath. A copy in the main resources ships to production and configures
nothing.

**★ Believing the compiler has your back on a CSV table.** It does not, and cannot: the table is
a string literal, the parameters are types, and nothing connects them until run time. That gap
is what this setting exists to narrow — and it narrows it only for indexed parameters.

**★ Adding a column to a `@CsvFileSource` file that several tests share.** One method's new
column is another method's surplus argument. Under `strict` the other tests break immediately,
which is correct and is also the moment to notice that a shared CSV file couples unrelated
tests ([03c](03c-csvfilesource.md)).

## Interview questions

**★ What is argument count validation and why is the default what it is?**
By default, a source supplying more arguments than the method declares has the extras silently
ignored. `ArgumentCountValidationMode.STRICT` — per annotation, or
`junit.jupiter.params.argumentCountValidation = strict` project-wide — turns that into an error.
The lenient default is backwards compatibility; the strict mode is what catches a parameter
someone deleted from a method whose table still carries the column.

**★ Why does strict argument count validation not help an aggregated test?**
Because it counts indexed parameters, and a method whose only parameter is an
`ArgumentsAccessor` or an `@AggregateWith` parameter declares none. Aggregation deliberately
takes the whole row, so there is no declared count to compare against. An explicit
`assertThat(arguments.size())` is the manual substitute.

**★ What are the three modes and how do they interact with the configuration parameter?**
`DEFAULT`, `NONE` and `STRICT`. `DEFAULT` is the annotation attribute's default and defers to
the `junit.jupiter.params.argumentCountValidation` configuration parameter. `STRICT` and `NONE`
are explicit and override the project setting for that class or method — so `NONE` is how one
legacy test opts out of a repository-wide `strict`.

**★ Does it catch a source that supplies too few arguments?**
No, and it does not need to. A missing argument for a declared parameter already fails at
resolution time with no configuration at all. The setting exists for the surplus direction,
which is the one that passes silently.

**★ What class of bug does this actually prevent?**
Drift between a source and a signature. Nothing in Java ties a CSV literal or a
`@MethodSource` factory to the method's parameter list, so the two can diverge in either
direction. The too-few direction is loud; the too-many direction is silent and leaves a test
that still looks like it checks something it no longer checks.

{/* FOOTER */}
