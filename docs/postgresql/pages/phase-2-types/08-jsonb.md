---
title: "jsonb vs json"
sidebar_label: "08 · jsonb vs json"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex33-types-core.mjs`.

**`json` stores the text you sent. `jsonb` parses it into a binary structure. Only `jsonb`
can be compared, indexed or queried efficiently — so `jsonb` is the answer unless you need
the original text byte-for-byte.**

## What each one keeps

```console
$ node ex33-types-core.mjs
=== 8. json vs jsonb ===
input : {"b": 1, "a": 2, "a": 3,   "nested": {"x": [1,2,3]}}
json  : {"b": 1, "a": 2, "a": 3,   "nested": {"x": [1,2,3]}} (56 bytes)
jsonb : {"a": 3, "b": 1, "nested": {"x": [1, 2, 3]}} (112 bytes)
  jsonb dropped the duplicate key, reordered, and normalised whitespace
```

Three differences visible in one line of output:

- **`json` is byte-identical to the input** — whitespace, key order and the duplicate `"a"`
  all preserved.
- **`jsonb` normalised it**: keys sorted, whitespace removed, and **the duplicate key
  resolved to the last value** (`"a": 3`). Object key order is not preserved and cannot be
  relied on.
- **`jsonb` was larger here — 112 bytes against 56.** That contradicts the usual claim that
  jsonb is more compact. On a small object the binary header and per-key offsets outweigh
  the whitespace saved; on large documents with repeated structure the balance shifts the
  other way. Do not choose between them on size.

## `jsonb` supports operators `json` does not

```console
json = json comparison                         ->  42883 operator does not exist: json = json
jsonb = jsonb comparison                       ok  {"eq":true}
```

**`json` has no equality operator at all** — so no `=`, no `DISTINCT`, no `GROUP BY`, no
`ORDER BY`, and no index that needs comparison. That alone rules it out for most uses.

`jsonb` adds the containment and existence operators that make querying practical:

```sql
b @> '{"tag":"t42"}'      -- contains this structure       (GIN-indexable)
b <@ '{...}'              -- is contained by
b ? 'tag'                 -- key exists                    (GIN-indexable)
b ?| array['a','b']       -- any of these keys exist
b ?& array['a','b']       -- all of these keys exist
b -> 'tag'                -- get as jsonb
b ->> 'tag'               -- get as text
b #> '{meta,n}'           -- get at path, as jsonb
b #>> '{meta,n}'          -- get at path, as text
b || '{"x":1}'            -- merge
b - 'tag'                 -- delete a key
jsonb_path_query(b, '$.items[*] ? (@.qty > 2)')   -- SQL/JSON path
```

## The query performance that decides it

```console
json  ->> filter (no index possible): 98.7 ms
jsonb ->> filter, no index          : 33.6 ms
jsonb @> containment, no index      : 40.3 ms
jsonb @> WITH a GIN index           : 9.4 ms | index 12 MB
the same GIN index on the json column          ->  42704 data type json has no default operator class for access method "gin"
```

200 000 rows. Even unindexed, **`jsonb` extraction was 3× faster than `json`** (33.6 ms vs
98.7 ms) because `json` must re-parse the text on every access. With a GIN index the
containment query drops to **9.4 ms — 10× faster than the `json` scan**.

And the last line is the decisive one: **you cannot build a GIN index on a `json` column at
all** (`42704`). Whatever the size comparison says, only `jsonb` can be indexed.

```sql
CREATE INDEX ON docs USING gin (b);                     -- all keys and values
CREATE INDEX ON docs USING gin (b jsonb_path_ops);      -- smaller, @> only
CREATE INDEX ON docs ((b->>'tag'));                     -- B-tree on one field
```

The third form is worth knowing: if you always filter on one field, a B-tree
[expression index](../phase-10-indexes/10-expression.md) is far smaller than a GIN index over
the whole document. The 12 MB GIN index above is the cost of being able to query *anything*.
More on the operator classes in [GIN and trigram indexes](../phase-10-indexes/11-gin-trgm.md).

## When to use jsonb at all

**Good reasons:**

- Genuinely schemaless data — webhook payloads, third-party API responses, audit snapshots.
- Sparse attributes that vary per row and are rarely queried.
- A document you store and return whole.

**Bad reasons, and the common mistake:** using `jsonb` for fields you know about and query
regularly. A column has types, constraints, defaults, cheap indexes and appears in `\d`;
a jsonb key has none of that. Every `->>'status'` is a string with no `CHECK` behind it, and
no foreign key can point at it.

```sql
-- the shape that usually wins
CREATE TABLE events (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       text NOT NULL,                    -- known, queried, constrained
  user_id    bigint REFERENCES users(id),      -- known, joined
  created_at timestamptz NOT NULL DEFAULT now(),
  payload    jsonb NOT NULL DEFAULT '{}'       -- genuinely variable
);
```

Promote a key to a real column as soon as you filter or join on it regularly — or add a
[generated column](../phase-3-ddl/15-generated-columns.md) over the jsonb path, which gives
you a typed, indexable column without changing how the data is written.

## From Node

```console
to JS: object {"id":1,"tag":"t1","meta":{"n":1}} | object
```

**Both `json` and `jsonb` arrive already parsed** — `pg` calls `JSON.parse` for you, so you
get a plain JavaScript object, not a string. Sending works the same way in reverse:

```js
// pass an object; pg serialises it
await pool.query('INSERT INTO events (kind, payload) VALUES ($1, $2)',
  ['signup', {source: 'web', ab: {variant: 'b'}}]);

// no JSON.stringify — that would store a JSON *string* containing JSON
await pool.query('INSERT INTO events (kind, payload) VALUES ($1, $2)',
  ['signup', JSON.stringify({source: 'web'})]);   // ← wrong: double-encoded
```

Two consequences worth remembering: a `bigint` inside jsonb comes back as a JavaScript
number (jsonb numbers are `numeric` server-side but `JSON.parse` makes doubles, so very
large values lose precision), and **key order in the object you get back is jsonb's sorted
order, not the order you inserted**.

## Trade-off

**`jsonb` buys schema flexibility with the loss of everything the schema gives you**:
constraints, foreign keys, per-column statistics, cheap B-tree indexes, and column names
visible in `\d`. The performance side is settled — measured 3× faster than `json`
unindexed, 10× with a GIN index, and `json` cannot be GIN-indexed at all — so the real
question is never `json` vs `jsonb` but **jsonb vs a column**. Use jsonb where the shape is
genuinely unknown, and promote keys to columns the moment you find yourself querying them.

## Gotchas

**Symptom:** `42883 operator does not exist: json = json`
**Cause:** `json` has no equality operator, so no comparison, `DISTINCT` or `GROUP BY`
**Fix:** Use `jsonb`

**Symptom:** `42704 data type json has no default operator class for access method "gin"`
**Cause:** `json` cannot be GIN-indexed
**Fix:** Use `jsonb`

**Symptom:** Duplicate keys disappeared and key order changed
**Cause:** `jsonb` normalises — last duplicate wins, keys are sorted
**Fix:** Expected; use `json` only if the exact original text matters

**Symptom:** A jsonb query is slow despite a GIN index
**Cause:** `->>` equality does not use a default GIN index; only `@>`, `?` and friends do
**Fix:** Rewrite as `@>`, or add a B-tree expression index on `(b->>'field')`

**Symptom:** The payload is stored as a string like `"{\"a\":1}"`
**Cause:** `JSON.stringify` was applied before passing the parameter
**Fix:** Pass the object; `pg` serialises it

**Symptom:** Large integers inside jsonb lose precision in Node
**Cause:** `JSON.parse` produces doubles
**Fix:** Store large ids as strings inside the document, or as real columns

**Symptom:** jsonb turned out bigger than json
**Cause:** Binary headers and key offsets — measured 112 vs 56 bytes on a small object
**Fix:** Do not choose on size; choose on whether you need to query it

## Interview questions

**★ What is the difference between `json` and `jsonb`?**
`json` stores the exact text; `jsonb` stores a parsed binary form. `jsonb` sorts keys, drops
duplicate keys and normalises whitespace — measured. Only `jsonb` supports comparison,
containment operators and indexing.

**★ Which is faster?**
`jsonb`, decisively. Measured on 200 000 rows: 33.6 ms vs 98.7 ms unindexed, and 9.4 ms with
a GIN index. `json` re-parses the text on every access.

**★ Can you index a `json` column?**
Not with GIN — `42704`. That alone settles the choice for anything queried.

**★ Is `jsonb` always smaller?**
No. Measured 112 bytes against 56 for the same small object; the binary header and key
offsets cost more than the whitespace saved. Size is not the deciding factor.

**★ When should a jsonb key become a real column?**
As soon as you filter, join or constrain on it. Columns give types, `CHECK`s, foreign keys,
statistics and cheap B-tree indexes; a jsonb key gives none of those. A generated column
over the path is the migration-free middle step.

**Does `pg` parse jsonb for you?**
Yes — both `json` and `jsonb` come back as JavaScript objects, and objects passed as
parameters are serialised. Calling `JSON.stringify` yourself double-encodes.

**Why did a `->>` filter ignore the GIN index?**
A default GIN index supports containment and key-existence operators, not `->>` equality.
Use `@>` or an expression index on the extracted field.

---

← [uuid](07-uuid.md) · Next → [boolean, date, interval](09-boolean-dates.md)
