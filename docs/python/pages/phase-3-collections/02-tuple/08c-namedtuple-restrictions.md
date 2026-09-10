---
title: "A `NamedTuple` class body may not define `__init__` or `__new__`, call `super()` or add a mixin — and the validating subclass you write instead is silently bypassed by `_make` and `_replace`"
sidebar_label: "8c · What the class syntax forbids"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 `typing` documentation —
> [`typing.NamedTuple`](https://docs.python.org/3.14/library/typing.html#typing.NamedTuple);
> the [`collections.namedtuple`](https://docs.python.org/3.14/library/collections.html#collections.namedtuple)
> reference; the [`dataclasses.replace`](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.replace)
> reference; and CPython 3.14 [`Lib/typing.py`](https://github.com/python/cpython/blob/3.14/Lib/typing.py)
> (`NamedTupleMeta`) and [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/3.14/Lib/collections/__init__.py)
> (`_make`, `_replace`) for the mechanism and the error text. Documentation-verified —
> **no sandbox run**. Version spine: **CPython 3.14**.

**The `class` keyword in `class Invoice(NamedTuple):` sets expectations the tuple underneath
cannot meet. A tuple's contents are fixed at creation, so there is nowhere for `__init__` to
put anything; the factory already wrote the `__new__`, so you may not replace it; the metaclass
throws away the class your body was compiled for, so `super()` has nothing sound to refer to
and 3.14 now refuses it; and the only base allowed besides `NamedTuple` is `Generic`. The
workaround for validation — subclass the named tuple and override `__new__` — works for
direct construction and is quietly skipped by `_make` and `_replace`, which build instances
with `tuple.__new__` directly. That last gap has no counterpart in a dataclass, whose
`replace()` is documented to run `__post_init__`.**

## What the metaclass forbids, and why

`NamedTupleMeta` in CPython 3.14's `Lib/typing.py` enforces the tuple's constraints on the
class body. From the source:

```python
_prohibited = frozenset({'__new__', '__init__', '__slots__', '__getnewargs__',
                         '_fields', '_field_defaults',
                         '_make', '_replace', '_asdict', '_source'})
```

Defining any of those raises `AttributeError("Cannot overwrite NamedTuple attribute " +
key)`. Three rules follow, and each surprises someone who read `class` and expected a class:

**No `__init__` and no `__new__`.** A tuple's items are fixed when the object is created, and
the factory already generated the `__new__` that does it. There is no hook in the class body
for validation or normalisation. The `collections` documentation extends a named tuple by
subclassing the generated class (to add a property and a `__str__`); that subclass is an
ordinary class, so it may define `__new__`:

```python
from typing import NamedTuple

class _InvoiceFields(NamedTuple):
    number: str
    customer: str
    total_cents: int
    currency: str = "EUR"

class Invoice(_InvoiceFields):
    __slots__ = ()

    def __new__(cls, number: str, customer: str, total_cents: int, currency: str = "EUR"):
        if total_cents < 0:
            raise ValueError(f"negative total on {number}: {total_cents}")
        return super().__new__(cls, number, customer, total_cents, currency.upper())
```

`super()` is legal there because `Invoice` is not created by `NamedTupleMeta`. The need for
two classes to do what a dataclass does with one `__post_init__` is one of the concrete
arguments in [8d](08d-when-a-dataclass-beats-a-tuple.md).

**No `super()` inside the `NamedTuple` body, as of 3.14.**

> *"Using `super` (and the `__class__` closure variable) in methods of `NamedTuple`
> subclasses is unsupported and causes a `TypeError`."* (versionchanged 3.14)

The source raises `TypeError("uses of super() and __class__ are unsupported in methods of
NamedTuple subclasses")` when the class body contains a `__class__` cell. The documentation
does not give the reason; the code shows the class the body was compiled for is not the class
you get back (the metaclass returns a freshly built named tuple and copies attributes onto
it), which is the likely cause.

**No other base classes.** `class Invoice(NamedTuple, AuditMixin):` raises `TypeError('can
only inherit from a NamedTuple type and Generic')`. A mixin goes on the subclass, as above.

## `_make` and `_replace` do not call your `__new__`

The subclass above validates every `Invoice(...)` call. It does not validate the two other
ways an instance gets built. CPython 3.14's `Lib/collections/__init__.py` defines them in
terms of the plain tuple constructor:

```python
tuple_new = tuple.__new__

@classmethod
def _make(cls, iterable):
    result = tuple_new(cls, iterable)
    if _len(result) != num_fields:
        raise TypeError(f'Expected {num_fields} arguments, got {len(result)}')
    return result

def _replace(self, /, **kwds):
    result = self._make(_map(kwds.pop, field_names, self))
    if kwds:
        raise TypeError(f'Got unexpected field names: {list(kwds)!r}')
    return result
```

`tuple_new(cls, iterable)` creates an instance of the subclass without ever entering the
subclass's `__new__`. So:

```python
good = Invoice("INV-1", "acme", 100)            # validated, currency normalised
bad  = good._replace(total_cents=-500)          # 🔴 accepted: no ValueError
raw  = Invoice._make(("INV-2", "acme", -1, "eur"))   # 🔴 accepted, "eur" not upper-cased
```

`copy.replace()` goes through the same `_replace` (the factory sets `__replace__ = _replace`),
so it bypasses validation too. If the invariant matters, override both:

```python
class Invoice(_InvoiceFields):
    __slots__ = ()

    def __new__(cls, number: str, customer: str, total_cents: int, currency: str = "EUR"):
        if total_cents < 0:
            raise ValueError(f"negative total on {number}: {total_cents}")
        return super().__new__(cls, number, customer, total_cents, currency.upper())

    @classmethod
    def _make(cls, iterable):
        return cls(*iterable)                    # route through the validating __new__

    def _replace(self, /, **changes):
        return type(self)(**{**self._asdict(), **changes})

    __replace__ = _replace
```

The dataclass equivalent needs none of this, and the reason is documented:
`dataclasses.replace` *"is created by calling the `__init__` method of the dataclass. This
ensures that `__post_init__`, if present, is also called."* —
[`dataclasses.replace`](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.replace).

## Gotchas

**★ Symptom: `AttributeError: Cannot overwrite NamedTuple attribute __init__`.** Cause: the
class body defines `__init__` (or `__new__`); `NamedTupleMeta` prohibits both, because the
factory owns construction. Fix: validate in a subclass `__new__`, or parse in a classmethod —
or switch to a frozen dataclass with `__post_init__`.

```python
@classmethod
def parse(cls, raw: dict[str, object]) -> "Invoice":
    return cls(str(raw["number"]), str(raw["customer"]), int(raw["total_cents"]))
```

**★ Symptom: after upgrading to 3.14, a `NamedTuple` class fails at definition with `TypeError:
uses of super() and __class__ are unsupported in methods of NamedTuple subclasses`.** Cause: a
method calls `super()` — documented as unsupported from 3.14. Fix: name the base explicitly.

```python
class Money(NamedTuple):
    amount_cents: int
    currency: str

    def __repr__(self) -> str:
        plain = tuple.__repr__(self)          # was: super().__repr__()
        return f"Money{plain}"
```

**★ Symptom: an invoice with a negative total exists even though `Invoice.__new__` rejects
negative totals.** Cause: it was produced by `_replace` (or `_make`, or `copy.replace`), which
construct through `tuple.__new__` and never call the subclass's `__new__`. Fix: override
`_make` and `_replace` to route through the constructor — or use a frozen dataclass, whose
`replace()` is documented to run `__post_init__`.

```python
@classmethod
def _make(cls, iterable):
    return cls(*iterable)

def _replace(self, /, **changes):
    return type(self)(**{**self._asdict(), **changes})
```

**Symptom: `TypeError: can only inherit from a NamedTuple type and Generic`.** Cause: the class
statement lists a mixin next to `NamedTuple`. Fix: define the named tuple alone, then subclass
it with the mixin.

```python
class _Point(NamedTuple):
    x: float
    y: float

class Point(_Point, JsonMixin):
    __slots__ = ()
```

**Symptom: `AttributeError: Cannot overwrite NamedTuple attribute __slots__` on a class that
declared `__slots__ = ()` "to be safe".** Cause: `__slots__` is on the prohibited list — the
factory already sets it to `()`. Fix: omit it in the `NamedTuple` body; declare it only on
ordinary subclasses of the generated class, where it is required.

```python
class Point(NamedTuple):       # no __slots__ here
    x: float
    y: float

class LabelledPoint(Point):    # but here, yes
    __slots__ = ()
```

## Interview questions

**★ How do you validate the fields of a `NamedTuple`?**
Not in the class body — `__init__` and `__new__` are prohibited there. Either subclass the
named tuple and override `__new__` (keeping `__slots__ = ()`), or give it a classmethod
constructor that converts and checks untrusted input before calling the class. A subclass
`__new__` must be paired with overrides of `_make` and `_replace`, which otherwise build
instances without calling it. If validation or derived fields are central to the type, that is
a strong signal it wants to be a frozen dataclass, where `__post_init__` is the designed hook.

**Why can a `NamedTuple` not define `__init__`?**
Because by the time `__init__` would run, the tuple already exists and its contents cannot be
changed. Immutable types set their state in `__new__`; the factory generates that `__new__`
from the field list. An `__init__` could only observe the values, never set them, so the
metaclass rejects it rather than letting it silently do nothing useful.

**What changed for `NamedTuple` in Python 3.14?**
Two things. Using `super()` or `__class__` in methods of a `NamedTuple` class now raises
`TypeError` at class creation. And the documentation now points to
`annotationlib.get_annotations` for field types, following the deferred-annotation work of
PEP 649/749. Separately, two legacy creation forms deprecated in 3.13 — keyword-argument fields
and omitting the fields argument — are scheduled to be disallowed in 3.15.

**★ Why does `_replace` skip the validation in a subclass's `__new__`?**
Because it does not call the class. CPython's `_replace` is implemented as `self._make(...)`,
and `_make` calls `tuple.__new__(cls, iterable)` directly — a lower-level constructor that
allocates an instance of `cls` and fills it without running any Python-level `__new__` the
subclass defined. It is fast and correct for the plain factory class, where there is nothing to
skip, and a hole as soon as a subclass adds invariants. Contrast `dataclasses.replace`, which
the documentation says constructs the new object *"by calling the `__init__` method"* so that
`__post_init__` runs.

**Why does `super()` work in a subclass of a `NamedTuple` but not inside the `NamedTuple` class
itself?**
Because only the `NamedTuple` class body is processed by `NamedTupleMeta`, which builds a new
class with the factory and copies your attributes onto it; a `__class__` cell in that body would
be tied to a class object that is not the one you end up with, and 3.14 rejects it. A subclass
of the generated class is created by the ordinary `type` machinery, so its methods' `__class__`
is the real class and `super()` resolves normally.

---

← [`typing.NamedTuple`](08b-typing-namedtuple.md) · [Topic index](README.md) · Next → [When a dataclass beats a 4-tuple](08d-when-a-dataclass-beats-a-tuple.md)
