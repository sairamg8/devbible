---
title: "INNER JOIN"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**An INNER JOIN emits one row per matching *pair*, not one row per left row. Both halves
of that sentence cause bugs: rows with no match disappear, and rows with several matches
are duplicated — which is how a `sum()` silently comes back too big.**

This topic is split into two chunks. The first builds the mental model and the row-count
rule; the second covers what that rule does to aggregates, which is where the real damage
happens.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[One row per matching pair](01-matching-pairs.md)** | the row-count rule, the fixture, why Dee vanishes and Ann duplicates, and how the planner executes it |
| 02 | **[Fan-out and aggregates](02-fan-out-and-aggregates.md)** | the double-counted `sum()`, the four fixes compared, `SELECT *` column collapse, and the join-shape checklist |

## The fixture

Every page in this phase uses these four customers and — for the first two topics — four
orders. Dee has no orders; order 13 has no items. Both of those absences are deliberate:
they are what makes a `LEFT JOIN` differ visibly from an `INNER JOIN`.

```sql
CREATE TABLE j_customers (id int PRIMARY KEY, name text NOT NULL, country text);
CREATE TABLE j_orders (id int PRIMARY KEY, customer_id int REFERENCES j_customers(id),
                       status text NOT NULL, total int NOT NULL,
                       created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE j_order_items (id int PRIMARY KEY, order_id int REFERENCES j_orders(id),
                            sku text NOT NULL, qty int NOT NULL);

INSERT INTO j_customers VALUES (1,'Ann','GB'),(2,'Bob','US'),(3,'Cid','GB'),(4,'Dee','IN');
INSERT INTO j_orders    VALUES (10,1,'paid',100,    '2026-03-01 09:15+00'),
                               (11,1,'open',50,     '2026-03-03 14:40+00'),
                               (12,2,'paid',200,    '2026-03-01 11:00+00'),
                               (13,3,'cancelled',0, '2026-03-04 08:05+00');
INSERT INTO j_order_items VALUES (100,10,'A',1),(101,10,'B',2),(102,11,'A',5),(103,12,'C',1);
```

`created_at` carries **fixed** timestamps rather than `now()` so that every console block in
this phase is reproducible; the pages that filter on recency
([semi joins](../03-semi-anti/01-semi-joins.md), [anti joins](../03-semi-anti/02-anti-joins.md))
and the [calendar-spine gap fill](../07-cross-join.md) all need this column to exist. The
dates deliberately leave 2026-03-02 empty, which is what gives the gap-filling example a gap
to fill.

### The fifth order, added part-way through

**From [semi and anti joins](../03-semi-anti/README.md) onward the fixture has five orders**, not four.
`sandbox/pg-api/ex35-joins.mjs` adds one more row in the middle of that section:

```sql
INSERT INTO j_orders VALUES (14, NULL, 'open', 5, '2026-03-05 16:20+00');  -- orphan: no customer
```

It exists because order 14 is an *orphan* — `customer_id IS NULL`, so it belongs to no
customer at all. That is a different kind of absence from Dee's (a customer with no orders),
and several later pages need it:

- **[Anti-joins](../03-semi-anti/02-anti-joins.md)** — the row that shows why `NOT IN` with a
  `NULL` in the subquery returns nothing, while `NOT EXISTS` behaves.
- **[CROSS JOIN](../07-cross-join.md)** — the reason the documented row count is
  4 customers × **5** orders = 20, not 16.
- **[LATERAL](../10-lateral.md)** — orders 13 and 14 both come back with `sku: null`.

**If you are building the fixture by hand, add order 14 before running any example from
topic 03 on.** Run the block above alone and the earlier pages match; run both and
everything from 03 onward matches. The insert is repeated in context on the anti-joins page
as a reminder — this is the same row, not a second one.

## Phase gate

You are done with this topic when you can state the row-count rule without hedging, and
when you can look at a report query with a `sum()` and two joined child tables and say
whether the total is wrong before running it.

## Where this connects

- **[LEFT JOIN](../02-left-join/README.md)** — the same mechanics when the relationship is optional
- **[Semi and anti joins](../03-semi-anti/README.md)** — the shape to use when you only need existence,
  which cannot fan out at all
- **[Multi-table joins](../04-multi-join.md)** — fan-out compounding across branches
- **[Aggregation](../../phase-6-aggregation/README.md)** — the aggregate side of the same problem

---

← [Phase index](../README.md) · Start → [One row per matching pair](01-matching-pairs.md)
