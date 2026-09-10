---
title: "A shared list is correct only when every compound operation on it is either one atomic call or runs under a lock — so pop instead of checking, snapshot with `copy()` instead of iterating, and hand work between threads with a Queue, not a list"
sidebar_label: "11d · Sharing a list between threads"
sidebar_position: 29
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against [Thread Safety Guarantees — list objects](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-list-objects),
> [Python support for free threading](https://docs.python.org/3.14/howto/free-threading-python.html),
> [`queue`](https://docs.python.org/3.14/library/queue.html),
> [`collections.deque`](https://docs.python.org/3.14/library/collections.html#collections.deque),
> and the Library FAQ on
> [thread-safe mutation](https://docs.python.org/3.14/faq/library.html#what-kinds-of-global-value-mutation-are-thread-safe).
> Documentation-validated; **no sandbox run, no free-threaded build exercised**.
> Target: **CPython 3.14** (3.14.7), default and free-threaded builds.

**[11c](11c-thread-safety-under-free-threading.md) is the table of what a list
guarantees. This chunk is what to do with it. The table's most useful rows are the
atomic ones — `append`, `pop()`, `clear()`, `copy()` — because the cheapest fix for a
race is to turn two steps into one of those: `try: lst.pop()` instead of `if lst:
lst.pop()`, `lst.copy()` and iterate the snapshot instead of iterating the live list.
When no single call expresses the operation, hold a `threading.Lock` for exactly the
compound step and no longer. And when the list was really a channel between threads,
it was the wrong structure: `queue.Queue` exists for that, and *"implements all the
required locking semantics."* Every pattern here is valid under the GIL too; the
free-threaded build only removes the luck that used to hide the bugs.**

## Pattern 1 — make it one atomic call

The page's check-then-act example is two operations; `pop()` alone is one:

```python
# NOT atomic — another thread can empty the list between the test and the pop
if jobs:
    job = jobs.pop()

# one atomic operation; the empty case becomes an exception
try:
    job = jobs.pop()
except IndexError:          # "pop from empty list" — the literal message in listobject.c
    job = None
```

This is "easier to ask forgiveness than permission" with a concurrency reason behind
it: the test and the action cannot be separated if they are the same call.

## Pattern 2 — snapshot, then iterate

Iteration is *"never atomic"*. `lst.copy()` is listed as appearing atomic, so take
one and walk that:

```python
for conn in connections.copy():    # a consistent list, taken in one step
    conn.ping()
```

The snapshot can be stale by the time you reach its end — a connection may have been
removed — so the loop body must tolerate that. What it cannot be is torn.

## Pattern 3 — a lock around the compound step, and nothing else

```python
import threading

counts = [0] * 24
counts_lock = threading.Lock()

def record(hour):
    with counts_lock:
        counts[hour] += 1          # read-modify-write: exactly the page's example
```

Keep the critical section to the list operation. Doing I/O, logging or calling
user code inside the `with` block serialises everything that touches the list behind
the slowest of them:

```python
with pending_lock:
    batch = pending.copy()
    pending.clear()
send(batch)                        # slow work happens outside the lock
```

## Pattern 4 — a channel is a `Queue`

> *"The queue module implements multi-producer, multi-consumer queues. It is
> especially useful in threaded programming when information must be exchanged safely
> between multiple threads. The Queue class in this module implements all the required
> locking semantics."*

```python
import queue
import threading

work = queue.Queue()

def worker():
    while True:
        item = work.get()          # blocks until an item is available
        try:
            handle(item)
        finally:
            work.task_done()

for _ in range(8):
    threading.Thread(target=worker, daemon=True).start()

for item in incoming:
    work.put(item)
work.join()                        # wait until every item has been processed
```

A plain `deque` also works for non-blocking FIFO use — *"Deques support thread-safe,
memory efficient appends and pops from either side"* — but it cannot make a consumer
wait for work, and it has no `join`.

## Pattern 5 — do not share

The race-free list is the one only one thread touches. Give each worker its own list
and combine after the workers finish:

```python
from concurrent.futures import ThreadPoolExecutor

def scan(shard):
    found = []                     # local to this call — no sharing
    for record in shard:
        if suspicious(record):
            found.append(record)
    return found

with ThreadPoolExecutor() as pool:
    results = [r for part in pool.map(scan, shards) for r in part]
```

## Gotchas

**★ Symptom: `IndexError: pop from empty list` in a worker, under load only.** Cause:
`if jobs: jobs.pop()` — another thread emptied the list between the check and the pop;
the page lists this exact shape as *"NOT atomic: check-then-act"*. Fix: pop and handle
the exception, or use a `Queue`:

```python
try:
    job = jobs.pop()
except IndexError:
    return
```

**★ Symptom: a shared counter list undercounts under concurrency.** Cause:
`counts[i] += 1` reads, adds and writes as separate steps; two threads read the same
value and one update is lost. Fix: a lock around the increment — or per-thread counts
summed at the end:

```python
with counts_lock:
    counts[i] += 1
```

**Symptom: a loop over a shared list processes an item twice or skips one while
another thread adds and removes.** Cause: the loop's iterator is an index into a list
whose elements are moving ([11](11-mutating-while-iterating.md)), and the page calls
iteration *"never atomic"*. Fix: iterate a snapshot:

```python
for sub in subscribers.copy():
    sub.notify(event)
```

**Symptom: a "unique" list shared between threads ends up with duplicates.** Cause:
`if x not in seen: seen.append(x)` is check-then-act, and `in` is a lock-free read
that *"may return results affected by concurrent modifications"*. Fix: lock the pair,
and use a set for the membership test:

```python
with seen_lock:
    if key not in seen_set:
        seen_set.add(key)
        ordered.append(key)
```

**Symptom: workers sharing one iterator over a list process some items twice and miss
others.** Cause: the free-threading HOWTO: threads sharing an iterator *"may see
duplicate or missing elements."* Fix: feed workers from a `Queue`, or give each worker
its own slice:

```python
shards = [items[i::n_workers] for i in range(n_workers)]
```

**Symptom: every request stalls while one thread holds the list's lock.** Cause: the
`with lock:` block does slow work — network calls, logging, user callbacks — while
holding it. Fix: copy or swap out under the lock, work outside:

```python
with lock:
    batch, pending[:] = pending[:], []
flush(batch)
```

**Symptom: a list used as a job queue with `pop(0)` gets slower as the backlog grows,
and a monitoring thread that reads `jobs[0]` reports values that match no state the
queue was ever in.** Cause: `pop(idx)` shifts every element — O(n) — and the page lists
it among operations that *"may allow lock-free operations to observe intermediate
states"*; `lst[i]` is one of those lock-free reads. Fix: `queue.Queue` for workers, or
`deque.popleft()` for a single-threaded FIFO:

```python
job = work.get()
```

**Symptom: `lst.remove(x)` in threaded code behaves erratically when the elements have
a custom `__eq__`.** Cause: the page: `remove()` *"may allow concurrent modifications
since element comparison may execute arbitrary Python code"*. Fix: hold a lock that
every mutator of that list also holds, or remove by identity from a structure keyed on
it:

```python
with registry_lock:
    registry.remove(handler)
```

## Interview questions

**★ How do you make `if lst: item = lst.pop()` safe across threads?**
Remove the gap between the test and the action. `lst.pop()` on its own is atomic on
the free-threaded build, so call it and catch `IndexError` for the empty case. If the
logic needs more than one call — pop only if the item matches something — hold a lock
for the whole sequence. For producer/consumer work, replace the list with a
`queue.Queue`, whose `get()` blocks until an item exists.

**★ Why use `queue.Queue` instead of a list for handing work between threads?**
Because a work channel needs more than atomic appends and pops: consumers must be able
to wait for work, producers may need to wait for space, and the coordinator needs to
know when everything is done. `Queue` provides blocking `get`/`put`, `task_done` and
`join`, and per its docs *"implements all the required locking semantics"*. A list
gives you none of that and a `pop(0)` that is O(n).

**How do you iterate over a list that other threads are modifying?**
Take a snapshot with `lst.copy()` — listed as appearing atomic — and iterate the copy.
The snapshot may be out of date, but it is internally consistent, which the live list
is not. If the loop must see a stable list and act on it atomically, hold a lock that
all writers respect for the duration.

**Why keep a lock's critical section small?**
Every thread that touches the list waits for whoever holds the lock. If the holder is
doing I/O or calling back into user code, all of them wait for that too, and a
callback that tries to take the same lock deadlocks. Copy or swap the data out under
the lock, release it, then do the slow work.

**Is `deque` a replacement for `queue.Queue`?**
For single-threaded FIFOs and simple multi-threaded appends and pops, yes — its docs
describe thread-safe appends and pops from either end in about O(1). It is not a
coordination primitive: a consumer cannot block waiting for an item, and there is no
`task_done`/`join`. Use `Queue` when threads wait on each other.

**If every mutating list operation takes a lock, why do I still need my own?**
Because the list's lock protects one call at a time. Correctness usually depends on a
sequence — check then act, read then write, find then remove — and nothing stops
another thread running between the calls. Your lock is what makes the sequence
indivisible. The HOWTO also recommends `threading.Lock` over relying on the internal
locks, which it calls *"a description of the current implementation, not a
guarantee"*.

---

← [Thread safety under free threading](11c-thread-safety-under-free-threading.md) · [Topic index](README.md) · Next → [Memory: list, tuple and array](12-memory-list-tuple-array.md)
