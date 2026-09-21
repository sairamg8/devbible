---
title: "A __slots__ class has no __dict__ to copy, so copy asks for a (dict, slots) pair, finds the slot names by walking the MRO, and restores each value with setattr — which is why unset slots stay unset, mangled names work, and a __getstate__ that returns a plain dict breaks the class"
sidebar_label: "06 · __slots__ classes"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** against the [`pickle` documentation on `__getstate__`](https://docs.python.org/3.14/library/pickle.html#pickling-class-instances), the [data model notes on `__slots__`](https://docs.python.org/3.14/reference/datamodel.html#slots), and the source at v3.14.7 of [`Lib/copyreg.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/copyreg.py) (`_slotnames`), [`Objects/typeobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/typeobject.c) (`object_getstate_default`) and [`Lib/copy.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py). Documentation- and source-validated — **no sandbox run**.

**A class with `__slots__` stores its attributes in fixed slots, not in an instance dictionary, and the copy machinery was written for the dictionary. The bridge is the default `__getstate__` (since 3.11 on `object`), which builds a pair — the instance dict, or `None` if there is none, and a dictionary of the slot values that are actually set — and `_reconstruct`, which unpacks any two-item tuple as that pair and applies the slot half with `setattr`. Everything distinctive about copying a slotted class follows from those two facts: an unset slot stays unset, slots from every class in the MRO are found, a slot that a `__setattr__` guard forbids cannot be restored, and a `__getstate__` returning a plain dict fails because there is no `__dict__` to update.**

## The default state

The pickle documentation lists the four shapes of the default `__getstate__`:

> *"For a class that has no instance `__dict__` and no `__slots__`, the default state is `None`."*
> *"For a class that has an instance `__dict__` and no `__slots__`, the default state is `self.__dict__`."*
> *"For a class that has an instance `__dict__` and `__slots__`, the default state is a tuple consisting of two dictionaries: `self.__dict__`, and a dictionary mapping slot names to slot values. Only slots that have a value are included in the latter."*
> *"For a class that has `__slots__` and no instance `__dict__`, the default state is a tuple whose first item is `None` and whose second item is a dictionary mapping slot names to slot values described in the previous bullet."*

The C implementation (`object_getstate_default`) follows it: it takes the slot names from `copyreg._slotnames(cls)`, reads each with `getattr`, skips any that raise `AttributeError` (*"It is not an error if the attribute is not present."*), and packs `(state, slots)` if there is at least one value. Then `_reconstruct` does the other half:

```python
            if isinstance(state, tuple) and len(state) == 2:
                state, slotstate = state
            else:
                slotstate = None
            if state is not None:
                y.__dict__.update(state)
            if slotstate is not None:
                for key, value in slotstate.items():
                    setattr(y, key, value)
```

## How the slot names are found

`copyreg._slotnames` walks the class's MRO and collects the `__slots__` of every class, so slots declared in a base class are included even though `cls.__slots__` shows only the last. From the v3.14.7 source:

```python
    names = []
    if not hasattr(cls, "__slots__"):
        # This class has no slots
        pass
    else:
        # Slots found -- gather slot names from all base classes
        for c in cls.__mro__:
            if "__slots__" in c.__dict__:
                slots = c.__dict__['__slots__']
                # if class has a single slot, it can be given as a string
                if isinstance(slots, str):
                    slots = (slots,)
                for name in slots:
                    # special descriptors
                    if name in ("__dict__", "__weakref__"):
                        continue
                    # mangled names
                    elif name.startswith('__') and not name.endswith('__'):
                        stripped = c.__name__.lstrip('_')
                        if stripped:
                            names.append('_%s%s' % (stripped, name))
                        else:
                            names.append(name)
                    else:
                        names.append(name)
```

Three details are visible. A single string is a legal `__slots__`. `__dict__` and `__weakref__` are skipped — they are not values to copy; the copy gets its own. And a private name such as `__balance` is stored as `_Account__balance`, which the function reproduces. The result is cached in `cls.__slotnames__`, wrapped in a bare `try/except` so a class that refuses the assignment still works. The side effect is real: **the first copy or pickle of any class that uses the default state creates a `__slotnames__` attribute on that class — an empty list when it has no slots.**

## What works without any code

```python
import copy


class Point:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        self.x = x
        self.y = y


p = Point(1, 2)
q = copy.copy(p)

assert q is not p
assert (q.x, q.y) == (1, 2)
```

The state was `(None, {"x": 1, "y": 2})`; `_reconstruct` skipped the dict half and called `setattr` for each slot. Inheritance and private names need nothing either:

```python
import copy


class Account:
    __slots__ = ("__balance",)

    def __init__(self, balance):
        self.__balance = balance

    def balance(self):
        return self.__balance


class Savings(Account):
    __slots__ = ("rate",)

    def __init__(self, balance, rate):
        super().__init__(balance)
        self.rate = rate


s = Savings(100, 0.02)
t = copy.deepcopy(s)

assert (t.balance(), t.rate) == (100, 0.02)
```

`_slotnames(Savings)` returns `rate` from `Savings` and `_Account__balance` from `Account`.

## Unset slots stay unset

A slot with no value is not in the state, so the copy does not have it either:

```python
import copy


class Node:
    __slots__ = ("value", "next")

    def __init__(self, value):
        self.value = value                   # `next` is never assigned


node = Node(3)
clone = copy.copy(node)

assert not hasattr(clone, "next")
assert clone.value == 3
```

This is faithful, not lossy: the original has no `next` either.

## A subclass without `__slots__` has both

A subclass that does not declare `__slots__` gets a `__dict__` again — the data model notes say so: *"instances of a child subclass will get a `__dict__` and `__weakref__` unless the subclass also defines `__slots__`"*. Its state is then the full pair, and both halves are restored:

```python
import copy


class Base:
    __slots__ = ("id",)

    def __init__(self, id):
        self.id = id


class Loose(Base):
    pass                                     # no __slots__ here


item = Loose(7)
item.note = "extra"                          # goes into the instance __dict__

clone = copy.copy(item)
assert (clone.id, clone.note) == (7, "extra")
```

## A slotted mixin that copies without `__dict__`

`vars(self)` — used by the `CopyControl` mixin in [05](05-writing-copy-hooks.md) — raises for an instance with no `__dict__`. A slots-aware version needs the slot names, mangling included:

```python
import copy


def slot_names(cls):
    names = []
    for klass in cls.__mro__:
        slots = klass.__dict__.get("__slots__", ())
        if isinstance(slots, str):
            slots = (slots,)
        for name in slots:
            if name in ("__dict__", "__weakref__"):
                continue
            if name.startswith("__") and not name.endswith("__"):
                name = "_" + klass.__name__.lstrip("_") + name
            names.append(name)
    return names


class SlottedCopy:
    __slots__ = ()

    def __copy__(self):
        cls = type(self)
        clone = cls.__new__(cls)
        if hasattr(self, "__dict__"):
            clone.__dict__.update(self.__dict__)
        for name in slot_names(cls):
            if hasattr(self, name):
                object.__setattr__(clone, name, getattr(self, name))
        return clone

    def __deepcopy__(self, memo):
        cls = type(self)
        clone = cls.__new__(cls)
        memo[id(self)] = clone
        if hasattr(self, "__dict__"):
            for key, value in self.__dict__.items():
                clone.__dict__[key] = copy.deepcopy(value, memo)
        for name in slot_names(cls):
            if hasattr(self, name):
                object.__setattr__(clone, name, copy.deepcopy(getattr(self, name), memo))
        return clone
```

`object.__setattr__` bypasses a class's own `__setattr__`, so it also works for immutable-style classes — the case the default machinery cannot handle.

## Gotchas

**★ Symptom: `AttributeError: ... object has no attribute '__dict__'` when copying a slotted class that defines `__getstate__`.** Cause: the class returns a plain dictionary; `_reconstruct` finds no `__setstate__`, does not see a pair, and calls `y.__dict__.update(state)` on an object that has no `__dict__`. Fix: define `__setstate__`, or return the documented pair.

```python
class Token:
    __slots__ = ("value",)

    def __init__(self, value):
        self.value = value

    def __getstate__(self):
        return {"value": self.value}

    def __setstate__(self, state):
        self.value = state["value"]
```

```python
    def __getstate__(self):
        return (None, {"value": self.value})       # the (dict, slots) form
```

**★ Symptom: copying an immutable slotted class raises whatever its `__setattr__` raises.** Cause: slot values are restored with `setattr`, which calls the class's `__setattr__`; unlike the `__dict__` route, it is not bypassed. Fix: `__getstate__` and `__setstate__` that use `object.__setattr__` — this is what `dataclasses` installs for frozen slotted dataclasses — or the `SlottedCopy` mixin above.

```python
class Coordinate:
    __slots__ = ("x", "y")

    def __init__(self, x, y):
        object.__setattr__(self, "x", x)
        object.__setattr__(self, "y", y)

    def __setattr__(self, name, value):
        raise AttributeError("Coordinate is immutable")

    def __getstate__(self):
        return {"x": self.x, "y": self.y}

    def __setstate__(self, state):
        object.__setattr__(self, "x", state["x"])
        object.__setattr__(self, "y", state["y"])
```

**★ Symptom: generic copy or introspection code that reads `vars(obj)` or `obj.__dict__` fails on slotted instances.** Cause: no instance dictionary. Fix: iterate the slot names (walking the MRO, as `copyreg._slotnames` does) with `getattr`, or use the default reduce value through `obj.__reduce_ex__(4)`.

**Symptom: `hasattr(cls, "__slotnames__")` is true for a class that never declared it.** Cause: the first copy or pickle of a class that uses the default state caches it there (an empty list if the class has no slots). Fix: nothing — but tools that iterate `vars(cls)` should tolerate the extra entry.

**Symptom: a slot present on the original is missing on the copy, with no error.** Cause: the original's slot was unset when `__getstate__` ran — unset slots are omitted. Fix: initialise every slot in `__init__` so "unset" never occurs, or accept that the copy is faithful.

**Symptom: weak references to the original do not keep the copy alive (or the reverse).** Cause: a slotted class with a `__weakref__` slot gives each instance its own weak-reference list; it is not part of the copied state. Fix: none needed — the copy is a new, separately weak-referenceable object.

## Interview questions

**★ How does `copy` handle a class with `__slots__`?**
The default `__getstate__` returns a pair — the instance `__dict__` (or `None`) and a dictionary of the slot values that are set — with the slot names gathered from every class in the MRO by `copyreg._slotnames`. `_reconstruct` unpacks any two-item tuple state as that pair, updates `__dict__` with the first half, and applies the second half with `setattr`.

**★ Why does a slotted class break when `__getstate__` returns a plain dictionary?**
Because `_reconstruct` only treats a state as a slot pair when it is a two-item tuple. A dictionary goes to `y.__dict__.update(state)`, and an instance without a `__dict__` raises `AttributeError`. Provide a `__setstate__`, or return the `(None, slots_dict)` form.

**What happens to a slot that was never assigned?**
It is omitted from the state and stays unset in the copy; accessing it raises `AttributeError` on both objects. Copying does not invent a value.

**Why can't the default copy handle an immutable slotted class that raises in `__setattr__`?**
The dictionary route bypasses `__setattr__` by writing into `__dict__`, but slots are restored with `setattr`, so the guard fires. `dataclasses` avoids it for frozen slotted classes by installing a `__getstate__`/`__setstate__` pair that uses `object.__setattr__`; a hand-written class can do the same, or provide `__copy__` and `__deepcopy__`.

**How are name-mangled slots such as `__balance` found?**
`copyreg._slotnames` rewrites any slot that starts with two underscores and does not end with two into `_ClassName__name`, using the class in which it was declared, so `getattr` and `setattr` reach the mangled attribute.

---

← [05b · copyreg and types you cannot edit](05b-copyreg-and-types-you-cannot-edit.md) · [Topic index](README.md)
