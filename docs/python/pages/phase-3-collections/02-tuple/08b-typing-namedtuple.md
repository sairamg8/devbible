---
title: "`typing.NamedTuple` is `collections.namedtuple` written as a class — the same runtime object with field types, defaults and methods on top, and a tuple's limits underneath: defaults are shared objects and annotations are never checked"
sidebar_label: "8b · typing.NamedTuple"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 `typing` documentation —
> [`typing.NamedTuple`](https://docs.python.org/3.14/library/typing.html#typing.NamedTuple);
> the [`collections.namedtuple`](https://docs.python.org/3.14/library/collections.html#collections.namedtuple)
> reference; and CPython 3.14 [`Lib/typing.py`](https://github.com/python/cpython/blob/3.14/Lib/typing.py)
> (`NamedTupleMeta`) and [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/3.14/Lib/collections/__init__.py)
> for the error text and the default-value mechanism. Documentation-verified — **no sandbox run**.
> Version spine: **CPython 3.14**.

**The class statement is a disguise. `class Invoice(NamedTuple):` looks like an ordinary
class that inherits from something called `NamedTuple`, but the documentation says the
result *"is equivalent to"* a `collections.namedtuple` call, and the implementation proves
it: a metaclass reads your annotations, calls the factory, and copies your methods onto the
class the factory returned. Everything in [8](08-named-records.md) therefore holds — a
`tuple` subclass, empty slots, underscore methods — and so do the limits of a tuple. You
cannot write `__init__`, because a tuple's contents are fixed in `__new__`; you cannot mix in
another base class; in 3.14 you cannot call `super()`; and the annotations are not checked
when an instance is built. What you gain over the factory is type information a checker can
use, defaults in the natural place, and methods and docstrings written as normal code. This
page is the syntax and its two quiet traps; what the class body is forbidden to contain, and
how validation escapes through `_replace`, is
[8c · What the class syntax forbids](08c-namedtuple-restrictions.md).**

## Same object, better syntax

> *"Typed version of `collections.namedtuple`."*

> ```python
> class Employee(NamedTuple):
>     name: str
>     id: int
> ```
> *"This is equivalent to:: `Employee = collections.namedtuple('Employee', ['name', 'id'])`"* —
> [`typing.NamedTuple`](https://docs.python.org/3.14/library/typing.html#typing.NamedTuple)

```python
from typing import NamedTuple

class Invoice(NamedTuple):
    """An issued invoice. Amounts are integer cents."""
    number: str
    customer: str
    total_cents: int
    currency: str = "EUR"

    @property
    def is_zero(self) -> bool:
        return self.total_cents == 0

    def with_payment(self, paid_cents: int) -> "Invoice":
        return self._replace(total_cents=self.total_cents - paid_cents)
```

Defaults are assignments in the class body — *"Fields with a default value must come after
any fields without a default"* — and *"`NamedTuple` subclasses can also have docstrings and
methods"*. Generic records are supported since 3.11:

```python
class Page[T](NamedTuple):
    items: tuple[T, ...]
    next_cursor: str | None
```

The field types are available to introspection. The 3.14 documentation phrases it in terms
of the new annotations machinery (PEP 649/749): *"The types for each field name can be
retrieved by calling `annotationlib.get_annotations` on the resulting class. (The field
names are in the `_fields` attribute and the default values are in the `_field_defaults`
attribute, both of which are part of the `collections.namedtuple` API.)"*

A functional form exists for dynamic creation — `Employee = NamedTuple('Employee',
[('name', str), ('id', int)])` — and one legacy spelling is on its way out:

> *"The undocumented keyword argument syntax for creating NamedTuple classes
> (`NT = NamedTuple("NT", x=int)`) is deprecated, and will be disallowed in 3.15. Use the
> class-based syntax or the functional syntax instead."*

## Defaults are shared objects

The factory stores defaults as the generated `__new__`'s `__defaults__` (CPython: `if defaults
is not None: __new__.__defaults__ = defaults`). They behave exactly like function defaults —
evaluated once, shared by every call that omits the argument — so a mutable default is the
mutable-default-argument bug in a record:

```python
class Order(NamedTuple):
    order_id: str
    tags: list[str] = []          # 🔴 one list, shared by every Order that omits tags

a = Order("o-1")
a.tags.append("rush")
Order("o-2").tags                 # ['rush'] — the same list object
```

`@dataclass` refuses a bare `list` default and demands `default_factory`; `NamedTuple` has no
such check. Use an immutable default — which, for a record meant to be hashable, is the only
correct choice anyway:

```python
class Order(NamedTuple):
    order_id: str
    tags: tuple[str, ...] = ()
```

## Annotations are not checks

Nothing validates `total_cents: int` at construction. `Invoice("INV-1", "acme", "129900")`
builds an invoice whose total is a string, and the error arrives wherever the first arithmetic
happens. That is the general rule from [7d](07d-checking-tuples-at-runtime.md) — the runtime
does not enforce annotations — applied to a class that looks like it should. Validation is a
classmethod parser at the trust boundary, or a subclass `__new__` (with the escape hatch
[8c](08c-namedtuple-restrictions.md) describes):

```python
class Invoice(NamedTuple):
    number: str
    customer: str
    total_cents: int

    @classmethod
    def parse(cls, raw: dict[str, object]) -> "Invoice":
        return cls(str(raw["number"]), str(raw["customer"]), int(raw["total_cents"]))
```

## Gotchas

**★ Symptom: tags added to one order appear on every order created afterwards.** Cause: a
mutable class-body default is stored once as a default of the generated `__new__` and shared.
Fix: use an immutable default.

```python
tags: tuple[str, ...] = ()
```

**Symptom: `TypeError: Non-default namedtuple field currency cannot follow default field
total_cents`.** Cause: a field without a default was declared after one with a default (message
from `Lib/typing.py`). Fix: move defaulted fields to the end.

```python
class Invoice(NamedTuple):
    number: str
    currency: str
    total_cents: int = 0
```

**Symptom: `DeprecationWarning` from `NamedTuple("Point", x=float, y=float)`.** Cause: the
keyword-argument form is deprecated since 3.13 and *"will be disallowed in 3.15"*. Fix: use
the functional list form or the class form.

```python
Point = NamedTuple("Point", [("x", float), ("y", float)])
```

**Symptom: a record annotated `total_cents: int` holds a string and fails deep inside a report.**
Cause: annotations are not enforced at construction. Fix: convert at the boundary where the
data enters.

```python
invoice = Invoice.parse(request_json)
```

## Interview questions

**★ What is the difference between `collections.namedtuple` and `typing.NamedTuple`?**
At runtime, almost none: the documentation says the class form *"is equivalent to"* the factory
call, and the implementation builds the class with the factory. The differences are in authoring
— field types a type checker can use, defaults written next to their fields, methods and
docstrings as normal class code, generic parameters since 3.11 — and in what the class syntax
forbids: `__init__`, `__new__`, `super()` (3.14), and any base other than `Generic`.

**Does `NamedTuple` check field types at runtime?**
No. The annotations are recorded for type checkers and for introspection through
`annotationlib.get_annotations`, and are otherwise ignored; construction goes through the
generated `__new__`, which only packs the arguments. A value of the wrong type is stored as-is.

**How do you introspect a `NamedTuple` class in 3.14?**
Three attributes answer three questions. `_fields` gives the field names in order and
`_field_defaults` the defaults, both inherited from the `collections.namedtuple` API; the field
*types* come from `annotationlib.get_annotations(cls)`, which is the call the 3.14 documentation
names now that annotations are evaluated lazily (PEP 649/749). `__match_args__` repeats the field
names for pattern matching. None of these involve an instance, so they work on the class alone —
which is how serialisers and form generators build themselves from a record type.

**Why is a mutable default in a `NamedTuple` dangerous, when a dataclass would have refused
it?**
The factory stores defaults as the generated `__new__`'s default argument values, so they have
function-default semantics: evaluated once, shared by every instance that omits the field. A
list default is one list for all of them. `@dataclass` detects unhashable defaults such as
`list` and demands `default_factory`; `NamedTuple` performs no such check, so the only defence
is choosing immutable defaults — which a record intended to be hashable needs anyway.

---

← [namedtuple](08-named-records.md) · [Topic index](README.md) · Next → [What the class syntax forbids](08c-namedtuple-restrictions.md)
