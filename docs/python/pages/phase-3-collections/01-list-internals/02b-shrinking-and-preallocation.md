---
title: "A list gives memory back late and grudgingly, and CPython skips growth altogether in two places — both of which you can steer from Python"
sidebar_label: "02b · Shrinking and preallocation"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against CPython
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list_resize`, `list_preallocate_exact`, `list_extend_iter_lock_held`), the
> Library Reference
> [`sys.getsizeof`](https://docs.python.org/3.14/library/sys.html#sys.getsizeof),
> [`operator.length_hint`](https://docs.python.org/3.14/library/operator.html#operator.length_hint),
> and [Time complexity of operations on built-in types](https://docs.python.org/3.14/library/time-complexity.html#list).
> Documentation-validated; **no sandbox run, no measured byte counts**.
> Target: **CPython 3.14** (3.14.7).

**Growth is only half of `list_resize`. The same function decides when a shrinking
list is worth reallocating, and the answer is "not until it has fallen below half
its capacity" — which is why draining a huge list element by element does not hand
the memory back. Meanwhile CPython avoids the growth curve entirely in two places:
building a list from something whose length is known, and `extend`, which asks the
iterable for a length hint before it starts. Both are levers you can pull from
Python, and one of them is the reason `__length_hint__` exists.**

## Shrinking: the other branch of `list_resize`

```c
    /* Bypass realloc() when a previous overallocation is large enough
       to accommodate the newsize.  If the newsize falls lower than half
       the allocated size, then proceed with the realloc() to shrink the list.
    */
    if (allocated >= newsize && newsize >= (allocated >> 1)) {
        assert(self->ob_item != NULL || newsize == 0);
        Py_SET_SIZE(self, newsize);
        return 0;
    }
```

A `pop()` that leaves the list at least half full only decrements `ob_size` — no
allocator call at all. The block is handed back only once the list falls below half
its capacity, and then it is *re*-allocated to a smaller block, not freed.

Consequences worth carrying:

- **A list that grew to a million elements and was then drained does not promptly
  return the memory**, and never returns it in one step.
- **Freeing a block returns it to Python's allocator, not necessarily to the OS.**
  RSS is not a list-level concept.
- **Emptying is not the same as dropping.** `xs.clear()` and `del xs[:]` release the
  element block, but the list object stays alive with whatever the allocator does
  next; `del xs` (or letting the name go out of scope) releases the whole thing.

⚠️ Stated as uncertain, deliberately: the exact shrink schedule is a source-level
rule in CPython 3.14, not a documented guarantee. Rely on "eventually", never on
`>> 1`.

## The two places CPython skips growth entirely

### `list(iterable)` when the length is known

When a fresh list is built from something that can report its length,
`list_preallocate_exact` allocates once:

```c
    /* Since the Python memory allocator has granularity of 16 bytes on 64-bit
     * platforms (8 on 32-bit), there is no benefit of allocating space for
     * the odd number of items, and there is no drawback of rounding the
     * allocated size up to the nearest even number.
     */
    size = (size + 1) & ~(size_t)1;
```

No proportional slack, no repeated resizes. This is why `list(range(1_000_000))` and
a million `append` calls end up with different capacities for the same `len` — the
complexity page's *"depending on the history of the container"* made concrete.

### `extend` asks the iterable how long it is

```c
    /* Guess a result list size. */
    Py_ssize_t n = PyObject_LengthHint(iterable, 8);
```

`PyObject_LengthHint` tries `len()`, then `__length_hint__`, then falls back to the
default of 8. It is a *hint*: after the loop CPython trims what it over-guessed.

```c
    /* Cut back result list if initial guess was too large. */
    if (Py_SIZE(self) < self->allocated) {
        if (list_resize(self, Py_SIZE(self)) < 0)
```

This is a real, usable lever. A lazy object that knows its own length can implement
`__length_hint__` and turn a series of resizes into one allocation:

```python
class Rows:
    """A lazy result set that knows its own size up front."""

    def __init__(self, cursor, rowcount):
        self._cursor = cursor
        self._rowcount = rowcount

    def __iter__(self):
        return iter(self._cursor)

    def __length_hint__(self):
        return self._rowcount


rows = list(Rows(cursor, cursor.rowcount))   # one allocation, not a growth curve
```

The public spelling of the same protocol is `operator.length_hint(obj, default)`,
which is the supported way to *read* a hint without poking at the dunder.

## Preallocating from Python

You cannot call `list_resize` directly, but you can create a list at its final size
and fill it by index. That is the standard fix when an append loop sits in a
latency-critical path:

```python
# grows: one or more resizes inside the timed section
out = []
for item in source:
    out.append(transform(item))

# preallocated: one allocation, then pure stores
out = [None] * len(source)
for i, item in enumerate(source):
    out[i] = transform(item)
```

⚠️ Only reach for the second form when you have a *reason* — a measured tail-latency
problem, or a genuinely enormous known size. The first form is clearer, and
`[None] * n` opens a window in which the list contains placeholder values that are
not yet real data. When you can express the whole thing as a comprehension, prefer
that: it is the idiom, and Phase 1's
[Comprehensions](../../phase-1-language-core/09-comprehensions/README.md) topic
covers what the compiler does with it.

🔴 One trap in `[x] * n`: repetition stores the *same reference* n times. It is safe
for `None`, `0` and `""`; it is a bug for `[]` or any mutable object. That is
[10](10-copies-and-aliasing.md), and Phase 1 has the long version in
[Repetition and shared references](../../phase-1-language-core/07-assignment-and-aliasing/03b-repetition-and-shared-refs.md).

## Gotchas

### Expecting memory back after `del` or `pop`
**Symptom.** RSS stays high after a big list is drained element by element.
**Cause.** `list_resize` only reallocates when the new size drops below half the
allocation; until then it just lowers `ob_size`. Even then the block goes to the
allocator, not to the OS.
**Fix.** Drop the whole object and rebuild, rather than draining in place:

```python
kept = [x for x in big if predicate(x)]   # new, right-sized block
del big                                    # old block released in one go
```

### `xs = []` inside a function that was supposed to empty the caller's list
**Symptom.** The caller still sees every element after the "clear".
**Cause.** Rebinding a local name does nothing to the object. Only a mutating call
touches the list the caller holds.
**Fix.** Mutate, do not rebind:

```python
def drain(xs):
    xs.clear()        # or: del xs[:]  — both empty the caller's list
```

### `list(generator)` where the generator lies about its length
**Symptom.** Memory use spikes far above the final list size, or an oddly large
allocation for a short result.
**Cause.** `PyObject_LengthHint` trusts `__length_hint__`. A wrong hint means a
wrong first allocation. CPython trims afterwards, but the peak already happened.
**Fix.** Either report the truth or report nothing — the default of 8 is fine:

```python
def __length_hint__(self):
    if self._rowcount is None:
        return NotImplemented      # "I don't know" — CPython falls back
    return self._rowcount
```

### Assuming `sys.getsizeof(l)` tells you how much memory the list uses
**Symptom.** A memory report showing a list of ten thousand dataclass instances
using a tiny amount.
**Cause.** The documented behaviour is *"Only the memory consumption directly
attributed to the object is accounted for, not the memory consumption of objects it
refers to."* You measured the pointer block, not the objects.
**Fix.** Sum the parts deliberately, and know it is still an approximation:

```python
import sys
approx = sys.getsizeof(rows) + sum(sys.getsizeof(r) for r in rows)
```

[12](12-memory-list-tuple-array.md) covers why even that undercounts, and the
*recursive sizeof recipe* the docs point at.

### Preallocating with `[None] * n` and then also appending
**Symptom.** The result is twice as long as expected, with a block of `None` in the
middle.
**Cause.** `[None] * n` creates n *real* elements, not capacity. `append` adds to
the end of those.
**Fix.** Pick one strategy per list — index-fill or append — and never mix them:

```python
out = [None] * len(source)
for i, item in enumerate(source):
    out[i] = transform(item)      # assignment, never append
```

### Trimming a list with `xs = xs[:n]` in a hot loop
**Symptom.** Allocation churn where a truncation was expected to be free.
**Cause.** The slice builds a whole new list (O(n)); the old one survives until the
name is rebound and the refcount drops.
**Fix.** Delete the tail in place — it moves nothing, because there is nothing after
it:

```python
del xs[n:]        # in-place truncation, no new block
```

## Interview questions

**★ Does popping every element from a large list return the memory?**
Not promptly and not in one step. CPython only reallocates when the size drops below
half the current allocation — the source's no-op condition is
`allocated >= newsize && newsize >= (allocated >> 1)`. Even then the block goes back
to Python's allocator, which may keep it rather than returning it to the OS. If you
want the memory back at a known point, drop the list object entirely rather than
emptying it.

**★ Two lists both have `len() == 1000`. Can they use different amounts of memory?**
Yes. One built by a thousand `append` calls carries over-allocation slack; one built
by `list(range(1000))` went through `list_preallocate_exact` and has essentially
none. This is exactly what the complexity footnote means by *"depending on the
history of the container"* — capacity is a function of how the list got here, not
just of its length.

**How would you make `list(my_lazy_thing)` allocate once?**
Implement `__length_hint__` on the iterable. `list.extend` calls
`PyObject_LengthHint(iterable, 8)`, which consults `len()` then `__length_hint__`,
and preallocates to that guess before iterating; anything left over is trimmed at
the end. It must be an honest estimate — a wrong hint just moves the waste to the
peak. `operator.length_hint` is the public way to read the same protocol.

**When is preallocating with `[None] * n` the wrong call?**
Almost always, unless you have a measured problem. It hides the real length behind a
list full of placeholders, breaks if the loop exits early (you ship `None`s as
data), and buys a constant factor. Prefer a comprehension; reach for preallocation
when the size is known, large, and the growth sits inside a latency budget.

**What is the difference between `xs.clear()`, `del xs[:]`, `xs = []` and `del xs`?**
The first two mutate the list the caller holds and release its element block. `xs = []`
rebinds the local name to a brand-new empty list and leaves the caller's object
untouched — a classic "why didn't my function clear it" bug. `del xs` unbinds the
name; if it was the last reference, the whole list object is collected. The docs
define `clear()` as *"equivalent to writing `del sequence[:]`"*.

**Why does `sys.getsizeof` on a list of big objects look so small?**
Because it measures the list's own storage — the header plus the pointer array plus
GC overhead — and, in the docs' words, *"not the memory consumption of objects it
refers to."* A list of ten thousand objects reports roughly ten thousand pointers'
worth, no matter how large the objects are. Any real memory accounting has to walk
the graph, and even then shared objects get double-counted unless you track identity.

---

← [Over-allocation and amortised append](02-overallocation-and-amortised-append.md) · [Topic index](README.md) · Next → [The O(n) shift](03-the-o-n-shift.md)
