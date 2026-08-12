---
title: "VALUES and unnest"
sidebar_label: "19 · VALUES and unnest"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex19-series-values.mjs`,
> `ex8-bulk-and-seed.mjs`, `ex14-crud.mjs`.

**Both turn data you are holding in JavaScript into rows the database can join against.
`VALUES` writes them out literally; `unnest` passes them as arrays — which is what lets
one statement carry 5 000 rows through exactly three parameters.**

## `VALUES` is a table

`VALUES` is not only an `INSERT` clause. On its own it is a table expression:

```console
$ node ex19-series-values.mjs
=== 6. VALUES as a table ===
┌─────────┬────┬───────┐
│ (index) │ id │ label │
├─────────┼────┼───────┤
│ 0       │ 1  │ 'a'   │
│ 1       │ 2  │ 'b'   │
└─────────┴────┴───────┘
inferred types → { id_type: 'integer', label_type: 'text' }
```

```sql
SELECT * FROM (VALUES (1,'a'), (2,'b')) AS t(id, label);
```

The alias supplying column names is required — without `AS t(id, label)` the columns are
`column1`, `column2`. Types are inferred from the first row, which is worth knowing: a
list whose first row has an integer and whose later rows have text fails with a type
error, and an explicit cast on the first row (`(1::bigint, 'a'::text)`) fixes it.

Its most useful form is joining a client-supplied list against a real table:

```console
joining a VALUES list against a real table:
┌─────────┬──────┬──────────┬────────┐
│ (index) │ sku  │ name     │ price  │
├─────────┼──────┼──────────┼────────┤
│ 0       │ 'a1' │ 'Widget' │ '10.0' │
│ 1       │ 'a2' │ 'Gadget' │ '20.0' │
└─────────┴──────┴──────────┴────────┘
```

```sql
SELECT i.sku, i.name, v.price
FROM s_items i
JOIN (VALUES ('a1', 10.0), ('a2', 20.0)) AS v(sku, price) ON v.sku = i.sku;
```

That is a batch price lookup — or a batch update, if the join feeds `UPDATE … FROM`
([`UPDATE`](07-update.md)) — without a temporary table.

## `unnest` expands arrays into rows

```console
=== 5. unnest over several arrays ===
┌─────────┬────┬─────┐
│ (index) │ n  │ s   │
├─────────┼────┼─────┤
│ 0       │ 10 │ 'x' │
│ 1       │ 20 │ 'y' │
└─────────┴────┴─────┘
```

```sql
SELECT * FROM unnest(ARRAY[10,20], ARRAY['x','y']) AS t(n, s);
```

Several arrays unnest **in parallel** — column-wise, not as a cross join. Each array
becomes a column and position *i* of each forms row *i*. That is the shape that matches
how you already hold data in JavaScript.

Mismatched lengths do not error:

```console
mismatched lengths — the short one is padded with NULL:
┌─────────┬───┬──────┐
│ (index) │ n │ s    │
├─────────┼───┼──────┤
│ 0       │ 1 │ 'a'  │
│ 1       │ 2 │ null │
│ 2       │ 3 │ null │
└─────────┴───┴──────┘
```

The shorter array is padded with `NULL` to the longest one's length. If your arrays are
built from separate `.map()` calls over the same source they will match — but a filter
applied to one and not another produces silent nulls rather than a complaint. Check
lengths before sending.

## The bulk-parameter bridge

This is the technique worth taking away:

```console
=== 7. unnest: N rows through a fixed number of parameters ===
inserted 5000 rows using exactly 3 parameters
the multi-row VALUES equivalent would need 15000 parameters (ceiling is 65535 → max 21845 rows)
```

```js
await pool.query(
  `INSERT INTO s_bulk (sku, name, qty)
   SELECT * FROM unnest($1::text[], $2::text[], $3::int[])`,
  [rows.map(r => r.sku), rows.map(r => r.name), rows.map(r => r.qty)],
);
```

**One parameter per column, regardless of row count.** A multi-row `VALUES` needs one
parameter per *field*, so it hits the 65 535 ceiling at 21 845 rows for three columns
([`INSERT`](04-insert.md), [Parameterized queries](08-parameters.md)). `unnest` never
approaches it.

The casts are mandatory. Without `$1::text[]` the server cannot infer an array type and
raises "could not determine data type". `pg` maps a JavaScript array to a PostgreSQL
array automatically, so no manual formatting is needed.

It drives updates and deletes too:

```console
bulk UPDATE via unnest → rowCount: 3
```

```sql
UPDATE s_bulk b SET qty = v.qty
FROM unnest($1::text[], $2::int[]) AS v(sku, qty)
WHERE b.sku = v.sku;
```

One statement to apply many different values to many different rows — the alternative
being a loop of single-row updates. Mind the duplicate-source hazard from
[`UPDATE`](07-update.md): if the arrays contain the same key twice, one wins arbitrarily.

`= ANY($1::int[])` is the same idea for reads, and the clean replacement for a generated
`IN` list:

```sql
SELECT * FROM s_items WHERE sku = ANY($1::text[]);
```

## Which is fastest

10 000 rows, from [`INSERT`](04-insert.md)'s measurements:

```console
$ node ex8-bulk-and-seed.mjs
=== 1. loading 10000 rows, four ways ===
per-row INSERT (one transaction)      2262 ms   rows=10000
multi-row VALUES (batch 1000)          148 ms   rows=10000
INSERT ... SELECT unnest (1 stmt)       81 ms   rows=10000
COPY FROM STDIN                        243 ms   rows=10000
```

`unnest` won at this size — one statement, three parameters, and a short SQL string to
parse, against a 10 000-tuple `VALUES` list the parser must chew through. `COPY` is a
streaming protocol with a fixed setup cost that pays off at larger volumes
([`COPY` from streams](../phase-8-schema-from-node/09-copy-streams.md)).

| Rows | Reach for |
|---|---|
| 1 | `INSERT … VALUES ($1, …)` |
| 2 – ~1 000 | multi-row `VALUES`, or `unnest` |
| ~1 000 – ~100 000 | `unnest` |
| Above that, or from a file/stream | `COPY` |

## `unnest` in the select list

```console
unnest in the SELECT list instead of FROM:
┌─────────┬───┬─────┐
│ (index) │ a │ b   │
├─────────┼───┼─────┤
│ 0       │ 1 │ 'x' │
│ 1       │ 2 │ 'y' │
└─────────┴───┴─────┘
```

Legal, and it expands to two rows. Prefer the `FROM` form: it is clearer, it can be
joined and aliased, and multiple set-returning functions in a select list have historically
had confusing behaviour when their lengths differ. `FROM unnest(…)` has none of that
ambiguity.

To preserve the array's order, add `WITH ORDINALITY`
([`generate_series`](18-generate-series.md)) — row order from a join is otherwise not
guaranteed.

## Choosing between them

| | `VALUES` | `unnest` |
|---|---|---|
| Rows in the SQL text | Yes — grows with row count | No — fixed statement |
| Parameters needed | rows × columns | columns |
| Hits the 65 535 ceiling | Yes | No |
| Plan cache | New statement per row count | One statement, always |
| Readable in `psql` | Yes | Less so |
| Types | Inferred from the first row | Explicit casts required |

That plan-cache row matters more than it looks: a `VALUES` list of 7 rows and one of 8
rows are *different statements* to PostgreSQL, so a busy endpoint generates a new entry
for every batch size it sees. `unnest` sends one statement shape forever.

## Trade-off

`unnest` buys a fixed statement, a fixed parameter count, no ceiling and a stable plan
cache. It costs legibility — the SQL no longer shows the data, so a logged statement is
harder to reason about — and it requires explicit array casts and matching array lengths
you must check yourself.

`VALUES` keeps the data visible and needs no casts, and is the better choice for small,
fixed lists and anything you want to paste into `psql`. Above a few hundred rows its
costs compound.

## Gotchas

**Symptom:** `08P01 bind message has 2 parameter formats but 0 parameters`
**Cause:** More than 65 535 parameters — a multi-row `VALUES` at 21 846 rows × 3 columns.
**Fix:** `unnest` with one array per column, or chunk the batch.

**Symptom:** `could not determine data type of parameter $1`
**Cause:** `unnest($1)` with no cast.
**Fix:** `unnest($1::text[])` — always cast array parameters.

**Symptom:** Some inserted rows have unexpected `NULL`s
**Cause:** Arrays of different lengths; the short one is padded — measured, a 3-element
and a 1-element array gave two null rows.
**Fix:** Assert equal lengths before the query.

**Symptom:** `column reference "column1" does not exist`
**Cause:** A `VALUES` subquery with no column alias.
**Fix:** `AS t(id, label)`.

**Symptom:** A `VALUES` list fails with a type mismatch on a later row
**Cause:** Types are inferred from the first row.
**Fix:** Cast explicitly in the first row: `(1::bigint, 'a'::text)`.

**Symptom:** `pg_stat_statements` fills with near-identical entries
**Cause:** Multi-row `VALUES` produces a distinct statement per batch size.
**Fix:** `unnest`, which has one shape.

**Symptom:** A bulk update applied the wrong value
**Cause:** Duplicate keys in the source arrays; `UPDATE … FROM` picks one arbitrarily.
**Fix:** Deduplicate before sending, or use `MERGE`, which raises `21000`.

**Symptom:** Results come back in a different order from the input array
**Cause:** Join output order is not guaranteed.
**Fix:** `WITH ORDINALITY` and `ORDER BY` that position.

## Interview questions

**★ How do you insert 5 000 rows without hitting the parameter limit?**
Pass each column as one array and expand server-side:
`INSERT … SELECT * FROM unnest($1::text[], $2::text[], $3::int[])`. Measured, 5 000 rows
through exactly 3 parameters; the multi-row `VALUES` equivalent would need 15 000, and
the 65 535 ceiling caps that approach at 21 845 rows for three columns.

**★ What does `unnest` do with several arrays — cross join or parallel?**
Parallel, column-wise: position *i* of each array forms row *i*. Measured,
`unnest(ARRAY[10,20], ARRAY['x','y'])` gave two rows, not four. Mismatched lengths are
padded with `NULL` rather than raising — measured with a 3-element and a 1-element array.

**★ When would you use `VALUES` as a table rather than in an `INSERT`?**
To join a client-supplied list against real data without a temp table — a batch lookup, or
a batch update through `UPDATE … FROM (VALUES …)`. It needs a column alias
(`AS v(sku, price)`) and infers types from the first row.

**★ Why does `unnest` behave better with the plan cache?**
Because the statement text is identical no matter how many rows are sent, so one prepared
plan serves every batch. A multi-row `VALUES` list has a different length — and therefore
a different statement — for every batch size, which fragments the cache and fills
`pg_stat_statements`.

**Is `unnest` faster than `COPY`?**
At 10 000 rows, yes — measured 81 ms against 243 ms, because `COPY` has a fixed
protocol setup cost. `COPY` wins at larger volumes and is the right choice when the data
is already a stream or a file.

**How do you pass a variable-length list to an `IN` clause?**
`WHERE col = ANY($1::text[])` with a JavaScript array as the parameter. One parameter
instead of a generated `$1, $2, … $n`, no ceiling, and it avoids the `NOT IN` null trap.

---

← [`generate_series`](18-generate-series.md) · Next → [Row constructors and keyset](20-tuple-comparison.md)
