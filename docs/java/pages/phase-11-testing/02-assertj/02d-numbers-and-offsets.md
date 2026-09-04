---
title: "Floating-point assertions need a tolerance, AssertJ gives you two kinds of tolerance whose boundary behaviour differs, and isEqualTo on a primitive double is == rather than equals"
sidebar_label: "02d · Numbers and offsets"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the `assertj-core` 3.27.7 sources
> (`org.assertj.core.data.Offset`, `org.assertj.core.data.Percentage`,
> `AbstractDoubleAssert.isEqualTo(double)`, `Assertions.within` / `byLessThan` /
> `withPrecision` / `withinPercentage`) and the AssertJ Core documentation, "Specifying how
> to compare specific types or fields in the comparison"
> ([assertj.github.io/doc](https://assertj.github.io/doc/#assertj-core-recursive-comparison-comparators)).
> JDK 25 · Spring Boot 4.1.1 → AssertJ Core 3.27.7, JUnit Jupiter 6.0.3.

**IEEE 754 binary doubles cannot represent most decimal fractions exactly, so a computed
`double` is almost never bit-identical to a literal you type. Every assertion library
therefore offers a tolerance, and AssertJ offers two — `within` and `byLessThan` — that
differ only at the boundary, which is exactly where the interesting failures live. On top
of that, `isEqualTo` on a `double` is not `Double.equals`, and AssertJ says so in its own
javadoc because the difference bites on `NaN` and on negative zero.**

## `isEqualTo(double)` is `==`, and `isEqualTo(Double)` is not

This is documented on `AbstractDoubleAssert.isEqualTo(double)`, verbatim:

> *"Unless a specific comparator has been set (with `usingComparator`) the equality is
> performed with `==` which is slightly different from `Double.equals(Object)` - notably:
> `0.0 == -0.0` but `Double.valueOf(0.0).equals(-0.0) == false`;
> `Double.NaN != Double.NaN` but `Double.valueOf(Double.NaN).equals(Double.NaN) == true`."*

So the overload the compiler picks decides the semantics:

```java
assertThat(-0.0).isEqualTo(0.0);              // passes  — primitive overload, ==
assertThat(Double.NaN).isEqualTo(Double.NaN); // fails   — primitive overload, ==
```

AssertJ cares enough about the second case to special-case the message. From the source:

```java
if (Double.valueOf(expected).equals(Double.NaN) && actual.equals(Double.NaN))
  throw new AssertionError("Actual and expected values were compared with == because expected was a primitive double, the assertion failed as both were Double.NaN and Double.NaN != Double.NaN (as per Double#equals javadoc)");
```

That is a message written specifically so that a developer staring at "expected NaN but
was NaN" does not lose an afternoon. If you genuinely mean "this is not a number", the
assertion is `isNaN()`.

## Two tolerances: `within` is inclusive, `byLessThan` is not

`Offset` carries a `strict` flag, and its field javadoc states the boundary rule directly:

> *"When |actual-expected|=offset and strict is true the
> `assertThat(actual).isCloseTo(expected, offset);` assertion will fail."*

The two factory methods differ in exactly that flag:

```java
public static <T extends Number> Offset<T> offset(T value) {      // within(...) is an alias
  checkArgument(value.doubleValue() >= 0d, "An offset value should be greater than or equal to zero");
  return new Offset<>(value, false);
}

public static <T extends Number> Offset<T> strictOffset(T value) { // byLessThan(...) is an alias
  checkArgument(value.doubleValue() > 0d, "A strict offset value should be greater than zero");
  return new Offset<>(value, true);
}
```

Note the precondition difference too: `within(0.0)` is legal (it degenerates to exact
equality); `byLessThan(0.0)` throws `IllegalArgumentException`, because nothing can be
strictly closer than zero.

`Assertions.byLessThan`'s own javadoc spells out the boundary case:

> *"A strict offset implies a strict comparison which means that `isCloseTo` will fail when
> abs(actual - expected) == offset."*

```java
// assertion succeeds
assertThat(8.1).isCloseTo(8.0, byLessThan(0.2));

// assertions fail
assertThat(8.1).isCloseTo(8.0, byLessThan(0.1)); // strict comparison!
assertThat(8.1).isCloseTo(8.0, byLessThan(0.01));
```

The names are the mnemonic: `within(0.1)` means "at most 0.1 away", `byLessThan(0.1)`
means "strictly less than 0.1 away". Pick `within` unless the boundary genuinely matters,
because the boundary is where floating-point residue puts you.

## The three aliases for the same `Offset`

`within`, `offset` and `withPrecision` all return `Offset.offset(value)`. They differ only
in which assertion they read well against:

```java
assertThat(0.1).isCloseTo(0.0, within(0.1));       // isCloseTo
assertThat(0.1).isEqualTo(0.0, withPrecision(0.1)); // isEqualTo with an offset
```

`isEqualTo(double, Offset)` exists precisely so the tolerant form still reads as equality.
It is the same comparison as `isCloseTo`.

## Relative tolerance: `withinPercentage`

Absolute tolerance is the wrong tool when the magnitude varies — a tolerance of 0.01 is
generous for a total of 3 and meaningless for a total of 3,000,000.

```java
assertThat(computed).isCloseTo(expected, withinPercentage(0.5));
```

`Percentage` requires a non-negative value (`"The percentage value <%s> should be greater
than or equal to zero"`) and is expressed in percent, not as a fraction — `withinPercentage(5)`
is five percent, not five hundred percent. `isCloseTo(expected, Percentage)` overloads exist
on the integral asserts too, so it works for counts and sizes as well as for doubles.

## What the recursive comparison does by default

This catches people out because it is a *different* default from `isEqualTo`. The
documentation states it plainly:

> *"By default floats are compared with a precision of 1.0E-6 and doubles with 1.0E-15."*

and the configuration dump AssertJ prints in a recursive-comparison failure names the
comparators it used:

```
- these types were compared with the following comparators:
  - java.lang.Double -> DoubleComparator[precision=1.0E-15]
  - java.lang.Float -> FloatComparator[precision=1.0E-6]
  - java.nio.file.Path -> lexicographic comparator (Path natural order)
```

So `assertThat(a).isEqualTo(b)` on two doubles is exact, while
`assertThat(dtoA).usingRecursiveComparison().isEqualTo(dtoB)` is tolerant to 1.0E-15 on the
double fields inside. Two assertions that look like the same question give different
answers on the same data, and the recursive one is the lenient one. To widen it further,
`withEqualsForType(closeEnough, Double.class)` — see
[04 · The recursive comparison](04-recursive-comparison.md).

## The real fix: do not use `double` for money

Every tolerance discussion in a financial codebase is a symptom. `double` cannot represent
0.10 exactly, so a ledger built on it accumulates residue that no tolerance makes correct —
it only makes the test stop noticing. `BigDecimal` with an explicit scale, or an integral
number of minor units, removes the question. Then assert with `isEqualByComparingTo` and
the scale problem from
[02c · Equality vs identity](02c-equality-identity-and-comparators.md) is the only one left.

Tolerances are right for genuinely approximate quantities: physical measurements,
statistical aggregates, geometry, anything where the input was already an approximation.

## Gotchas

**★ `assertThat(Double.NaN).isEqualTo(Double.NaN)` fails.**
The primitive overload compares with `==`, and `NaN != NaN` by IEEE 754. AssertJ throws a
message that explains exactly this rather than the generic one. Use `isNaN()`.

**★ `assertThat(-0.0).isEqualTo(0.0)` passes, but `assertThat(Double.valueOf(-0.0)).isEqualTo(Double.valueOf(0.0))`
does not.**
`==` treats the two zeros as equal; `Double.equals` does not. Which one you get depends on
whether the compiler picked the primitive or the boxed overload, which depends on how your
variables are declared.

**★ `byLessThan(0.0)` throws `IllegalArgumentException`; `within(0.0)` does not.**
`strictOffset` requires a value strictly greater than zero. A parameterised test that
sweeps tolerances down to zero will blow up on the strict variant and not on the inclusive
one.

**★ `byLessThan` fails at exactly the tolerance and `within` passes there.**
This is the entire difference between them and it is invisible in a code review unless you
know it. A test that passes with `within(0.1)` and fails with `byLessThan(0.1)` is not
flaky — it is on the boundary.

**★ `withinPercentage(5)` is 5 %, not 5×.**
The value is a percentage, not a fraction. `withinPercentage(0.05)` is five hundredths of
one percent, which is almost certainly not what you meant.

**★ The recursive comparison is tolerant on doubles and floats where `isEqualTo` is exact.**
1.0E-15 and 1.0E-6 respectively, by default. Switching a test from field-by-field
`isEqualTo` assertions to `usingRecursiveComparison` silently loosens the double
comparisons.

**★ A tolerance chosen to make the test pass is a test that has stopped asserting.**
If the tolerance had to be widened to accommodate the current implementation, the number
now encodes the implementation's error rather than the requirement's. Derive it from the
requirement, or fix the arithmetic.

**★ `isCloseTo` with a large offset silently passes for a completely wrong value.**
`isCloseTo(0.0, within(1000.0))` is a weak assertion in the sense of
[02b](02b-assertions-that-assert-nothing.md) — count how many wrong values would still
pass.

**★ Comparing a `float` against a `double` literal drags widening conversion into the
assertion.**
`assertThat(someFloat).isEqualTo(0.1)` does not compile against `FloatAssert`'s `isEqualTo(float)`
in the way you might expect; the `0.1` literal is a `double`. Write `0.1f`, or assert on a
double throughout.

**★ Integer division upstream is not a floating-point problem and no tolerance will fix
it.**
`(a / b) * 100` with `int` operands truncates before the multiply. The test fails by a
whole unit, the instinct is to add a tolerance, and the bug ships. If the discrepancy is
large and consistent rather than small and noisy, it is not representation error.

## Interview questions

**★ Why does `assertThat(0.1 + 0.2).isEqualTo(0.3)` fail?**
Because none of 0.1, 0.2 or 0.3 is exactly representable as an IEEE 754 binary double.
Each literal becomes the nearest representable value, the addition rounds again to the
nearest representable value, and the result is a different double from the one 0.3 maps to.
The assertion is comparing two exact binary values that are not the same. The remedy for a
genuinely approximate quantity is `isCloseTo(0.3, within(1e-9))`; the remedy for money is
to stop using `double`.

**★ What is the difference between `within` and `byLessThan`, and when does it matter?**
`within(d)` builds a non-strict `Offset` and passes when `|actual - expected| <= d`;
`byLessThan(d)` builds a strict one and fails when the difference equals `d` exactly. It
matters at the boundary, which is where rounded values tend to land — and it matters for
`byLessThan(0)`, which throws, whereas `within(0)` degenerates to exact equality.

**★ `assertThat(x).isEqualTo(Double.NaN)` fails even though `x` is NaN. Explain.**
`Double.NaN` as an argument selects the primitive `isEqualTo(double)` overload, which
compares with `==`, and IEEE 754 defines every comparison involving NaN as false — so
`NaN == NaN` is false. `Double.equals` is different: it compares bit patterns after
canonicalising NaN, so `Double.valueOf(NaN).equals(NaN)` is true. AssertJ detects this exact
situation and throws a message naming it. The correct assertion is `isNaN()`.

**★ You switch a test from a list of `isEqualTo` field assertions to
`usingRecursiveComparison().isEqualTo(expected)` and it starts passing where it used to
fail on a double field. What changed?**
The comparison did. The recursive comparison compares doubles with a default precision of
1.0E-15 and floats with 1.0E-6, whereas `isEqualTo` on a double is exact. The old assertion
was catching a difference in the last few bits; the new one tolerates it. If that
difference mattered, register a stricter comparator with `withEqualsForType`, or keep the
explicit assertion for that field.

**★ When is a tolerance the right answer and when is it a smell?**
Right when the quantity is inherently approximate — a sensor reading, a physics
simulation, an interpolation, a statistical estimate — because then exactness was never the
requirement. A smell when it was introduced to make a failing test pass, because at that
point the number encodes the current implementation's error rather than the specification's
allowance, and the test will keep passing as that error grows up to the tolerance.

**★ How would you assert on money without any tolerance at all?**
Represent money as `BigDecimal` with an enforced scale, or as an integral count of minor
units in a `long`, and assert with `isEqualByComparingTo` (which sidesteps `BigDecimal`'s
scale-sensitive `equals`) or plain `isEqualTo` on the long. The absence of a tolerance is
the point: a monetary total either is the expected figure or is a bug, and a tolerance in
that assertion is a licence for a rounding defect.

{/* FOOTER */}
