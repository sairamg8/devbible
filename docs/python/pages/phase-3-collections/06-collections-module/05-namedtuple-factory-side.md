---
title: "namedtuple() is a class factory that validates names, compiles a __new__ with eval and calls type() on every invocation — so it belongs at module level, never per row or per request, and the names you feed it from a CSV header or a SQL cursor are where it fails"
sidebar_label: "05 · namedtuple from the factory side"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 against the Python 3.14 documentation — [`collections.namedtuple`](https://docs.python.org/3.14/library/collections.html#collections.namedtuple) (field-name rules, *rename*, *module*, pickling, `_asdict` history, `_replace` and `copy.replace`, writable docstrings), [`sqlite3` — row factories](https://docs.python.org/3.14/library/sqlite3.html#how-to-create-and-use-row-factories), [`sqlite3.Row`](https://docs.python.org/3.14/library/sqlite3.html#sqlite3.Row), [`pickle`](https://docs.python.org/3.14/library/pickle.html#what-can-be-pickled-and-unpickled), [`types.SimpleNamespace`](https://docs.python.org/3.14/library/types.html#types.SimpleNamespace). What one call does read from CPython **v3.14.7** [`Lib/collections/__init__.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/collections/__init__.py) (`namedtuple`, lines 361–533) and `_tuplegetter` in [`Modules/_collectionsmodule.c`](https://github.com/python/cpython/blob/v3.14.7/Modules/_collectionsmodule.c). Target: **Python 3.14.7**. **No sandbox run, no timings.**

**Everything about a named tuple *being a tuple* — equality with plain tuples, hashing, unpacking, `_make`/`_asdict`/`_replace`, defaults, `typing.NamedTuple`, what the class syntax forbids, and when a dataclass is the better record — is in the tuple topic, starting at [8 · `namedtuple`](../02-tuple/08-named-records.md). This chunk is the other side: `namedtuple` is a *function*, and each call does real work. It splits and validates the field names, generates the source of a `__new__` method as a string and compiles it with `eval`, builds a namespace of methods and descriptors, calls `type()` to create a brand-new class, and inspects the caller's stack frame to decide which module the class claims to live in. Called once at import time, none of that matters. Called inside a row factory, a request handler or a loop, it creates a new, unrelated class every time — so rows from two queries are different types, `isinstance` checks fail, pickling fails, and the documentation's own `sqlite3` recipe does exactly this per row. And the field names that break it are the ones real data brings: headers with spaces and hyphens, columns named `class` or `count(*)`, keys starting with `_`.**

## What one call does

In `v3.14.7`, `namedtuple(typename, field_names, *, rename=False, defaults=None, module=None)` runs, in order:

1. **Normalise names** — a string is split on commas and whitespace; every name is passed through `str`; the type name is interned.
2. **Validate** (or, with `rename=True`, replace bad names with `_0`, `_1`, …) — the errors below.
3. **Build `__new__` from source text:**

   ```python
   # Lib/collections/__init__.py, v3.14.7, lines 446–447
   code = f'lambda _cls, {arg_list}: _tuple_new(_cls, ({arg_list}))'
   __new__ = eval(code, namespace)
   ```

4. **Build the namespace** — `__slots__ = ()`, `_fields`, `_field_defaults`, `_make`, `_replace`, `__replace__`, `__repr__`, `_asdict`, `__getnewargs__`, `__match_args__`, and one `_tuplegetter(index, doc)` descriptor per field.
5. **Create the class** — `result = type(typename, (tuple,), class_namespace)`.
6. **Pick `__module__`** — if `module` was not given, `sys._getframemodulename(1) or '__main__'`: the module *of the code that called `namedtuple`*.

Two consequences run through the rest of this page: **each call returns a distinct class**, and **that class believes it lives wherever the call happened.**

## The per-row class

The `sqlite3` documentation shows this row factory:

```python
from collections import namedtuple

def namedtuple_factory(cursor, row):
    fields = [column[0] for column in cursor.description]
    cls = namedtuple("Row", fields)
    return cls._make(row)
```

— and notes that *"With some adjustments, the above recipe can be adapted to use a `dataclass`, or any other custom class"*. As written, it runs all six steps above **for every row fetched**, including the `eval`. A 10,000-row result creates 10,000 classes named `Row`; no two rows share a type; and each row keeps its own class alive. The fix is to build each distinct shape once:

```python
import sqlite3
from collections import namedtuple
from functools import lru_cache


@lru_cache(maxsize=256)
def _row_class(fields: tuple[str, ...]) -> type:
    return namedtuple("Row", fields, rename=True)


def namedtuple_factory(cursor: sqlite3.Cursor, row: tuple) -> tuple:
    fields = tuple(column[0] for column in cursor.description)
    return _row_class(fields)._make(row)
```

`lru_cache` needs hashable arguments, hence the tuple of names. Or skip the factory: `sqlite3.Row` is, in its documentation's words, *"a highly optimized `row_factory`"* that supports *"mapping access by column name and index"* — `row["total_cents"]` and `row[2]` — and *"Two `Row` objects compare equal if they have identical column names and values."*

The same bug hides in any helper that converts records "generically":

```python
def to_record(data: dict[str, object]) -> tuple:
    Record = namedtuple("Record", data.keys())        # 🔴 a new class per call
    return Record(**data)
```

Define record types at module level, named, once — the documentation's pickling rule already requires it: *"To support pickling, the named tuple class should be assigned to a variable that matches *typename*."*

## Why a per-call class breaks pickling

`pickle` stores instances by *reference to their class* — module and qualified name — and the class must be importable on the other side (*"classes accessible from the top level of a module"*). A class made inside a function is not reachable as `module.Row`; a class made by a shared helper claims the *helper's* module as `__module__` (step 6), which is usually not where any variable called `Row` exists. Both surface as a pickling error the first time the records cross a process boundary — a multiprocessing pool, a pickle-based cache, a task queue.

`module=` exists for factories that create classes on behalf of another module; combine it with a module-level assignment of the same name in that module:

```python
# billing/records.py
from collections import namedtuple

Invoice = namedtuple("Invoice", "number customer total_cents currency", module=__name__)
```

## The names real data brings

Step 2 in `v3.14.7` raises `ValueError` with these messages (quoted from the source):

| Input | Error |
|---|---|
| `"first name"` given in a list | `Type names and field names must be valid identifiers: 'first name'` |
| `"e-mail"`, `"count(*)"`, `"2fa"` | `Type names and field names must be valid identifiers: …` |
| `"class"`, `"from"`, `"def"` | `Type names and field names cannot be a keyword: …` |
| `"_id"` | `Field names cannot start with an underscore: '_id'` |
| `"id"` twice (a join) | `Encountered duplicate field name: 'id'` |
| more defaults than fields | `TypeError: Got more default values than field names` |

(A space-separated *string* of names is split, so `"first name"` inside a single string becomes two fields, `first` and `name` — a different bug.)

`rename=True` makes all of these succeed by replacing each invalid name with `_` plus its position — *"For example, `['abc', 'def', 'ghi', 'abc']` is converted to `['abc', '_1', 'ghi', '_3']`"*. That keeps a CSV import running and leaves you with fields called `_1` and `_3`. Usually better: normalise the names yourself, so the attributes are readable and stable:

```python
import csv
import keyword
import re
from collections import namedtuple


def field_name(header: str) -> str:
    name = re.sub(r"\W+", "_", header.strip().lower()).strip("_") or "column"
    if name[0].isdigit() or keyword.iskeyword(name):
        name = f"f_{name}"
    return name


with open("customers.csv", newline="") as fh:
    reader = csv.reader(fh)
    headers = next(reader)
    Customer = namedtuple("Customer", [field_name(h) for h in headers], rename=True)
    customers = [Customer._make(row) for row in reader]
```

`rename=True` stays as the backstop for duplicates the normaliser produces (`"E-mail"` and `"e mail"` both become `e_mail`). This builds one class per file, not per row.

## Details that change behaviour

**Fields are C descriptors that refuse assignment.** Each field is a `_tuplegetter`; its `__set__` raises `AttributeError("can't set attribute")`, and `__slots__ = ()` means there is nowhere to put a new attribute either. The immutability itself is the tuple topic's ([1 · What immutability freezes](../02-tuple/01-what-immutability-freezes.md)).

**`_asdict()` returns a plain `dict`** since 3.8: *"Returns a regular `dict` instead of an `OrderedDict`. As of Python 3.7, regular dicts are guaranteed to be ordered. If the extra features of `OrderedDict` are required, the suggested remediation is to cast the result to the desired type: `OrderedDict(nt._asdict())`."*

**`copy.replace()` works on named tuples** — *"Named tuples are also supported by generic function `copy.replace()`"* — because the namespace sets `__replace__` to `_replace`. Since 3.13 an unknown field raises `TypeError` (the source's `Got unexpected field names: …`), not `ValueError`.

**Docstrings are writable** — *"Docstrings can be customized by making direct assignments to the `__doc__` fields"*, e.g. `Book.id.__doc__ = '13-digit ISBN'`, which is how a module-level record type gets documentation that `help()` shows.

**The mutable alternative is not a namedtuple.** The documentation's own pointer: *"See `types.SimpleNamespace()` for a mutable namespace based on an underlying dictionary instead of a tuple."* — attribute access, a readable `repr`, and *"Unlike `object`, with `SimpleNamespace` you can add and remove attributes."* For a typed, validated record, [8d · When a dataclass beats a 4-tuple](../02-tuple/08d-when-a-dataclass-beats-a-tuple.md).

## Gotchas

**★ Symptom: fetching rows is far slower with a named-tuple row factory than with plain tuples, and `type(row1) is type(row2)` is `False`.** Cause: the factory calls `namedtuple()` per row, so every row pays for validation, an `eval` and a `type()` call, and gets its own class. Fix: cache the class per column tuple — or use `sqlite3.Row`.

```python
@lru_cache(maxsize=256)
def _row_class(fields: tuple[str, ...]) -> type:
    return namedtuple("Row", fields, rename=True)
```

**★ Symptom: records pickle fine in tests and fail when sent to a worker process.** Cause: the class was created inside a function or by a shared helper, so it is not importable as `module.TypeName` — pickle stores classes by reference. Fix: define the type at module level with a matching name, and pass `module=` when a helper creates it for another module.

```python
Invoice = namedtuple("Invoice", "number customer total_cents currency", module=__name__)
```

**★ Symptom: `ValueError: Type names and field names must be valid identifiers: 'e-mail'` importing a CSV.** Cause: headers are rarely identifiers — spaces, hyphens, leading digits, keywords, duplicates. Fix: normalise the headers, with `rename=True` as the backstop.

```python
Customer = namedtuple("Customer", [field_name(h) for h in headers], rename=True)
```

**Symptom: after `rename=True`, code reads `row._3` and nobody knows what column 3 was.** Cause: `rename` replaces invalid names with positional `_N` names. Fix: normalise to meaningful names first; reserve `rename` for collisions.

```python
Customer = namedtuple("Customer", [field_name(h) for h in headers], rename=True)
```

**Symptom: `isinstance(row, Row)` is `False` for a row that prints as `Row(...)`.** Cause: the `Row` you imported and the class of that row are two different classes that happen to share a name — one per `namedtuple()` call. Fix: one module-level class; check `_fields` if you must duck-type.

```python
assert type(row)._fields == ("id", "email")
```

**Symptom: an `AttributeError` for `move_to_end` (or another `OrderedDict` method) on the result of `_asdict()`, in code written before 3.8.** Cause: since 3.8 `_asdict()` returns a regular `dict`. Fix: the documentation's remediation.

```python
ordered = OrderedDict(record._asdict())
```

**Symptom: code catching `ValueError` around `record._replace(...)` stopped catching a misspelt field.** Cause: 3.13 changed it to `TypeError`. Fix: catch `TypeError` — or do not catch; a misspelt field is a bug.

```python
updated = copy.replace(record, total_cents=0)
```

## Interview questions

**★ What does calling `collections.namedtuple()` actually do?**
It builds a new class at runtime. It normalises and validates the field names (or renames the invalid ones), generates the source of a `__new__` taking those names as parameters and compiles it with `eval`, assembles a namespace with `__slots__ = ()`, the underscore methods and one C descriptor per field, calls `type(typename, (tuple,), namespace)`, and sets `__module__` to the caller's module unless `module=` is given. That is why it belongs at module level: each call is real work and returns a class unrelated to every other call's.

**★ What is wrong with creating a named tuple class inside a row factory or a request handler?**
Three things. Cost — every call repeats validation, an `eval` and class creation. Identity — every call returns a different class, so `isinstance` and `type(a) is type(b)` comparisons between rows fail and each row pins its own class object. Pickling — the class is not importable under its name from its claimed module, so the rows cannot cross a process boundary. Cache one class per distinct field tuple, or use a purpose-built row type such as `sqlite3.Row`.

**How does a named tuple class decide which module it belongs to, and why does that matter?**
If `module` is not passed, `namedtuple` sets `__module__` from the caller's frame — `sys._getframemodulename(1)` in 3.14. `pickle` records a class as module plus name and imports it on load, so a class created by a helper in `utils.py` on behalf of `billing.py` claims to be `utils.Invoice`, which does not exist. Pass `module=` to name the right module and assign the class there under its `typename`, which is also the documentation's pickling requirement.

**What does `rename=True` do, and when is it the wrong fix?**
It replaces every invalid field name — keywords, non-identifiers, names starting with `_`, duplicates — with an underscore and its position, as in the documentation's `['abc', '_1', 'ghi', '_3']`. It is a good backstop when names come from data you do not control, and a bad primary fix, because attributes named `_1` and `_3` are unreadable and change meaning if the column order changes. Normalise names to readable identifiers first and keep `rename=True` for the collisions normalisation creates.

**Named tuple, `SimpleNamespace` or dataclass for a record?**
A named tuple when you need a lightweight, immutable, hashable record that also behaves as a tuple — a dict or `Counter` key, a replacement for an existing tuple-returning API. `SimpleNamespace` when you need a mutable bag of attributes with a readable `repr` and no schema — the documentation describes it as a *"mutable namespace based on an underlying dictionary"*. A dataclass when the record is part of an interface and should have types, defaults, validation and equality that does not leak to plain tuples ([8d](../02-tuple/08d-when-a-dataclass-beats-a-tuple.md)).

---

← Prev: [04c · `deque` during iteration and across threads](04c-deque-iteration-and-threads.md) · [Topic index](README.md) · Next → [06 · `ChainMap` — layered lookup](06-chainmap-layered-lookup.md)
