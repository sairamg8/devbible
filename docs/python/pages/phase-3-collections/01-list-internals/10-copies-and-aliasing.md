---
title: "Assignment never copies a list, and every way of copying one — slice, `list()`, `.copy()`, `copy.copy`, unpacking — copies only the pointer block, so the elements stay shared; the spellings differ only in what they do to subclasses and how they read"
sidebar_label: "10 · Copies and aliasing"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against [`copy` — Shallow and deep copy operations](https://docs.python.org/3.14/library/copy.html),
> [`list` and mutable sequence types](https://docs.python.org/3.14/library/stdtypes.html#mutable-sequence-types),
> [Time complexity — `list`](https://docs.python.org/3.14/library/time-complexity.html#list),
> [Thread Safety Guarantees — list objects](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-list-objects),
> and CPython's [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_slice_lock_held`, `list_copy_impl`, `list_new_prealloc`). Documentation-validated;
> **no sandbox run**. Target: **CPython 3.14** (3.14.7).

**A list is a block of pointers ([01](01-the-dynamic-array.md)), and that fixes what
"copy" can mean. Assignment copies nothing: it binds a second name to the same list.
A shallow copy allocates a *new* pointer block and fills it with the *same* pointers —
so appending to the copy never touches the original, but mutating an element through
either list is visible through both. All five spellings of a list copy do exactly
that, in O(n), and differ only at the edges: `copy.copy` keeps a subclass's type where
the others hand back a plain `list`, and under free threading only `.copy()` is listed
as appearing atomic. Phase 1 covers aliasing and `deepcopy` in general; this chunk is
what they mean for lists specifically.**

## Assignment binds

> *"Assignment statements in Python do not copy objects, they create bindings between
> a target and an object. For collections that are mutable or contain mutable items, a
> copy is sometimes needed so one can change one copy without changing the other."*

```python
defaults = ["--verbose"]
flags = defaults              # two names, ONE list
flags.append("--dry-run")     # defaults now has it too
flags is defaults             # True
```

Phase 1's [Aliasing](../../phase-1-language-core/07-assignment-and-aliasing/03-aliasing.md)
has the general model. For lists the consequence is that every function that receives
a list receives *the caller's* list — which is why the mutate-versus-rebind question
from [02b](02b-shrinking-and-preallocation.md) and [04](04-adding-and-combining.md)
keeps coming back.

## The five shallow copies

```python
a = rows[:]            # slice of the whole list
b = list(rows)         # constructor
c = rows.copy()        # method
d = copy.copy(rows)    # copy module
e = [*rows]            # unpacking display
```

The documentation ties the first three together:

> *"`sequence.copy()` — Create a shallow copy of sequence. This is equivalent to
> writing `sequence[:]`."*

> *"The constructor builds a list whose items are the same and in the same order as
> iterable's items. … If iterable is already a list, a copy is made and returned,
> similar to `iterable[:]`."*

What they do is visible in `list_slice_lock_held`, which `list.copy()` calls for the
whole range:

```c
    np = (PyListObject *) list_new_prealloc(len);
    ...
    for (i = 0; i < len; i++) {
        PyObject *v = src[i];
        dest[i] = Py_NewRef(v);
    }
```

A new block sized for exactly `len` pointers (`list_new_prealloc` sets `allocated =
size`), each pointer copied, each element's reference count incremented. No element is
copied. The complexity table lists *Copy* as O(n) — n pointer stores and n reference
count increments.

### Where the spellings differ

**Subclasses.** From the `copy` docs:

> *"Shallow copies of many collections can be made using the corresponding copy()
> method (such as list.copy(), dict.copy() or set.copy()), and of sequences (such as
> lists or bytearrays) by making a slice of the entire sequence (sequence[:]).
> However, these methods and slicing can create an instance of the base type when
> copying an instance of a subclass, whereas copy.copy() normally returns an instance
> of the same type."*

```python
class History(list):
    def latest(self):
        return self[-1]

h = History([1, 2, 3])
type(h[:])           # list — .latest() is gone
type(h.copy())       # list
type(copy.copy(h))   # History
```

**Threads.** Under the free-threaded build, the thread-safety page lists `lst.copy()`
among operations that *"return new objects and appear atomic to other threads"*. A
full slice and `list(lst)` are not in that list. For a snapshot of a list another
thread is mutating, `.copy()` is the documented spelling —
[11c](11c-thread-safety-under-free-threading.md) has the whole table.

**Input.** `list(x)` and `[*x]` accept any iterable; `x[:]` and `x.copy()` require a
sequence that supports them. `list(some_tuple)` is a conversion; `some_list[:]` is a
copy.

## Shallow means one level

```python
grid = [[0, 0], [0, 0]]
snapshot = grid.copy()

snapshot.append([9, 9])     # grid unaffected: different outer blocks
snapshot[0][0] = 1          # grid[0][0] is now 1: same inner list
```

The copy has its own outer pointer block; `grid[0]` and `snapshot[0]` are the same
inner list object. For a list of lists — a grid, a matrix, rows of cells — copy one
level deeper yourself:

```python
snapshot = [row[:] for row in grid]     # new outer block AND new inner blocks
```

That is cheaper and more explicit than `copy.deepcopy`, which the docs describe as
constructing *"a new compound object and then, recursively, inserts copies into it of
the objects found in the original"*, and whose documented problems include that
*"Because deep copy copies everything it may copy too much, such as data which is
intended to be shared between copies."* Phase 1's
[`deepcopy`](../../phase-1-language-core/07-assignment-and-aliasing/08b-deepcopy.md)
chunk owns the full story, and this phase's topic 08, **`copy` vs `deepcopy`**
*(not written yet)*, will too.

## The copy you can skip: tuples

`tuple` on the same complexity page: *"making a copy simply returns the same object,
so is constant time (O(1))."* And the constructor: *"If iterable is already a tuple,
it is returned unchanged."* Immutability is what makes that safe — nobody can mutate
the shared object — so when a function needs to hand out a list's contents without
letting callers change it, returning a tuple is one O(n) conversion, and every
further "copy" of that tuple is free.

```python
class Cart:
    def __init__(self):
        self._items = []

    @property
    def items(self):
        return tuple(self._items)      # callers cannot append to our state
```

## Gotchas

**★ Symptom: appending to a "new" list also changes the old one.** Cause: `b = a` made
an alias, not a copy. Fix: copy explicitly when you intend independence:

```python
working = list(defaults)
working.append("--dry-run")
```

**★ Symptom: a copied list of dicts still changes when the original's dicts are
edited.** Cause: a shallow copy shares the elements; only the pointer block is new.
Fix: copy the level you are going to mutate:

```python
fixture = [dict(row) for row in base_rows]   # new list AND new dicts
```

**Symptom: after `.copy()` or a slice, a custom list subclass's methods raise
`AttributeError`.** Cause: slicing and `.copy()` *"can create an instance of the base
type"*. Fix: use `copy.copy`, or construct the subclass explicitly:

```python
import copy
h2 = copy.copy(history)          # History, not list
h3 = History(history)            # explicit
```

**Symptom: a caller mutates an object's internal state through a list the object
returned.** Cause: the getter returned `self._items` itself. Fix: return an immutable
snapshot or a copy:

```python
def items(self):
    return tuple(self._items)
```

**Symptom: a helper that "resets" a list inside a function leaves the caller's list
unchanged.** Cause: `xs = xs[:]` or `xs = []` rebinds the local name; the caller's
object is untouched. Fix: mutate in place when the caller's list is the target:

```python
def reset(xs):
    xs[:] = []            # or xs.clear()
```

**Symptom: a grid initialised by copying one row changes every row at once.** Cause:
`[row] * n` or `[row.copy()] * n` still repeats one reference n times — the `copy()`
runs once. Fix: build each row inside the comprehension:

```python
grid = [[0] * width for _ in range(height)]
```

**Symptom: `dict.fromkeys(users, [])` gives every user the same list.** Cause: the
value is one list object stored under every key — the same repetition trap as
`[[]] * n`. Fix: create a list per key:

```python
inbox = {u: [] for u in users}
```

**Symptom: a loop that copies a large list "to be safe" dominates a profile.** Cause:
every copy is O(n) pointer stores and reference-count increments. Fix: copy once
outside the loop, or iterate without copying when nothing mutates the list:

```python
snapshot = pending.copy()
for batch in batches:
    process(batch, snapshot)
```

**Symptom: a default argument list accumulates values across calls.** Cause: the
default `[]` is created once, at `def` time, and every call without the argument
shares it. Phase 2's
[mutable default trap](../../phase-2-functions/02-parameters-in-full/01-default-values-and-the-mutable-trap.md)
has the mechanism. Fix:

```python
def collect(item, into=None):
    if into is None:
        into = []
    into.append(item)
    return into
```

## Interview questions

**★ Assignment, shallow copy, deep copy — what does each do to a list of lists?**
Assignment binds another name to the same outer list; nothing is duplicated. A shallow
copy — slice, `list()`, `.copy()`, `copy.copy`, `[*x]` — creates a new outer pointer
block holding the same inner lists, so appending to the copy is independent but
mutating `copy[0]` mutates `original[0]`. `copy.deepcopy` recursively copies the inner
lists too, tracking already-copied objects in a memo so shared and cyclic structure is
preserved. For a plain grid, `[row[:] for row in grid]` is the explicit middle ground.

**★ `xs[:]`, `list(xs)`, `xs.copy()`, `copy.copy(xs)` — are they the same?**
For a plain list they produce equal, independent shallow copies in O(n). They differ at
the edges: `copy.copy` preserves a subclass's type, while slicing and `.copy()` *"can
create an instance of the base type"*; `list()` accepts any iterable; and under free
threading `lst.copy()` is the one the thread-safety page lists as appearing atomic.
`xs.copy()` is the clearest to read.

**What does copying a list actually cost?**
One allocation of a pointer block sized for exactly `len` elements, n pointer stores,
and n reference-count increments — O(n) in the length, independent of how large the
elements are. That is why copying a list of large objects is cheap in memory relative
to the objects, and why it provides no protection for them.

**Why can `tuple(t)` return the same object when `list(l)` must copy?**
Because a tuple cannot change, sharing it is indistinguishable from copying it; the
docs make `tuple(t)` on a tuple O(1) and return it unchanged. A list can be mutated, so
`list(l)` must produce a distinct object or a later mutation would be visible through
both names.

**What is the difference between `xs[:] = ys` and `xs = ys[:]`?**
The first mutates the list `xs` refers to, replacing its contents with ys's elements —
every other name for that list sees the change. The second builds a new list from ys
and rebinds the local name `xs` to it — nothing else changes. Inside a function, only
the first affects the caller.

**An object exposes a list attribute. How do you stop callers mutating your state?**
Keep the list private and expose a tuple (or an iterator) built from it. A copy works
too but invites callers to think mutation will persist; a tuple makes the contract
obvious. Either costs O(n) per access, so for large collections expose query methods
instead of the collection.

---

← [Unorderable values](09d-unorderable-values.md) · [Topic index](README.md) · Next → [Mutating while iterating](11-mutating-while-iterating.md)
