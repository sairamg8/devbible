---
title: "Some objects come back from a copy as themselves — the atomic sets, a tuple of immutables, enum members, Decimal, compiled patterns, loggers — and the two functions disagree about which, so 'was it copied?' must be asked per function and per type, never inferred from immutability"
sidebar_label: "01b · Atomic types and identity"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** against [`Lib/copy.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py), [`Lib/enum.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/enum.py), [`Lib/fractions.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/fractions.py), [`Modules/_decimal/_decimal.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_decimal/_decimal.c), [`Lib/logging/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/logging/__init__.py), [`Objects/setobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/setobject.c) and the [`copy` documentation](https://docs.python.org/3.14/library/copy.html). Documentation- and source-validated — **no sandbox run**; results in code are `assert` statements derived from the source, not observed output.

**Sharing an object instead of copying it is safe exactly when nobody can tell, and the `copy` module decides that type by type, not by asking whether the type is immutable. `int`, `str`, functions, classes and `weakref.ref` come back untouched from both functions; a `tuple` and a `frozenset` come back untouched from `copy.copy` but not necessarily from `copy.deepcopy`; enum members, `Decimal`, `Fraction`, compiled patterns and loggers return themselves because their own code says so; and a plain `object()` — the classic sentinel — is not on any list, so a deep copy hands you a different one and every `is MISSING` check downstream quietly fails.**

## The two atomic sets

`copy.copy` and `copy.deepcopy` each begin with a set of types returned as-is. They are not the same set (verbatim from `Lib/copy.py`):

```python
_copy_atomic_types = {types.NoneType, int, float, bool, complex, str, tuple,
          bytes, frozenset, type, range, slice, property,
          types.BuiltinFunctionType, types.EllipsisType,
          types.NotImplementedType, types.FunctionType, types.CodeType,
          weakref.ref, super}

_atomic_types =  {types.NoneType, types.EllipsisType, types.NotImplementedType,
          int, float, bool, complex, bytes, str, types.CodeType, type, range,
          types.BuiltinFunctionType, types.FunctionType, weakref.ref, property}
```

The difference is four types — `tuple`, `frozenset`, `slice` and `super` are atomic for `copy.copy` only. That is not an oversight: a shallow copy of a tuple has nothing to do, but a deep copy must look inside, because the elements might be mutable. Both lookups are on the exact type, as in [01](01-what-copy-copy-decides.md); a `NoneType` or `int` subclass is not atomic.

## Identity is decided per type

Immutability does not put a type on the list. A frozen dataclass is immutable and is rebuilt; a named tuple is immutable and is rebuilt; `object()` has no state at all and is rebuilt. What is verified in the 3.14.7 source:

| Value | `copy.copy` returns the same object | `copy.deepcopy` returns the same object | Where that comes from |
|---|---|---|---|
| `int`, `float`, `bool`, `complex`, `str`, `bytes`, `None`, `Ellipsis`, `NotImplemented` | yes | yes | both atomic sets |
| functions, lambdas, builtin functions, code objects | yes | yes | both atomic sets |
| classes | yes | yes | `type` is atomic; `issubclass(cls, type)` covers metaclasses |
| `range`, `property`, `weakref.ref` | yes | yes | both atomic sets |
| exact `tuple` | yes | only if every element copies to itself | atomic for `copy`; `_deepcopy_tuple` |
| exact `frozenset` | yes | no — it is rebuilt | atomic for `copy` only |
| enum member | yes | yes | `Enum.__copy__` and `__deepcopy__` return `self` |
| `Decimal` (the C `_decimal` module) | yes | yes | `dec_copy` registered for both hooks |
| `Fraction` (exact type) | yes | yes | `__copy__`, `__deepcopy__` |
| `re.Pattern`, `re.Match` | yes | yes | `__copy__`, `__deepcopy__` return `self` |
| `logging.Logger` | yes | yes | `__reduce__` returns `getLogger, (name,)` |
| named tuple, frozen dataclass instance | **no** | **no** | reduce route |
| `object()` | **no** | **no** | reduce route: `object.__new__` |

`frozenset.copy()` is a separate fact: `frozenset_copy_impl` in `setobject.c` begins `if (PyFrozenSet_CheckExact(so)) { return Py_NewRef(so); }`, so the *method* also returns the same object for an exact frozenset, while `set.copy()` always builds a new set — and builds a plain `set` even for a subclass.

## Deep-copying a tuple

`_deepcopy_tuple`, verbatim:

```python
def _deepcopy_tuple(x, memo, deepcopy=deepcopy):
    y = [deepcopy(a, memo) for a in x]
    # We're not going to put the tuple in the memo, but it's still important we
    # check for it, in case the tuple contains recursive mutable structures.
    try:
        return memo[id(x)]
    except KeyError:
        pass
    for k, j in zip(x, y):
        if k is not j:
            y = tuple(y)
            break
    else:
        y = x
    return y
```

It copies every element, and returns the original tuple if every copy *is* its original. So the answer to "does `deepcopy` copy a tuple?" is "only if something inside needed copying":

```python
import copy

flat = (1, "two", 3.0, None)
assert copy.deepcopy(flat) is flat            # every element is atomic

nested = ((1, 2), "a")
assert copy.deepcopy(nested) is nested        # the inner tuple copies to itself too

holder = (1, [2, 3])
duplicate = copy.deepcopy(holder)
assert duplicate is not holder                # the list changed, so a new tuple is built
assert duplicate[1] == holder[1]
assert duplicate[1] is not holder[1]
```

The `memo[id(x)]` check in the middle is for cycles that run *through* a tuple; it is traced in a later chunk.

## Types that decide for themselves

**Enum members.** `Lib/enum.py`, inside `class Enum`:

```python
    def __reduce_ex__(self, proto):
        return self.__class__, (self._value_, )

    def __deepcopy__(self,memo):
        return self

    def __copy__(self):
        return self
```

`IntEnum`, `StrEnum` and `Flag` inherit them. A member inside a deep-copied structure is therefore the same member, which is what makes `if record["status"] is Status.ACTIVE` survive a copy. (Phase 1 left this unconfirmed; the source settles it.)

```python
import copy
import enum


class Status(enum.Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


record = {"status": Status.ACTIVE, "tags": ["a"]}
clone = copy.deepcopy(record)

assert clone["status"] is Status.ACTIVE
assert clone["tags"] is not record["tags"]
```

**`Decimal`.** The C module registers `dec_copy` — `return Py_NewRef(self);` — as both `__copy__` and `__deepcopy__` (`{ "__copy__", dec_copy, METH_NOARGS, NULL }`, `{ "__deepcopy__", dec_copy, METH_O, NULL }`). The pure-Python fallback `_pydecimal.py` is more careful: `if type(self) is Decimal: return self`, otherwise `return self.__class__(str(self))`. Which one runs depends on whether `_decimal` was built into the interpreter.

**`Fraction`.** Always pure Python: `if type(self) == Fraction: return self  # I'm immutable; therefore I am my own clone` and, for a subclass, `return self.__class__(self._numerator, self._denominator)`.

**Compiled regular expressions.** `_sre_SRE_Pattern___copy___impl` and its `__deepcopy__` sibling are each `return Py_NewRef(self);`, and so are the `Match` object's.

**Loggers.** `Logger.__reduce__` returns `getLogger, (self.name,)` (`RootLogger` returns `getLogger, ()`), so `_reconstruct` calls `getLogger(name)` and gets the registered logger back. A logger held by a deep-copied object is the same logger, not a copy.

## The sentinel that is not

`object()` is on no list. It has no `__copy__`, no `copyreg` entry, and `object.__reduce_ex__(4)` gives `_reconstruct` a callable that builds a new `object()`. A sentinel stored inside anything you deep-copy is replaced by a different sentinel:

```python
import copy

MISSING = object()


def read(settings, key):
    value = settings.get(key, MISSING)
    if value is MISSING:
        return None
    return value


settings = {"timeout": MISSING}
clone = copy.deepcopy(settings)

assert settings["timeout"] is MISSING
assert clone["timeout"] is not MISSING      # a fresh object() built by the reduce route
```

Two fixes, both making the copy return the sentinel itself. The enum route is the least code and survives copy and pickle by construction:

```python
import enum


class _Sentinel(enum.Enum):
    MISSING = enum.auto()


MISSING = _Sentinel.MISSING
```

A hand-written sentinel class needs the two hooks:

```python
class _Missing:
    __slots__ = ()

    def __copy__(self):
        return self

    def __deepcopy__(self, memo):
        return self

    def __repr__(self):
        return "MISSING"


MISSING = _Missing()
```

## `weakref.ref` is atomic, so a weak back-pointer keeps pointing at the original

`weakref.ref` is in both sets. A node that remembers its parent weakly, deep-copied as part of a tree, keeps the *same reference object* — which still points at the original parent:

```python
import copy
import weakref


class Node:
    def __init__(self, name, parent=None):
        self.name = name
        self.children = []
        self._parent = weakref.ref(parent) if parent is not None else None
        if parent is not None:
            parent.children.append(self)

    @property
    def parent(self):
        return self._parent() if self._parent is not None else None


root = Node("root")
Node("leaf", root)

tree = copy.deepcopy(root)
assert tree.children[0].parent is root            # still the ORIGINAL root
assert tree.children[0].parent is not tree
```

The copy has to re-link explicitly. `__deepcopy__` registers the new node in the memo, copies the children through the memo, and points each child's weak reference at the new parent:

```python
    def __deepcopy__(self, memo):
        clone = Node(self.name)
        memo[id(self)] = clone
        for child in self.children:
            child_clone = copy.deepcopy(child, memo)
            child_clone._parent = weakref.ref(clone)
            clone.children.append(child_clone)
        return clone
```

Copying a *subtree* this way yields a detached tree whose root has no parent — say so in the class's documentation.

## Gotchas

**★ Symptom: after a deep copy, `if value is MISSING` is false for a value that was `MISSING` before.** Cause: `object()` sentinels are rebuilt by the reduce route; only atomic types and types with self-returning hooks survive. Fix: make the sentinel an enum member or give its class `__copy__` and `__deepcopy__` returning `self`, as above.

**★ Symptom: a deep-copied tree's children report the original tree as their parent.** Cause: `weakref.ref` is atomic in both functions, so the same reference object — and its referent — is carried over. Fix: `__deepcopy__` that re-links, or store the parent as a plain attribute set after the copy.

**★ Symptom: code assumes `deepcopy(t) is t` for a tuple and gets a new tuple, or assumes it gets a new tuple and gets the same one.** Cause: `_deepcopy_tuple` returns the original exactly when every element copied to itself. Fix: test for what you need — never for identity — and copy the mutable members you care about explicitly.

```python
def has_shared_mutables(pair):
    return any(isinstance(item, (list, dict, set)) for item in pair)
```

**Symptom: `copy.copy(named_tuple_instance) is named_tuple_instance` is false, unlike for a plain tuple.** Cause: atomic membership is by exact type; a named tuple's type is not `tuple`, so it goes through `__reduce_ex__(4)` and `__getnewargs__` (its docstring: *"Return self as a plain tuple.  Used by copy and pickle."*), which builds a new instance. Fix: nothing to fix — compare with `==`, not `is`.

**Symptom: a `Fraction` subclass loses an attribute or fails with a `TypeError` when copied.** Cause: for anything but the exact type, `Fraction.__copy__` and `__deepcopy__` call `self.__class__(self._numerator, self._denominator)`, which neither restores extra attributes nor works for a constructor with another signature. Fix: override both hooks on the subclass.

```python
from fractions import Fraction


class Ratio(Fraction):
    def __new__(cls, numerator, denominator=1, label=""):
        obj = super().__new__(cls, numerator, denominator)
        obj.label = label
        return obj

    def __copy__(self):
        return Ratio(self.numerator, self.denominator, self.label)

    def __deepcopy__(self, memo):
        return Ratio(self.numerator, self.denominator, self.label)
```

## Interview questions

**★ Which objects does `copy.copy` return unchanged, and why is that safe?**
Any object whose exact type is in `_copy_atomic_types` — `None`, numbers, `str`, `bytes`, `tuple`, `frozenset`, functions, classes, `range`, `slice`, `property`, `weakref.ref` and a few more — plus anything whose class hook returns `self`. It is safe when the object cannot change, because sharing an unchangeable object is unobservable. It is only "safe" for a tuple in the shallow sense: the tuple is shared, and so is whatever mutable object it holds.

**★ Does `copy.deepcopy` of a tuple return the same tuple?**
Only if nothing inside needed copying. `_deepcopy_tuple` deep-copies each element and returns the original tuple when every element copy is its own original. A tuple of numbers, strings and inner tuples of the same is shared; a tuple containing a list is rebuilt around a copy of the list.

**★ Why does deep-copying a config that contains an `object()` sentinel break `is` checks, and how do you make a sentinel copy-proof?**
`object()` has no copy hook and is on neither atomic list, so the reduce route builds a new `object()` for the copy. Make the sentinel an enum member — `Enum.__copy__` and `__deepcopy__` return `self` — or give its class both hooks returning `self`.

**Why are `tuple` and `frozenset` atomic for `copy.copy` but not for `copy.deepcopy`?**
A shallow copy of an immutable container has nothing to duplicate, so returning it is exact. A deep copy must copy the elements, which might be mutable, so it cannot decide without looking inside; the tuple case then returns the original when it can.

**Which standard-library types return themselves from a copy, and by what mechanism?**
Enum members define `__copy__` and `__deepcopy__` returning `self`; `Decimal` (C implementation) registers `dec_copy` for both; `Fraction` returns `self` for its exact type; compiled patterns and match objects return `self`; loggers reduce to `getLogger(name)`, which returns the registered logger. Functions, classes and `weakref.ref` are in the atomic sets.

**Is an immutable object always shared by a copy?**
No. A frozen dataclass, a named tuple and a `frozenset` subclass are immutable and are rebuilt by the reduce route, because the atomic sets and hooks are by type, not by mutability. Never write code that depends on `copy(x) is x`; compare with `==`.

---

← [01 · What copy.copy decides](01-what-copy-copy-decides.md) · [Topic index](README.md)
