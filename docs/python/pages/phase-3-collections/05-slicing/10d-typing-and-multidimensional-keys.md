---
title: "The honest type of a __getitem__ that returns an element for an integer and a container for a slice is a pair of @overloads, not a union — and a comma inside the brackets passes a tuple, so a two-dimensional class interprets each part per axis while a one-dimensional one must refuse it"
sidebar_label: "10d · Typing and multi-dimensional keys"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [`typing.overload`](https://docs.python.org/3.14/library/typing.html#typing.overload),
> [`typing.SupportsIndex`](https://docs.python.org/3.14/library/typing.html#typing.SupportsIndex),
> the typing specification's [Overloads](https://typing.python.org/en/latest/spec/overload.html),
> [Slicings](https://docs.python.org/3.14/reference/expressions.html#slicings) (comma-separated
> subscripts), [The Ellipsis Object](https://docs.python.org/3.14/library/stdtypes.html#the-ellipsis-object);
> CPython 3.14 [`Objects/memoryobject.c`](https://github.com/python/cpython/blob/3.14/Objects/memoryobject.c)
> and [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c) for
> error text. Documentation-verified — **no sandbox run, no program output**.

**A `__getitem__` that returns an `int` for `obj[0]` and a container for `obj[0:2]` has a return
type that depends on its argument type — which a union cannot say, and two `@overload`s can. The
typing specification picks exactly this method, on `bytes`, as its motivating example. The other
key shape a class meets is the tuple: `grid[1, 2]` passes `(1, 2)`, and `grid[:, 0]` passes a tuple
containing a slice. The built-in sequences refuse tuples outright — which is why `rows[1, 2]` on a
list of lists fails even though `rows[1][2]` works — and a class that means to be two-dimensional
has to interpret each part against its own axis. Delegating each part to a `range` gets negatives,
clamping and errors right for free. [10c](10c-setitem-delitem-and-the-abcs.md) is the write side.**

## Typing `__getitem__`: overloads, not a union

> *"The `@overload` decorator allows describing functions and methods that support multiple
> different combinations of argument types. A series of `@overload`-decorated definitions must be
> followed by exactly one non-decorated definition (for the same function/method)."* —
> [`typing.overload`](https://docs.python.org/3.14/library/typing.html#typing.overload)

The typing specification's own example is `bytes.__getitem__` — `(self, i: int) -> int` and
`(self, s: slice) -> bytes` — and it states why: *"This description is more precise than would be
possible using unions, which cannot express the relationship between the argument and return
types"*. With a union, every caller of `prices[0]` is told it may have received a `Prices`.
`typing.SupportsIndex` — *"A protocol with one abstract method `__index__`"* — is the annotation for
"anything `operator.index` accepts":

```python
from collections.abc import MutableSequence
from typing import SupportsIndex, overload


class Prices(MutableSequence[int]):
    @overload
    def __getitem__(self, key: SupportsIndex) -> int: ...
    @overload
    def __getitem__(self, key: slice) -> "Prices": ...
    def __getitem__(self, key):
        if isinstance(key, slice):
            return Prices(self._data[key])
        return self._data[key]
```

## Tuple keys and `...`

A comma in the brackets passes a tuple — `grid[1, 2]` is `grid.__getitem__((1, 2))` — so a
two-dimensional class unpacks the tuple and interprets each part, and a one-dimensional class
should reject tuples. The built-in precedent is `memoryview`, which raises `NotImplementedError`
with `multi-dimensional slicing is not implemented` for a tuple of slices
(`Objects/memoryobject.c`). `...` is legal in a subscript and arrives as the `Ellipsis` object; the
3.14 docs list *"Numpy's slicing and striding"* among its typical uses, but no built-in sequence
gives it a meaning. Delegating each axis to a `range` gets negatives, clamping and errors right:

```python
class Grid:
    def __init__(self, width: int, height: int, fill=0) -> None:
        self.width, self.height = width, height
        self._cells = [fill] * (width * height)

    def __getitem__(self, key):
        if not (isinstance(key, tuple) and len(key) == 2):
            raise TypeError("Grid indices must be a (row, column) pair")
        rows = range(self.height)[key[0]]         # an int, or a range for a slice
        cols = range(self.width)[key[1]]
        if isinstance(rows, int) and isinstance(cols, int):
            return self._cells[rows * self.width + cols]
        rows = [rows] if isinstance(rows, int) else rows
        cols = [cols] if isinstance(cols, int) else cols
        return [[self._cells[r * self.width + c] for c in cols] for r in rows]


grid = Grid(3, 2)
grid._cells[:] = [1, 2, 3,
                  4, 5, 6]
assert grid[1, 2] == 6
assert grid[-1, 0] == 4
assert grid[:, 1] == [[2], [5]]          # column 1, as one-element rows
assert grid[0, :] == [[1, 2, 3]]         # row 0
```

## Gotchas

**Symptom: every caller of `prices[0]` needs an `isinstance` check to satisfy the type checker.**
Cause: `__getitem__` is annotated `key: int | slice -> int | Prices`, and a union cannot say which
input gives which output. Fix: two `@overload`s, as above.

```python
@overload
def __getitem__(self, key: SupportsIndex) -> int: ...
@overload
def __getitem__(self, key: slice) -> "Prices": ...
```

**★ Symptom: `TypeError: list indices must be integers or slices, not tuple` from `rows[1, 2]`
on a list of lists.** Cause: the comma makes the key the tuple `(1, 2)`, and a `list` accepts only
an integer or a slice — a list of lists is not a two-dimensional type, just a list whose elements
happen to be lists. Fix: index one level at a time, or wrap the data in a class that interprets a
pair, like `Grid` above.

```python
value = rows[1][2]
column = [row[2] for row in rows]      # rows[:, 2] has no meaning for nested lists
```

**Symptom: `obj[...]` on a one-dimensional class produces a confusing error from deep inside the
method.** Cause: `...` arrives as the `Ellipsis` object, and the integer branch passed it on to
arithmetic. Fix: convert with `operator.index`, which rejects it at the door with a `TypeError`.

```python
index = operator.index(key)
```

## Interview questions

**How should `__getitem__` be annotated when it accepts an index or a slice?**
With two overloads: one taking `SupportsIndex` (or `int`) and returning the element type, one
taking `slice` and returning the container type, followed by the single real implementation. The
typing specification uses `bytes.__getitem__` as its example and explains that a union *"cannot
express the relationship between the argument and return types"* — callers of `obj[0]` would be
told they might have received a container.

**How would you support `grid[1, 2]` and `grid[:, 0]`?**
A comma makes the key a tuple, so `__getitem__` receives `(1, 2)` or `(slice(None, None, None), 0)`.
Check that it is a pair, then interpret each part against the axis it indexes — delegating each to
`range(axis_length)[part]` gives an integer or a `range` with the built-in negative-index, clamping
and error behaviour — and combine them into a flat position or a list of positions. Reject other
shapes with `TypeError`. The built-in `memoryview` shows the other option: it declines
multi-dimensional slicing with `NotImplementedError`.

---

← Prev: [10c · `__setitem__`, `__delitem__` and the ABCs](10c-setitem-delitem-and-the-abcs.md) · [Topic index](README.md) · Next → [11 · Slicing in real code: pagination](11-slicing-in-real-code.md)
