---
title: "Every ordering problem in Python reduces to choosing a key function, and the standard library ships the ones worth not writing yourself"
sidebar_label: "8b · Sort keys in practice"
sidebar_position: 77
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14
> [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html),
> [`operator`](https://docs.python.org/3.14/library/operator.html#operator.itemgetter),
> [`bisect`](https://docs.python.org/3.14/library/bisect.html),
> [`heapq`](https://docs.python.org/3.14/library/heapq.html),
> and [`itertools.groupby`](https://docs.python.org/3.14/library/itertools.html#itertools.groupby).
> Version spine: **CPython 3.14**.

**Once ordering is a key function, every ordering tool in the standard library takes
the same argument, and the interesting work moves from "how do I compare these" to
"what value stands for this record in the order I want". This chunk is the catalogue:
`itemgetter`/`attrgetter`, decorate-sort-undecorate, natural sort, external lookup
keys, and the four other places `key=` appears — `min`/`max`, `heapq`, `bisect` and
`groupby` — each with the constraint that makes it different from `sorted()`.**

## `operator.itemgetter` and `attrgetter`

> ```python
> >>> from operator import itemgetter, attrgetter
> >>> sorted(student_tuples, key=itemgetter(2))
> >>> sorted(student_objects, key=attrgetter('age'))
> ```
> *"These functions allow multiple levels of sorting"*:
> ```python
> >>> sorted(student_tuples, key=itemgetter(1,2))
> ```
> — [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html)

`itemgetter(1, 2)` returns a *tuple* of those items, which is exactly the multi-level
tuple key of [08](08-sorting.md) with no lambda. `attrgetter` supports dotted paths —
`attrgetter("address.postcode")` — and `operator.methodcaller("lower")` covers the
"call a method on each element" case.

Prefer these over a lambda when they express the whole key: they are implemented in C,
they read as data rather than as code, and they can be assigned a name that documents
the ordering (`by_year = attrgetter("released")`).

Use a lambda the moment the key needs a transformation — a `None` guard, a `casefold`,
a negation — because bending `itemgetter` into that shape costs more clarity than the
C-level speed buys.

## Decorate–sort–undecorate

> *"This idiom has three steps: First, the initial list is decorated with new values
> that control the sort order. Second, the decorated list is sorted. Finally, the
> decorations are removed, creating a list that contains only the initial values in the
> new order."*
>
> ```python
> >>> decorated = [(student.grade, i, student) for i, student in enumerate(student_objects)]
> >>> decorated.sort()
> >>> [student for grade, i, student in decorated]  # undecorate
> ```
>
> *"Including the index i provides two benefits: stable sorting and handling of
> non-comparable objects."* —
> [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html)

That last sentence is the whole reason to still know DSU in a `key=` world. The index
`i` is a guaranteed-distinct tie-breaker, so the third element — the object itself,
which may be entirely un-orderable — is **never compared**. It is the same trick as
the `itertools.count()` sequence number in a `heapq` push, and it is the general
answer to "sort things that have no ordering of their own".

`key=` handles the common case and is preferred; DSU is what you reach for when you
need the tie-break slot to be explicit.

## Keys that consult something else

> *"Key functions can access external resources. For instance, if the student grades
> are stored in a dictionary"*:
> ```python
> >>> students = ['dave', 'john', 'jane']
> >>> newgrades = {'john': 'F', 'jane':'A', 'dave': 'C'}
> >>> sorted(students, key=newgrades.__getitem__)
> ```
> — [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html)

`d.__getitem__` as a key function is idiomatic and fast, and it raises `KeyError` for
a missing entry — which is usually what you want. `d.get` is the lenient version and
returns `None`, which then raises `TypeError` in the comparison; if you want lenient,
supply the default: `key=lambda s: grades.get(s, "Z")`.

This is also how you impose an arbitrary domain ordering:

```python
PRIORITY = {"critical": 0, "high": 1, "medium": 2, "low": 3}
sorted(tickets, key=lambda t: PRIORITY[t.severity])
```

Better than an `Enum` with `order=True` when the ordering is a display concern rather
than a property of the value, and better than `cmp_to_key` in every case.

## Natural sort and case-insensitive sort

```python
import re

def natural_key(s: str):
    # "file10.txt" -> ['file', 10, '.txt'] ; digits compare as numbers
    return [int(part) if part.isdigit() else part.casefold()
            for part in re.split(r"(\d+)", s)]

sorted(filenames, key=natural_key)
```

Note the key returns a **list of mixed types**, which is fine only because every
element at a given position has the same type across all inputs — the split pattern
guarantees digits and non-digits alternate. If your inputs can differ in shape (one
starts with a digit, another does not), the lists misalign and you get the `str`-vs-
`int` `TypeError` of [05](05-cross-type-comparison.md). The robust version tags each
part: `(0, int(part)) if part.isdigit() else (1, part.casefold())`.

Case-insensitive is just `key=str.casefold` — an unbound method used as a key
function, which works because `str.casefold(s)` is `s.casefold()`. Same trick as
`key=str.lower`, `key=len`, `key=abs`.

## Gotchas

**★ `key=d.get` raising `TypeError: '<' not supported between instances of 'NoneType'
and 'str'`.** `dict.get` returns `None` for a missing key and `None` does not order.
Fix: `key=d.__getitem__` if a miss should be an error, or
`key=lambda x: d.get(x, SENTINEL)` with a sentinel of the right type.

**★ A natural-sort key producing `TypeError` on some filename sets.** The key returns
a list whose element *types* depend on the input; if one name starts with a digit and
another does not, position 0 holds an `int` for one and a `str` for the other. Fix:
tag every part with a type rank — `(0, int(p))` versus `(1, p.casefold())`.

**★ `itemgetter` bent into doing a transformation.** `key=itemgetter("price")` cannot
null-guard, casefold or negate. Fix: use a lambda the moment a transformation appears;
the C-level speed of `itemgetter` is not worth an unreadable key.

**★ A DSU decoration without the index, blowing up on ties.** `[(grade, student) for
...]` compares `student` when grades tie. The HOWTO includes `i` precisely to prevent
that. Fix: `[(grade, i, student) for i, student in enumerate(...)]`.

**★ `attrgetter("a.b")` returning `None` because an intermediate attribute is
`None`.** Dotted `attrgetter` raises `AttributeError` on `None.b` rather than
returning `None` — a different failure from the one people expect, and it fires
mid-sort. Fix: a lambda with an explicit guard, or normalise the model so the
intermediate is never `None`.

**★ A key that is a bound method of a mutable object, capturing state that changes
mid-sort.** The key is called once per element up front, so a key reading a
`self.mode` flag that another thread flips produces a half-and-half ordering with no
error. Fix: keys must be pure; snapshot any configuration into a local before
sorting.

**★ `key=len` used on a mixed list of `str` and `int`.** `len` raises `TypeError` on
an `int` — from inside `sorted()`, on the element you did not expect. Fix: filter or
type-guard first; a key function's failure modes are the sort's failure modes.

## Interview questions

**★ Q: What does `operator.itemgetter(1, 2)` return, and why is that useful as a key?**
A tuple of the two items. That makes it a ready-made multi-level sort key with the
same semantics as `lambda r: (r[1], r[2])`, implemented in C, and nameable —
`by_dept_then_name = itemgetter(1, 2)` documents the ordering at its definition.

**★ Q: What is decorate-sort-undecorate and why would you still use it?**
Build a list of tuples whose leading elements are the sort key, sort that, then strip
the decoration. In a `key=` world its remaining value is the explicit tie-break slot:
the HOWTO's version includes `enumerate`'s index, which guarantees distinct
comparisons before the payload is ever reached — so you can sort objects that have no
ordering at all.

**Q: How do you impose a custom domain ordering like critical/high/medium/low?**
A dict from value to rank, used as the key: `key=lambda t: PRIORITY[t.severity]`. It
is explicit, cheap, and easy to change without touching the type. `d.__getitem__`
works directly as a key function when the element *is* the lookup key.

**Q: Why is `key=str.casefold` valid?**
Because an unbound method is a plain function taking the instance as its first
argument: `str.casefold(s)` is `s.casefold()`. The same applies to `key=str.lower`,
`key=len` and `key=abs` — any one-argument callable is a valid key.

**Q: `itemgetter`/`attrgetter` or a lambda?**
The `operator` functions when they express the whole key: they are C-level, they read
as data, and they can be named. A lambda the moment a transformation is needed — a
`None` guard, a casefold, a negation — because contorting `itemgetter` into that shape
costs more readability than the speed is worth.

**Q: How do you write a "natural sort" that puts `file9` before `file10`?**
Split on digit runs and convert the digit parts to `int`:
`[int(p) if p.isdigit() else p.casefold() for p in re.split(r"(\d+)", s)]`. Tag each
part with a type rank if the inputs can start with a digit or not, otherwise the
lists misalign and you get an `int`-versus-`str` comparison.

---

← Prev: [Sorting](08-sorting.md) · Index: [Comparisons](README.md) · Next → [The other tools that take a key](08c-min-max-heapq-bisect-groupby.md)
