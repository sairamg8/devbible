---
title: "Deleting through a slice costs the tail that has to move, so draining a list from the front is quadratic — except in a bytearray, which only advances its start — while del on a name forgets the name and leaves the object to its other holders, and the immutable types, memoryview and deque refuse slice deletion outright"
sidebar_label: "09c · Deletion cost and types"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [The `del` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-del-statement),
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html),
> [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types);
> CPython 3.14 [`Objects/bytearrayobject.c`](https://github.com/python/cpython/blob/3.14/Objects/bytearrayobject.c)
> (`bytearray_setslice_linear`),
> [`Objects/memoryobject.c`](https://github.com/python/cpython/blob/3.14/Objects/memoryobject.c) and
> [`Objects/abstract.c`](https://github.com/python/cpython/blob/3.14/Objects/abstract.c) for the
> mechanism and error text — implementation detail where the docs are silent.
> Documentation-verified — **no sandbox run, no program output**.

**[09b](09b-deleting-slices.md) is what `del` removes. This page is what it costs and what it
touches. A list deletion moves every element after the deleted range, so the position matters more
than the size, and a list drained from the front pays for its whole length on every deletion.
`bytearray` is the documented exception — a front deletion only moves its logical start — which is
why it, and not `bytes`, is the receive buffer of a framed protocol. `del` on a *name* is a
different statement altogether: it unbinds the name and does nothing to the object if anyone else
holds it. And not every sequence takes a slice deletion: the immutable ones, `memoryview` and
`deque` each refuse it, each with its own error.**

## What it costs — and the `bytearray` exception

> Delete slice `del l[i:j]`: **O(n - i)** —
> [Time complexity](https://docs.python.org/3.14/library/time-complexity.html)

The cost is the tail that has to move, so the *position* dominates: deleting the last hundred
elements is cheap, deleting the first hundred moves everything. Draining a list from the front
with `del queue[:k]` or `del queue[0]` in a loop is therefore quadratic; the fix for queues is
`collections.deque`, covered in [The queue problem, and deque](../01-list-internals/03b-quadratic-patterns-and-deque.md).

`bytearray` is documented as the exception:

> *"A `bytearray` is mutable, and additionally supports the mutating operations of `list` (except
> `sort`), at the same costs. However, deleting at the front with `del` (`del b[0]`, `del b[:k]`)
> only advances the start of the buffer instead of moving the remaining bytes, and is amortized
> O(1)."*

In `bytearray_setslice_linear`, a deletion starting at 0 shrinks the buffer by advancing its
logical start (`ob_start`) instead of moving bytes. That makes a `bytearray` with `del buf[:n]` the
natural receive buffer for a framed protocol — consume what you parsed from the front, append
what arrives at the back:

```python
def drain_frames(buffer: bytearray) -> list[bytes]:
    """Remove and return every complete length-prefixed frame at the front of buffer."""
    frames = []
    while len(buffer) >= 4:
        length = int.from_bytes(buffer[:4], "big")
        if len(buffer) < 4 + length:
            break                                   # incomplete: wait for more data
        frames.append(bytes(buffer[4:4 + length]))
        del buffer[:4 + length]                     # amortized O(1) at the front of a bytearray
    return frames


receive = bytearray(b"\x00\x00\x00\x03abc\x00\x00\x00\x02h")
assert drain_frames(receive) == [b"abc"]
assert receive == bytearray(b"\x00\x00\x00\x02h")   # the partial frame stays for next time
```

Deleting from a `bytearray` resizes it, so it raises `BufferError` while any `memoryview` of it is
alive — the pinning rule of [06](06-slices-that-do-not-copy.md). Parse with views if you like, but
release them before the `del`.

## `del a` is not `del a[:]`

> *"Deletion of a name removes the binding of that name from the local or global namespace"*

`del a` forgets the name; the list lives on for as long as anything else refers to it. `del a[:]`
keeps the name and empties the object, and every other holder sees it empty — the same split as
`a = []` against `a[:] = []` in [08c](08c-slice-assignment-versus-rebinding.md).

## Which types accept it

- **`list`, `bytearray`, `array.array`** — mutable sequences; ordinary and extended slice deletion.
- **`str`, `tuple`, `bytes`, `range`** — immutable: `PyObject_DelItem` raises `TypeError` from the
  format `'%.200s' object does not support item deletion`. Build the shorter object instead:
  `text = text[3:]`.
- **`memoryview`** — cannot change its buffer's size: a writable view raises
  `TypeError: cannot delete memory`, a read-only one `cannot modify read-only memory`.
- **`collections.deque`** — `del d[i]` works, a slice does not (the `deque` section of
  [06](06-slices-that-do-not-copy.md)).

## Gotchas

**★ Symptom: a socket reader's CPU use grows with the size of the backlog.** Cause: it consumes
parsed bytes with `data = data[n:]` on `bytes`, which copies the whole remainder on every frame.
Fix: keep a `bytearray` and delete from the front — documented as amortized O(1).

```python
buffer = bytearray()
buffer.extend(chunk)
del buffer[:consumed]
```

**Symptom: a worker that pops jobs with `del queue[0]` slows to a crawl as the backlog grows.**
Cause: every front deletion from a list moves every remaining element. Fix: a `deque`.

```python
from collections import deque

queue = deque(jobs)
job = queue.popleft()
```

**Symptom: `BufferError: Existing exports of data: object cannot be re-sized` from
`del buffer[:n]`.** Cause: a `memoryview` of the `bytearray` — often a parsed frame still being
referenced — is alive. Fix: copy what you keep, release the view, then delete.

```python
frame = bytes(view[4:4 + length])
view.release()
del buffer[:4 + length]
```

**Symptom: `TypeError: 'str' object does not support item deletion` from `del line[:2]`.** Cause:
strings are immutable. Fix: rebind to the shorter string.

```python
line = line[2:]
```

**Symptom: memory is not released after `del report_rows` in a long-running job.** Cause: `del`
removed one name; a cache or another object still refers to the list. Fix: empty the object if
every holder should drop its contents — or remove the other references.

```python
del report_rows[:]            # every holder now sees an empty list
```

## Interview questions

**★ What is the difference between `del a`, `del a[:]` and `a = []`?**
`del a` removes the name `a` from its namespace; the list still exists if anything else refers to
it, and using `a` afterwards raises `NameError`. `del a[:]` keeps the name and empties the list
object in place, so every reference to it sees an empty list — the documentation defines
`clear()` as exactly this. `a = []` rebinds the name to a new empty list and leaves the old one,
contents intact, to its other holders.

**Why is `del buf[:n]` cheap on a `bytearray` but not on a list?**
The 3.14 cost table documents it: deleting at the front of a `bytearray` *"only advances the start
of the buffer instead of moving the remaining bytes, and is amortized O(1)"*, whereas a list's
`del l[i:j]` is O(n − i) because the remaining references are moved down. CPython keeps a separate
logical start inside the bytearray's allocation for exactly this. It is why a `bytearray` is the
idiomatic receive buffer: append at the back, delete what you parsed from the front.

**★ Which built-in types support deleting a slice, and what happens with the others?**
`list`, `bytearray` and `array.array` — the mutable sequences — support both ordinary and extended
slice deletion. `str`, `tuple`, `bytes` and `range` are immutable and raise `TypeError` saying the
object *does not support item deletion*; you build a shorter object from slices instead. A
`memoryview` cannot resize its buffer, so it raises `TypeError: cannot delete memory` (or
`cannot modify read-only memory` for a read-only view). A `deque` deletes by index only; a slice
key fails because the type has no mapping subscript.

---

← Prev: [09b · Deleting slices](09b-deleting-slices.md) · [Topic index](README.md)
