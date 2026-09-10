---
title: "memoryview slices and range slices are views and recomputations, not copies — O(1) instead of O(k), at the price of sharing: a view writes through, keeps its whole buffer alive, and locks a bytearray against resizing until every view of it is gone"
sidebar_label: "06 · Slices that do not copy"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Memory Views](https://docs.python.org/3.14/library/stdtypes.html#memoryview),
> [Ranges](https://docs.python.org/3.14/library/stdtypes.html#ranges),
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html),
> [`collections.deque`](https://docs.python.org/3.14/library/collections.html#collections.deque),
> [`struct.unpack_from`](https://docs.python.org/3.14/library/struct.html#struct.unpack_from); the
> NumPy v2.5 manual, [Copies and views](https://numpy.org/doc/stable/user/basics.copies.html), as a
> named contrast only; CPython 3.14
> [`Objects/memoryobject.c`](https://github.com/python/cpython/blob/3.14/Objects/memoryobject.c),
> [`Objects/bytearrayobject.c`](https://github.com/python/cpython/blob/3.14/Objects/bytearrayobject.c)
> and [`Objects/abstract.c`](https://github.com/python/cpython/blob/3.14/Objects/abstract.c) for
> error text. Documentation-verified — **no sandbox run, no program output**.

**Two built-in types slice without copying elements. A `memoryview` slice is *"a new view onto
the same buffer"*, so it costs O(1) however large the slice — which is why protocol parsers and
file readers use it to cut frames out of a buffer. A `range` slice is a new `range` computed from
three numbers, also O(1). The copying slices of [05](05-slices-are-copies.md) are safe because
they share nothing but references; a view shares the memory itself. So a view writes through to
its source, it keeps the entire source buffer alive for as long as it exists, and while any view
of a `bytearray` exists — including a slice you stored and forgot — the `bytearray` cannot grow or
shrink. NumPy made the other choice for its arrays, which is the contrast that surprises people
moving between the two. `collections.deque` does not slice at all.**

## `memoryview`: the same buffer, re-windowed

> *"`memoryview` objects allow Python code to access the internal data of an object that supports
> the buffer protocol without copying."* · *"A `memoryview` supports slicing and indexing to
> expose its data. One-dimensional slicing will result in a subview"* —
> [Memory Views](https://docs.python.org/3.14/library/stdtypes.html#memoryview)

> *"In particular, slicing a memory view returns a new view onto the same buffer."* — Get slice
> `v[i:j]`: **O(1)**; Convert to bytes `v.tobytes()`, `bytes(v)`: O(n) —
> [Time complexity](https://docs.python.org/3.14/library/time-complexity.html)

That is the tool for cutting many small pieces out of one large buffer. A length-prefixed frame
parser over `bytes` slicing would copy every payload; over a `memoryview` it copies nothing until
the consumer asks for owned bytes:

```python
import struct


def parse_frames(buffer):
    """Yield each length-prefixed payload as a zero-copy view."""
    view = memoryview(buffer)
    offset = 0
    while offset + 4 <= len(view):
        (length,) = struct.unpack_from(">I", view, offset)
        start, end = offset + 4, offset + 4 + length
        if end > len(view):
            break                                  # incomplete frame: wait for more data
        yield view[start:end]
        offset = end


data = b"\x00\x00\x00\x03abc\x00\x00\x00\x02hi"
assert [bytes(frame) for frame in parse_frames(data)] == [b"abc", b"hi"]
```

`struct.unpack_from` reads *"from *buffer* starting at position *offset*"*, so even the length
prefix is read without slicing. The bytes-versus-view question in depth — formats, `cast`,
multi-dimensional views — belongs to **12 · `array` and `memoryview`** *(not written yet)*; this
page covers only what a view slice shares.

## A view writes through

If the underlying object is writable, so is the view: *"If the underlying object is writable, the
memoryview supports one-dimensional slice assignment. Resizing is not allowed"*. The
documentation's own example shows a mismatched length failing with `ValueError: memoryview
assignment: lvalue and rvalue have different structures`.

```python
packet = bytearray(b"\x00\x01payload")
view = memoryview(packet)

view[0:2] = b"\x00\x09"          # same length: written into packet itself
assert packet[:2] == b"\x00\x09"
assert packet[2:] == b"payload"
```

## A view pins its buffer

> *"Many objects take special actions when a view is held on them (for example, a `bytearray`
> would temporarily forbid resizing); therefore, calling release() is handy to remove these
> restrictions (and free any dangling resources) as soon as possible."* —
> [`memoryview.release()`](https://docs.python.org/3.14/library/stdtypes.html#memoryview.release)

CPython's implementation makes the scope of "a view is held" precise: every view created by
slicing registers itself with the shared managed buffer, and the underlying object's buffer is
released only when the *last* registered view is released (`_memory_release` in
`Objects/memoryobject.c` decrements `mbuf->exports` and releases at zero). So releasing the view
you created does not unlock a `bytearray` while a slice of it is still alive somewhere. Growing or
shrinking the `bytearray` meanwhile raises `BufferError`, with the message `Existing exports of
data: object cannot be re-sized` (`_canresize` in `Objects/bytearrayobject.c`).

Scope views with `with`, and copy whatever must outlive them:

```python
buffer = bytearray(b"header:payload")

with memoryview(buffer) as view:
    header = bytes(view[:6])             # an owned copy; the slice view dies at once
buffer.extend(b"-more")                  # the view is released: resizing is allowed again

assert header == b"header"
assert buffer == bytearray(b"header:payload-more")
```

The same pinning is a memory issue even for immutable `bytes`: a ten-byte view kept in a cache
holds the whole multi-megabyte object it was cut from.

## `range`: slicing recomputes

> *"a `range` object will always take the same (small) amount of memory, no matter the size of the
> range it represents (as it only stores the `start`, `stop` and `step` values, calculating
> individual items and subranges as needed)."* —
> [Ranges](https://docs.python.org/3.14/library/stdtypes.html#ranges)

The documentation's example is `range(0, 20, 2)[:5]` producing `range(0, 10, 2)`, and the cost table
prices a range slice at O(1). CPython's `compute_slice` runs the slice through the same
`_PySlice_GetLongIndices` that `slice.indices()` uses and builds a new range from the results:

```python
positions = range(0, 1_000_000_000, 7)
last_three = positions[-3:]

assert isinstance(last_three, range)
assert list(last_three) == [999_999_980, 999_999_987, 999_999_994]
assert range(0, 20, 2)[:5] == range(0, 10, 2)
```

## NumPy: the contrast

The NumPy manual states the opposite default for its arrays: *"Views are created when elements can
be addressed with offsets and strides in the original array. Hence, basic indexing always creates
views."* and *"Advanced indexing, on the other hand, always creates copies."*
([Copies and views](https://numpy.org/doc/stable/user/basics.copies.html), NumPy v2.5). So
`window = prices[1:3]` on an array followed by `window[0] = 0` changes `prices` — the exact
opposite of a list — and code that relied on list-slice copying needs an explicit `.copy()` when
it moves to arrays. This corpus has no NumPy page; the point here is only that "slices copy" is a
property of the built-in sequences, not of the syntax.

## `deque`: nothing to slice

The `deque` documentation lists what it supports — *"iteration, pickling, `len(d)`, `reversed(d)`,
`copy.copy(d)`, `copy.deepcopy(d)`, membership testing with the `in` operator, and subscript
references such as `d[0]` to access the first element.  Indexed access is O(1) at both ends but
slows to O(n) in the middle."* Slicing is not in the list, and CPython's `deque` type defines only
integer item access (`sq_item`), no mapping subscript. A slice key therefore reaches the generic
path in `PyObject_GetItem` and raises `TypeError` with the message `sequence index must be
integer, not 'slice'`. The documentation's own suggestion for in-place work is rotation: *"To
implement `deque` slicing, use a similar approach applying `rotate()` to bring a target element to
the left side of the deque."* To read a window, walk it with `islice`
([07](07-islice-and-iterators.md)):

```python
from collections import deque
from itertools import islice

recent = deque(["e1", "e2", "e3", "e4", "e5"], maxlen=100)
assert list(islice(recent, 1, 3)) == ["e2", "e3"]
```

## Gotchas

**★ Symptom: `BufferError: Existing exports of data: object cannot be re-sized` when appending to
a receive buffer.** Cause: a `memoryview` of the `bytearray` — often a slice stored by an earlier
parsing step — is still alive, and the buffer cannot change size while any view exists. Fix:
release views before resizing, and copy what must be kept.

```python
frame = bytes(view[start:end])      # keep an owned copy, not the view
view.release()
receive_buffer.extend(chunk)
```

**★ Symptom: a service's memory stays high after large uploads are processed, though only small
fields are kept.** Cause: the kept fields are `memoryview` slices, each of which keeps its entire
source buffer alive. Fix: convert what you store into owned bytes.

```python
cache[key] = bytes(view[offset:offset + 16])
```

**Symptom: a debug log prints `<memory at 0x…>` instead of the frame contents.** Cause: a
`memoryview`'s representation is its address — the documentation's own example shows `v[1:4]`
displaying as `<memory at 0x7f3ddc9f4350>`. Fix: log a copy or a hex dump.

```python
logger.debug("frame %s", frame.hex())
```

**Symptom: patching a field through a view raises `ValueError: memoryview assignment: lvalue and
rvalue have different structures`.** Cause: a view cannot resize its buffer, so the replacement
must have exactly the slice's length. Fix: resize the underlying `bytearray` itself, with no views
alive.

```python
view.release()
packet[4:6] = b"longer-field"          # a bytearray slice assignment may change the length
```

**★ Symptom: `TypeError: sequence index must be integer, not 'slice'` from code that keeps recent
events in a `deque`.** Cause: `deque` supports `d[0]` and `d[-1]` but not slices. Fix: walk the
window with `islice`, or keep a `list` if you slice more than you append.

```python
window = list(islice(recent_events, start, stop))
```

**Symptom: a memory spike when selecting every hundredth ID from a large numeric range.** Cause:
`list(range(n))[::100]` materialises all `n` integers before slicing. Fix: slice the range, which
is O(1) and stays lazy.

```python
sample_ids = range(0, total_ids)[::100]
```

## Interview questions

**★ Why is slicing a `memoryview` O(1) while slicing `bytes` is O(k)?**
Because a `memoryview` slice copies no data: it is a new view object describing a different window
— offset, length, stride — onto the same underlying buffer, and the 3.14 cost table prices it at
O(1). A `bytes` slice must produce an independent immutable object, so it copies the selected
bytes, which costs the length of the slice. Converting a view back with `bytes(view)` is the O(k)
step, and you take it only for the pieces you need to own.

**★ Why can't a `bytearray` be resized while a `memoryview` of it exists?**
Because the view points directly at the bytearray's memory; resizing may move or free that memory,
leaving the view dangling. So while any view holds the buffer, resizing raises `BufferError`. The
documentation recommends `release()` or a `with` block to end views promptly — and in CPython every
slice of a view holds the buffer too, so the lock lasts until the last slice is gone.

**How do NumPy array slices differ from list slices?**
Opposite defaults. A list slice is a new list — a shallow copy — so modifying it never affects the
original. A NumPy basic slice is a view — the manual says *"basic indexing always creates views"*
— so writing into it writes into the original array, and an explicit `.copy()` is needed for
independence. Advanced indexing, with integer arrays or boolean masks, always copies.

**Why doesn't `collections.deque` support slicing, and what do you use instead?**
A deque is optimised for its ends: indexed access *"is O(1) at both ends but slows to O(n) in the
middle"*, so a slice would silently cost a walk from an end. CPython's deque exposes only integer
indexing. Use `itertools.islice(d, start, stop)` to read a window, the documented `rotate()`
approach to modify one in place, or a `list` if the workload is mostly slicing.

**What does slicing a `range` return, and what does it cost?**
Another `range`, computed from the original's start, stop and step with the same clamping rules as
any slice, in O(1) time and memory — the documentation's example turns `range(0, 20, 2)[:5]` into
`range(0, 10, 2)`. Nothing is materialised, so slicing a billion-element range is as cheap as
slicing a ten-element one.

---

← Prev: [05 · Slices are copies](05-slices-are-copies.md) · [Topic index](README.md) · Next →: [07 · itertools.islice and iterators](07-islice-and-iterators.md)
