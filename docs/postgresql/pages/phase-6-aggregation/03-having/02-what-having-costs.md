---
title: "What HAVING costs"
sidebar_label: "02 · What HAVING costs"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36d-count-having.mjs`,
> `sandbox/pg-api/ex36b-agg-plans.mjs`.

**There are two kinds of `HAVING`, and they cost completely different things. A `HAVING`
on a grouping column is rewritten into a `WHERE` before execution and costs nothing. A
`HAVING` on an aggregate cannot be, and every group it discards was still built first.**

## The one the planner fixes for you

These two queries look like the textbook example of "the right way and the wrong way":

```sql
-- filter rows, then group
SELECT user_id, count(*) FROM agg_events
WHERE kind = 'purchase' GROUP BY user_id;

-- group by both, then discard groups
SELECT user_id, count(*) FROM agg_events
GROUP BY user_id, kind HAVING kind = 'purchase';
```

The plans are **identical**:

```console
--- W. WHERE then group
Finalize HashAggregate (actual rows=5000.00 loops=1)
  Group Key: user_id
  Batches: 1  Memory Usage: 409kB
  Buffers: shared hit=3783
  ->  Gather (actual rows=15000.00 loops=1)
        ->  Partial HashAggregate (actual rows=5000.00 loops=3)
              Group Key: user_id
              ->  Parallel Seq Scan on agg_events (actual rows=41666.67 loops=3)
                    Filter: (kind = 'purchase'::text)
                    Rows Removed by Filter: 125000

--- H. group by both, HAVING on the grouping column
Finalize HashAggregate (actual rows=5000.00 loops=1)
  Group Key: user_id
  Batches: 1  Memory Usage: 409kB
  Buffers: shared hit=3783
  ->  Gather (actual rows=15000.00 loops=1)
        ->  Partial HashAggregate (actual rows=5000.00 loops=3)
              Group Key: user_id
              ->  Parallel Seq Scan on agg_events (actual rows=41666.67 loops=3)
                    Filter: (kind = 'purchase'::text)
                    Rows Removed by Filter: 125000
```

Read what the second plan did with the query you wrote. You said `GROUP BY user_id,
kind`; the plan says **`Group Key: user_id`** — `kind` has been dropped from the grouping
entirely. And the `HAVING` predicate appears as `Filter: (kind = 'purchase'::text)` on
the **sequential scan**, which is where `WHERE` would have put it.

That is the optimiser applying a straightforward rule: a `HAVING` clause referencing only
grouping columns is constant within each group, so it can be evaluated per row instead —
and once `kind` is constrained to a single value it is no longer a useful grouping key.
Timings confirm there is nothing left between them:

```console
WHERE kind=purchase, GROUP BY               57.21 ms   rows out: 5000
GROUP BY user_id,kind HAVING kind=…         55.08 ms   rows out: 5000
```

**So the usual advice — "use `WHERE` when you can, it's faster" — is not true here on
performance grounds.** Write `WHERE` anyway, for two better reasons:

1. **It says what you mean.** The predicate is about a row, and putting it where rows are
   filtered is what a reader expects.
2. **The rewrite has conditions.** It applies because the predicate touches only grouping
   columns and is not volatile. Change it to something the planner cannot prove constant
   per group — a volatile function, a reference to a column not in the `GROUP BY` — and
   you are back to filtering after the fact, or to a `42803`.

## The one nobody can fix

```sql
SELECT user_id, count(*) FROM agg_events GROUP BY user_id HAVING count(*) > 50;
```

```console
--- H2. HAVING on an aggregate
Finalize HashAggregate (actual rows=5000.00 loops=1)
  Group Key: user_id
  Filter: (count(*) > 50)
  Batches: 1  Memory Usage: 409kB
  Buffers: shared hit=3783
  ->  Gather (actual rows=15000.00 loops=1)
        ->  Partial HashAggregate (actual rows=5000.00 loops=3)
              Group Key: user_id
              ->  Parallel Seq Scan on agg_events (actual rows=166666.67 loops=3)
```

Now the `Filter:` sits on the **`Finalize HashAggregate`**, not the scan — because it
cannot be evaluated until the count exists. Two consequences that are worth being
explicit about:

**The full scan happens regardless.** `actual rows=166666.67 loops=3` — all 500 000 rows,
no `Rows Removed by Filter` on the scan. Every group is built, then some are thrown away.

**Selectivity does not reduce work.** Measured with three thresholds against the same
table, where every user has exactly 100 events:

```console
GROUP BY user_id (no HAVING)                70.70 ms   rows out: 5000
… HAVING count(*) > 50  (keeps all)         64.53 ms   rows out: 5000
… HAVING count(*) > 100 (keeps none)        85.60 ms   rows out: 0
```

Discarding **every** group was not cheaper than discarding none, and both were in the
same band as no `HAVING` at all — the 21 ms spread across those three is run-to-run
variance on identical `Buffers: shared hit=3783`. There is no version of this where
filtering harder pays for itself, because the filtering happens after all the work.

That is the honest cost model: **`HAVING count(…) > n` costs whatever grouping the whole
table costs, and the filter itself is free.** If that is too slow, the fix is never to
tune the `HAVING` — it is to reduce what reaches the grouping, with a `WHERE` an index
can serve, a narrower time range, or a pre-aggregated rollup.

## When the aggregate filter can be made cheap

There is one shape that genuinely helps, and it is not a `HAVING` at all. If the
predicate is really an *existence* test, express it as one:

```sql
-- "users with at least one purchase" as a HAVING: groups everything
SELECT user_id FROM agg_events GROUP BY user_id
HAVING count(*) FILTER (WHERE kind = 'purchase') > 0;

-- as a semi-join: stops at the first match per user, and can use an index
SELECT u.user_id FROM (SELECT DISTINCT user_id FROM agg_events) u
WHERE EXISTS (SELECT 1 FROM agg_events e
              WHERE e.user_id = u.user_id AND e.kind = 'purchase');
```

`count(…) > 0` forces a full count of every group; `EXISTS` is allowed to stop at the
first matching row. That is the same argument as
[semi-joins](../../phase-5-joins/03-semi-anti/01-semi-joins.md), where `EXISTS` beat
`JOIN` + `DISTINCT` by 2.5×, and it is the single most valuable rewrite in this area —
because "has at least one" is what most `HAVING count(*) > 0` clauses were reaching for.

The rewrite does **not** apply when the threshold is genuinely a count (`> 5`, `>= 2`).
There you have to count, and the cost is the grouping.

## Where `HAVING` cannot go at all

`HAVING` filters groups. It cannot filter on anything computed *after* grouping — which
is exactly what a window function is:

```console
window function in HAVING -> 42P20 window functions are not allowed in HAVING
```

Windows are evaluated after `HAVING`, so the value does not exist yet. The only way to
filter on one is to compute it in a subquery and filter outside:

```sql
SELECT * FROM (
  SELECT user_id, count(*) AS n,
         rank() OVER (ORDER BY count(*) DESC) AS r
  FROM agg_events GROUP BY user_id
) s WHERE s.r <= 10;
```

Note `rank() OVER (ORDER BY count(*) DESC)` — a window function over an aggregate, which
is legal precisely because windows run later. Full treatment on
[window functions](../windows-intro/).

## In Node

Nothing special, except that the threshold is a parameter like any other and the count
comes back as `bigint`:

```js
const {rows} = await pool.query(
  `SELECT user_id, count(*)::int AS events
   FROM agg_events
   WHERE created_at >= $1                 -- cut the input first
   GROUP BY user_id
   HAVING count(*) > $2                   -- then filter the groups
   ORDER BY events DESC, user_id
   LIMIT $3`,
  [since, minEvents, limit],
);
```

The `WHERE` on `created_at` is doing the real work; the `HAVING` is shaping the answer.
That ordering — narrow first, group, then filter groups — is the whole practical lesson
of this chunk. And note the `ORDER BY` carries `user_id` as a tiebreaker, because
`events DESC` alone is not unique.

## Trade-off

`HAVING` is the only way to filter on an aggregate, and it necessarily pays for building
every group it then discards. There is no tuning knob for that; the cost is inherent,
since you cannot know a user has 51 events without counting them. What you *can* choose
is whether the question really needs a count — `EXISTS` answers "at least one" without
one — and how much data reaches the grouping in the first place.

## Gotchas

**Symptom:** you moved a predicate from `HAVING` to `WHERE` expecting a speed-up and got
none
**Cause:** the predicate referenced only grouping columns, so the planner had already
rewritten it into a scan filter. Measured: identical plans, 55.08 ms vs 57.21 ms
**Fix:** none needed for performance — keep it in `WHERE` for readability, and look
elsewhere for the actual cost

**Symptom:** `HAVING count(*) > n` is slow and raising `n` does not help
**Cause:** the filter runs after every group is built; selectivity cannot reduce the
scan. Measured: keeping 0 of 5000 groups was no faster than keeping all 5000
**Fix:** reduce the input with a `WHERE` an index can serve, or pre-aggregate. Tuning the
`HAVING` is not a lever

**Symptom:** "users who have ever done X" times out on a large table
**Cause:** written as `HAVING count(*) FILTER (WHERE …) > 0`, which counts every matching
row in every group
**Fix:** rewrite as `EXISTS`, which stops at the first match and can use an index

**Symptom:** `42P20 window functions are not allowed in HAVING`
**Cause:** windows are evaluated after `HAVING`; the value does not exist yet
**Fix:** compute the window in a subquery or CTE and filter in the outer `WHERE`

**Symptom:** the `HAVING` rewrite stopped happening after someone added a function call
**Cause:** the rewrite requires the predicate to be provably constant per group; a
volatile function is not
**Fix:** put the row-level condition in `WHERE` yourself rather than relying on the
optimiser to move it

## Interview questions

**★ Is `WHERE` faster than `HAVING` for the same predicate?**
Not when the predicate references only grouping columns — PostgreSQL rewrites it into a
scan filter, and the plans come out byte-identical (`Group Key: user_id`, `Filter: (kind
= 'purchase')` on the sequential scan). Measured 55.08 ms vs 57.21 ms. Write `WHERE`
anyway, because it states the intent and because the rewrite has preconditions.

**★ Why can't a `HAVING` on an aggregate be pushed down?**
Because the value it tests does not exist until every row of the group has been read. In
the plan the `Filter:` sits on the `Finalize HashAggregate` rather than the scan, and the
scan still reports all 500 000 rows.

**★ Does a more selective `HAVING` make the query cheaper?**
No. Measured: `HAVING count(*) > 100`, which kept **zero** of 5000 groups, was not faster
than one that kept all of them — same plan, same `Buffers: shared hit=3783`. All the work
happens before the filter.

**★ How do you make "users with at least one purchase" fast?**
Stop counting. `HAVING count(…) > 0` builds every group; `EXISTS` stops at the first
matching row per user and can use an index. Same rewrite that made `EXISTS` beat `JOIN` +
`DISTINCT` by 2.5× in the joins phase.

**Your `HAVING count(*) > 5` report is too slow. What do you change?**
Not the `HAVING` — it is already free. Reduce what reaches the grouping: a `WHERE` an
index can serve, a narrower time window, or a maintained rollup table. If the grouping
key is high-cardinality, an index leading with it lets the planner stream a
`GroupAggregate` in constant memory.

**Why is `rank() OVER (ORDER BY count(*) DESC)` legal when a window function in `HAVING`
is not?**
Because windows are evaluated *after* grouping and after `HAVING`, so by then the
aggregate exists and can be ordered by. Filtering on the window result still requires a
subquery, since there is no clause that runs later than the window.

---

← [Filtering groups, not rows](01-groups-vs-rows.md) ·
Next topic → [FILTER (WHERE ...)](../filter-clause/)
