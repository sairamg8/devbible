---
title: "In 3.14 a shared dict will not be corrupted by concurrent threads, and that is the whole guarantee — single operations are atomic, every read-modify-write, check-then-act and iteration is a race, and the free-threading docs call even the atomic list a description rather than a promise"
sidebar_label: "25 · dict across threads"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Thread Safety Guarantees — dict](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-dict-objects), [Python support for free threading](https://docs.python.org/3.14/howto/free-threading-python.html), [Library FAQ — *What kinds of global value mutation are thread-safe?*](https://docs.python.org/3.14/faq/library.html#what-kinds-of-global-value-mutation-are-thread-safe), [`functools.lru_cache` / `cached_property`](https://docs.python.org/3.14/library/functools.html), [`sys._is_gil_enabled`](https://docs.python.org/3.14/library/sys.html#sys._is_gil_enabled). Target: **CPython 3.14** (3.14.7), default and free-threaded builds. Documentation-validated; **no sandbox run, no timings**.

**A `dict` shared between threads is safe in exactly one sense: no interleaving of single operations will corrupt it. `d[k] = v` from two threads leaves one of the two values, never a broken table. What it will not do is make *your* operations atomic. `counts[k] += 1` is a read and a write, and two threads can both read 5 and both write 6. `if k in d: del d[k]` is a test and an action, and the key can vanish between them. A loop over `d.items()` holds an iterator that another thread's insert invalidates. The 3.14 documentation spells this out for the free-threaded build, gives the fixes, and then tells you not to lean on even the parts that are safe: use a lock.**

## Two builds, one rule for your code

**The default build has the GIL.** The library FAQ describes what that buys:

> *"In general, Python offers to switch among threads only between bytecode instructions"* … *"In practice, it means that operations on shared variables of built-in data types (ints, lists, dicts, etc) that "look atomic" really are."*

Its list of atomic operations includes `D[x] = y`, `D1.update(D2)` and `D.keys()`. Its list of non-atomic ones includes `D[x] = D[x] + 1`. And it closes: *"Operations that replace other objects may invoke those other objects' `__del__()` method when their reference count reaches zero, and that can affect things. This is especially true for the mass updates to dictionaries and lists. When in doubt, use a mutex!"*

**The free-threaded build has no GIL**, and the thread-safety page documents what `dict` does instead, starting with its scope:

> *"This page documents thread-safety guarantees for built-in types in Python's free-threaded build. The guarantees described here apply when using Python with the GIL disabled (free-threaded mode). When the GIL is enabled, most operations are implicitly serialized."*

🔴 And the free-threading HOWTO qualifies the whole thing:

> *"Built-in types like `dict`, `list`, and `set` use internal locks to protect against concurrent modifications in ways that behave similarly to the GIL. However, Python has not historically guaranteed specific behavior for concurrent modifications to these built-in types, so this should be treated as a description of the current implementation, not a guarantee of current or future behavior."*

> *"It's recommended to use the `threading.Lock` or other synchronization primitives instead of relying on the internal locks of built-in types, when possible."*

So the rule for application code is the same on both builds: **a single operation will not corrupt the dict; anything you need to be atomic across two operations needs a lock you hold.** To find out which build you are on:

```python
import sys
import sysconfig

build_supports_free_threading = sysconfig.get_config_var("Py_GIL_DISABLED") == 1
gil_currently_enabled = sys._is_gil_enabled()      # added in 3.13
```

The HOWTO recommends the `sysconfig` variable *"for decisions related to the build configuration"*, and `sys._is_gil_enabled()` for whether the GIL is *"actually disabled in the running process"* — a free-threaded build can re-enable it.

## What the free-threaded build guarantees, operation by operation

| Operation | Documented behaviour |
|---|---|
| `d[key]`, `d.get(key)`, `key in d`, `len(d)` | *"lock-free and atomic"* |
| `d[key] = value`, `del d[key]`, `d.pop(key)`, `d.popitem()`, `d.setdefault(key, v)` | *"safe to call from multiple threads and will not corrupt the dictionary"* |
| `d.copy()`, `d \| other`, `d.keys()`, `d.values()`, `d.items()` | *"return new objects and hold the per-object lock for the duration of the operation"* |
| `d.clear()` | *"holds the lock for its duration. Other threads cannot observe elements being removed."* |
| `d.update(other_dict)`, `d \|= other_dict`, `d == other_dict` | lock both dicts — for `update`/`\|=` *"only when the other operand is a `dict` that uses the standard dict iterator (but not subclasses that override iteration)"* |
| `dict(a_dict)`, `dict(a_tuple)` | *"atomic when the argument to it is a `dict` or a `tuple`"* |
| `d.update(iterable)`, `d \|= iterable`, `dict.fromkeys(iterable)` with a non-dict iterable | *"only the target dictionary is locked. The iterable may be concurrently modified by another thread"* |
| read-modify-write, check-then-act, iteration | *"never atomic"* |

Two footnotes on that table are easy to miss:

- **Key comparison can run your code.** *"These operations may compare keys using `__eq__()`, which can execute arbitrary Python code. During such comparisons, the dictionary may be modified by another thread. For built-in types like `str`, `int`, and `float`, that implement `__eq__()` in C, the underlying lock is not released during comparisons and this is not a concern."* A dict keyed by your own dataclass is not in that safe category.
- **Value comparison too.** *"All comparison operations also compare values using `__eq__()`, so for non-built-in types the lock may be released during comparison."*

## The three races, and the documented fixes

The page gives three patterns as `bad`, verbatim:

```python
# NOT atomic: read-modify-write
d[key] = d[key] + 1

# NOT atomic: check-then-act (TOCTOU)
if key in d:
    del d[key]

# NOT thread-safe: iteration while modifying
for key, value in d.items():
    process(key)  # another thread may modify d
```

and its fixes for the second and third:

```python
# Use pop() with default instead of check-then-delete
d.pop(key, None)

# Or handle the exception
try:
    del d[key]
except KeyError:
    pass

# Make a copy to iterate safely
for key, value in d.copy().items():
    process(key)
```

`d.copy()` works because `copy` holds the dict's lock for its duration, so the snapshot is internally consistent; the loop then walks an object no other thread knows about. `list(d.items())` is the same idea, but the documented guarantee is stated for `copy()`.

The first race — read-modify-write — has no single-operation fix. It needs a lock.

## Counters: the race everybody writes

```python
import threading
from collections import Counter


class RequestCounter:
    """Per-route hit counts, safe to increment from any thread."""

    def __init__(self) -> None:
        self._counts: Counter[str] = Counter()
        self._lock = threading.Lock()

    def hit(self, route: str) -> None:
        with self._lock:
            self._counts[route] += 1           # read + add + write, now indivisible

    def snapshot(self) -> dict[str, int]:
        with self._lock:
            return dict(self._counts)          # consistent copy for reporting
```

Without the lock, `self._counts[route] += 1` is exactly the documented `d[key] = d[key] + 1` race, and on the default build too: the FAQ lists `D[x] = D[x] + 1` among the operations that *aren't* atomic, because a thread switch can land between the read and the write. The symptom is counts that are slightly low under load and exact in every test.

## Cache fills: agree on the result, or compute once

`setdefault` gives every caller the same object — the one that won the insert — which is enough when computing the value twice is merely wasteful ([11 · `setdefault`](04c-setdefault.md) covers the pattern):

```python
def get_parser(schema_id: str) -> Parser:
    parser = _parsers.get(schema_id)
    if parser is None:
        parser = _parsers.setdefault(schema_id, build_parser(schema_id))   # may build twice; all callers agree
    return parser
```

When the work must happen **once** — it is expensive, has side effects, or holds a connection — take a lock and re-check inside it:

```python
import threading

_parsers: dict[str, Parser] = {}
_parsers_lock = threading.Lock()


def get_parser(schema_id: str) -> Parser:
    parser = _parsers.get(schema_id)          # lock-free read: the fast path
    if parser is not None:
        return parser
    with _parsers_lock:
        parser = _parsers.get(schema_id)      # re-check: another thread may have built it
        if parser is None:
            parser = build_parser(schema_id)
            _parsers[schema_id] = parser
        return parser
```

The unlocked first `get` relies on `d.get(key)` being *"lock-free and atomic"*: it returns either a fully-built parser or nothing, never a half-inserted entry, because the value is inserted only after it is built. `functools.lru_cache` and `functools.cached_property` do **not** give single execution either. For `lru_cache`: *"It is possible for the wrapped function to be called more than once if another thread makes an additional call before the initial call has been completed and cached."* For `cached_property`: it *"does not prevent a possible race condition in multi-threaded usage. The getter function could run more than once on the same instance."*

## The same shape without threads

An `await` between a check and an act is the same race in single-threaded `asyncio` code: another task runs at the `await` and can change the dict before you resume.

```python
async def release(session_id: str) -> None:
    session = sessions.pop(session_id, None)     # take it in one step, then await
    if session is not None:
        await session.close()
```

Written as `if session_id in sessions: await sessions[session_id].close(); del sessions[session_id]`, two concurrent releases both pass the check and the second `del` raises `KeyError`.

## Gotchas

**★ Symptom: per-key counters are slightly low under load and exact in tests.** Cause: `d[k] += 1` is read-modify-write — *"NOT atomic"* on the free-threaded page, and listed as non-atomic in the FAQ for the GIL build too. Fix: a lock around the increment.

```python
with self._lock:
    self._counts[route] += 1
```

**★ Symptom: intermittent `KeyError` from `del d[k]` right after `if k in d`.** Cause: check-then-act; another thread removed the key in between. Fix: the documented single operation.

```python
d.pop(k, None)
```

**★ Symptom: `RuntimeError: dictionary changed size during iteration` in a reporting thread.** Cause: a worker thread inserted while the reporter iterated — *"iteration while modifying"* is *"NOT thread-safe"*. Fix: iterate a copy; `copy()` holds the lock while it snapshots.

```python
for route, count in counts.copy().items():
    report(route, count)
```

**★ Symptom: an expensive resource is built two or three times at startup under concurrent requests.** Cause: an unlocked check-then-insert, or `setdefault(k, build())`, whose argument is built before the call on every path. Fix: double-checked locking.

```python
with _lock:
    value = cache.get(key)
    if value is None:
        value = cache[key] = build(key)
```

**★ Symptom: code that "was fine under the GIL" corrupts its own invariants on the free-threaded build.** Cause: it depended on the GIL serialising multi-step sequences that were never atomic, or on the internal per-object locks, which the HOWTO calls *"a description of the current implementation, not a guarantee."* Fix: make the critical section explicit.

```python
with state_lock:
    if order.id not in open_orders:
        open_orders[order.id] = order
        totals["pending"] += order.amount
```

**Symptom: a dict keyed by a custom class gives inconsistent results under concurrent writes on the free-threaded build.** Cause: the key's Python-level `__eq__` runs during lookup and the lock may be released while it runs — the page's caveat applies to anything that is not `str`, `int`, `float` or another C-implemented `__eq__`. Fix: key on a built-in type derived from the object, or lock.

```python
orders_by_key: dict[tuple[str, int], Order] = {}
orders_by_key[(order.tenant, order.number)] = order     # tuple of str/int: C-level __eq__
```

**Symptom: `d.update(pending_list)` stores pairs that another thread was halfway through appending.** Cause: updating from a non-dict iterable locks only the target — *"The iterable may be concurrently modified by another thread."* Fix: snapshot the source under the lock that protects it, then update.

```python
with pending_lock:
    batch = dict(pending_list)
    pending_list.clear()
d.update(batch)             # dict argument: both locked
```

**Symptom: a dict subclass with a custom `__iter__` is merged inconsistently under concurrency.** Cause: the both-locked guarantee for `update`/`|=` applies *"only when the other operand is a `dict` that uses the standard dict iterator (but not subclasses that override iteration)"*. Fix: convert to a plain dict under your own lock first.

```python
with source_lock:
    plain = dict(source)
target |= plain
```

**Symptom: two `asyncio` tasks releasing the same session raise `KeyError`.** Cause: an `await` between `if k in d` and `del d[k]` lets the other task run. Fix: take the entry in one step before awaiting.

```python
session = sessions.pop(session_id, None)
if session is not None:
    await session.close()
```

**Symptom: a mass `update()` or `clear()` triggers application code in the middle of a "simple" operation.** Cause: replacing or removing values drops references, and the FAQ warns that this *"may invoke those other objects' `__del__()` method"* — *"especially true for the mass updates to dictionaries."* Fix: do not put side effects in `__del__`; use explicit `close()` or context managers for resources held in shared dicts.

```python
old = connections.copy()
connections.clear()
for conn in old.values():
    conn.close()            # explicit, outside any shared-structure operation
```

## Interview questions

**★ Is a Python `dict` thread-safe?**
In the narrow sense that concurrent single operations will not corrupt it — yes, on both builds; the free-threaded page says writes and removals are *"safe to call from multiple threads and will not corrupt the dictionary."* In the sense that matters to application code, no: any sequence of operations — increment, check-then-delete, iterate — can interleave with another thread, and the page lists all three as *"never atomic."* The HOWTO adds that even the per-operation guarantees are *"a description of the current implementation, not a guarantee of current or future behavior"* and recommends `threading.Lock`.

**★ Why is `counts[key] += 1` a race, even with the GIL?**
Because it is a read, an addition, and a write — several bytecode instructions — and the interpreter may switch threads between instructions. Two threads can both read the same old value and both write the same new one, losing an increment. The library FAQ lists `D[x] = D[x] + 1` among operations that are not atomic; the free-threaded page lists `d[key] = d[key] + 1` as *"NOT atomic: read-modify-write."* The fix is a lock around the whole statement.

**★ What is the documented way to delete a key that may be removed concurrently?**
`d.pop(key, None)` — one operation, listed among those that are safe from multiple threads — or `try: del d[key]` / `except KeyError: pass`. The page names `if key in d: del d[key]` as a TOCTOU race: the key can disappear between the test and the delete.

**How do you iterate a dict that other threads are writing to?**
Iterate a copy: `for k, v in d.copy().items()`. The documentation gives exactly that fix, and the reason it works is that `copy()` *"hold[s] the per-object lock for the duration of the operation"*, producing a consistent snapshot that no other thread can touch. You then see the state as of the copy, not later changes — which is almost always what a report or a sweep wants.

**What does `setdefault` give you in a concurrent cache, and what does it not?**
It guarantees every caller gets the same object — the first one inserted — because it is a single operation that inserts only if the key is missing; the free-threaded page lists it among the safe single-item writes. It does not prevent the default being *built* more than once, because arguments are evaluated before the call. When building is expensive or has side effects, use a lock with a re-check inside it; `lru_cache` and `cached_property` do not provide once-only execution either.

**How can you tell whether code is running without the GIL?**
The HOWTO names two checks with different purposes: `sysconfig.get_config_var("Py_GIL_DISABLED")` tells you whether the *build* supports free threading, and is the one to use for build-configuration decisions; `sys._is_gil_enabled()`, added in 3.13, tells you whether the GIL is *actually* disabled in the running process, since a free-threaded build can re-enable it. Correct locking should not depend on either answer.

**Does the GIL make `d.update(other)` atomic?**
The library FAQ lists `D1.update(D2)` among operations that are atomic under the GIL, because the whole merge runs inside C code reached from one bytecode instruction. The same FAQ adds the caveat that replacing values may drop the last reference to an old value and run its `__del__`, which it calls *"especially true for the mass updates to dictionaries and lists."* On the free-threaded build, the documentation says `update` locks both dictionaries only when the argument is a plain `dict`; from any other iterable, only the target is locked.

**Why iterate a copy instead of holding a lock for the whole loop?**
Because the lock would be held for as long as the loop body runs — including any I/O it does — blocking every writer for that time. Copying under the lock (or with `copy()`, which holds the dict's own lock for its duration) keeps the critical section to the time it takes to copy, and the loop then runs on a private snapshot. Hold the lock for the loop only when the loop's decisions must be consistent with writes that happen during it — and then the loop body should be short.

---

← [24 · Dict equality](09c-dict-equality.md) · [Topic index](README.md) · Next → [26 · Dicts and JSON](11-dicts-and-json.md)
