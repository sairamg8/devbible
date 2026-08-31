---
title: "Decimal's // truncates toward zero where int's floors, so the same expression gives two different answers depending on the operand type"
sidebar_label: "8d · Decimal truncates, int floors"
sidebar_position: 83
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference for
> [`decimal`](https://docs.python.org/3.14/library/decimal.html)
> (Decimal objects; `remainder_near`) and the language reference
> [Binary arithmetic operations](https://docs.python.org/3.14/reference/expressions.html#binary-arithmetic-operations).
> Version spine: **Python 3.14.7**.

**Everything [08](08-floor-division-and-modulo.md) says about `//` and `%` is
true of `int` and false of `Decimal`. `-7 // 4` is `-2`; `Decimal(-7) //
Decimal(4)` is `Decimal('-1')`. `-7 % 4` is `1`; `Decimal(-7) % Decimal(4)` is
`Decimal('-3')`. Both satisfy the identity `x == (x//y)*y + (x%y)` — they just
satisfy it with different halves, because `Decimal` follows the IBM decimal
arithmetic specification, which truncates. This is the highest-value fact in
the whole numbers topic, because a codebase that computes an allocation in
`int` cents and re-checks it in `Decimal` gets two different answers from the
same expression, with no error anywhere.**

## `Decimal` truncates. `int` floors.

The `decimal` documentation states the divergence for `%` first:

> *"There are some small differences between arithmetic on `Decimal` objects
> and arithmetic on integers and floats. When the remainder operator `%` is
> applied to `Decimal` objects, the sign of the result is the sign of the
> dividend rather than the sign of the divisor"* — with `(-7) % 4` giving `1`
> and `Decimal(-7) % Decimal(4)` giving `Decimal('-3')`.

and then explains why `//` has to move with it:

> *"The integer division operator `//` behaves analogously, returning the
> integer part of the true quotient (truncating towards zero) rather than its
> floor, so as to preserve the usual identity `x == (x // y) * y + x % y`"* —
> with `-7 // 4` giving `-2` and `Decimal(-7) // Decimal(4)` giving
> `Decimal('-1')`.

| Expression | `int` | `Decimal` |
|---|---|---|
| `-7 // 4` | `-2` | `Decimal('-1')` |
| `-7 % 4` | `1` | `Decimal('-3')` |
| `7 // -4` | `-2` | `Decimal('-1')` |
| `7 % -4` | `-1` | `Decimal('3')` |

`Decimal` is not violating the invariant. It satisfies it exactly — that is the
stated *reason* for the choice. What it does not do is agree with `int` about
what either half of the invariant should be. The docs anchor the behaviour to
the standard rather than to Python:

> *"The `%` and `//` operators implement the remainder and divide-integer
> operations (respectively) as described in the specification."*

**`Decimal` is a C-style truncating type living inside a floored language.**

## Where this actually breaks a system

Anywhere a value's *type* varies across the call path. The canonical shape is a
refund or an adjustment that goes negative:

```python
from decimal import Decimal

def split_units(total, unit):
    """Split a (possibly negative) total into whole units and a remainder."""
    return divmod(total, unit)

split_units(-7, 4)                        # (-2, 1)           -- int, floored
split_units(Decimal(-7), Decimal(4))      # (-1, Decimal(-3)) -- Decimal, truncated
```

Same function, same numbers, two answers. A test written with positive inputs
passes for both, because the two conventions agree on positives. The bug ships
the first time a customer is refunded.

There are only two real defences. One is to pin the type at the boundary and
never let both through the same function. The other is to write the semantics
you want explicitly, so the answer no longer depends on what arrived:

```python
def floor_divmod(a, b):
    """Floored divmod for any numeric type, matching int semantics."""
    q = a // b
    r = a - q * b
    if r != 0 and (r < 0) != (b < 0):
        q -= 1
        r += b
    return q, r
```

For `int` the correction never fires, so this is a no-op. For `Decimal` it
converts the truncating result into the floored one, and the two types agree
again. The mirror-image helper, if the truncating convention is the one you
want everywhere:

```python
def trunc_divmod(a, b):
    """Truncating divmod for any numeric type, matching Decimal semantics."""
    q = a // b
    r = a - q * b
    if r != 0 and (r < 0) != (a < 0):
        q += 1
        r -= b
    return q, r
```

Pick one, put it in a module, and stop writing bare `//` on values whose type
you did not choose.

## The third convention `Decimal` gives you and `int` does not

`Decimal` carries a remainder operation with no operator and no `int`
equivalent:

> *"Return the remainder from dividing self by other. This differs from
> `self % other` in that the sign of the remainder is chosen so as to minimize
> its absolute value. More precisely, the return value is `self - n * other`
> where n is the integer nearest to the exact value of `self / other`, and if
> two integers are equally near then the even one is chosen."*
> — `Decimal.remainder_near`, documented with
> `Decimal(18).remainder_near(Decimal(10))` giving `Decimal('-2')` and
> `Decimal(25).remainder_near(Decimal(10))` giving `Decimal('5')`.

That is the decimal analogue of `math.remainder` — see
[08e](08e-float-modulo-fmod-and-remainder.md) — and it is genuinely useful for
"how far is this from the nearest multiple", where `%` answers "how far is this
above the multiple below".

## `Decimal` refuses to mix with `float` at all

> *"`Decimal` objects cannot generally be combined with floats or instances of
> `fractions.Fraction` in arithmetic operations: an attempt to add a `Decimal`
> to a `float`, for example, will raise a `TypeError`. However, it is possible
> to use Python's comparison operators to compare a `Decimal` instance x with
> another number y. This avoids confusing results when doing equality
> comparisons between numbers of different types."*

This is a feature: the two number systems cannot mix silently, so a `float`
cannot leak into a `Decimal` computation through arithmetic. But it means a
`%` expression that worked in a prototype starts raising `TypeError` the moment
one operand becomes a `Decimal`, and the traceback blames the operator rather
than the boundary — usually a JSON parse or an ORM column — where the type
changed. Comparison is the exception and is allowed in both directions.

## Gotchas

**★ `Decimal(-7) // Decimal(4)` is `Decimal('-1')`, not `-2`.** `Decimal`'s
`//` truncates toward zero and its `%` takes the sign of the dividend, per the
IBM specification. Any function that accepts "a number" and does `//` or `%` on
it therefore has two behaviours. Pin the type at the boundary, or route
everything through an explicit `floor_divmod` / `trunc_divmod` helper.

**★ The divergence only shows up for negative operands.** Positive inputs agree
exactly, so unit tests, fixtures and demo data all pass. The first negative
value in production — a refund, a chargeback, a correction, a southern latitude
— is where it surfaces, and by then the wrong number is already in a ledger.

**★ The `int` and `Decimal` answers differ in *both* halves, so a
reconciliation check does not catch it.** `-7 // 4` and `-7 % 4` give `(-2, 1)`;
the `Decimal` pair gives `(-1, -3)`. Both reconstruct `-7` under
`q*y + r == x`, so an assertion on the invariant passes for both. Only an
assertion on the quotient itself, or on the remainder's sign, detects the
divergence.

**★ `Decimal` will not do arithmetic with `float`.** *"An attempt to add a
`Decimal` to a `float`, for example, will raise a `TypeError`."* Comparisons
are allowed, arithmetic is not. The failure appears at the operator, one or
more frames from the boundary where the type actually changed.

**★ `Decimal.remainder_near` has no operator, so it is easy to miss.** If you
want a remainder minimised in absolute value, it exists — but only as a method.
Nothing about `%` hints that a third convention is available, so people
hand-roll it, usually incorrectly at the exact halfway case (the docs specify
round-half-to-even on `n`).

**★ Converting to `int` to "normalise" the type reintroduces the bug the other
way.** `int(Decimal('-1.5'))` truncates to `-1`, matching `Decimal`, while
`math.floor(Decimal('-1.5'))` gives `-2`, matching `int` semantics. Casting is
not a neutral act; it picks a convention.

## Interview questions

**★ What is `Decimal(-7) // Decimal(4)`, and why does it differ from
`-7 // 4`?**
`Decimal('-1')` versus `-2`. `Decimal` implements the IBM General Decimal
Arithmetic Specification's *divide-integer* operation, which returns *"the
integer part of the true quotient (truncating towards zero) rather than its
floor"*. It does so, in the docs' own words, *"so as to preserve the usual
identity `x == (x // y) * y + x % y`"* — because its `%` takes the sign of the
dividend. Both types satisfy the identity; they satisfy it with different
values.

**★ Is `Decimal` therefore breaking Python's modulo rule?**
It is diverging from the *language reference's* rule about the built-in
operators on built-in types, deliberately and on the record. The invariant
relating `//` and `%` is preserved. What is not preserved is "the remainder
takes the sign of the divisor" — which is a property of `int` and `float`, not
a property of the `%` operator in the abstract. The operator has no semantics
of its own; it dispatches to `__floordiv__` and `__mod__`.

**★ You have a `split_amount(total, parts)` helper used with both `int` cents
and `Decimal` amounts. What do you do?**
Stop accepting both. If that is impossible, replace the bare `//` and `%` with
an explicit floored or truncating helper so the convention is a property of the
function rather than of the argument, and add a test with a negative input for
each type — which is the test the original almost certainly did not have.

**★ Why does an assertion on `q * y + r == x` fail to catch the `int`/`Decimal`
divergence?**
Because both conventions satisfy it. Truncating division and a
dividend-signed remainder reconstruct the dividend just as exactly as floored
division and a divisor-signed remainder. The invariant is an internal
consistency check within a type, not a cross-type equivalence.

**★ Why can't you add a `Decimal` to a `float`?**
Because there is no conversion that is both exact and expected. Converting the
`float` to `Decimal` is exact but produces a 50-digit coefficient nobody wrote;
converting the `Decimal` to `float` is lossy and defeats the reason `Decimal`
was chosen. Rather than pick one silently, the module raises `TypeError`.
Comparisons are allowed because they can be answered exactly without producing
a value in either type.

---

← Prev: [Zero divisors and the protocol](08c-zero-divisors-and-the-operator-protocol.md) · Index: [Numbers](README.md) · Next → [Float modulo, fmod and remainder](08e-float-modulo-fmod-and-remainder.md)

{/* FOOTER */}
