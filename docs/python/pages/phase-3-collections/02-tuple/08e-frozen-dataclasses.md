---
title: "`frozen=True` emulates a tuple's immutability with a `__setattr__` that raises — so it stops assignment, not mutation, hashes only when every field can, and since 3.13 compares fields one by one instead of as a tuple"
sidebar_label: "8e · Frozen dataclasses"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html)
> reference — [Frozen instances](https://docs.python.org/3.14/library/dataclasses.html#frozen-instances),
> the [`@dataclass` parameters](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.dataclass),
> [`astuple`](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.astuple),
> [`replace`](https://docs.python.org/3.14/library/dataclasses.html#dataclasses.replace) and
> [Post-init processing](https://docs.python.org/3.14/library/dataclasses.html#post-init-processing);
> CPython 3.14 [`Lib/dataclasses.py`](https://github.com/python/cpython/blob/3.14/Lib/dataclasses.py)
> for the generated `__eq__`. Documentation-verified — **no sandbox run**. Version spine: **CPython 3.14**.

**A tuple is immutable because the type has no operation that writes to it. A frozen
dataclass is immutable because the decorator installed a `__setattr__` and `__delattr__` that
raise — the documentation calls it emulation and says, in its first sentence on the subject,
that truly immutable Python objects cannot be created. The difference is visible in exactly
the places a tuple taught you to look: a list in a field is still a list, the generated
`__hash__` is a hash of the fields and fails on an unhashable one, `__post_init__` has to go
around the guard to set a derived field, and the equality that used to be "compare the tuple
of fields" became "compare each field" in 3.13 — which changed the answer for NaN.**

## Emulation, in the documentation's words

> *"It is not possible to create truly immutable Python objects.  However, by passing
> `frozen=True` to the `@dataclass` decorator you can emulate immutability.  In that case,
> dataclasses will add `__setattr__` and `__delattr__` methods to the class.  These methods
> will raise a `FrozenInstanceError` when invoked."* —
> [Frozen instances](https://docs.python.org/3.14/library/dataclasses.html#frozen-instances)

`FrozenInstanceError` is *"a subclass of `AttributeError`"*, so code that catches
`AttributeError` catches it too. The generated `__init__` has to set the fields past its own
guard, and the documentation names the cost:

> *"There is a tiny performance penalty when using `frozen=True`: `__init__` cannot use
> simple assignment to initialize fields, and must use `object.__setattr__`."*

That escape hatch is also how your own `__post_init__` sets a derived field on a frozen
instance:

```python
from dataclasses import dataclass, field

@dataclass(frozen=True, slots=True)
class LineItem:
    sku: str
    unit_cents: int
    quantity: int
    total_cents: int = field(init=False)

    def __post_init__(self) -> None:
        if self.quantity <= 0:
            raise ValueError(f"quantity must be positive, got {self.quantity}")
        object.__setattr__(self, "total_cents", self.unit_cents * self.quantity)
```

`self.total_cents = ...` there would raise `FrozenInstanceError` — the guard does not know it is
being called from initialisation.

## Frozen stops assignment, not mutation

The rule from [1](01-what-immutability-freezes.md) applies unchanged: the guard protects the
*attribute bindings*, not the objects they point at.

```python
@dataclass(frozen=True)
class Tenant:
    name: str
    regions: list[str]

t = Tenant("acme", ["eu"])
t.regions = ["us"]            # FrozenInstanceError
t.regions.append("us")        # 🔴 works — the list is not frozen
```

The fix is the tuple's fix: make each field hold an immutable value, `regions: tuple[str,
...]`, and, for a set, `frozenset[str]`.

## When the generated `__hash__` exists — and when it fails

> *"If *eq* and *frozen* are both true, by default `@dataclass` will generate a `__hash__`
> method for you.  If *eq* is true and *frozen* is false, `__hash__` will be set to `None`,
> marking it unhashable (which it is, since it is mutable).  If *eq* is false, `__hash__` will
> be left untouched"*

> *"Having a `__hash__` implies that instances of the class are immutable."*

So a plain `@dataclass` is **unhashable** — `{Tenant(...)}` is a `TypeError` — and a frozen
one is hashable *if its fields are*. The generated hash combines the field values, so a
`list` field makes `hash()` fail at the moment you first use the instance as a key, not at
definition. That is the tuple rule from [3](03-hashability.md) — hashable only if every element
is — reappearing one level up. `unsafe_hash=True` forces a hash on a mutable class; the
documentation calls that *"a specialized use case"* that *"should be considered carefully"*.

## Equality and ordering compared to a tuple

**Equality, 3.13 onwards.** The generated `__eq__` *"compares the class by comparing each field
in order"* and requires *"the identical type"*. It used to compare tuples of fields, and 3.13
changed that:

> *"The generated `__eq__` method now compares each field individually (for example, `self.a ==
> other.a and self.b == other.b`), rather than comparing tuples of fields as in previous
> versions. This change makes the comparison faster but it may alter results in cases where
> attributes compare equal by identity but not by value (such as `float('nan')`)."*

The mechanism behind that caveat: tuple comparison first asks whether the two items are the
same object, because *"the built-in containers typically assume identical objects are equal to
themselves"* ([9](09-comparison-and-ordering.md)). Field-by-field `==` does not. So a dataclass
whose field holds a NaN — a missing sensor reading, a failed division — compared equal to a
copy of itself on 3.12 and does not on 3.13+. (Comparing an instance with *itself* is still
true: CPython 3.14's generated method begins `if self is other: return True`. A copy is a
different object and gets the field-by-field test.)

**Ordering.** `order=True` generates `__lt__` and friends, which *"compare the class as if it
were a tuple of its fields, in order. Both instances in the comparison must be of the identical
type."* Two consequences: field declaration order is sort order, exactly as for a tuple; and a
base-class instance and a subclass instance cannot be ordered against each other — the method
returns `NotImplemented`, and `sorted()` raises.

## Getting a tuple back out

`dataclasses.astuple` exists for the APIs that need a tuple, and it is deeper than it looks:

> *"Converts the dataclass *obj* to a tuple … dataclasses, dicts, lists, and tuples are recursed
> into. Other objects are copied with `copy.deepcopy`."*

The documentation gives the shallow alternative in the same entry:

```python
from dataclasses import fields

row = tuple(getattr(item, f.name) for f in fields(item))
```

## Gotchas

**★ Symptom: `FrozenInstanceError` from inside `__post_init__`.** Cause: assigning a derived
field on a frozen instance goes through the raising `__setattr__`, even during initialisation.
Fix: use the same escape hatch the generated `__init__` uses.

```python
def __post_init__(self) -> None:
    object.__setattr__(self, "total_cents", self.unit_cents * self.quantity)
```

**★ Symptom: `TypeError: unhashable type: 'list'` the first time a frozen dataclass is used as a
dict key.** Cause: the generated `__hash__` hashes the field values, and one field is a list —
frozen or not, the record inherits hashability from its worst member. Fix: immutable field
types.

```python
@dataclass(frozen=True, slots=True)
class Tenant:
    name: str
    regions: tuple[str, ...]
```

**★ Symptom: after moving to Python 3.13+, `assert reading == copy.copy(reading)` fails for
readings with a missing value.** Cause: the value is `float("nan")`, and the generated `__eq__`
now compares fields individually — NaN is never `==` itself, and the tuple comparison's
identity shortcut no longer applies. Fix: represent "missing" as `None`, or compare with an
explicit NaN-aware check.

```python
import math

def same_reading(a, b) -> bool:
    return a.sensor == b.sensor and (
        a.value == b.value or (math.isnan(a.value) and math.isnan(b.value))
    )
```

**Symptom: `TypeError: unhashable type` when adding a plain `@dataclass` instance to a set.**
Cause: with `eq=True` and `frozen=False`, `__hash__` is set to `None` — documented as
*"marking it unhashable (which it is, since it is mutable)"*. Fix: freeze it if it is a value.

```python
@dataclass(frozen=True)
class Coordinate:
    lat: float
    lon: float
```

**Symptom: `sorted(orders)` raises `TypeError` when the list mixes `Order` and `RushOrder(Order)`
instances.** Cause: the generated ordering methods require *"the identical type"* and return
`NotImplemented` across a subclass boundary. Fix: sort by an explicit key.

```python
from operator import attrgetter

orders.sort(key=attrgetter("due", "order_id"))
```

**Symptom: `astuple(report)` was slow and returned copies of objects the caller expected to be
shared.** Cause: `astuple` recurses into dataclasses, dicts, lists and tuples and
`copy.deepcopy`s everything else. Fix: the documented shallow form.

```python
row = tuple(getattr(report, f.name) for f in fields(report))
```

**Symptom: `t.regions.append("us")` on a frozen record succeeded.** Cause: `frozen=True` blocks
rebinding the attribute, not mutating the list it holds. Fix: store a tuple.

```python
t = Tenant("acme", ("eu",))
```

## Interview questions

**★ Is a frozen dataclass immutable?**
Its attribute bindings are: the decorator adds a `__setattr__` and `__delattr__` that raise
`FrozenInstanceError`. The documentation is precise that this *emulates* immutability — *"It is
not possible to create truly immutable Python objects"* — and `object.__setattr__` bypasses the
guard, which is how the generated `__init__` itself works. And, like a tuple, it freezes only one
level: a list stored in a field is fully mutable.

**★ When does a dataclass get a `__hash__`?**
By default, when both `eq` and `frozen` are true. With `eq=True, frozen=False` — the default
configuration — `__hash__` is set to `None` and instances are unhashable, which the documentation
justifies by mutability. With `eq=False` the inherited identity-based hash is kept. The generated
hash is computed from the fields, so it can still raise if a field holds an unhashable value.

**What changed about dataclass equality in 3.13, and why does it matter?**
The generated `__eq__` stopped building tuples of the fields and comparing those, and now
compares each field with `==` in turn. It is faster, but tuple comparison checks identity before
equality, so a field holding the *same* NaN object used to compare equal and no longer does. Any
test or deduplication relying on a record with a NaN field equalling a copy of itself changed
behaviour on upgrade.

**How do you set a derived field in a frozen dataclass?**
In `__post_init__`, with `object.__setattr__(self, name, value)`, declaring the field with
`field(init=False)` so callers do not pass it. Ordinary assignment raises `FrozenInstanceError`
even during initialisation. `dataclasses.replace` constructs through `__init__`, so the derived
field is recomputed on every copy — something a `NamedTuple`'s `_replace` cannot promise.

**How does `order=True` relate to tuple ordering?**
Directly: the generated methods *"compare the class as if it were a tuple of its fields, in
order"*, so they inherit lexicographic comparison, including its traps — declaration order is
sort priority, and a `None` in an early field raises the moment two instances tie on the fields
before it. Unlike tuples, both operands must be of the identical type. For sorting by anything
other than declaration order, a `key=` function is clearer than reordering the fields.

---

← [When a dataclass beats a 4-tuple](08d-when-a-dataclass-beats-a-tuple.md) · [Topic index](README.md) · Next → [Comparison and ordering](09-comparison-and-ordering.md)
