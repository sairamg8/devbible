---
title: "Every CSV cell arrives as a String, so the gap between what a source supplies and what a parameter declares is closed by conversion — and the two automatic mechanisms, widening and a fixed table of about thirty implicit converters, are both driven by the declared parameter type rather than by anything the annotation says"
sidebar_label: "08 · Implicit conversion"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Argument Conversion"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `DefaultArgumentConverter`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/DefaultArgumentConverter.html))
> and `ArgumentConversionException`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/ArgumentConversionException.html))
> pages, and the 6.0.0 release notes
> ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/index.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**`@CsvSource({ "PT3S, 3" })` feeding `void test(Duration timeout, int seconds)` works, and
nothing in the annotation says how. Three mechanisms are stacked behind that, and they are
worth keeping apart because they fail differently. Two of them are automatic and closed —
widening primitive conversion, and a documented table of about thirty implicit
`String`-to-type converters — and they are what this chunk covers. The third is a reflective
fallback that reaches into your own production code, which is why it gets its own chunk:
[08k · fallback conversion](08k-fallback-conversion.md). Explicit conversion, where you name
the converter yourself, is [08l](08l-explicit-conversion.md).**

## Widening comes first

> *"JUnit Jupiter supports Widening Primitive Conversion for arguments supplied to a
> `@ParameterizedClass` or `@ParameterizedTest`. For example, a parameterized class or test
> method annotated with `@ValueSource(ints = { 1, 2, 3 })` can be declared to accept not only
> an argument of type `int` but also an argument of type `long`, `float`, or `double`."*

```java
@ParameterizedTest
@ValueSource(ints = { 1, 2, 3 })
void widens(long value) { }        // int → long, fine
```

This is the JLS's widening primitive conversion, so it runs `byte → short → int → long →
float → double` and never the other way. It is the reason [02 · `@ValueSource`](02-valuesource.md)
can get away with `ints` for a method taking a `double`, and the reason the reverse — `doubles`
into an `int` parameter — is not a conversion at all but a failure.

⚠️ Widening applies to the *primitive* argument types a `@ValueSource` supplies. It is not a
route from `int` to `Long`, because that would be widening followed by boxing, and the
documentation only promises widening.

## Implicit conversion: the table

> *"To support use cases like `@CsvSource`, JUnit Jupiter provides a number of built-in
> implicit type converters. The conversion process depends on the declared type of each method
> parameter."*
>
> *"For example, if a `@ParameterizedClass` or `@ParameterizedTest` declares a parameter of
> type `TimeUnit` and the actual type supplied by the declared source is a `String`, the string
> will be automatically converted into the corresponding `TimeUnit` enum constant."*

```java
@ParameterizedTest
@ValueSource(strings = "SECONDS")
void testWithImplicitArgumentConversion(ChronoUnit argument) {
    assertNotNull(argument.name());
}
```

**The declared parameter type drives everything.** The source never decides; it supplies a
`String` and the parameter says what that string has to become. Change the parameter type and
you change the conversion, with no edit to the annotation — which is exactly how a test starts
passing for the wrong reason.

> *"`String` instances are implicitly converted to the following target types."*

| Target type | Documented example |
|---|---|
| `boolean` / `Boolean` | `"true"` → `true` — *"only accepts values 'true' or 'false', case-insensitive"* |
| `byte` / `Byte` | `"15"`, `"0xF"`, or `"017"` → `(byte) 15` |
| `char` / `Character` | `"o"` → `'o'` |
| `short` / `Short` | `"15"`, `"0xF"`, or `"017"` → `(short) 15` |
| `int` / `Integer` | `"15"`, `"0xF"`, or `"017"` → `15` |
| `long` / `Long` | `"15"`, `"0xF"`, or `"017"` → `15L` |
| `float` / `Float` | `"1.0"` → `1.0f` |
| `double` / `Double` | `"1.0"` → `1.0d` |
| Enum subclass | `"SECONDS"` → `TimeUnit.SECONDS` |
| `java.io.File` | `"/path/to/file"` → `new File("/path/to/file")` |
| `java.lang.Class` | `"java.lang.Integer"` → `java.lang.Integer.class` — *"use `$` for nested classes, e.g. `"java.lang.Thread$State"`"* |
| `java.lang.Class` | `"byte"` → `byte.class` — *"primitive types are supported"* |
| `java.lang.Class` | `"char[]"` → `char[].class` — *"array types are supported"* |
| `java.math.BigDecimal` | `"123.456e789"` → `new BigDecimal("123.456e789")` |
| `java.math.BigInteger` | `"1234567890123456789"` → `new BigInteger(…)` |
| `java.net.URI` | `"https://junit.org/"` → `URI.create("https://junit.org/")` |
| `java.net.URL` | `"https://junit.org/"` → `URI.create("https://junit.org/").toURL()` |
| `java.nio.charset.Charset` | `"UTF-8"` → `Charset.forName("UTF-8")` |
| `java.nio.file.Path` | `"/path/to/file"` → `Paths.get("/path/to/file")` |
| `java.time.Duration` | `"PT3S"` → `Duration.ofSeconds(3)` |
| `java.time.Instant` | `"1970-01-01T00:00:00Z"` → `Instant.ofEpochMilli(0)` |
| `java.time.LocalDateTime` | `"2017-03-14T12:34:56.789"` |
| `java.time.LocalDate` | `"2017-03-14"` |
| `java.time.LocalTime` | `"12:34:56.789"` |
| `java.time.MonthDay` | `"--03-14"` → `MonthDay.of(3, 14)` |
| `java.time.OffsetDateTime` | `"2017-03-14T12:34:56.789Z"` |
| `java.time.OffsetTime` | `"12:34:56.789Z"` |
| `java.time.Period` | `"P2M6D"` → `Period.of(0, 2, 6)` |
| `java.time.YearMonth` | `"2017-03"` |
| `java.time.Year` | `"2017"` |
| `java.time.ZonedDateTime` | `"2017-03-14T12:34:56.789Z"` |
| `java.time.ZoneId` | `"Europe/Berlin"` |
| `java.time.ZoneOffset` | `"+02:30"` → `ZoneOffset.ofHoursMinutes(2, 30)` |
| `java.util.Currency` | `"JPY"` → `Currency.getInstance("JPY")` |
| `java.util.Locale` | `"en-US"` → `Locale.forLanguageTag("en-US")` |
| `java.util.UUID` | `"d043e930-…"` → `UUID.fromString(…)` |

Four things worth pulling out of that table:

**Integral literals accept Java literal syntax.** *"Decimal, hexadecimal, and octal `String`
literals will be converted to their integral types: `byte`, `short`, `int`, `long`, and their
boxed counterparts."* So `"0xF1"` in a CSV cell is 241 and `"017"` is 15, not 17. That is
occasionally exactly what you want in a test about parsing, and occasionally a leading zero in
a product code that silently becomes an octal number.

**`boolean` is strict.** Only `true` or `false`, case-insensitive. `"1"`, `"yes"`, `"Y"` and
`"TRUE "` with a trailing space are all failures, not falsehood. Silent coercion to `false`
would be the far worse design, and JUnit does not do it.

**The `java.time` types are ISO-8601 parsers.** `"14/03/2017"` is not a `LocalDate` here.
Either write ISO in the table or use `@JavaTimeConversionPattern`
([08l](08l-explicit-conversion.md)).

**`Locale` changed in 6.0.** 🔴 *"Support for the
`junit.jupiter.params.arguments.conversion.locale.format` configuration parameter has been
removed. Locale conversions are now always performed using the IETF BCP 47 language tag format
supported by the `Locale.forLanguageTag(String)` factory method."* A 5.x project that used the
old ISO-639 style (`"en_US"` with an underscore) and set that parameter has tests that stop
converting on upgrade. BCP 47 uses hyphens: `"en-US"`.

The implementation is `DefaultArgumentConverter`, `@API(status = INTERNAL, since = "5.0")` —
so do not reference it from your own code — and its javadoc adds one rule the guide omits:

> *"If the source and target types are identical the source object will not be modified."*

That is why a `@MethodSource` supplying a real `LocalDate` to a `LocalDate` parameter passes
straight through with no parsing, and why conversion is only ever a `@CsvSource`/`@ValueSource`
concern in practice.

## Gotchas

**★ Assuming the source decides the type.** The *declared parameter type* decides. The same
`@CsvSource` row feeds an `int`, a `long`, a `String` or a `BigDecimal` depending only on the
method signature, so changing a parameter type silently changes what is being tested.

**★ A leading zero in a numeric cell.** `"017"` converts to 15, because octal literals are
accepted. Product codes, ZIP codes and phone extensions all look like this. Declare the
parameter `String` if the value is not really a number — which it usually is not.

**★ Expecting `"1"` or `"yes"` to be `true`.** `boolean` conversion accepts only `true` and
`false`, case-insensitive. Anything else is a conversion failure, which is better than a
silent `false` but does not look like one at first glance.

**★ A non-ISO date in a CSV table.** `java.time` conversion is ISO-8601 only. `"14/03/2017"`
fails. Write ISO in the table, or annotate the parameter with `@JavaTimeConversionPattern`
([08l](08l-explicit-conversion.md)).

**★ `"en_US"` for a `Locale` on JUnit 6.** Conversion is now always BCP 47 via
`Locale.forLanguageTag`, and the configuration parameter that used to select the old format was
removed in 6.0. Underscores are out; hyphens are in.

**★ A `null` reaching a primitive parameter.** From the `@CsvSource` javadoc: *"An
`ArgumentConversionException` is thrown if the target type of a `null` reference is a primitive
type."* An empty CSV cell is a `null` ([03](03-csvsource.md)), so a missing value in an `int`
column is a conversion failure that reads like a framework bug.

**★ Referencing `DefaultArgumentConverter` from your own code.** It is
`@API(status = INTERNAL)`. The public route to the same behaviour is to declare the parameter
type you want, or to call `ArgumentsAccessor.get(index, SomeType.class)`
([08b](08b-aggregation.md)).

**★ Expecting widening to box.** Widening primitive conversion is `int` to `long`, not `int` to
`Long`. A `@ValueSource(ints = …)` into an `Integer` parameter is boxing, which is a different
rule — and into a `Long` parameter it is neither.

**★ Treating a conversion failure as a test failure.** `ArgumentConversionException` extends
`JUnitException` and is thrown while resolving arguments, before your test body runs. Nothing
in the method under test has executed. The bug is in the table or the signature.

## Interview questions

**★ How does a `@CsvSource` cell become a `LocalDate`?**
Every CSV cell is a `String`. JUnit's implicit conversion consults the *declared parameter
type* and applies a built-in converter — for `java.time` types, the ISO-8601 parse. There are
about thirty such target types documented, covering primitives and their wrappers, enums,
`File`, `Path`, `Class`, `BigDecimal`, `BigInteger`, `URI`, `URL`, `Charset`, the `java.time`
family, `Currency`, `Locale` and `UUID`.

**★ What is widening primitive conversion doing here?**
It lets a source that supplies a narrower primitive feed a wider parameter —
`@ValueSource(ints = { 1, 2, 3 })` into a `long`, `float` or `double` parameter. It runs in one
direction only and does not include boxing.

**★ Why did `Locale` conversion break when you upgraded to JUnit 6?**
Because 6.0 removed `junit.jupiter.params.arguments.conversion.locale.format` and made all
`Locale` conversion go through `Locale.forLanguageTag`, the IETF BCP 47 form. Tables written
with the older underscore style, `"en_US"`, need hyphens.

**★ Your CSV table has an empty cell in an `int` column. What happens?**
An unquoted empty cell is a `null` reference, and the `@CsvSource` javadoc states that an
`ArgumentConversionException` is thrown when the target type of a `null` is a primitive. The
fix is either a value in the cell, a boxed `Integer` parameter, or an explicit `nullValues`
token so the intent is visible in the table.

**★ Does the parameter type or the source annotation decide the conversion?**
The parameter type, always. The source supplies a `String` (or a literal); the declared type
of the parameter selects the converter. This is why implicit conversion barely applies to
`@MethodSource` — when the source hands over a real `LocalDate`, source and target types are
identical and the documentation says the object is passed through unmodified.

**★ When should you stop relying on implicit conversion?**
When the string in the table stops being the value's natural written form. A date in a
non-ISO format, a domain type without a parse method, or a cell that has to become two fields
are all signals: reach for `@ConvertWith` ([08l](08l-explicit-conversion.md)), an aggregator
([08b](08b-aggregation.md)), or a `@MethodSource` that builds the object in Java
([04](04-methodsource.md)).

{/* FOOTER */}
