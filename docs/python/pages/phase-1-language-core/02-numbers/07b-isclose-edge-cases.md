---
title: "isclose special-cases the infinities, never returns NaN, and is not transitive — so it can never key a dict, dedupe a list or drive a sort"
sidebar_label: "7b · isclose edge cases"
sidebar_position: 71
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`math`](https://docs.python.org/3.14/library/math.html) (`isclose`, `isnan`, `isfinite`),
> [`cmath`](https://docs.python.org/3.14/library/cmath.html) (`isclose`),
> [`decimal`](https://docs.python.org/3.14/library/decimal.html),
> [`fractions`](https://docs.python.org/3.14/library/fractions.html),
> and [PEP 485](https://peps.python.org/pep-0485/).
> Version spine: **Python 3.14.7**.

**`math.isclose` has three behaviours that are not derivable from its formula, and
each one decides whether a use of it is legitimate. It special-cases the infinities,
so `isclose(inf, inf)` is `True` even though `abs(inf - inf)` is NaN. It never
returns NaN and never raises on one — a pipeline that has started producing NaN
reports "not close", which reads like a precision problem and is a data problem. And
it is **not transitive**, which disqualifies it from every operation Python builds on
equality: hashing, dict keys, set membership, dedup, sorting, and `__eq__` itself.**

## NaN and the infinities

> *"The IEEE 754 special values of `NaN`, `inf`, and `-inf` will be handled according
> to IEEE rules. Specifically, `NaN` is not considered close to any other value,
> including `NaN`. `inf` and `-inf` are only considered close to themselves."*

```python
import math
nan, inf = float("nan"), float("inf")

math.isclose(nan, nan)          # False
math.isclose(inf, inf)          # True
math.isclose(inf, -inf)         # False
math.isclose(inf, 1e308)        # False, at any finite tolerance
```

`isclose(inf, inf)` being `True` is worth pausing on, because the formula does not
produce it: `abs(inf - inf)` is NaN, and NaN is not `<=` anything. The equality of the
infinities is settled ahead of the arithmetic. `isclose(inf, 1e308)` being `False` at
*any* tolerance follows from the other direction — the relative clause is
`rel_tol * inf`, and no finite gap is being measured against a finite scale.

`isclose` also always returns a `bool`. It cannot propagate a NaN out into a
condition the way a bare `nan < x` silently evaluating to `False` can, and it does not
raise. That is convenient and it is also how NaN hides: an assertion that used to
compare two numbers now compares two NaNs and reports a tolerance failure.

**Test for the bad values first, and prefer the one call that covers all four.**
`math.isfinite(x)` *"Return `True` if `x` is neither an infinity nor a NaN"*:

```python
if not (math.isfinite(got) and math.isfinite(want)):
    raise ValueError(f"non-finite input: {got!r} vs {want!r}")
return math.isclose(got, want, rel_tol=1e-9, abs_tol=1e-12)
```

Detection is covered in full in
[Detecting NaN, and containers](06b-detecting-nan-and-containers.md); the point here
is only that a tolerance test is the wrong place to discover you have one.

## Complex numbers: cmath.isclose

`math.isclose` is a float function. For complex values, `cmath.isclose(a, b, *,
rel_tol=1e-09, abs_tol=0.0)` carries the identical documented formula and defaults,
with `abs()` reading as the modulus — so it is a single test on the distance between
two points in the plane, not a pair of independent tests on the real and imaginary
parts.

```python
import cmath
cmath.isclose(1 + 1j, 1 + 1.000_000_000_1j)   # one distance-based test
```

That distinction matters when the parts differ in scale. A value like
`1e6 + 1e-6j` is dominated by its real part, so a perturbation of the imaginary part
that is enormous *relative to the imaginary part* is invisible to a modulus-based
test. If the components carry independent meaning, compare them independently.

The zero trap is if anything sharper here, and `cmath`'s wording is blunter than
`math`'s — the collapsed form is `False` *"for any `x` and `rel_tol` less than
`1.0`"*. A complex value with one component exactly zero is entirely ordinary, so
`abs_tol` is close to mandatory in the plane.

## Decimal and Fraction do not need a tolerance function

`Decimal` and `Fraction` exist because their arithmetic is exact in the domain you
care about. Reaching for a float helper converts to binary64 first and throws that
away — reintroducing exactly the representation error the type was chosen to avoid.
Write the tolerance test in their own arithmetic instead; subtraction, `abs()` and
`<=` are all exact there.

```python
from decimal import Decimal
from fractions import Fraction

def close_dec(a: Decimal, b: Decimal, tol: Decimal) -> bool:
    return abs(a - b) <= tol

close_dec(Decimal("10.00"), Decimal("10.01"), Decimal("0.05"))   # exact throughout
abs(Fraction(1, 3) - Fraction(333, 1000)) <= Fraction(1, 1000)   # exact throughout
```

Note the tolerance itself is a `Decimal` built from a **string**. `Decimal(0.05)` is
the exact binary expansion of a float and defeats the point; that constructor
behaviour is covered in **Conversions and precision loss**
*(12-conversions-and-precision-loss.md)*.

If you find yourself wanting `isclose` on a `Decimal`, the question underneath is
usually whether the value should have been quantised to a fixed number of places —
**Decimal for money** *(10-decimal-for-money.md)* — rather than whether the
comparison should be fuzzy. A tolerance on an exact type is a statement that you do
not know what the answer is.

## isclose is not an equivalence relation

This is the property that decides where you are *allowed* to use it. Approximate
equality is reflexive (except for NaN) and symmetric, but it is **not transitive**:

```python
tol = 0.1
a, b, c = 1.00, 1.09, 1.18
math.isclose(a, b, rel_tol=tol)   # True
math.isclose(b, c, rel_tol=tol)   # True
math.isclose(a, c, rel_tol=tol)   # False
```

Every structure Python builds on equality assumes transitivity, so `isclose` cannot
be used to:

- **key a dict or populate a set** — the hash invariant requires that objects which
  compare equal hash equally, and two "close" floats have unrelated hashes;
- **deduplicate a list** — whether two elements survive depends on the order you
  visit them in, so the result is not a function of the input set;
- **drive a sort or a `bisect`** — a comparator built on it is not a total order, and
  `list.sort` is free to produce a nonsensical arrangement rather than raise;
- **implement `__eq__`** — a class whose `__eq__` is a tolerance test breaks `in`,
  `dict`, `set`, `count`, `index`, `assertEqual` and `==`-based caching all at once,
  and the breakage is silent.

## What to do instead: quantise, then compare exactly

Where you genuinely need "group values that are near each other", the operation is
**binning**, not comparison. Round or quantise onto a grid, then use exact equality
on the grid value. That *is* transitive, it is stable under reordering, and the
result is hashable:

```python
from collections import defaultdict

def bucket(x: float, grid: float = 0.01) -> int:
    return round(x / grid)          # an int — exact, hashable, order-independent

groups: dict[int, list[float]] = defaultdict(list)
for value in readings:
    groups[bucket(value)].append(value)
```

The honest cost is that binning has hard edges: two values three ULPs apart can still
land either side of a bucket boundary. That is a real limitation and it is not
removable — it is the price of getting transitivity back. Choosing the grid so that
boundaries fall where your data does not cluster is the whole of the design work.

For the money case the grid is not a choice at all: quantise with `Decimal` to the
currency's minor unit and compare with `==`.

## Gotchas

### A NaN turns a data bug into a tolerance failure
**Symptom.** A comparison that used to pass now fails, the numbers in the failure
message print as `nan`, and the investigation starts in the tolerance.
**Cause.** `isclose` treats NaN as "not close" rather than raising, so the failure
surfaces at the assertion instead of at the point the NaN was produced.
**Fix.** Reject non-finite inputs explicitly before the tolerance test.
```python
if not math.isfinite(got):
    raise ValueError(f"computation produced {got!r}")
```

### `isclose(inf, inf)` is `True` and that is not always what you want
**Symptom.** A test comparing an overflowed result against an overflowed expectation
passes, hiding that both sides overflowed.
**Cause.** The infinities are documented as close to themselves, special-cased ahead
of the subtraction.
**Fix.** Assert finiteness as its own condition, not as part of the closeness check.

### `isclose` used as `__eq__`
**Symptom.** A value class with a tolerance-based `__eq__` behaves correctly in
direct comparisons and then loses elements in a `set`, returns wrong `count()`
results, and fails to be found by `in`.
**Cause.** The hash/equality contract requires equal objects to hash equally, and a
non-transitive `__eq__` makes membership order-dependent.
**Fix.** Keep `__eq__` exact and expose the tolerance as an explicit method.
```python
class Reading:
    def __eq__(self, other): return self.value == other.value
    def __hash__(self): return hash(self.value)
    def close_to(self, other, *, rel_tol=1e-9, abs_tol=1e-12):
        return math.isclose(self.value, other.value, rel_tol=rel_tol, abs_tol=abs_tol)
```

### Deduplicating with a tolerance
**Symptom.** The same input list produces different "unique" sets depending on the
order it arrives in, and two runs of the same pipeline disagree on how many distinct
values there were.
**Cause.** Non-transitivity: whether `c` is absorbed into `a`'s group depends on
whether `b` was seen first.
**Fix.** Bin onto a grid and dedupe on the bin.
```python
unique = {round(x / 0.01) for x in values}
```

### `cmath.isclose` on components of very different scale
**Symptom.** A complex assertion passes while the imaginary part is wrong by orders
of magnitude.
**Cause.** The test is on the modulus, which the larger component dominates.
**Fix.** Compare the parts separately when they carry independent meaning.
```python
math.isclose(z.real, w.real, rel_tol=1e-9, abs_tol=1e-12) and \
    math.isclose(z.imag, w.imag, rel_tol=1e-9, abs_tol=1e-12)
```

### A float tolerance on a `Decimal`
**Symptom.** A money comparison drifts back into binary rounding after the codebase
deliberately moved to `Decimal`.
**Cause.** `math.isclose` is a float function; its arguments are converted to
binary64, which is the representation `Decimal` was adopted to escape.
**Fix.** Compare in `Decimal` arithmetic with a `Decimal` tolerance built from a
string — or better, `quantize` both sides and use `==`.

### `Decimal(0.05)` as a tolerance
**Symptom.** A `Decimal` tolerance that is very slightly larger or smaller than the
literal suggests, and a boundary case that flips.
**Cause.** The `Decimal` float constructor is exact about the *binary* value, so
`Decimal(0.05)` is a long expansion, not `Decimal("0.05")`.
**Fix.** Always build a `Decimal` from a string.

## Interview questions

**Is `math.isclose(float('nan'), float('nan'))` true?**
No. NaN is documented as not close to any value including itself, matching IEEE
equality. `isclose` returns `False`; it does not raise and does not return NaN.

**Is `math.isclose(inf, inf)` true, and how, given `inf - inf` is NaN?**
Yes. The infinities are documented as close only to themselves, and that case is
settled before the subtraction — the formula alone would give NaN, which is not `<=`
anything.

**Can `math.isclose` raise?**
On tolerance arguments, yes — a negative tolerance is a `ValueError`. On the values
themselves it does not raise for NaN or infinity; it answers `False` (or `True` for
matching infinities).

**Why can't you use `isclose` to deduplicate a list of floats?**
Because it is not transitive, so membership in a group depends on visiting order and
the "unique" result is not a function of the input set. Bin to a grid and dedupe on
the bin instead.

**Why is a tolerance-based `__eq__` a bug?**
It breaks the hash/equality contract — equal objects must hash equally, and close
values have unrelated hashes — and non-transitivity then makes `in`, `set`, `dict`,
`count` and `index` order-dependent. Keep `__eq__` exact and name the fuzzy
comparison something else.

**How do you group floats that are "about the same"?**
Quantise onto a grid and compare the grid values exactly. It is transitive, hashable
and order-independent; the cost is hard bucket edges, which you place away from where
your data clusters.

**What does `cmath.isclose` compare?**
The modulus of the difference against a tolerance scaled by the larger modulus — one
distance test in the complex plane, not two independent component tests.

**Should you use `math.isclose` on `Decimal` values?**
No. It converts to binary64 and reintroduces the error `Decimal` exists to avoid.
Compare with exact `Decimal` arithmetic and a string-built `Decimal` tolerance, or
`quantize` both sides and use `==`.

**Give three values `a`, `b`, `c` showing `isclose` is not transitive.**
At `rel_tol=0.1`: `1.00`, `1.09`, `1.18`. The first two are close, the second two are
close, the outer pair is not — each test is scaled to its own larger operand, so the
window moves along with it.

**Your assertion fails and both numbers print as `nan`. Where is the bug?**
Not in the tolerance. `isclose` reporting "not close" for a NaN pair is the documented
behaviour; the defect is wherever the NaN was produced. Guard with `math.isfinite`
ahead of the comparison so the failure points at the source.

---

← Prev: [Comparing floats](07-comparing-floats.md) · Index: [Numbers](README.md) · Next → [When equality is exactly right](07c-when-equality-is-right.md)
