---
title: "Lazy deletion leaves dead entries in the heap until they surface — so length, peeks and memory all lie until you compact, the way asyncio does at half dead, and Dijkstra's algorithm is the same trick with 'stale' in place of 'cancelled'"
sidebar_label: "05c · Stale entries and compaction"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`heapq` Priority Queue Implementation Notes](https://docs.python.org/3.14/library/heapq.html#priority-queue-implementation-notes) and CPython **v3.14.7** [`Lib/asyncio/base_events.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/asyncio/base_events.py) (lines 55–62 and 1972–2006, cancelled-timer cleanup), labelled as implementation detail — the thresholds are internal constants, not documented API. Target: **Python 3.14.7**. **No sandbox run, no timings.**

**[05b](05b-removal-and-update.md) makes cancel and update O(log n) by leaving the old entry in the heap, marked dead. That is only half a design. Until a dead entry works its way to the root it still counts in `len()`, can be the entry you peek at, and still costs memory — and a workload that cancels most of what it schedules, such as per-request timeouts, ends up with a heap that is almost entirely dead. The fix is compaction: when the dead exceed a fraction of the heap, filter them out and `heapify` in O(n), which amortises to O(1) per cancel. asyncio's event loop does exactly this at half dead with a floor of a hundred timers. And the textbook use of a heap in a graph — Dijkstra's shortest paths — relies on the same idea without any marking at all: push a better distance as a new entry and ignore the stale one when it surfaces.**

## What lazy deletion costs

Every operation is O(log n) — in the size of the heap *including* dead entries. Three things go
wrong once dead entries accumulate:

| Symptom | Why | Correct form |
|---|---|---|
| queue-depth metric too high; backpressure triggers early | `len(pq)` counts dead entries | `len(entry_finder)` |
| peeking at the next due time returns a cancelled job | `pq[0]` may be dead | purge dead entries from the head, then peek |
| memory grows although the live queue is small | a dead entry leaves only when it reaches the root | compact when dead entries dominate |

The third is the one that pages someone. Picture a service that schedules a 30-second timeout
for every outbound request and cancels it when the response arrives — 99% of timeouts are
cancelled, and each cancelled one sits in the heap until 30 seconds have passed and it drifts
to the top. At high request rates the heap is almost entirely dead entries.

## Compaction: what asyncio does

The event loop keeps `call_later` timers in a heap and cancels them lazily — cancelling a
`TimerHandle` only increments a counter. On every loop iteration it decides whether to clean up
(v3.14.7, `Lib/asyncio/base_events.py`):

```python
# Lib/asyncio/base_events.py, v3.14.7, lines 57 and 62
_MIN_SCHEDULED_TIMER_HANDLES = 100
_MIN_CANCELLED_TIMER_HANDLES_FRACTION = 0.5

# BaseEventLoop._run_once, lines 1984–2006 (abridged to the heap handling)
sched_count = len(self._scheduled)
if (sched_count > _MIN_SCHEDULED_TIMER_HANDLES and
    self._timer_cancelled_count / sched_count >
        _MIN_CANCELLED_TIMER_HANDLES_FRACTION):
    new_scheduled = []
    for handle in self._scheduled:
        if handle._cancelled:
            handle._scheduled = False
        else:
            new_scheduled.append(handle)
    heapq.heapify(new_scheduled)
    self._scheduled = new_scheduled
    self._timer_cancelled_count = 0
else:
    while self._scheduled and self._scheduled[0]._cancelled:
        self._timer_cancelled_count -= 1
        handle = heapq.heappop(self._scheduled)
        handle._scheduled = False
```

Once the heap holds more than 100 timers and more than half of them are cancelled, it filters
the list and re-heapifies — O(n), but at most once per n/2 cancellations, so amortised O(1)
per cancel. Otherwise it only pops dead entries off the top so that `_scheduled[0]` is live when
it computes how long to sleep. These thresholds are internal constants, not documented API.

The same two moves turned into a queue class you can own:

```python
import heapq
import itertools
from collections.abc import Hashable

class CancellableQueue:
    """Priority queue with O(log n) cancel and update; dead entries are compacted away."""

    _REMOVED = object()                     # identity-only sentinel: can never equal a task

    def __init__(self) -> None:
        self._heap: list[list] = []
        self._live: dict[Hashable, list] = {}
        self._seq = itertools.count()
        self._dead = 0

    def push(self, task: Hashable, priority: float) -> None:
        if task in self._live:
            self.cancel(task)
        entry = [priority, next(self._seq), task]
        self._live[task] = entry
        heapq.heappush(self._heap, entry)

    def cancel(self, task: Hashable) -> None:
        entry = self._live.pop(task)        # KeyError if not queued
        entry[-1] = self._REMOVED
        self._dead += 1
        if len(self._heap) > 100 and self._dead * 2 > len(self._heap):
            self._heap = [e for e in self._heap if e[-1] is not self._REMOVED]
            heapq.heapify(self._heap)
            self._dead = 0

    def _purge_head(self) -> None:
        while self._heap and self._heap[0][-1] is self._REMOVED:
            heapq.heappop(self._heap)
            self._dead -= 1

    def peek(self) -> tuple[float, Hashable]:
        self._purge_head()
        priority, _seq, task = self._heap[0]  # IndexError if empty
        return priority, task

    def pop(self) -> Hashable:
        self._purge_head()
        _priority, _seq, task = heapq.heappop(self._heap)
        del self._live[task]
        return task

    def __len__(self) -> int:
        return len(self._live)
```

## Dijkstra without decrease-key: stale entries by comparison

Shortest-path search needs "lower this node's distance" whenever a better route is found — a
decrease-key the heap does not have. The standard `heapq` answer skips the marking entirely:
push the node again with its new distance, and when an entry is popped, discard it if its
distance is worse than the best already recorded. The old entry is stale by comparison, not by a
sentinel. A routing example over a service mesh, with latencies as edge weights:

```python
import heapq
import math

def lowest_latency(
    graph: dict[str, list[tuple[str, float]]], source: str
) -> dict[str, float]:
    best = {source: 0.0}
    frontier: list[tuple[float, str]] = [(0.0, source)]
    while frontier:
        dist, node = heapq.heappop(frontier)
        if dist > best.get(node, math.inf):
            continue                                   # a stale entry: a shorter path won
        for neighbour, latency_ms in graph.get(node, ()):
            candidate = dist + latency_ms
            if candidate < best.get(neighbour, math.inf):
                best[neighbour] = candidate
                heapq.heappush(frontier, (candidate, neighbour))
    return best
```

The heap can hold up to one entry per edge rather than one per node, so its size is O(E) and the
running time O(E log E) — for a graph without an absurd number of edges per node, the same order
as O(E log V). Ties between equal distances fall through to comparing node names, which are
strings and order fine; with node objects that do not order, add a counter as in
[05](05-priority-queues.md).

## Gotchas

### Queue depth reported from `len(pq)`
**Symptom.** Autoscaling adds workers for a backlog that does not exist; the dashboard shows
thousands queued while the workers are idle.
**Cause.** With lazy deletion the heap holds dead entries. Its length is not the number of
tasks.
**Fix.** Count live tasks from the index: `len(entry_finder)` — or `len(queue)` on a class whose
`__len__` returns that, as above.

### Memory growth from cancelled timeouts
**Symptom.** A gateway's RSS climbs steadily under load and drops only when traffic stops.
**Cause.** Almost every scheduled timeout is cancelled, and each dead entry stays in the heap
until its deadline brings it to the root.
**Fix.** Compact once dead entries are more than half the heap, as asyncio does — the `cancel`
method above rebuilds with a list comprehension and `heapify`.

### Peeking at a cancelled entry
**Symptom.** A scheduler sleeps until the deadline of a job that was cancelled minutes ago, then
wakes up with nothing to do — or, worse, reports that job as "next".
**Cause.** `pq[0]` is the smallest entry, dead or alive.
**Fix.** Pop dead entries off the top before every peek (`_purge_head` above).

### Dijkstra that processes a node more than once
**Symptom.** A route calculation is far slower than expected on a dense graph, and neighbours
are relaxed repeatedly from a node that was already finished.
**Cause.** Without the stale check, every outdated entry for a node is expanded again when it is
popped.
**Fix.** Skip entries whose distance is worse than the recorded best, before expanding:

```python
dist, node = heapq.heappop(frontier)
if dist > best.get(node, math.inf):
    continue
```

## Interview questions

**★ What does lazy deletion cost, and how do you keep it bounded?**
Dead entries stay in the heap until they reach the root, so the heap's length and memory reflect
everything ever scheduled and not yet due, not what is live. Under cancel-heavy workloads that is
unbounded growth. Bound it by compacting — filter out dead entries and `heapify` — whenever they
exceed a fraction of the heap. Rebuilding at a fixed fraction costs O(n) once per O(n) cancels, so
the amortised cost per cancel is constant. asyncio's event loop uses 50% with a floor of 100
timers.

**What does asyncio's event loop do with cancelled timers?**
Cancelling a timer only marks the handle and increments a counter. On each loop iteration, if
more than 100 timers are scheduled and more than half are cancelled, the loop rebuilds the timer
list without them and re-heapifies; otherwise it just pops cancelled handles off the top so the
next wake-up time is computed from a live timer. Those thresholds are private constants in
`base_events.py`, not documented behaviour.

**★ How do you run Dijkstra's algorithm with `heapq`, which has no decrease-key?**
Push a new `(distance, node)` entry whenever a shorter path to the node is found, and leave the
old entry where it is. When an entry is popped, compare its distance with the best distance
recorded for that node; if it is larger, the entry is stale and is skipped. The heap then holds at
most one entry per edge, giving O(E log E) time, and no entry is ever modified — which is what
keeps the heap valid.

---

← Prev: [05b · Removing and re-prioritising entries](05b-removal-and-update.md) · [Topic index](README.md) · Next → [05d · Heaps shared by threads and tasks](05d-heaps-across-threads.md)
