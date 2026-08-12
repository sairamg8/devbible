---
title: "The logical query processing order"
sidebar_label: "09 · Logical order"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex14-crud.mjs`.

**SQL is written in one order and evaluated in another. Knowing the evaluation order
explains a whole family of errors that otherwise look arbitrary — starting with why a
select-list alias works in `ORDER BY` and fails in `WHERE`.**

## The order

```
FROM  →  WHERE  →  GROUP BY  →  HAVING  →  SELECT  →  DISTINCT  →  ORDER BY  →  LIMIT
```

`SELECT` — where aliases are created — comes **seventh**. Everything before it cannot
see them; `ORDER BY` and `LIMIT`, which come after, can.

## The measured consequence

```sql
SELECT price * qty AS total FROM c_items WHERE total > 10;
```

```console
$ node ex14-crud.mjs
=== 6. logical query processing order ===
alias in WHERE  → 42703 column "total" does not exist
alias in ORDER BY works → 57.50
```

`42703 column "total" does not exist` — when `WHERE` runs, the alias has not been
created. The same alias in `ORDER BY` works, because `ORDER BY` runs after `SELECT`.

The fix is to repeat the expression, since it is evaluated per row either way:

```sql
SELECT price * qty AS total
  FROM c_items
 WHERE price * qty > 10          -- repeat the expression
 ORDER BY total DESC NULLS LAST  -- alias is fine here
 LIMIT 2;
```

Repeating it costs nothing — PostgreSQL evaluates the expression once per row
regardless. If the repetition is ugly, wrap it in a subquery or CTE so the alias
exists before the outer `WHERE`:

```sql
SELECT * FROM (SELECT price * qty AS total FROM c_items) s WHERE s.total > 10;
```

## What each step explains

**`WHERE` before `GROUP BY`** — `WHERE` filters rows, `HAVING` filters groups. This
is why aggregate conditions belong in `HAVING`:

```sql
-- ✗ 42803: aggregates are not allowed in WHERE
SELECT user_id, count(*) FROM orders WHERE count(*) > 5 GROUP BY user_id;

-- ✓
SELECT user_id, count(*) FROM orders GROUP BY user_id HAVING count(*) > 5;
```

And why filtering non-aggregate conditions in `WHERE` is faster than in `HAVING`:
`WHERE` discards rows before they are grouped, so there is less to group.

**`GROUP BY` before `SELECT`** — after grouping, only the grouping columns and
aggregates exist. Anything else raises `42803 column must appear in the GROUP BY
clause or be used in an aggregate function`, which is the database telling you the
value is ambiguous: the group has many rows and no single answer for that column.

**`SELECT` before `DISTINCT`** — `DISTINCT` applies to the select list *after* it is
computed, which is why `SELECT DISTINCT id, random()` never deduplicates anything.

**`DISTINCT` before `ORDER BY`** — you can only order by something that survived
`DISTINCT`. This is also why `DISTINCT ON` has its strict `ORDER BY` rule
([`DISTINCT` and `DISTINCT ON`](12-distinct-on.md)).

**`ORDER BY` before `LIMIT`** — the sort happens over the whole result, then the
limit takes the top N. `LIMIT` without `ORDER BY` returns an arbitrary N, not "the
first N".

## Logical order is not execution order

This is the part worth being precise about. The order above defines **semantics** —
what the query means. The planner is free to execute it any way that produces the
same answer, and it routinely does something different:

- It pushes `WHERE` predicates down into index scans, so rows are filtered as they
  are read rather than after a full `FROM`.
- With `LIMIT` it may use a top-N heapsort that never materialises the full sorted
  set.
- It reorders joins entirely, regardless of how you wrote the `FROM`.

So use logical order to reason about **correctness and error messages**, and
`EXPLAIN (ANALYZE, BUFFERS)` to reason about **performance**. Conflating them leads
to folklore like "put the most selective condition first in `WHERE`", which has no
effect — the planner decides.

## Where the ordinal shortcut fits

`ORDER BY 1` and `GROUP BY 1` refer to select-list positions, which works precisely
because both run after `SELECT`:

```sql
SELECT date_trunc('day', created_at) AS day, count(*) FROM orders GROUP BY 1 ORDER BY 1;
```

Convenient for grouping by a long expression. Brittle for anything else — inserting a
column into the select list silently changes the meaning. And note from
[Sort and filter allowlists](../phase-9-api-crud/allowlists/) that a bare integer
*literal* means "column N" while a bound `$1` does **not**: it sorts by a constant and
silently does nothing.

## Trade-off

The written order (`SELECT` first) is optimised for reading — it says what you want
before the details of where it comes from. The evaluation order is what the semantics
require: you cannot compute a select list before knowing which rows survive.

Living with the mismatch means occasionally repeating an expression, or wrapping a
query in a subquery to make an alias visible. Both are cheap. The alternative —
allowing aliases in `WHERE`, as some engines do — introduces ambiguity when an alias
shadows a real column, which is why the standard forbids it.

## Gotchas

**Symptom:** `42703 column "total" does not exist` for an alias you just defined
**Cause:** `WHERE` runs before `SELECT`, so the alias does not exist yet — measured.
**Fix:** Repeat the expression in `WHERE`, or wrap in a subquery/CTE.

**Symptom:** `42803 aggregate functions are not allowed in WHERE`
**Cause:** `WHERE` filters rows before grouping; aggregates exist only after
`GROUP BY`.
**Fix:** `HAVING`.

**Symptom:** `42803 column must appear in the GROUP BY clause`
**Cause:** After grouping, only grouping columns and aggregates are single-valued.
**Fix:** Add the column to `GROUP BY`, or wrap it in an aggregate such as `min()`.

**Symptom:** `SELECT DISTINCT` returns duplicates
**Cause:** `DISTINCT` applies to the whole select list after it is computed —
including a unique id or a volatile expression.
**Fix:** Remove the distinguishing column, or use `DISTINCT ON`.

**Symptom:** `LIMIT` returns different rows each run
**Cause:** No `ORDER BY`, so "first N" is arbitrary — and a non-total sort has the
same effect.
**Fix:** An `ORDER BY` ending in a unique column.

**Symptom:** Reordering `WHERE` conditions changed nothing
**Cause:** Logical order is semantics, not execution; the planner decides.
**Fix:** Read `EXPLAIN (ANALYZE, BUFFERS)` instead.

**Symptom:** A report broke after adding a column to the select list
**Cause:** `GROUP BY 1` / `ORDER BY 2` are positional.
**Fix:** Name the expression or repeat it.

## Interview questions

**★ What is the logical query processing order?**
`FROM → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT`. It defines
what the query *means*; the planner may execute it differently as long as the result
is the same.

**★ Why can you use a select alias in `ORDER BY` but not in `WHERE`?**
Aliases are created by `SELECT`, which runs after `WHERE` and before `ORDER BY`.
Measured: the alias in `WHERE` raised `42703 column "total" does not exist`, while
the same alias in `ORDER BY` worked. Repeat the expression in `WHERE` — it costs
nothing, since it is evaluated per row anyway.

**★ `WHERE` or `HAVING`?**
`WHERE` filters rows before grouping; `HAVING` filters groups after. Aggregate
conditions must be in `HAVING` (`42803` otherwise). Non-aggregate conditions belong
in `WHERE`, where they reduce the number of rows to be grouped.

**★ Why does `SELECT DISTINCT` sometimes not deduplicate?**
`DISTINCT` applies to the entire computed select list. If it includes a unique id or
a volatile expression such as `random()`, every row is already distinct. Drop the
distinguishing column or use `DISTINCT ON`.

**★ Does putting the most selective condition first in `WHERE` help?**
No. Logical order is about semantics, not execution — the planner chooses access
paths and predicate order from statistics. Use `EXPLAIN (ANALYZE, BUFFERS)` to see
what it actually did.

**Why does `LIMIT` without `ORDER BY` return arbitrary rows?**
Because `LIMIT` runs last and simply stops after N rows of whatever order the plan
produced. There is no default order in SQL, so "the first 10" is undefined without an
`ORDER BY` — and one that is not total is equally undefined.

---

← [Parameterized queries](08-parameters.md) · Next → [`ORDER BY`](10-order-by.md)
