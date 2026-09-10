---
title: "`namedtuple` builds a real tuple subclass with a name for every position — still indexable, still unpackable, no per-instance dictionary — and every one of its extra methods starts with an underscore so your field names cannot collide with them"
sidebar_label: "8 · namedtuple"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against the Python 3.14 library reference —
> [`collections.namedtuple`](https://docs.python.org/3.14/library/collections.html#collections.namedtuple)
> and the [glossary entry for *named tuple*](https://docs.python.org/3.14/glossary.html#term-named-tuple);
> the [`json` conversion table](https://docs.python.org/3.14/library/json.html#py-to-json-table);
> and CPython 3.14 [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/3.14/Lib/collections/__init__.py)
> for what the factory generates and its error text. Documentation-verified — **no sandbox run**.
> Version spine: **CPython 3.14**.

**The cure for `record[3]` is a name, and the cheapest way to add names without changing
anything else is a named tuple: the same object, the same equality, the same hash, the same
unpacking — plus attribute access. `collections.namedtuple` is a factory that writes that
class for you. It generates a `tuple` subclass with `__slots__ = ()`, so instances carry no
dictionary and cost what a plain tuple costs; it adds three methods and two attributes, all
underscore-prefixed so a field can never shadow them; and because the result genuinely *is*
a tuple, every property of this topic — immutability one level deep, hashability inherited
from the contents, positional unpacking — carries over unchanged. That last fact is both the
reason to choose it and, as [8d](08d-when-a-dataclass-beats-a-tuple.md) argues, the reason to
stop choosing it.**

## What "named tuple" means

The glossary defines the concept independently of any factory:

> *"The term "named tuple" applies to any type or class that inherits from tuple and whose
> indexable elements are also accessible using named attributes.  The type or class may have
> other features as well."*

> *"Several built-in types are named tuples, including the values returned by
> `time.localtime` and `os.stat`.  Another example is `sys.float_info`"* —
> [glossary — *named tuple*](https://docs.python.org/3.14/glossary.html#term-named-tuple)

> *"Such a class can be written by hand, or it can be created by inheriting
> `typing.NamedTuple`, or with the factory function `collections.namedtuple`. The latter
> techniques also add some extra methods that may not be found in hand-written or built-in
> named tuples."*

So `os.stat(path).st_size` and `os.stat(path)[6]` read the same field, and the result also
unpacks — which is why [6b](06b-unpacking-library-results.md) recommends the names.

## The factory

> *"Returns a new tuple subclass named *typename*.  The new subclass is used to create
> tuple-like objects that have fields accessible by attribute lookup as well as being
> indexable and iterable."* —
> [`collections.namedtuple`](https://docs.python.org/3.14/library/collections.html#collections.namedtuple)

```python
from collections import namedtuple

Invoice = namedtuple("Invoice", ["number", "customer", "total_cents", "currency"])

inv = Invoice("INV-1042", "acme", 129_900, "EUR")
inv.total_cents          # 129900 — by name
inv[2]                   # 129900 — by position, same field
number, customer, total_cents, currency = inv    # unpacks like any tuple
```

*field_names* may also be one string — *"with each fieldname separated by whitespace and/or
commas, for example `'x y'` or `'x, y'`"* — so `namedtuple("Invoice", "number customer
total_cents currency")` is the same class.

## What the factory actually writes

CPython 3.14's implementation builds the class from one namespace dict and a call to
`type()` — this is the source, not output:

```python
class_namespace = {
    '__doc__': f'{typename}({arg_list})',
    '__slots__': (),
    '_fields': field_names,
    '_field_defaults': field_defaults,
    '__new__': __new__,
    '_make': _make,
    '__replace__': _replace,
    '_replace': _replace,
    '__repr__': __repr__,
    '_asdict': _asdict,
    '__getnewargs__': __getnewargs__,
    '__match_args__': field_names,
}
for index, name in enumerate(field_names):
    doc = _sys.intern(f'Alias for field number {index}')
    class_namespace[name] = _tuplegetter(index, doc)

result = type(typename, (tuple,), class_namespace)
```

Each field is a class-level descriptor that reads one slot of the tuple — `inv.total_cents`
is `inv[2]` with a name on it.

Four consequences follow directly, and each is worth knowing by its line:

- **`(tuple,)`** — the only base is `tuple`, so `isinstance(inv, tuple)` is true and every
  tuple operation works: `len`, `in`, slicing, `+`, `hash`, comparison.
- **`'__slots__': ()`** — no per-instance `__dict__`. The documentation's promise: *"Named
  tuple instances do not have per-instance dictionaries, so they are lightweight and require
  no more memory than regular tuples."*
- **`'__match_args__': field_names`** — positional class patterns work:
  `case Invoice(number, customer, total, "EUR"):`.
- **No `__eq__`, no `__hash__`, no `__lt__`** — the namespace defines none, so they are
  inherited from `tuple` unchanged. An `Invoice` compares and hashes exactly like the plain
  4-tuple with the same items. Hold that thought; it is the whole of
  [8d](08d-when-a-dataclass-beats-a-tuple.md).

## The extras, and why they start with an underscore

> *"In addition to the methods inherited from tuples, named tuples support three additional
> methods and two attributes.  To prevent conflicts with field names, the method and
> attribute names start with an underscore."*

Field names, correspondingly, may not: *"Any valid Python identifier may be used for a
fieldname except for names starting with an underscore."*

```python
row = ("INV-1042", "acme", 129_900, "EUR")

inv = Invoice._make(row)                   # from any iterable of the right length
inv._asdict()                              # {'number': 'INV-1042', ..., 'currency': 'EUR'}
paid = inv._replace(total_cents=0)         # new instance; inv is unchanged
Invoice._fields                            # ('number', 'customer', 'total_cents', 'currency')
getattr(inv, "customer")                   # field whose name is in a string
Invoice(**{"number": "INV-7", "customer": "globex", "total_cents": 5, "currency": "USD"})
```

`_make` is the documented bridge from row-returning APIs — *"Named tuples are especially
useful for assigning field names to result tuples returned by the `csv` or `sqlite3`
modules"*:

```python
import sqlite3

conn = sqlite3.connect("billing.db")
cursor = conn.execute("SELECT number, customer, total_cents, currency FROM invoices")
invoices = [Invoice._make(r) for r in cursor.fetchall()]
```

`_replace` is also reachable through the generic `copy.replace()` added in 3.13 (the
namespace above sets `__replace__`), and 3.13 changed its failure mode: *"Raise `TypeError`
instead of `ValueError` for invalid keyword arguments."* `_asdict` returns a regular `dict`
since 3.8.

## Defaults, renaming, pickling

**Defaults apply from the right.** *"Since fields with a default value must come after any
fields without a default, the *defaults* are applied to the rightmost parameters."*

```python
Invoice = namedtuple("Invoice", "number customer total_cents currency", defaults=["EUR"])
Invoice("INV-9", "acme", 100)              # currency defaults to "EUR"
Invoice._field_defaults                    # {'currency': 'EUR'}
```

**`rename=True` repairs bad names** — *"invalid fieldnames are automatically replaced with
positional names. For example, `['abc', 'def', 'ghi', 'abc']` is converted to `['abc',
'_1', 'ghi', '_3']`"* — which matters when field names come from a CSV header or a query you
do not control.

**Pickling looks the class up by name.** *"To support pickling, the named tuple class should
be assigned to a variable that matches *typename*."* The `module=` parameter sets
`__module__` for classes created somewhere other than where they are importable.

**Subclassing adds behaviour, never fields.** The documented pattern keeps `__slots__ = ()`
— *"This helps keep memory requirements low by preventing the creation of instance
dictionaries"* — and a new field means a new type built from `_fields`:

```python
class Money(namedtuple("Money", "amount_cents currency")):
    __slots__ = ()

    @property
    def major_units(self) -> float:
        return self.amount_cents / 100

TaxedMoney = namedtuple("TaxedMoney", Money._fields + ("tax_cents",))
```

The class-syntax version with type annotations is [8b · `typing.NamedTuple`](08b-typing-namedtuple.md).

## Gotchas

**★ Symptom: `json.dumps(invoice)` produced `["INV-1042", "acme", 129900, "EUR"]` — the field
names are gone.** Cause: the `json` encoder maps `list, tuple` to an array, and a named tuple
*is* a tuple (`isinstance` is true), so it is encoded positionally. Fix: encode the dict.

```python
json.dumps(invoice._asdict())
```

**★ Symptom: a subclass of a named tuple accepts `inv.note = "late"` — the record is no longer
closed.** Cause: the subclass omitted `__slots__ = ()`, so its instances gained a `__dict__`;
the generated base has empty slots but a subclass without them adds a dictionary. Fix: declare
empty slots on every subclass, as the documentation's example does.

```python
class Money(namedtuple("Money", "amount_cents currency")):
    __slots__ = ()
```

**★ Symptom: `ValueError: Field names cannot start with an underscore: '_id'` when building a
record type from a MongoDB document or a query result.** Cause: the factory rejects leading
underscores to protect `_make`, `_replace` and friends (CPython's message, from
`Lib/collections/__init__.py`). Fix: rename at the boundary, or let `rename=True` do it.

```python
Doc = namedtuple("Doc", ["_id", "title", "class"], rename=True)
Doc._fields            # ('_0', 'title', '_2') — keywords and _-names become positional
```

**Symptom: `pickle.dumps(record)` fails, or a worker process cannot unpickle it.** Cause: the
class was created as `Record = namedtuple("Row", …)` — the name the class reports (`Row`) is
not the name it is importable under (`Record`). Fix: make them match, at module level.

```python
Row = namedtuple("Row", "id name")
```

**Symptom: code that caught `ValueError` around `_replace(...)` stopped catching a misspelt
field.** Cause: since 3.13 invalid keyword arguments raise `TypeError` — CPython's
`'Got unexpected field names: …'`. Fix: catch `TypeError`, or better, do not catch at all —
a misspelt field is a bug.

```python
paid = inv._replace(total_cents=0)       # a typo here should crash in tests
```

**Symptom: `TypeError: Expected 4 arguments, got 5` from `Invoice._make(row)`.** Cause: the CSV
gained a column; `_make` checks the length exactly. Fix: select the columns explicitly.

```python
invoices = [Invoice._make(r[:4]) for r in csv.reader(fh)]
```

**Symptom: the "wrong" field got the default.** Cause: *defaults* bind to the rightmost fields,
so `defaults=[0]` on `"balance type"` defaults `type`, not `balance`. Fix: put defaulted fields
last, in the order the defaults are listed.

```python
Account = namedtuple("Account", ["type", "balance"], defaults=[0])   # balance defaults to 0
```

## Interview questions

**★ What does `collections.namedtuple` actually create?**
A new class, built with `type(typename, (tuple,), namespace)`, whose only base is `tuple`. The
namespace adds `__new__` with the field names as parameters, `__slots__ = ()` so there is no
instance dictionary, `__repr__`, `__match_args__`, `__getnewargs__` for pickling, and the
underscore-prefixed `_make`, `_replace`, `_asdict`, `_fields` and `_field_defaults`. It defines
no comparison or hash methods, so those are the tuple's own. Each field is a class-level
descriptor that reads one slot by index.

**★ Why do the extra methods start with an underscore?**
To keep the field namespace free. The documentation says so directly — *"To prevent conflicts
with field names, the method and attribute names start with an underscore"* — and forbids field
names that start with one. Because each field becomes a class attribute, a field called `count`
or `index` is allowed and simply shadows the inherited tuple method of that name on that class
(the method stays reachable as `tuple.count(record, value)`); a field called `replace` or
`make` can never collide with `_replace` or `_make`.

**Does a named tuple cost more memory than a plain tuple?**
Per instance, the documentation says no: *"Named tuple instances do not have per-instance
dictionaries, so they are lightweight and require no more memory than regular tuples."* The
names live once on the class. That guarantee holds only while `__slots__ = ()` holds — a subclass
that forgets to redeclare it gets a `__dict__` on every instance. Beyond that statement I have no
documented figure for exact sizes, and none is needed to make the choice.

**How do you add a field to an existing named tuple type?**
You make a new type. The documentation is explicit that *"subclassing is not useful for adding
new, stored fields"*, because the storage is the tuple itself; build the new type from the old
one's field list, `namedtuple("Point3D", Point._fields + ("z",))`. Existing instances of the old
type are unaffected and are not instances of the new one.

**How would you turn database rows into named records?**
`Record._make(row)` for each row, which the documentation recommends for exactly this — result
tuples from `csv` and `sqlite3`. `_make` checks that the row length matches the field count and
raises `TypeError` if not, so select explicit columns rather than `SELECT *`, where a schema
migration adding a column would break the load.

**Why must the variable name match the `typename`?**
Because pickle serialises a class by reference — module and name — and looks it up again on
load. If `Record = namedtuple("Row", …)`, the class calls itself `Row`, and there is no `Row` in
the module to find. The documentation states the requirement; the `module=` argument exists for
factories that create the class somewhere other than where it will be imported from.

---

← [Checking tuples at runtime](07d-checking-tuples-at-runtime.md) · [Topic index](README.md) · Next → [`typing.NamedTuple`](08b-typing-namedtuple.md)
