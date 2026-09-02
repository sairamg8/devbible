---
title: "What embeds: images, review photos and the address — bounded, co-read, co-written"
sidebar_label: "2 · What embeds"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/),
> [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/)
> (BSON document size **16 mebibytes**, nesting depth **100 levels**),
> [Atomicity and Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/),
> [`$push`](https://www.mongodb.com/docs/manual/reference/operator/update/push/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Three child tables become arrays, and the payoff is not "fewer joins" — it is
that every write to them becomes atomic for free, because
[a write is atomic on the single-document level](../../../../mongodb/pages/phase-0-how-mongodb-runs/02-single-document-atomicity.md).
What you pay is every constraint that used to live on those tables:
`unique (product_id, position)`, the foreign key to `products`, and the
`check (position between 0 and 2)`. This chunk takes the three easy embeds —
product images, review photos, and the order address — and shows exactly what
replaces each lost constraint. The cart, which is the hard one, is
[chunk 3](02b-the-cart-document.md).**

## `products.images` — the easy one

The Postgres table existed for three reasons, and two of them survive embedded:

| Postgres reason | Embedded outcome |
|---|---|
| `unique (product_id, position)` | **Lost** — no unique constraint applies inside an array. Enforced in the write path |
| `on delete cascade` with the product | **Free** — the array *is* part of the document |
| The upload service inserts rows independently | **Kept** — `$push` targets one product; no other document moves |

The bound is real and small: the storefront shows a gallery, so the practical
ceiling is a dozen images at a few dozen bytes of metadata each. The image
*bytes* were never in the database — the
[architecture](../../phase-0-the-app/02-architecture-and-data-model.md) puts them
in object storage and the row holds a key — so the array holds keys, and that is
the whole document-size story.

```js
// db/mongo/products.js — the upload service's insert: one write, atomic
export async function addImage(db, {productId, objectKey}) {
  const res = await db.collection('products').updateOne(
    {_id: productId, 'images.objectKey': {$ne: objectKey}},
    {$push: {images: {objectKey}}, $currentDate: {updatedAt: true}},
  );
  if (res.matchedCount === 0) return {added: false};      // already present
  await renumberImages(db, productId);
  return {added: true};
}

// position is DERIVED from array order, never stored independently —
// which is why two images can no longer claim position 0.
async function renumberImages(db, productId) {
  const doc = await db.collection('products')
    .findOne({_id: productId}, {projection: {images: 1}});
  await db.collection('products').updateOne(
    {_id: productId},
    {$set: {images: doc.images.map((im, i) => ({...im, position: i}))}},
  );
}
```

The filter `'images.objectKey': {$ne: objectKey}` is doing the work the lost
unique constraint used to do, and it does it *atomically* — the match and the
push are one operation on one document, so two concurrent uploads of the same
key cannot both pass. The Manual states the general form of this technique:

> *"To prevent conflicts during concurrent updates, include the expected current
> value in the update filter."*
> — [Atomicity and Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)

`renumberImages` is the more interesting half. Postgres enforced position
uniqueness with an index; the document model does better by making position **a
function of array order** rather than a stored fact that can disagree with
itself. Positions cannot collide because nothing writes them independently.
That is not a workaround for a missing constraint — it is a strictly stronger
model that only became available once the images stopped being separate rows.

## `reviews.images` — bounded by the spec itself

The spec caps review photos at three, and Postgres encoded that as
`check (position between 0 and 2)` plus `unique (review_id, position)`.
Embedded, the cap becomes one line of validator —

```js
images: {bsonType: 'array', maxItems: 3, items: {
  bsonType: 'object', required: ['objectKey'],
  properties: {objectKey: {bsonType: 'string'}},
}}
```

— and the photos travel with the review on every read, which is every read the
storefront does. This is the textbook one-to-few embed with no interesting
failure mode; [chunk 8](06-constraints-that-vanish.md) shows where that
validator fragment lives and what happens when a write violates it.

## `orders.address` — a subdocument, not a column type

`address jsonb` becomes a plain subdocument. The difference worth naming: in
Postgres, `jsonb` was a *typed column* the schema deliberately left
unstructured, and querying inside it needed different operators and a different
index type ([1·08](../../phase-1-database/08-jsonb-attributes.md)). In MongoDB
there is no distinction at all — `address.city` is exactly as indexable and
queryable as `totalCents`, with the same syntax and the same B-tree.

The `jsonb` seam simply does not exist, which is the clearest single
illustration of what a document database *is*. The same applies to
`products.attributes`: it stops being a special column and becomes ordinary
fields, so `{'attributes.finish': 'walnut'}` is an ordinary equality predicate
served by an ordinary index.

The symmetry is worth stating both ways, because it is a genuine loss as well as
a gain: Postgres could *choose* which parts of a row were schema-enforced and
which were free-form, per column. MongoDB makes that a whole-document validator
decision. You cannot have `priceCents` rigidly typed and `attributes` free-form
unless the validator says so explicitly — which it can, and
[chunk 8](06-constraints-that-vanish.md) shows the exact clause.

## How big is any of this?

The BSON document size limit is the ceiling on every embed:

> *"The maximum BSON document size is 16 mebibytes."*
> — [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/)

Do the arithmetic once so nobody has to guess. An image entry is an ObjectId-free
subdocument of a short string key and a small int — call it 60 bytes with BSON
key and type overhead. Sixteen mebibytes is therefore of the order of a quarter
of a million image entries, which is not a limit a product gallery reaches. **The
relevant bound is never the ceiling; it is the working size**, because every read
of the product transfers every image entry and every write rewrites the whole
document.

Nesting has its own documented ceiling — *"100 levels of nesting"* — which no
shape in this app approaches. It matters only if someone models the category tree
as nested subdocuments, which [chunk 5](04-what-stays-a-collection.md)
explicitly does not.

## Gotchas

**★ `$push` with no guard silently creates duplicates that no constraint will
catch.** This is the single most common defect in a first Mongo port of a schema
that had composite unique keys. Postgres raised `duplicate key`; MongoDB adds a
second array element and moves on. The fix is the `{$ne: value}` filter on the
push, shown above — and the discipline that **every `$push` into a set-like
array carries a negative filter naming the field that makes elements unique**.

**★ `$addToSet` is not the fix, and reaching for it is the second-most-common
defect.** `$addToSet` deduplicates on *whole-element equality*, so
`{objectKey: "a.jpg", position: 0}` and `{objectKey: "a.jpg", position: 1}` are
two different elements and both go in. It works only for arrays of scalars. For
arrays of subdocuments with an identity field, the guarded `$push` is the
pattern; `$addToSet` gives you an illusion of uniqueness that fails on the first
element that carries a mutable field.

**★ `$currentDate` instead of `new Date()` for `updatedAt`.** Passing a
JavaScript `Date` stamps the *application server's* clock, and with several API
instances behind a load balancer those clocks disagree — which matters the moment
`updatedAt` orders anything. `$currentDate` stamps the database server's clock,
one clock for the whole deployment. The Postgres original got this free from
`default now()`, and losing it silently is easy because the values look fine.

**★ Growing an array in place is not free at the storage layer.** WiredTiger
rewrites the document on update, and a document that outgrows its allocated space
is relocated. For image lists this is noise. It is the reason the Manual's
*"grows without bounds"* clause is about *sustained* growth: an array appended to
a million times is a document rewritten a million times, at ever-increasing size.
It degrades gradually and never throws until 16 MiB, so nothing tells you.

**★ Embedding removed the cascade, and also removed the foreign key.** `on
delete cascade` from `products` to `product_images` is free now (one document),
but every reference *into* `products` — from carts, orders, reviews — has no
enforcement at all. Nothing stops a cart holding a `productId` for a product that
no longer exists. [Chunk 07](06-constraints-that-vanish.md) is the full
accounting; the cart's answer is that the checkout read
([03·02](../03-checkout-with-transactions/02-the-transaction.md)) looks the
products up and treats "missing" as "out of stock", which is what the UI wanted
anyway.

**★ Projecting the parent to avoid shipping the array is a `projection`, not a
model change.** `findOne({slug}, {projection: {images: 0}})` on the catalog grid
keeps the array out of the wire response without touching the document model.
People conclude "the array is too big, it must become a collection" when the
actual problem is a missing projection on one read. Measure which read hurts
before moving the data.

## Interview questions

**★ You embedded `product_images` and lost `unique (product_id, position)`.
What breaks, and what do you do about it?** Two images can claim `position: 0`,
so "the cover image" — the catalog reads the lowest position — becomes ambiguous
and the grid shows a different photo on different requests. No index can restore
it, so the enforcement moves into the one write path that creates images:
`addImage` never trusts a caller-supplied position, it pushes without one and
then re-derives every position from array order in a single `$set`. Making
position a *function of order* rather than independently stored data means
positions cannot collide by construction — a better answer than the constraint
was, and only available because the images became one document.

**★ Why is 16 MiB the wrong number to quote when someone asks how big an
embedded array can get?** Because it is a hard failure ceiling, not a budget.
Cost grows linearly with array length long before the ceiling: every read
transfers the whole array, every write rewrites the whole document, and a
document that keeps growing keeps getting relocated. The number that should
govern the design is "how much am I willing to transfer on every read of the
parent", which lands in the hundreds of elements, not the hundreds of thousands.
16 MiB is the safety net that tells you the model was wrong three orders of
magnitude ago.

**★ `products.attributes` was `jsonb` and is now just fields. What did that
actually change, in both directions?** It removed a seam: no containment
operators, no separate GIN index type, no different NULL semantics, no mental
switch between "columns" and "the blob". `attributes.finish` is an ordinary
indexed path. In the other direction it removed a *choice*: Postgres let the
schema be rigid about `price_cents` and permissive about `attributes` in the same
table, column by column. MongoDB's equivalent is one validator over the whole
document, so per-field rigidity is something you now write out rather than get
from the column type.

**★ How do you enforce "at most three review photos" without a CHECK
constraint?** `maxItems: 3` inside `$jsonSchema` on the `reviews` collection —
which the server enforces on insert and, depending on validation level, on
update. That covers writes through any client, including `mongosh`, which is
what makes it a real constraint rather than an application convention. What it
does *not* cover is documents that already violated it before the validator was
added; the Manual's validation levels decide that, and the migration has to
choose deliberately.

**★ When would you move `products.images` out to its own collection after all?**
When a read appears that wants images *without* products. A CDN-warming job or a
"recently viewed photos" feed that scans image metadata across the catalog turns
the embed into a full `products` scan plus `$unwind`. That is the same test that
disqualified `reviews` — an access pattern running across parents rather than
within one — and it is worth restating because the trigger is never document
size, it is a new query shape.

---

← Prev: [Eleven tables, eight collections](01-eleven-tables-eight-collections.md) ·
[Overview](README.md) ·
Next → [The cart document](02b-the-cart-document.md)
