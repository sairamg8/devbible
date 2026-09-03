---
title: "Memoization with lru_cache and cache: eviction policies, unhashable traps, and method memory leaks"
sidebar_label: "02 · lru_cache and cache"
sidebar_position: 61
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-03 against Python 3.14 Library Reference (functools module: lru_cache, cache).
> Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**Memoization trades memory for execution time by caching the return values of deterministic functions based on their input arguments. Python provides two standard caching decorators: `@functools.lru_cache(maxsize=128)` (which maintains a bounded Least Recently Used eviction table) and `@functools.cache` (a faster, unbounded wrapper equivalent to `maxsize=None`). Because cache keys are derived from argument hashes, passing mutable containers (`list`, `dict`) raises an immediate `TypeError`. Crucially, decorating an instance method with `lru_cache` creates a severe memory leak by capturing `self` inside the function's internal cache dictionary, preventing garbage collection of instances.**

## `@functools.cache` versus `@functools.lru_cache`

The standard library offers two memoization tools tailored for different memory profiles:

```python
from functools import lru_cache, cache

# 1. UNBOUNDED CACHE: No maximum size, no eviction
@cache
def fibonacci(n: int) -> int:
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

# 2. BOUNDED LRU CACHE: Evicts least recently used items when full
@lru_cache(maxsize=1024)
def fetch_product_metadata(product_id: int) -> dict:
    ...
```

### Production rules: Bounded vs Unbounded

- **Use `@functools.cache`** only when the domain of input arguments is finite and small (e.g. recursive mathematical sequences, finite enum values, or immutable compiler tokens).
- **Use `@functools.lru_cache(maxsize=N)`** for web servers, database lookups, or API handlers. Using an unbounded cache on arbitrary user inputs creates an **Out-Of-Memory (OOM) denial-of-service vulnerability** because the dictionary grows indefinitely.

## The `typed` parameter

By default, `lru_cache(typed=False)` treats arguments that compare equal as the same cache key, even if their types differ:

```python
@lru_cache(maxsize=128, typed=False)
def square(x):
    return x * x

square(3)    # Cache miss -> returns 9 (int)
square(3.0)  # Cache HIT -> returns 9 (int), because 3 == 3.0 and hash(3) == hash(3.0)!
```

If your function returns different types depending on the argument type, enable `typed=True`:

```python
@lru_cache(maxsize=128, typed=True)
def typed_square(x):
    return x * x

typed_square(3)    # Caches (int, 3) -> 9
typed_square(3.0)  # Caches (float, 3.0) -> 9.0 (distinct cache entry!)
```

## Cache introspection and invalidation

Every decorated function exposes `.cache_info()` and `.cache_clear()`:

```python
print(fetch_product_metadata.cache_info())
# Output: CacheInfo(hits=42, misses=10, maxsize=1024, currsize=10)

# Invalidate and reset all entries
fetch_product_metadata.cache_clear()
```

Monitoring `hits / (hits + misses)` allows engineering teams to calibrate `maxsize` accurately in production.

## The instance method memory leak hazard

A critical bug occurs when `@lru_cache` is applied directly to an instance method:

```python
class UserSession:
    def __init__(self, user_id: int):
        self.user_id = user_id

    # CRITICAL LEAK: Decorating an instance method!
    @lru_cache(maxsize=1000)
    def compute_permissions(self) -> list[str]:
        return ["read", "write"]
```

### Why this leaks memory

1. In Python, calling `session.compute_permissions()` passes `session` as the first argument (`self`).
2. `lru_cache` stores `self` as part of the lookup key in its internal cache dictionary.
3. Even if external code discards all references (`del session`), the function object's cache table holds a strong reference to `session`.
4. As thousands of user sessions are created, **none of them can ever be garbage collected**, causing steady memory exhaustion.

### The two architectural solutions

#### Solution 1: Use `@functools.cached_property`
For zero-argument methods, use `@cached_property`. It stores the computed value directly on `self.__dict__`. When `self` is deleted, its cached data is freed automatically:

```python
from functools import cached_property

class UserSession:
    def __init__(self, user_id: int):
        self.user_id = user_id

    # SAFE: Stored in self.__dict__, freed when instance is deleted
    @cached_property
    def permissions(self) -> list[str]:
        return ["read", "write"]
```

#### Solution 2: Cache an external pure function
Extract the computation to a module-level function that accepts only primitive, hashable identifiers:

```python
@lru_cache(maxsize=1000)
def _get_permissions_for_user(user_id: int) -> tuple[str, ...]:
    return ("read", "write")

class UserSession:
    def __init__(self, user_id: int):
        self.user_id = user_id

    def compute_permissions(self) -> tuple[str, ...]:
        return _get_permissions_for_user(self.user_id)
```

## Gotchas

### Unhashable argument `TypeError`
**Symptom.** `TypeError: unhashable type: 'list'` or `'dict'` when calling a cached function.
**Cause.** `lru_cache` requires all arguments to be hashable to compute dictionary keys.
**Fix.** Convert mutable arguments to immutable equivalents (`tuple` for lists, `frozenset` for sets):

```python
# BROKEN: list is unhashable
# @lru_cache
# def summarize(items: list[int]): ...

# FIXED: convert to tuple
@lru_cache
def summarize(items: tuple[int, ...]):
    return sum(items)
```

### Mutating cached return values
**Symptom.** Intermittent data corruption across unrelated HTTP requests.
**Cause.** A cached function returned a mutable object (like a list or dict). A caller modified that return value in place, altering the cached copy for all subsequent callers.
**Fix.** Return immutable objects (`tuple`, `MappingProxyType`), or return shallow copies:

```python
# BROKEN: callers can mutate the cached list!
@lru_cache
def get_allowed_roles():
    return ["admin", "editor"]

# FIXED: return immutable tuple
@lru_cache
def get_allowed_roles():
    return ("admin", "editor")
```

## Interview questions

**★ Q: What is the difference between `@functools.cache` and `@functools.lru_cache`?**
`@functools.cache` is an unbounded cache (equivalent to `lru_cache(maxsize=None)`). It never evicts items, growing indefinitely as new arguments are encountered. `@functools.lru_cache(maxsize=N)` is a bounded cache that evicts the least recently used entries once the size reaches `maxsize`. In production services handling unbounded or user-controlled inputs, `lru_cache(maxsize=...)` must be used to prevent Out-Of-Memory crashes.

**★ Q: Why is decorating an instance method with `@lru_cache` considered a memory leak hazard?**
Because instance methods pass `self` as their first argument. The cache dictionary retains a strong reference to `self` as part of its composite key. When external references to the instance are removed, the instance cannot be deallocated because the method's cache dictionary continues holding it.

**★ Q: What happens if you mutate an object returned by an `@lru_cache` decorated function?**
`lru_cache` returns the exact object reference stored in memory without creating a copy. If caller A mutates that object (e.g. `result.append("new")`), caller B will receive that mutated object on subsequent cache hits. Cached functions should always return immutable objects (such as `tuple` or `frozenset`) or callers must copy results explicitly.

**Q: What does the `typed=True` parameter in `@lru_cache` control?**
By default (`typed=False`), Python treats equal arguments with identical hashes (such as `3` and `3.0`) as the same cache key. Setting `typed=True` forces the cache to distinguish argument types, creating distinct entries for `f(3)` and `f(3.0)`.

**Q: How can you inspect the hit rate and size of an `lru_cache` at runtime?**
Invoke `func.cache_info()`, which returns a named tuple `CacheInfo(hits, misses, maxsize, currsize)`. The cache hit ratio is calculated as `hits / (hits + misses)`.

---

← [partial and partialmethod](01-partial-and-freezing-callables.md) · [Topic index](README.md) · Next → [singledispatch and reduce](03-singledispatch-and-reduce.md)
