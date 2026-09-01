---
title: "math.isclose, assertAlmostEqual and pytest.approx are three different models, and they disagree exactly where floats are hardest — at scale and near zero"
sidebar_label: "7e · Tolerance in tests"
sidebar_position: 74
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`unittest`](https://docs.python.org/3.14/library/unittest.html#unittest.TestCase.assertAlmostEqual),
> [`math`](https://docs.python.org/3.14/library/math.html) and
> [`round()`](https://docs.python.org/3.14/library/functions.html#round),
> plus the [pytest API reference](https://docs.pytest.org/en/stable/reference/reference.html#pytest-approx)
> for `pytest.approx`.
> Version spine: **Python 3.14.7**; `assertAlmostEqual`'s equality shortcut since **3.2**.

**Three tolerance helpers are in daily use and no two of them agree. `math.isclose`
is relative and symmetric with no absolute floor. `unittest`'s `assertAlmostEqual` is
purely absolute and expressed in *decimal places*, which is a digit count and not a
tolerance. `pytest.approx` is relative to the expected value — asymmetric — with a
built-in absolute floor. A test that passes under one can fail under another on the
same data, and the two places they diverge most are the two places floats are hardest:
very large values, and values near zero.**

## assertAlmostEqual is a different model, not a wrapper

> *"Test that `first` and `second` are approximately (or not approximately) equal by
> computing the difference, rounding to the given number of decimal places (default
> 7), and comparing to zero. Note that these methods round the values to the given
> number of `decimal places` (i.e. like the `round()` function) and not `significant
> digits`."*

Three consequences follow immediately.

**It is absolute.** There is no relative component at all, so its usefulness tracks
the magnitude of your data. At `1e9`, seven decimal places is far below the spacing of
the floats themselves; at `1e-9` it is far above every value in play, and the
assertion passes for anything.

**It rounds, then compares to zero.** It is not `abs(a-b) < 1e-7`. The *difference*
is rounded to seven decimal places and tested against zero, so the effective threshold
is half a unit in the last place kept — and it inherits `round()`'s
round-half-to-even behaviour, described in
[round() and banker's rounding](09-round-and-bankers-rounding.md).

**`places` is decimal places.** `places=2` means hundredths, whatever the magnitude of
the operands. Reading it as significant digits is the standard misreading, and the
docs pre-empt it in their own note.

## delta, and the TypeError

> *"If `delta` is supplied instead of `places` then the difference between `first`
> and `second` must be less or equal to (or greater than) `delta`."*
> *"Supplying both `delta` and `places` raises a `TypeError`."*

`delta` is the honest form of the same absolute test — you state the tolerance in the
units of the thing being measured instead of encoding it as a digit count, and you
skip the rounding step entirely.

```python
self.assertAlmostEqual(measured, expected, delta=0.5)             # ± half a unit
self.assertAlmostEqual(measured, expected, places=2)              # hundredths
self.assertAlmostEqual(measured, expected, places=2, delta=0.5)   # TypeError
```

One more documented behaviour catches people writing custom numeric types:

> *"Changed in version 3.2: `assertAlmostEqual()` automatically considers almost equal
> objects that compare equal. `assertNotAlmostEqual()` automatically fails if the
> objects compare equal."*

The equality shortcut fires **before** any arithmetic. For a type whose `__eq__` is
itself approximate — which
[isclose edge cases](07b-isclose-edge-cases.md) argues you should never write —
`assertNotAlmostEqual` will fail on values you consider distinct, without subtracting
anything.

## pytest.approx is asymmetric

`approx(expected, rel=None, abs=None, nan_ok=False)`. By default it *"considers
numbers within a relative tolerance of `1e-6`"* and *"also considers numbers within an
absolute tolerance of `1e-12`"*, and *"If you specify both `abs` and `rel`, the
numbers will be considered equal if either tolerance is met."*

That built-in absolute floor is the practical difference from `math.isclose`: the
zero comparison `isclose` cannot pass without help, `approx` passes by default. It is
also the reason a `pytest` suite can drift into never testing the region near zero at
all — `1e-12` is a floor somebody else chose for your data.

The other difference is symmetry. `math.isclose` scales by the larger operand and so
treats both alike; `approx` takes its relative tolerance with respect to the expected
value only, and its own documentation says you can think of that argument as *"the
reference value"*. Swapping the two sides of the assertion can therefore change the
result, which is precisely why `approx` belongs on the **expected** side and never on
the computed one:

```python
assert computed == pytest.approx(expected, rel=1e-9)      # right way round
assert expected == pytest.approx(computed, rel=1e-9)      # tolerance now scaled by
                                                          # the value under test
```

It also lifts over containers — *"The same syntax also works for ordered sequences of
numbers"* and *"dictionary values can also be compared"*, while *"`sets` and other
unordered sequences are not supported"* — which is the one thing neither of the
others does, and the usual reason to reach for it.

`nan_ok=False` is the default, so a NaN on either side fails the comparison, matching
`math.isclose`'s rule rather than surprising you.

## The three side by side

| | `math.isclose` | `assertAlmostEqual` | `pytest.approx` |
|---|---|---|---|
| Model | relative, optional absolute | absolute, decimal places | relative to expected, absolute floor |
| Defaults | `rel_tol=1e-9`, `abs_tol=0.0` | `places=7` | `rel=1e-6`, `abs=1e-12` |
| Symmetric | yes | yes | **no** |
| Handles a zero operand out of the box | **no** | yes | yes |
| Combining both tolerances | `max` — either may satisfy | mutually exclusive (`TypeError`) | either may satisfy |
| Containers | no | no | sequences and dict values |
| NaN | never close | not close | not close unless `nan_ok=True` |

The two rows that flip results on real data are **zero** and **magnitude**:

```python
# near zero: assertAlmostEqual and approx pass, isclose fails
math.isclose(1e-9, 0.0)                      # False
# at scale: isclose and approx pass, assertAlmostEqual fails
math.isclose(1e16, 1e16 + 1.0)               # True — one part in 1e16
```

`assertAlmostEqual(1e16, 1e16 + 1.0)` rounds a difference of `1.0` to seven places,
gets `1.0`, compares it to zero and fails — even though the two values agree to
sixteen significant digits and are a single float apart. Meanwhile
`assertAlmostEqual(1e-9, 0.0)` passes, because the difference rounds to zero at seven
places, which means the default assertion cannot distinguish `1e-9` from nothing.

## Choosing, per assertion

- **A computed value against an analytic expected value** — relative: `math.isclose`
  or `approx`, with a tolerance derived from how many operations the computation
  performs and at what magnitudes, not from habit.
- **A measurement against a known scale** — absolute: `delta=` or `abs=`, stated in
  the units of the measurement, where a reviewer can judge whether it is reasonable.
- **A value that can legitimately be zero** — relative *and* absolute, always.
- **A value that should be exact** — `assertEqual`. The cases are enumerated in
  [When equality is exactly right](07c-when-equality-is-right.md); wrapping an exact
  expectation in a tolerance is how a genuine one-bit regression gets shipped.
- **Money** — `Decimal` and `assertEqual` after quantising. A tolerance on money is a
  statement that you do not know what the answer is.
- **A numerical routine's accuracy** — ULPs, per
  [Epsilons and ULPs](07d-epsilons-and-ulps.md).

## Do not assert on repr

```python
self.assertEqual(str(0.1 + 0.2), "0.30000000000000004")     # brittle
self.assertEqual(0.1 + 0.2, 0.30000000000000004)            # exact, about the value
```

`repr` output is a display convention — the shortest decimal that round-trips — and
it is not the value. Asserting on it couples the test to formatting rather than to
arithmetic, and it is the version that breaks for reasons unrelated to the code under
test.

## Gotchas

### `places` read as significant digits
**Symptom.** `assertAlmostEqual(x, y, places=3)` passes for values near `1e6` that
differ in the fourth significant digit, or fails for values near `1e-6` that are
identical to every digit that matters.
**Cause.** `places` is decimal places — a fixed absolute grid — not significant
digits. The docs say so explicitly.
**Fix.** State the tolerance in the units of the data, or use a relative test.
```python
self.assertAlmostEqual(x, y, delta=1.0)          # absolute, in units
assert math.isclose(x, y, rel_tol=1e-3)          # relative, 3 significant digits
```

### The default `places=7` at large magnitudes
**Symptom.** A test on values around `1e16` fails for a difference of one ULP.
**Cause.** Seven decimal places is far finer than the float grid at that magnitude,
so the assertion demands more precision than the type can carry.
**Fix.** Use a relative comparison; the requirement is "agrees to N significant
digits", which `places` cannot express.

### The default `places=7` near zero
**Symptom.** A test that is supposed to detect a small non-zero residual passes for
every input.
**Cause.** Any difference below `5e-8` rounds to zero at seven places, so the
assertion is vacuous in that region.
**Fix.** Assert against an explicit `delta` chosen from the residual you care about,
or assert `abs(residual) <= tol` directly.

### `places` and `delta` supplied together
**Symptom.** `TypeError` from an assertion whose arguments were built up in a helper.
**Cause.** They are documented as mutually exclusive.
**Fix.** Pick one in the helper's signature and pass exactly one through.

### `pytest.approx` on the wrong side
**Symptom.** A test's result changes when the two sides of the comparison are swapped
during a tidy-up.
**Cause.** `approx` scales the relative tolerance by its own argument, so which value
it wraps determines the window.
**Fix.** Always wrap the *expected* value: `assert computed == approx(expected)`.

### `approx`'s absolute floor masking a near-zero bug
**Symptom.** A residual of `1e-13` is accepted as zero even though the routine should
produce `1e-18`.
**Cause.** `approx`'s default `abs=1e-12` is a floor chosen without knowledge of your
scale, and it satisfies the comparison on its own.
**Fix.** Pass `abs=` explicitly whenever the quantity's natural scale is below
`1e-12`.

### `assertNotAlmostEqual` on a type with an approximate `__eq__`
**Symptom.** An assertion that two distinct readings are *not* almost equal fails
before any subtraction happens.
**Cause.** Since 3.2 the method fails automatically if the objects compare equal, and
an approximate `__eq__` makes them compare equal.
**Fix.** Keep `__eq__` exact — the argument is in
[isclose edge cases](07b-isclose-edge-cases.md) — and expose closeness as a named
method.

### One tolerance constant shared across the suite
**Symptom.** Some assertions have so much slack that regressions pass, others are so
tight that unrelated changes break them.
**Cause.** A single constant cannot be right for data spanning several magnitudes and
computations of different lengths.
**Fix.** Derive each tolerance from its own computation and write the reasoning
beside it.

## Interview questions

**How does `assertAlmostEqual` decide, exactly?**
It computes the difference, rounds it to `places` decimal places (default 7) and
compares that to zero. It is absolute, not relative, and `places` is decimal places
rather than significant digits — the docs call that out specifically.

**Why does `assertAlmostEqual(1e16, 1e16 + 1.0)` fail?**
Because seven decimal places is far below the float spacing at `1e16`. The difference
of `1.0` does not round away, so the comparison to zero fails — even though the values
agree to sixteen significant digits and are one float apart.

**Why does `assertAlmostEqual(1e-9, 0.0)` pass?**
Because `1e-9` rounds to `0.0` at seven decimal places. In that region the default
assertion cannot distinguish a small residual from nothing.

**What happens if you pass both `places` and `delta`?**
`TypeError` — they are documented as mutually exclusive. `delta` is the direct
absolute tolerance and skips the rounding step.

**What changed in `assertAlmostEqual` in 3.2?**
It began considering objects that compare equal to be almost equal automatically, and
`assertNotAlmostEqual` began failing automatically if the objects compare equal. The
shortcut runs before any arithmetic.

**Is `pytest.approx` symmetric?**
No. Its relative tolerance is taken with respect to the value it wraps — the
reference value — so swapping the sides can change the outcome. It goes on the
expected side.

**What are `pytest.approx`'s defaults, and how do they combine?**
Relative `1e-6` and absolute `1e-12`, and the comparison succeeds if *either* is
satisfied. That absolute floor is why it handles zero out of the box where
`math.isclose` does not.

**Which of the three handles a zero operand by default?**
`assertAlmostEqual` and `pytest.approx`. `math.isclose` does not — its `abs_tol`
defaults to `0.0`, so a zero comparison is guaranteed `False` without an explicit
absolute tolerance.

**Which of the three works on containers?**
Only `pytest.approx`, over ordered sequences and dictionary values. Sets and other
unordered collections are explicitly unsupported.

**A suite uses `assertAlmostEqual` everywhere. When would you change it?**
Wherever the data does not sit near unit magnitude: at large magnitudes `places=7`
demands sub-ULP agreement, and near zero it accepts anything. Both call for a
relative test, or for `delta` stated in the units of the measurement.

**Why not assert on `repr(x)`?**
`repr` is the shortest round-tripping decimal — a display convention, not the value.
A test on it couples to formatting and can break without the arithmetic changing.
Assert on the number.

**What tolerance would you use for a money assertion?**
None. Use `Decimal`, `quantize` to the currency's minor unit, and `assertEqual`. A
tolerance on money says you do not know what the answer is.

---

← Prev: [Epsilons and ULPs](07d-epsilons-and-ulps.md) · Index: [Numbers](README.md) · Next → [Floor division and modulo](08-floor-division-and-modulo.md)
