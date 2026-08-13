---
title: "The tuple comparison"
sidebar_label: "01 · The tuple comparison"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex43-keyset-patch.mjs`.

**`OFFSET n` does not skip `n` rows — it produces them and throws them away.** The
fix is to describe the starting point by value instead of by position.

The measurements below use 500 000 events across 5000 distinct timestamps, so 100
rows share each `created_at` — the sort key is deliberately not unique, because
that is the case where this gets interesting.

```sql
CREATE INDEX k_events_created_id_idx ON k_events (created_at DESC, id DESC);
```

## What `OFFSET` costs at depth

```console
$ node ex43-keyset-patch.mjs
=== 6. OFFSET vs keyset at the same depth ===
OFFSET 499980    295.87 ms
keyset at same depth      1.23 ms
```

**240× apart for the same twenty rows.** The plans say why:

```console
OFFSET plan:
  Limit (actual rows=20.00 loops=1)
    Buffers: shared hit=501918
    ->  Index Only Scan using k_events_created_id_idx on k_events (actual rows=500000.00 loops=1)
          Heap Fetches: 500000
          Index Searches: 1
          Buffers: shared hit=501918
  Execution Time: 375.725 ms
```

`actual rows=500000` under a `Limit` of 20. The index scan produced every row from
the start of the index up to the offset, and `Limit` discarded 499 980 of them.
`Buffers: shared hit=501918` — half a million buffer accesses to return twenty
rows.

```console
keyset plan:
  Limit (actual rows=20.00 loops=1)
    Buffers: shared hit=23
    ->  Index Only Scan using k_events_created_id_idx on k_events (actual rows=20.00 loops=1)
          Index Cond: (ROW(created_at, id) < ROW('2026-01-01 00:00:00+00'::timestamp with time zone, 105000))
          Heap Fetches: 20
          Index Searches: 1
          Buffers: shared hit=23
  Execution Time: 0.150 ms
```

`actual rows=20` and **23 buffers instead of 501 918**. The `Index Cond` line is
the whole difference: the comparison is a *seek condition*, so the scan descends
the B-tree directly to the starting point and reads twenty entries.

The cost of `OFFSET` grows linearly with depth. The cost of keyset does not grow
at all — page 25 000 costs what page 1 costs.

## The query

```js
// first page — no cursor
const {rows} = await db.query(
  `SELECT id, created_at, title FROM k_events
    ORDER BY created_at DESC, id DESC
    LIMIT $1`, [PAGE]);

// every page after that
const {rows} = await db.query(
  `SELECT id, created_at, title FROM k_events
    WHERE (created_at, id) < ($1, $2)
    ORDER BY created_at DESC, id DESC
    LIMIT $3`, [cursor.createdAt, cursor.id, PAGE]);
```

The cursor is the sort key of the last row you returned — here `created_at` and
`id` — and the next page is everything that sorts after it.

Three things have to line up, and all three are necessary:

1. **The `ORDER BY` is total.** `created_at` alone is not unique — 100 rows share
   each value — so `id` is appended. Without it, rows tie, and the same row can
   appear on two pages. That failure is measured in
   [the list endpoint](../02-list-endpoint.md): 46 duplicates across 100 rows.
2. **The `WHERE` uses exactly the same columns in the same order** as the
   `ORDER BY`. The comparison and the sort have to describe the same sequence.
3. **An index covers that order** — `(created_at DESC, id DESC)`. Without it the
   comparison is still correct but PostgreSQL has to sort, and you have lost the
   entire benefit.

## `(a, b) < ($1, $2)` is one comparison, not two

The row constructor compares tuples lexicographically, exactly like sorting: compare
`created_at`; only if equal, compare `id`. It is the same rule `ORDER BY
created_at, id` uses, which is why the two agree.

The reason it matters is that PostgreSQL can turn the whole tuple comparison into a
single B-tree seek. Written out by hand it looks equivalent and is not:

```console
=== 7. the row-constructor form vs writing the comparison out by hand ===
same rows? true
row constructor      0.99 ms
expanded OR form   158.12 ms
```

**Same rows, 160× apart.** The plans:

```console
row constructor:
  ->  Index Only Scan using k_events_created_id_idx on k_events (actual rows=20.00 loops=1)
  Index Cond: (ROW(created_at, id) < ROW('2026-01-02 17:39:00+00'::timestamp with time zone, 497499))
  Buffers: shared hit=23

expanded OR:
  ->  Index Only Scan using k_events_created_id_idx on k_events (actual rows=20.00 loops=1)
  Filter: ((created_at < '2026-01-02 17:39:00+00'::timestamp with time zone) OR ((created_at = '...') AND (id < 497499)))
  Rows Removed by Filter: 250001
  Buffers: shared hit=250981
```

`Index Cond` versus `Filter` is the distinction to internalise:

- **`Index Cond`** is evaluated *by the index scan* to decide where to start and
  stop. Rows that do not match are never visited.
- **`Filter`** is evaluated on every row the scan produces. `Rows Removed by
  Filter: 250001` — a quarter of a million rows read, checked, and discarded.

The `OR` cannot become a seek condition because the planner has no single starting
point for it: an `OR` of two independent predicates does not describe one
contiguous range of the index. So it scans from the beginning and tests each row.

**Always write the tuple form.** It is shorter, it is what the operator is for, and
it is the only version that produces an `Index Cond`.

## The index has to match the sort exactly

`(created_at DESC, id DESC)` matches `ORDER BY created_at DESC, id DESC`.

A B-tree can be read backwards, so an index declared `(created_at, id)` — both
ascending — also serves this query: PostgreSQL scans it in reverse. What does *not*
work is an index whose columns disagree with each other about direction relative to
the query, which is the subject of the mixed-direction trap in
[the next chunk](02-cursors-and-traps.md).

Column order is not negotiable. An index on `(id, created_at)` is useless here
however you read it, because the leading column of the index is not the leading
column of the sort — see
[Phase 10 · Multicolumn indexes](../../phase-10-indexes/06-multicolumn.md).

## Trade-off

Keyset pagination gives up random access. There is no page 500, no "jump to the
end", and no way to answer "how many pages are there" — the cursor only knows how
to go forward from a row you have already seen. Going backwards needs a second
query with the comparison and the sort both reversed.

That is a genuine product constraint, not just an implementation detail. It is
also the right shape for the things that page deeply: infinite scroll, API
consumers walking a collection, exports, and crawlers. A page-number UI over an
admin table is the case where `OFFSET` is still correct — it is shallow, the user
wants page numbers, and nobody is walking 25 000 pages.

The second cost is that the sort key is now part of your API contract. A cursor
encodes `created_at` and `id`; changing the default sort order invalidates every
cursor a client is holding.

## Gotchas

**Symptom:** Deep pages get linearly slower
**Cause:** `OFFSET n` produces and discards `n` rows. Measured at offset 499 980:
500 000 rows produced, 501 918 buffers, to return 20.
**Fix:** Keyset.

**Symptom:** Keyset is no faster than `OFFSET`
**Cause:** No index matching the `ORDER BY`, so the comparison is correct but the
rows still have to be sorted.
**Fix:** Index on exactly the `ORDER BY` columns, in that order.

**Symptom:** The plan shows `Filter` and a large `Rows Removed by Filter`
**Cause:** The comparison was written as `a < $1 OR (a = $1 AND b < $2)`, which
cannot become a seek condition. Measured: 250 001 rows removed, 158.12 ms against
0.99 ms.
**Fix:** Use the row-constructor form `(a, b) < ($1, $2)`.

**Symptom:** A row appears on two consecutive pages
**Cause:** The sort is not total — the cursor cannot distinguish rows that tie.
**Fix:** Append a unique column to both the `ORDER BY` and the tuple.

**Symptom:** The index exists but is not used
**Cause:** Its leading column is not the leading column of the sort.
**Fix:** Match the order exactly; `(id, created_at)` does not serve
`ORDER BY created_at, id`.

## Interview questions

**★ Why is `OFFSET` slow at depth?**
Because it does not skip rows, it produces them and discards them. Measured at
offset 499 980 in a 500 000-row table: the index scan produced all 500 000 rows and
`Limit` threw away 499 980, touching 501 918 buffers to return 20 rows — 295.87 ms
against 1.23 ms for the keyset equivalent.

**★ What does the keyset query look like, and what has to be true for it to be
correct?**
`WHERE (created_at, id) < ($1, $2) ORDER BY created_at DESC, id DESC LIMIT n`,
with the cursor being the last row's sort key. The `ORDER BY` must be total —
hence the unique `id` — the `WHERE` must use the same columns in the same order,
and an index must cover that order.

**★ Why is `(a, b) < ($1, $2)` faster than `a < $1 OR (a = $1 AND b < $2)`?**
The row constructor becomes an `Index Cond`, so the scan seeks straight to the
starting point. The `OR` form becomes a `Filter` evaluated on every row the scan
produces, because an `OR` of independent predicates does not describe one
contiguous index range. Measured: 0.99 ms versus 158.12 ms, with 250 001 rows
removed by the filter.

**★ What is the difference between `Index Cond` and `Filter` in a plan?**
`Index Cond` is used by the index scan to choose where to start and stop, so
non-matching rows are never visited. `Filter` is applied to rows the scan has
already produced. A predicate that becomes a `Filter` on a large table is usually
the reason a query is slow despite "using the index".

**What do you give up by moving from `OFFSET` to keyset?**
Random access — no page numbers, no jumping to page 500, no total page count, and
backwards paging needs a separate reversed query. Fine for feeds, APIs and
exports; wrong for an admin screen with a page-number UI.

---

← [Topic index](README.md) · Next → [Cursors and the traps](02-cursors-and-traps.md)
