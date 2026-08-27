---
title: "@ValueSource is the source with the fewest moving parts and the most rules: exactly one array, exactly one type, exactly one argument per invocation, and no way at all to say null"
sidebar_label: "02 · @ValueSource"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Parameterized Classes and Tests"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html))
> and the `@ValueSource` javadoc
> ([docs.junit.org](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/ValueSource.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3 (`org.junit:junit-bom:6.0.3`).

**`@ValueSource` takes one array of compile-time literals and hands each element to a
one-parameter test method. Its limits are not accidents to be worked around — they are the
signal that tells you when you have outgrown it. The moment you want two columns, a `null`, or
a value that is not a literal, the annotation stops you, and it is right to.**

## The shape

```java
@ParameterizedTest
@ValueSource(ints = { 1, 2, 3 })
void testWithValueSource(int argument) {
    assertTrue(argument > 0 && argument < 4);
}
```

Three invocations. One `int` each. The javadoc states the two boundaries in one paragraph:

> *"`@ValueSource` is one of the simplest possible sources. It lets you specify a single
> array of literal values and can only be used for providing a single argument per
> parameterized test invocation."*

and

> *"Supported types include `shorts()`, `bytes()`, `ints()`, `longs()`, `floats()`,
> `doubles()`, `chars()`, `booleans()`, `strings()`, and `classes()`. Note, however, that
> **only one of the supported types may be specified per `@ValueSource` declaration**."*

## The ten attributes

| Attribute | Element type | Reaches a parameter of |
|---|---|---|
| `shorts` | `short[]` | `short`, `Short`, or anything wider |
| `bytes` | `byte[]` | `byte`, `Byte`, or anything wider |
| `ints` | `int[]` | `int`, `Integer`, `long`, `float`, `double` |
| `longs` | `long[]` | `long`, `Long`, `float`, `double` |
| `floats` | `float[]` | `float`, `Float`, `double` |
| `doubles` | `double[]` | `double`, `Double` |
| `chars` | `char[]` | `char`, `Character`, and wider numeric types |
| `booleans` | `boolean[]` | `boolean`, `Boolean` |
| `strings` | `String[]` | `String` — or any type implicit conversion can reach |
| `classes` | `Class<?>[]` | `Class<?>` |

Every one of them carries the same javadoc sentence: *"must not be empty"*. An empty array
is a configuration error, not a test that runs zero times.

## The two conversions that make it bigger than it looks

**Widening.** The user guide:

> *"JUnit Jupiter supports Widening Primitive Conversion for arguments supplied to a
> `@ParameterizedClass` or `@ParameterizedTest`. For example, a parameterized class or test
> method annotated with `@ValueSource(ints = { 1, 2, 3 })` can be declared to accept not only
> an argument of type `int` but also an argument of type `long`, `float`, or `double`."*

So you do not need `longs = { 1L, 2L }` to feed a `long` parameter. You do need to remember
it only widens — a `long` array cannot feed an `int` parameter.

**Implicit conversion from `String`.** This is the one that quietly turns `strings` into a
universal source:

```java
@ParameterizedTest
@ValueSource(strings = "SECONDS")
void testWithImplicitArgumentConversion(ChronoUnit argument) {
    assertNotNull(argument.name());
}
```

The literal is a `String`; the parameter is an enum; the engine converts. The same holds for
`UUID`, `LocalDate`, `Duration`, `Path`, `BigDecimal`, `Currency`, `Locale` and about twenty
more, plus any of your own types with a single `String`-accepting factory method or
constructor. The full table and its failure modes are
[08 · conversion](08-conversion-and-aggregation.md).

```java
@ParameterizedTest
@ValueSource(strings = { "2026-01-31", "2026-02-28", "2026-12-31" })
void monthEndIsRecognised(LocalDate date) {
    assertThat(calendar.isMonthEnd(date)).isTrue();
}
```

That reads as three dates and is three strings. Which is fine — right up until someone
mistypes one and gets a conversion failure instead of a test failure.

## What it cannot do, and what to use instead

| You want | `@ValueSource` | Use |
|---|---|---|
| Two or more arguments per case | impossible — one argument only | [`@CsvSource`](03-csvsource.md), [`@MethodSource`](04-methodsource.md) |
| `null` | impossible — annotations cannot hold a null literal | [`@NullSource`](02b-null-and-empty.md) |
| An empty string | possible: `strings = ""` | `@EmptySource` reads better |
| A non-literal value (`Instant.now()`, a builder) | impossible — annotation values are compile-time constants | [`@MethodSource`](04-methodsource.md) |
| Every constant of an enum | possible but manual and stale | [`@EnumSource`](05-enumsource.md) |
| Mixed types in one run | impossible in one declaration | stack declarations, or `@MethodSource` |

The `null` row is the important one. Java annotations may not contain `null` as an element
value, so no attribute of `@ValueSource` can ever express it. That single language rule is
why `@NullSource` exists as a separate annotation, and why so many string-validation tests
are silently missing their most important case.

## It is repeatable, and that is how you mix sources

`@ValueSource` is declared `@Repeatable(ValueSources.class)`, and the user guide lists it
among the repeatable source annotations alongside `@EnumSource`, `@MethodSource`,
`@FieldSource`, `@CsvSource`, `@CsvFileSource` and `@ArgumentsSource`. The canonical use is
combining it with the null and empty sources:

```java
@ParameterizedTest
@NullSource
@EmptySource
@ValueSource(strings = { " ", "   ", "\t", "\n" })
void nullEmptyAndBlankStrings(String text) {
    assertTrue(text == null || text.isBlank());
}
```

> *"Both variants of the `nullEmptyAndBlankStrings(String)` parameterized test method result
> in six invocations: 1 for `null`, 1 for the empty string, and 4 for the explicit blank
> strings supplied via `@ValueSource`."*

Six invocations from three annotations. The arguments from repeated annotations are
concatenated, in declaration order — they are not a cartesian product, and nothing pairs them
up.

## Display names in JUnit 6

⚠️ **6.0 changed how these appear in your report.** Text arguments are now quoted:

> *"As of JUnit Jupiter 6.0, text-based arguments in display names for parameterized tests
> are quoted by default. In this context, any `CharSequence` (such as a `String`) or
> `Character` is considered text. A `CharSequence` is wrapped in double quotes (`"`), and a
> `Character` is wrapped in single quotes (`'`). Special characters will be escaped in the
> quoted text."*

The practical gain is exactly the case `@ValueSource(strings = …)` produces most often: a
blank string, a tab and an empty string used to be indistinguishable in a test report and now
are not. Turn it off per method with `quoteTextArguments = false` if a downstream report
parser depends on the old shape — details in [07 · display names](07-display-names.md).

## Gotchas

**★ Two attributes in one `@ValueSource`.** `@ValueSource(ints = {1}, strings = {"a"})`
compiles — annotation attributes are independent — and fails at runtime, because the javadoc
allows only one type per declaration. If you want both, that is two repeated `@ValueSource`
annotations, and your method parameter had better accept both.

**★ Trying to pass `null`.** There is no syntax for it. `strings = { null }` will not
compile. Reaching for the string `"null"` and converting it by hand inside the test is a
worse test than one extra `@NullSource` line.

**★ An empty array.** Each attribute's javadoc says *"must not be empty"*. Commenting out the
last value of a `@ValueSource` to "skip it for now" leaves a source that cannot run.

**★ Forgetting widening only goes one way.** `@ValueSource(longs = { 1, 2 })` cannot feed an
`int` parameter. `@ValueSource(ints = { 1, 2 })` feeds a `long` parameter fine. Widening is a
Java rule the engine reuses, not a JUnit convenience.

**★ Using `strings` where the parameter is a rich type, then mistyping a literal.** The
failure is an `ArgumentConversionException` during argument resolution, not an assertion
failure in your test. It looks like an engine problem and is a typo in a string.

**★ Consuming a `float` literal and asserting exact equality.**
`@ValueSource(doubles = { 0.1, 0.2 })` fed into money arithmetic will do what binary floating
point always does. The source is not the problem; the type is. Use `strings` and let implicit
conversion give you a `BigDecimal`.

**★ Assuming repeated annotations pair up.** Two `@ValueSource` declarations produce
`m + n` invocations, not `m × n` pairs. There is no cartesian product anywhere in
`junit-jupiter-params` — if you want one, you build it in a `@MethodSource` factory.

**★ `chars = { 'ab' }`.** Not a JUnit rule — `char` literals hold one code unit, so this is a
compile error, and it catches people modelling delimiters. Use `strings` for anything longer
than one character.

**★ Listing every enum constant as strings.** `@ValueSource(strings = { "PLACED", "PAID" })`
converts to the enum and works, and then someone adds a constant and this test does not
notice. `@EnumSource` is the source that notices — [05](05-enumsource.md).

**★ Growing a `@ValueSource` past a screenful.** Fifty literals in an annotation is a data
file that has not admitted it yet. Move it to
[`@CsvFileSource`](03b-csvfilesource.md) or a `@MethodSource` factory where it can be read,
diffed and commented.

## Interview questions

**★ Which types can `@ValueSource` supply?**
Ten: `short`, `byte`, `int`, `long`, `float`, `double`, `char`, `boolean`, `String` and
`Class`. Only one of those attributes may be set per `@ValueSource` declaration, and whichever
you set must not be empty.

**★ How do you pass `null` with `@ValueSource`?**
You cannot. Java annotation element values may not be `null`, so no attribute can express it.
That is the reason `@NullSource` exists as a separate annotation, and why you stack
`@NullSource` on top of `@ValueSource` rather than adding a value to the array.

**★ Can a method with `@ValueSource(ints = …)` declare a `long` parameter?**
Yes. Jupiter applies Java's widening primitive conversion to supplied arguments, so an `int`
source can feed `long`, `float` or `double`. It does not narrow, so a `long` source cannot
feed an `int` parameter.

**★ How does `@ValueSource(strings = "SECONDS")` end up as a `ChronoUnit`?**
Implicit argument conversion. When the supplied value is a `String` and the declared parameter
type is something else, Jupiter runs its built-in converters — enum constants, the `java.time`
types, `UUID`, `URI`, `Path`, `BigDecimal` and more — and falls back to a single
`String`-accepting factory method or constructor on the target type.

**★ Why is `@ValueSource` limited to one argument?**
Because it is a single flat array of literals with no notion of a record boundary. The moment
a case has two fields you need something that groups them, which is what `@CsvSource` (a
record per string) and `@MethodSource` (an `Arguments` per element) provide.

**★ What does stacking `@NullSource`, `@EmptySource` and `@ValueSource` produce?**
The concatenation of all three, in declaration order — one `null`, one empty value, then each
literal. The user guide's example yields six invocations. Repeated source annotations append;
they never combine pairwise.

**★ What changed for `@ValueSource` display names in JUnit 6?**
Text arguments are quoted by default: a `CharSequence` in double quotes, a `Character` in
single quotes, with special characters escaped. It is the difference between a report showing
a blank cell and one showing `"\t"`. `quoteTextArguments = false` restores the old
behaviour.

{/* FOOTER */}
