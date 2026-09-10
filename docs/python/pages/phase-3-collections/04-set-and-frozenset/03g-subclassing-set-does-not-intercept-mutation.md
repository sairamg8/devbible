---
title: "A `set` subclass cannot intercept its own mutations — the constructor, `update()` and `|=` never call an overridden `add()`, `|` hands back a plain set, and the way to own every mutation path is composition over `collections.abc.MutableSet`"
sidebar_label: "3g · Subclassing set does not intercept mutation"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html#collections.abc.MutableSet)
> (the mixin table and notes) — and CPython v3.14.7 `Objects/setobject.c` and
> `Lib/_collections_abc.py`, marked *implementation detail* wherever the docs are silent.
> Documentation-verified — **no sandbox run, no program output**.

**The obvious way to make a set that enforces an invariant — casefolded strings, validated IDs, an
audit log of changes — is to subclass `set` and override `add()`. It fails quietly: the C
implementation of `set` inserts elements through its own internals, so the constructor, `update()`
and `|=` never reach your override, and the plain operators return a plain `set` without your
methods. The way to own every mutation path is to implement `collections.abc.MutableSet`
around a private `set`, so that every mixin routes through the two methods you write.**

## Subclassing `set` does not intercept mutation

```python
class CasefoldedSet(set):
    """Intended: every element stored casefolded. Actually: only add() casefolds."""

    def add(self, item: str) -> None:
        super().add(item.casefold())
```

In 3.14.7 the constructor, `update()` and `|=` insert through the C-level `set_add_key` and
`set_merge`, never through a Python-level `add` (implementation detail — `set_init`,
`set_update_internal` and `set_ior` in `Objects/setobject.c`). So `CasefoldedSet(["Admin"])` stores
`"Admin"`, `s.update(["Ops"])` stores `"Ops"`, `s |= {"QA"}` stores `"QA"`, and `"ADMIN" in s` is a
case-sensitive lookup because `__contains__` was never overridden. Only a direct `s.add("Dev")`
casefolds. Nothing raises; the invariant the class exists for holds for one entry point out of
many.

The results of the plain operators lose the subclass altogether. In 3.14.7 `copy()`, `|`, `&`, `-`,
`^` and their named-method forms build a new object of the **base** type (`make_new_set_basetype`),
so `CasefoldedSet(...) | {"x"}` is a plain `set`, and any method you added to the subclass is gone
from the result. `|=` keeps the subclass only because it returns the same object.

A mutable set has a dozen mutation entry points — `add`, `update`, `|=`, `intersection_update`, `&=`,
`difference_update`, `-=`, `symmetric_difference_update`, `^=`, `remove`, `discard`, `pop`, `clear` —
plus the constructor. Overriding all of them is possible and fragile. The alternative the `collections.abc` page
describes is composition over `collections.abc.MutableSet`, which routes every mixin through the few methods you
write:

> *"Several of the ABCs are also useful as mixins that make it easier to develop classes supporting
> container APIs. For example, to write a class supporting the full `Set` API, it is only necessary
> to supply the three underlying abstract methods: `__contains__()`, `__iter__()`, and `__len__()`.
> The ABC supplies the remaining methods such as `__and__()` and `isdisjoint()`"* —
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html#collections.abc.Set)

`MutableSet` adds two more abstract methods, `add` and `discard`, and supplies `clear`, `pop`,
`remove`, `__ior__`, `__iand__`, `__ixor__` and `__isub__` as mixins. In 3.14.7 `__ior__` loops
`self.add(value)` and `__isub__` loops `self.discard(value)`, so the invariant lives in exactly two
places:

```python
from collections.abc import Iterable, Iterator, MutableSet


class CasefoldedSet(MutableSet):
    """Every element is stored casefolded; every mutation path goes through add() and discard()."""

    def __init__(self, iterable: Iterable[str] = ()) -> None:
        self._items: set[str] = set()
        for item in iterable:
            self.add(item)

    def __contains__(self, item: object) -> bool:
        return isinstance(item, str) and item.casefold() in self._items

    def __iter__(self) -> Iterator[str]:
        return iter(self._items)

    def __len__(self) -> int:
        return len(self._items)

    def add(self, item: str) -> None:
        self._items.add(item.casefold())

    def discard(self, item: str) -> None:
        self._items.discard(item.casefold())

    def clear(self) -> None:                 # the mixin removes one element at a time
        self._items.clear()

    def update(self, *others: Iterable[str]) -> None:   # MutableSet provides no update()
        for other in others:
            for item in other:
                self.add(item)

    def __repr__(self) -> str:
        return f"{type(self).__name__}({sorted(self._items)!r})"
```

Three things the ABC does not do for you. It has **no named methods** beyond `isdisjoint` and the
mutators listed — no `update()`, `union()` or `issubset()` — so callers written against `set` break
until you add the ones they use. Its operators build results through `_from_iterable`, which
*"calls `cls(iterable)` to produce a new set"*, so the constructor must accept a single iterable
(or you override `_from_iterable`, per note 1 of the same page). And its `clear()` is correct but
slow — the 3.14.7 docstring says so: *"This is slow (creates N new iterators!) but effective."*

⚠️ Comparisons with a plain `set` are decided by walking one side and testing membership in the
other (3.14.7 `Set.__le__`). `CasefoldedSet(["Admin"]) == {"Admin"}` walks the casefolded side and
asks the plain set for `"admin"` — which it does not have. Normalise the other side first:
`ci_set == CasefoldedSet(other)`.

## Gotchas

**★ Symptom: a `set` subclass that normalises in `add()` still contains un-normalised elements.**
Cause: in 3.14.7 the constructor, `update()` and `|=` insert through C internals and never call an
overridden `add()`. Fix: compose over `collections.abc.MutableSet` — the second `CasefoldedSet` —
so every mutation goes through `add` and `discard`.

**Symptom: `AttributeError` for a custom method on the result of `CasefoldedSet(...) | other`.**
Cause: operators on a `set` subclass build a plain `set` in 3.14.7. Fix: the `MutableSet` version,
whose operators build results with `cls(iterable)`.

**Symptom: after moving a custom set from a `set` subclass to `MutableSet`, callers fail with
`AttributeError: ... has no attribute 'update'`.** Cause: the ABC provides no named `update()`,
`union()` or `issubset()`. Fix: implement the ones your callers use — `update` above.

**Symptom: `clear()` on a large custom `MutableSet` is far slower than on a `set`.** Cause: the
mixin removes one element at a time — its own docstring calls it *"slow (creates N new
iterators!)"*. Fix: override `clear()` to clear the underlying storage, as above.

**Symptom: `CasefoldedSet(["Admin"]) == {"Admin"}` is `False`.** Cause: comparison walks one side
and tests membership in the other, and the plain set's membership is case-sensitive. Fix: convert
the plain side before comparing.

```python
same = roles == CasefoldedSet(submitted_roles)
```

## Interview questions

**★ You subclass `set` and override `add()` to normalise elements. What gets past it, and what do
you do instead?**
Everything that is not a direct `add()` call: the constructor, `update()`, `|=` and the other
in-place operations insert through CPython's C internals, which never look up a Python-level `add`.
Membership is not normalised either, since `__contains__` was not overridden, and `|`, `&`, `-`, `^`
and `copy()` return a plain `set`. The fix is composition: implement `collections.abc.MutableSet`
with a private `set` inside, write `__contains__`, `__iter__`, `__len__`, `add` and `discard`, and let
the mixins build every other operation on top of those five.

**★ What must you implement to get a full mutable set from `collections.abc`, and what is still
missing afterwards?**
`__contains__`, `__iter__` and `__len__` for `Set`, plus `add` and `discard` for `MutableSet`. The
ABC then supplies comparisons, `&`, `|`, `-`, `^`, `isdisjoint`, `clear`, `pop`, `remove` and the
in-place operators. Missing: the named methods `update()`, `union()`, `intersection()`,
`issubset()` and friends, a hash (the ABC deliberately defines none), a fast `clear()`, and — if
your constructor does not take a single iterable — a working `_from_iterable`.

---

← Prev: [Augmented assignment is an assignment](03f-augmented-assignment-is-an-assignment.md) · [Topic index](README.md) · Next → [Removal and mutation mid-loop](03h-removal-and-mutation-during-iteration.md)
