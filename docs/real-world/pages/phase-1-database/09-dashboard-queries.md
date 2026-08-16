---
title: "Dashboard queries"
sidebar_label: "09 · Dashboard queries"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against PostgreSQL 17 documentation — aggregate functions,
> window functions, `generate_series`, `filter` clauses. Concept home:
> [PostgreSQL — aggregation](../../../postgresql/pages/phase-6-aggregation/README.md).

## The problem

The admin dashboard: revenue by day for the last 30, top products, order
status counts, and each product's share of its category. Four queries that
read like business questions — and the chapter's real lesson is which SQL
feature answers which *shape* of question.

## Revenue by day — aggregation plus a spine

```sql
select d.day::date,
       coalesce(sum(o.total_cents), 0) as revenue_cents,
       count(o.id)                     as orders
  from generate_series(
         now() - interval '29 days', now(), interval '1 day'
       ) as d(day)
  left join orders o
    on o.created_at >= date_trunc('day', d.day)
   and o.created_at <  date_trunc('day', d.day) + interval '1 day'
   and o.status in ('paid', 'shipped', 'delivered')
 group by d.day
 order by d.day;
```

Two decisions carry it. **`generate_series` is the spine**: grouping orders by
day alone *omits* zero-revenue days, and the chart in Phase 4 would silently
skip them — the series makes absent days exist with `0`. **The date range is
half-open on the raw column** (`>= day and < day+1`), not
`date_trunc('day', o.created_at) = …` — truncating the *column* would defeat
the index on `created_at` (chapter 10) by hiding it inside a function.

Cancelled orders are excluded by the status list — revenue questions are
status-set questions, and the set is spelled out where the business can read
it.

## Status counts — one pass with `filter`

```sql
select count(*) filter (where status = 'pending')   as pending,
       count(*) filter (where status = 'paid')      as paid,
       count(*) filter (where status = 'shipped')   as shipped,
       count(*) filter (where status = 'delivered') as delivered,
       count(*) filter (where status = 'cancelled') as cancelled
  from orders
 where created_at > now() - interval '30 days';
```

One scan, five answers. The alternatives are five queries (five scans) or a
`group by status` the API must pivot; `filter` is the standard-SQL spelling of
"conditional count" and reads like the requirement.

## Top products and share-of-category — window functions

```sql
with sold as (
  select oi.product_id,
         sum(oi.quantity)                        as units,
         sum(oi.quantity * oi.unit_price_cents)  as revenue_cents
    from order_items oi
    join orders o on o.id = oi.order_id
   where o.created_at > now() - interval '30 days'
     and o.status in ('paid', 'shipped', 'delivered')
   group by oi.product_id
)
select p.name, p.slug, c.name as category,
       s.units, s.revenue_cents,
       rank() over (order by s.revenue_cents desc)          as overall_rank,
       round(100.0 * s.revenue_cents
             / sum(s.revenue_cents) over (partition by p.category_id), 1)
                                                            as pct_of_category
  from sold s
  join products p  on p.id = s.product_id
  join categories c on c.id = p.category_id
 order by s.revenue_cents desc
 limit 20;
```

The shape to internalize: **`group by` collapses rows; window functions
annotate rows without collapsing.** "Revenue per product" collapses order
items → `group by` in the CTE. "Each product's share of its category" needs
the product row *and* the category total on the same line → `sum() over
(partition by …)`. Note the revenue comes from `unit_price_cents` — the
[snapshot column](01-the-schema/02-carts-orders-reviews-outbox.md) — so
history stays true through price changes; joining `products.price_cents` here
would be the exact bug the schema was designed against.

## The performance posture

These run on the primary, on demand, for one admin at a time — at this scale
(hundreds of orders a day) each is milliseconds against chapter 10's
`orders (created_at)` index, and freshness beats cleverness. The escalation
ladder, so it is chosen and not stumbled into: **cache in the API** (60-second
TTL, Phase 2's cache layer) when the dashboard gets popular → **materialized
view refreshed on a schedule** when queries grow heavy →
**[read replica](../../../nodejs/pages/phase-6-data-access/15-read-replicas.md)**
when analytics load starts bullying checkout latency. Each step trades
freshness or ops for isolation; none is free, so none is the default.

## Using it in the app

`GET /admin/stats` (Phase 3, admin-gated) runs these and returns them as one
JSON payload; the Phase 4 admin screen charts revenue-by-day and tables the
rest. The status-count query doubles as the ops sanity check in Phase 2's
health kit — a sudden `pending` pile-up is the outbox worker being down.

## Gotchas

- **Symptom:** the revenue chart is missing days and the frontend interpolates
  wrongly. **Cause:** the spine was dropped in a "simplification" —
  `group by date_trunc('day', created_at)` alone omits empty days. **Fix:**
  `generate_series` + left join is the pattern; the chart renders what SQL
  says, no client-side gap-filling.
- **Symptom:** dashboard revenue disagrees with the finance export. **Cause:**
  status sets drifted — one query counts `paid+shipped+delivered`, another
  forgot `shipped`. **Fix:** the status list lives once, in a SQL view
  (`create view revenue_orders as select … where status in (…)`), and every
  revenue query selects from the view.
- **Symptom:** `division by zero` on `pct_of_category`. **Cause:** a category
  whose 30-day revenue is entirely refunds/cancellations sums to zero.
  **Fix:** `nullif(sum(…) over (…), 0)` — the share is honestly `null`
  ("no base"), and the UI renders a dash.
- **Symptom:** after adding `date_trunc('day', o.created_at) = d.day` "for
  clarity", the query got 40× slower. **Cause:** the function on the column
  hides it from the index; every row truncates. **Fix:** half-open ranges on
  the raw column — the pattern above, and the general rule: functions go on
  constants, not columns.

## Interview questions

1. **★ When do you need a window function instead of `group by`?** When the
   answer needs detail rows *and* an aggregate in the same result — each
   product with its category's total, each order with its running sum.
   `group by` collapses; `over (partition by …)` annotates. If the result
   has one row per group, `group by`; one row per row, window.
2. **★ Why does `where date_trunc('day', created_at) = $1` kill the index?**
   The index stores `created_at` values; the predicate asks about
   `date_trunc(created_at)` — a different expression the index knows nothing
   about, so every row must be fetched and truncated. Half-open ranges ask
   about the stored value directly. (An expression index on the truncation is
   the other fix — for one canonical expression, not per-query.)
3. **Why compute revenue from `order_items.unit_price_cents` and not join
   `products`?** Product prices are *current*; order items are *history*.
   Joining products makes every past total drift with today's price list —
   the exact mutability the snapshot column exists to prevent.
4. **The dashboard gets slow at 10× scale — what's the first move, and why
   not a replica?** The 60-second cache: one line in the API, staleness the
   business won't notice, and it removes the repeated cost entirely. A
   replica is an ops commitment (lag, failover, connection routing) that
   buys isolation this load doesn't yet need. Escalate on evidence.

---

← Prev: [JSONB for product attributes](08-jsonb-attributes.md) ·
Next → [Indexes for this app's queries](10-indexes.md)
