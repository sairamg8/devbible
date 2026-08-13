---
title: "FILTER (WHERE ...)"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36d-count-having.mjs`.

**`FILTER (WHERE …)` restricts the rows one aggregate sees, without restricting the
query. It is how a dashboard gets paid, open and cancelled counts out of a single
table scan instead of three — and it is *not* a pure syntax sugar for `CASE`, because
the two disagree about the empty set.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Conditional aggregation](01-conditional-aggregation.md)** | the syntax, the `CASE` equivalent, where the two genuinely differ, and building a pivot |
| 02 | **[When it pays](02-when-it-pays.md)** | one scan versus several measured, `FILTER` on window functions, the errors, and what it does not fix |

## The shape

```sql
SELECT count(*) FILTER (WHERE status = 'paid')::int      AS paid,
       count(*) FILTER (WHERE status = 'open')::int      AS open,
       count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
       sum(total) FILTER (WHERE status = 'paid')::int    AS paid_revenue
FROM agg_orders;
```

```console
one pass, three counts : [{"paid":3,"open":2,"cancelled":1,"paid_revenue":500}]
```

One row, one scan, four different questions answered.

## Phase gate

You are done when you can write a status-pivot query without a `CASE` in it, and can
say without checking what `sum(x) FILTER (…)` returns when nothing matches — and how
that differs from `sum(CASE … ELSE 0)`.

## Where this connects

- **[count variants](../02-count-variants/README.md)** — `count(*)` vs `count(col)` behaves
  differently *inside* a `FILTER` too
- **[GROUP BY and aggregates](../01-group-by/README.md)** — where the empty-group `NULL` rule
  comes from
- **[HAVING vs WHERE](../03-having/README.md)** — `FILTER` restricts one aggregate; `WHERE`
  restricts the whole query
- **[GROUPING SETS](../16-grouping-sets/README.md)** — the other way to get several
  aggregations out of one scan
- **[Window functions](../06-windows-intro/README.md)** — `FILTER` works there as well

---

← [Phase index](../README.md) · Start → [Conditional aggregation](01-conditional-aggregation.md)
