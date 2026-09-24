---
name: research-python-p02-t06-functools
description: Banked Research: Python Phase 2 · Topic 06 — functools
metadata:
  type: research
---

# Banked Research: Python Phase 2 · Topic 06 — functools

> Verified: 2026-09-03 against Python 3.14 Library Reference (functools module).
> Target: **CPython 3.14** (3.14.7).
> Do not re-derive.

---

## 1. Primary Sources & Verbatim Quotes

### Python 3.14 Library Reference — functools module
URL: https://docs.python.org/3.14/library/functools.html

- `functools.partial(func, /, *args, **keywords)`:
  - *"Return a new `partial` object which when called will behave like `func` called with the positional arguments `args` and keyword arguments `keywords`."*
  - *"A `partial` object is callable, weakly referenceable, and has the following attributes: `func`, `args`, `keywords`."*
- `functools.partialmethod(func, /, *args, **keywords)`:
  - *"Return a new `partialmethod` descriptor which behaves like `partial` except that it is designed to be used as a method definition rather than being directly callable."*
- `functools.lru_cache(user_function)` / `functools.lru_cache(maxsize=128, typed=False)`:
  - *"Decorator to wrap a function with a memoizing callable that saves up to the `maxsize` most recent calls. It can save time when an expensive or I/O bound function is periodically called with the same arguments."*
  - *"If `typed` is set to true, function arguments of different types will be cached separately. If `typed` is false, the implementation will usually regard them as equivalent."*
  - *"The wrapped function is instrumented with a `cache_info()` function that returns a named tuple showing `hits`, `misses`, `maxsize` and `currsize`."*
  - *"A `cache_clear()` function is also provided for clearing or invalidating the cache."*
- `functools.cache(user_function)`:
  - *"Simple lightweight unbounded function cache. Sometimes called 'memoize'. Returns the same as `lru_cache(maxsize=None)`."*
- `functools.singledispatch(user_function)`:
  - *"Transform a function into a single-dispatch generic function."*
  - *"To add overloaded implementations to the function, use the `register()` attribute of the generic function, which serves as a decorator."*
  - *"For functions annotated with types, the decorator will infer the type of the first argument automatically."*
- `functools.singledispatchmethod(user_function)`:
  - *"Transform a method into a single-dispatch generic method."*
- `functools.reduce(function, iterable[, initializer])`:
  - *"Apply `function` of two arguments cumulatively to the items of `iterable`, from left to right, so as to reduce the iterable to a single value."*

---

## 2. Key Architecture & Pitfalls

1. **`lru_cache` on Instance Methods (Memory Leak)**:
   When `@lru_cache` decorates an instance method, `self` is part of `args`. The cache dictionary holds references to `self`, preventing the instance from being garbage collected even after external references are deleted.
   Fix: Decorate helper functions outside the class, use `weakref`, or use `@cached_property` for zero-argument property caching.
2. **Unhashable Arguments in Caching**:
   `lru_cache` and `cache` hash their arguments. Passing a `list`, `dict`, or `set` raises `TypeError: unhashable type: 'list'`.
   Fix: Convert collections to `tuple` or `frozenset` before passing.
3. **`partial` vs `lambda`**:
   `partial` evaluates arguments eagerly when created; `lambda` is subject to closure late-binding unless default arguments are used. `partial` objects are picklable.
4. **`reduce` Empty Sequence**:
   `reduce(func, [])` raises `TypeError: reduce() of empty iterable with no initial value`. Always provide an `initializer` when reducing dynamically-sized collections.
