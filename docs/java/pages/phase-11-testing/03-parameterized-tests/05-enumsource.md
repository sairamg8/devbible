---
title: "@EnumSource is the only source whose case list updates itself when the code changes — which makes the choice between naming the constants you want and excluding the ones you do not the difference between a test that catches a new enum constant and one that ignores it"
sidebar_label: "05 · @EnumSource"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "@EnumSource"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `@EnumSource`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/EnumSource.html))
> and `EnumSource.Mode`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/EnumSource.Mode.html))
> pages. JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**Every other source is a list you maintain. `@EnumSource` with no attributes is a list the
compiler maintains for you: add a constant to the enum and the test runs against it tomorrow.
That property is the entire reason to use it — and it is exactly the property you throw away
the moment you write `names = { ... }` in `INCLUDE` mode.**

## The base case

```java
@ParameterizedTest
@EnumSource
void testWithEnumSourceWithAutoDetection(ChronoUnit unit) {
    assertNotNull(unit);
}
```

> *"The annotation's `value` attribute is optional. When omitted, the declared type of the
> first parameter is used. The test will fail if it does not reference an enum type."*

So the annotation can be empty when the parameter type says everything. Name the type when it
does not:

```java
@ParameterizedTest
@EnumSource(ChronoUnit.class)
void testWithEnumSource(TemporalUnit unit) {
    assertNotNull(unit);
}
```

> *"Thus, the `value` attribute is required in the above example because the method parameter
> is declared as `TemporalUnit`, i.e. the interface implemented by `ChronoUnit`, which isn't an
> enum type."*

## Selecting a subset: `names`, `from`/`to`, `mode`

> *"If no names or regular expressions are specified, and neither `from()` nor `to()` are
> specified, all enum constants declared in the specified enum type will be provided."*

**By name**, include being the default:

```java
@ParameterizedTest
@EnumSource(names = { "DAYS", "HOURS" })
void testWithEnumSourceInclude(ChronoUnit unit) { }
```

**By range** — added in 5.12:

> *"In addition to `names`, you can use the `from` and `to` attributes to specify a range of
> constants. The range starts from the constant specified in the `from` attribute and includes
> all subsequent constants up to and including the one specified in the `to` attribute, based
> on the natural order of the enum constants."*
>
> *"If `from` and `to` attributes are omitted, they default to the first and last constants in
> the enum type, respectively."*

```java
@ParameterizedTest
@EnumSource(from = "HOURS", to = "DAYS")
void testWithEnumSourceRange(ChronoUnit unit) { }
```

⚠️ "Natural order" for an enum is **declaration order** — ordinal order. A range is therefore
a statement about the *source file layout* of an enum, and reordering the constants (a change
that looks purely cosmetic) silently changes which cases run.

**By mode**, which is where the design decision lives:

| Mode | Selects | Since |
|---|---|---|
| `INCLUDE` (default) | only the constants named | 5.0 |
| `EXCLUDE` | all declared constants **except** those named | 5.0 |
| `MATCH_ALL` | constants whose names match **all** supplied regexes | 5.0 |
| `MATCH_ANY` | constants whose names match **any** supplied regex | 5.0 |
| `MATCH_NONE` | constants whose names match **none** of the regexes | 5.9 |

```java
@ParameterizedTest
@EnumSource(mode = EXCLUDE, names = { "ERAS", "FOREVER" })
void testWithEnumSourceExclude(ChronoUnit unit) { }

@ParameterizedTest
@EnumSource(mode = MATCH_ALL, names = "^.*DAYS$")
void testWithEnumSourceRegex(ChronoUnit unit) { }
```

Ranges and modes compose, and the javadoc is precise about how:

> *"The `mode` only applies to the `names()` attribute and does not change the behavior of
> `from()` and `to()`, which always define a range based on the natural order of the enum
> constants."*

> *"If `from()` or `to()` are specified, the elements in `names` must fall within the range
> defined by `from()` and `to()`."*

```java
@ParameterizedTest
@EnumSource(from = "HOURS", to = "DAYS", mode = EXCLUDE, names = { "HALF_DAYS" })
void testWithEnumSourceRangeExclude(ChronoUnit unit) { }
```

Read that as: take the range, then subtract the named constants from it.

## `INCLUDE` versus `EXCLUDE` is the whole argument

Consider an `OrderStatus` with `PLACED`, `PAID`, `SHIPPED`, `CANCELLED`, and a rule that only
`PLACED` and `PAID` orders may be cancelled.

```java
// Stale the moment anyone adds a constant.
@ParameterizedTest
@EnumSource(names = { "SHIPPED", "CANCELLED" })
void cannotCancel(OrderStatus status) {
    assertThatThrownBy(() -> service.cancel(orderWith(status)))
        .isInstanceOf(IllegalStateException.class);
}

// Notices the new constant, tomorrow, without anyone remembering to.
@ParameterizedTest
@EnumSource(mode = EXCLUDE, names = { "PLACED", "PAID" })
void cannotCancel(OrderStatus status) {
    assertThatThrownBy(() -> service.cancel(orderWith(status)))
        .isInstanceOf(IllegalStateException.class);
}
```

Both pass today. Add `REFUNDED` next quarter and only the second one runs against it — and
either it passes, confirming the new state is also non-cancellable, or it fails and tells
someone to think about it. **Express the exception, not the enumeration.** The set you name
should be the small set the rule carves out; the mode should be `EXCLUDE` so everything else is
covered by construction.

The same reasoning applies to a paired test: `@EnumSource(names = { "PLACED", "PAID" })` for
the positive case, `EXCLUDE` of the same two for the negative case. Together they cover every
constant that exists and every constant that will exist, and the two annotations name the same
list so a reviewer can see they are complements.

This is why `@EnumSource` is not interchangeable with
`@ValueSource(strings = { "PLACED", "PAID" })` even though implicit conversion makes the
latter compile and pass ([02](02-valuesource.md)). The strings do not track the enum.

## Repeatable

`@EnumSource` is `@Repeatable(EnumSources.class)`, so several selections can feed one test and
their constants concatenate. Useful when two disjoint ranges matter; a warning sign when it is
used to rebuild a set that `EXCLUDE` would express in one line.

## Gotchas

**★ Omitting `value` when the parameter is an interface or a supertype.** Auto-detection uses
the *declared* type of the first parameter, and the test fails if that type is not an enum. A
parameter typed `TemporalUnit`, `Comparable` or `Object` needs the explicit class.

**★ Using `INCLUDE` with an explicit list on a growing enum.** The test silently ignores every
constant added after it was written. This is the single most common way an enum-driven test
rots, and nothing about it ever goes red.

**★ Assuming `mode` filters the `from`/`to` range.** It does not — the mode applies only to
`names`. The range is always the natural-order span, and `names` are then included or excluded
within it.

**★ Naming a constant outside the `from`/`to` range.** The javadoc requires the elements of
`names` to fall within the range. A `names` entry outside it is a configuration error, not a
silently widened selection.

**★ Reordering enum constants when a test uses `from`/`to`.** Natural order is declaration
order, so moving a constant up or down the file changes which cases run. A range is a coupling
to source layout — prefer `EXCLUDE` unless the enum genuinely has an ordered meaning.

**★ A typo in `names`.** ⚠️ The user guide and the javadoc do not state what happens when a
name in `INCLUDE` or `EXCLUDE` mode matches no declared constant — **I could not confirm the
behaviour from the documentation.** Do not rely on either outcome: a mistyped `EXCLUDE` name
that is ignored would silently add a case, and a mistyped `INCLUDE` name that is ignored would
silently remove one. Copy constant names from the enum rather than typing them.

**★ Forgetting that `names` are regular expressions in the `MATCH_*` modes.** `"DAYS"` as a
regex matches any name *containing* DAYS unless you anchor it. The guide's own example uses
`"^.*DAYS$"` for exactly that reason.

**★ `MATCH_ALL` with a single pattern.** Equivalent to `MATCH_ANY` with the same pattern, which
makes the mode name misleading in the common case. The distinction only matters with two or
more patterns.

**★ Using a regex mode as a naming convention enforcement.** `MATCH_ANY` on `"^LEGACY_.*"` ties
your test suite to a naming scheme. When someone renames a constant, the test quietly covers
fewer cases rather than failing.

**★ Parameterizing over an enum when the enum is not the variable.** A test that runs over all
five statuses but asserts the same thing for four of them and something different for the fifth
is two tests. That argument is [09 · when not to parameterize](09-when-not-to-parameterize.md).

**★ Expecting `@EnumSource` to enumerate a sealed interface's implementations.** It is enum
constants only. A sealed hierarchy needs `@MethodSource`, and nothing keeps that list in sync
with the hierarchy.

## Interview questions

**★ When can you omit the enum type from `@EnumSource`?**
When the first parameter's declared type *is* the enum. The annotation falls back to that type,
and the test fails if it is not an enum type — which is why a parameter declared as an
interface the enum implements, such as `TemporalUnit` for `ChronoUnit`, still needs the
explicit `value`.

**★ What are the five modes?**
`INCLUDE` (default) selects only the named constants; `EXCLUDE` selects everything except them;
`MATCH_ALL`, `MATCH_ANY` and `MATCH_NONE` treat the names as regular expressions and select
constants matching all, any or none of them. `MATCH_NONE` arrived in 5.9.

**★ Why prefer `EXCLUDE` over `INCLUDE`?**
Because it keeps the test's coverage attached to the enum rather than to a list someone wrote
once. `EXCLUDE` names the exceptions to a rule, so a constant added later is automatically
covered by the rule; `INCLUDE` names the members, so a constant added later is silently
ignored. The first design fails loudly when reality changes, the second stays green.

**★ How do `from` and `to` work, and what is the risk?**
They define an inclusive range over the enum's natural — that is, declaration — order,
defaulting to the first and last constants. The risk is that declaration order is source
layout: reordering the constants for readability changes which cases run, with no test failure
to signal it.

**★ How do `mode` and the range interact?**
The mode applies only to `names`. The range is computed first from natural order, then the
named constants are included or excluded within it — so `from = "HOURS", to = "DAYS",
mode = EXCLUDE, names = "HALF_DAYS"` means "the HOURS-to-DAYS span, minus HALF_DAYS". The
javadoc also requires the names to fall inside the range.

**★ Is `@EnumSource` the same as listing the constant names in a `@ValueSource`?**
Functionally, for today's constants — implicit conversion turns `"PLACED"` into the enum
constant. Structurally, no: the strings are a snapshot and the enum is not. `@EnumSource` with
`EXCLUDE` is the version that notices when the enum grows.

**★ How would you write a test that fails when someone adds an enum constant?**
Cover the enum with two complementary `@EnumSource` methods — the positive case naming the
constants the rule admits, the negative case excluding exactly those names. Every constant
falls into one of the two, so a new constant lands in the `EXCLUDE` test and must satisfy the
general rule or the build breaks.

{/* FOOTER */}
