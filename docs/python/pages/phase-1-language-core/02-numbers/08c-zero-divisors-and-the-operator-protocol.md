---
title: "Python raises ZeroDivisionError where IEEE-754 would hand you an infinity, and divmod() is a third protocol that nothing keeps in step with // and %"
sidebar_label: "8c · Zero divisors and the protocol"
sidebar_position: 82
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 language reference
> [Binary arithmetic operations](https://docs.python.org/3.14/reference/expressions.html#binary-arithmetic-operations),
> the library reference
> [Numeric Types — int, float, complex](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex),
> [`divmod()`](https://docs.python.org/3.14/library/functions.html#divmod) and
> [`numbers`](https://docs.python.org/3.14/library/numbers.html).
> Version spine: **Python 3.14.7**.

**Two things about `//` and `%` that have nothing to do with flooring and
everything to do with the type system. First: Python raises
`ZeroDivisionError` for a float zero divisor as well as an integer one, which
means it deliberately does *not* follow IEEE-754 — there is no quiet `inf` and
no quiet `nan` from the built-in operators, so code moved in from NumPy or C
starts throwing where it used to propagate. Second: `//`, `%` and `divmod()`
are three independent protocols with six dunder methods between them, and the
interpreter never cross-checks them, so a numeric wrapper can satisfy all three
and still be internally inconsistent.**

## Zero divisors, and the shapes they take

> *"Division by zero raises the `ZeroDivisionError` exception."* — and for
> `%`: *"A zero right argument raises the `ZeroDivisionError` exception."*

`x / 0`, `x // 0`, `x % 0` and `divmod(x, 0)` all raise `ZeroDivisionError`,
and — this is the part that surprises people arriving from C or NumPy — so do
`x / 0.0`, `x // 0.0` and `x % 0.0`. The built-in operators do not implement
IEEE-754's division-by-zero behaviour at all.

That is a language-design decision, not an oversight: Python's default is that
a nonsense computation stops immediately rather than propagating a `nan`
through four more stages and surfacing as an odd number in a report. The
`decimal` module offers the other policy explicitly, through untrapped signals
— see **10b** *(not written yet)* — and NumPy offers it by
default, with a `RuntimeWarning`.

The realistic failure is a divisor derived from a length:

```python
shard = hash(key) % len(shards)     # ZeroDivisionError when shards is empty
```

The traceback names `%`, not the empty list, so the reported symptom points at
the arithmetic while the cause is three frames up in whatever produced
`shards`. Guard the collection where it is built; a `try/except` around the
operator only moves the mystery.

If you genuinely want IEEE semantics, produce them explicitly rather than
hoping the operator will:

```python
import math

def ieee_div(a: float, b: float) -> float:
    """What C would have done: ±inf for a nonzero numerator, nan for 0/0."""
    if b == 0.0:
        if a == 0.0 or math.isnan(a):
            return math.nan
        return math.copysign(math.inf, a) * math.copysign(1.0, b)
    return a / b
```

`math.copysign(1.0, b)` rather than a sign test on `b`, because `-0.0 == 0.0`
is `True` — a plain `b < 0` cannot tell negative zero from positive zero, and
IEEE says the sign of the infinity depends on it.

## Types: `//` and `%` never widen away from the operands

Mixed-type arithmetic follows the ordinary widening rule from the library
reference — *"the operand with the 'narrower' type is widened to that of the
other"* — and floor division applies it before flooring, not after:

```python
7 // 2          # int    -> 3
7.0 // 2        # float  -> whole-valued, but still a float
7 // 2.0        # float
True // True    # int    -> 1  (bool is an int subclass; the result is not True)
```

`7.0 // 2` being a `float` is a real hazard. It cannot be used as a list index,
`isinstance(x, int)` is `False` for it, and it serialises to JSON as `3.0`
rather than `3`. If a function is documented to return an index or a count,
keep both operands `int`, or wrap the result in `int()` deliberately so a
reader can see the decision was made rather than inherited.

`//`, `%` and `divmod()` are **not defined for complex numbers**:

> *"The floor division operator, the modulo operator, and the `divmod()`
> function are not defined for complex numbers. Instead, convert to a
> floating-point number using the `abs()` function if appropriate."*

## The three protocols, and why they drift

> *"The floor division operation can be customized using the special
> `__floordiv__()` and `__rfloordiv__()` methods."* … *"The modulo operation
> can be customized using the special `__mod__()` and `__rmod__()` methods."*

`divmod()` dispatches separately, to `__divmod__()` / `__rdivmod__()`. The
built-in does **not** synthesise `divmod` from `__floordiv__` and `__mod__`, and
it does not cross-check the three against each other. A numeric wrapper that
implements two of the three raises `TypeError` on the third; one that
implements all three by hand can be quietly inconsistent forever.

```python
class Cents:
    __slots__ = ("v",)

    def __init__(self, v: int) -> None:
        self.v = int(v)

    def __floordiv__(self, other):
        return Cents(self.v // int(other))

    def __rfloordiv__(self, other):
        return Cents(int(other) // self.v)

    def __mod__(self, other):
        return Cents(self.v % int(other))

    def __rmod__(self, other):
        return Cents(int(other) % self.v)

    def __divmod__(self, other):
        # Derive it. Never write the arithmetic a second time by hand.
        q, r = divmod(self.v, int(other))
        return Cents(q), Cents(r)

    def __rdivmod__(self, other):
        q, r = divmod(int(other), self.v)
        return Cents(q), Cents(r)
```

Deriving `__divmod__` from the built-in `divmod` on the underlying `int` is the
only version that cannot drift out of agreement with `//` and `%`, because
there is only one implementation of the arithmetic.

The reflected halves are not optional decoration. Without `__rfloordiv__`,
`Cents(7) // 2` works and `2 // Cents(7)` raises `TypeError`, because `int`
does not know what a `Cents` is and there is nothing on the right to ask.

If you register the type with the numeric tower, the ABC tells you which
operations you have signed up for:

> *"To `Complex`, `Real` adds the operations that work on real numbers. In
> short, those are: a conversion to `float`, `math.trunc()`, `round()`,
> `math.floor()`, `math.ceil()`, `divmod()`, `//`, `%`, `<`, `<=`, `>`, and
> `>=`."*

Subclassing `numbers.Real` therefore commits you to all of them — the ABC will
refuse to instantiate a class that leaves an abstract method unimplemented,
which is a feature, not an obstacle.

## Gotchas

**★ `x // 0.0` raises instead of returning an infinity.** Unlike C, NumPy and
raw IEEE-754, Python's built-in `/`, `//` and `%` raise `ZeroDivisionError` for
a float zero divisor as well as an integer one. Code migrated *from* NumPy that
relied on `inf`/`nan` propagation gets an exception instead — usually in a
pipeline stage that has no handler and no test for the empty case.

**★ A `ZeroDivisionError` from `%` almost always means an empty collection.**
The traceback blames the operator, but `hash(k) % len(shards)` fails because
`shards` is empty. Validate the collection where it is built; a guard at the
arithmetic site only moves the mystery one frame.

**★ `b < 0` cannot detect negative zero.** If you hand-roll IEEE behaviour, use
`math.copysign(1.0, b)`. `-0.0 < 0` is `False` and `-0.0 == 0.0` is `True`, so
a sign test silently produces `+inf` where IEEE requires `-inf`.

**★ `7.0 // 2` is a `float`, so it is not usable as an index.** Floor division
preserves the wider operand type; it does not convert to `int` just because the
value is whole. `items[7.0 // 2]` raises `TypeError`. Keep index arithmetic
integral end to end, and be suspicious of any `//` whose operands came from
`json.load` — JSON numbers written with a decimal point arrive as `float`.

**★ `True` and `False` participate in `//` and `%` as `1` and `0`.**
`x % True` is `x % 1`, which is `0` for every integer `x` — a silent
always-zero if a flag reaches an arithmetic slot through a mis-ordered
argument. `x % False` at least raises `ZeroDivisionError`. Neither is caught by
a type checker, because `bool` *is* an `int` subtype.

**★ `divmod()` on a custom type can disagree with that type's own `//` and
`%`.** Nothing enforces consistency: `divmod()` calls `__divmod__` and never
checks the result against `__floordiv__` and `__mod__`. Derive `__divmod__`
from the wrapped built-in rather than reimplementing it, and put
`assert divmod(x, y) == (x // y, x % y)` in the type's test suite.

**★ Implementing `__floordiv__` without `__rfloordiv__` breaks
`2 // your_object`.** The reflected methods are what make an operand work on
the *right* of the operator when the left operand's type does not know yours.
Omit them and `Cents // int` works while `int // Cents` raises `TypeError` —
the kind of asymmetry that is discovered in production because unit tests are
written in the order the author was thinking in.

**★ `abs()` is the documented escape for complex numbers, and it is lossy.**
The reference tells you to *"convert to a floating-point number using the
`abs()` function if appropriate"* — but `abs()` of a complex number is its
magnitude, so you have thrown away the phase. If `//` on a complex number
seemed like the right operation, the design is probably wrong, not the
conversion.

**★ Registering with `numbers.Real` is a bigger promise than it looks.** The
ABC requires `__trunc__`, `__floor__`, `__ceil__`, `__round__`, `__divmod__`,
`__floordiv__`, `__mod__` and the four ordering comparisons, plus
`__float__`. Registering to get `isinstance(x, numbers.Real)` to return `True`
and then not implementing the rest gives you a type that passes the check and
fails on use.

## Interview questions

**★ Does Python's `/` follow IEEE-754 for division by zero?**
No, not for the built-in operators. C and IEEE-754 give `±inf` for a nonzero
numerator over a float zero and `nan` for `0.0/0.0`; Python raises
`ZeroDivisionError` in every case, for `/`, `//` and `%`, whether the divisor is
`0` or `0.0`. NumPy *does* follow IEEE (with a `RuntimeWarning`), which is why
code moving between plain Python and NumPy changes behaviour without changing
shape. The `decimal` module lets you choose, by trapping or not trapping the
`DivisionByZero` signal.

**★ Is `//` ever *not* an integer?**
Yes. *"For operands of type `float`, the result has type `float`."* `7.0 // 2`
is a whole-valued `float`, `Decimal(7) // 2` is a `Decimal`, and
`Fraction(7) // 2` is an `int`. The docs are careful about this: *"In general,
the result is a whole integer, though the result's type is not necessarily
`int`."*

**★ Which numeric types do `//`, `%` and `divmod()` refuse?**
`complex`. The reference: *"The floor division operator, the modulo operator,
and the `divmod()` function are not defined for complex numbers. Instead,
convert to a floating-point number using the `abs()` function if
appropriate."* There is no meaningful floor on the complex plane, since there is
no total order to floor toward.

**★ You are writing a numeric wrapper type. Which dunders do you need for
`//`, `%` and `divmod()` to all work in both operand positions?**
Six: `__floordiv__` / `__rfloordiv__`, `__mod__` / `__rmod__`, and
`__divmod__` / `__rdivmod__`. `divmod()` is not derived from the other two, and
the reflected halves are what allow a built-in `int` on the left of the
operator. Derive `__divmod__` from the built-in `divmod` of the wrapped value
so it cannot drift out of step.

**★ Where does `7.0 // 2` returning a `float` actually cause a bug?**
Anywhere the value is used structurally rather than numerically: as a list or
string index (`TypeError`), as a `range()` bound (`TypeError`), as a dict key
later compared to an `int` key (this one *works*, because `3.0` and `3` hash
equal and compare equal, which hides the problem), and in JSON output, where
`3.0` and `3` are different documents to a strict consumer. The usual source is
a number that arrived from `json.load` or a CSV parse as a `float`.

**★ Why is `math.copysign(1.0, b)` better than `b < 0` when reasoning about
signs?**
Because `-0.0` exists. `-0.0 < 0` is `False` and `-0.0 == 0.0` is `True`, so
comparison operators cannot see the sign bit of a zero. `copysign` reads the
sign bit directly, which is exactly what IEEE-754 rules about zero divisors and
signed infinities depend on.

---

← Prev: [Ceiling division and exactness](08b-ceiling-division-and-integer-edges.md) · Index: [Numbers](README.md) · Next → [Modulo on floats and Decimals](08d-modulo-on-floats-and-decimals.md)

{/* FOOTER */}
