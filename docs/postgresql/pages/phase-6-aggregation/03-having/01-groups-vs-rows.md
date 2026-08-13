---
title: "Filtering groups, not rows"
sidebar_label: "01 · Groups vs rows"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36d-count-having.mjs`.

**`WHERE` decides which rows go into the groups. `HAVING` decides which groups come
out. They are not two spellings of the same idea, and the give-away is that `HAVING`
can see aggregates while `WHERE` cannot — because when `WHERE` runs, no aggregate has
been computed yet.**

## The two jobs

```sql
-- WHERE: only paid orders enter the grouping
SELECT customer_id, count(*)::int AS n, sum(total)::int AS spend
FROM agg_orders WHERE status = 'paid'
GROUP BY customer_id ORDER BY customer_id;
```

```console
WHERE then group : [{"customer_id":1,"n":1,"spend":100},{"customer_id":2,"n":2,"spend":400}]
```

```sql
-- HAVING: all orders enter, then groups with one member are dropped
SELECT customer_id, count(*)::int AS n
FROM agg_orders
GROUP BY customer_id HAVING count(*) > 1 ORDER BY customer_id;
```

```console
HAVING on the aggregate : [{"customer_id":1,"n":2},{"customer_id":2,"n":2}]
```

The first query's predicate is about a *row* — "is this order paid?" — and could be
evaluated the moment the row is read. The second's is about a *group* — "does this
customer have more than one order?" — and cannot be answered until every row for that
customer has been seen. That is the whole distinction, and it is why they occupy
different positions in the pipeline:

```
FROM → WHERE → GROUP BY → HAVING → SELECT → window → DISTINCT → ORDER BY → LIMIT
```

Customer 1 illustrates both at once. Under `WHERE status = 'paid'` they show 1 order;
under `HAVING count(*) > 1` they show 2. Neither number is wrong — they answer
different questions, and a report that mixes them up produces a total that no single
definition explains.

## What each clause may reference

Every cell below was produced rather than remembered:

```console
=== D7. HAVING edge cases ===
HAVING with no GROUP BY, true            ok  rows=1 [{"count":6}]
HAVING with no GROUP BY, false           ok  rows=0 []
HAVING a grouped column                  ok  rows=2 [{"status":"open","count":2},
                                                     {"status":"cancelled","count":1}]
HAVING an ungrouped column               ->  42803 column "agg_orders.coupon" must appear
                                             in the GROUP BY clause or be used in an
                                             aggregate function
HAVING an output alias                   ->  42703 column "n" does not exist
WHERE with an aggregate                  ->  42803 aggregate functions are not allowed in WHERE
HAVING referencing a DIFFERENT aggregate ok  rows=1 [{"status":"paid","n":3}]
```

| Reference | `WHERE` | `HAVING` |
|---|---|---|
| a plain column | ✅ | only if it is a **grouping key** — otherwise `42803` |
| an aggregate | ❌ `42803` | ✅ |
| an aggregate **not in the select list** | ❌ | ✅ |
| an output alias | ❌ `42703` | ❌ `42703` |
| a window function | ❌ `42P20` | ❌ `42P20` |

Three of those deserve a sentence each.

**`HAVING` on a grouping column is legal**, and it is the case that makes people think
the two clauses are interchangeable. `HAVING status <> 'paid'` works because `status`
is the grouping key, so it has one value per group. It is also, as chunk 02 shows,
optimised into a `WHERE` behind your back.

**`HAVING` may use an aggregate that never appears in the output.** `HAVING sum(total)
> 100` filtered the `paid` group while the select list contains only `count(*)` — the
aggregate is computed for the filter and discarded. That is genuinely useful: "customers
who have spent over £1000" does not require showing the total.

**Neither clause sees output aliases**, and the error is `42703 column "n" does not
exist` rather than `42803`. Both clauses run before the select list is materialised, so
the name has not been created yet. Repeat the expression, or wrap the query:

```sql
-- fails: 42703
SELECT status, count(*) AS n FROM agg_orders GROUP BY status HAVING n > 1;
-- works
SELECT status, count(*) AS n FROM agg_orders GROUP BY status HAVING count(*) > 1;
-- also works, and reads better when the expression is long
SELECT * FROM (SELECT status, count(*) AS n FROM agg_orders GROUP BY status) s WHERE s.n > 1;
```

The subquery form is worth knowing beyond aesthetics: it is the only shape that lets
you filter on a **window function** result, which `HAVING` cannot do at all — see
[window functions](../windows-intro/), where the error is `42P20`.

## `HAVING` without `GROUP BY`

This is the corner that surprises people, and it follows directly from the rule that
an aggregate query with no `GROUP BY` has exactly one implicit group:

```sql
SELECT count(*)::int AS n FROM agg_orders HAVING count(*) > 3;   -- [{"n":6}]
SELECT count(*)::int AS n FROM agg_orders HAVING count(*) > 99;  -- []
```

```console
HAVING with no GROUP BY : [{"n":6}]
  no GROUP BY = one group over the whole table; HAVING can eliminate it entirely:
  same, threshold 99    : []
  ^ zero rows, not a row containing 6
```

The second query returns **zero rows**, not one row containing `6`. There was one
group, `HAVING` rejected it, and nothing remains. This is the one way to make an
un-grouped aggregate query return no rows at all — everywhere else it is guaranteed to
return exactly one, as covered on
[empty groups](../01-group-by/02-empty-groups-and-keys.md).

In Node that means the shape of the result changes with the data:

```js
const {rows} = await pool.query(
  `SELECT count(*)::int AS n FROM agg_orders HAVING count(*) > $1`, [threshold]);
const n = rows[0]?.n ?? 0;     // rows may legitimately be empty
```

It is a real pattern — "return the total only if it exceeds a threshold" — but if you
did not mean it, the fix is to move the condition into the application, because a
missing row and a zero are being conflated.

## The `LEFT JOIN` version of the trap

```sql
-- matches EVERY customer, including those with no orders
SELECT c.id, count(*)::int FROM agg_customers c
LEFT JOIN agg_orders o ON o.customer_id = c.id
GROUP BY c.id HAVING count(*) > 0;

-- correct
… GROUP BY c.id HAVING count(o.id) > 0;
```

`count(*)` after a `LEFT JOIN` counts the `NULL`-extended row, so it is at least 1 for
every left row and the predicate is vacuously true. Measured in full on
[the LEFT JOIN trap](../02-count-variants/02-left-join-and-fan-out.md). When you find
this, ask whether the `LEFT JOIN` was ever right — "customers who have ordered" is a
[semi-join](../../phase-5-joins/03-semi-anti/01-semi-joins.md), and `EXISTS` states it
without needing a group at all.

## Choosing between them

The test is mechanical: **can the predicate be decided by looking at one row?**

| Predicate | Clause | Why |
|---|---|---|
| `status = 'paid'` | `WHERE` | one row decides it |
| `placed_at >= now() - interval '30 days'` | `WHERE` | one row decides it |
| `count(*) > 1` | `HAVING` | needs the whole group |
| `sum(total) > 1000` | `HAVING` | needs the whole group |
| `customer_id = 42` (also the grouping key) | either — **prefer `WHERE`** | see chunk 02 |

Where both are legal, `WHERE` is the better default for one reason that survives every
optimiser change: it makes the intent explicit at the point where the reader is
thinking about rows. Chunk 02 shows that PostgreSQL rewrites the `HAVING` form into the
`WHERE` form anyway when it can — but *when it can* has conditions, and relying on it is
relying on something the plan can stop doing.

## Trade-off

`HAVING` is the only way to filter on an aggregate, and it necessarily runs after the
grouping has already been computed — so every group you are about to discard was still
built. When the filter is highly selective and *could* have been expressed as a `WHERE`,
that is pure waste. When it genuinely needs the aggregate, there is no alternative and
the cost is inherent: you cannot know a customer has five orders without counting them.

## Gotchas

**Symptom:** `42803 aggregate functions are not allowed in WHERE`
**Cause:** a group-level predicate written in a row-level clause
**Fix:** move it to `HAVING`. If it does not involve an aggregate, the real problem is
usually an output alias — check for `42703` instead

**Symptom:** `42703 column "n" does not exist` in `HAVING`, where `n` is right there in
the select list
**Cause:** `HAVING` runs before the select list is materialised, so aliases do not exist
**Fix:** repeat the aggregate expression, or wrap the grouped query in a subquery and
filter outside — which is also the only way to filter on a window function

**Symptom:** `HAVING` on a plain column gives `42803`
**Cause:** the column is not a grouping key, so it has no single value per group
**Fix:** if it is a row-level condition, it belongs in `WHERE`. If you meant "any row in
the group", use `bool_or(col = …)`; if "every row", `bool_and`

**Symptom:** an aggregate query returns zero rows and the code crashes on `rows[0].n`
**Cause:** `HAVING` with no `GROUP BY` can eliminate the single implicit group entirely
**Fix:** `rows[0]?.n ?? 0`, and reconsider whether the threshold belongs in SQL

**Symptom:** `HAVING count(*) > 0` after a `LEFT JOIN` matches everything
**Cause:** the `NULL`-extended row makes `count(*)` at least 1 for every left row
**Fix:** `HAVING count(o.id) > 0` — or drop the `LEFT JOIN` and use `EXISTS`, which is
what "has at least one" actually means

## Interview questions

**★ What is the difference between `WHERE` and `HAVING`?**
`WHERE` filters rows before grouping; `HAVING` filters groups after. The consequence is
that `HAVING` can reference aggregates and `WHERE` cannot — when `WHERE` runs, nothing
has been aggregated yet. Measured: `WHERE count(*) > 1` gives `42803`.

**★ Can `HAVING` reference a plain column?**
Only if it is a grouping key — otherwise `42803`, the same error as selecting an
ungrouped column, and for the same reason. `HAVING status <> 'paid'` works when
grouping by `status`.

**★ What does `HAVING` do without a `GROUP BY`?**
It filters the single implicit group covering the whole table. `HAVING count(*) > 99`
on a six-row table returns **zero rows** — not a row containing 6. It is the only way to
make an un-grouped aggregate query return nothing.

**★ Can `HAVING` use an aggregate that is not in the select list?**
Yes. `HAVING sum(total) > 100` while selecting only `count(*)` is legal — the aggregate
is computed for the filter and discarded. That is how "customers who spent over £1000"
is written without displaying the total.

**Why can neither `WHERE` nor `HAVING` use a select-list alias?**
Both run before the select list is materialised, so the alias does not exist yet. The
error is `42703 column does not exist`, distinct from `42803`. `ORDER BY`, which runs
last, can use aliases.

**`HAVING count(*) > 0` after a `LEFT JOIN` returns every row. Why?**
Because the `LEFT JOIN` emits a `NULL`-extended row for non-matching left rows, and
`count(*)` counts it — so the count is never 0. Use `count(o.id)`, or express the
intent as `EXISTS`.

---

← [Topic index](README.md) · Next → [What HAVING costs](02-what-having-costs.md)
