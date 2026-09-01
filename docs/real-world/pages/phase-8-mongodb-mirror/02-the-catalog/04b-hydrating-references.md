---
title: "Hydrating references: one $in instead of a join, and the N+1 that a document model does not remove"
sidebar_label: "6 · Hydrating references"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [`$in`](https://www.mongodb.com/docs/manual/reference/operator/query/in/),
> [`$lookup`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/)
> (*"performs a left outer join"*; *"will likely have poor performance if a
> supporting index on the `foreignField` does not exist"*),
> [Limits and Thresholds](https://www.mongodb.com/docs/manual/reference/limits/)
> (BSON document size **16 mebibytes**, which the query document is also subject
> to).
> Concept home:
> [Node — the N+1 problem](../../../../nodejs/pages/phase-6-data-access/07-n-plus-1.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Three collections in this model hold references that a read has to resolve: a
cart's `items[].productId`, a review's `userId`, an order's
`items[].productId`. Embedding removed most of the joins; it did not remove
these, and the way they are resolved decides whether the cart page is two round
trips or twenty-two. The pattern is one `$in`, an in-memory join, and an explicit
branch for the document that is not there — and the last part is not defensive
noise, it is [the missing foreign
key](../01-modeling-the-store/06b-no-equivalent.md) arriving in code.**

## The pattern

```js
// db/mongo/carts.js — hydrate a cart's lines in one extra round trip
export async function cartWithProducts(db, cartId) {
  const cart = await db.collection('carts').findOne({_id: cartId});
  if (!cart) return null;
  if (cart.items.length === 0) return {...cart, items: []};   // skip the round trip

  const ids = cart.items.map((i) => i.productId);
  const docs = await db.collection('products')
    .find({_id: {$in: ids}, deletedAt: null})
    .project(CARD_PROJECTION)
    .toArray();

  // key by STRING — two ObjectId instances with the same value are not
  // the same Map key
  const byId = new Map(docs.map((d) => [d._id.toString(), d]));

  return {
    ...cart,
    items: cart.items.map((line) => ({
      ...line,
      product: byId.get(line.productId.toString()) ?? null,   // may be missing
    })),
  };
}
```

Two round trips, for any cart size. That is the whole trick, and it is the same
trick the [N+1 page](../../../../nodejs/pages/phase-6-data-access/07-n-plus-1.md)
describes for `pg` — collect the ids, fetch once, join in memory. **A document
store does not remove the N+1 pattern; it removes some of the *places* it can
occur**, because data that is always read together is already in one document.
Wherever a reference survives, the loop is still the bug.

## Why not `$lookup`

`$lookup` would do the join server-side:

```js
db.collection('carts').aggregate([
  {$match: {_id: cartId}},
  {$lookup: {from: 'products', localField: 'items.productId',
             foreignField: '_id', as: 'products'}},
]);
```

It works, it is one round trip instead of two, and it is the wrong default here
for three reasons.

**The result shape is worse, not better.** `$lookup` *"adds a new array field to
each input document"* — so you get `cart.items` and a separate `cart.products`
array, and the code still has to build a map and pair them. The join you wanted
was per-line; the join you got is per-document. Getting the per-line shape needs
`$unwind` plus a regrouping, which is more pipeline than the two-query version is
JavaScript.

**Nothing was actually saved.** The second round trip is a millisecond on a
connection that is already open, and `$lookup` performs the same index lookups —
the Manual is explicit that it *"will likely have poor performance if a supporting
index on the `foreignField` does not exist"*, and `_id` is that index either way.
The pipeline moves work to the server without reducing it.

**It makes the missing-document case invisible.** With `$in`, a product that is
gone is simply absent from the result and `?? null` handles it explicitly. With
`$lookup`, the line is present, the joined array is short, and the mismatch has
to be detected by comparing lengths — which nobody does.

`$lookup` earns its place where the join *filters or aggregates*, which is the
**dashboard** *(not written yet)*: joining orders to products to rank
sellers is a real server-side reduction, and shipping the intermediate result to
Node to join it would be absurd. The rule that separates the two cases: **use
`$lookup` when the join makes the result smaller, and `$in` when it makes the
result wider.**

## Where else this appears

| Read | Reference | Resolution |
|---|---|---|
| Cart page | `carts.items[].productId` | `$in` over `products` — above |
| Product page reviews | `reviews.userId` | `$in` over `users`, projecting `displayName` only |
| Order history | `orders.items[].productId` | **none** — the order snapshots name, slug and cover |
| Admin moderation queue | `reviews.productId` + `reviews.userId` | two `$in`s, one per collection |

The third row is the payoff from
[chapter 01 chunk 4](../01-modeling-the-store/03-the-order-document.md), and it
is worth seeing next to the others: order history is the *only* one of these
reads with no hydration step at all, because the order document was deliberately
widened to contain everything it renders. Every other row pays a round trip that
a wider snapshot could have avoided — and does not, because those references
point at data that must stay current.

## Gotchas

**★ Building a lookup map keyed by ObjectId objects silently fails.**
`new Map(docs.map((d) => [d._id, d]))` followed by `map.get(line.productId)`
returns `undefined` for every line, because two ObjectId instances with the same
value are different object keys. `.toString()` on both sides is the fix, and the
bug presents as "every product in the cart is unavailable" — which reads as a
data problem and sends people to the database.

**★ `$in` with an empty array matches nothing, which is usually right and
occasionally not.** An empty cart produces `find({_id: {$in: []}})`, which
returns no documents — correct, and worth short-circuiting anyway to save the
round trip. The bug of the same shape is an `$in` built from a list that a filter
emptied, where the caller reads "no results" as "no matching products" rather
than "I asked for none".

**★ `$in` with a very large array is a large query document.** A thousand
ObjectIds is roughly 12 KB of filter, and the query document is itself subject to
the 16 MiB BSON limit. Carts never approach it; a bulk reorder of a
5,000-line purchase order would put real pressure on it, and the answer there is
batching the `$in` into chunks, not a bigger single query.

**★ `$in` does not preserve order.** The returned documents come back in whatever
order the index scan produced, not in the order of the ids you supplied. Code
that zips two arrays positionally — `ids.map((id, i) => docs[i])` — is wrong and
will look right on small test data where the orders happen to coincide. The map
lookup is what makes it correct; positional pairing is what makes it a bug.

**★ Adding `deletedAt: null` to the hydration filter changes "deleted" into
"missing".** That is intentional here — a soft-deleted product should render as
unavailable in a cart — but it means the `?? null` branch now handles two
different situations, and any UI that wants to distinguish "removed from sale"
from "never existed" needs the filter dropped and the flag returned instead.
Decide which one the page is showing.

**★ Hydrating a reference inside a `map` callback reintroduces N+1 invisibly.**
`items.map(async (line) => await products.findOne({_id: line.productId}))` looks
like one line of clean code and issues one query per cart line. It is the
canonical form of the bug, it passes review because it reads declaratively, and
the only reliable detector is a query counter in tests — the same instrumentation
the [N+1 page](../../../../nodejs/pages/phase-6-data-access/07-n-plus-1.md)
recommends for `pg`.

**★ Projecting the whole user document to render an author name leaks.**
`$in` over `users` without a projection returns `passwordHash` and `email` into
the process, where they end up in logs, caches and error payloads. The projection
on a hydration query is a security control, not only a bandwidth one — and it is
the query most likely to be written quickly because "it's just the name".

## Interview questions

**★ Does a document model eliminate N+1?** No. It eliminates some *sites* where
N+1 could occur, by putting data that is always read together into one document —
so the product page's images and the order's line items are simply there. Every
surviving reference still has the same exposure: a loop that fetches one document
per element is N+1 whether the loop is over SQL rows or array elements. The fix
is also the same — collect the ids, one `$in`, join in memory — which is why the
concept page for `pg` applies unchanged.

**★ When is `$lookup` the right tool and when is `$in` better?** `$lookup` when
the join makes the result *smaller* — an aggregation that groups, filters or ranks
using the joined collection, where shipping the intermediate data to Node would be
absurd. `$in` when the join makes the result *wider* — attaching a product to each
cart line, where the server-side version returns a parallel array you still have
to pair up, saves one round trip that costs a millisecond, and hides the
missing-document case behind an array-length comparison nobody checks.

**★ The cart page shows every product as "unavailable" in production but works
locally. What is your first hypothesis?** A `Map` keyed by ObjectId instances
rather than strings. Two ObjectIds with the same value are different object keys,
so every lookup misses and every line takes the `?? null` branch. It can work
locally if the local code path happens to compare the same instance — for example
when the fixtures build the cart from the same objects the product fetch
returned. The second hypothesis is the `deletedAt: null` filter matching a
seeded-but-soft-deleted catalog.

**★ Why does the order history page need no hydration when the cart page does?**
Because the order snapshots the name, slug and cover key of each line at checkout
time, and the cart deliberately does not. The difference is not a performance
choice, it is a semantic one: an order is a historical assertion and must not
change when the product does, while a cart is a statement of current intent and
*should* show the current price and photo. So the order pays nothing at read
time and the cart pays one `$in` — and copying the product data into the cart to
save that round trip would make the cart lie about the price the shopper is about
to be charged.

**★ How would you detect a hydration N+1 that has already shipped?** Count
queries, not time. A query counter around a request — the driver's command
monitoring, or a wrapper in the repository layer — turns "the cart page is slow"
into "the cart page issues 23 queries", which names the bug immediately. Latency
alone will not do it, because on a fast local database twenty round trips look
like one slow one, and the symptom scales with cart size rather than with data
size, so it stays invisible until a customer with a large cart complains.

{/* FOOTER */}
