---
title: "Indexes for this app's queries"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [ESR guideline](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/),
> [Unique Indexes](https://www.mongodb.com/docs/manual/core/index-unique/),
> [Partial Indexes](https://www.mongodb.com/docs/manual/core/index-partial/),
> [TTL Indexes](https://www.mongodb.com/docs/manual/core/index-ttl/),
> [Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/),
> [Text Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/),
> [Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/),
> [Index Builds on Populated Collections](https://www.mongodb.com/docs/manual/core/index-creation/).
> Sources are named per chunk.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

Every index in this chapter is derived from a query written in chapters 01–04, and
each one is named next to the query it serves. That is
[Phase 1's method](../../phase-1-database/10-indexes.md) unchanged — *an index is
bought twice, once at write time and once in memory, so be able to say which query
it exists for* — applied to a database where the schema file that would otherwise
document the collections does not exist. **Here the index list is the schema
documentation.**

What changes in the port is the ordering rule and the diagnostics. Postgres taught
leftmost-prefix and left the rest to judgement; MongoDB names a guideline, **ESR**,
and states its exception. `EXPLAIN ANALYZE` becomes `explain()` with three
verbosities, one of which does not run the query — and running it at all bypasses
the plan cache, so the plan you are shown is not necessarily the plan production is
executing.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The method and ESR](01-the-method-and-esr.md)** | Deriving indexes from queries; Equality-Sort-Range and the documented ERS exception; why `$in` is an equality |
| 2 | **[The index list](02-the-index-list.md)** | The whole migration, with the query each index exists for beside it |
| 3 | **[What the list leaves out](02b-what-the-list-leaves-out.md)** | The index this app decided not to build, and why `createIndex` refuses to update one in place |
| 4 | **[Unique indexes](03-unique-and-partial.md)** | Every `UNIQUE` constraint ported, and the missing-field-indexes-as-null rule that breaks a careless port |
| 5 | **[Partial indexes](03b-partial-indexes.md)** | The closed operator list, the silent coupling to every query, and the one that changes an index's asymptotics |
| 6 | **[Collation](04-collation-and-case.md)** | `citext` as an index property, the opt-in a query can forget, and why this app normalises instead |
| 7 | **[The TTL index](05-the-ttl-index.md)** | The scheduled job it deleted, the sixty-second guarantee, and expiry that only runs on the primary |
| 8 | **[TTL restrictions](05b-ttl-restrictions-and-the-deleter.md)** | Four ways to declare a TTL index that expires nothing, and what the single-threaded deleter is doing |
| 9 | **[Multikey indexes](06-multikey-indexes.md)** | What embedding `order_items` cost at index time; the one-array-per-compound rule enforced on insert |
| 10 | **[The text index](07-the-text-index.md)** | One per collection, weights fixed at build time, and the sort it cannot help — which is why search caps at ten pages |
| 11 | **[Covered queries](08-covered-queries.md)** | The three conditions, the one query here worth covering, and the argument for declining |
| 12 | **[Index intersection](09-index-intersection.md)** | The mechanism MongoDB is engineered to avoid, and why the Postgres habit ports badly |
| 13 | **[Reading `explain()`](10-explain-verbosity-and-stages.md)** | Three verbosities, how to run it, and why running it changes what you are measuring |
| 14 | **[The plan tree](10b-the-plan-tree.md)** | Reading bottom-up, two execution engines with two output shapes, and the two plan-cache hashes |
| 15 | **[The ratio and `SORT`](11-the-ratio-and-the-sort-stage.md)** | Which way the three counters point when an index is mis-derived; the gate |
| 16 | **[`hint()` and the plan cache](12-hint-and-the-plan-cache.md)** | A diagnostic that ships by accident, and why a query gets slower with nobody changing it |
| 17 | **[Building indexes live](13-building-indexes-live.md)** | Commit quorum, the write-blocking lock at the end, and why the rolling procedure is unavailable here |

Chunks 2–3, 4–5, 7–8 and 13–14 are each **one topic split** across two files:
respectively the list and its omissions, unique and partial, the TTL index and its
restrictions, and the explain output and the plan tree. The phase README advertised
three chunks; the topic had seventeen.

## The gate

**Every catalog and checkout query runs under `explain('executionStats')` with an
index it actually uses, no `SORT` stage on any keyset-paginated query, and a
documents-examined-to-returned ratio near one — judged against a realistically
sized dataset, not the 200-document seed.** That sentence is
[chunk 15](11-the-ratio-and-the-sort-stage.md), and it is the same gate Phase 1
set with the counters renamed.

The seed caveat is not a technicality. On two hundred documents the planner will
often prefer a collection scan because it genuinely is cheaper, which is correct
behaviour and a false gate failure — and a gate that fails for the wrong reason is
one people learn to ignore.

## What is different from Phase 1, in one place

| | Phase 1 | Phase 8 |
|---|---|---|
| Ordering rule | leftmost prefix, judgement for the rest | **ESR**, with a documented ERS exception |
| Standing filters | `where deleted_at is null` | `partialFilterExpression`, with a **closed** operator list — no `$ne` |
| Case-insensitive unique | `citext` — the *type* | a collation on the *index*, which every query must opt into |
| Expiry | a scheduled sweep job | a TTL index, and a deleter you do not schedule |
| Arrays | a join table with an FK index | a **multikey** index, and four restrictions that arrive with it |
| Full text | several `tsvector` columns and GIN indexes | **one** text index per collection |
| Combining indexes | bitmap AND, an everyday plan | disfavoured by design; use compound indexes |
| Diagnostics | `EXPLAIN ANALYZE` | `explain()` — three verbosities, and it bypasses the plan cache |
| Online build | `CREATE INDEX CONCURRENTLY` | a quorum build across every member; no rolling build for unique indexes |

The row that surprises people most is the last-but-two: a habit that is correct in
Postgres — index each column and let the planner combine them — produces a
collection with many indexes and one query shape served well.

## Where this connects

Every query indexed here was written in
[chapter 02](../02-the-catalog/README.md),
[chapter 03](../03-checkout-with-transactions/01-the-stock-decrement.md) and
[chapter 04](../04-the-dashboard/README.md); the documents they read were decided
in [chapter 01](../01-modeling-the-store/README.md). The mechanics of each index
type — what a B-tree is, how a compound index is traversed — are the MongoDB
section's, and this chapter is the application. Chapter 06 is
**change streams** *(not written yet)*.

---

Phase index: [Phase 8 — The MongoDB mirror](../README.md) ·
← Prev chapter: [The dashboard on the aggregation pipeline](../04-the-dashboard/README.md) ·
Next chapter → **Change streams where `LISTEN`/`NOTIFY` was** *(not written yet)*
