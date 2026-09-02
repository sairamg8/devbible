---
title: "Eleven tables become eight collections, and the three that vanish are the whole argument"
sidebar_label: "1 · Eleven tables, eight collections"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/),
> [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/),
> [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**The Postgres schema has eleven tables (twelve counting `review_images`). The
Mongo schema has eight collections. The three that disappear — `product_images`,
`cart_items`, `order_items` — disappear for exactly one reason, and it is not
"MongoDB doesn't do joins": it is that each of them is read only ever as part of
its parent, written only ever by the same code path that writes its parent, and
bounded in size by something real. Every other table survives as a collection,
and this chunk is the derivation, row by row, with the rule that produced it.**

## The rule that decides every row

The Manual states the principle the whole phase runs on:

> *"A core principle of data modeling in MongoDB is that data that's accessed
> together should be stored together. You should structure your data model based
> on your application's data access patterns."*
> — [Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/)

That is not "denormalize everything". It is a *question* you ask of each
relationship, and the Manual gives both halves of the answer. Embed when there
is a

> *"'has-a' or 'contains' relationship"*, when *"your application queries pieces
> of information together"*, and when data is *"often updated together"*.

Reference when

> *"your embedded data grows without bounds"*, when *"the child side of the
> relationship has high cardinality"*, when the combined size *"takes up too much
> memory or transfer bandwidth"*, and when data *"is written at different rates"*.
> — [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)

The mechanics of applying that rule live in
[MongoDB 3·02](../../../../mongodb/pages/phase-3-schema-design/02-embed-vs-reference.md)
and the three cardinality pages that follow it
([one-to-few](../../../../mongodb/pages/phase-3-schema-design/03-one-to-few.md),
[one-to-many](../../../../mongodb/pages/phase-3-schema-design/04-one-to-many.md),
[one-to-squillions](../../../../mongodb/pages/phase-3-schema-design/05-one-to-squillions.md)).
This chapter does not re-derive them. It applies them to
[the eleven tables](../../phase-0-the-app/02-architecture-and-data-model.md) and
records the answer, because every later chunk and chapter in this phase depends
on the answer being fixed.

## The map

| Postgres table | Mongo | Why |
|---|---|---|
| `users` | collection `users` | Referenced from four places; own write rate; grows forever |
| `sessions` | collection `sessions` | High cardinality per user, expires independently — and a TTL index deletes the sweep job |
| `categories` | collection `categories` | Tiny, referenced by every product, renamed rarely |
| `products` | collection `products` | The catalog's unit of query |
| `product_images` | **embedded** `products.images[]` | Bounded (a handful), never read without the product, written by the upload path only |
| `carts` | collection `carts` | One live cart per owner; own lifecycle |
| `cart_items` | **embedded** `carts.items[]` | Bounded by human patience, always read whole, one write path |
| `orders` | collection `orders` | Immutable history; queried by user and by date |
| `order_items` | **embedded** `orders.items[]` | The price snapshot — the strongest embed in the app |
| `reviews` | collection `reviews` | Unbounded per product, moderated across products, independent write rate |
| `review_images` | **embedded** `reviews.images[]` | Capped at three by spec — the definition of bounded |
| `outbox` | collection `outbox` | A queue; documents *leave* it. Embedding a queue is a category error |

Eight collections: `users`, `sessions`, `categories`, `products`, `carts`,
`orders`, `reviews`, `outbox`.

Chunks [2](02-what-embeds.md), [3](02b-the-cart-document.md) and
[4](03-the-order-document.md) defend the embeds; chunks
[5](04-what-stays-a-collection.md) and [9](06b-no-equivalent.md) defend the
references —
including the two rows most people get wrong, `reviews` and `categories`.

## What "the same data model" means here

Two things did **not** change, and saying so up front prevents the most common
misreading of a document-model rewrite.

**The entity set is identical.** The
[spec](../../phase-0-the-app/01-the-storefront-spec.md) fixes six entities and
this model still has six. Nothing was merged out of existence and nothing was
invented. A document model is a different *storage* of the same domain, not a
different domain.

**Money is still integer cents.** The Manual prefers `Decimal128` for monetary
data, and
[MongoDB 1·04](../../../../mongodb/pages/phase-1-documents-and-bson/04-numbers.md)
quotes it: binary floating point is *"unsuitable for monetary arithmetic"*. But
this app is not storing decimals — it is storing *counts of cents*, the Manual's
own documented "scale factor" model, and the API contract already publishes
`price_cents` as an integer. Switching to `Decimal128` would change the wire
type (a `Decimal128` serialises to JSON as a string), which the gate forbids.
The trade is stated where it lives:
[chunk 8](06-constraints-that-vanish.md) shows what the validator must say so
that a JavaScript number — which the driver writes as a BSON `double` — does not
silently break a `bsonType: "int"` rule.

## The one shape you should hold in your head

```js
// products — one document, everything the product detail page needs
{
  _id: ObjectId("..."),
  slug: "walnut-standing-desk",          // the public identifier
  name: "Walnut Standing Desk",
  description: "...",
  priceCents: 89900,
  stock: 12,
  attributes: {width_cm: 140, finish: "walnut"},   // was jsonb
  category: {                                       // extended reference
    _id: ObjectId("..."), slug: "desks", name: "Desks",
  },
  images: [                                         // was product_images
    {objectKey: "img/abc.jpg", position: 0},
    {objectKey: "img/def.jpg", position: 1},
  ],
  deletedAt: null,
  createdAt: ISODate("..."), updatedAt: ISODate("..."),
}
```

Read the [catalog endpoint's](../../phase-3-express-api/05-catalog-endpoints.md)
`productDetail` mapper next to it. Every field that mapper needs — except the
approved reviews — is in that one document. The Postgres version of the same
page is a three-way join plus a correlated subquery for the cover image. That
is what "data accessed together is stored together" buys, and it is the only
thing it buys: it does not make the database faster in the abstract, it makes
*this page's read* one document fetch.

## Gotchas

**★ "MongoDB has `$lookup`, so I can keep the eleven tables."** You can, and
the app will work, and it will be worse than the Postgres original at every
point. `$lookup`
[*"performs a left outer join"*](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/) —
but the Manual is blunt that it *"will likely have poor performance if a
supporting index on the `foreignField` does not exist"*, and even indexed it
runs per input document rather than as a hash or merge join. A relational schema
on a document store gets you the join costs without the query planner that was
built to pay them. If the eleven-table shape is genuinely right for the
workload, that is an argument for staying on Postgres, not for emulating it.

**★ The embed decision is per *relationship*, not per *entity*.** `products`
embeds its images and references its category, in the same document, for
different reasons. Reaching a single verdict like "products are embedded" is how
models end up with an `orders` document containing the full product record —
which then has to be maintained forever.

**★ Eight collections is this app's answer, not MongoDB's.** Change one access
pattern and a row moves. If the storefront grew a "recently viewed" feed reading
images without products, `products.images` would earn its own collection. The
map above is only as durable as the
[spec](../../phase-0-the-app/01-the-storefront-spec.md) it was derived from,
which is why the derivation is written down and not just the result.

**★ A collection is not a table and does not enforce a shape.** Postgres refuses
a row that does not match the DDL. MongoDB accepts anything until you configure
[schema validation](https://www.mongodb.com/docs/manual/core/schema-validation/) —
and even then, the Manual notes validation applies to *"all document inserts"*
with existing documents governed by the validation level. Two versions of the
same collection can coexist. That is a feature during a migration and a hazard
forever after; [chunk 8](06-constraints-that-vanish.md) is about paying for it
deliberately.

## Interview questions

**★ Eleven tables, eight collections — which three went, and what do the three
have in common?** `product_images`, `cart_items` and `order_items`. All three
are *pure child tables of a single parent*: no query in the app reads them
without the parent, no write path touches them without touching the parent, and
each has a real upper bound on cardinality (a product's photos, a shopper's
cart lines, an order's lines). Those are exactly the Manual's embed conditions —
a "contains" relationship, queried together, updated together, not growing
without bounds. Every other table fails at least one of them.

**★ Why is `reviews` not embedded in `products`, when reviews are obviously
"part of" a product?** Two independent disqualifiers. First, unbounded growth: a
popular product accumulates reviews forever, and the Manual says reference when
*"your embedded data grows without bounds"* — with a hard ceiling at the 16 MB
BSON document limit that the app would hit as a write failure, not a warning.
Second, the access pattern runs *across* products: the admin moderation queue is
"all reviews with `status: pending`, newest first", which on an embedded model
is a full scan of `products` plus `$unwind`. Embedding optimises one read (the
product page) and destroys another. [Chunk 04](04-what-stays-a-collection.md)
carries the full argument.

**★ Does this model make the app faster?** For the product detail page and the
order history page, unambiguously yes — both become a single document fetch
where Postgres needs joins. For the dashboard it is a wash or slightly worse
(chapter [04](../04-the-dashboard/README.md)). For deep catalog pagination on a
computed sort it is worse (chapter [02](../02-the-catalog/README.md)). "Faster"
is not a property of a data model; it is a property of a model *and* a workload,
and the honest summary is that this rewrite moved cost from reads the app does
constantly to writes and analytics it does rarely.

**★ What would make you revisit the embed of `carts.items`?** A cart that stops
being bounded — a B2B reorder feature that loads a 4,000-line purchase order, or
a "save for later" list that never empties. The trigger is not a document-size
crisis; it is the moment a *partial* read of the cart becomes a real query
("show me page two of the cart"), because array elements cannot be paginated
efficiently and the whole document travels on every read.
[Chunk 02](02-what-embeds.md) states the size arithmetic that says when.

---

← [Overview](README.md) ·
Next → [What embeds](02-what-embeds.md)
