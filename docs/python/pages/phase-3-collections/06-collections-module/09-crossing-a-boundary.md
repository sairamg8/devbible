---
title: "Every collections type changes shape at a boundary — JSON keeps dict subclasses and drops their behaviour, refuses the wrappers and deques, and flattens named tuples to arrays before your default hook can see them; pickle keeps some attributes and silently drops others; and a database driver may bind a Counter's zero for a parameter you forgot"
sidebar_label: "09 · Crossing a boundary — JSON, pickle, copy, isinstance"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`json`](https://docs.python.org/3.14/library/json.html) (conversion table, `JSONEncoder.default`, key coercion), [`pickle`](https://docs.python.org/3.14/library/pickle.html#what-can-be-pickled-and-unpickled), [`copy`](https://docs.python.org/3.14/library/copy.html), [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html), [`collections`](https://docs.python.org/3.14/library/collections.html). Encoder dispatch, `__reduce__` bodies and parameter binding read from CPython **v3.14.7** — [`Lib/json/encoder.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/json/encoder.py), [`Modules/_json.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_json.c), [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py), [`Modules/_collectionsmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_collectionsmodule.c), [`Modules/_sqlite/cursor.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_sqlite/cursor.c), [`Objects/abstract.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/abstract.c) — **implementation detail** where the docs are silent. Target: **Python 3.14.7**. **No sandbox run.**

**Inside one function a `Counter`, a `deque` or a `ChainMap` is just a better container. The trouble starts when it leaves the process or the module: an HTTP response, a cache entry, a message to a worker, a database query, a library that checks `isinstance`. At every one of those boundaries the type is either accepted as the built-in it subclasses — and loses whatever made it special — or rejected because it is not that built-in. The behaviour is decided by a handful of checks in the standard library's own code: the JSON encoder asks `isinstance(o, (list, tuple))` and `isinstance(o, dict)` before it ever calls your `default` hook; `pickle` stores whatever each class's `__reduce__` returns, which for some of these types omits your instance attributes; and `sqlite3` decides between "named" and "positional" parameters by asking `PyDict_Check`. This chunk puts all nine types through the same four boundaries, and ends with a converter that makes the crossing explicit.**

## The matrix

| Type | `json.dumps` | Back from `json.loads` | `pickle` keeps | `isinstance(…, dict/list/str)` |
|---|---|---|---|---|
| `defaultdict` | object | plain `dict` — factory gone | items + factory (must be importable); **no instance attributes** | `dict` ✅ |
| `Counter` | object — **int keys become strings** | plain `dict` | items; **no instance attributes** (`(cls, (dict(self),))`) | `dict` ✅ |
| `OrderedDict` | object | plain `dict` (order kept) | items and instance `__dict__` | `dict` ✅ |
| `ChainMap` | `TypeError` | — | the `maps` list, every layer by value (an `os.environ` layer fails) | ❌ (a `Mapping`) |
| `UserDict` | `TypeError` | — | `data` and instance attributes | ❌ (a `Mapping`) |
| `deque` | `TypeError` | — | items + `maxlen` | ❌ `list` |
| `UserList` | `TypeError` | — | `data` and instance attributes | ❌ `list` |
| `UserString` | `TypeError` | — | `data` and instance attributes | ❌ `str` |
| a `namedtuple` class | **array** — field names gone | `list` | fields, by class reference (class must be importable) | `tuple` ✅ |

Everything in the JSON columns follows from the encoder's dispatch; everything in the pickle column from each type's `__reduce__`.

## JSON: the encoder decides before your hook does

`JSONEncoder._iterencode` in `v3.14.7` tests, in order: `str`, `None`, `True`, `False`, `int`, `float`, then `isinstance(o, (list, tuple))`, then `isinstance(o, dict)`, and only then calls `self.default(o)`, whose base implementation raises `TypeError(f'Object of type {o.__class__.__name__} is not JSON serializable')`. The C accelerator checks `PyList_Check(obj) || PyTuple_Check(obj)` and `PyDict_Check(obj)` in the same order. Two consequences that are easy to get backwards:

- **A named tuple never reaches `default`.** It passes `isinstance(o, tuple)` and is written as an array; a `default` that handles named tuples is dead code. Convert *before* encoding.
- **A `Counter`, `defaultdict` or `OrderedDict` never reaches `default` either.** It is written as an object — and JSON object keys are strings, so the documentation warns that *"when a dictionary is converted into JSON, all the keys of the dictionary are coerced to strings"*; a `Counter` of HTTP status codes comes back keyed `"404"` ([26 · Dicts and JSON](../03-dict/11-dicts-and-json.md) covers the key coercion).

The types that do reach `default` — `deque`, `ChainMap`, the `User*` wrappers — are the ones you can handle there. The robust approach converts the whole structure up front, where every branch is visible:

```python
from collections import ChainMap, Counter, OrderedDict, UserDict, UserList, UserString, defaultdict, deque
from collections.abc import Mapping
from typing import Any


def to_jsonable(value: Any) -> Any:
    """Turn collections types into plain JSON-shaped values, explicitly."""
    if isinstance(value, tuple) and hasattr(type(value), "_fields"):   # named tuple — before tuple
        return {field: to_jsonable(v) for field, v in zip(value._fields, value)}
    if isinstance(value, UserString):
        return value.data
    if isinstance(value, Mapping):                  # dict, Counter, defaultdict, OrderedDict, ChainMap, UserDict
        return {str(k): to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, deque, UserList)):
        return [to_jsonable(v) for v in value]
    return value
```

The order is the logic: named tuples must be caught before the generic tuple branch or they become arrays; `Mapping` covers both the dict subclasses and the ABC-built mappings; keys are stringified deliberately, so the coercion is a decision rather than a surprise.

## pickle: what each `__reduce__` keeps

Pickle stores what `__reduce__` returns, and three of these types return *less than the object*:

- **`Counter`** — `__reduce__` is `return self.__class__, (dict(self),)`: the class and the counts, no state. A subclass's instance attributes are not pickled and its constructor receives the dict.
- **`defaultdict`** — `defdict_reduce` returns the class, `(default_factory,)`, no state, and the items. Instance attributes are dropped; the factory must be importable by name (*"functions (built-in and user-defined) accessible from the top level of a module (using `def`, not `lambda`)"*) — [02b](02b-defaultdict-in-production.md).
- **named tuples** — pickled by class reference; the class must be *"assigned to a variable that matches *typename*"* at module level — [05](05-namedtuple-factory-side.md).

`deque` pickles its `maxlen` and, for subclasses, the instance state; `OrderedDict`, `UserDict`, `UserList` and `UserString` pickle their data and attributes. A `ChainMap` pickles its `maps` list — every layer by value, so a large shared defaults dict is carried into every pickle, and the unpickled chain's layers are independent copies, no longer shared with anything. A layer that is `os.environ` does not pickle at all: in `Lib/os.py` (`v3.14.7`) the `_Environ` object holds `encode`/`decode` functions defined *inside* `_create_environ_mapping`, which pickle cannot reference by qualified name.

```python
import pickle
from collections import Counter


class TaggedCounter(Counter):
    def __init__(self, iterable=None, /, *, tag: str = "", **kwds):
        super().__init__(iterable, **kwds)
        self.tag = tag


c = TaggedCounter("aab", tag="login-failures")
restored = pickle.loads(pickle.dumps(c))
restored.tag                          # '' — Counter.__reduce__ carried the counts, not the tag
```

The fix is to own `__reduce__` in the subclass: `return (type(self), (dict(self),), {"tag": self.tag})` — the third element is state that pickle restores into `__dict__`.

## `copy`: `.copy()` and `copy.copy()` are not always the same function

The `copy` documentation's general warning applies — *"these methods and slicing can create an instance of the base type when copying an instance of a subclass, whereas `copy.copy()` normally returns an instance of the same type"* — and each type has its own specifics:

| Type | `x.copy()` | `copy.copy(x)` |
|---|---|---|
| `defaultdict` | `type(x)(factory, x)` — same factory, shallow | same (`__copy__` is the same C function) |
| `Counter` | `self.__class__(self)` — the constructor | via `__reduce__` — the constructor again |
| `OrderedDict` | `self.__class__(self)` | via `__reduce__` |
| `ChainMap` | new `maps[0]` copy, same lower layers | same (`__copy__ = copy`) |
| `UserDict` subclass | empty-copy then `update` — calls `__setitem__` per key | `__copy__` — copies `.data` directly ([08](08-userlist-and-userdict.md)) |
| `deque` | keeps `maxlen` | keeps `maxlen` — but `deque(x)` does not ([04b](04b-bounded-deques.md)) |

All of them are shallow. For nested structures — a `defaultdict(list)`, a `ChainMap` of dicts — the inner objects are shared between original and copy; `copy.deepcopy` duplicates them. Topic **08 · `copy` vs `deepcopy`** *(not written yet)* is the general treatment.

## `sqlite3`: which parameters count as "named"

`bind_parameters` in `Modules/_sqlite/cursor.c` (`v3.14.7`) takes the *sequence* path when the parameters are an exact tuple or list, or anything that is not a dict subclass and passes `PySequence_Check`; it takes the *named* path only for `PyDict_Check` — a `dict` or dict subclass — and fetches each name with `PyMapping_GetOptionalItemString`. Two consequences:

**A `defaultdict` or `Counter` of named parameters fills in the ones you forgot.** For anything other than an exact `dict`, `PyMapping_GetOptionalItem` (`Objects/abstract.c`) calls `PyObject_GetItem` and treats only `KeyError` as "missing". `Counter.__missing__` returns `0`; a `defaultdict`'s factory returns its default. So instead of `ProgrammingError: You did not supply a value for binding parameter :discount.`, the query runs with `0` (or `None`, i.e. `NULL`) bound:

```python
import sqlite3
from collections import Counter

params = Counter(user_id=42)                            # forgot "discount"
conn.execute(
    "UPDATE carts SET discount = :discount WHERE user_id = :user_id", params
)                                                       # 🔴 discount silently set to 0
conn.execute(
    "UPDATE carts SET discount = :discount WHERE user_id = :user_id", dict(params)
)                                                       # ProgrammingError — the missing name is reported
```

**A `ChainMap` or `UserDict` of named parameters is treated as a sequence.** They are not dict subclasses, and any Python class defining `__getitem__` gets the `sq_item` slot (`Objects/typeobject.c`), so `PySequence_Check` is true. The driver then counts them as positional bindings and raises `ProgrammingError` with either *"Incorrect number of bindings supplied…"* or *"Binding 1 ('user_id') is a named parameter, but you supplied a sequence which requires nameless (qmark) placeholders."* — messages that point at the placeholders, not at the ChainMap. Pass `dict(params)`.

A `deque` or `UserList` works for `?` placeholders for the same reason — it passes `PySequence_Check`.

## Gotchas

**★ Symptom: an API returns `[["INV-1", 1299], ...]` instead of objects, although a custom `JSONEncoder.default` handles the record type.** Cause: the records are named tuples; the encoder writes any `tuple` as an array before `default` is consulted. Fix: convert before encoding.

```python
json.dumps([inv._asdict() for inv in invoices])
```

**★ Symptom: an `UPDATE` sets a column to `0` or `NULL` although the code never supplied that parameter.** Cause: the parameters were a `Counter` or `defaultdict`; `sqlite3`'s named-parameter lookup goes through `__getitem__` for dict subclasses, so `__missing__` answered. Fix: pass an exact `dict`.

```python
conn.execute(sql, dict(params))
```

**★ Symptom: `ProgrammingError: Binding 1 ('user_id') is a named parameter, but you supplied a sequence…` with a `ChainMap` of parameters.** Cause: only dict subclasses take the named path; a `ChainMap` passes `PySequence_Check`. Fix: flatten to a dict.

```python
conn.execute(sql, dict(ChainMap(request_params, defaults)))
```

**★ Symptom: a `Counter` read back from a JSON cache reports zero for every status code.** Cause: JSON object keys are strings; `c[404]` on `{'404': 3}` is a missing key, which a `Counter` reads as `0`. Fix: restore the key type.

```python
codes = Counter({int(k): v for k, v in json.loads(raw).items()})
```

**Symptom: a `Counter` or `defaultdict` subclass loses its attributes after a round trip through a process pool.** Cause: their `__reduce__` omits instance state. Fix: define `__reduce__` with a state element.

```python
def __reduce__(self):
    return (type(self), (dict(self),), {"tag": self.tag})
```

**Symptom: pickling a settings `ChainMap` fails with a pickling error — or succeeds, is enormous, and no longer follows changes to the shared defaults after loading.** Cause: pickling stores every layer by value; an `os.environ` layer cannot be pickled (its encode/decode helpers are local functions in `Lib/os.py`), and any other layer is copied, not shared. Fix: pickle the flattened values you need.

```python
payload = pickle.dumps(dict(settings))
```

**Symptom: `TypeError: Object of type deque is not JSON serializable` from a metrics endpoint.** Cause: `deque` is neither `list` nor `tuple`. Fix: convert at the boundary — `to_jsonable` above, or `list(d)`.

```python
return {"recent": list(recent_errors)}
```

## Interview questions

**★ Why can't a `JSONEncoder.default` override customise how a named tuple is serialised?**
Because `default` is only called for objects the encoder does not already know. The encoder checks `isinstance(o, (list, tuple))` before falling back to `default`, and a named tuple is a `tuple`, so it is written as an array and `default` never sees it. The same applies to dict subclasses such as `Counter`. The only way to control their encoding is to convert them before calling `json.dumps` — `_asdict()` for named tuples, `dict(...)` with deliberate key handling for the mappings.

**★ Which `collections` types does `json.dumps` accept, and what comes back from `json.loads`?**
It accepts the dict subclasses — `defaultdict`, `Counter`, `OrderedDict` — as objects and named tuples as arrays, because they are `dict` and `tuple` instances. It rejects `deque`, `ChainMap`, `UserDict`, `UserList` and `UserString` with `TypeError`. What comes back is always plain `dict`, `list` and `str`: factories, counting behaviour, `maxlen` and field names are gone, and non-string keys have become strings. Round-tripping any of these types needs explicit re-wrapping on load.

**★ What happens if you pass a `defaultdict` as named parameters to `sqlite3` and forget one?**
The query runs with the factory's default bound. `sqlite3` uses the named-parameter path for any dict subclass and looks each name up with `PyMapping_GetOptionalItemString`, which for anything but an exact `dict` goes through `__getitem__` and only treats `KeyError` as missing — so `__missing__` supplies a value. A plain `dict` would have raised `ProgrammingError` naming the missing parameter. The same happens with a `Counter`, which binds `0`.

**How do you serialise a response that mixes Counters, deques, named tuples and ChainMaps?**
Convert the whole structure to plain JSON types before encoding, in one function whose branch order is deliberate: named tuples first (they would otherwise match the tuple branch and become arrays), `UserString` to its `data`, any `Mapping` — which covers the dict subclasses and `ChainMap`/`UserDict` — to a dict with explicitly stringified keys, and `list`, `tuple`, `deque` and `UserList` to lists, recursing into values. A `default` hook cannot do this alone, because the encoder never calls it for tuples and dict subclasses.

**What does pickling a `Counter` subclass preserve?**
Only the class and the counts: `Counter.__reduce__` returns `(self.__class__, (dict(self),))`, with no state element, so instance attributes are not saved and the constructor is called with a dict on load. A subclass with extra attributes must define its own `__reduce__` returning a state dictionary as the third element. `defaultdict` has the same limitation — its `__reduce__` returns no state — plus the requirement that its factory be importable by name.

**Why does a `ChainMap` of query parameters produce a confusing "sequence" error in `sqlite3`?**
`sqlite3` treats parameters as named only if they are a `dict` or dict subclass; otherwise, if the object passes `PySequence_Check`, it treats it as positional. `ChainMap` is a `MutableMapping`, not a dict subclass, and like every Python class that defines `__getitem__` it has the sequence item slot, so the check passes. The driver then complains about binding counts or qmark placeholders. Flatten with `dict(chain)` before passing it.

---

← Prev: [08b · `UserString`](08b-userstring.md) · [Topic index](README.md) · Next topic → **07 · `heapq` and `bisect`** *(not written yet)*
