---
title: "While a list is being sorted it appears empty, mutating it raises `ValueError: list modified during sort`, and a comparison that throws leaves the list in a partially modified state"
sidebar_label: "06b · During the sort"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against
> [`list.sort`](https://docs.python.org/3.14/library/stdtypes.html#list.sort)
> (including its *CPython implementation detail* note),
> [Thread Safety Guarantees — list objects](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-list-objects),
> the [Sorting HOWTO — Partial Sorts](https://docs.python.org/3.14/howto/sorting.html#partial-sorts),
> and CPython's
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_sort_impl`) and
> [`Include/cpython/listobject.h`](https://github.com/python/cpython/blob/3.14/Include/cpython/listobject.h).
> Documentation-validated; **no sandbox run; the error string is quoted from the
> CPython source**. Target: **CPython 3.14** (3.14.7).

**A sort is not an atomic step you can ignore the inside of. Comparisons call your
`__lt__`, and your `__lt__` can look at the list, mutate it, raise, or block. CPython
answers all four cases explicitly: for the duration of the sort the list is made to
look *empty*, any mutation it can detect raises `ValueError: list modified during
sort`, and an exception from a comparison aborts the sort with the list left as some
permutation of its input. This chunk is what the documentation means by "the effect
of attempting to mutate, or even inspect, the list is undefined".**

## The documented rule

> *"**CPython implementation detail:** While a list is being sorted, the effect of
> attempting to mutate, or even inspect, the list is undefined. The C implementation
> of Python makes the list appear empty for the duration, and raises `ValueError` if
> it can detect that the list has been mutated during a sort."*

Note the two halves. *"Undefined"* is the language-level statement — no
implementation owes you anything here. *"Makes the list appear empty"* is what
CPython specifically does, and it is observable.

## How CPython does it

```c
    /* The list is temporarily made empty, so that mutations performed
     * by comparison functions can't affect the slice of memory we're
     * sorting (allowing mutations during sorting is a core-dump
     * factory, since ob_item may change).
     */
    saved_ob_size = Py_SIZE(self);
    saved_ob_item = self->ob_item;
    saved_allocated = self->allocated;
    Py_SET_SIZE(self, 0);
    FT_ATOMIC_STORE_PTR_RELEASE(self->ob_item, NULL);
    self->allocated = -1; /* any operation will reset it to >= 0 */
```

The element block is detached and the list object left looking like `[]`. That is why
a `__lt__` that inspects the list sees nothing, and why the header comments that
*"list.sort() temporarily sets allocated to -1 to detect mutations."*

At the end, the tripwire is checked:

```c
    if (self->allocated != -1 && result != NULL) {
        /* The user mucked with the list during the sort,
         * and we don't already have another error to report.
         */
        PyErr_SetString(PyExc_ValueError, "list modified during sort");
```

Any list operation that resizes resets `allocated` to a non-negative value, so
CPython can tell afterwards that something touched it. `list modified during sort` is
the literal C string, quoted from the source.

🔴 It is detected **after the fact**, not prevented. A comparison that appends will
run to completion; the exception arrives at the end. And an operation that does not
resize may not be detected at all — which is exactly why the docs say *undefined*
rather than *raises*.

```python
class Sneaky:
    def __init__(self, v, target):
        self.v = v
        self.target = target

    def __lt__(self, other):
        self.target.append(object())   # resizes the list being sorted
        return self.v < other.v

# rows.sort() here will end with ValueError: list modified during sort
```

## An exception from a comparison leaves the list scrambled

> *"This method sorts the list in place, using only `<` comparisons between items.
> Exceptions are not suppressed - if any comparison operations fail, the entire sort
> operation will fail (and the list will likely be left in a partially modified
> state)."*

The C header comment states the guarantee you *do* get:

```c
/* An adaptive, stable, natural mergesort.  See listsort.txt.
 * Returns Py_None on success, NULL on error.  Even in case of error, the
 * list will be some permutation of its input state (nothing is lost or
 * duplicated).
 */
```

So the contract on failure is: **no element is lost, none is duplicated, the order is
arbitrary.** That is enough to retry, and not enough to trust the order.

The common cause is a heterogeneous list, where the docs on Python 3's comparison
rules apply — *"sorting a heterogeneous list no longer makes sense – all the elements
must be comparable to each other"*:

```python
rows.sort(key=lambda r: r.priority)   # TypeError if any priority is None
```

If a partially-sorted list is not acceptable, sort a copy and swap on success:

```python
ordered = sorted(rows, key=lambda r: r.priority)   # raises before rows changes
rows[:] = ordered                                   # only reached on success
```

## Under free threading

The 3.14 thread-safety page is explicit about `sort`:

> *"The `sort()` method is not atomic. Other threads cannot observe intermediate
> states during sorting, but the list appears empty for the duration of the sort."*

So a concurrent reader does not see a half-sorted list — it sees an *empty* one. That
is a different and arguably worse failure for code that assumed a snapshot, and it is
why the page ends with *"Consider external synchronization when sharing list
instances across threads."*

## Gotchas

### `ValueError: list modified during sort`
**Symptom.** A sort raises at the very end, with no obvious mutation in the calling
code.
**Cause.** A comparison — `__lt__`, or a `key` function — resized the list being
sorted. CPython detects it after the fact via the `allocated = -1` tripwire.
**Fix.** Make the comparison pure. If a key function genuinely needs to record
something, record it elsewhere:

```python
seen = []                              # a DIFFERENT list
rows.sort(key=lambda r: (seen.append(r.id), r.score)[1])
```

Better still, precompute:

```python
scored = [(score(r), r) for r in rows]  # any side effects happen here
scored.sort(key=lambda pair: pair[0])
rows[:] = [r for _, r in scored]
```

### A `__lt__` that reads the list it is sorting
**Symptom.** A comparison that consults "the current position of this item" always
sees an empty list.
**Cause.** CPython detaches the element block for the duration: *"The C
implementation of Python makes the list appear empty."*
**Fix.** Pass the information in rather than reading it back out:

```python
positions = {id(r): i for i, r in enumerate(rows)}   # captured BEFORE the sort
rows.sort(key=lambda r: (r.score, positions[id(r)]))
```

### A half-sorted list after a `TypeError`
**Symptom.** A sort raises, and the list is neither in its original order nor sorted.
**Cause.** The documented behaviour: *"the list will likely be left in a partially
modified state"*. The only guarantee is that it is a permutation of the input.
**Fix.** Sort into a new list and assign only on success:

```python
try:
    ordered = sorted(rows, key=score)
except TypeError:
    ordered = None
if ordered is not None:
    rows[:] = ordered
```

### `None` in the data, discovered at sort time
**Symptom.** `TypeError: '<' not supported between instances of 'NoneType' and 'int'`.
**Cause.** `None` is not comparable to other types — the Sorting HOWTO says so
directly: *"This is needed because None is not comparable to other types."*
**Fix.** Decide where `None` sorts, and encode that in the key:

```python
rows.sort(key=lambda r: (r.priority is None, r.priority or 0))
```

The leading boolean pushes the `None`s to the end (`False < True`) without ever
comparing a `None` to a number.

### Sorting a list that another thread is reading
**Symptom.** A reader intermittently sees an empty list, not a stale one.
**Cause.** The sort detaches the element block, so under free threading *"the list
appears empty for the duration of the sort"*.
**Fix.** Sort a copy and publish atomically, or hold a lock:

```python
ordered = sorted(shared)     # work on a snapshot
shared[:] = ordered          # one slice assignment; still not atomic — lock if it matters
```

### Assuming a failed sort can be undone
**Symptom.** A retry after a comparison error produces a different order than the
original data would have.
**Cause.** There is no rollback. The C comment promises only that *"the list will be
some permutation of its input state (nothing is lost or duplicated)."*
**Fix.** Keep the original if you need it:

```python
original = rows[:]      # snapshot before any risky sort
```

## Interview questions

**★ What does `ValueError: list modified during sort` mean, and how do you get it?**
It means a comparison performed during the sort mutated the list being sorted.
CPython detaches the element block and sets `allocated = -1` before sorting; any list
operation that resizes resets it, and at the end CPython notices and raises. The
cause is almost always a `__lt__` or a `key` function with a side effect. Note it is
detected *after* the sort, not prevented — mutation during a sort is documented as
*undefined*, and this is a best-effort tripwire.

**★ Why does a list appear empty to code running inside a comparison?**
Because CPython deliberately makes it so. Its comment says *"The list is temporarily
made empty, so that mutations performed by comparison functions can't affect the
slice of memory we're sorting (allowing mutations during sorting is a core-dump
factory, since ob_item may change)."* The sort holds raw pointers into the element
block; if user code could trigger a resize, those pointers could be freed underneath
it.

**A sort raises `TypeError` halfway through. What state is the list in?**
Some arbitrary permutation of the original — the docs say it *"will likely be left in
a partially modified state"*, and the C comment adds the only guarantee: *"nothing is
lost or duplicated"*. You can safely retry, and you cannot rely on the order for
anything. If the original order matters, sort into a new list with `sorted()` and
assign back only after success.

**How do you sort records where a field may be `None`?**
Put the nullability into the key rather than into the comparison, e.g.
`key=lambda r: (r.value is None, r.value or 0)`. Booleans order `False < True`, so
missing values land last, and no `None` is ever compared to a number. The Sorting
HOWTO's own advice is to strip them (`sorted(x for x in data if x is not None)`) when
they should not appear at all.

**Is `list.sort()` thread-safe?**
It will not corrupt the list, but the 3.14 thread-safety page states plainly that
*"The `sort()` method is not atomic"*, and adds the observable consequence: other
threads cannot see intermediate orderings, but they *can* see the list as empty for
the duration. That is a nastier failure than a stale read, because the reader gets a
plausible, wrong answer. The page's own recommendation is external synchronisation.

**How would you sort safely when the comparison logic is expensive or side-effecting?**
Precompute. Build a list of `(key, item)` pairs first — all side effects happen
there, in ordinary Python you can debug — then sort on the key, then rebuild. That is
the Decorate-Sort-Undecorate idiom, and it also removes any chance of a comparison
touching the list mid-sort.

---

← [`sorted` versus `.sort()`](06-sorted-versus-sort.md) · [Topic index](README.md) · Next → [Timsort](07-timsort.md)
