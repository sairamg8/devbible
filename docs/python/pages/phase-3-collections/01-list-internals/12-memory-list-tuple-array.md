---
title: "A list's memory is a header, one pointer per slot of capacity, and every object those pointers reach — `sys.getsizeof` reports only the first two, a tuple drops the spare capacity, and an `array` drops the per-element objects, at the price of creating one on every read"
sidebar_label: "12 · Memory: list, tuple and array"
sidebar_position: 30
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against [`sys.getsizeof`](https://docs.python.org/3.14/library/sys.html#sys.getsizeof),
> [`array`](https://docs.python.org/3.14/library/array.html),
> and CPython sources
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_resize`),
> [`Include/cpython/tupleobject.h`](https://github.com/python/cpython/blob/3.14/Include/cpython/tupleobject.h),
> [`Modules/arraymodule.c`](https://github.com/python/cpython/blob/3.14/Modules/arraymodule.c)
> (`array_resize`, `array_array___sizeof___impl`, `q_getitem`).
> Documentation-validated; 🔴 **no byte counts anywhere on this page — nothing was
> measured**. Target: **CPython 3.14** (3.14.7).

**Three structures hold "a sequence of numbers" in the standard library, and they
differ in *where the numbers live*. A `list` owns a separate block of pointers — sized
for its capacity, not its length — and each pointer leads to a full Python object
elsewhere on the heap. A `tuple` stores its pointers inline in the object itself and
has no spare capacity, because it can never grow. An `array.array` stores raw C values
with no per-element objects at all. `sys.getsizeof` sees only the container's own
storage, so it reports a list of a million large objects as a million pointers'
worth and is silent about the rest. This page gives the shape of each layout from
the source, and deliberately no numbers: sizes depend on the build and platform, and
none were measured here. How to count what a structure really costs is
[12b](12b-measuring-memory.md).**

## Three layouts

**`list`** — `PyListObject` holds a pointer to a separately allocated block:

```c
    PyObject **ob_item;       /* list[0] is ob_item[0], etc. */
    Py_ssize_t allocated;     /* 0 <= ob_size <= allocated */
```

**`tuple`** — `PyTupleObject` in 3.14 carries the items inside itself:

```c
typedef struct {
    PyObject_VAR_HEAD
    /* Cached hash.  Initially set to -1. */
    Py_hash_t ob_hash;
    /* ob_item contains space for 'ob_size' elements. ... */
    PyObject *ob_item[1];
} PyTupleObject;
```

No `allocated` field — nothing to over-allocate, because a tuple never grows — and no
second allocation for the pointer block. The 3.14 header also has a cached-hash field.

**`array.array`** — raw machine values, typed by a one-character code:

> *"This module defines an object type which can compactly represent an array of basic
> values: characters, integers, floating-point numbers. Arrays are mutable sequence
> types and behave very much like lists, except that the type of objects stored in
> them is constrained."*

Its `__sizeof__` is the header plus `allocated * itemsize` — capacity times the width
of one C value.

| | `list` | `tuple` | `array.array` |
|---|---|---|---|
| Stores | pointers to objects | pointers to objects, inline | raw C values |
| Separate element block | yes | no | yes |
| Spare capacity | yes, ~1/8 growth ([02](02-overallocation-and-amortised-append.md)) | none | yes, *"about 1/16th"* |
| Per-element Python object | yes, shared where possible | yes | **no** — created on each read |
| Element types | anything | anything | one C type per array |
| Mutable / hashable | mutable / no | immutable / if its items are | mutable / no |

The `array` growth comment, from `array_resize`: *"the pattern starts out the same as
for lists but then grows at a smaller rate so that larger arrays only overallocate by
about 1/16th -- this is done because arrays are presumed to be more memory
critical."*

## The type codes, and what their sizes mean

The docs' table gives each code a **minimum** size, not an exact one:

| Code | C type | Python type | Minimum size in bytes |
|---|---|---|---:|
| `'b'` / `'B'` | signed / unsigned char | int | 1 |
| `'h'` / `'H'` | signed / unsigned short | int | 2 |
| `'i'` / `'I'` | signed / unsigned int | int | 2 |
| `'l'` / `'L'` | signed / unsigned long | int | 4 |
| `'q'` / `'Q'` | signed / unsigned long long | int | 8 |
| `'f'` | float | float | 4 |
| `'d'` | double | float | 8 |
| `'w'` | `Py_UCS4` | Unicode character | 4 |

> *"The actual representation of values is determined by the machine architecture
> (strictly speaking, by the C implementation). The actual size can be accessed
> through the array.itemsize attribute."*

`'u'` also exists and is deprecated: *"Deprecated since version 3.3, will be removed in
version 3.16: Please migrate to 'w' typecode."*

## An array stores values, so every read makes an object

`array` element access builds a fresh Python object from the stored C value — for
`'q'`, from `Modules/arraymodule.c`:

```c
q_getitem(arrayobject *ap, Py_ssize_t i)
{
    return PyLong_FromLongLong(((long long *)ap->ob_item)[i]);
}
```

That is the trade in one function: compact at rest, an allocation on every access (for
values outside the small-int cache). An `array` makes numeric data *smaller*; it does
not make Python-level arithmetic over it faster. For vectorised arithmetic the answer
is outside the standard library; inside it, `array` is for storage, I/O and buffers —
topic 12 of this phase, **`array` and `memoryview`** *(not written yet)*, owns that.

## Gotchas

**★ Symptom: an `array` of floats uses less memory but a Python loop over it is no
faster — sometimes slower — than the list was.** Cause: each read creates a new `float`
from the stored C double. Fix: keep `array` for compact storage and bulk I/O, and do
not iterate it element-wise in hot paths:

```python
from array import array

samples = array("d")
with open("samples.bin", "rb") as f:
    samples.frombytes(f.read())         # bulk load, no per-element objects
```

**Symptom: `OverflowError` appending to an `array`.** Cause: the value does not fit the
C type — for `'b'`, `arraymodule.c` raises `signed char is greater than maximum`.
Fix: choose the type code from the value range, or use a wider one:

```python
counts = array("q")     # signed long long: minimum 8 bytes
```

**Symptom: a binary file written from `array("i")` on one machine is misread on
another.** Cause: the docs give `'i'` a *minimum* of 2 bytes; the real width and byte
order are the platform's. Fix: check `itemsize`, and byteswap or use `struct` for wire
formats:

```python
import sys

assert samples.itemsize == 8
if sys.byteorder != "little":
    samples.byteswap()
```

**Symptom: `BufferError` when appending to an array.** Cause: a `memoryview` (or other
buffer export) on it is still alive — `"cannot resize an array that is exporting
buffers"` is the literal message in `arraymodule.c`. Fix: release the view before
resizing:

```python
with memoryview(samples) as view:
    checksum = compute(view)
samples.append(0.0)     # view released; resize allowed
```

**Symptom: `array("u", …)` in code that must keep running past 3.15.** Cause: `'u'` is
deprecated and scheduled for removal in 3.16. Fix:

```python
letters = array("w", "héllo")
```

## Interview questions

**★ Compare the memory layout of a list, a tuple and an `array.array`.**
A list is a header pointing at a separate, over-allocated block of object pointers. A
tuple holds its pointers inline, sized exactly, with no capacity field because it
cannot grow. An array holds raw C values in a separate, mildly over-allocated block,
and has no per-element objects — it creates one each time an element is read.

**Why isn't `array` faster than `list` for arithmetic in pure Python?**
Because every access converts a C value into a new Python object, and the arithmetic
then happens on Python objects exactly as it would for a list. The gain is memory and
cheap bulk I/O. Speed on numeric data needs operations that run over the raw buffer
in C, which the standard library `array` does not provide.

**When would you store numbers in an `array.array` rather than a list?**
When there are many of them, they share one C type, and they are mostly stored, moved
or written rather than computed on element by element — sensor samples, a large id
column, a buffer read from a file with `frombytes`. The saving is the per-element
objects. If the workload is Python-level arithmetic, the saving is paid back on every
read; if it is vectorised arithmetic, the standard library is the wrong layer.

**Why doesn't a tuple need an `allocated` field?**
Because it never changes size after creation. Over-allocation exists to make repeated
appends cheap; a tuple has no append, so its storage is sized exactly once and the
items can live inside the object itself.

---

← [Sharing a list between threads](11d-sharing-a-list-between-threads.md) · [Topic index](README.md) · Next → [Measuring memory honestly](12b-measuring-memory.md)
