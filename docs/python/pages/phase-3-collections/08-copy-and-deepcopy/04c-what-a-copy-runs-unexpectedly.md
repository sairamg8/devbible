---
title: "A copy runs your __getattr__ on a half-built object, your append on a list whose state it shares, and the lookup for __deepcopy__ on your proxy's target — and it skips everything __init__ was doing, from id assignment to closing a descriptor — so five ordinary classes copy wrongly for reasons that are all in _reconstruct"
sidebar_label: "04c · What a copy runs unexpectedly"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** against [`Lib/copy.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py), the [pickle documentation on class instances](https://docs.python.org/3.14/library/pickle.html#pickling-class-instances) and the `copy` documentation. Documentation- and source-validated — **no sandbox run**; every failure below is derived from reading `copy` and `_reconstruct`, and each `assert` states what that reading implies, not an observed result.

**The two previous chunks read `copy` and `_reconstruct` as code. This one collects the ordinary classes that break inside them, because each breakage is the same fact seen from a different class: the new object exists but its `__init__` has not run, and `copy` will call methods on it anyway. A `__getattr__` that reads an attribute the new object does not have yet recurses. A `list` subclass whose `append` writes to shared state pollutes the original. A proxy answers `copy`'s lookup for `__deepcopy__` with its target's. A class that assigns an identity or owns a resource in `__init__` gets a copy with the same identity and the same resource. Each has a two-line fix once you can see it.**

## `__getattr__` on a half-built object

`_reconstruct` calls `hasattr(y, '__setstate__')` on the *new* object, before its state is restored. `object` has no `__setstate__`, so for an ordinary class the lookup fails and falls through to `__getattr__` — with an instance whose `__dict__` is empty. The pickle documentation warns of exactly this:

> *"At unpickling time, some methods like `__getattr__()`, `__getattribute__()`, or `__setattr__()` may be called upon the instance. In case those methods rely on some internal invariant being true, the type should implement `__new__()` to establish such an invariant, as `__init__()` is not called when unpickling an instance."*

The class below reads `self._cache` inside `__getattr__`. On the half-built object `_cache` does not exist, so reading it calls `__getattr__("_cache")`, which reads `self._cache`, and so on:

```python
import copy


class LazySettings:
    def __init__(self, loader):
        self._loader = loader
        self._cache = {}

    def __getattr__(self, name):                 # only called when normal lookup fails
        if name not in self._cache:              # reads self._cache: recursion on a new object
            self._cache[name] = self._loader(name)
        return self._cache[name]


settings = LazySettings(lambda name: name.upper())
copy.copy(settings)                              # RecursionError, derived from _reconstruct
```

`hasattr` only swallows `AttributeError`. A `RecursionError` — or a `KeyError` from a `__getattr__` written as `return self.data[name]` — propagates out of the copy. Three fixes, in order of preference:

```python
class LazySettings:
    def __init__(self, loader):
        self._loader = loader
        self._cache = {}

    def __getattr__(self, name):
        if name.startswith("_"):                 # never lazy-load private or dunder names
            raise AttributeError(name)
        cache = self.__dict__["_cache"]
        if name not in cache:
            cache[name] = self._loader(name)
        return cache[name]
```

The guard turns the failed dunder lookup into a plain `AttributeError`, which `hasattr` reports as `False`. Alternatively define `__getstate__` and `__setstate__`, so the class answers `hasattr` itself and `__getattr__` is never asked; or read through `self.__dict__`, which the type provides without `__getattr__`.

## A proxy answers the `__deepcopy__` lookup with its target's

`copy.copy` looks `__copy__` up on the *class*; `copy.deepcopy` looks `__deepcopy__` up on the *instance* (`getattr(x, "__deepcopy__", None)`). A class with a forwarding `__getattr__` therefore behaves differently under the two functions:

```python
import copy
from decimal import Decimal


class Proxy:
    def __init__(self, target):
        self._target = target

    def __getattr__(self, name):
        if name == "_target":
            raise AttributeError(name)
        return getattr(self._target, name)


proxy = Proxy(Decimal("1.5"))

shallow = copy.copy(proxy)
deep = copy.deepcopy(proxy)

assert isinstance(shallow, Proxy)
assert not isinstance(deep, Proxy)        # deepcopy called the Decimal's __deepcopy__
```

For the deep copy, `getattr(proxy, "__deepcopy__", None)` misses on `Proxy`, falls into `__getattr__`, and gets `Decimal`'s bound `__deepcopy__` — which returns the `Decimal`. The "copy of the proxy" is the target. Give the proxy its own hooks so it is never asked:

```python
    def __copy__(self):
        return Proxy(self._target)

    def __deepcopy__(self, memo):
        return Proxy(copy.deepcopy(self._target, memo))
```

## An overridden `append` runs against shared state

Step 4 restores the state, step 5 appends each item with the subclass's own `append`. In a shallow copy, the state's *values* are the original's objects. A subclass whose `append` records something in one of them writes into the **original**:

```python
import copy


class AuditedList(list):
    def __init__(self, items=()):
        super().__init__(items)
        self.log = []

    def append(self, item):
        self.log.append(("append", item))
        super().append(item)


audited = AuditedList([1, 2])
audited.append(3)
assert len(audited.log) == 1

twin = copy.copy(audited)
assert twin.log is audited.log            # the state value is shared
assert len(audited.log) == 4              # the copy's three appends wrote into it
```

A deep copy has the opposite fault: the log is copied first, and then the three `append` calls add three more entries to the *copy's* log. Neither result is a faithful copy. Take over both hooks, and build the items with the C-level `extend`, which does not call `append`:

```python
import copy


class AuditedList(list):
    def __init__(self, items=()):
        super().__init__(items)
        self.log = []

    def append(self, item):
        self.log.append(("append", item))
        super().append(item)

    def __copy__(self):
        clone = type(self)(self)                # __init__ fills items without append
        clone.log = list(self.log)
        return clone

    def __deepcopy__(self, memo):
        clone = type(self)()
        memo[id(self)] = clone
        list.extend(clone, (copy.deepcopy(item, memo) for item in self))
        clone.log = copy.deepcopy(self.log, memo)
        return clone
```

The same holds for a `dict` subclass whose `__setitem__` logs, validates or counts.

## Copies skip what `__init__` was doing

Identity, registration and ownership are usually set in `__init__`. A copy carries the state — including the identity — and does none of the rest:

```python
import copy
import uuid


class Draft:
    _instances = []

    def __init__(self, title):
        self.id = uuid.uuid4()
        self.title = title
        Draft._instances.append(self)


draft = Draft("Q3 plan")
twin = copy.copy(draft)

assert twin.id == draft.id                 # two objects, one primary key
assert twin not in Draft._instances        # and the copy was never registered
```

If two objects with one `id` will both be saved, the second save overwrites or collides. If lookups go through the registry, the copy is invisible to them. The class should say what a copy *is*: a new draft with a new identity, registered.

```python
    def __copy__(self):
        clone = type(self)(self.title)          # __init__: new id, registered
        return clone

    def __deepcopy__(self, memo):
        return type(self)(copy.deepcopy(self.title, memo))
```

The sharpest form is a class that owns a resource. A `__del__` that closes a descriptor runs for *every* object that reaches the end of its life — including a copy that never opened it and shares the original's number:

```python
import copy
import os


class Spool:
    """Owns a file descriptor and closes it when collected."""

    def __init__(self, path):
        self.fd = os.open(path, os.O_RDONLY)

    def __del__(self):
        fd = getattr(self, "fd", None)
        if fd is not None:
            os.close(fd)

    def __copy__(self):
        clone = type(self).__new__(type(self))
        clone.fd = os.dup(self.fd)            # its own descriptor, closed by its own __del__
        return clone

    def __deepcopy__(self, memo):
        return self.__copy__()
```

The default copy would leave two `Spool` objects holding one descriptor number, each `__del__` closing it — the second close hits an unrelated descriptor if the number was reused in between. If duplicating is not meaningful, raise `TypeError` from both hooks rather than let the default run.

## A `__new__` singleton rewritten by its own deep copy

`_reconstruct` calls `func(*args)`, which for the default recipe is `cls.__new__(cls)`. If `__new__` returns the existing instance, `y` *is* `x`. The deep copy then deep-copies the state and applies it to that same object:

```python
import copy


class Registry:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance.handlers = []
        return cls._instance


registry = Registry()
handlers_before = registry.handlers

clone = copy.deepcopy(registry)

assert clone is registry
assert registry.handlers is not handlers_before      # derived: replaced by its own copy
```

Anything else holding `handlers_before` — a component that grabbed the list at start-up — is now attached to a list the registry no longer uses. A shallow copy does no harm: it updates the object's dictionary from itself. Give the singleton the two hooks that return `self`:

```python
    def __copy__(self):
        return self

    def __deepcopy__(self, memo):
        return self
```

## Gotchas

**★ Symptom: `RecursionError` (or `KeyError`) from `copy.copy` or `copy.deepcopy` on an object with a `__getattr__`, with a traceback that alternates `__getattr__` and `hasattr`.** Cause: `hasattr(y, '__setstate__')` runs on the new object before its state exists, and `__getattr__` reads an attribute that is not there yet. Fix: raise `AttributeError` for names beginning with an underscore, or read through `self.__dict__`.

**★ Symptom: `copy.deepcopy(proxy)` returns the wrapped object, not a proxy, while `copy.copy(proxy)` returns a proxy.** Cause: `deepcopy` looks up `__deepcopy__` on the instance and the proxy's `__getattr__` forwards it to the target. Fix: define `__copy__` and `__deepcopy__` on the proxy class.

**★ Symptom: copying a list or dict subclass changes the original's log, counter or audit trail — or doubles the copy's.** Cause: the state's values are shared in a shallow copy, and the overridden `append`/`__setitem__` is called once per item on the new object. Fix: `__copy__` and `__deepcopy__` that fill the container with `list.extend`/`dict.update` and copy the bookkeeping explicitly.

**★ Symptom: two objects share one id, or a copy is missing from the registry, or a resource is released twice.** Cause: a copy carries the state and does not run `__init__`. Fix: `__copy__` that constructs through `__init__`, or `os.dup` for a descriptor — or a `TypeError` if a copy is meaningless.

**Symptom: a singleton's attributes are replaced by copies of themselves after `deepcopy`.** Cause: `__new__` returned the existing object and `_reconstruct` applied the deep-copied state to it. Fix: `__copy__` and `__deepcopy__` returning `self`.

**Symptom: `copy.copy` works and `copy.deepcopy` recurses on the same class, or the reverse.** Cause: the two functions ask different questions of the object — `copy` looks up `__copy__` on the class, `deepcopy` looks up `__deepcopy__` on the instance, and only `_reconstruct` calls `hasattr(y, '__setstate__')`. Fix: test both functions on every class you ship that defines `__getattr__`, `__new__` or a container base.

```python
import copy


def test_copy_and_deepcopy_both_work(settings):
    assert copy.copy(settings) is not settings
    assert copy.deepcopy(settings) is not settings
```

## Interview questions

**★ Why can a class with a `__getattr__` fail when copied, and what is the fix?**
Because `_reconstruct` calls `hasattr(y, '__setstate__')` on the newly created object before it has any attributes, and the lookup falls through to `__getattr__`. If `__getattr__` reads an attribute that only `__init__` sets, it calls itself. `hasattr` does not swallow `RecursionError` or `KeyError`. Guard `__getattr__` so names beginning with an underscore raise `AttributeError`, or implement `__setstate__` so the lookup succeeds normally.

**★ Why does `copy.deepcopy` of a forwarding proxy return the wrapped object?**
`deepcopy` does `getattr(x, "__deepcopy__", None)` on the instance. A proxy's `__getattr__` forwards the missing name to the target, so a target that defines `__deepcopy__` answers, and its result — a copy of the target — is returned in place of a proxy. `copy.copy` reads `__copy__` from the class, where the forwarding does not apply, so the two functions disagree.

**★ How can copying a list subclass change the original?**
The shallow copy shares the state's values with the original. `_reconstruct` then calls the subclass's overridden `append` for every item, and an `append` that records into a shared attribute writes to the original's. Override `__copy__` to build the items with `list.extend` and copy the attribute.

**Why does a copy of an object have the same id as the original, and how do you get a new one?**
The id was assigned in `__init__`, which a copy does not run; the state including the id is copied. Write `__copy__` to call the constructor, or use `copy.replace` with a `__replace__` that generates a new id.

**What is unusual about deep-copying a `__new__`-based singleton?**
The reduce recipe calls `__new__`, which hands back the existing instance, so the deep copy applies copies of its state back onto the original object. Its attributes end up replaced by equal copies, which breaks anyone still holding the old ones. The hooks that return `self` avoid it.

---

← [04b · _reconstruct step by step](04b-reconstruct-step-by-step.md) · [Topic index](README.md) · Next → [05 · Writing copy hooks](05-writing-copy-hooks.md)
