---
title: "count variants"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex36-aggregation.mjs`,
> `sandbox/pg-api/ex36b-agg-plans.mjs`, `sandbox/pg-api/ex36d-count-having.mjs`.

**`count(*)`, `count(col)` and `count(DISTINCT col)` answer three different questions,
and the SQL for them differs by a few characters. That is the whole problem: the wrong
one is never a syntax error, it is a number that looks fine. On the fixture the three
return 6, 5 and 2 over the same six rows.**

Three chunks. The first is what each one means. The second is the `LEFT JOIN` trap and
its bigger sibling, join fan-out — where counting goes wrong most often in real
applications. The third is what each one costs, where `count(DISTINCT)` measured
**3.6× slower** than an equivalent rewrite, and why the ranking flips completely once
an index exists.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Three different questions](01-three-questions.md)** | what each form counts, `NULL` handling, the `count(1)` folklore measured, and counting pairs of columns |
| 02 | **[The LEFT JOIN trap and fan-out](02-left-join-and-fan-out.md)** | why an empty group counts 1, how a join inflates `sum()` while `count(DISTINCT)` survives, and the shape that is actually correct |
| 03 | **[What counting costs](03-what-counting-costs.md)** | 27 ms to 209 ms over the same table, why `count(DISTINCT)` cannot go parallel, the rewrite, and the index that makes the rewrite pointless |

## The short version

| Form | Counts | On the fixture |
|---|---|---|
| `count(*)` | rows | **6** |
| `count(total)` | rows where `total IS NOT NULL` | **5** |
| `count(DISTINCT coupon)` | distinct non-`NULL` values | **2** |
| `count(DISTINCT (a, b))` | distinct *pairs*, `NULL`s included | **4** |

```console
on the small table : [{"star":6,"total_nonnull":5,"coupon_nonnull":3,"coupons":2,"statuses":3}]
  count(*) counts rows; count(col) counts non-NULL; count(DISTINCT col) ignores NULL too
```

## Phase gate

You are done with this topic when you can read `count(*)` inside a `LEFT JOIN` query
and immediately say whether it is a bug, and when you can predict which of
`count(DISTINCT x)` and `count(*) FROM (SELECT DISTINCT x)` will be faster on a given
table by asking one question about its indexes.

## Where this connects

- **[GROUP BY and aggregates](../group-by/)** — where the `NULL`-skipping rule comes from
- **[Counting for pagination](../pagination-counts/)** — when *not* to count at all
- **[FILTER](../filter-clause/)** — counting several conditions in one pass
- **[Fan-out and aggregates](../../phase-5-joins/01-inner-join/02-fan-out-and-aggregates.md)** —
  the join-side view of the same problem
- **[EXPLAIN](../../phase-10-indexes/03-explain.md)** — reading the plans in chunk 03

---

← [Phase index](../README.md) · Start → [Three different questions](01-three-questions.md)
