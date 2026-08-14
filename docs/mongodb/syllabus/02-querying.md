---
title: "Part 2 — Querying"
sidebar_label: "02 · Querying"
sidebar_position: 2
---

> Verified: 2026-08-14 against the **MongoDB 8.0** manual. Tiers are assigned for
> fullstack application development.

**Phases 4–7 · 62 topics.** Everything you send to the server, and making the
planner do what you meant.

Phase 7 is the load-bearing one. A MERN application is almost never slow because
MongoDB is slow; it is slow because a query is scanning a collection and nobody
has run `explain()`.

---

## Phase 4 — CRUD and DML

*16 topics.* The write surface. Small, and full of operations that look
interchangeable and are not.

| Topic | Tier |
|---|---|
| **`insertOne` / `insertMany`** — and ⚠️ `ordered: true` stopping at the first failure while `ordered: false` continues | <span className="db-tier t-master">Master</span> |
| **`find` and the query document** — the shape of a filter, and implicit `$and` | <span className="db-tier t-master">Master</span> |
| **`findOne`** — and how it differs from `find().limit(1)` | <span className="db-tier t-master">Master</span> |
| **Projection** — asking for less, and why it matters more than it looks | <span className="db-tier t-master">Master</span> |
| **`updateOne` / `updateMany`** — and the fact that an update **must** use operators or it is a replacement | <span className="db-tier t-master">Master</span> |
| **Field update operators** — `$set`, `$unset`, `$inc`, `$mul`, `$min`, `$max`, `$rename`, `$currentDate` | <span className="db-tier t-master">Master</span> |
| **Array update operators** — `$push` (with `$each`, `$slice`, `$sort`), `$pull`, `$addToSet`, `$pop`, `$pullAll` | <span className="db-tier t-master">Master</span> |
| 🔴 **Positional operators** — `$`, `$[]` and `$[<identifier>]` with `arrayFilters`; which one updates which element, and why `$` only ever touches the first match | <span className="db-tier t-master">Master</span> |
| **`replaceOne`** — the operation people invoke by accident when they omit `$set` | <span className="db-tier t-master">Master</span> |
| 🔴 **`upsert`** — what it does, and the concurrency trap: two concurrent upserts on a non-unique field both insert. The unique index is the fix, not the retry | <span className="db-tier t-master">Master</span> |
| **`findOneAndUpdate` / `findOneAndDelete`** — atomic read-modify-write on one document, `returnDocument`, and why this is the right tool far more often than a transaction | <span className="db-tier t-master">Master</span> |
| **`deleteOne` / `deleteMany`** — and the absence of a "delete returned rows" | <span className="db-tier t-master">Master</span> |
| **`bulkWrite`** — batching mixed operations, ordered vs unordered, and reading the result | <span className="db-tier t-understand">Understand</span> |
| **Reading a write result** — `matchedCount`, `modifiedCount`, `upsertedId`, and why matched ≠ modified | <span className="db-tier t-master">Master</span> |
| 🔴 **`sort`, `limit`, `skip`** — and why `skip` is the wrong pagination primitive at any real size; range-based pagination instead | <span className="db-tier t-master">Master</span> |
| **`countDocuments` vs `estimatedDocumentCount`** — one is accurate, one is fast, and the difference has bitten every dashboard ever built | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can write an idempotent "add this item to the cart,
or increment its quantity if already there" operation as a *single* atomic
statement, and explain why it needs no transaction.

---

## Phase 5 — Query operators and projection

*14 topics.* The operator surface, and the array-matching semantics that produce
the most confident wrong answers in MongoDB.

| Topic | Tier |
|---|---|
| **Comparison operators** — `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, and how they behave across BSON types | <span className="db-tier t-master">Master</span> |
| **Logical operators** — `$and`, `$or`, `$not`, `$nor`, and when the explicit `$and` is required | <span className="db-tier t-master">Master</span> |
| **Element operators** — `$exists` and `$type`; the precise tool for the null/missing distinction | <span className="db-tier t-master">Master</span> |
| **`$regex`** — anchoring, case-insensitivity, and 🔴 when a regex can use an index and when it cannot | <span className="db-tier t-master">Master</span> |
| **`$expr`** — comparing two fields *of the same document*, which the plain query language cannot do | <span className="db-tier t-master">Master</span> |
| 🔴 **Array matching: exact vs containment** — `{tags: "a"}` matches an array containing `"a"`; `{tags: ["a"]}` matches only the exact array. The single most common query bug | <span className="db-tier t-master">Master</span> |
| **`$all`, `$size`** — and why `$size` cannot use a range | <span className="db-tier t-understand">Understand</span> |
| 🔴 **`$elemMatch`** — the difference between "some element matches all conditions" and "conditions are satisfied across different elements", with the worked example that catches everyone | <span className="db-tier t-master">Master</span> |
| **Querying arrays of embedded documents** — dot notation vs `$elemMatch`, and the wrong result the shorthand gives you | <span className="db-tier t-master">Master</span> |
| **Array index paths** — `"items.0.sku"`, and why depending on position is usually a modelling smell | <span className="db-tier t-know">Know</span> |
| **Projection** — inclusion and exclusion cannot be mixed, and the `_id` exception to that rule | <span className="db-tier t-master">Master</span> |
| **Projection operators** — `$slice`, `$elemMatch` and the positional `$` in projections | <span className="db-tier t-understand">Understand</span> |
| **Text search and text indexes** — the built-in option, its limits, and where Atlas Search takes over | <span className="db-tier t-know">Know</span> |
| **Geospatial queries** — `2dsphere`, `$near`, `$geoWithin`; enough to build "stores near me" | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** given `orders` with an array of line items, you can write
the query for "orders containing a line item that is both product X *and*
quantity > 2" and explain why the obvious version returns the wrong orders.

---

## Phase 6 — The aggregation pipeline

*20 topics.* MongoDB's real query language. Everything the find API cannot do
lives here, including every report and every screen that needs data from two
collections.

| Topic | Tier |
|---|---|
| **What a pipeline is** — an ordered list of stages, each taking documents in and emitting documents out | <span className="db-tier t-master">Master</span> |
| 🔴 **`$match` first, always** — the stage that decides whether an index is usable at all | <span className="db-tier t-master">Master</span> |
| **`$project` vs `$addFields` / `$set`** — replacing the shape vs adding to it | <span className="db-tier t-master">Master</span> |
| **`$group` and the accumulators** — `$sum`, `$avg`, `$min`, `$max`, `$push`, `$addToSet`, `$first`, `$last` | <span className="db-tier t-master">Master</span> |
| **`$sort`, `$limit`, `$skip` in a pipeline** — and the sort-before-group optimisation | <span className="db-tier t-master">Master</span> |
| **`$unwind`** — one document per array element, `preserveNullAndEmptyArrays`, and the document multiplication it causes | <span className="db-tier t-master">Master</span> |
| 🔴 **`$lookup`** — the join, its real cost, and why a schema that needs three of them is telling you something | <span className="db-tier t-master">Master</span> |
| **`$lookup` with a `pipeline`** — correlated sub-queries, `let`, and filtering the joined side *before* it is joined | <span className="db-tier t-understand">Understand</span> |
| **`$graphLookup`** — recursive traversal for hierarchies and category trees | <span className="db-tier t-know">Know</span> |
| **`$facet`** — several pipelines over one input, and the pagination-plus-count pattern it enables | <span className="db-tier t-understand">Understand</span> |
| **`$bucket` / `$bucketAuto`** — histograms and price bands | <span className="db-tier t-know">Know</span> |
| **`$count`, `$sortByCount`** | <span className="db-tier t-understand">Understand</span> |
| **`$out` and `$merge`** — materialising results; `$merge` as the incremental one | <span className="db-tier t-know">Know</span> |
| **`$unionWith`** — combining collections | <span className="db-tier t-know">Know</span> |
| **Expression operators** — the arithmetic, string, date and array families, and how to find the one you need in the manual | <span className="db-tier t-understand">Understand</span> |
| **`$cond`, `$switch`, `$ifNull`** — branching inside a pipeline | <span className="db-tier t-master">Master</span> |
| **System variables** — `$$ROOT`, `$$NOW`, `$$REMOVE`, and `$let` | <span className="db-tier t-understand">Understand</span> |
| **`$setWindowFields`** — window functions: running totals, ranking, moving averages | <span className="db-tier t-know">Know</span> |
| 🔴 **Pipeline optimisation** — what the optimizer reorders for you (`$match` coalescing, `$sort`+`$limit`), and what it will not | <span className="db-tier t-understand">Understand</span> |
| ⚠️ **Memory limits** — the per-stage limit, `allowDiskUse`, and why a pipeline that works on 10,000 documents fails on 10 million | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can write, and explain the cost of, a pipeline that
returns the top 10 products by revenue for a date range, with the customer name
joined in, paginated, and with a total count — in one round trip.

---

## Phase 7 — Indexes and the query planner

*12 topics.* 🔴 **The highest-value phase in this syllabus.** Nothing else here
changes application performance by two orders of magnitude.

| Topic | Tier |
|---|---|
| **What an index is here** — a B-tree over field values, the cost it adds to every write, and the one you always have (`_id`) | <span className="db-tier t-master">Master</span> |
| **Single-field indexes** — and why direction does not matter for one field | <span className="db-tier t-master">Master</span> |
| 🔴 **Compound indexes and the ESR rule** — Equality, Sort, Range, in that order. The single most useful rule in MongoDB performance | <span className="db-tier t-master">Master</span> |
| 🔴 **Index prefixes** — why `{a:1, b:1, c:1}` serves queries on `a`, and `a+b`, but not on `b` alone; the reason field order is the whole design | <span className="db-tier t-master">Master</span> |
| **Multikey indexes** — indexing an array field, what it costs, and the restrictions (no compound index on two array fields) | <span className="db-tier t-master">Master</span> |
| **Partial and sparse indexes** — indexing a subset; why partial supersedes sparse in new work | <span className="db-tier t-understand">Understand</span> |
| 🔴 **Unique indexes** — and their interaction with missing fields and `null`, which is where the surprise lives; the fix for the concurrent-upsert race from Phase 4 | <span className="db-tier t-master">Master</span> |
| **TTL indexes** — expiring sessions, carts and tokens; the granularity you actually get | <span className="db-tier t-understand">Understand</span> |
| **Other index types** — text, wildcard, hashed, `2dsphere`; what each is for and its trade | <span className="db-tier t-know">Know</span> |
| **Covered queries** — when MongoDB answers from the index alone and never touches a document | <span className="db-tier t-master">Master</span> |
| 🔴 **`explain()` deeply** — `queryPlanner` / `executionStats` / `allPlansExecution`; `IXSCAN` vs `COLLSCAN`, `totalKeysExamined` vs `totalDocsExamined` vs `nReturned`, rejected plans, and the plan cache | <span className="db-tier t-master">Master</span> |
| ⚠️ **Index builds and index count** — building on a live system, and why "add an index" is not free: every index is a write amplifier | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** you can look at `executionStats` and say in one sentence
why a query is slow — wrong index, no index, poor selectivity, or too many
documents examined per document returned — and design the compound index that
fixes it using ESR, without trial and error.

---

← Prev: **[Part 1 — The document model](01-the-document-model.md)** ·
Next → **[Part 3 — MongoDB from Node](03-from-node.md)**
