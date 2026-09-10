---
title: "heapify builds a heap bottom-up in linear time, every push and pop repairs one root-to-leaf path in O(log n) comparisons, and each of those comparisons is a full call to your own __lt__ — which is what a heap actually costs"
sidebar_label: "01b · Building and sifting"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`heapq` documentation](https://docs.python.org/3.14/library/heapq.html) (introduction, [Theory](https://docs.python.org/3.14/library/heapq.html#theory), [Basic Examples](https://docs.python.org/3.14/library/heapq.html#basic-examples)) and CPython **v3.14.7** source — [`Lib/heapq.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/heapq.py) (lines 133–292), [`Modules/_heapqmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_heapqmodule.c) (lines 25–118, 311–388) and `Lib/test/test_heapq.py` (`test_comparison_operator`), labelled as implementation detail where the docs are silent. Target: **Python 3.14.7**. **No sandbox run, no timings** — the only comparison counts on this page are CPython's own, quoted from a source comment.

**[01](01-the-heap-invariant.md) is what the list promises; this is how the promise is built and kept. `heapify` does it in linear time because most nodes sit near the bottom and have almost nowhere to sink; pushing the same items one at a time costs O(n log n). After that, every push walks one new leaf up a single path and every pop walks one displaced leaf down a single path, so each costs O(log n) *comparisons* — and a comparison is not a cheap machine instruction but a rich comparison between two of your objects: a tuple compared element by element, or a Python `__lt__` method. There is no `key=` to push that work out of the elements, and there is no second operator: `heapq` calls `<` and nothing else.**

## `heapify` is linear; n pushes are not

> *"Transform list *x* into a min-heap, in-place, in linear time."*

`heapify` works bottom-up. Every index at or beyond `len(x) // 2` is a leaf and is already a
one-element heap; the loop sifts each internal node from `n//2 - 1` down to `0`, and each node's
children are already heaps by the time it is reached:

```python
# Lib/heapq.py, v3.14.7 — heapify
def heapify(x):
    """Transform list into a heap, in-place, in O(len(x)) time."""
    n = len(x)
    for i in reversed(range(n//2)):
        _siftup(x, i)
```

The work for a node is proportional to its height, not to the tree's height. Half the nodes
are leaves (height 0, no work), a quarter have height 1, an eighth height 2 — the sum of
heights over the whole tree is bounded by *n*, which is where "linear" comes from. Pushing the
same *n* items one at a time instead walks each new leaf up a path whose length grows with the
heap, O(log n) each. The source records its own comparison counts for the two approaches on
random lists of 1,000 — *"Building the heap by using heappush() 1000 times instead required
2198, 2148, and 2219 compares: heapify() is more efficient, when you can use it."* (those are
CPython's measurements in a source comment, not ours).

For heaps over 2,500 elements the C implementation switches to a cache-friendlier traversal
that, per its own comment, does *"the exact same number of comparisons and produce[s] exactly
the same heap"* — an implementation detail that changes memory access order, not results.

```python
import heapq

def build_deadline_heap(jobs: list[tuple[float, int, str]]) -> list[tuple[float, int, str]]:
    heap = list(jobs)          # copy: heapify rearranges its argument in place
    heapq.heapify(heap)        # O(n) — not a loop of heappush
    return heap
```

## The two sifts, and why pop goes all the way to a leaf

CPython's names are the reverse of most textbooks, which is worth knowing before you read the
source. `_siftdown(heap, startpos, pos)` moves the item at `pos` **toward the root** (the
parents move down); `_siftup(heap, pos)` moves the item at `pos` **toward the leaves** (the
smaller child moves up).

`_siftup` does not stop as soon as the sinking item is no larger than both children. It
promotes the smaller child all the way to a leaf, drops the item there, then sifts it back up:

> *"We *could* break out of the loop as soon as we find a pos where newitem <= both its children,
> but turns out that's not a good idea, and despite that many books write the algorithm that
> way. During a heap pop, the last array element is sifted in, and that tends to be large, so
> that comparing it against values starting from the root usually doesn't pay"* —
> `Lib/heapq.py` v3.14.7, lines 240–246

The reason given is the one that matters for your own code:

> *"Cutting the # of comparisons is important, since these routines have no way to extract "the
> priority" from an array element, so that intelligence is likely to be hiding in custom
> comparison methods, or in array elements storing (priority, record) tuples. Comparisons are
> thus potentially expensive."* — lines 248–252

Every sift step is a full rich comparison between two of *your* objects — tuple comparison
walking element by element, or a Python-level `__lt__`. The heap's cost is comparisons times
the price of one comparison, and the price is yours.

## Only `<`, never a key

> *"Like `list.sort()`, this implementation uses only the `<` operator for comparisons, for both
> min-heaps and max-heaps."*

A class that defines only `__lt__` works in a heap; a class that defines only `__le__` or
`__gt__` does not — CPython's own test suite asserts that *"`__le__` alone is not enough"*
(`Lib/test/test_heapq.py`, `test_comparison_operator`). And there is no `key=` on `heappush`,
`heappop` or `heapify`: the ordering must live in the elements themselves, which is why heaps
hold `(priority, count, item)` tuples. That pattern is the subject of [05](05-priority-queues.md);
the `key=` that `nlargest`, `nsmallest` and `merge` *do* accept is in [03](03-nlargest-and-nsmallest.md) and **06 · `heapq.merge`** *(not written yet)*.

## What each operation costs

| Operation | Cost | Source of the claim |
|---|---|---|
| `heapq.heapify(x)` | O(n) | docs: *"in linear time"* |
| `heappush`, `heappop`, `heapreplace`, `heappushpop` | O(log n) comparisons | docs, Theory: *"clearly logarithmic"* |
| `heap[0]` | O(1) | docs: *"use `heap[0]`"* |
| find, remove or re-prioritise an arbitrary item | O(n) | no index exists — see **05b** *(not written yet)* |
| `heapq.nsmallest(k, xs)` / `nlargest` | O(n log k), k items of memory | source notes, see [03](03-nlargest-and-nsmallest.md) |
| heapsort (push all, pop all) | O(n log n), **not stable** | docs: *"unlike `sorted()`, this implementation is not stable"* |

## Gotchas

### `heap = heapq.heapify(rows)` leaves `heap` as `None`
**Symptom.** `TypeError: 'NoneType' object is not subscriptable` on the next line.
**Cause.** Like `list.sort()`, `heapify` works in place and returns `None`.
**Fix.**

```python
heapq.heapify(rows)
heap = rows
```

### `heapify` rearranged a list someone else was still using
**Symptom.** A list passed into a helper comes back in a scrambled order; the caller's report
now prints rows out of their original sequence.
**Cause.** `heapify` mutates its argument. The caller and the helper held the same list.
**Fix.** Heapify a copy when the input is not yours: `heap = list(rows); heapq.heapify(heap)`.

### Building a heap with a loop of `heappush` when all the items are already in hand
**Symptom.** Start-up of a worker that loads a backlog of 200,000 pending jobs into its queue
is noticeably slower than loading the same rows into a plain list.
**Cause.** Each `heappush` walks a new leaf up a path as long as the heap is tall, so the loop
is O(n log n) comparisons — tuple comparisons, in a job queue. `heapify` does the same job in
O(n).
**Fix.**

```python
import heapq

def load_backlog(rows: list[tuple[float, int, str]]) -> list[tuple[float, int, str]]:
    heap = [(due_at, seq, job_id) for due_at, seq, job_id in rows]
    heapq.heapify(heap)            # not: for r in rows: heapq.heappush(heap, r)
    return heap
```

### A class with `__le__` or `__gt__` but no `__lt__`
**Symptom.** `TypeError` from `heappush` on objects that "are comparable" — `a <= b` works in
the REPL.
**Cause.** `heapq` calls `<` and nothing else.
**Fix.** Define `__lt__`, or derive the rest from one method with `functools.total_ordering`:

```python
from functools import total_ordering

@total_ordering
class Deadline:
    def __init__(self, at: float) -> None:
        self.at = at
    def __eq__(self, other: object) -> bool:
        return isinstance(other, Deadline) and self.at == other.at
    def __lt__(self, other: "Deadline") -> bool:
        return self.at < other.at
```

### A heap of rich objects whose `__lt__` does real work
**Symptom.** Profiling a scheduler shows most of its time inside a model's comparison method,
called from `heappush` and `heappop`.
**Cause.** Every sift step is one comparison, and with `@dataclass(order=True)` a comparison
builds and compares tuples of *every* field in declaration order until two differ. A heap
cannot cache "the priority" of an element — the source comment above says exactly that.
**Fix.** Compute the priority once, before the push, and let the heap compare plain numbers:

```python
import heapq
import itertools

_seq = itertools.count()

def schedule(heap: list[tuple[float, int, "Job"]], job: "Job") -> None:
    heapq.heappush(heap, (job.effective_deadline(), next(_seq), job))
    # the job object itself is never compared: (float, int) pairs are always distinct
```

## Interview questions

**★ Why is `heapify` O(n) when a single `heappush` is O(log n)?**
Because the work per node is proportional to that node's height, and most nodes are close to
the bottom. `heapify` sifts each internal node down into children that are already heaps: half
the nodes are leaves and cost nothing, a quarter sift at most one level, an eighth at most two,
and the series sums to a constant times *n*. Pushing *n* items one by one instead walks every
new item up from the bottom of an ever-taller tree, and each walk can be as long as the whole
height, so the bound is O(n log n). When you have all the items up front, build once with
`heapify`.

**Why does CPython's pop sift the replacement all the way to a leaf before moving it back up?**
The item moved to the root on a pop is the old last leaf, which tends to be large, so checking
at every level whether it can stop early usually fails and just adds comparisons. Promoting the
smaller child down to a leaf and then sifting the item up a short distance does fewer
comparisons on typical data, and comparisons — tuple comparisons or Python `__lt__` calls — are
the expensive part.

**Why does `heapq` only need `__lt__`?**
Every decision it makes is "is A less than B", the same contract as `list.sort()`. Using one
operator means user classes only need one method and the ordering cannot be inconsistent
between two operators. Defining only `__le__` does not work; `total_ordering` is the usual way
to get the rest.

**What actually dominates the cost of a heap operation on your own objects?**
The number of comparisons times the price of one comparison. The number is O(log n) per push or
pop and O(n) for `heapify`; the price is whatever `<` costs on your elements — a float
comparison for `(float, int, obj)` tuples whose first fields differ, a Python method call for a
class with `__lt__`, and a field-by-field tuple build for an ordered dataclass. Precomputing the
priority into the first tuple position is usually worth more than any structural change.

**★ Is heapsort stable?**
No, and the documentation says so. Equal elements can be reordered by the sifts, which is why a
priority queue that must be first-in-first-out among equal priorities adds an insertion counter
to each entry.
---

← Prev: [01 · The heap invariant](01-the-heap-invariant.md) · [Topic index](README.md) · Next → [02 · push, pop, replace, pushpop](02-push-pop-replace-pushpop.md)
