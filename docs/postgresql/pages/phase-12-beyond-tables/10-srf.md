---
title: "Set-returning functions in FROM"
sidebar_label: "10 · Set-returning functions"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex47-functions.mjs`,
> `sandbox/pg-api/ex19-series-values.mjs`, `sandbox/pg-api/ex44-jsonb-ops.mjs`.

**A set-returning function returns rows, so it belongs in `FROM` where rows come
from.** Put it there and it behaves like a table you can join, filter and order.
Put it in the `SELECT` list and it behaves like nothing else in SQL.

## The three you will actually use

| Function | Turns | Into |
|---|---|---|
| `generate_series(a, b [, step])` | two bounds | a column of values |
| `unnest(anyarray [, ...])` | one array per column | rows |
| `jsonb_to_recordset(doc)` | a JSON array | typed rows |

All three take a parameter, which is what makes them the answer when
[a view cannot](07-views.md).

### `unnest` — the bulk-insert bridge

This is the one that matters most for application code, and it is **portable to any
client language**: the parameter count stays fixed no matter how many rows you send.

```sql
INSERT INTO items (sku, qty)
SELECT * FROM unnest($1::text[], $2::int[])
```

```console
$ node ex19-series-values.mjs
unnest: 5000 rows through 3 parameters
VALUES equivalent needs 15000 parameters and caps at 21845 rows
unnest 81 ms vs VALUES 148 ms vs COPY 243 ms at 10k
```

**5000 rows through 3 parameters.** The `VALUES` equivalent needs one parameter per
value — 15 000 — and the wire protocol caps a statement at 65 535, so `VALUES` hits
a hard ceiling at 21 845 rows. `unnest` has no such ceiling.

The full comparison against `COPY` at 10k/100k/500k is in
[Phase 4 · VALUES and unnest](../phase-4-crud/19-values-unnest.md).

**Mismatched array lengths pad with NULL rather than erroring** — measured in
`ex19`. If your arrays can disagree in length, that is a silent data bug, so build
them from one loop over one source.

### `jsonb_to_recordset` — when the input is already JSON

```sql
INSERT INTO items (sku, qty)
SELECT sku, qty FROM jsonb_to_recordset($1::jsonb) AS t(sku text, qty int)
```

```console
$ node ex44-jsonb-ops.mjs
jsonb_to_recordset → [{"a":1,"b":"x"},{"a":2,"b":"y"}]
```

**One parameter for any number of rows**, and the column types are declared in the
`AS` list rather than inferred. Convenient when the request body is already JSON;
the tabular `unnest` form is generally faster. More in
[Building JSON in SQL](04-build-json-sql.md).

### `generate_series` — rows that do not exist yet

Its main job is gap filling: a report needs a row per day including days with no
data, and only a generated series has those days.

```console
$ node ex19-series-values.mjs
hourly over one day = 25 rows          ← endpoints are INCLUSIVE
generate_series(5,1) returns no rows   ← needs a negative step
step 0 → 22023
gap fill needs count(e.id), not count(*)
```

Three traps, all measured. **Endpoints are inclusive**, so an hourly series across
one day is 25 rows, not 24. **A descending range needs a negative step** or it
silently returns nothing. And in a gap-fill `LEFT JOIN`, **`count(*)` reports 1 for
empty days** because it counts the generated row — you need `count(e.id)`. Full
treatment: [Phase 4 · generate_series](../phase-4-crud/18-generate-series.md).

## `WITH ORDINALITY` — the row number

```console
$ node ex47-functions.mjs
WITH ORDINALITY    → [{"val":"x","pos":"1"},{"val":"y","pos":"2"},{"val":"z","pos":"3"}]
```

```sql
SELECT * FROM unnest(ARRAY['x','y','z']) WITH ORDINALITY AS t(val, pos)
```

This is how you preserve **input order**, and it is the reason to put an SRF in
`FROM` rather than the `SELECT` list. Array order is not otherwise meaningful once
the values become rows — nothing promises they come back in order, and without a
position column you cannot restore it.

The classic use: bulk-update several rows to different values in one statement, and
match results back to input positions.

Note `pos` arrives as a **string** — `WITH ORDINALITY` produces `bigint`, which
`pg` returns as text ([Rows to domain objects](../phase-9-api-crud/01-repository/02-rows-to-domain.md)).

## In `FROM`, not in `SELECT`

An SRF in the `SELECT` list is legal and behaves unlike anything else:

```console
=== 3. set-returning function in SELECT vs in FROM ===
SELECT generate_series(1,3) → 1,2,3
two SRFs in SELECT → [{"a":1,"b":1},{"a":2,"b":2},{"a":null,"b":3},{"a":null,"b":4}]
  ↑ PG10+ runs them in lockstep and pads the shorter with NULL
ROWS FROM(...)     → [{"a":1,"b":1},{"a":2,"b":2},{"a":null,"b":3},{"a":null,"b":4}]
```

**Two SRFs in one `SELECT` list run in lockstep and the shorter is padded with
`NULL`.** Before PostgreSQL 10 the behaviour was worse — the result length was the
*least common multiple* of the two, which produced surprising row counts.

`ROWS FROM (a(), b())` in the `FROM` clause does the same thing explicitly, which
is the version to write: the reader can see that two sets are being zipped.

And an SRF cannot go just anywhere:

```console
an SRF in the WHERE clause                   → 0A000 set-returning functions are not allowed in WHERE
```

**The rule: put set-returning functions in `FROM`.** They produce rows; `FROM` is
where rows enter a query. Then everything else — joins, `WHERE`, `ORDER BY`,
aggregation — works normally on them.

## Joining against them

Because they sit in `FROM`, they join like tables. With `LATERAL` they can
reference a column from the row to their left:

```sql
SELECT o.id, t.tag
  FROM orders o, LATERAL unnest(o.tags) AS t(tag)
```

That expands a per-row array into rows — the standard way to explode an array
column, and it is why `LATERAL` and SRFs are usually learned together. The measured
`LATERAL` material, including the benchmark that was confounded and its 5.6×
correction, is in [Phase 5 · LATERAL](../phase-5-joins/10-lateral.md).

## Trade-off

Set-returning functions let one statement do work that would otherwise be a loop
in application code — a round trip per row becomes one round trip. That is the
single biggest performance lever available to a client-side developer, and it is
why `unnest` is worth knowing well.

The cost is that the SQL gets denser and the array parameters have to line up
positionally. A mismatch pads with `NULL` rather than raising, so the failure is
silent. Build the arrays from one pass over one collection, never from separate
`.map()` calls that could diverge.

## Gotchas

**Symptom:** `bind message has 70000 parameter formats` on a bulk insert
**Cause:** A generated `VALUES` list uses one parameter per value and the protocol
caps at 65 535 — measured, `VALUES` caps at 21 845 rows for three columns.
**Fix:** `unnest` with one array per column: 5000 rows through 3 parameters.

**Symptom:** A bulk insert silently writes `NULL`s
**Cause:** Mismatched array lengths — `unnest` pads rather than erroring.
**Fix:** Build every array in one pass over one source collection.

**Symptom:** An hourly series over one day gives 25 rows
**Cause:** `generate_series` endpoints are inclusive.
**Fix:** Expected; subtract an interval from the upper bound if you want 24.

**Symptom:** A descending `generate_series` returns nothing
**Cause:** No negative step. `generate_series(5,1)` is empty.
**Fix:** `generate_series(5,1,-1)`. Step 0 raises `22023`.

**Symptom:** A gap-filled report shows 1 for days with no data
**Cause:** `count(*)` counts the generated row.
**Fix:** `count(e.id)` — count a column from the joined side.

**Symptom:** Bulk-updated rows cannot be matched back to input order
**Cause:** No position column; array order is not preserved through rows.
**Fix:** `WITH ORDINALITY`.

**Symptom:** `0A000 set-returning functions are not allowed in WHERE`
**Cause:** An SRF used as a predicate.
**Fix:** Put it in `FROM` and join.

**Symptom:** Two SRFs in a `SELECT` list produce unexpected rows
**Cause:** They run in lockstep with the shorter padded to `NULL`.
**Fix:** `ROWS FROM (a(), b())` in `FROM`, so the zipping is explicit.

## Interview questions

**★ How do you insert 5000 rows in one statement without hitting the parameter
limit?**
`INSERT ... SELECT * FROM unnest($1::text[], $2::int[])` — one array parameter per
column, so the count is fixed regardless of rows. Measured: 5000 rows through 3
parameters, where the `VALUES` equivalent needs 15 000 and caps at 21 845 rows
because the protocol allows 65 535.

**★ Why put a set-returning function in `FROM` rather than `SELECT`?**
Because it produces rows, and `FROM` is where rows enter a query — after which
joins, `WHERE`, `ORDER BY` and aggregation all work normally. In the `SELECT` list
two SRFs run in lockstep with the shorter padded to `NULL`, which is unlike
anything else in SQL. And an SRF is not allowed in `WHERE` at all — `0A000`.

**★ What does `WITH ORDINALITY` give you?**
A position column, which is the only way to preserve the input order of an array
once it becomes rows — measured, `unnest(ARRAY['x','y','z']) WITH ORDINALITY`
returns `pos` 1, 2, 3. Essential when matching results back to input positions.

**★ What are the traps in `generate_series`?**
Endpoints are inclusive, so hourly over one day is 25 rows. A descending range
returns nothing without a negative step, and step 0 raises `22023`. In a gap-fill
`LEFT JOIN`, `count(*)` reports 1 for empty periods because it counts the generated
row — use `count(joined.id)`.

**When would you use `jsonb_to_recordset` instead of `unnest`?**
When the input is already a JSON body: one parameter for any number of rows, with
column types declared in the `AS` list. `unnest` with parallel arrays is generally
faster, so it wins when you are building the payload anyway.

---

← [Extensions](09-extensions.md) · Next → [Materialized views](11-matviews.md)
