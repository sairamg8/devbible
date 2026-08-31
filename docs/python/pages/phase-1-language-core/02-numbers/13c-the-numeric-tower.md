---
title: "numbers.Integral is an abstract tower over the concrete types, and Decimal was deliberately left out of it"
sidebar_label: "13c · The numeric tower"
sidebar_position: 132
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the Python 3.14 library reference
> ([`numbers`](https://docs.python.org/3.14/library/numbers.html),
> [Numeric Types — int, float, complex](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex))
> and [PEP 3141 — A Type Hierarchy for Numbers](https://peps.python.org/pep-3141/).
> Version spine: **Python 3.14.7**.

**Above the concrete numeric types sits a second, abstract structure: the `numbers`
module's tower, `Number` → `Complex` → `Real` → `Rational` → `Integral`, which is
what `isinstance(x, numbers.Real)` actually tests. It is registration, not behaviour,
and two facts about it decide whether you should use it at all. `Fraction` is
registered as `Rational`, so the tower does cover the exact-rational case. But
**`Decimal` is not in the tower at all** — PEP 3141 says *"the `Decimal` type should
not at this time be made part of the numeric tower"* — so
`isinstance(Decimal("1.5"), numbers.Real)` is `False`, and a validator written as
"accept any real number" silently rejects the type you were told to use for money.
The tower also inherits every boolean ambiguity, because `bool` subclasses `int`:
`isinstance(True, numbers.Integral)` is `True`.**

## The abstract tower

`numbers` defines ABCs, not implementations. From the docs, rung by rung:

| ABC | Adds | Registered built-ins |
|---|---|---|
| `Number` | nothing — *"The root of the numeric hierarchy"* | all of them |
| `Complex` | *"conversions to `complex` and `bool`, `real`, `imag`, `+`, `-`, `*`, `/`, `**`, `abs()`, `conjugate()`, `==`, and `!=`"* | `complex` |
| `Real` | *"a conversion to `float`, `math.trunc()`, `round()`, `math.floor()`, `math.ceil()`, `divmod()`, `//`, `%`, `<`, `<=`, `>`, and `>=`"* | `float` |
| `Rational` | *"`numerator` and `denominator` properties"* | `Fraction` |
| `Integral` | *"a conversion to `int`"*, plus `pow()` with modulus and `<<`, `>>`, `&`, `^`, `\|`, `~` | `int`, and therefore `bool` |

The tower is what you test against when you mean "any real number" rather than
"a `float`":

```python
import numbers
isinstance(3, numbers.Integral)          # True
isinstance(3, numbers.Real)              # True — Integral subtypes Rational subtypes Real
isinstance(3.0, numbers.Integral)        # False
isinstance(True, numbers.Integral)       # True — bool is an int
```

That last line is the point of contact with
[bool is an int](04-bool-is-an-int.md): the tower inherits every boolean/integer
ambiguity, so a `numbers.Integral` check is no better at excluding `True` than an
`int` check is.

### `Decimal` is not in the tower

This is the fact worth carrying away, because it makes the obvious use of `numbers`
wrong. PEP 3141 states the decision plainly: *"the `Decimal` type should not at this
time be made part of the numeric tower."*

```python
isinstance(Decimal("1.5"), numbers.Real)     # False
isinstance(Decimal("1.5"), numbers.Number)   # False
```

So a validator written as `if not isinstance(x, numbers.Real): raise` rejects the
exact type you were told to use for money in
**Decimal for money** *(not written yet)*. If a function must accept both, say so:

```python
from decimal import Decimal
import numbers

Numeric = (numbers.Real, Decimal)
if not isinstance(amount, Numeric):
    raise TypeError("expected a real number or a Decimal")
```

The reasoning behind the exclusion is that `Decimal`'s equality and hashing
interoperate with the tower while its *arithmetic* does not behave the way `Real`
promises — its `//` truncates toward zero rather than flooring, as
**floor division and modulo** *(not written yet)* covers. A type that is `Real` by
`isinstance` but not by behaviour would be worse than one that is honestly outside.

### Registering your own numeric type

If you write a numeric class, register it against the right rung and mind the hash.
The docs are explicit:

> *"Implementers should be careful to make equal numbers equal and hash them to the
> same values. This may be subtle if there are two different extensions of the real
> numbers."*

Equal-hashing across types is what makes `1 == 1.0 == Fraction(1)` share a dict key
(see [identity and boundaries](01c-identity-and-boundaries.md)), and breaking it
produces a container that appears to lose entries.

### Typing sees a shortcut, not the tower

The typing specification defines a numeric shortcut that has nothing to do with
`numbers`: an `int` argument is acceptable where `float` is annotated, and `int` or
`float` where `complex` is annotated. So `def f(x: float)` accepts an `int` with no
complaint, and `def f(x: complex)` accepts both — while `numbers.Real` and friends
are runtime ABCs that most checkers do not treat as equivalent to those annotations.
Phase 6 covers the consequences; the short version is **annotate with the built-in
types and check with the ABCs**, not the other way round.

## Gotchas

### `isinstance(Decimal(...), numbers.Real)` is `False`

**Symptom.** A "accept any real number" validator rejects the money type.
**Cause.** PEP 3141 deliberately left `Decimal` out of the tower.
**Fix.** Test against an explicit tuple — `(numbers.Real, Decimal)` — or against the
concrete types you actually support.

### `isinstance(True, numbers.Integral)` is `True`

**Symptom.** Moving a check from `int` to `numbers.Integral` did not exclude booleans.
**Cause.** The tower is registered over the concrete types, and `bool` subclasses
`int`.
**Fix.** The same guard as everywhere else — check `bool` first. See
[identity traps](04b-bool-identity-traps.md).

### A custom numeric type appears to vanish from a dict

**Symptom.** `d[MyNumber(1)]` misses an entry stored under `1`.
**Cause.** The type compares equal to `1` but does not hash equal, breaking the
invariant the `numbers` docs call out.
**Fix.** Implement `__hash__` consistently with `__eq__`, following
[hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#numeric-hash).

## Interview questions

**What is the numeric tower, and what does `isinstance(x, numbers.Real)` actually
test?**
`numbers` defines abstract base classes `Number` → `Complex` → `Real` → `Rational` →
`Integral`, each adding a set of operations, with the built-in types registered
against them. `isinstance(x, numbers.Real)` tests registration, not behaviour — it is
true for `int`, `bool` and `float`, and false for `complex`.

**Is `Decimal` a `numbers.Real`?**
No, and that is deliberate. PEP 3141: *"the `Decimal` type should not at this time be
made part of the numeric tower."* A tower check therefore rejects the type used for
money. Test against `(numbers.Real, Decimal)` explicitly if both must be accepted.

**Is `Fraction` in the tower?**
Yes — it is the registered `Rational`, which is the rung that adds `numerator` and
`denominator`. The docs add that those *"should be instances of `Integral` and should
be in lowest terms with `denominator` positive."*

**You are writing a function that must accept any real number. How do you annotate it
and how do you check it?**
Annotate with `float` — the typing shortcut means an `int` is acceptable where a
`float` is annotated, and `int` or `float` where `complex` is. Check at runtime with
`numbers.Real` if you need a check at all, remembering that it admits `bool` and
excludes `Decimal`. Annotate with built-ins, check with ABCs.

---

← Prev: [cmath](13b-cmath.md) · Index: [Numbers](README.md) · Next → **math versus the operators** *(not written yet)*
