---
title: "Multicolumn indexes and column order"
sidebar_label: "06 · Multicolumn"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex24-index-not-used.mjs`.

**An index on `(a, b)` is sorted by `a` first, so it serves `a` alone and `a` with `b`,
but not `b` alone — the leftmost-prefix rule. PostgreSQL 18 softens this with skip scan,
but only when the leading column has very few distinct values.**

## The leftmost-prefix rule

400 000 rows, single index `m_orders (user_id, state)`. `user_id` has 5000 distinct
values, `state` has 4:

```console
$ node ex24-index-not-used.mjs
=== 6. multicolumn index — column order ===
both columns         Bitmap Heap Scan on m_orders                 → 0.098 ms
leading column only  Bitmap Heap Scan on m_orders                 → 0.226 ms
SECOND column only   Seq Scan on m_orders                         → 56.913 ms
ORDER BY (a, b)      ->  Index Scan using m_orders_ab on m_orders → 0.110 ms
ORDER BY (b, a)      ->  Parallel Seq Scan on m_orders            → 62.717 ms
```

- `WHERE user_id = 42 AND state = 'paid'` — the full key. 0.098 ms.
- `WHERE user_id = 42` — a **prefix** of the key. Still 0.226 ms.
- `WHERE state = 'paid'` — skips the leading column. **Seq scan, 580× slower.**
- `ORDER BY user_id, state` matches the index order exactly. `ORDER BY state, user_id`
  does not, so it sorts the whole table.

Think of a phone book sorted by (surname, first name). Finding "Patel" is fast; finding
"everyone named Anjali" is not.

## PostgreSQL 18: skip scan

PostgreSQL 18 can *skip* through the leading column's distinct values instead of giving
up — but only when there are few enough of them to make that worthwhile. With **only** a
`(state, user_id)` index and a query filtering `user_id`:

```console
-- PG 18 skip scan: ONLY a (state, user_id) index, query filters user_id --
Bitmap Heap Scan on m_orders (actual time=0.329..0.443 rows=80.00 loops=1)
  Recheck Cond: (user_id = 42)
  ->  Bitmap Index Scan on m_orders_ba_probe (actual time=0.301..0.301 rows=80.00 loops=1)
        Index Cond: (user_id = 42)
        Index Searches: 7
Execution Time: 0.511 ms
```

**`Index Searches: 7`** is the tell — the executor probed the index once per distinct
leading value instead of once overall, and got the answer in 0.511 ms rather than
seq-scanning.

Contrast with the first measurement above, where the leading column (`user_id`) had 5000
distinct values: there the planner did *not* attempt a skip scan and chose a sequential
scan. **Skip scan is a safety net for low-cardinality leading columns, not a licence to
stop thinking about column order.**

## Equality first, range second

The rule that matters in practice. Query: `user_id = 42 AND created_at > …
ORDER BY created_at DESC LIMIT 20`.

```console
=== 7. (equality, range) is the right order — not the other way round ===
(user_id, created_at) ->  Index Scan Backward using m_ord_eq_range → 0.119 ms | hit=20 read=3
(created_at, user_id) ->  Index Scan Backward using m_ord_range_eq → 6.987 ms | hit=29 read=367
```

Both indexes get used. One reads **23 buffers, the other 396** — 17× the work, 59× the
time.

With `(user_id, created_at)` the equality pins a single position and the range walks a
contiguous run from there, already in `created_at` order. With `(created_at, user_id)`
the range is the leading column, so every entry in the time window must be visited and
filtered on `user_id`.

**Order the columns: equality predicates first, then the one range or sort column.**

## Two indexes are not better than one right one

```console
with BOTH (a,b) and (b,a) present, planner picks: Bitmap Heap Scan on m_orders → 0.156 ms
┌─────────┬───────────────┬───────────┬──────────┐
│ (index) │ name          │ size      │ idx_scan │
├─────────┼───────────────┼───────────┼──────────┤
│ 0       │ 'm_orders_ab' │ '2704 kB' │ '0'      │
│ 1       │ 'm_orders_ba' │ '2704 kB' │ '0'      │
└─────────┴───────────────┴───────────┴──────────┘
```

Adding the mirror index bought nothing for this query and doubled the write cost. See
[Unused and duplicate indexes](13-unused-indexes.md).

## In SQL

```sql
CREATE INDEX m_orders_ab ON m_orders (user_id, state);

-- equality, then range/sort
CREATE INDEX ON orders (user_id, created_at DESC);

-- mixed sort directions need a matching index
CREATE INDEX ON orders (user_id, created_at DESC, id ASC);
```

An index on `(a, b, c)` serves `(a)`, `(a, b)` and `(a, b, c)` — so three separate
single-column indexes are usually the wrong shape, and one well-ordered composite is the
right one.

## From Node

The composite index exists to serve one query shape. Write the query first, then the
index for it:

```js
// list one user's recent orders — the canonical (equality, range) shape
const {rows} = await pool.query(
  `SELECT id, state, created_at FROM m_orders
   WHERE user_id = $1 AND created_at > now() - interval '2 days'
   ORDER BY created_at DESC LIMIT $2`, [userId, 20]);
```

```sql
-- the migration that makes it 0.119 ms instead of 6.987 ms
CREATE INDEX m_ord_eq_range ON m_orders (user_id, created_at);
```

Keyset pagination has the same requirement — the index must match
`(filter columns…, sort column, tiebreaker)` exactly. See
[LIMIT and OFFSET](../phase-4-crud/03-limit-offset.md).

## Trade-off

**A composite index is narrower in what it serves and wider in what it costs.** It is
larger than a single-column index on the same table, it only helps queries that use a
leftmost prefix, and it becomes dead weight the moment the query shape changes.

The counter-argument for one composite over several singles: PostgreSQL can combine
single-column indexes with a `BitmapAnd`, but that costs two index scans and a bitmap
merge, and cannot provide sort order. When one query dominates, index for that query.

PostgreSQL 18's skip scan lowers the penalty for getting the order wrong on a
low-cardinality leading column — it does not remove it, and it does nothing for the
5000-value case measured above.

## Gotchas

**Symptom:** Index on `(a, b)` unused by a query filtering only `b`
**Cause:** Leftmost-prefix rule
**Fix:** Reorder to `(b, a)` if that query matters more, or add an index on `(b)`

**Symptom:** Skip scan works in one place and not another
**Cause:** It is chosen by cost — viable with 4 distinct leading values, not with 5000
**Fix:** Do not rely on it; put the selective column first

**Symptom:** The index is used but the query is still slow
**Cause:** Range column before equality column — measured 396 buffers versus 23
**Fix:** `(equality…, range)` order

**Symptom:** `ORDER BY a, b DESC` still shows a `Sort` node
**Cause:** The index is `(a, b)` ascending
**Fix:** `CREATE INDEX ON t (a, b DESC)`

**Symptom:** Both `(a,b)` and `(b,a)` exist
**Cause:** Someone indexed defensively
**Fix:** Check `idx_scan` for each and drop the one at zero

## Interview questions

**★ What is the leftmost-prefix rule?**
An index on `(a, b, c)` is sorted by `a`, then `b`, then `c`, so it can serve any leading
prefix — `(a)`, `(a,b)`, `(a,b,c)` — but not `(b)` or `(c)` alone. Measured: 0.226 ms on
the leading column, 56.9 ms on the second alone.

**★ How do you order columns in a composite index?**
Equality predicates first, then the range or sort column. Measured: `(user_id,
created_at)` used 23 buffers where `(created_at, user_id)` used 396 for the same query.

**★ Does PostgreSQL 18 remove the leftmost-prefix rule?**
No. Skip scan lets it probe once per distinct leading value, shown by `Index Searches: 7`
in the plan, and it is only chosen when the leading column has few distinct values.

**Is one composite index or several single-column indexes better?**
Usually one composite matching the dominant query. PostgreSQL can `BitmapAnd` several
single-column indexes, but that costs extra scans and provides no ordering.

**Do you need `(a,b)` and `(b,a)`?**
Almost never. Measured, adding the mirror gained nothing and doubled the write cost.

---

← [Why an index is not used](05-index-not-used.md) · Next → [EXPLAIN ANALYZE BUFFERS](07-explain-buffers.md)
