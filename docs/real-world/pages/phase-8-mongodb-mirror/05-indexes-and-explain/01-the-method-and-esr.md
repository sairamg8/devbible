---
title: "Every index is derived from a query somebody wrote, and the ordering rule that decides the columns is ESR — which is not the leftmost-prefix intuition Postgres taught you"
sidebar_label: "1 · The method and ESR"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [ESR guideline](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/)
> (*"Ensure that equality fields always come first"*; *"If avoiding in-memory
> sorts is critical, place sort fields before range fields (ESR)"*; *"If your
> range predicate in the query is very selective, then put it before sort fields
> (ERS)"*; *"When `$in` is used alone, it is an equality operator that performs a
> series of equality matches"*),
> [Compound Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/),
> [Indexing Strategies](https://www.mongodb.com/docs/manual/applications/indexes/).
> Counterpart: [1·10 — indexes](../../phase-1-database/10-indexes.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1's index chapter opened with a discipline rather than a list: an index
is bought twice, once at write time and once in memory, so the rule is **derive
each index from a query this app actually runs, and be able to say which one**.
That discipline ports unchanged and this chapter is the derivation, query by
query. What does not port unchanged is the *ordering* rule. Postgres taught you
leftmost-prefix — equality columns first, then whatever — and MongoDB's guideline
is more specific and occasionally the reverse: **Equality, Sort, Range**, with a
documented exception where a very selective range should jump ahead of the
sort.**

## The method

For each query shape written in chapters 01–04:

1. **List the predicates** and label each one *equality*, *sort* or *range*.
2. **Order the index keys** E, then S, then R — with the sort keys in the same
   order and the same direction the query uses.
3. **Add the app's standing filter as a `partialFilterExpression`** if every
   query of that shape carries it (`deletedAt: null`, `status: 'approved'`,
   `processedAt: null`).
4. **Check it with `explain()`** — the expected index name in the winning plan,
   no `SORT` stage where the index should have supplied the order, and a
   `totalDocsExamined`-to-`nReturned` ratio near one.

Steps 1–3 are this chunk and the next few; step 4 is
[chunk 13, reading `explain()`](10-explain-verbosity-and-stages.md).

The rule that governs the whole exercise: **an index you cannot name a query for
is deleted.** Every index is maintained on every write to the collection, and a
speculative index is a permanent tax paid for a query nobody runs.

## Equality, Sort, Range

The Manual states it as a guideline, and the core sentence is short:

> *"Ensure that equality fields always come first. Placing equality fields first
> keeps the remaining index fields in sorted order."*
> — [ESR guideline](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/)

That second sentence is the mechanism and it is the whole reason the rule works.
An index is a B-tree sorted by its keys in order. **An equality predicate on the
leading key narrows the scan to one contiguous stretch of the tree — and within
that stretch, the remaining keys are still in sorted order.** So the sort is free:
the server walks the range and the documents come out already ordered.

Put a *range* first instead and the narrowing is still contiguous, but the second
key is no longer sorted within it — each distinct value of the first key restarts
the ordering of the second. The server has to collect everything and sort it,
which is the blocking `SORT` stage.

The definitions the Manual gives:

| Term | The Manual | In this app |
|---|---|---|
| **Equality** | *"an exact match on a single value"* | `category.slug`, `status`, `userId`, `slug` |
| **Sort** | *"determines the order for results"* | `priceCents`, `createdAt`, `_id` |
| **Range** | *"filters scan fields. The scan doesn't require an exact match, which means range filters are loosely bound to index keys"* | `priceCents` between two values, `createdAt` in a window |

Note that `priceCents` appears in two rows. **A field can be a sort key in one
query and a range key in another**, and that is exactly why the catalog needs
more than one index — chunk 2's list has both `(category.slug, priceCents, _id)`
and the reason it does not also serve the price-*filtered* newest-first sort.

## The exception the guideline states out loud

ESR is not absolute, and the Manual says so in the same paragraph:

> *"Choose whether to use a sort or range field next based on your index's
> specific needs: If avoiding in-memory sorts is critical, place sort fields
> before range fields (ESR). If your range predicate in the query is very
> selective, then put it before sort fields (ERS)."*

So the ordering is a trade, not a law:

- **ESR** — the index supplies the order, so no blocking sort, but the range is
  applied by scanning more index entries than match.
- **ERS** — the range narrows first, so fewer index entries are touched, but the
  results come out unordered and a `SORT` stage appears.

The decision rule that falls out: **ESR when the query is paginated, ERS when the
range is very selective and the result set is small.** A paginated query cannot
afford a blocking sort, because the sort must see every matching document before
it can return the first page — the cost is proportional to the whole filtered set
regardless of the page size. A one-off report returning forty rows can absorb a
sort of forty rows quite happily.

This app is almost entirely the first case: the catalog is paginated, the order
history is paginated, and the dashboard's sorts happen after a `$group` that has
already collapsed the stream. So **ESR everywhere, and the two places ERS would
win are noted where they occur.**

## How this differs from the Postgres intuition

Phase 1's rule was the leftmost-prefix rule: a B-tree on `(a, b, c)` serves
queries constraining `a`, or `a` and `b`, or all three — a prefix, in order.

That rule is *also* true in MongoDB, and the Manual's compound-index page states
the same prefix behaviour. ESR is not a replacement for it; **ESR is guidance
about which fields to put in which prefix position**, which Postgres left you to
work out from first principles.

Two concrete differences worth having in mind:

**Postgres's planner has index-only scans, bitmap heap scans and index
intersection as everyday tools.** MongoDB's has covered queries (rarer, see
[chunk 11](08-covered-queries.md)) and disfavours index intersection so strongly
that the Manual tells you not to design for it (**chunk 9**
[chunk 12](09-index-intersection.md)). The practical consequence is that **MongoDB pushes you
toward one well-ordered compound index per query shape**, where Postgres would
sometimes let two single-column indexes cooperate.

**Direction matters in both, and matters the same way.** An index on
`(a: 1, b: -1)` serves `sort({a: 1, b: -1})` and its exact reverse
`sort({a: -1, b: 1})`, and does not serve `sort({a: 1, b: 1})`. This is identical
to Postgres's `(a asc, b desc)` behaviour, and it is the reason the catalog's
keyset index spells out its directions rather than defaulting them.

## `$in` counts as equality

> *"When `$in` is used alone, it is an equality operator that performs a series of
> equality matches."*

That sentence settles a question the dashboard raised in
[04·01](../04-the-dashboard/01-revenue-by-day.md): the revenue `$match` filters
`status: {$in: ['paid','shipped','delivered']}` and ranges on `createdAt`, and the
index is `{status: 1, createdAt: -1}` — status *first*, because `$in` is an E and
not an R.

There is a documented size threshold. The Manual notes that when `$in` is used
with `.sort()`, *"If `$in` has fewer than 201 array elements, the elements are
expanded and then merged in the sort order specified for the index using a
`SORT_MERGE` stage"*, and beyond that *"It isn't possible for the subsequent
fields in the index to be used for sorting"*. Three statuses is comfortably under
201; a `$in` built from a user-supplied list of ids is not necessarily, and that
is the case where an `$in` quietly stops behaving like an equality.

## What the method rejects

Being able to name the query is a filter that removes real indexes people write:

- **`products.stock`** — never filtered on its own. The catalog's `in_stock`
  boolean is derived in the projection, not queried.
- **`orders.status` alone** — five values, so the index is barely selective, and
  every query that filters on status also ranges on `createdAt`, which is the
  compound index.
- **`users.role`** — two values, queried by an admin screen that reads tens of
  rows.
- **`reviews.rating`** — the rating summary is recomputed by product, not by
  rating ([01·11](../01-modeling-the-store/07b-the-rating-summary.md)).

Each absence is a write cost saved on every insert and update to that collection.
Phase 1 made the same list for the same reason, and it is worth writing down
because **an absent index leaves no trace** — nobody reviewing the schema later
can tell the difference between "we decided against it" and "we forgot".

## Gotchas

**★ ESR is a guideline with a documented exception, not a law.** The Manual
itself gives ERS for a very selective range. Reciting "always ESR" in a design
review is repeating half a sentence; the other half is about which cost you are
choosing to pay.

**★ A field is not intrinsically E, S or R — the *query* decides.** `priceCents`
is a sort key in "cheapest first" and a range key in "under 50 euros", and the
same index cannot be optimal for both. This is why one collection ends up with
several compound indexes rather than one clever one.

**★ `$in` is an equality until it is 201 elements long.** Under the threshold the
planner expands it and can still use later index fields for the sort, via a
`SORT_MERGE`. Over it, the sort falls back. A `$in` whose length is user input
therefore has a cliff in it, and the fix is to clamp the list before it reaches
the query.

**★ Index direction is part of the index.** `{a: 1, b: -1}` and `{a: 1, b: 1}`
are different indexes serving different sorts. A single-key index serves both
directions; a compound one serves its declared pattern and its exact mirror, and
nothing else.

**★ An index you cannot name a query for is a permanent write tax.** Every insert
and every update touching an indexed field maintains every index on that field.
"Indexing to be safe" is paying forever for a query that was never written.

**★ Deriving from queries means the query and the index must move together.**
The moment somebody adds a filter to the catalog and does not revisit the index,
the plan silently degrades — the index is still used, it just selects a superset
that the filter then discards. The diagnostic is the docs-examined-to-returned
ratio, not an error.

**★ MongoDB will not compensate with index intersection the way Postgres often
does.** The Manual's own guidance is that *"Schema designs should not rely on
index intersection. Instead, compound indexes should be used."* So the habit of
creating single-column indexes and trusting the planner to combine them ports
badly.

## Interview questions

**★ State the ESR rule and explain *why* equality comes first.**
Equality, then Sort, then Range. Equality first because an exact match on the
leading key narrows the scan to one contiguous stretch of the B-tree, and within
that stretch the remaining index keys are still in sorted order — so the sort is
supplied by the walk and no blocking sort is needed. Put a range first and the
narrowing is still contiguous, but the second key restarts its ordering for every
distinct value of the first, so the order is gone and the server must materialise
and sort.

**★ When is ERS right instead?**
When the range predicate is very selective and avoiding an in-memory sort is not
critical — the Manual states exactly this exception. Putting the range before the
sort touches far fewer index entries, at the cost of a blocking `SORT` stage on
the survivors. It is a good trade for a small, non-paginated result and a bad one
for a paginated query, because a blocking sort has to see every matching document
before returning the first page, so its cost is independent of the page size.

**★ How does ESR relate to the leftmost-prefix rule you learned in Postgres?**
It sits on top of it. The prefix rule is still true — a compound index serves
queries that constrain a prefix of its keys, in order — and it tells you *what an
index can serve*. ESR tells you *which fields to put in which position* so that
the index serves the query well rather than merely legally. Postgres has the same
underlying B-tree behaviour and simply never packaged the guidance under a name.

**★ Is `$in` an equality or a range for the purposes of ESR?**
An equality. The Manual: *"When `$in` is used alone, it is an equality operator
that performs a series of equality matches."* So a filter on
`status: {$in: [...]}` plus a range on `createdAt` wants
`{status: 1, createdAt: -1}`, status first. The caveat is the documented
201-element threshold: below it the planner expands the list and can still use
later index keys for sorting via a `SORT_MERGE` stage; above it, subsequent index
fields cannot be used for the sort.

**★ Why does this chapter refuse to index `orders.status` on its own?**
Because no query filters on status alone. Every query that constrains status also
constrains a time range, so the useful index is the compound one — and a
standalone index on a five-value field is barely selective anyway, which means
the planner would usually decline it even if it existed. The general form: an
index is derived from a query shape, and a query shape includes every predicate
that shape carries.

**★ You inherit a collection with fourteen indexes. How do you decide which to
drop?**
Name the query for each. Anything you cannot attribute goes on the list, and
`$indexStats` gives usage counts to confirm that the list is not being used in
some path you missed — the MongoDB counterpart of Phase 1's
`pg_stat_user_indexes.idx_scan = 0`. Then check for redundancy: an index whose
key pattern is a prefix of another index's is usually removable, because the
longer index serves the shorter one's queries. The exceptions are indexes with
different partial filters or collations, which are different indexes even when
the key patterns match.

---

← [Overview](README.md) ·
Next → [The index list](02-the-index-list.md)
