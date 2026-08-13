---
title: "Building JSON in SQL"
sidebar_label: "04 · Building JSON"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex44-jsonb-ops.mjs`,
> `sandbox/pg-api/ex41-shaping-mapping.mjs`.

**Reading documents is one direction; producing them is the other.** The
constructors are simple — the decisions are which one to use and, more
importantly, whether to do it in SQL at all.

## The constructors

```console
$ node ex44-jsonb-ops.mjs
=== 6. building JSON ===
build          {"id": 1, "tag": "t1"}
to_jsonb_row   {"id": 1, "qty": 1, "tag": "t1"}
row_to_json    {"id":1,"tag":"t1","qty":1}
jsonb_agg      [{"id": 1}, {"id": 2}, {"id": 3}]
jsonb_object_agg {"t1": 1, "t2": 2, "t3": 3}
jsonb_to_recordset → [{"a":1,"b":"x"},{"a":2,"b":"y"}]
```

| Function | Input | Output |
|---|---|---|
| `jsonb_build_object('k', v, ...)` | alternating keys and values | one object, **explicit keys** |
| `jsonb_build_array(a, b, ...)` | values | one array |
| `to_jsonb(row)` | a row or any value | object keyed by **column name** |
| `row_to_json(row)` | a row | same, as `json` not `jsonb` |
| `jsonb_agg(expr)` | rows | array, one element per row |
| `jsonb_object_agg(k, v)` | rows | object, one key per row |
| `jsonb_to_recordset(doc)` | a JSON array | **rows** — the reverse direction |

Two details visible in that output:

- **`to_jsonb(t)` reordered the keys** to `id, qty, tag` while `row_to_json(t)`
  preserved `id, tag, qty` as written. jsonb sorts keys; json keeps the text as
  produced. If key order matters to a consumer, `row_to_json` / `json_agg` are the
  ones that preserve it.
- **`jsonb_build_object` names its keys explicitly**, which is the reason to
  prefer it over `to_jsonb(t)` for anything a client sees: the payload is an
  allowlist, and a column added to the table does not appear in it. Exactly the
  argument from [Rows to domain objects](../phase-9-api-crud/01-repository/02-rows-to-domain.md).

## The empty-collection trap

`jsonb_agg` over zero rows returns `NULL`, not `[]`, and over a `LEFT JOIN` with
no match it returns a one-element array containing nulls:

```console
$ node ex41-shaping-mapping.mjs
=== 2. jsonb_agg over a LEFT JOIN with no children ===
plain jsonb_agg      : [{"sku":null}]
with FILTER+coalesce : []
```

```sql
coalesce(
  jsonb_agg(jsonb_build_object('sku', i.sku)) FILTER (WHERE i.id IS NOT NULL),
  '[]'::jsonb)
```

**Both halves are required.** `FILTER` removes the all-null row the `LEFT JOIN`
produced; `coalesce` then converts the `NULL` that an aggregate over zero rows
returns into an empty array. Use one without the other and you ship `null` where
the client expects `[]`.

## What the types become

```console
$ node ex41-shaping-mapping.mjs
=== 3. types coming back from jsonb vs from columns ===
through jsonb : { total: 11, placed: '2026-08-13T08:03:06.359569+00:00' } → number / string
as columns    : { order_total: '11.00', placed_at: 2026-08-13T08:03:06.359Z } → string / Date
```

Going through jsonb changes what arrives in Node:

- **`numeric` becomes a JSON number.** `'11.00'` arrives as `11` — trailing zeros
  gone and floating-point representation now in play. For money this is a real
  defect, and it exists only on the JSON path. Cast to text inside the object
  (`'total', o.order_total::text`) if the value must stay exact.
- **`timestamptz` becomes a string**, not a `Date`.

Selected as ordinary columns, `pg` gives you the exact string `'11.00'` and a
`Date`. The full mapping is in
[Phase 7 · Type parsing](../phase-7-pg-driver/08-type-parsing.md).

## Whether to do it in SQL at all

This is the part worth knowing before reaching for `jsonb_agg` to build an API
response. Building a nested payload of 5000 parents and 25 000 children:

```console
median of 5 runs:
  (a) jsonb_agg in SQL          284.8 ms
  (a3) json_agg not jsonb       131.2 ms
  (b) flat join + JS             90.7 ms
  (c) two queries + JS          103.3 ms
  (d) N+1, 500 orders           298.6 ms  (2986 ms extrapolated to 5000)
```

**Shaping in SQL was about 3× slower than grouping flat rows in JavaScript**, and
`json_agg` was less than half the cost of `jsonb_agg` — the binary parse is where
the time goes. It is server-side CPU, not transfer: `EXPLAIN` attributed 232 ms of
it to the server against 36 ms for the flat join.

The full analysis, including why the jsonb payload is *larger* despite returning
five times fewer rows, is in
[Shaping in SQL vs JS](../phase-9-api-crud/15-shape-sql-vs-js.md).

**So use these functions when the shape is the point** — a payload consumed by
later steps of the same query, several independent child collections in one round
trip, or a document written into a jsonb column — and **use `json_agg` rather than
`jsonb_agg`** unless you need jsonb's operators or are storing the result.

## The reverse direction

`jsonb_to_recordset` turns a document back into rows, which is how a bulk endpoint
takes one JSON parameter instead of arrays per column:

```sql
INSERT INTO items (sku, qty)
SELECT sku, qty
  FROM jsonb_to_recordset($1::jsonb) AS t(sku text, qty int)
```

One parameter for any number of rows, and the column types are declared in the
`AS` list rather than inferred. Compare `unnest` with one array per column, which
is measured against `VALUES` and `COPY` in
[Phase 4 · VALUES and unnest](../phase-4-crud/19-values-unnest.md); the tabular
form is generally faster, and this one is more convenient when the input is
already a JSON body. More on both in
[Set-returning functions](10-srf.md).

## Trade-off

Building the response in SQL keeps the shape in one artifact and removes a
mapping layer. It also puts the API contract inside the query, so the query
changes whenever the response does and cannot serve two endpoints that need
different shapes — and, measured, it is slower than doing it in JavaScript.

The functions are still the right tool for the narrower jobs: assembling a
document to *store*, producing a payload that a later CTE consumes, and returning
several unrelated collections in one round trip. Those are shape problems, not
serialisation problems, and nothing in the application replaces them.

## Gotchas

**Symptom:** A parent with no children serialises as `[{"sku":null}]`
**Cause:** `jsonb_agg` over a `LEFT JOIN` aggregates the all-null row.
**Fix:** `FILTER (WHERE child.id IS NOT NULL)` **and** `coalesce(..., '[]'::jsonb)`.

**Symptom:** An empty collection is `null` instead of `[]`
**Cause:** `FILTER` applied without `coalesce`; an aggregate over zero rows is
`NULL`.
**Fix:** Both together.

**Symptom:** Monetary values lose trailing zeros
**Cause:** `numeric` through jsonb becomes a JSON number. Measured: `'11.00'`
arrived as `11`.
**Fix:** Cast to text inside the object, or select it as a column.

**Symptom:** JSON keys come back in an order nobody wrote
**Cause:** jsonb sorts keys. Measured: `to_jsonb` gave `id, qty, tag` where
`row_to_json` preserved `id, tag, qty`.
**Fix:** `row_to_json` / `json_agg` if order matters.

**Symptom:** A new column appears in API responses
**Cause:** `to_jsonb(t)` or `row_to_json(t)` keys by whatever the row has.
**Fix:** `jsonb_build_object` with explicit keys.

**Symptom:** Moving aggregation into SQL made the endpoint slower
**Cause:** jsonb construction is server-side CPU. Measured: 284.8 ms against
90.7 ms for grouping in JS; `json_agg` was 131.2 ms.
**Fix:** Group in JS, or at least use `json_agg`.

## Interview questions

**★ What is the difference between `jsonb_build_object` and `to_jsonb(row)`?**
`jsonb_build_object` takes explicit key/value pairs, so the payload is an
allowlist and a new column does not appear in it. `to_jsonb(row)` keys by column
name, so the response follows the table. For anything a client sees, build the
object explicitly.

**★ Why does an empty child collection come back as `null` rather than `[]`?**
Because an aggregate over zero rows returns `NULL`. And over a `LEFT JOIN` with no
match, `jsonb_agg` returns `[{"key":null}]` because it aggregates the all-null
row. You need `FILTER (WHERE child.id IS NOT NULL)` to drop that row and
`coalesce(..., '[]')` to handle the resulting `NULL` — measured, both.

**★ What happens to a `numeric` column built into a jsonb payload?**
It becomes a JSON number, so `'11.00'` arrives in Node as `11` — precision and
trailing zeros lost. Selected as a column it stays the exact string `'11.00'`.
Cast to text inside the object for money.

**★ Should you build API responses with `jsonb_agg`?**
Usually not for performance reasons — measured, 284.8 ms against 90.7 ms for
grouping flat rows in JavaScript, with `json_agg` at 131.2 ms. Use it when the
shape is the point: a document being stored, a payload a later CTE consumes, or
several independent collections in one round trip.

**How do you insert many rows from a single JSON parameter?**
`INSERT ... SELECT ... FROM jsonb_to_recordset($1::jsonb) AS t(col type, ...)`.
One parameter regardless of row count, with column types declared in the `AS`
list.

---

← [Indexing jsonb](03-index-jsonb.md) · Next → [Full-text search](./full-text/)
