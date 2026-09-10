---
title: "insort finds the slot in O(log n) and then pays O(n) to open it, so a list kept sorted one insert at a time is quadratic in bulk — batch with extend and sort, and when inserts and deletes never stop, the answer is a structure built for it, not a faster insort"
sidebar_label: "08 · insort and the cost of keeping a list sorted"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`bisect.insort_left` / `insort_right`](https://docs.python.org/3.14/library/bisect.html#bisect.insort_left), the `bisect` thread-safety note and [Performance Notes](https://docs.python.org/3.14/library/bisect.html#performance-notes), [time complexity — `list`](https://docs.python.org/3.14/library/time-complexity.html#list) — and CPython **v3.14.7** [`Modules/_bisectmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_bisectmodule.c) (lines 201–234, 387–419) and `Lib/test/test_bisect.py` (`test_listDerived`). Target: **Python 3.14.7**. **No sandbox run, no timings.**

**`insort(a, x)` is two steps: `bisect` to find where `x` belongs — about log2(n) comparisons — then `a.insert(i, x)`, which moves every element after `i` one slot to the right. The documentation is blunt that the second step decides the cost: *"The insort() functions are O(n) because the logarithmic search step is dominated by the linear time insertion step."* One insort is cheap; n of them into a growing list are O(n²) element moves, and a service that "keeps a sorted list up to date" by inserting each event as it arrives has that cost built in. The fixes depend on the access pattern: batch inserts become one `extend` and one `sort`; a structure that only needs its minimum becomes a heap; a structure with constant inserts, deletes and range queries becomes a B-tree-like container such as `sortedcontainers.SortedList` or, when the data outlives the process, a database index.**

## The two steps

> *"Insert *x* in *a* in sorted order. This function first runs `bisect_left()` to locate an
> insertion point. Next, it runs the `insert()` method on *a* to insert *x* at the appropriate
> position to maintain sort order."*

> *"Keep in mind that the *O*(log *n*) search is dominated by the slow *O*(*n*) insertion step."*

The list cost is on the time-complexity page: `l.insert(k, x)` is O(n − k), because

> *"inserting at index *k* shifts the elements from *k* onwards one slot to the right, moving *n* -
> *k* elements. The worst case is index 0, where the whole rest of the list has to be moved; the
> average case, an index in the middle of the list, takes *O*(*n*/2) = *O*(*n*) operations"*

The shift is a single block move of pointers in C, so the constant is small — which is why insort
is perfectly reasonable for lists of a few thousand elements and occasional inserts. It is the
*shape* of the cost that bites: it grows with the list, and in a loop it multiplies. The phase's
list chunk makes the same point from the list's side
([01 · `list` — partial sorts and counting](../01-list-internals/03d-partial-sorts-and-counting.md)).

## Left or right: where equal items land

`insort_left` inserts before existing equal items, `insort_right` — and its alias `insort` —
after them. With a `key`, "equal" means equal keys, so the choice decides the order of records
that tie: `insort` keeps them in arrival order, `insort_left` puts the newest first. The stability
reasoning is the same as Timsort's merge, which
[01 · `list` — galloping](../01-list-internals/07c-galloping.md) walks through.

```python
from bisect import insort
from dataclasses import dataclass

@dataclass(frozen=True)
class Ticket:
    priority: int
    ticket_id: str

tickets: list[Ticket] = []
for t in (Ticket(2, "T-1"), Ticket(1, "T-2"), Ticket(2, "T-3")):
    insort(tickets, t, key=lambda t: t.priority)   # T-2, T-1, T-3: equal priorities stay FIFO
```

## What `insort` calls

For an exact `list`, the C implementation calls `PyList_Insert` directly. For anything else it
calls the object's own `insert` method (`_PyObject_CallMethod(a, "insert", ...)`, lines 221–231),
and CPython's test suite checks that a `list` subclass's overridden `insert` is the one used. So:

- a `list` subclass that validates in `insert` is honoured — but one that validates only in
  `append` is bypassed;
- `collections.deque` and `array.array` have `insert`, so insort works on them — for a deque, both
  the bisect's indexing and the insert are O(n) in the middle;
- a `tuple` or `str` has no `insert`, so the search succeeds and the insert raises
  `AttributeError`.

## Batches: extend, then sort once

Inserting k new items into a sorted list of n with insort costs O(k·n) element moves. Appending
them and sorting once costs one sort — and Timsort recognises the existing sorted list as one long
run, sorts the batch, and merges the two, so the work is close to O(n + k log k):

```python
import heapq
from bisect import insort

def add_batch_slow(prices: list[float], batch: list[float]) -> None:
    for p in batch:
        insort(prices, p)              # k shifts of up to n pointers each

def add_batch(prices: list[float], batch: list[float]) -> None:
    prices.extend(batch)
    prices.sort()                      # one run + one sorted batch, merged by Timsort

def add_batch_streamed(prices: list[float], batch: list[float]) -> list[float]:
    return list(heapq.merge(prices, sorted(batch)))   # a new list, built in one pass
```

The same thinking applies when reads are rare: if the list is queried once a minute and written
thousands of times a minute, append without sorting and sort (or `nsmallest`) at read time.

## Removing from a sorted list

Deleting is the mirror image: `bisect_left` finds the position in O(log n), `del a[i]` shifts the
tail left in O(n). Check that the element at `i` is the one you meant — the insertion point is
not a match:

```python
from bisect import bisect_left

def remove_value(sorted_ids: list[int], target: int) -> bool:
    i = bisect_left(sorted_ids, target)
    if i != len(sorted_ids) and sorted_ids[i] == target:
        del sorted_ids[i]              # O(n - i) shift
        return True
    return False
```

`list.remove(x)` does the same job without the logarithmic search — a linear scan with `==` —
and removes the *first* equal element, which is not necessarily the record you are holding when
several compare equal.

## When a sorted list is the wrong structure

A leaderboard is the classic test. Reading the top ten is a slice. Finding a player's rank is a
bisect. Changing a score is remove-then-insert: two O(n) shifts, per score change, for every
player. With a thousand players and occasional updates that is fine. With a million players
updating continuously it is the entire cost of the service. The decision:

| Workload | Structure |
|---|---|
| build once, query many times | sorted `list` + `bisect` |
| only ever need the smallest / largest | heap ([01](01-the-heap-invariant.md)) |
| a batch of inserts, then queries | `extend` + `sort`, then `bisect` |
| constant inserts *and* deletes *and* range queries, in one process | a sorted container — [10](10-when-the-answer-is-not-heapq-or-bisect.md) |
| shared by processes, durable, or bigger than memory | a database index |

## Gotchas

**★ Symptom: a job that loads a day of events into a sorted list gets slower every hour, and is
CPU-bound in `insort`.** Cause: n insorts into a growing list are O(n²) element moves in total.
Fix: collect, then sort once — `events.extend(batch); events.sort(key=by_ts)` — or `heapq.merge`
the new sorted batch with the old list.

**★ Symptom: equal-priority tickets are handled newest-first.** Cause: `insort_left`, which
inserts before existing equal keys. Fix: `insort` (`insort_right`), which keeps arrival order among
equals.

**★ Symptom: after several threads insert into a shared sorted list, bisect lookups start
returning wrong answers.** Cause: the documentation says so directly — *"using `insort_left()` on
the same list from multiple threads may result in the list becoming unsorted."* Fix: one lock
around every search-and-insert pair:

```python
import threading
from bisect import insort

_book_lock = threading.Lock()

def add_order(book: list[tuple[float, int]], price: float, order_id: int) -> None:
    with _book_lock:
        insort(book, (price, order_id))
```

**Symptom: range queries miss items whose score was just updated.** Cause: an element's sort key
was changed in place, so it now sits where it no longer belongs, and bisect cannot see that. Fix:
treat the key as immutable while the element is in the list — remove it, change it, insort it
again.

**Symptom: records inserted through `insort` skip the validation that `append` performs on a
custom list class.** Cause: `insort` calls `insert`, not `append`. Fix: validate in `insert` too
(or in both, through one helper).

**Symptom: `AttributeError: 'tuple' object has no attribute 'insert'`.** Cause: insort needs a
mutable sequence with `insert`. Fix: keep the sorted data in a `list`.

**Symptom: removing a record by value deletes a different record with the same score.** Cause:
`list.remove` deletes the first element that compares equal. Fix: bisect to the run of equal keys
and delete the index whose element `is` the record you hold:

```python
from bisect import bisect_left, bisect_right

def remove_record(rows: list, record, key) -> None:
    lo, hi = bisect_left(rows, key(record), key=key), bisect_right(rows, key(record), key=key)
    for i in range(lo, hi):
        if rows[i] is record:
            del rows[i]
            return
    raise ValueError("record not in list")
```

**Symptom: deleting with the index `bisect_left` returned removes a neighbour when the value is
absent.** Cause: the insertion point exists whether or not the value does. Fix: check
`a[i] == target` before `del a[i]`, as `remove_value` does.

## Interview questions

**★ What does `bisect.insort` cost, and why?**
O(n) per call. Finding the position is O(log n) comparisons, but inserting into a Python list
shifts every later element one slot, which is O(n − i) — the documentation says the search is
*"dominated by the slow O(n) insertion step"*. For many inserts that means O(n²) moves in total.

**★ How would you add ten thousand items to a large sorted list?**
Not with ten thousand insorts. Extend the list and sort once: Timsort finds the existing sorted
list as a run, sorts the new items and merges, which is close to linear in the old size plus
k log k for the batch. If a new list is acceptable, `heapq.merge(old, sorted(batch))` does the
same in one pass.

**When is a sorted list with `insort` the wrong choice?**
When inserts and deletes are continuous and the list is large, because each one is O(n). If you
only need the minimum, a heap does it in O(log n). If you need ordered iteration, rank and range
queries with continuous updates, you need a structure with logarithmic insert and delete — a
balanced tree or a chunked sorted list like `sortedcontainers.SortedList` — or a database index if
the data is shared or durable.

**Is `bisect` thread-safe?**
No, and unlike `heapq`, the documentation says so explicitly: concurrent use on the same sequence
is undefined behaviour, and concurrent `insort_left` may leave the list unsorted. Guard the
search and the insert with one lock.

**How is `insort` different on a list subclass?**
For an exact `list` it inserts directly in C; for anything else, including subclasses, it calls
the object's `insert` method. Overriding `insert` therefore intercepts insort, and overriding only
`append` does not.

---

← Prev: [07b · The `key=` parameter and its asymmetry](07b-the-key-parameter.md) · [Topic index](README.md) · Next → [09 · Range queries on sorted data](09-range-queries.md)
