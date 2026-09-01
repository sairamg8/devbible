---
title: "Float equality is a question about provenance, and in five identifiable cases == is exact, total and transitive when a tolerance is none of those"
sidebar_label: "7c · When == is exactly right"
sidebar_position: 72
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`math`](https://docs.python.org/3.14/library/math.html) (`ulp`, `nextafter`),
> [Numeric Types — int, float, complex](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex),
> [`sys.float_info`](https://docs.python.org/3.14/library/sys.html#sys.float_info),
> the tutorial appendix
> [Floating-Point Arithmetic: Issues and Limitations](https://docs.python.org/3.14/tutorial/floatingpoint.html),
> and [PEP 485](https://peps.python.org/pep-0485/).
> Version spine: **Python 3.14.7**; `math.ulp`/`math.nextafter` since **3.9**,
> `nextafter`'s `steps` argument since **3.12**.

**"Never compare floats with `==`" is repeated far more often than it is true, and
believing it costs you correctness twice: once when you wrap an exact comparison in a
tolerance and hide a real regression inside the slack, and once when you cannot say
why a comparison is safe and so cannot defend it in review. A binary64 float is an
exact rational number and `==` compares those exact values without ever lying about
them. What is unreliable is the *assumption* that two independently computed
quantities which are mathematically equal will land on the same float. So the
question is never "is this a float?" — it is "could these two values have taken
different rounding paths?"**

## Case 1 — integers below 2\*\*53

Every integer with absolute value up to `2**53` is exactly representable, and
addition, subtraction and multiplication of such integers are exact **so long as the
true result also stays inside that range**. Inside it, float arithmetic on integers
is integer arithmetic.

```python
2.0 ** 53 == 9_007_199_254_740_992      # True
(2.0 ** 53) + 1 == 2.0 ** 53            # True — the first gap opens here
```

The second line is the boundary itself: at `2**53` the spacing between adjacent
floats reaches `2.0`, so the odd integers stop existing. The moment a true result
leaves the range the guarantee is gone, which is why 64-bit identifiers must never
round-trip through a float — the case is worked through in
[Identity and boundaries](01c-identity-and-boundaries.md).

## Case 2 — dyadic values

A value is exactly representable when it is a fraction with a power-of-two
denominator and an in-range exponent. `0.5`, `0.25`, `0.125`, `3.75` and `-2.5` are
all exact; `0.1`, `0.2` and `0.3` are not. Arithmetic that stays on the dyadic grid
stays exact.

```python
0.5 + 0.25 == 0.75      # True, and not a coincidence
0.1 + 0.2 == 0.3        # False, and not a coincidence either
```

You can settle any literal without guessing: `(0.75).as_integer_ratio()` returns the
exact fraction the float holds, and the tutorial appendix gives the canonical
counter-example — `1/10` stored as *"`3602879701896397 / 2 ** 55` which is close to
but not exactly equal to the true value of 1/10."* See
[Inspecting and constructing floats](05b-inspecting-and-constructing-floats.md).

Halves, quarters and eighths turn up more often than people expect: pixel offsets,
audio sample scaling, powers of two in binary formats, and anything built from
bit-shifts. Those comparisons are exact and should be written exactly.

## Case 3 — the identical computation

IEEE 754 arithmetic is deterministic: the same operation on the same operands yields
the same result every time. So a value compared against itself, or against the output
of a byte-for-byte identical expression, is exactly equal.

```python
total = sum(prices)
if total == sum(prices):        # True — same inputs, same operations, same order
    ...
```

The trap hidden in that sentence is **order**. Float addition is commutative but not
associative, so `a + b + c` and `c + b + a` are different computations and may differ
in the last bit — which is why `sum()` and `math.fsum()` disagree, covered in
[Accurate float arithmetic](05d-accurate-float-arithmetic.md). "The identical
computation" means identical, not merely equivalent: reordering a loop, switching
from a comprehension to a generator that consumes in a different order, or letting a
compiler or a vectorised library re-associate the additions all break it.

## Case 4 — round-tripped values

`repr()` produces the shortest decimal string that reads back as the same float, so
`float(repr(x)) == x` holds for every finite `x`. The same guarantee applies to
`float.hex()`/`float.fromhex()` and to `as_integer_ratio()`. A value that has been
serialised and parsed through a round-trip-safe representation is *the same float*,
and comparing it exactly is correct.

```python
x = 0.1
float(repr(x)) == x                   # True
float.fromhex(x.hex()) == x           # True
```

This is why a tolerance in a serialisation test is usually wrong: it converts a
round-trip guarantee you actually hold into a fuzzy check that would also pass if the
round trip were broken. If the format is *not* round-trip safe — a fixed `%.2f`, a
JSON writer that truncates — then the tolerance is not papering over a float problem
either; it is hiding a format that loses data, and the assertion should say so.

## Case 5 — sentinels and exact constants

Comparing against `0.0`, `1.0`, `inf` or `-inf` as *sentinels* — values a computation
deliberately produces rather than approaches — is exact and correct.

```python
if divisor == 0.0:              # a guard, not an approximation
    raise ValueError("divisor must be non-zero")
if scale == 1.0:                # a fast path, exact by construction
    return values
```

Two footnotes. `x == 0.0` is `True` for `-0.0` as well, which is usually what a guard
wants and occasionally not — see
[Signed zero and serialisation](06c-signed-zero-and-serialisation.md). And `x == x`
is the classic inline NaN test, false only for NaN; `math.isnan` says the same thing
and says it legibly.

## Gotchas

### A tolerance hides a one-bit regression
**Symptom.** A refactor changes results in the last bit, no test notices, and the
drift is found months later in a downstream aggregate.
**Cause.** An assertion on a value that should have been bit-exact was written with
`isclose`, so any change smaller than the tolerance is invisible.
**Fix.** Where the computation is deterministic and the inputs are fixed, assert
exact equality — and let a genuine change to the arithmetic fail loudly.

### Reordering an accumulation and keeping the exact assertion
**Symptom.** Swapping `sum()` for a parallel or vectorised reduction breaks an
equality assertion that was previously correct.
**Cause.** Case 3 requires the *identical* sequence of operations; float addition is
not associative, so re-association changes the last bits.
**Fix.** Either preserve the order, or accept that the comparison is now between two
independent computations and switch to `math.isclose` with a tolerance derived from
the number of terms.

### Asserting on `repr`
**Symptom.** A test breaks on a Python upgrade or a platform change even though the
arithmetic is unchanged.
**Cause.** `repr` is a display convention — the shortest round-tripping decimal — not
the value.
**Fix.** Assert on the number.
```python
self.assertEqual(0.1 + 0.2, 0.30000000000000004)   # exact, and about the value
```

### `x == x` used without a comment
**Symptom.** A reviewer deletes it as a tautology.
**Cause.** It is the inline NaN test, false only for NaN, and it does not look like
one.
**Fix.** Write `math.isnan(x)` and let the name carry the meaning.

## Interview questions

**Is `0.5 + 0.25 == 0.75` reliable?**
Yes, and not by luck. All three are dyadic — fractions with power-of-two denominators
— so each is exactly representable and the addition is exact.

**Up to what magnitude is float arithmetic on integers exact?**
`2**53`. Every integer up to that is representable, and `+`, `-` and `*` on such
integers are exact provided the true result also stays under it. Above it the
spacing exceeds 1 and integers start being skipped.

**When is `==` on two computed floats correct?**
When both came from the identical sequence of operations on the identical inputs.
IEEE arithmetic is deterministic, so the results are bit-identical. Change the order
and the guarantee is gone, because addition is not associative.

**Does `float(repr(x)) == x` always hold?**
Yes for every finite `x` — `repr` emits the shortest decimal that reads back as the
same float. `float.hex()`/`fromhex()` and `as_integer_ratio()` give the same
guarantee.

**Is `x == x` ever meaningful for a float?**
Yes — it is `False` exactly when `x` is NaN. Prefer `math.isnan(x)`, which says the
same thing legibly and survives review.

**A colleague says "never use `==` on floats". What is your answer?**
That the rule is about provenance, not about the type. If both sides are exactly
representable, or came from the same computation, or came back from a round-trip-safe
serialisation, or are sentinels, then `==` is exact, total and transitive — and a
tolerance would only add slack for a real regression to hide in.

---

← Prev: [isclose edge cases](07b-isclose-edge-cases.md) · Index: [Numbers](README.md) · Next → [Epsilons and ULPs](07d-epsilons-and-ulps.md)
