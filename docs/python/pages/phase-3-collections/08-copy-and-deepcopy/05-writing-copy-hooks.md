---
title: "Choose the copy hook by what the copy must be — a shallow variant, an independent graph, a reusable state, or the same object — write it against type(self) so subclasses survive, and never delegate back to copy.copy(self), never hand out the live __dict__, and never store the state you were given"
sidebar_label: "05 · Writing copy hooks"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** against the [`copy` documentation](https://docs.python.org/3.14/library/copy.html), the [pickle documentation on `__getstate__`/`__setstate__`/`__reduce__`](https://docs.python.org/3.14/library/pickle.html#pickling-class-instances) and [`Lib/copy.py` at v3.14.7](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py). Documentation- and source-validated — **no sandbox run**. The three memo rules for `__deepcopy__` are in [phase 1](../../phase-1-language-core/07-assignment-and-aliasing/08c-copy-hooks-and-uncopyable.md); this chunk covers choosing the hook, the templates, and the mistakes the source makes easy.

**There are four ways to tell `copy` what a copy of your class is, and they answer different questions. `__copy__` and `__deepcopy__` say what a copy is *for `copy`*. `__getstate__` and `__setstate__` say what the *state* is, and serve `copy`, `pickle`, `multiprocessing` and `shelve` at once. `__reduce_ex__` says how to *rebuild* the object. And returning `self` says the object is not copyable in any sense worth having. Which to write depends on what the copy must be. Most hook bugs are not in the choice — they are in three lines that look natural and are wrong: `copy.copy(self)` inside `__copy__`, `state = self.__dict__` in `__getstate__`, and `self.__dict__ = state` in `__setstate__`.**

## Choosing the hook

| The copy must… | Write | Because |
|---|---|---|
| be a shallow variant with something re-made (a lock, an id) | `__copy__` | called by `copy.copy` only; shares everything you do not touch |
| be independent, but keep a resource shared or reset a cache | `__deepcopy__` | gets the memo, so shared children and cycles stay right |
| drop or rebuild members for **every** consumer (copy, pickle, subprocess) | `__getstate__` + `__setstate__` | one definition of "what the state is"; `copy` applies it |
| call `__init__`, or need constructor arguments, or use `__slots__` cleanly | `__reduce__` / `__reduce_ex__`, or `__getnewargs__` | the recipe itself ([04](04-the-reduce-protocol.md)) |
| be the very same object (singleton, immutable value, handle) | `__copy__` and `__deepcopy__` returning `self` | what `Enum`, `Decimal` and `re.Pattern` do |
| be impossible | `__copy__` and `__deepcopy__` raising `TypeError` | better than a copy that shares a lock |

`__copy__` and `__deepcopy__` win over the reduce route (`copy` finds them first), so defining either overrides `__getstate__` for that function. Define both, or neither, unless the two really differ.

## Template 1: explicit constructor

When the class has a stable constructor, call it. `__init__` runs, so ids, validation and registration happen:

```python
import copy


class Invoice:
    def __init__(self, number, lines):
        self.number = number
        self.lines = list(lines)

    def __copy__(self):
        return type(self)(self.number, self.lines)

    def __deepcopy__(self, memo):
        clone = type(self)(self.number, [])
        memo[id(self)] = clone
        clone.lines = copy.deepcopy(self.lines, memo)
        return clone
```

Two details. `type(self)` keeps subclasses — but only works if a subclass keeps the same constructor signature. And `__deepcopy__` registers the clone in the memo *before* the recursive call, or a cycle through `self` overflows the stack ([03](03-cycles-and-shared-children-traced.md)).

## Template 2: clone without `__init__`

When `__init__` is expensive, has side effects, or a subclass changes its signature, build the empty object with `__new__` and move the state across:

```python
import copy


class Report:
    def __init__(self, title, rows):
        self.title = title
        self.rows = rows

    def __copy__(self):
        cls = type(self)
        clone = cls.__new__(cls)
        clone.__dict__.update(self.__dict__)
        return clone

    def __deepcopy__(self, memo):
        cls = type(self)
        clone = cls.__new__(cls)
        memo[id(self)] = clone
        for name, value in self.__dict__.items():
            clone.__dict__[name] = copy.deepcopy(value, memo)
        return clone
```

It writes to `clone.__dict__` rather than calling `setattr`, so it works for classes whose `__setattr__` is guarded — and, like the default recipe, it bypasses properties and validators.

## Template 3: a reusable mixin — share these, reset those

The same need — copy everything, but keep the client shared and give the copy a fresh lock — recurs across classes. Put it in a mixin:

```python
import copy
import threading


class CopyControl:
    """Deep-copy everything except: keep _shared attributes, rebuild _reset ones."""

    _shared = ()
    _reset = {}          # class-level table, never mutated: attribute name -> factory

    def __copy__(self):
        cls = type(self)
        clone = cls.__new__(cls)
        clone.__dict__.update(vars(self))
        for name, factory in self._reset.items():
            clone.__dict__[name] = factory()
        return clone

    def __deepcopy__(self, memo):
        cls = type(self)
        clone = cls.__new__(cls)
        memo[id(self)] = clone
        for name, value in vars(self).items():
            if name in self._shared:
                clone.__dict__[name] = value
            elif name in self._reset:
                clone.__dict__[name] = self._reset[name]()
            else:
                clone.__dict__[name] = copy.deepcopy(value, memo)
        return clone


class Exporter(CopyControl):
    _shared = ("client",)
    _reset = {"_lock": threading.Lock}

    def __init__(self, client, rows):
        self.client = client
        self.rows = rows
        self._lock = threading.Lock()


exporter = Exporter(client=object(), rows=[1, 2, 3])
twin = copy.deepcopy(exporter)

assert twin.client is exporter.client
assert twin.rows == exporter.rows and twin.rows is not exporter.rows
assert twin._lock is not exporter._lock
```

The original's lock is never visited, so nothing tries to copy it. The mixin reads `vars(self)`, so it applies to classes with a `__dict__`; slotted classes are the subject of the next chunk.

## `__getstate__` and `__setstate__`

Use the pair when the rule is about the *state* — "a `Session` is its `dsn` and nothing else" — and should hold for pickling and multiprocessing as well:

```python
import threading


class Session:
    def __init__(self, dsn):
        self.dsn = dsn
        self._lock = threading.Lock()
        self._conn = None

    def __getstate__(self):
        state = self.__dict__.copy()          # a copy: see the gotchas
        del state["_lock"]
        state["_conn"] = None
        return state

    def __setstate__(self, state):
        self.__dict__.update(state)           # not self.__dict__ = state
        self._lock = threading.Lock()
```

`copy` applies it as `_reconstruct` does ([04b](04b-reconstruct-step-by-step.md)): in a deep copy the returned state is deep-copied first, which is why the lock is removed in `__getstate__`, not in `__setstate__`. If the class has no other instance state, `__getstate__` must still return a non-`None` value for `__setstate__` to run.

## Hooks and subclasses

A hook written against the base class's name silently downgrades every subclass:

```python
import copy


class Base:
    def __init__(self, name):
        self.name = name

    def __copy__(self):
        return Base(self.name)                # hard-codes the base class


class Child(Base):
    def __init__(self, name, level):
        super().__init__(name)
        self.level = level


twin = copy.copy(Child("a", 1))
assert type(twin) is Base                     # the subclass and its `level` are gone
```

Use `type(self)` — and if subclass constructors differ, Template 2, which needs no constructor at all. If a subclass has extra state, it overrides the hook, calls `super().__copy__()`, and adds its own.

## Gotchas

**★ Symptom: `RecursionError` from `__copy__` (or `__deepcopy__`) that delegates to the module.** Cause: `copy.copy(self)` finds `__copy__` and calls it again; `copy.deepcopy(self, memo)` does not hit the memo, because the clone is registered only after the hook returns. Fix: build the clone yourself with `cls.__new__` and update its `__dict__`.

```python
def __copy__(self):
    cls = type(self)
    clone = cls.__new__(cls)
    clone.__dict__.update(self.__dict__)
    return clone
```

**★ Symptom: after `copy.copy(cache)`, the original loses an attribute (`AttributeError` on `_lock` a moment later).** Cause: `__getstate__` did `state = self.__dict__` and `del state["_lock"]` — the state *is* the instance's dictionary, so the delete removed the lock from the original. Fix: copy the dictionary first.

```python
def __getstate__(self):
    state = self.__dict__.copy()
    del state["_lock"]
    return state
```

**★ Symptom: after `copy.copy(profile)`, assigning `clone.name` changes `profile.name`.** Cause: `__getstate__` returns `self.__dict__` and `__setstate__` does `self.__dict__ = state`; a shallow copy passes the original's live dictionary straight through, so both objects now use one dictionary. A deep copy does not show it, because it deep-copies the state first. Fix: `self.__dict__.update(state)`.

```python
def __setstate__(self, state):
    self.__dict__.update(state)
```

**★ Symptom: a copy of a subclass is an instance of the base class and has lost the subclass's attributes.** Cause: the hook names the base class. Fix: `type(self)`, or `cls.__new__` plus a `__dict__` update.

**Symptom: `__setstate__` never runs for some instances.** Cause: the default state is `None` for an object with no attributes, and `_reconstruct` skips `__setstate__` when the state is `None`. Fix: return a non-`None` value (`{}`) from `__getstate__`.

**Symptom: a frozen dataclass with a list field has `__deepcopy__` returning `self`, and mutating the list through the "copy" changes the original.** Cause: `frozen=True` stops rebinding attributes, not mutating what they hold; returning `self` from `__deepcopy__` is right only for values that are immutable *all the way down*. Fix: return `self` only when every field is immutable; otherwise rebuild.

```python
import copy
from dataclasses import dataclass, field, fields


@dataclass(frozen=True)
class Tagged:
    label: str
    tags: list = field(default_factory=list)

    def __deepcopy__(self, memo):
        values = [copy.deepcopy(getattr(self, f.name), memo) for f in fields(self)]
        return type(self)(*values)
```

**Symptom: a hook works for `copy.copy` and the same class fails under `copy.deepcopy` (or the reverse).** Cause: the two functions call different hooks. Fix: test both, and define both.

## Interview questions

**★ How do you decide between `__copy__`/`__deepcopy__`, `__getstate__`/`__setstate__` and `__reduce__`?**
`__copy__` and `__deepcopy__` are the direct hooks and affect `copy` only; use them when the copy has behaviour of its own — a fresh id, a shared client. `__getstate__` and `__setstate__` define what the object's *state* is and serve `copy`, `pickle` and `multiprocessing` at once; use them when the rule is about members you cannot or should not transfer. `__reduce__` or `__reduce_ex__` control the rebuilding recipe — needed to call `__init__` or a factory. And `__copy__`/`__deepcopy__` returning `self` is for singletons and immutable values.

**★ Why does `def __copy__(self): return copy.copy(self)` recurse forever?**
`copy.copy` looks up `__copy__` on the class and calls it — which is this method — so it calls itself. `copy.deepcopy(self, memo)` inside `__deepcopy__` recurses for the same reason, and the memo does not help because the wrapper registers the result only after the hook returns. Build the clone with `type(self).__new__` and copy the dictionary yourself.

**★ What is wrong with `state = self.__dict__` in `__getstate__`?**
It returns the instance's live dictionary, so any change to `state` — including `del state["_lock"]` — changes the object being copied. Use `self.__dict__.copy()`. The mirror mistake is `self.__dict__ = state` in `__setstate__`: a shallow copy passes the original's dictionary, and the two objects end up sharing it.

**How do you write a hook that survives subclassing?**
Refer to `type(self)`, never the class name. Prefer `cls.__new__(cls)` plus a state transfer over calling `cls(...)`, so a subclass with a different constructor still works. A subclass with extra state overrides the hook, calls `super().__copy__()` or `super().__deepcopy__(memo)`, and adds its own.

**When is returning `self` from `__deepcopy__` correct?**
When the object is immutable all the way down or must be unique — a sentinel, a singleton, an enum member, a handle to a shared resource. A frozen dataclass holding a list does not qualify: freezing stops rebinding, not mutation of the contained list.

**Why remove an uncopyable member in `__getstate__` and not in `__setstate__`?**
In a deep copy `_reconstruct` deep-copies the state before it calls `__setstate__`, so an uncopyable member left in the state fails before your `__setstate__` can discard it.

---

← [04c · What a copy runs unexpectedly](04c-what-a-copy-runs-unexpectedly.md) · [Topic index](README.md) · Next → [05b · copyreg and types you cannot edit](05b-copyreg-and-types-you-cannot-edit.md)
