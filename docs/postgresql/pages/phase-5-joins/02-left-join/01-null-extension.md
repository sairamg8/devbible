---
title: "The guarantee and its NULLs"
sidebar_label: "01 · NULL extension"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**A LEFT JOIN promises that every left row appears at least once. It keeps that promise by
inventing a row of NULLs for the right side — and those manufactured NULLs are
indistinguishable from stored ones, which is where every trap in this topic comes from.**

## The guarantee

```sql
SELECT c.name, o.id AS order_id
FROM j_customers c
LEFT JOIN j_orders o ON o.customer_id = c.id
ORDER BY c.id, o.id;
```

```console
$ node ex35-joins.mjs
=== 2. LEFT JOIN — and the WHERE clause that silently makes it an INNER JOIN ===
LEFT JOIN                : [{"name":"Ann","order_id":10},{"name":"Ann","order_id":11},
                            {"name":"Bob","order_id":12},{"name":"Cid","order_id":13},
                            {"name":"Dee","order_id":null}]
```

Five rows: the four matching pairs an inner join would give, **plus Dee with
`order_id: null`**.

Read precisely, the definition is: emit every matching pair, exactly as an inner join
does; then, for each left row that produced no pairs at all, emit it once with every
right-hand column set to NULL. Two things follow that people routinely get wrong:

- **"At least once", not "exactly once".** Ann still appears twice. A LEFT JOIN does not
  protect against fan-out — that is orthogonal, and everything on
  [fan-out and aggregates](../01-inner-join/02-fan-out-and-aggregates.md) applies unchanged.
  The output row count is `(number of matching pairs) + (number of unmatched left rows)`.
- **The NULL row is manufactured.** `order_id: null` is not stored anywhere. No row of
  `j_orders` has a NULL id; the join created that value to satisfy the shape.

## Manufactured NULLs are indistinguishable

This is the property that generates the rest of the topic. Once the result is built, there
is nothing marking `order_id: null` as "no match" rather than "matched, and the value was
NULL". Both are just NULL, to SQL and to `pg`.

Consider a nullable right-hand column — say `o.shipped_at`:

```sql
SELECT c.name, o.shipped_at
FROM j_customers c LEFT JOIN j_orders o ON o.customer_id = c.id;
```

A NULL `shipped_at` now means *either* "this customer has no orders" *or* "this customer
has an order that has not shipped". The result cannot tell you which. That is why every
test for "did this row match?" must use a column that is `NOT NULL` in the right table —
in practice, its primary key:

```sql
WHERE o.id IS NULL        -- ✓ id is NOT NULL, so NULL here can only mean "no match"
WHERE o.shipped_at IS NULL -- ✗ conflates "no order" with "unshipped order"
```

The same reasoning applies in JS. `row.order_id === null` is a reliable "no match" test
only because `id` is a primary key; `row.shipped_at === null` is not.

## The count trap

The most common wrong number in any reporting query:

```sql
SELECT count(*) AS count_star, count(o.id) AS count_col
FROM j_customers c LEFT JOIN j_orders o ON o.customer_id = c.id;
```

```console
count trap: [{"count_star":5,"count_col":4}]
```

**5 against 4.** `count(*)` counts *rows*, and Dee's NULL-extended row is a row.
`count(o.id)` counts *non-NULL values* of that column, which is what "how many orders"
actually means.

Ungrouped, the discrepancy is easy to spot. Grouped, it is the bug that ships:

```sql
SELECT c.name, count(*) AS wrong, count(o.id) AS right
FROM j_customers c LEFT JOIN j_orders o ON o.customer_id = c.id
GROUP BY c.id, c.name;
```

Dee's group contains exactly one row — her NULL-extended one — so `count(*)` reports
**1** and `count(o.id)` reports **0**. A customer with no orders is shown as having one.
The number is plausible, the query looks right, and nothing errors.

The rule generalises to every aggregate: `sum`, `avg`, `min` and `max` all ignore NULLs, so
they are safe on the NULL-extended row, but they return **NULL** rather than 0 for a group
that is entirely NULL. Wrap in `coalesce` when the API needs a number:

```sql
coalesce(sum(o.total), 0)::int AS revenue
```

`avg` deserves particular care — it divides by the count of non-NULL values, so a group of
one unmatched row gives NULL, not 0, and `coalesce(avg(...), 0)` may or may not be the
honest answer depending on whether "no orders" means "average zero" or "no average".

## The anti-join idiom

Turn the mechanism around and it becomes a tool. Filter for the manufactured NULL and you
get exactly the left rows that had no match:

```sql
SELECT c.name FROM j_customers c
LEFT JOIN j_orders o ON o.customer_id = c.id
WHERE o.id IS NULL;
```

```console
IS NULL to find non-matches: [{"name":"Dee"}]
```

This is the classic "LEFT JOIN … IS NULL" anti-join, and it is worth recognising because
it appears constantly in older code. It works, with two caveats: the tested column must be
`NOT NULL` in the right table, and the join still materialises all the matching pairs
before discarding them.

`NOT EXISTS` expresses the same thing directly, gets a dedicated `Hash Anti Join` node, and
cannot be broken by a careless column choice — measured on
[semi and anti joins](../semi-anti/). Prefer it in new code.

## From Node

```js
const {rows} = await pool.query(
  `SELECT c.id, c.name,
          count(o.id)::int              AS order_count,
          coalesce(sum(o.total), 0)::int AS revenue
   FROM j_customers c
   LEFT JOIN j_orders o ON o.customer_id = c.id
   GROUP BY c.id, c.name
   ORDER BY c.id`,
);
// [{id:1,name:'Ann',order_count:2,revenue:150}, …, {id:4,name:'Dee',order_count:0,revenue:0}]
```

Three deliberate choices: `count(o.id)` not `count(*)`, `coalesce` around the sum so Dee
reports `0` rather than `null`, and `::int` casts because `count()` and `sum()` return
`bigint`/`numeric`, which `pg` delivers as **strings** to preserve precision
([type parsing](../../phase-7-pg-driver/08-type-parsing.md)).

That last one bites quietly: without the cast, `revenue` arrives as `"150"` and
`revenue + 10` in JS produces `"15010"`.

## Trade-off

A LEFT JOIN gives you the parent-with-optional-children shape in one round trip. The cost
is that the result now contains values that do not exist in the database, and every
consumer — the aggregate, the `WHERE`, the JS — has to interpret them correctly. When most
left rows have no match, you are also transferring a large NULL-filled result to express
mostly-absence; an anti-join or a separate query is usually both clearer and smaller.

## Gotchas

**Symptom:** Every entity reports a count of at least 1, even with no children
**Cause:** `count(*)` counting the NULL-extended row
**Fix:** `count(child.id)` — 5 versus 4 in the measurement, and 1 versus 0 per group

**Symptom:** A sum or average is `null` in JSON instead of `0`
**Cause:** Aggregates over an all-NULL group return NULL
**Fix:** `coalesce(sum(...), 0)`; think twice before doing the same to `avg`

**Symptom:** A numeric field arrives as a string and string-concatenates in JS
**Cause:** `count`/`sum` return `bigint`/`numeric`
**Fix:** `::int` in SQL, or a type parser

**Symptom:** "Rows with no match" also returns rows that do have matches
**Cause:** The `IS NULL` test is on a nullable column, so a stored NULL looks unmatched
**Fix:** Test the right table's primary key

**Symptom:** A LEFT JOIN still duplicates left rows
**Cause:** Expected — the guarantee is "at least once", not "exactly once"
**Fix:** Pre-aggregate the child side
([fan-out](../01-inner-join/02-fan-out-and-aggregates.md))

## Interview questions

**★ What exactly does a LEFT JOIN guarantee?**
That every left row appears at least once. Matching pairs are emitted as an inner join
would; left rows with no pairs are emitted once with the right side NULL-extended. It does
not guarantee one row per left row — fan-out still applies.

**★ Why does `count(*)` give the wrong answer after a LEFT JOIN?**
A NULL-extended row is still a row. `count(*)` counts rows; `count(col)` counts non-NULL
values. Measured 5 versus 4, and per group it turns "no orders" into a count of 1.

**★ Can you tell an unmatched row from a matched row whose column is NULL?**
Not from the result — the join manufactures NULLs identical to stored ones. Test a column
that is `NOT NULL` in the right table, normally its primary key.

**Why might a sum come back as `null` rather than `0`?**
Aggregates ignore NULLs, and over a group with no non-NULL values they return NULL.
`coalesce(sum(x), 0)` if the API needs a number.

**What is the "LEFT JOIN … IS NULL" idiom?**
An anti-join: keep the left rows whose right-hand key came back NULL, meaning no match.
Correct if the tested column is `NOT NULL` in the right table, but `NOT EXISTS` says it
more directly and gets a dedicated plan node.

---

← [Topic index](README.md) · Next → [ON vs WHERE](02-on-vs-where.md)
