---
title: "Writing and deleting through a slice reach your class as __setitem__ and __delitem__ with a slice key — no ABC mixin will handle it for you, and a list subclass that validates in __setitem__ is bypassed by append, extend and its own constructor"
sidebar_label: "10c · __setitem__, __delitem__ and the ABCs"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Emulating container types](https://docs.python.org/3.14/reference/datamodel.html#emulating-container-types)
> (`__setitem__`, `__delitem__`), [Subscriptions](https://docs.python.org/3.14/reference/expressions.html#subscriptions),
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html) (the ABC table and
> the `Sequence` implementation note); CPython 3.14
> [`Lib/_collections_abc.py`](https://github.com/python/cpython/blob/3.14/Lib/_collections_abc.py)
> (the mixin bodies) and [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_append_impl`, `list_extend_impl`, `list_insert_impl`) — implementation detail.
> Documentation-verified — **no sandbox run, no program output**.

**`obj[1:3] = values` calls `obj.__setitem__(slice(1, 3, None), values)`; `del obj[::2]` calls
`obj.__delitem__(slice(None, None, 2))`. So the slice rules of [08](08-slice-assignment.md) and
[09](09-extended-slice-assignment.md) — any length for an ordinary slice, one-for-one for an
extended one, clamping everywhere — are *your* rules to implement, and the easiest way to get them
right is again to delegate to a list. The standard building blocks do less than people assume.
`MutableSequence` supplies `append`, `extend`, `pop`, `remove`, `+=` and friends, but every one of
them is written with integer indices; no mixin ever passes a slice, so slice support is exactly as
good as your two methods. Subclassing `list` to validate is worse: `list.append`, `extend`,
`insert` and the constructor are C functions that never call your `__setitem__`. Typing `__getitem__`
and tuple keys are [10d](10d-typing-and-multidimensional-keys.md).**

## Two more methods, the same key

> *"Subscriptions may also be used as targets in assignment or deletion statements. In these cases,
> the interpreter will call the subscripted object's `__setitem__` or `__delitem__` special method,
> respectively, instead of `__getitem__`."* ·
> *"All advanced forms of *subscript* documented in the following sections are also usable for
> assignment and deletion."* —
> [Subscriptions](https://docs.python.org/3.14/reference/expressions.html#subscriptions)

For both methods the data model says *"Same note as for `__getitem__`"* and *"The same exceptions
should be raised for improper *key* values as for the `__getitem__` method."* So `__setitem__`
receives an integer, a `slice`, or (for a comma) a tuple, and must raise `TypeError` for the wrong
kind and `IndexError` for an out-of-range integer, as in [10](10-slicing-your-own-class.md).

## Delegate, and validate before you write

A validated container built on `MutableSequence` and a private `list` gets every slice rule from
the list. The one thing it adds — validation — has a single correct place: *before* the list is
touched, over the whole right-hand side, so a bad item leaves nothing half-written:

```python
from collections.abc import MutableSequence


class Prices(MutableSequence):
    """Non-negative integer prices in cents; every write path is validated."""

    def __init__(self, values=()) -> None:
        self._data = [self._check(value) for value in values]

    @staticmethod
    def _check(value):
        if type(value) is not int or value < 0:
            raise ValueError(f"price must be a non-negative int, got {value!r}")
        return value

    def __len__(self) -> int:
        return len(self._data)

    def __getitem__(self, key):
        if isinstance(key, slice):
            return Prices(self._data[key])
        return self._data[key]

    def __setitem__(self, key, value) -> None:
        if isinstance(key, slice):
            checked = [self._check(item) for item in value]   # all or nothing
            self._data[key] = checked                          # list applies the slice rules
        else:
            self._data[key] = self._check(value)

    def __delitem__(self, key) -> None:
        del self._data[key]

    def insert(self, index, value) -> None:
        self._data.insert(index, self._check(value))

    def __repr__(self) -> str:
        return f"Prices({self._data!r})"


prices = Prices([100, 250, 399])
prices[1:2] = [200, 225]                 # ordinary slice: grows
prices.append(10)                        # mixin append -> insert -> validated
prices += [5]                            # mixin __iadd__ -> extend -> append -> insert
del prices[::2]                          # extended delete: the list does the work
assert list(prices) == [200, 399, 5]

try:
    prices[0:2] = [1, -1]                # the second item is invalid ...
except ValueError:
    pass
assert list(prices) == [200, 399, 5]     # ... so nothing was written
```

The MutableSequence table documents what is abstract and what is supplied: abstract
`__getitem__`, `__setitem__`, `__delitem__`, `__len__` and `insert`; mixins *"Inherited `Sequence`
methods and `append`, `clear`, `reverse`, `extend`, `pop`, `remove`, and `__iadd__`"*. In the 3.14
source every mixin is built on integer operations — `append` is `self.insert(len(self), value)`,
`extend` loops over `append`, `clear` pops until `IndexError`, `reverse` swaps pairs by index. They
are correct for any valid subclass, and slow in the ways the loops suggest: `clear` is n calls to
`pop`, `extend` n calls to `insert`. Override them with slice operations on `_data` when the
container is large — `clear` as `del self._data[:]`.

## When there is no list to delegate to

For fixed-size storage — a memory-mapped record area, a ring buffer, a hardware register block —
an ordinary slice assignment cannot resize either, so behave like `memoryview` and demand equal
lengths. Get the positions from `slice.indices`, and refuse a length mismatch instead of letting
`zip` truncate it:

```python
    def __setitem__(self, key, value) -> None:
        if isinstance(key, slice):
            positions = range(*key.indices(len(self)))
            values = list(value)
            if len(values) != len(positions):
                raise ValueError(f"cannot resize: {len(positions)} slots, {len(values)} values")
            for position, item in zip(positions, values, strict=True):
                self._write(position, item)
        else:
            index = operator.index(key)
            if index < 0:
                index += len(self)
            if not 0 <= index < len(self):
                raise IndexError("assignment index out of range")
            self._write(index, value)
```

## Why a validating `list` subclass leaks

Overriding `__setitem__` on a `list` subclass intercepts `obj[i] = x` and `obj[i:j] = xs`, and
nothing else. CPython's list methods are C functions that write the array directly —
`list_append_impl` calls `_PyList_AppendTakeRef`, `list_insert_impl` goes through `ins1`,
`list_extend_impl` copies items in, and the constructor goes through `list___init___impl` — so none
of them looks up your override. A subclass that validates in `__setitem__` therefore accepts bad
data through `append`, `insert`, `extend`, `+=` and `MyList(bad_items)`. There is a second trap
inside `__setitem__` itself: for a slice key, `value` is an *iterable of items*, and a validator
written for one item either rejects every legitimate slice assignment or, worse, passes a list
object as "a valid item".

The fix is not to find every method to override; it is to stop inheriting a C implementation that
does not call you. `MutableSequence` (above) or `collections.UserList` routes every path through
methods you control.

## Gotchas

**★ Symptom: a `list` subclass that rejects negative prices in `__setitem__` still ends up holding
`-5`.** Cause: the value came in through `append`, `extend`, `insert`, `+=` or the constructor —
C methods that never call `__setitem__`. Fix: build on `MutableSequence` or `UserList` so every
write path goes through your methods.

```python
class Prices(MutableSequence):      # not: class Prices(list)
    ...
```

**★ Symptom: `prices[1:3] = [200, 300]` raises "price must be a non-negative int, got [200,
300]".** Cause: `__setitem__` validates `value` as one item, but for a slice key the value is an
iterable of items. Fix: branch on the key and validate each item.

```python
if isinstance(key, slice):
    checked = [self._check(item) for item in value]
```

**★ Symptom: after a failed bulk update, the container holds half new and half old values.**
Cause: the slice branch validates and writes item by item, so an exception mid-way leaves the
earlier writes in place. Fix: validate the whole right-hand side into a list first, then perform
one delegated slice assignment.

```python
checked = [self._check(item) for item in value]
self._data[key] = checked
```

**★ Symptom: `records[2:4] = new_rows` raises `TypeError` — or corrupts one record — on a
`MutableSequence` subclass.** Cause: `__setitem__` was written for integers only; the ABC provides
no slice handling, and the slice key reached integer arithmetic. Fix: implement the slice branch,
delegating to a list or iterating `range(*key.indices(len(self)))`.

```python
if isinstance(key, slice):
    self._data[key] = [self._check(item) for item in value]
```

**Symptom: writing four values into a three-slot window of a fixed buffer silently drops one.**
Cause: the slice branch pairs positions and values with `zip`, which stops at the shorter input.
Fix: compare the lengths — or use `zip(..., strict=True)` — and raise.

```python
for position, item in zip(positions, values, strict=True):
    self._write(position, item)
```

**Symptom: `x in history` and `history.index(x)` get dramatically slower as a linked-storage
sequence grows.** Cause: the `Sequence` mixins call `__getitem__` once per position; the
documentation warns that with linear-time `__getitem__` *"the mixins will have quadratic
performance and will likely need to be overridden"*. Fix: override them with a direct walk.

```python
def __contains__(self, value):
    return any(item is value or item == value for item in self._walk())
```

## Interview questions

**★ How do you make a custom class support `obj[1:3] = values` and `del obj[::2]`?**
Implement `__setitem__` and `__delitem__` and accept a `slice` key in both — the interpreter passes
the slice object exactly as it does to `__getitem__`. The simplest correct implementation delegates
to an internal list, which enforces the ordinary-versus-extended length rules and clamping. Without
a list, compute the positions with `range(*key.indices(len(self)))`, enforce the one-for-one rule
for extended slices (and for all slices, if the storage cannot resize), and raise the same
`TypeError`/`IndexError` as indexing does.

**★ Why is subclassing `list` a poor way to build a validated list?**
Because overriding `__setitem__` only intercepts subscription writes. In CPython `append`,
`insert`, `extend`, `+=` and the constructor are C functions that write the underlying array without
calling any overridden Python method, so they bypass validation entirely — you would have to
override every one of them and keep up with any added later. Building on
`collections.abc.MutableSequence` or `collections.UserList` routes every mutation through methods
you define, so one validation point covers them all.

**Does `collections.abc.Sequence` give your class slicing?**
No. It requires `__getitem__` and `__len__` and supplies `__contains__`, `__iter__`,
`__reversed__`, `index` and `count`, all implemented with integer indexing. Supporting slice keys
is entirely up to your `__getitem__`; registering as a `Sequence` is a promise to callers that you
do, not an implementation of it. The same goes for `MutableSequence` and `__setitem__`/`__delitem__`.

---

← Prev: [10b · Integer keys and return types](10b-integer-keys-and-return-types.md) · [Topic index](README.md) · Next →: [10d · Typing and multi-dimensional keys](10d-typing-and-multidimensional-keys.md)
