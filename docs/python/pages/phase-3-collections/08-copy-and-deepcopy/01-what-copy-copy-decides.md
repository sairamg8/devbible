---
title: "copy.copy makes one decision per call — return the object, call a builtin's copy method, call a class hook, or rebuild from a reduce value — and every branch is chosen by the object's exact type, so a subclass of list is never treated as a list"
sidebar_label: "01 · What copy.copy decides"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** against the [`copy` documentation](https://docs.python.org/3.14/library/copy.html), the [Programming FAQ — "How do I copy an object in Python?"](https://docs.python.org/3.14/faq/programming.html#how-do-i-copy-an-object-in-python) and the source of [`Lib/copy.py` at v3.14.7](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py). Documentation- and source-validated — **no sandbox run**; every "what happens" below is a reading of the code, not an observed result.

**`copy.copy` is about forty lines of Python, and there is no magic in it: it looks at `type(x)` and walks five checks in a fixed order — is the type in the "atomic" set, is it exactly `list`, `dict`, `set` or `bytearray`, is it a class, does the class define `__copy__`, and otherwise what does the pickle protocol's reduce value say. The first check that matches decides everything. Two facts follow that are the source of most surprises: the tables are keyed by `type(x)` *exactly* (a subclass of `list` misses the list branch), and `__copy__` is looked up on the class, not on the instance. Read the function once and every "why did `copy` do that" has an answer.**

## The whole function

`Lib/copy.py` at v3.14.7, verbatim:

```python
def copy(x):
    cls = type(x)

    if cls in _copy_atomic_types:
        return x
    if cls in _copy_builtin_containers:
        return cls.copy(x)


    if issubclass(cls, type):
        # treat it as a regular class:
        return x

    copier = getattr(cls, "__copy__", None)
    if copier is not None:
        return copier(x)

    reductor = dispatch_table.get(cls)
    if reductor is not None:
        rv = reductor(x)
    else:
        reductor = getattr(x, "__reduce_ex__", None)
        if reductor is not None:
            rv = reductor(4)
        else:
            reductor = getattr(x, "__reduce__", None)
            if reductor:
                rv = reductor()
            else:
                raise Error("un(shallow)copyable object of type %s" % cls)

    if isinstance(rv, str):
        return x
    return _reconstruct(x, None, *rv)


_copy_atomic_types = {types.NoneType, int, float, bool, complex, str, tuple,
          bytes, frozenset, type, range, slice, property,
          types.BuiltinFunctionType, types.EllipsisType,
          types.NotImplementedType, types.FunctionType, types.CodeType,
          weakref.ref, super}
_copy_builtin_containers = {list, dict, set, bytearray}
```

The module imports only `types`, `weakref` and `copyreg.dispatch_table`. It is pure Python: there is no C accelerator behind `copy.copy` or `copy.deepcopy` in 3.14.7.

## The five routes

| # | Route | It is taken when | You get | Shared with the original |
|---|---|---|---|---|
| 1 | **atomic** | `type(x)` is *exactly* in `_copy_atomic_types` | `x` itself | everything — it is the same object |
| 2 | **builtin container** | `type(x)` is *exactly* `list`, `dict`, `set` or `bytearray` | `cls.copy(x)` — the type's own `copy` method | the elements |
| 3 | **class** | `type(x)` is `type` or a metaclass | `x` itself | everything |
| 4 | **class hook** | the *class* has an attribute `__copy__` | whatever `__copy__(x)` returns | whatever the hook chooses |
| 5 | **reduce** | none of the above | a new object built by `_reconstruct` from the reduce value | the values inside the object's state |

Route 5 has a sub-order of its own: a function registered in `copyreg.dispatch_table` for the exact type wins, then `x.__reduce_ex__(4)`, then `x.__reduce__()`. A reduce value that is a plain string means "this object is a global; the copy is the object" and returns `x`. The next two chunks of this topic read routes 5 and its `_reconstruct` in full; this chunk is about how you *arrive* there.

Where common types land, from the tables above and the C source read for this topic:

- **Route 1:** `int`, `float`, `bool`, `complex`, `str`, `bytes`, `None`, `tuple`, `frozenset`, `range`, `slice`, functions, builtin functions, `weakref.ref`, `property`, `type`.
- **Route 2:** exactly `list`, `dict`, `set`, `bytearray`.
- **Route 4:** `defaultdict`, `deque`, `ChainMap`, `UserDict`, `array.array`, enum members, `Decimal`, `Fraction`, compiled regular expressions.
- **Route 5:** instances of your own classes, dataclasses, named tuples, `Counter`, `OrderedDict`, and every subclass of `list`, `dict` or `set`.

## Exact type, not `isinstance`

`cls in _copy_builtin_containers` is a set-membership test on the type object, so it is true only when the type *is* `list`. A subclass is a different type object and falls through to the later routes:

```python
import copy


class History(list):
    """A list that carries a label."""


history = History(["login", "search", "checkout"])
history.label = "session-42"

plain = history.copy()
kept = copy.copy(history)

assert type(plain) is list           # list.copy builds a plain list
assert type(kept) is History         # copy.copy took the reduce route
assert kept.label == "session-42"    # the instance __dict__ came along
assert not hasattr(plain, "label")
```

The documentation states the same asymmetry:

> *"Shallow copies of many collections can be made using the corresponding copy() method (such as list.copy(), dict.copy() or set.copy()), and of sequences (such as lists or bytearrays) by making a slice of the entire sequence (sequence[:]). However, these methods and slicing can create an instance of the base type when copying an instance of a subclass, whereas copy.copy() normally returns an instance of the same type."*

So the spelling matters when the value might be a subclass: `history.copy()`, `list(history)`, `history[:]` and `[*history]` all discard `History`; `copy.copy(history)` keeps it. The other siblings own each spelling in detail — [list copies](../01-list-internals/10-copies-and-aliasing.md), [dict copies](../03-dict/06-building-a-dict.md), [slices](../05-slicing/05-slices-are-copies.md) — this topic owns only what `copy.copy` does.

## `__copy__` is read from the class

`copier = getattr(cls, "__copy__", None)` looks on the *class*, then calls `copier(x)` with the instance as the argument. An attribute assigned to one instance is invisible to it:

```python
import copy


class Sensor:
    def __init__(self, name):
        self.name = name


s = Sensor("boiler-1")
s.__copy__ = lambda: "never called by copy.copy"

clone = copy.copy(s)
assert isinstance(clone, Sensor)       # the reduce route ran; the lambda did not
```

`deepcopy` is the other way round — it does `getattr(x, "__deepcopy__", None)` on the *instance*, so an instance attribute there is honoured, and so is anything an object's `__getattr__` chooses to answer. The asymmetry is in the source, and the later chunk on hooks depends on it.

## What the reduce route shares

For an ordinary class the reduce value carries a state dictionary, and a shallow copy copies the dictionary's *entries* into the new object — not what the entries point at:

```python
import copy


class Order:
    def __init__(self, order_id, lines):
        self.order_id = order_id
        self.lines = lines


original = Order("A-1", ["pen", "ink"])
clone = copy.copy(original)

assert clone is not original
assert clone.lines is original.lines        # one list, two owners
clone.lines.append("blotter")
assert original.lines == ["pen", "ink", "blotter"]
```

`__init__` did not run for `clone`. That is also route 5, and the reason is the subject of the chunk on `_reconstruct`.

## The two ways `copy.copy` gives you the same object

Routes 1 and 3 return `x`, and route 5 can too (the reduce value is a string, or a hook returns `self`). Code that assumes `copy.copy(x) is not x` breaks on all of them, and it is *correct* for an immutable object because nothing can tell the difference — see [phase 1 on shallow copies](../../phase-1-language-core/07-assignment-and-aliasing/08-shallow-copy.md). The case that is actually dangerous is a tuple whose *elements* are mutable: route 1 returns the tuple unchanged, so the "copy" shares every list inside it.

```python
import copy

row = ("ada", ["admin", "billing"])
same = copy.copy(row)

assert same is row
same[1].append("root")                # mutates the list both names see
assert row[1] == ["admin", "billing", "root"]
```

## `copy.Error` and what really fails

The function ends in `raise Error("un(shallow)copyable object of type %s" % cls)`, and `copy.error` is a backward-compatible alias. To reach that line an object must have neither `__reduce_ex__` nor `__reduce__`, and every object inherits both from `object`. What you meet in practice is a `TypeError` raised *inside* `object.__reduce_ex__` — for a lock, a file, a generator — which no `except copy.Error` will catch. The messages are collected in the chunk on what cannot be copied.

## Gotchas

**★ Symptom: a copy of a `list` subclass keeps its type with `copy.copy` and loses it with `.copy()`, `list()` or `[:]`.** Cause: routes are chosen by exact type — `type(x)` is `list` for the builtin container branch, while a subclass goes through the reduce route that rebuilds `type(x)`; the methods and slices build a plain `list` (a documented difference). Fix: pick the spelling on purpose, and if the type must survive, use `copy.copy` or write `__copy__`.

```python
import copy

def snapshot(rows):
    return copy.copy(rows)      # keeps whatever subclass the caller passed
```

**★ Symptom: `obj.__copy__ = some_function` has no effect on `copy.copy(obj)`.** Cause: `copy.copy` calls `getattr(type(obj), "__copy__", None)`, so only the class counts. Fix: define the method in the class body; assigning it to an instance changes only `deepcopy`'s lookup for `__deepcopy__`, not `copy`'s for `__copy__`.

```python
class Sensor:
    def __init__(self, name):
        self.name = name

    def __copy__(self):
        return type(self)(self.name)
```

**★ Symptom: a "copy" of a tuple of lists still changes the original.** Cause: `tuple` is in the atomic set, so `copy.copy` returns the same tuple object. Fix: copy the mutable members, or use `deepcopy` if the structure is irregular.

```python
row = ("ada", ["admin", "billing"])
safe = (row[0], list(row[1]))
```

**Symptom: `except copy.Error` never fires when a copy of a lock-holding object fails.** Cause: the failure is a `TypeError` from `object.__reduce_ex__`; `copy.Error` is raised only when an object has no reduce hooks at all. Fix: catch `TypeError`, or better, keep uncopyable resources out of the graph.

```python
import copy

def try_copy(value):
    try:
        return copy.deepcopy(value)
    except TypeError as exc:
        raise ValueError(f"cannot snapshot {type(value).__name__}") from exc
```

**Symptom: `copy.copy(SomeClass)` returns `SomeClass`, and class-level state is still shared.** Cause: route 3 treats any class (any instance of `type`) as atomic. Fix: copy the instances, and give per-object state to `__init__` rather than the class body.

```python
class Registry:
    def __init__(self):
        self.handlers = {}       # per instance, so copy.copy(registry) can isolate it
```

## Interview questions

**★ In what order does `copy.copy` look for a way to copy an object?**
It takes `cls = type(x)` and checks, in order: is `cls` in the atomic set (return `x`), is `cls` exactly `list`/`dict`/`set`/`bytearray` (call `cls.copy(x)`), is `cls` a subclass of `type` (return `x`), does the class have `__copy__` (call it), then the `copyreg.dispatch_table` entry for the exact type, then `x.__reduce_ex__(4)`, then `x.__reduce__()`. The first branch that applies decides; a string reduce value returns `x`, and anything else goes to `_reconstruct` with no memo.

**★ Why does `copy.copy` of a `list` subclass keep the subclass while `.copy()` returns a plain `list`?**
Because `copy.copy` only takes the "call the type's `copy` method" shortcut when the type is exactly `list`. A subclass is a different type object, so it falls through to the reduce route, which rebuilds `type(x)`. `list.copy()`, slicing, `list(x)` and unpacking all build a `list` regardless of the input's class, which the `copy` documentation warns about explicitly.

**★ Why does `copy.copy((1, [2, 3]))` return the same tuple, and is that a bug?**
`tuple` is in `_copy_atomic_types`, so the function returns `x` untouched. For a tuple of immutable elements that is exactly right — nothing can distinguish a copy from the original. For a tuple that contains a list it means the shallow copy shares the list, which is what "shallow" promises: only the outer container is duplicated, and a tuple has no reason to be.

**Where does `copy.copy` look for `__copy__`, and where does `copy.deepcopy` look for `__deepcopy__`?**
`copy.copy` reads `__copy__` from the class with `getattr(cls, "__copy__", None)` and calls it with the instance; `copy.deepcopy` reads `__deepcopy__` from the instance with `getattr(x, "__deepcopy__", None)` and calls it with the memo. The practical consequence is that an instance-level `__copy__` is ignored, while an instance-level `__deepcopy__` — or a `__getattr__` that answers for it — is honoured.

**Why is `copy.copy` of a function or a class not a copy?**
Functions and builtin functions are in the atomic set, and any type that is a subclass of `type` is returned as-is by an explicit check, so the "copy" is the same object. The documentation describes this as returning the original unchanged, "compatible with the way these are treated by the pickle module".

**When would you see `copy.Error`?**
Almost never. It is raised only when an object has neither `__reduce_ex__` nor `__reduce__`, and `object` supplies both. The failures people actually meet are `TypeError`s raised by the default reduce machinery for objects such as locks and generators.

---

← [Topic index](README.md)
