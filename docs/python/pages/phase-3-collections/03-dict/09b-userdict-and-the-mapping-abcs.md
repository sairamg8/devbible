---
title: "UserDict and MutableMapping route every method through the five you write, which is what makes one override enough — at the price of not being a dict, so isinstance(x, dict) and json.dumps both refuse them, and popitem() quietly takes from the other end"
sidebar_label: "23 · UserDict and the mapping ABCs"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.UserDict`](https://docs.python.org/3.14/library/collections.html#userdict-objects), [`collections.abc` — ABCs table](https://docs.python.org/3.14/library/collections.abc.html#collections-abstract-base-classes), [Glossary — *mapping*](https://docs.python.org/3.14/glossary.html#term-mapping), [`types.MappingProxyType`](https://docs.python.org/3.14/library/types.html#types.MappingProxyType), [`json`](https://docs.python.org/3.14/library/json.html). Mixin implementations read from [`Lib/_collections_abc.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/_collections_abc.py) and [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py) at CPython **v3.14.7**. Target: **CPython 3.14** (3.14.7). **No sandbox run.**

**When you need a mapping whose storing, reading or deleting *means* something different — normalised keys, validated values, an audit log — the fix for [22 · Subclassing dict](09-subclassing-dict.md) is to stop inheriting the C table. `collections.abc.MutableMapping` asks for five methods and builds `update`, `setdefault`, `pop`, `popitem`, `clear`, `get`, `keys`, `items`, `values`, `__contains__` and `__eq__` out of them, so an override in `__setitem__` is honoured everywhere. `UserDict` is the same thing with a real `dict` inside it, reachable as `.data`. The costs are specific and worth knowing before you ship one: it is not a `dict`, so `isinstance` checks and `json.dumps` reject it; it is slower; and `popitem()` removes the *oldest* entry, not the newest.**

## The ABC contract

The `collections.abc` table, verbatim for the two mapping ABCs:

| ABC | Inherits from | Abstract methods | Mixin methods |
|---|---|---|---|
| `Mapping` | `Collection` | `__getitem__`, `__iter__`, `__len__` | `__contains__`, `keys`, `items`, `values`, `get`, `__eq__`, and `__ne__` |
| `MutableMapping` | `Mapping` | `__getitem__`, `__setitem__`, `__delitem__`, `__iter__`, `__len__` | Inherited `Mapping` methods and `pop`, `popitem`, `clear`, `update`, and `setdefault` |

The glossary defines a mapping by exactly this: *"A container object that supports arbitrary key lookups and implements the methods specified in the `collections.abc.Mapping` or `collections.abc.MutableMapping` abstract base classes."* And the `stdtypes` page frames the `dict` operation list as the standard for everyone else: *"These are the operations that dictionaries support (and therefore, custom mapping types should support too)."*

The mixins in `v3.14.7` are ordinary Python written against the abstract methods — `MutableMapping.update` is, in part:

```python
# Lib/_collections_abc.py, MutableMapping.update (v3.14.7)
if isinstance(other, Mapping):
    for key in other:
        self[key] = other[key]
elif hasattr(other, "keys"):
    for key in other.keys():
        self[key] = other[key]
else:
    for key, value in other:
        self[key] = value
for key, value in kwds.items():
    self[key] = value
```

`self[key] = ...` is your `__setitem__`. `setdefault`, `pop` and `popitem` likewise go through `self[key]` and `del self[key]`. That is the whole point: one override, every path.

## A case-insensitive mapping that is actually consistent

```python
from collections.abc import Iterator, MutableMapping


class CaseInsensitiveDict(MutableMapping[str, str]):
    """Keys compare case-insensitively; the first-seen spelling is kept for display."""

    def __init__(self, data: dict[str, str] | None = None, /, **kwargs: str) -> None:
        self._store: dict[str, tuple[str, str]] = {}      # lower -> (original key, value)
        self.update(data or {}, **kwargs)                  # the mixin — goes through __setitem__

    def __getitem__(self, key: str) -> str:
        return self._store[key.lower()][1]

    def __setitem__(self, key: str, value: str) -> None:
        lowered = key.lower()
        original = self._store[lowered][0] if lowered in self._store else key
        self._store[lowered] = (original, value)

    def __delitem__(self, key: str) -> None:
        del self._store[key.lower()]

    def __iter__(self) -> Iterator[str]:
        return (original for original, _ in self._store.values())

    def __len__(self) -> int:
        return len(self._store)

    def __repr__(self) -> str:
        return f"{type(self).__name__}({dict(self.items())!r})"


headers = CaseInsensitiveDict({"Content-Type": "text/html"})
headers.update({"ACCEPT": "*/*"})          # via __setitem__
headers["accept"]                          # '*/*'
"content-type" in headers                  # True — Mapping.__contains__ calls __getitem__
headers.get("CONTENT-TYPE")                # 'text/html' — Mapping.get calls __getitem__
headers.setdefault("Accept", "x")          # '*/*' — no duplicate entry
list(headers)                              # ['Content-Type', 'ACCEPT']
```

Every method behaves, because every method was built from the five you wrote. `Mapping.__contains__` and `Mapping.get` are implemented as `try: self[key]` / `except KeyError`, which is what makes them honour the override.

## `UserDict`: the same thing, with the dict already inside

> *"The class, `UserDict` acts as a wrapper around dictionary objects. The need for this class has been partially supplanted by the ability to subclass directly from `dict`; however, this class can be easier to work with because the underlying dictionary is accessible as an attribute."*

> *"Class that simulates a dictionary. The instance's contents are kept in a regular dictionary, which is accessible via the `data` attribute of `UserDict` instances."*

`UserDict` is a `MutableMapping` whose five abstract methods are implemented on `self.data`, plus conveniences: `copy`, `fromkeys`, `__repr__`, `|` that preserves the class. You override the methods whose meaning you are changing and write to `self.data`:

```python
from collections import UserDict


class AuditedDict(UserDict):
    def __init__(self, *args: object, audit: list[str], **kwargs: object) -> None:
        self.audit = audit                  # set BEFORE super().__init__, which calls update()
        super().__init__(*args, **kwargs)

    def __setitem__(self, key: str, value: object) -> None:
        self.audit.append(f"set {key}")
        self.data[key] = value

    def __delitem__(self, key: str) -> None:
        self.audit.append(f"del {key}")
        del self.data[key]


log: list[str] = []
d = AuditedDict({"a": 1}, audit=log)       # constructor -> update -> __setitem__: logged
d.update(b=2)                              # logged
d.pop("a")                                 # logged — MutableMapping.pop calls del self[key]
```

⚠️ Two `UserDict` methods read `self.data` *directly* rather than going through `__getitem__`. In `v3.14.7`, `UserDict.__contains__` is `return key in self.data`, and `UserDict.get` is `if key in self: return self[key]` — commented *"Modify `__contains__` and get() to work like dict does when `__missing__` is present."* So if you normalise keys in `__getitem__` only, `in` and `get` will disagree with `d[k]`. Normalise on the way *in* (`__setitem__`) and override `__contains__` too, or use the `MutableMapping` pattern above, where `__contains__` goes through `__getitem__`.

`UserDict.__getitem__` also honours `__missing__`: it checks `self.data`, then calls `self.__class__.__missing__` if the class defines one, else raises `KeyError`.

## The costs

**It is not a `dict`.** `UserDict` and `MutableMapping` subclasses fail `isinstance(x, dict)`. Code that checks for `dict` specifically — including your own validation layers — rejects them. Check against the ABC instead:

```python
from collections.abc import Mapping

def normalise(payload: Mapping[str, object]) -> dict[str, object]:
    if not isinstance(payload, Mapping):
        raise TypeError("expected a mapping")
    return dict(payload)
```

**`json.dumps` refuses it.** The `json` conversion table maps `dict` to a JSON object and lists nothing for other mappings, and the encoder's fallback is the `default` hook, whose base implementation raises `TypeError(f'Object of type {o.__class__.__name__} is not JSON serializable')` (`Lib/json/encoder.py`, `v3.14.7`). Convert at the boundary:

```python
json.dumps(dict(headers))
json.dumps(audited.data)          # UserDict: the real dict is right there
```

**`popitem()` takes from the front.** `MutableMapping.popitem` in `v3.14.7` is `key = next(iter(self))` followed by `del self[key]` — the **first** key in iteration order. `UserDict` does not override it. `dict.popitem()` is documented as LIFO. Same method name, opposite ends:

```python
from collections import UserDict

plain = {"a": 1, "b": 2}
wrapped = UserDict({"a": 1, "b": 2})
plain.popitem()        # ('b', 2) — LIFO, documented for dict
wrapped.popitem()      # ('a', 1) — the MutableMapping mixin takes next(iter(self))
```

**It is slower.** Every operation is at least one Python-level call. The complexity page's caveat — *"instances of subclasses may have different costs"* — applies with more force to a class written in Python on top of a dict than to a subclass of one.

## Accept a `Mapping`, return a `dict`

The general rule for function signatures that falls out of all this: **type parameters as `collections.abc.Mapping` (or `MutableMapping` if you mutate), and return a plain `dict`.** Accepting the ABC lets callers pass a `MappingProxyType`, a `ChainMap`, a `UserDict` or a `dict`; returning a `dict` gives them the one mapping type every library, serialiser and type check accepts.

```python
from collections.abc import Mapping

def effective_settings(defaults: Mapping[str, object], overrides: Mapping[str, object]) -> dict[str, object]:
    return {**defaults, **overrides}          # unpacking accepts any Mapping; result is a dict
```

`Mapping` in a signature also documents intent: the function will not write to what you pass it.

## Gotchas

**★ Symptom: `isinstance(settings, dict)` is `False` and a validation layer rejects a perfectly good mapping.** Cause: `UserDict`, `MutableMapping` subclasses, `MappingProxyType` and `ChainMap` are mappings but not `dict`s. Fix: check `collections.abc.Mapping`.

```python
if not isinstance(settings, Mapping):
    raise TypeError("settings must be a mapping")
```

**★ Symptom: `TypeError: Object of type CaseInsensitiveDict is not JSON serializable`.** Cause: the encoder serialises `dict` and falls back to `default` for everything else. Fix: convert, or teach the encoder once.

```python
from collections.abc import Mapping

def encode_mappings(obj: object) -> object:
    if isinstance(obj, Mapping):
        return dict(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")

json.dumps(payload, default=encode_mappings)
```

**★ Symptom: replacing a `dict` with a `UserDict` reverses the order a drain loop processes items.** Cause: `MutableMapping.popitem` takes `next(iter(self))` — the oldest entry — while `dict.popitem` is LIFO. Fix: be explicit about the end you want.

```python
newest_key = next(reversed(d.data))      # UserDict: reverse the real dict
value = d.pop(newest_key)
```

**★ Symptom: on a `UserDict` subclass that normalises in `__getitem__`, `k in d` and `d.get(k)` disagree with `d[k]`.** Cause: `UserDict.__contains__` reads `self.data` directly, and `get` is written on top of it. Fix: normalise on write, and override `__contains__` to match.

```python
class LowerDict(UserDict):
    def __setitem__(self, key: str, value: object) -> None:
        self.data[key.lower()] = value

    def __getitem__(self, key: str) -> object:
        return super().__getitem__(key.lower())

    def __contains__(self, key: object) -> bool:
        return isinstance(key, str) and key.lower() in self.data
```

**Symptom: `AttributeError` for an attribute used inside an overridden `__setitem__` during construction.** Cause: `UserDict.__init__` calls `self.update(...)`, which calls your `__setitem__` before the rest of your `__init__` has run. Fix: set the attributes first, then call `super().__init__`.

```python
def __init__(self, *args: object, audit: list[str], **kwargs: object) -> None:
    self.audit = audit
    super().__init__(*args, **kwargs)
```

**Symptom: instantiating a `MutableMapping` subclass raises `TypeError` naming abstract methods.** Cause: a `MutableMapping` subclass is missing one of the five abstract methods — most often `__len__` or `__iter__`. Fix: implement all five.

```python
def __iter__(self) -> Iterator[str]:
    return iter(self._store)

def __len__(self) -> int:
    return len(self._store)
```

**Symptom: a function typed `dict[str, Any]` forces every caller to convert a `MappingProxyType` first.** Cause: the parameter type is narrower than what the function needs. Fix: accept `Mapping`, return `dict`.

```python
def render(context: Mapping[str, object]) -> str:
    return TEMPLATE.format_map(context)
```

**Symptom: a hot path got measurably slower after a `dict` was replaced with a `UserDict` "for safety".** Cause: every subscription is now a Python method call on top of a `dict` lookup. Fix: keep the plain `dict` inside the hot path and wrap only at the API boundary.

```python
def hot_loop(table: dict[str, int], keys: list[str]) -> int:
    return sum(table[k] for k in keys)

hot_loop(audited.data, keys)            # the real dict, no wrapper cost
```

## Interview questions

**★ Why does overriding `__setitem__` work on a `MutableMapping` subclass but not on a `dict` subclass?**
Because `MutableMapping`'s other methods are written in Python in terms of the abstract ones — `update` does `self[key] = other[key]`, `setdefault` does `self[key] = default`, `pop` does `del self[key]` — so your override is on every path. `dict`'s methods are C functions that operate on the hash table directly and never dispatch back to Python-level `__setitem__`. The ABC trades speed for the guarantee that five methods define the whole behaviour.

**★ What does `UserDict` give you over `MutableMapping`?**
The storage and the boilerplate: a real `dict` in `self.data`, implementations of all five abstract methods on it, `copy`, `fromkeys`, a `repr`, `|`/`|=` that preserve the subclass, and `__missing__` support in `__getitem__`. The documentation's own pitch: it *"can be easier to work with because the underlying dictionary is accessible as an attribute."* You override only what changes meaning and write through `self.data`. The one trap is that `__contains__` and `get` read `self.data` directly, so normalisation must happen on write.

**★ What are the practical costs of using `UserDict` instead of `dict`?**
It fails `isinstance(x, dict)`; `json.dumps` will not serialise it without conversion or a `default` hook; it is slower because every operation runs Python code; and `popitem()` comes from the `MutableMapping` mixin, which removes `next(iter(self))` — the oldest entry — where `dict.popitem()` is documented as LIFO. None of these raise where the substitution happened, which is why swapping a `dict` for a `UserDict` deserves a test pass rather than a find-and-replace.

**How should a function that only reads a mapping be typed?**
Accept `collections.abc.Mapping[K, V]` and, if it builds a new mapping, return `dict[K, V]`. The ABC admits every mapping — `dict`, `MappingProxyType`, `ChainMap`, `UserDict`, your own — and it tells the reader the function will not mutate its argument. Returning a concrete `dict` gives callers the type that every serialiser and `isinstance(x, dict)` check accepts. `{**mapping}` and `dict(mapping)` both convert any `Mapping`.

**What is the minimum you must implement to get a full mapping?**
For read-only, `Mapping` needs `__getitem__`, `__iter__` and `__len__`; it supplies `__contains__`, `keys`, `items`, `values`, `get`, `__eq__` and `__ne__`. For mutable, `MutableMapping` adds `__setitem__` and `__delitem__` and supplies `pop`, `popitem`, `clear`, `update` and `setdefault`. Miss one abstract method and instantiation raises `TypeError`, which is the ABC doing its job.

**When would you choose `MutableMapping` over `UserDict`?**
When the storage is not simply one `dict` of the same keys — a store of `(original_key, value)` pairs under normalised keys, a mapping backed by a database or a file, a view over another object. `MutableMapping` asks only for the five methods and makes no assumption about where the data lives, and its `__contains__` and `get` go through your `__getitem__`. `UserDict` is the shortcut for "a dict, with a few methods changed" and gives you `.data`, `copy`, `fromkeys` and `|` for free.

**Why do `UserDict.__contains__` and `UserDict.get` read `self.data` directly?**
To behave like `dict` when a subclass defines `__missing__`. The source comment says so: *"Modify `__contains__` and get() to work like dict does when `__missing__` is present."* If `in` and `get` went through `__getitem__`, a `__missing__` that returns a default would make every key appear present and every `get` return the default — the opposite of `dict`, where `__missing__` fires only on `d[key]`. The cost is that normalisation done only in `__getitem__` is invisible to `in` and `get`.

---

← [22 · Subclassing dict](09-subclassing-dict.md) · [Topic index](README.md) · Next → [24 · Dict equality](09c-dict-equality.md)
