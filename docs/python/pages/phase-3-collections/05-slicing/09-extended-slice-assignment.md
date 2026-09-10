---
title: "An extended slice names scattered positions, so assigning to one can only overwrite them one-for-one — the right-hand side must have exactly the slice's length — and whether a slice counts as extended is decided at run time by its step, so a computed step of 1 quietly switches the statement back to one that may resize the list"
sidebar_label: "09 · Extended-slice assignment"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 for **Python 3.14.7** against the 3.14 documentation —
> [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types)
> (note 1), [Sequences](https://docs.python.org/3.14/reference/datamodel.html#datamodel-sequences),
> [`slice.indices`](https://docs.python.org/3.14/reference/datamodel.html#slice.indices); CPython
> 3.14 [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_ass_subscript_lock_held`, `adjust_slice_indexes`) and
> [`Objects/bytearrayobject.c`](https://github.com/python/cpython/blob/3.14/Objects/bytearrayobject.c)
> for the mechanism and error text — implementation detail where the docs are silent.
> Documentation-verified — **no sandbox run, no program output**.

**An ordinary slice is one contiguous run, so it can be replaced by a run of any length and the
tail shifts to fit ([08](08-slice-assignment.md)). An extended slice — `a[::2]`, `a[1::3]`,
`a[::-1]` — is a set of *scattered* positions with elements in between that belong to nobody's
assignment. There is no coherent way to put three items into two scattered slots, so the rule is
one-for-one: the right-hand side must have exactly as many items as the slice selects, or the
statement raises `ValueError` and changes nothing. That makes extended assignment the tool for
writing *into* a pattern — every other slot, one column of a flattened grid, the odd positions of an
interleave — and never for changing a list's length. The trap is the boundary: the check is on the
step's *value* at run time, so `a[0:3:1]` is an ordinary slice that may shrink the list, and code
tested with a configured stride of 1 behaves differently the day the stride becomes 2. Deleting
through a slice, extended or not, is [09b](09b-deleting-slices.md).**

## The one-for-one rule

> `s[i:j:k] = t` — *"the elements of `s[i:j:k]` are replaced by those of *t*"* ·
> *"(1) If *k* is not equal to `1`, *t* must have the same length as the slice it is replacing."* —
> [Mutable Sequence Types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types)

CPython's `list_ass_subscript_lock_held` enforces it after converting the right-hand side to a
sequence and computing the slice's length:

- a length mismatch raises `ValueError` from the format `attempt to assign sequence of size %zd to
  extended slice of size %zd` — both numbers are in the message, which is the fastest way to see
  which side is wrong;
- a non-iterable value raises `TypeError: must assign iterable to extended slice`;
- a `bytearray` target words it as `attempt to assign bytes of size %zd to extended slice of size
  %zd` (`Objects/bytearrayobject.c`).

The check happens before any element is written, so a failed extended assignment leaves the list
unchanged. The writes themselves are a straight loop storing each new reference at `start`,
`start + step`, … — no memory moves, since the length does not change.

```python
slots = ["a", "b", "c", "d", "e"]

slots[::2] = ["A", "C", "E"]              # positions 0, 2, 4: three slots, three items
assert slots == ["A", "b", "C", "d", "E"]

slots[::-2] = ["z", "y", "x"]             # positions 4, 2, 0 in that order
assert slots == ["x", "b", "y", "d", "z"]
```

The second assignment shows the order: the items of *t* go to the slice's positions in the order
the slice visits them, so with a negative step the first item lands at the highest index.

## The size is `slice.indices`, not arithmetic

The number of items needed is the slice's length on *this* list, after clamping. Guessing it with
`len(a) // k` is off by one whenever the length is not a multiple of the step. The exact number is
what [04b](04b-slice-indices.md) computes — the length of the equivalent `range`, which is O(1)
and allocates nothing:

```python
from itertools import repeat


def fill(items: list, value, start=None, stop=None, step=None) -> None:
    """Set every position selected by items[start:stop:step] to value."""
    count = len(range(*slice(start, stop, step).indices(len(items))))
    items[start:stop:step] = repeat(value, count)


readings = [5, 6, 7, 8, 9, 10, 11]
fill(readings, 0, step=3)                 # positions 0, 3, 6
assert readings == [0, 6, 7, 0, 9, 10, 0]
assert len(readings) // 3 == 2            # the naive count would have been one short
```

`len(items[start:stop:step])` also gives the right number, at the cost of building the slice just
to measure it.

## Step 1 is decided at run time

The one-for-one rule is keyed on the step's *value*, not on whether a step was written. In
`list_ass_subscript_lock_held`, after the bounds are computed, `if (step == 1)` hands the work to
the ordinary resizing path. So:

- `a[0:3:1] = ["x"]` is an ordinary assignment: three elements replaced by one, list shorter by two;
- `a[::1] = []` empties the list, exactly like `a[:] = []`;
- `a[::-1] = t` **is** extended — a step of −1 is not 1 — so `t` must have `len(a)` items.

The consequence is that a stride coming from configuration or a function argument changes the
contract of the statement it feeds:

```python
def replace_strided(items: list, new_values: list, stride: int) -> None:
    """Overwrite every stride-th element; never change the list's length."""
    positions = range(*slice(None, None, stride).indices(len(items)))
    if len(new_values) != len(positions):
        raise ValueError(f"need {len(positions)} values for stride {stride}, got {len(new_values)}")
    items[::stride] = new_values
```

Without the explicit check, a `stride` of 1 would accept a list of any length and resize `items`,
while every other stride raises — the same call, two behaviours, split on a number.

## What extended assignment is for

Writing into a regular pattern of positions, in place, in one statement.

**Interleaving two sequences:**

```python
evens = [0, 2, 4]
odds = [1, 3, 5]

merged = [None] * (len(evens) + len(odds))
merged[::2] = evens
merged[1::2] = odds
assert merged == [0, 1, 2, 3, 4, 5]
```

**One column of a row-major grid** — element `(row, col)` lives at `row * width + col`, so column
`col` is the extended slice `cells[col::width]`:

```python
width = 3
cells = [0] * 9                          # a 3 x 3 grid, stored row by row

cells[1::width] = [7, 8, 9]              # column 1
assert cells == [0, 7, 0,
                 0, 8, 0,
                 0, 9, 0]
assert cells[width:2 * width] == [0, 8, 0]   # row 1 is an ordinary slice
```

**Swapping neighbours pairwise** — the right-hand side is built before any write, so both slices
are read from the original:

```python
pairs = ["b", "a", "d", "c", "f", "e"]
pairs[::2], pairs[1::2] = pairs[1::2], pairs[::2]
assert pairs == ["a", "b", "c", "d", "e", "f"]
```

The tuple on the right is fully evaluated — two new lists — before either target is assigned, which
is why the swap works.

**Reversing a sub-range in place** does not need an extended slice at all: `a[i:j] = a[i:j][::-1]`
or `a[i:j] = reversed(a[i:j])` is an ordinary same-length assignment, and it avoids the
negative-step stop arithmetic of [02](02-negative-steps.md) that breaks when `i` is 0.

## Gotchas

**★ Symptom: `ValueError: attempt to assign sequence of size 2 to extended slice of size 3`.**
Cause: the replacement was sized with `len(items) // step`, which undercounts whenever the length
is not a multiple of the step. Fix: size it from the slice itself.

```python
count = len(range(*slice(None, None, step).indices(len(items))))
items[::step] = [placeholder] * count
```

**★ Symptom: a job that overwrites every n-th record works in staging and shrinks the table in
production.** Cause: staging ran with a stride of 1, where `items[::stride] = values` is an
ordinary assignment that accepts any length and resizes; production's stride of 2 made it
extended. Fix: enforce the one-for-one contract yourself, as `replace_strided` above does.

```python
if len(values) != len(range(*slice(None, None, stride).indices(len(items)))):
    raise ValueError("replacement length does not match the strided slots")
items[::stride] = values
```

**Symptom: `TypeError: must assign iterable to extended slice` from `mask[::2] = 0`.** Cause: a
slice target needs an iterable, even to write the same value everywhere. Fix: repeat the value the
right number of times.

```python
mask[::2] = repeat(0, len(range(0, len(mask), 2)))
```

**Symptom: `items[::-1] = sorted(items)[:3]` raises `ValueError` instead of "writing the top
three at the end".** Cause: `[::-1]` is an extended slice covering every position, so it needs
`len(items)` values. Fix: name the exact positions — the last three, visited backwards.

```python
items[:-4:-1] = sorted(items)[:3]        # positions len-1, len-2, len-3
```

**Symptom: a grid column write puts values in the wrong cells after the grid was widened.**
Cause: the column slice hard-codes the old width — `cells[1::3]` — so on a width-4 grid it walks a
diagonal. Fix: derive the stride from the grid's width, never a literal.

```python
cells[col::width] = column_values
```

**Symptom: `ValueError: attempt to assign bytes of size 3 to extended slice of size 4` while
masking bytes in a `bytearray`.** Cause: the same one-for-one rule, in `bytearray`'s wording.
Fix: build the replacement bytes at the slice's length.

```python
payload[::2] = bytes(len(payload[::2]))       # zero every other byte
```

## Interview questions

**★ Why must an extended slice assignment have exactly the slice's length, when an ordinary one
need not?**
An ordinary slice is a contiguous run; replacing it with more or fewer items is well defined — the
items go where the run was and the tail shifts. An extended slice selects scattered positions with
unselected elements between them. If the replacement had more items, there would be no position to
put the extras without also moving elements that were not selected; with fewer, some selected
slots would have no value. So the documentation requires *t* to have the same length when the step
is not 1, and CPython raises `ValueError` with both sizes before writing anything.

**★ Is `a[0:3:1] = ["x"]` an extended slice assignment?**
No. CPython decides at run time by the step's value: after unpacking the slice, a step equal to 1
takes the ordinary path, which may resize, so the three elements are replaced by one and the list
shrinks by two. The documentation's rule is worded the same way — the length constraint applies
*"If k is not equal to 1"*. A step of −1, by contrast, is extended, so `a[::-1] = t` requires `t`
to match the list's length. Code whose step is computed gets two different behaviours from one
statement, so it should check the length itself.

**How do you compute how many values an extended slice assignment needs?**
Use the slice's own arithmetic: `len(range(*slice(start, stop, step).indices(len(seq))))`. The
`indices` call applies the same clamping as the assignment, and the length of the resulting range
is O(1) to compute. `len(seq[start:stop:step])` also works but builds the slice to measure it.
`len(seq) // step` is wrong whenever the length is not a multiple of the step.

**How would you interleave two lists of equal length into one?**
Allocate the result at the combined length and assign each input to an extended slice:
`merged[::2] = first` and `merged[1::2] = second`. Each assignment is one-for-one, so the lengths
are checked for you. `[x for pair in zip(first, second) for x in pair]` builds the same list
without the preallocation; the slice version is the natural choice when the target list already
exists and other code holds it.

**In what order are the values written when the step is negative?**
In the order the slice visits positions. For `a[::-2] = t` on a five-element list the positions are
4, 2, 0, so `t[0]` goes to index 4 and `t[-1]` to index 0. It is the same correspondence as reading:
`a[::-2][k]` is the element that `t[k]` replaces.

---

← Prev: [08c · Slice assignment versus rebinding](08c-slice-assignment-versus-rebinding.md) · [Topic index](README.md) · Next →: [09b · Deleting slices](09b-deleting-slices.md)
