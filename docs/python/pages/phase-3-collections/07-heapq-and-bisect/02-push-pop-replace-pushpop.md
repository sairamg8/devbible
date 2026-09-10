---
title: "heappush and heappop are the whole priority queue, heapreplace and heappushpop are the same two steps in opposite orders with different answers, and a comparison that raises halfway through a sift leaves the pushed item in the heap and the popped item nowhere"
sidebar_label: "02 · push, pop, replace, pushpop"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`heapq` documentation](https://docs.python.org/3.14/library/heapq.html) (the min-heap function entries) and CPython **v3.14.7** source — [`Lib/heapq.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/heapq.py) (lines 133–169) and [`Modules/_heapqmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_heapqmodule.c) (lines 25–68, 120–297). What a heap looks like after a failed comparison is **read from the C source, not documented** and is labelled that way. Target: **Python 3.14.7**. **No sandbox run, no timings.**

**Four functions change a heap. `heappush` appends a leaf and sifts it toward the root; `heappop` takes the root, moves the last leaf into its place and sifts it down. `heapreplace` and `heappushpop` both do one pop and one push in a single sift, but in opposite orders: `heapreplace` pops first, so it always returns the old smallest item even when the new one is smaller; `heappushpop` pushes first, so it returns whichever is smaller and — when the new item is not larger than the root — returns it without touching the heap at all. Choosing the wrong one of those two is how a streaming top-K evicts its best entries. And because every sift step calls your comparison, the moment that comparison raises is the moment the heap's state stops being what you think: per the v3.14.7 source, a failed push has already appended its item, and a failed pop has already dropped its result — [02b](02b-when-a-comparison-fails.md) is that failure mode in full.**

## `heappush` and `heappop`

> *"Push the value *item* onto the *heap*, maintaining the min-heap invariant."*

> *"Pop and return the smallest item from the *heap*, maintaining the min-heap invariant. If the
> heap is empty, `IndexError` is raised. To access the smallest item without popping it, use
> `heap[0]`."*

The pure-Python reference implementation shows the shape; the C functions that replace it at
import time do the same steps:

```python
# Lib/heapq.py, v3.14.7
def heappush(heap, item):
    heap.append(item)
    _siftdown(heap, 0, len(heap)-1)      # walk the new leaf toward the root

def heappop(heap):
    lastelt = heap.pop()    # raises appropriate IndexError if heap is empty
    if heap:
        returnitem = heap[0]
        heap[0] = lastelt
        _siftup(heap, 0)                 # walk the old last leaf down from the root
        return returnitem
    return lastelt
```

Both are O(log n) comparisons. Neither takes a default: there is no `heappop(heap, None)`, and
peeking with `heap[0]` on an empty list is an ordinary `IndexError` from list indexing. The
empty case is the one every queue consumer must decide about explicitly:

```python
import heapq

def next_due(heap: list[tuple[float, int, str]], now: float) -> str | None:
    if heap and heap[0][0] <= now:      # peek before popping; empty is a normal state
        _due_at, _seq, job_id = heapq.heappop(heap)
        return job_id
    return None
```

## `heapreplace`: pop first, then push

> *"Pop and return the smallest item from the *heap*, and also push the new *item*. The heap size
> doesn't change. If the heap is empty, `IndexError` is raised."*

> *"This one step operation is more efficient than a `heappop()` followed by `heappush()` and can
> be more appropriate when using a fixed-size heap. The pop/push combination always returns an
> element from the heap and replaces it with *item*."*

> *"The value returned may be larger than the *item* added. If that isn't desired, consider using
> `heappushpop()` instead."*

The implementation is three lines: remember `heap[0]`, overwrite it with the new item, sift
down once. One sift instead of two is the whole saving. The source's docstring adds the usage
rule the documentation only implies — *"That constrains reasonable uses of this routine unless
written as part of a conditional replacement: `if item > heap[0]: item = heapreplace(heap,
item)`"*.

The case it fits exactly is a **recurring job**: the root is the job that is due, you run it,
and the same job goes back in with its next due time. Pop-then-push is precisely the intended
order, and the heap stays the same size:

```python
import heapq
import itertools
from collections.abc import Callable
from dataclasses import dataclass

_seq = itertools.count()

@dataclass(frozen=True)
class RecurringJob:
    name: str
    interval_s: float
    action: Callable[[], None]

def run_due_jobs(heap: list[tuple[float, int, RecurringJob]], now: float) -> None:
    while heap and heap[0][0] <= now:
        due_at, _seq_no, job = heap[0]
        job.action()
        # the root is this job: replace it with its next occurrence in one sift
        heapq.heapreplace(heap, (due_at + job.interval_s, next(_seq), job))
```

## `heappushpop`: push first, then pop

> *"Push *item* on the heap, then pop and return the smallest item from the *heap*. The combined
> action runs more efficiently than `heappush()` followed by a separate call to `heappop()`."*

> *"Its push/pop combination returns the smaller of the two values, leaving the larger value on
> the heap."*

```python
# Lib/heapq.py, v3.14.7
def heappushpop(heap, item):
    """Fast version of a heappush followed by a heappop."""
    if heap and heap[0] < item:
        item, heap[0] = heap[0], item
        _siftup(heap, 0)
    return item
```

Read the condition carefully. If the heap is empty, or the new item is **not greater** than the
root, the item is returned immediately and the heap is not touched — no sift, no write. Only a
strictly larger item displaces the root. On a tie (`heap[0] == item`), the item you passed in
comes straight back and the one already in the heap stays. The C version makes the same
decision with one `<` comparison of the root against the item.

## The streaming top-K: why it is `heappushpop`

To keep the **K largest** items of a stream in O(K) memory, keep a **min**-heap of size K. Its
root is the smallest of the current top K — the entry to evict next. Every new item either
beats that root or is discarded:

```python
import heapq
from collections.abc import Iterable

def slowest_requests(log: Iterable[tuple[float, str]], k: int) -> list[tuple[float, str]]:
    """The k highest (latency_ms, request_id) pairs, in one pass, holding k entries."""
    heap: list[tuple[float, str]] = []
    for entry in log:
        if len(heap) < k:
            heapq.heappush(heap, entry)
        else:
            heapq.heappushpop(heap, entry)   # evicts the root only if entry is larger
    return sorted(heap, reverse=True)
```

With `heapreplace` in that `else` branch, every new entry would evict the current K-th largest
*unconditionally* — including when the new entry is smaller — and the result would drift
toward the most recent K items. This loop is exactly what `heapq.nlargest(k, log)` does
internally, with tie-breaking and a few shortcuts added; **03 · `nlargest` and `nsmallest`**
*(not written yet)* shows when to call that instead of writing the loop.

| | empty heap | item ≤ root | item > root | heap size |
|---|---|---|---|---|
| `heapreplace(h, item)` | `IndexError` | returns old root, item goes in | returns old root, item goes in | unchanged |
| `heappushpop(h, item)` | returns item | returns item, **heap untouched** | returns old root, item goes in | unchanged |

## When the comparison itself fails

Every one of these functions calls your `<` at each sift step, and none of them can undo the
steps already taken when that call raises or lies. What a failed push, a failed pop and a `NaN`
priority each leave behind is [02b](02b-when-a-comparison-fails.md).

## Gotchas

### `heappop` on an empty heap in a consumer loop
**Symptom.** A worker crashes with `IndexError` the first time the queue drains.
**Cause.** `heappop` has no default; an empty heap is an error, and `heap[0]` on an empty list
is one too.
**Fix.** Treat empty as a normal state and check it, or catch it at the one place that means
"nothing to do":

```python
while heap:
    priority, _seq, job = heapq.heappop(heap)
    handle(job)
```

### `heapreplace` in a bounded top-K loop
**Symptom.** A "top 100 customers by spend" job returns mostly recent customers, some with tiny
totals.
**Cause.** `heapreplace` pops the root first and always inserts the new item, so every later
arrival evicts the current 100th-best whether or not it beats it.
**Fix.** `heappushpop`, which only displaces the root for a strictly larger item — or the
documented conditional form:

```python
if entry > heap[0]:
    heapq.heapreplace(heap, entry)      # equivalent here to heapq.heappushpop(heap, entry)
```

### Expecting the newest of two equal items to win a top-K slot
**Symptom.** Two scores tie for the last place in a leaderboard; the older one keeps the slot and
the product owner expected the newer one.
**Cause.** `heappushpop` displaces the root only when `heap[0] < item`. An equal item is handed
back and the incumbent stays.
**Fix.** Put the tie-break in the entry, so "newer" is genuinely larger:

```python
heapq.heappushpop(heap, (score, arrival_seq, player_id))   # later arrival_seq wins ties
```

### Draining a heap with `for item in heap`
**Symptom.** Half the items are skipped, or the loop returns items out of order.
**Cause.** Iterating a list while popping from it; and iteration order is not heap order anyway.
**Fix.** `while heap: item = heapq.heappop(heap)` — or `sorted(heap)` if you want every item
in order and do not need the heap afterwards.

### Pop-then-push for a recurring job
**Symptom.** Not a bug — twice the sift work in the hottest loop of a scheduler, plus a window in
which the job is in no structure at all if the push fails.
**Cause.** `heappop` then `heappush` does two sifts; `heapreplace` does one.
**Fix.** Peek the root, run the job, `heapreplace` the root with its next occurrence (the
`run_due_jobs` example above).

## Interview questions

**★ What is the difference between `heapreplace` and `heappushpop`?**
Order of operations. `heapreplace` pops first and then pushes, so it always returns the item that
was at the root — even if the new item is smaller — and it raises `IndexError` on an empty heap.
`heappushpop` pushes first and then pops, so it returns the smaller of the new item and the root;
if the new item is not larger than the root it comes straight back and the heap is untouched,
and on an empty heap it just returns the item. Both keep the size constant and both cost one
sift. `heapreplace` fits "the root is done, put its successor in"; `heappushpop` fits "keep only
the best K".

**★ How do you keep the K largest items of an unbounded stream in bounded memory?**
Keep a min-heap of at most K items. Its root is the weakest of the current top K. Push until
the heap has K items; after that, `heappushpop` each new item, which evicts the root only if the
new item beats it. Memory is O(K), time O(n log K), and the result is `sorted(heap,
reverse=True)`. It is a min-heap — not a max-heap — because the element you need to see and
evict is the smallest of the survivors. `heapq.nlargest` implements the same idea.

**Why is `heapreplace` cheaper than `heappop` followed by `heappush`?**
Pop-then-push moves the last leaf to the root and sifts it down, then appends a new leaf and sifts
it up — two sifts. `heapreplace` writes the new item straight into the root and sifts it down
once. The size never changes, so the list is never shrunk and regrown.

**Which operation would you use for a scheduler that re-runs periodic jobs?**
Peek at `heap[0]`; if it is due, run it and `heapreplace` the root with `(next_due, seq, job)`.
The root is exactly the entry being retired, the heap size is constant, and it is one sift. Use a
fresh sequence number on each re-insert so equal due times stay first-in-first-out.
---

← Prev: [01b · Building and sifting](01b-building-and-sifting.md) · [Topic index](README.md) · Next → [02b · When a comparison fails](02b-when-a-comparison-fails.md)
