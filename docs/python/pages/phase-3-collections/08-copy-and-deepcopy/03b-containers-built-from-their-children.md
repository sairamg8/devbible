---
title: "A set, a frozenset, a Counter or a named tuple is built from its already-copied children, so deepcopy cannot put it in the memo early — a reference from an element back to the set makes the set be copied twice, and if the element's hash reads an attribute the second copy raises"
sidebar_label: "03b · Containers built from their children"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 on **Python 3.14.7** against [`Lib/copy.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/copy.py), [`Objects/setobject.c`](https://github.com/python/cpython/blob/v3.14.7/Objects/setobject.c) (`set___reduce___impl`), [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py) (`Counter.__reduce__`, `namedtuple`'s `__getnewargs__`) and the [pickle documentation](https://docs.python.org/3.14/library/pickle.html#pickling-class-instances). Documentation- and source-validated — **no sandbox run. The behaviour on this page is derived by reading the call sequence, not observed; if your code depends on it, run the reproduction on your own interpreter first.**

**The previous chunk showed the rule that ends cycles: put the copy in the memo before copying the children. That rule needs the container to be creatable while empty. A `list`, a `dict`, an instance and a `deque` are — their children arrive afterwards, through `append`, `__setitem__` or `__dict__.update`. A `set`, a `frozenset`, a `Counter` and a named tuple are not: their reduce value carries the children *in the constructor's arguments*, and `_reconstruct` deep-copies the arguments before it calls the constructor. So the memo entry for the container does not exist while its children are being copied, and a cycle that comes back to the container itself is not recognised. The tuple has a retrofit for this in `_deepcopy_tuple`; nothing else does.**

## Which containers travel in `args`

`_reconstruct(x, memo, func, args, ...)` begins with `args = (deepcopy(arg, memo) for arg in args)`, then `y = func(*args)`, then `memo[id(x)] = y`. Whatever a type puts in `args` is copied before the type exists. From the sources read for this topic:

| Type | Reduce value (children marked) | Children in `args`? |
|---|---|---|
| `set`, `frozenset` | `(type, ([elements],), state)` — `set___reduce___impl` builds `keys = list(so)` | **yes**: a temporary list of the elements |
| `Counter` | `(self.__class__, (dict(self),))` | **yes**: a temporary dict |
| named tuple | `copyreg.__newobj__` with `(cls, *fields)` — its `__getnewargs__` returns the fields | **yes**: the fields |
| `list` subclass | `(__newobj__, (cls,), state, iter(items), None)` | no — `listiter` is applied afterwards |
| `dict` subclass, `OrderedDict`, `defaultdict` | items iterator in `dictiter` | no |
| `deque` | `(type, (), state, iter(items))` | no |
| ordinary instance | `(__newobj__, (cls,), state, None, None)` | no — `state` is applied afterwards |

Exact `list`, `dict` and `tuple` never reach `_reconstruct`; they have their own routines ([02](02-deepcopy-the-algorithm.md)).

## A set that is referred to by its own element

The shape: each member knows which group it belongs to, and the group is the set itself.

```python
import copy


class Member:
    def __init__(self, name, group):
        self.name = name
        self.group = group          # the very set this member is in
        group.add(self)


team = set()
Member("ada", team)

clone = copy.deepcopy(team)
(member,) = clone

assert member.group is not clone    # derived from reading _reconstruct; not run
assert member in member.group
```

The call sequence, from the source:

1. `deepcopy(team)` — `set` is not in the dispatch table — takes the reduce route. `set.__reduce__` builds a **temporary list** `[member]` and returns `(set, ([member],), None)`. `_reconstruct` starts deep-copying the arguments.
2. `deepcopy([member])` runs `_deepcopy_list`, which registers the temporary list's copy and copies `member`.
3. `deepcopy(member)` takes the reduce route: `_reconstruct` creates an empty `Member`, **registers it**, then deep-copies its state — including `member.group`, which is `team`.
4. `deepcopy(team, memo)` again. `team` is **not in the memo**: the first call has not returned from copying its arguments. A second reduce builds a *second* temporary list `[member]` (a different object, so no memo hit) and copies it. When it reaches `member`, the memo *does* have an entry — the half-built copy from step 3 — and returns it. The second call builds a set from it: call it `S2`, and records `memo[id(team)] = S2`.
5. Step 3 resumes: the copied member's `group` is `S2`.
6. Step 1 resumes: the temporary list holds the same copied member, the outer `_reconstruct` builds another set, `S1`, and records `memo[id(team)] = S1`, replacing `S2`.

`deepcopy` returns `S1`. Its only member's `group` is `S2`. Two sets, one member in both; the cycle points at the wrong one.

## When the hash reads an attribute, the second copy raises

Step 4 puts a *half-built* member into a set. A default `object` hash does not care. A hash computed from an attribute does, because the copy's attributes are assigned only after `_reconstruct` has deep-copied the state — which is the step that is still running:

```python
import copy


class Tag:
    def __init__(self, label, registry):
        self.label = label
        self.registry = registry
        registry.add(self)

    def __hash__(self):
        return hash(self.label)

    def __eq__(self, other):
        return isinstance(other, Tag) and self.label == other.label


registry = set()
Tag("urgent", registry)

try:
    copy.deepcopy(registry)
except AttributeError:
    failed = True       # derived: hash(half-built copy) reads self.label before it exists
```

`hash(self.label)` runs when step 4 builds `S2` from the half-built `Tag`, whose `__dict__` is still empty. Nothing in the module guards against this; the only container that copes is the tuple.

## Fixes

**Point at the owner, not at the set.** A cycle through an *instance* is safe, because an instance registers itself before its state is copied ([03](03-cycles-and-shared-children-traced.md)). Give the members a reference to a group object that holds the set:

```python
import copy


class Group:
    def __init__(self):
        self.members = set()


class Tag:
    def __init__(self, label, group):
        self.label = label
        self.group = group
        group.members.add(self)

    def __hash__(self):
        return hash(self.label)

    def __eq__(self, other):
        return isinstance(other, Tag) and self.label == other.label


group = Group()
Tag("urgent", group)

clone = copy.deepcopy(group)
(tag,) = clone.members
assert tag.group is clone
```

The sequence is now: `Group` registered → its state copied → the set's temporary list → `Tag` registered → its state copied → `tag.group` is a memo hit for `Group`. No step needs the set to exist before its members.

**When you cannot restructure, write `__deepcopy__` on the owner** and build the set after its members are copied:

```python
class Group:
    def __init__(self):
        self.members = set()

    def __deepcopy__(self, memo):
        clone = type(self)()
        memo[id(self)] = clone
        clone.members = {copy.deepcopy(member, memo) for member in self.members}
        return clone
```

**Give a value-hashed element its hash fields at construction.** A `__getnewargs__` makes `_reconstruct` call `Tag.__new__` with the label, so a `__new__` that sets `label` guarantees the half-built object already hashes:

```python
class Tag:
    def __new__(cls, label, registry=None):
        obj = super().__new__(cls)
        obj.label = label
        return obj

    def __init__(self, label, registry=None):
        self.registry = registry
        if registry is not None:
            registry.add(self)

    def __getnewargs__(self):
        return (self.label,)

    def __hash__(self):
        return hash(self.label)

    def __eq__(self, other):
        return isinstance(other, Tag) and self.label == other.label
```

This removes the exception. It does **not** remove the duplicate set: the back-reference to the set still resolves to `S2`. Only removing the direct cycle removes both.

## Named tuples have the same shape

A named tuple's fields travel in `args`, and the reduce route has no tuple retrofit, so a cycle that passes through one is copied twice as well:

```python
import copy
from collections import namedtuple

Edge = namedtuple("Edge", ["source", "targets"])

hub = Edge("hub", [])
hub.targets.append(hub)             # the list inside the tuple refers back to it

clone = copy.deepcopy(hub)
assert clone.targets[0] is not clone      # derived from reading _reconstruct; not run
```

Plain `tuple` is different because `deepcopy` never sends it down the reduce route. Model a graph with instances, or with names and lookups, not with named tuples that contain their own ancestors.

## Gotchas

**★ Symptom: `deepcopy` of a set raises `AttributeError` about an attribute the class certainly sets in `__init__`.** Cause: the elements' `__hash__` reads an attribute, and a member that refers back to the set is placed, half-built, into a second copy of the set. Fix: point members at an owner object, or supply a `__deepcopy__` on the owner.

```python
class Group:
    def __init__(self):
        self.members = set()
```

**★ Symptom: after a deep copy, a member's back-reference names a different set than the one the copy returned — mutations to one do not show in the other.** Cause: the set is copied twice (steps 4–6); the memo entry from the second copy is overwritten by the first. Fix: back-reference the owner instance, not the set.

**Symptom: a copied structure has "two" of a set that the original had one of.** Cause: same mechanism; look for any element that stores the set (or `Counter`, or named tuple) that contains it. Fix: find it with a probe.

```python
import copy


class CountingSet(set):
    copies = 0

    def __deepcopy__(self, memo):
        CountingSet.copies += 1
        clone = CountingSet()
        memo[id(self)] = clone
        clone.update(copy.deepcopy(item, memo) for item in self)
        return clone
```

Register the counting subclass in place of the set, copy the structure, and read `CountingSet.copies` — a value above the number of sets you expect means a duplicate.

**Symptom: a cyclic structure built from `namedtuple` nodes copies into a different cycle.** Cause: the fields travel in `args`. Fix: use a class with `__slots__` or a dataclass for nodes that refer to each other.

## Interview questions

**★ Why can `deepcopy` handle a self-referencing list but not always a set that its own element points to?**
A list's copy is created empty and registered in the memo before its items are copied, so the reference back to it is a hit. A set's reduce value puts the elements in the constructor's arguments, and `_reconstruct` copies arguments before calling the constructor; the memo has no entry for the set while its elements are being copied, so the reference back starts a second copy.

**★ What exactly goes wrong when an element of a set has an attribute-based `__hash__` and refers back to the set?**
The second copy of the set builds itself from an element copy that `_reconstruct` has created and registered but not yet given its state. Hashing that half-built object reads an attribute that does not exist yet, and the copy raises `AttributeError`.

**How do you copy such a structure safely?**
Remove the direct cycle: make the element refer to an owner object that holds the set, since instances register themselves before their state is copied. If the shape is fixed, write `__deepcopy__` on the owner to register the clone first and build the set from copied members afterwards.

**Which containers are affected, and which are not?**
The ones whose reduce value carries children in `args`: `set`, `frozenset`, `Counter` and named tuples. Exact `list`, `dict` and `tuple` have dedicated routines (the tuple with a retrofit), and list or dict subclasses, `deque`, `OrderedDict`, `defaultdict` and ordinary instances add their children after they are registered.

**Does supplying `__getnewargs__` with the hash fields fix the duplicate set?**
No. It makes the half-built element hashable, which removes the exception, but the element's reference to the set still resolves to the second copy. Only removing the direct cycle removes the duplicate.

---

← [03 · Cycles and shared children](03-cycles-and-shared-children-traced.md) · [Topic index](README.md) · Next → [04 · The reduce protocol](04-the-reduce-protocol.md)
