---
title: "A Python list is a resizable array of pointers, not a linked list — every cost you will ever argue about follows from that one sentence"
sidebar_label: "01 · The dynamic array"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 Programming FAQ
> [How are lists implemented in CPython?](https://docs.python.org/3.14/faq/design.html#how-are-lists-implemented-in-cpython),
> the Library Reference
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html#list),
> and CPython's own
> [`Include/cpython/listobject.h`](https://github.com/python/cpython/blob/3.14/Include/cpython/listobject.h)
> and [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c).
> Documentation-validated; **no sandbox run, no timings, no byte counts**.
> Target: **CPython 3.14** (3.14.7).

**A `list` is one contiguous C array of `PyObject *` pointers, plus a length and a
capacity, held behind a pointer in a small header struct. Indexing is a pointer
addition, so `l[k]` costs the same whether the list holds three items or thirty
million. Everything else — why `append` is cheap, why `insert(0, x)` is not, why a
list of a million integers is not a million integers laid end to end, why `len()`
is free — is a consequence of that layout and nothing else. Learn the layout once
and you stop having to memorise the table.**

## The documented shape

The Programming FAQ states the implementation directly, and it is the page the new
complexity reference links back to:

> *"CPython's lists are really variable-length arrays, not Lisp-style linked lists.
> The implementation uses a contiguous array of references to other objects, and
> keeps a pointer to this array and the array's length in a list head structure."*

> *"This makes indexing a list `a[i]` an operation whose cost is independent of the
> size of the list or the value of the index."*

The "list head structure" is `PyListObject`, and CPython's public header spells out
its invariants:

```c
typedef struct {
    PyObject_VAR_HEAD
    /* Vector of pointers to list elements.  list[0] is ob_item[0], etc. */
    PyObject **ob_item;

    /* ob_item contains space for 'allocated' elements.  The number
     * currently in use is ob_size.
     * Invariants:
     *     0 <= ob_size <= allocated
     *     len(list) == ob_size
     *     ob_item == NULL implies ob_size == allocated == 0
     * list.sort() temporarily sets allocated to -1 to detect mutations.
     */
    Py_ssize_t allocated;
} PyListObject;
```

Three fields carry the whole model:

- **`ob_item`** — one allocated block of pointers. The *pointers* are contiguous.
  The objects they point at are scattered anywhere on the heap.
- **`ob_size`** — how many slots are in use. This is what `len()` returns, which is
  why the docs note *"The number of elements is stored in the object, so `len()`
  does not need to count them."*
- **`allocated`** — how many slots the block can hold. `allocated - ob_size` is
  free space bought in advance; [02](02-overallocation-and-amortised-append.md)
  is about how it is bought.

That `allocated = -1` line is not a curiosity. It is the mechanism behind the
`list modified during sort` error in [06b](06b-during-the-sort.md).

## The consequence: two different memory pictures

A Java `ArrayList<Integer>` and a Python `list` of ints have the same picture: an
array of references. A C `int[]` does not. This matters more often than people
expect:

```python
xs = [10, 20, 30]
```

The list owns a three-slot pointer block. Slot 0 holds the address of an `int`
object whose value is 10. The integer itself lives elsewhere on the heap and may be
shared with every other reference to `10` in the process. Two direct results:

- **A list is heterogeneous for free.** `[1, "a", None, [2]]` costs exactly the same
  per slot as `[1, 2, 3, 4]` — one pointer each. Nothing about the layout cares what
  is on the other end of the pointer.
- **A list of numbers is not a numeric buffer.** Every arithmetic pass over it
  dereferences a pointer and unboxes an object. That is the entire reason `array`
  and `numpy` exist; [12](12-memory-list-tuple-array.md) works through when to
  reach for them.

## Indexing is arithmetic; searching is not

`l[k]` is `ob_item[k]` — one addition and one load. `x in l`, `l.index(x)` and
`l.count(x)` are all O(n) because a flat array of pointers carries no index over the
*values*. This is the single most common performance bug in Python service code:

```python
# O(n) per lookup, O(n*m) for the loop — the list is scanned every time
blocked = ["u_1001", "u_2002", "u_3003"]          # imagine 50_000 entries
flagged = [e for e in events if e.user_id in blocked]

# O(1) per lookup, O(n + m) overall
blocked = {"u_1001", "u_2002", "u_3003"}          # a set, built once
flagged = [e for e in events if e.user_id in blocked]
```

Nothing about the list is slow here. `in` on a list is doing exactly what a flat
array can do — walk it. Topic 04 of this phase owns `set` and why its `in` differs.

## Where the "list head" indirection actually shows

Because `ob_item` is a separate allocation reached through a pointer, a resize can
move the whole element block without the list object itself moving. Nothing in
Python-level code can observe the block's address, so this is invisible — except in
one place, and it is the reason `sort` protects itself:

```c
    /* The list is temporarily made empty, so that mutations performed
     * by comparison functions can't affect the slice of memory we're
     * sorting (allowing mutations during sorting is a core-dump
     * factory, since ob_item may change).
     */
```

That comment, from `list_sort_impl` in `Objects/listobject.c`, is the C-level
statement of a rule you will meet again from the Python side in
[11](11-mutating-while-iterating.md): a list's element block is not stable across
mutation, so anything holding a raw position into it has to be defended.

## Gotchas

### "Python lists are linked lists"
**Symptom.** Someone argues that `insert(0, x)` should be O(1), or that indexing the
middle of a big list is slow.
**Cause.** Carrying a Lisp or Java `LinkedList` mental model across. The FAQ names
this misconception explicitly — *"not Lisp-style linked lists"*.
**Fix.** There is no code fix; there is a model fix. Insert-at-front is O(n) because
the array is contiguous, and index-anywhere is O(1) for the same reason. If you
genuinely need cheap insertion at the front, that is what `collections.deque` is
for — [03](03-the-o-n-shift.md) shows the switch.

### Treating `l[k]` on a subclass as O(1)
**Symptom.** A profiler shows time inside `__getitem__` for something that "is a
list".
**Cause.** The complexity page says the costs *"assume exact built-in types, as
instances of subclasses may have different costs"*. A subclass overriding
`__getitem__` runs Python on every access.
**Fix.** Check the exact type before you trust the table:

```python
def is_plain_list(x):
    return type(x) is list          # NOT isinstance — a subclass passes that
```

### Reading `x in big_list` inside a loop and blaming the loop
**Symptom.** An import job that was fine on 500 rows takes minutes on 50,000.
**Cause.** `x in l` is O(n), so the loop is O(n·m). The growth is quadratic and only
becomes visible past a size threshold.
**Fix.** Build the membership structure once:

```python
seen = set(existing_ids)                           # O(n) once
new = [r for r in incoming if r.id not in seen]    # O(1) per test
```

### Assuming a list of ints is compact
**Symptom.** A ten-million-element list of small integers uses far more memory than
"eight bytes each".
**Cause.** Each slot is a pointer *to* an int object; the objects are separate heap
allocations with their own headers.
**Fix.** For homogeneous numeric data, use the type designed for it:

```python
from array import array
values = array("q", range(10_000_000))   # 'q' = signed long long, stored raw
```

[12](12-memory-list-tuple-array.md) covers the trade — and why you must not quote a
byte count you did not measure.

### Reasoning about `list` costs on PyPy, MicroPython or Jython
**Symptom.** A carefully tuned "avoid `insert(0, …)`" rewrite makes no difference on
another interpreter, or a JIT flattens the difference entirely.
**Cause.** The complexity page's first sentence scopes itself to CPython:
*"Other Python implementations may have different performance characteristics."*
**Fix.** Keep the algorithmic fix (it is never *worse*), but pin the claim to the
runtime you actually deploy on, and state it that way in review comments:

```python
# CPython 3.14: deque.popleft() is O(1); list.pop(0) is O(n).
# Not asserted for other implementations.
from collections import deque
```

## Interview questions

**★ How is a Python list implemented, and what follows from it?**
As a variable-length array of pointers — the FAQ's words are *"a contiguous array of
references to other objects"* — with the pointer, the length and the capacity kept
in a small header struct. Indexing is therefore O(1) and independent of the index;
`len()` is O(1) because the length is a stored field; appending is amortised O(1)
because spare capacity is bought in advance; and inserting or deleting anywhere but
the end is O(n) because the array is contiguous and the tail has to move.

**★ Why is `len(l)` O(1) when `l.count(x)` is O(n)?**
`len()` reads `ob_size`, a field maintained by every operation that changes the
list. `count` has to compare each element, and the array carries no information
about values — only addresses. The docs say it directly: *"The number of elements is
stored in the object, so `len()` does not need to count them."*

**A list holds one million integers. Are those integers contiguous in memory?**
No. The *pointers* are contiguous; the integer objects are individually allocated
and reached by dereference. That is why iterating a list of numbers is dramatically
less cache-friendly than iterating an `array` or a NumPy array, and why the
"array of structs" reasoning from C does not transfer.

**What is `allocated` in the list header, and when is it not equal to `len`?**
`allocated` is the capacity of the pointer block; `ob_size` (which is `len`) is how
much of it is in use. They differ whenever the list has over-allocated slack —
almost always, after any `append`. The invariant `0 <= ob_size <= allocated` holds
except during `sort`, which deliberately sets `allocated = -1` as a mutation
tripwire.

**Does a list of mixed types cost more than a homogeneous one?**
Not in the list itself — every slot is one pointer regardless. It can cost more at
*sort* time: CPython runs a pre-sort homogeneity check and picks a specialised
comparison routine for an all-`int`, all-`float` or all-latin-1-`str` list, falling
back to the general path for a mixed one. That is an implementation detail with no
documented guarantee, covered in [07](07-timsort.md).

**Why can a comparison function crash the interpreter if `sort` did not defend
against it?**
Because a comparison runs arbitrary Python, which can `append` to the very list
being sorted, which can trigger a resize, which can `realloc` `ob_item` to a
different address — while the sort routine is holding raw pointers into the old
block. CPython's own comment calls unguarded mutation during sorting *"a core-dump
factory, since ob_item may change"*. The defence is to detach the block and make the
list appear empty for the duration.

---

← [Topic index](README.md) · Next → [The complexity table, and what it is scoped to](01b-the-complexity-table.md)
