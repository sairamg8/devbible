---
title: "A sort asks only `<`, so a class that sorts needs one consistent ordering — all six comparisons or `total_ordering` — and `cmp_to_key` is a per-comparison Python call you reach for only when an order is genuinely pairwise"
sidebar_label: "09c · Comparisons and cmp_to_key"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against [`list.sort`](https://docs.python.org/3.14/library/stdtypes.html#list.sort),
> [`sorted`](https://docs.python.org/3.14/library/functions.html#sorted),
> [Data model — rich comparisons](https://docs.python.org/3.14/reference/datamodel.html#object.__lt__),
> [`functools.cmp_to_key` / `total_ordering`](https://docs.python.org/3.14/library/functools.html#functools.cmp_to_key)
> and [`Lib/functools.py`](https://github.com/python/cpython/blob/3.14/Lib/functools.py),
> [What's New in Python 3.0](https://docs.python.org/3.14/whatsnew/3.0.html), and the
> [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html) — *Comparison
> Functions*, *Odds and Ends*.
> Documentation-validated; **no sandbox run** — the only outputs shown are the HOWTO's
> own doctests, quoted. Target: **Python 3.14** (3.14.7).

**Every sort in Python reduces to one question asked many times: is `a < b`? When
the elements are your own objects, that question is answered by your `__lt__` — and
the language gives you no help keeping it consistent with the other five comparison
methods, which other tools such as `max()` use instead. This chunk is how to give a
class a trustworthy order: implement all six, or let `functools.total_ordering` derive
them at a documented cost. Then the other direction: code ported from languages with
comparator-based sorts, or libraries that expose only a comparison function, need
`functools.cmp_to_key` — which wraps every element in an object whose `__lt__` calls
your two-argument function, so every comparison runs Python. It is the right tool for
orderings that are genuinely pairwise and the wrong one for anything a key can
express. What happens when `<` itself is inconsistent — NaN, sets, tolerances — is
[09d](09d-unorderable-values.md).**

## Sorts ask only `<`

> *"This method sorts the list in place, using only `<` comparisons between items."*

> *"The sort algorithm uses only `<` comparisons between items. While defining an
> `__lt__()` method will suffice for sorting, PEP 8 recommends that all six rich
> comparisons be implemented. This will help avoid bugs when using the same data with
> other ordering tools such as `max()` that rely on a different underlying method.
> Implementing all six comparisons also helps avoid confusion for mixed type
> comparisons which can call the reflected `__gt__()` method."*

The data model explains that reflection:

> *"There are no swapped-argument versions of these methods (to be used when the left
> argument does not support the operation but the right argument does); rather,
> `__lt__()` and `__gt__()` are each other's reflection, `__le__()` and `__ge__()` are
> each other's reflection, and `__eq__()` and `__ne__()` are their own reflection."*

And warns that the six are independent unless you make them agree:

> *"There are no other implied relationships among the comparison operators or default
> implementations; for example, the truth of (x<y or x==y) does not imply x<=y. To
> automatically generate ordering operations from a single root operation, see
> @functools.total_ordering."*

```python
from functools import total_ordering

@total_ordering
class Version:
    def __init__(self, major, minor):
        self.major, self.minor = major, minor

    def _key(self):
        return (self.major, self.minor)

    def __eq__(self, other):
        if not isinstance(other, Version):
            return NotImplemented
        return self._key() == other._key()

    def __lt__(self, other):
        if not isinstance(other, Version):
            return NotImplemented
        return self._key() < other._key()
```

`total_ordering` has a documented cost: *"it does come at the cost of slower execution
and more complex stack traces for the derived comparison methods."* For plain records
Phase 4's `@dataclass(order=True)` generates all six from the fields; for sorting
alone, a `key=` function avoids defining comparisons at all
([09](09-key-functions-and-cmp-to-key.md)).

## Comparison functions and `cmp_to_key`

Python 3.0 removed the `cmp` argument:

> *"`sorted()` and `list.sort()` no longer accept the cmp argument providing a
> comparison function. Use the key argument instead."*

> *"The `cmp()` function should be treated as gone, and the `__cmp__()` special method
> is no longer supported. … (If you really need the `cmp()` functionality, you could
> use the expression `(a > b) - (a < b)` as the equivalent for `cmp(a, b)`.)"*

Comparison functions still turn up — the HOWTO names two sources:

> *"It is common to encounter comparison functions when translating algorithms from
> other languages. Also, some libraries provide comparison functions as part of their
> API. For example, `locale.strcoll()` is a comparison function."*

`functools.cmp_to_key` adapts one:

> *"A comparison function is any callable that accepts two arguments, compares them,
> and returns a negative number for less-than, zero for equality, or a positive number
> for greater-than. A key function is a callable that accepts one argument and returns
> another value to be used as the sort key."*

What it builds is visible in the pure-Python fallback in `Lib/functools.py` (CPython
uses a C version from `_functools` when available):

```python
def cmp_to_key(mycmp):
    """Convert a cmp= function into a key= function"""
    class K(object):
        __slots__ = ['obj']
        def __init__(self, obj):
            self.obj = obj
        def __lt__(self, other):
            return mycmp(self.obj, other.obj) < 0
        def __gt__(self, other):
            return mycmp(self.obj, other.obj) > 0
        def __eq__(self, other):
            return mycmp(self.obj, other.obj) == 0
        def __le__(self, other):
            return mycmp(self.obj, other.obj) <= 0
        def __ge__(self, other):
            return mycmp(self.obj, other.obj) >= 0
        __hash__ = None
    return K
```

So the "key" is a wrapper object per element, and **every comparison calls your
two-argument function** — the opposite of a real key function's n calls. The pre-sort
check of [07d](07d-reverse-and-the-pre-sort-check.md) sees n keys of one exact type,
`K`, so it installs the single-type path — which still dispatches to `K.__lt__`, a
Python method, on every comparison; none of the specialised `int`, `float` or `str`
paths can apply. And `__hash__ = None` makes the wrappers unhashable.

### When a comparison function is the honest answer

Some orders are defined only pairwise. The classic: arrange non-negative integers to
form the largest number. Whether `a` goes before `b` depends on comparing the two
concatenations, and there is no per-element key that captures it:

```python
from functools import cmp_to_key

def by_concatenation(a, b):
    ab, ba = a + b, b + a
    return (ab < ba) - (ab > ba)        # negative → a first when ab is larger

def largest_number(nums):
    parts = sorted(map(str, nums), key=cmp_to_key(by_concatenation))
    return "".join(parts).lstrip("0") or "0"
```

If you can write a key, write a key. If the rule is "compare these two", this is what
`cmp_to_key` is for.

## Gotchas

**Symptom: `cmp_to_key` sort leaves the list unchanged.** Cause: the comparison
returns a `bool` — `lambda a, b: a < b` — and `K.__lt__` asks `mycmp(...) < 0`, which
`True` and `False` never satisfy. Every element looks equal, and a stable sort of equal
elements changes nothing. Fix: return negative/zero/positive:

```python
cmp = lambda a, b: (a > b) - (a < b)
```

**Symptom: a class sorts fine but `max()` of the same objects, or a comparison against
another type, misbehaves.** Cause: only `__lt__` was defined; the other five fall back
to reflection or the defaults, which *"imply no other relationships"*. Fix: implement
all six, or decorate:

```python
from functools import total_ordering

@total_ordering
class Job:
    def __init__(self, priority):
        self.priority = priority
    def __eq__(self, other):
        return NotImplemented if not isinstance(other, Job) else self.priority == other.priority
    def __lt__(self, other):
        return NotImplemented if not isinstance(other, Job) else self.priority < other.priority
```

**Symptom: `TypeError` about an unhashable type when putting sort keys into a set or
using them as dict keys.** Cause: `cmp_to_key` wrappers set `__hash__ = None`. Fix: do
not reuse the wrappers; key your cache on the original objects:

```python
order = sorted(items, key=cmp_to_key(compare))
position = {id(x): i for i, x in enumerate(order)}
```

**Symptom: a sort ported from Java or JavaScript got much slower after the move to
`cmp_to_key`.** Cause: the comparator runs as Python on every comparison, instead of
once per element. Most comparators are really "compare by this field", which a key
expresses directly. Fix: translate the comparator into a key:

```python
# before: key=cmp_to_key(lambda a, b: (a.score > b.score) - (a.score < b.score))
rows.sort(key=lambda r: r.score)
```

## Interview questions

**★ Which comparison does `list.sort` use, and why implement all six anyway?**
Only `<`. But other tools use other operators — the docs name `max()` — and mixed-type
comparisons can reach the reflected `__gt__`. The data model states that the six
methods have no implied relationships, so defining only `__lt__` leaves the others at
their defaults. PEP 8 therefore recommends all six; `functools.total_ordering` derives
the rest from `__eq__` plus one ordering method, at a documented speed cost.

**★ When do you need `functools.cmp_to_key`, and what does it cost?**
When the order is defined pairwise and no per-element key exists — the largest-number
concatenation problem, or a library that only exposes a comparison function such as
`locale.strcoll`. The cost is that each element is wrapped in a `K` object whose
`__lt__` calls your function, so every comparison runs Python, and the sort loses its
homogeneous fast paths. Prefer a key whenever one can be written.

**How do you write `cmp(a, b)` in Python 3?**
`(a > b) - (a < b)`, which the What's New for 3.0 gives verbatim. It yields -1, 0 or 1
from two booleans. Use it inside a comparison function you wrap with `cmp_to_key`, not
as a sort key.

**Why did Python 3 remove the `cmp` argument?**
Because `key` covers nearly every real case more cheaply — n key calls instead of a
Python call per comparison — and a single calling convention is simpler. The escape
hatch for the rest is `cmp_to_key`, which the `functools` docs describe as *"primarily
used as a transition tool for programs being converted from Python 2"*.

---

← [Sorting text](09b-sorting-text.md) · [Topic index](README.md) · Next → [Unorderable values](09d-unorderable-values.md)
