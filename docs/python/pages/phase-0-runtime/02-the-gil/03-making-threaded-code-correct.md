---
title: "Making threaded code correct: locks that cover the whole operation, single-step alternatives, and designs that share nothing"
sidebar_label: "3 · Making it correct"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the Python 3.14 docs for
> [`threading`](https://docs.python.org/3.14/library/threading.html),
> [`queue`](https://docs.python.org/3.14/library/queue.html),
> [`concurrent.futures`](https://docs.python.org/3.14/library/concurrent.futures.html),
> [`functools.lru_cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache),
> [`os.makedirs`](https://docs.python.org/3.14/library/os.html#os.makedirs),
> and [Python support for free threading § Thread safety](https://docs.python.org/3.14/howto/free-threading-python.html).
> Version spine: **Python 3.14.7**.

**[The previous chunk](02-the-gil-is-not-thread-safety.md) established that the
GIL protects the interpreter and not your invariants. This one shows the fixes,
in full, in the order you should reach for them: stop sharing if you can; use a
structure that does the locking for you if you can't; use an operation that is
genuinely one step if one exists; and take an explicit lock over the entire
read-decide-act span if none of the above applies. The ordering matters —
"add a lock" is the last resort, not the first, because a design that shares
nothing cannot have a race in it.**

## Option 1: stop sharing

The strongest fix removes the shared state rather than guarding it. Two
patterns cover most cases.

**Accumulate per task, combine at the end:**

```python
from concurrent.futures import ThreadPoolExecutor

def count_chunk(chunk):
    return sum(1 for x in chunk if predicate(x))   # entirely local

with ThreadPoolExecutor() as pool:
    total = sum(pool.map(count_chunk, chunks))     # combined in one thread
```

No global, no lock, no race, and no contention to slow it down. The reduction
happens in the calling thread after every worker has finished.

**Give each thread its own object with `threading.local()`:**

```python
import threading, requests

_state = threading.local()

def session():
    if not hasattr(_state, "session"):
        _state.session = requests.Session()   # one per thread; no sharing
    return _state.session
```

This is the right shape for anything that is expensive to create, cheap to
have several of, and not safe to share — HTTP sessions, some database cursors,
per-request context. Note the caveat that bites people: with a thread *pool*,
these objects live as long as the pool's threads, so anything holding a
resource needs an explicit lifecycle.

## Option 2: use a structure that locks for you

`queue.Queue` is the canonical answer for producer/consumer, which is the shape
of most threaded work:

```python
import queue, threading

work = queue.Queue()

def worker():
    while True:
        item = work.get()          # blocks; releases the GIL while waiting
        if item is None:
            work.task_done()
            break
        handle(item)
        work.task_done()

threads = [threading.Thread(target=worker, daemon=True) for _ in range(8)]
for t in threads: t.start()

for item in items:
    work.put(item)
work.join()                        # wait for all task_done() calls
for _ in threads: work.put(None)   # one sentinel per worker to stop it
```

`Queue` does its own locking, so threads never touch shared mutable state
directly — they exchange items. That is a stronger property than sharing state
correctly, because it is a property of the design rather than of remembering
every lock.

`concurrent.futures.ThreadPoolExecutor` is the higher-level version of the same
idea and is what you should reach for first; drop to `Queue` when you need
backpressure (`maxsize`), a long-lived pipeline, or fan-in from multiple
producers.

## Option 3: find the single-step operation

Where one exists, an operation that completes in a single step is both correct
and faster than a lock:

```python
os.makedirs(path, exist_ok=True)     # one syscall — no TOCTOU window
cache.setdefault(key, default)       # one dict operation
next(id_counter)                     # itertools.count() — one operation
open(path, "x")                      # exclusive create; fails if it exists
os.replace(tmp, final)               # atomic rename on the same filesystem
```

The last two are the pattern for writing a file safely from concurrent
processes: write to a temporary name, then `os.replace` it into place. Readers
see either the old file or the new one, never a partial write — and unlike an
in-process lock, this works across processes and across machines sharing a
filesystem.

`functools.lru_cache` deserves a precise statement of what it does. It is
thread-safe in the sense that concurrent callers get one consistent cached
value and the cache structure is not corrupted. It does **not** guarantee the
wrapped function is called exactly once for a given key under a race — two
threads may both compute before either stores. If the computation must happen
exactly once (it opens a connection, it charges a card), you need option 4.

## Option 4: lock the entire read-decide-act span

When state genuinely must be shared and mutated, the lock has to cover the
whole logical operation, not just the write:

```python
import threading

_lock = threading.Lock()
_cache: dict[str, object] = {}

def get(key):
    with _lock:
        if key not in _cache:            # check and act inside one lock
            _cache[key] = expensive(key)
        return _cache[key]
```

This is correct but serialises `expensive()` across all keys. When the
computation is slow and keys are independent, use a per-key lock with a
double-check:

```python
import threading

_cache: dict[str, object] = {}
_key_locks: dict[str, threading.Lock] = {}
_guard = threading.Lock()

def _lock_for(key):
    with _guard:                             # tiny critical section
        return _key_locks.setdefault(key, threading.Lock())

def get(key):
    try:
        return _cache[key]                   # fast path, no lock
    except KeyError:
        pass
    with _lock_for(key):
        if key not in _cache:                # re-check INSIDE the lock
            _cache[key] = expensive(key)
        return _cache[key]
```

**The re-check inside the lock is not optional.** Without it, every thread that
queued behind the first one recomputes as soon as it acquires. This is
double-checked locking, and in Python it is safe because acquiring the lock is
a full memory barrier — unlike in Java before `volatile` semantics were fixed,
which is where the pattern's bad reputation comes from.

And the counter from the previous chunk, fixed:

```python
import threading

_counter = 0
_counter_lock = threading.Lock()

def bump():
    global _counter
    for _ in range(1_000_000):
        with _counter_lock:
            _counter += 1
```

Correct — and considerably *slower* than the racy version, because a million
lock acquisitions per thread is a million contended handoffs. Which is exactly
why option 1 (accumulate locally, add once at the end) is listed first:

```python
def bump():
    global _counter
    local = 0
    for _ in range(1_000_000):
        local += 1
    with _counter_lock:          # one acquisition instead of a million
        _counter += local
```

## Gotchas

**Symptom:** a lock was added and the threaded version became slower than the single-threaded one
**Cause:** the lock now serialises the work the threads were supposed to overlap — and if that work is Python bytecode, the GIL was already serialising it, so you added handoff overhead for nothing
**Fix:** lock the smallest correct region, or restructure so threads accumulate locally and combine once. If the work is CPU-bound Python, threads were never going to help; move to processes

**Symptom:** a lazily-created singleton (a database client, an HTTP session, a connection pool) exists twice, with double the connections
**Cause:** `if self._client is None: self._client = Client()` under concurrent first use
**Fix:** create it eagerly at startup where possible; otherwise double-checked locking with the re-check *inside* the lock. `functools.lru_cache` on a zero-argument factory is a compact idiom, with the caveat that it does not promise exactly-once computation

**Symptom:** a cache with a lock still computes the expensive value once per waiting thread
**Cause:** the re-check inside the lock was omitted, so each queued thread proceeds to compute after acquiring
**Fix:** re-check the cache immediately after acquiring the lock. This is the "double" in double-checked locking and it is the part people leave out

**Symptom:** `threading.local()` objects hold database connections that are never closed
**Cause:** in a thread pool, threads live for the lifetime of the pool, so the thread-local object does too — there is no scope exit to trigger cleanup
**Fix:** register an explicit teardown (the framework's request-teardown hook, or a context manager around the unit of work). Thread-local storage removes the sharing problem and creates a lifecycle problem

**Symptom:** writing a file from several processes produces truncated or interleaved content, and an in-process lock did not help
**Cause:** a `threading.Lock` is per process. Another process on the same machine, or another machine on the same NFS mount, does not see it
**Fix:** write to a unique temporary file and `os.replace()` it into position — an atomic rename within a filesystem. For cross-process mutual exclusion you need a real file lock or an external coordinator

## Interview questions

**★ How do you fix a cache that computes the same value twice under concurrency?**
Take a lock across both the check and the write, and re-check the cache inside
the lock so threads that queued behind the first one do not each recompute. If
the computation is slow and keys are independent, use a per-key lock so
unrelated keys are not serialised, with a tiny guarded section that hands out
the per-key locks. `functools.lru_cache` handles the simple case, but be precise
about what it promises: one consistent value, not exactly-once computation.

**★ Walk me through fixing the threaded counter, and then improve your fix.**
The correct version wraps `counter += 1` in a `with lock:`. That is right and
also slow, because it is one contended acquisition per increment. The better
version removes the sharing from the hot path entirely: each thread accumulates
into a local variable and takes the lock once at the end to add its subtotal.
Same result, one lock acquisition per thread instead of a million. The general
principle is that the cheapest correct concurrency is the kind with nothing
shared in the inner loop.

**★ When would you use `queue.Queue` instead of a lock?**
Whenever the shape is producer/consumer, which is most threaded work. `Queue`
does its own locking, so threads exchange items instead of sharing mutable
state — a stronger property than sharing it correctly, because it holds by
construction rather than by remembering every lock. It also gives you
backpressure through `maxsize` and completion tracking through
`task_done()`/`join()`. Reach for `ThreadPoolExecutor` first and drop to
`Queue` when you need those extras.

**How do you write a file safely when several processes might write it?**
Write to a unique temporary file in the same directory, flush and `fsync` it,
then `os.replace()` it onto the final name. Rename within a filesystem is
atomic, so a reader sees either the complete old file or the complete new one,
never a partial write. An in-process `threading.Lock` does not help here at all
— it is invisible to other processes, which is a distinction worth stating
explicitly because people reach for it.

**What is the ordering of fixes you would apply to a racy threaded module?**
First, try to remove the sharing: local accumulation, per-task results combined
at the end, or `threading.local()` for per-thread objects. Second, move the
work through a structure that locks for you — `ThreadPoolExecutor` or
`queue.Queue`. Third, look for a genuinely single-step operation:
`makedirs(exist_ok=True)`, `setdefault`, `os.replace`. Only then add an explicit
lock, covering the whole read-decide-act span, held for as little time as
correctness allows.

---

← Prev: [The GIL is not thread safety](02-the-gil-is-not-thread-safety.md) · Index: [The GIL](README.md) · Next → [Lock discipline and testing for races](04-lock-discipline-and-testing.md)
