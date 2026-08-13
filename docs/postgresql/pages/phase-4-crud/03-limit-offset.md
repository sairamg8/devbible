---
title: "LIMIT and OFFSET"
sidebar_label: "03 · LIMIT / OFFSET"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex15-pagination.mjs`,
> `ex5-filter-sort.mjs`.

**`LIMIT` is cheap. `OFFSET` is not — the server produces and discards every row you
skipped, so page 25 000 costs 87× page 1. And without a unique tiebreaker in
`ORDER BY`, pages silently overlap.**

## `OFFSET` cost grows with depth

500 000 rows, primary key on `id`, `LIMIT 20` each time, median of five runs:

```console
$ node ex15-pagination.mjs
=== 1. SELECT ... ORDER BY id LIMIT 20 OFFSET n ===
OFFSET      0       1.22 ms
OFFSET   1000       1.35 ms
OFFSET  10000       3.76 ms
OFFSET 100000      23.21 ms
OFFSET 499980     105.85 ms
```

Twenty rows every time. The only thing that changed is how many rows were thrown away
first. The plan says so plainly:

```console
=== 2. EXPLAIN ANALYZE at OFFSET 499980 ===
  Limit (actual time=157.812..157.820 rows=20.00 loops=1)
    Buffers: shared hit=5045
    ->  Index Scan using p_rows_pkey on p_rows (actual time=0.039..129.268 rows=500000.00 loops=1)
```

**`rows=500000.00`** on the inner node against `rows=20.00` on the `Limit`. There is no
index trick that fixes this: `OFFSET n` is *defined* as "generate the rows in order,
then discard the first `n`". An index makes producing them cheap; it cannot make the
server skip counting them.

This is why deep pagination is a reliable way to make an endpoint slow, and why
`?page=50000` is a cheap denial-of-service against an unguarded list API.

## Keyset does the same job in constant time

```console
=== 3. keyset: WHERE id > $1 ORDER BY id LIMIT 20 ===
keyset at the same depth       0.93 ms  (after id=499980)
  Limit (actual time=0.019..0.027 rows=20.00 loops=1)
    Buffers: shared hit=4
    ->  Index Scan using p_rows_pkey on p_rows (actual time=0.018..0.024 rows=20.00 loops=1)
          Index Cond: (id > '499980'::bigint)
```

**105.85 ms → 0.93 ms**, and `Buffers: shared hit=5045 → 4`. Instead of discarding half
a million rows, the index seeks straight to the key you left off at. The last page costs
what the first page costs.

The mechanics — including what to do when the sort key is not unique — are
[Row constructors and keyset pagination](20-tuple-comparison.md) and
[Keyset pagination](../phase-9-api-crud/keyset/).

## `OFFSET` pages drift under concurrent writes

Even at shallow depth, `OFFSET` has a correctness problem. One row inserted between two
requests shifts every later page by one:

```console
=== 5. OFFSET drift under a concurrent write ===
page 1        : item 20, item 19, item 18, item 17, item 16
page 2 (after): item 16, item 15, item 14, item 13, item 12
repeated across the page boundary: item 16
```

`item 16` was served twice, and had the insert been a delete, one row would have been
skipped entirely — never shown on any page. This is not a race that is unlikely to
happen; on a feed ordered newest-first it happens whenever anything is created.

Keyset does not have the problem, because the cursor is a value, not a count:

```console
keyset page 2 : item 16, item 15, item 14, item 13, item 12
repeated with keyset: (none)
```

## Ties need a unique tiebreaker

`ORDER BY` on a non-unique column leaves the order among equal rows undefined, and
PostgreSQL is free to return them differently between executions. Paging over 100 rows
five at a time, ordered by a column with duplicates:

```console
$ node ex5-filter-sort.mjs
=== 10. ties + LIMIT/OFFSET without a tiebreaker ===
paging 0→100 by 5 without a tiebreaker: 54 distinct ids, 46 repeats
same, with ", id" as tiebreaker:        100 distinct ids, 0 repeats
```

**46 of 100 rows were duplicates and 46 were never shown at all** — on a static table
with no concurrent writes. Appending the primary key fixes it completely:

```sql
ORDER BY grp          LIMIT 5 OFFSET 40    -- ✗ undefined among equal grp
ORDER BY grp, id      LIMIT 5 OFFSET 40    -- ✓ total order
```

**Every paginated query needs a unique final sort key.** This is the same rule keyset
pagination depends on, and the reason [`ORDER BY`](10-order-by.md) matters more than it
looks.

## `LIMIT` without `ORDER BY` is not "the first rows"

There is no default order. Without `ORDER BY`, PostgreSQL returns rows in whatever order
the scan produced them, and an ordinary `UPDATE` is enough to change it:

```console
=== 6. LIMIT without ORDER BY ===
before update: 1,2,3,4,5
after  update: 2,3,4,5,6 ← ORDER CHANGED
```

Updating row 1 wrote a new tuple version at the end of the heap, so it fell out of the
first five. `LIMIT` without `ORDER BY` is only ever correct when you genuinely do not
care which rows you get — sampling, existence checks, `LIMIT 1` on a unique predicate.

## The `count(*)` that powers "page 1 of N"

Numbered pages need a total, and the total is its own scan:

```console
=== 4. cost of the total count ===
SELECT count(*)                   25.69 ms
planner estimate (reltuples)       0.49 ms  → 500000
```

`count(*)` cost more than the first 100 pages combined. PostgreSQL has no stored row
count — MVCC means visibility is per-transaction, so it must check each row
([MVCC](../phase-11-mvcc/)). Options, in order of preference:

```sql
-- exact, and you pay for it every request
SELECT count(*) FROM p_rows;
-- approximate, effectively free, good enough for "about 500,000 results"
SELECT reltuples::bigint FROM pg_class WHERE relname = 'p_rows';
-- "is there a next page?" — ask for one extra row instead of counting
SELECT ... LIMIT 21;   -- got 21? there is a next page. Serve 20.
```

The `LIMIT n+1` trick answers the only question most UIs actually ask, at no cost.

## From Node

```js
const PAGE_MAX = 100;
const limit  = Math.min(Number(req.query.limit) || 20, PAGE_MAX);
const offset = Math.max(Number(req.query.offset) || 0, 0);

const {rows} = await pool.query(
  `SELECT id, name FROM p_rows ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
  [limit + 1, offset],
);
const hasNext = rows.length > limit;
res.json({items: rows.slice(0, limit), hasNext});
```

Both values are parameters, both are clamped. `limit` and `offset` arrive as strings
from a query string, and `LIMIT 'abc'` is an error while `LIMIT $1` with a `NaN` is a
different error — validate before you reach SQL. An uncapped `limit` is the other easy
denial of service: `?limit=10000000` will genuinely try.

## Trade-off

`OFFSET` buys random access — page 7 without having seen pages 1–6 — which is what
numbered page controls and "jump to last page" require. It costs linear work in the
offset and pages that drift under writes.

Keyset buys constant-time pages that never drift, and costs random access: you can only
go forward and backward from where you are. Choose by the UI. Admin screens with
numbered pages over tens of thousands of rows are fine on `OFFSET`; an infinite-scroll
feed over millions is not.

## Gotchas

**Symptom:** A list endpoint is fast in testing and slow in production
**Cause:** Deep `OFFSET` — measured 1.22 ms at offset 0 against 105.85 ms at 499 980.
**Fix:** Keyset pagination, or cap how deep `OFFSET` may go.

**Symptom:** Users report seeing the same item twice while scrolling
**Cause:** Either `OFFSET` drift under concurrent inserts, or a non-unique `ORDER BY`.
**Fix:** Add a unique tiebreaker (`ORDER BY created_at DESC, id DESC`) and switch to
keyset for feeds.

**Symptom:** Some rows never appear on any page
**Cause:** The same two causes — a delete shifts pages backwards, or ties reshuffle.
Measured: 46 rows of 100 never appeared.
**Fix:** As above. This one is worse than duplicates because nobody reports it.

**Symptom:** `LIMIT 10` returns different rows on identical requests
**Cause:** No `ORDER BY`. Measured: an `UPDATE` to one row changed which rows came back.
**Fix:** Always `ORDER BY` when the identity of the rows matters.

**Symptom:** The list endpoint's `count(*)` dominates its latency
**Cause:** An exact total over a large table on every request — measured 25.69 ms
against 500 000 rows.
**Fix:** `LIMIT n+1` for a next-page flag, `reltuples` for an approximate total, or
cache the count.

**Symptom:** `?limit=10000000` hangs the API
**Cause:** An unclamped, user-supplied `LIMIT`.
**Fix:** `Math.min(requested, PAGE_MAX)` before the query.

**Symptom:** `OFFSET` with a negative number errors
**Cause:** `2201X ERROR: OFFSET must not be negative`.
**Fix:** Clamp at zero.

## Interview questions

**★ Why does `OFFSET 100000` get slower as the offset grows, even with an index?**
Because `OFFSET` is defined as producing the ordered rows and discarding the first `n`.
Measured on 500 000 rows: 1.22 ms at offset 0, 105.85 ms at 499 980, with `EXPLAIN`
showing `rows=500000` on the index scan feeding a `Limit` that returns 20. The index
makes generating rows cheap; nothing lets the server skip them.

**★ How does keyset pagination fix that, and what does it cost?**
It replaces "skip n rows" with "start after this key" — `WHERE id > $1 ORDER BY id
LIMIT 20` — so the index seeks directly to the position. Measured at the same depth:
0.93 ms against 105.85 ms, and 4 buffers against 5045. The cost is losing random
access: no jumping to page 500, only next and previous.

**★ Why can `OFFSET` pagination show the same row twice?**
The offset is a count, not a position. A row inserted before the current page between
two requests shifts everything down by one, so the row at the boundary is served on both
pages — measured, `item 16` appeared on page 1 and page 2. A delete does the reverse and
hides a row entirely.

**★ Why does every paginated query need a unique column in `ORDER BY`?**
Order among rows with equal sort keys is undefined and may differ between executions.
Measured over 100 rows paged 5 at a time on a duplicated column: 54 distinct ids and 46
repeats; adding `, id` gave 100 distinct and 0 repeats.

**Does `LIMIT` without `ORDER BY` return the first rows inserted?**
No — there is no default order. Measured, an `UPDATE` to one row changed which rows came
back, because the new tuple version was written at the end of the heap.

**How do you show "page 1 of N" without paying for `count(*)` every request?**
Usually you do not need N. `LIMIT n+1` tells you whether a next page exists for free. If
a total is genuinely required, `reltuples` from `pg_class` is an estimate that cost
0.49 ms against 25.69 ms for the exact count, or cache the exact value.

---

← [`WHERE` predicates](02-where-predicates.md) · Next → [`INSERT`](04-insert.md)
