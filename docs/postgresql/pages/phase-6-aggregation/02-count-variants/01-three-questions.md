---
title: "Three different questions"
sidebar_label: "01 · Three questions"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36d-count-having.mjs`.

**"How many orders?" and "how many orders have a total?" and "how many different
coupons were used?" are three questions. SQL spells them almost identically, and
nothing warns you when you asked the wrong one.**

## All three at once

```sql
SELECT count(*)::int                  AS star,
       count(total)::int              AS total_nonnull,
       count(coupon)::int             AS coupon_nonnull,
       count(DISTINCT coupon)::int    AS coupons,
       count(DISTINCT status)::int    AS statuses
FROM agg_orders;
```

```console
$ node ex36-aggregation.mjs
=== 2. three counts, three questions ===
on the small table : [{"star":6,"total_nonnull":5,"coupon_nonnull":3,
                      "coupons":2,"statuses":3}]
  count(*) counts rows; count(col) counts non-NULL; count(DISTINCT col) ignores NULL too
```

Six rows in the table. Read down the numbers:

| Expression | Result | Because |
|---|---|---|
| `count(*)` | **6** | six rows |
| `count(total)` | **5** | order 15's `total` is `NULL` |
| `count(coupon)` | **3** | three orders carry a coupon, three are `NULL` |
| `count(DISTINCT coupon)` | **2** | those three are `WELCOME`, `WELCOME`, `SPRING` |
| `count(DISTINCT status)` | **3** | `paid`, `open`, `cancelled` — no `NULL`s to skip |

The two facts that matter, and they compose:

> **`count(*)` counts rows. `count(expr)` counts rows where `expr` is not `NULL`.
> `DISTINCT` then de-duplicates what survived — it does not bring the `NULL`s back.**

So `count(DISTINCT coupon)` is 2 and not 3: `NULL` is not counted as "a distinct
value of its own". That surprises people who have internalised that `NULL` groups with
itself in `GROUP BY` — and both behaviours are correct, because `GROUP BY` is
partitioning rows while `count` is counting values, and there is no value here.

If you *want* `NULL` to be a category, say so explicitly:

```sql
SELECT count(DISTINCT coalesce(coupon, '')) AS coupons_including_none FROM agg_orders;
-- 3
```

## `count(*)` vs `count(1)`: measuring the folklore

There is a persistent belief that `count(1)` is faster than `count(*)` because the
database "does not have to expand the row". Measured on 500 000 rows, all four forms:

```console
=== D1. count(*) vs count(1) vs count(col) — is the folklore true? ===
count(*)          26.73 ms  buffers=3783   Finalize Aggregate / Gather / Partial Aggregate
count(1)          28.35 ms  buffers=3783   Finalize Aggregate / Gather / Partial Aggregate
count(id)         33.21 ms  buffers=3783   Finalize Aggregate / Gather / Partial Aggregate
count(amount)     31.25 ms  buffers=3783   Finalize Aggregate / Gather / Partial Aggregate
values : [{"star":500000,"one":500000,"pk":500000,"nullable":428572}]
```

**Identical plans, identical buffers, and a 6.5 ms spread with no reliable ordering.**
`count(1)` was not faster — it came out marginally slower. `count(amount)`, which has to
test 500 000 values for `NULL`, came out *faster* than `count(id)`, which does not. Run
them again and the ranking moves around inside that band.

The correct reading is that **on a cached sequential scan, the aggregate is not the
cost** — the scan is, and all four scan the same 3783 buffers. In PostgreSQL `count(*)`
is not "expand every column and count"; the parser treats `*` here as "no argument", and
the executor counts tuples. There is nothing for `1` to save.

The folklore has a real origin — it repeats advice from other engines and other decades
— and it survives because the two forms are genuinely equivalent, so believing it is
never punished. Use `count(*)`: it is the standard spelling and it says "rows".

**Do not read a `NULL`-test penalty into this either.** An earlier run of these same
scripts showed `count(amount)` at 44.36 ms against `count(*)` at 27.85 ms and it was
tempting to write up a 1.6× cost for the per-row `NULL` check. It did not reproduce.
Whatever produced that gap was machine noise or cache state, not the `NULL` test —
which is exactly why the rule in this corpus is to compare `Buffers` first and treat
timing differences under ~2× on a cached scan as unproven.

The decision between these forms is therefore entirely about **meaning**:

| You want | Write |
|---|---|
| how many rows | `count(*)` |
| how many rows have this field | `count(col)` |
| how many different values | `count(DISTINCT col)` |

## Counting pairs

`DISTINCT` can span several columns, but the syntax is not what you would guess:

```console
=== D2. count(DISTINCT) over more than one column ===
two columns as a row : [{"pairs":12}]
count(DISTINCT a, b) without parens -> 42883 function count(text, integer) does not exist
```

`count(DISTINCT a, b)` is parsed as a two-argument `count`, which does not exist —
hence `42883`, an *unknown function* error rather than a syntax error. The working form
wraps the columns in a **row constructor**:

```sql
SELECT count(DISTINCT (kind, user_id % 3))::int AS pairs FROM agg_events;
-- 12   (4 kinds × 3 buckets)
```

And this is where the `NULL` rule reverses:

```sql
SELECT count(*)::int                        AS rows,
       count(DISTINCT (status, coupon))::int AS pairs,
       count(DISTINCT status)::int           AS statuses
FROM agg_orders;
```

```console
null inside the row : [{"rows":6,"pairs":4,"statuses":3}]
```

Six rows, **four** distinct pairs. Enumerate them:

```
(paid, WELCOME)   (open, NULL)   (paid, WELCOME)
(cancelled, NULL) (paid, SPRING) (open, NULL)
→ distinct: (paid,WELCOME), (open,NULL), (cancelled,NULL), (paid,SPRING) = 4
```

`(open, NULL)` and `(cancelled, NULL)` both counted, even though `count(DISTINCT
coupon)` on its own ignores those rows entirely. The reason is precise: **a row
containing a `NULL` is not itself `NULL`.** `count` skips `NULL` *arguments*, and the
argument here is a composite value that exists. Composite comparison uses `IS NOT
DISTINCT FROM` semantics per field, so the two `NULL` coupons compare equal to each
other and unequal to `WELCOME`.

This is a genuinely useful property — it is how you count distinct `(user, day)` pairs
without losing the rows where one side is missing — and a genuinely surprising one if
you carried the single-column rule over.

## Three shapes for the same question in Node

```js
// "how many orders?" — parameterised, cast, one row guaranteed
const {rows: [{n}]} = await pool.query(
  `SELECT count(*)::int AS n FROM agg_orders WHERE customer_id = $1`, [customerId]);

// "how many have been priced?"
const {rows: [{priced}]} = await pool.query(
  `SELECT count(total)::int AS priced FROM agg_orders WHERE customer_id = $1`, [customerId]);

// "how many different coupons?" — see chunk 03 before shipping this on a big table
const {rows: [{coupons}]} = await pool.query(
  `SELECT count(DISTINCT coupon)::int AS coupons FROM agg_orders WHERE customer_id = $1`,
  [customerId]);
```

The `::int` is not decoration — without it every one of these arrives as a string,
because `count` returns `bigint`. See
[what the driver hands JavaScript](../01-group-by/01-collapsing-rows.md).

## Trade-off

`count(*)` is the honest default, and it is wrong the moment a `LEFT JOIN` or a
nullable column enters the query. `count(col)` states the intent precisely and costs
nothing measurable next to the scan. `count(DISTINCT col)` answers a question the other
two cannot, and pays for it with a completely different execution strategy: no
parallelism and, without a suitable index, a disk sort — the only one of the three whose
cost is a real consideration. Choose on meaning first; chunk 03 is about what to do when
the meaning you need turns out to be the expensive one.

## Gotchas

**Symptom:** `count(DISTINCT status)` returns one less than the number of distinct
values you can see in the table
**Cause:** one of those "values" is `NULL`, which `count` skips even under `DISTINCT`
**Fix:** `count(DISTINCT coalesce(col, '<none>'))` if `NULL` should be a category — and
pick a sentinel the column cannot legitimately contain

**Symptom:** `42883 function count(text, integer) does not exist`
**Cause:** `count(DISTINCT a, b)` parses as a two-argument `count`
**Fix:** wrap in a row constructor: `count(DISTINCT (a, b))`

**Symptom:** counting distinct `(user, day)` pairs returns more than expected
**Cause:** the opposite of the single-column rule — a row containing a `NULL` is not
`NULL`, so pairs with a missing side *are* counted, and all such pairs with the same
non-`NULL` side collapse together
**Fix:** filter explicitly (`WHERE day IS NOT NULL`) if those rows should not count

**Symptom:** someone "optimises" `count(*)` to `count(1)` in a code review
**Cause:** folklore imported from other engines
**Fix:** measured identical here — 27.85 ms vs 28.96 ms, same plan, same buffers. Spend
the review comment on whether the query should be counting at all

**Symptom:** `rows[0].n` is a string
**Cause:** `count` returns `bigint`, which `pg` delivers as text
**Fix:** `count(*)::int` in SQL for bounded counts

## Interview questions

**★ What is the difference between `count(*)`, `count(col)` and `count(DISTINCT col)`?**
`count(*)` counts rows. `count(col)` counts rows where `col` is not `NULL`.
`count(DISTINCT col)` counts distinct non-`NULL` values. Measured on the same six rows:
6, 5 and 2.

**★ Does `count(DISTINCT col)` treat `NULL` as a distinct value?**
No — it skips `NULL` entirely, so a column with three `NULL`s and two real values
returns 2. This differs from `GROUP BY`, which puts all the `NULL`s in one group,
because `GROUP BY` partitions rows while `count` counts values.

**★ Is `count(1)` faster than `count(*)`?**
No. Measured at 28.35 ms vs 26.73 ms on 500 000 rows — identical plans, identical
`buffers=3783`, the difference inside run noise. `count(*)` does not expand the row; the
executor counts tuples, so there is nothing for `1` to save. All four counting forms
landed in a 26.7–33.2 ms band with no stable ordering.

**★ How do you count distinct combinations of two columns?**
`count(DISTINCT (a, b))` with a row constructor. Without the parentheses it parses as a
two-argument `count` and fails with `42883`. Note that pairs containing a `NULL` *are*
counted, unlike a single-column `count(DISTINCT)`.

**Does the per-row `NULL` test in `count(col)` cost anything measurable?**
Not on a cached sequential scan. `count(id)` (never `NULL`) measured 33.21 ms and
`count(amount)` (71 428 `NULL`s) measured 31.25 ms — the one doing *more* work was
faster. An earlier run suggested a 1.6× penalty and it did not reproduce. All four forms
read the same 3783 buffers; the scan is the cost.

**A column has 30% `NULL`s. Which of `count(*)` and `count(col)` do you want for "how
many records are there"?**
`count(*)`. The records exist; the column is merely unfilled. `count(col)` answers
"how many have this field", which is a different — and often also useful — number.
Return both if the distinction is meaningful to the reader.

---

← [Topic index](README.md) · Next → [The LEFT JOIN trap and fan-out](02-left-join-and-fan-out.md)
