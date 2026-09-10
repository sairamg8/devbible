---
title: "The heapq documentation promises nothing about threads, and even where CPython 3.14 locks each call, 'if heap: heappop(heap)' is two calls — share a priority queue between threads through queue.PriorityQueue or your own lock, between coroutines through asyncio.PriorityQueue, and between processes through a database"
sidebar_label: "05d · Heaps shared by threads and tasks"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`heapq`](https://docs.python.org/3.14/library/heapq.html) (no thread-safety statement, confirmed on the live page), [`bisect`](https://docs.python.org/3.14/library/bisect.html) (its thread-safety note, for contrast), [`queue`](https://docs.python.org/3.14/library/queue.html), [asyncio queues](https://docs.python.org/3.14/library/asyncio-queue.html) — and CPython **v3.14.7** source: [`Modules/clinic/_heapqmodule.c.h`](https://github.com/python/cpython/blob/v3.14.7/Modules/clinic/_heapqmodule.c.h) (`Py_BEGIN_CRITICAL_SECTION(heap)` in every function), [`Lib/queue.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/queue.py) (lines 280–296), [`Modules/itertoolsmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/itertoolsmodule.c) (lines 3650–3678, `count_next`) — all labelled as implementation detail. Target: **Python 3.14.7**. **No sandbox run, no timings.**

**A heap is a list plus a convention, and a list shared between threads needs a lock for anything made of more than one step. The `heapq` documentation makes no thread-safety claim at all. CPython 3.14 does wrap each C heap function in a critical section on the list — so two concurrent `heappush` calls on a free-threaded build will not interleave inside the list — but that is an implementation detail, it does not cover `nlargest`, `nsmallest` or `merge` (which are Python code), and it cannot make *your* sequence atomic: `if heap: heappop(heap)`, peek-then-`heapreplace`, or the lazy-deletion recipe's dict-plus-heap updates are each several calls that another thread can land between. The standard library already has the locked version: `queue.PriorityQueue` is `heappush`/`heappop` behind a mutex with blocking `get`. What it cannot do — peek, cancel, or "sleep until the earliest item is due" — you build with one `threading.Condition` around a plain heap. And between processes there is no shared heap; the queue belongs in a database or a broker.**

## What is and is not promised

The `bisect` page carries an explicit warning; the `heapq` page has none, in either direction:

> *"The functions in this module are not thread-safe. If multiple threads concurrently use
> `bisect` functions on the same sequence, this may result in undefined behaviour."* — `bisect`

For `heapq` the only evidence is the source. Every C function is declared with
`@critical_section heap`, and the generated wrapper brackets the call with
`Py_BEGIN_CRITICAL_SECTION(heap)` / `Py_END_CRITICAL_SECTION()`; the module declares
`Py_MOD_GIL_NOT_USED`. On the free-threaded build that serialises heap *calls* on one list against
each other and against other operations that lock the same list. It does not:

- make any **sequence** of calls atomic — the check in `if heap:` and the pop that follows are
  separate, and the heap can empty in between;
- cover the **Python-level** functions `nlargest`, `nsmallest` and `merge`, which iterate the
  input like any other Python loop;
- protect code that reads or writes the list **without** the heap functions — `heap[0]`,
  `len(heap)`, a slice, the lazy-deletion dict;
- say anything about comparisons that run Python code (`__lt__` on your own class) while the call
  is in progress. The documentation does not describe that case, and this page does not guess.

The list-level guarantees on the free-threaded build, and why check-then-act on a list is never
atomic in either build, are [01 · `list` — thread safety under free-threading](../01-list-internals/11c-thread-safety-under-free-threading.md).
The rule that falls out: **one owner, or one lock around every access.**

## Threads: `queue.PriorityQueue`

> *"The `queue` module implements multi-producer, multi-consumer queues. It is especially useful in
> threaded programming when information must be exchanged safely between multiple threads. The
> `Queue` class in this module implements all the required locking semantics."*

> *"The lowest valued entries are retrieved first (the lowest valued entry is the one that would
> be returned by `min(entries)`). A typical pattern for entries is a tuple in the form:
> `(priority_number, data)`."*

Underneath it is exactly this module:

```python
# Lib/queue.py, v3.14.7 — PriorityQueue
class PriorityQueue(Queue):
    def _init(self, maxsize):
        self.queue = []
    def _qsize(self):
        return len(self.queue)
    def _put(self, item):
        heappush(self.queue, item)
    def _get(self):
        return heappop(self.queue)
```

So everything about entry design from [05](05-priority-queues.md) still applies — the `(priority,
data)` form the documentation suggests has the same tie problem, and needs the counter:

```python
import itertools
import queue
import threading

_seq = itertools.count()
jobs: queue.PriorityQueue[tuple[int, int, str]] = queue.PriorityQueue(maxsize=10_000)

def run_job(job_id: str) -> None:
    print(f"running {job_id}")

def submit(priority: int, job_id: str) -> None:
    jobs.put((priority, next(_seq), job_id))       # blocks while the queue is full

def worker() -> None:
    while True:
        _priority, _seq_no, job_id = jobs.get()    # blocks while the queue is empty
        try:
            run_job(job_id)
        finally:
            jobs.task_done()

for _ in range(4):
    threading.Thread(target=worker, daemon=True).start()
```

Calling `next(_seq)` from several producer threads is safe in CPython 3.14.7: `count_next` in
`Modules/itertoolsmodule.c` increments in C without releasing the GIL on the default build and
with an atomic compare-exchange on the free-threaded build, so no two calls return the same value.
That is source, not documentation. What it does not give you is FIFO *across* producers: two
threads can take counts in one order and reach `put` in the other.

What `PriorityQueue` deliberately lacks is anything beyond put and get: no peek, no cancel, no
change of priority, and `qsize()` is advisory — *"Return the approximate size of the queue. Note,
qsize() > 0 doesn't guarantee that a subsequent get() will not block"*. Its `queue` attribute is
the raw heap, but reading it from another thread without the queue's internal lock is the
unsynchronised access this page is about.

## Threads, when you need more than put and get: a condition around a heap

A retry queue with backoff — "run this again at time T" — needs the consumer to sleep until the
*earliest* deadline, and to wake early if a producer inserts something even earlier.
`PriorityQueue.get` cannot express "not before T". One `threading.Condition` guarding a plain
heap can:

```python
import heapq
import itertools
import threading
import time
from typing import Generic, TypeVar

T = TypeVar("T")

class DelayQueue(Generic[T]):
    """Items become available at their due time; earliest first; FIFO among equal times."""

    def __init__(self) -> None:
        self._heap: list[tuple[float, int, T]] = []
        self._seq = itertools.count()
        self._cond = threading.Condition()

    def put(self, item: T, delay_s: float) -> None:
        with self._cond:
            due_at = time.monotonic() + delay_s
            heapq.heappush(self._heap, (due_at, next(self._seq), item))
            self._cond.notify()               # the new item may be due before the one awaited

    def get(self) -> T:
        with self._cond:
            while True:
                if not self._heap:
                    self._cond.wait()
                    continue
                remaining = self._heap[0][0] - time.monotonic()
                if remaining <= 0:
                    return heapq.heappop(self._heap)[2]
                self._cond.wait(timeout=remaining)   # wake at the deadline or on a new put
```

Every read and write of `_heap` happens with the condition's lock held, so the peek, the check
and the pop are one atomic step from any other thread's point of view. `time.monotonic()` rather
than `time.time()` keeps a wall-clock adjustment from releasing or stranding everything at once.
Cancellation, if you need it, is [05b](05b-removal-and-update.md)'s recipe inside the same lock.

## Coroutines: `asyncio.PriorityQueue`

> *"asyncio queues are designed to be similar to classes of the `queue` module. Although asyncio
> queues are not thread-safe, they are designed to be used specifically in async/await code."*

Within one event loop, a plain heap needs no lock at all as long as no `await` sits between the
check and the act — coroutines only switch at `await`. `asyncio.PriorityQueue` adds what a bare
heap cannot: `await queue.get()` suspends until an item arrives. The entry design is unchanged;
push `(priority, next(seq), item)`. From another thread, hand items to the loop with
`loop.call_soon_threadsafe(queue.put_nowait, entry)` rather than touching the queue directly.

## Processes: there is no shared heap

A list lives in one process's memory. Several worker processes — gunicorn workers, Celery
workers, Kubernetes pods — each have their own, and a "priority queue" built from `heapq` in one of
them is invisible to the others and lost on restart. The shared, durable version is a table
ordered by an index, claimed row by row:

```sql
SELECT id, payload
FROM jobs
WHERE status = 'queued' AND run_at <= now()
ORDER BY priority, run_at, id
LIMIT 1
FOR UPDATE SKIP LOCKED;
```

`ORDER BY priority, run_at, id` is the `(priority, time, count)` entry; `SKIP LOCKED` lets
concurrent workers each claim a different row instead of queuing on the same lock. Whether the
queue belongs in the database, a broker or a hosted service is a separate decision —
[Next.js — broker, database or hosted queue](../../../../nextjs/pages/15-databases-apis-and-full-stack-patterns/04g-broker-database-or-hosted-queue.md)
argues it from the transaction side.

## Gotchas

**★ Symptom: `IndexError: index out of range` from `heappop` in a worker that checked
`if heap:` on the line before.** Cause: another thread popped the last item between the check and
the pop — two calls, no lock. Fix: hold one lock across both, or let `queue.PriorityQueue.get`
do the waiting:

```python
with heap_lock:
    item = heapq.heappop(heap) if heap else None
```

**Symptom: occasional out-of-order pops, or `RuntimeError: list changed size during iteration`,
from a heap several threads push to.** Cause: unsynchronised shared use; the per-call critical
section is an implementation detail of the free-threaded build, not a promise, and does not cover
your other accesses. Fix: one owner thread, `queue.PriorityQueue`, or a lock around every access.

**Symptom: a worker sleeps for the full timeout although an urgent retry was queued a moment
later.** Cause: the consumer computed its sleep from the old head and nothing woke it. Fix:
`notify()` the condition on every `put`, and re-check the head after every wake-up, as
`DelayQueue` does.

**Symptom: a thread-pool callback puts into an `asyncio.PriorityQueue` and the awaiting coroutine
never wakes, or the queue's internal state goes inconsistent.** Cause: asyncio queues are not
thread-safe. Fix:

```python
loop.call_soon_threadsafe(async_jobs.put_nowait, (priority, next(_seq), job))
```

**Symptom: backpressure logic based on `jobs.qsize()` lets the queue overflow or blocks
producers needlessly.** Cause: `qsize()` is documented as approximate. Fix: bound with
`PriorityQueue(maxsize=N)` and let `put` block or raise `queue.Full`.

**Symptom: jobs queued in a `heapq` list vanish on deploy, and each web worker runs a different
subset.** Cause: the heap lives in one process's memory. Fix: a durable queue — the `SKIP LOCKED`
table above, or a broker.

## Interview questions

**★ Is `heapq` thread-safe?**
The documentation does not say it is, so the working answer is no. In CPython 3.14 each C heap
function holds a critical section on the list, which keeps a single push or pop from interleaving
with another on the free-threaded build, but that is an implementation detail, it does not cover
`nlargest`, `nsmallest` or `merge`, and it cannot make a check-then-pop or a peek-then-replace
atomic. Share a heap through `queue.PriorityQueue` or guard every access with one lock.

**★ When would you write your own locked heap instead of using `queue.PriorityQueue`?**
When you need operations `PriorityQueue` does not offer: peeking at the head, cancelling or
re-prioritising entries, or waiting until the head's due time rather than until any item exists —
a delay or retry queue. A `threading.Condition` around a plain heap gives all of those: the lock
makes compound operations atomic, and `wait(timeout=...)` plus `notify()` on insert handles "sleep
until due, wake early if something earlier arrives".

**How is `asyncio.PriorityQueue` different from `queue.PriorityQueue`?**
Both are a heap with blocking retrieval, but the asyncio one blocks by suspending a coroutine and is
explicitly not thread-safe, while the `queue` one blocks the calling thread and implements locking
for multiple threads. Crossing from a thread into the event loop goes through
`call_soon_threadsafe`.

**Why can't several worker processes share one heap?**
Each process has its own memory; a list in one is not visible to the others and dies with it. A
queue shared by processes needs shared, durable storage — a database table claimed with
`FOR UPDATE SKIP LOCKED`, or a message broker.

**Is `next(itertools.count())` safe to call from several threads?**
The documentation does not state it. In the CPython 3.14.7 source, `count_next` increments inside C
with the GIL held on the default build and with an atomic compare-exchange on the free-threaded
build, so values are unique. Uniqueness is what the tie-break needs; strict arrival order across
threads is not guaranteed, because taking a number and pushing the entry are separate steps.

---

← Prev: [05c · Stale entries and compaction](05c-stale-entries-and-compaction.md) · [Topic index](README.md) · Next → [06 · `heapq.merge` — k-way merge as a stream](06-merge.md)
