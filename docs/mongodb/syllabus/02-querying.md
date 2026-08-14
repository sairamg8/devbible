---
title: "Part 2 — Querying"
sidebar_label: "02 · Querying"
sidebar_position: 2
---

> Verified: 2026-08-14 against the **MongoDB 8.0** manual. Tiers are assigned for
> fullstack application development.

**Phases 4–7 · 24 topics.** Everything you send to the server, and making the
planner do what you meant.

Phase 7 is the load-bearing one. A MERN application is almost never slow because
MongoDB is slow; it is slow because a query is scanning a collection and nobody
has run `explain()`.

---

## Phase 4 — CRUD and DML

*6 topics.* The write surface. Small, and full of operations that look
interchangeable and are not.

| Topic | Tier |
|---|---|
| **`insertOne` / `insertMany`** — and ⚠️ `ordered: true` stopping at the first failure while `ordered: false` continues | <span className="db-tier t-master">Master</span> |
| **`find` and the query document** — the shape of a filter, and implicit `$and` | <span className="db-tier t-master">Master</span> |
| **`findOne`** — and how it differs from `find().limit(1)` | <span className="db-tier t-master">Master</span> |
| **Projection** — asking for less, and why it matters more than it looks | <span className="db-tier t-master">Master</span> |
| **`updateOne` / `updateMany`** — and the fact that an update **must** use operators or it is a replacement | <span className="db-tier t-master">Master</span> |
| **Field update operators** — `$set`, `$unset`, `$inc`, `$mul`, `$min`, `$max`, `$rename`, `$currentDate` | <span className="db-tier t-master">Master</span> |

*Cut from this phase: 10 topics* — the non-Master rows and any Master rows beyond the top 6. Critical path only.

**Gate — move on when:** you can write an idempotent "add this item to the cart,
or increment its quantity if already there" operation as a *single* atomic
statement, and explain why it needs no transaction.

---

## Phase 5 — Query operators and projection

*6 topics.* The operator surface, and the array-matching semantics that produce
the most confident wrong answers in MongoDB.

| Topic | Tier |
|---|---|
| **Comparison operators** — `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, and how they behave across BSON types | <span className="db-tier t-master">Master</span> |
| **Logical operators** — `$and`, `$or`, `$not`, `$nor`, and when the explicit `$and` is required | <span className="db-tier t-master">Master</span> |
| **Element operators** — `$exists` and `$type`; the precise tool for the null/missing distinction | <span className="db-tier t-master">Master</span> |
| **`$regex`** — anchoring, case-insensitivity, and 🔴 when a regex can use an index and when it cannot | <span className="db-tier t-master">Master</span> |
| **`$expr`** — comparing two fields *of the same document*, which the plain query language cannot do | <span className="db-tier t-master">Master</span> |
| 🔴 **Array matching: exact vs containment** — `{tags: "a"}` matches an array containing `"a"`; `{tags: ["a"]}` matches only the exact array. The single most common query bug | <span className="db-tier t-master">Master</span> |

*Cut from this phase: 8 topics* — the non-Master rows and any Master rows beyond the top 6. Critical path only.

**Gate — move on when:** given `orders` with an array of line items, you can write
the query for "orders containing a line item that is both product X *and*
quantity > 2" and explain why the obvious version returns the wrong orders.

---

## Phase 6 — The aggregation pipeline

*6 topics.* MongoDB's real query language. Everything the find API cannot do
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

*Cut from this phase: 14 topics* — the non-Master rows and any Master rows beyond the top 6. Critical path only.

**Gate — move on when:** you can write, and explain the cost of, a pipeline that
returns the top 10 products by revenue for a date range, with the customer name
joined in, paginated, and with a total count — in one round trip.

---

## Phase 7 — Indexes and the query planner

*6 topics.* 🔴 **The highest-value phase in this syllabus.** Nothing else here
changes application performance by two orders of magnitude.

| Topic | Tier |
|---|---|
| **What an index is here** — a B-tree over field values, the cost it adds to every write, and the one you always have (`_id`) | <span className="db-tier t-master">Master</span> |
| **Single-field indexes** — and why direction does not matter for one field | <span className="db-tier t-master">Master</span> |
| 🔴 **Compound indexes and the ESR rule** — Equality, Sort, Range, in that order. The single most useful rule in MongoDB performance | <span className="db-tier t-master">Master</span> |
| 🔴 **Index prefixes** — why `{a:1, b:1, c:1}` serves queries on `a`, and `a+b`, but not on `b` alone; the reason field order is the whole design | <span className="db-tier t-master">Master</span> |
| **Multikey indexes** — indexing an array field, what it costs, and the restrictions (no compound index on two array fields) | <span className="db-tier t-master">Master</span> |
| 🔴 **Unique indexes** — and their interaction with missing fields and `null`, which is where the surprise lives; the fix for the concurrent-upsert race from Phase 4 | <span className="db-tier t-master">Master</span> |

*Cut from this phase: 6 topics* — the non-Master rows and any Master rows beyond the top 6. Critical path only.

**Gate — move on when:** you can look at `executionStats` and say in one sentence
why a query is slow — wrong index, no index, poor selectivity, or too many
documents examined per document returned — and design the compound index that
fixes it using ESR, without trial and error.

---

← Prev: **[Part 1 — The document model](01-the-document-model.md)** ·
Next → **[Part 3 — MongoDB from Node](03-from-node.md)**
