---
title: "A deque with maxlen is a ring buffer that silently throws away the oldest item on every append past the limit — ideal for the last N of anything, a data-loss bug in a work queue, and a trap when maxlen is 0 or when deque(d) quietly drops the bound"
sidebar_label: "04b · Bounded deques"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.deque`](https://docs.python.org/3.14/library/collections.html#deque-objects) (*maxlen*, `insert`, the `tail` and `moving_average` recipes), [`itertools` recipes](https://docs.python.org/3.14/library/itertools.html#itertools-recipes) (`tail`, `consume`, `sliding_window`), [`queue`](https://docs.python.org/3.14/library/queue.html). Trimming, `insert` and constructor behaviour read from CPython **v3.14.7** [`Modules/_collectionsmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_collectionsmodule.c) (`NEEDS_TRIM`, `deque_append_lock_held`, `deque_insert_impl`, `deque_init_impl`, `deque_copy_impl`, `deque___reduce___impl`). Target: **Python 3.14.7**. **No sandbox run.**

**Give a deque a `maxlen` and it never holds more than that many items: *"Once a bounded length deque is full, when new items are added, a corresponding number of items are discarded from the opposite end."* The discard is silent — no exception, no return value, no callback. That one behaviour is exactly right for everything whose job is "the most recent N": the last hundred log lines, the last ten error messages for a health page, a moving average, a sliding window over a stream, a bounded undo history. It is exactly wrong for a queue of work, where "discarded from the opposite end" means jobs that were accepted and will never run. The rest of this chunk is the edges: `maxlen=0` accepts everything and keeps nothing, `insert` on a full deque raises where `append` does not, `appendleft` on a full deque evicts the *newest* item, `maxlen` cannot be changed, and `deque(existing)` builds an unbounded copy.**

## The rule, and where it lives in the source

> *"If *maxlen* is not specified or is `None`, deques may grow to an arbitrary length. Otherwise, the
> deque is bounded to the specified maximum length. Once a bounded length deque is full, when new
> items are added, a corresponding number of items are discarded from the opposite end. Bounded
> length deques provide functionality similar to the `tail` filter in Unix. They are also useful for
> tracking transactions and other pools of data where only the most recent activity is of interest."*

In `v3.14.7` the trim is inside the append itself. The comment above `NEEDS_TRIM`: *"After an item is added to a deque, we check to see if the size has grown past the limit. If it has, we get the size back down to the limit by popping an item off of the opposite end. The methods that can trigger this are append(), appendleft(), extend(), and extendleft()."* So `append` on a full deque adds on the right and then pops the leftmost item; `appendleft` adds on the left and pops the *rightmost*. The popped item's reference is simply dropped.

```python
from collections import deque

recent = deque(maxlen=3)
for event in ["login", "view", "view", "purchase"]:
    recent.append(event)

recent                     # deque(['view', 'view', 'purchase'], maxlen=3) — 'login' is gone
recent.maxlen              # 3 — read-only
```

## What it is for

**The last N lines of a file** — the documentation's `tail` recipe, and the itertools recipe for any iterable:

```python
def tail(filename, n=10):
    'Return the last n lines of a file'
    with open(filename) as f:
        return deque(f, n)
```

It reads the whole file — every line passes through the deque — but holds only `n` at a time, so memory is bounded by `n`, not by the file ([07b · `islice` bounds](../05-slicing/07b-islice-bounds.md) has the time-versus-memory argument).

**A ring buffer of recent events for a health or debug endpoint:**

```python
from collections import deque
from datetime import datetime, timezone

RECENT_ERRORS: deque[tuple[datetime, str]] = deque(maxlen=50)


def record_error(message: str) -> None:
    RECENT_ERRORS.append((datetime.now(timezone.utc), message))


def health() -> dict[str, object]:
    return {
        "recent_errors": [
            {"at": at.isoformat(), "message": message} for at, message in RECENT_ERRORS
        ],
    }
```

Memory is fixed at fifty entries forever, however many errors happen. `list(RECENT_ERRORS)` or iteration gives them oldest first.

**A sliding window over a stream** — the itertools recipe:

```python
from collections import deque
from itertools import islice


def sliding_window(iterable, n):
    "Collect data into overlapping fixed-length chunks or blocks."
    # sliding_window('ABCDEFG', 3) → ABC BCD CDE DEF EFG
    iterator = iter(iterable)
    window = deque(islice(iterator, n - 1), maxlen=n)
    for x in iterator:
        window.append(x)
        yield tuple(window)
```

**A moving average** — the documentation's recipe, which keeps a running sum and uses an *unbounded* deque with an explicit `popleft`, because it needs the value that leaves the window in order to subtract it:

```python
import itertools
from collections import deque


def moving_average(iterable, n=3):
    # moving_average([40, 30, 50, 46, 39, 44]) --> 40.0 42.0 45.0 43.0
    # https://en.wikipedia.org/wiki/Moving_average
    it = iter(iterable)
    d = deque(itertools.islice(it, n-1))
    d.appendleft(0)
    s = sum(d)
    for elem in it:
        s += elem - d.popleft()
        d.append(elem)
        yield s / n
```

That choice is a pattern worth copying: **when you need to act on what falls out of the window, do not use `maxlen`** — the discard is silent, and the evicted item is gone before you can see it.

**A bounded undo history** — `history.append(state)` on every edit, `history.pop()` to undo; `maxlen` caps memory at the last N states and forgets the oldest.

## `maxlen=0`: accepts everything, keeps nothing

`maxlen` may be `0`, and `deque_extend_impl` has a special case for it — *"Shortcut for the extend/extendleft methods when maxlen == 0"* — that runs the iterator to exhaustion and discards every item. The itertools `consume` recipe uses exactly that on purpose (*"Use functions that consume iterators at C speed."*):

```python
def consume(iterator, n=None):
    "Advance the iterator n-steps ahead. If n is None, consume entirely."
    # Use functions that consume iterators at C speed.
    if n is None:
        deque(iterator, maxlen=0)
    else:
        next(islice(iterator, n, n), None)
```

By accident, it is a buffer that is always empty. Configuration where `0` means "no limit" produces one:

```python
history = deque(maxlen=settings.history_size)          # 🔴 history_size = 0 → keeps nothing
history = deque(maxlen=settings.history_size or None)  # 0 → unbounded, as intended
```

A negative `maxlen` is rejected — `ValueError("maxlen must be non-negative")` in `deque_init_impl`.

## `insert` raises where `append` discards

> *"If the insertion would cause a bounded deque to grow beyond *maxlen*, an `IndexError` is raised."*

The source check is `if (deque->maxlen == Py_SIZE(deque))` → `IndexError("deque already at its maximum size")`. So on a full bounded deque, `append`, `appendleft`, `extend` and `extendleft` evict silently, and `insert` fails loudly — even `insert(len(d), x)`, which would otherwise be an append.

## The bound does not survive every copy

`maxlen` is set at construction and has no setter. What carries it over:

| Operation | Keeps `maxlen`? | Source |
|---|---|---|
| `d.copy()`, `copy.copy(d)` | ✅ | `deque_copy_impl` copies `maxlen` |
| `pickle` round trip | ✅ | `deque___reduce___impl` includes `maxlen` |
| `deque(d, d.maxlen)` | ✅ | explicit |
| `deque(d)` | ❌ — unbounded | a new deque with the default `maxlen=None` |
| `list(d)` then back | ❌ | |

To change the bound, build a new deque: `deque(d, maxlen=new)` fills from the left and trims as it goes, so shrinking keeps the *newest* `new` items.

## Backpressure is not what a bounded deque does

A work queue that must not grow without bound has two honest options: block the producer, or reject the item. A bounded deque does neither — it accepts the item and destroys an older one. `queue.Queue(maxsize=n)` blocks on `put` (or raises `queue.Full` from `put_nowait`), which is backpressure ([03b · The queue problem, and deque](../01-list-internals/03b-quadratic-patterns-and-deque.md) makes the data-loss case; [11d · Sharing a list between threads](../01-list-internals/11d-sharing-a-list-between-threads.md) makes the `Queue` case).

```python
import queue

jobs: queue.Queue[str] = queue.Queue(maxsize=1000)
jobs.put_nowait("resize:42")        # raises queue.Full when full — the caller learns about it
```

## Gotchas

**★ Symptom: accepted jobs never run, with no error anywhere, and only under burst load.** Cause: the queue is `deque(maxlen=n)`; each append past `n` silently discards the oldest waiting job. Fix: a work queue needs backpressure, not eviction.

```python
jobs: queue.Queue[Job] = queue.Queue(maxsize=1000)
jobs.put(job, timeout=5)              # blocks, then raises queue.Full
```

**★ Symptom: a history or audit buffer is always empty.** Cause: `maxlen=0` — typically a config value where 0 was meant as "unlimited" — keeps nothing. Fix: map zero to `None` explicitly.

```python
buffer = deque(maxlen=limit if limit > 0 else None)
```

**★ Symptom: a copied ring buffer grows without limit.** Cause: `deque(recent)` creates an unbounded deque; only `copy()`, `copy.copy` and pickling carry `maxlen`. Fix: copy the bound too.

```python
snapshot = recent.copy()              # or deque(recent, recent.maxlen)
```

**Symptom: `IndexError: deque already at its maximum size` from `insert`, when `append` on the same deque never fails.** Cause: `insert` refuses to grow a full bounded deque; the four append/extend methods evict instead. Fix: decide which item should go, then insert.

```python
if len(buffer) == buffer.maxlen:
    buffer.popleft()                  # evict deliberately
buffer.insert(position, item)
```

**Symptom: a "high-priority" item pushed with `appendleft` onto a full buffer evicts the most recent item.** Cause: `appendleft` trims from the right — the end that holds the newest entries. Fix: do not mix ends on a bounded buffer, or evict explicitly first.

```python
if len(buffer) == buffer.maxlen:
    buffer.popleft()
buffer.appendleft(urgent)
```

**Symptom: `AttributeError` on `buffer.maxlen = 200`.** Cause: `maxlen` is a read-only attribute with no setter. Fix: rebuild.

```python
buffer = deque(buffer, maxlen=200)
```

**Symptom: a moving total drifts because evicted values are never subtracted.** Cause: with `maxlen` the evicted item disappears inside `append`, so code that needed it never sees it. Fix: evict yourself, as the documentation's `moving_average` does.

```python
window.append(value)
total += value
if len(window) > size:
    total -= window.popleft()
```

**Symptom: a rate limiter built on `deque(maxlen=100)` allows bursts far above 100 per minute.** Cause: `maxlen` bounds a count, not a time span — it says nothing about how old the entries are. Fix: store timestamps and evict by age.

```python
import time

def allow(log: deque[float], limit: int, window_seconds: float) -> bool:
    now = time.monotonic()
    while log and now - log[0] > window_seconds:
        log.popleft()
    if len(log) >= limit:
        return False
    log.append(now)
    return True
```

## Interview questions

**★ What happens when you append to a full bounded deque?**
The item is added and one item is removed from the opposite end — the documentation: *"a corresponding number of items are discarded from the opposite end."* In CPython the trim happens inside the same call: `append` pops from the left, `appendleft` pops from the right, and `extend`/`extendleft` trim after each item. Nothing is raised and nothing is returned; the discarded object's reference is dropped. `insert` is the exception: it raises `IndexError` rather than growing a full deque.

**★ How do you get the last N lines of a large file without loading it?**
`deque(file_object, maxlen=n)` — the documentation's `tail` recipe. Every line is read once and passed through the deque, which holds at most `n` of them, so memory is proportional to `n` and time to the file length. The itertools recipe `iter(deque(iterable, maxlen=n))` is the same thing for any iterable. Seeking backwards from the end of the file is faster for a huge file, but it is byte-level work the deque does not do.

**★ Why is a bounded deque the wrong structure for a bounded work queue?**
Because it bounds memory by destroying accepted work. When full, each append silently evicts the oldest item, which in a work queue is the job that has waited longest. A bounded work queue needs backpressure: `queue.Queue(maxsize=n)` blocks the producer on `put`, or raises `queue.Full` from `put_nowait`, so the producer can slow down, retry or reject the request visibly.

**How would you implement a per-client rate limiter with a deque?**
Keep a deque of request timestamps per client. On each request, pop from the left while the oldest timestamp is outside the window, then allow the request only if the remaining length is under the limit, and append the current time. Both ends are O(1), and the deque holds at most `limit` timestamps. `maxlen` alone cannot do this, because it bounds the number of entries, not their age.

**What is `deque(iterator, maxlen=0)` for?**
Consuming an iterator entirely, fast, while keeping nothing — the itertools `consume` recipe, which notes that it *"consume[s] iterators at C speed"*. CPython special-cases `maxlen == 0` in `extend` and just runs the iterator to exhaustion. It is useful for driving an iterator for its side effects; by accident, it is a buffer that is always empty.

**How do you change the `maxlen` of an existing deque?**
You cannot; it is fixed at construction and read-only. Build a new one with `deque(old, maxlen=new_size)`. Because the constructor appends from the left and trims from the left, a smaller bound keeps the most recent items. Also note that `deque(old)` without the argument drops the bound entirely, while `old.copy()` and pickling preserve it.

---

← Prev: [04 · `deque` — the block list underneath](04-deque-the-block-list.md) · [Topic index](README.md)
