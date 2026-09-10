---
title: "`sys.getsizeof` measures a list's capacity in pointers and nothing it points to, CPython shares small ints and more behind those pointers, and the only honest measure of a structure's memory is allocation tracing — not a formula"
sidebar_label: "12b · Measuring memory honestly"
sidebar_position: 31
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against [`sys.getsizeof`](https://docs.python.org/3.14/library/sys.html#sys.getsizeof),
> [`tracemalloc`](https://docs.python.org/3.14/library/tracemalloc.html),
> [Integer objects — C API](https://docs.python.org/3.14/c-api/long.html) (the small-int
> cache note), and CPython's
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/3.14/Objects/listobject.c)
> (`list___sizeof___impl`, `list_resize`). Documentation-validated; 🔴 **no byte
> counts anywhere on this page — nothing was measured**. Target: **CPython 3.14**
> (3.14.7).

**Every memory question about a list has two halves, and `sys.getsizeof` answers only
the first. It reports the list's own storage — the header plus a pointer for every slot
of *capacity* — and the docs are explicit that it excludes *"the memory consumption of
objects it refers to"*. The second half, the objects, is where the memory usually is,
and it is not simply "one object per element": CPython hands back the same cached
object for every small integer, so a test list of zeros holds one int while
production data holds a million. Summing `getsizeof` over elements double-counts
anything shared; forgetting sharing under-counts. The instrument built for the job is
`tracemalloc`, which traces allocations as they happen — started early enough to see
them. [12](12-memory-list-tuple-array.md) is the three layouts; this chunk is how to
count them without inventing a number.**

## What `sys.getsizeof` counts

> *"Return the size of an object in bytes."* … *"Only the memory consumption directly
> attributed to the object is accounted for, not the memory consumption of objects it
> refers to."*

> *"`getsizeof()` calls the object's `__sizeof__` method and adds an additional garbage
> collector overhead if the object is managed by the garbage collector."*

For a list, `__sizeof__` in 3.14 (default build) is:

```c
    size_t res = _PyObject_SIZE(Py_TYPE(self));
    ...
    res += (size_t)self->allocated * sizeof(PyObject *);
```

The fixed header, plus **`allocated`** — capacity, not length — times the size of a
pointer. So `getsizeof` on a list answers "how big is the pointer block, including
its spare slots", which is why two lists of equal length can report different sizes
([02b](02b-shrinking-and-preallocation.md)) and why neither number says anything about
the elements.

## The objects behind the pointers

A list's real footprint is the pointer block plus the distinct objects it references,
and "distinct" matters. CPython shares some objects:

> *"CPython implementation detail: CPython keeps an array of integer objects for all
> integers between -5 and 256. When you create an int in that range you actually just
> get back a reference to the existing object."*

So `[0] * 1_000_000` is a million pointers to *one* `int`, while a list of a million
different large integers is a million pointers *and* a million `int` objects.
Extrapolating from the first to the second is how memory estimates go wrong.

Measure the process, not a formula:

> *"The tracemalloc module is a debug tool to trace memory blocks allocated by
> Python."*

```python
import tracemalloc

tracemalloc.start()
before = tracemalloc.take_snapshot()
rows = load_rows()
after = tracemalloc.take_snapshot()
for stat in after.compare_to(before, "lineno")[:10]:
    print(stat)
```

If you must walk a structure, count each object once:

```python
import sys

def deep_size(obj, seen=None):
    seen = set() if seen is None else seen
    if id(obj) in seen:
        return 0
    seen.add(id(obj))
    size = sys.getsizeof(obj)
    if isinstance(obj, (list, tuple, set, frozenset)):
        size += sum(deep_size(x, seen) for x in obj)
    elif isinstance(obj, dict):
        size += sum(deep_size(k, seen) + deep_size(v, seen) for k, v in obj.items())
    return size
```

It is still an approximation — allocator overhead and objects reached through
attributes are not counted — which is why the `sys` docs point at a *recursive sizeof
recipe* rather than providing a function.

## Gotchas

**★ Symptom: a memory estimate built from `sys.getsizeof` of a list of zeros is wildly
low for production data.** Cause: every `0` is the same cached object, so the test list
had one int; real data has one object per distinct value. Fix: estimate from
representative data, or measure with `tracemalloc`:

```python
sample = load_rows(limit=10_000)        # real values, not placeholders
```

**Symptom: `getsizeof(xs)` stays the same after removing half the elements.** Cause: it
reports `allocated`, not `len`, and the list only shrinks its block when the size drops
below half the capacity. Fix: build a right-sized list when you need the memory back:

```python
xs = xs.copy()          # new block sized exactly to len(xs)
```

**Symptom: summing `getsizeof` over nested lists double-counts.** Cause: shared
elements are counted once per reference. Fix: track identities, as `deep_size` does
above.

**Symptom: a `tracemalloc` snapshot shows almost nothing for data you know is large.**
Cause: tracing began after the data was allocated — at import time, or in a module
loaded before `start()`. The docs: *"To trace most memory blocks allocated by Python,
the module should be started as early as possible by setting the PYTHONTRACEMALLOC
environment variable to 1, or by using -X tracemalloc command line option."* Fix:
start tracing at interpreter launch:

```bash
python -X tracemalloc=5 -m myservice.report
```

**Symptom: an estimate of "len × getsizeof(one element)" is off in both directions for
a list of strings.** Cause: strings differ in length and storage kind, and equal
strings may or may not be the same object. Fix: measure the real data, deduplicating
by identity:

```python
import sys

total = sys.getsizeof(names) + sum(sys.getsizeof(s) for s in {id(s): s for s in names}.values())
```

## Interview questions

**★ What does `sys.getsizeof` on a list include?**
The list object's header and its pointer block at full capacity — `allocated`
pointers, not `len` — plus garbage-collector overhead. It excludes every element; the
docs say only memory *"directly attributed to the object"* is counted. A list of a
million large dicts reports roughly a million pointers' worth.

**Why does `[0] * 10**6` tell you little about a list of a million real integers?**
CPython caches ints from -5 to 256, so every slot of `[0] * n` points to one shared
object. A million distinct large integers need a million separate `int` objects on top
of the pointers. The same trap applies to repeated short strings and other shared
objects.

**How would you measure how much memory a data structure really uses?**
Measure allocation, not formulas: `tracemalloc` snapshots before and after building
it, compared by line. A recursive `getsizeof` walk that tracks visited ids is a
reasonable estimate for plain containers, but misses allocator overhead and anything
reachable through attributes.

**Why do you have to start `tracemalloc` early?**
Because it records allocations as they happen; anything allocated before tracing
started is invisible to it. The docs recommend starting it *"as early as possible"* via
`PYTHONTRACEMALLOC=1` or `-X tracemalloc`, with `tracemalloc.start()` for tracing from
a point at runtime.

---

← [Memory: list, tuple and array](12-memory-list-tuple-array.md) · [Topic index](README.md) · Next → [Phase 3 — Collections in depth](../README.md)
