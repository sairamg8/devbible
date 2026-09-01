---
title: "Negative zero is a distinct float that equality and hashing cannot see, so math.copysign is the only documented way to look and the C division trick does not port"
sidebar_label: "6c · Signed zero: detecting it"
sidebar_position: 62
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`math`](https://docs.python.org/3.14/library/math.html) (`copysign`, `atan2`,
> and the CPython implementation-detail note),
> [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types)
> (including the documented `hash_float` reference implementation),
> [`float.as_integer_ratio`](https://docs.python.org/3.14/library/stdtypes.html#float.as_integer_ratio),
> and [`decimal`](https://docs.python.org/3.14/library/decimal.html).
> Version spine: **Python 3.14.7**.

**IEEE 754 binary64 stores the sign bit separately from the magnitude, so there
are two zeros: `0.0` and `-0.0`. Python gives you both and then hides the
difference behind every tool you would normally reach for. `-0.0 == 0.0` is
`True`; the documented numeric hash requirement then forces
`hash(-0.0) == hash(0.0)`, so a `dict` or `set` cannot hold both. `-0.0 < 0.0`
is `False`, `bool(-0.0)` is `False`, `if x == 0` and `if not x` both fire. The
one documented way to see the sign is `math.copysign`, and the C idiom every
experienced numerics programmer reaches for — divide into it and look at which
infinity comes back — does not port, because Python raises `ZeroDivisionError`
where C returns `±inf`. This chunk is detection.
[06d](06d-where-negative-zero-comes-from.md) is where the value comes from,
[06e](06e-what-erases-the-sign.md) is what erases it, [06f](06f-printing-negative-zero.md)
is display, and [06g](06g-negative-zero-across-a-boundary.md) plus
[06h](06h-other-runtimes-and-databases.md) are what happens when it leaves.**

## There are two zeros, and every comparison sees one

The bit pattern with sign 1 and every exponent and significand bit 0 is a legal
binary64, and IEEE 754 requires it to compare equal to `+0`. Python inherits
that from the platform C double and then builds the rest of the language on top
of the comparison:

```python
-0.0 == 0.0          # True   - IEEE 754 requires it
-0.0 < 0.0           # False  - they compare equal, so neither is less
-0.0 <= 0.0          # True
-0.0 is 0.0          # False  - but this is about objects, not values
bool(-0.0)           # False
if x == 0: ...       # fires for -0.0
if not x: ...        # fires for -0.0
x in (0.0,)          # True for x = -0.0
min(0.0, -0.0)       # 0.0  - min returns the first of equal items
max(-0.0, 0.0)       # -0.0 - likewise
sorted([0.0, -0.0])  # unchanged; sort is stable and they compare equal
```

There is no comparison operator anywhere in the language that separates them,
and `is` is not a substitute — it answers a question about object identity, and
CPython does not intern float objects, so `is` is unreliable in the opposite
direction as well (`0.0 is 0.0` may be `True` only because the compiler folded
two references to one constant).

## Hashing collapses them, so containers hold exactly one

Hashing follows equality because the documentation requires it:

> *"For numbers `x` and `y`, possibly of different types, it's a requirement
> that `hash(x) == hash(y)` whenever `x == y` (see the `__hash__()` method
> documentation for more details)."*

The same page gives a reference implementation, and it shows precisely where the
sign bit is lost. For a finite float, the documented equivalent of `hash` is:

```python
def hash_float(x):
    """Compute the hash of a float x."""
    if math.isnan(x):
        return object.__hash__(x)
    elif math.isinf(x):
        return sys.hash_info.inf if x > 0 else -sys.hash_info.inf
    else:
        return hash_fraction(*x.as_integer_ratio())
```

`float.as_integer_ratio` is documented to *"return a pair of integers whose
ratio is exactly equal to the original float"*, in lowest terms with a positive
denominator — and the exact value of `-0.0` is zero, so the pair is `(0, 1)`,
identical to the pair for `0.0`. The sign bit never reaches the hash function at
all. Note the contrast with NaN on the line above: NaN falls through to
`object.__hash__`, which is identity-based, which is why *NaNs* can multiply
inside a set while *zeros* cannot (see
[06b](06b-detecting-nan-and-containers.md)).

The consequence:

```python
s = {0.0, -0.0}          # a set of ONE element
len(s)                   # 1

d = {0.0: "positive"}
d[-0.0] = "negative"     # does NOT add a key; replaces the value
len(d)                   # 1
```

Which of the two zeros survives as the stored *key* is the one inserted first —
CPython replaces the value and keeps the existing key object. That is CPython
behaviour, not a documented language guarantee, so do not build on it. Build on
the fact that **you get exactly one of them and you do not choose which.**

## `math.copysign` is the test, and it is the only documented one

The `math` docs define `copysign` and then, unusually, spell the zero case out:

> *"Return a float with the magnitude (absolute value) of x but the sign of y.
> On platforms that support signed zeros, `copysign(1.0, -0.0)` returns -1.0."*

That sentence is the entire API. The test:

```python
import math

def is_negative_zero(x: float) -> bool:
    return x == 0.0 and math.copysign(1.0, x) < 0.0
```

The `x == 0.0` guard matters. `copysign(1.0, -3.5)` is also `-1.0`, so
`copysign` on its own tells you the sign of **any** float, not whether you have
a negative zero. If what you want is the IEEE `signbit` operation — the raw sign
bit, including for zeros and NaNs, which Python does not expose directly — then
`copysign` alone is exactly that, and it is total:

```python
def signbit(x: float) -> bool:
    """True if the sign bit is set - for -0.0, and for negative NaNs too."""
    return math.copysign(1.0, x) < 0.0
```

`copysign` accepts ints as well and always returns a float, per the module-wide
rule *"Except when explicitly noted otherwise, all return values are floats"* —
so `math.copysign(1, -1)` is `-1.0`, and `math.copysign(0.0, -1)` is `-0.0`,
which is also the cleanest way to *construct* a negative zero deliberately.

### The C trick that does not port

In C, the canonical negative-zero test divides into the value and looks at which
infinity comes back: `1.0 / -0.0` is `-INFINITY`, `1.0 / 0.0` is `+INFINITY`.
Every port of numeric C into Python that carries this idiom across breaks
immediately, because Python is deliberately not IEEE 754 here — as
[06](06-nan-inf-and-signed-zero.md) covers, `1.0 / 0.0` raises
`ZeroDivisionError` for **both** zeros. You do not get a wrong answer; you get
an exception, which at least is loud.

```python
# C: works. Python: raises ZeroDivisionError, for 0.0 and for -0.0 alike.
def is_negative_zero_WRONG(x):
    return 1.0 / x < 0.0
```

The `math.atan2` fallback that C programmers reach for next does work —
`atan2` is documented to consider the signs of both arguments, so
`math.atan2(0.0, x)` distinguishes the zeros — but it is an obscure spelling of
`copysign` and the next reader will not follow it. Use `copysign`.

### `str()` is not a test either

`str(-0.0)` and `repr(-0.0)` do carry the minus, so `"-" in repr(x)` looks
tempting. It is fragile for the reason [06f](06f-printing-negative-zero.md)
covers in full: `repr` is one of at least four display paths in Python and they
disagree with one another — `format(-0.0, '.1f')` and `format(-0.0, 'g')`
produce differently-shaped strings, and the `'z'` option added in 3.11 exists
specifically to suppress the sign. A string test couples a numeric predicate to
a formatting decision somebody will change without thinking about you.

### `Decimal` carries its own signed zero, and shows it

`decimal.Decimal` is not a float and does not go through `copysign`; it stores a
sign field of its own, and `Decimal('-0')` is a legal decimal. `Decimal`'s
`is_signed()` method is the equivalent test, and unlike floats the sign is
visible in `str()`, because the decimal string representation renders it. Note
that `Decimal('-0') == Decimal('0')` is still `True` — the sign does not affect
comparison there either, exactly as with floats. What changes is only that the
value survives into printed output where a float might not have.

## Gotchas

**★ `if x == 0` and `if not x` cannot distinguish the two zeros, so a "skip the
zero rows" filter silently drops your negative zeros too.** That is usually what
you want; it becomes a bug only when the sign was carrying information — a
signed delta where "fell to exactly zero" and "rose to exactly zero" are
different events. If the sign is data, it must not live in a float's sign bit.
Give it its own field.

**★ `1.0 / x < 0` ported from C raises instead of answering.** Python's
`ZeroDivisionError` on `1.0 / 0.0` means the C idiom does not give a wrong
answer, it aborts the function — a `try/except ZeroDivisionError` wrapper around
ported numeric code will convert this into a silently wrong branch. Replace it
with `math.copysign(1.0, x) < 0.0`, which is total: it works for zeros,
non-zeros, infinities and NaNs alike.

**★ `math.copysign(1.0, x) < 0` alone is a sign-bit test, not a negative-zero
test.** It returns `True` for `-3.5` as well. If you specifically want negative
zero you need the `x == 0.0` conjunct. Conflating the two gives you a filter
that silently rejects every negative number in the dataset.

**★ `{0.0, -0.0}` has one element and `{-0.0, 0.0}` has one element, but not the
same element.** Deduplicating a list of floats through a `set` collapses the
zeros to whichever came first in iteration order. Write that set out and the
sign in your output depends on input ordering — a golden-file or
reproducible-build failure with no visible cause, because the two files differ
by one character that `diff` shows and equality does not.

**★ `-0.0` compares equal to `0`, to `Decimal(0)` and to `Fraction(0)`, so
switching type does not rescue you.** The numeric tower's equality is value-based
across `int`, `float`, `Decimal` and `Fraction` (see
[13c](13c-the-numeric-tower.md)), and none of those comparisons consults a sign
bit. Converting a float to `Decimal` to "get an exact comparison" changes
nothing about zeros.

**★ NaN has a sign bit too, and `copysign` reads it.**
`math.copysign(1.0, float('nan'))` returns `1.0` or `-1.0` depending on which
NaN you happen to have, and nothing in Python lets you predict or control which.
The math docs are explicit that *"Python makes no effort to distinguish
signaling NaNs from quiet NaNs"* and treats NaN payloads as unspecified. Do not
run a sign-bit test on a value that might be NaN and treat the answer as
meaningful — guard with `math.isnan` first
([06b](06b-detecting-nan-and-containers.md)).

**★ `x is 0.0` is not a negative-zero test and is not a zero test.** It is a
question about object identity that happens to answer `True` sometimes because
the compiler folds equal float constants within a code object. It will answer
`False` for a `-0.0` that came from arithmetic, `False` for a `0.0` that came
from arithmetic, and modern Python emits a `SyntaxWarning` for `is` against a
literal. There is no identity-based route into this problem.

**★ `functools.lru_cache` and any hash-keyed memo see one zero.** Because the
hash and the equality both collapse, a cache keyed on a float argument returns
the `0.0` result for a `-0.0` call. If the cached function is sign-sensitive —
`math.copysign` itself, or a formatter — the cache is now wrong, and it will
stay wrong for the process lifetime.

## Interview questions

**★ How do you tell `-0.0` from `0.0` in Python?**
`math.copysign(1.0, x) < 0.0`, conjoined with `x == 0.0` if you want negative
zero specifically rather than "any negative value". The docs guarantee this case
explicitly: *"On platforms that support signed zeros, `copysign(1.0, -0.0)`
returns -1.0."* Nothing else works. `==`, `<`, `<=`, `bool()`, `hash()`,
membership and `min`/`max` all treat the two zeros as one, because IEEE 754
requires `-0.0 == 0.0` and Python's documented numeric hash requirement — equal
numbers must hash equally — then forces the hashes to match too.

**★ Why can't you use `1.0 / x` the way you would in C?**
Because Python raises `ZeroDivisionError` on division by either zero rather than
returning a signed infinity. This is one of the deliberate places where Python
departs from IEEE 754: the standard says `1.0 / 0.0` signals division-by-zero
and delivers `+inf`; Python raises. So the C idiom does not merely give a
different answer, it terminates the function. `math.copysign` is the
replacement, and unlike the division it is defined for every float.

**★ How many elements does `{0.0, -0.0, 0, False}` have, and why?**
One. All four compare equal — `-0.0 == 0.0` by IEEE 754, `0.0 == 0` by the
numeric tower's cross-type equality, and `False == 0` because `bool` is a
subclass of `int` (see [04](04-bool-is-an-int.md)) — and Python's hashing rule
requires equal numbers to hash equally, so all four collide into a single set
member. Which object is stored is the first inserted, which is `0.0` here, but
that is CPython behaviour rather than a documented guarantee.

**★ Show the documented mechanism by which `hash(-0.0)` and `hash(0.0)` end up
equal.**
The stdtypes page publishes a Python equivalent of the built-in hash. For a
finite float it is `hash_fraction(*x.as_integer_ratio())`. `as_integer_ratio` is
documented to return the exact ratio in lowest terms with a positive
denominator; the exact value of `-0.0` is zero, so the pair is `(0, 1)`, the
same pair `0.0` produces. The sign bit is discarded before hashing begins — it
is not that the hash function ignores it, it is that the value handed to the
hash function no longer contains it.

**★ Why can a `set` contain two NaNs but never two zeros?**
Different branches of the same documented `hash_float`. NaN takes the
`object.__hash__(x)` branch, which is identity-based, so two *distinct* NaN
objects get different hashes and `x is x` short-circuits membership to `True`
only for the same object — two NaNs from different sources are two set members.
Zeros take the `hash_fraction` branch, which is value-based and sign-blind, and
they also compare equal, so they always collapse to one.

**★ Is `-0.0` a problem, or just a curiosity?**
It is a display and serialisation problem, not an arithmetic one. Arithmetic on
`-0.0` is correct and IEEE-defined throughout, and every comparison you would
write behaves as though it were `0.0`. Where it costs you is at a boundary: a
report that shows `-0.00`, a golden-file test that fails on one character, a
JSON payload whose consumer reads `-0` back as an integer zero, and a set-based
deduplication whose output depends on input order. Every one of those is fixed
at the boundary, not in the arithmetic — which is why
[06f](06f-printing-negative-zero.md),
[06g](06g-negative-zero-across-a-boundary.md) and
[06h](06h-other-runtimes-and-databases.md) exist.

---

← Prev: [Detecting NaN, and containers](06b-detecting-nan-and-containers.md) · Index: [Numbers](README.md) · Next → [Where negative zero comes from](06d-where-negative-zero-comes-from.md)

{/* FOOTER */}
