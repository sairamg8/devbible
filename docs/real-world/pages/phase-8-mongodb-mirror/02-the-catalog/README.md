---
title: "The catalog on MongoDB"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Query Documents](https://www.mongodb.com/docs/manual/tutorial/query-documents/),
> [`$sort`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sort/),
> [Text Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/),
> [Project Fields](https://www.mongodb.com/docs/manual/tutorial/project-fields-from-query-results/).
> Concept home:
> [MongoDB — CRUD](../../../../mongodb/pages/phase-4-crud/README.md) and
> [query operators](../../../../mongodb/pages/phase-5-query-operators/README.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

The busiest query in the app, rebuilt. The Postgres counterparts are
[1·04 — the catalog query](../../phase-1-database/04-the-catalog-query.md) and
[1·05 — full-text search](../../phase-1-database/05-full-text-search.md), and
this chapter's job is to reproduce both **behind an unchanged API contract**:
the same filters, the same three sorts, the same opaque base64 cursor, the same
`in_stock` boolean, the same ten-page search cap.

Most of it ports cleanly. Two things do not, and they are where the depth is:
**MongoDB has no row-value comparison**, so the keyset predicate has to be
written out as an `$or` and kept in step with the sort spec and the index; and
**a value that arrives as an object becomes an operator**, which is the injection
SQL never had.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The filter document](01-the-filter-document.md)** | Composing filters as objects, the type-injection attack, `$where` and `$expr`, the sort allow-list |
| 2 | **[Keyset pagination](02-keyset-pagination.md)** | `(price, _id) > (a, b)` written out by hand; why `$sort` being unstable makes the tiebreak mandatory |
| 3 | **[The cursor round trip](02b-the-cursor-round-trip.md)** | Hydrating the value out of JSON, carrying the sort, and making a mismatched cursor a clean 400 |
| 4 | **[Search](03-search.md)** | `$text`, index-time weights, one text index per collection, and the gaps that are identical to Postgres FTS |
| 5 | **[The catalog repository](04-the-catalog-repository.md)** | The module Phase 3 calls, and the projection that decides how much of the database travels |
| 6 | **[Hydrating references](04b-hydrating-references.md)** | One `$in` instead of a join, `$lookup` versus `$in`, and the N+1 the document model does not remove |

## What the contract required

Nothing in this chapter changes a route or a response shape. The one place the
storage swap presses on Phase 3 is the cursor decoder, and that is settled in
[chapter 01 chunk 7](../01-modeling-the-store/05b-the-cursor-and-the-boundary.md):
the codec moves into the data layer, the wire format stays byte-identical, and
the route passes an opaque string it never opens.

## Where this connects

The documents queried here are
[chapter 01's](../01-modeling-the-store/README.md) — in particular the embedded
`images` array (which makes the cover image a projection rather than a subquery)
and the denormalised `category` subdocument (which makes the category filter an
indexed equality predicate instead of a join). Every index these queries need is
derived in **chapter 05** *(not written yet)*, and the `SORT`
stage that `explain()` reports when the index and the sort disagree is that
chapter's gate.

---

Phase index: [Phase 8 — The MongoDB mirror](../README.md) ·
← Prev chapter: [Modeling the store as documents](../01-modeling-the-store/README.md) ·
Next chapter → **Checkout with transactions** *(not written yet)*
