---
title: "setdefault is not a getter with a default — it is an insert-if-missing that returns the stored object, and both halves of that sentence are why it works and why it surprises people"
sidebar_label: "11 · setdefault"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict), [`collections.defaultdict`](https://docs.python.org/3.14/library/collections.html#collections.defaultdict), [Thread Safety Guarantees — dict](https://docs.python.org/3.14/library/threadsafety.html#thread-safety-for-dict-objects). Target: **CPython 3.14** (3.14.7). Documentation-validated; **no sandbox run**.

**The name is misleading. `setdefault` reads like `get` with a fallback, and it is not: on a miss it *writes*. What makes it useful is the second half — it returns the object that is now in the dictionary, so mutating the return value mutates the stored value. That is the entire group-by idiom in one line. What makes it dangerous is the same thing: a lookup that was meant to be read-only quietly grows the dictionary, and the default is built on every call whether or not it is used.**

## The documented behaviour, and the two things it does

> *"`setdefault(key, default=None, /)` — If *key* is in the dictionary, return its value. If not, insert *key* with a value of *default* and return *default*. *default* defaults to `None`."*

Two operations, one call:

```python
groups: dict[str, list[str]] = {}

bucket = groups.setdefault("admin", [])   # key absent -> inserts [], returns that list
bucket.append("alice")                     # mutates the list that is IN the dict
groups                                     # {"admin": ["alice"]}

bucket = groups.setdefault("admin", [])   # key present -> returns the SAME list
bucket.append("bob")
groups                                     # {"admin": ["alice", "bob"]}
```

The second call's `[]` is constructed, ignored and thrown away — the key exists, so the existing list is returned. That is both the elegance and the waste.

Like `get`, the parameters are **positional-only** (`/` in the signature), so `d.setdefault(key=k, default=v)` is a `TypeError`.

## The group-by, in one line

This is the idiom `setdefault` exists for, and the `collections` documentation itself uses it as the point of comparison for `defaultdict`:

```python
def group_by_role(users: list[User]) -> dict[str, list[User]]:
    groups: dict[str, list[User]] = {}
    for user in users:
        groups.setdefault(user.role, []).append(user)
    return groups
```

Compare the shapes it replaces:

```python
# three lookups and a branch
for user in users:
    if user.role not in groups:
        groups[user.role] = []
    groups[user.role].append(user)

# two lookups, and it rebinds the whole list every time
for user in users:
    groups[user.role] = groups.get(user.role, []) + [user]     # O(n²) overall
```

That last one is worth staring at: `+` builds a **new list** each iteration, so grouping *n* items into one bucket copies the bucket *n* times. It is the most common accidental quadratic in Python code that "works".

The counting variant, with `0` as the default:

```python
counts: dict[str, int] = {}
for event in events:
    counts[event.kind] = counts.setdefault(event.kind, 0) + 1
```

⚠️ That one is *not* the good use. Integers are immutable, so the "mutate the returned object" trick does nothing for you and you end up writing the key twice. For counters, `counts[k] = counts.get(k, 0) + 1` is clearer, and `collections.Counter` is clearer still — [06 · `collections`](../06-collections-module/README.md).

🔴 **The rule of thumb: `setdefault` earns its place when the default is a *mutable container you are about to mutate*. Everywhere else, `get` says what you mean.**

## The default is built on every call

Same trap as `get`, with a sharper edge because the wasted object is sometimes *also* inserted:

```python
# build_expensive_default() runs on every iteration, hit or miss
for row in rows:
    bucket = index.setdefault(row.key, build_expensive_default())
```

Arguments are evaluated before the call, so there is no way for `setdefault` to skip it. For an empty `[]` or `{}` that is a small allocation; for anything that opens a file, hits a network or takes a lock, it is a bug. Two fixes, depending on which you actually want:

```python
# 1. branch, so the default is only built on a miss
bucket = index.get(row.key)
if bucket is None:
    bucket = build_expensive_default()
    index[row.key] = bucket

# 2. defaultdict, whose factory really is called lazily — but only via d[k]
from collections import defaultdict
index = defaultdict(build_expensive_default)
bucket = index[row.key]
```

## `setdefault` **writes**, and that is the surprise

The most common bug is using it where you meant `get`:

```python
# reads like "give me the config value or a default"
timeout = settings.setdefault("timeout", 30)
```

That call *inserts* `"timeout": 30` into `settings`. Now:

- `"timeout" in settings` is `True` where it was `False`;
- `len(settings)` has grown;
- `json.dumps(settings)` writes a key the user never set;
- a later "did the user configure this?" check answers wrongly;
- and if `settings` is a shared module-level object, the change is permanent for the process.

The fix is `get`, which never writes:

```python
timeout = settings.get("timeout", 30)
```

🔴 **A `setdefault` that is not followed by mutating its return value is almost always a `get` in disguise.** That is the review heuristic: read the next line. If it does not mutate the result, ask why the write is there.

## `setdefault` and `defaultdict` — the documented comparison

The `collections` documentation runs both versions of the grouping loop and says outright:

> *"This technique is simpler and faster than an equivalent technique using `dict.setdefault()`"*

— referring to `d.setdefault(k, []).append(v)`. Two things follow.

**Prefer `defaultdict` when the whole dictionary has one default.** It is the documented recommendation and it removes the per-iteration allocation.

**Prefer `setdefault` when the default varies, or when the dict must stay a plain `dict`.** A `defaultdict` is a different type: it serialises the same but it *behaves* differently under `d[k]`, and handing one to code that expects a `KeyError` on a missing key turns a loud failure into a silent empty value. That is a real API-boundary decision, not a style preference.

🔴 **`setdefault` on a `defaultdict` does not call the factory.** *"No other operations or methods invoke `__missing__`"* — only `d[key]` does. So:

```python
from collections import defaultdict

buckets = defaultdict(list)
buckets.setdefault("a", [])        # inserts an ordinary [] — factory not consulted
buckets["b"]                        # factory called; inserts []
```

Both end up with an empty list here, because the factory *is* `list`. They diverge the moment the factory is not equivalent to the literal you passed — a `defaultdict(lambda: {"count": 0})` given `setdefault(k, {})` gets the wrong shape, silently.

## Memoisation, and the one place `setdefault` is exactly right

Insert-if-missing-and-return-what-is-there is precisely the shape of a cache fill where a concurrent filler must not be clobbered:

```python
_cache: dict[str, Compiled] = {}

def compiled(pattern: str) -> Compiled:
    """Return the shared Compiled for `pattern`, compiling it at most once per winner."""
    existing = _cache.get(pattern)
    if existing is not None:
        return existing
    return _cache.setdefault(pattern, compile_pattern(pattern))
```

The `setdefault` at the end is doing real work: if two threads reach it at the same time, both compile, but **both callers get the same object back** — the one that won the insert. Without it, the second `_cache[pattern] = ...` would replace the first, and two callers would hold two different "shared" objects.

That guarantee is documented for free-threaded builds:

> *"Writing or removing a single item is safe to call from multiple threads and will not corrupt the dictionary"* — the list includes `d.setdefault(key, v)  # insert if missing`.

⚠️ Note what is *not* promised: the compile still happens twice, because the argument is evaluated before the call. `setdefault` gives you a single agreed *result*, not single execution. If the work must happen once, you need a lock — see [25 · `dict` across threads](10-dict-across-threads.md).

## Gotchas

**★ Symptom: a settings dictionary contains keys the user never configured.** Cause: `setdefault` was used where `get` was meant — it inserts on a miss, by definition. Fix: `get` for reads; keep `setdefault` for the mutate-the-result idiom.

```python
timeout = settings.get("timeout", 30)     # reads; never writes
```

**★ Symptom: a grouping loop is quadratic.** Cause: `d[k] = d.get(k, []) + [item]` builds a new list on every append. Fix: mutate the stored list in place.

```python
groups.setdefault(key, []).append(item)
```

**★ Symptom: an expensive default is computed on every loop iteration despite the key being present.** Cause: arguments are evaluated before the call; `setdefault` cannot be lazy. Fix: branch on the miss, or use `defaultdict`, whose factory is called only on `d[k]`.

```python
bucket = index.get(key)
if bucket is None:
    bucket = build_expensive_default()
    index[key] = bucket
```

**★ Symptom: `setdefault` on a `defaultdict` produces the wrong default shape.** Cause: `setdefault` never consults `default_factory` — *"No other operations or methods invoke `__missing__`."* Fix: index it, which is the whole point of the type.

```python
buckets = defaultdict(lambda: {"count": 0})
buckets[key]["count"] += 1        # not buckets.setdefault(key, {})
```

**★ Symptom: two callers of a memoising helper get two different "shared" objects.** Cause: the fill was `cache[key] = build()`, so the later write replaced the earlier one and each caller kept its own. Fix: `setdefault`, which returns whichever object won.

```python
return _cache.setdefault(key, build())
```

**Symptom: `d.setdefault(key=k, default=v)` raises `TypeError`.** Cause: the signature is `setdefault(key, default=None, /)` — positional-only. Fix: pass positionally.

```python
bucket = d.setdefault(k, v)
```

**Symptom: `setdefault` inserts `None` when the second argument is omitted.** Cause: *"default defaults to `None`"* — and it is inserted, not merely returned. Fix: pass the default you actually want, and if the answer is "nothing", use `get`.

```python
groups.setdefault(key, [])        # not groups.setdefault(key)
```

**Symptom: a `setdefault(key, [])` result is reassigned instead of mutated and nothing is stored.** Cause: rebinding the local name does not touch the dict; only mutation of the returned object does. Fix: mutate.

```python
# rebinding: the dict still holds the original list
bucket = groups.setdefault(key, [])
bucket = bucket + [item]                    # wrong

bucket = groups.setdefault(key, [])
bucket.append(item)                         # right
```

**Symptom: profiling shows millions of short-lived empty lists.** Cause: `setdefault(k, [])` in a hot loop allocates a list per iteration and discards it on every hit. Fix: `defaultdict(list)`, which allocates only on a genuine miss — the documented reason it is *"simpler and faster"*.

```python
from collections import defaultdict
groups = defaultdict(list)
for user in users:
    groups[user.role].append(user)
```

**Symptom: handing a `defaultdict` to another module makes missing-key bugs vanish and reappear as empty results.** Cause: `d[k]` on a `defaultdict` never raises, so downstream code that relied on `KeyError` to detect bad input silently succeeds. Fix: convert at the boundary before returning.

```python
def group_by_role(users: list[User]) -> dict[str, list[User]]:
    groups = defaultdict(list)
    for user in users:
        groups[user.role].append(user)
    return dict(groups)          # a plain dict crosses the boundary
```

## Interview questions

**★ What does `setdefault` do that `get` does not?**
It writes. `get` returns the default without touching the dictionary; `setdefault` *"insert[s] key with a value of default and return[s] default"* when the key is absent. The second half is what makes it useful: the object it returns is the object now stored, so mutating it mutates the dict. That is the entire `d.setdefault(k, []).append(v)` idiom. It is also the whole failure mode — using it as a read grows the dictionary with defaults the caller never set.

**★ Why is `d[k] = d.get(k, []) + [item]` a bug?**
Because `+` on lists builds a new list, so appending *n* items to one bucket copies that bucket *n* times — the loop is quadratic in the size of the largest group. `setdefault(k, []).append(item)` mutates the existing list in place and is linear. This is the most common accidental *O*(n²) in otherwise correct-looking Python, and it stays invisible until a group gets large.

**★ Does `setdefault` avoid evaluating its default when the key is present?**
No. It is an ordinary method call, so the default is constructed before `setdefault` runs and is simply discarded on a hit. For `[]` and `{}` that is a cheap allocation you may not care about; for anything with a cost or a side effect it is wrong. `defaultdict` is the lazy alternative — its `default_factory` is called only when `d[k]` misses — and an explicit `get`-then-branch is the version that works without changing the type.

**★ When should you use `defaultdict` instead, and when not?**
Use it when the whole dictionary shares one default and you are building it in a loop; the `collections` documentation says the `defaultdict` version is *"simpler and faster than an equivalent technique using dict.setdefault()"*, and it avoids the per-iteration allocation. Do not use it when the dictionary crosses an API boundary: `d[k]` on a `defaultdict` never raises, so callers that relied on `KeyError` to catch a bad key get an empty value instead. Convert with `dict(groups)` before returning.

**Does `setdefault` work on a `defaultdict`?**
It works, but it does not use the factory. The `dict` documentation is explicit that only `d[key]` invokes `__missing__` — *"No other operations or methods invoke `__missing__`"* — so `setdefault` inserts exactly the default you passed. With `defaultdict(list)` and `setdefault(k, [])` you cannot tell the difference; with any factory that produces something other than the literal you wrote, you get the wrong shape and no error.

**Where is `setdefault` genuinely the best tool, rather than a habit?**
Cache fills where several callers must agree on one object. `return cache.setdefault(key, build())` guarantees that everyone gets the object that won the insert, whereas `cache[key] = build(); return cache[key]` lets a later caller replace an object an earlier one is already holding. It is also a documented atomic operation on free-threaded builds — *"Writing or removing a single item is safe to call from multiple threads and will not corrupt the dictionary"* lists `d.setdefault`. What it does **not** give you is single execution: `build()` still runs on every call, because the argument is evaluated first.

---

← [10 · Nested access](04b-nested-access.md) · [Topic index](README.md) · Next → [12 · `fromkeys` and the shared default](04d-fromkeys.md)
