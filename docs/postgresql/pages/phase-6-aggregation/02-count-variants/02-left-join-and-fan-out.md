---
title: "The LEFT JOIN trap and fan-out"
sidebar_label: "02 · LEFT JOIN and fan-out"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36d-count-having.mjs`.

**A `LEFT JOIN` invents a row for every left row with no match. `count(*)` counts it.
That single interaction produces the most common wrong number in any application: the
customer with no orders who is reported as having one.**

## The trap

```sql
SELECT c.name, count(*)::int AS wrong, count(o.id)::int AS right
FROM agg_customers c LEFT JOIN agg_orders o ON o.customer_id = c.id
GROUP BY c.name ORDER BY c.name;
```

```console
=== 2. three counts, three questions ===
the LEFT JOIN trap : [{"name":"Ann","wrong":2,"right":2},
                      {"name":"Bob","wrong":2,"right":2},
                      {"name":"Cid","wrong":1,"right":1},
                      {"name":"Dee","wrong":1,"right":1},
                      {"name":"Eve","wrong":1,"right":0}]
  Eve has no orders: count(*) says 1 (the extended NULL row), count(o.id) says 0
```

**Four of the five rows agree.** Only Eve — the customer with no orders — differs, and
she differs by exactly one. This is what makes the bug so durable:

- It is invisible in any fixture where every parent has at least one child.
- It is off by exactly 1, which looks like a plausible number rather than a broken one.
- It only shows up on the rows a reader is least likely to check.

The mechanism is worth stating precisely. A `LEFT JOIN` guarantees every left row
appears in the output. When there is no matching right row, PostgreSQL emits the left
row extended with `NULL`s in all the right-hand columns. That extended row is a **real
row** in the join result — so `count(*)`, which counts rows, counts it. `count(o.id)`
counts non-`NULL` values of `o.id`, and the invented row's `o.id` is `NULL`.

> **Rule: inside a `LEFT JOIN`, never `count(*)`. Count a `NOT NULL` column of the
> right-hand table** — its primary key is the safe choice.

`count(o.id)` and not `count(o.total)`: `total` is nullable in its own right, so it
would under-count real orders. The distinction is visible when you ask for both:

```sql
SELECT c.name,
       count(*)::int       AS star,
       count(o.id)::int    AS orders,
       count(o.total)::int AS priced_orders,
       coalesce(sum(o.total),0)::int AS spend
FROM agg_customers c LEFT JOIN agg_orders o ON o.customer_id = c.id
GROUP BY c.name ORDER BY c.name;
```

```console
=== D4. count(*) vs count(col) across a LEFT JOIN, in full ===
[{"name":"Ann","star":2,"orders":2,"priced_orders":2,"spend":150},
 {"name":"Bob","star":2,"orders":2,"priced_orders":2,"spend":400},
 {"name":"Cid","star":1,"orders":1,"priced_orders":1,"spend":0},
 {"name":"Dee","star":1,"orders":1,"priced_orders":0,"spend":0},
 {"name":"Eve","star":1,"orders":0,"priced_orders":0,"spend":0}]
```

Three different right answers, depending on the question. **Dee** has one order whose
`total` is `NULL` — 1 order, 0 priced, spend 0. **Eve** has none — 0, 0, 0. Only
`count(*)` is wrong for both, and it is wrong in a way that makes Dee and Eve look
identical when they are not.

Note `coalesce(sum(o.total),0)` for spend: without it, Eve's spend is `null` rather
than `0` — [`sum` over an empty group](../01-group-by/02-empty-groups-and-keys.md).

### The `HAVING` version of the same bug

```sql
-- wrong: every customer passes, because count(*) is at least 1 for all of them
… GROUP BY c.id HAVING count(*) > 0
-- right
… GROUP BY c.id HAVING count(o.id) > 0
```

Filtering "customers who have ordered" with `count(*) > 0` after a `LEFT JOIN` matches
everyone. At that point the `LEFT JOIN` should have been an inner join or a semi-join
anyway — see [semi joins](../../phase-5-joins/03-semi-anti/01-semi-joins.md).

## Fan-out: the same problem, one size up

The `LEFT JOIN` trap inflates by 1. Join fan-out inflates by a multiplier, and it
damages `sum()` far worse than `count()`.

```sql
SELECT count(*)::int                   AS rows,
       count(DISTINCT o.id)::int       AS distinct_orders,
       sum(o.total)::int               AS inflated_revenue,
       sum(DISTINCT o.total)::int      AS distinct_sum_also_wrong
FROM agg_orders o JOIN agg_items i ON i.order_id = o.id;
```

```console
=== D3. counting under join fan-out ===
no join         : [{"orders":6,"revenue":550}]
joined to items : [{"rows":5,"distinct_orders":4,"inflated_revenue":650,
                    "distinct_sum_also_wrong":350}]
```

*(`ex36d` runs after `ex37` has already added orders 16 and 17, so every query in that
section carries `WHERE o.id < 16` to stay on the six-order fixture these pages are
written against — see [the fixture note](../group-by/). The SQL above is the same
query with that guard removed for readability.)*

Four numbers, three of them wrong, and each wrong differently:

| Value | Result | Truth | What happened |
|---|---|---|---|
| `count(*)` | 5 | 6 orders | counts **item** rows; orders 13 and 15 have no items and vanished |
| `count(DISTINCT o.id)` | 4 | 6 orders | correct *for the joined set* — the two order-less orders are genuinely absent |
| `sum(o.total)` | **650** | 550 | order 10 has two items, so its 100 was added **twice** |
| `sum(DISTINCT o.total)` | **350** | 550 | de-duplicated the **values**, collapsing two genuinely different 200s |

The last row is the one to internalise. `sum(DISTINCT x)` looks like the parallel of
`count(DISTINCT x)` and it is not a fix for anything: it removes duplicate *values*,
not duplicate *rows*. Orders 12 and 14 both total 200; they are different orders, and
`sum(DISTINCT)` counted one of them. It happens to give 350 here, which is neither the
inflated 650 nor the true 550 — a third wrong answer wearing the costume of a fix.

**`count(DISTINCT)` survives fan-out and `sum()` does not**, and the asymmetry has a
clean explanation: counting distinct ids is idempotent under duplication, while adding
a number is not. So `count(DISTINCT o.id)` is a legitimate repair for a count inside a
fanned-out join, and there is **no** equivalent repair for `sum`.

### The shape that is actually correct

Aggregate the child side *before* joining, so no duplication ever reaches the parent's
columns:

```sql
SELECT count(*)::int      AS orders,
       sum(o.total)::int  AS revenue,
       sum(i.items)::int  AS item_rows
FROM agg_orders o
LEFT JOIN LATERAL (
  SELECT count(*)::int AS items FROM agg_items i WHERE i.order_id = o.id
) i ON true;
```

```console
the correct shape : [{"orders":6,"revenue":550,"item_rows":5}]
```

All three right at once: **6** orders, **550** revenue, **5** item rows. Each order
contributes exactly one row, carrying a pre-computed count of its children, so
`sum(o.total)` cannot double-count and no order disappears.

`LEFT JOIN LATERAL … ON true` rather than a plain subquery so that orders with no items
still appear — `count(*)` inside the lateral returns 0 for them, which is why
`item_rows` is 5 and not `NULL`-poisoned. The alternative spellings, and when each is
faster, are on [LATERAL](../../phase-5-joins/10-lateral.md) and
[fan-out and aggregates](../../phase-5-joins/01-inner-join/02-fan-out-and-aggregates.md).

### Diagnosing it in an existing query

Two joins to two different child tables is where this becomes genuinely hard to see —
the multiplier is the *product* of both branches. A fast check that needs no
understanding of the query:

```sql
-- if these disagree, something in the FROM is multiplying rows
SELECT count(*) AS join_rows, count(DISTINCT o.id) AS real_orders
FROM agg_orders o JOIN … ;
```

When they differ, every non-`DISTINCT` aggregate over a parent column in that query is
suspect.

## Trade-off

The `LATERAL` pre-aggregation shape is correct by construction and costs an extra
subquery per parent row — usually cheap with an index on the FK, and genuinely
expensive without one, which is the case for
[missing FK indexes](../../phase-10-indexes/18-fk-indexes.md). The alternative,
`count(DISTINCT o.id)` over the fanned-out join, is a one-word fix that repairs the
count and leaves every `sum` in the same query still wrong. Reach for it only when the
count is the only aggregate; reach for pre-aggregation whenever a `sum` or `avg` is
involved.

## Gotchas

**Symptom:** a customer with no orders is reported as having 1
**Cause:** `count(*)` after a `LEFT JOIN` counts the `NULL`-extended row
**Fix:** `count(o.id)` — a `NOT NULL` column of the right-hand table, its primary key
by preference

**Symptom:** "customers who have ordered" returns every customer
**Cause:** `HAVING count(*) > 0` after a `LEFT JOIN` — always true
**Fix:** `HAVING count(o.id) > 0`, or use an inner join / `EXISTS` if you never wanted
the non-matching rows

**Symptom:** revenue is higher than the sum of the orders table, by a factor that
changes as data grows
**Cause:** join fan-out — each parent row is repeated once per matching child, and
`sum` adds it each time. Measured: 650 against a true 550
**Fix:** pre-aggregate the child in a `LATERAL` or subquery before joining. `DISTINCT`
in the select list does not fix it

**Symptom:** `sum(DISTINCT total)` was used to "fix" the inflated sum and the number is
still wrong
**Cause:** it de-duplicates *values*, not rows — two different orders with the same
total collapse into one. Measured: 350 against a true 550
**Fix:** there is no `DISTINCT`-shaped fix for `sum`. Pre-aggregate

**Symptom:** the count is right but the sum is wrong in the same query
**Cause:** somebody repaired the count with `count(DISTINCT id)` and stopped there.
`count(DISTINCT)` is idempotent under duplication; `sum` is not
**Fix:** treat the surviving `sum` as evidence the join still fans out, and restructure

**Symptom:** none of this reproduces in tests
**Cause:** the fixture has exactly one child per parent and no childless parents
**Fix:** every join fixture needs a parent with zero children and a parent with two —
the reason `agg_customers` has Eve and `agg_orders` has order 10

## Interview questions

**★ Why does `count(*)` return 1 for a customer with no orders after a `LEFT JOIN`?**
Because `LEFT JOIN` emits the left row extended with `NULL`s when there is no match,
and that extended row is a real row in the join output. `count(*)` counts rows.
`count(o.id)` counts non-`NULL` ids and correctly returns 0.

**★ Which column should you count inside a `LEFT JOIN`?**
A `NOT NULL` column of the right-hand table — its primary key. Counting a nullable
column like `o.total` under-counts real rows: measured, Dee showed 1 order but 0
priced orders because her order's total is `NULL`.

**★ A revenue report joins orders to line items and the total is too high. What
happened, and what is the fix?**
Fan-out: an order with N items appears N times, so `sum(o.total)` adds it N times —
measured 650 against a true 550. The fix is to pre-aggregate the items in a subquery
or `LATERAL` before joining. Adding `DISTINCT` does not repair the sum.

**★ Why does `count(DISTINCT o.id)` survive fan-out when `sum(o.total)` does not?**
Because de-duplicating ids is idempotent under row duplication, while addition is not.
That asymmetry is also why `sum(DISTINCT o.total)` is not the parallel fix — it removes
duplicate *values*, collapsing two different orders that happen to share a total.
Measured: 350, a third wrong answer.

**How would you detect fan-out in a query you did not write?**
Compare `count(*)` against `count(DISTINCT <parent pk>)` in the same query. If they
differ, the `FROM` clause is multiplying rows, and every non-distinct aggregate over a
parent column is suspect.

**Why does the correct version use `LEFT JOIN LATERAL … ON true` rather than a plain
join to a grouped subquery?**
So that parents with no children still appear, with a count of 0 rather than being
dropped or turning into `NULL`. Measured: 6 orders and 5 item rows, including the two
orders that have no items at all.

---

← [Three different questions](01-three-questions.md) · Next → [What counting costs](03-what-counting-costs.md)
