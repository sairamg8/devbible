---
title: "Writing an __eq__ that other people's types can cooperate with, and the 3.14 TypeError that finally makes a leaked NotImplemented loud"
sidebar_label: "2b · Writing `__eq__` correctly"
sidebar_position: 63
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 library reference
> [Built-in Constants — `NotImplemented`](https://docs.python.org/3.14/library/constants.html#NotImplemented),
> the [data model — rich comparison methods](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__),
> and [`functools.total_ordering`](https://docs.python.org/3.14/library/functools.html#functools.total_ordering).
> Version spine: **CPython 3.14**.

**Almost every `__eq__` in the wild has the same bug: a type guard that returns
`False`. It looks harmless because it produces the right answer for the case the
author tested, and it is wrong because it answers a question that was not asked —
"not equal" instead of "not my type" — which shuts down the reflected-operand
fallback and makes equality asymmetric. This chunk is the correct shape of the
method, the distinction between `NotImplemented` and a deliberate `TypeError`, and
the 3.14 change that turns the related sin, testing `NotImplemented` in an `if`,
into an exception.**

## Writing `__eq__` correctly

The wrong version, and the one you will find in most codebases:

```python
class Money:
    def __init__(self, cents, currency):
        self.cents, self.currency = cents, currency

    def __eq__(self, other):
        if not isinstance(other, Money):
            return False                 # 🔴 WRONG
        return (self.cents, self.currency) == (other.cents, other.currency)
```

The bug is not visible until someone writes a type that *should* compare equal to a
`Money`:

```python
class MoneyLike:                          # e.g. a test double, or an ORM column type
    def __eq__(self, other):
        if isinstance(other, Money):
            return self.as_money() == other
        return NotImplemented
```

Now `Money(500, "EUR") == MoneyLike(...)` returns `False` immediately, because
`Money.__eq__` answered "no" instead of "not my problem", and `MoneyLike.__eq__` is
never consulted. Meanwhile `MoneyLike(...) == Money(500, "EUR")` returns `True`.
Equality is no longer symmetric, and the two orderings of the same comparison
disagree — which will eventually show up as a `set` containing what look like
duplicates, or a test that passes in one direction only.

The correct version:

```python
class Money:
    __slots__ = ("cents", "currency")

    def __init__(self, cents: int, currency: str):
        self.cents, self.currency = cents, currency

    def __eq__(self, other):
        if not isinstance(other, Money):
            return NotImplemented        # ✅ let the other operand answer
        return (self.cents, self.currency) == (other.cents, other.currency)

    def __lt__(self, other):
        if not isinstance(other, Money):
            return NotImplemented
        if self.currency != other.currency:
            raise TypeError(f"cannot order {self.currency} against {other.currency}")
        return self.cents < other.cents

    def __hash__(self):
        return hash((self.cents, self.currency))
```

Note the deliberate distinction inside `__lt__`: `NotImplemented` for *"wrong type,
someone else may know"*, but an explicit `raise TypeError` for *"right type, but this
particular pair is meaningless"*. Returning `NotImplemented` for the currency
mismatch would produce the interpreter's generic message —
`'<' not supported between instances of 'Money' and 'Money'` — which is exactly the
"misleading error message" the constants documentation warns about.

The standard library's own example, from `functools.total_ordering`, uses a duck-typed
guard rather than `isinstance`:

```python
def _is_valid_operand(self, other):
    return (hasattr(other, "lastname") and
            hasattr(other, "firstname"))
def __eq__(self, other):
    if not self._is_valid_operand(other):
        return NotImplemented
    ...
```

Either shape is fine. The load-bearing part is `return NotImplemented`, not how you
decided.

## `NotImplemented` in a boolean context: a `TypeError` since 3.14

This is the 3.14 change worth knowing by heart:

> *"Changed in version 3.14: Evaluating `NotImplemented` in a boolean context now
> raises a `TypeError`. It previously evaluated to `True` and emitted a
> `DeprecationWarning` since Python 3.9."* —
> [Built-in Constants](https://docs.python.org/3.14/library/constants.html#NotImplemented)

The docs also state the rule plainly in the entry itself: *"It should not be
evaluated in a boolean context."*

Why this matters: `NotImplemented` is a truthy singleton in ≤3.8, so code that
called a dunder *directly* got a silently wrong answer:

```python
if a.__eq__(b):          # 🔴 never do this
    ...
```

If `a.__eq__` returned `NotImplemented`, that `if` took the true branch on every
Python up to 3.8, warned on 3.9–3.13, and raises `TypeError` on 3.14. The fix is
never to call the dunder yourself — write `a == b` and let the interpreter run the
protocol, including the reflection and the identity fallback. The same applies to
`functools.reduce(operator.eq, ...)`-style code and to any wrapper that forwards a
comparison result.

Note that this is about `bool(NotImplemented)`, not about *returning* it. Returning
`NotImplemented` from a dunder remains correct and required.

## Gotchas

**★ `a == b` is `False` but `b == a` is `True`.** One of the two `__eq__`
implementations returns `False` for unknown types instead of `NotImplemented`, so
the reflected method is never tried in one direction. Fix: `return NotImplemented`
from the type-check branch in *both* classes.

**★ `TypeError: '<' not supported between instances of 'Money' and 'Money'` — the
same type on both sides.** Your `__lt__` returned `NotImplemented` for a condition
that was not a type mismatch (different currency, different unit, uninitialised
field). Both operands then declined, so the interpreter raised its generic message.
Fix: `raise TypeError("cannot order EUR against USD")` explicitly for meaningful
refusals; reserve `NotImplemented` for "not my type".

**★ `TypeError: NotImplemented should not be used in a boolean context` appearing
only after upgrading to 3.14.** Some code path calls `__eq__`/`__lt__` directly and
tests the result. On 3.9–3.13 it emitted a `DeprecationWarning` that nobody read, and
before that it silently evaluated `True`. Fix: replace `x.__eq__(y)` with `x == y`
everywhere; if you must dispatch manually, compare with
`result is NotImplemented` before using it.

**★ A comparison against a `Mock` or a test double behaving differently from
production.** The double returns `NotImplemented` (correct) while the production
class returns `False` (incorrect), so the *direction* of the comparison decides the
result and the test passes for the wrong reason. Fix: audit for `return False` in
dunder type guards — `grep -n -A3 'def __eq__' **/*.py | grep 'return False'` finds
most of them in one pass.

**★ Confusing `NotImplemented` with `NotImplementedError`.** The docs carry an
explicit Caution: *"`NotImplemented` and `NotImplementedError` are not
interchangeable."* `raise NotImplemented` raises `TypeError` (you cannot raise a
non-exception), and `return NotImplementedError` from `__eq__` returns a truthy class
object, making every comparison true. Fix: `return NotImplemented` in binary dunders;
`raise NotImplementedError` in abstract methods.

**★ `isinstance(other, Money)` making a subclass compare equal to its base.** A
subclass that adds a field passes the `isinstance` check, so `Money(500,"EUR") ==
PremiumMoney(500,"EUR",tier="gold")` is `True`. Fix: use `type(self) is type(other)`
when the classes are meant to be distinct — this is exactly what
`@dataclass(eq=True)` does, whose docs say *"Both instances in the comparison must be
of the identical type."*

**★ A duck-typed guard (`hasattr`) accepting an object that merely happens to have
the attribute.** The `total_ordering` example in the standard library uses
`hasattr(other, "lastname")`, which a completely unrelated CSV row object might also
satisfy. Fix: prefer `isinstance` against a shared ABC or protocol when the domain is
closed; keep `hasattr` for genuinely open extension points, and document it.

## Interview questions

**★ Q: What is wrong with `return False` in `__eq__`'s type-check branch?**
It answers a question you were not asked. `False` means "definitely not equal", so
the interpreter stops and never tries the other operand's `__eq__`. Any type that
knows how to compare itself to yours is silently locked out, and equality becomes
asymmetric: `a == b` is `False` while `b == a` is `True`. `NotImplemented` means
"I don't know", which keeps the protocol running.

**★ Q: When should `__lt__` raise `TypeError` instead of returning `NotImplemented`?**
When the *type* is right but the *pair* is meaningless — comparing euros to dollars,
a timezone-aware datetime to a naive one, two vectors of different length.
`NotImplemented` in that position produces the interpreter's generic
"not supported between instances of X and X" message, which the constants
documentation describes as a misleading error message. An explicit raise lets you say
why.

**★ Q: What changed about `NotImplemented` in Python 3.14?**
Evaluating it in a boolean context now raises `TypeError`. It used to evaluate to
`True`, then from 3.9 to `True` with a `DeprecationWarning`. This surfaces code that
calls comparison dunders directly and tests the result — code that had been silently
taking the wrong branch for years.

**Q: Is it still correct to *return* `NotImplemented` in 3.14?**
Yes, and required. The 3.14 change is about `bool(NotImplemented)` — evaluating the
singleton in an `if`, a `while`, an `and`, a `not`. Returning it from a binary dunder
is the documented protocol and is unaffected.

**Q: `NotImplemented` versus `NotImplementedError` — where does each belong?**
`NotImplemented` is a value you `return` from a binary dunder to trigger reflection.
`NotImplementedError` is an exception you `raise` from an abstract or unfinished
method. The docs carry an explicit caution that the two are not interchangeable, and
mixing them up produces either a `TypeError` from `raise` or a permanently-truthy
comparison.

**Q: `isinstance` or `type(self) is type(other)` in `__eq__`?**
`isinstance` if subclasses should compare equal to their base — which requires that
the subclass adds no state relevant to equality, and that you have thought about
symmetry and transitivity. `type(self) is type(other)` otherwise; it is what
`@dataclass` generates, and the dataclasses docs state that both instances must be of
the identical type.

**Q: How would you make a class comparable to a foreign type you do not control?**
Implement the comparison on *your* side and return `NotImplemented` for everything
else. The foreign type will be tried first (or second, depending on operand order),
decline, and the interpreter will reflect into your method. You never need to modify
the other class — that is the entire point of the fallback.

---

← Prev: [NotImplemented and reflection](02-notimplemented-and-reflection.md) · Index: [Comparisons](README.md) · Next → [`__ne__`, `__hash__` and the equality contract](02c-ne-hash-and-the-contract.md)
