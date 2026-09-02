---
title: "Indexing a field inside an embedded array makes the index multikey automatically, and multikey brings four restrictions the document model handed you without asking"
sidebar_label: "9 · Multikey indexes"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/)
> (*"You do not need to explicitly specify an index as multikey"*; *"For each
> distinct value in the array, MongoDB creates a separate entry in the index"*;
> *"In a compound multikey index, each indexed document can have at most one
> indexed field whose value is an array"*; *"You cannot create a compound multikey
> index if more than one field in the index specification is an array"*; *"If a
> compound multikey index already exists, you cannot insert a document that would
> violate this restriction"*; *"Hashed indexes cannot be multikey"*; *"The `$expr`
> operator does not support multikey indexes"*),
> [Unique Indexes](https://www.mongodb.com/docs/manual/core/index-unique/).
> Counterpart: none — Postgres solved this problem with a join table, so there is
> nothing to port.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1 had no multikey indexes because Phase 1 had no arrays: `order_items`
was a table, and "which orders contain this product" was an index on a foreign
key. [Chapter 01](../01-modeling-the-store/02-what-embeds.md) embedded that table
as `orders.items[]`, and the index that answers the same question is now an index
on a field *inside* an array — which MongoDB makes multikey automatically, without
being asked and without saying so. This chunk is what that automatic conversion
brings with it: one index entry per array element, a hard limit of one array field
per compound index that is enforced at *insert* time, a sort that quietly becomes
in-memory, and a covered-query rule that rules out the array itself.**

## You do not ask for a multikey index

> *"You do not need to explicitly specify an index as multikey. If you create an
> index on a field that contains an array value, MongoDB automatically creates
> the index as a multikey index."*
> — [Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/)

There is no `multikey: true` option and no way to decline. The index becomes
multikey the first time a document with an array in that position is indexed, and
`explain()`'s `isMultiKey` field is where you find out.

That matters because **a schema change can turn a plain index into a multikey
one.** A field that has always held a scalar and starts holding an array — a
single tag becoming a tag list — silently changes the index's class, and with it
brings every restriction below onto an index that previously had none.

## The index this app needs

```js
await db.collection('orders').createIndex({userId: 1, 'items.productId': 1});
```

Derived from a query [chapter 01·04](../01-modeling-the-store/03-the-order-document.md)
made necessary: a review may only be written by someone who bought the product, so
posting a review runs

```js
const eligible = await orders.findOne(
  {userId, 'items.productId': productId, status: {$in: ['paid','shipped','delivered']}},
  {projection: {_id: 1}},
);
```

Equality on `userId`, equality on `items.productId`, and a `$in` on `status` that
this index does not carry — so the status check is applied to the fetched
documents. That is deliberate: `userId` plus a product is already selective enough
that the number of candidate orders is small, and adding `status` would make a
third key on an index used by one code path.

**The dotted path is the whole trick.** `'items.productId'` indexes the
`productId` of every element of `items`, so one order with three line items
contributes three entries pointing at the same document:

> *"For each distinct value in the array, MongoDB creates a separate entry in the
> index, and each entry points back to the same document. As a result, a single
> document can have multiple entries in a multikey index. If an array contains
> multiple instances of the same value, the index only includes one entry for the
> value."*

So the index grows with the *total number of line items*, not with the number of
orders. That is the same size the Postgres `order_items(product_id)` index had —
the join table did not disappear, it moved into the parent document and the index
that used to point at it now points at the parent.

## At most one array field per compound index

This is the restriction that shapes what you can build:

> *"In a compound multikey index, each indexed document can have **at most** one
> indexed field whose value is an array."*

with two enforcement points:

> *"You cannot create a compound multikey index if more than one field in the
> index specification is an array."*

> *"If a compound multikey index already exists, you cannot insert a document that
> would violate this restriction."*

Read the second one carefully, because it is the one that bites in production:
**the restriction is enforced on insert, not only on index creation.** An index
created when nobody had arrays in both fields is legal, and every subsequent write
that puts arrays in both fields **fails**. The failure is not in a migration, it
is in a user request, and it arrives whenever the data shape changes rather than
when the index is declared.

For this app the risk is concrete and worth naming. `products` has
`images[]` and `attributes` — and if `attributes` ever became an array rather
than a subdocument, an index spanning both would be uncreatable and, if created
first, would start rejecting product writes. The rule to carry: **an index may
touch at most one of a document's arrays, and which fields are arrays is a
modelling decision that the index quietly depends on.**

## Sorting on a multikey field is usually an in-memory sort

> *"When you sort based on an array field that is indexed with a multikey index,
> the query plan includes an in-memory sort stage unless both of the following are
> true: The index boundaries for all sort fields are `[MinKey, MaxKey]`. No
> boundaries for any multikey-indexed field have the same path prefix as the sort
> pattern."*

The short version: **if you filter on an array field and then sort on it, the
index cannot supply the order.** Which is intuitive once you see why — a document
has several entries in the index, at several positions, so "the document's
position in index order" is not a single thing.

This app never sorts on `items.productId`, so the restriction does not bite. It
would bite immediately on a design like "products sorted by their lowest tag",
and the answer there is a precomputed scalar field to sort on rather than a
cleverer index.

## Unique multikey does not mean unique within the array

> *"In a unique multikey index, a document may have array elements that result in
> repeating index key values as long as the index key values for that document do
> not duplicate those of another document."*

So a unique index on an array field prevents **two documents** sharing a value; it
does not prevent one document listing the same value twice. If the requirement is
"no duplicate line items within an order", a unique multikey index does not
express it and never will — that is an application invariant, enforced by the
guarded `$push` from
[chapter 01·03](../01-modeling-the-store/02b-the-cart-document.md).

Getting this backwards is the classic multikey mistake: the index looks like it
enforces within-array uniqueness, and it enforces across-document uniqueness.

## The other restrictions, briefly

- **Covered queries are possible but narrow.** A multikey index can cover a query
  only if the array field is not in the projection, there is no `$elemMatch`, and
  the ordinary covered-query rules hold — which means, as the Manual notes, *"to
  cover a query, the multikey index must be compound"*. Details in
  [the covered-queries chunk](08-covered-queries.md).
- **`$expr` does not use multikey indexes.** *"The `$expr` operator does not
  support multikey indexes."* So a filter written as an `$expr` comparing two
  fields inside an array is a collection scan, and rewriting it as an ordinary
  predicate is the fix.
- **Hashed indexes cannot be multikey**, and **a multikey index cannot be a shard
  key index**. Neither constrains this app, and both constrain a future one that
  wants to shard on something inside an array.
- **Matching an array as a whole is a two-step.** For
  `find({genres: ['Drama']})`, MongoDB *"uses the multikey index to locate
  documents that contain the first element of that array"* and then *"fetches the
  candidate documents and filters them"*. So exact-array equality is
  index-assisted rather than index-answered, and its `totalDocsExamined` is
  larger than its `nReturned` by construction.

## Gotchas

**★ An index becomes multikey without being asked, and a schema change can
convert one.** There is no option and no warning. A scalar field that starts
holding arrays turns its existing index into a multikey index, importing every
restriction on this page onto an index that previously had none. `isMultiKey` in
`explain()` is where you notice.

**★ The one-array-per-compound-index rule is enforced on insert.** An index that
was legal when created starts **rejecting writes** the day a document has arrays
in two of its keys. The error surfaces in a user request, not in a migration, and
it appears when the data changes rather than when the index is declared.

**★ A unique multikey index does not enforce uniqueness within one document's
array.** It prevents two documents sharing a value. "No duplicate line items in
this cart" is an application invariant and needs a guarded update, not an index.

**★ Sorting on a filtered array field forces an in-memory sort.** A document has
many positions in a multikey index, so the index cannot define its order.
`explain()` shows a `SORT` stage under an `IXSCAN`, which reads like a
misconfigured index and is a structural consequence.

**★ The index grows with total array elements, not with documents.** An index on
`items.productId` over a collection of orders averaging four line items is four
times the entry count of a scalar index on the same collection. That is the cost
the join table used to carry visibly and now carries invisibly.

**★ `$expr` silently opts out of the multikey index.** A predicate rewritten as
`$expr` — usually to compare two fields — stops using the index entirely. The
results are right and the plan is a `COLLSCAN`.

**★ Exact-array equality is a filter, not a seek.** `find({tags: ['a','b']})`
locates candidates by the first element and then filters them, so the
examined-to-returned ratio is poor by design. If the query is common, store a
canonical scalar — a sorted, joined string — and index that instead.

**★ `$elemMatch` changes which documents match *and* whether the index can cover
the query.** `{'items.qty': {$gte: 2}, 'items.productId': pid}` matches a document
where *different* elements satisfy the two conditions; `$elemMatch` requires one
element to satisfy both. The predicates are different questions, and the
`$elemMatch` version additionally cannot be covered.

**★ A multikey index cannot be a shard key index.** Not a constraint today, and a
hard stop on a future decision to shard `orders` by anything inside `items`.

## Interview questions

**★ What makes an index multikey, and how do you find out that one is?**
Indexing a field whose value is an array — including a field reached by a dotted
path into an array of subdocuments. There is no option to request or refuse it:
MongoDB creates the index as multikey automatically when it encounters an array in
that position. You find out from `explain()`, which reports `isMultiKey` on the
winning plan's index scan. The practical importance is that the conversion can
happen later than index creation, when the data shape changes.

**★ Explain the compound multikey restriction and why its enforcement point
matters.**
A compound index may have at most one key whose value is an array *per document*.
MongoDB enforces it twice: it refuses to create such an index if existing data
violates it, and — the part that matters — it refuses the **insert** of any
document that would violate an existing one. So the failure can appear long after
the index was created, in a user-facing write, on the day the data shape changed.
An index built when only one field held arrays becomes a write-blocking constraint
when a second field starts to.

**★ You put a unique index on `orders.items.productId`. What does it actually
enforce?**
That no two *orders* contain the same product — which is almost certainly not what
was wanted, and is catastrophic for a storefront. Within a single document,
repeating values are permitted: the Manual states that a document may have array
elements producing repeated index keys as long as they do not duplicate another
document's. Uniqueness within one array is not an index-expressible constraint at
all; it is an application invariant enforced by a guarded update.

**★ Why does sorting on a multikey-indexed array field usually produce a `SORT`
stage?**
Because a document occupies several positions in a multikey index — one per
distinct array element — so there is no single index position that defines the
document's place in a sort order. The Manual gives the narrow exception: the sort
can be index-supplied only when the index bounds for all sort fields are
unbounded and no bound on a multikey field shares a path prefix with the sort
pattern, which in practice means "you are not filtering on the array". If you need
to sort by something derived from an array, precompute it as a scalar field.

**★ The `order_items(product_id)` index in Postgres and
`orders {userId, 'items.productId'}` here — same cost?**
Roughly the same *size*: both hold one entry per line item, because embedding
moved the rows into the parent document without changing how many there are. What
changed is where the cost is visible and what a lookup returns. In Postgres the
index pointed at line-item rows and a join was needed to get the order; here the
entries point straight at the order document, so the "join" is free — and the
restrictions on this page are the price for that.

**★ A query on an array field is returning correct results but examining ten
times the documents it returns. What are the likely causes?**
Three, in order of likelihood. It is an exact-array-equality query, which the
Manual documents as locating candidates by the array's first element and then
filtering — so the ratio is structural. Or it uses `$elemMatch` semantics in a
query written without `$elemMatch`, matching documents where different elements
satisfy different conditions and then filtering. Or the index is missing a key the
query also filters on, so the index selects a superset. The first is fixed by
storing a canonical scalar; the second by writing `$elemMatch`; the third by
re-deriving the index from the query.

---

← Prev: [TTL restrictions](05b-ttl-restrictions-and-the-deleter.md) ·
Next → [The text index](07-the-text-index.md)
