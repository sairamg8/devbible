---
title: "GROUPING and labelling subtotals"
sidebar_label: "02 · GROUPING and labels"
sidebar_position: 2
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37-cte-subquery.mjs`.

**A subtotal row marks its rolled-up columns with `NULL`. So does a row whose data is
genuinely `NULL`. Those two rows are indistinguishable in the output, and on any nullable
column that is a live reporting bug — the `GROUPING()` function is the only thing that
tells them apart.**

## The collision

Add a customer whose country is `NULL` and one order for them, then roll up by country:

```sql
SELECT c.country, count(*)::int AS n,
       GROUPING(c.country) AS is_subtotal,
       CASE WHEN GROUPING(c.country) = 1 THEN 'ALL'
            ELSE coalesce(c.country, '(none)') END AS label
FROM agg_orders o JOIN agg_customers c ON c.id = o.customer_id
GROUP BY ROLLUP (c.country)
ORDER BY is_subtotal, c.country NULLS LAST;
```

```console
telling a subtotal NULL from a data NULL:
   [{"country":"GB","n":3,"is_subtotal":0,"label":"GB"},
    {"country":"IN","n":1,"is_subtotal":0,"label":"IN"},
    {"country":"US","n":2,"is_subtotal":0,"label":"US"},
    {"country":null,"n":1,"is_subtotal":0,"label":"(none)"},
    {"country":null,"n":7,"is_subtotal":1,"label":"ALL"}]
```

**Two rows have `country: null`, and they mean completely different things.**

| Row | `country` | `n` | `is_subtotal` | Means |
|---|---|---|---|---|
| 4th | `null` | 1 | **0** | one order from a customer with **no country recorded** |
| 5th | `null` | 7 | **1** | the **grand total** across all countries |

Without `GROUPING()` there is no way to tell them apart from the result set alone. A report
renderer that treats every `NULL` country as the total row would show 1 instead of 7; one
that treats every `NULL` as "unknown country" would show a bogus 7-order "unknown" bucket
that also double-counts everything.

**And the failure only appears once a `NULL` exists in the data**, which is why it survives
development. This is the same shape of latent bug as
[the `NOT IN` trap](../11-subqueries/03-in-exists-and-not-in.md): correct until one null shows
up, then silently wrong.

## `GROUPING()`

`GROUPING(col)` returns **1 if that column was rolled up in this row**, 0 if it is a real
grouping value. It is the only reliable discriminator.

With several columns it returns a bit mask, most significant bit first:

```sql
GROUPING(country, status)   -- 0 = both grouped, 1 = status rolled up,
                            -- 2 = country rolled up, 3 = both (grand total)
```

That single integer identifies which grouping set produced the row, which is exactly what a
client needs to decide how to render it. Returning it is cheaper and clearer than
reconstructing the level from which columns happen to be null.

### It only works on grouped columns

```console
GROUPING on a column not in any grouping set ->  42803 arguments to GROUPING must be grouping expressions of the associated query level
```

`GROUPING(total)` where the query groups by `status` is `42803`. The function reports
whether a *grouping* column was rolled up; a column that was never grouped has no such
state. The fix is to pass a column that appears in the `GROUP BY`.

## Labelling for the client

The `CASE` in the query above is the pattern worth copying:

```sql
CASE WHEN GROUPING(c.country) = 1 THEN 'ALL'
     ELSE coalesce(c.country, '(none)') END AS label
```

It resolves both meanings in one column: `ALL` for the subtotal, `(none)` for a real
missing value, and the country itself otherwise. Doing this in SQL rather than in the client
means the distinction is made where the information exists, and cannot be lost by a
`?? 'Unknown'` somewhere in the rendering code.

The same applies to sorting:

```sql
ORDER BY is_subtotal, c.country NULLS LAST
```

Ordering by `GROUPING()` first puts every detail row above the totals, whatever the
countries are called. Ordering by the column alone puts `NULL`s first by default in
ascending order — so the grand total lands at the top of the report, above the rows it
totals.

## In Node

```js
const {rows} = await pool.query(
  `SELECT c.country,
          o.status,
          count(*)::int  AS n,
          GROUPING(c.country, o.status) AS level
   FROM agg_orders o
   JOIN agg_customers c ON c.id = o.customer_id
   GROUP BY ROLLUP (c.country, o.status)
   ORDER BY GROUPING(c.country), c.country NULLS LAST,
            GROUPING(o.status),  o.status  NULLS LAST`,
);

const LEVEL = {0: 'detail', 1: 'countryTotal', 3: 'grandTotal'};

const shaped = rows.map((r) => ({
  ...r,
  kind: LEVEL[r.level],
  country: r.level >= 2 ? 'ALL' : (r.country ?? '(none)'),
  status:  r.level % 2 === 1 ? 'ALL' : (r.status ?? '(none)'),
}));
```

- **`GROUPING(a, b)` as one `level` column** is the compact form — one integer per row that
  says which grouping set produced it, rather than the client guessing from nulls.
- **`r.country ?? '(none)'` is only safe once `level` has been consulted.** Applying it
  first would relabel the grand total as `(none)`, which is exactly the bug this page is
  about.
- **`ROLLUP (a, b)` produces levels 0, 1 and 3** — never 2, since it drops columns from the
  right only. Level 2 appears with `CUBE` or an explicit `GROUPING SETS` containing `(b)`.
- **Sort by `GROUPING()` before the column**, so totals land under their details regardless
  of the values.

## Trade-off

`GROUPING()` costs one small integer column and removes the only genuine ambiguity in a
grouping-sets result. There is no real argument against including it. The cost is upstream:
you are choosing a result set that mixes granularities, so the client must branch on the
level for both labelling and sorting, and that branching is easy to get subtly wrong. If a
report has only two levels and the client code is getting convoluted, two queries and no
`GROUPING()` is a perfectly good answer — and on a cached table it measured faster
([previous chunk](01-sets-rollup-cube.md)).

## Gotchas

**Symptom:** a report shows an "unknown" bucket whose count equals the grand total
**Cause:** subtotal rows and rows with a genuinely `NULL` grouping value are both `NULL`, and
the client treated them alike. Measured: two rows with `country: null`, one meaning 1 order
with no country and one meaning all 7
**Fix:** return `GROUPING(col)` and branch on it

**Symptom:** the bug appeared only after a nullable column acquired its first `NULL`
**Cause:** with no data nulls, every `NULL` in a grouping column really is a subtotal
**Fix:** add a null to the test fixture deliberately, and assert on the labels

**Symptom:** `42803 arguments to GROUPING must be grouping expressions of the associated query level`
**Cause:** `GROUPING()` was applied to a column not in the `GROUP BY`
**Fix:** pass a grouping column; the function has no meaning for anything else

**Symptom:** the grand total appears at the top of the table
**Cause:** `NULL`s sort first in ascending order
**Fix:** `ORDER BY GROUPING(col), col NULLS LAST`

**Symptom:** a `coalesce(country, 'Unknown')` relabelled the total row
**Cause:** `coalesce` was applied before the level was consulted
**Fix:** branch on `GROUPING()` first, and only then default the real nulls

**Symptom:** `GROUPING(a, b)` never returns 2 and the client's mapping has a hole
**Cause:** `ROLLUP` drops from the right only, so it produces 0, 1 and 3
**Fix:** expected — level 2 needs `CUBE` or an explicit set containing only `b`

## Interview questions

**★ How do you tell a subtotal row from a row whose grouping column is genuinely `NULL`?**
`GROUPING(col)` — 1 when the column was rolled up for that row, 0 when it is a real value.
Measured: two rows both showed `country: null`, one with `is_subtotal: 0` and `n: 1` (a
customer with no country) and one with `is_subtotal: 1` and `n: 7` (the grand total).

**★ What does `GROUPING()` return for several columns?**
A bit mask, most significant bit first — `GROUPING(country, status)` gives 0 for both
grouped, 1 when status is rolled up, 2 when country is, and 3 for the grand total. One
integer identifies the grouping set.

**★ Why is this bug invisible in development?**
It requires a `NULL` in a grouping column. Until one exists, every `NULL` in the result
really is a subtotal and the naive rendering is correct.

**★ Why does `GROUPING(total)` fail with `42803`?**
Because `total` is not a grouping column. `GROUPING()` reports whether a grouping expression
was rolled up, which is undefined for a column that was never grouped.

**How should a multi-level report be sorted?**
`ORDER BY GROUPING(col), col NULLS LAST` — by level first, so detail rows precede their
totals whatever the values are, and with `NULLS LAST` so nulls do not float to the top.

**Which `GROUPING` levels does `ROLLUP (a, b)` produce?**
0, 1 and 3 — never 2, because `ROLLUP` only drops columns from the right. Level 2 requires
`CUBE` or an explicit grouping set of `(b)` alone.

---

← [GROUPING SETS, ROLLUP and CUBE](01-sets-rollup-cube.md) · Next → [Phase index](../README.md)
