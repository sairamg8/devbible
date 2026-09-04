---
title: "The second half of the review pass covers the three things a reader cannot see in a table — what null and empty actually mean in each source, which conversions are happening silently, and whether the columns are data or a hidden switch statement"
sidebar_label: "10b · Checklist: data and shape"
sidebar_position: 37
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide, "Null and Empty Sources",
> "`@CsvSource`" and "Argument Conversion"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)).
> Every quote below is one already verified in the chunk it links to; this page adds no new claims
> about JUnit's behaviour.
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**[10](10-the-checklist.md) covered the report, the rows that can pass wrongly, and the source.
These four groups are the ones that need a fact you have to know rather than a judgement you can
make: exactly what `@EmptySource` produces, exactly which conversions fire without a trace, and
what a `@ParameterizedClass` shares between invocations. Then the two-minute pass you actually
run.**

## 4 · Is `@NullAndEmptySource` doing what the author thinks?

☐ **Is `@NullSource` attached to a primitive parameter?** It cannot work:

> *"Note that `@NullSource` cannot be used for an argument that has a primitive type, unless the
> argument is converted to a corresponding wrapper type with an `ArgumentConverter`."*

Change the parameter to the wrapper, or supply a converter ([02b](02b-null-and-empty.md),
[08l](08l-explicit-conversion.md)). This is a resolution-time failure, not a compile error, so the
diff looks fine.

☐ **Is `@EmptySource` attached to a type it supports?** The list is closed and specific —
`String`, `Collection` and its named subtypes, `Map` and its named subtypes, and primitive or
object arrays ([02b](02b-null-and-empty.md)). An `@EmptySource` on an `Optional`, a domain type or
an `int` is not "empty"; it is unsupported.

☐ **Does the author mean *empty* or *blank*?** `@EmptySource` gives `""`. A string of spaces, a
tab and a newline are different cases, and the guide's own advice is to list them:
*"`@ValueSource(strings = {" ", "   ", "\t", "\n"})`"*. There is no `@BlankSource`
([02b](02b-null-and-empty.md)).

☐ **In a `@CsvSource`, does the author know which cells are `null`?** The rule is exact and
frequently surprising:

> *"**NOTE:** An unquoted empty value will always be converted to a `null` reference"*
>
> *"An empty, quoted value (`''`) results in an empty `String` unless the `emptyValue()` attribute
> is set"*

So `a,,c` has a `null` in the middle and `a,'',c` has an empty string ([03](03-csvsource.md)). A
row written to test "empty input" that omitted the quotes is testing `null` instead — and probably
still passing.

☐ **Is `nullValues` overloaded to mean "not applicable"?** A `-` that means "this rule does not
apply to this row" destroys the ability to test a genuinely `null` input, because the two are
indistinguishable ([09b](09b-when-the-table-stops-being-data.md)).

☐ **Does a converter handle `null` deliberately?** `@NullSource`, `@NullAndEmptySource` and a
`nullValues` cell all reach the converter. An unguarded `convert` turns the deliberate null row
into a `NullPointerException` during resolution ([08n](08n-null-and-conversion-failure.md)).

☐ **Does the null row assert something the other rows do not?** If `null` and `""` produce the
same behaviour as `"  "`, that is worth one row and one assertion. If they differ, they are
different cases and probably different tests ([09](09-when-not-to-parameterize.md)).

## 5 · Does a conversion happen that a reader cannot see?

☐ **Is a parameter's type different from what the table contains?** A `String` cell and a
`LocalDate`, `Duration`, `Currency` or domain-type parameter means a conversion fired. Which of
the three mechanisms was it ([08l](08l-explicit-conversion.md))? A reviewer who cannot answer that
does not know what the row means.

☐ **Is a date or time written in a non-ISO format?** Implicit `java.time` conversion is ISO-8601
only ([08](08-conversion-and-aggregation.md)). `"14/03/2017"` needs
`@JavaTimeConversionPattern("dd/MM/yyyy")` ([08o](08o-annotation-driven-converters.md)).

☐ **Is a `Locale` written as `"en_US"`?** 🔴 6.0 changed `Locale` conversion; the details and the
quote are in [08](08-conversion-and-aggregation.md). Any `Locale` cell in a project that upgraded
to Jupiter 6 deserves a look.

☐ **Is the row relying on fallback conversion into a type you do not own?** It works only while
that type has exactly one suitable single-`String` or `CharSequence` factory. A dependency upgrade
that adds an overload disables it, with nothing in your diff
([08k](08k-fallback-conversion.md)).

☐ **Did this diff add a `static` factory method to a value type?** That is the change that breaks
fallback conversion in a test module the author never opened
([08k](08k-fallback-conversion.md)). It is worth grepping for `@CsvSource` uses of the type.

☐ **Does a converter hold state?** Instances may be cached and called from several threads, and
the instantiation policy is explicitly undefined. Fields other than immutable configuration are a
race ([08l](08l-explicit-conversion.md)).

☐ **Is the converter a `static` nested class?** A non-`static` inner class cannot be instantiated
by JUnit ([08l](08l-explicit-conversion.md)). Same rule for aggregators
([08i](08i-custom-aggregators.md)) and providers ([06](06-argumentssource.md)).

☐ **Does the converter's exception message name the offending value and the expected format?** It
is the only code that has seen the raw cell, and a conversion failure means the test body never
ran ([08n](08n-null-and-conversion-failure.md)).

## 6 · Is the table doing selection rather than data?

The six shapes from [09](09-when-not-to-parameterize.md) onwards, as things to look for in a diff:

☐ **A parameter consumed by an `if` in the method body** — a branch selector, which the report
cannot show ([09](09-when-not-to-parameterize.md)).

☐ **An `expected` column typed `String` when every real value is a number** — widened so one row
could carry a sentinel meaning "and this one throws"
([09](09-when-not-to-parameterize.md)).

☐ **A first column of prose** — rules that should be method names
([09b](09b-when-the-table-stops-being-data.md)).

☐ **A column that is `null` on most rows** — several rules sharing a signature, with
`if (x != null)` scaffolding to prove it ([09b](09b-when-the-table-stops-being-data.md)).

☐ **A loop, filter or computation in the source** — coverage that lives outside the file
([09c](09c-the-source-that-grew-logic.md)).

☐ **A column typed `Consumer`, `Runnable`, `Supplier` or `Function`** — arrangement smuggled into
data ([09d](09d-setup-drift-and-computed-expectations.md)).

☐ **An assertion whose expected side is an expression containing the parameter** — the test has
re-implemented the code ([09d](09d-setup-drift-and-computed-expectations.md)).

☐ **And the counter-check, which matters just as much:** if the table is long but every row takes
the same path, the expectations are written down, deleting a row loses an example, and the rows
read as a specification — leave it alone
([09e](09e-when-a-big-table-is-right.md)). Length is not a finding.

## 7 · If it is a `@ParameterizedClass`

☐ **Constructor injection or field injection?** They have different rules and different failure
modes ([08d](08d-parameterized-class-injection.md),
[08e](08e-parameterized-class-field-injection.md)).

☐ **Do the lifecycle hooks assume a fresh instance?** What runs per invocation and in what order
is [08f](08f-parameterized-class-lifecycle.md) and
[08g](08g-invocation-hook-ordering.md); an assumption here is the classic source of a suite that
passes in isolation and fails in sequence.

☐ **Is any injected argument mutable, and is it mutated?** Argument lifetime — including what
JUnit closes for you — is [08h](08h-argument-lifetime.md). A row that mutates a shared object
changes the meaning of every row after it.

☐ **Is an aggregator being used, and does it validate its width?**
[08i](08i-custom-aggregators.md) and [08j](08j-argument-count-validation.md).

## The two-minute pass

When you have two minutes and not twenty, these six questions catch most of it:

1. **Read the name pattern.** Will a red row name itself?
2. **What varies between rows that is not data?** Branch, setup, applicability, justification.
3. **Where did each expected value come from?** A human, or an expression?
4. **What would have to be broken for a row to fail?** If the answer is "not much", the assertion
   is too weak.
5. **Can the source produce zero rows?** A filter, a `names` regex, an empty file.
6. **Is anything being converted silently?** A `String` cell and a non-`String` parameter.

Everything else on this page is a refinement of one of those six.

## Gotchas

**★ Reading `@EmptySource` as "blank".** It produces `""` for a closed list of types. A test that
meant to cover `"   "` has not, and the guide's own remedy is an explicit `@ValueSource` of blank
strings.

**★ Assuming an empty CSV cell is an empty string.** *"An unquoted empty value will always be
converted to a `null` reference."* The row testing "empty input" is testing `null`, and probably
passing anyway.

**★ Approving `@NullSource` on a primitive.** It cannot resolve. The guide's one escape is a
converter producing the wrapper type, which is a deliberate choice and not an accident.

**★ Not asking which conversion mechanism fired.** A `String` cell and a domain-type parameter is
one of three different situations with three different fragilities, and only one of them is
visible at the call site.

**★ Missing a fallback break in an unrelated diff.** Adding a second single-`String` factory to a
value type disables fallback conversion everywhere it was used. The diff that breaks the test does
not contain the test.

**★ Letting a `Locale` cell through unexamined on Jupiter 6.** The conversion changed in 6.0;
anything written as `"en_US"` is worth a second look after an upgrade.

**★ Reviewing a `@ParameterizedClass` as if it were a `@ParameterizedTest`.** It has its own
injection, lifecycle and argument-lifetime rules, and shared mutable state across invocations is a
category of bug that does not exist in the method form.

**★ Flagging a long table.** Length on its own is never a finding, and a reviewer who has read the
smells and not the counter-case will split a conformance suite that was correct
([09e](09e-when-a-big-table-is-right.md)).

**★ Running the checklist as a form.** It is an ordering of attention, not a gate. The two-minute
pass exists because six questions asked properly beat thirty ticked mechanically.

## Interview questions

**★ What does `@EmptySource` actually produce, and for what?**
A single empty argument, for a closed list of types: `String`, `Collection` and its named subtypes,
`Map` and its named subtypes, and primitive or object arrays. It is *empty*, not blank — `""`, not
`"   "` — and there is no `@BlankSource`, because the guide's position is that blankness is
open-ended and you should list the blank strings you care about in a `@ValueSource`.

**★ In `@CsvSource`, what is the difference between `a,,c` and `a,'',c`?**
The first has a `null` in the middle: *"An unquoted empty value will always be converted to a
`null` reference."* The second has an empty `String`, because *"an empty, quoted value (`''`)
results in an empty `String` unless the `emptyValue()` attribute is set"*. It is the single most
commonly misread rule in this topic, and a test meaning to cover empty input usually covers `null`
instead.

**★ Why can't `@NullSource` feed a primitive parameter?**
Because there is no `null` to pass to an `int`. The guide states it directly and gives exactly one
escape: convert the argument to the corresponding wrapper type with an `ArgumentConverter`. The
failure happens during argument resolution, so nothing about the diff or the compile flags it.

**★ You see a `String` cell and a `Duration` parameter. What do you ask?**
Which of the three conversion mechanisms is responsible. If it is implicit, the format is fixed by
JUnit. If it is the fallback, the conversion depends on `Duration` declaring exactly one suitable
factory — a property of code you do not own. If it is explicit, there is a converter class named at
the parameter and the answer is in the repository. Only the third is stable and visible.

**★ Which single review finding is worth the most?**
An expected value that is computed from the input. Everything else makes a test harder to diagnose;
that one makes it incapable of failing for the reason it exists. It also tends to hide the
interesting cases, because nobody had to sit down and decide what the answer should be at the
boundaries.

**★ A pull request adds a `static of(CharSequence)` overload to a value class. Which tests do you
check?**
Every parameterized test that puts that type in a signature and a string in the table. Fallback
conversion applies only when the target type declares exactly one suitable factory; a second
overload means there are two candidates, which are ignored, and the conversion stops. The affected
tests may be in modules the diff never touches.

{/* FOOTER */}
