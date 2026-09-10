---
title: "An LRU cache is an OrderedDict with two rules — move_to_end on every hit, popitem(last=False) past capacity — and functools.lru_cache already implements it thread-safely, so write your own only for what lru_cache cannot do: expiry, per-key invalidation, eviction callbacks, or a budget in bytes"
sidebar_label: "07b · OrderedDict as an LRU cache"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.OrderedDict`](https://docs.python.org/3.14/library/collections.html#ordereddict-examples-and-recipes) (the `TimeBoundedLRU` and `MultiHitLRUCache` recipes), [`functools.lru_cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache) (thread safety, hashable arguments, `cache_info`, `cache_clear`, `__wrapped__`, references kept until eviction), [`time.monotonic`](https://docs.python.org/3.14/library/time.html#time.monotonic). `OrderedDict` behaviour as in [07](07-ordereddict-what-it-still-does.md). Target: **Python 3.14.7**. **No sandbox run, no timings.**

**A least-recently-used cache needs two things from its storage: find an entry by key in O(1), and know which entry was touched longest ago in O(1). An `OrderedDict` gives both — the hash table for the first, the linked list for the second — and the whole algorithm is two lines: on a hit, `move_to_end(key)`; after an insert, `popitem(last=False)` while over capacity. The documentation's own recipes do exactly that. But before writing one, notice that `functools.lru_cache` is this data structure already, in C, *"threadsafe so that the wrapped function can be used in multiple threads"*. The reasons to build your own are specific: entries that must expire, entries that must be invalidated individually when the underlying data changes, evicted values that must be closed, capacity measured in bytes rather than entries, or a cache that is not a function's arguments-to-result map. And a hand-built cache is a sequence of dict operations, so it needs its own lock — which is the part most home-grown caches get wrong.**

## First: `functools.lru_cache`

> *"Decorator to wrap a function with a memoizing callable that saves up to the *maxsize* most recent
> calls."*
> *"The cache is threadsafe so that the wrapped function can be used in multiple threads. This means
> that the underlying data structure will remain coherent during concurrent updates."*
> *"It is possible for the wrapped function to be called more than once if another thread makes an
> additional call before the initial call has been completed and cached."*
> *"Since a dictionary is used to cache results, the positional and keyword arguments to the function
> must be hashable."*

```python
from functools import lru_cache


@lru_cache(maxsize=1024)
def exchange_rate(base: str, quote: str) -> float:
    return fetch_rate_from_provider(base, quote)


exchange_rate("EUR", "USD")
exchange_rate.cache_info()        # hits, misses, maxsize, currsize — a named tuple
exchange_rate.cache_clear()       # the only invalidation: everything
exchange_rate.__wrapped__("EUR", "USD")   # bypass the cache
```

The documented surface is `cache_info()`, `cache_clear()` — *"for clearing or invalidating the cache"* — `cache_parameters()`, and `__wrapped__`. There is no way to drop one key, no expiry, no eviction hook, and the key is the call's arguments. And one sentence matters for memory: *"The cache keeps references to the arguments and return values until they age out of the cache or until the cache is cleared."*

## The minimal LRU on `OrderedDict`

```python
import threading
from collections import OrderedDict
from typing import Generic, Hashable, TypeVar

K = TypeVar("K", bound=Hashable)
V = TypeVar("V")
_MISSING = object()


class LRUCache(Generic[K, V]):
    """O(1) get/put/delete. Most recently used at the right end."""

    def __init__(self, capacity: int) -> None:
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        self.capacity = capacity
        self._data: OrderedDict[K, V] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: K, default: V | None = None) -> V | None:
        with self._lock:
            value = self._data.get(key, _MISSING)
            if value is _MISSING:
                return default
            self._data.move_to_end(key)                  # rule 1: a hit makes it most recent
            return value

    def put(self, key: K, value: V) -> None:
        with self._lock:
            self._data[key] = value
            self._data.move_to_end(key)                  # an update is also a use
            while len(self._data) > self.capacity:
                self._data.popitem(last=False)           # rule 2: evict the least recent

    def delete(self, key: K) -> None:
        with self._lock:
            self._data.pop(key, None)                    # per-key invalidation

    def __len__(self) -> int:
        return len(self._data)
```

Every operation is a constant number of dict and linked-list steps. The lock is not optional in threaded code: `get` is a lookup *and* a reorder, `put` is an insert, a reorder and possibly an eviction, and another thread interleaving between those steps can reorder or evict the entry you are working on. On the free-threaded build each `OrderedDict` call is internally consistent, but nothing makes the *sequence* atomic; on the default build the GIL does not either.

A plain `dict` can implement the same two rules — `d[k] = d.pop(k)` to move to the end, `next(iter(d))` to find the oldest — but the oldest-key lookup degrades under exactly the insert-evict churn a cache produces ([07](07-ordereddict-what-it-still-does.md) explains why). This is the workload `OrderedDict` exists for.

## Expiry: the documentation's `TimeBoundedLRU`

```python
from collections import OrderedDict
from time import monotonic

class TimeBoundedLRU:
    "LRU Cache that invalidates and refreshes old entries."

    def __init__(self, func, maxsize=128, maxage=30):
        self.cache = OrderedDict()      # { args : (timestamp, result)}
        self.func = func
        self.maxsize = maxsize
        self.maxage = maxage

    def __call__(self, *args):
        if args in self.cache:
            self.cache.move_to_end(args)
            timestamp, result = self.cache[args]
            if monotonic() - timestamp <= self.maxage:
                return result
        result = self.func(*args)
        self.cache[args] = monotonic(), result
        if len(self.cache) > self.maxsize:
            self.cache.popitem(last=False)
        return result
```

Three details worth copying: it stores `(timestamp, result)` and checks age on read, so an entry older than `maxage` is recomputed and overwritten; it uses `time.monotonic()` — *"a clock that cannot go backwards. The clock is not affected by system clock updates."* — so a wall-clock step cannot make an age negative or huge, as it can with `time.time()`; and eviction is still by recency, not by age. The consequence of the last point: an expired entry that is never read again stays until recency pushes it out — memory is bounded by `maxsize`, not by `maxage`. The recipe also has no lock; it is a single-threaded illustration.

## Admission: `MultiHitLRUCache`

The documentation's second recipe is *"LRU cache that defers caching a result until it has been requested multiple times."* — its docstring gives the reason: *"To avoid flushing the LRU cache with one-time requests, we don't cache until a request has been made more than once."* It keeps two `OrderedDict`s: `requests` counts uncached keys (itself bounded, evicting the oldest with `popitem(last=False)`), and `cache` holds results only for keys seen more than `cache_after` times. That is the answer to a real production problem — a crawler or a report that touches every key once evicts the entire hot set of an ordinary LRU — and it is built from the same two primitives.

## What a custom cache is for

**Invalidate one key when the data changes** — the thing `lru_cache` cannot do:

```python
user_cache: LRUCache[int, dict] = LRUCache(capacity=10_000)

def on_user_updated(user_id: int) -> None:
    user_cache.delete(user_id)          # the next read refetches just this user
```

**Close what you evict** — clients, file handles, compiled resources:

```python
class ClosingLRU(LRUCache[str, "Client"]):
    def put(self, key: str, value: "Client") -> None:
        evicted = []
        with self._lock:
            self._data[key] = value
            self._data.move_to_end(key)
            while len(self._data) > self.capacity:
                evicted.append(self._data.popitem(last=False)[1])
        for client in evicted:
            client.close()                  # outside the lock: close() may block
```

**Budget in bytes, not entries** — track a running size and evict while over it:

```python
class ByteBudgetLRU:
    def __init__(self, max_bytes: int) -> None:
        self.max_bytes = max_bytes
        self.used = 0
        self._data: OrderedDict[str, bytes] = OrderedDict()

    def put(self, key: str, blob: bytes) -> None:
        old = self._data.pop(key, None)
        if old is not None:
            self.used -= len(old)
        self._data[key] = blob
        self.used += len(blob)
        while self.used > self.max_bytes and self._data:
            _, evicted = self._data.popitem(last=False)
            self.used -= len(evicted)
```

## Gotchas

**★ Symptom: the "LRU" cache behaves like FIFO — hot keys are evicted as soon as they get old.** Cause: a hit returns the value without `move_to_end`, so order stays insertion order. Fix: move on every hit (and on every update).

```python
value = self._data[key]
self._data.move_to_end(key)
```

**★ Symptom: the cache evicts the entry that was just inserted.** Cause: eviction with `popitem()`, which defaults to `last=True` — the newest. Fix: evict from the left.

```python
self._data.popitem(last=False)
```

**★ Symptom: under concurrent load, `KeyError` from `move_to_end` or a cache that briefly exceeds capacity.** Cause: `get` and `put` are several `OrderedDict` operations; another thread evicts or inserts in between. Fix: one lock around each compound operation — or use `functools.lru_cache`, which is documented as thread-safe.

```python
with self._lock:
    self._data.move_to_end(key)
```

**★ Symptom: instances are never garbage-collected after `@lru_cache` was put on a method.** Cause: `self` is an argument, and *"The cache keeps references to the arguments and return values until they age out of the cache or until the cache is cleared."* Fix: cache a module-level function of the fields that matter, or keep a per-instance cache.

```python
from functools import lru_cache

@lru_cache(maxsize=1024)
def _price_for(sku: str, region: str) -> int:
    return lookup_price(sku, region)

class Catalogue:
    def price(self, sku: str) -> int:
        return _price_for(sku, self.region)
```

**Symptom: a caller mutates a cached result and every later caller sees the change.** Cause: the cache returns the stored object, not a copy. Fix: cache immutable values, or copy on the way out.

```python
return dict(value)          # or store a tuple / frozen dataclass / MappingProxyType
```

**Symptom: an expensive function runs twice for the same key during a traffic spike, despite the cache.** Cause: for `lru_cache`, documented — *"It is possible for the wrapped function to be called more than once if another thread makes an additional call before the initial call has been completed and cached."* Custom caches have the same gap between miss and put. Fix: accept it, or add per-key single-flight.

```python
_inflight: dict[str, threading.Lock] = {}      # one lock per key ever seen — prune it in real code

def get_or_compute(key: str) -> bytes:
    if (hit := cache.get(key)) is not None:
        return hit
    lock = _inflight.setdefault(key, threading.Lock())
    with lock:
        if (hit := cache.get(key)) is not None:
            return hit
        value = compute(key)
        cache.put(key, value)
        return value
```

**Symptom: `TypeError: unhashable type: 'list'` from a cached function.** Cause: arguments are dictionary keys — *"the positional and keyword arguments to the function must be hashable"*. Fix: pass tuples or frozensets.

```python
report(tuple(sorted(filters)))
```

**Symptom: `cache_info()` shows two entries for what looks like one call.** Cause: the documentation says *"`f(a=1, b=2)` and `f(b=2, a=1)` differ in their keyword argument order and may have two separate cache entries."* Fix: call with a consistent signature (positional, or a fixed keyword order).

```python
exchange_rate("EUR", "USD")
```

**Symptom: `RuntimeError: OrderedDict mutated during iteration` from a cache-warming loop.** Cause: the loop iterates the cache's `OrderedDict` and calls `get`, which moves keys. Fix: iterate a snapshot.

```python
for key in list(cache._data):
    cache.get(key)
```

**Symptom: an expiring cache's memory never shrinks at night when traffic stops.** Cause: in the `TimeBoundedLRU` design, age is checked only on read; expired entries leave only when evicted by recency. Fix: sweep from the oldest end — it is ordered by recency, so stop at the first fresh entry.

```python
def sweep(self) -> None:
    now = monotonic()
    while self.cache:
        oldest_key = next(iter(self.cache))
        if now - self.cache[oldest_key][0] <= self.maxage:
            break
        self.cache.popitem(last=False)
```

## Interview questions

**★ Implement an LRU cache with O(1) `get` and `put`.**
Store entries in an `OrderedDict`. `get`: look up the key; on a hit call `move_to_end(key)` and return the value. `put`: assign, `move_to_end(key)`, then `popitem(last=False)` while `len > capacity`. The hash table makes lookup O(1); the linked list makes both "move to most recent" and "remove least recent" O(1). In threaded code wrap each method in a lock, because each is several operations. Without `OrderedDict`, the textbook version is a dict of key → node plus a hand-written doubly-linked list, which is exactly what `OrderedDict` is.

**★ When would you write your own cache instead of using `functools.lru_cache`?**
When you need something `lru_cache` does not offer: expiry by age; invalidation of a single key when the source data changes (it has only `cache_clear`); a callback when an entry is evicted, to close a connection or file; capacity in bytes; keys that are not the function's arguments; or a cache shared across several functions. Otherwise `lru_cache` is better: it is in C, documented as thread-safe, and has `cache_info` for tuning.

**★ Why is `@lru_cache` on an instance method a memory leak?**
`self` is one of the arguments, and the documentation says the cache *"keeps references to the arguments and return values until they age out of the cache or until the cache is cleared."* Every instance that calls the method is kept alive by the cache until evicted — with `maxsize=None`, forever. Cache a module-level function of the values that matter, or give each instance its own cache that dies with it.

**How does the documentation's `TimeBoundedLRU` handle expiry, and what does it not handle?**
It stores `(timestamp, result)` per key using `time.monotonic()` and, on a hit, recomputes if the entry is older than `maxage`; eviction when full is still by recency. It does not remove expired entries proactively, so memory is bounded by `maxsize`, not by age, and it has no lock. A sweep from the least-recent end, stopping at the first fresh entry, adds proactive expiry cheaply because the dictionary is already ordered by recency.

**What problem does `MultiHitLRUCache` solve?**
Cache pollution by one-time requests. In a plain LRU, a scan that touches many keys once evicts the entire working set. The recipe admits a result into the cache only after the key has been requested more than `cache_after` times, tracking uncached request counts in a second, bounded `OrderedDict`. Both structures use the same primitives — `move_to_end` on use and `popitem(last=False)` on overflow.

**Is an `OrderedDict`-based cache thread-safe?**
Not as a cache. Individual `OrderedDict` operations keep the structure consistent, but `get` is a lookup plus a reorder and `put` is an insert, a reorder and an eviction; another thread can act in between, so you get `KeyError`s from `move_to_end`, transient over-capacity, or a result for a key that was just evicted. One lock per compound operation fixes it. `functools.lru_cache` is documented as thread-safe and is the simpler answer when it fits.

---

← Prev: [07 · `OrderedDict` — what it still does](07-ordereddict-what-it-still-does.md) · [Topic index](README.md)
