---
title: "The nine types in collections are three different kinds of thing — dict subclasses that are real dicts, ABC-built wrappers that only look like one, and two standalone structures — and which family a type is in decides its speed, its isinstance answer and whether json.dumps accepts it"
sidebar_label: "01 · Nine types, three families"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections`](https://docs.python.org/3.14/library/collections.html) (module table), [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html) (ABC table, registration), [`typing`](https://docs.python.org/3.14/library/typing.html#aliases-to-container-abcs-in-collections-abc) (deprecated aliases), [Time complexity](https://docs.python.org/3.14/library/time-complexity.html), [What's New in 3.10](https://docs.python.org/3.14/whatsnew/3.10.html#removed), [`json`](https://docs.python.org/3.14/library/json.html). Which type is C and which is Python read from CPython **v3.14.7** — [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py), [`Modules/_collectionsmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_collectionsmodule.c), [`Lib/json/encoder.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/json/encoder.py). Target: **Python 3.14.7**. **No sandbox run.**

**The `collections` documentation lists nine names in one table, and they are not nine of the same thing. `defaultdict`, `Counter` and `OrderedDict` are subclasses of `dict`: they *are* dicts, they pass `isinstance(x, dict)`, they serialise to JSON objects, and every method they do not override runs at `dict` speed. `ChainMap`, `UserDict`, `UserList` and `UserString` are built on the abstract base classes instead of the built-ins: they behave like a mapping, a list or a string, and they are none of those — `isinstance` says no, `json.dumps` raises, and every operation is a Python method call. `deque` and `namedtuple` stand alone: `deque` is a C structure that is *registered* as a `MutableSequence` without inheriting from `list`, and `namedtuple` is not a type at all but a function that writes a new `tuple` subclass each time you call it. Knowing which family a type belongs to answers most questions about it before you open its documentation.**

## The module table, and what each line leaves out

> *"This module implements specialized container datatypes providing alternatives to Python's
> general purpose built-in containers, `dict`, `list`, `set`, and `tuple`."*

| Name | The documentation's line | Family | Implemented in (v3.14.7) |
|---|---|---|---|
| `defaultdict` | *"dict subclass that calls a factory function to supply missing values"* | dict subclass | C (`_collectionsmodule.c`) |
| `Counter` | *"dict subclass for counting hashable objects"* | dict subclass | Python class; counting loop in C |
| `OrderedDict` | *"dict subclass that remembers the order entries were added"* | dict subclass | C (`Objects/odictobject.c`); a pure-Python version stays in the source as the spec |
| `ChainMap` | *"dict-like class for creating a single view of multiple mappings"* | ABC-built | Python, on `MutableMapping` |
| `UserDict` | *"wrapper around dictionary objects for easier dict subclassing"* | ABC-built | Python, on `MutableMapping` |
| `UserList` | *"wrapper around list objects for easier list subclassing"* | ABC-built | Python, on `MutableSequence` |
| `UserString` | *"wrapper around string objects for easier string subclassing"* | ABC-built | Python, on `Sequence` |
| `deque` | *"list-like container with fast appends and pops on either end"* | standalone | C, registered as a `MutableSequence` |
| `namedtuple` | *"factory function for creating tuple subclasses with named fields"* | standalone | Python function; field access in C |

The word the table uses for `ChainMap` — *"dict-like"* — and for `deque` — *"list-like"* — is exact. Like, not is.

## Family 1 — dict subclasses: a dict with one or two methods changed

```python
from collections import Counter, OrderedDict, defaultdict

groups = defaultdict(list)
tally = Counter("mississippi")
recent = OrderedDict()

isinstance(groups, dict), isinstance(tally, dict), isinstance(recent, dict)   # (True, True, True)
```

Each changes a small, specific part of `dict` and inherits the rest:

- **`defaultdict`** — the documentation: *"It overrides one method and adds one writable instance variable."* The method is `__missing__`, the variable is `default_factory`.
- **`Counter`** — adds `__missing__` returning `0`, redefines `update` to *add*, refuses `fromkeys`, and adds multiset arithmetic and comparisons.
- **`OrderedDict`** — adds `move_to_end`, a `popitem(last=...)`, order-sensitive equality with other `OrderedDict`s, and keeps its own linked list of keys.

What you inherit is the C hash table: `d[k]`, `len`, `in`, iteration, and the rest of [03 · `dict`](../03-dict/README.md). The subclassing bypass comes along wherever a method is inherited unchanged: a `defaultdict` subclass that overrides `__setitem__` is skipped by the constructor, `update` and `setdefault` exactly as a `dict` subclass is ([22 · Subclassing dict](../03-dict/09-subclassing-dict.md)). `Counter` and `OrderedDict` are different — both reimplement `update` in terms of `self[key] = value` (in `v3.14.7`, `Counter.update` in Python and `OrderedDict`'s C `mutablemapping_update` through `PyObject_SetItem`), so an override *is* reached through `update`. That is implementation, not a documented promise.

## Family 2 — built on the ABCs: behaves like a container, is not one

`ChainMap`, `UserDict`, `UserList` and `UserString` inherit from `collections.abc` classes, and store their data in an ordinary attribute (`maps` or `data`):

```python
from collections import ChainMap, UserDict, UserList, UserString
from collections.abc import Mapping, MutableSequence, Sequence

settings = ChainMap({"debug": True}, {"debug": False, "region": "eu"})
wrapped = UserDict(region="eu")
rows = UserList([1, 2, 3])
label = UserString("invoice")

isinstance(settings, dict), isinstance(settings, Mapping)      # (False, True)
isinstance(wrapped, dict), isinstance(wrapped, Mapping)        # (False, True)
isinstance(rows, list), isinstance(rows, MutableSequence)      # (False, True)
isinstance(label, str), isinstance(label, Sequence)            # (False, True)
```

Three consequences follow from that one fact, and they are the ones that surface in production:

1. **Every `isinstance(x, dict)` / `isinstance(x, list)` / `isinstance(x, str)` check rejects them** — in your validation layer and in every library you pass them to.
2. **`json.dumps` rejects them.** The encoder in `v3.14.7` tests `isinstance(o, (list, tuple))` and `isinstance(o, dict)` (and the C encoder `PyList_Check`/`PyTuple_Check`/`PyDict_Check`); anything else goes to `default()`, whose base implementation raises `TypeError(f'Object of type {o.__class__.__name__} is not JSON serializable')`.
3. **Every operation is Python code.** The time-complexity page warns that *"the listed costs assume exact built-in types, as instances of subclasses may have different costs"* — and these are not even subclasses of the built-ins; each `x[k]` is a Python method that then indexes the real container underneath.

## Family 3 — the two that stand alone

**`deque`** is a C type with its own storage (a doubly-linked list of fixed-size blocks — [04 · `deque` — the block list underneath](04-deque-the-block-list.md)). It does not inherit from `list`; the module registers it with the ABC after importing it:

```python
# Lib/collections/__init__.py, v3.14.7, lines 44–49
try:
    from _collections import deque
except ImportError:
    pass
else:
    _collections_abc.MutableSequence.register(deque)
```

So `isinstance(d, MutableSequence)` is `True` and `isinstance(d, list)` is `False` — and the ABC's promise of a full sequence API is not the list's: a deque has no slicing (see [06 · Slices that do not copy](../05-slicing/06-slices-that-do-not-copy.md)) and no `sort`.

**`namedtuple`** is a function. Each call builds and returns a new class whose only base is `tuple`; the class, not `namedtuple`, is what your objects are instances of. Everything about those objects *being tuples* is [8 · `namedtuple`](../02-tuple/08-named-records.md) in the tuple topic.

## Which hand-rolled code each one replaces

| You wrote | Reach for | Chunk |
|---|---|---|
| `if k not in d: d[k] = []` then `d[k].append(v)` | `defaultdict(list)` | [02](02-defaultdict.md) |
| `d[k] = d.get(k, 0) + 1` in a loop | `Counter` (or `Counter(iterable)` in one call) | [03](03-counter.md) |
| `sorted(d.items(), key=lambda kv: kv[1], reverse=True)[:10]` | `Counter.most_common(10)` | [03b](03b-counter-top-n.md) |
| `queue.pop(0)` / `queue.insert(0, x)` on a list | `deque.popleft()` / `appendleft()` | [04](04-deque-the-block-list.md) |
| `lines = lines[-100:]` after every append | `deque(maxlen=100)` | [04b](04b-bounded-deques.md) |
| `row[3]` with a comment saying what 3 is | a `namedtuple` (or a dataclass) | [05](05-namedtuple-factory-side.md) |
| `{**defaults, **env, **cli}` rebuilt on every change | `ChainMap(cli, env, defaults)` | [06](06-chainmap-layered-lookup.md) |
| a dict plus a list of keys kept "in recency order" | `OrderedDict.move_to_end` — or `functools.lru_cache` | [07b](07b-ordereddict-lru-caches.md) |

## Annotating them

The built-in generics work on the classes themselves. The `typing` names are deprecated aliases — for each, the `typing` documentation says, for example, *"Deprecated alias to `collections.defaultdict`"* and *"Deprecated since version 3.9: `collections.defaultdict` now supports subscripting (`[]`)."*

```python
from collections import ChainMap, Counter, OrderedDict, defaultdict, deque

page_views: defaultdict[str, Counter[str]] = defaultdict(Counter)
recent_errors: deque[str] = deque(maxlen=100)
lru: OrderedDict[tuple[str, int], bytes] = OrderedDict()
layered: ChainMap[str, str] = ChainMap()
```

The documentation states the parameters in its own words: *"Deques are generic over the type of their contents"* and *"`defaultdict`s are generic over two types, signifying (respectively) the types of the dictionary's keys and values."*

## Gotchas

**★ Symptom: `ImportError: cannot import name 'Mapping' from 'collections'` from an old dependency after a Python upgrade.** Cause: the ABCs moved to `collections.abc` in 3.3, and What's New in 3.10 records the final step — *"Remove deprecated aliases to Collections Abstract Base Classes from the `collections` module."* Fix: import the ABCs from `collections.abc` (and upgrade the dependency that did not).

```python
from collections.abc import Mapping, MutableMapping, Sequence
```

**★ Symptom: a validator rejects a perfectly good settings object with "expected dict".** Cause: the object is a `ChainMap` or a `UserDict` — family 2, a `Mapping` but not a `dict`. Fix: test the ABC, not the concrete type.

```python
from collections.abc import Mapping

def validate(settings: Mapping[str, object]) -> None:
    if not isinstance(settings, Mapping):
        raise TypeError("settings must be a mapping")
```

**★ Symptom: `TypeError: Object of type deque is not JSON serializable` (or `ChainMap`, `UserList`, `UserString`).** Cause: the encoder accepts only `list`/`tuple` for arrays and `dict` for objects, and none of these is. Fix: convert at the boundary.

```python
import json

json.dumps({"recent": list(recent_errors), "settings": dict(layered)})
```

**Symptom: `TypeError` from `isinstance(record, namedtuple)`.** Cause: `namedtuple` is a function, so it cannot be the second argument of `isinstance`; the instances belong to the class it returned. Fix: check the specific class, or duck-type the generated attributes.

```python
def is_named_tuple(obj: object) -> bool:
    return isinstance(obj, tuple) and hasattr(type(obj), "_fields")
```

**Symptom: code that accepts "a list" with `isinstance(x, list)` rejects a `deque` or a `UserList`.** Cause: neither inherits from `list`. Fix: accept the ABC your code actually needs — `Sequence` to read, `MutableSequence` to write — or `Iterable` if you only loop.

```python
from collections.abc import Iterable

def total(amounts: Iterable[int]) -> int:
    return sum(amounts)
```

**Symptom: a type checker or linter flags `typing.DefaultDict` / `typing.Deque` / `typing.Counter`.** Cause: deprecated aliases since 3.9. Fix: subscript the `collections` class.

```python
from collections import deque

inbox: deque[bytes] = deque()
```

**Symptom: a code path is slower after replacing `dict` with `UserDict` (or `list` with `UserList`) to add behaviour.** Cause: family 2 runs every operation as a Python method call over the real container. Fix: keep the plain built-in on the hot path and pass the wrapper's `.data` — or add behaviour in functions that take the plain container.

```python
def hot_sum(values: list[int]) -> int:
    return sum(values)

hot_sum(rows.data)        # the real list inside the UserList
```

## Interview questions

**★ Which types in `collections` are subclasses of `dict`, and why does it matter?**
`defaultdict`, `Counter` and `OrderedDict`. They are real dicts: `isinstance(x, dict)` is true, `json.dumps` writes them as objects, and every method they do not override is `dict`'s C implementation. `ChainMap` and `UserDict` are "dict-like" — built on `MutableMapping`, storing their data in an attribute — so they fail `isinstance(x, dict)`, are refused by `json`, and pay a Python method call per operation. The practical rule: a dict subclass is a drop-in replacement for a dict; an ABC-built mapping is a drop-in replacement only for code that checks `Mapping`.

**★ Why is `deque` registered as a `MutableSequence` rather than being a `list` subclass?**
Because its storage has nothing in common with a list's. A list is one contiguous array of pointers; a deque is a doubly-linked list of fixed-size blocks, which is what makes both ends O(1). Inheriting from `list` would inherit a layout and methods that are wrong for it. Registration (`MutableSequence.register(deque)` in `Lib/collections/__init__.py`) lets `isinstance(d, MutableSequence)` succeed without any inheritance. The ABC documentation's condition for registration — *"Those classes should define the full API"* — is met for the ABC's methods, but a `Sequence` in the ABC sense does not promise slicing, and a deque does not support it.

**Why are `UserDict`, `UserList` and `UserString` still in the standard library when you can subclass the built-ins?**
The documentation's answer is that their need *"has been partially supplanted by the ability to subclass directly"* from the built-in, but they *"can be easier to work with because the underlying"* container *"is accessible as an attribute."* The deeper reason is that a built-in subclass inherits C methods that do not call each other, so overriding one method does not change the others; a class written in Python over a `.data` attribute has only the behaviour its Python methods give it. Whether that actually makes overriding easier differs between the three — chunk **08** *(not written yet)* shows that `UserList`, unlike `UserDict`, does not route its methods through `__setitem__`.

**Is `namedtuple` a class?**
No — it is a factory function. Each call runs code that validates the field names, compiles a `__new__` for them and calls `type(typename, (tuple,), namespace)` to build a brand-new `tuple` subclass. Your objects are instances of that returned class. That is why `isinstance(x, namedtuple)` is a `TypeError`, and why calling `namedtuple(...)` inside a loop or a request handler creates a different class every time ([05 · `namedtuple` from the factory side](05-namedtuple-factory-side.md)).

**How should you annotate a `defaultdict` of `Counter`s in 3.14?**
`defaultdict[str, Counter[str]]`, subscripting the `collections` classes directly. The `typing.DefaultDict`, `typing.Counter` family are *"Deprecated alias[es]"* since 3.9, when the `collections` classes gained `[]` support through PEP 585. The annotation documents the shape; it does not check anything at runtime, and it says nothing about the `default_factory`, which you still pass as the constructor's first argument.

**A function should accept "any mapping" — what do you check and what do you return?**
Check (or annotate) `collections.abc.Mapping`, which every family-1 and family-2 mapping satisfies, and return a plain `dict` built with `dict(m)` or `{**m}`. That accepts a `ChainMap` of settings, a `Counter`, a `UserDict` or a `MappingProxyType`, and gives the caller the one type that `json`, `isinstance(x, dict)` checks and every library accept. The same shape for sequences is `Sequence` in, `list` out.

---

← [Topic index](README.md) · Next → [02 · `defaultdict` — a factory behind `d[k]`](02-defaultdict.md)
