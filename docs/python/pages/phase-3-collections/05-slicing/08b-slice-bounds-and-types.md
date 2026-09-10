---
title: "On the left of =, a slice's clamped bounds change what the statement does — a start past the end appends, a reversed pair inserts, and -0 empties the list — and only list, bytearray, array and same-length memoryview accept a slice target at all"
sidebar_label: "08b · Slice bounds and target types"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Common Sequence Operations](https://docs.python.org/3.14/library/stdtypes.html#common-sequence-operations)
> (notes 3 and 4), [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types),
> [`array`](https://docs.python.org/3.14/library/array.html); CPython 3.14
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`adjust_slice_indexes`, `list_ass_slice_lock_held`),
> [`Objects/bytearrayobject.c`](https://github.com/python/cpython/blob/3.14/Objects/bytearrayobject.c)
> (`bytearray_ass_subscript`) and
> [`Objects/abstract.c`](https://github.com/python/cpython/blob/3.14/Objects/abstract.c) for the
> mechanism and error text — implementation detail where the docs are silent.
> Documentation-verified — **no sandbox run, no program output**.

**Reading a slice with bad bounds costs you, at worst, an empty or short result
([03](03-out-of-range-never-raises.md)). Writing to one with bad bounds costs you data, because the
clamping that makes reads forgiving turns into a different operation on the left of `=`: a start
beyond the end becomes an append, a stop below the start becomes an insertion, and a computed
`-0` start becomes "the whole list". None of these raise. The second half of the page is which
objects accept a slice target at all — `list`, `bytearray` (bytes-like values only), `array.array`
(same type code only) and `memoryview` (same length only) — and what each of the others says when
you try. [08](08-slice-assignment.md) is the assignment itself.**

## Bounds clamp — so a bad pair appends or inserts instead of failing

The slice's bounds go through the same clamping as reading a slice
([03](03-out-of-range-never-raises.md)). On the left of `=` that is not merely forgiving; it
changes *what the statement does*:

- **A start past the end appends.** On a five-element list, `a[10:12] = ["x"]` clamps to `a[5:5]`
  and adds `"x"` at the end. There is no position 10 to put it at, and no error says so.
- **A reversed pair inserts.** `a[5:2] = ["X"]` replaces nothing: the source comment in
  `adjust_slice_indexes` reads *"Make sure s[5:2] = [..] inserts at the right place: before 5, not
  before 2."*, and `list_ass_slice_lock_held` raises the stop to the start (`if (ihigh < ilow)
  ihigh = ilow;`). So a computed `(start, end)` that came out swapped silently inserts.
- **Negatives count from the end, as ever.** `a[-1:] = ["z"]` replaces the last element;
  `a[-1:-1] = ["y"]` inserts before it; and `a[-n:] = []` with `n == 0` is `a[0:] = []` — it
  empties the whole list, the `-0` trap of [01](01-the-three-numbers.md) with a destructive edge.

When a range comes from outside — a user, a diff, an edit script — validate it before assigning:

```python
def replace_range(items: list, start: int, stop: int, new_items) -> None:
    if not 0 <= start <= stop <= len(items):
        raise IndexError(f"range {start}:{stop} is outside 0:{len(items)}")
    items[start:stop] = new_items
```

## Only mutable sequences take it

- **`str`, `tuple`, `bytes`** are immutable: the store reaches `PyObject_SetItem`, which raises
  `TypeError` from the format `'%.200s' object does not support item assignment` — for a slice
  target as for an index. Build a new object: `"J" + word[1:]`.
- **`bytearray`** takes bytes, buffers or iterables of ints; a `str` or a number on the right
  raises `TypeError: can assign only bytes, buffers, or iterables of ints in range(0, 256)`
  (`bytearray_ass_subscript` in `Objects/bytearrayobject.c`). Encode text first.
- **`array.array`** is stricter still: *"When using slice assignment, the assigned value must be an
  array object with the same type code; in all other cases, `TypeError` is raised."* —
  [`array`](https://docs.python.org/3.14/library/array.html).
- **`memoryview`** allows slice assignment only at the same length — it cannot resize its buffer
  ([06](06-slices-that-do-not-copy.md)).

```python
from array import array

buffer = bytearray(b"GET /old HTTP/1.1")
buffer[4:8] = "/new-path".encode("ascii")        # a bytearray may grow: bytes on the right
assert buffer == bytearray(b"GET /new-path HTTP/1.1")

samples = array("i", [1, 2, 3, 4])
samples[1:3] = array("i", [20, 30, 35])          # same type code, any length
assert samples == array("i", [1, 20, 30, 35, 4])
```

## Gotchas

**★ Symptom: an editor's "replace selection" command sometimes inserts text instead of replacing
it.** Cause: when the user selects backwards, the computed range arrives as `(5, 2)`; `a[5:2] = new`
clamps the stop up to the start and inserts before position 5. Fix: normalise or validate the pair.

```python
start, stop = sorted((anchor, cursor))
lines[start:stop] = replacement
```

**★ Symptom: "remove the last n rows" with `rows[-n:] = []` empties the entire table when n is 0.**
Cause: `-0` is `0`, so `rows[-0:]` is `rows[0:]`. Fix: compute the stop from the length.

```python
rows[len(rows) - n:] = []           # n == 0 removes nothing; n > len(rows) needs a guard
```

**Symptom: rows written "at line 120" of a 100-line buffer appear at line 100, and nothing
complains.** Cause: an out-of-range start clamps to the end, so the assignment appends. Fix:
validate against `len()` first, as `replace_range` above does.

```python
if index > len(lines):
    raise IndexError(f"cannot insert at {index}: buffer has {len(lines)} lines")
lines[index:index] = new_lines
```

**Symptom: `TypeError: can assign only bytes, buffers, or iterables of ints in range(0, 256)` when
patching a header.** Cause: a `str` on the right of a `bytearray` slice. Fix: encode.

```python
packet[0:4] = "HTTP".encode("ascii")
```

**Symptom: `TypeError` from `samples[0:2] = [1.5, 2.5]` on an `array('d')`.** Cause: array slice
assignment requires an `array` of the same type code on the right, not a list. Fix: build one.

```python
samples[0:2] = array("d", [1.5, 2.5])
```

**Symptom: `TypeError: 'str' object does not support item assignment` from `title[0:1] =
title[0].upper()`.** Cause: strings are immutable; no slice of one can be a target. Fix: build a
new string.

```python
title = title[:1].upper() + title[1:]
```

## Interview questions

**Why does `a[5:2] = ["X"]` insert rather than raise or replace?**
Slice bounds are clamped rather than validated, and a stop below the start denotes an empty slice.
CPython raises the stop to the start so that the empty slice sits at position 5 — its source says
the point is to insert *"before 5, not before 2"*. The result is an insertion before index 5. The
same forgiveness makes a start past the end append. Code that takes ranges from outside should
validate them, because the list never will.

**★ What does `rows[-n:] = []` do when `n` is 0, and how do you write "drop the last n" safely?**
It empties the list. `-0` is `0`, so `rows[-0:]` is `rows[0:]` — every element — and assigning the
empty list to it removes them all. On the read side the same bug returns too much; on the write side
it destroys data. Compute the start from the length instead, `rows[len(rows) - n:] = []`, and guard
`n > len(rows)` separately, since a start that goes negative starts counting from the end again.

**Why can't you assign to a slice of a `str` or a `tuple`, and what do you do instead?**
Both are immutable: they define no item-assignment slot, so the store reaches `PyObject_SetItem`,
which raises `TypeError` saying the object *does not support item assignment* — the same error for
a slice target as for an index. Immutability is the point of the types: a `str` or `tuple` can be
hashed, shared and cached precisely because nobody can change it in place. You build a new object
from slices instead — `word[:i] + replacement + word[j:]` — and rebind the name.

**How do `bytearray` and `array.array` slice assignment differ from a list's?**
Both are mutable and both may change length through a slice assignment, but they constrain the
right-hand side. A `bytearray` accepts bytes, buffers or iterables of ints in `range(0, 256)` and
rejects a `str` or a number with `TypeError`, because text has no byte value until it is encoded.
An `array.array` accepts only another `array` with the same type code — the documentation says
*"in all other cases, `TypeError` is raised"* — even when a plain list of suitable numbers would
fit. A list accepts any iterable of any objects.

---

← Prev: [08 · Slice assignment](08-slice-assignment.md) · [Topic index](README.md) · Next →: [08c · Slice assignment versus rebinding](08c-slice-assignment-versus-rebinding.md)
