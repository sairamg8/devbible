---
title: "@ConvertWith is the only one of the three conversion mechanisms that is visible at the call site, which is exactly why you reach for it when the conversion does real work or when the target type belongs to somebody else"
sidebar_label: "08l · Explicit conversion"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide, "Explicit Conversion" and
> "Argument Conversion"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> and the javadocs for `ConvertWith`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/ConvertWith.html))
> and `ArgumentConverter`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/ArgumentConverter.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**[08](08-conversion-and-aggregation.md) covered widening and the implicit table;
[08k](08k-fallback-conversion.md) covered the reflective fallback into your own production code.
Both are invisible at the call site — a reader sees a `String` in the table and a domain type in
the signature and has to already know a mechanism exists to connect the two. This chunk is the
third leg, and its value proposition is exactly the opposite: `@ConvertWith` writes the
conversion into the parameter declaration, where a reviewer cannot miss it and where nobody
else's refactoring can take it away.**

## The rule

> *"Instead of relying on implicit argument conversion, you may explicitly specify an
> `ArgumentConverter` to use for a certain parameter using the `@ConvertWith` annotation."*

`@ConvertWith` has one required element — *"The type of `ArgumentConverter` to use"* — and is
`@API(status = STABLE, since = "5.7")`, present since 5.0. Its `@Target` is
`{ANNOTATION_TYPE, PARAMETER, FIELD}`, which is three separate facts worth reading slowly:

- **`PARAMETER`** — the ordinary case, on a `@ParameterizedTest` method parameter.
- **`FIELD`** — on a `@Parameter`-annotated field of a `@ParameterizedClass`
  ([08e](08e-parameterized-class-field-injection.md)). The declared type of the *field* selects
  the conversion, exactly as the declared type of a parameter does.
- **`ANNOTATION_TYPE`** — it may be placed on *your own* annotation, which is how JUnit itself
  ships its only built-in explicit converter. That half is
  [08o](08o-annotation-driven-converters.md).

```java
@ParameterizedTest
@ValueSource(strings = { "PT15M", "PT2H30M" })
void rejectsShortWindows(@ConvertWith(IsoDurationConverter.class) Duration window) {
    assertThat(policy.accepts(window)).isFalse();
}
```

One annotation, one class name, one parameter. Nothing about that line requires the reader to
know the conversion table, the fallback rules, or anything at all about `Duration`.

## Two reasons to reach for it — and "the type is unusual" is not one of them

**The conversion does real work that a reader has to see.** A cell of `"1,234.50"` becoming a
`Money` is not a spelling change; it involves a locale, a scale and a rounding mode. A parameter
declared `Money amount` with nothing else on it hides all three, and the reviewer who wonders
whether `"1,234.50"` is one thousand or one point two has nowhere to look.
`@ConvertWith(EurAmount.class)` puts a class name in the signature that can be opened.

**The target type is one you do not own.** The fallback ([08k](08k-fallback-conversion.md)) fires
on any class that declares exactly one suitable single-`String` factory — including a third-party
one. A library release that adds an `of(CharSequence)` overload gives that type two candidates,
and the documented behaviour when multiple factory methods are discovered is that *"they will be
ignored"*. The conversion silently stops applying, and the change that caused it is in someone
else's changelog. An explicit converter you wrote cannot be revoked by a dependency bump.

Note what is *not* on that list: "the type is not in the implicit table". That alone is the
fallback's job, and the fallback does it with no code at all. Writing a converter for
`String → Iban` when `Iban.parse` already exists is ceremony that buys nothing.

## The three mechanisms, side by side

| | Implicit ([08](08-conversion-and-aggregation.md)) | Fallback ([08k](08k-fallback-conversion.md)) | Explicit (here) |
|---|---|---|---|
| **Triggered by** | the declared type being in the built-in table | the target type declaring exactly one suitable factory | the `@ConvertWith` annotation you wrote |
| **Governed by code in** | JUnit | 🔴 *your production module* | your test module |
| **Visible at the call site** | no | no | **yes** |
| **Configurable** | no | no | yes — the converter is a class you own |
| **Can be switched off by** | a JUnit upgrade changing the table | anyone adding a second single-`String`/`CharSequence` factory | nothing outside the converter |
| **Cost** | zero | zero | one class, one annotation per parameter |
| **Right when** | the type is `int`, `LocalDate`, an enum, a `Class`… | the type is yours and has one obvious parse method | the conversion does work, or the type is not yours |

The row that settles most arguments is **"governed by code in"**. Implicit and explicit
conversion are both controlled from inside the test module. The fallback is controlled from the
module *under test* — which is simultaneously the reason it is so pleasant to use and the reason
it is the only conversion mechanism a production refactoring can silently remove.

## Declaration: top-level, or `static` nested

> *"Note that an implementation of `ArgumentConverter` must be declared as either a top-level
> class or as a `static` nested class."*

So **yes, a converter can live inside the test class** — which is usually where a one-test
converter belongs — but the nesting must be `static`. A non-`static` inner class carries an
implicit reference to an enclosing instance that JUnit has no way to supply, so at the bytecode
level it has no no-argument constructor no matter what the source looks like.

```java
class PriceRulesTest {

	static class ToMoney extends TypedArgumentConverter<String, Money> {   // static — required
		ToMoney() { super(String.class, Money.class); }
		@Override protected Money convert(String source) { return Money.parse(source); }
	}

	@ParameterizedTest
	@CsvSource({ "12.50, 2.50", "0.00, 0.00" })
	void appliesVat(@ConvertWith(ToMoney.class) Money net,
	                @ConvertWith(ToMoney.class) Money vat) {
		assertThat(net.vatAt(STANDARD_RATE)).isEqualTo(vat);
	}
}
```

The identical sentence appears in the user guide for `ArgumentsAggregator`
([08i](08i-custom-aggregators.md)) and for `ArgumentsProvider` ([06](06-argumentssource.md)).
It is one rule stated three times, and forgetting `static` is the single most common way to fail
at all three.

## Instantiation: one constructor, no assumptions, thread-safe

> *"Implementations must provide a no-args constructor or a single unambiguous constructor to use
> parameter resolution."*

Two legal shapes, and no third. A no-argument constructor — which does **not** have to be
`public`; the user guide's own `ToLengthArgumentConverter` declares its as `protected` — or
**exactly one** constructor whose parameters a registered `ParameterResolver` can satisfy.
Adding a convenience constructor beside the no-argument one is precisely the ambiguity that
sentence rules out; it is not "JUnit will pick the empty one".

And the lifecycle is deliberately left undefined:

> *"They should not make any assumptions regarding when they are instantiated or how often they
> are called. Since instances may potentially be cached and called from different threads, they
> should be thread-safe."*

Read that as a prohibition on the obvious clever thing. A converter that counts invocations, or
caches the previous row, or keeps a `SimpleDateFormat` or a `Matcher` in a field, is relying on
an instantiation policy the javadoc explicitly refuses to promise — and under parallel execution
it is a data race inside your test infrastructure, which is the worst possible place for one.
Keep converters pure: value in, value out, no mutable fields, and only immutable configuration
assigned in the constructor.

## What comes next

The class you plug into the annotation — the three base classes and how to choose between them
— is [08m](08m-writing-a-converter.md). What that class does with a `null` source and what it
throws when a cell is not convertible is [08n](08n-null-and-conversion-failure.md). Hiding
`@ConvertWith` behind an annotation of your own, the way JUnit ships
`@JavaTimeConversionPattern`, is [08o](08o-annotation-driven-converters.md).

## Gotchas

**★ Writing a converter the fallback already covers.** If the target type is yours and declares
one single-`String` factory, and the cell is that value's natural written form, `@ConvertWith`
adds a class and removes nothing. The two honest triggers are "the conversion does work a reader
must see" and "I do not own the target type".

**★ A converter declared as a non-`static` inner class.** The guide requires *"a top-level class
or a `static` nested class"*. Inner classes have an implicit enclosing-instance parameter, so
they have no usable no-argument constructor regardless of how the source reads. The compiler is
happy; resolution is not.

**★ Two constructors on a converter.** The requirement is a no-argument constructor **or**
*"a single unambiguous constructor"*. A second constructor added later for convenience makes the
class ambiguous under the rule as written, and it will not be the constructor's own commit that
gets blamed. Keep exactly one.

**★ Assuming the no-argument constructor must be `public`.** It need not. The user guide's own
example declares `protected ToLengthArgumentConverter()`. A package-private converter with a
package-private constructor is fine and keeps it out of the production API surface.

**★ Putting mutable state in a converter.** Instances *"may potentially be cached and called from
different threads"* and you may not assume how often they are constructed. A row counter, a
memoisation map, or a shared formatter is a bug that shows up only under parallel execution or
on a rerun — and it will look like flakiness in the test, not in the converter.

**★ Doing expensive work inside `convert`.** It runs per argument per invocation, so it multiplies
by the number of rows and by the number of annotated parameters. Anything costly belongs in an
immutable field set in the constructor, which is the one kind of state the contract permits.

**★ Forgetting that `@ConvertWith` targets fields too.** In a `@ParameterizedClass`
([08c](08c-parameterized-classes.md)) the annotation goes on the `@Parameter` field, and the
field's declared type drives the conversion. A converter attached only to a constructor parameter
does nothing for the field-injection style.

**★ Using `@ConvertWith` to reshape a row.** A converter maps *one* argument to one value. A cell
that must become two fields, or two cells that must become one object, is an aggregator's job
([08b](08b-aggregation.md), [08i](08i-custom-aggregators.md)). I could not confirm from the
documentation what happens when `@ConvertWith` and `@AggregateWith` are placed on the same
parameter, so do not build on any particular outcome — choose one mechanism per parameter.

**★ Annotating every parameter with the same converter and calling it explicit.** If four
parameters in one signature all carry `@ConvertWith(ToMoney.class)`, the annotation has stopped
communicating and become noise. That is usually the signal that the row wants an aggregator, or
that a `@MethodSource` returning built objects ([04](04-methodsource.md)) is the honest version.

## Interview questions

**★ What does `@ConvertWith` do that implicit conversion does not?**
It names the converter in the parameter declaration. Implicit conversion and the fallback both
happen because of a *type* — one that JUnit's table knows, or one your production code
accidentally qualifies for — and neither leaves any trace at the call site. `@ConvertWith` puts a
class name exactly where the reviewer is already looking, and that class is one you own, so no
JUnit upgrade and no unrelated refactoring can change what it does.

**★ Where can `@ConvertWith` be applied?**
Its `@Target` is `{ANNOTATION_TYPE, PARAMETER, FIELD}`: on a `@ParameterizedTest` method
parameter, on a `@Parameter`-annotated field or constructor parameter of a `@ParameterizedClass`,
and on another annotation — the last of which is how composed annotations such as
`@JavaTimeConversionPattern` are built.

**★ Can a converter be a nested class inside the test class?**
Yes, provided it is `static`. The guide requires an implementation to be *"declared as either a
top-level class or as a `static` nested class"*. A non-`static` inner class needs an enclosing
instance that JUnit cannot supply, so it has no no-argument constructor to call.

**★ What are the constructor rules for a converter?**
*"Implementations must provide a no-args constructor or a single unambiguous constructor to use
parameter resolution."* The no-argument constructor does not need to be `public` — the guide's
own example makes it `protected`. If you want dependencies injected instead, there must be
exactly one constructor and a registered `ParameterResolver` capable of satisfying it; two
plausible constructors is the ambiguity the rule forbids.

**★ How often is a converter instantiated, and why does the answer matter?**
It is undefined on purpose. The javadoc says implementations *"should not make any assumptions
regarding when they are instantiated or how often they are called"* and that instances *"may
potentially be cached and called from different threads"*, so they must be thread-safe. The
practical consequence is that a converter must be stateless apart from immutable configuration —
no counters, no caches, no reused formatters.

**★ Contrast the three conversion mechanisms.**
Implicit conversion is a fixed table inside JUnit, keyed on the declared parameter type, and it
changes only when JUnit changes. The fallback reaches into the target type and uses its single
suitable single-`String` or `CharSequence` factory, so its trigger lives in production code and a
second overload disables it. Explicit conversion is a class you write, named at the parameter, so
it is the only one of the three a reader can see and the only one nothing outside your test module
can break.

**★ Why prefer an explicit converter for a type from a third-party library?**
Because the fallback's trigger lives inside that library. It applies only when the target type
declares *exactly one* suitable single-`String` or single-`CharSequence` factory; the moment a
release adds a second overload there are two candidates and, per the guide, *"they will be
ignored"*. Your test goes red on a dependency bump with nothing in your own diff to explain it.
An explicit converter depends on nothing but itself.

{/* FOOTER */}
