---
title: "A sync job is three set differences over keys, never over records — and the keys have to be the same value on both sides before the algebra means anything, because a set treats `42` and `\"42\"`, a `UUID` and its string, and `(42,)` and `42` as different elements and reports the mismatch as a table's worth of creates and deletes"
sidebar_label: "9 · Diffing ID sets"
sidebar_position: 22
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [Set Types](https://docs.python.org/3.14/library/stdtypes.html#set-types-set-frozenset),
> [dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects),
> [`int`](https://docs.python.org/3.14/library/functions.html#int) and
> [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html#sqlite3.Cursor.row_factory) (rows are
> tuples); CPython v3.14.7 [`Lib/uuid.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/uuid.py)
> (`UUID.__eq__`) for what the docs do not state — marked as implementation detail. Documentation-verified — **no sandbox run, no program output**.

**Every "sync the upstream into our table" job asks the same three questions — what is upstream and
not here, what is here and not upstream, and what is in both but different. The first two are set
differences and the third is an intersection followed by a comparison. The algebra is
[3](03-set-algebra-instead-of-nested-loops.md); what this page adds is everything that has to be true
of the keys before the algebra means anything. A database hands you `int`s inside one-element tuples,
an API hands you strings, a UUID column hands you `UUID` objects, and a set compares all of them with
`==` — which says `42 != "42"` without raising. A diff over mismatched keys does not fail; it reports
every row as both new and deleted, and the job that applies it does exactly that.**

## The shape of every sync

Index both sides by the key, do the algebra on the key views, and look at values only for keys in
both:

```python
import sqlite3
from dataclasses import dataclass

Row = tuple[str, int]                           # (name, price_cents): the fields the sync writes


@dataclass(frozen=True)
class SyncPlan:
    to_create: tuple[int, ...]
    to_update: tuple[int, ...]
    to_delete: tuple[int, ...]


def load_existing(con: sqlite3.Connection) -> dict[int, Row]:
    rows = con.execute("SELECT external_id, name, price_cents FROM products")
    return {external_id: (name, price_cents) for external_id, name, price_cents in rows}


def index_incoming(records: list[dict]) -> dict[int, Row]:
    indexed: dict[int, Row] = {}
    for record in records:
        key = parse_external_id(record["id"])                     # defined below
        if key in indexed:
            raise ValueError(f"upstream sent id {key} twice")
        indexed[key] = (record["name"], record["price_cents"])
    return indexed


def plan_sync(existing: dict[int, Row], incoming: dict[int, Row]) -> SyncPlan:
    in_both = existing.keys() & incoming.keys()
    return SyncPlan(
        to_create=tuple(sorted(incoming.keys() - existing.keys())),
        to_update=tuple(sorted(k for k in in_both if existing[k] != incoming[k])),
        to_delete=tuple(sorted(existing.keys() - incoming.keys())),
    )
```

Four decisions are baked in, and each is a gotcha when it is missing:

- **The algebra runs on keys, not records.** A record is usually a dict (unhashable), and even a
  hashable record would make every edit look like a delete of the old version plus a create of the
  new one.
- **Key views need no conversion.** `existing.keys() - incoming.keys()` returns a plain `set`
  ([3d](03d-views-and-abc-sets-as-operands.md)).
- **A duplicate in the input is an error, not a last-write-wins** — more in
  [9b](09b-composite-keys-nulls-and-values.md).
- **Everything that leaves the function is sorted**, so logs, retries and the SQL issued are the same
  on every run ([6](06-iteration-order.md)).

The whole plan is linear in the sizes of the two inputs: one pass to index each side, then
differences and an intersection that are linear on the 3.14 cost table.

## When the values are hashable: diff the items views

A `sqlite3` row is a tuple — *"If `None`, a row is represented as a `tuple`"* for the default
[`row_factory`](https://docs.python.org/3.14/library/sqlite3.html#sqlite3.Cursor.row_factory) — so
`(name, price_cents)` is hashable, and the docs allow a shortcut:

> *"Items views also have set-like operations since the (key, value) pairs are unique and the keys
> are hashable. If all values in an items view are hashable as well, then the items view can
> interoperate with other sets."* —
> [Dictionary view objects](https://docs.python.org/3.14/library/stdtypes.html#dictionary-view-objects)

```python
def plan_sync_by_items(existing: dict[int, Row], incoming: dict[int, Row]) -> SyncPlan:
    new_or_changed = incoming.items() - existing.items()          # {(key, value), ...}
    return SyncPlan(
        to_create=tuple(sorted(k for k, _ in new_or_changed if k not in existing)),
        to_update=tuple(sorted(k for k, _ in new_or_changed if k in existing)),
        to_delete=tuple(sorted(existing.keys() - incoming.keys())),
    )
```

One difference finds every pair upstream has that we do not — a new key, or a known key with a
different value. It stops working the moment a value is a dict or a list: the view has to hash each
`(key, value)` pair to build a set, a pair holding a dict is unhashable, and the subtraction raises
`TypeError`. Per-key comparison (`plan_sync`) has no such requirement — `==` between two dicts is
fine.

## A key is not equal to its own spelling

The diff is only as good as `==` between a key from one side and the same entity's key from the
other. Every mismatch below produces **no error** — just a `to_create` and a `to_delete` that each
contain nearly everything:

| Database side | API side | Why they differ |
|---|---|---|
| `42` (`INTEGER` column) | `"42"` (JSON string) | an `int` never equals a `str` |
| `(42,)` from `set(cursor)` | `42` | a row is a tuple, even with one column |
| `UUID('1b4e28ba-…')` | `"1b4e28ba-…"` | `UUID.__eq__` returns `NotImplemented` for a non-`UUID` |
| `"1b4e28ba-…"` (lowercase) | `"1B4E28BA-…"` | strings compare by code point |
| `(tenant_id, 42)` | `42` | a composite key is a tuple |
| `42` | `True` | not a mismatch — `True == 1`, and that is its own bug ([7](07-equal-but-distinct-elements.md)) |

The UUID and composite-key rows — and `NULL` keys — are [9b](09b-composite-keys-nulls-and-values.md).
The rule for all of them: **pick one canonical type per key — the one the data store uses — and convert both
sides at the boundary**, before either reaches a set. A tripwire catches whatever slips through, before
anything is applied:

```python
def assert_one_key_type(*key_sets: set) -> None:
    key_types = {type(key) for keys in key_sets for key in keys}
    if len(key_types) > 1:
        raise TypeError(f"diff mixes key types: {sorted(t.__name__ for t in key_types)}")
```

### Integer IDs: `int()` is a converter, not a validator

`int(value)` is the obvious normaliser, and it accepts far more than an ID:

> *"Optionally, the string can be preceded by `+` or `-` (with no space in between), have leading
> zeros, be surrounded by whitespace, and have single underscores interspersed between digits."* ·
> *"The values 0--9 can be represented by any Unicode decimal digit."* —
> [`int`](https://docs.python.org/3.14/library/functions.html#int)

The docs' own example is `int('   -12_345\n')`, which returns `-12345`. So `"042"`, `" 42"`, `"4_2"`,
`"+42"` and `"٤٢"` (Arabic-Indic digits) all become `42`. If the upstream system treats IDs as
opaque strings, `int()` merges IDs it considers distinct; if it treats them as numbers, `int()` hides
a malformed payload. Parse strictly:

```python
import re

_CANONICAL_ID = re.compile(r"[1-9][0-9]*")        # [0-9] is ASCII; \d would match any Nd digit


def parse_external_id(value: object) -> int:
    if isinstance(value, bool):                   # True is an int: see 7
        raise TypeError("id must not be a boolean")
    if isinstance(value, int) and value > 0:
        return value
    if isinstance(value, str) and _CANONICAL_ID.fullmatch(value):
        return int(value)
    raise ValueError(f"not a canonical external id: {value!r}")
```

If the upstream says its IDs are strings, keep them as strings in a text column — the conversion you
never make is the one that cannot go wrong.

## Gotchas

**★ Symptom: the first run of a new sync plans to delete every product and create every product.**
Cause: the database side is `int` and the API side is `str`; `42 != "42"`, so the two key sets are
disjoint. Nothing raises. Fix: parse both sides to the store's type, and trip on mixed types before
applying anything.

```python
existing = {parse_external_id(k) for k in existing_raw}
incoming = {parse_external_id(item["id"]) for item in payload["items"]}
assert_one_key_type(existing, incoming)
```

**★ Symptom: `to_delete` holds every ID even though the API returned all of them.** Cause:
`set(con.execute("SELECT external_id FROM products"))` is a set of one-element tuples — a row is a
tuple even with one column — and `(42,) != 42`. Fix: unpack the column.

```python
existing = {external_id for (external_id,) in con.execute("SELECT external_id FROM products")}
```

**★ Symptom: the items-view diff started raising `TypeError` the day upstream added a nested
`"dimensions"` object.** Cause: `incoming.items() - existing.items()` hashes every `(key, value)`
pair, and a pair holding a dict is unhashable. Fix: project each value to the hashable fields the
sync writes, or fall back to per-key comparison.

```python
incoming = {key: (rec["name"], rec["price_cents"]) for key, rec in raw_incoming.items()}
new_or_changed = incoming.items() - existing.items()
```

**Symptom: upstream products `"007"` and `"7"` became one row, and one of them overwrites the other
on every run.** Cause: `int()` accepts leading zeros, so two distinct string IDs normalise to `7`.
The same happens to `" 7"`, `"+7"`, `"0_7"` and non-ASCII digits. Fix: parse strictly — or, if the
upstream's IDs are strings, keep them strings.

```python
if not (isinstance(raw, str) and _CANONICAL_ID.fullmatch(raw)):
    raise ValueError(f"not a canonical external id: {raw!r}")
```

## Interview questions

**★ How would you compute what a sync job has to create, update and delete, given the rows in your
table and the records from an API?**
Index both sides by a normalised key into dicts. `incoming.keys() - existing.keys()` is what to
create, `existing.keys() - incoming.keys()` is what to delete, and for each key in
`existing.keys() & incoming.keys()` compare the stored fields with the incoming ones to decide the
updates. Sort every output list so the plan is reproducible. It is linear in the two input sizes;
the nested loop it replaces is quadratic.

**★ A new sync job's first run wants to delete every existing row and create every incoming one.
What do you check first?**
That the two key sets have any element in common, and then the types of their elements. The
signature of a key mismatch is two disjoint sets of equal-looking values: `int` against `str`, a
one-element row tuple against a scalar, a `UUID` against its string, or two spellings of the same
hex. None of these raises, because `==` between different types is simply `False`. The fix is to
normalise both sides to one type at the boundary, and a check that the combined set of element types
has exactly one member prevents the next regression.

**Why diff keys rather than whole records?**
Records are usually dicts and cannot go into a set at all. And even hashable records would turn every
edit into a disappearance of the old record plus an appearance of a new one — the diff would say
"delete and create" where the job needs "update". Keys carry identity; values carry state. Diff the
identity with set algebra and compare the state per key.

**When can you subtract two dict items views, and what breaks it?**
When every value in the views is hashable — tuples of scalars, for instance, which is what a
database row is. Then `incoming.items() - existing.items()` yields every `(key, value)` pair that is
new or changed, in one operation. It breaks when any value is a dict or a list, because building the
set means hashing each pair, and the subtraction raises `TypeError`.

**Why is `int()` a poor way to normalise ID strings?**
Because it is designed to be forgiving: it strips surrounding whitespace, accepts a sign, leading
zeros and single underscores between digits, and any Unicode decimal digit. Distinct upstream IDs
such as `"007"` and `"7"` collapse into one key, and malformed input is silently accepted. A strict
pattern such as `[1-9][0-9]*` with `fullmatch` validates the canonical form before converting — or,
if the upstream defines IDs as strings, you keep them as strings.

---

← Prev: [When identity is the equality you want](08b-identity-elements.md) · [Topic index](README.md) · Next → [Composite keys, NULLs and values](09b-composite-keys-nulls-and-values.md)
