---
title: "GROUP BY and aggregates"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36b-agg-plans.mjs`.

**`GROUP BY` splits the rows into groups and emits exactly one row per group. Every
column in the select list must then be either a grouping key or fed through an
aggregate — because for anything else, there are several candidate values and no rule
for picking one. Almost every `GROUP BY` bug is that rule being violated in spirit
while satisfying it in letter.**

Five chunks. The first two are the semantics — how `NULL` moves through an aggregate,
and what shape the result takes when a group is empty; between them they account for
most silently-wrong numbers. The next two are the select-list rule and every legal and
illegal shorthand around it. The last is what the planner actually executes, which is
where the same query goes from 59 ms to 118 ms without a word of the SQL changing.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Collapsing rows](01-collapsing-rows.md)** | the model, the `NULL` rule, the five aggregates and their return types, and what the driver hands JavaScript |
| 02 | **[Empty groups and grouping keys](02-empty-groups-and-keys.md)** | one row vs zero rows, `sum` over nothing, `NULL` as a key, multi-column and expression grouping, the time-zone trap |
| 03 | **[What you are allowed to select](03-what-you-can-select.md)** | `42803`, the four ways out, `DISTINCT ON`, and functional dependency on a primary key |
| 04 | **[Ordinals, aliases and DISTINCT](04-ordinals-and-distinct.md)** | evaluation order, where `1` and an alias are legal, `GROUP BY` vs `SELECT DISTINCT`, and why grouping does not order |
| 05 | **[How it executes](05-how-it-executes.md)** | `HashAggregate` vs `GroupAggregate`, `work_mem` and spilling, parallel partial aggregation, and reading the plan |

## The fixture

Every page in this phase uses these tables. Six orders, five customers, five line
items — small enough to check by eye, with three deliberate absences that make the
edge cases visible.

```sql
CREATE TABLE agg_customers (id int PRIMARY KEY, name text NOT NULL,
                            country text, plan text);
CREATE TABLE agg_orders (id int PRIMARY KEY,
                         customer_id int REFERENCES agg_customers(id),
                         status text NOT NULL, total int,
                         coupon text,
                         placed_at timestamptz NOT NULL);
CREATE TABLE agg_items (id int PRIMARY KEY, order_id int REFERENCES agg_orders(id),
                        sku text NOT NULL, qty int NOT NULL, unit int NOT NULL);

INSERT INTO agg_customers VALUES
  (1,'Ann','GB','pro'),(2,'Bob','US','free'),(3,'Cid','GB','pro'),
  (4,'Dee','IN','free'),(5,'Eve','US',NULL);

INSERT INTO agg_orders VALUES
  (10,1,'paid',     100, 'WELCOME', '2026-03-01 09:15+00'),
  (11,1,'open',      50, NULL,      '2026-03-03 14:40+00'),
  (12,2,'paid',     200, 'WELCOME', '2026-03-01 11:00+00'),
  (13,3,'cancelled',  0, NULL,      '2026-03-04 08:05+00'),
  (14,2,'paid',     200, 'SPRING',  '2026-03-05 16:20+00'),
  (15,4,'open',    NULL, NULL,      '2026-03-05 18:00+00');

INSERT INTO agg_items VALUES
  (100,10,'A',1,100),(101,10,'B',2,50),(102,11,'A',5,10),
  (103,12,'C',1,200),(104,14,'C',1,200);
```

The three absences, and what each one is for:

| Absence | What it exposes |
|---|---|
| **Eve has no orders** | `count(*)` returning **1** instead of 0 across a `LEFT JOIN` — see [count variants](../count-variants/) |
| **Order 15 has `total` `NULL`** | `sum`/`avg`/`min`/`max` skipping the row while `count(*)` counts it |
| **`coupon` is `NULL` on three orders** | `count(coupon)` = 3 while `count(*)` = 6, and `count(DISTINCT coupon)` = 2 |

`total` on order 13 is `0`, not `NULL`. That distinction is deliberate: a cancelled
order has a known total of zero, an unfinished one has no total yet. `avg` treats
those two rows completely differently and that is the whole point.

### The fixture grows part-way through the phase

`ex36-aggregation.mjs` builds the six orders above and topics **01–08** are measured
against exactly that. `ex37-cte-subquery.mjs` then runs and mutates it, which is what
topics **09–16** are measured against:

```sql
-- added by ex37, section 11, to demonstrate the NOT IN NULL trap
INSERT INTO agg_orders VALUES (16, NULL, 'open', 5, NULL, '2026-03-06 10:00+00');
-- added by ex37, section 16, to separate a "no country" NULL from a subtotal NULL
INSERT INTO agg_customers VALUES (6, 'Fox', NULL, 'free');
INSERT INTO agg_orders    VALUES (17, 6, 'paid', 70, NULL, '2026-03-07 09:00+00');
-- and ex37 section 10 MOVES order 13 out to agg_archive before putting it back
```

So a `count(*)` of `agg_orders` reads **6** on topics 01–08 and **8** from topic 09 on.
If you are following along by hand, run `ex36` alone to match the early pages and both
scripts to match the later ones. Same arrangement as
[the fifth order in phase 5](../../phase-5-joins/inner-join/) — the alternative was
freezing the fixture and losing the `NULL`-bearing cases the later topics need.

### The big table

Every timing in chunk 05 and in the later performance pages uses `agg_events`,
500 000 rows seeded in **3.13 s**, occupying **40 MB** in **3783** heap pages:

```sql
CREATE TABLE agg_events (id bigserial PRIMARY KEY, user_id int NOT NULL,
                         kind text NOT NULL, amount int,
                         created_at timestamptz NOT NULL);

INSERT INTO agg_events (user_id, kind, amount, created_at)
SELECT (g % 5000) + 1,
       (ARRAY['view','click','purchase','refund'])[((g / 5000) % 4) + 1],
       CASE WHEN g % 7 = 0 THEN NULL ELSE (g % 900) + 10 END,
       timestamptz '2026-01-01 00:00+00' + (g % 180) * interval '1 day'
                                         + (g % 1440) * interval '1 minute'
FROM generate_series(1, 500000) g;
ANALYZE agg_events;
```

5000 distinct users, 4 kinds, 100 events each, and **71 428 rows with a `NULL`
amount** (`count(*)` 500 000 vs `count(amount)` 428 572). The `NULL`s are there so that
`count(*)` and `count(amount)` cannot accidentally agree.

**Why `kind` is derived from `g / 5000` and not `g % 4`.** The obvious spelling is
`(g % 4) + 1` — and it is wrong here, in a way worth carrying to your own fixtures. With
`user_id = (g % 5000) + 1`, and 4 dividing 5000 evenly, `g % 4` is *determined* by
`g % 5000`: every user ends up with exactly one kind, and `count(DISTINCT (user_id,
kind))` is 5000 rather than 20 000. Any query that groups or filters on both columns is
then silently measuring one column twice. The first version of these scripts had that
bug; it was caught by a `HAVING` plan reporting 1250 groups where 5000 were expected.
`g / 5000` cycles all four kinds across each user's 100 events instead, making the two
columns independent.

The general rule: **when you generate a fixture from a single counter, check that your
derived columns are actually independent.** Two moduli that share a factor are not.

## Phase gate

You are done with this topic when you can look at a `GROUP BY` query with a `LEFT
JOIN` and a `sum()` in it and say — before running it — whether the total is right,
whether a zero should have been a `NULL`, and which of `HashAggregate` or
`GroupAggregate` the planner will pick.

## Where this connects

- **[count variants](../count-variants/)** — the three counts, and the `LEFT JOIN`
  trap that starts here
- **[HAVING vs WHERE](../having/)** — filtering the groups this page produces
- **[FILTER](../filter-clause/)** — several different aggregations over one scan
- **[Window functions](../windows-intro/)** — the same aggregates without the collapse
- **[INNER JOIN fan-out](../../phase-5-joins/01-inner-join/02-fan-out-and-aggregates.md)** —
  the join-side cause of a `sum()` that comes back too big
- **[EXPLAIN](../../phase-10-indexes/03-explain.md)** — reading the plans in chunk 05

---

← [Phase index](../README.md) · Start → [Collapsing rows](01-collapsing-rows.md)
