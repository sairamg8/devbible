---
title: "`frozenset` and `set` mix freely and diverge silently — a mixed operation returns the type of its left operand, a frozenset is not an instance of `set`, `frozen=True` on a dataclass does not freeze a set field, and a custom `Set` becomes hashable only when you say so"
sidebar_label: "5b · frozenset beside set"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset),
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html#collections.abc.Set)
> (note 3), [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html) (`frozen`,
> `field(hash=...)`, frozen instances, mutable defaults), [`typing`](https://docs.python.org/3.14/library/typing.html#typing.FrozenSet),
> [`json`](https://docs.python.org/3.14/library/json.html), the [glossary](https://docs.python.org/3.14/glossary.html)
> — and CPython v3.14.7 `Objects/setobject.c`, `Lib/_collections_abc.py` and `Lib/dataclasses.py`,
> marked *implementation detail* wherever the docs are silent. Documentation-verified — **no sandbox
> run, no program output**.

**[5](05-frozenset-hashable-sets.md) is about what a frozenset is for. This page is about living with
both types in one codebase. They compare equal by members and accept each other in every operation,
so nothing forces you to notice which one you are holding — until a result comes back as the wrong
one, an `isinstance` check skips half your data, or a "frozen" dataclass turns out to contain a
mutable set.**

## A mixed operation returns the type of its left operand

> *"Binary operations that mix `set` instances with `frozenset` return the type of the first
> operand. For example: `frozenset('ab') | set('bc')` returns an instance of `frozenset`."* —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset)

The named methods follow the receiver, which is the same thing: in 3.14.7 `union` and friends start
from a copy of `self` (implementation detail, `set_or` → `set_copy`). So:

| Expression | Result type |
|---|---|
| `frozenset_a \| set_b` | `frozenset` |
| `set_b \| frozenset_a` | `set` |
| `frozenset_a.union(list_c)` | `frozenset` |
| `set().union(frozenset_a, list_c)` | `set` |
| `frozenset_a - some_dict.keys()` | `set` — the view does the work ([3d](03d-views-and-abc-sets-as-operands.md)) |
| `MyFrozen(...) \| other` for a `frozenset` subclass | plain `frozenset` (3.14.7, `make_new_set_basetype`) |

Operand order is usually chosen for readability — base permissions first, then the extras — and
that choice silently decides mutability. When the type matters to the next line, say it:

```python
BASE_PERMISSIONS = frozenset({"posts:read", "comments:read"})

def permissions_for(extra: set[str]) -> set[str]:
    return set(BASE_PERMISSIONS) | extra          # mutable, because the caller will add to it

def permission_key(extra: set[str]) -> frozenset[str]:
    return frozenset(BASE_PERMISSIONS | extra)    # hashable, whatever the operand order becomes
```

## A frozenset is not a `set`

`frozenset` does not inherit from `set`, so `isinstance(frozenset(), set)` is `False`. What the two
share is registration with the collection ABCs: in 3.14.7 `Lib/_collections_abc.py` registers
`frozenset` as a `Set` and `set` as a `MutableSet`. So:

| Check | `set()` | `frozenset()` | `{}.keys()` |
|---|---|---|---|
| `isinstance(x, set)` | `True` | `False` | `False` |
| `isinstance(x, (set, frozenset))` | `True` | `True` | `False` |
| `isinstance(x, collections.abc.Set)` | `True` | `True` | `True` |
| `isinstance(x, collections.abc.MutableSet)` | `True` | `False` | `False` |

Choose the check by what the next line does: `collections.abc.Set` if it only reads and uses
operators, `(set, frozenset)` if it needs the named methods, `MutableSet` if it mutates. For
annotations, `frozenset[str]` is the builtin generic; `typing.FrozenSet` is a *"Deprecated alias to
`builtins.frozenset`"* ([`typing`](https://docs.python.org/3.14/library/typing.html#typing.FrozenSet)).

The JSON encoder has no row for either type, and a `default` hook written for one misses the other:

```python
import json
from collections.abc import Set


def encode_default(obj: object) -> object:
    if isinstance(obj, Set):          # set, frozenset, key views, custom Set types
        return sorted(obj)            # sorted: sets have no stable order to preserve
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


payload = json.dumps({"roles": frozenset({"editor", "viewer"})}, default=encode_default)
```

## "Frozen" fixes the membership, not the members

A frozenset's elements cannot be added or removed. The elements themselves are whatever they are:
a frozenset of instances of an ordinary class holds those objects by identity, and their attributes
can change freely. The glossary's claim about immutable objects — *"Immutable objects are inherently
thread-safe because their state cannot be modified after creation"* — covers the frozenset's
membership; it says nothing about the state of the objects inside it. Elements whose hash depends
on state that changes are broken in any set, frozen or not — that is
**Custom classes as elements** *(not written yet)*.

## `frozen=True` on a dataclass does not freeze a set field

> *"frozen: If true (the default is `False`), assigning to fields will generate an exception. This
> emulates read-only frozen instances."*

> *"It is not possible to create truly immutable Python objects. However, by passing `frozen=True`
> to the `@dataclass` decorator you can emulate immutability."* —
> [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html)

Assigning to the field is blocked; calling a method on the object in it is not. A `set` field in a
frozen dataclass can still be `.add()`-ed to. And because `eq=True, frozen=True` generates a
`__hash__`, and a field is included in it by default —

> *"hash: This can be a bool or `None`. If true, this field is included in the generated
> `__hash__()` method. … If `None` (the default), use the value of compare"* —

hashing an instance hashes the set, and raises `TypeError`. The instance is constructible, prints,
compares — and fails the first time it goes into a set or becomes a dict key.

A non-frozen dataclass with a `set()` default is refused at class-definition time: in 3.14.7 the
decorator raises `ValueError: mutable default <class 'set'> for field tags is not allowed: use
default_factory` (`Lib/dataclasses.py`), because it treats *unhashable* as *mutable*. A
`frozenset()` default passes that check — it is hashable — and is safe to share. The fix for both
problems is the same field type, with `__post_init__` converting whatever the caller passed; a
frozen dataclass must use `object.__setattr__` for that, as the docs note its own `__init__` does:

```python
from collections.abc import Iterable
from dataclasses import dataclass


@dataclass(frozen=True)
class Grant:
    user_id: int
    roles: frozenset[str] = frozenset()

    def __post_init__(self) -> None:
        object.__setattr__(self, "roles", frozenset(self.roles))   # accept any iterable, store a frozenset


def grants_for(user_id: int, roles: Iterable[str]) -> Grant:
    return Grant(user_id, frozenset(roles))
```

The same pattern for tuples, and the rest of what `frozen=True` does and does not buy, is
[tuple · 8e](../02-tuple/08e-frozen-dataclasses.md).

## Making a custom `Set` hashable

A class built on `collections.abc.Set` is not hashable by default, and the ABC says why and how:

> *"The `Set` mixin provides a `_hash()` method to compute a hash value for the set; however,
> `__hash__()` is not defined because not all sets are hashable or immutable. To add set hashability
> using mixins, inherit from both `Set` and `Hashable`, then define `__hash__ = Set._hash`."* —
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html#collections.abc.Set)

```python
from collections.abc import Hashable, Iterable, Iterator, Set


class RoleSet(Set, Hashable):
    """Immutable, hashable, casefolded role names."""

    def __init__(self, roles: Iterable[str] = ()) -> None:
        self._roles = frozenset(role.casefold() for role in roles)

    def __contains__(self, role: object) -> bool:
        return isinstance(role, str) and role.casefold() in self._roles

    def __iter__(self) -> Iterator[str]:
        return iter(self._roles)

    def __len__(self) -> int:
        return len(self._roles)

    __hash__ = Set._hash
```

`Set.__eq__` makes a `RoleSet` equal to any `Set` with the same members, including a plain
frozenset, so equal objects of the two types must hash equal if they are ever mixed as dict keys.
The ABC's source docstring for `_hash` says *"We match the algorithm used by the built-in frozenset type."* I could
not confirm that the two produce the same number, so this page does not claim it. When your storage
is a frozenset of exactly the elements you iterate, `__hash__ = lambda self: hash(self._roles)` is
consistent with frozenset equality by construction.

## Gotchas

**★ Symptom: `AttributeError: 'frozenset' object has no attribute 'add'` on a permission set that
was built from "a set plus extras".** Cause: `BASE_PERMISSIONS | extra` returns the type of the left
operand, and `BASE_PERMISSIONS` is a frozenset. Fix: state the type — `set(BASE_PERMISSIONS) | extra`
— as in `permissions_for` above.

**★ Symptom: `TypeError: unhashable type: 'set'` when a computed permission set is used as a cache
key, after someone reordered the operands of a union.** Cause: with a `set` on the left the result
is a `set`. Fix: wrap the result, not the operands — `frozenset(a | b)` — so operand order cannot
change the type.

**★ Symptom: a `@dataclass(frozen=True)` instance with a set field raises `TypeError` when added to a
set, and its field can be changed with `.add()`.** Cause: `frozen=True` only blocks assignment to
fields; the generated `__hash__` includes the set. Fix: a `frozenset` field, converted in
`__post_init__` — `Grant` above.

**★ Symptom: `TypeError: Object of type frozenset is not JSON serializable` from an encoder whose
`default` hook already handles sets.** Cause: the hook tests `isinstance(obj, set)`, and a frozenset
is not a `set`. Fix: test against `collections.abc.Set` — `encode_default` above.

**Symptom: `ValueError: mutable default <class 'set'> for field tags is not allowed: use
default_factory` at import time.** Cause: dataclasses refuse unhashable defaults. Fix:
`field(default_factory=set)` if the field must be mutable, or a `frozenset()` default if it need not
be.

```python
from dataclasses import dataclass, field

@dataclass
class Draft:
    tags: set[str] = field(default_factory=set)
```

**Symptom: methods of a `frozenset` subclass are missing from the result of `a | b`.** Cause: in
3.14.7 operations on a subclass build a plain `frozenset`. Fix: wrap results in the subclass
explicitly, or build the type on `collections.abc.Set`, whose operators construct results with
`cls(iterable)`.

**Symptom: a dict keyed by a mix of `RoleSet` and `frozenset` objects fails to find keys that compare
equal.** Cause: if two equal objects hash differently, a dict cannot find one with the other — and
`Set._hash` is not documented to equal `frozenset`'s hash. Fix: key the dict on one type only, or
define `__hash__` by delegating to a stored frozenset of the same elements.

## Interview questions

**★ What type is `frozenset('ab') | set('bc')`? And `set('bc') | frozenset('ab')`?**
A `frozenset` and a `set` respectively: the documentation says mixed binary operations *"return the
type of the first operand"*. The named methods follow the receiver the same way. The exception is an
operation that a dict view performs, such as `frozenset_x - d.keys()`, which returns a plain `set`.
Because the type depends on operand order, wrap the result when the next line needs a particular
type.

**★ Is a `frozenset` an instance of `set`? How should code check for "a set"?**
No — `frozenset` is a separate type, not a subclass. Both are registered with the collection ABCs:
`frozenset` as `collections.abc.Set`, `set` as `collections.abc.MutableSet`. Check against
`collections.abc.Set` when the code only reads, `(set, frozenset)` when it needs the named methods
of the concrete types, and `MutableSet` when it mutates.

**What does `@dataclass(frozen=True)` guarantee about a field that holds a set?**
Only that the field cannot be reassigned. The docs describe `frozen` as emulating immutability by
making field assignment raise; the set object in the field is still mutable. Worse, the generated
`__hash__` includes the field, so hashing the instance raises `TypeError`. Use a `frozenset` field and
convert in `__post_init__` with `object.__setattr__`.

**How do you make a custom `collections.abc.Set` hashable?**
Inherit from both `Set` and `Hashable` and set `__hash__ = Set._hash`, as the ABC's note 3
prescribes; `Set` deliberately defines no `__hash__` because not every set is immutable. Only do it for
a class whose membership cannot change, and remember that equality with other `Set` types means the
hash must agree with theirs if the types are ever mixed as keys.

**Is a frozenset thread-safe?**
Its membership is: nothing can add or remove elements, so any number of threads can read it without
coordination, which is what the glossary means by immutable objects being *"inherently thread-safe"*.
The objects inside it are not covered by that — if they have mutable state, sharing them across threads
needs the same care as sharing them any other way.

---

← Prev: [frozenset — hashable sets](05-frozenset-hashable-sets.md) · [Topic index](README.md) · Next → [Iteration order](06-iteration-order.md)
