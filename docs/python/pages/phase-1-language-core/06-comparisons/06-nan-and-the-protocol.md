---
title: "NaN is the standard library's own counterexample to the comparison rules, and the containment operator's identity-first shortcut is what makes it findable anyway"
sidebar_label: "6 · NaN and the protocol"
sidebar_position: 73
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 language reference
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)
> and [Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations),
> and the [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html)
> `eq` parameter changelog.
> Version spine: **CPython 3.14**.

**The numeric behaviour of NaN belongs to the numbers topic —
[`../02-numbers/06-nan-inf-and-signed-zero.md`](../02-numbers/06-nan-inf-and-signed-zero.md)
covers where NaNs come from and how to detect them, and
[`../02-numbers/06b-detecting-nan-and-containers.md`](../02-numbers/06b-detecting-nan-and-containers.md)
covers what they do to sets, dicts and aggregates. What belongs *here* is narrower and
more general: NaN is the case the language reference itself names when it admits that
the comparison consistency rules are not enforced, and understanding it as a
*protocol* violation rather than a float quirk is what lets you predict the behaviour
of any type that breaks reflexivity — including your own.**

## The reference names NaN as its own counterexample

After listing the five consistency rules for user-defined comparisons, the reference
closes with:

> *"Python does not enforce these consistency rules. In fact, the not-a-number values
> are an example for not following these rules."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

And states the behaviour precisely:

> *"The not-a-number values `float('NaN')` and `decimal.Decimal('NaN')` are special.
> Any ordered comparison of a number to a not-a-number value is false. A
> counter-intuitive implication is that not-a-number values are not equal to
> themselves. For example, if `x = float('NaN')`, `3 < x`, `x < 3` and `x == x` are
> all false, while `x != x` is true. This behavior is compliant with IEEE 754."*

Two rules are broken, and it is worth naming which:

- **Rule 1, reflexivity.** *"`x is y` implies `x == y`"* — false for NaN: `x is x` and
  `x != x`.
- **Rule 4, inverse comparison.** *"`x < y` and `not x >= y`"* should agree — false
  for NaN: `x < 3` is `False` **and** `x >= 3` is `False`. Both directions are false
  simultaneously, which is not something a total order can do.

Notice that `decimal.Decimal('NaN')` is included. Everything in this chunk applies to
it, and `Decimal` additionally has a *signalling* NaN (`Decimal('sNaN')`) that raises
`InvalidOperation` on comparison rather than returning `False` — see
[`../02-numbers/10i-special-values-and-stdlib-interop.md`](../02-numbers/10i-special-values-and-stdlib-interop.md).

## Why `x in [x]` is `True` when `x != x`

This is the part that surprises everyone, and it is not a special case for NaN — it is
a documented property of the membership operator:

> *"For container types such as list, tuple, set, frozenset, dict, or
> collections.deque, the expression `x in y` is equivalent to
> `any(x is e or x == e for e in y)`."* —
> [Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations)

`x is e or x == e`. Identity is tested **first**, and `or` short-circuits, so `==` is
never reached for an element that *is* the object you are looking for:

```python
n = float("nan")
n == n            # False
n in [n]          # True  — the identity arm of the test succeeded
n in [float("nan")]   # False — a different NaN object; identity fails,
                      #         then equality fails too
```

The same wording appears for user-defined classes that define `__iter__` (*"`x in y`
is `True` if some value `z`, for which the expression `x is z or x == z` is true, is
produced while iterating over `y`"*) and for the old-style `__getitem__` protocol
(*"`x is y[i] or x == y[i]`"*). The identity-first shortcut is uniform.

The reference gives the reason it exists, in the sequence-comparison section:

> *"The built-in containers typically assume identical objects are equal to
> themselves. That lets them bypass equality tests for identical objects to improve
> performance and to maintain their internal invariants."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)

Read that as the design decision it is: the containers choose to *impose*
reflexivity, because a container whose elements can vanish from it is not a container.
The consequence is a hard split between "the NaN I am holding a reference to" and "a
NaN with the same bits":

```python
n = float("nan")
xs = [1.0, n, 3.0]

n in xs                 # True   — identity
xs.index(n)             # 1      — identity
xs.remove(n)            # works  — identity
xs.count(n)             # 1      — identity

float("nan") in xs      # False  — different object
xs.count(float("nan"))  # 0
```

## Lists and tuples containing NaN can compare equal

The same identity shortcut lifts to sequence comparison, which is why this holds:

```python
n = float("nan")
[n] == [n]              # True  — element-wise, identity short-circuits
[float("nan")] == [float("nan")]     # False — different objects, == is False
```

`[n] == [n]` being `True` while `n == n` is `False` looks like a contradiction and is
not: list equality is defined as element-wise comparison *by the container's rules*,
and the container's rule is identity-then-equality.

`x = [n]; x == x` is `True` for the same reason — which means a list *is* reflexive
even when its elements are not, and that is exactly the invariant the reference said
the containers were protecting.

## Sets and dicts inherit it too

> *"Comparison of sets enforces reflexivity of its elements."* —
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)
>
> *"Mappings (instances of `dict`) compare equal if and only if they have equal
> `(key, value)` pairs. Equality comparison of the keys and values enforces
> reflexivity."*

"Enforces reflexivity" is the docs' phrase for the identity-first rule. So the set
comparison `{n} == {n}` is `True`, the mapping comparison `{"k": n} == {"k": n}` is
`True`, and a NaN retrieved as a dict *value* can be compared against the original
object successfully — while a NaN reconstructed from JSON cannot.

Deduplication is where this becomes visible: `{float("nan"), float("nan")}` has two
elements because the two objects are neither identical nor equal, while
`{n, n}` has one.

## The `@dataclass` 3.13 change, and NaN

This is a live behavioural difference that a NaN can expose:

> *"Changed in version 3.13: The generated `__eq__` method now compares each field
> individually (for example, `self.a == other.a and self.b == other.b`), rather than
> comparing tuples of fields as in previous versions. This change makes the comparison
> faster but it may alter results in cases where attributes compare equal by identity
> but not by value (such as `float('nan')`)."* —
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html)

Before 3.13 the generated `__eq__` built `(self.a, self.b) == (other.a, other.b)`,
which is *tuple* comparison and therefore gets the identity-first shortcut. From 3.13
it compares fields directly with `==`, which does not. So a dataclass holding the same
NaN object in a field compared equal to itself on 3.12 and does not on 3.13+:

```python
@dataclass
class Reading:
    value: float

n = float("nan")
a = Reading(n)
b = Reading(n)
a == b        # 3.12: True (tuple comparison, identity shortcut)
              # 3.13+: False (field-by-field `==`, NaN != NaN)
```

`a == a` — the *same* object on both sides — is a separate question again, and depends
on whether anything short-circuits identity before reaching `__eq__`; the generated
method does not, so it too compares the field with `==`. If your tests assert
`obj == obj` on a dataclass that may hold a NaN, they can break on a Python upgrade
with no code change on your side. The documentation is explicit that NaN is the
example.

## What to take from it for your own types

If you ever write a type whose `__eq__` is not reflexive — a tolerance-based
comparison, a "matches any" wildcard, a three-valued domain type — you inherit every
one of these behaviours:

- Containers will find your object by identity and not by value, so `obj in
  container` and `container.index(obj)` will disagree with `==`.
- `list`/`tuple`/`set`/`dict` equality will report your objects equal when they are
  the *same* object and unequal when they are copies.
- `sorted()` will not raise and will not sort correctly; Timsort assumes a total
  order and produces an arbitrary permutation when it does not get one.
- `set` deduplication will keep every distinct object.

None of that is a bug in the containers. It is the price of a non-reflexive `==`, and
the reference told you Python does not enforce the rule you broke.

## Gotchas

**★ `float("nan") in [float("nan")]` being `False` while `n in [n]` is `True`.**
Membership is defined as `any(x is e or x == e for e in y)` — identity first. Fix: if
you need "does this list contain any NaN", ask
`any(math.isnan(v) for v in xs if isinstance(v, float))`, not `in`.

**★ `[n] == [n]` being `True` when `n == n` is `False`.** Sequence comparison uses the
containers' identity-first rule, which the reference says exists to maintain their
internal invariants. Fix: nothing to fix — but do not derive "NaN is equal to itself"
from it.

**★ A dataclass equality test that broke on a Python 3.13 upgrade.** The generated
`__eq__` changed from tuple comparison to field-by-field `==`, losing the identity
shortcut for NaN-valued fields. The dataclasses docs name NaN as the example. Fix:
compare with an explicit NaN-aware helper (`math.isnan` per field, or
`math.isclose(..., rel_tol=..)`) rather than relying on `==` for float fields.

**★ `set(values)` not deduplicating repeated NaNs read from a file.** Each parse
creates a distinct object, and two distinct NaNs are neither identical nor equal. Fix:
canonicalise on ingest — replace every NaN with one shared `NAN = float("nan")`
object, or with `None`, before it reaches a set.

**★ `sorted()` on NaN-bearing data producing an order that changes with the input
permutation and never raises.** All ordered comparisons against NaN are false, so
Timsort's assumptions are violated silently. Fix: filter or partition NaNs before
sorting, exactly as with `None` ([05c](05c-none-never-orders.md)).

**★ Treating `Decimal("NaN")` as safe because it is not a float.** The reference
includes `decimal.Decimal('NaN')` in the same rule. And `Decimal("sNaN")` is worse: it
signals rather than returning `False`. Fix: `value.is_nan()` for `Decimal`,
`math.isnan()` for `float`, and never `==`.

**★ Writing a wildcard/tolerance `__eq__` and being surprised that `in` finds objects
`==` says are unequal.** You broke reflexivity; the containers enforce it anyway. Fix:
know that `x in c` answers a slightly different question from `any(x == e for e in
c)`, and write the explicit `any(...)` when you mean value semantics.

## Interview questions

**★ Q: Why is `float('nan') == float('nan')` `False`, and why is `n in [n]` `True`?**
The first is IEEE 754, and the reference states it: any ordered comparison to a NaN is
false and NaN is not equal to itself. The second is the membership operator, which the
reference defines as `any(x is e or x == e for e in y)` — identity is tested first and
`or` short-circuits, so the NaN you hold a reference to is found by pointer without
`==` ever being consulted.

**★ Q: Which of Python's comparison consistency rules does NaN break?**
Reflexivity (`x is y` should imply `x == y`) and the inverse-comparison rule (`x < y`
and `not x >= y` should agree — for NaN both `x < 3` and `x >= 3` are false). The
reference lists the rules and then names the not-a-number values as its own
counterexample.

**★ Q: Why does `[n] == [n]` return `True`?**
Sequence comparison compares corresponding elements using the containers' rule, which
short-circuits on identity: the reference says built-in containers assume identical
objects are equal to themselves so they can bypass equality tests and maintain their
internal invariants. The two list elements are the same object, so the element
comparison succeeds without calling `float.__eq__`.

**★ Q: What changed for dataclass equality in 3.13, and how can a NaN expose it?**
The generated `__eq__` switched from comparing tuples of fields to comparing each
field individually. Tuple comparison has the identity shortcut; field-by-field `==`
does not. So a dataclass whose field holds a NaN compared equal to another holding the
*same* NaN object before 3.13 and does not after. The docs call out `float('nan')` as
the example.

**Q: Does any of this apply to `Decimal`?**
Yes. The reference names `decimal.Decimal('NaN')` alongside `float('NaN')` in the same
rule. `Decimal` additionally has a signalling NaN, `Decimal('sNaN')`, which raises
`InvalidOperation` on comparison instead of quietly returning `False`.

**Q: How do you deduplicate a list of floats that may contain NaNs?**
Not with `set()`. Canonicalise first — map every NaN to one shared object or to
`None` — then deduplicate. Two independently-created NaNs are neither identical nor
equal, so a set keeps both, and a third parse keeps a third.

**Q: What general lesson does NaN teach about writing a non-reflexive `__eq__`?**
That the containers will not follow you. `in`, `.index()`, `.remove()`, `.count()`,
sequence equality, `set` and `dict` equality all short-circuit on identity, so your
objects will be found by pointer and not by value. Sorting will silently produce an
arbitrary order. If you break reflexivity, you must stop using the containers'
value-based operations and write explicit comparisons.

---

← Prev: [`None` never orders](05c-none-never-orders.md) · Index: [Comparisons](README.md) · Next → [Sequences and strings](07-sequences-and-strings.md)
