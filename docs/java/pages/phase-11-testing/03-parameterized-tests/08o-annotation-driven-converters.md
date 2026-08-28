---
title: "Because @ConvertWith may be placed on another annotation, a converter and its configuration can be collapsed into one word at the parameter — which is exactly how JUnit ships its only built-in explicit converter, and how you should ship yours"
sidebar_label: "08o · Annotation-driven converters"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide, "Explicit Conversion"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> and the javadocs for `JavaTimeConversionPattern`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/JavaTimeConversionPattern.html)),
> `AnnotationBasedArgumentConverter`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/AnnotationBasedArgumentConverter.html))
> and `ConvertWith`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/ConvertWith.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**`@ConvertWith`'s `@Target` includes `ANNOTATION_TYPE` ([08l](08l-explicit-conversion.md)), and
that one element turns explicit conversion from a mechanism into a vocabulary. Instead of
`@ConvertWith(GermanDateConverter.class)` on every parameter, you write `@GermanDate` — and if the
converter needs configuring, the annotation carries the configuration. JUnit's own and only
built-in explicit converter is shipped exactly this way, which makes it the reference
implementation for yours.**

## The one converter JUnit ships, and why there is only one

> *"Explicit argument converters are meant to be implemented by test and extension authors. Thus,
> `junit-jupiter-params` only provides a single explicit argument converter that may also serve as
> a reference implementation: `JavaTimeArgumentConverter`. It is used via the composed annotation
> `JavaTimeConversionPattern`."*

Read the first sentence as a design statement, not an apology. Explicit conversion is a hook for
*your* domain; JUnit is not going to guess at `Money` or `Iban`. The single exception exists
because there is one conversion problem every project has and nobody can express in a type: a date
written in a format that is not ISO-8601.

That matters because implicit conversion of `java.time` types is ISO-8601 only
([08](08-conversion-and-aggregation.md)). A cell of `"31.12.2017"` will not become a `LocalDate`
by itself, and the fallback cannot help either — `LocalDate` has many static factories, not one.
The guide's example:

```java
@ParameterizedTest
@ValueSource(strings = { "01.01.2017", "31.12.2017" })
void testWithExplicitJavaTimeConverter(
		@JavaTimeConversionPattern("dd.MM.yyyy") LocalDate argument) {

	assertEquals(2017, argument.getYear());
}
```

One annotation on the parameter carries both *which* converter and *how* it is configured. There
is no converter class in the test source at all.

## The shape that makes it work

```java
@Target({ ANNOTATION_TYPE, PARAMETER, FIELD })
@Retention(RUNTIME)
@Documented
@API(status = STABLE, since = "5.7")
@ConvertWith(org.junit.jupiter.params.converter.JavaTimeArgumentConverter.class)
public @interface JavaTimeConversionPattern
```

That is the whole trick, and every element of it is copyable:

- **`@ConvertWith(SomeConverter.class)` on the annotation type.** This is what makes it a composed
  annotation: JUnit finds `@ConvertWith` as a meta-annotation on `@JavaTimeConversionPattern` and
  applies the named converter.
- **`@Retention(RUNTIME)`** — non-negotiable. An annotation the runtime cannot see does not exist
  as far as argument resolution is concerned, and the symptom is silence, not an error.
- **`@Target({ANNOTATION_TYPE, PARAMETER, FIELD})`** — mirroring `@ConvertWith`'s own targets, so
  your annotation works on a `@ParameterizedTest` parameter, on a `@Parameter` field of a
  `@ParameterizedClass` ([08e](08e-parameterized-class-field-injection.md)), and as a
  meta-annotation itself.

Its documented purpose is stated in terms of both:

> *"`@JavaTimeConversionPattern` is an annotation that allows a date/time conversion pattern to be
> specified on a parameter of a `@ParameterizedClass` or `@ParameterizedTest`."*

⚠️ `JavaTimeArgumentConverter` itself has **no published javadoc page** in 6.0.3 — the URL under
`org.junit.jupiter.params.converter` returns 404 while the annotation's does. So the annotation,
not the class, is the supported entry point, and I could not confirm from the documentation which
`java.time` target types it accepts. The user guide demonstrates only `LocalDate`; do not assume
the full set without checking against your own version.

## Its two elements, including the one people miss

`value` is required — *"The date/time conversion pattern."* — and the javadoc points at
`DateTimeFormatterBuilder.appendPattern(String)` for what a pattern may contain, which is the
usual `java.time` pattern language and not a JUnit dialect.

`nullable` is optional, a `boolean`, and defaults to `false`:

> *"Whether `null` argument values are allowed."* — *"Defaults to `false`, in which case a `null`
> value will result in an exception."*

It is `@since 5.12`. So the default behaviour is that a `null` cell — from `@NullSource`, or from
a CSV column listed in `nullValues` ([02b](02b-null-and-empty.md)) — fails rather than passing
through as a `null` date. If your table deliberately contains a missing date, you must opt in:

```java
@ParameterizedTest
@CsvSource(nullValues = "NONE", value = {
    "31.12.2017, false",
    "NONE,       true"
})
void treatsAMissingExpiryAsOpenEnded(
        @JavaTimeConversionPattern(value = "dd.MM.yyyy", nullable = true) LocalDate expiry,
        boolean openEnded) {
    assertThat(Licence.expiringOn(expiry).isOpenEnded()).isEqualTo(openEnded);
}
```

This is the same decision every converter has to make ([08n](08n-null-and-conversion-failure.md)),
here exposed as a switch rather than left to the implementer.

## Writing your own: `AnnotationBasedArgumentConverter`

> *"If you wish to implement a custom `ArgumentConverter` that also consumes an annotation (like
> `JavaTimeArgumentConverter`), you have the possibility to extend the
> `AnnotationBasedArgumentConverter` class."*

The javadoc describes it as *"an abstract base class for `ArgumentConverter` implementations that
also need to consume an annotation in order to perform the conversion"*. It is generic in
`A extends Annotation`, implements `ArgumentConverter`, `AnnotationConsumer<A>` and `Consumer<A>`,
and its subclass hook is:

```java
protected abstract Object convert(Object source, Class<?> targetType, A annotation);
```

with the `annotation` parameter documented as *"never `null`"* — JUnit resolves it for you before
the call, so there is no "what if the annotation is absent" branch to write. `@since 5.10`,
`@API(status = MAINTAINED, since = "5.13.3")`.

🔴 Note the API status: **`MAINTAINED`, not `STABLE`**, unlike `SimpleArgumentConverter` and
`TypedArgumentConverter` ([08m](08m-writing-a-converter.md)). Perfectly usable; just not the same
guarantee, and worth knowing before you build a shared test-support module on it.

A complete pair, with the annotation and the converter that reads it:

```java
@Target({ ANNOTATION_TYPE, PARAMETER, FIELD })
@Retention(RetentionPolicy.RUNTIME)
@Documented
@ConvertWith(MoneyArgumentConverter.class)
public @interface MoneyIn {
	String value();              // ISO 4217 currency code, e.g. "EUR"
}
```

```java
public class MoneyArgumentConverter extends AnnotationBasedArgumentConverter<MoneyIn> {

	@Override
	protected Object convert(Object source, Class<?> targetType, MoneyIn annotation) {
		if (source == null) {
			throw new ArgumentConversionException("no amount given for " + annotation.value());
		}
		if (!Money.class.equals(targetType)) {
			throw new ArgumentConversionException("@MoneyIn can only produce Money, not " + targetType);
		}
		try {
			return Money.of(new BigDecimal(source.toString()), Currency.getInstance(annotation.value()));
		}
		catch (NumberFormatException ex) {
			throw new ArgumentConversionException("'" + source + "' is not a decimal amount", ex);
		}
	}
}
```

```java
@ParameterizedTest
@CsvSource({ "12.50, 2.38", "0.00, 0.00" })
void appliesVat(@MoneyIn("EUR") Money net, @MoneyIn("EUR") Money vat) {
	assertThat(net.vatAt(STANDARD_RATE)).isEqualTo(vat);
}
```

Note the `targetType` check. Like `SimpleArgumentConverter`, this rung hands you `Object` and a
`Class<?>` — the base class is doing annotation resolution for you, not type checking, so the
check that `TypedArgumentConverter` would have performed is back to being your responsibility.

## When to compose and when not to

Compose when the converter needs configuring — a currency, a date pattern, a locale, a scale.
That configuration has to live *somewhere* visible at the parameter, and an annotation element is
the only place that is both visible and type-checked at compile time. The alternative,
`@ConvertWith(EurMoneyConverter.class)` plus `@ConvertWith(GbpMoneyConverter.class)` plus
`@ConvertWith(UsdMoneyConverter.class)`, is a class per configuration value.

Do not compose when the converter has no configuration and appears in one test. `@GermanDate` used
once, defined in its own file, and only comprehensible after opening two files is worse than
`@ConvertWith(GermanDate.class)` on the parameter, which names the class directly. A composed
annotation earns its indirection by being used in several places or by carrying a value.

## Gotchas

**★ Forgetting `@Retention(RUNTIME)` on your composed annotation.** The default retention is
`CLASS`, so the annotation is invisible at runtime, the meta-`@ConvertWith` is never found, and the
parameter falls back to implicit conversion. Nothing tells you: the symptom is a conversion failure
that names the parameter's type and never mentions your annotation.

**★ Omitting `ANNOTATION_TYPE` from your `@Target`.** Your annotation then cannot itself be
meta-annotated onto a further annotation. `@ConvertWith` and `@JavaTimeConversionPattern` both
include it, and copying their target set costs nothing.

**★ Omitting `FIELD` from your `@Target`.** It compiles and works for `@ParameterizedTest`
parameters, then fails to compile the day someone converts the class to a `@ParameterizedClass`
with `@Parameter` fields ([08c](08c-parameterized-classes.md)).

**★ Assuming a `null` cell passes through `@JavaTimeConversionPattern`.** `nullable` defaults to
`false` and the javadoc is explicit that a `null` value then *"will result in an exception"*. A
`@NullSource` row, or a `nullValues` cell, needs `nullable = true` written out.

**★ Assuming `nullable` exists on older versions.** It is `@since 5.12`. On an older Jupiter the
element is simply not there, and there is no way to express an optional date through this
annotation.

**★ Treating `JavaTimeArgumentConverter` as public API.** Its javadoc page is not published in
6.0.3 while the annotation's is. Reference the annotation. I could not confirm from the
documentation which `java.time` types the converter supports beyond the `LocalDate` the guide
demonstrates.

**★ Expecting the pattern to be a JUnit dialect.** `value` is fed to
`DateTimeFormatterBuilder.appendPattern(String)`, so it is the ordinary `java.time` pattern
language — case-sensitive, with all the usual `dd`/`DD` and `mm`/`MM` traps intact.

**★ Extending `AnnotationBasedArgumentConverter` and skipping the `targetType` check.** The base
class resolves the annotation for you; it does not do type checking. You get `Object` and a
`Class<?>` exactly as with `SimpleArgumentConverter`, and the same obligation.

**★ Building a shared library on `AnnotationBasedArgumentConverter` without noting its status.** It
is `MAINTAINED`, not `STABLE`. That is a weaker compatibility promise than the two convenience base
classes beside it.

**★ Creating a composed annotation for a single use.** One extra file and one extra hop for a name
that says less than the converter's class name would have. Compose when there is configuration to
carry or several call sites to serve.

**★ Putting the configuration in the converter's constructor instead of the annotation.** A
converter is instantiated by JUnit, not by you ([08l](08l-explicit-conversion.md)) — a no-argument
constructor, or a single unambiguous one satisfied by a registered `ParameterResolver`. There is no
call site at which you could pass `"EUR"`. The annotation element is the mechanism that exists for
exactly that.

## Interview questions

**★ How does `@JavaTimeConversionPattern` work?**
It is a composed annotation: it is itself meta-annotated with
`@ConvertWith(JavaTimeArgumentConverter.class)`, has `@Retention(RUNTIME)` and targets
`ANNOTATION_TYPE`, `PARAMETER` and `FIELD`. JUnit sees `@ConvertWith` as a meta-annotation on it,
instantiates the named converter, and the converter reads the pattern out of the annotation
instance. From the test author's side that collapses converter plus configuration into one word at
the parameter.

**★ Why does `junit-jupiter-params` ship only one explicit converter?**
Because, as the guide puts it, *"explicit argument converters are meant to be implemented by test
and extension authors"*. Conversion beyond the built-in table is domain-specific; JUnit cannot
anticipate it. The `java.time` pattern converter exists because implicit conversion of `java.time`
types is ISO-8601 only, and a non-ISO date is a problem every project has.

**★ How would you write a converter that needs configuration — say a currency code?**
Extend `AnnotationBasedArgumentConverter<A>` and define an annotation `A` carrying the currency,
meta-annotated with `@ConvertWith(YourConverter.class)` and retained at runtime. The subclass hook
is `convert(Object source, Class<?> targetType, A annotation)`, and the annotation is documented as
*"never `null`"*. You cannot pass the currency through a constructor, because JUnit is the one
constructing the converter.

**★ What happens if you forget `@Retention(RUNTIME)`?**
The annotation is not visible to reflection, so the meta-`@ConvertWith` is never discovered and no
explicit conversion is applied. The parameter then goes through implicit conversion or the
fallback, and the failure — if there is one — talks about the parameter's type, never about your
annotation. It is the quietest mistake in this chunk.

**★ Does `@JavaTimeConversionPattern` accept a `null` date?**
Only if you ask it to. The `nullable` element defaults to `false`, and the javadoc states that a
`null` value then *"will result in an exception"*. Set `nullable = true` when the table genuinely
contains a missing date. The element is `@since 5.12`, so it does not exist on older Jupiter
versions.

**★ When is a composed converter annotation not worth it?**
When there is nothing to configure and one place using it. The indirection has to buy something —
a configuration value that would otherwise force one converter class per setting, or enough call
sites that the annotation becomes vocabulary. Otherwise `@ConvertWith(TheConverter.class)` names
the class directly and saves the reader a file.

**★ What is the API status of `AnnotationBasedArgumentConverter`, and why care?**
`MAINTAINED` since 5.13.3, added in 5.10 — a weaker promise than the `STABLE` status of
`SimpleArgumentConverter` and `TypedArgumentConverter`. It is fine to use, but if you are building a
shared test-support module that many teams depend on, that difference is worth writing down where
the next upgrade will find it.

{/* FOOTER */}
