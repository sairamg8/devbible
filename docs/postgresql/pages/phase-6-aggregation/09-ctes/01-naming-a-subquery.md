---
title: "Naming a subquery"
sidebar_label: "01 · Naming a subquery"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37b-cte-inlining.mjs`.

**A CTE is a name bound to a subquery for the duration of one statement. That is the whole
feature — the name exists only while the statement runs, and it buys readability, a place
to break a long query into named steps, and the ability to reference the same intermediate
result more than once. What it does *not* buy is a temporary table, and the difference is
the subject of [the next chunk](02-the-inlining-rule.md).**

## The shape

```sql
WITH paid AS (
  SELECT * FROM agg_orders WHERE status = 'paid'
)
SELECT customer_id, count(*)::int AS n, sum(total)::int AS spend
FROM paid
GROUP BY customer_id
ORDER BY customer_id;
```

```console
plain CTE               : [{"customer_id":1,"n":1,"spend":100},{"customer_id":2,"n":2,"spend":400}]
```

`paid` behaves like a table for the rest of the statement: it appears in `FROM`, it can be
joined, it can be grouped. It is gone the moment the statement finishes — there is nothing
to drop and nothing to clean up, and a second statement in the same transaction cannot see
it.

The same query without the CTE is a derived table:

```sql
SELECT customer_id, count(*)::int, sum(total)::int
FROM (SELECT * FROM agg_orders WHERE status = 'paid') paid
GROUP BY customer_id;
```

These two are the same query. The CTE version reads top-down — *first take the paid
orders, then aggregate them* — and the derived-table version reads inside-out. For one
level that is a matter of taste. At three levels it stops being one.

## Chaining: each step names the one before it

```sql
WITH paid AS (
  SELECT * FROM agg_orders WHERE status = 'paid'
),
per_cust AS (
  SELECT customer_id, sum(total)::int AS spend FROM paid GROUP BY customer_id
)
SELECT c.name, p.spend
FROM per_cust p
JOIN agg_customers c ON c.id = p.customer_id
ORDER BY p.spend DESC;
```

```console
chained CTEs            : [{"name":"Bob","spend":400},{"name":"Ann","spend":100}]
```

This is the pattern that earns CTEs their place. A report built from four filtering and
aggregating steps becomes four named steps in the order a human would describe them,
instead of four nested parentheses read from the middle outwards. Each name documents what
that step produces.

**Comma-separated, and only one `WITH`.** A common beginner error is repeating the keyword
— `WITH a AS (...) WITH b AS (...)`. There is one `WITH`, then a comma-separated list.

## Scope: forward references are an error

A CTE can see the ones declared **before** it, not after:

```console
a later CTE sees an earlier one                      ok  [{"y":2}]
an earlier CTE sees a later one (forward reference)  ->  42P01 relation "b" does not exist
WITH RECURSIVE allows the forward reference          ok  [{"y":1}]
```

The error is `42P01 relation "b" does not exist` — the same error you get for a genuinely
missing table, which is why this one gets misdiagnosed. If a CTE name you can plainly see
in the statement is reported as a missing relation, check the **order** of the declarations
before you check anything else.

**`WITH RECURSIVE` lifts the restriction for every CTE in the list**, not just the
recursive one. That is the one case where declaration order stops mattering. It is also
why the keyword is attached to `WITH` rather than to the individual CTE that recurses —
covered in [recursive CTEs](../recursive-cte/).

Duplicate names are rejected outright:

```console
two CTEs with the same name                          ->  42712 WITH query name "a" specified more than once
```

## A CTE name shadows a real table

```console
a CTE name shadows a real table                      ok  [{"id":99,"name":"shadow"}]
```

```sql
WITH agg_customers AS (SELECT 99 AS id, 'shadow' AS name)
SELECT id, name FROM agg_customers;   -- reads the CTE, not the table
```

No warning. Inside that statement, `agg_customers` means the CTE, and the real table is
unreachable by that name. This is occasionally useful for testing a query against a
handful of literal rows, and is otherwise a trap: name a CTE after a table and every
reference in a long statement silently changes meaning. **Give CTEs names that cannot
collide** — `paid_orders`, not `orders`.

## Column aliases can be declared on the name

```sql
WITH t (a, b) AS (SELECT 1, 2) SELECT a + b AS sum FROM t;
```

```console
CTE column aliases declared on the name              ok  [{"sum":3}]
wrong number of column aliases                       ->  42P10 WITH query "t" has 2 columns available but 3 columns specified
```

The alias list is positional and must match the column count exactly — `42P10` otherwise.
It is worth using when the CTE's own `SELECT` produces unnamed expression columns, since
the alternative is referring to `?column?`.

## Where `WITH` may be attached

Not just `SELECT`:

```console
WITH attached to an UPDATE                           ok  [{"id":10}]
WITH attached to a DELETE                            ok  []
```

```sql
WITH pick AS (SELECT id FROM agg_orders ORDER BY id LIMIT 1)
UPDATE agg_orders SET total = total
WHERE id IN (SELECT id FROM pick)
RETURNING id;
```

`WITH` goes at the front of `SELECT`, `INSERT`, `UPDATE`, `DELETE` and `MERGE`. This is how
you express "delete the oldest 100 rows" — `DELETE` has no `LIMIT` of its own
([measured in phase 4](../../phase-4-crud/11-delete.md)), so the rows are chosen in a CTE
and the `DELETE` matches on the result.

The reverse direction — a CTE that *itself* writes — is a separate topic with its own
rules: [data-modifying CTEs](../modifying-ctes/).

## A CTE is referenced like a table, anywhere a table can appear

```sql
WITH k AS (SELECT count(*)::int AS n FROM agg_orders)
SELECT (SELECT n FROM k) AS orders;
```

That one runs — a CTE is visible inside scalar subqueries in the target list, inside
`WHERE`, inside a join, and inside the recursive term of *another* CTE:

```console
a sibling CTE referenced from the recursive term of another ok  [{"n":3}]
```

## CTE vs the alternatives

| | Lives for | Visible to | Costs |
|---|---|---|---|
| **CTE** | one statement | that statement only | nothing to create or drop |
| **Derived table** (subquery in `FROM`) | one statement | its own query level | same; reads inside-out |
| **View** | until dropped | every session | a catalog object to migrate and version |
| **Materialized view** | until dropped | every session | storage, plus a `REFRESH` policy |
| **Temp table** | the session | that session | catalog churn per creation; needs `ANALYZE` to get statistics |

The honest summary: **a CTE is not a performance feature.** It is a naming feature. People
reach for a temp table when they want the intermediate result *stored* and *analyzed* —
which a CTE never does — and reach for a view when more than one statement needs the
definition.

The one case where a CTE genuinely changes the execution rather than the reading is when
the same intermediate result is referenced twice, because PostgreSQL will then compute it
once. That is measured in [the inlining rule](02-the-inlining-rule.md), along with the
much larger surprise that a CTE referenced *once* is not a boundary at all.

## In Node

A CTE is ordinary SQL text, so it parameterizes like anything else:

```js
const {rows} = await pool.query(
  `WITH paid AS (
     SELECT * FROM agg_orders
     WHERE status = 'paid' AND placed_at >= $1
   ),
   per_cust AS (
     SELECT customer_id, sum(total)::int AS spend
     FROM paid GROUP BY customer_id
   )
   SELECT c.name, p.spend
   FROM per_cust p
   JOIN agg_customers c ON c.id = p.customer_id
   ORDER BY p.spend DESC
   LIMIT $2`,
  [since, limit],
);
```

Two things worth knowing when the query lives in a template literal:

- **A parameter used inside a CTE counts once.** `$1` above is referenced in one place; if
  two CTEs both need the cutoff, they both write `$1` and you still pass one value.
- **Long CTE chains are where `SELECT *` hurts.** `SELECT * FROM agg_orders` inside `paid`
  carries every column through the whole statement, and if a later step joins another
  table with an overlapping column name, the driver collapses the duplicates into one key
  in the returned object — [measured in phase 7](../../phase-7-pg-driver/06-result-object.md).
  List the columns the last step actually needs.

## Trade-off

CTEs cost nothing at parse time and buy a query you can read top-down and review a step at
a time. The cost is that the readability suggests a boundary that mostly is not there: a
single-reference CTE is folded into the surrounding query, so a filter written outside it
can reach inside, and the "steps" you named do not execute in the order you wrote them.
Believing otherwise is the source of both the "my CTE is slow" and the "my CTE is a
temp table" misconceptions. Read [the inlining rule](02-the-inlining-rule.md) before
using a CTE to control *how* something executes.

## Gotchas

**Symptom:** `42P01 relation "x" does not exist` for a CTE that is plainly in the statement
**Cause:** it is declared *after* the CTE that references it — CTEs only see earlier ones
**Fix:** reorder the declarations, or add `RECURSIVE` to the `WITH`, which lifts the
restriction for the whole list

**Symptom:** a statement reads a handful of rows where a table should have thousands
**Cause:** a CTE was named after a real table and shadows it for the whole statement
**Fix:** rename the CTE. Nothing warns about this

**Symptom:** `42712 WITH query name "a" specified more than once`
**Cause:** two CTEs in one list share a name
**Fix:** rename one. Unlike shadowing a table, this at least errors

**Symptom:** `42P10 WITH query "t" has 2 columns available but 3 columns specified`
**Cause:** the optional alias list after the CTE name does not match the column count
**Fix:** match the count, or drop the alias list and name the columns in the `SELECT`

**Symptom:** a syntax error at the second `WITH`
**Cause:** the keyword was repeated per CTE
**Fix:** one `WITH`, then a comma-separated list

**Symptom:** the intermediate result is needed by the next statement and the name is gone
**Cause:** a CTE lives for exactly one statement
**Fix:** a temp table if it must persist across statements in the session, or fold both
statements into one

## Interview questions

**★ What is a CTE, and how long does it live?**
A named subquery bound for the duration of a single statement. It is not stored, not
visible to any other statement, and needs no cleanup. Anywhere a table name can appear in
that statement, the CTE name can.

**★ Is a CTE a performance optimization?**
No — it is a readability feature, and expecting otherwise causes real bugs. A CTE
referenced once is folded into the surrounding query, so it is not an optimization fence.
The only execution-level guarantee it gives is that a CTE referenced more than once is
computed once.

**★ CTE, view, or temp table — how do you choose?**
CTE when one statement needs the step named. View when several statements need the
definition and you accept a catalog object to version. Temp table when the intermediate
result must survive across statements in the session, or when it is large enough that you
want it stored and `ANALYZE`d so the planner has statistics for it.

**★ Why does my CTE report "relation does not exist" when I can see it?**
Declaration order — a CTE can only reference CTEs declared before it. `WITH RECURSIVE`
removes that restriction for every CTE in the list.

**Can `WITH` be attached to something other than `SELECT`?**
Yes — `INSERT`, `UPDATE`, `DELETE` and `MERGE`. It is the standard way to give `DELETE` a
`LIMIT` it does not have: choose the rows in a CTE, then match on that result.

**What happens if a CTE has the same name as a table?**
The CTE wins inside that statement, silently. The real table becomes unreachable by that
name for the whole statement.

---

← [Topic index](README.md) · Next → [The inlining rule](02-the-inlining-rule.md)
