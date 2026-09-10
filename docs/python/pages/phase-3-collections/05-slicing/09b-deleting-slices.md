---
title: "del on a slice removes the run or the pattern it names in one pass — no length rule even for an extended slice, never an IndexError for a bad range — and a comma-separated del runs left to right against a list that is already shrinking"
sidebar_label: "09b · Deleting slices"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [The `del` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-del-statement),
> [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types),
> [Data Structures: the `del` statement](https://docs.python.org/3.14/tutorial/datastructures.html#the-del-statement);
> CPython 3.14 [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_ass_subscript_lock_held`) for the mechanism and error text — implementation detail.
> Documentation-verified — **no sandbox run, no program output**.

**`del a[i:j]` is the documented twin of `a[i:j] = []`, and `del a[::2]` goes one step further:
it removes a scattered pattern of elements, which *no* assignment can do, because an empty list
never has the length an extended slice demands. Deletion has no length to match, so it has no
length rule, and it inherits the clamping of every slice — deleting past the end or with a
reversed pair is silently a no-op, never an `IndexError`. Three things catch people. `del a[0],
a[1]` deletes left to right, so the second index is taken from a list that has already shrunk. A
list pays a shift of every later element for each deletion, so draining one from the front is
quadratic — while a `bytearray` only advances its start and pays amortized O(1), which makes it
the right receive buffer. And `del a` is not `del a[:]`: one forgets a name, the other empties an
object that other names still hold. Extended *assignment* is [09](09-extended-slice-assignment.md);
the cost, the `bytearray` exception, `del a` and the types that refuse deletion are
[09c](09c-deletion-cost-and-types.md).**

## What `del` does to a slicing

> *"Deletion of attribute references and subscriptions is passed to the primary object involved;
> deletion of a slicing is in general equivalent to assignment of an empty slice of the right type
> (but even this is determined by the sliced object)."* —
> [The `del` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-del-statement)

The mutable-sequence table spells out both forms: `del s[i:j]` *"removes the elements of `s[i:j]`
from the list (same as `s[i:j] = []`)"*, and `del s[i:j:k]` *"removes the elements of `s[i:j:k]`
from the list"* — note that the second row, unlike the first, claims no equivalence. The tutorial:
*"The `del` statement can also be used to remove slices from a list or clear the entire list
(which we did earlier by assignment of an empty list to the slice)."*

```python
a = [-1, 1, 66.25, 333, 333, 1234.5]    # the tutorial's list
del a[0]
del a[2:4]
assert a == [1, 66.25, 1234.5]
del a[:]
assert a == []
```

## Ordinary slices: clamped, silent, shifted

A deleted slice goes through the same clamping as a read ([03](03-out-of-range-never-raises.md)),
so `del` through a slice never raises for a bad range — it deletes whatever part of the range
exists, which may be nothing:

- `del a[10:20]` on a five-element list deletes nothing;
- `del a[3:1]` — a reversed pair — deletes nothing;
- `del a[-n:]` with `n == 0` is `del a[0:]`, and deletes **everything** — the `-0` trap of
  [01](01-the-three-numbers.md), destructively.

`del a[i]` is the contrast: an index outside the list raises `IndexError` with the message
`list assignment index out of range`. Use the index form when a missing element is a bug, and the
slice form when "delete it if it is there" is what you mean.

## Extended slices: no length rule, one pass

`del a[::2]` removes every other element — something `a[::2] = []` cannot do, because an empty
list has length 0 and the extended slice has length `ceil(len(a) / 2)`, so the assignment raises
`ValueError`. That is the reference's *"in general"* and *"determined by the sliced object"*: for
extended slices, deletion is its own operation.

```python
samples = [10, 11, 12, 13, 14, 15, 16]
del samples[1::2]                        # drop the odd positions
assert samples == [10, 12, 14, 16]

samples = [10, 11, 12, 13, 14, 15, 16]
del samples[::-3]                        # positions 6, 3, 0 — the sign of the step does not matter
assert samples == [11, 12, 14, 15]
```

CPython does not delete the selected elements one at a time. `list_ass_subscript_lock_held`
normalises a negative step to the equivalent positive one, then walks the list once, `memmove`-ing
each run of *kept* elements left over the gaps, and resizes at the end. So `del a[::2]` costs one
pass over the list, not one shift per deleted element.

## Left to right: a comma-separated `del` hits a moving list

> *"Deletion of a target list recursively deletes each target, from left to right."*

Each target is deleted before the next one is *evaluated* against the list, so every deletion
renumbers everything after it:

```python
columns = ["id", "name", "email", "phone", "notes"]
del columns[1], columns[2]               # deletes "name", then index 2 of the shorter list: "phone"
assert columns == ["id", "email", "notes"]
```

To delete several arbitrary positions, delete from the highest index down — earlier positions
are unaffected by a later deletion — or rebuild the list once:

```python
def delete_positions(items: list, positions) -> None:
    """Remove the elements at the given positions of the list as it was before the call."""
    drop = set(positions)
    items[:] = [item for index, item in enumerate(items) if index not in drop]


columns = ["id", "name", "email", "phone", "notes"]
delete_positions(columns, [1, 3])
assert columns == ["id", "email", "notes"]

columns = ["id", "name", "email", "phone", "notes"]
for index in sorted({1, 3}, reverse=True):    # the alternative: highest first
    del columns[index]
assert columns == ["id", "email", "notes"]
```

The rebuild is one O(n) pass however many positions are dropped; the descending loop shifts the
tail once per deletion, which is fine for a handful and quadratic for thousands.

## Gotchas

**★ Symptom: `del columns[1], columns[2]` removes "name" and "phone" instead of "name" and
"email".** Cause: targets are deleted left to right, and the second index is evaluated against the
list after the first deletion. Fix: delete highest-first, or as one slice when the positions are
contiguous.

```python
del columns[1:3]                        # "name" and "email", in one deletion
```

**★ Symptom: a loop that deletes the positions in `bad_rows` removes the wrong rows and then
raises `IndexError: list assignment index out of range`.** Cause: ascending deletion shifts every
later row left, so each stored position is stale after the first `del`. Fix: iterate the positions
in descending order — or rebuild the list once.

```python
for position in sorted(bad_rows, reverse=True):
    del rows[position]
```

**★ Symptom: `ValueError: attempt to assign sequence of size 0 to extended slice of size 4` from
`readings[::2] = []`.** Cause: an empty-list assignment is only a deletion for ordinary slices; an
extended slice needs a one-for-one replacement. Fix: say what you mean.

```python
del readings[::2]
```

**Symptom: "trim the last n audit rows" deletes the entire audit table when n is 0.** Cause:
`del rows[-n:]` with `n == 0` is `del rows[0:]`. Fix: compute the start from the length.

```python
del rows[max(len(rows) - n, 0):]
```

**Symptom: a "delete lines start to end" command does nothing when the user selected upwards.**
Cause: `del lines[5:2]` is an empty slice; deletion through a slice never complains. Fix: normalise
the range.

```python
start, end = sorted((anchor, cursor))
del lines[start:end]
```

## Interview questions

**★ Why does `del a[::2]` work when `a[::2] = []` raises `ValueError`?**
Assignment to an extended slice must be one-for-one, and `[]` has length 0 while the slice selects
about half the list. Deletion has no right-hand side to match, so it simply removes the selected
positions. The language reference hedges exactly here: deleting a slicing is *"in general
equivalent to assignment of an empty slice"*, *"but even this is determined by the sliced object"*.
For extended slices on a list, deletion is its own operation, done in a single compacting pass.

**★ What does `del a[0], a[1]` delete?**
The original elements at positions 0 and 2. The reference says a target list is deleted left to
right, and each target is evaluated when its turn comes, so `a[1]` is looked up after `a[0]` has
already been removed and everything has shifted left. To remove several positions, delete from the
highest down, delete one contiguous slice, or rebuild the list.

**How do you delete many arbitrary positions from a large list efficiently?**
Rebuild it once: collect the positions in a set and assign `items[:] = [x for i, x in
enumerate(items) if i not in drop]` — one O(n) pass however many positions go. Deleting them one
by one in descending order is correct but shifts the tail per deletion, which is quadratic when the
number of positions grows with the list. If the positions form a regular pattern, `del
items[start::step]` is a single pass too.

**Does `del a[10:20]` raise on a five-element list?**
No. Slice bounds are clamped, so the range becomes empty and nothing is deleted. The index form
`del a[10]` raises `IndexError`. Choose deliberately: the slice form for "remove whatever of this
range exists", the index form when a missing element means something is wrong.

---

← Prev: [09 · Extended-slice assignment](09-extended-slice-assignment.md) · [Topic index](README.md) · Next →: [09c · Deletion cost and types](09c-deletion-cost-and-types.md)
