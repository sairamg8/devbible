---
title: "One row per matching pair"
sidebar_label: "01 · Matching pairs"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**The output of an INNER JOIN is the set of pairs `(left_row, right_row)` that satisfy the
condition. Everything surprising about joins follows from taking that definition
literally — including the fact that the result can be smaller than either input, larger
than both, or exactly the size you expected for the wrong reason.**

## The measurement

```sql
SELECT c.name, o.id AS order_id
FROM j_customers c
JOIN j_orders o ON o.customer_id = c.id
ORDER BY o.id;
```

```console
$ node ex35-joins.mjs
=== 1. INNER JOIN — only matching pairs survive ===
customers                : [{"n":4}]
orders                   : [{"n":4}]
INNER JOIN rows          : [{"name":"Ann","order_id":10},{"name":"Ann","order_id":11},
                            {"name":"Bob","order_id":12},{"name":"Cid","order_id":13}]
  Dee (no orders) is gone, Ann appears TWICE - one row per matching pair
```

Four customers in, four orders in, four rows out — and the coincidence is doing real
damage to intuition here, because those four output rows are **not** the four customers.
Dee is missing and Ann is duplicated. If you had written this query expecting "one row per
customer" the row count would have confirmed your belief while the data contradicted it.

## Reading the rule literally

Take the definition as a nested loop, which is one of the strategies the planner actually
uses:

```
for each row c in j_customers:
    for each row o in j_orders:
        if o.customer_id = c.id:
            emit (c, o)
```

Three consequences drop out immediately, and they are the whole topic:

| Left row has… | Effect on output |
|---|---|
| no matching right row | **the left row does not appear at all** |
| exactly one match | one row — the case people picture |
| N matches | **the left row's columns are repeated N times** |

So for a left row, the join is simultaneously a *filter* (no match → dropped) and a
*multiplier* (N matches → N copies). Neither is visible in the query text. The only way to
know which is happening is to know the cardinality of the relationship, which is why
"is this FK nullable, and is it unique?" is the first question to ask about any join.

### Predicting the row count

For an equijoin from a child table to its parent via a `NOT NULL` foreign key, the output
is **exactly one row per child row** — the FK guarantees a match exists and the parent's
primary key guarantees it is unique. That is the one direction where the count is
knowable in advance, and it is why `orders JOIN customers` is safe while
`customers JOIN orders` is not.

Reverse it — parent to child — and the output is the number of *children*, with parents
having none silently dropped. The fixture shows both: joining from `j_orders` would have
given 4 rows with no surprises; joining from `j_customers` gave 4 rows that happen to
match the input count by accident.

Making a FK `NOT NULL` is therefore not only an integrity decision. It determines whether
a join in that direction can lose rows.

## `JOIN` is `INNER JOIN`

The keyword `INNER` is optional and the parser discards it. `JOIN`, `INNER JOIN`, and the
archaic comma form with the condition in `WHERE` all produce the same plan:

```sql
FROM j_customers c JOIN j_orders o ON o.customer_id = c.id     -- this corpus
FROM j_customers c INNER JOIN j_orders o ON o.customer_id = c.id
FROM j_customers c, j_orders o WHERE o.customer_id = c.id      -- legacy, avoid
```

The third is worth avoiding for a reason that has nothing to do with style: if you omit
the condition, the first two are **syntax errors** and the third is a silent cross join.
That is measured on [CROSS JOIN](../07-cross-join.md), where a missing condition turned
4 and 5 rows into 20 with no complaint.

## What the planner does with it

`ON o.customer_id = c.id` is an *equijoin*, which unlocks all three strategies. The
planner picks by cost, and the choice is visible in `EXPLAIN`:

| Node | Chosen when | Cost shape |
|---|---|---|
| `Nested Loop` | one side is small and the other has an index on the join column | one index probe per driving row |
| `Hash Join` | both sides are large, condition is equality | build a hash of the smaller side, scan the larger once |
| `Merge Join` | both sides already sorted on the join key, or sorting is cheap | one pass over each |

Two practical consequences. First, **a non-equality condition leaves only the nested loop.**
`ON b.v BETWEEN a.lo AND a.hi` cannot be a hash join, which needs equality to build a hash
key — and it cannot be a merge join either. Merge join requires a **mergejoinable** clause,
meaning a btree equality operator it can walk both sorted inputs against; a pure range
predicate has none, so there is no second plan to fall back to. That is why
[range joins](../13-join-expressions.md) need an index on the probed side far more urgently
than an equijoin does: the nested loop is not one option among three, it is the only one, and
without an index each of its probes is a full scan. Second, the
planner's choice depends on row *estimates*, so stale statistics produce the classic
failure where a nested loop is chosen for what turns out to be a million driving rows.
`ANALYZE`, and read the `rows=` estimate against `actual rows` in
[EXPLAIN](../../phase-10-indexes/03-explain.md).

You do not choose the strategy and should not try to. What you control is whether the join
column is indexed on the probed side — an unindexed foreign key is the single most common
reason a correct join is slow, and
[Phase 10](../../phase-10-indexes/18-fk-indexes.md) has the catalog query that finds them.

## Order does not matter to the planner

```sql
FROM j_customers c JOIN j_orders o ON o.customer_id = c.id
FROM j_orders o JOIN j_customers c ON c.id = o.customer_id
```

Identical results, identical plans — the planner reorders inner joins freely and will
drive from whichever side it costs cheaper. Write them in the order a reader thinks: the
entity the query is *about* first, then outward along the relationships.

That freedom is specific to inner joins. Introduce an outer join and the order becomes
semantic, which is the trap on [multi-table joins](../04-multi-join.md).

## From Node

```js
const {rows} = await pool.query(
  `SELECT c.name, o.id AS order_id
   FROM j_customers c
   JOIN j_orders o ON o.customer_id = c.id
   WHERE c.country = $1
   ORDER BY o.id`,
  [country],
);
```

Nothing about a join changes the driver contract: values go through `$1`, never string
concatenation. Table and column names **cannot** be parameterised — `ORDER BY $1` is a
silent no-op rather than an error, measured in
[Phase 4](../../phase-4-crud/08-parameters.md). When the join target or sort column is
user-selected, it needs an allowlist:
[safe dynamic WHERE](../../phase-9-api-crud/safe-dynamic-where/).

One shape worth internalising early — the result is **flat**. There is no nesting in a
relational result, so `{customer, orders: [...]}` is something you build in JS or ask
SQL to build with `json_agg` ([N-N relationships](../05-nn-join-table.md)). Joining and
then grouping in JS works, but it transfers the customer columns once per order.

## Trade-off

A join does in one round trip what would otherwise be N+1 queries, and the planner can
choose strategies you would never write by hand. The cost is that the result is
**denormalised**: repeated left-hand rows inflate the payload the driver must materialise,
and every aggregate over that result needs care. Two queries at the right grain often beat
one join whose rows you immediately de-duplicate in JS — especially when the parent has
wide columns and many children, where the join multiplies the wide side by the child count.

## Gotchas

**Symptom:** A list endpoint returns fewer entities than exist in the table
**Cause:** `JOIN` where the relationship is optional — unmatched rows are dropped
**Fix:** `LEFT JOIN`, and then check that no `WHERE` on the right table re-creates the
inner join ([LEFT JOIN](../left-join/))

**Symptom:** The same entity appears several times in a list
**Cause:** Joining to a one-to-many when you only needed the parent
**Fix:** `EXISTS` if you needed existence ([semi joins](../semi-anti/)), or aggregate the
child side. Reaching for `DISTINCT` hides the duplication rather than fixing it

**Symptom:** Row count matches expectations but the data is wrong
**Cause:** Coincidence — as in the measurement, 4 in and 4 out with one row lost and one
duplicated
**Fix:** Check identities, not counts. `count(DISTINCT c.id)` against `count(*)` tells you
immediately whether fan-out occurred

**Symptom:** A join that was fast becomes very slow after data growth
**Cause:** The planner switched strategy, or stale statistics kept it on a nested loop
that is now driving millions of rows
**Fix:** `ANALYZE`, then compare estimated `rows=` with `actual rows` in
`EXPLAIN (ANALYZE, BUFFERS)`

## Interview questions

**★ How many rows does an INNER JOIN return?**
One per matching pair. Fewer than either input when rows do not match, more than both when
the relationship is many-to-many. On the fixture, 4 customers joined to 4 orders gave 4
rows — with Dee dropped and Ann duplicated.

**★ Which direction of a join can lose rows?**
Parent to child. Child to parent via a `NOT NULL` foreign key always yields exactly one row
per child, because the FK guarantees the match exists and the PK guarantees it is unique.
A nullable FK removes that guarantee in both directions.

**★ Is `JOIN` the same as `INNER JOIN`?**
Yes; `INNER` is optional syntax. The forms that change meaning are `LEFT`/`RIGHT`/`FULL`
and `CROSS`. The comma form is also an inner join but makes a missing condition legal —
prefer explicit `JOIN … ON`, where the same omission is a syntax error.

**Does the order of tables in the FROM clause affect the result or the plan?**
For inner joins, neither — the planner reorders freely by cost. It affects readability and
what each `ON` clause may reference. For outer joins the order is semantic.

**What decides whether the planner uses a hash, merge, or nested-loop join?**
Estimated cost, driven by statistics and available indexes. Equality conditions allow all
three; non-equality conditions rule out the hash join. You influence it through indexes and
`ANALYZE`, not by choosing directly.

---

← [Topic index](README.md) · Next → [Fan-out and aggregates](02-fan-out-and-aggregates.md)
