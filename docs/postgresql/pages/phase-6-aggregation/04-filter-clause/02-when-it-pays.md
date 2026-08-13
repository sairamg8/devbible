---
title: "When it pays"
sidebar_label: "02 · When it pays"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36d-count-having.mjs`.

**`FILTER` is not faster than `CASE` — measured, they are the same. What it is faster
than is the thing people actually write instead: one subquery per number. Four counts as
four scalar subqueries cost 4× the buffers and 2.5× the time of the same four as
`FILTER`.**

## The measurement that matters

Four counts over 500 000 rows, three ways:

```sql
-- one scan, four FILTERs
SELECT count(*) FILTER (WHERE kind='view')     AS a,
       count(*) FILTER (WHERE kind='click')    AS b,
       count(*) FILTER (WHERE kind='purchase') AS c,
       count(*) FILTER (WHERE kind='refund')   AS d
FROM agg_events;

-- one scan, four CASEs
SELECT count(CASE WHEN kind='view' THEN 1 END) AS a, … FROM agg_events;

-- four scans
SELECT (SELECT count(*) FROM agg_events WHERE kind='view')  AS a,
       (SELECT count(*) FROM agg_events WHERE kind='click') AS b, … ;
```

```console
FILTER x4, one scan                      65.45 ms  seqscans=1  maxbuf=3783
CASE x4, one scan                        65.14 ms  seqscans=1  maxbuf=3783
4 scalar subqueries                     161.21 ms  seqscans=4  maxbuf=15132
GROUP BY kind (rows not columns)         71.79 ms  seqscans=1  maxbuf=3803
```

**The buffer counts are the proof, not the timings.** 3783 against 15132 is exactly 4×,
because the subquery form reads the whole table once per number. That ratio holds
whatever else the machine is doing, which is what makes it a result rather than a
measurement.

The plan confirms there is one pass and it is parallel:

```console
Finalize Aggregate (actual rows=1.00 loops=1)
  Buffers: shared hit=3783
  ->  Gather (actual rows=3.00 loops=1)
        Workers Planned: 2
        Workers Launched: 2
        ->  Partial Aggregate (actual rows=1.00 loops=3)
              ->  Parallel Seq Scan on agg_events (actual rows=166666.67 loops=3)
```

No `Filter:` on the scan — every row is read, and each of the four aggregates decides
for itself whether to consume it. That is the mechanism, and it is also the limitation:
**`FILTER` is not a scan filter and no index can serve it.** A `FILTER` predicate does
not reduce the rows read; it reduces which rows each aggregate counts.

### The corollary people get wrong

If you only need **one** of those numbers, `FILTER` is the wrong tool:

```sql
-- reads every row, counts a quarter of them
SELECT count(*) FILTER (WHERE kind = 'purchase') FROM agg_events;
-- reads only what the WHERE lets through, and can use an index on kind
SELECT count(*) FROM agg_events WHERE kind = 'purchase';
```

`FILTER` pays for itself precisely when the alternative is **several passes**. With one
aggregate it is strictly worse than a `WHERE`, because it forfeits any chance of an index
narrowing the scan.

## `FILTER` versus `GROUP BY`

`GROUP BY kind` produces the same four numbers as rows rather than columns, in one scan,
at 71.79 ms — within noise of the `FILTER` form. So this is not a performance decision
either. Choose on **shape**:

| | `FILTER` | `GROUP BY` |
|---|---|---|
| Result | one row, N columns | N rows, 2 columns |
| Categories | fixed when the query is written | discovered from the data |
| A category with no rows | appears as `0` (for `count`) | **does not appear at all** |
| Mixing different predicates | easy — each aggregate has its own | needs several queries |
| Client code | `rows[0].purchase` | a loop or a `Map` |

The third row is the practical one. `GROUP BY kind` on a week where nobody refunded
anything simply has no `refund` row, and a dashboard renders a gap. The `FILTER` version
returns `0`, because the column exists in the query text. That is the strongest argument
for `FILTER` in a reporting endpoint, and it is a correctness argument, not a speed one.

The strongest argument the other way: `FILTER` cannot discover categories. A new `kind`
appears in the data and the `FILTER` query silently keeps reporting the four it knows.

## `FILTER` on a window function

`FILTER` attaches to the aggregate, so it composes with `OVER`:

```sql
SELECT id, count(*) FILTER (WHERE status = 'paid') OVER () FROM agg_orders;
```

```console
FILTER on a window function  ok  rows=6
  [{"id":10,"count":"3"},{"id":11,"count":"3"},{"id":12,"count":"3"}]
```

Six rows out, each carrying the count of paid orders across the whole result. The clause
order is fixed: **`aggregate(...) FILTER (WHERE …) OVER (…)`**. Putting `FILTER` after
`OVER` is a syntax error.

This works for aggregate window functions only. `row_number()`, `rank()`, `lag()` and
friends are *not* aggregates, so they take no `FILTER` — which is the same distinction
that produces the error below.

## The error

```console
FILTER on a plain function -> 42809 FILTER specified, but upper is not an aggregate function
```

`42809` is `wrong_object_type`, and the message names the function it rejected. It is a
useful error to recognise, because it is what you get from a typo in a function name
too — `count` misspelled becomes "not an aggregate function" rather than "does not
exist".

## What `FILTER` does not fix

Three things it is regularly reached for and does not solve:

**Join fan-out.** `count(*) FILTER (WHERE …)` over a fanned-out join counts duplicated
rows, exactly like `count(*)` does. The `FILTER` narrows; it does not de-duplicate. The
fix is still pre-aggregation —
[fan-out and aggregates](../../phase-5-joins/01-inner-join/02-fan-out-and-aggregates.md).

**The `LEFT JOIN` `NULL` row.** `count(*) FILTER (WHERE o.status = 'paid')` is safe by
accident — the invented row has `status` `NULL`, so it fails the predicate — but
`count(*) FILTER (WHERE o.status IS DISTINCT FROM 'cancelled')` counts it. When in doubt
count a `NOT NULL` column of the right table:
[the LEFT JOIN trap](../02-count-variants/02-left-join-and-fan-out.md).

**An expensive predicate.** `FILTER` evaluates its predicate once per row per aggregate.
Four `FILTER`s with a regex each is four regex evaluations per row. Cheap for equality,
not free for everything.

## In Node

The whole point is one round trip returning one row:

```js
const {rows: [summary]} = await pool.query(
  `SELECT count(*)                                        ::int AS total,
          count(*) FILTER (WHERE status = 'paid')          ::int AS paid,
          count(*) FILTER (WHERE status = 'open')          ::int AS open,
          count(*) FILTER (WHERE status = 'cancelled')     ::int AS cancelled,
          coalesce(sum(total) FILTER (WHERE status='paid'),0)::int AS paid_revenue
   FROM agg_orders
   WHERE placed_at >= $1`,
  [since],
);
// { total: 6, paid: 3, open: 2, cancelled: 1, paid_revenue: 500 }
```

Two details that are not decoration. The `WHERE placed_at >= $1` is doing the real
narrowing — an index can serve it, and it applies to all five aggregates. And
`coalesce(...)` on the `sum` but not on the `count`s, because only `sum` comes back
`NULL` when nothing matches.

## Trade-off

`FILTER` turns N queries into one and gives fixed columns with real zeros, at the cost of
reading every row for every number and of a column set frozen at query-writing time. It
is the right default for a summary endpoint with a small, known set of categories. It is
the wrong tool for a single number — where a plain `WHERE` can use an index — and for a
category set that grows, where `GROUP BY` and a client-side pivot keep working without a
deploy.

## Gotchas

**Symptom:** a dashboard endpoint issues one query per tile and is slow
**Cause:** N scalar subqueries means N scans. Measured at four counts: 15132 buffers
against 3783, 161.21 ms against 65.45 ms
**Fix:** one query with one `FILTER` per tile. Compare `Buffers` before and after — the
ratio is the number of scans you removed

**Symptom:** you replaced a `WHERE` with a `FILTER` on a single-aggregate query and it
got slower
**Cause:** `FILTER` is not a scan filter — no index can narrow it, so the whole table is
read
**Fix:** use `WHERE` when there is only one aggregate. `FILTER` earns its place from the
second one onwards

**Symptom:** a status disappears from a report in a quiet week
**Cause:** `GROUP BY status` emits only statuses present in the data
**Fix:** `FILTER` columns, which are fixed by the query text and come back as `0` — or
generate the category spine and `LEFT JOIN` the aggregate onto it

**Symptom:** a new category appears in the data and the report never mentions it
**Cause:** the opposite failure — `FILTER` columns are fixed by the query text
**Fix:** `GROUP BY` plus a client-side pivot when the category set is open

**Symptom:** `42809 FILTER specified, but X is not an aggregate function`
**Cause:** `FILTER` only attaches to aggregates — not to plain functions, and not to
`row_number`/`rank`/`lag`, which are window functions rather than aggregates
**Fix:** check the function is an aggregate. If you meant a window ranking, the
condition belongs in a subquery `WHERE` outside it

**Symptom:** `FILTER` written after `OVER` is a syntax error
**Cause:** the clause order is `aggregate(...) FILTER (WHERE …) OVER (…)`
**Fix:** put `FILTER` before `OVER`

## Interview questions

**★ Is `FILTER` faster than `CASE`?**
No — measured 65.45 ms against 65.14 ms on 500 000 rows, identical plans and identical
`Buffers: shared hit=3783`. It is faster than the pattern people actually write instead:
four scalar subqueries took 161.21 ms and read 15132 buffers, exactly 4× the pages,
because each subquery scans the table again.

**★ When is `FILTER` the wrong choice?**
When there is only one aggregate. `FILTER` is not a scan filter — no index can narrow it
— so `count(*) FILTER (WHERE kind='purchase')` reads the whole table while `count(*) …
WHERE kind='purchase'` can use an index. `FILTER` pays from the second aggregate onwards.

**★ `FILTER` or `GROUP BY` for a status breakdown?**
Neither is faster (65 ms vs 72 ms, both one scan). `FILTER` gives fixed columns with real
zeros for absent categories; `GROUP BY` gives rows and silently omits categories with no
data. Use `FILTER` for a known, small category set and `GROUP BY` when the set is open.

**★ Can you use `FILTER` with a window function?**
With aggregate window functions, yes: `count(*) FILTER (WHERE …) OVER ()` — measured
working. Not with `row_number`, `rank` or `lag`, which are window functions rather than
aggregates and give `42809`. The clause order is `FILTER` then `OVER`.

**Does `FILTER` help with join fan-out?**
No. It narrows which rows an aggregate consumes; it does not de-duplicate them. A
`count(*) FILTER (…)` over a fanned-out join is inflated exactly as `count(*)` would be.
Pre-aggregate the child table instead.

**How would you prove that a dashboard rewrite actually removed work?**
Compare `Buffers` in `EXPLAIN (ANALYZE, BUFFERS)`, not wall-clock. Four subqueries read
15132 shared buffers; the single `FILTER` query read 3783. That 4× is stable, whereas the
2.5× time difference varies with machine load.

---

← [Conditional aggregation](01-conditional-aggregation.md) ·
Next topic → [jsonb_agg and friends](../json-agg/)
