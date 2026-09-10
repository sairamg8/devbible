---
title: "A deque iterator dies on any append or pop during the loop, even one that leaves the length unchanged, and a deque shared between threads makes each single call atomic and nothing else — so drain with popleft, snapshot with copy(), and hand work between threads with a Queue that is a deque plus a lock"
sidebar_label: "04c · deque during iteration and across threads"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.deque`](https://docs.python.org/3.14/library/collections.html#deque-objects) (*"thread-safe, memory efficient appends and pops"*), [`queue`](https://docs.python.org/3.14/library/queue.html) (the `deque` note under `SimpleQueue`), [asyncio Queues](https://docs.python.org/3.14/library/asyncio-queue.html), [Thread Safety Guarantees](https://docs.python.org/3.14/library/threadsafety.html) (which covers `list` and `dict` and **not** `deque`). The iterator's state check, the per-method critical sections and the error strings read from CPython **v3.14.7** [`Modules/_collectionsmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_collectionsmodule.c); `Queue`'s storage from [`Lib/queue.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/queue.py) and [`Lib/asyncio/queues.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/asyncio/queues.py) — **implementation detail, not documented guarantees**. Target: **Python 3.14.7**. **No sandbox run.**

**A list iterator never complains — append during a loop and the loop simply visits the new items too. A dict iterator complains when the size changes. A deque iterator is stricter than both: the deque keeps a counter that every append, pop, extend, rotate, remove, insert and clear increments, and the iterator raises `RuntimeError: deque mutated during iteration` the next time it notices the counter moved — even if the length ended up the same. So the BFS that "works" on a list fails on a deque, and a reporting thread that iterates a shared ring buffer fails intermittently whenever a request appends to it. Across threads, the documentation promises *"thread-safe … appends and pops"* and the `queue` docs call `append` and `popleft` *"atomic"* — single calls, not sequences of them. `if d: d.popleft()` is a race, a consumer polling an empty deque burns a core, and the fix for both is `queue.Queue`, which the standard library builds on a deque plus a lock and two conditions.**

## The state counter

The deque struct in `v3.14.7` carries `size_t state; /* incremented whenever the indices move */`, and each iterator records the value when it is created (`state when the iterator is created`). Every call to `next` begins with:

```c
/* dequeiter_next_lock_held, Modules/_collectionsmodule.c, v3.14.7 */
if (it->deque->state != it->state) {
    it->counter = 0;
    PyErr_SetString(PyExc_RuntimeError,
                    "deque mutated during iteration");
    return NULL;
}
```

`append`, `appendleft`, `pop`, `popleft`, `extend`, `extendleft`, `rotate`, `insert`, `remove`, `del d[i]` and `clear` all move the indices and increment `state`. Setting `counter = 0` makes the failure sticky — the iterator is exhausted afterwards. Two operations do **not** touch `state` in `v3.14.7`: item assignment `d[i] = x` (`deque_ass_item_lock_held` replaces the pointer in place) and `reverse()` (swaps in place). Neither is documented either way; a loop that reverses the deque it is walking gets no error and a mixture of orders.

```python
from collections import deque

frontier = deque(["root"])
for node in frontier:                      # 🔴 RuntimeError on the next step after the append
    frontier.extend(children_of(node))
```

The same loop over a `list` runs to completion — and grows the list as it goes, which is its own problem ([11 · Mutating while iterating](../01-list-internals/11-mutating-while-iterating.md)). Over a `dict` it would raise only if the size changed ([14 · Mutating while iterating](../03-dict/05b-mutating-while-iterating.md)). The deque's rule is the simplest of the three: **no structural change while an iterator is alive.**

The scanning methods apply the same check between comparisons: `x in d`, `d.count(x)` and `d.index(x)` raise `RuntimeError("deque mutated during iteration")` if an `__eq__` they call (or another thread) mutates the deque mid-scan. `d.remove(x)` does the same check but raises **`IndexError`** with that message — a quirk of `deque_remove_impl` worth knowing if you catch exceptions around it.

## The three loops that are correct

**Drain it** — the loop condition is the deque's truthiness, and `popleft` is the only access:

```python
def crawl(start: str) -> list[str]:
    frontier = deque([start])
    seen = {start}
    order: list[str] = []
    while frontier:
        page = frontier.popleft()
        order.append(page)
        for link in links_on(page):
            if link not in seen:
                seen.add(link)
                frontier.append(link)
    return order
```

**Filter in place by rotation** — visit each item exactly once, keep the ones you want, order preserved, O(*n*), no second container:

```python
def drop_expired(sessions: deque[Session], now: float) -> None:
    for _ in range(len(sessions)):
        session = sessions.popleft()
        if session.expires_at > now:
            sessions.append(session)
```

`range(len(sessions))` is evaluated once, before the loop starts, so the appends do not extend it.

**Iterate a snapshot** — when the body must mutate the deque and must see the original contents, iterate `d.copy()` (or `list(d)`) and mutate the original.

## What "thread-safe" means for a deque

> *"Deques support thread-safe, memory efficient appends and pops from either side of the deque with
> approximately the same *O*(1) performance in either direction."*

> *"`collections.deque` is an alternative implementation of unbounded queues with fast atomic
> `append()` and `popleft()` operations that do not require locking and also support indexing."*
> — the `queue` documentation

That is a statement about single calls. In `v3.14.7` every public deque method is declared `@critical_section` (argument clinic), so on the free-threaded build each call holds the deque's own lock for its duration; on the default build the GIL has the same effect for C code that does not call back into Python. The 3.14 *Thread Safety Guarantees* page documents `list` and `dict` operation by operation and says nothing about `deque`, so treat anything beyond "each append and pop is atomic" as unpromised.

What that does **not** make safe:

```python
# 🔴 check-then-act: another consumer can empty the deque between the test and the pop
if pending:
    job = pending.popleft()          # IndexError: pop from an empty deque — under load only

# ✅ one call, and handle "empty" as its result
try:
    job = pending.popleft()
except IndexError:
    job = None
```

And iteration from one thread while another appends is the state-counter failure above, now intermittent. A health endpoint that renders a module-level `deque(maxlen=50)` of recent errors ([04b](04b-bounded-deques.md)) while request threads call `append` on it can raise `RuntimeError` whenever an append lands between two steps of the loop — including inside `list(RECENT_ERRORS)`, which iterates. Take the snapshot with `copy()`: `deque_copy_impl` is one critical section in `v3.14.7` and, for an exact deque, copies by walking the blocks in C without calling back into Python.

```python
def health() -> dict[str, object]:
    snapshot = RECENT_ERRORS.copy()            # one call, not an iteration
    return {"recent_errors": [message for _, message in snapshot]}
```

## A deque is not a work queue between threads

A consumer of a plain deque has no way to wait. It either spins — `while not pending: pass` burns a core — or sleeps and polls, adding latency. There is no `task_done`, no `join`, no bound with backpressure. `queue.Queue` provides all of that, and it is built on the same structure: `Queue._init` in `Lib/queue.py` (`v3.14.7`) is `self.queue = deque()`, wrapped in a mutex and two condition variables so `get()` blocks until an item arrives and `put()` blocks while full.

```python
import queue
import threading

jobs: queue.Queue[Job | None] = queue.Queue(maxsize=1000)


def worker() -> None:
    while (job := jobs.get()) is not None:      # blocks, no polling
        try:
            process(job)
        finally:
            jobs.task_done()


threads = [threading.Thread(target=worker, daemon=True) for _ in range(4)]
for t in threads:
    t.start()
```

[11d · Sharing a list between threads](../01-list-internals/11d-sharing-a-list-between-threads.md) has the full Queue argument; the point here is that choosing `Queue` over `deque` is not choosing a slower structure — it is choosing the same structure with the synchronisation already written.

**In `asyncio` code** the situation is different: all tasks run on one thread, so a plain deque shared between coroutines cannot be torn by another thread — but an `await` between a check and a pop hands control to another task exactly as a thread switch would. `asyncio.Queue` is, again, a deque inside (`self._queue = collections.deque()` in `Lib/asyncio/queues.py`) plus futures for waiting; the documentation's caveat is that *"Although asyncio queues are not thread-safe, they are designed to be used specifically in async/await code."*

## Gotchas

**★ Symptom: `RuntimeError: deque mutated during iteration` from a traversal loop.** Cause: the body appends to (or pops from) the deque the `for` is iterating; any structural change invalidates the iterator, even when the length is unchanged. Fix: drain with `while`/`popleft` instead of iterating.

```python
while frontier:
    node = frontier.popleft()
    frontier.extend(children_of(node))
```

**★ Symptom: a status or health endpoint fails intermittently with `RuntimeError: deque mutated during iteration`, never in tests.** Cause: it iterates a module-level deque (directly, or via `list(d)`) while request threads append to it. Fix: snapshot with one call.

```python
snapshot = RECENT_ERRORS.copy()
```

**★ Symptom: `IndexError: pop from an empty deque` in a worker, only under concurrency.** Cause: `if pending: pending.popleft()` — another thread emptied it between the check and the pop. Fix: attempt the pop and treat `IndexError` as "empty" — or use `queue.Queue`.

```python
try:
    job = pending.popleft()
except IndexError:
    return
```

**★ Symptom: an idle worker process sits at 100% CPU.** Cause: a consumer loops on an empty deque waiting for work; a deque cannot block. Fix: `queue.Queue.get()` blocks until an item arrives.

```python
job = jobs.get()                     # sleeps until a producer puts something
```

**Symptom: code that catches `RuntimeError` around `pending.remove(job)` still crashes with `IndexError: deque mutated during iteration`.** Cause: `deque_remove_impl` in `v3.14.7` raises `IndexError`, not `RuntimeError`, when the deque changes during its scan. Fix: catch both — or, better, stop mutating the deque from an `__eq__` or another thread during `remove`.

```python
try:
    pending.remove(job)
except (ValueError, IndexError, RuntimeError):
    log.warning("could not remove %s", job)
```

**Symptom: two coroutines both pass `if queue:` and one then fails on `popleft()`.** Cause: an `await` between the check and the pop let the other task run. Fix: no `await` between check and act — or use `asyncio.Queue`, whose `get()` waits.

```python
item = await work.get()              # asyncio.Queue
```

**Symptom: a loop that reverses a deque it is iterating produces a jumbled order and no error.** Cause: `reverse()` swaps elements in place without incrementing the state counter (v3.14.7), so the iterator keeps going over rearranged data. Fix: never restructure a deque you are iterating; reverse after the loop, or iterate `reversed(d)`.

```python
for item in reversed(history):
    replay(item)
```

## Interview questions

**★ Why does appending to a deque during a `for` loop raise, when appending to a list does not?**
Because the deque tracks structural changes with a counter and its iterator checks it on every step. Every append, pop, extend, rotate, insert, remove or clear increments `state`; the iterator compares against the value it saw when it was created and raises `RuntimeError("deque mutated during iteration")` on mismatch. A list iterator holds only an index and never checks — which is why the list version silently visits appended items, and sometimes never terminates. For a deque the correct loop is `while d: x = d.popleft()`.

**★ Is `collections.deque` thread-safe?**
Each individual `append`, `appendleft`, `pop` and `popleft` is — the documentation says *"thread-safe … appends and pops"* and the `queue` docs call `append` and `popleft` *"atomic"*. In CPython 3.14 every method runs in the deque's critical section on the free-threaded build. Compound sequences are not: `if d: d.popleft()` races, iterating while another thread appends raises `RuntimeError`, and `len(d)` followed by an action can be stale. Use single calls with exception handling, `d.copy()` for snapshots, and `queue.Queue` when threads hand work to each other.

**★ When should you use `queue.Queue` instead of `deque`?**
When a consumer needs to wait for work, a producer needs backpressure, or the program needs to know when all work is done. `Queue` provides blocking `get`/`put`, `maxsize`, `task_done` and `join`; a deque provides none of them, so consumers either spin or poll. `Queue` is not a different data structure — `Lib/queue.py` stores its items in a `deque` — it is the deque with the locking and signalling written correctly.

**How do you take a consistent snapshot of a deque that other threads append to?**
Call `d.copy()`. It is a single method call — one critical section in CPython 3.14 — that copies the elements by walking the block list in C. `list(d)` and `for x in d` iterate, which in the free-threaded build means one locked step per element, so an append from another thread between steps raises `RuntimeError`. The documentation does not spell out either behaviour; one call is the defensible choice.

**How do you remove items from a deque in place while keeping the order?**
Rotate through it once: `for _ in range(len(d)): item = d.popleft(); if keep(item): d.append(item)`. Each element is popped from the front and, if kept, appended to the back, so after exactly `len(d)` steps the survivors are back in their original order. It is O(*n*), uses no second container, and never iterates the deque with an iterator, so the state check never fires.

**Why is a plain `deque` fine between asyncio tasks but still racy?**
All tasks run on one thread, so no deque operation is ever interrupted halfway — but a task gives up control at every `await`. If a task checks `if queue:` and then awaits something before `queue.popleft()`, another task can take the last item in between. Keep the check and the pop in the same synchronous stretch of code, or use `asyncio.Queue`, whose `get()` suspends the task until an item is available.

---

← Prev: [04b · Bounded deques](04b-bounded-deques.md) · [Topic index](README.md) · Next → [05 · `namedtuple` from the factory side](05-namedtuple-factory-side.md)
