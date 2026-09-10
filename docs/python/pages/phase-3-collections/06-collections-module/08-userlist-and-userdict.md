---
title: "UserDict funnels its writes through __setitem__ only because it inherits MutableMapping's update — UserList inherits nothing of the kind, so every one of its methods writes self.data directly, and a UserList that validates in __setitem__ is bypassed by append, extend, insert, += and its own constructor"
sidebar_label: "08 · UserList and UserDict — wrappers, not funnels"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.UserDict`](https://docs.python.org/3.14/library/collections.html#userdict-objects), [`collections.UserList`](https://docs.python.org/3.14/library/collections.html#userlist-objects) (the subclassing requirements), [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html) (`MutableSequence`), [`copy`](https://docs.python.org/3.14/library/copy.html). Every method body read from CPython **v3.14.7** [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py) (`UserDict` lines 1133–1223, `UserList` lines 1230–1356) and [`Lib/_collections_abc.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/_collections_abc.py) (`MutableSequence`, lines 1104–1168). Target: **Python 3.14.7**. **No sandbox run.**

**The `User*` classes are sold as the easy way to customise a built-in: *"a useful base class for your own list-like classes which can inherit from them and override existing methods or add new ones."* The dict topic's [23 · `UserDict` and the mapping ABCs](../03-dict/09b-userdict-and-the-mapping-abcs.md) shows why that works for `UserDict`: it inherits `update`, `setdefault` and `pop` from `MutableMapping`, which are written as `self[key] = value` and `del self[key]`, so one override of `__setitem__` is honoured almost everywhere. People then assume `UserList` works the same way. It does not. `UserList` implements every list method itself, each one a direct call on `self.data` — `append` is `self.data.append(item)`, `extend` is `self.data.extend(other)`, the constructor is `list(initlist)` — so overriding `__setitem__` catches `ul[i] = x` and nothing else. `UserList` is a list with its storage exposed as `.data`, not a class that funnels its writes through one method. If you need the funnel, `collections.abc.MutableSequence` is the class that provides it. This chunk is the wrapper model, the two places `UserDict` also bypasses its own `__setitem__`, and what each wrapper returns and refuses.**

## What "wrapper" means here

> *"Class that simulates a list. The instance's contents are kept in a regular list, which is
> accessible via the `data` attribute of `UserList` instances. The instance's contents are initially
> set to a copy of *list*, defaulting to the empty list `[]`."*

> *"The need for this class has been partially supplanted by the ability to subclass directly from
> `list`; however, this class can be easier to work with because the underlying list is accessible as
> an attribute."*

All three `User*` classes follow one pattern: a Python class on an ABC (`MutableMapping`, `MutableSequence`, `Sequence`), with a real built-in in `self.data`, and methods that forward to it. Because they are Python classes, *you can override any of them* and your override is called — unlike a `list` or `dict` subclass, whose C methods never dispatch to your Python methods ([10c · `__setitem__`, `__delitem__` and the ABCs](../05-slicing/10c-setitem-delitem-and-the-abcs.md), [22 · Subclassing dict](../03-dict/09-subclassing-dict.md)). What they do *not* promise is that their methods call *each other*.

## Which `UserList` paths reach your `__setitem__`

From the `v3.14.7` source:

| Operation | `list` subclass | `UserList` subclass | `MutableSequence` subclass |
|---|---|---|---|
| `x[i] = v`, `x[i:j] = vs` | your `__setitem__` | your `__setitem__` | your `__setitem__` |
| `x.append(v)` | C, bypasses | `self.data.append(item)`, bypasses | mixin → `self.insert(len(self), v)` |
| `x.insert(i, v)` | C, bypasses | `self.data.insert(i, item)`, bypasses | your `insert` (abstract) |
| `x.extend(vs)`, `x += vs` | C, bypasses | `self.data.extend` / `self.data +=`, bypasses | mixin → `append` → `insert` |
| constructor | C, bypasses | `list(initlist)` / `self.data[:] = initlist`, bypasses | your `__init__` |
| `x + y`, `x * n` | new plain `list` | `self.__class__(self.data + …)` → your `__init__` | not provided |
| `x.pop()`, `x.remove(v)` | C | `self.data.pop` / `self.data.remove` | mixin → `del self[i]` |
| `x.reverse()` | C | `self.data.reverse()` | mixin → swaps through `self[i]` |
| `x.sort()` | C | `self.data.sort(...)` | not provided |

So a validating list needs one of two designs.

**On `UserList`: override every entry point.** Five methods is the minimum for "no invalid item ever gets in":

```python
from collections import UserList
from collections.abc import Iterable


class Prices(UserList[int]):
    """A list of non-negative prices in cents."""

    @staticmethod
    def _check(value: int) -> int:
        if not isinstance(value, int) or value < 0:
            raise ValueError(f"invalid price: {value!r}")
        return value

    def __init__(self, initlist: Iterable[int] | None = None) -> None:
        super().__init__(self._check(v) for v in (initlist or ()))

    def __setitem__(self, index, value) -> None:
        if isinstance(index, slice):
            value = [self._check(v) for v in value]
        else:
            value = self._check(value)
        self.data[index] = value

    def append(self, value: int) -> None:
        self.data.append(self._check(value))

    def insert(self, index: int, value: int) -> None:
        self.data.insert(index, self._check(value))

    def extend(self, values: Iterable[int]) -> None:
        self.data.extend(self._check(v) for v in values)

    def __iadd__(self, values: Iterable[int]) -> "Prices":
        self.extend(values)
        return self
```

`+` and `*` build a new instance through the constructor (`self.__class__(self.data + list(other))`), so validation in `__init__` covers them — which is also why the documentation requires *"a constructor which can be called with either no arguments or one argument"* ([10b · Integer keys and return types](../05-slicing/10b-integer-keys-and-return-types.md) shows what breaks without it).

**On `MutableSequence`: write five methods and inherit the funnel.** The mixins are written against `insert`, `__setitem__` and `__delitem__` — `append` is `self.insert(len(self), value)`, `extend` loops over `append`, `__iadd__` calls `extend` — so validating in `insert` and `__setitem__` covers every write:

```python
from collections.abc import Iterable, MutableSequence


class Prices(MutableSequence[int]):
    def __init__(self, values: Iterable[int] = ()) -> None:
        self._items: list[int] = []
        self.extend(values)                          # mixin → append → insert: validated

    @staticmethod
    def _check(value: int) -> int:
        if not isinstance(value, int) or value < 0:
            raise ValueError(f"invalid price: {value!r}")
        return value

    def __getitem__(self, index):
        return self._items[index]

    def __setitem__(self, index, value) -> None:
        if isinstance(index, slice):
            value = [self._check(v) for v in value]
        else:
            value = self._check(value)
        self._items[index] = value

    def __delitem__(self, index) -> None:
        del self._items[index]

    def __len__(self) -> int:
        return len(self._items)

    def insert(self, index: int, value: int) -> None:
        self._items.insert(index, self._check(value))
```

The trade: `MutableSequence` gives you no `sort`, no `+`, no `copy`, and every inherited method runs Python-level loops (`extend` is one `insert` call per item); `UserList` gives you all of the list API at nearly list speed and makes you override each write path yourself.

## Two `UserDict` paths that skip `__setitem__`

`UserDict` really is a funnel for `update`, `setdefault`, the constructor and `|` — they come from `MutableMapping` or go through the constructor. Two methods in `v3.14.7` write `self.data` directly:

```python
# Lib/collections/__init__.py, v3.14.7 — UserDict
def __ior__(self, other):
    if isinstance(other, UserDict):
        self.data |= other.data
    else:
        self.data |= other
    return self

def __copy__(self):
    inst = self.__class__.__new__(self.__class__)
    inst.__dict__.update(self.__dict__)
    # Create a copy and avoid triggering descriptors
    inst.__dict__["data"] = self.__dict__["data"].copy()
    return inst
```

So on an auditing or normalising `UserDict` subclass, `settings |= overrides` updates the storage without a single `__setitem__` call — unnormalised keys, no audit entries — while `settings.update(overrides)` goes through the override. `copy.copy(d)` copies the storage directly; `d.copy()` for a subclass does something different again:

```python
def copy(self):
    if self.__class__ is UserDict:
        return UserDict(self.data.copy())
    import copy
    data = self.data
    try:
        self.data = {}
        c = copy.copy(self)
    finally:
        self.data = data
    c.update(self)
    return c
```

— it copies the instance with empty storage and then `update`s, which calls `__setitem__` for every key. Both copies share every *other* instance attribute by reference (`inst.__dict__.update(self.__dict__)` is shallow), so an `AuditedDict` copy appends to the *same* audit list as the original. Override `__ior__` if `|=` must be funnelled, and override `__copy__`/`copy` if instance attributes must not be shared.

## What they return, and what they refuse

**`repr` hides the type.** `UserDict.__repr__` and `UserList.__repr__` are `repr(self.data)` — a log line shows `{'region': 'eu'}` or `[1, 2, 3]`, indistinguishable from a `dict` or a `list`, while `isinstance(x, dict)` and `json.dumps(x)` fail ([01](01-nine-types-three-families.md)). When debugging, log `type(x).__name__` alongside.

**`UserList` compares with lists.** `__eq__`, `__lt__` and friends compare `self.data` to `other.data` or to `other` itself, so `UserList([1]) == [1]` is `True`; `__hash__` is `None` because `__eq__` is defined.

**`UserList + anything`.** `__add__` accepts any iterable — `self.__class__(self.data + list(other))` — so `UserList([1]) + (2, 3)` works where `[1] + (2, 3)` raises `TypeError`; `__radd__` makes `[0] + UserList([1])` a `UserList`.

**The constructor copies.** `UserList(existing)` sets `self.data[:] = initlist` for a real list, so the wrapper does not alias the caller's list; assigning `ul.data = existing` does.

**Slices come back wrapped** — `UserList.__getitem__` returns `self.__class__(self.data[i])` for a slice ([10b](../05-slicing/10b-integer-keys-and-return-types.md)).

## Gotchas

**★ Symptom: a `UserList` subclass that validates in `__setitem__` still ends up holding invalid items.** Cause: `append`, `insert`, `extend`, `+=` and the constructor all write `self.data` directly in `UserList`. Fix: override every entry point, or build on `MutableSequence` so the mixins route through `insert` and `__setitem__`.

```python
def append(self, value: int) -> None:
    self.data.append(self._check(value))
```

**★ Symptom: keys merged with `settings |= overrides` are not normalised (or not audited), though `settings.update(overrides)` is.** Cause: `UserDict.__ior__` is `self.data |= other`. Fix: route it through `update`.

```python
def __ior__(self, other):
    self.update(other)
    return self
```

**★ Symptom: a copied `AuditedDict` writes its events into the original's audit log.** Cause: `__copy__` (used by `copy.copy` and, via `copy()`, for subclasses) copies `__dict__` shallowly, so both objects hold the same list. Fix: give the copy its own attributes.

```python
def __copy__(self):
    clone = type(self)(audit=[])
    clone.data = self.data.copy()
    return clone
```

**Symptom: `d.copy()` on a subclass fires `__setitem__` side effects once per key, while `copy.copy(d)` does not.** Cause: `UserDict.copy()` for subclasses copies with empty storage and then calls `update`; `copy.copy` goes to `__copy__`, which copies `.data` directly. Fix: pick one behaviour and implement `copy` in terms of it.

```python
def copy(self):
    return self.__copy__()
```

**Symptom: a log shows `[1, 2, 3]` and the code downstream says the object "is not a list".** Cause: `UserList.__repr__` is `repr(self.data)`. Fix: log the type too.

```python
logger.debug("items=%r (%s)", items, type(items).__name__)
```

**Symptom: `TypeError` about constructor arguments from `batch[1:]`, `batch + more`, `batch * 2` or `batch.copy()` on a `UserList` subclass.** Cause: all of them call `self.__class__(one_argument)`; the documented requirement is a constructor callable with zero or one argument. Fix: make extra constructor arguments keyword-only with defaults, or override those methods.

```python
class Batch(UserList):
    def __init__(self, initlist=None, *, batch_id: str = "") -> None:
        super().__init__(initlist)
        self.batch_id = batch_id
```

**Symptom: a list wrapped as `UserList(rows)` no longer reflects later changes to `rows`.** Cause: the constructor copies — *"initially set to a copy of *list*"*. Fix: if you want to wrap in place, assign `.data`.

```python
view = UserList()
view.data = rows            # now aliases rows
```

## Interview questions

**★ Does overriding `__setitem__` on a `UserList` subclass intercept `append`?**
No. `UserList.append` is `self.data.append(item)`, and likewise `insert`, `extend`, `+=`, `pop`, `remove`, `sort` and the constructor act on `self.data` directly. Only `ul[i] = x` and `ul[i:j] = xs` reach `__setitem__`. This differs from `UserDict`, whose `update` and `setdefault` come from `MutableMapping` and are written as `self[key] = value`. To intercept every write on a list-like class, either override all of `UserList`'s write methods or subclass `collections.abc.MutableSequence`, whose `append`, `extend` and `__iadd__` mixins route through your `insert`.

**★ `UserList`, a `list` subclass, or `MutableSequence` — how do you choose?**
A `list` subclass when you only add methods and read through the normal API — it is a real `list` and runs at C speed, but none of its C methods calls your overrides. `UserList` when you want the full list API with storage you can reach (`.data`) and are willing to override every write path you care about; it is not a `list` for `isinstance` or `json`. `MutableSequence` when one validation point must cover every write — five methods, and the mixins funnel the rest — at the cost of Python-level loops and no `sort` or `+`.

**Which `UserDict` operations bypass an overridden `__setitem__`?**
In CPython 3.14, `|=` (`self.data |= other`) and `copy.copy()` (the `__copy__` method copies `.data` directly). Everything built on `MutableMapping.update` — the constructor, `update`, `setdefault` — goes through `__setitem__`, as does `|`, which constructs a new instance. `UserDict.copy()` on a subclass goes through `update`, so it calls `__setitem__` for every key. Override `__ior__` if `|=` must be funnelled.

**Why does the documentation require `UserList` subclasses to accept a single constructor argument?**
Because every operation that returns a new sequence builds it with `self.__class__(data)`: slicing, `+`, `*`, `copy()`. The documentation says *"it assumes that the constructor can be called with a single parameter, which is a sequence object used as a data source"*, and that a class that does not comply must override *"all of the special methods supported by this class"*. Keyword-only extra parameters with defaults keep the one-argument call working.

**Why is `UserList([1, 2]) == [1, 2]` true while `deque([1, 2]) == [1, 2]` is false?**
`UserList.__eq__` compares `self.data` with `other.data` if `other` is a `UserList`, otherwise with `other` directly, so list equality decides. `deque`'s rich comparison returns `NotImplemented` unless both operands are deques, and the fallback identity comparison is `False`. Two list-like types, two different equality contracts — which is why tests should compare `list(x)` with the expected list.

---

← Prev: [07b · `OrderedDict` as an LRU cache](07b-ordereddict-lru-caches.md) · [Topic index](README.md) · Next → [08b · `UserString`](08b-userstring.md)
