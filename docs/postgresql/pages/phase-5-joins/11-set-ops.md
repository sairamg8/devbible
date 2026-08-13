---
title: "UNION INTERSECT EXCEPT"
sidebar_label: "11 · Set ops"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**Joins combine tables sideways, adding columns. Set operations stack results vertically,
adding rows. The one that costs money is `UNION`, which deduplicates whether or not you
need it — 491 ms against 142 ms for `UNION ALL` over the same 600 000 rows.**

## The three operators

```sql
SELECT 1 UNION SELECT 1 UNION SELECT 2;         -- dedupes
SELECT 1 UNION ALL SELECT 1 UNION ALL SELECT 2; -- keeps duplicates
SELECT id FROM j_customers INTERSECT SELECT customer_id FROM j_orders ORDER BY 1;
SELECT id FROM j_customers EXCEPT    SELECT customer_id FROM j_orders ORDER BY 1;
```

```console
$ node ex35-joins.mjs
=== 11. UNION / INTERSECT / EXCEPT ===
UNION (dedupes)          : [{"?column?":1},{"?column?":2}]
UNION ALL (keeps dupes)  : [{"?column?":1},{"?column?":1},{"?column?":2}]
INTERSECT                : [{"id":1},{"id":2},{"id":3}]
EXCEPT                   : [{"id":4}]
```

`INTERSECT` gives the customers who have orders — the same answer as the semi join on
[page 03](semi-anti/). `EXCEPT` gives Dee, the same answer as the anti join. Both also
deduplicate, and both have an `ALL` variant that does not.

The `ALL` variants of `INTERSECT` and `EXCEPT` are multiset operations, and their semantics
surprise people: `INTERSECT ALL` keeps `min(count_left, count_right)` copies of each value,
and `EXCEPT ALL` keeps `count_left − count_right`. They are occasionally exactly what a
reconciliation needs — "this batch has three more of SKU A than the manifest" — and are
otherwise best avoided as a source of confusion.

An important semantic difference from the join forms: set operators compare **whole rows**,
not a key. `EXCEPT` on `(id, name)` removes a row only when both columns match, so a
renamed row appears in the difference. `NOT EXISTS` correlated on `id` would not report it.
When the question is "which entities are missing", use the anti join; when it is "which
rows differ", use `EXCEPT`.

Set operators are the right tool when the two sides are **different queries producing the
same shape** — this year's table and last year's archive, two sources being merged, a
`UNION ALL` over partitions. When one side is a filter on the other, a semi or anti join
says it better and the planner has dedicated nodes for those.

## The cost of deduplicating

Two branches of 300 000 rows each:

```console
UNION over 2 x 300k rows     : HashAggregate (actual time=334.613..467.797 rows=300000.00 loops=1) 491.299 ms
UNION ALL over the same rows : Append (actual time=0.010..107.653 rows=600000.00 loops=1) 142.442 ms
```

**491 ms against 142 ms — 3.5×.** `UNION ALL` is a plain `Append`: it streams one branch
after the other and returns the first row almost immediately (`actual time=0.010`).
`UNION` adds a `HashAggregate` over all 600 000 rows to remove duplicates, and must consume
**everything** before it can emit a single row — note `334.613` before the first row
appears.

That blocking behaviour matters as much as the raw time. Under a `LIMIT`, `UNION ALL` can
stop early; `UNION` cannot.

**Default to `UNION ALL`.** Add the deduplicating form only when duplicates are possible
*and* wrong. Branches that select from disjoint sources — different date ranges, different
partitions, different tenants — cannot produce duplicates, so `UNION` there is pure waste.

## Type and column rules

```console
UNION with mismatched column counts            ->  42601 each UNION query must have the same number of columns
UNION with incompatible types                  ->  22P02 invalid input syntax for type integer: "abc"
UNION takes column names from the FIRST branch: [{"first_name":1},{"first_name":2}]
```

Three rules, all visible above:

- **Column counts must match** — `42601`, raised at parse time.
- **Types must be compatible**, resolved by the same rules as a `CASE` expression.
  `SELECT 1 UNION SELECT 'abc'` fails with **`22P02`**, not a type-mismatch error: the
  literal `'abc'` is untyped, so PostgreSQL resolves the union to `integer` and then fails
  *casting* the string. Mixing `int` and `text` columns from real tables gives
  `42804 UNION types integer and text cannot be matched` instead.
- **Column names come from the first branch only.** `SELECT 1 AS first_name UNION ALL
  SELECT 2` labels both rows `first_name`. Names in later branches are ignored entirely,
  so aliasing only the second branch produces `?column?` — visible in the very first output
  line, where neither branch was aliased.

`ORDER BY` and `LIMIT` at the end apply to the **whole** result, not the last branch, and
`ORDER BY` may only reference output column names or positions (`ORDER BY 1`). To sort or
limit within a branch, parenthesise it:

```sql
(SELECT id FROM a ORDER BY created_at DESC LIMIT 10)
UNION ALL
(SELECT id FROM b ORDER BY created_at DESC LIMIT 10)
ORDER BY id;
```

Precedence: `INTERSECT` binds tighter than `UNION` and `EXCEPT`, which are left-associative.
Parenthesise anything mixing them rather than relying on that.

## Where set operators are structural, not optional

`UNION ALL` is not only a way to combine two queries — it is the joining operator of a
recursive CTE, where the anchor and the recursive term are separated by it:

```sql
WITH RECURSIVE chain AS (
  SELECT … FROM j_emp WHERE manager_id IS NULL
  UNION ALL
  SELECT … FROM j_emp e JOIN chain c ON e.manager_id = c.id)
```

`UNION` is legal there and deduplicates on every iteration, which costs more and can mask a
cycle by silently discarding the repeat instead of looping visibly. Use `UNION ALL` and
detect cycles explicitly — [self joins](09-self-join.md).

Partitioned reads are the other structural use: a query over a table inherited by month
partitions is an `Append` of per-partition scans, which is the same node `UNION ALL`
produces. That is why `UNION ALL` over disjoint sources costs so little — it is the shape
the executor already uses internally.

## From Node

```js
const {rows} = await pool.query(
  `SELECT id, title, 'post' AS kind FROM j_posts   WHERE title ILIKE $1
   UNION ALL
   SELECT id, name,  'tag'  AS kind FROM j_tags    WHERE name  ILIKE $1
   ORDER BY kind, id
   LIMIT $2`,
  [`%${term}%`, limit],
);
```

The classic mixed-entity search. Both branches must produce the same column count and
compatible types, so the second selects `name` into the `title` slot; the literal `kind`
column is what lets the client tell them apart. `$1` is referenced twice — `pg` sends
parameters positionally, so one placeholder can appear any number of times.

## Trade-off

Set operations combine results that no join could, because the branches need not share a
key — or even a table. What you give up is the planner's ability to optimise across the
boundary: each branch is planned separately, so an index that would help a combined
predicate cannot be applied once to both, and `UNION`'s deduplication is a blocking
aggregate over the total row count. For two filters on the *same* table, `WHERE a OR b`
usually plans better than a `UNION` of two queries — though the union form occasionally
wins when each branch hits a different index and the `OR` prevents either from being used.

## Gotchas

**Symptom:** A union query is slow and returns nothing until it finishes
**Cause:** `UNION` deduplicating, which must consume both branches before emitting a row
**Fix:** `UNION ALL` when duplicates are impossible — 491 ms vs 142 ms measured

**Symptom:** `ERROR: 42601 each UNION query must have the same number of columns`
**Cause:** Branches select different column counts
**Fix:** Pad the shorter branch with `NULL::type AS col`

**Symptom:** `22P02 invalid input syntax for type integer`
**Cause:** Type resolution picked the first branch's type and the second could not be cast
**Fix:** Cast explicitly in every branch: `SELECT x::text …`

**Symptom:** Result column names are wrong, or `?column?`
**Cause:** Names are taken from the first branch only
**Fix:** Alias in the first branch

**Symptom:** `ORDER BY` inside a union sorts the whole result, not the branch
**Cause:** A trailing `ORDER BY` binds to the union
**Fix:** Parenthesise the branch that needs its own ordering or limit

**Symptom:** `ERROR: 42P10 for SELECT DISTINCT, ORDER BY expressions must appear in select
list` when ordering a `UNION` by a column you did not select
**Cause:** `ORDER BY` on a union may only reference output columns
**Fix:** Select the column, or sort in a wrapping query

## Interview questions

**★ `UNION` vs `UNION ALL` — which should you default to and why?**
`UNION ALL`. `UNION` adds a deduplication pass over the combined result: `HashAggregate`
at 491 ms against a streaming `Append` at 142 ms for 600 000 rows, and it blocks until both
branches are exhausted. Use `UNION` only when duplicates are both possible and wrong.

**★ How do set operations differ from joins?**
Joins combine tables horizontally on a condition, producing wider rows. Set operations
stack results vertically, producing more rows, and require matching column counts and
compatible types rather than a key.

**★ Where do a union's column names come from?**
The first branch. Later branches' aliases are ignored — a common source of `?column?` in a
client that expects a named field.

**When would you use `INTERSECT` or `EXCEPT` over a semi/anti join?**
When the two sides are genuinely independent queries. If one is a filter on the other,
`EXISTS`/`NOT EXISTS` is clearer, planner-friendlier, and does not deduplicate the left
side behind your back.

**Can you `ORDER BY` a column that is not in the select list of a union?**
No. The `ORDER BY` applies to the union's output columns, so the column must be selected —
or you wrap the whole union in an outer query.

---

← [LATERAL](10-lateral.md) · Next → [Alias discipline](12-alias-discipline.md)
