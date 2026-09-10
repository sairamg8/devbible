---
title: "A function that returns a pair on success has to decide what it returns on failure, and a cached function hands every caller the same object — both decisions are made by the return type, not by the caller"
sidebar_label: "7b · Absence, errors and shared results"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 library reference —
> [Truth Value Testing](https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing)
> and [`functools.lru_cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache);
> and CPython 3.14 [`Python/ceval.c`](https://github.com/python/cpython/blob/3.14/Python/ceval.c)
> for the unpacking error text. Documentation-verified — **no sandbox run**.
> Version spine: **CPython 3.14**.

**Unpacking a return value asserts its shape, which is exactly right until the shape depends
on the data. The commonest version is a lookup that returns `(pattern, handler)` when it
finds something and falls off the end when it does not: the implicit `None` travels back to
the caller and detonates at the unpack as a `TypeError` that names neither the function nor
the missing key. The fix is to make absence a decision the function states — raise, or return
an explicit `None` the caller checks first — and not to borrow Go's `(value, error)` pair,
which Python gives no way to enforce. The companion problem is sharing: a cached function
returns the same object every time, so its return type decides whether one caller can corrupt
the next caller's result.**

## Sometimes a pair, sometimes `None`

```python
def find_route(path: str):
    for pattern, handler in ROUTES:
        if pattern == path:
            return pattern, handler
    # falls off the end: returns None

pattern, handler = find_route("/missing")
```

The last line raises `TypeError: cannot unpack non-iterable NoneType object` — CPython's
`"cannot unpack non-iterable %.200s object"` in `Python/ceval.c` — at the **call site**,
far from the function that forgot to say what "not found" means. The shape of the return
depends on the data, which is precisely the property that makes unpacking unsafe (the same
distinction as `partition` versus `split` in [6b](06b-unpacking-library-results.md)).

Two honest shapes exist. Raise when absence is an error; return an explicit `None` and make
the caller branch *before* unpacking when absence is normal:

```python
def find_route(path: str) -> tuple[str, Handler]:
    for pattern, handler in ROUTES:
        if pattern == path:
            return pattern, handler
    raise LookupError(f"no route for {path!r}")

def find_route_or_none(path: str) -> tuple[str, Handler] | None:
    for pattern, handler in ROUTES:
        if pattern == path:
            return pattern, handler
    return None

found = find_route_or_none(path)
if found is None:
    return not_found()
pattern, handler = found
```

The `-> tuple[str, Handler] | None` annotation is what lets a type checker demand the `is
None` branch before the unpack; without it, nothing flags the unguarded call site. The
annotation forms are [7c](07c-annotating-tuples.md).

The Go-style `(value, error)` pair is the third shape, and it is the wrong one in Python:
the caller can unpack it and forget to look at `error`, whereas an exception cannot be
ignored by accident.

## Empty is not absent

A function that returns a *variable-length* tuple — matching rows, granted scopes — has a
second way to say "nothing": the empty tuple. It is a perfectly good result, and it is falsy:

> *"Here are most of the built-in objects considered false: … empty sequences and
> collections: `''`, `()`, `[]`, `{}`, `set()`, `range(0)`"* —
> [Truth Value Testing](https://docs.python.org/3.14/library/stdtypes.html#truth-value-testing)

So a caller that tests `if not result:` cannot tell "the lookup failed" (`None`) from "the
lookup succeeded and found no scopes" (`()`). When both outcomes are possible, the two tests
have to be written separately:

```python
scopes = granted_scopes(user_id)      # -> tuple[str, ...] | None
if scopes is None:
    raise PermissionError(f"unknown user {user_id}")
if not scopes:
    return read_only_view()           # known user, nothing granted
return full_view(scopes)
```

The cleaner design usually removes one of the two: return `()` for "none granted" and raise
for "unknown user", so the return type is just `tuple[str, ...]` and truthiness means one
thing.

## Returning a tuple from a cached function

`lru_cache` hands every caller **the same object** it stored:

> *"Since a dictionary is used to cache results, the positional and keyword arguments to the
> function must be hashable."* —
> [`functools.lru_cache`](https://docs.python.org/3.14/library/functools.html#functools.lru_cache)

The documentation constrains the *arguments*; nothing constrains the return value, so a
cached function that returns a list returns a shared, mutable list. The first caller who
sorts it or appends to it has edited the cache for everyone. Returning a tuple of immutable
values makes the cached result safe to hand out, for the same reason
[1b](01b-thread-safety-and-identity.md) gives for sharing across threads.

```python
from functools import lru_cache

@lru_cache(maxsize=1024)
def allowed_regions(tenant: str) -> tuple[str, ...]:
    rows = db.fetch_regions(tenant)
    return tuple(sorted(r.code for r in rows))     # immutable, shared safely
```

🔴 **The tuple has to be immutable all the way down.** `return (tenant, regions_list)` is a
tuple, and the cached `regions_list` inside it is exactly as shared and exactly as mutable as
it would have been on its own — the rule from [1](01-what-immutability-freezes.md) that a tuple
freezes its slots, not their contents.

## Gotchas

**★ Symptom: `TypeError: cannot unpack non-iterable NoneType object` at a call site.**
Cause: the function returns a tuple on one path and falls off the end (an implicit `None`) on
another; the unpack is the first place the missing value is touched. Fix: make absence a
decision — raise, or return `None` explicitly and branch before unpacking.

```python
result = find_route_or_none(path)
if result is None:
    return not_found()
pattern, handler = result
```

**★ Symptom: one request's result mysteriously contains another request's items.** Cause: an
`lru_cache`-decorated function returned a list, and a caller mutated it — the cache hands
every caller the same object. Fix: return a tuple (of immutable items) from anything cached.

```python
@lru_cache(maxsize=256)
def feature_flags(tenant: str) -> tuple[str, ...]:
    return tuple(load_flags(tenant))
```

**★ Symptom: users with no granted scopes are reported as "unknown user".** Cause: the caller
wrote `if not scopes:`, and `()` is falsy exactly like `None` — the truth-value rules list
*"empty sequences and collections"* among the false objects. Fix: test `is None` for absence,
and emptiness separately.

```python
if scopes is None:
    raise PermissionError(f"unknown user {user_id}")
if not scopes:
    return read_only_view()
```

**Symptom: a Go-style `value, err = fetch()` path silently continued with `value = None`.**
Cause: nothing forces the caller to inspect `err`; the tuple unpacks either way. Fix: raise,
and let the caller that can handle the failure catch it.

```python
def fetch(url: str) -> bytes:
    response = http.get(url)
    if response.status >= 400:
        raise FetchError(url, response.status)
    return response.body
```

**Symptom: a cached function returns a tuple and callers still corrupt each other's data.**
Cause: the tuple holds a list or dict; the outer tuple is shared *and* so is the mutable
object in its slot. Fix: convert the contents too before they enter the cache.

```python
@lru_cache(maxsize=256)
def tenant_config(tenant: str) -> tuple[str, tuple[str, ...]]:
    name, regions = load_tenant(tenant)
    return name, tuple(regions)
```

**Symptom: `ValueError: not enough values to unpack (expected 2, got 0)` from a lookup that
"returns a pair".** Cause: the not-found path returns `()` instead of `None`, so the caller's
unpack sees an empty iterable — a count mismatch rather than a missing object. Fix: pick one
representation of absence and annotate it, so the unguarded unpack is flagged before it runs.

```python
def find_route_or_none(path: str) -> tuple[str, Handler] | None:
    return ROUTE_INDEX.get(path)      # a (pattern, handler) tuple, or None
```

## Interview questions

**★ Is returning `(value, error)` idiomatic Python?**
No. It is a translation of Go's convention, and it loses the one property that makes Go's
version tolerable — the compiler's complaint about an unused variable. In Python the caller
can unpack the pair and proceed with `value = None`. Exceptions carry the failure to the
first frame that can handle it and cannot be ignored silently; a function that may legitimately
find nothing returns `None` (or a documented sentinel) and the caller checks before unpacking.

**Why does `pattern, handler = find_route(path)` raise `TypeError`, not `ValueError`, when the
route is missing?**
Because the function returned `None`, and `None` is not iterable at all — CPython's message is
*"cannot unpack non-iterable NoneType object"*. `ValueError` is reserved for an iterable with
the wrong number of items. The type of the exception tells you which kind of shape failure you
have: nothing to iterate, or the wrong count.

**What is the risk of returning a list from an `lru_cache`-decorated function?**
The cache stores the object and returns that same object on every hit. A list is mutable, so
the first caller that sorts, appends or pops has changed the cached value for every later
caller — a cross-request data leak with no error anywhere. The documentation only requires the
*arguments* to be hashable; protecting the return value is the author's job, and a tuple of
immutable values is the simplest way to do it.

**★ What should a lookup that may find nothing return?**
It depends on whether "nothing" is an error for the caller. If it is, raise — `LookupError`
or a domain subclass — so the failure surfaces at the lookup with the key in the message. If
absence is a normal outcome, return `None` explicitly and annotate the function
`-> tuple[...] | None`, so a type checker requires the caller to branch before unpacking.
What it should never do is fall off the end on one path, because the implicit `None` is the
same object but carries no statement of intent, and the failure then appears at the caller's
unpack.

**Why is `if not result:` a bug when `result` can be `None` or an empty tuple?**
Because both are false in a boolean context — the truth-value rules list `None` among the
false constants and `()` among the empty collections. The test merges two different facts,
"there was no answer" and "the answer was empty", into one branch. Test `result is None` for
the first and `not result` (or `len(result) == 0`) for the second, or change the function so
only one of them can happen.

---

← [Multiple return values](07-multiple-return-values.md) · [Topic index](README.md) · Next → [Annotating tuples](07c-annotating-tuples.md)
