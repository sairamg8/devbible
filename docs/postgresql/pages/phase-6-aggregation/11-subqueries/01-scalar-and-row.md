---
title: "Scalar and row subqueries"
sidebar_label: "01 · Scalar and row subqueries"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37-cte-subquery.mjs`.

**A subquery in an expression position must produce exactly one row and one column. That
constraint is enforced at *runtime*, not by the planner — so a scalar subquery that is
correct against today's data and wrong against tomorrow's passes review, passes tests, and
fails in production with `21000`.**

## A scalar subquery is a value

```sql
SELECT id, total,
       (SELECT round(avg(total), 2) FROM agg_orders) AS avg_all
FROM agg_orders
WHERE total IS NOT NULL
ORDER BY id LIMIT 3;
```

```console
scalar subquery         : [{"id":10,"total":100,"avg_all":"110.00"},
                           {"id":11,"total":50,"avg_all":"110.00"},
                           {"id":12,"total":200,"avg_all":"110.00"}]
```

The subquery runs once and its single value is attached to every row. This is the shape for
*"each row, plus something about the whole set"* — a value next to its own average, a count
next to a total, a row next to the maximum it is being compared against.

Because it is uncorrelated — it mentions nothing from the outer query — PostgreSQL
evaluates it **once**, not once per row. That is the difference between this and the
correlated form in [the next chunk](02-correlated-and-cost.md), and it is the whole
performance story of subqueries in one sentence.

`avg_all` arrives as the string `"110.00"` rather than a number, which is the standard
`numeric` behaviour in the driver — `numeric` is arbitrary precision and would lose
information as a JS `number`, so `pg` hands it over as text
([phase 7](../../phase-7-pg-driver/09-pg-types.md)).

## More than one row is a runtime error

```sql
SELECT id, (SELECT status FROM agg_orders) FROM agg_orders LIMIT 1;
```

```console
scalar subquery returning 2 rows             ->  21000 more than one row returned by a subquery used as an expression
```

**`21000`, and only when it happens.** Nothing in the statement is invalid — the planner
cannot know how many rows `SELECT status FROM agg_orders` will return, so it accepts the
query and lets the executor discover the problem. A scalar subquery over a table that today
holds one matching row is a time bomb; the second row arrives months later and the endpoint
starts 500ing.

Three ways to make it safe, in descending order of preference:

1. **Aggregate it** — `(SELECT max(status) …)` or `min`, which cannot return two rows.
2. **Constrain it** to a key that is unique, so the database's own constraint is what
   guarantees one row.
3. **`LIMIT 1` with an `ORDER BY`** — honest only when "any one of them" genuinely is the
   requirement. `LIMIT 1` without `ORDER BY` makes the result depend on the plan, which is
   its own measured trap ([phase 4](../../phase-4-crud/03-limit-offset.md)).

`LIMIT 1` as a reflex to silence `21000` is the wrong instinct: it converts a loud error
into a silently arbitrary answer.

## Zero rows is `NULL`, not an error

The asymmetry is worth stating because it catches people from other languages: too many
rows raises, **too few does not**. A scalar subquery matching nothing yields `NULL`, and
`NULL` then propagates through whatever arithmetic or comparison it lands in. So the
failure mode for "no match" is not an exception but a quietly `NULL` column — and if that
column feeds a `WHERE`, the row disappears rather than announcing anything.

## Row constructors compare several columns at once

```sql
SELECT id, status, total FROM agg_orders
WHERE (status, total) = ('paid', 200)
ORDER BY id;
```

```console
row constructor         : [{"id":12,"status":"paid","total":200},{"id":14,"status":"paid","total":200}]
```

`(a, b) = (x, y)` is `a = x AND b = y`, written once. It is genuinely useful in three
places:

- **Keyset pagination**, where `(placed_at, id) > ($1, $2)` expresses "after this row in
  this ordering" in one comparison instead of the nested `OR` form people write by hand and
  get wrong ([phase 4](../../phase-4-crud/20-tuple-comparison.md)).
- **Matching a composite key** against a subquery: `WHERE (a, b) IN (SELECT x, y FROM …)`.
- **Multi-column `IN` lists**, which have no other concise spelling.

The `NULL` rules follow the usual three-valued logic, and row comparison inherits them: if
any component is `NULL` the result is `NULL` rather than false, which is the same mechanism
behind the `NOT IN` trap in [chunk 03](03-in-exists-and-not-in.md).

**Ordering comparisons are lexicographic**, not per-column: `(a, b) > (1, 5)` means *a > 1,
or (a = 1 and b > 5)* — not `a > 1 AND b > 5`. That is exactly what keyset pagination wants
and exactly what a hand-written `AND` gets wrong.

## Where a subquery may appear

| Position | Must return | Example |
|---|---|---|
| Target list (`SELECT` …) | one row, one column | `(SELECT avg(total) FROM …) AS avg_all` |
| `WHERE` as a value | one row, one column | `WHERE total > (SELECT avg(total) FROM …)` |
| `WHERE` with `IN`/`ANY`/`EXISTS` | any number of rows | `WHERE id IN (SELECT customer_id FROM …)` |
| `FROM` (a derived table) | any number of rows and columns | `FROM (SELECT … ) t` — **alias required** |
| `FROM … LATERAL` | any number, and may reference earlier `FROM` items | [phase 5](../../phase-5-joins/10-lateral.md) |

The one that trips people is `FROM`: a derived table **must** be aliased, and it cannot see
the other `FROM` items unless it is `LATERAL`. That restriction is the entire reason
`LATERAL` exists.

## In Node

```js
// The list, plus one figure about the whole filtered set.
const {rows} = await pool.query(
  `SELECT o.id, o.total,
          (SELECT round(avg(total), 2) FROM agg_orders WHERE status = $1) AS avg_paid
   FROM agg_orders o
   WHERE o.status = $1
   ORDER BY o.id
   LIMIT $2`,
  [status, limit],
);
```

- **The same parameter can appear as often as you need.** `$1` is used twice above and one
  value is passed. This is the tidy way to keep a scalar subquery's filter in step with the
  outer query's.
- **`numeric` comes back as a string.** `round(avg(...), 2)` is `numeric`, so it arrives as
  `"110.00"`. Cast in SQL (`::float8`) if you want a JS number and can accept the precision
  loss — do not `parseFloat` money.
- **A scalar subquery in the target list is computed once per statement, not per row**, as
  long as it is uncorrelated. If it mentions an outer column it becomes correlated, and the
  cost changes completely.

## Trade-off

A scalar subquery reads exactly like what it means — *this row, next to that figure* — with
no join, no fan-out risk, and no `GROUP BY` to get wrong. The price is that its
single-row-ness is a runtime property rather than a checked one, so the query is only as
correct as the data happens to be. Prefer a form whose one-row guarantee comes from an
aggregate or a unique constraint, so that the guarantee is enforced rather than assumed.

## Gotchas

**Symptom:** `21000 more than one row returned by a subquery used as an expression`, in
production only
**Cause:** a scalar subquery that matched one row in test data now matches several
**Fix:** aggregate it (`max`/`min`), or constrain it by a unique key. Reach for `LIMIT 1`
only when "any one" is genuinely the requirement — and then with an `ORDER BY`

**Symptom:** a column is unexpectedly `NULL` and no error was raised
**Cause:** the scalar subquery matched zero rows — too many rows raises, too few does not
**Fix:** `coalesce(...)` with a defined default, and decide whether "no match" should be an
error at the application level

**Symptom:** `numeric` values arrive in JavaScript as strings
**Cause:** `pg` does not convert `numeric` to a JS `number`, because it would lose precision
**Fix:** cast in SQL when the precision loss is acceptable, or keep it as a string for money

**Symptom:** a keyset pagination predicate written as `a > $1 AND b > $2` skips rows
**Cause:** row comparison is lexicographic; the `AND` form is a different, wrong condition
**Fix:** `(a, b) > ($1, $2)`

**Symptom:** `subquery in FROM must have an alias`
**Cause:** a derived table without a name
**Fix:** alias it — `FROM (SELECT …) t`

**Symptom:** a derived table cannot see a column from another `FROM` item
**Cause:** plain derived tables are evaluated independently of their siblings
**Fix:** `LATERAL`, which exists precisely to lift that restriction

## Interview questions

**★ What must a scalar subquery return, and what happens if it returns more?**
Exactly one row and one column. More than one row raises `21000` at execution time — not at
plan time, since the planner cannot know the row count. Zero rows is not an error: it
yields `NULL`.

**★ Is a scalar subquery in the target list evaluated once, or once per row?**
Once for the whole statement if it is uncorrelated. If it references a column from the outer
query it is correlated and may be re-executed per row, which is a different cost class
entirely.

**★ Someone fixes a `21000` by adding `LIMIT 1`. What is wrong with that?**
It converts a loud error into a silently arbitrary answer — and without `ORDER BY`, which
row you get depends on the plan and can change. The right fix is an aggregate or a unique
key, so that "one row" is guaranteed rather than truncated to.

**★ What does `(a, b) > (1, 5)` mean?**
Lexicographic comparison: `a > 1`, or `a = 1 AND b > 5`. Not `a > 1 AND b > 5`. This is why
row constructors are the correct spelling for keyset pagination.

**Where can a subquery appear, and what changes between those positions?**
Target list and scalar `WHERE` positions require one row and one column. `IN`/`ANY`/`EXISTS`
accept many rows. `FROM` accepts many rows and columns but requires an alias and cannot
reference sibling `FROM` items without `LATERAL`.

---

← [Topic index](README.md) · Next → [Correlated subqueries and what they cost](02-correlated-and-cost.md)
