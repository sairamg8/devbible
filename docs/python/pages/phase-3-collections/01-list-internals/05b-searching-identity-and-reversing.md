---
title: "`in`, `index`, `count` and `remove` all compare with `x is e or x == e`, identity first — which is why you can find a NaN in a list it is not equal to anything in"
sidebar_label: "05b · Searching, identity and reversing"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Language Reference
> [§6.10.2 Membership test operations](https://docs.python.org/3.14/reference/expressions.html#membership-test-operations),
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations),
> [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types),
> the [Sorting HOWTO](https://docs.python.org/3.14/howto/sorting.html#strategies-for-unorderable-types-and-values),
> and [`reversed()`](https://docs.python.org/3.14/library/functions.html#reversed).
> Documentation-validated; **no sandbox run**.
> Target: **CPython 3.14** (3.14.7).

**Every value-based list operation — `in`, `index`, `count`, `remove` — shares one
comparison rule, and the language reference states it exactly: `any(x is e or x == e
for e in y)`. Identity is checked first and short-circuits. That single sentence
explains why a NaN you already put in a list can be found and removed while a freshly
constructed one cannot, why `True in [0, 1, 2]` is `True`, and why an expensive
`__eq__` on your model class quietly makes membership tests expensive. This chunk
also settles the three ways to reverse a list, which differ in exactly the same way
the three ways to copy one do.**

## The rule, verbatim

> *"For container types such as list, tuple, set, frozenset, dict, or
> `collections.deque`, the expression `x in y` is equivalent to
> `any(x is e or x == e for e in y)`."*

`list.index`, `list.count` and `list.remove` use the same comparison — CPython routes
all of them through `PyObject_RichCompareBool`, which performs exactly that identity
shortcut before dispatching to `__eq__`.

## Consequence 1 — NaN

```python
nan = float("nan")
xs = [1.0, nan, 3.0]

nan == nan          # False — IEEE-754: a NaN compares unordered with everything
nan in xs           # True  — because `nan is xs[1]`
xs.index(nan)       # 1
xs.remove(nan)      # works — the same object is found by identity

float("nan") in xs  # False — a DIFFERENT NaN object; identity fails, == fails
```

The Sorting HOWTO quotes the underlying standard when explaining why NaN breaks
sorting: *"Every NaN shall compare unordered with everything, including itself."*
Membership sidesteps it only because of the identity shortcut, and only for the very
same object.

Phase 1 works the container case through in
[Detecting NaN, and containers](../../phase-1-language-core/02-numbers/06b-detecting-nan-and-containers.md).
The practical rule: **never search for a NaN by value.** Filter by predicate:

```python
import math
xs[:] = [x for x in xs if not (isinstance(x, float) and math.isnan(x))]
```

## Consequence 2 — `bool` is an `int`

```python
xs = [0, 1, 2]
True in xs          # True — because True == 1
xs.index(True)      # 1
xs.remove(False)    # removes the 0
```

`bool` subclasses `int` and `True == 1`, so a list of integers "contains" booleans and
vice versa. Phase 1's
[Comparisons](../../phase-1-language-core/06-comparisons/README.md) topic owns the
full equality story, and
[Bool identity traps](../../phase-1-language-core/02-numbers/04b-bool-identity-traps.md)
covers the numeric side.

## Consequence 3 — your `__eq__` is in the hot path

A list scan calls `__eq__` once per element until it matches. If that method does I/O,
normalises strings, or compares nested structures, every `in`, `index`, `count` and
`remove` inherits the cost — and none of it is visible at the call site.

```python
if row in pending:      # runs Row.__eq__ up to len(pending) times
    ...
```

If the elements are hashable, move the membership test to a `set`, which hashes once
and compares only on collision. If they are not, compare on a cheap key you control:

```python
pending_ids = {r.id for r in pending}
if row.id in pending_ids:      # one hash, no __eq__ at all
    ...
```

## Searching: `index` and `count`

> *"`sequence.index(value[, start[, stop]])` — Return the index of the first
> occurrence of value in sequence. Raises `ValueError` if value is not found in
> sequence."*

> *"The start or stop arguments allow for efficient searching of subsections of the
> sequence, beginning at start and ending at stop. This is roughly equivalent to
> `start + sequence[start:stop].index(value)`, only without copying any data."*

The `start`/`stop` form is the right tool for walking every occurrence, because the
returned index is relative to the whole list:

```python
def all_positions(xs, value):
    positions = []
    start = 0
    while True:
        try:
            i = xs.index(value, start)
        except ValueError:
            return positions
        positions.append(i)
        start = i + 1
```

⚠️ The docs add a caution that matters in generic code:
*"Not all sequence types support passing the start and stop arguments."*

> *"`sequence.count(value, /)` — Return the total number of occurrences of value in
> sequence."*

`count` has no `start`/`stop` and always walks the whole list — which is why the
frequency-table trap in [03d](03d-partial-sorts-and-counting.md) exists.

## Reversing: three operations, three costs

```python
xs.reverse()          # in place, returns None, O(n) swaps, no allocation
ys = reversed(xs)     # a lazy iterator over the LIVE list — no copy, no mutation
zs = xs[::-1]         # a new reversed list — a full copy
```

> *"`sequence.reverse()` — Reverse the items of sequence in place. This method
> maintains economy of space when reversing a large sequence. To remind users that it
> operates by side-effect, it returns None."*

That last sentence is the same design principle behind `sort` returning `None`, which
[06](06-sorted-versus-sort.md) is entirely about. The tutorial states it as a rule:
*"methods like insert, remove or sort that only modify the list have no return value
printed – they return the default None. This is a design principle for all mutable
data structures in Python."*

🔴 `reversed(xs)` is a *view over the live list*, not a snapshot. The docs describe
the mechanism: *"Forward and reversed iterators over mutable sequences access values
using an index. That index will continue to march forward (or backward) even if the
underlying sequence is mutated."* [11](11-mutating-while-iterating.md) works through
what that does to a loop.

## Gotchas

### `float('nan')` that will not go away
**Symptom.** `xs.remove(float('nan'))` raises `ValueError` even though the list
visibly contains a NaN.
**Cause.** Membership is `x is e or x == e`, and a *fresh* NaN is neither the same
object nor equal to anything.
**Fix.** Filter by predicate rather than by value:

```python
import math
xs[:] = [x for x in xs if not (isinstance(x, float) and math.isnan(x))]
```

### `True`/`False` matching `1`/`0`
**Symptom.** `xs.remove(False)` deletes a `0`; `xs.index(True)` finds a `1`.
**Cause.** `bool` subclasses `int`, and `True == 1`, so equality matches.
**Fix.** Compare types explicitly when the distinction matters:

```python
xs[:] = [x for x in xs if not (type(x) is bool and x is False)]
```

### A membership test that is slow for no visible reason
**Symptom.** `if item in queue:` dominates a profile, on a short list.
**Cause.** `in` calls `__eq__` per element, and the elements are ORM models,
dataclasses with nested fields, or mocks with expensive comparison.
**Fix.** Test a cheap, hashable key in a set built once:

```python
queued_ids = {q.id for q in queue}
if item.id in queued_ids:
    ...
```

### `xs.index(v)` used where `-1` was expected
**Symptom.** A `ValueError` where a C or JavaScript habit expected a sentinel.
**Cause.** Python raises rather than returning `-1`; and `-1` would be a *valid*
index anyway.
**Fix.** Ask first, or catch:

```python
i = xs.index(v) if v in xs else None     # two scans, clearest
```

```python
try:                                     # one scan, faster
    i = xs.index(v)
except ValueError:
    i = None
```

### `xs.reverse()` assigned to a name
**Symptom.** `ys = xs.reverse()` gives `None`, and `len(ys)` raises
`TypeError: object of type 'NoneType' has no len()`.
**Cause.** In-place methods return `None` by design — *"To remind users that it
operates by side-effect, it returns None."*
**Fix.** Pick the expression form when you want a value:

```python
ys = xs[::-1]              # a new reversed list
ys = list(reversed(xs))    # same, via the iterator
```

### Using `reversed(xs)` after `xs` has changed
**Symptom.** A "snapshot" taken with `reversed` reflects later edits, or ends early.
**Cause.** `reversed` returns a lazy iterator over the live list, walking by index.
**Fix.** Materialise if you need a snapshot:

```python
snapshot = xs[::-1]        # a real copy, reversed
```

### Reading `item in lst` as atomic under free threading
**Symptom.** A membership test returns a result that was never true of any single
state of the list.
**Cause.** The 3.14 thread-safety page lists `item in lst`, `lst.index(item)` and
`lst.count(item)` as operations that *"traverse the list and use atomic reads of each
item"* and therefore *"may return results affected by concurrent modifications"*.
**Fix.** Synchronise externally, or work on a snapshot:

```python
with lock:
    present = item in lst
```

## Interview questions

**★ Why does `float('nan') in xs` sometimes return `True` and sometimes `False` for
what looks like the same list?**
Because the language reference defines membership as `any(x is e or x == e for e in y)`
— identity is checked first. If you search for the *same NaN object* that is in the
list, the identity test succeeds and you get `True`. If you construct a fresh
`float('nan')`, identity fails and equality also fails, because IEEE-754 says a NaN
compares unordered with everything including itself. Same value, different object,
opposite answer.

**★ Why does `xs.remove(False)` delete a `0`?**
Because `bool` is a subclass of `int` and `False == 0`, so the equality scan matches
the integer. The same reason `True in [0, 1, 2]` is `True`. If the distinction
matters, test the type as well as the value — `x is False` alone is not enough
either, since it excludes `0` but says nothing about which one the scan will find
first.

**What is the difference between `xs.reverse()`, `reversed(xs)` and `xs[::-1]`?**
`reverse()` mutates the list in place, allocates nothing, and returns `None` — the
docs say it *"maintains economy of space"*. `reversed(xs)` returns a lazy iterator
over the live list: no copy, and it observes later mutations. `xs[::-1]` builds a
whole new list, which costs O(n) and is a genuine snapshot. Choose by whether you
need to mutate, to stream, or to keep.

**Why does `list.index` accept `start` and `stop` when you could slice first?**
Because slicing copies. The docs say the narrowed form is *"roughly equivalent to
`start + sequence[start:stop].index(value)`, only without copying any data"*, and it
returns the index relative to the full list rather than to the slice. That is
precisely what a "find every occurrence" loop needs, and it turns an O(n) copy per
step into no copy at all.

**Someone says "membership on a list is O(n), so use a set". When is that wrong?**
When the elements are not hashable, when the list is short enough that building the
set costs more than the scans, or when the set would have to be rebuilt inside the
loop — which is the most common way the "optimisation" produces no gain at all. It is
also wrong when order or duplicates matter downstream, since a set discards both.

**Why can `x in xs` be expensive even for a short list?**
Because each comparison may run `__eq__`, which is arbitrary Python. For dataclasses
that compare tuples of fields, or ORM models that compare identity maps, the constant
factor per element can be enormous. The identity shortcut in `x is e or x == e` only
helps when you are searching for the exact object already stored.

**Under free threading, is `item in lst` reliable?**
It will not corrupt anything, but the answer may not correspond to any single state
of the list. The 3.14 thread-safety page groups `in`, `index` and `count` as
traversals using atomic per-item reads that *"may return results affected by
concurrent modifications"*, and explicitly notes they do not take the per-object
lock. If the answer has to be consistent, hold a lock or work from a copy.

---

← [Removing from a list](05-removing-and-searching.md) · [Topic index](README.md) · Next → [`sorted` versus `.sort()`](06-sorted-versus-sort.md)
