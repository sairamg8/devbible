---
title: "The search indexer job"
sidebar_label: "07 · Search indexer"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against PostgreSQL 17 documentation (generated columns,
> `REINDEX`, GIN) — and honestly framed: with the schema as designed, most of
> this job does not need to exist. Concept home:
> [PostgreSQL — full text search](../../../postgresql/pages/phase-12-beyond-tables/README.md).

## The problem — and why this chapter is short

Every search system carries an indexing pipeline: something watches the
source of truth and keeps the searchable representation current. This app's
[search chapter](../phase-1-database/05-full-text-search.md) made a choice
that dissolves most of that pipeline — `products.search` is a **stored
generated column**, updated by Postgres in the same transaction as every
write. There is no lag to monitor, no queue to drain, no sync job to crash.

A "Know"-tier chapter earns its place by making that explicit: **know what
the indexer would be, know why this design doesn't need one, and know the
three residual tasks that remain.**

## What the generated column already does

| Classic indexer duty | Here |
|---|---|
| Watch for product changes | The column recomputes on every `insert`/`update` — nothing watches |
| Backfill on rules change | A migration rebuilds the column (chapter 1·05's weighted rebuild) — one-time, transactional |
| Recover from missed events | No events exist to miss |
| Monitor freshness lag | Lag is structurally zero |

## The residual tasks

**1. GIN index health.** The one moving part is the index on the column.
After heavy churn (a bulk price import touching every row), GIN's pending
list grows; the fastidious version of this job runs `select
gin_clean_pending_list('products_search_idx'::regclass)` after bulk writes —
or simply lets autovacuum do it, which is this app's answer. Named, not
built.

**2. Rebuilds ship as migrations.** Changing analyzers, weights or the
source expression is a schema change: drop and re-add the generated column
(the [weighted migration](../phase-1-database/05-full-text-search.md) is the
worked example), then `create index concurrently` its replacement and drop
the old — the [no-transaction file pattern](../phase-1-database/02-migrations.md).
The "indexer" is the migration runner.

**3. The external-engine future.** If search ever moves to
Elasticsearch/Meilisearch, *this chapter's file* becomes real: an outbox
topic per product change (`product.changed` — the checkout transaction's
pattern applied to admin writes), a relay handler pushing documents, and
freshness-lag metrics in the health kit. The design is already sitting in
[chapter 04](04-outbox-relay-and-email.md); search-engine sync is one more
handler, which is precisely why the outbox was worth building first.

## Gotchas

- **Symptom:** someone proposes a nightly "reindex everything" cron for
  safety. **Cause:** habit from systems with sync pipelines. **Fix:** there
  is nothing to reconcile — the column cannot drift. A no-op safety job
  costs a nightly full-table rewrite and teaches the team the system is
  scarier than it is.
- **Symptom:** bulk imports got slower after search weights were added.
  **Cause:** every row write recomputes two `to_tsvector` calls plus a GIN
  insert — the price of zero-lag consistency, paid at write time. **Fix:**
  for rare huge imports: drop the GIN index, import, recreate concurrently.
  The column itself stays — its cost is the honest floor.

## Interview questions

1. **★ Where did the indexing pipeline go?** Into the database's write path:
   a stored generated column makes the searchable form a *consequence* of
   the row, not a copy of it. The pipeline pattern exists to manage a copy;
   no copy, no pipeline. The trade is write-time cost and being limited to
   what Postgres can express — which chapter 1·05 accepted with eyes open.
2. **What is the first artifact you would build when moving to an external
   search engine?** The freshness-lag metric — seconds between a product
   write and its appearance in the engine. Sync bugs are silent and
   corrosive; the metric is the difference between knowing and guessing.
   Then the outbox topic and handler, because delivery machinery already
   exists.

---

← Prev: [The webhook dispatcher](06-the-webhook-dispatcher.md) ·
Next → [The cache layer](08-the-cache-layer.md)
