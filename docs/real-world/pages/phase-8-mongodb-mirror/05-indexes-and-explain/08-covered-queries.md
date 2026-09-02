---
title: "A covered query never touches a document, and this app has exactly one query worth widening an index to cover"
sidebar_label: "11 · Covered queries"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Query Optimization — Run Covered Queries](https://www.mongodb.com/docs/manual/core/query-optimization/)
> (*"A covered query is a query that can be satisfied entirely using an index and
> doesn't have to examine any documents"*; the three conditions; *"the projection
> document must explicitly specify `_id: 0` to exclude the `_id` field from the
> result since the index doesn't include the `_id` field"*; *"Multikey indexes
> cannot cover queries over array fields"*; *"When run on `mongos`, indexes can
> only cover queries on sharded collections if the index contains the shard key"*),
> [Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/)
> (*"Common query execution stages that examine documents are `COLLSCAN` and
> `FETCH`"*),
> [Text Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/)
> (*"Text indexes can't cover a query"*).
> Counterpart: Postgres calls this an index-only scan
> ([1·10](../../phase-1-database/10-indexes.md)).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**A covered query is MongoDB's index-only scan: the index holds everything the
query needs, so the server never reads a document. It is the cheapest read
available and it is much rarer than it sounds, because the conditions are strict
and because a projection wide enough to be useful is usually wide enough to
disqualify. This chunk works out which queries in this app could be covered, finds
exactly one worth paying for — the session lookup on the hot path of every
authenticated request — and then argues both sides of paying for it.**

## The three conditions

> *"A covered query is a query that can be satisfied entirely using an index and
> doesn't have to examine any documents. An index covers a query when all of the
> following apply:*
>
> - *All the fields in the query (both as specified by the application and as
>   needed internally such as for sharding purposes) are part of an index.*
> - *All the fields returned in the results are in the same index.*
> - *No fields in the query are equal to `null`."*

And the trap that catches everyone on the first attempt:

> *"For the specified index to cover the query, the projection document must
> explicitly specify `_id: 0` to exclude the `_id` field from the result since the
> index doesn't include the `_id` field."*

**`_id` is returned by default.** So a projection that names the fields it wants
and says nothing about `_id` is asking for a field the index does not hold, and
the query is not covered. One missing `_id: 0` is the difference between an
index-only read and a fetch per document, with no other symptom.

The third condition — no `null` equality — connects back to
[chapter 02's filter gotcha](../02-the-catalog/01-the-filter-document.md): a
predicate of `{field: null}` matches both explicit nulls and missing fields, and
the index cannot distinguish them, so the server must look at the documents. That
is a real constraint here, because the catalog's standing filter *is*
`deletedAt: null` — and it is why none of the catalog queries can ever be covered,
independently of their projections.

## The signature in `explain()`

The Manual states the structural signature exactly:

> *"When an index covers a query, the explain result has an `IXSCAN` stage that is
> **not** a descendant of a `FETCH` stage."*
> — [Explain Results — Covered Queries](https://www.mongodb.com/docs/manual/reference/explain-results/)

and the numeric one follows from it:

- **`totalDocsExamined: 0`** — the query examined no documents at all.
- **`nReturned` greater than zero** — it did return some.

`FETCH` is one of the stages the Manual names as examining documents, so the two
statements are the same fact seen from the plan tree and from the counters.
Reading these fields properly is
[chunk 15](11-the-ratio-and-the-sort-stage.md).

## The one query in this app worth covering

Every authenticated request resolves a session token:

```js
export const findSession = (db, tokenHash) =>
  db.collection('sessions').findOne(
    {tokenHash},
    {projection: {_id: 0, userId: 1, expiresAt: 1}});
```

Three fields, one equality predicate, and it runs on **every request**. It is
the hottest read in the application by a wide margin — hotter than the catalog,
because the catalog is cached and a session lookup is not.

Today it uses `{tokenHash: 1}` unique, finds one index entry, and fetches the
document to read `userId` and `expiresAt`. Covering it means an index that holds
all three:

```js
await db.collection('sessions').createIndex(
  {tokenHash: 1, userId: 1, expiresAt: 1});   // NOT unique — see below
```

with the projection already written correctly: `_id: 0` present, only indexed
fields requested.

**It cannot be the same index as the unique one.** Making the compound index
unique would enforce uniqueness of the *triple*, not of `tokenHash` — the
constraint that actually matters — so the unique single-field index has to stay
and the covering index is a second structure. The Manual is explicit that basic
and unique indexes can coexist with the same key pattern; here the patterns differ
anyway.

### Is it worth it?

The honest ledger:

| | Covering it | Leaving it |
|---|---|---|
| Reads per request | index only | index + one document fetch |
| Indexes on `sessions` | 3 (unique, TTL, covering) | 2 |
| Write cost per login | 3 index entries | 2 |
| Write cost per session delete | 3 | 2 |
| Index size | larger — three keys per session | smaller |
| Failure mode if the projection drifts | silently uncovered | n/a |

Sessions are written once at login and deleted once at expiry, and read on every
request — an extremely read-heavy ratio, which is the profile that justifies a
covering index. Against that: **the sessions collection is small and hot**, so the
document being fetched is almost certainly already in the cache, and the saving is
a pointer chase rather than a disk read.

**This app does not add it**, and the reason is the last row of the table. A
covering index is only covering while the projection continues to match it exactly;
the day someone adds `role` to the session lookup's projection — a plausible
one-line change — the index silently stops covering and the only evidence is
`totalDocsExamined` going from zero to one. That is a fragile optimisation to buy
a cache hit.

It is written down here because it is the *right* candidate, and because "we
considered covering the session lookup and declined" is a more useful artefact
than silence.

## Why the catalog cannot be covered

The catalog card projection from
[02·05](../02-the-catalog/04-the-catalog-repository.md):

```js
const CARD_PROJECTION = {
  slug: 1, name: 1, priceCents: 1, stock: 1,
  'category.slug': 1, 'category.name': 1,
  rating: 1,
  images: {$slice: 1},
};
```

Three independent disqualifications, and it is worth having all three because each
one is a general rule:

**The `deletedAt: null` predicate.** A `null` equality in the query, which the
third condition forbids outright. No projection can rescue it.

**The `images` array.** *"Multikey indexes cannot cover queries over array
fields."* The projection returns an array field, so even an index containing it
could not cover the query — and `$slice` is a projection operator, not something
an index can evaluate.

**The width.** Covering would need an index holding eight fields including a
subdocument, which is most of the document. At that point the index *is* the
collection, with all the write cost and none of the benefit.

The general rule this yields: **covered queries suit narrow lookups, not
list-and-display reads.** A read that exists to render something to a user
usually wants most of the document, and an index that holds most of the document
is a second copy of the collection.

## The other exclusions

- **Text indexes cannot cover a query**, ever
  ([chunk 10](07-the-text-index.md)). So search always fetches.
- **Multikey indexes can cover queries over the *non-array* fields** *"if the
  index tracks which field or fields cause the index to be multikey"*, and never
  over the array field itself. And per the multikey page, a covering multikey
  index must be compound and the query must not use `$elemMatch`.
- **On a sharded collection**, *"indexes can only cover queries on sharded
  collections if the index contains the shard key"* — because `mongos` needs the
  shard key internally, and the first condition counts fields *"needed internally
  such as for sharding purposes"*. Not a constraint today; a real one for any
  future sharding decision.

## Gotchas

**★ Forgetting `_id: 0` uncovers the query.** `_id` is returned by default, the
index does not contain it, so the server fetches every document to supply it. The
results are identical and the plan is not. This is the single most common reason a
query that should be covered is not.

**★ Any `null` equality in the predicate disqualifies the query.** `{field:
null}` and `{field: {$eq: null}}` both match missing fields as well as explicit
nulls, which the index cannot distinguish. Since this app's catalog filter is
`deletedAt: null`, no catalog query can be covered regardless of projection.

**★ A covering index is covering only while the projection matches it.** Adding
one field to the projection silently uncovers the query. There is no error, no
warning, and no test that catches it unless a test asserts on the plan. That
fragility is a legitimate reason to decline the optimisation.

**★ A multikey index cannot cover a query that returns the array field.** It can
cover one over the non-array fields of the same index. So "give me the `userId`
of orders containing this product" is coverable; "give me the items" is not.

**★ Text indexes never cover.** Every `$text` query fetches its documents. There
is no configuration that changes this.

**★ Making a covering index unique changes what is unique.** Widening
`{tokenHash: 1}` unique into `{tokenHash: 1, userId: 1, expiresAt: 1}` unique
enforces uniqueness of the triple and lets two sessions share a token hash — a
security hole introduced by a performance change. The covering index must be a
separate, non-unique index.

**★ Covered queries need the fields in *one* index.** Not "in some index": the
Manual says *"All the fields returned in the results are in the same index"*.
MongoDB will not assemble a covered result from two indexes, which is one more
consequence of it disfavouring index intersection
([chunk 12](09-index-intersection.md)).

**★ On a sharded collection, the shard key must be in the index.** Because the
query's internally-needed fields count toward the first condition. An index that
covers a query on a replica set can stop covering it the day the collection is
sharded.

**★ "Covered" is not a property you can request.** There is no option and no
hint. It is an emergent property of index, predicate and projection agreeing,
which is why the only way to know is `explain()` and the only way to keep it is a
test that asserts on the plan.

## Interview questions

**★ What is a covered query and how do you verify one?**
A query the server answers entirely from an index, examining no documents — the
MongoDB name for what Postgres calls an index-only scan. The conditions are that
every field in the predicate is in one index, every field returned is in that same
index, and no field in the predicate is compared to `null`. You verify it with
`explain()`: `totalDocsExamined` is zero and the winning plan has no `FETCH` stage
under the `IXSCAN`, because `FETCH` is one of the stages the Manual names as
examining documents.

**★ Why does forgetting `_id: 0` break it?**
Because `_id` is included in a projection by default, so the query is asking for a
field the index does not contain, and the server must fetch each document to
supply it. The results are byte-identical to the covered version — only the plan
differs — so nothing surfaces the mistake except reading `explain()`. It is the
most common reason a query that looks coverable is not.

**★ Which query in this app is the best candidate for a covering index, and would
you build it?**
The session lookup: one equality on `tokenHash`, a three-field projection, and it
runs on every authenticated request, which is the most read-heavy ratio in the
system. The index would be `{tokenHash: 1, userId: 1, expiresAt: 1}`, and it has
to be a *second*, non-unique index — widening the existing unique index would make
the triple unique instead of the token hash, which is a security hole. I would not
build it. The sessions collection is small and hot, so the fetch it saves is
almost certainly a cache hit rather than a disk read, and the optimisation is
fragile: one field added to the projection silently uncovers it, with no symptom
but a changed plan.

**★ Why can no catalog query be covered?**
Three independent reasons, any one of which is sufficient. The standing filter is
`deletedAt: null`, and a null equality disqualifies a covered query outright
because the index cannot distinguish an explicit null from a missing field. The
projection returns the `images` array, and multikey indexes cannot cover queries
over array fields. And the projection is eight fields wide including a subdocument,
so a covering index would be a second copy of the collection with all of the write
cost and none of the benefit.

**★ When is a covering index the right tool?**
Narrow, high-frequency lookups where the projection is small, stable and entirely
scalar — a token-to-user resolution, an existence check, a counter read. It is the
wrong tool for anything that renders a list to a user, because those reads want
most of the document, and an index holding most of the document is a duplicate of
the collection that must be maintained on every write. The rule of thumb: if you
would not be comfortable writing the projection out as an index key list, the query
should not be covered.

**★ Could MongoDB cover a query using two indexes?**
No. The Manual requires all the returned fields to be *"in the same index"*. This
is one more downstream consequence of MongoDB disfavouring index intersection: not
only will the planner rarely combine two indexes to satisfy a predicate, it will
never combine them to satisfy a projection. Postgres, which uses bitmap index
scans routinely, still cannot do this either — an index-only scan there is also
single-index — so this is a shared limitation rather than a MongoDB one.

---

← Prev: [The text index](07-the-text-index.md) ·
Next → [Index intersection](09-index-intersection.md)
