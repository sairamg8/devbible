---
title: "IN, EXISTS and the NOT IN trap"
sidebar_label: "03 · IN, EXISTS, NOT IN"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37-cte-subquery.mjs`.

**`IN`, `= ANY` and `EXISTS` are three spellings of the same question and give the same
answer. Their negations are not: `NOT IN` against a subquery containing a single `NULL`
returns **no rows at all**, silently and correctly, and `NOT EXISTS` does not. This is the
single most expensive `NULL` behaviour in SQL because the query keeps working right up
until one nullable column has one null in it.**

## The positive forms agree

```sql
SELECT (SELECT count(*)::int FROM agg_customers
        WHERE id IN (SELECT customer_id FROM agg_orders)) AS in_,
       (SELECT count(*)::int FROM agg_customers
        WHERE id = ANY (SELECT customer_id FROM agg_orders)) AS any_,
       (SELECT count(*)::int FROM agg_customers c
        WHERE EXISTS (SELECT 1 FROM agg_orders o WHERE o.customer_id = c.id)) AS exists_;
```

```console
IN / = ANY / EXISTS same answer: [{"in_":4,"any_":4,"exists_":4}]
```

Four customers have at least one order, by all three spellings. `IN (subquery)` and
`= ANY (subquery)` are the same operator — `IN` is defined as `= ANY` — and `EXISTS` asks
the equivalent question from the other side. The planner turns all three into a **semi
join**, which stops at the first match per outer row rather than counting matches.

That equivalence is worth internalising, because it means **the choice between them is
about readability, not speed**. The joins phase measures the case where it *is* about
speed — `EXISTS` versus a `JOIN` with `DISTINCT`, where the semi join wins 2.5× because it
does not build and then discard duplicates
([phase 5](../../phase-5-joins/semi-anti/)).

A rough guide to which to write:

| Situation | Prefer |
|---|---|
| A literal list of values from the app | `= ANY($1)` with an array parameter |
| A subquery, single column, no `NULL`s possible | `IN` — it reads best |
| A subquery over a nullable column | **`EXISTS`**, always |
| Correlated on more than one column | `EXISTS` — `IN` needs a row constructor |
| Any negation | **`NOT EXISTS`**, always |

## The trap

Start from a state with no `NULL` customer ids:

```console
NOT IN with a NULL      : [{"n":1}]
  ^ Eve is the only customer with no orders; no NULL customer_id yet. Now force one:
```

One customer — Eve — has no orders, which is the right answer. Now insert a single order
whose `customer_id` is `NULL`, and ask exactly the same question:

```console
NOT IN, now with a NULL : [{"n":0}]
NOT EXISTS, same data   : [{"n":1}]
```

**`NOT IN` went from 1 to 0. `NOT EXISTS` still says 1.** The data about Eve did not
change; a `NULL` appeared somewhere else entirely, and the query that had been correct for
years started returning an empty result.

### Why

`x NOT IN (a, b, NULL)` expands to `x <> a AND x <> b AND x <> NULL`. The last comparison
is not false — it is **unknown**, because nothing equals `NULL` and nothing fails to equal
it either. `true AND unknown` is `unknown`, and `WHERE unknown` does not pass a row. So
every row fails the test, and the result is empty however many rows would otherwise match.

This is ordinary three-valued logic ([phase 2](../../phase-2-types/06-null.md)) doing
exactly what it is specified to do. There is no bug and no warning — which is precisely why
it survives to production.

`NOT EXISTS` never compares anything to `NULL`. It asks *"is there a matching row?"* and a
row with `customer_id IS NULL` simply does not match `o.customer_id = c.id`. The absence of
a match is a plain `false`, so the outer row passes.

### The fixes, in order of preference

1. **`NOT EXISTS`.** Correct regardless of nulls, and the planner produces an anti join —
   the same plan shape you were hoping for from `NOT IN`.
2. **`LEFT JOIN … WHERE right.id IS NULL`.** The older anti-join spelling; also
   null-safe, and worth recognising in existing code.
3. **`NOT IN (SELECT col FROM t WHERE col IS NOT NULL)`.** Works, but it is a patch that
   has to be remembered every time and re-applied by every future editor.
4. **A `NOT NULL` constraint on the column**, if the data model allows it — then the trap
   cannot arise. This is the only fix that is structural rather than per-query.

**`NOT IN` against a literal list you built in the application is fine** — you control
whether it contains a `NULL`. The trap is specifically `NOT IN (subquery)` over a nullable
column.

## `EXISTS` does not care what you select

`SELECT 1`, `SELECT *`, `SELECT NULL` inside an `EXISTS` are identical — the planner never
evaluates the target list, only whether a row exists. `SELECT 1` is the conventional
spelling and signals the intent; there is no performance argument between them.

## In Node

```js
// Anti join: customers with no orders. Null-safe by construction.
const {rows} = await pool.query(
  `SELECT c.id, c.name
   FROM agg_customers c
   WHERE NOT EXISTS (
     SELECT 1 FROM agg_orders o WHERE o.customer_id = c.id
   )
   ORDER BY c.id`,
);

// A list of ids from the application: one array parameter, not N placeholders.
const {rows} = await pool.query(
  `SELECT id, name FROM agg_customers WHERE id = ANY($1::int[])`,
  [ids],
);
```

- **`= ANY($1::int[])` instead of building `IN ($1, $2, $3, …)`.** One parameter whatever
  the list length, no string-built SQL, and no re-planning per distinct list size. The bulk
  version of the same idea — `unnest` to bridge 5000 rows through 3 parameters — is
  [measured in phase 4](../../phase-4-crud/19-values-unnest.md).
- **An empty array is safe**: `= ANY('{}')` matches nothing and returns no rows. An empty
  `IN ()` is a syntax error, which is why the string-building version needs a special case
  and this one does not.
- **Never build a `NOT IN` list by interpolation.** Beyond the injection risk
  ([phase 7](../../phase-7-pg-driver/04-query-placeholders.md)), a `null` that reaches the
  list turns the whole predicate into "no rows".

## Trade-off

`IN` reads more naturally than `EXISTS` for a simple membership test, and for a literal
list it is the obvious thing to write. But the readability advantage disappears the moment
the test is negated or the column is nullable, and the failure mode is an empty result set
rather than an error. **Defaulting to `EXISTS`/`NOT EXISTS` for every subquery-based
membership test costs a little clarity on the easy cases and removes an entire class of
silent bug** — that is a trade worth making by policy rather than case by case.

## Gotchas

**Symptom:** a `NOT IN (subquery)` query suddenly returns no rows at all
**Cause:** the subquery now contains at least one `NULL`; `x <> NULL` is unknown, so every
row fails. Measured: the same query went from 1 row to 0 after one `NULL` was inserted,
while `NOT EXISTS` still returned 1
**Fix:** `NOT EXISTS`. Failing that, filter the nulls out of the subquery or make the
column `NOT NULL`

**Symptom:** the bug cannot be reproduced in staging
**Cause:** staging has no `NULL` in that column. The behaviour depends entirely on one null
existing
**Fix:** insert one deliberately and re-run the query — that is the test

**Symptom:** `IN ()` with an empty list is a syntax error
**Cause:** an empty parenthesised list is not valid SQL
**Fix:** `= ANY($1::int[])` with an array parameter, which handles the empty case as
"matches nothing"

**Symptom:** a query with a large `IN (...)` list re-plans constantly
**Cause:** each distinct list length is a different statement text
**Fix:** one array parameter with `= ANY`, so the text is stable

**Symptom:** an `EXISTS` was "optimised" by changing `SELECT 1` to `SELECT id`
**Cause:** a belief that the target list is evaluated
**Fix:** it is not. The two are identical; keep `SELECT 1` for intent

## Interview questions

**★ What is the difference between `IN`, `= ANY` and `EXISTS`?**
For the positive case, none that matters — `IN` is defined as `= ANY`, and all three plan as
a semi join. Measured: all three returned 4. The difference appears under negation and with
nulls.

**★ Why does `NOT IN` return no rows when the subquery contains a `NULL`?**
`x NOT IN (a, NULL)` is `x <> a AND x <> NULL`. Comparing to `NULL` yields unknown, and
`true AND unknown` is unknown, which `WHERE` does not pass. So every row is rejected.
Measured: 1 row became 0 rows after a single `NULL` was introduced.

**★ Does `NOT EXISTS` have the same problem?**
No. It never compares a value to `NULL` — it asks whether a matching row exists, and a row
with a `NULL` join key simply does not match. Measured: it still returned 1 with the `NULL`
present.

**★ How would you write "customers with no orders"?**
`NOT EXISTS (SELECT 1 FROM agg_orders o WHERE o.customer_id = c.id)`. The `LEFT JOIN … WHERE
o.id IS NULL` form is equivalent and also null-safe. `NOT IN` is the one to avoid.

**★ How do you pass a list of ids from the application?**
`= ANY($1::int[])` with a single array parameter — stable statement text regardless of list
length, no string building, and an empty array is valid and matches nothing, unlike `IN ()`.

**Does `SELECT 1` versus `SELECT *` inside `EXISTS` matter?**
No. The target list is never evaluated. `SELECT 1` is convention, not optimisation.

---

← [Correlated subqueries and what they cost](02-correlated-and-cost.md) · Next topic → [Counting for pagination](../pagination-counts/)
