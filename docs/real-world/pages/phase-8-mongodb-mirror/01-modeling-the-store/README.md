---
title: "Modeling the store as documents"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/),
> [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/),
> [Schema Validation](https://www.mongodb.com/docs/manual/core/schema-validation/),
> [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/).
> Concept home:
> [MongoDB — schema design](../../../../mongodb/pages/phase-3-schema-design/README.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

The keystone chapter of the phase. It fixes the document model that
[02](../02-the-catalog/README.md), [03](../03-checkout-with-transactions/README.md),
[04](../04-the-dashboard/README.md), **05** *(not written yet)*
and **06** *(not written yet)* all assume, by taking the
[eleven tables](../../phase-0-the-app/02-architecture-and-data-model.md) of the
Postgres schema one at a time and deciding where each one landed — and, more
importantly, writing down *why*, so a later chapter can be checked against the
reasoning rather than against a diagram.

The short answer: **eight collections**, three tables embedded as arrays, every
unique constraint preserved, every `CHECK` translated into a validator, and
every foreign key gone.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Eleven tables, eight collections](01-eleven-tables-eight-collections.md)** | The Manual's embed rule applied row by row, the map, and the one product document to hold in your head |
| 2 | **[What embeds](02-what-embeds.md)** | Product images, review photos, the address; the guarded `$push`; how big an array may actually get |
| 3 | **[The cart document](02b-the-cart-document.md)** | Why `INSERT … ON CONFLICT` became two writes and a loop, and the guard that makes the loop correct |
| 4 | **[The order document](03-the-order-document.md)** | The price snapshot widened to the whole line item; the copy that must never be repaired |
| 5 | **[What stays a collection](04-what-stays-a-collection.md)** | Reviews, sessions, outbox, categories; the TTL index that deleted a scheduled job; leases instead of `SKIP LOCKED` |
| 6 | **[Ids and the contract](05-ids-and-the-api-contract.md)** | ObjectId instead of `bigint`, and the `order_id` that changes type on the wire |
| 7 | **[The cursor and the boundary](05b-the-cursor-and-the-boundary.md)** | The pagination decoder that Phase 3 leaked, and the four rules that kept every other route intact |
| 8 | **[Constraints that vanish](06-constraints-that-vanish.md)** | Unique indexes, collations, `$jsonSchema` — and what "enforced" now means |
| 9 | **[What has no equivalent](06b-no-equivalent.md)** | Ten foreign keys and one generated column, and what holds them up now |
| 10 | **[Denormalisation and staleness](07-denormalization-and-staleness.md)** | Owner, repair path, staleness budget — and the category copy that answers all three |
| 11 | **[The rating summary](07b-the-rating-summary.md)** | Recompute, never increment; the rule that makes the repair job three lines |

## The model, in one place

```text
users      { email, passwordHash, role, deletedAt }
sessions   { userId|null, tokenHash, expiresAt }          ← TTL index
categories { slug, name, parentId|null }
products   { slug, name, priceCents, stock, attributes,
             category{_id,slug,name},                     ← extended reference
             rating{avg,count},                           ← derived
             images[{objectKey,position}],                ← was product_images
             deletedAt }
carts      { sessionId|null, userId|null,
             items[{productId, qty}] }                    ← was cart_items
orders     { userId, status, idempotencyKey, address,
             items[{productId,name,slug,coverKey,
                    qty,unitPriceCents}],                 ← was order_items
             totalCents }
reviews    { productId, userId, orderId, rating, body,
             status, images[{objectKey}] }                ← was review_images
outbox     { topic, payload, processedAt|null, leasedUntil }
```

## Where this connects

The Postgres counterpart is
[the schema](../../phase-1-database/01-the-schema/README.md), read in full before
this chapter. The mechanisms — what a document is, how embedding works, the
cardinality patterns — are
[MongoDB phases 1 and 3](../../../../mongodb/pages/phase-3-schema-design/README.md)
and are never re-taught here. Everything downstream depends on this chapter:
[chapter 02](../02-the-catalog/README.md) queries these documents,
[chapter 03](../03-checkout-with-transactions/README.md) writes five of these
collections in one transaction, and
**chapter 05** *(not written yet)* indexes exactly the fields this
chapter put where they are.

---

Phase index: [Phase 8 — The MongoDB mirror](../README.md) ·
Next chapter → [The catalog on MongoDB](../02-the-catalog/README.md)
