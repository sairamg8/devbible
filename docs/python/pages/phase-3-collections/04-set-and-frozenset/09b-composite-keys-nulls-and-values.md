---
title: "A key is more than its type — a UUID equals none of its spellings, a tenant-scoped ID is half a key, every NULL collapses into one `None`, a duplicate in the payload silently drops a record, and an update check that compares a `Decimal` with a `float` or a naive `datetime` with an aware one flags every row on every run"
sidebar_label: "9b · Composite keys, NULLs and values"
sidebar_position: 23
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-10 on **Python 3.14.7** against the library reference —
> [`uuid.UUID`](https://docs.python.org/3.14/library/uuid.html#uuid.UUID),
> [`json.loads`](https://docs.python.org/3.14/library/json.html#json.loads) (`parse_float`),
> [`datetime`](https://docs.python.org/3.14/library/datetime.html#datetime.datetime) (comparisons, `fromisoformat`)
> and [`sqlite3`](https://docs.python.org/3.14/library/sqlite3.html#sqlite3.Cursor.row_factory);
> CPython v3.14.7 [`Lib/uuid.py`](https://github.com/python/cpython/blob/v3.14.7/Lib/uuid.py)
> (`__eq__`, `__hash__`, the hex-string parser) — implementation detail, marked where used. Split out of
> [9 · Diffing ID sets](09-diffing-id-sets.md) on a concept boundary. Documentation-verified — **no
> sandbox run, no program output**.

**[9](09-diffing-id-sets.md) builds the diff and makes an integer key mean the same thing on both
sides. Real keys are often not integers: a `UUID` column hands back objects that equal no string, a
per-tenant ID is only half of the key, and a nullable external-ID column puts `None` into the set.
And the third question of every sync — *what changed?* — compares values with `==`, which has the
same blind spots one level down. Each of these produces a plan that is wrong without an exception
anywhere.**

## UUIDs: normalise to `UUID`, not to a string

> *"When a string of hex digits is given, curly braces, hyphens, and a URN prefix are all
> optional."* · `UUID.hex`: *"The UUID as a 32-character lowercase hexadecimal string."* —
> [`uuid.UUID`](https://docs.python.org/3.14/library/uuid.html#uuid.UUID)

`str(some_uuid)` is built from `hex`, so it is always lowercase and hyphenated; an upstream that sends
uppercase or braces produces strings that never match it. In 3.14.7 `UUID.__eq__` compares `self.int`
only when the other side is a `UUID` and returns `NotImplemented` otherwise, and `__hash__` is
`hash(self.int)` (`Lib/uuid.py`, implementation detail) — so a `UUID` is never equal to any string.
Parse every side into `UUID`:

```python
import uuid


def parse_uuid(value: object) -> uuid.UUID:
    if isinstance(value, uuid.UUID):
        return value
    if isinstance(value, str):
        return uuid.UUID(value)        # either case, braces, hyphens, "urn:uuid:" prefix
    raise TypeError(f"expected a UUID or its string form, got {type(value).__name__}")


def account_diff(con, payload: dict) -> tuple[set, set]:
    existing = {parse_uuid(v) for (v,) in con.execute("SELECT public_id FROM accounts")}
    incoming = {parse_uuid(item["public_id"]) for item in payload["items"]}
    return incoming - existing, existing - incoming
```

The same page says *"Comparison with a non-UUID object raises a `TypeError`"* — that is the ordering
operators; `==` against a string is simply `False`. So `sorted()` over a set that mixes `UUID`s and
strings raises, while the diff over the same data silently reports everything.

## Composite keys: an ID unique per tenant is half a key

Diffing bare IDs across tenants merges tenant A's order 42 with tenant B's. The key is the tuple
`(tenant_id, order_id)`, and a JSON array arrives as a list, which is unhashable, so build the tuple
explicitly:

```python
def order_keys(con, payload: dict) -> tuple[set, set]:
    existing = set(con.execute("SELECT tenant_id, external_id FROM orders"))    # rows are tuples
    incoming = {(item["tenant_id"], parse_external_id(item["id"])) for item in payload["items"]}
    return existing, incoming
```

Here `set(cursor)` is correct *because* the whole row is the key — the default `row_factory` returns
each row as a tuple, and a tuple of scalars is hashable. With one selected column it is the one-tuple
bug from [9](09-diffing-id-sets.md). The other way to be correct is to **scope the existing side to
the same slice the incoming side covers**: a sync that fetches one tenant's orders must load one
tenant's rows, or `existing - incoming` contains every other tenant.

```python
def tenant_existing(con, tenant_id: int) -> set[int]:
    rows = con.execute("SELECT external_id FROM orders WHERE tenant_id = ?", (tenant_id,))
    return {external_id for (external_id,) in rows}
```

## `None` is an ordinary element

Rows whose external ID is `NULL` all become the single element `None`: the set collapses them, and
`None` lands in `to_delete` whenever upstream (correctly) sends no such ID. Those rows are not part of
the sync — they are rows the sync does not own. Exclude them before the diff and report them
separately:

```python
def split_owned(con) -> tuple[set[int], list[int]]:
    rows = con.execute("SELECT id, external_id FROM products").fetchall()
    unmapped = [local_id for local_id, external_id in rows if external_id is None]
    owned = {external_id for _, external_id in rows if external_id is not None}
    return owned, unmapped
```

What SQL then does with a `NULL` inside `IN` or `NOT IN` is a different set of rules again —
**9c · Applying the diff** *(not written yet)*.

## Duplicates in the payload

A dict built from the payload keeps one record per key — the last — and the set of its keys has no
way to show that a second record existed ([3](03-set-algebra-instead-of-nested-loops.md)). The
cheap check is a length comparison; the useful one names every offender at once:

```python
from collections import Counter


def duplicate_ids(records: list[dict]) -> list[int]:
    counts = Counter(parse_external_id(record["id"]) for record in records)
    return sorted(key for key, n in counts.items() if n > 1)


def checked_ids(records: list[dict]) -> set[int]:
    if dupes := duplicate_ids(records):
        raise ValueError(f"upstream sent {len(dupes)} duplicated ids: {dupes[:20]}")
    return {parse_external_id(record["id"]) for record in records}
```

Note the order: parse first, count second. Two records whose raw IDs are `"7"` and `7` are
duplicates only after normalisation.

## Updates: the values must compare too

`existing[k] != incoming[k]` has the key problem one level down. A `NUMERIC` price read as `Decimal`
does not equal the `float` that `json.loads` produced for `19.99`
([7](07-equal-but-distinct-elements.md)). Every such row is reported as changed on every run, and a
job that writes "changed" rows rewrites the table nightly. Parse to the store's type at the
boundary:

> *"If set, a function that is called with the string of every JSON float to be decoded. If `None`
> (the default), it is equivalent to `float(num_str)`. This can be used to parse JSON floats into
> custom datatypes, for example `decimal.Decimal`."* —
> [`json.loads`, *parse_float*](https://docs.python.org/3.14/library/json.html#json.loads)

```python
import json
from decimal import Decimal


def incoming_prices(response_body: str) -> dict[int, Decimal]:
    payload = json.loads(response_body, parse_float=Decimal)
    return {parse_external_id(item["id"]): item["price"] for item in payload["items"]}
```

Timestamps fail the same way with a different rule:

> *"Naive and aware `datetime` objects are never equal."* —
> [`datetime` objects](https://docs.python.org/3.14/library/datetime.html#datetime.datetime), supported operations, note 4

`datetime.fromisoformat("2011-11-04T00:05:23Z")` — the docs' own example — returns an **aware**
datetime in UTC. A column that comes back **naive** never equals it, so every row "changed". Pick one
convention (aware UTC is the one that survives a daylight-saving change) and convert on the way in:

```python
from datetime import UTC, datetime


def as_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)
```

`replace(tzinfo=UTC)` on a naive value is an assertion that the store holds UTC — make it only if
that is true. And compare **only the fields the sync writes**. A tuple that includes `updated_at` or
an ETag differs whenever anything touched the row, including the sync itself.

## Gotchas

**★ Symptom: after moving account IDs to a `uuid` column, every account is re-created on sync.**
Cause: the driver now returns `uuid.UUID` objects and the API sends strings — or the API sends
uppercase hex and the table stores lowercase text. A `UUID` equals no string, and two spellings of
one hex value are two strings. Fix: `parse_uuid` on both sides.

```python
existing = {parse_uuid(v) for (v,) in con.execute("SELECT public_id FROM accounts")}
incoming = {parse_uuid(item["public_id"]) for item in payload["items"]}
```

**Symptom: logging `sorted(to_create)` raises `TypeError` in a job that computed the diff without
complaint.** Cause: the set mixes `UUID` objects with strings — `==` between them is `False`, which
the diff tolerates, but `<` between them raises, which `sorted` does not. Fix: the cause is the mixed
set, not the logging; normalise, and trip on mixed types (`assert_one_key_type` in
[9](09-diffing-id-sets.md)).

```python
assert_one_key_type(existing, incoming)
```

**★ Symptom: syncing tenant A deleted tenant B's orders.** Cause: the existing side was loaded for
every tenant and the incoming side for one, so `existing - incoming` contained all of B. Fix: scope
the existing query to exactly what the fetch covers — `tenant_existing` above — or diff
`(tenant_id, id)` tuples.

**Symptom: the plan wants to delete `None`, or a `DELETE` for it matches nothing and the job reports
success.** Cause: nullable external IDs put `None` into the existing set, and upstream never sends it.
Fix: exclude `NULL` rows before the diff and report them as unmapped — `split_owned` above.

**★ Symptom: a product that appears twice in the upstream feed flips between two prices on
alternate runs.** Cause: the payload is indexed by a dict comprehension, which keeps the last record
per key, and the feed's order is not stable. Fix: detect duplicates after parsing and refuse the
payload.

```python
ids = checked_ids(payload["items"])
```

**★ Symptom: the sync "updates" every row on every run, and the audit table grows by the whole
catalogue nightly.** Cause: a value comparison across types — `Decimal` against `float`, naive
`datetime` against aware — or an `updated_at` in the compared tuple. Fix: parse to the store's types
and compare only written fields.

```python
payload = json.loads(response_body, parse_float=Decimal)
incoming = {parse_external_id(i["id"]): (i["name"], i["price"]) for i in payload["items"]}
```

**Symptom: comparing a stored timestamp with the API's raises `TypeError` in a `max()` or a sort,
but `==` never complained.** Cause: order comparison between naive and aware datetimes raises; the
equality comparison is simply `False`. Fix: `as_utc` on both sides before any comparison.

```python
changed = as_utc(stored_published_at) != as_utc(datetime.fromisoformat(item["published_at"]))
```

## Interview questions

**★ Is `uuid.UUID(s) in {s}` true?**
No. In CPython 3.14.7, `UUID.__eq__` returns `NotImplemented` for anything that is not a `UUID`, so
the comparison falls back to identity and is `False`; the hash is `hash(self.int)`, unrelated to the
string's hash anyway. Ordering comparisons with a non-`UUID` raise `TypeError`, as the docs state, so
a mixed collection can be diffed silently and then fail when you sort it. Parse everything into
`UUID`, which accepts either case, braces, hyphens and the `urn:uuid:` prefix.

**★ Your sync covers one tenant at a time. What goes wrong if the "existing" side is loaded for the
whole table?**
`existing - incoming` then contains every row of every other tenant, and the job deletes them. The
two operands of a difference must describe the same universe. Either scope the existing query with
the same filter the fetch used, or make the tenant part of the key so rows from different tenants
can never be confused.

**Why can't a nullable column be diffed as it is?**
Because every `NULL` becomes the same element, `None`. The set collapses however many unmapped rows
there are into one element, and that element shows up in `existing - incoming` because upstream never
sends it. Unmapped rows are outside the sync's ownership: filter them out first and report them.

**How do you detect duplicates in a payload before indexing it?**
Parse the IDs, then compare `len(ids)` with `len(set(ids))` for a cheap yes/no, or count them with a
`Counter` to name the duplicates. Parsing first matters — `"7"` and `7` only become duplicates after
normalisation. Indexing into a dict first hides the problem, because a dict keeps the last record
per key.

**Why does an update check report every row as changed on every run?**
Because it compares values across types that are never equal: a `Decimal` from a `NUMERIC` column
against a `float` parsed from JSON, a naive `datetime` against an aware one, or a tuple that includes
a field the database changes on every write, such as `updated_at`. Parse to the store's types at the
boundary — `parse_float=Decimal`, one timezone convention — and compare only the fields the sync
writes.

---

← Prev: [Diffing ID sets](09-diffing-id-sets.md) · [Topic index](README.md) · Next → **9c · Applying the diff** *(not written yet)*
