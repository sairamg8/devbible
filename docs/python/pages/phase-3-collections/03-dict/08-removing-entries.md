---
title: "del, pop, popitem and clear remove entries four different ways — and the difference that matters most in shared code is not between any of them, it is between clear() and rebinding the name to {}"
sidebar_label: "21 · Removing entries"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [Thread Safety Guarantees — dict](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-dict-objects), [Time complexity](https://docs.python.org/3.14/library/time-complexity.html). `clear()`'s table release and the `popitem` error string read from `Objects/dictobject.c` at the [CPython **v3.14.7**](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c) tag, not from a run. Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Removing a key is the easy part of the `dict` API, and the four spellings each carry one decision: `del d[k]` asserts the key exists, `d.pop(k, default)` does not and hands you the value, `d.popitem()` takes the newest entry, and `d.clear()` empties the object in place. The bugs are not in the spellings. They are in code that writes `d = {}` believing it cleared a cache every other module still holds, `if k in d: del d[k]` in a threaded server, and `d.pop(k, None)` on a dictionary where `None` is a legitimate value.**

## The four operations

| Spelling | Missing key | Returns | Documented as |
|---|---|---|---|
| `del d[k]` | `KeyError` | nothing (statement) | *"Remove `d[key]` from d. Raises a `KeyError` if key is not in the map."* |
| `d.pop(k)` | `KeyError` | the removed value | *"If key is in the dictionary, remove it and return its value, else return default. If default is not given and key is not in the dictionary, a `KeyError` is raised."* |
| `d.pop(k, default)` | returns `default` | the value or `default` | same sentence |
| `d.popitem()` | `KeyError` if empty | the last-inserted `(key, value)` | *"Pairs are returned in LIFO (last-in, first-out) order."* |
| `d.clear()` | — | `None` | *"Remove all items from the dictionary."* |

`del d[k]`, `d.pop(k)` are *O*(1) on the complexity page; `popitem` is covered with its LIFO guarantee in [04 · Working with the order](02b-working-with-the-order.md). Its empty-dict error in `v3.14.7` is `KeyError("popitem(): dictionary is empty")`.

**`pop`'s parameters are positional-only.** The signature is `pop(key, /)` / `pop(key, default, /)`, so `d.pop(k, default=None)` is a `TypeError`. And there is no way to spell "pop, and default to `None`" without passing `None` — omitting the default means *raise*, not *return `None`*, which is the opposite of `get`.

## `del` versus `pop(k, None)`: assert or tolerate

They answer different questions, and choosing between them is choosing what a missing key means:

```python
# the key MUST be there — its absence is a bug worth a traceback
del sessions[session_id]

# the key may or may not be there — both are fine
sessions.pop(session_id, None)

# you need the value you removed
session = sessions.pop(session_id)          # KeyError if absent: removal and use are one step
```

`pop(k, None)` is also the documented answer to check-then-delete races. The thread-safety page lists `if key in d: del d[key]` as a *"NOT atomic: check-then-act (TOCTOU)"* example and gives the fix:

> *"To avoid time-of-check to time-of-use (TOCTOU) issues, use atomic operations or handle exceptions"* — `d.pop(key, None)`, or `try: del d[key]` / `except KeyError: pass`.

```python
# racy under threads: another thread may delete between the test and the del
if token in revoked:
    del revoked[token]

# one operation
revoked.pop(token, None)
```

⚠️ `pop(k, None)` has the same ambiguity as `get(k)`: when `None` is a value the dictionary can legitimately hold, a `None` return does not tell you whether anything was removed. Use a private sentinel, exactly as in [09 · Reading a key](04-reading-a-key.md):

```python
_MISSING = object()

removed = pending.pop(job_id, _MISSING)
if removed is _MISSING:
    log.warning("job %s was not pending", job_id)
```

## `clear()` versus `d = {}`: the object, or the name

This is the one that causes outages. `clear()` empties **the dictionary**. `d = {}` makes **one name** refer to a new, empty dictionary and leaves the old one — with all its contents — wherever else it is referenced.

```python
# cache.py
_entries: dict[str, bytes] = {}

def get_cache() -> dict[str, bytes]:
    return _entries

# worker.py
from cache import get_cache
entries = get_cache()                  # holds the dict object

# admin.py
import cache

def flush_wrong() -> None:
    cache._entries = {}                # rebinds the module attribute; worker still holds the OLD dict

def flush() -> None:
    cache._entries.clear()             # empties the object everyone holds
```

The same distinction bites inside a function without any imports, because assignment to a name makes it local:

```python
_registry: dict[str, Plugin] = {}

def reset_wrong() -> None:
    _registry = {}          # creates a LOCAL name; the module-level dict is untouched, no error

def reset() -> None:
    _registry.clear()       # no `global` needed: this mutates, it does not rebind
```

`reset_wrong` raises nothing and does nothing — the most expensive kind of bug. Rebinding is correct only when you *want* the old object to survive intact for whoever holds it, for example when handing a finished batch to a consumer and starting a new one:

```python
def take_batch(self) -> dict[str, Event]:
    batch, self._pending = self._pending, {}      # the consumer owns the old dict now
    return batch
```

## Memory: `clear()` releases, `del` does not

From [01 · The hash table underneath](01-the-hash-table-underneath.md): deleting a key leaves a *Dummy* slot, and the table does not shrink on `del`. `clear()` is different in `v3.14.7` — `clear_lock_held` swaps in the shared empty key table (`set_keys(mp, Py_EMPTY_KEYS)`) and releases the old one (`dictkeys_decref(...)`). So for a long-lived dictionary that is periodically emptied, `clear()` gives the table back, while deleting every key one at a time keeps the capacity it grew to. That is CPython implementation detail, not a language promise — but it matches the portable advice: when you mean "empty", say `clear()`, and when you mean "keep some", rebuild.

On a free-threaded build, `clear()` is also the atomic spelling: *"The `clear()` method holds the lock for its duration. Other threads cannot observe elements being removed."*

## Removing many keys

```python
# a known set of keys, some of which may be absent
for key in ("password", "token", "ssn"):
    record.pop(key, None)

# a condition over the entries: rebuild (new object)
record = {k: v for k, v in record.items() if not k.startswith("_")}

# a condition, keeping the object's identity: collect, then delete
doomed = [k for k in record if k.startswith("_")]
for key in doomed:
    del record[key]
```

`for key in record.keys() & SENSITIVE: del record[key]` is also safe, for a reason worth knowing: `&` on a keys view produces a detached `set` before the loop starts ([16 · Set operations on views](05d-set-operations-on-views.md)), so the loop does not iterate the dictionary it is deleting from. A plain `for key in record: del record[key]` does, and raises — [14 · Mutating while iterating](05b-mutating-while-iterating.md).

## `del d` is not `d.clear()`

`del d` unbinds the *name*. The dictionary is untouched, and if anything else refers to it, it lives on with every entry:

```python
config = {"region": "eu", "debug": True}
alias = config

del config            # the name `config` is gone; the dict is not
alias                 # {'region': 'eu', 'debug': True}

alias.clear()         # THIS empties the object, for every name that refers to it
```

## Gotchas

**★ Symptom: after "flushing" a cache, stale entries are still served.** Cause: the flush rebound a name to `{}`; the code serving requests holds the original dictionary. Fix: empty the object.

```python
cache._entries.clear()
```

**★ Symptom: a `reset()` function runs without error and the module-level dict is still full.** Cause: `_registry = {}` inside a function creates a local variable. Fix: mutate with `clear()` (no `global` needed), or declare `global` if you truly mean to rebind.

```python
def reset() -> None:
    _registry.clear()
```

**★ Symptom: an intermittent `KeyError` from `del d[k]` under load, right after an `if k in d` check.** Cause: another thread removed the key between the check and the delete — the documented TOCTOU case. Fix: a single operation.

```python
d.pop(k, None)
```

**★ Symptom: `KeyError` from `d.pop(k)` where the author expected `None`.** Cause: without a default, `pop` raises — unlike `get`. Fix: pass the default explicitly.

```python
value = d.pop(k, None)
```

**Symptom: `d.pop(k, default=None)` raises `TypeError`.** Cause: `pop(key, default, /)` is positional-only. Fix: pass it positionally.

```python
value = d.pop(k, None)
```

**Symptom: code cannot tell whether `pop(k, None)` removed anything.** Cause: the stored value may itself be `None`. Fix: a sentinel default.

```python
_MISSING = object()
if d.pop(k, _MISSING) is _MISSING:
    handle_absent(k)
```

**Symptom: a dictionary emptied by deleting every key keeps its memory footprint.** Cause: deletion leaves tombstones and never shrinks the table; `clear()` releases it (CPython detail). Fix: `clear()` to empty, rebuild to filter.

```python
cache.clear()                                        # empty
cache = {k: v for k, v in cache.items() if keep(v)}  # filter, fresh table
```

**Symptom: "take any pending job" via `popitem()` always processes the newest job first, starving old ones.** Cause: `popitem` is LIFO by guarantee. Fix: take from the front for FIFO.

```python
job_id = next(iter(pending))
job = pending.pop(job_id)
```

**Symptom: `popitem()` on an empty dict raises `KeyError: 'popitem(): dictionary is empty'` inside a worker loop.** Cause: the loop assumed there was work. Fix: guard on truthiness.

```python
while pending:
    job_id, job = pending.popitem()
    run(job)
```

**Symptom: removing sensitive fields from a payload also removed them from the original request object logged later.** Cause: the payload *was* the request's dict — `pop`/`del` mutated the shared object. Fix: build a redacted copy.

```python
SENSITIVE = {"password", "token"}
redacted = {k: v for k, v in payload.items() if k not in SENSITIVE}
```

**Symptom: `del config` and the dictionary is still reachable, fully populated, from elsewhere.** Cause: `del` removes a name binding, not the object. Fix: `clear()` if the intent is to empty it for everyone.

```python
config.clear()
```

## Interview questions

**★ What is the difference between `d.clear()` and `d = {}`?**
`clear()` mutates the dictionary object, so every reference to it — another module's import, an attribute on a long-lived object, a closure — sees it empty. `d = {}` rebinds one name to a new, empty dictionary and leaves the original, full, wherever else it is held. Inside a function, `d = {}` on a module-level name does not even rebind the module attribute: it creates a local, silently. So "reset the cache" is almost always `clear()`; rebinding is right only when you deliberately want the old object to survive for its current holders, as when swapping out a finished batch.

**★ When would you use `del d[k]` rather than `d.pop(k, None)`?**
When the key's absence is a bug. `del` says "this key is there" and raises `KeyError` naming it when it is not — the traceback is the diagnosis. `pop(k, None)` says "remove it if present", which is right for idempotent cleanup and is the documented race-free replacement for `if k in d: del d[k]` under threads. `pop(k)` without a default is the one to use when you need the removed value and absence is an error.

**★ Why is `if key in d: del d[key]` wrong in threaded code, and what does the documentation suggest?**
It is two operations, and another thread can remove the key between them, so the `del` raises `KeyError`. The thread-safety page lists it as a *"NOT atomic: check-then-act (TOCTOU)"* pattern and recommends `d.pop(key, None)` — a single operation that the same page lists among those that are *"safe to call from multiple threads"* — or catching the `KeyError`. The same shape is a bug in `asyncio` code if there is an `await` between the check and the delete.

**What does `d.pop(k)` do when `k` is missing, and why is that different from `get`?**
It raises `KeyError`. `get` defaults its default to `None` and *"never raises a `KeyError`"*; `pop` has no default default — the documentation: *"If default is not given and key is not in the dictionary, a `KeyError` is raised."* The asymmetry is deliberate: a removal you did not expect to be a no-op should be loud. Pass `None` (or a sentinel) explicitly when a missing key is acceptable.

**Does deleting keys give memory back?**
Not in CPython: a deleted slot becomes a tombstone so that collision probe sequences still work, and the table keeps its size. `clear()` is different — in CPython 3.14 it swaps in the shared empty key table and releases the old one. Rebuilding with a comprehension produces a table sized to what survives. None of that is a language guarantee, but the practical rule is portable: empty with `clear()`, filter by rebuilding, and do not expect a long `del` loop to shrink anything.

**How do you remove several keys, some of which may be absent?**
Loop over the keys to remove and `pop(key, None)` each — it tolerates absence and does not iterate the dictionary. If the keys are chosen by a condition over the entries, either rebuild with a comprehension (new object) or collect the doomed keys first and delete in a second loop (same object). Never delete inside a loop over the dictionary itself.

**`popitem()` removes which entry, and when is that the wrong one?**
The most recently inserted — *"Pairs are returned in LIFO (last-in, first-out) order"*, guaranteed since 3.7. That is right for a stack and for draining a dict in any order, and wrong for anything that should be fair: a work queue drained with `popitem()` starves its oldest entries whenever new ones keep arriving. For FIFO, take `next(iter(d))` and `pop` it, or use `collections.deque` for a real queue.

---

← [20 · What a merge returns](07b-what-a-merge-returns.md) · [Topic index](README.md) · Next → [22 · Subclassing dict](09-subclassing-dict.md)
