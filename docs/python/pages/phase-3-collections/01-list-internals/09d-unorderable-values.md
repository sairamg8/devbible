---
title: "Some values cannot be ordered — mixed types, None and dicts raise, but NaN and sets answer `<` inconsistently and the sort returns a list that is not sorted without a word — so every unorderable value needs an explicit place in the key"
sidebar_label: "09d · Unorderable values"
sidebar_position: 24
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Language Reference
> [§6.10.1 Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons)
> (NaN, mappings, sets), the
> [Sorting HOWTO — Strategies For Unorderable Types and Values](https://docs.python.org/3.14/howto/sorting.html#strategies-for-unorderable-types-and-values),
> and [`max`](https://docs.python.org/3.14/library/functions.html#max).
> Documentation-validated; **no sandbox run** — the only outputs shown are the HOWTO's
> own doctests, quoted; the NaN-position consequences below are derived from the
> documented rule, not observed. Target: **Python 3.14** (3.14.7).

**A sort works only if `<` is a consistent ordering, and Python's sort never checks
that it is. Values fail that requirement in two very different ways. Some refuse to be
ordered at all — `None` against a number, a `str` against an `int`, one `dict` against
another, complex numbers — and those raise `TypeError`, which is loud and leaves the
list scrambled ([06b](06b-during-the-sort.md)). The dangerous ones answer. A NaN says
"no" to every ordered comparison, including against itself; a set's `<` means
*proper subset*, a partial order. The sort accepts those answers, produces an order
that is not sorted, and returns normally. The HOWTO's rule for all of them is the same:
decide where each unorderable value goes, and say so in the key, before the sort ever
compares one.**

## What "consistent" means

The documentation does not state the requirement formally. The standard one, which
any comparison sort relies on, is a *strict weak ordering*: `a < a` is never true;
`<` is transitive; and "neither `a < b` nor `b < a`" — which a sort treats as
*equal* — is itself transitive. Python's sort checks none of this. Every item below is
a way to break one of those properties.

## The HOWTO's checklist

The HOWTO's *Strategies For Unorderable Types and Values* is a checklist; each item has
a documented reason.

**Mixed types** — *"This is needed because most cross-type comparisons raise a
TypeError."* The HOWTO's doctest:

```python
>>> data = ['twelve', '11', 10]
>>> sorted(map(str, data))
['10', '11', 'twelve']
```

**NaN** — *"This is needed because the IEEE-754 standard specifies that, \"Every NaN
shall compare unordered with everything, including itself.\""* The reference spells
out what that means for `<`: *"Any ordered comparison of a number to a not-a-number
value is false."* A NaN is therefore "not less than" everything and nothing is less
than it — the sort treats it as equal to every number, which breaks transitivity, and
the output is not guaranteed to be sorted. No exception is raised.

**`None`** — *"This is needed because None is not comparable to other types."*
([06b](06b-during-the-sort.md) has the `(x is None, x or 0)` key.)

**Dicts** — *"This is needed because dict-to-dict comparisons raise a TypeError."* The
reference: *"Order comparisons (&lt;, >, &lt;=, and >=) raise TypeError."*

**Sets** — the most dangerous, because they *do* support `<`, meaning *proper subset*:

> *"Those relations do not define total orderings (for example, the two sets \{1,2\} and
> \{2,3\} are not equal, nor subsets of one another, nor supersets of one another).
> Accordingly, sets are not appropriate arguments for functions which depend on total
> ordering (for example, min(), max(), and sorted() produce undefined results given a
> list of sets as inputs)."*

The HOWTO's fixes, for each:

```python
from itertools import filterfalse
from math import isnan

sorted(filterfalse(isnan, readings))                  # drop NaN
sorted(x for x in readings if x is not None)          # drop None
sorted(configs, key=lambda d: sorted(d.items()))      # dicts → sorted item lists
sorted(map(sorted, tag_sets))                         # sets → sorted lists
```

## Keep them, but put them somewhere

Dropping values is not always acceptable — a report may need to show the missing
readings. Then the key has to rank them explicitly, and must never let a NaN or a
`None` reach a comparison with a real number:

```python
from math import isnan

def reading_key(r):
    v = r.value
    missing = v is None or (isinstance(v, float) and isnan(v))
    return (missing, 0.0 if missing else v)      # missing last; never compares a NaN

readings.sort(key=reading_key)
```

The leading `bool` separates the classes; the second element is a real number for
every row, so the pre-sort check sees homogeneous tuples of `(bool, float)` and every
comparison is consistent.

## Gotchas

**★ Symptom: a list of floats comes back "sorted" with values visibly out of order,
and no error.** Cause: a NaN is present; every ordered comparison with it is false, so
the sort's consistency assumption fails silently. Fix: remove NaNs, or push them to one
end with a key that never compares a NaN to a number:

```python
from math import isnan
readings.sort(key=lambda x: (isnan(x), x))   # NaNs last; numbers compared normally
```

**★ Symptom: `sorted(list_of_sets)` or `max(list_of_sets)` returns different answers
for the same sets in a different order.** Cause: `<` on sets is the subset test, not an
ordering; the reference calls the result *undefined*. Fix: sort by a real key:

```python
groups.sort(key=lambda s: sorted(s))            # lexicographic on sorted members
groups.sort(key=lambda s: (len(s), sorted(s)))  # size first
```

**Symptom: `max(readings)` is sometimes `nan` and sometimes a number, for the same
values.** Cause: `max` keeps its current best unless a later item compares greater,
and nothing compares greater than or less than a NaN. A NaN in first position is never
displaced; a NaN later on never displaces anything. The answer depends on position —
derived from the documented rule, not observed. Fix: exclude NaNs explicitly:

```python
from math import isnan
peak = max((x for x in readings if not isnan(x)), default=None)
```

**Symptom: a sort with a tolerance-based comparison produces an order that is not
monotonic.** Cause: "equal if within 0.01" is not transitive — a≈b and b≈c do not give
a≈c — and the algorithm assumes it is. Fix: quantise in the key so equality becomes
exact:

```python
prices.sort(key=lambda p: round(p.amount, 2))
```

**Symptom: `TypeError` sorting IDs that came from JSON or CSV.** Cause: some are `int`
and some `str`, and cross-type `<` raises. Fix: pick one type at the key — the HOWTO
converts to `str`; converting to `int` is usually what the data meant:

```python
ids.sort(key=lambda v: int(v))
```

**Symptom: `sorted(configs)` raises `TypeError` on a list of dicts.** Cause: dicts have
no order comparisons. Fix: sort by the field you meant, or by the HOWTO's sorted-items
key:

```python
configs.sort(key=lambda d: d["priority"])
```

**Symptom: sorting complex numbers raises `TypeError`.** Cause: complex numbers have no
ordering. Fix: choose one — magnitude, or real then imaginary:

```python
roots.sort(key=lambda z: (z.real, z.imag))
```

**Symptom: the `map(str, …)` fix makes `10` sort before `9`.** Cause: the HOWTO's
mixed-type strategy converts everything to text, and text compares character by
character — its own doctest shows `'10'` before `'11'`, and the same rule puts `'10'`
before `'9'`. Fix: rank by type first, then compare within a type:

```python
mixed.sort(key=lambda v: (isinstance(v, str), v if isinstance(v, str) else float(v)))
```

## Interview questions

**★ What does sorting a list containing NaN do?**
It does not raise. Every ordered comparison with NaN is false, so the sort treats NaN as
equal to everything, which makes the ordering inconsistent, and the result is not
guaranteed to be sorted — even the non-NaN values may be out of order around it. Filter
NaNs out, as the HOWTO does, or key on `(isnan(x), x)`.

**Why is sorting a list of sets meaningless?**
Because `<` on sets is the proper-subset test, which is a partial order: `{1, 2}` and
`{2, 3}` are neither equal nor subsets of each other. The reference says `min()`,
`max()` and `sorted()` *"produce undefined results given a list of sets as inputs"*.
Sort by a derived total order such as `sorted(s)`.

**What properties must a comparison have for a sort to work?**
The documentation does not spell them out; the standard requirement is a strict weak
ordering — `a < a` is never true, `<` is transitive, and "neither is less than the
other" is itself transitive, so it behaves like equality. NaN breaks the last property,
tolerance comparisons break it too, and sets are not total. Python's sort checks none
of this; it returns whatever order the inconsistent answers produce.

**Which unorderable values fail loudly, and which silently?**
Loudly: cross-type comparisons (most raise `TypeError`), `None` against anything else,
dicts (order comparisons raise), complex numbers. Silently: NaN, whose comparisons all
return `False`, and sets, whose `<` is a subset test. The loud ones leave the list in a
partially sorted state; the silent ones return a wrong order as if nothing happened,
which is why they are worse.

**How do you sort records with some missing values without dropping them?**
Rank the missing ones explicitly in the key and give them a comparable placeholder, so
no comparison ever involves a `None` or a NaN: `(missing, 0.0 if missing else value)`.
The leading boolean decides the class — `False` sorts before `True`, so missing values
go last — and the placeholder is only ever compared with other placeholders.

---

← [Comparisons and `cmp_to_key`](09c-comparisons-and-cmp-to-key.md) · [Topic index](README.md) · Next → [Copies and aliasing](10-copies-and-aliasing.md)
