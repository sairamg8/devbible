---
title: "A heap is a plain list that keeps exactly one promise — heap[0] is the smallest item — and every other index, the iteration order and the list's own methods are outside that promise, which is where every silent heap bug lives"
sidebar_label: "01 · The heap invariant"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`heapq` documentation](https://docs.python.org/3.14/library/heapq.html) (introduction, [Theory](https://docs.python.org/3.14/library/heapq.html#theory), [Basic Examples](https://docs.python.org/3.14/library/heapq.html#basic-examples)) and CPython **v3.14.7** source — [`Lib/heapq.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/heapq.py) (lines 133–146, 221–233) and [`Modules/clinic/_heapqmodule.c.h`](https://github.com/python/cpython/blob/v3.14.7/Modules/clinic/_heapqmodule.c.h) (the `PyList_Check` argument guard), labelled as implementation detail where the docs are silent. Target: **Python 3.14.7**. **No sandbox run, no timings.**

**`heapq` has no heap type. A heap is an ordinary `list` whose elements happen to be arranged so that every parent compares less than or equal to its two children — and the only consequence you can read off that arrangement is that `heap[0]` is the smallest element. `heap[1]` is not the second smallest, `heap[-1]` is not the largest, and iterating the list gives you no order at all. The functions keep the arrangement intact; nothing else does. `append`, `insert`, item assignment, `sort(reverse=True)` and — the one that reaches production — mutating the priority of an object already in the heap all break it without an error, and every later `heappop` then returns the wrong item. This chunk is the representation: the index arithmetic, exactly what the list promises and does not, and why it has to be a real `list`. How the arrangement is built and repaired, and what that costs, is [01b](01b-building-and-sifting.md).**

## The invariant, and the tree that is not there

> *"Min-heaps are binary trees for which every parent node has a value less than or equal to any
> of its children. We refer to this condition as the heap invariant."*

> *"For min-heaps, this implementation uses lists for which `heap[k] <= heap[2*k+1]` and
> `heap[k] <= heap[2*k+2]` for all *k* for which the compared elements exist. Elements are
> counted from zero. The interesting property of a min-heap is that its smallest element is
> always the root, `heap[0]`."*

The tree is implicit. Index `k` has children at `2*k + 1` and `2*k + 2` and its parent at
`(k - 1) // 2`; the source computes the parent as `(pos - 1) >> 1`. The documentation's
[Theory](https://docs.python.org/3.14/library/heapq.html#theory) section draws the indices (not
the values) as a tournament:

```text
                                  0

                 1                                 2

         3               4                5               6

     7       8       9       10      11      12      13      14

   15 16   17 18   19 20   21 22   23 24   25 26   27 28   29 30
```

> *"In the tree above, each cell *k* is topping `2*k+1` and `2*k+2`. […] the rule becomes that a
> cell and the two cells it tops contain three different items, but the top cell "wins" over the
> two topped cells."*

Because the tree is stored level by level with no gaps, a heap of *n* items is exactly
`⌊log2 n⌋ + 1` levels deep, there are no pointers to allocate, and the last element is always a
leaf. That last fact is what makes push and pop cheap: push appends a leaf and walks it up one
path; pop moves the last leaf to the root and walks it down one path. Neither touches anything
off that path.

## What `heap[0]` promises — and what nothing promises

The invariant relates a parent to its own children and to nothing else. Two siblings are
unordered. A node on the left of the tree is unordered with respect to a node on the right. So:

| Question | Answer | Why |
|---|---|---|
| smallest item | `heap[0]`, O(1) | the root beats every path below it |
| second smallest | `heap[1]` **or** `heap[2]` | it must be a child of the root — but which child is not recorded |
| largest item | somewhere among the leaves (the last ⌈n/2⌉ slots) | a leaf is never anyone's parent |
| iteration order | none | level order of an arbitrary valid arrangement |
| `x in heap` | O(n) | no order to search by |

```python
import heapq

latencies_ms = [212, 48, 97, 5, 330, 61, 18]
heapq.heapify(latencies_ms)

fastest = latencies_ms[0]                          # correct: the minimum
second_fastest = heapq.nsmallest(2, latencies_ms)[1]   # correct: never latencies_ms[1]
slowest = max(latencies_ms)                        # correct: O(n); the heap cannot help
in_order = sorted(latencies_ms)                    # a sorted copy; the heap is untouched
```

The converse does hold, and the documentation leans on it:

> *"These two aspects make it possible to view the heap as a regular Python list without
> surprises: `heap[0]` is the smallest item, and `heap.sort()` maintains the heap invariant!"*

A list sorted ascending satisfies `a[k] <= a[2*k+1]` for every `k`, so a sorted list is a valid
min-heap. A heap is almost never a sorted list.

## The heap must be a real `list`

The C functions that replace the Python ones at import time declare their first argument as
`object(subclass_of='&PyList_Type')` and are positional-only. A `list` or a `list` subclass is
accepted; a `deque`, a `tuple`, an `array.array` or a `collections.UserList` is rejected with a
`TypeError` from argument parsing, before any heap logic runs (`Modules/clinic/_heapqmodule.c.h`,
the `PyList_Check` guard). Keyword arguments are rejected too: `heapq.heappush(heap=h, item=x)`
is a `TypeError`.

## Building it and keeping it — the next chunk

How `heapify` builds this arrangement in linear time, how a push or pop repairs it along one
path, why only `<` is ever called and what each operation costs is
[01b](01b-building-and-sifting.md). The rest of this page is about the list itself: what you
may read from it and what you must never write to it.

## Gotchas

### `heap[1]` read as the runner-up
**Symptom.** A "top two candidates" feature returns the right winner and a runner-up that is
sometimes the third- or fourth-best.
**Cause.** The second smallest is a child of the root, but it can be `heap[1]` or `heap[2]`;
the invariant does not order siblings.
**Fix.** Ask for what you mean, without disturbing the heap:

```python
best, runner_up = heapq.nsmallest(2, candidates_heap)
```

### Iterating, printing or slicing a heap as if it were sorted
**Symptom.** An admin endpoint that lists "upcoming jobs" shows them out of order; `heap[:10]`
is not the ten earliest.
**Cause.** A heap's list order is one arbitrary valid arrangement. Only index 0 is meaningful.
**Fix.**

```python
next_ten = heapq.nsmallest(10, job_heap)   # O(n log 10), heap untouched
everything_in_order = sorted(job_heap)     # O(n log n) copy, heap untouched
```

### `heap.append(x)` instead of `heapq.heappush(heap, x)`
**Symptom.** After a refactor, `heappop` occasionally returns an item that is not the smallest;
no exception anywhere.
**Cause.** `append` places the item at a leaf without sifting it up. If it is smaller than its
parent the invariant is broken on that path, and every pop that relies on that path is wrong.
**Fix.** Use the heap functions for single items; after a bulk `extend`, restore the invariant
once:

```python
heapq.heappush(heap, item)        # one item: O(log n)

heap.extend(new_batch)            # many items: extend, then
heapq.heapify(heap)               # one O(n) repair instead of len(new_batch) pushes
```

### Mutating the priority of an object already in the heap
**Symptom.** A scheduler that "bumps" a job by setting `job.priority = 0` keeps running other
jobs first; later pops come out in an order no one can explain.
**Cause.** The heap was arranged for the old value. Changing it does not move the object, and
the invariant is now false on that object's path — silently, because nothing re-checks it.
**Fix.** Never change what the heap compares while the entry is in the heap. Make entries
immutable, and re-prioritise by invalidating the old entry and pushing a new one
(**05b · Removing and re-prioritising entries** *(not written yet)*):

```python
from dataclasses import dataclass, field

@dataclass(frozen=True, order=True)
class Entry:
    priority: int
    seq: int
    job_id: str = field(compare=False)
```

### Handing `heapq` a `deque`, a tuple or a `UserList`
**Symptom.** `TypeError` naming argument 1 and `list` from `heappush`/`heapify`.
**Cause.** The C implementation accepts only `list` and its subclasses.
**Fix.** `heap = list(source); heapq.heapify(heap)`.

### `heap.sort(reverse=True)` on a min-heap
**Symptom.** After a "sort for display" in place, the queue starts returning the *largest*
items first.
**Cause.** A list sorted descending satisfies the *max*-heap invariant — the documentation says
so — which is the opposite of what `heappop` assumes.
**Fix.** Display with `sorted(heap, reverse=True)`, which copies, and never sort the heap list
itself in reverse.

## Interview questions

**★ What does a heap tell you about `heap[1]`?**
Only that it is no smaller than `heap[0]` and no larger than its own children. The second
smallest item is guaranteed to be a child of the root, so it is `heap[1]` or `heap[2]`, but the
heap does not record which. Ask for `nsmallest(2, heap)[1]`, or pop twice and push back.

**★ Why does Python use a plain list with functions instead of a `Heap` class?**
The list *is* the representation — an implicit tree with no pointers — so exposing it costs
nothing and lets you use `heap[0]`, `len(heap)` and `heapify` on data you already have. The
price is that nothing protects the invariant: any list method or any in-place mutation of an
element can break it without an error. The documentation's framing is that zero-based indexing
and a min-heap make the list viewable *"without surprises"*; the surprises come from writing to
it.

**What happens if an element's priority changes while it is inside the heap?**
Nothing, immediately — and that is the problem. The element stays where it is, the invariant
becomes false along its path, and later pops can return a larger item before a smaller one. The
heap never re-validates. The safe designs are immutable entries plus lazy invalidation and
re-push, or rebuilding with `heapify` after a batch of changes.

**Is a sorted list a heap? Is a heap a sorted list?**
A list sorted ascending is always a valid min-heap, because every element is no larger than
anything after it, including its children. A heap is a sorted list only by coincidence; the
invariant constrains each parent against its children and leaves siblings and cousins
unordered.

---

← [Topic index](README.md) · Next → [01b · Building and sifting](01b-building-and-sifting.md)
