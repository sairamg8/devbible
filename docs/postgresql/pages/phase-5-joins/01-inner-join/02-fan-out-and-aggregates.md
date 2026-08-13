---
title: "Fan-out and aggregates"
sidebar_label: "02 · Fan-out"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**When a joined row is duplicated, every aggregate over it is computed on the duplicates.
That is how `sum(o.total)` returns 450 for orders worth 350 — no error, no warning, and a
number that stays plausible while being arbitrarily wrong.**

## The measurement

Join orders to their items and sum the *order* total:

```sql
SELECT count(*) AS joined_rows
FROM j_orders o JOIN j_order_items i ON i.order_id = o.id;

SELECT sum(o.total) AS wrong
FROM j_orders o JOIN j_order_items i ON i.order_id = o.id;

SELECT sum(total) AS right FROM j_orders;
```

```console
$ node ex35-joins.mjs
row multiplication: [{"joined_rows":4}]
  4 orders x their items = 4 item rows; the ORDER total would be double-counted:
  naive sum : [{"wrong":450}]
  correct   : [{"right":350}]
```

**450 against a true total of 350.** Order 10 (`total = 100`) has two items, so its total
was added twice. On four rows the error is 29 %; on a real orders table with an average of
three items per order it approaches 200 %, and it moves whenever the *items* table changes
even though nothing about orders did.

Worth noting what is **not** wrong: `sum(i.qty)` over that same join is correct, because
`qty` lives at the item grain. The join did not corrupt the data — it changed the grain of
the result, and only the columns from the multiplied side are now being over-counted.

## Grain: the concept that prevents this

Every result set has a **grain** — the thing one row represents. The fixture's tables are
one row per customer, per order, and per order item. A join *sets* the grain to the
finest side involved:

| Query | Grain of the result |
|---|---|
| `FROM j_orders` | one row per order |
| `FROM j_orders JOIN j_order_items` | **one row per order item** |
| `FROM j_customers JOIN j_orders JOIN j_order_items` | one row per order item |

An aggregate is only correct when applied to a column at the result's own grain. `total`
is an order-grain column being summed in an item-grain result, so it is counted once per
item. State the grain in a comment above any reporting query and most of this class of
bug becomes visible while writing it.

The same reasoning explains why the error compounds across branches: joining a parent to
**two** independent one-to-many children gives the *product* of the two child counts. A post
with 2 tags and 3 comments yields 6 rows, and the two aggregates then behave differently — a
naive `sum(comment.score)` triples, because each comment's score is now on two rows, while
`count(DISTINCT tag_id)` still returns the right 2, because de-duplicating is exactly what
`DISTINCT` does. That asymmetry is not a curiosity; it is the rule §3 below turns into a
technique, and knowing which of your aggregates survives fan-out is how you tell a wrong
report from a slow one ([multi-table joins](../04-multi-join.md)).

## The four fixes, and when each applies

### 1. Pre-aggregate the child, then join

The general answer. Reduce the child to one row per parent *before* joining, so no
multiplication happens:

```sql
SELECT o.id, o.total, coalesce(i.item_count, 0) AS item_count
FROM j_orders o
LEFT JOIN (SELECT order_id, count(*) AS item_count
           FROM j_order_items GROUP BY order_id) i ON i.order_id = o.id;
```

`sum(o.total)` over this is correct — the subquery yields at most one row per order, so
the grain stays "one row per order". Use `LEFT JOIN` so orders with no items survive, and
`coalesce` so they report 0 rather than NULL.

### 2. `LATERAL` when you need the child's rows, not a count

Pre-aggregation collapses the child to scalars. When you need the top few child rows per
parent, `LEFT JOIN LATERAL … ON true` with a `LIMIT` keeps the grain at one row per
*parent × N*, which you control:

```sql
SELECT o.id, recent.sku
FROM j_orders o
LEFT JOIN LATERAL (SELECT sku FROM j_order_items x
                   WHERE x.order_id = o.id ORDER BY qty DESC LIMIT 1) recent ON true;
```

Measured at 9.3 ms against 51.8 ms for the window-function equivalent on 200 000 rows —
[LATERAL](../10-lateral.md).

### 3. `count(DISTINCT …)` when a count is all you need

```sql
SELECT count(DISTINCT o.id) AS orders, count(*) AS item_rows
FROM j_orders o JOIN j_order_items i ON i.order_id = o.id;
```

Correct and compact, but it only rescues *counts*. There is no `sum(DISTINCT …)` that
means what you want — `sum(DISTINCT o.total)` would collapse two different orders that
happen to have the same total. Use it for counts, never for sums.

### 4. Aggregate the child into a structure

When the API wants the children anyway, `array_agg`/`jsonb_agg` with `GROUP BY` returns
one row per parent with the children nested — covered with its `FILTER` and `coalesce`
requirements on [N-N relationships](../05-nn-join-table.md).

What is **not** on this list is `DISTINCT` on the whole query. It removes duplicate rows,
not duplicate contributions: `SELECT DISTINCT o.id, o.total` de-duplicates fine, but the
moment you add an item column back the rows differ again and the duplicates return. It
also silently collapses rows that were legitimately identical.

## The driver makes it harder to notice

```sql
SELECT * FROM j_u1 a JOIN j_u2 b ON a.id = b.id LIMIT 1;
```

The server returns every column of both tables, duplicates included. `pg` builds row
objects keyed by column name, so **duplicate names collapse and the rightmost wins** —
measured on [ON vs USING vs NATURAL](../08-on-using-natural.md), where six returned
columns became four JS keys and a `created_at` silently became the other table's value.

Two consequences for fan-out specifically. A duplicated `id` column means you cannot tell
from the JS object which side a row came from, and a naive
`rows.reduce((n, r) => n + r.total, 0)` in the application repeats the SQL bug in a place
with even less visibility. Alias every column you select across a join, or use
`rowMode: 'array'`.

## A checklist for any query with a join and an aggregate

1. **What is one row of this result?** Write it down. If the answer needs the word "and",
   there is a join multiplying something.
2. **Which side does each aggregated column come from?** Any column from a side that can
   be duplicated is suspect.
3. **Can each join produce more than one match?** Check the FK and unique constraints, not
   the current data — "it is one-to-one today" is not a guarantee.
4. **Compare `count(*)` with `count(DISTINCT parent.id)`.** Unequal means fan-out; that
   one query answers the question in every case.
5. **Run the aggregate without the join** as a control, as the measurement does — 350 from
   `j_orders` alone against 450 with the join is what makes the bug undeniable.

## From Node

```js
// one row per order, with a correct item count and a correct total
const {rows} = await pool.query(
  `SELECT o.id, o.total, coalesce(i.item_count, 0)::int AS item_count
   FROM j_orders o
   LEFT JOIN (SELECT order_id, count(*) AS item_count
              FROM j_order_items GROUP BY order_id) i ON i.order_id = o.id
   WHERE o.customer_id = $1
   ORDER BY o.id`,
  [customerId],
);
const revenue = rows.reduce((n, r) => n + r.total, 0);   // safe: one row per order
```

The `reduce` is only safe because the SQL guarantees the grain. That guarantee is worth a
comment — it is the kind of invariant a later "just add a join to items" quietly breaks.

## Trade-off

Pre-aggregating each child at its own grain is always correct and costs an extra scan and
grouping of the child table per branch. Joining raw and de-duplicating later is cheaper to
write and sometimes cheaper to run, but it makes correctness depend on every future
consumer understanding the grain. For anything that produces a number a human will act
on — revenue, counts, SLA percentages — take the extra scan.

## Gotchas

**Symptom:** A revenue or count total is too high, and grows as a child table grows
**Cause:** Fan-out — the parent row is repeated once per child before aggregation
**Fix:** Pre-aggregate the child, or `count(DISTINCT parent.id)` for counts. Measured: 450
against a true 350

**Symptom:** Adding `DISTINCT` fixed duplicates, then they came back after adding a column
**Cause:** `DISTINCT` de-duplicates whole rows; a new column makes the rows differ again
**Fix:** Fix the grain — pre-aggregate, or use `EXISTS` if you only needed existence

**Symptom:** `sum()` is wrong but `count()` looks right
**Cause:** `count(DISTINCT id)` was used for the count and plain `sum()` for the money
**Fix:** There is no `sum(DISTINCT)` that helps. Pre-aggregate

**Symptom:** Totals differ between two reports that "run the same query"
**Cause:** One joins an extra child table, changing the grain
**Fix:** State the grain in a comment; compare `count(*)` with `count(DISTINCT parent.id)`

**Symptom:** JS sums over `rows` disagree with the SQL aggregate
**Cause:** The result has more rows than entities, or duplicate column names collapsed in
the driver
**Fix:** Alias columns explicitly; verify the grain before reducing in JS

## Interview questions

**★ You add a `JOIN order_items` to a working report and revenue doubles. What happened?**
Fan-out. Each order row is now repeated once per item, so `sum(o.total)` adds each order's
total once per item — 450 instead of 350 on the fixture. Aggregate items separately and
join the pre-aggregated row.

**★ What is the "grain" of a result and why does it matter?**
What one row represents. A join sets the grain to the finest side involved, and an
aggregate is only correct on columns at that grain. `sum(i.qty)` is fine in an item-grain
result; `sum(o.total)` is not.

**★ How do you detect fan-out in a query you did not write?**
Compare `count(*)` with `count(DISTINCT parent_id)`. Unequal means the parent is
duplicated. Running the aggregate without the join as a control confirms it.

**★ Why is `DISTINCT` not a fix?**
It removes duplicate *rows*, not duplicate *contributions*. Add any column from the
multiplied side and the rows differ again, so the duplicates return — and it silently
collapses rows that were meant to be identical.

**When is `count(DISTINCT x)` the right tool?**
When a count is genuinely all you need. It does not generalise: there is no sum equivalent,
because two distinct entities may legitimately share a value.

**Does fan-out corrupt the data?**
No — the join is doing exactly what it is defined to do. It changes the grain of the
result, and the aggregate is then applied at the wrong grain. The bug is in the aggregate,
not the join.

---

← [One row per matching pair](01-matching-pairs.md) · Next → [LEFT JOIN](../left-join/)
