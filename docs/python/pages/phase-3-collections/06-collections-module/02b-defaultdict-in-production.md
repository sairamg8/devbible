---
title: "A defaultdict is safe inside the function that builds it and a liability everywhere else — reads grow it without bound, a lambda factory cannot be pickled, JSON drops the factory, a subclass breaks copy(), and under contention the factory can run twice"
sidebar_label: "02b · defaultdict in production"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#defaultdict-objects), [`pickle` — What can be pickled](https://docs.python.org/3.14/library/pickle.html#what-can-be-pickled-and-unpickled), [`copy`](https://docs.python.org/3.14/library/copy.html), [`dataclasses` — Mutable default values](https://docs.python.org/3.14/library/dataclasses.html#mutable-default-values), [`json`](https://docs.python.org/3.14/library/json.html). `copy()`, `__reduce__` and `__missing__` read from CPython **v3.14.7** [`Modules/_collectionsmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_collectionsmodule.c) (`defdict_copy`, `defdict_reduce`, `defdict_missing`) — **implementation detail, not a documented guarantee**. Target: **Python 3.14.7**. **No sandbox run.**

**[02](02-defaultdict.md) is the defaultdict you build in a loop and throw away. This chunk is the one that escapes — returned from a function, stored on a class, cached, sent to a worker process, serialised. Every property that made it convenient inside the builder becomes a defect outside it. A read on a missing key inserts, so a long-running service that looks up request-supplied keys in a defaultdict grows a key for every distinct probe. The factory is part of the object's state, so a `lambda` factory makes the whole structure unpicklable. JSON keeps the data and silently drops the factory, so behaviour changes after a round trip through a cache. `copy()` calls the class with the factory as its first argument, so a subclass with a different constructor breaks. And the factory is called outside any lock, so two threads that miss the same key can both call it. The single rule that prevents most of this: build with a `defaultdict`, return a `dict`.**

## Reads that insert, in a process that never restarts

A request handler that *reads* from a defaultdict grows it on every miss. In a batch job that is a curiosity; in a service that runs for weeks it is a memory leak with a cardinality equal to the number of distinct keys anyone ever asked about:

```python
from collections import defaultdict

hits_by_path: defaultdict[str, int] = defaultdict(int)


def record(path: str) -> None:
    hits_by_path[path] += 1                      # write path: inserting is the point


def hits_for(path: str) -> int:
    return hits_by_path[path]                    # 🔴 read path: inserts every unknown path
```

A scanner probing ten thousand random URLs against `hits_for` adds ten thousand keys, each with a zero, and every later `len(hits_by_path)` and every metrics export includes them. The read path must not use `d[k]`:

```python
def hits_for(path: str) -> int:
    return hits_by_path.get(path, 0)             # no insert
```

Nothing in the type stops the wrong one being written later, which is why the durable fix is to not expose the defaultdict at all — keep it private to the module and expose functions.

## Leaving the function: return a plain dict

Code that receives a defaultdict inherits its `d[k]`-never-raises behaviour without knowing it — the dict topic's [11 · `setdefault`](../03-dict/04c-setdefault.md) covers the "missing keys come back as empty results" bug that follows. Convert at the boundary. For a flat grouping, `dict(grouped)`; for nested defaultdicts, recursively:

```python
from collections import defaultdict
from typing import Any


def to_plain(value: Any) -> Any:
    """Recursively turn defaultdicts (and any other dict subclass) into plain dicts."""
    if isinstance(value, dict):
        return {key: to_plain(inner) for key, inner in value.items()}
    return value


daily: defaultdict[str, defaultdict[str, int]] = defaultdict(lambda: defaultdict(int))
daily["2026-09-10"]["/checkout"] += 1
report = to_plain(daily)            # {'2026-09-10': {'/checkout': 1}} — nothing creates on read now
```

`isinstance(value, dict)` also matches `Counter` and `OrderedDict`, so this flattens those too — which is what you want for serialisation and not what you want if the caller needed `most_common`. Write the converter for the shape you have.

## Pickling: the factory travels by name

`pickle` stores a defaultdict as its class, its factory and its items — in `v3.14.7`, `defdict_reduce` returns `(type(self), (default_factory,), None, None, iter(self.items()))`, and its comment states the consequence: *"For this to be useful with pickle.py, the default_factory must be picklable; e.g., None, a built-in, or a global function in a module or package."* The `pickle` documentation says which functions qualify:

> *"functions (built-in and user-defined) accessible from the top level of a module (using `def`,
> not `lambda`);"*

> *"Note that functions (built-in and user-defined) are pickled by fully qualified name, not by
> value."*

So `defaultdict(list)` pickles and `defaultdict(lambda: defaultdict(int))` does not — and the failure appears wherever pickle is used implicitly: arguments and return values of a `multiprocessing` pool or a `ProcessPoolExecutor`, a task queue configured with a pickle serialiser, `shelve`, an on-disk cache. Three fixes, in order of preference:

```python
import pickle
from collections import defaultdict
from functools import partial

# 1. Do not send the defaultdict — send what it built.
payload = pickle.dumps(to_plain(daily))

# 2. A named, module-level factory pickles by reference.
def int_counter() -> defaultdict[str, int]:
    return defaultdict(int)

nested = defaultdict(int_counter)
payload = pickle.dumps(nested)

# 3. functools.partial defines __reduce__ (Lib/functools.py, v3.14.7), so a partial
#    over picklable parts pickles too.
nested = defaultdict(partial(defaultdict, int))
payload = pickle.dumps(nested)
```

The receiving process must be able to import the factory by the same qualified name — the `pickle` docs: *"the defining module must be importable in the unpickling environment, and the module must contain the named object"*. A function defined inside another function is not *"accessible from the top level of a module"* and fails for the same reason a lambda does.

## JSON: the data survives, the factory does not

A defaultdict is a `dict`, so `json.dumps` writes it as an object without complaint. `json.loads` builds plain dicts. Anything downstream that relied on `d[k]` returning a default now raises `KeyError` — typically in the code that reads back from a Redis or file cache, which is exercised far less often than the code that wrote to it:

```python
import json
from collections import defaultdict

cached = json.loads(redis_value)                    # plain dict
hits = defaultdict(int, cached)                     # re-attach the factory explicitly
```

## `copy()`, `|` and subclasses: the constructor is called

`defaultdict.copy()` is not `dict.copy()`. In `v3.14.7`, `defdict_copy` calls `type(self)(self.default_factory, self)` — the new object keeps the factory, and the copy is shallow, so the lists inside are shared:

```python
groups = defaultdict(list, {"a": [1]})
clone = groups.copy()
clone["a"].append(2)
groups["a"]                                  # [1, 2] — one list, two dicts
```

The source comment spells out the subclass consequence: *"This calls the object's class. That only works for subclasses whose class constructor has the same signature. Subclasses that define a different constructor signature must override copy()."* The same call is made by `|` (see [20 · What a merge returns](../03-dict/07b-what-a-merge-returns.md)) and, through `__reduce__`, by `pickle` and `copy.copy`:

```python
from collections import defaultdict


class TenantGroups(defaultdict):
    def __init__(self, tenant: str) -> None:
        super().__init__(list)
        self.tenant = tenant

    def copy(self) -> "TenantGroups":
        clone = TenantGroups(self.tenant)
        clone.update(self)
        return clone

    __copy__ = copy

    def __reduce__(self):
        return (TenantGroups, (self.tenant,), None, None, iter(self.items()))
```

For deep copies, the `copy` documentation is the authority: it *"does "copy" functions and classes (shallow and deeply), by returning the original object unchanged"* — so `copy.deepcopy` of a defaultdict keeps the same factory object and duplicates the contents. (The `defdict_reduce` comment in `v3.14.7` still says functions *"are not copyable at this time"*; the `copy` documentation is the later and authoritative statement.)

## Two threads, one missing key

`defdict_missing` in `v3.14.7` calls the factory and then inserts with `PyDict_SetDefaultRef` — insert only if the key is still absent, and return whichever value ended up stored. So when two threads miss the same key at once (on the free-threaded build, or on the default build when the factory is Python code the interpreter can switch out of), **both may call the factory, but only one result is stored, and both callers receive that one.** For `defaultdict(list)` that means `groups[k].append(x)` from two threads does not lose an append to a discarded list. It does mean the factory can run more often than there are keys — harmless for `list`, a leak for a factory that opens a connection:

```python
import threading
from collections import defaultdict

_lock = threading.Lock()
_pools: dict[str, "ConnectionPool"] = {}


def pool_for(dsn: str) -> "ConnectionPool":
    pool = _pools.get(dsn)
    if pool is None:
        with _lock:
            pool = _pools.get(dsn)
            if pool is None:
                pool = _pools[dsn] = ConnectionPool(dsn)     # built exactly once
    return pool
```

This behaviour is read from the source, not documented; do not build correctness on it. And it does nothing for the value's own operations: `counts[k] += 1` on a `defaultdict(int)` is a read-modify-write race exactly as on a dict — [25 · dict across threads](../03-dict/10-dict-across-threads.md).

## Class attributes and dataclass fields

A defaultdict as a class attribute is one object shared by every instance — the ordinary mutable-class-attribute bug, harder to spot because nothing is ever "assigned":

```python
from collections import defaultdict
from dataclasses import dataclass, field


class EventBus:
    handlers = defaultdict(list)             # 🔴 one registry for every EventBus ever made


@dataclass
class Bus:
    handlers: defaultdict[str, list] = field(default_factory=lambda: defaultdict(list))
```

`dataclasses` catches the direct form — `handlers: defaultdict = defaultdict(list)` raises `ValueError`, because the decorator *"will raise a `ValueError` if it detects an unhashable default parameter. The assumption is that if a value is unhashable, it is mutable."* A plain class has no such check.

## Gotchas

**★ Symptom: a long-running service's memory and metric cardinality grow with traffic from scanners, not users.** Cause: a read path indexes a module-level defaultdict with request-supplied keys; every miss inserts. Fix: read with `get`, and keep the defaultdict private.

```python
def hits_for(path: str) -> int:
    return hits_by_path.get(path, 0)
```

**★ Symptom: a `PicklingError` when a defaultdict goes to a process pool, a task queue or `shelve`.** Cause: the factory is pickled by qualified name, and a `lambda` or nested function has none that can be imported — the `pickle` docs allow only functions *"accessible from the top level of a module (using `def`, not `lambda`)"*. Fix: send plain dicts, or use a module-level factory or a `partial`.

```python
nested = defaultdict(partial(defaultdict, int))
```

**★ Symptom: code that worked on fresh data raises `KeyError` on data read back from a JSON cache.** Cause: `json.loads` returns plain dicts; the factory was never serialised. Fix: re-wrap on load, or stop relying on the factory outside the builder.

```python
hits = defaultdict(int, json.loads(raw))
```

**★ Symptom: two `EventBus()` instances deliver each other's events.** Cause: `handlers = defaultdict(list)` in the class body is one object shared by all instances. Fix: create it per instance.

```python
class EventBus:
    def __init__(self) -> None:
        self.handlers: defaultdict[str, list] = defaultdict(list)
```

**Symptom: a `TypeError` about the constructor's arguments from `groups.copy()`, `groups | other` or `copy.copy(groups)` on a defaultdict subclass — or, worse, a `pickle` round trip that succeeds and leaves `tenant` set to `<class 'list'>`.** Cause: all of them call the class the way `defaultdict` expects — `type(self)(default_factory, …)`. The copy paths pass two arguments to a one-argument `__init__` and fail loudly; the inherited `__reduce__` passes only the factory, which lands in the `tenant` parameter, and records no instance attributes at all. Fix: override `copy`, `__copy__` and `__reduce__` as shown above (and `__or__` / `__ror__` per [20](../03-dict/07b-what-a-merge-returns.md)).

```python
def __reduce__(self):
    return (TenantGroups, (self.tenant,), None, None, iter(self.items()))
```

**Symptom: after `clone = groups.copy()`, appending to `clone[k]` changes `groups[k]`.** Cause: `copy()` is shallow — the new defaultdict holds the same list objects. Fix: copy one level down (or `copy.deepcopy` for arbitrary nesting).

```python
clone = defaultdict(groups.default_factory, {k: list(v) for k, v in groups.items()})
```

**Symptom: a connection factory in a defaultdict opens two connections for the same host under load, and one is never closed.** Cause: the factory runs before the insert-if-absent, so concurrent misses can both run it; only one result is stored (v3.14.7 `defdict_missing`). Fix: do not put resource-creating factories in a defaultdict — build under a lock.

```python
with _lock:
    pool = _pools.get(dsn) or _pools.setdefault(dsn, ConnectionPool(dsn))
```

**Symptom: logs show `defaultdict(<class 'list'>, {...})` where a dict was expected, and a log-parsing job chokes on it.** Cause: `defdict_repr` prefixes the factory's repr. Fix: log `dict(d)` (or JSON) at the boundary, not the live object.

```python
logger.info("groups=%s", json.dumps(dict(groups)))
```

## Interview questions

**★ Why is returning a `defaultdict` from a public function a design smell?**
Because its defining behaviour — `d[k]` on a missing key inserts and returns a default — is invisible in the type most readers expect. Downstream code that uses `d[k]` to detect absence stops getting `KeyError` and starts getting empty results, `len()` grows as a side effect of reads, and a read path with user-supplied keys becomes an unbounded memory leak. Build with a `defaultdict` inside the function and return `dict(d)` (recursively for nested ones); if the copy is too costly, set `default_factory = None` so misses raise again.

**★ Why can't you pickle `defaultdict(lambda: defaultdict(int))`, and what do you do?**
`pickle` records a defaultdict as its class plus its factory plus its items, and functions are pickled *"by fully qualified name, not by value"* — only functions *"accessible from the top level of a module (using `def`, not `lambda`)"* have one. The lambda does not, so pickling fails, and that surfaces wherever pickle is used implicitly: process pools, task queues, `shelve`, disk caches. Convert to plain dicts before crossing the process boundary, or use a module-level `def` factory, or `functools.partial(defaultdict, int)`, which defines `__reduce__`.

**Can two threads calling `groups[k].append(x)` on a new key lose an append?**
Not in CPython 3.14's implementation: `__missing__` calls the factory and then inserts with `PyDict_SetDefaultRef`, which stores a value only if the key is still absent and returns whatever is stored — so both threads end up appending to the same list, even if the factory ran twice. That is read from `Modules/_collectionsmodule.c`, not promised by the documentation, so a design that needs it should still lock. And it is only about creation: `counts[k] += 1` remains a lost-update race.

**What does `copy()` return for a `defaultdict`, and how deep is it?**
A new defaultdict of the same class with the same `default_factory`, holding the same value objects — a shallow copy. In CPython it is `type(self)(self.default_factory, self)`, which is also why a subclass with a different `__init__` signature must override `copy` (the source comment says exactly that). For independent inner lists, copy one level yourself or use `copy.deepcopy`, which the `copy` docs say returns functions unchanged, so the factory is shared and the contents duplicated.

**Your service keeps request counts in a module-level `defaultdict(int)`. What are the risks?**
Three. Reads with `counts[path]` insert, so scans and typos grow it permanently; use `get` on every read path. `counts[path] += 1` from concurrent handlers is a read-modify-write that loses increments on both builds; use a lock, a per-thread counter merged later, or a metrics library. And the dictionary never shrinks on its own, so an unbounded key space (paths with IDs in them) needs normalising or capping before it is used as a key.

**How does `json` treat a `defaultdict`, and why does that matter for caching?**
As an ordinary `dict` subclass: the encoder writes it as a JSON object and never records the factory. Loading gives back plain dicts. So a value written to a cache as a defaultdict and read back is a different kind of object — code that relied on `d[k]` defaults works on a cache miss (fresh object) and raises `KeyError` on a cache hit. Either re-wrap on load with `defaultdict(factory, loaded)` or stop relying on the factory outside the code that builds the structure.

---

← Prev: [02 · `defaultdict` — a factory behind `d[k]`](02-defaultdict.md) · [Topic index](README.md) · Next → [03 · `Counter` — counting semantics](03-counter.md)
