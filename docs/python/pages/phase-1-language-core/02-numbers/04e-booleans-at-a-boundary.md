---
title: "json keeps a boolean value and loses a boolean key, and SQLite has no boolean at all"
sidebar_label: "4e · Writing a bool out"
sidebar_position: 44
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference
> ([`json`](https://docs.python.org/3.14/library/json.html),
> [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html),
> [`argparse`](https://docs.python.org/3.14/library/argparse.html),
> [`bool()`](https://docs.python.org/3.14/library/functions.html#bool),
> [Boolean Type — `bool`](https://docs.python.org/3.14/library/stdtypes.html#boolean-type-bool)).
> Version spine: **Python 3.14.7**.

**Inside one process, `bool` being an `int` is a nuisance you can guard against. On
the way *out* of the process it is data loss, and the two stdlib boundaries lose it
in opposite places. `json` keeps boolean **values** — its conversion table maps
`True` to `true` and back — but coerces every **key** to a string, so a dictionary
grouped by a predicate does not survive the round trip; the docs say so outright:
*"`loads(dumps(x)) != x` if x has non-string keys."* `sqlite3` is the mirror image:
it has no boolean storage class at all, so a `bool` goes in through the `int` adapter
as `INTEGER` and comes back as the integer `1`, values and all. Neither raises,
neither warns, and both failures surface far from the write.**

## JSON: values survive, keys do not

The conversion table is unambiguous for values — Python `True` serialises to JSON
`true`, and `true` deserialises back to `True`. Keys are a different mechanism:

> *"Keys in key/value pairs of JSON are always of the type `str`. When a dictionary
> is converted into JSON, all the keys of the dictionary are coerced to strings. As
> a result of this, if a dictionary is converted into JSON and then back into a
> dictionary, the dictionary may not equal the original one. That is,
> `loads(dumps(x)) != x` if x has non-string keys."*

A boolean key is not exotic — it is the natural output of grouping by a predicate,
which is exactly the operation `bool`-as-`int` makes so convenient in the first
place:

```python
grouped = {}
for r in responses:
    grouped.setdefault(r.status >= 400, []).append(r)
# keys are True and False
```

Serialise that and the keys become `"true"` and `"false"`. Every later lookup with a
real boolean misses, and it misses *silently* — a `.get(True, [])` returns the
default rather than raising.

Normalise before serialising:

```python
payload = {str(k).lower(): v for k, v in grouped.items()}
```

Better still, do not key a wire format on a boolean at all. Two named fields —
`{"errors": [...], "ok": [...]}` — survive every round trip, document themselves, and
leave room for a third state later. A boolean key is a schema that cannot grow.

Note the asymmetry once more, because it is the part that misleads: **the values are
fine.** A `{"active": True}` payload round-trips perfectly. It is only the key
position that loses the type, so the bug appears exclusively in code that groups,
buckets or indexes by a predicate.

## SQLite: no boolean storage class, so it comes back as `1`

The `sqlite3` default adapter table maps `None` → `NULL`, `int` → `INTEGER`,
`float` → `REAL`, `str` → `TEXT`, `bytes` → `BLOB`. **`bool` is not in the table**,
and it does not need to be — a `bool` *is* an `int`, so it takes the `int` row and is
stored as `INTEGER`. The loss is on the way back: the reverse table maps `INTEGER` to
`int`.

```python
cur.execute("INSERT INTO flags(active) VALUES (?)", (True,))    # stored as 1
row = cur.execute("SELECT active FROM flags").fetchone()
row[0] is True        # False — it is the int 1
```

Two fixes, and which one is right depends on how much of the codebase is affected.

**Convert at the edge**, for a small number of columns:

```python
active = bool(row[0])
```

**Register a converter**, when booleans are pervasive. The `sqlite3` docs describe
the extension mechanism: *"you can store additional Python types in an SQLite
database via object adapters, and you can let the `sqlite3` module convert SQLite
types to Python types via converters."* Declare the column `BOOLEAN` and open the
connection with `detect_types=sqlite3.PARSE_DECLTYPES`:

```python
sqlite3.register_converter("BOOLEAN", lambda b: b != b"0")
con = sqlite3.connect(path, detect_types=sqlite3.PARSE_DECLTYPES)
```

The converter receives the raw `bytes` from the column, which is the detail that
catches people out — it is not handed an `int`.

The same shape appears with any driver over any database whose boolean is an integer,
and with any ORM where the column type was never declared. It also appears in reverse
in a `WHERE` clause: `WHERE active = 1` and `WHERE active = TRUE` are the same query
in SQLite and different queries in a database with a real boolean type, so the
portability bug and the round-trip bug travel together.

## Gotchas

### `loads(dumps(x)) != x`

**Symptom.** A grouped-by-predicate dict comes back from JSON with `"true"` and
`"false"` string keys, and every subsequent lookup misses — silently, if the lookup
uses `.get` with a default.
**Cause.** JSON object keys are always strings, and `json` coerces non-string keys.
**Fix.** Convert boolean keys to explicit names before serialising, or restructure
the payload into two named fields.

### A boolean written to SQLite reads back as an `int`

**Symptom.** `row[0] is True` is `False`, and a tri-state check takes the wrong
branch.
**Cause.** SQLite has no boolean storage class; `bool` is stored through the `int`
adapter as `INTEGER`, and `INTEGER` converts back to `int`.
**Fix.** `bool(row[0])` at the boundary, or declare the column `BOOLEAN` and register
a converter with `detect_types=sqlite3.PARSE_DECLTYPES`. The converter receives
`bytes`, not an `int`.




### `WHERE active = 1` works here and not there

**Symptom.** A query ported from SQLite to a database with a real boolean type
returns nothing, or raises a type error.
**Cause.** SQLite stores the boolean as an integer, so `= 1` matches; a database with
a genuine boolean type does not accept the comparison.
**Fix.** Bind a Python `bool` as a parameter and let the driver render it, rather
than writing the literal into the SQL.


## Interview questions

**A grouped-by-predicate dict survives `json.dumps` but not the round trip. Why?**
JSON object keys are always strings, and `json` coerces non-string keys on the way
out. The docs state it directly: *"`loads(dumps(x)) != x` if x has non-string
keys."* `True` becomes `"true"`, so every later lookup with a real boolean misses.
Boolean *values* are unaffected — the conversion table maps `True` to `true` and back.

**You wrote `True` to a SQLite column and read back `1`. Is that a bug in the driver?**
No. SQLite has no boolean storage class, and the `sqlite3` default adapter table maps
`int` to `INTEGER` — `bool` needs no entry of its own because it *is* an `int`. The
reverse mapping turns `INTEGER` back into `int`. Convert at the boundary with
`bool()`, or declare the column `BOOLEAN` and register a converter with
`detect_types=sqlite3.PARSE_DECLTYPES`.




**When is it acceptable to key a dictionary on a boolean?**
Inside one process, for a short-lived grouping that never crosses a boundary — the
output of a partition, consumed immediately. The moment it is serialised, stored, or
cached across processes, it needs named keys, because the boolean will come back as a
string or an integer.


---

← Prev: [Booleans and the type system](04d-booleans-and-the-type-system.md) · Index: [Numbers](README.md) · Next → [Reading a bool in](04f-reading-a-bool-in.md)
