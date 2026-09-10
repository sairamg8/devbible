---
title: "A heap cannot find or remove an arbitrary entry, so cancellation and re-prioritisation are done by marking the old entry dead and pushing a new one — which is O(log n) until the dead entries outnumber the live ones, and then it is a memory leak unless you compact"
sidebar_label: "05b · Removing and re-prioritising entries"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`heapq` Priority Queue Implementation Notes](https://docs.python.org/3.14/library/heapq.html#priority-queue-implementation-notes) (the `add_task` / `remove_task` / `pop_task` recipe) and CPython **v3.14.7** source — [`Lib/sched.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/sched.py) (lines 87–96, `cancel`), labelled as implementation detail. Target: **Python 3.14.7**. **No sandbox run, no timings.**

**A heap has no index. To cancel a job you must first find its entry — an O(n) scan — and then take it out of the middle of the array, which breaks the invariant on two paths. The standard library shows two answers. `sched.scheduler.cancel` pays in full every time: `list.remove` plus `heapify`, O(n) per cancel. The documentation's recipe pays nothing up front: a dictionary maps each task to its live entry, cancelling marks that entry dead in place, and `pop` throws dead entries away when they surface — every operation O(log n). The catch is that dead entries still occupy the heap until they reach the root, so a workload that cancels most of what it schedules — request timeouts are the classic — grows without bound, reports the wrong queue length, and peeks at corpses. asyncio's event loop has exactly that workload and handles it by rebuilding the heap once more than half of it is dead — that side, and Dijkstra's use of the same stale-entry trick, is [05c](05c-stale-entries-and-compaction.md). Re-prioritising is the same operation as cancelling: kill the old entry, push a new one.**

## Why the middle of a heap is off-limits

> *"Removing the entry or changing its priority is more difficult because it would break the heap
> structure invariants."*

Removing index `i` leaves a hole that must be filled — by the last element, which then has to
move either up or down from `i` depending on how it compares with its new neighbours. `heapq`
exposes no public function for that, and even if it did, you would still need `i`: the heap
functions do not report where they move things, so nothing outside the module can keep a
position map up to date. Both halves of "delete this task" are therefore O(n) with the public
API, unless you avoid doing them at all.

## Option 1: remove and re-heapify

`sched` does the straightforward thing:

```python
# Lib/sched.py, v3.14.7 — scheduler.cancel
def cancel(self, event):
    """Remove an event from the queue.

    This must be presented the ID as returned by enter().
    If the event is not in the queue, this raises ValueError.

    """
    with self._lock:
        self._queue.remove(event)
        heapq.heapify(self._queue)
```

`list.remove` scans for the first entry *equal* to the argument — O(n) comparisons with `==`
— and shifts the tail left; `heapify` rebuilds in O(n). For a queue of a few hundred entries
with occasional cancels this is simple and correct. It becomes the bottleneck when cancels are
as common as pushes, because every cancel is a full pass over the queue.

## Option 2: lazy deletion — the documentation's recipe

> *"Finding a task can be done with a dictionary pointing to an entry in the queue."*

> *"So, a possible solution is to mark the entry as removed and add a new entry with the revised
> priority"*

The recipe, as the documentation gives it, with its imports added:

```python
import itertools
from heapq import heappush, heappop

pq = []                         # list of entries arranged in a heap
entry_finder = {}               # mapping of tasks to entries
REMOVED = '<removed-task>'      # placeholder for a removed task
counter = itertools.count()     # unique sequence count

def add_task(task, priority=0):
    'Add a new task or update the priority of an existing task'
    if task in entry_finder:
        remove_task(task)
    count = next(counter)
    entry = [priority, count, task]
    entry_finder[task] = entry
    heappush(pq, entry)

def remove_task(task):
    'Mark an existing task as REMOVED.  Raise KeyError if not found.'
    entry = entry_finder.pop(task)
    entry[-1] = REMOVED

def pop_task():
    'Remove and return the lowest priority task. Raise KeyError if empty.'
    while pq:
        priority, count, task = heappop(pq)
        if task is not REMOVED:
            del entry_finder[task]
            return task
    raise KeyError('pop from an empty priority queue')
```

Why each piece is the way it is:

- **Entries are lists** because `remove_task` mutates one in place. A tuple could not be marked.
- **Only the last slot is overwritten.** The priority and count stay, so the dead entry still
  compares exactly as it did and the heap invariant is untouched. Overwriting the priority
  instead would corrupt the heap — [01](01-the-heap-invariant.md).
- **The dict maps task → entry**, so tasks must be hashable; it is also the only accurate
  record of which tasks are live.
- **Update is remove-then-add.** `add_task` on an existing task kills the old entry and pushes a
  fresh one with a new count. A re-prioritised task therefore also goes to the back of its new
  priority class — usually what you want.
- **`pop_task` raises `KeyError`, not `IndexError`**, when nothing live is left.

## When the dead outnumber the living

Every one of those operations is O(log n) in the size of the heap *including* the dead entries,
and dead entries leave only when they reach the root. What that does to queue length, peeks and
memory, how asyncio bounds it, and a queue class that compacts itself are
[05c](05c-stale-entries-and-compaction.md).

## Gotchas

### A string sentinel that can collide with a real task
**Symptom.** Tasks whose value happens to equal the placeholder text are silently skipped —
typically right after a reviewer "tidied" `task is not REMOVED` into `task != REMOVED`.
**Cause.** The recipe's `REMOVED = '<removed-task>'` is a string, so it is only distinguishable
from real string tasks by identity. With `!=` any equal task is treated as dead; with `is`, the
recipe depends on no real task ever being that very object, which Python does not promise for
equal strings either way.
**Fix.** Use a sentinel that cannot equal anything else, and compare by identity:

```python
REMOVED = object()          # unique; equal to nothing but itself
if task is not REMOVED:
    ...
```

### Cancelling by overwriting the priority
**Symptom.** After "cancel = set priority to infinity", other jobs start coming out of order.
**Cause.** Changing a compared field of an entry that is in the heap breaks the invariant on its
path; the entry does not move.
**Fix.** Leave the priority and count alone and mark only the payload slot, as the recipe does.

### `list.remove` plus `heapify` on every cancel
**Symptom.** A bulk "cancel all jobs for this tenant" takes minutes on a large queue.
**Cause.** Each cancel scans and rebuilds: O(n) per cancel, O(n × k) for k cancels.
**Fix.** Mark all k dead and rebuild once:

```python
for task_id in tenant_task_ids:
    entry_finder.pop(task_id)[-1] = REMOVED      # mark: O(1) each
pq[:] = [e for e in pq if e[-1] is not REMOVED]  # one O(n) pass, same list object
heapq.heapify(pq)                                # one O(n) rebuild
```

### `del heap[i]` or `heap.remove(entry)` without repairing the heap
**Symptom.** Pops go subtly out of order after an admin "remove job" action.
**Cause.** Deleting from the middle shifts every later element one slot left — every parent/child
relationship after `i` changes.
**Fix.** Follow it with `heapq.heapify(heap)`, or do not delete at all and mark instead.

### Unhashable tasks in the index
**Symptom.** `TypeError: unhashable type: 'dict'` from `add_task`.
**Cause.** `entry_finder` is a dict keyed by the task.
**Fix.** Key the index by the task's identifier and carry the object in the entry:
`entry = [priority, count, job]; entry_finder[job["id"]] = entry`.

## Interview questions

**★ How do you support cancelling and re-prioritising tasks in a `heapq` priority queue?**
Keep a dictionary from task to its heap entry, store entries as mutable lists, and on cancel mark
the entry's payload slot with a sentinel instead of removing it; `pop` discards entries carrying
the sentinel. Re-prioritising is cancel plus a fresh push with a new count. Every operation stays
O(log n) and the heap invariant is never touched, because the compared fields of an entry never
change. This is the documentation's own recipe.

**Why does the recipe store lists and overwrite only the last element?**
A tuple cannot be changed after it is pushed, and the entry must be marked in place because the
heap holds a reference to that exact object. Only the payload slot is overwritten so that the
entry keeps its priority and count and therefore its position stays valid.

**Why not track each entry's index so it can be removed in O(log n)?**
Because the heap functions move elements without telling you, so no external index stays
correct. An indexed heap with true decrease-key needs its own sift implementation that updates a
position map on every swap — possible, but it means not using `heapq`.

**What does `sched.scheduler.cancel` cost?**
O(n): it calls `list.remove` on the queue, which scans with `==` and shifts the tail, then
`heapq.heapify` to restore the invariant. Fine for a small scheduler; the wrong model for
thousands of cancellations per second.

---

← Prev: [05 · Priority queues — ties and the counter](05-priority-queues.md) · [Topic index](README.md) · Next → [05c · Stale entries and compaction](05c-stale-entries-and-compaction.md)
