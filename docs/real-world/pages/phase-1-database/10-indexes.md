---
title: "Indexes for this app's queries"
sidebar_label: "10 · Indexes"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against PostgreSQL 17 documentation — B-tree/GIN index
> types, multicolumn indexes, partial indexes, `EXPLAIN`. Concept home:
> [PostgreSQL — indexes](../../../postgresql/pages/phase-10-indexes/README.md),
> where the mechanics live; this chapter is the application.

## The problem

Every index is bought twice: once at write time (every insert/update
maintains it) and once in memory. So the discipline is not "index the
columns" — it is **derive each index from a query this app actually runs,
and be able to say which one**. This chapter is that derivation, query by
query.

## The method

For each query shape from chapters 04–09: equality filters first, then the
sort — in the same order and direction the query uses — then check it with
`EXPLAIN ANALYZE`. The
[concept page](../../../postgresql/pages/phase-10-indexes/README.md) explains
*why* column order works this way (the leftmost-prefix rule); here it is
applied.

## The migration

```sql
-- 014_indexes.sql
-- FKs first: Postgres does NOT auto-index the referencing side,
-- and every one of these is joined or cascaded through constantly.
create index cart_items_product_idx   on cart_items (product_id);
create index order_items_product_idx  on order_items (product_id);
create index orders_user_idx          on orders (user_id);
create index reviews_product_idx      on reviews (product_id) where status = 'approved';
create index sessions_user_idx        on sessions (user_id);

-- the catalog (chapter 04): filter equality, then the sort pair
create index products_cat_created_idx on products (category_id, created_at desc, id desc)
  where deleted_at is null;
create index products_cat_price_idx   on products (category_id, price_cents, id)
  where deleted_at is null;

-- catalog with no category filter: the bare sort pairs
create index products_created_idx     on products (created_at desc, id desc)
  where deleted_at is null;
create index products_price_idx       on products (price_cents, id)
  where deleted_at is null;

-- expiry sweep + token lookup (Phase 2 jobs, Phase 3 auth)
create index sessions_expires_idx     on sessions (expires_at);

-- the worker's outbox poll: only unprocessed rows, oldest first
create index outbox_due_idx           on outbox (created_at) where processed_at is null;

-- dashboards (chapter 09): time-ranged order scans
create index orders_created_idx       on orders (created_at desc);
```

```sql
-- no-transaction
-- 015_search_gin.sql  (concurrently => its own file, chapter 02's marker)
create index concurrently products_search_idx
  on products using gin (search);
```

```sql
-- no-transaction
-- 016_attributes_gin.sql (chapter 08's containment filter)
create index concurrently products_attributes_idx
  on products using gin (attributes jsonb_path_ops);
```

## The derivations that teach the most

**`(category_id, created_at desc, id desc)`** is chapter 04's invariant made
physical: equality column first, then *exactly* the `order by` pair with
matching directions. A keyset query on this index is one descent plus a
walk — `EXPLAIN` shows `Index Scan … Index Cond: (category_id = …)` with **no
`Sort` node**. A `Sort` node under a keyset query means the index and the
`order by` disagree, and the whole point of chapter 04 is lost.

**Partial indexes carry the app's standing filters.** `where deleted_at is
null` (every catalog query), `where processed_at is null` (the outbox poll —
the index stays *tiny* no matter how much history the table holds, because
processed rows leave it), `where status = 'approved'` (the only reviews the
storefront reads). A partial index is smaller, cheaper to maintain, and
self-documents the query it serves. The cost: a query *without* the matching
predicate cannot use it — which is fine, because those queries are the admin's,
and rare.

**The FK block is the unglamorous one that prevents the worst incident.**
Postgres indexes the *referenced* side (the PK) automatically, never the
*referencing* side. Unindexed FKs make joins seq-scan — and, sneakier, make
`on delete cascade`/`restrict` checks scan the child table while holding
locks: deleting one user scans all of `sessions`. Every FK in this schema
gets an index unless a measured reason says otherwise.

**What is deliberately absent.** No index on `products.stock` (never filtered
alone), none on `orders.status` (five values — the planner rightly prefers
scans, and the dashboard's `filter` counts read a month of rows anyway),
none on `users.role`. Absences are decisions too; each is one write-cost
saved on every insert.

## Proving it — the phase gate

The gate says every catalog and checkout query runs under `EXPLAIN ANALYZE`
with an index it actually uses. The check is mechanical, per query: run
chapter 04's query with each sort, chapter 05's search, chapter 08's
containment filter, the outbox poll. Read for three things — the expected
index name in the plan, **no `Sort` node** on keyset queries, and
`Rows Removed by Filter` staying near zero (a large number means the index
found the wrong rows and the filter cleaned up — the index is mis-derived).
On the 200-row seed the planner may prefer sequential scans — that is
correct planner behaviour on tiny tables, not a broken index; the gate is
judged against a realistically sized dataset — a one-off
`insert … select … from generate_series(1, 100000)` bulk load, exactly the
kind of throwaway the scratch database is for.

## Gotchas

- **Symptom:** the price-sorted catalog uses the index; the newest-first one
  sorts. **Cause:** direction mismatch — the index was built `asc` while the
  query orders `desc` on a multicolumn pair. A single-column index serves
  both directions; a multicolumn one only serves order-compatible patterns.
  **Fix:** build the index in the query's direction pattern, as 014 does.
- **Symptom:** writes to `products` got measurably slower after "indexing
  everything to be safe". **Cause:** every index is maintained on every
  write — eight speculative indexes is eight extra B-tree updates per
  insert. **Fix:** the method — indexes come from queries; delete any index
  you cannot name the query for (`pg_stat_user_indexes.idx_scan = 0` finds
  the dead ones).
- **Symptom:** `create index concurrently` in CI failed and now the index
  "exists" but queries don't use it. **Cause:** a failed concurrent build
  leaves an `INVALID` index. **Fix:** `drop index` then re-run — chapter 02's
  no-transaction gotcha, met in practice.
- **Symptom:** the outbox poll slows down over months even though unprocessed
  rows stay few. **Cause:** the partial index is fine — the *query* stopped
  matching it (someone changed the poll to `processed_at is null or
  processed_at > …`). **Fix:** the predicate must imply the index's `where`
  clause verbatim-ish; the poll query and index are documented as a pair in
  Phase 2's worker chapter.

## Interview questions

1. **★ Why does column order in a multicolumn index matter?** A B-tree is
   sorted by the first column, then the second within it. Equality on the
   first column narrows to a contiguous range that is *already sorted* by
   the second — which is why `(category_id, price_cents)` serves
   "this category, by price" as a pure walk. Flip the order and the equality
   can't narrow first; the index degrades to a scan-and-filter.
2. **★ Why doesn't Postgres index foreign keys automatically, and what goes
   wrong when you don't?** The referenced (parent) side must be unique so it
   is indexed by the constraint; the referencing side's access pattern is
   the app's business, so Postgres leaves it to you. Unindexed, every join
   from the child and every cascade/restrict check becomes a child-table
   scan — the classic "deleting a user takes 30 seconds" incident.
3. **What makes a partial index the right call for the outbox?** The queue's
   working set is the unprocessed rows — a handful — while the table holds
   months of audit history. `where processed_at is null` keeps the index at
   working-set size forever; rows leave the index at the moment they stop
   being interesting. Small index, hot in cache, unaffected by table growth.
4. **`EXPLAIN` shows your new index used, but with `Rows Removed by Filter:
   9800`. Is the index working?** Mechanically yes, usefully no — it selects
   a superset and the filter discards 98% of fetched rows. The index's
   columns don't cover the query's real selectivity; re-derive (usually the
   missing filter column belongs in the index, or as its partial predicate).

---

← Prev: [Dashboard queries](09-dashboard-queries.md) ·
Next → [Soft delete and audit columns](11-soft-delete-and-audit.md)
