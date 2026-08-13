---
title: "NULL semantics"
sidebar_label: "06 · NULL"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex33-types-core.mjs`.

**`NULL` is not a value — it is the absence of one, and comparing with it yields `unknown`
rather than true or false. Every surprise on this page follows from that single rule,
including the `NOT IN` that silently returns nothing.**

## Three-valued logic

```console
$ node ex33-types-core.mjs
=== 6. NULL — three-valued logic ===
{"eq_null":null,"ne_null":null,"is_null":true,"not_distinct":true,
 "in_with_null":true,"in_no_match_null":null,"not_in_with_null":null,
 "true_and_null":null,"false_and_null":false,"true_or_null":true}
```

| Expression | Result |
|---|---|
| `NULL = NULL` | `NULL` (not true) |
| `NULL <> NULL` | `NULL` (not true) |
| `NULL IS NULL` | **true** |
| `NULL IS NOT DISTINCT FROM NULL` | **true** |
| `true AND NULL` | `NULL` |
| `false AND NULL` | **false** |
| `true OR NULL` | **true** |

A `WHERE` clause keeps rows only when the predicate is **true** — `NULL` is discarded just
like `false`. So `WHERE col = NULL` matches nothing, ever. Use `IS NULL`, or
`IS NOT DISTINCT FROM` when comparing two nullable expressions.

`false AND NULL` is `false` and `true OR NULL` is `true` because those results are
determined regardless of the unknown — the reason short-circuit logic still works.

## The one that loses data: `NOT IN`

```console
"in_with_null":true, "in_no_match_null":null, "not_in_with_null":null
```

```sql
SELECT 2 NOT IN (1, NULL);   -- NULL, not true
```

**`2 NOT IN (1, NULL)` is `NULL`, so the row is dropped.** Expanded, `NOT IN` means
`2 <> 1 AND 2 <> NULL` → `true AND NULL` → `NULL`. One `NULL` anywhere in the list makes
the whole `NOT IN` return nothing at all.

This is the real-world form:

```sql
-- returns ZERO rows if any customer_id in orders is NULL
SELECT * FROM customers WHERE id NOT IN (SELECT customer_id FROM orders);

-- correct
SELECT * FROM customers c WHERE NOT EXISTS (
  SELECT 1 FROM orders o WHERE o.customer_id = c.id);
```

**Prefer `NOT EXISTS` to `NOT IN` with a subquery.** It handles `NULL` correctly and usually
plans better (an anti-join rather than a hashed subplan).

## Filtering skips NULLs — in both directions

```console
WHERE v <> 30 skips NULLs: {"ids":[1]}
WHERE v IS DISTINCT FROM 30: {"ids":[1,2,4]}
```

Four rows: `v` = 10, NULL, 30, NULL. `WHERE v <> 30` returned **only row 1** — the two NULL
rows were dropped, because `NULL <> 30` is unknown. If "everything that is not 30" should
include the unknowns, say so:

```sql
WHERE v IS DISTINCT FROM 30      -- 10, NULL, NULL  ← treats NULL as a distinct value
WHERE v <> 30 OR v IS NULL       -- the same thing, more verbosely
```

`IS DISTINCT FROM` is the null-safe comparison operator, and it is the one to reach for
whenever a nullable column appears in a predicate you expect to be exhaustive.

## Aggregates ignore NULL

```console
aggregates ignore NULL: {"count_star":"4","count_v":"2","sum_v":"40","avg_v":"20.0000000000000000","sum_coalesced":"40"}
sum over all-NULL       : {"s":null,"c":"0"} <- sum is NULL, not 0
```

- **`count(*)` counts rows (4); `count(col)` counts non-null values (2).** The difference is
  a quick null census.
- **`avg` divides by the non-null count** — 40/2 = 20, not 40/4 = 10. Usually right, but be
  sure it is the average you meant.
- **`sum()` over no rows, or over all NULLs, is `NULL` — not 0.** In an application that
  formats the result, that is a `null` where a number was expected. Wrap it:
  `coalesce(sum(v), 0)`.

## `UNIQUE` allows many NULLs

```console
rows in a UNIQUE column, all NULL: 3
second NULL with NULLS NOT DISTINCT            ->  23505 duplicate key value violates unique constraint
```

**A `UNIQUE` column accepted three NULLs**, because two NULLs are not equal, so they do not
conflict. That is standard behaviour and frequently a surprise — a "unique" email column
permits unlimited rows with no email.

PostgreSQL 15+ gives you the choice:

```sql
CREATE TABLE t (v int UNIQUE);                      -- many NULLs allowed (default)
CREATE TABLE t (v int UNIQUE NULLS NOT DISTINCT);   -- at most one NULL
```

This is also why soft-delete schemas use a [partial unique index](../phase-10-indexes/09-partial.md)
rather than relying on NULL behaviour.

## Ordering

```console
ordering: {"asc_default":[10,30,null,null],"desc_default":[null,null,30,10],"asc_nulls_first":[null,null,10,30]}
```

**NULLs sort last ascending and first descending** — PostgreSQL treats them as larger than
everything. So reversing a sort moves the NULLs from the bottom to the top, which quietly
changes what a `LIMIT 10` returns. Be explicit when it matters:

```sql
ORDER BY updated_at DESC NULLS LAST
```

An index supports `NULLS FIRST`/`LAST` only if it was created with the matching option, so
a mismatched `ORDER BY` can cost you the index — see
[why an index is not used](../phase-10-indexes/05-index-not-used.md).

## `NULL` is not the empty string

```console
'' is not NULL: {"empty_is_null":false,"empty_eq_null":null,"len":0,"concat_null":null,"concat_fn":"x"}
```

Three distinct facts:

- **`''` is a value; `NULL` is not.** `'' IS NULL` is false. (Oracle conflates them;
  PostgreSQL does not.)
- **`NULL || 'x'` is `NULL`** — concatenation with an unknown is unknown. This is how a
  whole address line becomes NULL because the second line was empty.
- **`concat(NULL, 'x')` is `'x'`** — the `concat()` *function* ignores NULLs, unlike the
  `||` operator. Use `concat_ws()` for joined fields.

## From Node

`NULL` arrives as JavaScript `null`, and `undefined` sent as a parameter is converted to
`NULL`:

```js
await pool.query('INSERT INTO t (a, b) VALUES ($1, $2)', [1, undefined]);  // b becomes NULL
```

That is a trap in an update built from a request body: a missing key is `undefined`, which
silently nulls the column rather than leaving it alone. Build partial updates explicitly:

```sql
UPDATE users SET
  name  = COALESCE($2, name),      -- NULL parameter means "leave it"
  email = COALESCE($3, email)
WHERE id = $1;
```

The limitation is that this makes it impossible to *set* a column to NULL. When that is
needed, build the `SET` list from the keys actually present — see
[partial updates](../phase-9-api-crud/08-update-partial.md).

## Trade-off

**Three-valued logic is the price of representing "unknown" honestly**, and it is a price
paid in every predicate over a nullable column. The alternative — a sentinel value like `-1`
or `''` — makes comparisons simple and pushes the ambiguity into your data, where nothing
enforces it and every query has to remember the convention. The practical resolution is to
make columns `NOT NULL` wherever a value is genuinely always present, so three-valued logic
only applies where absence is real information.

## Gotchas

**Symptom:** `WHERE col = NULL` returns nothing
**Cause:** Comparison with NULL is `unknown`, and `WHERE` keeps only `true`
**Fix:** `IS NULL`

**Symptom:** `NOT IN (subquery)` returns zero rows
**Cause:** A NULL in the list makes the whole predicate `NULL` — measured
**Fix:** `NOT EXISTS`, or filter the NULLs out of the subquery

**Symptom:** `WHERE status <> 'x'` misses rows where status is NULL
**Cause:** `NULL <> 'x'` is unknown
**Fix:** `IS DISTINCT FROM`, or add `OR status IS NULL`

**Symptom:** `sum()` returned `null` instead of 0
**Cause:** Summing zero rows or all NULLs yields NULL
**Fix:** `coalesce(sum(v), 0)`

**Symptom:** A `UNIQUE` column contains many rows with no value
**Cause:** NULLs do not conflict with each other — measured, three NULLs accepted
**Fix:** `UNIQUE NULLS NOT DISTINCT` (PostgreSQL 15+), or `NOT NULL`, or a partial index

**Symptom:** Reversing a sort changed which rows a `LIMIT` returned
**Cause:** NULLs sort last ascending, first descending
**Fix:** `ORDER BY col DESC NULLS LAST`

**Symptom:** A concatenated string became NULL
**Cause:** `||` with a NULL operand yields NULL
**Fix:** `concat()` / `concat_ws()`, which ignore NULLs

**Symptom:** A partial update nulled columns the request did not mention
**Cause:** `undefined` parameters become NULL
**Fix:** `COALESCE($n, col)`, or build the `SET` list from present keys only

## Interview questions

**★ Why does `WHERE col = NULL` match nothing?**
Comparing with NULL yields `unknown`, and `WHERE` keeps only rows where the predicate is
`true`. Use `IS NULL`, or `IS NOT DISTINCT FROM` for a null-safe equality.

**★ Why can `NOT IN` return zero rows unexpectedly?**
If the list contains a NULL, the predicate expands to `… AND x <> NULL`, which is `unknown`
for every row. Measured: `2 NOT IN (1, NULL)` is `NULL`. Use `NOT EXISTS`.

**★ What is the difference between `count(*)` and `count(col)`?**
`count(*)` counts rows; `count(col)` counts non-null values. Measured 4 and 2 on the same
four rows.

**★ How many NULLs can a `UNIQUE` column hold?**
Any number — NULLs are not equal to each other. Measured three. `UNIQUE NULLS NOT DISTINCT`
(PostgreSQL 15+) restricts it to one.

**★ Where do NULLs sort?**
Last ascending, first descending. Override with `NULLS FIRST` / `NULLS LAST`, and be aware
an index only helps if it was built with the matching order.

**Is `''` the same as NULL?**
No. `'' IS NULL` is false, and `length('')` is 0. Oracle conflates them; PostgreSQL does not.

**Why did concatenation produce NULL?**
`||` returns NULL if any operand is NULL. `concat()` and `concat_ws()` skip NULLs instead.

---

← [Time zones](05-time-zones.md) · Next → [uuid](07-uuid.md)
