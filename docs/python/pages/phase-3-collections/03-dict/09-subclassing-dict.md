---
title: "Subclassing dict gets you C speed and an API that ignores your overrides — update(), the constructor, setdefault(), get() and copy() never call your __setitem__ or __getitem__ — which is why __missing__ is the one hook worth subclassing dict for"
sidebar_label: "22 · Subclassing dict"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [Mapping Types — dict](https://docs.python.org/3.14/library/stdtypes.html#mapping-types-dict) (`__missing__`), [`collections.UserDict`](https://docs.python.org/3.14/library/collections.html#userdict-objects), [Time complexity](https://docs.python.org/3.14/library/time-complexity.html). Which methods reach a subclass override was read from `Objects/dictobject.c` at the [CPython **v3.14.7**](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c) tag — `dict_merge`, `merge_from_seq2_lock_held`, `dict_get_impl`, `dict_setdefault_impl`, `dict_pop_impl`, `copy_lock_held`, `_PyDict_FromKeys` — **implementation detail, not a documented guarantee**. Target: **CPython 3.14** (3.14.7). **No sandbox run.**

**`class LowerDict(dict)` with a `__setitem__` that lower-cases keys looks finished after one test. It is not. The documentation promises exactly one hook on `dict` — `__missing__`, and it says outright that *"No other operations or methods invoke `__missing__`"*. It promises nothing about `__setitem__` or `__getitem__`, and in CPython the methods are written against the hash table directly: the constructor, `update`, `|=`, `setdefault`, `get`, `pop`, `in` and `copy` never call your overrides. The result is a class that behaves correctly through `d[k] = v` and `d[k]` and incorrectly through everything else. This chunk is where the bypass is, read from the source; [23 · `UserDict` and the mapping ABCs](09b-userdict-and-the-mapping-abcs.md) is the way out.**

## The one documented hook

> *"If a subclass of dict defines a method `__missing__` and key is not present, the `d[key]` operation calls that method with the key key as argument. The `d[key]` operation then returns or raises whatever is returned or raised by the `__missing__(key)` call. No other operations or methods invoke `__missing__`. If `__missing__` is not defined, `KeyError` is raised. `__missing__` must be a method; it cannot be an instance variable"*

That paragraph is the whole contract `dict` offers subclasses, and it is narrow on purpose: one operation, subscription, calls one hook, on a miss. `Counter` and `defaultdict` are built on it — the documentation says so. It is also the only customisation that works *completely* on a `dict` subclass, because it only claims to affect `d[key]`.

```python
class Defaults(dict):
    """A dict that answers a fixed default for unknown keys — without storing it."""

    def __init__(self, default: object, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)
        self.default = default

    def __missing__(self, key: object) -> object:
        return self.default


limits = Defaults(100, {"premium": 1000})
limits["premium"]        # 1000
limits["free"]           # 100 — and, unlike defaultdict, nothing was inserted
limits.get("free")       # None — get does not call __missing__, as documented
```

## Where overrides are not called

In `Objects/dictobject.c` at `v3.14.7`, the generic `PyObject_SetItem` — the call that would dispatch to a Python-level `__setitem__` — appears in exactly one place: `_PyDict_FromKeys`, when the class being built is not an exact `dict`. Every other insertion path calls the internal `setitem_lock_held` on the table. Likewise, `get`, `setdefault` and `pop` go straight to internal lookups (`_Py_dict_lookup_threadsafe`, `dict_setdefault_ref_lock_held`, `dict_pop_default`).

| Operation on a `dict` subclass | Calls your `__setitem__`? | Calls your `__getitem__`? | Calls `__missing__`? |
|---|---|---|---|
| `d[k] = v` | ✅ | — | — |
| `d[k]` | — | ✅ | ✅ on a miss |
| `Sub(mapping)`, `Sub(pairs)`, `Sub(k=v)` | ❌ (`dict_merge` / `merge_from_seq2_lock_held` insert directly) | — | — |
| `d.update(...)`, `d \|= ...` | ❌ same path | — | — |
| `d.setdefault(k, v)` | ❌ | ❌ | ❌ |
| `d.get(k)` | — | ❌ | ❌ (documented) |
| `k in d` | — | ❌ | ❌ |
| `d.pop(k)` | — | ❌ | ❌ |
| `d.copy()`, `d \| other` | — | ❌ — and the result is a plain `dict` | — |
| `Sub.fromkeys(keys)` | ✅ — the one exception | — | — |

⚠️ This is CPython's implementation, read from source, not a documented promise. The documentation neither says these methods call your overrides nor says they do not — which is precisely the problem: nothing *guarantees* the behaviour you would need.

## The broken case-insensitive dict

```python
class LowerDict(dict):
    def __setitem__(self, key: str, value: object) -> None:
        super().__setitem__(key.lower(), value)

    def __getitem__(self, key: str) -> object:
        return super().__getitem__(key.lower())


headers = LowerDict({"Content-Type": "text/html"})   # constructor: stored as 'Content-Type'
headers["Accept"] = "*/*"                            # __setitem__: stored as 'accept'
headers.update({"X-Trace": "abc"})                   # update: stored as 'X-Trace'

headers["content-type"]         # KeyError — stored key is 'Content-Type', lookup uses 'content-type'
headers.get("accept")           # '*/*' — only because __setitem__ happened to lower-case it
headers.get("Accept")           # None  — get bypasses __getitem__, no lower-casing
"ACCEPT" in headers             # False — __contains__ bypasses __getitem__ too
headers.setdefault("Accept", "text/plain")   # inserts a SECOND entry, 'Accept'
```

Every line after the first two is a different bug, and none of them raises where the mistake is. To make a `dict` subclass consistent you would have to override `__init__`, `update`, `__ior__`, `setdefault`, `get`, `__contains__`, `pop`, `__delitem__`, `copy`, `__or__`, `__ror__` and `fromkeys` — at which point you have written a `MutableMapping` the hard way, with a C base class fighting you. [23 · `UserDict` and the mapping ABCs](09b-userdict-and-the-mapping-abcs.md) shows the version that works.

## The reverse direction: reading *from* a subclass

The bypass also applies when your subclass is the **source** of a copy. `dict_merge` has a fast path in `v3.14.7`:

```c
if (PyDict_Check(b) && (Py_TYPE(b)->tp_iter == dict_iter)) {
    /* ... reads b's entries straight out of its table ... */
}
```

So a `dict` subclass that overrides `__getitem__` (or `keys`, or `items`) to transform values on the way out, but does **not** override `__iter__`, is copied from its raw storage by `dict(sub)`, `{**sub}`, `other.update(sub)` and `other | sub`. The transformation you wrote is invisible to every consumer that copies:

```python
class Masked(dict):
    def __getitem__(self, key: str) -> object:
        value = super().__getitem__(key)
        return "***" if key in {"password", "token"} else value


creds = Masked(user="svc", password="hunter2")
creds["password"]        # '***'
dict(creds)["password"]  # 'hunter2' — the fast path read the table, not __getitem__
{**creds}["password"]    # 'hunter2'
```

Only when the subclass overrides `__iter__` does `dict_merge` fall back to `keys()` and `__getitem__`. Depending on that is depending on an optimisation; masking belongs in a type that does not inherit the table at all.

## "Read-only" subclasses that are not

The most dangerous version is a subclass meant to be immutable:

```python
class FrozenConfig(dict):
    def __setitem__(self, key: object, value: object) -> None:
        raise TypeError("FrozenConfig is read-only")

    def __delitem__(self, key: object) -> None:
        raise TypeError("FrozenConfig is read-only")


cfg = FrozenConfig(region="eu")
cfg["region"] = "us"          # TypeError, as intended
cfg.update(region="us")       # 🔴 succeeds — update never calls __setitem__
cfg.setdefault("debug", True) # 🔴 succeeds
cfg.pop("region")             # 🔴 succeeds — pop never calls __delitem__
cfg |= {"x": 1}               # 🔴 succeeds
cfg.clear()                   # 🔴 succeeds
```

Python 3.14 has no built-in frozen dict. The standard-library read-only mapping is `types.MappingProxyType` — *"Read-only proxy of a mapping"* — which has no mutating methods at all, so there is nothing to forget:

```python
from types import MappingProxyType

_config = {"region": "eu"}
CONFIG = MappingProxyType(_config)      # every write path raises; reads are live
```

## `copy()` returns a plain `dict`

`copy_lock_held` in `v3.14.7` always constructs an exact `dict` — there is no call to `type(self)`. So `sub.copy()` silently drops the subclass, its `__missing__`, and any attributes set in `__init__`:

```python
limits = Defaults(100, {"premium": 1000})
snapshot = limits.copy()
type(snapshot)             # dict
snapshot["free"]           # KeyError — the default went with the type
```

If a subclass has behaviour, it needs its own `copy` (and `__or__` / `__ror__`, see [20 · What a merge returns](07b-what-a-merge-returns.md)):

```python
class Defaults(dict):
    def __init__(self, default: object, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)
        self.default = default

    def __missing__(self, key: object) -> object:
        return self.default

    def copy(self) -> "Defaults":
        return type(self)(self.default, self)
```

## When subclassing `dict` is right

- **Adding `__missing__`** — the documented hook, fully honoured for `d[key]`.
- **Adding methods or properties** that read the dictionary through its normal API — `def by_prefix(self, p)`, `@property def total(self)`.
- **Performance-critical mappings** where a Python-level `__getitem__` on every lookup is unacceptable; the complexity page reminds you that *"the listed costs assume exact built-in types, as instances of subclasses may have different costs."*

Anything that changes what `__setitem__`, `__getitem__`, `__delitem__` or `__contains__` *mean* belongs in `UserDict` or `collections.abc.MutableMapping`.

## Gotchas

**★ Symptom: a key-normalising `dict` subclass stores un-normalised keys.** Cause: the constructor, `update`, `|=` and `setdefault` insert directly into the table; only `d[k] = v` calls your `__setitem__`. Fix: derive from `UserDict`, whose methods route through `__setitem__`.

```python
from collections import UserDict

class LowerDict(UserDict):
    def __setitem__(self, key: str, value: object) -> None:
        self.data[key.lower()] = value
```

**★ Symptom: a "read-only" `dict` subclass is modified in production.** Cause: `update`, `setdefault`, `pop`, `popitem`, `clear` and `|=` never call the overridden `__setitem__`/`__delitem__`. Fix: `MappingProxyType`, which has no write path.

```python
CONFIG = MappingProxyType({"region": "eu"})
```

**★ Symptom: `d.get(k)` returns `None` where `d[k]` returns a value, on a subclass.** Cause: `get` does its own lookup and neither calls your `__getitem__` nor `__missing__` — the documentation: *"No other operations or methods invoke `__missing__`."* Fix: override `get` too, or use `UserDict`, whose `get` is written in terms of `in` and `self[key]`.

```python
def get(self, key: str, default: object = None) -> object:
    try:
        return self[key]
    except KeyError:
        return default
```

**★ Symptom: `sub.copy()` loses the subclass's behaviour and attributes.** Cause: `dict.copy()` always builds an exact `dict`. Fix: define `copy` to construct `type(self)`.

```python
def copy(self) -> "Defaults":
    return type(self)(self.default, self)
```

**★ Symptom: a masking `__getitem__` leaks secrets through `dict(obj)`, `{**obj}` or `json.dumps(obj)`.** Cause: copying from a `dict` subclass that does not override `__iter__` reads its table directly — the fast path in `dict_merge`. Fix: do not store the secret in the mapping; mask at the boundary instead.

```python
def redacted(creds: dict[str, str]) -> dict[str, str]:
    return {k: ("***" if k in SECRET_KEYS else v) for k, v in creds.items()}
```

**Symptom: `in` reports a key missing that `d[k]` finds.** Cause: `__getitem__` was overridden (to normalise, or to fall back) but `__contains__` was not; `k in d` uses its own lookup. Fix: override `__contains__` consistently — or, better, stop subclassing `dict`.

```python
def __contains__(self, key: object) -> bool:
    return isinstance(key, str) and super().__contains__(key.lower())
```

**Symptom: `__missing__` assigned in `__init__` (`self.__missing__ = ...`) is never called.** Cause: the documentation is explicit — *"`__missing__` must be a method; it cannot be an instance variable."* Fix: define it on the class and read per-instance state from `self`.

```python
class Fallback(dict):
    def __init__(self, fallback: dict, *args: object) -> None:
        super().__init__(*args)
        self.fallback = fallback

    def __missing__(self, key: object) -> object:
        return self.fallback[key]
```

**Symptom: `Sub.fromkeys(keys)` behaves differently from `Sub(dict.fromkeys(keys))`.** Cause: `fromkeys` is the one `dict` method that goes through `PyObject_SetItem` for a subclass — so it calls your `__setitem__`, while the constructor does not. Fix: do not rely on either; if normalisation matters, it has to be in a type whose every path goes through one method.

```python
normalised = LowerDict()             # the UserDict version
normalised.update(dict.fromkeys(keys))
```

**Symptom: a `dict` subclass with a Python `__getitem__` makes a hot lookup loop several times slower.** Cause: every `d[k]` now runs a Python-level function; the complexity table explicitly excludes subclasses. Fix: keep hot mappings as plain `dict`s and put behaviour in functions that take them.

```python
def lookup(table: dict[str, int], key: str) -> int:
    return table[key.lower()]
```

## Interview questions

**★ Why doesn't `dict.update()` call an overridden `__setitem__` on a subclass?**
Because `dict`'s methods are implemented in C directly against the hash table, not in terms of each other. In CPython 3.14, `update`, `|=` and the constructor all end in `dict_merge` or `merge_from_seq2_lock_held`, which insert with the internal `setitem_lock_held`; the only `dict` method that dispatches through `PyObject_SetItem` for a subclass is `fromkeys`. The documentation never promises that methods call each other — its only subclass hook is `__missing__`, scoped to `d[key]`. If you need every write to go through one method, use `collections.UserDict` or `collections.abc.MutableMapping`, whose methods are written in Python on top of `__setitem__`.

**★ What is `__missing__` for, and which operations call it?**
It is the one documented extension point on `dict`: when `d[key]` misses on a subclass that defines it, `d[key]` returns or raises whatever `__missing__(key)` does. Only subscription triggers it — *"No other operations or methods invoke `__missing__`"* — so `get`, `in`, `pop`, `setdefault` all report absence honestly. That is why `defaultdict` can be queried with `get` without growing, and why a `__missing__` that returns a default *without storing it* makes a clean "default for unknown keys" mapping.

**★ How do you make a read-only dict in Python 3.14?**
Not by subclassing `dict` and raising in `__setitem__` — `update`, `setdefault`, `pop`, `clear` and `|=` bypass it. The standard answer is `types.MappingProxyType(d)`, a read-only proxy with no mutating methods. It is a live view, so keep the underlying dict private if you need the contents fixed, or proxy a copy. There is no built-in frozen, hashable dict in 3.14; if you need one as a dict key, `frozenset(d.items())` works when the values are hashable.

**Why does `sub.copy()` return a plain `dict`?**
Because `dict.copy()` is implemented to build an exact `dict` — in CPython 3.14 `copy_lock_held` never calls `type(self)`. The same is true of `sub | other`. The reason is the constructor problem PEP 584 describes: a generic method cannot know how to construct an arbitrary subclass, whose `__init__` may take different arguments. A subclass that needs to survive copying defines its own `copy`, `__or__` and `__ror__`.

**When *is* subclassing `dict` the right choice?**
When you are adding `__missing__`, or adding methods that use the dictionary through its normal API, or when a mapping is on a hot path and a Python-level `__getitem__` would be too slow. It is the wrong choice whenever you are changing what storing, reading, deleting or membership *mean* — normalising keys, validating values, masking, auditing writes — because several methods will bypass the change. For those, `UserDict` or `MutableMapping` give you a class where one override really is enough.

**Why does `dict(obj)` ignore an overridden `__getitem__` on a dict subclass?**
Because CPython's merge routine has a fast path for dict sources: in 3.14's `dict_merge`, if the source passes `PyDict_Check` and still uses the standard dict iterator, its entries are read straight from the table. Only a subclass that overrides `__iter__` is read through `keys()` and `__getitem__`. So a subclass that transforms values on read shows the transformation to `d[k]` and hides it from `dict(d)`, `{**d}` and `other.update(d)`. It is an optimisation, not a documented contract — which is why value transformation belongs in a type that does not inherit the table.

**Which `dict` method *does* call a subclass's `__setitem__`?**
`fromkeys`. In 3.14 `_PyDict_FromKeys` constructs the class and, when the result is not an exact `dict`, inserts with `PyObject_SetItem`, which dispatches to Python-level `__setitem__`. Every other insertion path — the constructor, `update`, `|=`, `setdefault` — inserts directly. So `Sub.fromkeys(keys)` and `Sub(dict.fromkeys(keys))` can produce different contents from the same keys, which is a good illustration of why overriding `__setitem__` on a `dict` subclass is unreliable.

---

← [21 · Removing entries](08-removing-entries.md) · [Topic index](README.md) · Next → [23 · `UserDict` and the mapping ABCs](09b-userdict-and-the-mapping-abcs.md)
