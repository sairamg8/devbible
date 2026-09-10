---
title: "The sets-only rule belongs to `set`, not to the operator — a dictionary view or a `collections.abc.Set` on either side accepts any iterable, the reflected result is a plain `set` even when the left operand was a frozenset, and an ABC-typed parameter has operators but no `union()`"
sidebar_label: "3d · Views and ABC sets as operands"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects),
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset),
> [`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html#collections.abc.Set),
> [`typing.Set`](https://docs.python.org/3.14/library/typing.html#typing.Set) — and CPython v3.14.7
> `Objects/dictobject.c` and `Lib/_collections_abc.py`, marked *implementation detail* where the docs
> are silent. Split out of [3b · Operators versus methods](03b-operators-versus-methods.md) on a
> concept boundary. Documentation-verified — **no sandbox run, no program output**.

**[3b](03b-operators-versus-methods.md) shows that `set`'s operators refuse anything that is not a
set. That refusal is implemented by `set` returning `NotImplemented` — so when the *other* operand
implements the operator itself, the operation goes ahead on that operand's terms. Two families of
objects do exactly that: dictionary views, and anything built on `collections.abc.Set`. Both accept
any iterable, both change the type of the result, and one of them has none of the named methods.**

## Who else can sit on the other side

**Dictionary views** implement the set operators themselves and accept any iterable:

> *"For set-like views, all of the operations defined for the abstract base class
> `collections.abc.Set` are available (for example, `==`, `<`, or `^`). While using set operators,
> set-like views accept any iterable as the other operand, unlike sets which only accept sets as the
> input."* — [dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects)

That covers the reflected case too. `REQUIRED - config.keys()` with a frozenset on the left:
`frozenset.__sub__` declines the view, Python calls the view's reflected subtraction, and in
3.14.7 that builds a set from the **left** operand and removes the view's keys from it
(`Objects/dictobject.c`, `dictviews_sub` → `dictviews_to_set`). The result is a plain `set` — not a
frozenset, although the documented rule for mixed operands is *"return the type of the first
operand"*. That rule is about `set` mixed with `frozenset`; a view is neither.

```python
REQUIRED = frozenset({"DATABASE_URL", "SECRET_KEY", "REDIS_URL"})
config = {"DATABASE_URL": "postgres://db/app", "DEBUG": "1"}

missing = REQUIRED - config.keys()      # a plain set, not a frozenset
unknown = config.keys() - REQUIRED      # a plain set
also_ok = config.keys() | ["LOG_LEVEL"] # the view accepts a list: the sets-only rule is gone
```

**`collections.abc.Set` implementations** get their operators from mixins, and those mixins are
looser still: in 3.14.7 `Set.__and__` and `Set.__or__` return `NotImplemented` only when the other
operand is not an `Iterable` (`Lib/_collections_abc.py`). The ABC also provides **no** named
`union()` or `intersection()` — the documented mixin list is `__le__`, `__lt__`, `__eq__`, `__ne__`,
`__gt__`, `__ge__`, `__and__`, `__or__`, `__sub__`, `__rsub__`, `__xor__`, `__rxor__` and
`isdisjoint` ([`collections.abc`](https://docs.python.org/3.14/library/collections.abc.html#collections.abc.Set)).
That matters because the typing docs steer annotations toward the ABC:

> *"Note that to annotate arguments, it is preferred to use an abstract collection type such as
> `collections.abc.Set` rather than to use `set` or `typing.Set`."* —
> [`typing.Set`](https://docs.python.org/3.14/library/typing.html#typing.Set)

A parameter annotated `collections.abc.Set` must be combined with **operators** and `isdisjoint`;
the named methods are an accident of the concrete type, and a `dict_keys` argument does not have
them.

## Gotchas

**★ Symptom: `AttributeError: 'dict_keys' object has no attribute 'union'` from a helper that worked in
every test.** Cause: the helper is annotated `collections.abc.Set` and calls `.union()`; the tests
passed real sets, production passes `config.keys()`. The ABC has operators, not the named methods.
Fix: use operators on an ABC-typed parameter.

```python
from collections.abc import Set

def missing_keys(present: Set[str], required: Set[str]) -> set[str]:
    return set(required - present)
```

**Symptom: `TypeError: unhashable type: 'set'` when caching the result of
`REQUIRED - settings.keys()` in a dict keyed by it.** Cause: `REQUIRED` is a frozenset, but the
subtraction was performed by the dict view's reflected operator, which returns a plain `set`. Fix:
freeze the result explicitly when you need it hashable.

```python
missing = frozenset(REQUIRED - settings.keys())
cache[missing] = build_error_message(missing)
```

## Interview questions

**★ Why does `config.keys() | ["X"]` work when `{"A"} | ["X"]` does not?**
Dictionary views implement the set operators themselves, and their documentation says they
*"accept any iterable as the other operand, unlike sets which only accept sets as the input"*.
Legality is decided by the operand types, not by the operator symbol. The same is true in the
reflected direction: `frozenset_value - d.keys()` is handled by the view and returns a plain `set`.

**You annotate a parameter as `collections.abc.Set`. Which set operations may you call on it?**
The comparison operators, `&`, `|`, `-`, `^` and `isdisjoint` — the ABC's mixins. Not `union()`,
`intersection()`, `issubset()` or any mutating method; those exist on the concrete `set` type only,
and a `dict_keys` or custom `Set` implementation passed in will not have them.

---

← Prev: [Operators versus methods](03b-operators-versus-methods.md) · [Topic index](README.md) · Next → **The in-place forms** *(not written yet)*
