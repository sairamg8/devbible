---
title: "slice.indices(n) turns a slice into concrete positions with exactly the clamping the built-in sequences use — the way to count, enumerate or implement a slice without building it — but its output is shaped for range(), and fed back into a slice with a negative step it selects nothing"
sidebar_label: "04b · slice.indices()"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Slice objects](https://docs.python.org/3.14/reference/datamodel.html#slice-objects) and
> [Ranges](https://docs.python.org/3.14/library/stdtypes.html#ranges); CPython 3.14
> [`Objects/sliceobject.c`](https://github.com/python/cpython/blob/3.14/Objects/sliceobject.c)
> (`_PySlice_GetLongIndices`, `slice_indices`) for the bounds it chooses and its error text.
> Documentation-verified — **no sandbox run, no program output**.

**A `slice` means nothing until it meets a length: `slice(-3, None)` is "the last three" only
once you know how many there are. `indices(length)` performs that meeting — it applies the same
defaults, negative re-basing and clamping as the built-in sequences and returns three plain
integers. Those integers are designed as `range()` arguments, which makes them the exact tool for
three jobs: counting how many elements a slice selects without building it, enumerating the
positions, and implementing slicing in a class whose storage is not a list. They are not designed
to go back into a slice, and for a negative step they cannot: the stop comes back as `-1`, which
`range` reads as "below zero" and a slice reads as "the last element".**

## What the documentation promises

> *"This method takes a single integer argument *length* and computes information about the slice
> that the slice object would describe if applied to a sequence of *length* items.  It returns a
> tuple of three integers; respectively these are the *start* and *stop* indices and the *step*
> or stride length of the slice. Missing or out-of-bounds indices are handled in a manner
> consistent with regular slices."* —
> [Slice objects](https://docs.python.org/3.14/reference/datamodel.html#slice-objects)

The CPython docstring says the same thing in fewer words — *"Out of bounds indices are clipped in
a manner consistent with the handling of normal slices"* — and the same function,
`_PySlice_GetLongIndices`, is what `range` uses when *you* slice a range. It works on arbitrary
precision integers, so it has no overflow edge.

```python
assert slice(-3, None).indices(5) == (2, 5, 1)       # "last three" of five
assert slice(0, 100).indices(5) == (0, 5, 1)         # stop clamped to the length
assert slice(10, 20).indices(5) == (5, 5, 1)         # entirely past the end: empty
assert slice(-100, 2).indices(5) == (0, 2, 1)        # far below: clamped to 0
```

CPython rejects a negative length with `ValueError` (message `length should not be negative`) and
a zero step with the same `slice step cannot be zero` that slicing raises.

## Job 1: count without building

The number of elements a slice selects is awkward by hand once steps and negatives are involved.
`range` already knows the arithmetic, so the length of the range built from `indices()` is the
length of the slice:

```python
def slice_length(sl: slice, length: int) -> int:
    return len(range(*sl.indices(length)))


assert slice_length(slice(1, 10, 3), 8) == 3          # positions 1, 4, 7
assert slice_length(slice(None, None, -2), 6) == 3    # positions 5, 3, 1
assert slice_length(slice(5, 2), 10) == 0
assert slice_length(slice(-3, None), 2) == 2          # "last three" of two is both
```

That is also the number an extended slice *assignment* demands on the right-hand side — the
length rule of **12** *(not written yet)* — so computing it this way lets you
build a replacement of exactly the right size.

## Job 2: enumerate the positions

```python
def selected_positions(sl: slice, length: int) -> list[int]:
    return list(range(*sl.indices(length)))


assert selected_positions(slice(None, None, 2), 5) == [0, 2, 4]
assert selected_positions(slice(None, None, -1), 3) == [2, 1, 0]
```

A `slice` itself cannot do this — it has no length and no iteration, because it describes
positions only relative to a length you supply. `range` is a real sequence: the documentation
calls it an object that *"only stores the `start`, `stop` and `step` values, calculating
individual items and subranges as needed"*.

## Job 3: implement slicing for storage that is not a list

When your class wraps a list, it can hand the slice straight to the list. When the storage is a
file, a database page, or a computed series, you need the positions — and `indices()` supplies
them with the built-in semantics, so your class clamps and handles negatives exactly as a list
would:

```python
class Squares:
    """The squares 0, 1, 4, 9, ... up to (count - 1) ** 2, computed on demand."""

    def __init__(self, count: int) -> None:
        self._count = count

    def __len__(self) -> int:
        return self._count

    def __getitem__(self, key):
        if isinstance(key, slice):
            return [i * i for i in range(*key.indices(self._count))]
        if key < 0:
            key += self._count
        if not 0 <= key < self._count:
            raise IndexError("Squares index out of range")
        return key * key


squares = Squares(6)
assert squares[1:4] == [1, 4, 9]
assert squares[::-2] == [25, 9, 1]
assert squares[-2:100] == [16, 25]
```

That class still has gaps — it accepts a float index, and returns a list rather than its own type
— which **13** *(not written yet)* closes.

## The trap: the numbers are for `range`, not for slicing

For a negative step, `_PySlice_GetLongIndices` uses `-1` as the lower bound and `length - 1` as
the upper, so an omitted stop comes back as `-1`. To `range`, `-1` is "one below position 0" and
the countdown includes 0. To a slice, `-1` is re-based to `length - 1` — the start — and the slice
is empty:

```python
data = ["a", "b", "c", "d", "e"]
backwards = slice(None, None, -1)

start, stop, step = backwards.indices(len(data))
assert (start, stop, step) == (4, -1, -1)
assert data[backwards] == ["e", "d", "c", "b", "a"]
assert data[start:stop:step] == []                                 # -1 re-based to 4
assert [data[i] for i in range(start, stop, step)] == ["e", "d", "c", "b", "a"]
```

This is the same "before index 0" position that [02](02-negative-steps.md) showed no literal can
spell. Keep the original slice object whenever you need to slice again, and treat the triple as
`range` arguments only.

## Gotchas

**★ Symptom: code that re-slices with the numbers from `slice.indices()` returns an empty list
for reversed slices.** Cause: for a negative step, `indices()` returns a stop of `-1` meaning
"before 0" to `range`, but `-1` in a slice means the last element. Fix: slice with the original
object; use the numbers only with `range`.

```python
subset = data[original_slice]
positions = range(*original_slice.indices(len(data)))
```

**Symptom: `for i in some_slice:` raises `TypeError`.** Cause: a `slice` defines no iteration; it
needs a length to mean anything. Fix: convert through `indices()`.

```python
for i in range(*some_slice.indices(len(seq))):
    handle(seq[i])
```

**Symptom: a hand-written "how many rows will this slice return" gives the wrong count for steps
other than 1.** Cause: `(stop - start) // step` ignores clamping, negative bounds, and the
rounding up that a partial last stride needs. Fix: let `range` count.

```python
expected_rows = len(range(*requested.indices(total_rows)))
```

**Symptom: `ValueError: length should not be negative` from a pagination helper.** Cause: the
length passed to `indices()` was computed as `total - offset` and went negative for an offset past
the end. Fix: the length is the size of the sequence, never a derived remainder.

```python
positions = range(*requested.indices(len(rows)))
```

## Interview questions

**★ What does `slice.indices(n)` return, and when do you need it?**
A `(start, stop, step)` triple of integers describing the positions the slice selects in a
sequence of length `n`, with the same clamping as the built-in sequences. You need it when you
implement `__getitem__` for storage that is not a list, when you want the number of selected
elements without building the slice (`len(range(*s.indices(n)))`), or when you must iterate the
positions themselves.

**★ Why can't the output of `indices()` always be fed back into a slice?**
Because for a negative step the stop it returns may be `-1`, which `range` reads as "one below
position 0" and a slice reads as "the last element". The triple is designed as `range` arguments.
To slice again, keep the original slice object.

**How do you count the elements an extended slice selects?**
`len(range(*s.indices(len(seq))))`. `indices()` resolves defaults, negatives and clamping for the
given length, and `range` computes the count of a stepped progression exactly — including the
partial last stride — without allocating the elements.

**Why is `indices()` better than reading `start`, `stop` and `step` directly in a custom
`__getitem__`?**
Because the attributes are raw: `None` for omitted parts, negatives that need re-basing against
the length, out-of-range values that need clamping, and defaults that depend on the sign of the
step. Re-implementing those rules is where hand-written slicing goes wrong at the edges;
`indices()` applies the built-in rules in one call, so your class behaves exactly like a list.

---

← Prev: [04 · slice objects](04-slice-objects.md) · [Topic index](README.md) · Next → [05 · Slices are copies](05-slices-are-copies.md)
