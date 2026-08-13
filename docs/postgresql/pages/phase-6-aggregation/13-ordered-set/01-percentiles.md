---
title: "Percentiles"
sidebar_label: "01 · Percentiles"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex37-cte-subquery.mjs`,
> `sandbox/pg-api/ex37e-ordered-set-checks.mjs`.

**An ordered-set aggregate needs its input sorted before it can produce an answer, which is
why it has its own syntax: `WITHIN GROUP (ORDER BY ...)`. Percentiles are the reason you
will use one — and the p95 of a latency distribution says something an average cannot,
which is exactly why it costs 3× more.**

## The syntax and the two variants

```sql
SELECT round(percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)::numeric, 2) AS p50_cont,
       percentile_disc(0.5) WITHIN GROUP (ORDER BY amount) AS p50_disc,
       round(percentile_cont(0.95) WITHIN GROUP (ORDER BY amount)::numeric, 2) AS p95,
       round(avg(amount), 2) AS mean
FROM agg_events;
```

```console
percentiles             : [{"p50_cont":"459.00","p50_disc":459,"p95":"864.00","mean":"459.30"}]
```

The `ORDER BY` lives **inside** `WITHIN GROUP`, not in the query. It is not the output
ordering — it is the ordering the aggregate is defined over. That is the syntactic tell for
this whole family.

### `cont` interpolates, `disc` returns a real value

```sql
SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY v) AS cont,
       percentile_disc(0.5) WITHIN GROUP (ORDER BY v) AS disc
FROM (VALUES (1.0),(2.0),(3.0),(4.0)) t(v);
```

```console
cont vs disc on 4 values: [{"cont":2.5,"disc":"2.0"}]
  cont interpolates (2.5), disc returns an actual value from the set (2.0)
```

**2.5 is not in the input.** `percentile_cont` treats the values as a continuous
distribution and interpolates between the two middle values; `percentile_disc` picks the
first actual value at or past the position. On the 500 000-row table both give 459 because
the data is dense enough that the interpolation lands on a real value.

Which to use:

| | Use when |
|---|---|
| `percentile_cont` | the quantity is continuous — latency, price, duration. The standard choice for p95/p99 |
| `percentile_disc` | the result must be a value that actually occurred — a real order id, a real timestamp, a category |

`percentile_cont` only accepts numeric and interval input, because it has to be able to
average two values. `percentile_disc` works on anything sortable, which is why it is the
one you can use on text or dates.

## Several percentiles in one pass

Passing an array returns an array, and sorts **once**:

```sql
SELECT percentile_cont(ARRAY[0.5, 0.9, 0.99]) WITHIN GROUP (ORDER BY amount) AS p
FROM agg_events;
```

```console
several percentiles, one pass: [{"p":[459,819,900]}]
```

This is the form to reach for on a dashboard. Three separate `percentile_cont` calls in one
`SELECT` would ask for three sorts of the same data; the array form asks for one and picks
three positions out of it. The result arrives in the driver as a JS array.

## `NULL`s are ignored, like every other aggregate

```console
percentile ignores NULL : [{"rows":500000,"non_null":428572,"max_via_pct":909,"max_via_max":909}]
```

500 000 rows, **428 572 of them non-null**, and `percentile_disc(1.0)` returns 909 —
exactly what `max()` returns. Two things follow:

- **The percentile is computed over the non-null values only.** 71 428 nulls did not become
  zeros and did not drag the distribution down. That is almost always what you want, but it
  means a p50 over a column that is 60% `NULL` is the median *of the rows that have a
  value*, which is a different statement from the one a dashboard label usually makes.
- **`percentile_disc(1.0)` is `max()` and `percentile_disc(0.0)` is `min()`**, confirmed at
  both ends:

  ```console
  === C. percentile_disc at the extremes equals min/max ===
  [{"p0":10,"min":10,"p100":909,"max":909}]
  ```

  Useful as a sanity check when you are unsure whether a percentile expression is doing what
  you think it is.

## Per group

Ordered-set aggregates work under `GROUP BY` like any other aggregate:

```sql
SELECT kind, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)::numeric, 1) AS p50
FROM agg_events GROUP BY kind ORDER BY kind;
```

```console
per-group percentile    : [{"kind":"click","p50":"459.0"},{"kind":"purchase","p50":"460.0"},
                           {"kind":"refund","p50":"458.0"},{"kind":"view","p50":"459.0"}]
```

Four medians within two units of each other — which is the correct read on this fixture,
where `amount` is generated independently of `kind`. **A per-group breakdown that comes back
suspiciously uniform is worth checking against the data generator before it is worth
explaining**, and in an earlier version of this fixture two columns shared a factor and made
every two-column query meaningless.

## What it costs

```console
percentile cost, 500k   : 178.32 ms  <- must sort
avg cost, 500k          : 57.41 ms
```

**3.1× the cost of `avg()`**, and the reason is structural rather than incidental. `avg()`
is a running sum and a count: one pass, constant memory, and it parallelises. A percentile
cannot be known until the whole ordered set is available, so the input has to be
materialised and sorted — which costs time, costs `work_mem`, and spills to disk when the
set does not fit.

That is the price of the question. There is no percentile algorithm that avoids ordering
the data, so the trade is not between implementations but between *asking for a percentile
at all* versus accepting a mean. And a mean is the wrong statistic for latency, which is
the case where you should simply pay.

Two ways to make it cheaper when you must:

- **Aggregate ahead of time.** Roll up percentiles per hour into a summary table, then read
  those. Percentiles do not compose — you cannot average the p95s — so the rollup has to
  store enough to recompute, or accept approximation.
- **Use an approximation extension** such as `t-digest` or HyperLogLog-style sketches, which
  trade exactness for a fixed-size state that *does* merge.

## In Node

```js
const {rows: [stats]} = await pool.query(
  `SELECT percentile_cont(ARRAY[0.5, 0.95, 0.99])
            WITHIN GROUP (ORDER BY duration_ms) AS p,
          round(avg(duration_ms), 2) AS mean,
          count(*)::int              AS n,
          count(duration_ms)::int    AS n_with_value
   FROM requests
   WHERE started_at >= $1`,
  [since],
);

const [p50, p95, p99] = stats.p;
```

- **The array form returns a JS array**, so one destructure gives you all three.
- **Return `count(*)` next to `count(col)`.** The gap between them is how many rows had no
  value, and without it a percentile over a mostly-`NULL` column looks authoritative.
  Measured here: 500 000 rows, 428 572 with a value.
- **`::numeric` before `round`.** `percentile_cont` over a `double precision` column returns
  `double precision`, and `round(v, n)` with two arguments is `numeric`-only — the cast is
  what stops a `42883 function round(double precision, integer) does not exist`.
- **Expect `numeric` results as strings** in the driver, as always
  ([phase 7](../../phase-7-pg-driver/09-pg-types.md)).

## Trade-off

Percentiles describe a distribution in a way a mean cannot — the p95 is the number your
users actually feel, and an average latency hides every tail. The cost is a sort of the
whole input: 3.1× `avg()` here, memory proportional to the group, a spill to disk when it
does not fit, and no way to combine precomputed results afterwards. Pay it on the query
that matters and roll up in advance for anything a dashboard refreshes on a timer.

## Gotchas

**Symptom:** `syntax error` writing `percentile_cont(0.5, amount)`
**Cause:** ordered-set aggregates take the fraction as their argument and the column in
`WITHIN GROUP (ORDER BY ...)`
**Fix:** `percentile_cont(0.5) WITHIN GROUP (ORDER BY amount)`

**Symptom:** a p50 returns a value that does not exist in the data
**Cause:** `percentile_cont` interpolates. Measured: 2.5 from the set 1, 2, 3, 4
**Fix:** `percentile_disc` if the result must be a value that actually occurred

**Symptom:** `42883 function round(double precision, integer) does not exist`
**Cause:** two-argument `round` is `numeric`-only, and `percentile_cont` over a float column
returns `double precision`
**Fix:** `round(percentile_cont(...)::numeric, 2)`

**Symptom:** a percentile query is slow and spills to disk
**Cause:** it must sort the whole input; `avg()` does not. Measured 178.32 ms versus 57.41 ms
**Fix:** raise `work_mem` for that query, pre-aggregate into a summary table, or use an
approximation extension

**Symptom:** a dashboard's p50 looks implausibly good
**Cause:** `NULL`s are excluded, so it is the median of rows that have a value. Measured:
428 572 of 500 000 rows
**Fix:** report `count(col)` alongside, and decide whether missing values should be excluded
or treated as something

**Symptom:** three percentiles in one `SELECT` are slower than expected
**Cause:** three separate calls sort three times
**Fix:** the array form — `percentile_cont(ARRAY[0.5, 0.9, 0.99])` — which sorts once

## Interview questions

**★ What is the difference between `percentile_cont` and `percentile_disc`?**
`percentile_cont` interpolates between values and can return something not present in the
data — measured: 2.5 from the set 1, 2, 3, 4. `percentile_disc` returns an actual value from
the set — 2.0 for the same input. Use `cont` for continuous quantities like latency, `disc`
when the answer must be a real occurring value.

**★ Why is `WITHIN GROUP` needed at all?**
Because the aggregate is defined over an *ordered* set — the answer depends on the sort
order of the input, unlike `sum` or `avg`. `WITHIN GROUP (ORDER BY ...)` supplies that
ordering, and it is separate from the query's own `ORDER BY`.

**★ Why is a percentile more expensive than an average?**
`avg()` is one pass with constant memory and parallelises; a percentile cannot be known
until the entire input is ordered, so it materialises and sorts. Measured on 500 000 rows:
178.32 ms versus 57.41 ms, 3.1×.

**★ How do you compute p50, p95 and p99 without sorting three times?**
Pass an array: `percentile_cont(ARRAY[0.5, 0.9, 0.99]) WITHIN GROUP (ORDER BY amount)`,
which sorts once and returns an array. Measured: `[459, 819, 900]`.

**Do percentiles ignore `NULL`?**
Yes, like every aggregate — they are computed over non-null values only. Report
`count(col)` next to the result so a mostly-empty column cannot masquerade as a full one.

**Can you average precomputed p95s from each hour to get a daily p95?**
No. Percentiles do not compose that way. Either store enough per bucket to recompute, or use
an approximation sketch designed to merge.

---

← [Topic index](README.md) · Next → [mode, bool_and and hypothetical sets](02-mode-and-booleans.md)
