---
title: "The four functions"
sidebar_label: "01 · The four functions"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex36-aggregation.mjs`.

**All four take no arguments and depend entirely on the `ORDER BY` inside their `OVER`
clause. They differ in exactly one respect — what happens when two rows have equal
`ORDER BY` values — and that is the whole of this page.**

## The fixture

```sql
CREATE TEMP TABLE agg_score (name text, team text, pts int);
INSERT INTO agg_score VALUES
  ('Ann','red',10),('Bob','red',10),('Cid','red',7),('Dee','red',5),
  ('Eve','blue',9),('Fay','blue',9),('Gil','blue',9);
```

Deliberately: `red` has one tie at the top, `blue` is entirely tied.

## `row_number`, `rank`, `dense_rank`, `percent_rank`

```sql
SELECT name, pts,
       row_number()   OVER (ORDER BY pts DESC)::int          AS rn,
       rank()         OVER (ORDER BY pts DESC)::int          AS rnk,
       dense_rank()   OVER (ORDER BY pts DESC)::int          AS dense,
       percent_rank() OVER (ORDER BY pts DESC)::numeric(4,2) AS pct_rank
FROM agg_score WHERE team = 'red' ORDER BY pts DESC, name;
```

```console
ties, three ways : [{"name":"Ann","pts":10,"rn":1,"rnk":1,"dense":1,"pct_rank":"0.00"},
                    {"name":"Bob","pts":10,"rn":2,"rnk":1,"dense":1,"pct_rank":"0.00"},
                    {"name":"Cid","pts":7, "rn":3,"rnk":3,"dense":2,"pct_rank":"0.67"},
                    {"name":"Dee","pts":5, "rn":4,"rnk":4,"dense":3,"pct_rank":"1.00"}]
```

| Function | Ann & Bob (tied) | Cid (next) | Rule |
|---|---|---|---|
| `row_number` | 1, **2** | 3 | consecutive integers, ties broken arbitrarily |
| `rank` | 1, **1** | **3** | ties share; the next value **skips** the gap |
| `dense_rank` | 1, **1** | **2** | ties share; no gap |
| `percent_rank` | 0.00, 0.00 | 0.67 | `(rank - 1) / (total_rows - 1)` |

The one to think about is `rank` giving Cid **3**, not 2. That is the familiar sporting
convention — two golds, no silver — and it means **`rank` values are not consecutive** and
`max(rank)` equals the row count, not the number of distinct values. If you need "how many
distinct score levels are above this one", that is `dense_rank`.

`percent_rank` is `(rank - 1) / (rows - 1)`, so it always starts at 0 and ends at 1. Cid's
0.67 is `(3-1)/(4-1)`. Its sibling `cume_dist` uses a different formula — the proportion of
rows *at or before* this one — and so starts above 0 and ends at exactly 1. Reach for
`cume_dist` for "what percentile is this value at"; `percent_rank` for "how far through the
ranking".

### When everything is tied

```sql
SELECT name, pts, row_number() OVER (ORDER BY pts DESC)::int AS rn,
                  rank()       OVER (ORDER BY pts DESC)::int AS rnk
FROM agg_score WHERE team = 'blue' ORDER BY name;
```

```console
all ties : [{"name":"Eve","pts":9,"rn":1,"rnk":1},
            {"name":"Fay","pts":9,"rn":2,"rnk":1},
            {"name":"Gil","pts":9,"rn":3,"rnk":1}]
  row_number is arbitrary among peers - the order can change between runs
```

`rank` is 1 for all three, correctly. `row_number` produced 1, 2, 3 — and **which player
got which number is not defined**. Nothing in the query distinguishes them, so the
executor assigns numbers in whatever order rows arrive.

That is the single most important practical fact on this page:

> **`row_number()` over a non-unique `ORDER BY` is non-deterministic.** Re-run it after a
> vacuum, an index change, or a plan flip, and the same row can get a different number.

Which matters enormously for `WHERE rn = 1` — "the top scorer per team" silently changes
identity between runs. The fix is always the same: **add a unique tiebreaker.**

```sql
row_number() OVER (ORDER BY pts DESC, name)      -- deterministic
row_number() OVER (PARTITION BY team ORDER BY pts DESC, id)
```

This is the same rule as [unstable pagination](../../phase-4-crud/03-limit-offset.md),
where paging 100 rows by 5 without a tiebreaker returned 54 distinct rows and 46 repeats.
Any `ORDER BY` whose result you act on needs to be total.

### Choosing between them

| You want | Use |
|---|---|
| exactly one row per position, no duplicates | `row_number` **+ a unique tiebreaker** |
| a leaderboard where ties genuinely share a place | `rank` |
| "which distinct level is this" — 1st, 2nd, 3rd tier | `dense_rank` |
| top-N per group | `row_number` — see [chunk 02](02-top-n-per-group.md) |
| de-duplicating rows | `row_number`, then keep `rn = 1` |

Ranking functions **ignore the frame clause**. `rank() OVER (ORDER BY x ROWS BETWEEN 1
PRECEDING AND CURRENT ROW)` is accepted and the frame has no effect, because rank is
defined over the whole partition by peer group. Only aggregate window functions and the
positional ones (`first_value`, `last_value`, `nth_value`) respond to a frame — see
[frames](../14-frames.md).

## `ntile`

`ntile(n)` divides the partition into `n` buckets as evenly as it can:

```sql
SELECT name, pts, ntile(3) OVER (ORDER BY pts DESC)::int AS bucket
FROM agg_score ORDER BY pts DESC, name;
```

```console
ntile, 7 rows into 3 : [{"name":"Ann","pts":10,"bucket":1},{"name":"Bob","pts":10,"bucket":1},
                        {"name":"Eve","pts":9,"bucket":2},{"name":"Fay","pts":9,"bucket":2},
                        {"name":"Gil","pts":9,"bucket":1},{"name":"Cid","pts":7,"bucket":3},
                        {"name":"Dee","pts":5,"bucket":3}]
  7/3: buckets get 3,2,2 - the earlier buckets take the remainder
```

**Two things in that output are worth stopping on.**

**The remainder goes to the earliest buckets.** 7 rows into 3 gives sizes 3, 2, 2 — never
2, 2, 3. So "the top quartile" from `ntile(4)` over 10 rows contains 3 rows and the bottom
contains 2. A report that says "top 25%" is not saying anything precise unless the row
count divides evenly.

**`ntile` splits ties across bucket boundaries.** Look at Gil: 9 points, same as Eve and
Fay, and Gil is in bucket **1** while Eve and Fay are in bucket 2. `ntile` fills buckets
positionally and has no concept of peers — so three identical scores landed in two
different buckets, and which one is arbitrary in exactly the way `row_number` is.

That makes `ntile` unsuitable for anything where equal values must be treated equally —
grading, tiering, commission bands. For those, compute the thresholds with
[`percentile_cont`](../13-ordered-set.md) and compare values against them, which puts
equal values in the same band by construction.

Fewer rows than buckets is legal and gives one row each, with the empty buckets simply
absent:

```console
ntile with fewer rows than buckets : [{"name":"Eve","b":1},{"name":"Fay","b":2},{"name":"Gil","b":3}]
```

Three rows, `ntile(10)`, buckets 1–3 used. Nothing indicates buckets 4–10 exist.

## In Node

```js
const {rows} = await pool.query(
  `SELECT name, pts,
          rank()       OVER w ::int AS rank,
          dense_rank() OVER w ::int AS tier,
          row_number() OVER (ORDER BY pts DESC, name)::int AS position
   FROM agg_score
   WHERE team = $1
   WINDOW w AS (ORDER BY pts DESC)
   ORDER BY pts DESC, name`,
  [team],
);
```

Three notes. The `::int` casts matter — all four functions return `bigint` and arrive as
strings otherwise. The named `WINDOW w` keeps `rank` and `dense_rank` on one definition.
And `position` deliberately uses a *different*, total ordering, because it is the one
whose value must be reproducible.

## Trade-off

Ranking in SQL is one pass over already-sorted data and needs no second query, and it
commits you to the tie semantics you chose at query-writing time. The genuine risk is not
performance but **non-determinism**: `row_number` over a non-unique order is a bug that
tests pass, because a small fixture returns rows in insertion order and looks stable. Add
the tiebreaker even when it looks redundant.

## Gotchas

**Symptom:** "top scorer per team" returns a different player on different days
**Cause:** `row_number()` over a non-unique `ORDER BY` — the assignment among tied rows is
arbitrary and depends on the plan
**Fix:** add a unique tiebreaker: `ORDER BY pts DESC, id`. Measured: three tied players
got 1, 2, 3 in an order nothing in the query determined

**Symptom:** ranks jump from 1 to 3 and a reviewer reports it as a bug
**Cause:** `rank()` skips after ties — two firsts means no second. That is the definition
**Fix:** `dense_rank()` if you want consecutive numbers. `max(rank())` equals the row
count, not the number of distinct values

**Symptom:** quartile buckets from `ntile(4)` are not the same size
**Cause:** the remainder is distributed to the **earliest** buckets — 7 rows into 3 gives
3, 2, 2
**Fix:** expected behaviour. If equal sizes matter, say "approximately" or compute
thresholds with `percentile_cont`

**Symptom:** two rows with identical values landed in different `ntile` buckets
**Cause:** `ntile` fills positionally and has no notion of peers. Measured: three players
on 9 points split across buckets 1 and 2
**Fix:** do not use `ntile` for grading or tiering. Compute percentile thresholds and
compare values to them

**Symptom:** a frame clause on `rank()` has no effect
**Cause:** ranking functions ignore the frame; they are defined over the whole partition
**Fix:** nothing to fix. Frames apply to aggregate windows and to
`first_value`/`last_value`/`nth_value`

**Symptom:** `rank` arrives in Node as a string
**Cause:** all four return `bigint`
**Fix:** `rank() OVER (…)::int`

## Interview questions

**★ What is the difference between `row_number`, `rank` and `dense_rank`?**
Only their tie behaviour. `row_number` always gives consecutive integers, breaking ties
arbitrarily. `rank` gives tied rows the same value and then skips (1, 1, 3).
`dense_rank` gives tied rows the same value without skipping (1, 1, 2). Measured on four
rows with one tie.

**★ When is `row_number()` non-deterministic, and why does it matter?**
Whenever the `ORDER BY` inside `OVER` is not unique — the numbers assigned among tied rows
depend on the plan, so `WHERE rn = 1` can pick a different row after a vacuum or a plan
change. Always add a unique tiebreaker.

**★ `ntile(4)` over 10 rows — how big is each bucket?**
3, 3, 2, 2. The remainder goes to the earliest buckets. It also splits tied values across
bucket boundaries, which makes it wrong for grading or commission tiers; use
`percentile_cont` thresholds there.

**★ Why does `rank()` skip numbers?**
Because it reports position, and two rows sharing first place means nothing occupies
second. The consequence is that `max(rank())` equals the row count rather than the number
of distinct values — use `dense_rank` when you want the count of distinct levels.

**Does a frame clause affect `rank()`?**
No. Ranking functions are defined over the whole partition by peer group and ignore the
frame. Frames affect aggregate windows and the positional functions `first_value`,
`last_value` and `nth_value`.

**What is the difference between `percent_rank` and `cume_dist`?**
`percent_rank` is `(rank - 1) / (rows - 1)`, so it runs from 0 to 1 — "how far through the
ranking". `cume_dist` is the proportion of rows at or before this one, so it starts above
0 and ends at 1 — "what percentile is this value at".

---

← [Topic index](README.md) · Next → [Top-N per group](02-top-n-per-group.md)
