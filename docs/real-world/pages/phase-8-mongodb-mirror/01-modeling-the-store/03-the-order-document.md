---
title: "The order document: the price snapshot the spec fixed, and why the whole line item comes with it"
sidebar_label: "4 · The order document"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)
> (data *"sensitive to staleness"* is *"data that requires frequent updates to
> ensure that all occurrences of the data are consistent"*),
> [Unique Indexes](https://www.mongodb.com/docs/manual/core/index-unique/),
> [`$lookup`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**`order_items` is the strongest embed in the application, and the reason is not
performance — it is that the
[spec](../../phase-0-the-app/01-the-storefront-spec.md) already declared the
data immutable. "An order stores its own prices" was fixed at spec level and
implemented in Postgres as a copied `unit_price_cents` column. The document
model takes that principle one step further: if the price must never be joined
back, neither must the name, the slug or the cover image — because those change
too, and an order that renders "Walnut Standing Desk" should keep rendering it
after the product is renamed. Postgres left them joined because a join was
cheap. Here, copying them is cheaper *and* more correct.**

## The document

```js
// orders
{
  _id: ObjectId("..."),
  userId: ObjectId("..."),
  status: "paid",                          // pending|paid|shipped|delivered|cancelled
  idempotencyKey: "8f1c…",                 // unique index — the replay guard
  address: {line1: "…", city: "…", postcode: "…", paymentRef: "auth_…"},
  items: [
    {
      productId: ObjectId("..."),          // provenance, not a join target
      name: "Walnut Standing Desk",        // snapshot
      slug: "walnut-standing-desk",        // snapshot — links still work
      coverKey: "img/abc.jpg",             // snapshot
      qty: 1,
      unitPriceCents: 89900,               // THE snapshot, fixed by the spec
    },
  ],
  totalCents: 89900,
  createdAt: ISODate("..."), updatedAt: ISODate("..."),
}
```

Every field the order-history screen renders is in this one document. The
Postgres version needed `orders ⋈ order_items ⋈ products` to put a name next to
a price; here the order-history endpoint is
`find({userId}).sort({createdAt: -1, _id: -1}).limit(20)` and nothing else.

## Why the snapshot widened

The Manual's rule for duplicated data is a staleness question, and it cuts both
ways:

> Data *"sensitive to staleness"* is *"data that requires frequent updates to
> ensure that all occurrences of the data are consistent"*.
> — [Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)

Applied to `orders.items`, the answer is the opposite of the usual one: **this
copy must never be updated.** Staleness is not a defect here, it is the
requirement. An order line is a historical assertion — *on this date, this
customer bought this thing at this price* — and a background job that
"refreshed" the names in old orders to match renamed products would be
destroying data, not maintaining it.

That inverts the normal cost of denormalisation. The usual objection —
"now you have two copies and have to keep them in sync" — does not apply,
because the whole point is that they are allowed to diverge. Which is exactly
why the snapshot should be *wider*, not narrower: every additional field copied
in is one more thing the order does not have to look up, at zero maintenance
cost, because nothing maintains it.

The line to draw is stock: `stock` is emphatically **not** copied into the order.
It is not part of what was bought; it is current state of the product, it changes
constantly, and copying it would create exactly the stale duplicate the rule
warns about. The test to apply, field by field: *would a change to this field
make the historical record wrong, or just out of date?* Wrong ⇒ do not copy.
Out of date ⇒ copy, that is the point.

## What Postgres did and what changed

| Concern | Postgres | MongoDB |
|---|---|---|
| Price snapshot | `order_items.unit_price_cents` copied at checkout | `items[].unitPriceCents` copied at checkout — identical |
| Product name on the receipt | joined from `products` at read time | copied at checkout |
| One line per product | `primary key (order_id, product_id)` | enforced by the write path — the items array is built once, in memory, from the cart |
| History survives product deletion | `on delete restrict` on `order_items.product_id` | nothing enforces it — and nothing needs to, because the order no longer depends on the product row existing |
| Replay safety | `unique (idempotency_key)` | `createIndex({idempotencyKey: 1}, {unique: true})` — identical |

The third row is the one people worry about and should not. In Postgres the
composite primary key stopped a bug where the same product got two lines in one
order. Here there is no key — but there is also no *incremental* write path: the
`items` array is constructed once, in JavaScript, from the cart's items, and
inserted whole. A duplicate would require the cart to have contained duplicates,
which [chunk 3](02b-the-cart-document.md) makes impossible. **The constraint
moved from the storage engine to a code path that only executes once per
order** — a much smaller surface than the cart's, which is why the cart got a
retry loop and this did not.

The fourth row is a genuine and welcome loss. `on delete restrict` existed
because the order *needed* the product row to render. Once the order carries its
own name, slug, price and cover key, the product can be hard-deleted and every
past order still renders perfectly. The `productId` stays as provenance — for
"buy it again" links, and for the reviews rule below — and a dangling one is
handled by the UI, not by a constraint.

## The one thing that still points outward

`reviews` needs to prove a verified purchase, and Postgres proved it with
`reviews.unique (order_id, product_id)` plus a foreign key to `orders`. That
rule survives, but it now spans two collections:

```js
await db.collection('reviews').createIndex(
  {orderId: 1, productId: 1}, {unique: true},
);
```

The uniqueness ports exactly. The *foreign key* does not: nothing stops a review
naming an `orderId` that does not exist, or an order that belongs to a different
user. In Postgres, half of that was structural; here it is entirely a
server-side check in the review-creation path — the same ownership check
[Phase 3 already performs](../../phase-3-express-api/04-authorization.md), now
load-bearing rather than belt-and-braces. [Chunk 7](06-constraints-that-vanish.md)
lists every constraint in this category.

## Reads this shape makes trivial

```js
// order history — one document per order, no joins, no lookups
export const ordersByUser = (db, userId, {limit = 20, before} = {}) =>
  db.collection('orders')
    .find({userId, ...(before ? {_id: {$lt: before}} : {})})
    .sort({_id: -1})
    .limit(limit)
    .toArray();

// one order, for the confirmation page and the receipt
export const orderById = (db, _id, userId) =>
  db.collection('orders').findOne({_id, userId});   // ownership in the filter
```

Note the ownership check is *in the query filter*, not a post-fetch comparison.
That is worth doing everywhere but it is worth doing especially here: a
`findOne({_id})` followed by `if (order.userId !== userId) throw` is one early
`return` away from an IDOR, whereas a filter that does not match simply returns
`null` and the 404 path handles it.

Sorting by `_id` descending is sorting by creation time descending, because
[ObjectId's leading four bytes are a timestamp](../../../../mongodb/pages/phase-1-documents-and-bson/03-objectid.md) —
which makes the order-history keyset cursor a single field instead of the
`(created_at, id)` pair Postgres needed. That is a real simplification, and
[chunk 6](05-ids-and-the-api-contract.md) is careful about how far it can be
pushed, because the timestamp is second-resolution and generated *by the client
driver*, not the server.

## Gotchas

**★ Copying `stock` into the order line is the mistake this whole chunk exists to
prevent.** It looks harmless — the checkout already read the product, the field
is right there — and it produces an order document that claims a stock level from
months ago. Someone will eventually read it. The discriminator is the question
above: does a later change make the record *wrong* (never copy) or merely *out of
date* (copy freely)?

**★ A "data cleanup" job that refreshes denormalised product names in old orders
is data destruction.** It will be proposed, because "the same data in two places
and one of them is stale" reads as a bug in every code review. Write the reason
into the code — a comment on the items array and a line in the migration — because
the invariant is invisible from the schema alone. Postgres had the same exposure
and the same defence; the document model just makes the duplicate easier to see
and therefore easier to "fix".

**★ `orders.items[].productId` invites a `$lookup` that undoes the design.**
Someone adds "show current price alongside the historical one" and reaches for
`$lookup` on every order-history read. It works, and it reintroduces the join the
model removed, on the app's second-most-common authenticated read. If the feature
is genuinely wanted, it belongs on the *product detail* page where the product is
already loaded, not on the history list.

**★ The unique index on `idempotencyKey` must be built before the first
checkout.** In Postgres the constraint arrived with the table because DDL and
data are the same migration. Here, `createIndex` is a separate operation and the
collection works fine without it — right up until two concurrent replays both
insert and the app has two orders and one payment. Index creation is part of the
deploy, not part of setup-if-missing, and
**chapter 05** *(not written yet)* treats the index list as a
migration artefact for exactly this reason.

**★ A unique index over a field that is sometimes absent will collide on
`null`.** Every document missing `idempotencyKey` indexes as `null`, and the
second one fails. Orders always have the key so it does not bite here, but the
same index on an optional field (a `cancellationRef`, say) needs
`partialFilterExpression: {field: {$exists: true}}` or it will reject the second
document that lacks it. This is the single most common surprise when porting
`UNIQUE` columns that were nullable in Postgres, where multiple `NULL`s are
allowed.

**★ Nothing enforces `totalCents` equals the sum of the lines.** Postgres did not
either — it had `check (total_cents >= 0)` and nothing more — but the document
model makes the drift easier because the total and the lines are visibly one
object and a partial `$set` can update one without the other. The rule: the total
is written once, with the items, in the same insert, and never updated
independently. Any code path that would `$set` a total is a bug.

## Interview questions

**★ The spec says an order stores its own prices. Why does the document model
copy the name and slug too, when Postgres was content to join for those?** Because
the argument that justified copying the price applies unchanged to every other
displayed field, and Postgres only stopped at the price because a join was cheap
enough not to force the question. An order is a historical assertion; a renamed
product should not retroactively rename what a customer bought. Copying costs
nothing to maintain precisely because the copy is never meant to be maintained —
that is what makes this an unusually good denormalisation. The test is whether a
future change makes the record wrong or merely out of date.

**★ Postgres had `primary key (order_id, product_id)` on order items. You lost
it. Why is that safe here but not on the cart?** Because of how many times the
write path runs. The cart is mutated incrementally, by many independent requests
over a shopper's session, so the uniqueness invariant is exposed to concurrency
and needs enforcement on every write — hence the guarded push and the retry loop.
The order's `items` array is built once, in memory, from an already-deduplicated
cart, and inserted whole in a single operation. There is no second writer and no
incremental path, so the invariant has exactly one place to be violated, and that
place is straight-line code.

**★ `on delete restrict` protected order history from product deletion. What
replaces it?** Nothing — and nothing needs to, which is the point. The constraint
existed because the order *depended* on the product row to render a name and a
price. Once those are snapshotted, the dependency is gone: a product can be hard
deleted and every historical order still renders correctly. The `productId`
survives as provenance for "buy it again", and a dangling one degrades to a
disabled link rather than a broken page. This is a case where losing a constraint
is a consequence of removing the need for it, not of the database being weaker.

**★ How do you prove "one review per purchase" without a foreign key?** The
uniqueness half ports exactly: a unique compound index on
`{orderId: 1, productId: 1}` makes a second review for the same purchase a
duplicate-key error, atomically, under concurrency. The *referential* half —
that the order exists, belongs to this user, and actually contained this
product — has no storage-level equivalent and becomes a server-side check in the
review-creation path, reading the order and matching `userId` and
`items[].productId` before inserting. That check existed in Postgres too; the
difference is that it is now the only thing standing there, so it cannot be
skipped for a "quick admin script".

**★ Why sort order history by `_id` instead of `createdAt`?** Because an ObjectId
begins with a four-byte timestamp, so `_id` descending is already
creation-descending, and one field replaces the `(created_at, id)` pair that
Postgres needed for a unique keyset. It also removes an index: `_id` is indexed
by definition and can never be dropped. The caveat is that ObjectId timestamps
are second-resolution and generated by the *driver* on the client, so `_id` order
is not a reliable global event order across processes with skewed clocks — fine
for one user's orders, not fine as an audit timeline, which is why
[chunk 6](05-ids-and-the-api-contract.md) keeps `createdAt` on the document as
the authoritative time.

---

← Prev: [The cart document](02b-the-cart-document.md) ·
[Overview](README.md) ·
Next → [What stays a collection](04-what-stays-a-collection.md)
