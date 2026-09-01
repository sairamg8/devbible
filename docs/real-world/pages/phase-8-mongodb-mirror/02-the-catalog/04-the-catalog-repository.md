---
title: "The catalog repository: the module Phase 3 calls, and the projection that decides what travels"
sidebar_label: "5 · The catalog repository"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Project Fields to Return from Query](https://www.mongodb.com/docs/manual/tutorial/project-fields-from-query-results/),
> [`$slice` projection](https://www.mongodb.com/docs/manual/reference/operator/projection/slice/),
> [`find`](https://www.mongodb.com/docs/manual/reference/method/db.collection.find/),
> [`$in`](https://www.mongodb.com/docs/manual/reference/operator/query/in/) —
> and the contract in
> [Phase 3·05](../../phase-3-express-api/05-catalog-endpoints.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**The three previous chunks each solved a piece; this one is the module that
ships. It has the same shape as
[Phase 2's data layer](../../phase-2-node-services/02-the-data-layer.md) — a
repository per entity, domain arguments in, domain shapes out, no driver objects
escaping — and it exposes exactly the three functions Phase 3's catalog routes
already call: `list`, `search`, `product`. The one thing worth studying closely
is the projection, because in a document model the projection is where you decide
how much of the database travels over the wire, and the default is "all of it".**

## The module

```js
// db/mongo/catalog.js
import {ObjectId} from 'mongodb';
import {buildFilter, SORTS} from './products.filter.js';
import {afterCursor} from './keyset.js';
import {encodeCursor, decodeCursor} from './cursor.js';

// what a catalog CARD needs — and nothing else
const CARD_PROJECTION = {
  slug: 1, name: 1, priceCents: 1, stock: 1,
  'category.slug': 1, 'category.name': 1,
  rating: 1,
  images: {$slice: 1},               // the cover, without the gallery
};

export function catalogRepo(db) {
  const products = db.collection('products');
  const reviews  = db.collection('reviews');
  const categories = db.collection('categories');

  return {
    async list({categorySlug, minCents, maxCents, sort = 'newest',
                cursor: raw, limit = 24} = {}) {
      const s = SORTS[sort];
      if (!s) throw new RangeError(`unknown sort: ${sort}`);
      const cursor = decodeCursor(raw);
      if (cursor && cursor.sort !== sort) throw new BadCursorError();

      const filter = buildFilter({categorySlug, minCents, maxCents});
      const keyset = afterCursor(s, cursor);
      const query = Object.keys(keyset).length ? {$and: [filter, keyset]} : filter;
      const sortSpec = s.key === '_id'
        ? {_id: s.dir}
        : {[s.key]: s.dir, _id: s.dir};

      const docs = await products.find(query)
        .project(CARD_PROJECTION).sort(sortSpec).limit(limit + 1).toArray();

      const hasMore = docs.length > limit;
      const page = hasMore ? docs.slice(0, limit) : docs;
      const last = page.at(-1);
      return {
        items: page.map(toCard),
        nextCursor: hasMore
          ? encodeCursor({value: s.key === '_id' ? null : last[s.key],
                          id: last._id, sort})
          : null,
      };
    },

    async search({query, limit = 24, page = 0}) {
      if (page >= 10) return {items: [], hasMore: false};
      const docs = await products.find(
        {$text: {$search: query}, deletedAt: null},
        {projection: {...CARD_PROJECTION, score: {$meta: 'textScore'}}},
      ).sort({score: {$meta: 'textScore'}})
       .skip(page * limit).limit(limit + 1).toArray();
      const hasMore = docs.length > limit;
      return {items: (hasMore ? docs.slice(0, limit) : docs).map(toCard), hasMore};
    },

    async product(slug) {
      const doc = await products.findOne({slug, deletedAt: null});
      if (!doc) return null;
      const rvs = await reviews.find(
        {productId: doc._id, status: 'approved'},
        {projection: {rating: 1, body: 1, createdAt: 1, images: 1}},
      ).sort({createdAt: -1}).limit(20).toArray();
      return toDetail(doc, rvs);
    },

    tree: () => categories.find({}, {projection: {slug: 1, name: 1, parentId: 1}})
                          .sort({name: 1}).toArray(),
  };
}

// the ONE place a document becomes the shape Phase 3's mapper expects
const toCard = (d) => ({
  slug: d.slug, name: d.name,
  price_cents: d.priceCents, stock: d.stock,
  cover: d.images?.[0]?.objectKey ?? null,
  category: d.category,
  rating: d.rating,
});

const toDetail = (d, reviews) => ({
  ...toCard(d),
  description: d.description,
  attributes: d.attributes,
  images: d.images.map((i) => i.objectKey),
  reviews,
});
```

## The projection is the interesting part

In SQL, the select list is compulsory — you name the columns or you type `*` and
someone objects in review. In MongoDB, `find(filter)` returns whole documents by
default, and a whole product document carries a description, an attributes
subdocument and every image. Rendering 24 catalog cards without a projection
transfers 24 product *pages*.

`CARD_PROJECTION` is therefore not an optimisation, it is the query's contract.
Two details:

**`images: {$slice: 1}`** returns only the first element of the array. This is
the document-model replacement for Phase 1's correlated subquery:

```sql
(select object_key from product_images i
  where i.product_id = p.id order by i.position limit 1) as cover
```

Phase 1 needed a subquery to avoid multiplying product rows by their images.
There is no multiplication here — the images are inside the document — so the
whole problem reduces to "send one element of the array". The `$slice` takes the
first array element *in stored order*, which is why
[chapter 01 chunk 2](../01-modeling-the-store/02-what-embeds.md) derives image
positions from array order rather than storing them independently: array order
*is* the display order, and this projection depends on it.

**Dotted paths in the projection**, `'category.slug': 1`, pull two fields out of
the subdocument rather than the whole thing. The category subdocument is three
small fields so it hardly matters here; the habit matters, because the same
pattern applied to an order's `items` array is the difference between a summary
and a full receipt.

## What did not need to change

Phase 3's routes call `catalog.list`, `catalog.search`, `catalog.product` with
the same arguments and map the results with the same `productSummary` and
`productDetail`. Three things made that free:

**`toCard` renames fields to the contract's vocabulary.** `priceCents` becomes
`price_cents`, `images[0].objectKey` becomes `cover`. This is precisely what the
SQL version did in its select list (`p.price_cents`, `… as cover`), moved from
the query text into a function. The route's mapper cannot tell which database
produced the object.

**`in_stock` is still computed in the route's mapper**, from `stock`, and stock
is still not exposed. The repository returns the number; the boundary reduces it
to a boolean. Neither layer changed its mind about who owns that decision.

**`product()` issues two queries and returns one object.** In Postgres this was a
join plus a filtered subquery; here it is a `findOne` and a `find`. Two round
trips is the honest cost of
[not embedding reviews](../01-modeling-the-store/04-what-stays-a-collection.md),
and it is paid on a page that is cached for 60 seconds by both the API and the
browser, which is why the reviews stayed a collection. The general pattern for
resolving references across collections — one `$in`, an in-memory join, and the
missing-document branch — is [chunk 6](04b-hydrating-references.md).

## Gotchas

**★ `find()` without a projection ships the whole document, and nothing warns
you.** The SQL habit of naming columns has no equivalent default here. The
symptom is not an error but a response payload several times larger than the
page needs, and it is most expensive on exactly the endpoint that runs most —
the catalog grid.

**★ Mixing inclusion and exclusion in one projection is an error, except for
`_id`.** `{name: 1, description: 0}` fails. `{name: 1, _id: 0}` is legal, because
`_id` is the documented exception. Reaching for exclusion to "hide one big field"
in an otherwise-inclusive projection is the common way to meet this.

**★ `$slice: 1` on a missing array yields a missing field, not an empty array.**
`d.images?.[0]?.objectKey ?? null` in `toCard` is not defensive noise — a product
whose images have never been uploaded has no `images` field at all, and the
optional chaining is what turns that into `cover: null` rather than a throw. The
validator makes `images` optional deliberately, because a product exists before
its photographs do.

**★ The repository returns `null` for a missing product and the route decides the
status.** Throwing a `NotFoundError` from the repository would be fine too, but
mixing the two — `null` here, a throw there — means every caller has to handle
both. Pick one convention per layer; this layer returns `null` for "no such
document" and throws only for programmer errors like an unknown sort.

**★ `.toArray()` buffers the whole result in memory.** For 25 documents that is
the right call. For the rebuild jobs in
[chapter 01 chunk 11](../01-modeling-the-store/07b-the-rating-summary.md), it is
not, and those iterate the cursor with `for await` instead. The distinction is
the same one the
[Node cursors page](../../../../nodejs/pages/phase-6-data-access/16-cursors.md)
draws for `pg`, and the failure mode — a job that works on staging data and
exhausts memory on production data — is identical.

## Interview questions

**★ Phase 1 used a correlated subquery to get the cover image. What replaced it,
and why is that not just a simplification?** `images: {$slice: 1}` in the
projection. The subquery existed because joining `product_images` would multiply
product rows by their images and force a `DISTINCT ON`; with the images embedded
there is nothing to multiply, so the problem disappears rather than being solved
differently. It is not *only* a simplification, though — it makes the projection
depend on array order being display order, which is why image positions are
derived from array order rather than stored as independent numbers. The
simplification was bought by a modelling decision made three chunks earlier.

**★ Why does `product()` do two queries when the whole point of the document
model was one?** Because reviews are a separate collection, and they are a
separate collection for reasons that outrank this page's round-trip count:
unbounded growth, a moderation queue that queries across products, and a write
rate completely unlike the product's. The two-query cost lands on a page that is
cached for 60 seconds at two layers, so it is paid once per cached minute. The
document model's promise is not "one query for everything" — it is "one query for
the things that are always read together", and reviews are not.

**★ What is the projection actually protecting you from?** Transfer volume and
memory, on the hottest read in the application. A product document carries a
description, an attributes subdocument and an image array; a catalog card needs
six fields. Without a projection the grid ships 24 full product pages per
request, which shows up as bandwidth, as driver-side BSON parsing, and as cache
entries several times larger than necessary. SQL forced the decision by making
the select list compulsory; MongoDB defaults to everything, so the discipline has
to be deliberate.

**★ Why does `toCard` exist when Phase 3 already has `productSummary`?** Because
they answer different questions. `toCard` translates *storage* vocabulary into
*domain* vocabulary — `priceCents` to `price_cents`, an image subdocument to a
key — and is the seam that lets the storage engine change. `productSummary`
translates domain into *public contract* — deciding that `stock` becomes
`in_stock`, that images become URLs — and is the seam that lets the storage stay
private. Collapsing them would work today and would mean that either a schema
change leaks into the contract or a contract change reaches into the query.

**★ Someone proposes returning the driver's cursor from `list()` so the route can
stream.** The repository would then be handing a driver object to the HTTP layer,
which breaks the rule this module is built on — and the practical consequence is
that the route now owns cursor lifetime, so an early client disconnect leaks a
server-side cursor until it times out. Streaming is a real requirement for
exports and bulk jobs, and the shape that satisfies it without leaking is a
repository method that takes a callback or returns an async iterator of *domain
objects*, keeping the driver's cursor inside the layer that knows how to close
it.

{/* FOOTER */}
