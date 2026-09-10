---
title: "Python 3.14 finally ships public max-heap functions, which retire the negation trick — but a max-heap is still an unmarked list, so pairing it with the min-heap functions corrupts it silently, and a counter that gave FIFO ties in a min-heap gives LIFO ties in a max-heap"
sidebar_label: "04 · Max-heaps in 3.14"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`heapq` documentation](https://docs.python.org/3.14/library/heapq.html) ([`heapify_max`](https://docs.python.org/3.14/library/heapq.html#heapq.heapify_max) and the four other `_max` entries, each marked *Added in version 3.14*; [Other Applications — running median](https://docs.python.org/3.14/library/heapq.html#other-applications)), [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html) (heapq), and CPython **v3.14.7** [`Lib/heapq.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/heapq.py) (lines 129–131, 182–215, 601–606) compared against **v3.13.0** [`Lib/heapq.py`](https://github.com/python/cpython/blob/v3.13.0/Lib/heapq.py) (lines 181–202). Target: **Python 3.14.7**. **No sandbox run, no timings.**

**Until 3.13 the `heapq` module had no public way to pop the *largest* item. Everyone negated: push `-latency`, pop, negate back — which works for numbers, fails with a `TypeError` for strings and dates, and leaks negative values into reports the day someone forgets the second minus. Python 3.14 adds five public functions — `heapify_max`, `heappush_max`, `heappop_max`, `heapreplace_max` and `heappushpop_max` — that maintain the reverse invariant on the same plain list. They remove the negation, not the discipline: nothing marks a list as a max-heap, so one stray `heappop` on it returns an arbitrary item, and the `(priority, count, item)` tie-break that makes a min-heap first-in-first-out makes a max-heap last-in-first-out unless the count is reversed too.**

## What 3.14 added

> *"The `heapq` module has improved support for working with max-heaps, via the following new
> functions: `heapify_max()`, `heappush_max()`, `heappop_max()`, `heapreplace_max()`,
> `heappushpop_max()`"* — What's New in Python 3.14

> *"Max-heaps satisfy the reverse invariant: every parent node has a value *greater* than any of
> its children. These are implemented as lists for which `maxheap[2*k+1] <= maxheap[k]` and
> `maxheap[2*k+2] <= maxheap[k]` for all *k* for which the compared elements exist. The root,
> `maxheap[0]`, contains the *largest* element; `heap.sort(reverse=True)` maintains the max-heap
> invariant."*

The formula is the rule the code follows — equal parent and child are allowed, whatever the
word "greater" suggests. Each function mirrors its min-heap twin, including the edge cases:

| Min-heap | Max-heap (3.14) | Returns | Empty heap |
|---|---|---|---|
| `heapify(x)` | `heapify_max(x)` | `None`, in place, linear time | fine |
| `heappush(h, item)` | `heappush_max(h, item)` | `None` | fine |
| `heappop(h)` | `heappop_max(h)` | smallest / **largest** | `IndexError` |
| `heapreplace(h, item)` | `heapreplace_max(h, item)` | old root — *"may be smaller than the item added"* for the max form | `IndexError` |
| `heappushpop(h, item)` | `heappushpop_max(h, item)` | the larger of item and root for the max form; item back untouched if it is not smaller than the root | returns item |

> *"Like `list.sort()`, this implementation uses only the `<` operator for comparisons, for both
> min-heaps and max-heaps."*

So a class needs only `__lt__` to live in either kind of heap: the max functions ask
`parent < child` where the min functions ask `child < parent`.

## What existed before, and what still does

In 3.13 the module already had max-heap helpers, privately, because `nsmallest` and
`merge(reverse=True)` needed them: `_heapify_max`, `_heappop_max` and `_heapreplace_max`, in both
the Python and the C implementation. There was no `_heappush_max` and no `_heappushpop_max`. 3.14
makes the full set public and keeps the underscored names as aliases:

```python
# Lib/heapq.py, v3.14.7, lines 601–606
# For backwards compatibility
_heappop_max  = heappop_max
_heapreplace_max = heapreplace_max
_heappush_max = heappush_max
_heappushpop_max = heappushpop_max
_heapify_max = heapify_max
```

Code that reached into the private names on 3.13 still runs on 3.14. The documentation lists only
the public names, and says nothing about how long the aliases stay; move to the public names.

## The negation trick, and where it breaks

```python
import heapq

# Pre-3.14 max-heap of latencies: store the negative, negate on the way out.
slowest_first: list[float] = []
for latency_ms in (212.0, 48.5, 330.2, 97.0):
    heapq.heappush(slowest_first, -latency_ms)
worst = -heapq.heappop(slowest_first)

# With priorities in tuples, only the priority is negated; the counter stays ascending (FIFO).
jobs: list[tuple[int, int, str]] = []
heapq.heappush(jobs, (-5, 0, "rebuild-search-index"))
```

It fails in four ways, all of which the 3.14 functions remove:

- **Non-numeric priorities.** `-"2026-09-10"` and `-date.today()` are `TypeError`s. A max-heap of
  ISO timestamps, names or version tuples had to fall back to a wrapper class with a reversed
  `__lt__`.
- **Forgetting to negate back.** The value in the heap is not the value in the domain; every read
  site must remember, and a dashboard that shows `-330.2 ms` is the usual symptom.
- **Tuples.** `-(priority, seq)` is a `TypeError`; you must rebuild the tuple with only the right
  fields negated.
- **Mixed signs of meaning.** A code base that has both "negated" and "plain" heaps of the same
  type cannot tell them apart by looking at a value.

The same latency heap on 3.14:

```python
import heapq

slowest_first: list[float] = []
for latency_ms in (212.0, 48.5, 330.2, 97.0):
    heapq.heappush_max(slowest_first, latency_ms)
worst = heapq.heappop_max(slowest_first)          # 330.2 — no sign games
peek = slowest_first[0]                           # the current largest, O(1)
```

## Ties in a max-heap come out newest-first

A counter in the second position makes a **min**-heap first-in-first-out among equal priorities:
the smaller count wins. In a **max**-heap the *larger* count wins, so the same entry shape gives
last-in-first-out — the most recently queued of several equal-priority jobs runs first:

```python
import heapq
import itertools

_seq = itertools.count()
urgent_first: list[tuple[int, int, str]] = []

def submit(priority: int, job_id: str) -> None:
    # Negate the counter, not the priority: the largest priority wins, and among
    # equal priorities the largest -seq (= the oldest job) wins. FIFO again.
    heapq.heappush_max(urgent_first, (priority, -next(_seq), job_id))

def next_job() -> str:
    _priority, _neg_seq, job_id = heapq.heappop_max(urgent_first)
    return job_id
```

The alternative is to keep a min-heap and negate the numeric priority, `(-priority, seq, job)`,
as before 3.14. Either works; what does not work is moving an existing `(priority, seq, item)`
design from `heappush` with negated priorities to `heappush_max` with plain priorities and
leaving the counter alone.

## Two heaps: the running median

The documentation's own example for the new functions is a running median — a max-heap for the
lower half, a min-heap for the upper half, balanced so the lower half has the same size or one
more:

```python
from heapq import heappush, heappushpop, heappush_max, heappushpop_max

def running_median(iterable):
    "Yields the cumulative median of values seen so far."

    lo = []  # max-heap
    hi = []  # min-heap (same size as or one smaller than lo)

    for x in iterable:
        if len(lo) == len(hi):
            heappush_max(lo, heappushpop(hi, x))
            yield lo[0]
        else:
            heappush(hi, heappushpop_max(lo, x))
            yield (lo[0] + hi[0]) / 2
```

Each new value is first passed through the *other* heap with a push-pop, so whatever crosses into
`lo` is guaranteed to be no larger than everything in `hi`, and vice versa. `lo[0]` is the largest
of the lower half and `hi[0]` the smallest of the upper half; the median is one of them or their
average. Each step is O(log n) and memory is O(n) — every value is kept. The same shape answers
"p50 latency so far" on a stream; for a sliding window or bounded memory you need removal, which
is the subject of **05b · Removing and re-prioritising entries** *(not written yet)*.

## Keeping the K smallest: the max-heap as a bouncer

The mirror of the streaming top-K in [02](02-push-pop-replace-pushpop.md): to keep the K
**smallest** distances, keep a **max**-heap of K, whose root is the worst of the current best.
It is what `nsmallest` does internally, written out for when the stream never ends:

```python
import heapq
from collections.abc import Iterable

def nearest_drivers(candidates: Iterable[tuple[float, str]], k: int) -> list[tuple[float, str]]:
    """k closest (distance_km, driver_id) pairs, holding k entries."""
    heap: list[tuple[float, str]] = []
    for entry in candidates:
        if len(heap) < k:
            heapq.heappush_max(heap, entry)
        else:
            heapq.heappushpop_max(heap, entry)   # evicts the farthest only if entry is nearer
    return sorted(heap)
```

## Gotchas

### `AttributeError` or `ImportError` for `heappush_max` on an older interpreter
**Symptom.** `module 'heapq' has no attribute 'heappush_max'`, or a failing `from heapq import
heappop_max`, in CI or on a server still running 3.13.
**Cause.** The five functions are *Added in version 3.14*.
**Fix.** Declare the floor so installers refuse older interpreters
([`requires-python`](../../phase-7-packaging-tooling/01-pyproject-toml/04-version-and-requires-python.md)),
or keep the negation form in code that must still run on 3.13:

```toml
[project]
name = "dispatch-service"
version = "2.4.0"
requires-python = ">=3.14"
```

### `heappop` on a list built with `heapify_max`
**Symptom.** A "largest first" queue occasionally returns a small item; no error.
**Cause.** Both kinds of heap are plain lists. `heappop` assumes the min invariant, moves the last
leaf to the root and sifts it with the wrong comparison, and the list is now neither heap.
**Fix.** Never let a max-heap list escape without its functions. A three-method wrapper is enough
to make the pairing impossible to get wrong:

```python
import heapq
from typing import Generic, TypeVar

T = TypeVar("T")

class MaxHeap(Generic[T]):
    def __init__(self, items: list[T] | None = None) -> None:
        self._items = list(items or [])
        heapq.heapify_max(self._items)
    def push(self, item: T) -> None:
        heapq.heappush_max(self._items, item)
    def pop(self) -> T:
        return heapq.heappop_max(self._items)
    def peek(self) -> T:
        return self._items[0]
    def __len__(self) -> int:
        return len(self._items)
```

### Equal-priority jobs start running newest-first after the 3.14 migration
**Symptom.** After replacing `heappush(q, (-p, next(seq), job))` with
`heappush_max(q, (p, next(seq), job))`, jobs of the same priority run in reverse order of
submission.
**Cause.** In a max-heap the larger counter wins the tie.
**Fix.** `heappush_max(q, (p, -next(seq), job))` — reverse the counter along with the heap.

### Negating a string, date or tuple priority
**Symptom.** `TypeError: bad operand type for unary -` when building a max-heap of timestamps,
names or `(major, minor)` versions.
**Cause.** The negation trick only works for numbers.
**Fix.** On 3.14, the `_max` functions with the values as they are:
`heapq.heappush_max(releases, (2026, 9, "api-gateway"))`.

### A negated value read without negating it back
**Symptom.** A report shows negative latencies or negative prices; the heap was right.
**Cause.** The stored value was `-x` and one reader forgot.
**Fix.** Use the 3.14 max functions and store the real value; the root is then the answer as-is.

### `heapreplace_max` evicting a larger item for a smaller one
**Symptom.** A "keep the 100 cheapest quotes" heap ends up with expensive quotes in it.
**Cause.** Like `heapreplace`, it pops first and always inserts; *"The value returned may be
smaller than the *item* added."*
**Fix.** `heappushpop_max`, which only displaces the root for a strictly smaller item.

### Leaning on `heapq._heapify_max` and friends
**Symptom.** Code written for 3.13 calls `heapq._heappop_max`; a linter or reviewer flags a
private API.
**Cause.** Before 3.14 those were the only max-heap helpers. 3.14 keeps them as aliases *"For
backwards compatibility"* without documenting them or saying for how long.
**Fix.** Rename to the public forms — `heapq.heappop_max`, `heapq.heapify_max`,
`heapq.heapreplace_max` — once the code requires 3.14.

## Interview questions

**★ How did you implement a max-heap in Python before 3.14, and what changed?**
By negating numeric priorities on the way in and out of a min-heap, or by wrapping values in a
class whose `__lt__` compares in reverse; the module's own max-heap helpers existed only as
private underscored functions used by `nsmallest` and `merge`. Python 3.14 adds public
`heapify_max`, `heappush_max`, `heappop_max`, `heapreplace_max` and `heappushpop_max`, which
maintain the reverse invariant on a plain list with plain values — so strings, dates and tuples
work without a wrapper and no value is stored with a flipped sign.

**★ How does the two-heap running median work?**
A max-heap holds the lower half of the values and a min-heap the upper half, with the lower half
the same size or one larger. Each new value is pushed through the opposite heap with a push-pop,
which guarantees that what crosses over respects the split, and then lands in whichever heap
restores the size balance. The median is the root of the larger heap, or the average of both
roots when the sizes are equal. Every step is O(log n).

**Why did the tie order of a `(priority, count, item)` queue flip when it moved to `heappush_max`?**
Because the counter is compared in the same direction as the priority. In a min-heap the
smaller counter — the older entry — wins a tie; in a max-heap the larger counter — the newer
entry — does. Negate the counter in a max-heap to keep first-in-first-out.

**Why does `nsmallest` use a max-heap?**
To keep the K smallest items it must repeatedly find and evict the largest of the K it is
holding, and a max-heap keeps that element at index 0. The mirror holds for `nlargest`, which
uses a min-heap.

**Why does `heapq` not simply take `reverse=True` or `key=` on every function?**
The heap functions store no state between calls — the list is the only state — so a key or a
direction would have to be passed identically on every push and pop of the same list, and one
call that forgot would corrupt it. Separate function names make the direction part of the call.
The functions that do take `key=` and `reverse=` — `merge`, `nlargest`, `nsmallest` — build and
consume their heap inside one call.

---

← Prev: [03b · Ties, keys and top-N queries](03b-ties-keys-and-top-n-queries.md) · [Topic index](README.md) · Next → [05 · Priority queues — ties and the counter](05-priority-queues.md)
