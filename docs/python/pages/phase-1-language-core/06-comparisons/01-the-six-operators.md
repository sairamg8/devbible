---
title: "There are six comparison operators, they all have the same precedence, and every one of them is a method call you can override"
sidebar_label: "1 · The six operators"
sidebar_position: 60
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons)
> and [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> the [data model — rich comparison methods](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__),
> [`sorted()`](https://docs.python.org/3.14/library/functions.html#sorted),
> and [PEP 8 — Programming Recommendations](https://peps.python.org/pep-0008/#programming-recommendations).
> Version spine: **CPython 3.14**.

**`<`, `>`, `==`, `>=`, `<=`, `!=` are not primitive operations on values — each one
dispatches to a *method* on the left operand, and every one of them can return
anything at all. That single fact explains why `a == b` can build a SQL query, why
`arr == 1` can raise `ValueError`, and why a class with a working `__eq__` still
raises `TypeError` the moment you call `sorted()` on it. Python also gives all six
the *same* precedence, lower than every arithmetic and bitwise operator, which is
what makes `0 <= x < 10` parse the way mathematics reads it rather than the way C
does.**

## The operator table

Six operators, six methods. The language reference gives the correspondence
directly:

| Expression | Calls | Reflection is |
|---|---|---|
| `x < y` | `x.__lt__(y)` | `__gt__` |
| `x <= y` | `x.__le__(y)` | `__ge__` |
| `x == y` | `x.__eq__(y)` | `__eq__` (itself) |
| `x != y` | `x.__ne__(y)` | `__ne__` (itself) |
| `x > y` | `x.__gt__(y)` | `__lt__` |
| `x >= y` | `x.__ge__(y)` | `__le__` |

Two further comparison-class operators exist in the grammar and are *not* rich
comparison methods: `is` / `is not` (identity, uninterceptable — see
[04](04-is-versus-equals.md)) and `in` / `not in` (membership, which dispatches to
`__contains__`). The grammar puts all eight in one production:

> *"**comp_operator**: `"<" | ">" | "==" | ">=" | "<=" | "!=" | "is" ["not"] | ["not"] "in"`"*
> — [Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons)

## Precedence: all six are equal, and all six are low

The reference is explicit about the two ways this differs from C:

> *"Unlike C, all comparison operations in Python have the same priority, which is
> lower than that of any arithmetic, shifting or bitwise operation. Also unlike C,
> expressions like `a < b < c` have the interpretation that is conventional in
> mathematics"* —
> [Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons)

"Lower than any arithmetic, shifting or bitwise operation" is the part that bites
people porting code:

```python
x + 1 == y * 2          # (x + 1) == (y * 2)      — arithmetic binds tighter
x & 1 == 0              # x & (1 == 0)  in C;  in Python: x & (1 == 0)?  NO —
                        # in Python `&` is a bitwise op, so it binds TIGHTER:
                        # (x & 1) == 0            — which is what you meant
```

That is the rare case where Python does what you want and C does not: in C, `==`
binds tighter than `&`, so `x & 1 == 0` means `x & (1 == 0)`. In Python, `&` is
listed among the operations of higher priority than comparison, so `x & 1 == 0`
groups as `(x & 1) == 0`.

The other side of "all six are equal" is chaining, which gets its own chunk —
[03](03-chaining.md).

## Comparisons yield booleans — *usually*

> *"Comparisons yield boolean values: `True` or `False`. Custom rich comparison
> methods may return non-boolean values. In this case Python will call `bool()` on
> such value in boolean contexts."* —
> [Comparisons](https://docs.python.org/3.14/reference/expressions.html#comparisons)

Read that twice. The result of `a == b` is whatever `a.__eq__(b)` returned. Python
does **not** coerce it to a `bool` at the point of comparison; it coerces only when
the value reaches a boolean context — an `if`, a `while`, an `and`, a `not`, a
`filter`. The data model says the same from the other side:

> *"By convention, `False` and `True` are returned for a successful comparison.
> However, these methods can return any value, so if the comparison operator is used
> in a Boolean context (e.g., in the condition of an `if` statement), Python will
> call `bool()` on the value to determine if the result is true or false."* —
> [data model](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__)

Every "`==` is not a boolean" library in the ecosystem lives in that sentence.
NumPy returns an array, pandas returns a Series, SQLAlchemy returns a SQL
expression object, `unittest.mock.ANY` returns `True` for everything. That is
[10](10-when-equality-is-not-a-boolean.md).

## What `object` gives you for free

Every class inherits comparison behaviour from `object`, and what it inherits is
deliberately minimal and asymmetric.

**Equality defaults to identity.**

> *"The default behavior for equality comparison (`==` and `!=`) is based on the
> identity of the objects. Hence, equality comparison of instances with the same
> identity results in equality, and equality comparison of instances with different
> identities results in inequality. A motivation for this default behavior is the
> desire that all objects should be reflexive (i.e. `x is y` implies `x == y`)."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

Mechanically:

> *"By default, `object` implements `__eq__()` by using `is`, returning
> `NotImplemented` in the case of a false comparison: `True if x is y else
> NotImplemented`."* —
> [data model](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__)

Note it returns `NotImplemented`, not `False`. That is what lets the *other*
operand have a say before Python falls back to identity. See
[02](02-notimplemented-and-reflection.md).

**Ordering defaults to nothing at all.**

> *"A default order comparison (`<`, `>`, `<=`, and `>=`) is not provided; an attempt
> raises `TypeError`. A motivation for this default behavior is the lack of a similar
> invariant as for equality."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

So this class compares fine and sorts not at all:

```python
class Version:
    def __init__(self, major, minor):
        self.major, self.minor = major, minor

    def __eq__(self, other):
        if not isinstance(other, Version):
            return NotImplemented
        return (self.major, self.minor) == (other.major, other.minor)

    __hash__ = None   # see 02b — defining __eq__ already did this implicitly


Version(1, 2) == Version(1, 2)    # True
sorted([Version(2, 0), Version(1, 9)])
# TypeError: '<' not supported between instances of 'Version' and 'Version'
```

`sorted()` needs `__lt__` and only `__lt__`; the docs for `sorted()` say so and then
immediately tell you not to stop there:

> *"The sort algorithm uses only `<` comparisons between items. While defining an
> `__lt__()` method will suffice for sorting, **PEP 8** recommends that all six rich
> comparisons be implemented. This will help avoid bugs when using the same data with
> other ordering tools such as `max()` that rely on a different underlying method.
> Implementing all six comparisons also helps avoid confusion for mixed type
> comparisons which can call the reflected `__gt__()` method."* —
> [`sorted()`](https://docs.python.org/3.14/library/functions.html#sorted)

## Gotchas

**★ `sorted()` raising `TypeError: '<' not supported` on a class whose `==` works
perfectly.** The class defined `__eq__` and nothing else, so it inherited *no*
ordering from `object` — the reference says a default order comparison "is not
provided". Fix: define `__lt__` at minimum, or `@functools.total_ordering`, or sort
with an explicit `key=` that returns a tuple of already-orderable fields. See
[09](09-total-ordering-and-dataclasses.md).

**★ `max()` failing on data that `sorted()` handled.** You defined only `__lt__`.
`sorted()` is documented to use only `<`; other tools may reach for `__gt__` and get
the inherited `object` version, which raises. Fix: implement all six, per PEP 8 and
the `sorted()` docs.

**★ `x & 1 == 0` reviewed as a bug by someone coming from C or Java.** In C, `==`
binds tighter than `&`, so the C reading is `x & (1 == 0)`. Python puts bitwise ops
*above* comparison in priority, so it groups as `(x & 1) == 0` — the intended
reading. Fix: nothing to fix in Python, but parenthesise anyway if the file is read
by people who switch languages daily.

**★ `if a == b:` doing something surprising because `__eq__` returned a non-bool.**
The operator returns whatever the method returned; `bool()` is applied only at the
boolean context, and *that* is where it can raise. Fix: never assume `==` produced a
`bool` when either operand comes from NumPy, pandas, SQLAlchemy or a mocking
library — see [10](10-when-equality-is-not-a-boolean.md).

**★ A subclass that adds a field and inherits `__eq__` comparing equal to its
base.** If `Base.__eq__` compares only `Base`'s fields and `isinstance(other,
Base)`, then `Derived(1, extra=9) == Base(1)` is `True` in both directions. Fix:
compare `type(self) is type(other)` rather than `isinstance`, unless you genuinely
want cross-class equality — and if you do, make sure it is symmetric and transitive.

## Interview questions

**★ Q: How many comparison operators does Python have, and what do they compile to?**
Six rich comparison operators — `<`, `<=`, `==`, `!=`, `>`, `>=` — each dispatching
to a dunder method on the operands (`__lt__`, `__le__`, `__eq__`, `__ne__`,
`__gt__`, `__ge__`), plus `is`/`is not` and `in`/`not in`, which are in the same
grammar production and the same precedence class but are *not* rich comparison
methods: `is` is an uninterceptable identity test and `in` dispatches to
`__contains__`.

**★ Q: What does `a == b` return?**
Whatever `type(a).__eq__` returned — the language does not force a `bool`. The
reference says custom rich comparison methods may return non-boolean values and that
Python calls `bool()` on the result only in boolean contexts. That is precisely how
NumPy returns an array and SQLAlchemy returns a SQL expression from `==`.

**Q: What comparison behaviour does a plain class get from `object`?**
Equality based on identity — `object.__eq__` is `True if x is y else
NotImplemented` — and *no* ordering at all: the reference states a default order
comparison is not provided and an attempt raises `TypeError`. So a bare class can be
tested with `==` and cannot be sorted.

**Q: Why does `object` provide default equality but not default ordering?**
The docs give the motivation directly: identity-based equality preserves the
reflexivity invariant, `x is y` implies `x == y`. There is no comparable invariant
that would let the interpreter guess an ordering, so ordering raises rather than
inventing one.

**★ Q: `sorted()` works on my objects but `max()` raises. Why?**
`sorted()` is documented to use only `<`, so `__lt__` alone is enough for it. Other
tools use different methods — `max()` can end up needing `__gt__` — and that one
still comes from `object`, which raises. PEP 8 and the `sorted()` docs both say to
implement all six.

**Q: Where do comparison operators sit in Python's precedence table?**
All six share one precedence level, below every arithmetic, shifting and bitwise
operator and above `not`/`and`/`or`. Two consequences: `a + 1 == b * 2` needs no
parentheses, and `x & 1 == 0` groups as `(x & 1) == 0`, unlike C.

---

← Prev: [Truthiness](../05-truthiness/README.md) · Index: [Comparisons](README.md) · Next → [Consistency rules and runtime dispatch](01b-consistency-and-dispatch.md)
