---
title: "B-tree indexes"
sidebar_label: "02 · B-tree"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`,
> database collation `en_US.utf8`), **Node 24.19.0**, `pg` 8.23.0.
> Script: `sandbox/pg-api/ex23-index-basics.mjs`.

**`CREATE INDEX` with no `USING` clause gives you a B-tree, and a B-tree serves far more
than equality: ranges, `ORDER BY`, `min`/`max`, and — with one caveat that bites
everybody — prefix `LIKE`.**

## What one B-tree serves

Single index `b_events (sku)`, single index `b_events (at)`, 500 000 rows:

```console
$ node ex23-index-basics.mjs
=== 2. what a single B-tree can serve ===
equality         Index Scan using b_events_sku_idx on b_events            [0.110 ms]
range            Index Scan using b_events_at_idx on b_events             [0.059 ms]
sort order       Limit  ... (actual time=0.085..0.089 rows=5.00 loops=1)  [0.116 ms]
prefix LIKE      Gather ... Parallel Seq Scan                             [34.484 ms]
infix LIKE       Gather ... Parallel Seq Scan                             [40.313 ms]
min/max          Result ... (actual time=0.034..0.035 rows=1.00 loops=1)  [0.070 ms]
```

Four of the six are sub-millisecond off the same ordinary index:

| Query | Why the B-tree works |
|---|---|
| `sku = 'sku-0250000'` | descend to the key |
| `at > now() - interval '30 seconds'` | keys are sorted, so a range is a contiguous slice |
| `ORDER BY sku LIMIT 5` | read the first five leaf entries; **no `Sort` node at all** |
| `max(at)` | walk to the last leaf entry — note the plan is a `Result`, not an `Aggregate` scan |

`min`/`max` deserve the emphasis: with an index they are an index-endpoint lookup, not an
aggregate over the table.

## The prefix `LIKE` caveat

`LIKE 'sku-025%'` is *logically* a range — everything from `sku-025` up to `sku-026`.
But under a non-`C` collation the B-tree's sort order is not byte order, so PostgreSQL
cannot use it:

```console
db collation: en_US.utf8
prefix LIKE on a normal btree:
Gather
  Workers Planned: 2
  ->  Parallel Seq Scan on b_events
        Filter: (sku ~~ 'sku-025%'::text)
```

The fix is an operator class that sorts by byte value:

```sql
CREATE INDEX b_events_sku_pat_idx ON b_events (sku text_pattern_ops);
```

```console
same query after CREATE INDEX ... (sku text_pattern_ops):
Bitmap Heap Scan on b_events
  Filter: (sku ~~ 'sku-025%'::text)
  ->  Bitmap Index Scan on b_events_sku_pat_idx
        Index Cond: ((sku ~>=~ 'sku-025'::text) AND (sku ~<~ 'sku-026'::text))
execution time now: 4.107 ms
```

34.5 ms → 4.1 ms, and the `Index Cond` shows the rewritten range with the `~>=~` /
`~<~` pattern operators.

**But `text_pattern_ops` does not replace the ordinary index** — it cannot serve
`ORDER BY sku`, because it sorts differently:

```console
but equality still needs the plain one — text_pattern_ops index cannot serve ORDER BY sku:
Limit
  ->  Index Only Scan using b_events_sku_idx on b_events
```

Two indexes, two jobs. If your database is created with `LC_COLLATE=C` you need only
one — that is the real argument for `C` collation, and its cost is that
`ORDER BY name` stops being alphabetical for humans.

**`LIKE '%250000%'` is not helped by either.** A leading wildcard has no prefix to seek
to; that needs [`pg_trgm`](11-gin-trgm.md).

## In SQL

```sql
CREATE INDEX b_events_sku_idx ON b_events (sku);                    -- btree, the default
CREATE INDEX b_events_sku_pat_idx ON b_events (sku text_pattern_ops);
CREATE INDEX b_events_at_desc ON b_events (at DESC NULLS LAST);     -- direction matters for ORDER BY

-- opclasses available for a type
SELECT opcname FROM pg_opclass o
JOIN pg_am a ON a.oid = o.opcmethod
WHERE a.amname = 'btree' AND opcintype = 'text'::regtype;
```

A B-tree can be scanned backwards, so `(at)` also serves `ORDER BY at DESC` — you do not
need both directions for a single column. You *do* need to think about direction for
multi-column sorts, where `(a ASC, b DESC)` and `(a ASC, b ASC)` are genuinely different.

## From Node

```js
// keyset pagination — the exact shape a B-tree is built for
const {rows} = await pool.query(
  `SELECT id, sku, at FROM b_events
   WHERE at < $1 ORDER BY at DESC LIMIT $2`, [cursor, 20]);
```

Check what you got rather than assuming:

```js
const plan = await pool.query(
  `EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM b_events WHERE sku LIKE $1`, ['sku-025%']);
console.log(plan.rows.map(r => r['QUERY PLAN']).join('\n'));
```

## Trade-off

**A B-tree is the general-purpose answer, and that is both its strength and its ceiling.**
It handles equality, ranges, sorts and endpoints on any type with a total order, which is
most of what an application does — but it cannot do containment (`@>`), similarity, or
"which rows contain this array element". Those need [GIN](11-gin-trgm.md) or
[GiST](15-gist-brin-hash.md), and those indexes cannot do what a B-tree does.

Reaching for `text_pattern_ops` buys prefix matching at the cost of a second full-size
index (15 MB each on the measured table) that duplicates the same column.

## Gotchas

**Symptom:** `LIKE 'abc%'` sequential-scans despite an index on the column
**Cause:** Non-`C` database collation; the B-tree order is not byte order
**Fix:** `CREATE INDEX ... (col text_pattern_ops)`, keeping the original for `ORDER BY`

**Symptom:** You added `text_pattern_ops` and now `ORDER BY col` is slow
**Cause:** That index sorts by byte value and cannot serve a collation-aware sort
**Fix:** Keep both indexes; they are not interchangeable

**Symptom:** `ORDER BY a, b DESC LIMIT 10` still shows a `Sort` node
**Cause:** The index is `(a, b)`; mixed directions need a matching index
**Fix:** `CREATE INDEX ON t (a, b DESC)`

**Symptom:** `SELECT max(ts)` takes seconds on a big table
**Cause:** No index on `ts`, so it is an aggregate over every row
**Fix:** Index it; the plan becomes a `Result` reading one index endpoint

## Interview questions

**★ What can a B-tree index serve besides equality?**
Range predicates, `ORDER BY` (in either direction), `min`/`max` as endpoint lookups, and
prefix `LIKE` when the operator class sorts by byte value. Measured: all sub-millisecond
on 500 000 rows.

**★ Why does `LIKE 'abc%'` not use my index?**
Under a non-`C` collation the index order does not match byte order, so the prefix is not
a contiguous range. `text_pattern_ops` fixes it — 34.5 ms → 4.1 ms measured.

**★ Do you need a separate index for `ORDER BY col DESC`?**
No for a single column — B-trees scan backwards. Yes when a multi-column sort mixes
directions.

**Why is `min(x)` fast with an index and slow without?**
With one it reads the first (or last) leaf entry. Without one it is an aggregate over
every row.

**When is a B-tree the wrong index type?**
Containment and similarity queries — `jsonb @>`, array overlap, `LIKE '%x%'`,
full-text — which need [GIN](11-gin-trgm.md), and very large append-only tables where
[BRIN](15-gist-brin-hash.md) gives 99% of the benefit for 0.04% of the size.

---

← [What an index is](01-what-index.md) · Next → [EXPLAIN vs EXPLAIN ANALYZE](03-explain.md)
