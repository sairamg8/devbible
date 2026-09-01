---
title: "Building the filter document: the same composable filters, and the injection that SQL never had"
sidebar_label: "1 · The filter document"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the **MongoDB Manual (8.0)** —
> [Query Documents](https://www.mongodb.com/docs/manual/tutorial/query-documents/),
> [Comparison Query Operators](https://www.mongodb.com/docs/manual/reference/operator/query-comparison/),
> [`$where`](https://www.mongodb.com/docs/manual/reference/operator/query/where/),
> [`$expr`](https://www.mongodb.com/docs/manual/reference/operator/query/expr/),
> [Query on Embedded/Nested Documents](https://www.mongodb.com/docs/manual/tutorial/query-embedded-documents/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Phase 1's catalog query](../../phase-1-database/04-the-catalog-query.md) built
SQL by assembling *clauses* from a fixed set with `$n` placeholders, because a
value interpolated into SQL is an injection and an identifier from a user is a
catastrophe. MongoDB removes half of that problem and introduces a new half. The
query is a BSON document, so there is no string to interpolate and no parser to
confuse — but a *value* that arrives as an object instead of a scalar becomes an
operator, and `{price: {$gt: 0}}` where you expected `{price: 1999}` is a filter
the user wrote. The defence is not escaping; it is knowing the type of every
value before it reaches the filter.**

## The same filters, a different medium

The storefront's filters are unchanged from Phase 1: category, price floor,
price ceiling, and the standing "not deleted" predicate. In SQL each was a
clause appended to a `WHERE`. Here each is a key added to an object:

```js
// db/mongo/products.js
function buildFilter({categorySlug, minCents, maxCents}) {
  const filter = {deletedAt: null};              // the standing filter, always

  if (categorySlug) filter['category.slug'] = categorySlug;

  if (minCents != null || maxCents != null) {
    filter.priceCents = {};
    if (minCents != null) filter.priceCents.$gte = minCents;
    if (maxCents != null) filter.priceCents.$lte = maxCents;
  }
  return filter;
}
```

Three things are worth noticing before the interesting part.

**`category.slug` is a dotted path into the embedded copy.** That copy is
[chunk 10 of chapter 01](../01-modeling-the-store/07-denormalization-and-staleness.md),
and this line is its justification: with it, the category filter is an indexed
equality predicate in the same collection as the sort. Without it, the pipeline
needs a `$lookup` before it can filter, and the compound index in
**chapter 05** *(not written yet)* stops applying.

**Both price bounds go into one operator document.** Writing
`filter.priceCents = {$gte: min}` and then `filter.priceCents = {$lte: max}`
replaces the first — a plain-JavaScript mistake with no MongoDB flavour at all,
and one that silently drops a filter rather than erroring. Build the operator
object once and add to it.

**`{deletedAt: null}` matches both an explicit `null` and a missing field.** That
is documented MongoDB behaviour and it is convenient here, because it means the
filter is right whether or not a legacy document has the field. The validator in
[chapter 01](../01-modeling-the-store/06-constraints-that-vanish.md) requires the
field to be present anyway, so the two agree; relying on the equivalence without
the validator is how a partial index later fails to apply to half the collection.

## The injection MongoDB does have

SQL injection needs a parser: you smuggle syntax into a string that will be
parsed as code. A MongoDB query is already a data structure, so there is no
parse step to attack — which is why "MongoDB is immune to injection" gets said,
and why it is wrong.

The attack is a **type** attack. Consider a filter built directly from request
input:

```js
// DO NOT — no type guarantee on the way in
const filter = {deletedAt: null, priceCents: {$gte: req.query.min_cents}};
```

If `min_cents` arrives as the string `"1999"`, the comparison is
string-against-number and matches nothing — a bug. If it arrives as an *object*,
because the query-string parser was configured to build nested objects and the
client sent `?min_cents[$gt]=`, then `req.query.min_cents` is `{$gt: ''}` and
the filter becomes `{priceCents: {$gte: {$gt: ''}}}` — a filter the attacker
composed. The same shape applied to an authentication lookup —
`findOne({email, passwordHash: req.body.password})` where `password` is
`{$ne: null}` — is the textbook credential bypass.

The defence is exactly the one Phase 3 already built and this chapter simply
insists on:

```js
// Phase 3, catalog.schemas.js — the validation boundary does the work
export const ListProductsQuery = z.object({
  category:   z.string().regex(/^[a-z0-9-]+$/).optional(),
  min_cents:  z.coerce.number().int().min(0).optional(),
  max_cents:  z.coerce.number().int().min(0).optional(),
  sort:       z.enum(['newest', 'price_asc', 'price_desc']).default('newest'),
  cursor:     z.string().optional(),
  limit:      z.coerce.number().int().min(1).max(48).default(24),
});
```

`z.coerce.number()` on an object produces `NaN` and fails the schema, so the
operator never reaches the driver. **The rule that generalises: every value that
becomes part of a filter must be a scalar of a known type, and the place that
guarantees it is
[the validation boundary](../../phase-3-express-api/02-the-validation-boundary.md),
not the data layer.** The data layer's job is to assume the guarantee and be
readable; adding defensive `typeof` checks in `buildFilter` would express doubt
about a boundary that either works or needs fixing.

Where a value genuinely cannot be schema-validated — a dynamic admin filter, a
saved-search feature — the second line of defence is to construct the operator
document yourself from an allow-list, never to spread user input into it:

```js
// admin filters: the operator is chosen by the server, the value is a scalar
const OPS = {eq: '$eq', gte: '$gte', lte: '$lte'};
function adminClause(field, op, rawValue) {
  const mongoOp = OPS[op];
  if (!mongoOp) throw new RangeError(`unknown operator: ${op}`);
  if (typeof rawValue !== 'string' && typeof rawValue !== 'number') {
    throw new TypeError('filter values must be scalars');
  }
  return {[field]: {[mongoOp]: rawValue}};
}
```

That is the direct analogue of Phase 1's `SORTS` allow-list, and for the same
reason: the one part of a query you cannot take from a user is the part that
says what the query *does*.

## The two operators to keep away from user input entirely

**`$where` runs JavaScript on the server.** It cannot use an index, it is
disabled in some deployments, and a `$where` string built from user input is
remote code execution in the query engine. There is no filter in this app that
needs it.

**`$expr` is safe but is not a place for user-supplied expressions.** It brings
the aggregation expression language into the query — legitimately useful for
comparing two fields in the same document, which is the one thing an ordinary
filter cannot do — and it is used deliberately in
[chapter 01's validator](../01-modeling-the-store/06-constraints-that-vanish.md).
Assembling an `$expr` tree from request input hands the user a small programming
language.

## Sorting is an allow-list, exactly as before

```js
const SORTS = {
  newest:     {key: '_id',        dir: -1},
  price_asc:  {key: 'priceCents', dir:  1},
  price_desc: {key: 'priceCents', dir: -1},
};
```

Field *names* in a MongoDB sort are strings in a document, so unlike SQL there is
no identifier-injection hazard in the classic sense — but a user-chosen sort
field is still a user-chosen *index*, and the practical consequence is a query
that sorts an unindexed field, which the Manual is clear costs a 100 MB in-memory
sort or a spill to disk. The allow-list is now a performance control rather than
a security one, and it is just as non-negotiable.

`newest` sorts by `_id` rather than `createdAt`, because
[ObjectId leads with a timestamp](../../../../mongodb/pages/phase-1-documents-and-bson/03-objectid.md)
and `_id` is indexed unconditionally — a genuine simplification over Postgres's
`(created_at, id)` pair, and one that [chunk 2](02-keyset-pagination.md) leans on
hard.

## Gotchas

**★ A string where a number belongs matches nothing, silently.** BSON compares
across numeric types but a string is a different BSON type entirely, so
`{priceCents: {$gte: "1999"}}` returns an empty page rather than an error. This
is the single most common "the filter isn't working" bug in a Node/Mongo stack,
and it is why `z.coerce.number()` rather than `z.number()` is the right schema —
query strings arrive as strings by construction.

**★ Assigning `filter.priceCents` twice discards the first operator.** Not a
MongoDB issue at all, but it presents as one: the min filter vanishes and the
page shows cheap products the user filtered out. Build the operator object once.

**★ `{field: null}` matches missing fields too, and `{field: {$eq: null}}`
behaves the same way.** To match *only* documents where the field is explicitly
null, the predicate is `{field: {$type: 'null'}}`; to match only missing ones,
`{field: {$exists: false}}`. The catalog wants the permissive version and gets
it by accident, which is fine until a partial index is defined with the strict
predicate and then applies to a different set of documents than the query does.

**★ Dotted paths do not need `$elemMatch` here, but they will the moment an array
is involved.** `{'category.slug': 'desks'}` is unambiguous because `category` is
a subdocument. `{'items.qty': {$gte: 2}}` on an *array* matches a document where
*any* element has qty ≥ 2 — and `{'items.qty': {$gte: 2}, 'items.productId': X}`
matches a document where one element satisfies each condition, not necessarily
the same element. `$elemMatch` is what says "one element satisfies all of these",
and forgetting it is a correctness bug that only appears with multi-line carts.

**★ An empty filter object matches everything.** `buildFilter({})` returns
`{deletedAt: null}` here, deliberately, so the standing filter is never absent.
A refactor that makes the standing filter conditional produces a function that
can return `{}` — and `find({})` on the products collection is a full collection
scan that also returns soft-deleted products to the storefront. The standing
filter is unconditional for the same reason Phase 1 put `deleted_at is null` in
the base `where`.

**★ `$regex` for a "search-as-you-type" filter looks harmless and is not.** An
unanchored regular expression cannot use an index, and one built from user input
can be made to backtrack catastrophically. Prefix-anchored regexes
(`/^walnut/`) can use an index, which is why the temptation exists — but the
catalog's text search belongs in [chunk 3](03-search.md), not in the filter
document.

## Interview questions

**★ Is MongoDB immune to injection because queries are documents rather than
strings?** No — it is immune to *parser* injection and exposed to *type*
injection. There is no string being parsed as code, so smuggling syntax is
impossible; but a value that arrives as an object instead of a scalar becomes an
operator document, and `{password: {$ne: null}}` is a credential bypass written
by the client. The defence is not escaping, because there is nothing to escape:
it is guaranteeing the type of every value before it enters the filter, which is
the validation boundary's job.

**★ Why is the sort allow-list still mandatory if there is no identifier
injection?** Because it stopped being a security control and became a performance
one. A user-chosen sort field is a user-chosen index, and a sort on an unindexed
field is an in-memory sort against a documented 100 MB limit — so an arbitrary
`?sort=description` is a cheap way to make the catalog slow or make it spill to
disk. The allow-list also keeps the set of sorts equal to the set of indexes,
which is the invariant **chapter 05** *(not written yet)* is built
on: every sort the API offers has an index that serves it.

**★ Why does `category.slug` live on the product instead of being resolved
through `categories`?** Because the filter and the sort have to be served by one
index scan. With the copy, `{'category.slug': 'desks'}` is an equality predicate
that becomes the leading field of a compound index whose remaining fields are the
sort — the ESR shape. Resolving the slug through a `$lookup` puts a join before
the match, which means the match happens on the lookup's output rather than on
an index, and every catalog page becomes a scan. The denormalisation exists for
this one line.

**★ When would you use `$expr`, and why not for user input?** For comparing two
fields of the same document — "orders where `totalCents` differs from the sum of
the lines", the kind of rule an ordinary filter cannot express because a query
document compares a field to a *constant*. It is safe by itself. It is not a
place for user-supplied structure, because the aggregation expression language is
a small programming language, and assembling one from request data gives the user
control over what the server computes rather than merely over which documents it
returns.

**★ Phase 1 assembled SQL clauses; this assembles object keys. Which is easier to
get wrong, and how?** The object version is easier to get *silently* wrong. A
malformed SQL clause raises a syntax error at the database; a malformed filter
document is usually a *valid* filter that means something else — an overwritten
key drops a bound, a string where a number belongs matches nothing, a missing
`$elemMatch` matches the wrong documents. There is no parser to catch you, so the
errors surface as wrong results rather than as failures, and the compensating
discipline is that every filter shape gets a test asserting the *count* of
matching documents, not merely that the call succeeded.

{/* FOOTER */}
