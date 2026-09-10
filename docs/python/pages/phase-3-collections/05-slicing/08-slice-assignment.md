---
title: "Assigning to a slice replaces a run of elements with the contents of any iterable, and the two lengths need not match — so one statement can replace, shrink, grow, insert at a position or empty a list in place, at the cost of shifting everything after the slice"
sidebar_label: "08 · Slice assignment"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types),
> [An Informal Introduction: Lists](https://docs.python.org/3.14/tutorial/introduction.html#lists),
> [Emulating container types](https://docs.python.org/3.14/reference/datamodel.html#emulating-container-types),
> [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html);
> CPython 3.14 [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_ass_subscript_lock_held`, `list_ass_slice_lock_held`) and
> [`Python/bytecodes.c`](https://github.com/python/cpython/blob/3.14/Python/bytecodes.c)
> (`_STORE_SLICE`) for the mechanism and error text — implementation
> detail where the docs are silent.
> Documentation-verified — **no sandbox run, no program output**.

**On the right of `=`, a slice copies ([05](05-slices-are-copies.md)). On the left it does the
opposite: it names a run of positions *inside the existing list* and replaces them with whatever
the right-hand iterable produces. The two lengths are independent, so the same statement replaces
(equal lengths), shrinks (fewer), grows (more), inserts (an empty slice — a fence post from
[01](01-the-three-numbers.md)) or empties the list (`a[:] = []`). `insert`, `extend`, `append`
and `clear` are documented as exactly such assignments. The right-hand side is unpacked, not
stored: a string becomes its characters, and a non-iterable is a `TypeError`. The bounds clamp
like any slice, which means an out-of-range assignment appends and a reversed pair inserts instead
of failing. And the price of changing the length is a shift of every element after the slice.**

What the clamped bounds do on the left of `=`, and which types accept a slice target at all, are
[08b](08b-slice-bounds-and-types.md); why `a[:] = …` is not `a = …` is
[08c](08c-slice-assignment-versus-rebinding.md).

## What the documentation defines

> `s[i:j] = t` — *"slice of *s* from *i* to *j* is replaced by the contents of the iterable *t*"* —
> [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types)

> *"Assignment to slices is also possible, and this can even change the size of the list or clear
> it entirely"* — [Lists](https://docs.python.org/3.14/tutorial/introduction.html#lists)

> *"Slicing is handled by `__getitem__`, `__setitem__`, and `__delitem__`. A call like
> `a[1:2] = b` is translated to `a[slice(1, 2, None)] = b` and so forth. Missing slice items are
> always filled in with `None`."* —
> [Emulating container types](https://docs.python.org/3.14/reference/datamodel.html#emulating-container-types)

"The contents of the iterable" is the whole rule. Nothing requires *t* to have `j - i` items; that
constraint exists only for extended slices with a step other than 1, which is
**09 · Extended-slice assignment and `del`** *(not written yet)*.

## Replace, shrink, grow, insert, clear

The tutorial's own sequence, extended with the two cases it does not show:

```python
letters = ["a", "b", "c", "d", "e", "f", "g"]

letters[2:5] = ["C", "D", "E"]          # 3 for 3: replace
assert letters == ["a", "b", "C", "D", "E", "f", "g"]

letters[2:5] = []                       # 3 for 0: shrink
assert letters == ["a", "b", "f", "g"]

letters[1:2] = ["x", "y", "z"]          # 1 for 3: grow
assert letters == ["a", "x", "y", "z", "f", "g"]

letters[1:1] = ["NEW"]                  # 0 for 1: insert before position 1
assert letters == ["a", "NEW", "x", "y", "z", "f", "g"]

letters[:] = []                         # everything for nothing: clear
assert letters == []
```

In CPython, `list_ass_slice_lock_held` computes `d = n - norig` — the new length minus the
replaced length — then `memmove`s the tail left (`d < 0`) or resizes and `memmove`s it right
(`d > 0`) before writing the new references. A replacement that leaves the list empty goes
straight to `list_clear`.

## The empty slice is an insertion point

`a[i:i]` selects nothing — it is the fence post *before* element `i` — so assigning to it inserts
without replacing. The documentation defines four list methods as exactly these assignments:

| Method | Documented as |
|---|---|
| `insert(index, value)` | *"This is equivalent to writing `sequence[index:index] = [value]`."* |
| `append(value)` | *"This is equivalent to writing `seq[len(seq):len(seq)] = [value]`."* |
| `extend(iterable)` | *"For the most part, this is the same as writing `seq[len(seq):len(seq)] = iterable`."* |
| `clear()` | *"This is equivalent to writing `del sequence[:]`."* |

What the slice form adds is **many items at one position in one shift**. `insert` in a loop shifts
the tail once per item; a slice assignment shifts it once:

```python
def insert_all(items: list, index: int, new_items) -> None:
    """Insert every element of new_items before items[index], shifting the tail once."""
    items[index:index] = new_items


rows = ["header", "r3", "r4"]
insert_all(rows, 1, ["r1", "r2"])
assert rows == ["header", "r1", "r2", "r3", "r4"]

rows[:0] = ["# generated"]              # prepend
rows[len(rows):] = ["footer"]           # append — the same position as rows[len(rows):len(rows)]
assert rows[0] == "# generated" and rows[-1] == "footer"
```

## The right-hand side is unpacked, and read first

The target receives *"the contents of the iterable"*, so the iterable is iterated and its items
are inserted — the container itself is never stored. That has three consequences:

- **A string becomes its characters.** `tags[0:1] = "urgent"` puts six one-letter strings in the
  list. A dict contributes its keys, a set its members in the set's arbitrary order.
- **A non-iterable is rejected — with a misleading message.** Since 3.12 the statement compiles to
  `STORE_SLICE`, which builds a `slice` and calls `PyObject_SetItem`, reaching the list's
  `list_ass_subscript_lock_held`. That function converts the value with
  `PySequence_Fast(value, "must assign iterable to extended slice")` for *every* slice target, so
  `a[1:2] = 5` raises `TypeError: must assign iterable to extended slice` although no step was
  written. (The `can only assign an iterable` string in `list_ass_slice_lock_held` belongs to the
  C-API path, `PyList_SetSlice`.) An index target (`a[1] = 5`) stores one object; a slice target
  never does.
- **The iterable is fully read before the list changes.** `PySequence_Fast` returns a list or
  tuple unchanged and materialises anything else into a new list, *before* any element moves. So a
  generator that reads the list being assigned sees the original contents. And when the value *is*
  the list itself, `list_ass_subscript_lock_held` copies it first (its comment: *"protect against
  a[::-1] = a"*). Both are CPython implementation details — the documentation does not promise
  when *t* is consumed.

```python
readings = [3, -1, 4, -1, 5]
readings[:] = (value for value in readings if value >= 0)   # reads the unmodified list
assert readings == [3, 4, 5]

mirror = [1, 2, 3]
mirror[len(mirror):] = mirror                                 # a[i:j] = a: copied first
assert mirror == [1, 2, 3, 1, 2, 3]
```

## What it costs

> Set slice `l[i:j] = t` [1]: *"O(j - i) if len(t) == j - i, otherwise O(n - i + len(t))"* ·
> [1] *"Amortized. An individual operation may occasionally be O(n) when the underlying storage is
> resized, but this cost is spread over many operations, depending on the history of the
> container."* — [Time complexity](https://docs.python.org/3.14/library/time-complexity.html)

A same-length replacement touches only the slice. Any change in length moves the whole tail after
*i*, so the position matters more than the size: growing a slice near the end of a million-element
list is cheap, growing one at the front moves a million references. `items[:0] = [x]` in a loop is
therefore quadratic in the same way as `insert(0, x)` — the shift mechanics are in
[The O(n) shift](../01-list-internals/03-the-o-n-shift.md).

## Gotchas

**★ Symptom: a list of tags becomes `['u', 'r', 'g', 'e', 'n', 't']`.** Cause: `tags[0:1] =
"urgent"` — a slice target takes the *contents* of the iterable, and a string's contents are its
characters. Fix: wrap a single value in a list.

```python
tags[0:1] = ["urgent"]
```

**★ Symptom: `TypeError: must assign iterable to extended slice` from a line that "replaces one
element" and has no step in it.** Cause: `items[i:i + 1] = value` with a non-iterable value; CPython
3.14 reports every non-iterable slice value with the extended-slice wording. Fix: assign by index,
or wrap it.

```python
items[i] = value            # replace one element with one object
items[i:i + 1] = [value]    # the same, written as a slice
```

**Symptom: a nested list appears where a flat splice was expected — `[1, [8, 9], 3]`.** Cause:
`items[1] = [8, 9]` stores one object (the list) at an index; only a slice target unpacks. Fix:
use a slice to splice.

```python
items[1:2] = [8, 9]         # [1, 8, 9, 3]
```

**Symptom: an ingest job that prepends each new batch slows down as the list grows.** Cause:
`log[:0] = batch` shifts every existing element on every call. Fix: append and reverse at read
time, or use a `deque` whose `extendleft` does not shift.

```python
from collections import deque

log = deque()
log.extendleft(reversed(batch))     # extendleft reverses, so reverse first to keep batch order
```

## Interview questions

**★ How can assigning to a slice change the length of a list?**
Because the rule is "replace the elements in this range with the contents of that iterable", and
nothing ties the two lengths together. Replacing three elements with one shrinks the list by two;
replacing one with three grows it by two; replacing an empty slice `a[i:i]` inserts; replacing
`a[:]` with `[]` empties it. CPython computes the difference, shifts the tail with `memmove` and
resizes. Only an extended slice — a step other than 1 — requires equal lengths.

**★ What does `a[2:2] = [x, y]` do, and how does it relate to `insert`?**
It inserts `x` and `y` before the element at index 2 and replaces nothing, because `a[2:2]` is the
empty slice at that fence post. The documentation defines `a.insert(i, v)` as exactly
`a[i:i] = [v]`, and `append` and `extend` as assignments to `a[len(a):len(a)]`. The slice form is
how you insert many items at one position with a single shift of the tail, instead of one shift per
`insert` call.

**What happens with `a[1:3] = "hi"`, `a[1:3] = 5` and `a[1] = [8, 9]`?**
`"hi"` is an iterable of two characters, so elements 1 and 2 are replaced by `"h"` and `"i"`. `5` is
not iterable, so CPython raises `TypeError` — worded `must assign iterable to extended slice`, even
though the slice has no step, because every slice store goes through the same subscript-assignment
function. `a[1] = [8, 9]` is an
index assignment, which stores one object — the list — as element 1, producing a nested list. Only
a slice target unpacks its right-hand side.

**Is `a[:] = (x for x in a if keep(x))` safe, given that the generator reads the list it is
assigning to?**
In CPython, yes: slice assignment first converts the right-hand side with `PySequence_Fast`, which
materialises a generator into a temporary list before any element of `a` moves, so the generator
reads the original contents. The documentation does not state when the iterable is consumed, so the
explicit `a[:] = [x for x in a if keep(x)]` says the same thing without relying on it — and costs
the same, since a temporary list is built either way.

**What does a slice assignment cost?**
The 3.14 cost table: O(j − i) when the replacement has the same length, otherwise
O(n − i + len(t)), amortized. Same-length replacement only writes the slice. A length change must
move everything after position *i*, so the cost depends mostly on how far from the end the slice
starts: a splice at the front of a large list moves the entire list.

---

← Prev: [07d · islice lifetimes](07d-islice-lifetimes.md) · [Topic index](README.md) · Next →: [08b · Slice bounds and target types](08b-slice-bounds-and-types.md)
