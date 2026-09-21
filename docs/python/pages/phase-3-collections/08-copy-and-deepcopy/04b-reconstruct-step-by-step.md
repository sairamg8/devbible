---
title: "_reconstruct does six things in a fixed order — copy the arguments, call the callable, memoize, restore the state, append the items, store the pairs — and every hook it runs along the way, from __new__ to an overridden append, is code that executes during a copy"
sidebar_label: "04b · _reconstruct step by step"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** against [`Lib/copy.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py) (`_reconstruct`), [`Objects/typeobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/typeobject.c) (`_PyObject_GetItemsIter`) and the [pickle documentation on class instances](https://docs.python.org/3.14/library/pickle.html#pickling-class-instances). Documentation- and source-validated — **no sandbox run**; the event orders in the code below are derived from the source, not observed.

**`_reconstruct` is the function that turns a reduce value into an object, for both `copy` and `deepcopy`, and it is about thirty lines. What makes it worth reading is not the sequence — it is that the sequence *calls your code*: `__new__` to build the empty object, `hasattr` to look for `__setstate__`, `__setstate__` itself or a direct write into `__dict__`, `setattr` for each slot, and `append` or `__setitem__` for every item of a list or dict subclass. A copy is an event sequence with your methods in it, run on an object whose `__init__` never ran. Knowing the order is how you predict what a subclass, a property, or a `__getattr__` will do to a copy.**

## The function

Verbatim from `Lib/copy.py`:

```python
def _reconstruct(x, memo, func, args,
                 state=None, listiter=None, dictiter=None,
                 *, deepcopy=deepcopy):
    deep = memo is not None
    if deep and args:
        args = (deepcopy(arg, memo) for arg in args)
    y = func(*args)
    if deep:
        memo[id(x)] = y

    if state is not None:
        if deep:
            state = deepcopy(state, memo)
        if hasattr(y, '__setstate__'):
            y.__setstate__(state)
        else:
            if isinstance(state, tuple) and len(state) == 2:
                state, slotstate = state
            else:
                slotstate = None
            if state is not None:
                y.__dict__.update(state)
            if slotstate is not None:
                for key, value in slotstate.items():
                    setattr(y, key, value)

    if listiter is not None:
        if deep:
            for item in listiter:
                item = deepcopy(item, memo)
                y.append(item)
        else:
            for item in listiter:
                y.append(item)
    if dictiter is not None:
        if deep:
            for key, value in dictiter:
                key = deepcopy(key, memo)
                value = deepcopy(value, memo)
                y[key] = value
        else:
            for key, value in dictiter:
                y[key] = value
    return y
```

`copy.copy` calls it with `memo=None`, so `deep` is false and nothing is copied — every argument, the state and every item are used as they are. `copy.deepcopy` passes the memo, and each of the three inputs is deep-copied first.

## The six steps

| # | Step | Shallow (`memo` is `None`) | Deep |
|---|---|---|---|
| 1 | arguments | used as they are | each argument deep-copied (a generator, evaluated by `func(*args)`) |
| 2 | `y = func(*args)` | build the empty object | same |
| 3 | `memo[id(x)] = y` | skipped | **now** the copy is registered ([03](03-cycles-and-shared-children-traced.md)) |
| 4 | state | `state` is the *original's* state, passed through | `state = deepcopy(state, memo)` first |
| 5 | list items | `y.append(item)` for each | each item deep-copied, then `y.append` |
| 6 | dict items | `y[key] = value` for each | key and value deep-copied, then `y[key] = value` |

Two consequences of step 4 are worth memorising. In a shallow copy the state dictionary handed to `__setstate__` is the **original's live `__dict__`** (the C default returns the instance dictionary itself, not a copy). And in a deep copy the state is deep-copied *before* `__setstate__` sees it, so a state that contains an uncopyable object fails there even if `__setstate__` would have discarded it.

## Step 4 in detail: three ways to restore state

**A `__setstate__` exists.** `hasattr(y, '__setstate__')` is asked of the **new, un-initialised object**, and if it is true `y.__setstate__(state)` is called with whatever `__getstate__` returned. The state need not be a dictionary; the pickle documentation: *"In that case, there is no requirement for the state object to be a dictionary."* Since 3.11 `object` has a default `__getstate__` but **no** `__setstate__`, so for an ordinary class `hasattr` looks further — into `__getattr__`, if the class has one. The next chunk's first gotcha is about that.

**No `__setstate__`, a dict state.** `y.__dict__.update(state)`. This writes straight into the instance dictionary, so it **bypasses `__setattr__`, property setters and descriptors** — which is why a frozen dataclass (its `__setattr__` raises) can be copied, and why a validating property is not re-run.

**No `__setstate__`, a two-item tuple state.** The code cannot tell a `(dict_state, slot_state)` pair from anything else, so it always unpacks it that way: `state, slotstate = state`. The dict part goes to `__dict__`, and each slot value is applied with **`setattr(y, key, value)`** — which does call `__setattr__`. The documentation's default-state description for classes with `__slots__` is exactly this pair; the slots chunk reads it in full.

## Watching the order

A list subclass with a method that records each step makes the sequence visible. The expected `events` list is what the source above produces; it was derived, not run:

```python
import copy

events = []


class Probe(list):
    def __new__(cls, *args):
        events.append("__new__")
        return super().__new__(cls, *args)

    def __init__(self, *args):
        events.append("__init__")
        super().__init__(*args)

    def __setstate__(self, state):
        events.append("__setstate__")
        self.__dict__.update(state)

    def append(self, item):
        events.append("append")
        super().append(item)


probe = Probe([1, 2])
probe.tag = "x"
events.clear()

clone = copy.copy(probe)

assert events == ["__new__", "__setstate__", "append", "append"]
assert clone.tag == "x" and list(clone) == [1, 2]
```

`__new__` runs (with no arguments — the default recipe passes none), then `__setstate__` (state before items), then one `append` per item. `__init__` is absent. `deepcopy` runs the same four steps, with the items deep-copied on the way.

## The item iterators come from your methods

`_PyObject_GetItemsIter` in `typeobject.c` produces the two iterators: for a `list` (or subclass) `PyObject_GetIter(obj)`, and for a `dict` (or subclass) `iter(obj.items())`, calling the method by name. Whatever the subclass's `__iter__` or `items` yields is what the copy contains, and whatever its `append` or `__setitem__` does is what runs to insert it:

```python
import copy


class Visible(dict):
    """A dict whose items() hides underscore keys from callers."""

    def items(self):
        return ((k, v) for k, v in super().items() if not k.startswith("_"))


config = Visible({"host": "db", "_secret": "s3cr3t"})
clone = copy.copy(config)

assert "_secret" in config
assert "_secret" not in clone           # copy took its items from items()
```

## The shapes `_reconstruct` cannot express

- **A reduce value with a sixth item** (the state-setter callable) — the function takes five.
- **A state that must be applied before `__new__` finishes.** The state is applied after the object exists. An object that needs a field to hash or compare correctly must get it through `__new__` ([03b](03b-containers-built-from-their-children.md)).
- **Anything that must not be shared between a shallow copy and its original** but sits in the state: the state values are the original's own objects.

## Gotchas

**★ Symptom: `copy.copy` raises a `TypeError`, or silently misassigns attributes, for a class whose `__getstate__` returns a pair.** Cause: with no `__setstate__`, a two-item tuple is read as `(dict_state, slot_state)`; `y.__dict__.update(first_item)` then receives a number or a string instead of a mapping. Fix: return a dictionary, or define `__setstate__` so the pair is handed to you untouched.

```python
class Point:
    def __init__(self, lat, lon):
        self.lat = lat
        self.lon = lon

    def __getstate__(self):
        return (self.lat, self.lon)            # a 2-tuple

    def __setstate__(self, state):             # without this, copy misreads the pair
        self.lat, self.lon = state
```

**★ Symptom: a copied object accepts a value that the property setter forbids.** Cause: `y.__dict__.update(state)` writes straight into the instance dictionary, so setters, validators and `__setattr__` do not run. Fix: restore through a `__setstate__` that goes through the checks, if the invariant matters.

```python
class Percentage:
    def __init__(self, value):
        self.value = value

    @property
    def value(self):
        return self._value

    @value.setter
    def value(self, new):
        if not 0 <= new <= 100:
            raise ValueError("percentage out of range")
        self._value = new

    def __setstate__(self, state):
        self.value = state["_value"]           # validated on copy
```

**★ Symptom: a `dict` subclass copy has fewer entries than the original.** Cause: the copy's items come from `iter(obj.items())`, so an `items()` override that filters, sorts or transforms decides the contents. Fix: leave `items()` faithful, or write `__copy__` and `__deepcopy__` that read the underlying storage.

```python
import copy


class Visible(dict):
    def items(self):
        return ((k, v) for k, v in super().items() if not k.startswith("_"))

    def __copy__(self):
        return Visible(dict.items(self))

    def __deepcopy__(self, memo):
        clone = Visible()
        memo[id(self)] = clone
        for key, value in dict.items(self):
            clone[copy.deepcopy(key, memo)] = copy.deepcopy(value, memo)
        return clone
```

**Symptom: a `__setattr__` guard raises during `copy.copy` of a `__slots__` class.** Cause: slot values are restored with `setattr`, unlike `__dict__` state. Fix: implement `__getstate__` and `__setstate__` that write through `object.__setattr__`, as `dataclasses` does for frozen slotted classes.

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

**Symptom: in a deep copy, `__setstate__` is never reached because the state itself raises.** Cause: step 4 deep-copies the state first. Fix: drop unpicklable and uncopyable members in `__getstate__`, not in `__setstate__`.

## Interview questions

**★ Walk through what `_reconstruct` does.**
It optionally deep-copies the arguments, calls `func(*args)` to build the empty object, registers it in the memo (deep only), then restores state — through `__setstate__` if the new object has one, otherwise into `__dict__` with any slot values applied by `setattr` — then appends list items and stores dict items, deep-copying each in a deep copy. It returns the new object.

**★ In what order do `__new__`, `__setstate__` and `append` run when a list subclass is copied?**
`__new__` first, called with no arguments by `copyreg.__newobj__`; then `__setstate__` (or the `__dict__` update) with the state; then `append` once per item. `__init__` does not run. The order matters because a subclass's `append` can rely on attributes that state restored earlier.

**Why can a frozen dataclass be copied although assigning to it raises?**
Because the default state restoration is `y.__dict__.update(state)`, which writes into the instance dictionary directly and never calls `__setattr__`. The exception is a slotted frozen class, whose slot values would be applied with `setattr`; the dataclass machinery therefore installs its own `__getstate__` and `__setstate__` that use `object.__setattr__`.

**What happens if `__getstate__` returns a two-tuple and there is no `__setstate__`?**
The two-tuple is interpreted as `(dict_state, slot_state)`. The first item is fed to `__dict__.update` and the second is treated as a mapping of slot names to values, which fails or misassigns if the pair means something else. Define `__setstate__`, or return a dictionary.

**How do a shallow and a deep copy differ inside `_reconstruct`?**
A shallow copy passes the arguments, the state and the items through unchanged — the state dictionary is the original's own — so values are shared. A deep copy copies each of the three first, after registering the new object in the memo.

---

← [04 · The reduce protocol](04-the-reduce-protocol.md) · [Topic index](README.md)
