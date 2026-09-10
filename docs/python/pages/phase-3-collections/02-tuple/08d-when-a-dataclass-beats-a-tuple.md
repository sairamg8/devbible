---
title: "A dataclass beats a 4-tuple the moment the record crosses a module boundary — because a named tuple still equals any tuple with the same items, still collides with it as a dict key, and still unpacks, which makes every new field a breaking change"
sidebar_label: "8d · When a dataclass beats a 4-tuple"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against [PEP 557 — Data Classes, *Why not just use namedtuple?*](https://peps.python.org/pep-0557/#why-not-just-use-namedtuple);
> the Python 3.14 [`dataclasses`](https://docs.python.org/3.14/library/dataclasses.html) reference;
> the [`collections.namedtuple`](https://docs.python.org/3.14/library/collections.html#collections.namedtuple)
> reference; the [glossary entry for *hashable*](https://docs.python.org/3.14/glossary.html#term-hashable);
> and CPython 3.14 [`Objects/tupleobject.c`](https://github.com/python/cpython/blob/3.14/Objects/tupleobject.c)
> (`tuple_richcompare`) for why a named tuple equals a plain tuple. Documentation-verified —
> **no sandbox run**. Version spine: **CPython 3.14**.

**The syllabus question — when does a dataclass beat a 4-tuple? — has a precise answer, and
it is not "when you want names". A named tuple already has names. The dividing line is
*tuple-ness*: a named tuple is a tuple, so it is equal to every other tuple with the same
items, it hashes to the same dict slot as them, it has a length, it supports `in` over its
fields, it sorts field-by-field, and it unpacks positionally. Inside one function those are
conveniences. Across a module boundary each is a way for two unrelated records to be
confused, or for a new field to break a caller you have never seen. PEP 557 lists these
exact costs as the reason dataclasses exist. A frozen, slotted, keyword-only dataclass
removes all of them and adds a validation hook — and the tuple still wins for keys, pairs and
the APIs that demand one.**

## What PEP 557 says is wrong with named tuples

> *"Any namedtuple can be accidentally compared to any other with the same number of fields.
> For example: `Point3D(2017, 6, 2) == Date(2017, 6, 2)`.  With Data Classes, this would
> return False."*

> *"A namedtuple can be accidentally compared to a tuple.  For example, `Point2D(1, 10) ==
> (1, 10)`.  With Data Classes, this would return False."*

> *"Instances are always iterable, which can make it difficult to add fields."*

> *"No option for mutable instances. / Cannot specify default values. / Cannot control which
> fields are used for `__init__`, `__repr__`, etc. / Cannot support combining fields by
> inheritance."* — [PEP 557](https://peps.python.org/pep-0557/#why-not-just-use-namedtuple)

⚠️ One item on that 2017 list is stale: named tuples gained defaults — `namedtuple(...,
defaults=...)` in 3.7 and class-body defaults in `typing.NamedTuple` from 3.6.1. The rest
still stand, and on `typing.NamedTuple` specifically the PEP adds: *"This produces a
namedtuple, so it shares namedtuples benefits and some of its downsides.  Data Classes,
unlike typing.NamedTuple, support combining fields via inheritance."*

## Why the equality leak happens

The factory defines no `__eq__` or `__hash__` ([8](08-named-records.md)), so a named tuple
uses the tuple's. CPython 3.14's `tuple_richcompare` starts with

```c
if (!PyTuple_Check(v) || !PyTuple_Check(w))
    Py_RETURN_NOTIMPLEMENTED;
```

and `PyTuple_Check` accepts any tuple subclass. So the comparison never looks at the class —
only at the items. Hashing follows equality, as it must (*"Hashable objects which compare
equal must have the same hash value"*), which turns an equality curiosity into a data bug:

```python
from typing import NamedTuple

class PriceKey(NamedTuple):
    sku: str
    region: str

class StockKey(NamedTuple):
    sku: str
    warehouse: str

cache = {}
cache[PriceKey("A-100", "eu")] = 1999          # a price in cents
cache[StockKey("A-100", "eu")] = 12            # 🔴 overwrites the price: equal keys
cache[("A-100", "eu")]                         # 12 — a bare tuple finds it too
```

Two record types that mean different things share one slot because their items happen to
match. The same happens in a `set`, in `lru_cache`, and in any `==` in a test.

## The other tuple behaviours that leak

```python
inv = Invoice("INV-1", "acme", 129_900, "EUR")      # a NamedTuple

len(inv)                     # 4 — a record has a length
"acme" in inv                # True — membership searches every field
inv + ("paid",)              # a plain 5-tuple: the name and type are gone
max(invoices)                # compares number, then customer, then total...
number, *_ = inv             # unpacking: every caller that does this breaks on a new field
```

None of these is wrong for a tuple. Each is an accident waiting in a record: a
`"acme" in inv` that should have been `inv.customer == "acme"` and matches the wrong field; a
`max(invoices)` that sorts by invoice number because that happens to be field zero; and the
unpacking that [7](07-multiple-return-values.md) showed makes adding a field a breaking change.

## What a dataclass does instead

```python
from dataclasses import dataclass

@dataclass(frozen=True, slots=True, kw_only=True)
class Invoice:
    number: str
    customer: str
    total_cents: int
    currency: str = "EUR"

    def __post_init__(self) -> None:
        if self.total_cents < 0:
            raise ValueError(f"negative total on {self.number}: {self.total_cents}")

inv = Invoice(number="INV-1", customer="acme", total_cents=129_900)
```

Each flag closes one of the leaks:

- **`eq` (the default)** — *"This method compares the class by comparing each field in order.
  Both instances in the comparison must be of the identical type."* A `PriceKey` never equals
  a `StockKey`, and never equals a plain tuple.
- **`frozen=True`** — assignment raises; and with `eq` *"If *eq* and *frozen* are both true, by
  default `@dataclass` will generate a `__hash__` method for you"*, so it is still a valid dict
  key — just one that only equals its own type.
- **No `__iter__`, no `__len__`, no `__getitem__`** — the decorator generates none, so
  `number, *_ = inv` is a `TypeError` from day one, and every caller uses attribute access,
  which survives new fields.
- **`kw_only=True`** — *"all fields will be marked as keyword-only"*, so the transposition bug
  from [7](07-multiple-return-values.md) cannot be written at construction.
- **`slots=True`** — generates `__slots__`, so, like a named tuple, no per-instance `__dict__`.
- **`__post_init__`** — the validation hook a named tuple does not have, and one that
  `dataclasses.replace` is documented to run.

The mechanics and traps of `frozen=True` itself — including why *"it is not possible to
create truly immutable Python objects"* — are [8e · Frozen dataclasses](08e-frozen-dataclasses.md).

## The decision

| | bare tuple | `namedtuple` / `NamedTuple` | `@dataclass(frozen=True, slots=True)` |
|---|---|---|---|
| fields by name | ❌ | ✅ | ✅ |
| equals a plain tuple with the same items | ✅ | ✅ 🔴 | ❌ |
| equals another record type with the same items | — | ✅ 🔴 | ❌ |
| positional unpacking | ✅ | ✅ | ❌ (by design) |
| `len`, `in`, indexing, slicing, `+` | ✅ | ✅ | ❌ |
| hashable when contents are | ✅ | ✅ | ✅ (generated `__hash__`) |
| validation hook | ❌ | subclass `__new__`, bypassed by `_replace` ([8c](08c-namedtuple-restrictions.md)) | `__post_init__`, run by `replace()` |
| keyword-only construction | ❌ | ❌ | ✅ `kw_only=True` |
| field inheritance | ❌ | ❌ | ✅ |
| no per-instance `__dict__` | ✅ | ✅ | ✅ with `slots=True` |
| accepted where a tuple is required | ✅ | ✅ | ❌ — convert with `astuple` or explicitly |

**A dataclass beats a 4-tuple** when the record is part of an interface — returned from a
public function, stored in a cache or a queue, passed between modules — and any of these hold:
two fields share a type, the shape may grow, it needs validation, or a different record type
with a compatible shape exists anywhere in the codebase.

**The tuple still wins** for a composite key built and consumed in one place
([4](04-tuples-as-keys.md)), a sort key ([9b](09b-sort-keys-and-priority-queues.md)), a pair
from `zip`, `enumerate` or `dict.items()`, `*args`, and every API that demands a tuple — DB-API
parameters, `%`-formatting ([5c](05c-when-a-library-requires-the-tuple.md)).

**A named tuple is the right upgrade** for an *existing* tuple-returning API: adding names
without breaking a single caller that indexes or unpacks is exactly what being a tuple buys, and
it is how `os.stat` and `time.localtime` gained names. Choose it for that; do not choose it for
a new public record.

## Gotchas

**★ Symptom: a cached price was replaced by a stock count.** Cause: two named tuples with
matching items compare equal and hash equal, so they are the same dict key — `tuple_richcompare`
only checks that both sides are tuples. Fix: dataclasses, whose generated `__eq__` requires the
identical type.

```python
@dataclass(frozen=True, slots=True)
class PriceKey:
    sku: str
    region: str

@dataclass(frozen=True, slots=True)
class StockKey:
    sku: str
    warehouse: str
```

**★ Symptom: `if "acme" in invoice:` matched invoices where "acme" was the *memo*, not the
customer.** Cause: a named tuple is a sequence; `in` searches every field. Fix: compare the
field you mean — and on a dataclass the `in` form is a `TypeError`, so it cannot be written by
accident.

```python
if invoice.customer == "acme":
    flag(invoice)
```

**★ Symptom: `max(invoices)` returns the invoice with the highest *number*, not the highest
total.** Cause: named tuples sort field by field, like any tuple, and the first field won. Fix:
say what you are ordering by.

```python
from operator import attrgetter

largest = max(invoices, key=attrgetter("total_cents"))
```

**Symptom: `invoice + ("paid",)` produced something with no `.customer`.** Cause: `+` is the
tuple's concatenation and returns a plain `tuple`. Fix: make a new record type with the extra
field, or use `_replace` for an existing field.

```python
PaidInvoice = namedtuple("PaidInvoice", Invoice._fields + ("paid_at",))
paid = PaidInvoice(*invoice, paid_at=now)
```

**Symptom: a library call that worked with a named tuple fails with a dataclass.** Cause: the
API required a real tuple — a DB-API parameter sequence, a `%`-format argument, an
`isinstance(x, tuple)` check. Fix: convert at the call, shallowly.

```python
from dataclasses import fields

params = tuple(getattr(inv, f.name) for f in fields(inv))
cursor.execute("INSERT INTO invoices VALUES (?, ?, ?, ?)", params)
```

## Interview questions

**★ When does a dataclass beat a 4-tuple?**
When the record is part of an interface and its tuple-ness becomes a liability. A bare tuple
has no names; a named tuple fixes that but remains a tuple, so it equals any tuple with the same
items, hashes to the same dict slot as them, supports `len`, `in` and field-by-field ordering,
and unpacks — which, as PEP 557 points out, makes adding a field break callers. A frozen,
slotted, keyword-only dataclass has names, compares only with its own type, cannot be unpacked
or transposed, and has `__post_init__` for validation. The tuple still wins for local keys,
pairs and tuple-requiring APIs.

**★ Why is `Point(1, 2) == (1, 2)` true for a named tuple?**
Because a named tuple defines no `__eq__`; it inherits the tuple's, and CPython's
`tuple_richcompare` only checks that both operands are tuples — `PyTuple_Check` accepts
subclasses — before comparing items. The class never enters into it. The same reasoning makes
two unrelated named tuple types with matching items equal, and because equal objects must hash
equal, they are also the same dict key.

**Why would you still pick a named tuple?**
To add names to something that is already a tuple without breaking anyone. Every caller that
indexes, unpacks, compares against a plain tuple or passes the value to a tuple-requiring API
keeps working, which is exactly why the standard library's `os.stat` and `time.localtime` results
are named tuples. It is also a reasonable choice for small, internal, genuinely tuple-like values
— coordinates, key parts — where equality with a plain tuple is harmless or even useful.

**Does `slots=True` make a dataclass as light as a named tuple?**
It removes the per-instance `__dict__`, which is the named tuple's documented advantage — *"no
per-instance dictionaries, so they are lightweight"*. The documentation does not give a size
comparison between a slotted dataclass instance and a tuple, and I have not measured one, so the
defensible statement is qualitative: both avoid a dictionary per instance; any remaining
difference is an implementation detail to measure if it matters at your scale.

**Why is `kw_only=True` especially valuable for records with several fields of the same type?**
Because positional construction is where transposition happens. `Invoice("acme", "INV-1", ...)`
type-checks if both fields are `str`; `Invoice(customer="acme", number="INV-1")` cannot be
wrong in that way. With `kw_only=True` the generated `__init__` rejects positional arguments
outright, so the safe spelling is the only one. The cost is that keyword-only fields are excluded
from `__match_args__`, so positional class patterns stop working and matches must use keyword
patterns.

---

← [What the class syntax forbids](08c-namedtuple-restrictions.md) · [Topic index](README.md) · Next → [Frozen dataclasses](08e-frozen-dataclasses.md)
