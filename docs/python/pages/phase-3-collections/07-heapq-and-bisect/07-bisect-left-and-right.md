---
title: "bisect does not find a value, it finds the boundary where a value would go — bisect_left before the equal run, bisect_right after it — using only <, in O(log n) comparisons, on any indexable sequence that you promise is already sorted"
sidebar_label: "07 · bisect_left and bisect_right"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`bisect` documentation](https://docs.python.org/3.14/library/bisect.html) ([`bisect_left`](https://docs.python.org/3.14/library/bisect.html#bisect.bisect_left), [`bisect_right`](https://docs.python.org/3.14/library/bisect.html#bisect.bisect_right), [Performance Notes](https://docs.python.org/3.14/library/bisect.html#performance-notes), [Searching Sorted Lists](https://docs.python.org/3.14/library/bisect.html#searching-sorted-lists)) and CPython **v3.14.7** source — [`Lib/bisect.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/bisect.py) (lines 21–118), [`Modules/_bisectmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_bisectmodule.c) (lines 32–149, 236–333), `Modules/clinic/_bisectmodule.c.h` and `Lib/test/test_bisect.py`. Target: **Python 3.14.7**. **No sandbox run, no timings.**

**`bisect_left(a, x)` answers "at which index would `x` be inserted to keep `a` sorted, before any elements equal to it", and `bisect_right(a, x)` — also spelled `bisect(a, x)` — the same question after them. The answer is a boundary, not a match: it is a valid index even when `x` is absent, and it can be `len(a)`. Everything useful — membership, "largest value at or below", counting duplicates, range queries — is built from one or two of those boundaries. The search halves an index range until it is empty, so it costs about log2(n) comparisons, it calls only `<` and never `==`, and it works on any object with `__len__` and `__getitem__`. What it cannot do is check its one precondition. On a list that is not sorted — or sorted descending, or containing a `NaN` — it returns a confident, wrong index.**

## What the two functions return

> *"Locate the insertion point for *x* in *a* to maintain sorted order. The parameters *lo* and
> *hi* may be used to specify a subset of the list which should be considered; by default the
> entire list is used. If *x* is already present in *a*, the insertion point will be before (to
> the left of) any existing entries. The return value is suitable for use as the first parameter
> to `list.insert()` assuming that *a* is already sorted."*

The precise statement is the partition each one produces:

> *"The returned insertion point *ip* partitions the array *a* into two slices such that
> `all(elem < x for elem in a[lo : ip])` is true for the left slice and
> `all(elem >= x for elem in a[ip : hi])` is true for the right slice."* — `bisect_left`

> *"The returned insertion point *ip* partitions the array *a* into two slices such that
> `all(elem <= x for elem in a[lo : ip])` is true for the left slice and
> `all(elem > x for elem in a[ip : hi])` is true for the right slice."* — `bisect_right`

So for a sorted list, the elements equal to `x` occupy exactly `a[bisect_left(a, x):bisect_right(a, x)]`:

```python
from bisect import bisect_left, bisect_right

response_codes = [200, 200, 201, 204, 301, 404, 404, 404, 500]

lo = bisect_left(response_codes, 404)     # 5: first index whose value is >= 404
hi = bisect_right(response_codes, 404)    # 8: first index whose value is > 404
count_404 = hi - lo                       # 3, in O(log n) — no scan
missing = bisect_left(response_codes, 302)   # 5: where 302 would go; nothing there equals it
past_end = bisect_right(response_codes, 999) # 9 == len(response_codes)
```

## The loop, and why it only needs `<`

> *"Unlike other bisection tools that search for a specific value, the functions in this module
> are designed to locate an insertion point. Accordingly, the functions never call an `__eq__()`
> method to determine whether a value has been found. Instead, the functions only call the
> `__lt__()` method and will return an insertion point between values in an array."*

```python
# Lib/bisect.py, v3.14.7 — the key-less loops (the C versions in _bisect replace these at import)
def bisect_right(a, x, lo=0, hi=None, *, key=None):
    if lo < 0:
        raise ValueError('lo must be non-negative')
    if hi is None:
        hi = len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if x < a[mid]:
            hi = mid
        else:
            lo = mid + 1
    return lo

def bisect_left(a, x, lo=0, hi=None, *, key=None):
    if lo < 0:
        raise ValueError('lo must be non-negative')
    if hi is None:
        hi = len(a)
    while lo < hi:
        mid = (lo + hi) // 2
        if a[mid] < x:
            lo = mid + 1
        else:
            hi = mid
    return lo
```

Each iteration halves `[lo, hi)`, so a million-element list takes about twenty comparisons. The
only difference between the two is the question asked at `mid` — `a[mid] < x` ("is everything up
to here strictly smaller?") versus `x < a[mid]` ("is `x` strictly smaller than this?") — which is
what sends equal elements to opposite sides. The source comment says why `<` alone: *"the
comparison uses "<" to match the `__lt__()` logic in list.sort() and in heapq."*

Note which operand is on the left. `bisect_left` calls `element < x`; `bisect_right` calls
`x < element`. When `x` and the elements are different types, those are different methods — see
the Gotchas.

## What it can search

The C implementation fetches items through the sequence protocol (`get_sq_item` in
`Modules/_bisectmodule.c`) and takes the length with `PySequence_Size` when `hi` is omitted. So
any object with `__len__` and `__getitem__` works: `list`, `tuple`, `str`, `range`, `array.array`,
a `collections.deque` and your own classes. CPython's tests bisect a `range(sys.maxsize - 1)`,
which is never materialised. A mapping is rejected — the source's error format is
`"%.200s is not a sequence"` — and so is anything without item access, such as a `set`
(`"'%.200s' object does not support indexing"`).

Two consequences for real code:

- **Cost is comparisons × the price of `a[mid]`.** For a list that is O(1). For a `deque` the
  documentation says indexed access *"slows to O(n) in the middle"*, so a bisect over a deque is
  O(log n) probes of O(n) each. Convert to a list, or keep one.
- **A virtual sequence works.** A class whose `__getitem__` computes the value is searched without
  ever being built — which is what makes "binary search on the answer" possible;
  [07b](07b-the-key-parameter.md) does it with `range` and `key=`.

## `lo` and `hi`

`lo` and `hi` restrict the search to `a[lo:hi]` without slicing (so without copying). The return
value is still an index into the whole of `a`. `lo` must be non-negative — both implementations
raise `ValueError('lo must be non-negative')`. `hi` is **not** interpreted like a slice bound:

- `hi=None` (the default) means `len(a)`.
- A `hi` larger than `len(a)` lets `mid` run past the end, and the item access can raise `IndexError`.
- A negative `hi` is not "from the end". In the C implementation `hi` defaults internally to `-1`,
  and an explicit `hi=-1` is indistinguishable from omitting it (`Modules/clinic/_bisectmodule.c.h`
  converts `None` to `-1`); the pure-Python fallback treats `hi=-1` as an empty range and returns
  `lo`. Neither behaviour is documented. Compute the bound: `hi=len(a) - k`.

## The five lookups, from the documentation

> *"The above bisect functions are useful for finding insertion points but can be tricky or
> awkward to use for common searching tasks. The following five functions show how to transform
> them into the standard lookups for sorted lists"*

```python
from bisect import bisect_left, bisect_right

def index(a, x):
    'Locate the leftmost value exactly equal to x'
    i = bisect_left(a, x)
    if i != len(a) and a[i] == x:
        return i
    raise ValueError

def find_lt(a, x):
    'Find rightmost value less than x'
    i = bisect_left(a, x)
    if i:
        return a[i-1]
    raise ValueError

def find_le(a, x):
    'Find rightmost value less than or equal to x'
    i = bisect_right(a, x)
    if i:
        return a[i-1]
    raise ValueError

def find_gt(a, x):
    'Find leftmost value greater than x'
    i = bisect_right(a, x)
    if i != len(a):
        return a[i]
    raise ValueError

def find_ge(a, x):
    'Find leftmost item greater than or equal to x'
    i = bisect_left(a, x)
    if i != len(a):
        return a[i]
    raise ValueError
```

The rule under all five: **`_left` when the boundary should exclude `x`'s equals from the left
part, `_right` when it should include them.** "Rightmost ≤ x" includes equals, so it is
`bisect_right` then step back one; "leftmost ≥ x" excludes nothing equal from the right part, so
it is `bisect_left`. Every one of them guards both ends — `i` of `0` and `len(a)` are normal
return values, not errors.

A typical service use: which configuration was in force at a given moment, from a list of change
timestamps.

```python
from bisect import bisect_right
from datetime import datetime, timezone

changed_at = [                                   # sorted, timezone-aware
    datetime(2026, 7, 1, tzinfo=timezone.utc),
    datetime(2026, 8, 3, 14, 30, tzinfo=timezone.utc),
    datetime(2026, 9, 1, 9, 0, tzinfo=timezone.utc),
]
configs = ["v41", "v42", "v43"]                  # configs[i] took effect at changed_at[i]

def config_in_force(at: datetime) -> str | None:
    i = bisect_right(changed_at, at)             # a change at exactly `at` is already in force
    return configs[i - 1] if i else None         # before the first change: nothing applies
```

## Gotchas

**★ Symptom: `IndexError`, or the wrong record, when the looked-up value is not present.** Cause:
the return value was used as "the index of the match"; it is an insertion point, possibly
`len(a)`, and `a[i]` may be a different value. Fix: the documentation's `index()` recipe —
check both `i != len(a)` and `a[i] == x`.

**★ Symptom: lookups return plausible but wrong answers after data is appended.** Cause: the list
is no longer sorted — someone used `append`, or the source query lost its `ORDER BY`. `bisect`
does not check. Fix: keep the invariant at the single place the list is built, and assert it in
tests:

```python
from itertools import pairwise

assert all(a <= b for a, b in pairwise(changed_at)), "changed_at must be sorted ascending"
```

**Symptom: every lookup on a descending list lands at 0 or `len(a)`.** Cause: bisect assumes
ascending order and has no `reverse=`. Fix: keep the list ascending, or search a descending list
of numbers by negating through `key=` (3.10+) — the searched value is then in key space too:

```python
from bisect import bisect_left

scores_desc = [98, 91, 91, 85, 70]
i = bisect_left(scores_desc, -91, key=lambda s: -s)   # 1: first position of 91
```

**Symptom: `bisect_left(records, 42)` works and `bisect_right(records, 42)` raises `TypeError`.**
Cause: `bisect_left` calls `record < 42`, which works because the record class's `__lt__` was
written to accept a bare ID; `bisect_right` calls `42 < record`, `int.__lt__` returns
`NotImplemented`, and the reflected method would be `record.__gt__`, which the class does not
define. Fix: search by key instead of mixing types —
`bisect_right(records, 42, key=attrgetter("id"))` — or search a parallel list of keys.

**Symptom: `TypeError: dict is not a sequence` (or `'set' object does not support indexing`).**
Cause: bisect needs positional access. Fix: bisect a sorted list of the keys — `ids = sorted(user_by_id)`
— and look the record up in the dict afterwards.

**Symptom: a lookup inside a request handler is far slower than its log2(n) comparisons suggest.**
Cause: the sequence is a `deque`, where middle indexing is O(n). Fix: bisect a `list`.

**Symptom: a `hi=-1` meant as "all but the last" searches the whole list.** Cause: `hi` is not a
slice bound, and in the C implementation `-1` is the internal "not given" value. Fix:
`bisect_left(a, x, 0, len(a) - 1)`.

**Symptom: range counts are wrong on a list of floats with one `NaN` in it.** Cause: every `<`
against `NaN` is `False`, so the halving goes the wrong way whenever `mid` lands on it and the
partition statement no longer holds. Fix: drop `NaN` before sorting —
`values = sorted(v for v in raw if v == v)`.

**Symptom: code bisects a sorted list only to test membership, on every request.** Cause: the
tool fits, but not best — *"Bisection is effective for searching ranges of values. For locating
specific values, dictionaries are more performant."* Fix: a `set` or `dict` for exact lookups;
keep the sorted list for "between", "nearest" and "at or below" questions.

## Interview questions

**★ What is the difference between `bisect_left` and `bisect_right`?**
Where they put `x` relative to elements equal to it. `bisect_left` returns the first index whose
element is `>= x`, so an insert there goes before the equal run; `bisect_right` returns the first
index whose element is `> x`, so an insert goes after it. For a sorted list, the equal elements
are exactly `a[bisect_left(a, x):bisect_right(a, x)]`, and the difference of the two is the
count. `bisect` is an alias for `bisect_right`.

**★ How do you test whether `x` is in a sorted list using `bisect`?**
`i = bisect_left(a, x)`, then `i != len(a) and a[i] == x`. The insertion point alone does not
say whether `x` is present, and it can be `len(a)`, so both checks are needed. If exact
membership is the only question, a `set` is the better structure.

**★ Why does `bisect` return an insertion point rather than the index of a match?**
Because the module is designed for maintaining and querying sorted order, and a boundary answers
more questions than a match: where to insert, how many elements are below a value, where a range
starts and ends. It also means the functions only need `<` — the documentation stresses that
they never call `__eq__` — so any type with a consistent `__lt__` can be searched.

**How many comparisons does `bisect` make, and what else does it cost?**
About log2(n): each step halves the candidate range. The other cost is item access — O(1) for a
list, tuple or range, but O(n) in the middle of a deque — and, with `key=`, one key call per
probe.

**Can you bisect something that is not a list?**
Yes — any sequence with `__len__` and `__getitem__`: tuples, strings, `range`, `array.array`, or a
custom class that computes items on demand. Mappings and sets are rejected because they have no
positional access.

---

← Prev: [06 · `heapq.merge` — k-way merge as a stream](06-merge.md) · [Topic index](README.md) · Next → [07b · The `key=` parameter and its asymmetry](07b-the-key-parameter.md)
