---
title: "Returning False from __eq__ when you meant \"I don't handle this type\" is the single most common way to break the comparison protocol"
sidebar_label: "2 · NotImplemented and reflection"
sidebar_position: 62
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 library reference
> [Built-in Constants — `NotImplemented`](https://docs.python.org/3.14/library/constants.html#NotImplemented),
> the [data model — rich comparison methods](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__),
> and the language reference on
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons).
> Version spine: **CPython 3.14**, where evaluating `NotImplemented` in a boolean
> context became a `TypeError`.

**A rich comparison method has three possible answers, not two: yes, no, and *"ask
the other operand"*. The third one is spelled `return NotImplemented`, and it is the
mechanism by which `Fraction(1, 2) == 0.5` works without `float` ever having heard
of `Fraction`. Writing `return False` in that position does not give a wrong answer
once — it silently disables the whole fallback chain, so the other type never gets
asked, and your class becomes the reason someone else's correct code returns the
wrong result. Python 3.14 made the related mistake — leaking `NotImplemented` into
an `if` — loud instead of silent.**

## The three-valued protocol

> *"A rich comparison method may return the singleton `NotImplemented` if it does not
> implement the operation for a given pair of arguments."* —
> [data model](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__)

And what the interpreter does with it:

> *"When a binary (or in-place) method returns `NotImplemented` the interpreter will
> try the reflected operation on the other type (or some other fallback, depending on
> the operator). If all attempts return `NotImplemented`, the interpreter will raise
> an appropriate exception. Incorrectly returning `NotImplemented` will result in a
> misleading error message or the `NotImplemented` value being returned to Python
> code."* —
> [Built-in Constants](https://docs.python.org/3.14/library/constants.html#NotImplemented)

So the evaluation of `a < b` is, in order:

1. Try `type(a).__lt__(a, b)`. If it returns anything but `NotImplemented`, that is
   the result — **including a non-boolean**.
2. Otherwise try the *reflection*, `type(b).__gt__(b, a)`. Same rule.
3. If both returned `NotImplemented`: for `<`, `<=`, `>`, `>=`, raise `TypeError`.
   For `==` and `!=`, fall back to identity.

Step 3's split is the important asymmetry, and the data model states it:

> *"When no appropriate method returns any value other than `NotImplemented`, the
> `==` and `!=` operators will fall back to `is` and `is not`, respectively."* —
> [data model](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__)

That is why two objects of unrelated types can always be `==`-compared (answer:
`False`, because they are not the same object) but can never be `<`-compared without
one of them opting in.

## The reflection table

There are no `__req__` or `__rlt__` methods. The reference is explicit:

> *"There are no swapped-argument versions of these methods (to be used when the left
> argument does not support the operation but the right argument does); rather,
> `__lt__()` and `__gt__()` are each other's reflection, `__le__()` and `__ge__()`
> are each other's reflection, and `__eq__()` and `__ne__()` are their own
> reflection."* —
> [data model](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__)

| Left tried | Reflected fallback |
|---|---|
| `a.__lt__(b)` | `b.__gt__(a)` |
| `a.__le__(b)` | `b.__ge__(a)` |
| `a.__gt__(b)` | `b.__lt__(a)` |
| `a.__ge__(b)` | `b.__le__(a)` |
| `a.__eq__(b)` | `b.__eq__(a)` |
| `a.__ne__(b)` | `b.__ne__(a)` |

Which is why the `sorted()` docs warn that *"Implementing all six comparisons also
helps avoid confusion for mixed type comparisons which can call the reflected
`__gt__()` method."* If you implement only `__lt__`, then `a < b` where `a` is a
foreign type can land in your `__gt__` — which does not exist.

## Subclasses go first

One rule overrides "left operand first":

> *"If the operands are of different types, and the right operand's type is a direct
> or indirect subclass of the left operand's type, the reflected method of the right
> operand has priority, otherwise the left operand's method has priority. Virtual
> subclassing is not considered."* —
> [data model](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__)

So `Base() < Derived()` tries `Derived.__gt__` **before** `Base.__lt__`, provided
`Derived` actually overrides it. The subclass gets the chance to refine the
comparison its parent would otherwise have decided. "Virtual subclassing is not
considered" means an ABC registration (`SomeABC.register(MyType)`) does **not** buy
you this priority — only real inheritance does.

## Gotchas

**★ `Base() == Derived()` calling the *subclass* method first, surprising a
carefully-written `Base.__eq__`.** That is documented behaviour: the reflected method
of a direct-or-indirect subclass has priority. Fix: rely on it rather than fight it —
put the more specific logic in the subclass — and remember it does not apply to ABC
`register()`ed virtual subclasses.

**★ A class that implements only `__lt__` failing when compared against a foreign
type on the left.** `foreign < mine` tries `type(foreign).__lt__`, then reflects to
`type(mine).__gt__` — which you never defined. Fix: implement all six, or use
`@functools.total_ordering` ([09](09-total-ordering-and-dataclasses.md)).

**★ `__eq__` returning `NotImplemented` and the caller seeing `NotImplemented`
itself.** This happens when the dunder is invoked directly rather than via the
operator, so no reflection or fallback runs. The constants docs call this out:
*"Incorrectly returning `NotImplemented` will result in ... the `NotImplemented`
value being returned to Python code."* Fix: use the operator.

**★ An ABC `register()`ed type not getting reflected-method priority.** You
registered `MyDecimal` as a virtual subclass of `numbers.Real` and expected
`some_real < my_decimal` to reach `MyDecimal.__gt__` first. The reference says
*"Virtual subclassing is not considered."* Fix: inherit for real if you need the
priority, or make the left-hand type return `NotImplemented` so the fallback reaches
you anyway.

**★ `TypeError: unorderable types` never appearing for `==`.** People expect `==`
between two unrelated types to raise the way `<` does. It does not: the docs say
`==` and `!=` fall back to `is` and `is not`. So `datetime.now() == "now"` is a
perfectly quiet `False`, and a bug that compares a parsed value against an
unconverted string never announces itself. Fix: assert the type, or use a linter rule
that flags equality between unrelated annotated types.

## Interview questions

**★ Q: What is `NotImplemented` and when do you return it?**
A singleton returned from a binary special method to say "I do not implement this
operation for this pair of types". The interpreter responds by trying the reflected
operation on the other operand; if that also declines, ordering operators raise
`TypeError` and `==`/`!=` fall back to `is`/`is not`. You return it from the
type-check branch of any `__eq__`, `__lt__`, `__add__` and so on.

**★ Q: Walk through exactly what `a < b` does.**
Unless `type(b)` is a subclass of `type(a)` that overrides `__gt__` (in which case
that goes first), Python calls `type(a).__lt__(a, b)`. If the result is not
`NotImplemented`, that is the value of the expression — no `bool()` coercion at this
point. Otherwise it calls `type(b).__gt__(b, a)`. If that also returns
`NotImplemented`, it raises `TypeError: '<' not supported between instances of ...`.

**★ Q: How does `==` behave differently from `<` when both operands decline?**
`==` and `!=` fall back to identity: `a == b` becomes `a is b`, and `a != b` becomes
`a is not b`. Ordering operators have no such fallback and raise `TypeError`. That
is why any two objects can be equality-compared and only opted-in types can be
ordered.

**Q: There is no `__req__`. How does reflection work for equality?**
`__eq__` is its own reflection, as is `__ne__`; `__lt__`/`__gt__` are each other's
reflection, and `__le__`/`__ge__` are each other's. So the fallback for
`a.__eq__(b)` is `b.__eq__(a)` — same method name, swapped operands.

**Q: Which operand goes first when a subclass is on the right?**
The subclass. The reference says the reflected method of the right operand has
priority when the right operand's type is a direct or indirect subclass of the left
operand's type. Virtual subclassing via `abc.ABCMeta.register` does not count.

**Q: How does `Fraction(1, 2) == 0.5` work when `float` knows nothing about
`Fraction`?**
`float.__eq__` is tried first, returns `NotImplemented` for a `Fraction`, and the
interpreter reflects to `Fraction.__eq__`, which knows how to convert a float to an
exact rational and compare. The whole numeric tower is built on types declining
politely rather than answering `False`.

---

← Prev: [Consistency and dispatch](01b-consistency-and-dispatch.md) · Index: [Comparisons](README.md) · Next → [Writing `__eq__` correctly](02b-writing-eq-correctly.md)
