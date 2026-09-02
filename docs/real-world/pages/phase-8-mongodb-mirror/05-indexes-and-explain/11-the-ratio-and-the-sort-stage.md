---
title: "Three counters and one stage name decide whether an index is right, and the ratio between the counters says which way it is wrong"
sidebar_label: "15 · The ratio and SORT"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/)
> (*"Number of documents returned by the winning query plan"*; *"Number of index
> entries scanned"*; *"Number of documents examined during query execution. Common
> query execution stages that examine documents are `COLLSCAN` and `FETCH`"*;
> *"`totalDocsExamined` refers to the total number of documents examined and not
> to the number of documents returned"*; *"If a document is examined multiple times
> during query execution, `totalDocsExamined` counts each examination"*; *"If
> MongoDB cannot use an index or indexes to obtain the sort order, the results
> include a `SORT` stage indicating an in-memory sort operation. If the explain
> plan does not contain an explicit `SORT` stage, then MongoDB used an index to
> obtain the sort order"*; the per-stage `keysExamined`, `docsExamined`, `seeks`,
> `works`, `usedDisk` and spill fields).
> Counterpart: `Rows Removed by Filter` and the absent `Sort` node
> ([1·10](../../phase-1-database/10-indexes.md)).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1's index chapter gave two things to read in an `EXPLAIN ANALYZE`: the
expected index name, and `Rows Removed by Filter` staying near zero. This is the
MongoDB version, and it is sharper because the counters are separated. Three
numbers — `nReturned`, `totalKeysExamined`, `totalDocsExamined` — describe the
same query at three levels, and **the ratios between them say exactly which way an
index is mis-derived.** Then one stage name, `SORT`, answers the other half of the
question, and its presence or absence is this chapter's gate.**

## The three counters

> *"`nReturned` — Number of documents returned by the winning query plan."*

> *"`totalKeysExamined` — Number of index entries scanned."*

> *"`totalDocsExamined` — Number of documents examined during query execution.
> Common query execution stages that examine documents are `COLLSCAN` and
> `FETCH`."*

And the caveat that stops people misreading the third:

> *"`totalDocsExamined` refers to the total number of documents examined and **not**
> to the number of documents returned. For example, a stage can examine a document
> in order to apply a filter. If the document is filtered out, then it has been
> examined but will not be returned as part of the query result set."*

> *"If a document is examined multiple times during query execution,
> `totalDocsExamined` counts each examination. That is, `totalDocsExamined` is
> **not** a count of the total number of *unique* documents examined."*

That second sentence is why `totalDocsExamined` can exceed the collection size.
Seeing a number larger than `countDocuments()` is not a bug in the counter.

## Reading the ratios

The healthy shape for an indexed equality-plus-sort query is **1 : 1 : 1** —
one index key examined and one document examined per document returned.
Everything else is a named failure:

| Shape | What it means | What to change |
|---|---|---|
| `keys ≈ docs ≈ returned` | the index selects exactly the result | nothing |
| `keys ≈ docs ≫ returned` | the index found the wrong rows and a filter cleaned up | a predicate the index does not carry — add the field to the index or to its partial filter |
| `keys ≫ docs ≈ returned` | the index scan walked far more entries than it fetched | the index bounds are not one contiguous range — usually a leading key the query does not constrain, or a `$in` exploding into many ranges |
| `docs ≈ returned`, `keys = 0` | a collection scan | no usable index at all — see the `COLLSCAN` causes below |
| `docs = 0`, `returned > 0` | a covered query ([chunk 11](08-covered-queries.md)) | nothing; this is the best case |
| `docs > keys` | documents examined more than once, or a scan | a `COLLSCAN`, or a plan re-examining documents |

The middle two rows are the ones worth internalising, because they look identical
in a latency graph and want opposite fixes.

**`keys ≈ docs ≫ returned` is Phase 1's `Rows Removed by Filter` exactly.** The
index selected a superset, every one of those documents was fetched, and a filter
threw most of them away. The work was done and discarded. The fix is to put the
discarding predicate *into* the index — either as a key, or as the partial filter
if it is a standing condition.

This is precisely the situation
[chunk 3](02b-what-the-list-leaves-out.md) predicted for the deliberately-omitted
"category + price range + newest" index: the `{'category.slug': 1, _id: -1}` index
serves the equality and the sort, and the price range is applied after fetching.
The ratio is how you find out it stopped being acceptable.

**`keys ≫ docs ≈ returned` is a different animal.** The fetch was efficient; the
*index walk* was not. The per-stage `seeks` field is the confirmation — the Manual
defines it as *"The number of times that we had to seek the index cursor to a new
position in order to complete the index scan"* — and a high `seeks` means the
index bounds are many small ranges rather than one. The usual causes are a
compound index whose leading key the query does not constrain, and a large `$in`
producing one range per element.

## Per-stage fields, when the totals are not enough

The totals are sums over the whole plan. When a plan has several stages that could
be responsible, the per-stage fields localise it:

| Field | Stages | The Manual |
|---|---|---|
| `docsExamined` | `COLLSCAN`, `FETCH` | *"the number of documents scanned during the query execution stage"* |
| `keysExamined` | `IXSCAN` | *"the total number of in-bounds and out-of-bounds keys that are examined in the process of the index scan"* |
| `seeks` | `IXSCAN` | *"The number of times that we had to seek the index cursor to a new position"* |
| `works` | classic engine | *"the number of 'work units' performed by the query execution stage"* |
| `usedDisk` | `GROUP`, and aggregation stages | *"Whether the stage wrote to disk"* |

The `keysExamined` definition contains the useful nuance: it counts **out-of-bounds
keys too**, because *"If the index bounds consists of several key ranges, the index
scan execution process may examine out-of-bounds keys in order to skip from the end
of one range to the beginning of the next."* So a high `keysExamined` with a high
`seeks` is one phenomenon, not two.

Since MongoDB 8.2 the blocking stages also report spilling —
`spills`, `spilledBytes`, `spilledRecords`, `spilledDataStorageSize` on `GROUP`
and `SORT` — which is how you see the 100 megabyte threshold being crossed
([04·17](../04-the-dashboard/07-limits-and-materialisation.md)) rather than
inferring it from latency.

## 🔴 The `SORT` stage, and the chapter's gate

> *"If MongoDB cannot use an index or indexes to obtain the sort order, the
> results include a `SORT` stage indicating an in-memory sort operation. If the
> explain plan does not contain an explicit `SORT` stage, then MongoDB used an
> index to obtain the sort order."*
> — [Explain Results — Sort Stage](https://www.mongodb.com/docs/manual/reference/explain-results/)

That is a **biconditional**, which makes it the cleanest test in the whole
chapter: `SORT` present ⟺ the index did not supply the order.

For this app that turns into one rule:

> **A keyset-paginated query with a `SORT` stage is broken, whatever its latency
> looks like today.**

Because a blocking sort must see every matching document before it can return the
first page, so its cost is proportional to the *filtered set* and not to the page
size. Page 1 and page 40 cost the same, and both grow with the catalog. On a seed
database the sort is over two hundred documents and nothing is visibly wrong; at
fifty thousand products the same query is a different program.

[Chapter 02](../02-the-catalog/02-keyset-pagination.md) spent a whole chunk making
the sort spec, the keyset predicate and the index agree on **direction**, and this
is the check that they do. A `SORT` under a catalog query means one of the three
disagrees with the other two, and the three-places-one-decision rule from that
chunk is where to look.

Note also what the biconditional does *not* say. It says nothing about whether the
sort is expensive — a `SORT` over thirty grouped daily buckets
([04·01](../04-the-dashboard/01-revenue-by-day.md)) is entirely fine. The rule is
"know how many documents the sort sees", and the stage name only tells you that
one happened.

## The gate

Mechanical, per query shape, run against a realistically sized dataset:

1. Run the query with `explain('executionStats')`.
2. **The expected index name appears** in the winning plan's `IXSCAN`.
3. **No `SORT` stage** on any keyset-paginated query.
4. `totalDocsExamined / nReturned` is near 1 — and where it is not, the reason is
   written down, as it is for the omitted catalog index in
   [chunk 3](02b-what-the-list-leaves-out.md).
5. `totalKeysExamined / totalDocsExamined` is near 1, or `seeks` explains why not.

**On the 200-document seed the planner may legitimately prefer a collection
scan**, exactly as Phase 1 noted for Postgres: on a tiny collection a scan is
genuinely cheaper than an index descent, and the planner is right. That is correct
behaviour and not a failed gate. The gate is judged against a realistic dataset —
a one-off bulk load of a hundred thousand generated products, which is what a
scratch database is for.

## Gotchas

**★ `totalDocsExamined` can exceed the collection size.** It counts each
examination, not each unique document, so a plan that revisits documents inflates
it. Comparing it against `countDocuments()` and concluding the counter is broken
is a common first reaction.

**★ `keys ≈ docs ≫ returned` and `keys ≫ docs ≈ returned` look the same in a
latency graph and want opposite fixes.** The first means the index selected the
wrong rows and a filter discarded them — add the discarding predicate to the index.
The second means the index walk was fragmented — usually an unconstrained leading
key or a large `$in`. Check `seeks` to tell them apart.

**★ A `COLLSCAN` with correct results is the silent failure mode.** Nothing errors.
The three causes in this app are all silent: a query omitting a partial index's
filter ([chunk 5](03b-partial-indexes.md)), a query omitting a collated index's
collation ([chunk 6](04-collation-and-case.md)), and an expression wrapped around
an indexed field ([04·01](../04-the-dashboard/01-revenue-by-day.md)).

**★ A `SORT` stage is proof the index did not supply the order.** The Manual
states it as a biconditional. There is no "it used the index and also sorted a
bit" — either the order came from the index or a blocking sort produced it.

**★ A blocking sort's cost is independent of the page size.** It must see every
matching document before returning the first one. That is why a `SORT` under a
paginated query is a defect rather than an inefficiency, and why it is invisible
on small data.

**★ Not every `SORT` is a problem.** A sort over thirty grouped daily buckets is
fine. The question is how many documents the stage sees, and after a `$group` on a
bounded key that number is bounded by the request. Treating every `SORT` as a
failure produces indexes nobody needed.

**★ The planner preferring a `COLLSCAN` on a tiny collection is correct.** On two
hundred documents a scan beats an index descent, and the planner knows. Running the
gate against seed data produces false failures and teaches people to ignore it.

**★ `executionTimeMillis` is not one of the gate's numbers.** It includes
plan-selection time and moves when `hint()` bypasses planning
([chunk 13](10-explain-verbosity-and-stages.md)). The counters describe work done
and are stable across runs; the clock is not.

**★ Spill metrics on `SORT` and `GROUP` are new in 8.2.** `usedDisk`, `spills`
and `spilledBytes` make the 100 megabyte threshold visible instead of inferred.
Tooling written against 8.0 will not find them, and their absence does not mean
nothing spilled.

## Interview questions

**★ Name the three counters and say what the ideal relationship between them
is.**
`nReturned` — documents returned. `totalKeysExamined` — index entries scanned.
`totalDocsExamined` — documents examined, which the Manual is careful to say is not
documents returned and counts repeat examinations. The ideal for an indexed
equality-plus-sort query is roughly one-to-one-to-one: each key examined leads to
one document examined which is returned. A covered query does better still, with
`totalDocsExamined` at zero.

**★ `totalKeysExamined` is 200,000 and `nReturned` is 24, but `totalDocsExamined`
is also 24. What is happening?**
The fetch was efficient and the index walk was not — the index found exactly the
right documents but had to examine a great many keys to do it. That means the
index bounds are not one contiguous range: the scan is skipping between many small
ranges, examining out-of-bounds keys to get from the end of one to the start of the
next. The `seeks` field on the `IXSCAN` stage confirms it. The usual causes are a
compound index whose leading key the query does not constrain, or a `$in` with many
elements producing one range per element.

**★ And if `totalDocsExamined` were 200,000 instead?**
Then the index selected a superset and a filter discarded most of what was
fetched — Phase 1's `Rows Removed by Filter`, in MongoDB's vocabulary. The work of
fetching 200,000 documents was done and thrown away. The fix is to move the
discarding predicate into the index, either as an additional key ordered by ESR or
as a `partialFilterExpression` if it is a condition every query of that shape
carries.

**★ What does a `SORT` stage prove?**
That the index did not supply the sort order, and the server performed an in-memory
sort instead. The Manual states it both ways — a `SORT` stage means no index
supplied the order, and no `SORT` stage means one did — so it is a clean test
rather than a hint. Whether it is a *problem* depends on how many documents the
stage sees: over thirty grouped daily buckets it is free; over a filtered
collection under a paginated query it is a defect, because a blocking sort must
process the entire matching set before returning the first page.

**★ Why is a `SORT` under a keyset query a bug rather than an inefficiency?**
Because it destroys the property keyset pagination exists to provide. The point of
a keyset cursor is that page *n* costs the same as page 1 — one index descent and a
walk. A blocking sort has to see every matching document before it can order them,
so every page costs the whole filtered set, and the cost grows with the collection
rather than with the page. It is also invisible on small data, so it ships.

**★ The gate fails on the seed database. Is the index wrong?**
Probably not. On two hundred documents the planner will often choose a collection
scan because it genuinely is cheaper than descending an index, and that is correct
behaviour rather than a broken index. The gate has to be run against a realistically
sized dataset — a one-off bulk load of generated documents into a scratch database —
or it produces false failures, which is worse than no gate because people learn to
ignore it.

**★ Which field in the explain output do you deliberately not use, and why?**
`executionTimeMillis`. The Manual states it includes plan-selection time, so an
`explain` that plans from scratch reports more than steady state where the plan is
cached, and that using `hint()` with `explain()` bypasses planning and reports
less. It moves with the measurement rather than with the query. The counters
describe work done — keys examined, documents examined, documents returned — and
are stable across runs, which is what a gate needs.

---

← Prev: [The plan tree](10b-the-plan-tree.md) ·
Next → [`hint()` and the plan cache](12-hint-and-the-plan-cache.md)
