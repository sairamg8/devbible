---
title: "The SELECT shape"
sidebar_label: "01 · SELECT"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex14-crud.mjs`.

**Every read is one statement with six clauses in a fixed written order. Learn the
skeleton, and learn which clauses can see the names you invent in `SELECT` — because
two of them can and one of them cannot.**

## The skeleton

```sql
SELECT   name, price * qty AS total   -- what comes back
FROM     c_items                      -- where from
WHERE    qty IS DISTINCT FROM 5       -- which rows
ORDER BY total DESC NULLS LAST        -- in what order
LIMIT    2 OFFSET 0;                  -- how many
```

Add `GROUP BY` / `HAVING` between `WHERE` and `ORDER BY` and that is the whole of
`SELECT`. Written in this order, always — PostgreSQL rejects any other arrangement.

The table used throughout this phase:

```sql
CREATE TABLE c_items (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku        text NOT NULL UNIQUE,
  name       text NOT NULL,
  qty        int,
  price      numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now());
```

## The clause you write first runs almost last

This is the single most useful thing to know about the shape, and it is measurable:

```console
$ node ex14-crud.mjs
=== 6. logical query processing order ===
alias in WHERE  → 42703 column "total" does not exist
alias in ORDER BY works → 57.50
```

```sql
SELECT price * qty AS total FROM c_items WHERE total > 10;    -- ✗ 42703
SELECT price * qty AS total FROM c_items WHERE price * qty > 10
  ORDER BY total DESC NULLS LAST LIMIT 2;                     -- ✓
```

`WHERE` is evaluated **before** the select list exists, so `total` is not a name yet —
you repeat the expression. `ORDER BY` runs **after**, so the alias is available there.
The full ordering is [Logical query processing order](09-logical-order.md); the
practical rule is: *aliases work in `ORDER BY`, never in `WHERE`.*

## Expressions belong in the select list

The select list is not restricted to columns. Anything that evaluates per row is legal,
and naming it with `AS` is what makes the result readable from Node:

```console
$ node ex14-crud.mjs
=== 9. expressions ===
┌─────────┬──────┬────────────┬───────────────────┐
│ (index) │ qty0 │ state      │ label             │
├─────────┼──────┼────────────┼───────────────────┤
│ 0       │ 5    │ 'in stock' │ 'Widget (a1)'     │
│ 1       │ 0    │ 'unknown'  │ 'Gadget (a2)'     │
│ 2       │ 3    │ 'in stock' │ 'doohickey (a3)'  │
│ 3       │ 0    │ 'out'      │ 'Widget Pro (a4)' │
└─────────┴──────┴────────────┴───────────────────┘
```

Pushing the shape into SQL rather than mapping it in JavaScript is usually the right
call — see [Shaping in SQL vs JS](../phase-9-api-crud/15-shape-sql-vs-js.md) for where
that stops being true. The building blocks are in
[Expressions and `CASE`](15-expressions.md).

## `SELECT *` is for `psql`, not for code

`*` is a convenience at the shell and a liability in an application:

- Adding a column silently widens every payload — including the `password_hash` someone
  adds next quarter.
- It defeats [index-only scans](../phase-10-indexes/08-index-only.md), which need every
  selected column to be in the index.
- Column *order* becomes part of your contract if anything reads positionally.
- A `SELECT *` over a join yields duplicate column names, and the driver keeps only the
  last one.

Name the columns. The cost is a longer statement and one more edit when the schema
changes; both are worth it.

## What comes back in Node

```console
$ node ex14-crud.mjs
=== 3. RETURNING ===
INSERT   → { id: '5', sku: 'b1', created_at: 2026-08-12T06:48:17.024Z }
```

Two things to register from that line. `created_at` arrived as a real JS `Date`. And
**`id` is the string `'5'`, not the number `5`** — `bigint` exceeds `Number.MAX_SAFE_INTEGER`,
so `pg` hands it back as a string rather than lose precision quietly. `numeric` behaves
the same way (`price` came back as `'11.50'`).

```js
const {rows, rowCount} = await pool.query(
  `SELECT id, name, price * qty AS total
   FROM c_items
   WHERE ($1::text IS NULL OR sku = $1)
   ORDER BY total DESC NULLS LAST
   LIMIT $2`,
  [skuOrNull, limit],
);
```

`rows` is a plain array of plain objects; `rowCount` is how many came back. Casting in
SQL is the cheap fix when you want a JS number — `count(*)::int` is used all over this
phase for exactly that reason. The full type-mapping story is
[Type parsing](../phase-7-pg-driver/08-type-parsing.md), and the result object is
[The result object](../phase-7-pg-driver/06-result-object.md).

Note the `($1::text IS NULL OR sku = $1)` idiom: one statement handles both the filtered
and unfiltered case, so the plan cache stays warm. It stops scaling once you have more
than a few optional filters — at that point build the `WHERE` clause and its parameter
array together, as in [Safe dynamic `WHERE`](../phase-9-api-crud/safe-dynamic-where/).

## Trade-off

The fixed clause order is what makes SQL declarative: you describe the result and the
planner picks the strategy. The cost is that the written order is not the evaluation
order, so the language reads in a sequence it does not execute in — which is why the
alias-in-`WHERE` error is one of the most common first errors people hit.

Naming columns explicitly costs edits on every schema change and buys a payload that
cannot silently grow, index-only scans that keep working, and a contract that does not
depend on column order.

## Gotchas

**Symptom:** `42703 column "total" does not exist`, when `total` is right there in the
`SELECT`
**Cause:** `WHERE` runs before the select list is computed.
**Fix:** Repeat the expression in `WHERE`, or wrap the query in a subselect/CTE and
filter outside it. In `ORDER BY` the alias works as written.

**Symptom:** A JSON API starts returning a field nobody added to it
**Cause:** `SELECT *` plus a new column.
**Fix:** Name the columns you actually serve.

**Symptom:** `id` compares unequal to the number you expected; `id === 5` is false
**Cause:** `bigint` and `numeric` arrive as **strings** to preserve precision.
**Fix:** Compare as strings, cast in SQL (`id::int`), or register a type parser —
[Type parsing](../phase-7-pg-driver/08-type-parsing.md). Do not `parseInt` a real
`bigint`; that is the precision loss you were being protected from.

**Symptom:** A joined query is missing columns
**Cause:** `SELECT *` across tables produced duplicate column names and the last one
won.
**Fix:** Alias them: `SELECT u.id AS user_id, o.id AS order_id`.

**Symptom:** `count(*)` returns `'12'` and string-concatenates in JavaScript
**Cause:** `count()` returns `bigint`.
**Fix:** `count(*)::int` — used throughout this phase.

## Interview questions

**★ Why can you use a `SELECT` alias in `ORDER BY` but not in `WHERE`?**
Because `WHERE` is evaluated before the select list is computed, and `ORDER BY` after.
Measured: `WHERE total > 10` fails with `42703 column "total" does not exist`, while
`ORDER BY total DESC` on the same alias works. Repeat the expression in `WHERE`, or
filter outside a subselect.

**★ Why avoid `SELECT *` in application code?**
Payloads widen silently when columns are added, index-only scans stop applying because
the index no longer covers every selected column, column order leaks into any
positional consumer, and duplicate names across a join collapse to one. It is fine
interactively in `psql`.

**★ Why does `pg` return `id` as a string?**
`bigint` and `numeric` can hold values outside the range JavaScript's `number` represents
exactly, so the driver returns strings rather than lose precision silently. Measured:
`{ id: '5' }`. Cast to `int` in SQL when the value is genuinely small, or use a type
parser.

**What is the written clause order of a `SELECT`?**
`SELECT`, `FROM`, `WHERE`, `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`/`OFFSET`. It is
fixed; the evaluation order differs and is covered in
[Logical query processing order](09-logical-order.md).

**How do you make one statement serve both a filtered and an unfiltered list?**
`WHERE ($1::text IS NULL OR sku = $1)` — passing `null` disables the predicate. The
explicit cast is needed so PostgreSQL can infer the parameter's type. Beyond a few
optional filters, build the clause and its parameter array together instead.

---

← [Phase index](README.md) · Next → [`WHERE` predicates](02-where-predicates.md)
