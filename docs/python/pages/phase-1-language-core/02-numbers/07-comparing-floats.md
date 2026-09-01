---
title: "math.isclose is a relative test with the formula written down in the docs, and comparing anything to 0.0 with its defaults is guaranteed to return False"
sidebar_label: "7 · Comparing floats"
sidebar_position: 70
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`math`](https://docs.python.org/3.14/library/math.html)
> (`isclose`, `ulp`, `nextafter`, `isfinite`)
> and [PEP 485 — A function for testing approximate equality](https://peps.python.org/pep-0485/).
> Version spine: **Python 3.14.7**; `math.isclose` since **3.5**.

**Two floats are equal or they are not; there is no "approximately" built into the
type. What you actually want, almost always, is a question about *provenance*: were
these two numbers produced by computations whose rounding errors should have kept
them within some tolerance of each other? `math.isclose(a, b)` answers that, and it
answers it with a formula you should be able to recite —
`abs(a-b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)`. Every mistake people make
with it comes from one of two places: not knowing that `rel_tol` is relative to the
*larger* operand, or not knowing that comparing anything to `0.0` with the default
arguments is guaranteed to return `False`.**

## The formula, and nothing but the formula

`math.isclose(a, b, *, rel_tol=1e-09, abs_tol=0.0)` was added in 3.5. The library
reference states the result outright: *"If no errors occur, the result will be:
`abs(a-b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)`."*

Read that as an `or`. Two values are close if the gap is small **relative to the
bigger one**, *or* if the gap is small in absolute terms. The default `abs_tol=0.0`
switches the second half off, so out of the box `isclose` is a purely relative test.

```python
import math

math.isclose(1_000_000.0, 1_000_000.000_1)   # gap 1e-4, scale 1e6 -> ratio 1e-10
math.isclose(0.000_001, 0.000_001_1)         # gap 1e-7, scale 1e-6 -> ratio 0.1
```

The first is close at the default tolerance and the second is not, and the absolute
gap in the first is a *thousand times larger*. That is the point of a relative test:
it scales with the numbers.

## rel_tol is a fraction, not a number of digits

*"`rel_tol` is the relative tolerance – it is the maximum allowed difference between
`a` and `b`, relative to the larger absolute value of `a` or `b`. For example, to set
a tolerance of 5%, pass `rel_tol=0.05`. The default tolerance is `1e-09`, which
assures that the two values are the same within about 9 decimal digits. `rel_tol`
must be nonnegative and less than `1.0`."*

Two constraints fall straight out of that sentence. A negative tolerance is rejected:

```python
math.isclose(1.0, 1.0, rel_tol=-0.1)   # ValueError — tolerances must be non-negative
```

And the documented upper bound of `1.0` is there because at or above it the test
degenerates: with `rel_tol=1.0` every pair of same-signed values is "close", since
the gap between two positive numbers never exceeds the larger of them.

A tolerance of `1e-09` is roughly half the precision a binary64 float carries. PEP
485 chose it as *"the largest relative tolerance for which the various possible
methods will yield the same result"* — that is, small enough that the competing
formulations all agree. It is a default picked to be uncontroversial, not a default
picked because your data wants it.

## Weak, strong, and why the docs say `max`

PEP 485 took two candidate symmetric tests from Boost:

| Name | Test | Reading |
|---|---|---|
| **weak** *(chosen)* | `abs(a-b) <= tol * max(abs(a), abs(b))` | close if within tolerance of **either** |
| strong | `abs(a-b) <= tol * min(abs(a), abs(b))` | close if within tolerance of **both** |

The weak test was adopted because it *"provides a more useful result for very large
tolerances"* and is indistinguishable from the strong test at small ones. That `max`
in the documented formula is the whole of that decision, and it is why `isclose` is
**symmetric**: `isclose(a, b)` and `isclose(b, a)` are the same expression. Neither
argument is the "expected" one. Hold on to that — it is exactly where
`pytest.approx` differs, in [Tolerance in tests](07e-tolerance-in-tests.md).

## The zero case is the one you must memorise

This is the single most common `isclose` bug, and the docs spell out the mechanism:

> *"`abs_tol` is the absolute tolerance; it defaults to `0.0` and it must be
> nonnegative. When comparing `x` to `0.0`, `isclose(x, 0)` is computed as
> `abs(x) <= rel_tol * abs(x)`, which is `False` for any nonzero `x` and `rel_tol`
> less than `1.0`. So add an appropriate positive `abs_tol` argument to the call."*

Substitute `b = 0.0` into the formula yourself and watch it collapse:

```
abs(a - 0.0) <= max(rel_tol * max(abs(a), 0.0), 0.0)
abs(a)       <= rel_tol * abs(a)
```

For any non-zero `a` and any `rel_tol` below `1.0` that is `False`. Not "usually
false". False. PEP 485 gives the reason in seven words: *"By definition, no value is
small relative to zero."* Zero has no magnitude for a fraction of it to be taken.

```python
math.isclose(1e-300, 0.0)                    # False — always
math.isclose(1e-300, 0.0, abs_tol=1e-12)     # True
```

So any time zero is a *possible* value of either operand — a residual, a delta, a
balance, a difference of two nearly equal quantities, a dot product of orthogonal
vectors — you must pass `abs_tol`, and you must choose it from the scale of the
problem rather than copying `1e-12` out of a blog post. The right question is
"what magnitude counts as noise **in the units I am working in**?" For money in
whole cents that might be `abs_tol=0.005`; for a physical residual it is set by your
measurement floor.

PEP 485 declined to guess for you deliberately: `abs_tol` defaults to `0.0` under
*"In the face of ambiguity, refuse the temptation to guess"*, on the reasoning that a
wrong non-zero default silently passes tests that should fail, whereas `0.0` fails
loudly and makes you pick.

## Both tolerances together

Supplying both is normal, not a fallback. The `max` means the pair is close if
**either** clause holds, which is precisely the behaviour you want for a quantity
that ranges over many orders of magnitude and may legitimately reach zero:

```python
def close(a: float, b: float) -> bool:
    # relative for the large end, absolute floor for the region around zero
    return math.isclose(a, b, rel_tol=1e-9, abs_tol=1e-12)
```

The absolute clause dominates near zero, the relative clause dominates far from it,
and the crossover sits where `rel_tol * scale == abs_tol` — here at a scale of
`1e-3`. Knowing where your crossover is is worth more than knowing either constant.

## Gotchas

### `isclose(x, 0)` never fires
**Symptom.** A tolerance check against zero fails for every input, including inputs
that are `1e-300`, and the failure looks like a precision problem in the code that
produced `x`.
**Cause.** With `abs_tol=0.0` the formula collapses to `abs(x) <= rel_tol * abs(x)`,
false for every non-zero `x` at any `rel_tol` below `1.0`.
**Fix.** Give the comparison an absolute floor chosen from the problem's units.
```python
math.isclose(residual, 0.0, abs_tol=1e-12)
```

### `rel_tol` read as "decimal places"
**Symptom.** Someone passes `rel_tol=2` meaning "two decimal places" and every
comparison in the suite starts passing.
**Cause.** `rel_tol` is a fraction of the larger operand. At `2.0` the right-hand
side of the test is twice the larger value, which no gap between two same-signed
finite numbers can exceed.
**Fix.** Express a percentage as a fraction — `rel_tol=0.05` is 5% — and if you
genuinely want decimal places, you want an absolute test, not this function.
```python
math.isclose(a, b, rel_tol=0.05)       # within 5%
math.isclose(a, b, abs_tol=0.005)      # within half a hundredth
```

### A negative tolerance raises rather than inverting
**Symptom.** `ValueError` from a call whose tolerance was computed rather than
written literally.
**Cause.** Both tolerances must be non-negative; a subtraction that went the wrong
way produces a negative one.
**Fix.** Take the magnitude at the point of construction: `rel_tol=abs(computed)`.

### The tolerance was copied, not chosen
**Symptom.** A suite where every numeric assertion uses the same `1e-9`, and a
regression of several ULPs in a long computation slips through while a trivial
change to an accumulation order breaks three tests.
**Cause.** `1e-9` is a *default chosen to be safe in the absence of information*, not
a tolerance derived from your computation's error growth.
**Fix.** Set the tolerance from the number of operations and the magnitudes involved,
and write the reason next to it.
```python
# 3 chained multiplications on values near 1e6; ~1e-13 relative growth expected
assert math.isclose(got, want, rel_tol=1e-12)
```

### Chained comparisons that use different scales
**Symptom.** `isclose(a, b)` and `isclose(b, c)` both pass, and a later assertion
that `a` and `c` agree fails.
**Cause.** The test is relative to the larger operand of *each individual pair*, so
the effective window moves. It is not transitive — see
[Edge cases](07b-isclose-edge-cases.md).
**Fix.** Compare everything against one reference value rather than in a chain.

### Using `isclose` on values that should be exact
**Symptom.** A one-bit regression ships because the assertion had slack in it.
**Cause.** A tolerance was applied to a comparison whose operands are exactly
representable, or which came from the identical computation.
**Fix.** Use `==`, and say why it is safe — the cases are enumerated in
[When equality is exactly right](07c-when-equality-is-right.md).

## Interview questions

**Write out what `math.isclose` computes.**
`abs(a-b) <= max(rel_tol * max(abs(a), abs(b)), abs_tol)`, with defaults
`rel_tol=1e-09` and `abs_tol=0.0`. It is an `or` between a relative clause and an
absolute one, and the `max(abs(a), abs(b))` makes it symmetric.

**Why does `math.isclose(x, 0.0)` return `False` for every non-zero `x`?**
Because `abs_tol` defaults to `0.0`, so the test reduces to
`abs(x) <= rel_tol * abs(x)`, which is false for every non-zero `x` at any `rel_tol`
below `1.0`. PEP 485's phrasing: no value is small relative to zero.

**Why is `abs_tol=0.0` the default rather than something small?**
PEP 485 applied "refuse the temptation to guess": a non-zero default would silently
pass comparisons the library has no basis to judge, and there is no scale-free value
that is right for both angstroms and astronomical units. Failing forces the caller to
supply the scale.

**What is the difference between the weak and the strong test, and which did Python
adopt?**
Weak is `tol * max(abs(a), abs(b))`, strong is `tol * min(...)`. Python adopted the
weak test, because it behaves more usefully at large tolerances and is
indistinguishable from the strong one at small tolerances.

**Is `math.isclose` symmetric? Does that matter?**
Yes — swapping the arguments cannot change the result, because the scale is the max
of the two magnitudes. It matters because `pytest.approx` is *not* symmetric, so the
two helpers can disagree on the same pair of numbers.

**How do you set `rel_tol` for a 5% tolerance?**
`rel_tol=0.05`. It is a fraction of the larger operand, not a digit count.

**When would you pass both `rel_tol` and `abs_tol`?**
Whenever the quantity spans orders of magnitude *and* can legitimately be zero. The
absolute clause covers the region around zero, the relative clause covers everything
else, and they cross over where `rel_tol * scale == abs_tol`.

**Can `rel_tol` be `1.0` or greater?**
The docs say it must be less than `1.0`. At `1.0` the test is vacuous for same-signed
values, since the gap between two positive numbers never exceeds the larger of them.

**Someone's suite uses `rel_tol=1e-9` on every assertion. What is wrong with that?**
It is the library's uninformed default applied to informed situations. A tolerance
should follow from the magnitudes involved and how many rounding steps the
computation performs; a single constant is either too loose somewhere or too tight
somewhere else, usually both.

**How would you compare a computed residual to zero?**
With an absolute tolerance only, chosen from the measurement floor of the problem:
`math.isclose(residual, 0.0, abs_tol=eps)`, or equivalently `abs(residual) <= eps`.
The relative clause contributes nothing when one side is zero.

---

← Prev: [Signed zero and serialisation](06c-signed-zero-and-serialisation.md) · Index: [Numbers](README.md) · Next → [isclose edge cases](07b-isclose-edge-cases.md)
