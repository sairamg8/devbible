---
title: "GROUPING SETS, ROLLUP and CUBE"
sidebar_label: "01 · Sets, ROLLUP, CUBE"
sidebar_position: 1
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37-cte-subquery.mjs`.

**One `GROUP BY` produces one level of aggregation. A report usually wants several — per
country and status, per country, and a grand total — and `GROUPING SETS` asks for all of
them in one statement. `ROLLUP` and `CUBE` are shorthands for the two common set
collections, and the subtotal rows they add are marked by `NULL`s in the grouping
columns.**

## The baseline

```sql
SELECT c.country, o.status, count(*)::int AS n
FROM agg_orders o JOIN agg_customers c ON c.id = o.customer_id
GROUP BY c.country, o.status ORDER BY 1, 2;
```

```console
plain GROUP BY, 2 cols  : [{"country":"GB","status":"cancelled","n":1},
                           {"country":"GB","status":"open","n":1},
                           {"country":"GB","status":"paid","n":1},
                           {"country":"IN","status":"open","n":1},
                           {"country":"US","status":"paid","n":2}]
```

Five rows, one per existing combination. No country totals, no grand total.

## `GROUPING SETS`: ask for each level explicitly

```sql
GROUP BY GROUPING SETS ((c.country, o.status), (c.country), ())
```

```console
GROUPING SETS           : [{"country":"GB","status":"cancelled","n":1},
                           {"country":"GB","status":"open","n":1},
                           {"country":"GB","status":"paid","n":1},
                           {"country":"GB","status":null,"n":3},
                           {"country":"IN","status":"open","n":1},
                           {"country":"IN","status":null,"n":1},
                           {"country":"US","status":"paid","n":2},
                           {"country":"US","status":null,"n":2},
                           {"country":null,"status":null,"n":6}]
```

Nine rows: the original five, plus a per-country subtotal for each of the three countries,
plus one grand total. **`()` is the empty grouping set** — group by nothing, i.e. the whole
table — and it is how you ask for the grand-total row.

The subtotal rows are identified by `NULL` in the columns not being grouped by. `GB` with
`status: null` and `n: 3` is *"all GB orders"*, not *"GB orders with no status"*. That
ambiguity is real and is the subject of [the next chunk](02-grouping-and-labels.md).

## `ROLLUP`: the hierarchy shorthand

```sql
GROUP BY ROLLUP (c.country, o.status)
```

```console
ROLLUP is the same thing: [ ... identical nine rows ... ]
```

`ROLLUP (a, b)` expands to `GROUPING SETS ((a, b), (a), ())` — progressively dropping
columns from the **right**. It is the right shape when the columns form a hierarchy:
country → status, year → month → day, region → store. `ROLLUP (a, b, c)` gives four sets.

## `CUBE`: every combination

```sql
GROUP BY CUBE (c.country, o.status)
```

```console
CUBE adds every combination: [ ... the nine ROLLUP rows, plus ... 
                           {"country":null,"status":"cancelled","n":1},
                           {"country":null,"status":"open","n":2},
                           {"country":null,"status":"paid","n":3},
                           {"country":null,"status":null,"n":6}]
```

`CUBE (a, b)` is `GROUPING SETS ((a,b), (a), (b), ())` — all four subsets. The extra rows
here are the per-*status* totals across all countries, which `ROLLUP` does not produce
because status is not a prefix of the hierarchy.

**`CUBE` over n columns produces 2ⁿ grouping sets.** That growth is the thing to keep in
mind: three columns is 8, four is 16, five is 32.

```console
row counts              : [{"plain":5,"rollup":9,"cube":12}]
```

Measured on this fixture, and confirmed at three columns:

```console
=== A. how many grouping sets does each form produce? ===
GROUP BY a, b, c (1 set)                 result rows = 160
GROUPING SETS ((a),(b),(c)) (3 sets)     result rows = 18
ROLLUP (a,b,c) (4 sets)                  result rows = 205
CUBE (a,b,c) (8 sets)                    result rows = 275
```

| Form | Sets over n columns | Use for |
|---|---|---|
| `GROUPING SETS (...)` | exactly what you list | arbitrary combinations |
| `ROLLUP (a, b, c)` | n + 1 | a hierarchy, subtotals down one path |
| `CUBE (a, b, c)` | 2ⁿ | cross-tabulation on every axis |

## One scan — and why that is not the same as faster

The plan really does read the table once:

```console
=== D. the plan — one scan feeding a MixedAggregate ===
  MixedAggregate (actual rows=275.00 loops=1)
  Hash Key: kind, (user_id % 10), (amount % 3)
  Hash Key: kind, (user_id % 10)
  Hash Key: kind
  Hash Key: (user_id % 10), (amount % 3)
  Hash Key: (user_id % 10)
  Hash Key: (amount % 3), kind
  Hash Key: (amount % 3)
  Group Key: ()
  Batches: 1  Memory Usage: 1089kB
  ->  Seq Scan on agg_events (actual rows=500000.00 loops=1)
```

Eight `Hash Key` lines — one per grouping set — over a single `Seq Scan`. `MixedAggregate`
is the node that maintains several hash tables at once from one pass.

That looks decisive, and the like-for-like measurement says otherwise:

```console
=== B. like for like — the SAME three sets, one scan vs three scans ===
GROUPING SETS, 3 sets, one scan : 293.67 ms   buffers=3790
three separate GROUP BYs        : 57.02 + 56.47 + 56.72 = 170.22 ms
  buffers for ONE of them       : 3810 (x3 scans)
  verdict: 0.58x — one scan LOSES
```

**Three separate queries, reading the table three times, beat the single-scan version by
1.7×.** The reason is in the plans:

```console
=== E. why: the plain GROUP BY parallelises and the grouping-set version does not ===

  -- ONE separate GROUP BY
    Finalize GroupAggregate (actual rows=4.00 loops=1)
    ->  Gather Merge (actual rows=12.00 loops=1)
    Workers Planned: 2
    Workers Launched: 2
    ->  Partial HashAggregate (actual rows=4.00 loops=3)
    ->  Parallel Seq Scan on agg_events (actual rows=166666.67 loops=3)

  -- GROUPING SETS, the same three sets
    HashAggregate (actual rows=18.00 loops=1)
    Hash Key: kind
    Hash Key: (user_id % 10)
    Hash Key: (amount % 3)
    ->  Seq Scan on agg_events (actual rows=500000.00 loops=1)
```

**Grouping sets are not parallelised.** The plain `GROUP BY` gets `Gather Merge` and two
workers over a `Parallel Seq Scan`; the grouping-set version is a single serial scan. Three
scans across three processes finish sooner than one scan in one process.

Note also that every buffer here is a **shared hit** — the table is in cache, so this is a
CPU comparison, not an I/O one. On a table that does not fit in memory, where each scan is
real disk reads, the single-scan version would look much better. **The "one pass" advantage
is real when I/O dominates and can be entirely eaten by parallelism when it does not.**

### And do not compare `CUBE` against three queries

```console
=== C. now CUBE, which is doing 8 sets not 3 ===
CUBE (8 sets)                   : 749.70 ms
  per grouping set              : 93.71 ms
  vs GROUPING SETS per set      : 97.89 ms
  vs separate GROUP BY per set  : 56.74 ms
  ^ comparing CUBE against 3 separate GROUP BYs is comparing 8 answers to 3
```

`CUBE (a, b, c)` at 749.70 ms against three separate `GROUP BY`s at 170.22 ms looks like a
4.4× penalty, and it is not a like-for-like comparison at all: `CUBE` computed **eight**
aggregations, the three queries computed three. Per grouping set the gap is 93.71 ms versus
56.74 ms — still a real cost, and a much smaller story than the raw totals suggest.

**Ask for the sets you need.** Most reports that reach for `CUBE` want three or four of its
sets, and `GROUPING SETS` listing exactly those is both cheaper and clearer.

## In Node

```js
const {rows} = await pool.query(
  `SELECT c.country, o.status, count(*)::int AS n,
          GROUPING(c.country, o.status) AS lvl
   FROM agg_orders o
   JOIN agg_customers c ON c.id = o.customer_id
   WHERE o.placed_at >= $1
   GROUP BY ROLLUP (c.country, o.status)
   ORDER BY c.country NULLS LAST, o.status NULLS LAST`,
  [since],
);
```

- **`ORDER BY ... NULLS LAST`**, so subtotal rows sort below their detail rows instead of
  above. Without it the grand total can land first and a naive renderer puts it at the top
  of the table.
- **Return `GROUPING(...)`** so the client can tell a subtotal from a data `NULL` — see
  [the next chunk](02-grouping-and-labels.md).
- **The result mixes granularities in one array.** The client must branch on the level; if
  that is awkward, splitting into separate queries is a legitimate choice, and on a cached
  table it measured faster anyway.
- **Filter before aggregating.** The `WHERE` applies once, to the single scan, and reduces
  every grouping set at the same time.

## Trade-off

`GROUPING SETS` and its shorthands turn a multi-level report into one statement with one
filter and one round trip, and the plan genuinely reads the table once. Against that: the
result set mixes granularities so the client has to branch, subtotal rows are marked only
by `NULL`s, the set count explodes as 2ⁿ under `CUBE`, and — measured here — the single scan
is **not** parallelised, so on a cached table three ordinary `GROUP BY`s finished in 58% of
the time. Reach for it when the levels genuinely belong to one report and the table is large
enough that scanning it repeatedly is the dominant cost; otherwise separate queries are
simpler and, on this hardware, faster.

## Gotchas

**Symptom:** `GROUPING SETS` was expected to be faster than several `GROUP BY`s and is slower
**Cause:** grouping sets are not parallelised, while a plain `GROUP BY` gets a parallel plan.
Measured: 293.67 ms for one scan versus 170.22 ms for three parallel ones, on a
fully-cached table
**Fix:** benchmark both on your data. The single scan wins when I/O dominates, not when CPU
does

**Symptom:** a `CUBE` report takes far longer than expected
**Cause:** `CUBE` over n columns computes 2ⁿ grouping sets — 8 for three columns, 16 for
four
**Fix:** list the sets you actually need with `GROUPING SETS`

**Symptom:** a benchmark shows `CUBE` several times slower than N separate queries
**Cause:** the comparison counts different numbers of answers. Measured: 749.70 ms for 8
sets versus 170.22 ms for 3
**Fix:** compare per grouping set — 93.71 ms versus 56.74 ms — or compare the same sets

**Symptom:** the grand total row appears at the top of the report
**Cause:** `NULL`s sort first by default in ascending order
**Fix:** `ORDER BY col NULLS LAST` on every grouping column

**Symptom:** `ROLLUP` does not produce the per-status totals the report needs
**Cause:** `ROLLUP` drops columns from the right only, so it produces subtotals down one
hierarchy
**Fix:** `CUBE`, or `GROUPING SETS` listing the combinations required

## Interview questions

**★ What do `ROLLUP (a, b)` and `CUBE (a, b)` expand to?**
`ROLLUP` is `GROUPING SETS ((a,b), (a), ())` — dropping columns from the right, for a
hierarchy. `CUBE` is `GROUPING SETS ((a,b), (a), (b), ())` — every subset. Measured on the
fixture: 5 rows plain, 9 with `ROLLUP`, 12 with `CUBE`.

**★ How many grouping sets does `CUBE` over four columns produce?**
2⁴ = 16. Measured at three columns: 8 sets, 275 result rows, and 749.70 ms against 170.22 ms
for three single-column `GROUP BY`s — which is 8 answers against 3.

**★ Is one scan with `GROUPING SETS` faster than several `GROUP BY` queries?**
Not necessarily, and here it was not. Measured like-for-like on the same three sets:
293.67 ms for the single scan versus 170.22 ms for three separate queries — the single scan
lost by 1.7×, because grouping sets are not parallelised while a plain `GROUP BY` gets two
workers. On a table too large to cache, where I/O dominates, the single scan should win.

**★ What is the `()` in a grouping set list?**
The empty grouping set — group by nothing, which produces the grand-total row over the whole
filtered table.

**How do you spot a grouping-set plan?**
`MixedAggregate` (or `GroupAggregate`/`HashAggregate` with several `Hash Key` lines), one
per grouping set, over a single scan.

---

← [Topic index](README.md) · Next → [GROUPING and labelling subtotals](02-grouping-and-labels.md)
