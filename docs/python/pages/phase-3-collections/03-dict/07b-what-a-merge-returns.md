---
title: "The type that comes out of a merge is decided by the operand's implementation, not by what you put in — a dict subclass collapses to plain dict, defaultdict and OrderedDict survive, Counter changes what | means, and os.environ | hands back a dict that sets nothing"
sidebar_label: "20 · What a merge returns"
sidebar_position: 20
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against [PEP 584](https://peps.python.org/pep-0584/) and the Python 3.14 documentation — [`collections`](https://docs.python.org/3.14/library/collections.html) (`defaultdict`, `OrderedDict`, `Counter`, `ChainMap`, `UserDict`), [`types.MappingProxyType`](https://docs.python.org/3.14/library/types.html#types.MappingProxyType), [`os.environ`](https://docs.python.org/3.14/library/os.html#os.environ), [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html). Return types read from the CPython **v3.14.7** sources — [`Objects/dictobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/dictobject.c) (`dict_or`), [`Objects/odictobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/odictobject.c) (`odict_or`), [`Modules/_collectionsmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_collectionsmodule.c) (`defdict_or`), [`Objects/descrobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/descrobject.c) (`mappingproxy_or`), [`Lib/os.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/os.py) and [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py) — not from a run. Target: **CPython 3.14** (3.14.7). **No sandbox run.**

**PEP 584 added `|` to `dict`, and then — its own note says — *"the decision was made to also implement the new operators for several other standard library mappings."* Each of those types implemented `|` its own way, so the result type is a property of the operand, not of the operator. A `dict` subclass you wrote gets a plain `dict` back and silently loses its behaviour. `defaultdict` and `OrderedDict` keep their type whichever side they are on. `Counter` redefines `|` to mean "maximum count" — unless the other side is a plain dict, in which case you get ordinary last-wins and a plain dict. `os.environ | {...}` gives you a dict that does not touch the environment, while `os.environ |= {...}` changes it for the whole process. None of this raises.**

## The table

| Left operand | `\|` with a plain dict returns | `\|=` does | Source of the rule |
|---|---|---|---|
| `dict` | `dict` | updates in place | `dict_or`: `PyDict_Copy(self)` then update |
| your `dict` subclass (no override) | **plain `dict`** | updates in place, keeps type | `PyDict_Copy` always builds an exact `dict` |
| `defaultdict` | `defaultdict`, same `default_factory` | updates in place | `defdict_or` → `new_defdict(self, left)` |
| `OrderedDict` | `OrderedDict` (the operand's own class) | updates in place | `odict_or` → `PyObject_CallOneArg(type, left)` |
| `Counter` | **plain `dict`, last value wins** (not a Counter union) | updates in place, last wins | `Counter.__or__` returns `NotImplemented` for a non-`Counter` |
| `Counter` \| `Counter` | `Counter` of the **maximum** counts | max, in place | documented |
| `ChainMap` | `ChainMap` whose first map was updated | updates `maps[0]` | `m = self.copy(); m.maps[0].update(other)` |
| `UserDict` | the same `UserDict` subclass | updates `.data` | `self.__class__(self.data \| other)` |
| `MappingProxyType` | whatever the **underlying** mapping's `\|` returns | **`TypeError`** | `mappingproxy_or` / `mappingproxy_ior` |
| `os.environ` | **plain `dict`** — environment untouched | **sets the real environment** | `_Environ.__or__` / `__ior__` |
| a `collections.abc.Mapping` you wrote | `TypeError` | `TypeError` | the ABCs define no `\|` |

## A `dict` subclass comes back as a `dict`

`dict_or` in `v3.14.7` is four lines of logic: return `NotImplemented` unless both operands pass `PyDict_Check`, then `new = PyDict_Copy(self)`, then update `new` from `other`. `PyDict_Copy` builds an exact `dict` — so for a subclass that does not override `__or__`, the merge result has lost the subclass:

```python
class CaseInsensitiveHeaders(dict):
    def __missing__(self, key: str) -> str:
        for existing, value in self.items():
            if existing.lower() == key.lower():
                return value
        raise KeyError(key)


headers = CaseInsensitiveHeaders({"Content-Type": "text/html"})
headers["content-type"]                          # 'text/html' — __missing__ fires

merged = headers | {"X-Trace": "abc"}
type(merged)                                     # dict
merged["content-type"]                           # KeyError — the behaviour is gone
```

`d.copy()` does the same, and `{**headers, ...}` was always going to — PEP 584: *"`{**d1, **d2}` ignores the types of the mappings and always returns a dict."* The fix is to own the operators in the subclass:

```python
class CaseInsensitiveHeaders(dict):
    def __missing__(self, key: str) -> str:
        for existing, value in self.items():
            if existing.lower() == key.lower():
                return value
        raise KeyError(key)

    def copy(self) -> "CaseInsensitiveHeaders":
        return type(self)(self)

    def __or__(self, other: object) -> "CaseInsensitiveHeaders":
        if not isinstance(other, dict):
            return NotImplemented
        merged = self.copy()
        merged.update(other)
        return merged

    def __ror__(self, other: object) -> "CaseInsensitiveHeaders":
        if not isinstance(other, dict):
            return NotImplemented
        merged = type(self)(other)
        merged.update(self)
        return merged
```

`|=` needs no override: `dict_ior` mutates `self` and returns it, so the type is preserved. That shape — construct `type(self)`, then `update` — is exactly what the standard library's own `UserDict` and `OrderedDict` do, and it only works if the class can be constructed from a mapping. The `defaultdict` source carries the warning for everyone: *"Like copy(), this calls the object's class. Override `__or__`/`__ror__` for subclasses with different constructors."*

## `defaultdict` and `OrderedDict` keep their type — from either side

Both implement `|` in C so that the specialised operand determines the result wherever it appears. `defdict_or` finds whichever operand is the `defaultdict` and builds the result from it, keeping its `default_factory`; `odict_or` takes the type of whichever operand is the `OrderedDict`. Python tries the right operand's reflected method first when the right operand's type is a subclass of the left's, so `plain | ordered` reaches `odict_or` too.

```python
from collections import OrderedDict, defaultdict

counts = defaultdict(int, {"a": 1})
merged = counts | {"b": 2}
type(merged)                  # defaultdict
merged["zzz"]                 # 0 — and 'zzz' is now IN merged: the factory came along

ordered = {"x": 1} | OrderedDict(y=2)
type(ordered)                 # OrderedDict
```

⚠️ Keeping the factory is usually what you want and occasionally a surprise: a merged `defaultdict` still creates entries on every missing read, so a "merged config" built from one will grow keys the moment someone indexes a typo. Convert at the boundary with `dict(merged)` if the result leaves your module.

## `Counter`: two different meanings of `|`

For two counters, `|` is a multiset union — the documentation: *"Intersection and union return the minimum and maximum of corresponding counts."* — and the docs' own example line is `c | d  # union:  max(c[x], d[x])`.

```python
from collections import Counter

errors_monday = Counter({"timeout": 3, "dns": 1})
errors_tuesday = Counter({"timeout": 1, "tls": 2})

errors_monday | errors_tuesday     # Counter({'timeout': 3, 'tls': 2, 'dns': 1}) — max, not sum
errors_monday + errors_tuesday     # Counter({'timeout': 4, 'tls': 2, 'dns': 1}) — the total
```

🔴 **Mix in a plain dict and the meaning changes.** In `v3.14.7`, `Counter.__or__` begins `if not isinstance(other, Counter): return NotImplemented`. Python then tries the right operand's reflected `__ror__`, which for a plain dict is `dict`'s own `|` — and that accepts any two dicts, copies the left operand into a **plain dict** and overwrites with the right:

```python
errors_monday | {"timeout": 1}     # {'timeout': 1, 'dns': 1} — plain dict, last value wins
```

No exception, a different type, and the count went *down*. Wrap the right side in `Counter(...)` whenever the intent is a counter union.

## `MappingProxyType`: `|` delegates, `|=` is refused

> *"Changed in version 3.9: Updated to support the new union (`|`) operator from PEP 584, which simply delegates to the underlying mapping."*

`mappingproxy_or` unwraps any proxy operand and calls the ordinary `|` on the underlying objects, so `proxy | extra` returns a new plain `dict` (for a proxy over a dict) and never touches the proxied mapping. `mappingproxy_ior` raises `TypeError` with the message `"'|=' is not supported by %s; use '|' instead"` — the read-only contract holds.

```python
from types import MappingProxyType

DEFAULTS = MappingProxyType({"timeout": 30})
effective = DEFAULTS | {"timeout": 5}     # {'timeout': 5} — a new dict; DEFAULTS unchanged
# DEFAULTS |= {"timeout": 5}              # TypeError: '|=' is not supported by mappingproxy; use '|' instead
```

## `os.environ`: `|` is a snapshot, `|=` is a side effect

`os.environ` gained both operators in 3.9 — *"Updated to support PEP 584's merge (`|`) and update (`|=`) operators."* The `v3.14.7` implementation makes the difference stark:

```python
# Lib/os.py, class _Environ
def __ior__(self, other):
    self.update(other)
    return self

def __or__(self, other):
    if not isinstance(other, Mapping):
        return NotImplemented
    new = dict(self)
    new.update(other)
    return new
```

`os.environ | {"LANG": "C"}` is a plain dict — building it changes nothing, which is exactly right for handing an environment to a child process. `os.environ |= {"LANG": "C"}` goes through `update`, which assigns each item, and assignments to `os.environ` set the real process environment — visible to every thread and every later subprocess.

```python
import os
import subprocess

child_env = os.environ | {"LANG": "C", "TZ": "UTC"}          # snapshot; this process unchanged
subprocess.run(["make", "test"], env=child_env, check=True)
```

## Mappings you wrote from the ABCs

`collections.abc.Mapping` and `MutableMapping` define no `|`. PEP 584 gives the reason — *"Currently, neither defines a `copy` method, which would be necessary for `|` to create a new instance."* A `Mapping` subclass therefore raises `TypeError` on `|` in either position (a plain dict's `|` also refuses it, because it is not a `dict`). Convert, or use unpacking, which accepts any mapping:

```python
merged = dict(custom_mapping) | overrides
merged = {**custom_mapping, **overrides}
```

## Gotchas

**★ Symptom: after `headers | extra`, a custom dict subclass's behaviour disappears.** Cause: `dict_or` builds the result with `PyDict_Copy`, an exact `dict`. Fix: override `copy`, `__or__` and `__ror__` in the subclass, constructing `type(self)`.

```python
def __or__(self, other: object) -> "Headers":
    if not isinstance(other, dict):
        return NotImplemented
    merged = type(self)(self)
    merged.update(other)
    return merged
```

**★ Symptom: `counter | {"k": 1}` lowers a count and returns a plain dict.** Cause: `Counter.__or__` declines non-`Counter` operands, so `dict`'s reflected `|` runs — last value wins, result type `dict`. Fix: make both operands counters.

```python
merged = counter | Counter(extra)
```

**★ Symptom: a subprocess did not see an environment variable that "was merged in".** Cause: `os.environ | {...}` returns a new plain dict and sets nothing. Fix: pass that dict as `env=`, which is also the correct way to scope variables to a child.

```python
subprocess.run(cmd, env=os.environ | {"FEATURE_X": "1"}, check=True)
```

**★ Symptom: a variable set for one test leaks into every later test in the process.** Cause: `os.environ |= {...}` (like `os.environ.update`) sets the real environment. Fix: build a child environment instead, or use a fixture that restores it.

```python
import os
from unittest import mock

with mock.patch.dict(os.environ, {"FEATURE_X": "1"}):
    run_feature()
```

**Symptom: `TypeError: '|=' is not supported by mappingproxy; use '|' instead`.** Cause: the proxy is read-only and `mappingproxy_ior` refuses in-place merges. Fix: do what the message says.

```python
effective = DEFAULTS | overrides
```

**Symptom: `TypeError: unsupported operand type(s) for |` on your own `Mapping`.** Cause: the ABCs define no `|`, deliberately — no `copy()` to build the result from. Fix: convert first, or unpack.

```python
merged = {**settings, **overrides}
```

**Symptom: a merged config silently gains keys when read.** Cause: one input was a `defaultdict`; `defdict_or` kept its type and factory, so missing reads on the result insert. Fix: convert the result.

```python
config = dict(defaults_dd | overrides)
```

**Symptom: `|` on an `OrderedDict`, `defaultdict` or `UserDict` subclass — or a `dict` subclass using the recipe above — raises `TypeError` about missing constructor arguments.** Cause: implementations that preserve the type — `OrderedDict`'s, `UserDict`'s, `defaultdict`'s, and the recipe above — build the result by calling the class. Fix: override `__or__` / `__ror__` to supply the argument, as the `defaultdict` source comment says.

```python
class TenantConfig(dict):
    def __init__(self, tenant: str, *args: object, **kwargs: object) -> None:
        super().__init__(*args, **kwargs)
        self.tenant = tenant

    def __or__(self, other: object) -> "TenantConfig":
        if not isinstance(other, dict):
            return NotImplemented
        merged = TenantConfig(self.tenant, self)
        merged.update(other)
        return merged
```

**Symptom: `plain_dict | ordered_dict` returns an `OrderedDict` and an order-sensitive comparison later fails.** Cause: `odict_or` takes the type of whichever operand is the `OrderedDict`, and `OrderedDict` equality is order-sensitive against another `OrderedDict`. Fix: convert when you want dict semantics.

```python
merged = dict(plain | ordered)
```

## Interview questions

**★ You subclass `dict` and add behaviour. What happens to it under `|`?**
It is lost for the result: `dict.__or__` copies the left operand with `PyDict_Copy`, which always produces an exact `dict`, then updates it. The same is true of `d.copy()` and `{**d, ...}`. `|=` is fine, because it mutates and returns `self`. If the behaviour must survive a merge, override `copy`, `__or__` and `__ror__` to construct `type(self)` — which is what `UserDict` and `OrderedDict` do — and make sure the class can be constructed from a single mapping.

**★ What does `Counter(a=3) | Counter(a=1)` give, and what about `Counter(a=3) | {"a": 1}`?**
The first is `Counter({'a': 3})`: for two counters `|` is the multiset union, *"the … maximum of corresponding counts."* The second is the plain dict `{'a': 1}`: `Counter.__or__` returns `NotImplemented` when the other operand is not a `Counter`, so Python falls back to `dict`'s reflected `|`, which does ordinary last-wins merging and returns a `dict`. Same operator, different type on one side, completely different semantics — and no error.

**★ What is the difference between `os.environ | extra` and `os.environ |= extra`?**
The first returns a new plain `dict` — `Lib/os.py` literally does `new = dict(self); new.update(other); return new` — and changes nothing. The second calls `update` on `os.environ` itself, and assigning to `os.environ` sets the process environment, which every thread and every later subprocess sees. For a child process, build the dict with `|` and pass it as `env=`; reach for `|=` only when you really mean to change the current process.

**Why does `{"x": 1} | OrderedDict(y=2)` return an `OrderedDict` when the left operand is a plain dict?**
Because of how Python resolves binary operators: when the right operand's type is a subclass of the left operand's type and provides its own implementation, the right operand's reflected method gets the first try. `OrderedDict` is a `dict` subclass, and its C `odict_or` handles both positions by taking the type of whichever operand is the `OrderedDict`. `defaultdict` does the same with `defdict_or`.

**Why don't `collections.abc.Mapping` subclasses get `|` for free?**
PEP 584 considered it and declined: *"Currently, neither defines a `copy` method, which would be necessary for `|` to create a new instance."* An ABC cannot know how to construct a new instance of an arbitrary subclass. Standard-library mappings that support `|` each implement it themselves. For your own mapping, either implement `__or__` with knowledge of your constructor, or merge through `dict(m) | other` / `{**m, **other}`.

**What does `MappingProxyType` do with `|` and `|=`?**
`|` delegates — the documentation says it *"simply delegates to the underlying mapping"*, and the C implementation unwraps the proxy and applies ordinary `|` to what it wraps, returning a new object and leaving the original untouched. `|=` raises `TypeError` with *"'|=' is not supported by mappingproxy; use '|' instead"*, because an in-place merge would be a write through a read-only view. That combination makes a proxy a good container for module-level defaults: you can derive from it freely and cannot mutate it by accident.

**Why does `|=` keep a subclass's type when `|` does not?**
Because `|=` never creates an object. `dict_ior` updates `self` in place and returns `self`, so whatever type `self` had, it still has. `|` has to produce a *new* object, and `dict.__or__` does that with `PyDict_Copy`, which knows only how to make an exact `dict`. That asymmetry is the practical argument for `|=` on a copy you built yourself — `merged = MyDict(base); merged |= extra` — when you cannot override `__or__`.

---

← [19 · Merging](07-merging.md) · [Topic index](README.md) · Next → [21 · Removing entries](08-removing-entries.md)
