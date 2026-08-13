---
title: "Estimates and capped counts"
sidebar_label: "02 · Estimates and capped counts"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex37d-pagination-counts.mjs`.

**Between "no total" and "an exact total that costs a full scan" there are two useful
middles: the planner's own row estimate, which is free and was within 0.7% here, and an
exact count capped at a ceiling, which is 23× cheaper when there are many matches — and
buys nothing at all when there are few.**

## The planner already has a number

Every `EXPLAIN` carries an estimated row count, produced from statistics rather than from
reading the rows:

```console
=== C. the planner already has an estimate, for free ===
planner estimate        : 125833 vs actual 125000  (100.7%)
reltuples (whole table) : [{"reltuples":"500000","relpages":3790}]
```

**125 833 against a true 125 000 — 0.7% high, for zero row reads.** For a UI that renders
*"about 126 000 results"*, that is a completely adequate answer and it costs a plan, not a
scan.

```sql
EXPLAIN (FORMAT JSON) SELECT * FROM agg_events WHERE kind = 'purchase';
-- then read: QUERY PLAN -> [0] -> Plan -> "Plan Rows"
```

Two honest caveats:

- **The accuracy is not guaranteed.** It was 0.7% out here on a single-column equality
  filter with fresh statistics. Multi-column filters, correlated columns and stale
  statistics all make it worse — sometimes by orders of magnitude. The joins and index
  phases show estimates going badly wrong; this is the friendly case.
- **It depends on `ANALYZE`.** The estimate is only as current as the statistics behind it,
  which is why `CREATE STATISTICS` exists for correlated columns
  ([phase 10](../../phase-10-indexes/16-statistics.md)).

`reltuples` in `pg_class` is the same idea for a whole table with no filter — a free,
possibly stale row count maintained by `VACUUM` and `ANALYZE`. Use it for *"this table has
roughly 500 000 rows"*, never for anything a user might reconcile against.

## Exact up to a cap

The hybrid: count exactly, but stop at a ceiling and report *"1000+"* beyond it. The
subquery's `LIMIT` is what bounds the work.

```sql
SELECT count(*)::int AS n, count(*) = 1000 AS capped
FROM (SELECT 1 FROM agg_events WHERE kind = 'purchase' LIMIT 1000) s;
```

```console
=== D. exact up to a cap — BOTH branches ===
common filter (kind=purchase)      [{"n":1000,"capped":true}]  capped-scan 1.46 ms vs exact 33.85 ms
the ex37 "rare" filter             [{"n":1000,"capped":true}]  capped-scan 26.96 ms vs exact 31.37 ms
  ^ both capped: that second filter matches far more than 1000 rows
  how many, really     : [{"n":2264}]
genuinely rare (amount = 909)      [{"n":120,"capped":false}]  capped-scan 3.01 ms vs exact 3.02 ms
  ^ under the cap: capped=false, and n is an exact count
```

Three cases, and the third is the one that changes how you think about this:

| Matches | `n` | `capped` | Capped scan | Exact | Saving |
|---|---|---|---|---|---|
| 125 000 | 1000 | `true` | **1.46 ms** | 33.85 ms | **23×** |
| 2 264 | 1000 | `true` | 26.96 ms | 31.37 ms | 1.2× |
| 120 | **120** | **`false`** | 3.01 ms | 3.02 ms | **none** |

**The cap only pays when matches are plentiful**, because then it stops after 1000 rows and
the other 124 000 are never touched. When matches are rare the scan has to look everywhere
to find them, cap or no cap — 3.01 ms against 3.02 ms is the same query doing the same
work. And in between, at 2 264 matches, the saving is already down to 1.2×.

This is the opposite of most people's intuition, which expects the trick to help most on
the "hard" queries. It helps most on the *easy* ones — and those are exactly the ones where
an exact total is least meaningful to a human anyway.

> **A measurement note.** The original script used `kind='refund' AND amount > 890` as its
> "rare" filter and reported both branches as `capped: true`, so the uncapped case was
> never demonstrated. That filter matches **2 264** rows — well over the cap. Checking what
> a filter actually matches before calling it rare is the difference between a
> demonstration and a decoration.

## Choosing between the four

| The product needs | Use | Cost |
|---|---|---|
| A *Next* button | `limit + 1` | free, exact |
| "About 126 000 results" | planner estimate | free, ~1% here, no guarantee |
| "1000+ results" | capped count | 23× cheaper *when matches are plentiful* |
| "Page 1 of 6 250" | exact `count(*)` | full pass over matching rows |

Work down that list, not up it. The exact count is the last resort, and it is worth pushing
back on a numbered pager for a large collection — it is the only requirement in the table
that cannot be served cheaply, and users rarely navigate to page 4 000 of anything.

## In Node

```js
// "1000+" style: one query, bounded work.
const CAP = 1000;
const {rows: [{n, capped}]} = await pool.query(
  `SELECT count(*)::int AS n, count(*) = $2 AS capped
   FROM (SELECT 1 FROM agg_events WHERE kind = $1 LIMIT $2) s`,
  [kind, CAP],
);

res.json({total: n, totalIsCapped: capped});   // client renders "1000+" when capped
```

```js
// Estimate: read the planner's number without running the query.
const sql = `SELECT * FROM agg_events WHERE kind = $1`;
const {rows} = await pool.query(`EXPLAIN (FORMAT JSON) ${sql}`, [kind]);
const estimate = rows[0]['QUERY PLAN'][0].Plan['Plan Rows'];
```

- **`EXPLAIN` accepts parameters**, so the estimate is measured for the actual filter
  without concatenating anything. Prefix your own SQL only — never user input.
- **Tell the client the number is capped or estimated.** A `total` field that is sometimes
  exact, sometimes a ceiling and sometimes a guess, with no flag, is worse than no total —
  `totalIsCapped` and `totalIsEstimate` cost nothing and stop the number being trusted more
  than it deserves.
- **`count(*) = $2` reuses the cap parameter**, so the cap lives in one place and the
  `capped` flag cannot drift from the `LIMIT`.

## Trade-off

Estimates and caps both buy speed by giving up exactness, and both are honest choices — as
long as the response says which one it is. The estimate is free and unbounded in error; the
cap is exact below the ceiling and silent above it, and it only saves time when matches are
plentiful, which is the case where the number was least useful to begin with. The real
decision is upstream of all of this: whether the interface needs a total at all, or whether
it needs a *Next* button that costs nothing.

## Gotchas

**Symptom:** the capped-count trick did not speed anything up
**Cause:** the filter matches fewer rows than the cap, so the scan still has to look
everywhere. Measured: 3.01 ms capped versus 3.02 ms exact for 120 matching rows
**Fix:** none needed — just do not expect a saving. The cap pays only when matches are
plentiful

**Symptom:** a filter described as "rare" behaves like a common one
**Cause:** nobody checked what it actually matches. Measured: `kind='refund' AND amount >
890` matches 2 264 rows, not a handful
**Fix:** count it once before designing around its selectivity

**Symptom:** the planner estimate is wildly wrong for some filters
**Cause:** correlated columns or stale statistics; a single-column equality filter is the
friendly case
**Fix:** `ANALYZE`, and `CREATE STATISTICS` for correlated columns. Never present an
estimate as exact

**Symptom:** users report the total changing between page loads
**Cause:** an estimate or a stale `reltuples` is being rendered as an exact figure
**Fix:** label it — "about 126 000" — or pay for the exact count

**Symptom:** `reltuples` is far from the real row count
**Cause:** it is maintained by `VACUUM`/`ANALYZE` and is stale between them
**Fix:** treat it as an order of magnitude only

## Interview questions

**★ How do you show a result count without scanning the table?**
Read the planner's estimate from `EXPLAIN (FORMAT JSON)` — `Plan Rows`. Measured: 125 833
against a true 125 000, 0.7% high, for zero row reads. Label it as approximate, because the
error is unbounded for correlated or stale-statistics cases.

**★ How does an "exact up to a cap" count work, and when does it pay?**
Count inside a subquery with a `LIMIT`: below the cap you get an exact number, at the cap
you report "1000+". It pays when matches are plentiful — 1.46 ms versus 33.85 ms with
125 000 matches, 23×. With 120 matches it measured 3.01 ms versus 3.02 ms: no saving at all,
because the scan must look everywhere to find them.

**★ Why does the capped count save nothing on a rare filter?**
The `LIMIT` can only stop the scan early if there are enough matching rows to reach it. If
there are 120, the executor visits everything looking for them and the cap never engages.

**★ What is `reltuples`, and what is it good for?**
An approximate row count for a whole table, kept in `pg_class` and refreshed by
`VACUUM`/`ANALYZE`. Good for "roughly how big is this table"; not for anything a user might
reconcile against, since it is stale between maintenance runs.

**Your API returns `total`. What should the response also carry?**
Whether that total is exact, capped, or estimated. A field that silently changes meaning is
trusted more than it deserves, and a flag costs nothing.

---

← [What "total" costs](01-what-total-costs.md) · Next topic → [Ordered-set aggregates](../ordered-set/)
