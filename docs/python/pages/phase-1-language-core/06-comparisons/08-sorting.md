---
title: "sorted() takes a key, not a comparison function, and that single API decision is why Python sorts are fast, stable and composable"
sidebar_label: "8 · Sorting"
sidebar_position: 76
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14
> [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html),
> [`sorted()`](https://docs.python.org/3.14/library/functions.html#sorted),
> [`list.sort()`](https://docs.python.org/3.14/library/stdtypes.html#list.sort),
> [`functools.cmp_to_key`](https://docs.python.org/3.14/library/functools.html#functools.cmp_to_key),
> [`operator.itemgetter`](https://docs.python.org/3.14/library/operator.html#operator.itemgetter),
> and [What's New In Python 3.0](https://github.com/python/cpython/blob/3.14/Doc/whatsnew/3.0.rst).
> Version spine: **CPython 3.14**.

**Python 2's `sort(cmp=...)` called your function O(n log n) times. Python 3 deleted
it and left `key=`, which calls your function exactly n times and then compares the
results with `<`. That is not a cosmetic change: it is the reason a Python sort of a
million records with an expensive key is tractable, the reason a sort key composes as
a tuple, and the reason you can build any multi-level ordering out of stable single
passes without writing a single comparison.**

## `key=`, not `cmp=`

> *"`sorted()` and `list.sort()` no longer accept the *cmp* argument providing a
> comparison function. Use the *key* argument instead. N.B. the *key* and *reverse*
> arguments are now "keyword-only"."* —
> [What's New In Python 3.0](https://github.com/python/cpython/blob/3.14/Doc/whatsnew/3.0.rst)

And the reason:

> *"The value of the key parameter should be a function (or other callable) that takes
> a single argument and returns a key to use for sorting purposes. **This technique is
> fast because the key function is called exactly once for each input record.**"* —
> [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html)

n calls versus O(n log n) calls. For a key that parses a date, normalises a string, or
looks something up, that is the difference between a sort you can run and one you
cannot:

```python
sorted(logs, key=lambda r: datetime.fromisoformat(r["ts"]))   # n parses
# a cmp-style equivalent would parse both operands on every comparison
```

If the key is genuinely expensive, precompute it once into a tuple and sort that —
that is the decorate-sort-undecorate idiom, below, and `key=` is just DSU with the
bookkeeping done for you.

## Only `<` is used

> *"The sort algorithm uses only `<` comparisons between items. While defining an
> `__lt__()` method will suffice for sorting, **PEP 8** recommends that all six rich
> comparisons be implemented."* —
> [`sorted()`](https://docs.python.org/3.14/library/functions.html#sorted)

So a key can return an object that only implements `__lt__`, and sorting a list of
your own objects needs only `__lt__`. But see [01](01-the-six-operators.md): `max()`
and other tools may reach for `__gt__`, which you did not define.

## Stability, and what you can build with it

> *"Sorts are guaranteed to be stable. That means that when multiple records have the
> same key, their original order is preserved."* —
> [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html)

This is a **language guarantee**, not a CPython detail — `sorted()`'s own
documentation repeats it: *"The built-in `sorted()` function is guaranteed to be
stable."*

Stability is what makes multi-pass sorting correct:

> *"This wonderful property lets you build complex sorts in a series of sorting steps.
> For example, to sort the student data by descending grade and then ascending age, do
> the age sort first and then sort again using grade"* —
> [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html)

```python
s = sorted(students, key=attrgetter("age"))                    # secondary key first
s = sorted(s, key=attrgetter("grade"), reverse=True)           # then primary
```

**Least significant key first, most significant last.** That is the opposite of the
tuple-key ordering, and getting it backwards is the classic bug.

## Tuple keys versus multiple passes

Two ways to express the same multi-level ordering:

```python
# one pass, tuple key — primary first
sorted(students, key=lambda s: (s.grade, s.age))

# two passes, stable — primary LAST
sorted(sorted(students, key=attrgetter("age")), key=attrgetter("grade"))
```

Prefer the tuple key: one pass, one comparison chain, no ordering-of-passes bug. Use
multiple passes when a sub-key must be **descending** and is not numerically
negatable — which is the next section, and the only real reason the multi-pass form
still earns its place.

## `reverse=True` versus negating the key

`reverse=True` reverses the whole ordering and, importantly, keeps stability:

> *"The reverse parameter still maintains sort stability (so that records with equal
> keys retain the original order)."* —
> [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html)

That is the crucial difference from `reversed(sorted(...))`, which reverses the *ties*
as well. The HOWTO spells out the equivalence:

```python
standard_way   = sorted(data, key=itemgetter(0), reverse=True)
double_reversed = list(reversed(sorted(reversed(data), key=itemgetter(0))))
# the HOWTO asserts these are equal
```

For a **mixed-direction** multi-key sort, `reverse=True` is no help — it flips
everything. Three options:

```python
# 1. Negate a numeric sub-key (only works for numbers)
sorted(rows, key=lambda r: (r.department, -r.salary))

# 2. Two stable passes, least significant first
s = sorted(rows, key=attrgetter("salary"), reverse=True)
s = sorted(s, key=attrgetter("department"))

# 3. A key type that inverts comparison, for non-numeric descending sub-keys
class Desc:
    __slots__ = ("v",)
    def __init__(self, v): self.v = v
    def __lt__(self, other): return other.v < self.v
    def __eq__(self, other): return self.v == other.v

sorted(rows, key=lambda r: (r.department, Desc(r.name)))
```

Option 1 is wrong for `str`, `date` and `Decimal`-with-`None` keys — you cannot negate
a string. Option 2 is the documented idiom and is correct for everything. Option 3
costs an object per element but keeps it to one pass; note it must define `__eq__`
too, or tuple comparison will fall back to identity when two `Desc` keys hold equal
values and the ordering becomes input-dependent.

**`reverse=True` also flips a null-partitioning key**, which is the interaction
covered in [05c](05c-none-never-orders.md).

## `functools.cmp_to_key`: the escape hatch

> *"Transform an old-style comparison function to a key function. Used with tools that
> accept key functions (such as `sorted()`, `min()`, `max()`, `heapq.nlargest()`,
> `heapq.nsmallest()`, `itertools.groupby()`). This function is primarily used as a
> transition tool for programs being converted from Python 2 which supported the use of
> comparison functions."*
>
> *"A comparison function is any callable that accepts two arguments, compares them,
> and returns a negative number for less-than, zero for equality, or a positive number
> for greater-than."* —
> [`functools.cmp_to_key`](https://docs.python.org/3.14/library/functools.html#functools.cmp_to_key)

The docs' own example is the one case where it is genuinely the right tool:

```python
sorted(iterable, key=cmp_to_key(locale.strcoll))  # locale-aware sort order
```

`cmp_to_key` wraps each element in an object whose `__lt__` calls your comparison
function — so you are back to O(n log n) calls plus one wrapper allocation per
element. Reach for it only when the ordering genuinely cannot be expressed as a
per-element key: locale collation, a domain-specific ordering that depends on both
operands (version strings with pre-release rules, a tournament tie-break), or porting
legacy code you have not finished converting.

A comparison function must be a **consistent total order** — antisymmetric and
transitive. Timsort will not verify it, and an inconsistent one produces an arbitrary
permutation rather than an error.

## `sorted()` versus `list.sort()`

> *"You can also use the `list.sort()` method. It modifies the list in-place (and
> returns `None` to avoid confusion). Usually it's less convenient than `sorted()` -
> but if you don't need the original list, it's slightly more efficient."*
>
> *"Another difference is that the `list.sort()` method is only defined for lists. In
> contrast, the `sorted()` function accepts any iterable."* —
> [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html)

`return items.sort()` returning `None` is a weekly beginner bug and a documented
design decision: the `None` return exists *to avoid confusion*, by making the mutation
obvious.

## Gotchas

**★ `return items.sort()` returning `None`.** `list.sort()` sorts in place and
deliberately returns `None` — the HOWTO says it does so "to avoid confusion". Fix:
`return sorted(items)`, or sort then return the list on the next line.

**★ Multi-pass sorting done in the wrong order.** Stability means the *last* sort is
the most significant. Sorting by grade then by age gives you age-major order. Fix:
least significant key first, or use a single tuple key where the order reads
naturally.

**★ `reverse=True` on a multi-key sort reversing every level.** It reverses the whole
comparison. Fix: negate the numeric sub-key, or do two stable passes, or wrap the
descending component in an inverting key type.

**★ `list(reversed(sorted(xs, key=k)))` used as a substitute for `reverse=True`.** It
also reverses the order of *tied* elements, destroying stability. The HOWTO shows that
you need a double `reversed` to reproduce `reverse=True` exactly. Fix: use
`reverse=True`.

**★ A key function with side effects, or one that mutates the elements.** It is called
exactly once per element, but in an unspecified order relative to comparisons and
before any of them. Fix: keys must be pure functions of the element.

**★ An expensive key recomputed by writing a `cmp` function instead.** `cmp_to_key`
restores the O(n log n) call count that `key=` was designed to eliminate. Fix: find a
per-element key, even if it means precomputing a tuple.

**★ A `cmp_to_key` comparison function that is not a consistent total order.** Timsort
assumes antisymmetry and transitivity, verifies neither, and silently produces a
meaningless permutation. Fix: make the comparison a real total order, or derive a key.

**★ A descending `Desc`-style key wrapper without `__eq__`.** Tuple comparison calls
`==` on elements before `<`; without `__eq__` the wrapper falls back to identity, two
equal values compare unequal, and the tie-break behaviour becomes allocation-dependent.
Fix: define both `__lt__` and `__eq__` on any custom key type.

**★ `sorted()` on a dict expecting entries and getting keys.** `sorted(d)` iterates
the dict, which yields keys. Fix: `sorted(d.items(), key=itemgetter(1))` for
value-ordered pairs.

**★ Assuming stability from another language's sort.** It is a documented Python
guarantee (`sorted()` and `list.sort()`), and it is *not* guaranteed by C's `qsort`,
by C++'s `std::sort`, or by JavaScript's `Array.prototype.sort` before ES2019. Code
ported in either direction should not assume the other side matches.

## Interview questions

**★ Q: Why did Python 3 remove `cmp=` from `sort`?**
Because `key=` is strictly better for almost every case: the key function is called
exactly once per element rather than O(n log n) times, so an expensive key costs n
evaluations instead of n log n. It also composes — a tuple key expresses multi-level
ordering with no comparison logic at all. `functools.cmp_to_key` remains for the cases
that genuinely need a two-argument comparison.

**★ Q: What does it mean that Python's sort is stable, and what does it let you do?**
Records with equal keys keep their original relative order. It is a documented
guarantee of both `sorted()` and `list.sort()`. It lets you build any multi-level
ordering as a sequence of single-key sorts — least significant key first — which is
the only clean way to get a descending sub-key on a non-numeric field.

**★ Q: How do you sort by department ascending and salary descending?**
Either `key=lambda r: (r.department, -r.salary)` if the sub-key is numeric, or two
stable passes with the salary sort first and `reverse=True`, then the department sort.
A single `reverse=True` on a tuple key would reverse the department order too.

**★ Q: Is `reverse=True` the same as `reversed(sorted(...))`?**
No. `reverse=True` preserves stability, so tied records keep their original order;
`reversed(sorted(...))` reverses the ties as well. The Sorting HOWTO shows that
reproducing `reverse=True` without the parameter takes *two* `reversed()` calls, one
on the input and one on the output.

**Q: How many times is the key function called?**
Exactly once per input record — the HOWTO states it explicitly, and it is the whole
performance argument for `key=` over `cmp=`. It follows that the key must be a pure
function of the element; there is no defined ordering of the calls relative to the
comparisons.

**Q: When is `functools.cmp_to_key` the right answer?**
When the ordering genuinely depends on both operands and cannot be reduced to a
per-element key: locale collation (`cmp_to_key(locale.strcoll)` is the docs' own
example), a tournament tie-break, a domain ordering with special-case rules. It costs
you a wrapper object per element and O(n log n) calls to your function.

**Q: Which comparison method does `sorted()` require?**
Only `__lt__` — the docs say the sort algorithm uses only `<`. PEP 8 and the
`sorted()` documentation both then recommend implementing all six anyway, because
other tools such as `max()` may use a different method and mixed-type comparisons can
reach the reflected `__gt__`.

**Q: Why does `list.sort()` return `None`?**
Deliberately, "to avoid confusion" per the HOWTO: returning the list would make an
in-place mutation look like it produced a new one, and `x = y.sort()` would silently
alias. `sorted()` is the expression form and returns a new list from any iterable.

---

← Prev: [Mappings and sets](07b-mappings-and-sets.md) · Index: [Comparisons](README.md) · Next → [Sort keys in practice](08b-sort-keys-in-practice.md)
