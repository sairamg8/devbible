---
title: "A heap has no rollback — when a comparison raises mid-sift, the pushed item is already in the list and the popped item is already gone, and a NaN priority never raises at all, it just leaves the heap wrong"
sidebar_label: "02b · When a comparison fails"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`heapq` documentation](https://docs.python.org/3.14/library/heapq.html) ([priority queue notes](https://docs.python.org/3.14/library/heapq.html#priority-queue-implementation-notes)) and CPython **v3.14.7** source — [`Modules/_heapqmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_heapqmodule.c) (lines 25–68 `siftdown`, 120–150 `heappush`, 152–220 `heappop`/`heapreplace`), [`Lib/heapq.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/heapq.py) (lines 133–162) and `Lib/test/test_heapq.py` (the mutating-comparison tests). 🔴 The state of a heap after a failed comparison is **read from the source — the documentation does not describe it**. Target: **Python 3.14.7**. **No sandbox run, no timings.**

**`heapq` has no transactions. Each function makes its structural change first — `heappush` appends, `heappop` detaches the root and moves the last leaf into its place — and then runs the comparisons that put things in order. If one of those comparisons raises, the function stops and returns the error with the structural change already made. The documentation is silent on this; the v3.14.7 C source is not, and it says the pushed item stays in the list and the popped item is released without being returned. The other failure is quieter: a comparison that returns `False` both ways, which is exactly what a `NaN` priority does, never raises and never alerts — it just lets the heap settle into an order that is not the invariant. Both are prevented the same way, before anything enters the heap: priorities that are totally ordered, and a unique counter so the payload is never compared.**

## When a comparison raises in the middle of a sift

Every sift step is one `<` between two of your elements. If that comparison raises — most
often a `TypeError` because two entries tied on priority and the payloads behind them have no
order — the operation stops where it is. The documentation says nothing about the heap's state
afterwards. The v3.14.7 C source is specific:

- **`heappush`** appends the item *before* sifting (`_PyList_AppendTakeRef`, then `siftdown`).
  If the sift fails, the function returns the error and the item **stays in the list** —
  possibly out of place.
- **`heappop`** removes the last element, stores it at index 0 and keeps its own reference to
  the old root, then sifts. If the sift fails, it releases that reference
  (`Py_DECREF(returnitem)`) and returns the error: the smallest item is **no longer in the heap
  and was never returned to you.** `heapreplace` has the same shape — the old root is dropped
  and the new item is in.

The pure-Python functions in `Lib/heapq.py` behave the same way for the same reason: the
`append` and the `heap[0] = lastelt` happen before the comparisons do.

```python
import heapq

queue: list[tuple[int, dict[str, str]]] = []
heapq.heappush(queue, (0, {"job": "rotate-keys"}))
heapq.heappush(queue, (1, {"job": "send-digest"}))
heapq.heappush(queue, (1, {"job": "reindex"}))     # compared only against the root: fine

heapq.heappop(queue)
# The last entry is moved to the root and sifted; on its way it is compared with
# (1, {"job": "send-digest"}) — equal priorities, so the dicts are compared: TypeError.
# Per the C source, (0, {"job": "rotate-keys"}) has already left the list: it is gone.
```

The fix is never a `try`/`except` around the pop — by then the entry is lost. It is making the
comparison total before anything enters the heap, with a unique counter in the second slot
([05](05-priority-queues.md) covers the pattern in full):

```python
import heapq
import itertools

_seq = itertools.count()
queue: list[tuple[int, int, dict[str, str]]] = []
heapq.heappush(queue, (1, next(_seq), {"job": "send-digest"}))
heapq.heappush(queue, (1, next(_seq), {"job": "reindex"}))   # (1, 0) < (1, 1): dicts never compared
```

A comparison that **changes the heap's length** — a `__lt__` that lazily loads something and
pushes it onto the same heap, or another thread appending mid-sift — is detected by the C
sift loops, which raise `RuntimeError` with the message `"list changed size during iteration"`
(`Modules/_heapqmodule.c`, lines 53–57) rather than reading past the end.

## Gotchas

### Retrying a push that raised, and ending up with duplicates
**Symptom.** After a `TypeError` from `heappush` is caught and the push retried with a fixed
entry, the job runs twice.
**Cause.** Per the v3.14.7 source the failed push had already appended the original entry.
**Fix.** Do not recover inside the heap. Make entries totally ordered so the push cannot raise:
`(priority, next(seq), payload)`. If a heap has already seen a failed comparison, rebuild it from
the source of truth rather than trusting its contents.

### Catching `TypeError` around `heappop` and carrying on
**Symptom.** The highest-priority job in a queue silently never runs; there is a logged
`TypeError` from the same minute.
**Cause.** A failed sift in `heappop` drops the item it was about to return.
**Fix.** The counter above, so the payload is never compared. An `except TypeError: continue`
around a pop hides data loss.

### A comparison that pushes onto the heap it is being compared in
**Symptom.** `RuntimeError: list changed size during iteration` from `heappush` or `heappop`,
in code that has no loop over the heap.
**Cause.** The C sift loops check the list's length after each comparison
(`Modules/_heapqmodule.c`, lines 53–57) and raise rather than index past the end. Something
inside the comparison — a lazily-loading `__lt__`, a property that schedules follow-up work on
the same queue, or another thread — changed the heap mid-sift.
**Fix.** Comparisons must be pure. Resolve anything lazy before the push, and give the heap one
owner or one lock ([05d](05d-heaps-across-threads.md)):

```python
entry = (job.resolve_priority(), next(_seq), job)   # any I/O happens here, not in __lt__
heapq.heappush(queue, entry)
```

### A `NaN` priority
**Symptom.** A heap of `(score, seq, item)` entries starts returning items out of order after one
record with a missing score arrives; nothing raises.
**Cause.** `float("nan")` compares `False` against everything with `<`, so every sift step that
meets it concludes "not smaller" and stops or moves the wrong way. The invariant is not
checked, so the heap simply stops being one.
**Fix.** Refuse or map `NaN` at the boundary, before the push:

```python
import heapq
import math

def push_scored(heap: list[tuple[float, int, str]], score: float, seq: int, item: str) -> None:
    if math.isnan(score):
        raise ValueError(f"unscored item {item!r}")      # or: score = math.inf to sort it last
    heapq.heappush(heap, (score, seq, item))
```

## Interview questions

**★ What happens to a heap if a comparison raises during `heappop`?**
The documentation does not say. In CPython 3.14.7 the pop has already removed the last element,
written it into slot 0 and taken ownership of the old root before it starts comparing; on
failure it releases the old root and returns the error. So the smallest item is gone — neither in
the heap nor returned — and the heap may no longer satisfy the invariant. A failed `heappush`,
by contrast, leaves the new item appended. The practical conclusion is that entries must be
totally ordered before they go in; there is no safe recovery afterwards.

**Why does `heappush` on `(priority, payload)` tuples pass every test and fail in production?**
Tuple comparison only reaches the payload when the priorities are equal, and a test suite
with distinct priorities never produces that tie. Production does. Then the payloads are
compared, and dicts, most dataclasses and arbitrary objects have no order, so `<` raises. A
unique counter between priority and payload means the comparison is always decided before the
payload.

**What does a `NaN` priority do to a heap?**
It corrupts it silently. Every `<` involving `NaN` is `False`, so the sift logic treats it as
neither smaller nor larger than its neighbours, and items end up where the invariant does not
hold. No exception is raised and no later operation detects it. Validate priorities at the point
where they enter the heap — reject `NaN`, or map it to `math.inf` or `-math.inf` deliberately.

---

← Prev: [02 · push, pop, replace, pushpop](02-push-pop-replace-pushpop.md) · [Topic index](README.md) · Next → [03 · `nlargest` and `nsmallest`](03-nlargest-and-nsmallest.md)
