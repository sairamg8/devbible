---
title: "A converter is contractually expected to be handed null and is only sometimes allowed to hand one back, and when it refuses a value the exception message it writes is the entire user interface of the failure — because the test body never ran"
sidebar_label: "08n · Null and conversion failure"
sidebar_position: 29
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide, "`@CsvSource`" and
> "Explicit Conversion"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> and the javadocs for `TypedArgumentConverter`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/TypedArgumentConverter.html))
> and `ArgumentConversionException`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/converter/ArgumentConversionException.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**[08m](08m-writing-a-converter.md) picked the base class. This chunk is the two things that are
easiest to get wrong once you have one: what your `convert` method does when it is handed `null`,
and what it throws when the value in front of it is not convertible. Both matter more than they
look, because a conversion failure happens before the test body — so the only information anyone
gets about it is the sentence your converter wrote.**

## `null` arrives, and it arrives on purpose

Both the public and the protected `convert` on `TypedArgumentConverter` document the source as
*"may be `null`"*, and both document the return as:

> *"the converted object; may be `null` but only if the target type is a reference type"*

A converter is therefore *expected* to receive `null`. It is not an edge case somebody forgot —
`@NullSource`, `@NullAndEmptySource`, and any CSV cell listed in `nullValues`
([02b](02b-null-and-empty.md)) all deliver one deliberately, because the null case is usually the
most interesting row in the table.

The return side is constrained because a parameter may be primitive. The user guide states the
consequence directly, under `@CsvSource`:

> *"An `ArgumentConversionException` is thrown if the target type of a `null` reference is a
> primitive type."*

That is why the guide's own `ToLengthArgumentConverter` maps `null` to `0` instead of passing it
through: its declared target is `Integer`, but the parameter it is attached to may well be an
`int`.

## Three defensible answers, and one failure

```java
// 1. null is a case in this table: map it to a value.
@Override protected Integer convert(String source) {
	return (source != null ? source.length() : 0);
}

// 2. null passes through: legal only because the target is a reference type.
@Override protected Duration convert(String source) {
	return (source != null ? Duration.parse(source) : null);
}

// 3. null is never valid here: say so where the reader will see it.
@Override protected Duration convert(String source) {
	if (source == null) {
		throw new ArgumentConversionException("a null window is not a case this policy accepts");
	}
	return Duration.parse(source);
}
```

The failure is the fourth option — not deciding. A converter that dereferences `source` unguarded
turns a deliberate `@NullSource` row into a `NullPointerException` thrown during argument
resolution. That report is strictly worse than either of the alternatives: it names a line inside
your converter, not the row, not the parameter, and not the fact that `null` was the point of the
row in the first place.

Option 2 deserves one caution. It is legal *only* while the parameter stays a reference type. If
someone later changes `Duration window` to a primitive — or, more realistically, if the same
converter is reused on an `int` parameter elsewhere — the pass-through becomes the exact situation
the guide's sentence describes, and the failure appears at a call site the converter's author
never saw.

## `ArgumentConversionException` is the converter's user interface

> *"`ArgumentConversionException` is an exception that can occur when an object is converted to
> another object by an implementation of an `ArgumentConverter`."*

It extends `JUnitException` (from `org.junit.platform.commons`), offers `(String)` and
`(String, Throwable)` constructors, and is `@API(status = STABLE, since = "5.7")`. It is the
declared `throws` on every `convert` method on every rung of the ladder.

```java
public class IsoDurationConverter extends TypedArgumentConverter<String, Duration> {

	protected IsoDurationConverter() {
		super(String.class, Duration.class);
	}

	@Override
	protected Duration convert(String source) {
		if (source == null) {
			throw new ArgumentConversionException("a null duration is never a valid case here");
		}
		try {
			return Duration.parse(source);
		}
		catch (DateTimeParseException ex) {
			throw new ArgumentConversionException(
					"'" + source + "' is not an ISO-8601 duration such as PT15M", ex);
		}
	}

}
```

Three lines of ceremony, and this is what they buy. The message names **the offending cell** and
**the format it should have had**, which is the difference between a reviewer fixing the table in
ten seconds and a reviewer opening the converter to work out what it wanted. And the `cause` is
preserved, so the underlying `DateTimeParseException` — which carries the index at which parsing
gave up — is still attached to the report rather than discarded.

Throwing a bare `IllegalArgumentException` instead "works", in the sense that the invocation
fails. But you have thrown away the framework's own vocabulary for *"the argument never became a
value"*, and the failure now reads exactly like a defect in the code under test.

## 🔴 A conversion failure is not a test failure

It happens during argument resolution, before the test method is entered. Nothing the test exists
to check has executed — no arrange, no act, no assert. When you see one, the bug is in exactly one
of three places:

1. **The cell** — a typo, a wrong format, a column that shifted when someone inserted another one.
2. **The parameter's declared type** — the table is right and the signature drifted.
3. **The converter** — it does not accept a form that the table legitimately contains.

The converter is the only code that has seen the raw cell, which is why its message is the whole
diagnosis. `"'14/03/2017' is not an ISO-8601 duration such as PT15M"` distinguishes case 1 from
case 3 on sight. `"conversion failed"` distinguishes nothing.

This is also the argument against a converter that quietly recovers:

```java
// Never: the row now passes for a reason the table never described.
@Override protected Money convert(String source) {
	try {
		return Money.parse(source);
	}
	catch (RuntimeException ex) {
		return Money.ZERO;
	}
}
```

A malformed cell becomes `Money.ZERO`, the assertion runs against a value nobody wrote down, and
the test is green. That is a row passing for the wrong reason — the failure mode
[10](10-the-checklist.md) exists to catch — manufactured inside the converter where no reviewer
of the table can see it.

## When the converter has stopped converting

```java
// Smell: the converter decides what the test asserts.
@Override
protected Order convert(String source) {
	Order order = Order.of(source);
	if (source.startsWith("CANCELLED:")) {
		order.cancel();          // the "conversion" now has behaviour in it
	}
	return order;
}
```

Once a converter branches on the content of a cell to produce structurally different objects, the
table has stopped being data: an encoding has grown inside it, and the branch is invisible both in
the test method and in the report. That is the point at which a `@MethodSource` returning built
objects ([04](04-methodsource.md)) is the honest version, and the general form of that argument is
[09](09-when-not-to-parameterize.md).

## Gotchas

**★ Dereferencing `source` without a `null` check.** The source is documented as *"may be
`null`"*. `@NullSource`, `@NullAndEmptySource` and a CSV `nullValues` cell all deliver one, and an
unguarded converter turns a deliberate null case into a `NullPointerException` raised during
resolution — pointing at a line in the converter rather than at the row.

**★ Returning `null` into a primitive parameter.** The javadoc constrains the return to *"may be
`null` but only if the target type is a reference type"*, and the guide spells out the
consequence: *"An `ArgumentConversionException` is thrown if the target type of a `null` reference
is a primitive type."*

**★ A `null`-passing converter reused on a primitive parameter.** The pass-through was correct
where it was written, because that parameter was a reference type. Reuse — or a later change from
`Integer` to `int` — makes it wrong, and the breakage lands in a test the converter's author never
opened.

**★ Throwing a bare runtime exception instead of `ArgumentConversionException`.** The invocation
fails either way, but you lose the framework's signal that the *argument* never became a value,
and the report reads like a bug in the system under test.

**★ Forgetting to pass the cause.** `ArgumentConversionException(String, Throwable)` exists.
Swallowing the `DateTimeParseException` or `NumberFormatException` throws away the parse position
— often the single most useful fact about a malformed cell.

**★ A message that does not name the value.** The converter is the only code that has seen the raw
cell. If its message says only "invalid duration", the reader has to count columns in the source to
find which one. Interpolate the source string into the message, every time.

**★ A message that does not name the expected format.** "Not a valid duration" tells the reader
what is wrong and not what to write instead. `"… such as PT15M"` closes the loop without them
opening the converter at all.

**★ Catching `Exception` inside `convert` and returning a default.** The row then passes for a
reason the table never stated. This is the worst outcome in the topic: not a red test, a green one
asserting on a value nobody wrote.

**★ Debugging a conversion failure as if the system under test were broken.** It ran before the
test body. Reading the stack trace for a clue about your service is time spent on the wrong file —
check the cell, the declared parameter type, and the converter, in that order.

**★ A converter that branches on cell content to build different shapes of object.** That is logic
hiding in the data. The test method no longer says what a row means, and the report cannot show
the branch. Build the objects in a `@MethodSource` factory instead.

## Interview questions

**★ What should a converter do with a `null` source?**
Decide, and encode the decision. `null` is a legitimate source — the javadoc documents it as *"may
be `null`"* — arriving from `@NullSource`, `@NullAndEmptySource` or a CSV `nullValues` cell. You
may map it to a value, as the guide's `ToLengthArgumentConverter` does with `0`; you may return
`null`, but only into a reference type; or you may throw `ArgumentConversionException` if `null` is
not a case that table should ever contain. What you may not do is leave it unconsidered and ship a
converter that throws `NullPointerException` from inside argument resolution.

**★ Why is the converter's return value constrained on `null`?**
Because a parameter may be a primitive, and there is no `null` to hand to an `int`. The javadoc
says the result *"may be `null` but only if the target type is a reference type"*, and the user
guide states the failure directly: *"An `ArgumentConversionException` is thrown if the target type
of a `null` reference is a primitive type."*

**★ A parameterized test fails with an `ArgumentConversionException`. Where is the bug?**
Not in the system under test — it never ran. Conversion happens during argument resolution, so the
fault is in the cell, in the parameter's declared type, or in the converter. That is the practical
reason to make the message name the offending value and the expected format: it tells the reader
immediately which of the three it is.

**★ Why not just let a `NumberFormatException` escape from `convert`?**
Because it is unlabelled. `ArgumentConversionException` says "the argument never became a value",
which routes the reader to the table; a raw `NumberFormatException` looks like a parsing bug in the
code under test. Wrap it and keep it as the cause, so the parse position survives into the report.

**★ Is it ever right for a converter to swallow a parse error and return a default?**
No. That makes a malformed row pass against a value the table never described — a row passing for
the wrong reason, which is the thing a reviewer is least able to detect by reading the table. If a
missing or unparseable cell is a legitimate case, model it as `null` or as an explicit sentinel in
the table, where it is visible.

**★ How do you tell that a converter has stopped being a converter?**
When it branches on the content of the cell to produce structurally different objects, or when it
performs actions on the object it builds. At that point the row's meaning lives in the converter
rather than in the table, the test method no longer states what it is testing, and the honest
rewrite is a `@MethodSource` factory that builds each object in Java.

{/* FOOTER */}
