---
title: "A list subclass that validates in __setitem__ is bypassed by append, insert, extend, += and its own constructor — and UserList does not close those paths, because it writes self.data directly too; only MutableSequence funnels every write through insert and __setitem__"
sidebar_label: "10e · Why a validating subclass leaks"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-21 for **Python 3.14.7** against CPython **v3.14.7** —
> [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py)
> (`class UserList`, lines 1230–1356),
> [`Lib/_collections_abc.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/_collections_abc.py)
> (`class MutableSequence`, lines 1104–1168) and
> [`Objects/listobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/listobject.c)
> (`list_append_impl`, `list_insert_impl`, `list_extend_impl`, `list___init___impl`) — implementation
> detail; and the 3.14 documentation for
> [`collections.UserList`](https://docs.python.org/3.14/library/collections.html#userlist-objects).
> Documentation-verified — **no sandbox run, no program output**.
> Split out of [10c](10c-setitem-delitem-and-the-abcs.md) on 2026-09-21. That page had said
> `collections.UserList` routes every write through methods you control; the `v3.14.7` source shows
> it does not, and this page carries the corrected account.

**Overriding `__setitem__` on a `list` subclass intercepts `obj[i] = x` and `obj[i:j] = xs`, and
nothing else: `append`, `insert`, `extend`, `+=` and the constructor are C functions that write the
array without looking up your override, so a validator that lives only in `__setitem__` is bypassed
by five other paths. The two standard escapes are not equivalent. `collections.abc.MutableSequence`
is a real funnel — its mixins are written against `insert`, so validating in `insert` and
`__setitem__` covers every write. `collections.UserList` is not — its methods are ordinary Python and
can be overridden, but in 3.14.7 each of them writes `self.data` directly, so it leaks through the
same five paths until you override every one of them. The slice-key rules and the delegating
`MutableSequence` class this page keeps referring to are in
[10c](10c-setitem-delitem-and-the-abcs.md).**

## Why a validating `list` subclass leaks

Overriding `__setitem__` on a `list` subclass intercepts `obj[i] = x` and `obj[i:j] = xs`, and
nothing else. CPython's list methods are C functions that write the array directly —
`list_append_impl` calls `_PyList_AppendTakeRef`, `list_insert_impl` goes through `ins1`,
`list_extend_impl` copies items in, and the constructor goes through `list___init___impl` — so none
of them looks up your override. A subclass that validates in `__setitem__` therefore accepts bad
data through `append`, `insert`, `extend`, `+=` and `MyList(bad_items)`. There is a second trap
inside `__setitem__` itself: for a slice key, `value` is an *iterable of items*, and a validator
written for one item either rejects every legitimate slice assignment or, worse, passes a list
object as "a valid item".

## `MutableSequence` funnels; `UserList` does not

The fix is not to find every method to override; it is to stop inheriting a C implementation that
does not call you. Of the two replacements on offer, only one is a funnel.

`MutableSequence` (the `Prices` class in [10c](10c-setitem-delitem-and-the-abcs.md)) is: its mixins
are written against `insert`, `__setitem__` and `__delitem__` (`append` is
`self.insert(len(self), value)`, `extend` loops over `append`, `__iadd__` calls `extend`), so
validating in `insert` and `__setitem__` covers every write.

`collections.UserList` is not. The documentation sells it as *"a useful base class for your own
list-like classes which can inherit from them and override existing methods or add new ones"* and
says nothing about its methods calling one another; the source shows that they do not. It is a
Python class, so every method can be overridden and your override will be called, but nothing calls
`__setitem__` on your behalf. In the `v3.14.7` source the constructor, `append`, `insert`, `extend`
and `+=` each write `self.data` directly; only `ul[i] = x` and `ul[i:j] = xs` reach `__setitem__`:

```python
# Lib/collections/__init__.py, v3.14.7 — class UserList (excerpt)
def __init__(self, initlist=None):
    self.data = []
    if initlist is not None:
        # XXX should this accept an arbitrary sequence?
        if type(initlist) == type(self.data):
            self.data[:] = initlist
        elif isinstance(initlist, UserList):
            self.data[:] = initlist.data[:]
        else:
            self.data = list(initlist)

def __setitem__(self, i, item):
    self.data[i] = item

def append(self, item):
    self.data.append(item)

def insert(self, i, item):
    self.data.insert(i, item)

def extend(self, other):
    if isinstance(other, UserList):
        self.data.extend(other.data)
    else:
        self.data.extend(other)

def __iadd__(self, other):
    if isinstance(other, UserList):
        self.data += other.data
    elif isinstance(other, type(self.data)):
        self.data += other
    else:
        self.data += list(other)
    return self
```

So a `UserList` subclass that validates only in `__setitem__` leaks through the same five paths as a
`list` subclass. The difference is that you can close them one by one from Python. The full table of
which `UserList` operations reach `__setitem__`, and a worked `UserList` subclass that overrides each
write path, is in [08 · UserList and UserDict](../06-collections-module/08-userlist-and-userdict.md).

## Gotchas

**★ Symptom: a `list` subclass that rejects negative prices in `__setitem__` still ends up holding
`-5`.** Cause: the value came in through `append`, `extend`, `insert`, `+=` or the constructor —
C methods that never call `__setitem__`. Fix: build on `MutableSequence`, whose `append`, `extend`
and `__iadd__` mixins call your `insert`, so `insert` and `__setitem__` cover every write.

```python
class Prices(MutableSequence):      # not: class Prices(list)
    def insert(self, index, value) -> None:
        self._data.insert(index, self._check(value))   # append, extend and += end up here
```

**★ Symptom: the subclass was moved from `list` to `UserList` to fix the bypass, and
`prices.append(-5)` still gets in.** Cause: `UserList` is a wrapper, not a funnel — in 3.14.7
`append` is `self.data.append(item)`, and `insert`, `extend`, `+=` and the constructor also write
`self.data` without calling `__setitem__`. Fix: override each of those write methods, or build on
`MutableSequence` instead ([08](../06-collections-module/08-userlist-and-userdict.md) has both).

```python
class Prices(UserList):
    def append(self, value) -> None:
        self.data.append(self._check(value))   # and the same for insert, extend, += and __init__
```

## Interview questions

**★ Why is subclassing `list` a poor way to build a validated list?**
Because overriding `__setitem__` only intercepts subscription writes. In CPython `append`,
`insert`, `extend`, `+=` and the constructor are C functions that write the underlying array without
calling any overridden Python method, so they bypass validation entirely — you would have to
override every one of them and keep up with any added later. Building on
`collections.abc.MutableSequence` routes `append`, `extend` and `+=` through your `insert` and slice
and index writes through your `__setitem__`, so those two methods cover every write.
`collections.UserList` does not do that: it is a Python class, so you can override its methods, but
in 3.14.7 its constructor, `append`, `insert`, `extend` and `+=` each write `self.data` directly and
never call `__setitem__`. You would still override every write path yourself.

---

← Prev: [10d · Typing and multi-dimensional keys](10d-typing-and-multidimensional-keys.md) · [Topic index](README.md) · Next → [11 · Slicing in real code: pagination](11-slicing-in-real-code.md)
