---
title: "MongoDB can intersect two indexes and has been engineered not to, which is why the Postgres habit of one index per column ports badly"
sidebar_label: "12 · Index intersection"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual** — the
> [Index Intersection](https://www.mongodb.com/docs/v6.0/core/index-intersection/)
> page, which is **archived at v6.0**: the current manual folds the topic into
> [Indexes](https://www.mongodb.com/docs/manual/core/index-intersection/) without
> the detail, so the quotations below are cited to the v6.0 page and I could not
> confirm a re-statement of them in the 8.0 documentation. Quotations:
> *"In practice, the query optimizer rarely selects plans that use index
> intersection"*; *"Hash-based index intersection is disabled by default and
> sort-based index intersection is disfavored in plan selection. The optimizer
> behaves in this fashion in order to prevent bad plan selection"*; *"Schema
> designs should not rely on index intersection. Instead, compound indexes should
> be used"*; *"the results of `explain()` will include either an `AND_SORTED`
> stage or an `AND_HASH` stage"*; *"Index intersection does not apply when the
> `sort()` operation requires an index completely separate from the query
> predicate"*.
> Counterpart: Postgres's bitmap index scans
> ([1·10](../../phase-1-database/10-indexes.md)).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Postgres will happily combine two single-column indexes with a bitmap AND, and
that capability shapes how people index: one index per column, let the planner
sort it out. MongoDB has the same mechanism and the documentation tells you not to
design for it — hash-based intersection is off by default, sort-based intersection
is deliberately disfavoured, and the guidance is a single sentence: use compound
indexes instead. That is why
[chunk 2's list](02-the-index-list.md) is a list of carefully-ordered compound
indexes rather than a list of columns.**

## What it is, and how you would see it

MongoDB *can* use two indexes for one query. Given `{qty: 1}` and `{item: 1}` on
`orders`, a query filtering both fields may be answered by intersecting the two
index scans, and the way you find out is the plan:

> *"To determine if MongoDB used index intersection, run `explain()`; the results
> of `explain()` will include either an `AND_SORTED` stage or an `AND_HASH`
> stage."*

`AND_SORTED` is the sort-based intersection — walk both index scans in the same
order and keep the record ids present in both. `AND_HASH` builds a hash of one
side and probes it with the other, which is the same pair of strategies any join
engine has.

**Index prefix intersection** also exists: *"With index intersection, MongoDB can
use an intersection of either the entire index or the index prefix. An index
prefix is a subset of a compound index, consisting of one or more keys starting
from the beginning of the index."* So a compound index can contribute its leading
keys to an intersection without being usable in full.

## Why you should not design for it

The archived page is unusually direct, and the three sentences are worth having
verbatim because the guidance is stronger than "prefer compound indexes":

> *"In practice, the query optimizer rarely selects plans that use index
> intersection."*

> *"Hash-based index intersection is disabled by default and sort-based index
> intersection is disfavored in plan selection. The optimizer behaves in this
> fashion in order to prevent bad plan selection."*

> *"Schema designs should not rely on index intersection. Instead, compound
> indexes should be used."*

Read the middle one carefully. It is not that intersection is unimplemented or
slow — it is that the optimizer has been **deliberately biased against choosing
it**, because plans that intersect were found to be chosen wrongly often enough to
be a net loss. So the behaviour you would be designing for is behaviour the
planner is engineered to avoid.

The practical consequence for anyone arriving from Postgres: **the habit of
creating single-column indexes and trusting the planner to combine them does not
port.** In Postgres that habit is often fine — a bitmap heap scan over two
single-column indexes is an everyday plan. Here it produces a set of indexes the
planner will mostly decline to combine, so one of them gets used and the other
becomes a filter, and the write cost of both is paid regardless.

## The trade compound indexes make, stated fairly

The archived page also makes the case *for* intersection, and it is a real case:

> *"Index intersection does not eliminate the need for creating compound indexes.
> However, because both the list order (i.e. the order in which the keys are
> listed in the index) and the sort order (i.e. ascending or descending), matter
> in compound indexes, a compound index may not support a query condition that
> does not include the index prefix keys or that specifies a different sort
> order."*

Which is precisely the cost this chapter has been paying since
[chunk 1](01-the-method-and-esr.md). A compound index is ordered, so it serves a
prefix and a sort direction pattern and nothing else — which is why `products`
carries five catalog indexes rather than one. Two separate single-key indexes are
*more flexible* and less powerful; a compound index is less flexible and, when it
matches, dramatically better.

The archived page's own example makes the flexibility point cleanly:
`{status: 1, ord_date: -1}` supports a query on `status` and a query on both, but
not `find({ord_date: {$gt: …}})` alone and not `find({}).sort({ord_date: 1})`,
whereas separate `{status: 1}` and `{ord_date: -1}` indexes support all four
"either individually or through index intersection". And then:

> *"The choice between creating compound indexes that support your queries or
> relying on index intersection depends on the specifics of your system."*

The honest summary: **flexibility is the argument for many small indexes, and the
planner's documented reluctance is the argument against.** This corpus resolves it
the way the Manual does — derive compound indexes from queries — and the reason is
not that intersection is bad, it is that a plan you cannot predict is worse than a
plan that is occasionally missing.

## The restriction that decides it for this app

> *"Index intersection does not apply when the `sort()` operation requires an
> index completely separate from the query predicate."*

The archived page's example: with indexes on `{qty: 1}` and `{status: 1}`,
MongoDB *"cannot use index intersection"* for
`find({qty: {$gt: 10}}).sort({status: 1})` — it will not use one index for the
filter and a different one for the sort.

**Almost every query in this app filters and sorts.** The catalog filters by
category and sorts by price; the order history filters by user and sorts by date;
the dashboard filters by status and date and sorts after grouping. So even if the
planner were willing to intersect, the shape of these queries is exactly the shape
intersection does not serve — which converts a preference into a structural
requirement.

That is the strongest single reason
[chunk 2's list](02-the-index-list.md) looks the way it does. It is not a stylistic
choice about compound indexes; it is that a filter-and-sort query needs one index
covering both roles, and that index is compound by definition.

## Gotchas

**★ Two single-column indexes are not a substitute for a compound index.** The
planner rarely combines them, hash-based intersection is off by default, and
sort-based intersection is deliberately disfavoured. You pay the write cost of
both and usually get the benefit of one.

**★ Intersection never spans a filter and a separate sort.** MongoDB will not use
one index for the predicate and another for the ordering. Since nearly every query
in a web application filters and sorts, this alone makes compound indexes
mandatory rather than preferable.

**★ `AND_SORTED` or `AND_HASH` in a plan means intersection happened.** It is rare
enough that seeing it is usually a signal that the compound index you expected to
be used is missing or was rejected — worth investigating rather than celebrating.

**★ The documentation for this moved and thinned.** The detailed page is archived
at v6.0; the current manual folds the topic into the indexes overview without the
quotable guidance. I could not confirm the same sentences in the 8.0
documentation, so the citations here point at the archived page. The *behaviour*
is unchanged as far as I can determine, but the source is older than the version
spine and that is worth knowing before quoting it in an argument.

**★ Compound index flexibility is the real cost, and it is why there are five
catalog indexes.** A compound index serves a prefix and one direction pattern.
Every additional query shape that does not fit an existing prefix needs its own
index, which is the write cost the single-column approach was trying to avoid.
Trading write cost for plan predictability is the decision, and it should be made
knowingly.

**★ Prefix intersection means a compound index can contribute partially.** MongoDB
can intersect using a compound index's *prefix*, so an index you thought was
unused may be contributing its first key. That makes `$indexStats` usage counts
harder to interpret than they look.

**★ The Postgres instinct is the specific thing to unlearn.** Bitmap heap scans
make "index each column, let the planner decide" a reasonable default there. Here
it is the pattern that produces a collection with eight indexes and one query
shape served well.

## Interview questions

**★ Can MongoDB use two indexes for one query, and should you plan on it?**
It can — `explain()` reports an `AND_SORTED` or `AND_HASH` stage when it does —
and you should not plan on it. The documentation is explicit that hash-based
intersection is disabled by default and sort-based intersection is disfavoured in
plan selection *"in order to prevent bad plan selection"*, and that *"Schema
designs should not rely on index intersection. Instead, compound indexes should be
used."* So the mechanism exists and the optimizer is engineered to avoid it, which
makes it a diagnostic observation rather than a design tool.

**★ Why does the Postgres habit of one index per column port badly?**
Because Postgres routinely combines single-column indexes with a bitmap AND, so
indexing each column and trusting the planner is a reasonable default there.
MongoDB's planner is biased against the equivalent, so the same set of indexes
yields one index used and the rest acting as write overhead. The port is not "the
same indexes in different syntax" — it is a re-derivation, per query shape, into
compound indexes ordered by ESR.

**★ What is the single restriction that makes compound indexes mandatory for this
app rather than merely preferable?**
That intersection does not apply when the sort requires an index separate from the
predicate. MongoDB will not use one index for the filter and another for the
ordering. Every significant read here filters and sorts — catalog by category then
price, history by user then date — so there is no configuration in which two
narrow indexes could serve those queries, whatever the optimizer's preferences.
One index must cover both roles, and such an index is compound.

**★ What do you actually give up by preferring compound indexes?**
Flexibility, and the Manual says so. A compound index serves a prefix of its keys
and one sort-direction pattern; a query that constrains a non-prefix field, or
sorts the other way, cannot use it. That is why `products` carries five catalog
indexes where two single-key indexes would have "covered" more shapes — worse, but
more of them. The trade is write cost and index count in exchange for plans that
are predictable, and predictability is what you actually want on a hot path.

**★ You see `AND_HASH` in a production plan. What does it tell you?**
That something unusual happened, because hash-based intersection is disabled by
default — so either it was explicitly enabled, or you are on a deployment
configured differently from the documented default. Either way the more useful
reading is that the planner found no single index good enough for the query, which
points at a missing compound index rather than at a clever plan. Treat it as a
symptom.

**★ How confident are you in the documentation for this behaviour?**
Moderately, and it is worth saying so. The detailed index-intersection page is
archived at v6.0; the current manual folds the topic into the indexes overview
and does not restate the guidance in quotable form. I could not confirm the exact
sentences in the 8.0 documentation, so the claims here are cited to the archived
page. Nothing I found suggests the behaviour changed, and the practical advice —
derive compound indexes from query shapes — is restated throughout the current
indexing-strategies material, so the conclusion is well supported even where the
specific wording is not current.

---

← Prev: [Covered queries](08-covered-queries.md) ·
Next → [Reading `explain()`](10-explain-verbosity-and-stages.md)
