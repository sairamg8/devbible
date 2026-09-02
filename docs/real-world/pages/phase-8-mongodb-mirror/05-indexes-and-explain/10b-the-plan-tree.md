---
title: "The plan is a tree read from the leaves upward, and its shape depends on which execution engine ran the query"
sidebar_label: "14 · The plan tree"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/)
> (*"The `explain` results present the query plans as a tree of stages"*; *"Each
> stage passes its resulting documents or index keys to the parent node. The leaf
> nodes access the collection or the indices."*; the stage name list including
> `EXPRESS` stages *"New in version 8.0"*; *"The output structure can differ based
> on which query engine the operation uses"*; *"Starting in MongoDB 8.0, rejected
> query plans only contain the `find` portion of the query"*; *"The fields listed
> in the output are subject to change"*),
> [Slot-Based Query Execution Engine](https://www.mongodb.com/docs/manual/reference/sbe/).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**[Chunk 13](10-explain-verbosity-and-stages.md) got the output; this chunk reads
it. Three things trip people up and none of them is about indexing. The tree runs
the opposite way round from a Postgres `EXPLAIN`, so reading it top-down inverts
the causality. The *shape* of the output depends on which of MongoDB's two
execution engines ran the query, which means tooling that walks a fixed path
breaks on an upgrade that changed nothing in your code. And several stage names
are new enough that a plan can look wrong to someone reading against older
documentation.**

## The output is a tree of stages

> *"The `explain` results present the query plans as a tree of stages."*

Each stage has an `inputStage` — or `inputStages` when it has several children —
and:

> *"Each stage passes its resulting documents or index keys to the parent node.
> The leaf nodes access the collection or the indices. The internal nodes use the
> documents or the index keys that result from the child nodes. The root node
> indicates the stage that MongoDB ultimately derives the result set from."*

So you read it **bottom-up**: the leaf is where the data came from, and each
parent is something done to it. That is the opposite of reading `EXPLAIN` output
in Postgres, which prints the root first and indents downward, and getting the
direction wrong makes an ordinary plan look nonsensical — a `FETCH` above an
`IXSCAN` reads as "fetched, then indexed" instead of "indexed, then fetched".

## The stage names that matter here

Quoted from the Manual's own list, with the app-specific reading:

| Stage | The Manual | What it means in this app |
|---|---|---|
| `COLLSCAN` | *"for a collection scan"* | an index is missing or unusable — a partial filter omitted, an expression around the field |
| `IXSCAN` | *"for scanning index keys"* | the index was used; the `keyPattern` field says which |
| `FETCH` | *"for retrieving documents"* | the index did not carry everything; normal unless you expected a covered query |
| `SORT` | an in-memory sort | the index did not supply the order — the chapter's gate |
| `LIMIT` / `SKIP` | the cursor modifiers as stages | `SKIP` on a deep page is the offset-pagination cost, visible |
| `PROJECTION_*` | applying the projection | |
| `GROUP` | *"for grouping documents"* | an aggregation `$group`; carries spill metrics since 8.2 |
| `OR` | an `$or` served by several index scans | the keyset predicate's `$or` from [02·02](../02-the-catalog/02-keyset-pagination.md) |
| `AND_SORTED` / `AND_HASH` | index intersection | rare, and usually a missing compound index ([chunk 12](09-index-intersection.md)) |
| `BATCHED_DELETE` | *"for multiple document deletions that are batched together internally (starting in MongoDB 6.1)"* | what TTL deletes look like ([chunk 8](05b-ttl-restrictions-and-the-deleter.md)) |
| `EXPRESS_IXSCAN` etc. | *"for a limited set of queries that can bypass regular query planning to use optimized index scan plans"*, **new in 8.0** | a simple `_id` lookup, optimised |

The healthy shape for a catalog page is a small tree: an `IXSCAN` at the leaf, a
`FETCH` above it, a `LIMIT` above that. **No `SORT`.** That rule is the chapter's
gate and it gets its own chunk.

`EXPRESS` stages deserve the warning. They are new in 8.0, they replace the plan
you expected for a narrow class of queries, and someone reading a plan against
7.x documentation will look for `IXSCAN` on an `_id` equality, not find it, and
conclude the index is not being used. Nothing is wrong.

## Two engines, two output shapes

> *"The output structure can differ based on which query engine the operation
> uses. Operations can use the classic query engine or the slot-based execution
> query engine."*

Under the **classic** engine the plan tree hangs directly off `winningPlan`, with
`stage` and `inputStage` all the way down.

Under the **slot-based** engine the same logical tree appears under
`winningPlan.queryPlan`, and alongside it are `slotBasedPlan` fields that the
Manual explicitly marks **"For internal use by MongoDB."**

Which engine runs a given query is not something the application chooses, and it
can change between versions for the same query. There is an `explainVersion`
field stating the output format version precisely because of this, and a general
warning on the page: *"Only the most important output fields are shown on this
page, and fields for internal use are not documented. The fields listed in the
output are subject to change."*

**The practical rule: do not write tooling that hard-codes a path into
`winningPlan`.** A CI check that walks `winningPlan.inputStage.stage` passes
vacuously the day the engine changes, because the path resolves to `undefined` and
`undefined !== 'COLLSCAN'`. Serialising the plan and searching the whole string for
the stage names you care about is cruder and survives:

```js
// scripts/assert-no-collscan.js
const plan = await coll.find(filter).sort(sortSpec).explain('queryPlanner');
const text = JSON.stringify(plan);
if (text.includes('"COLLSCAN"')) throw new Error(`COLLSCAN: ${name}`);
if (text.includes('"SORT"'))     throw new Error(`blocking SORT: ${name}`);
```

Ugly, and it fails for the right reason on every engine and every output version.

## `rejectedPlans`, and what changed in 8.0

`rejectedPlans` is *"an array of candidate plans considered and rejected by the
query optimizer"*, and *"The array can be empty if there were no other candidate
plans."*

An empty `rejectedPlans` is a **finding**, not a blank. It means the planner had
exactly one candidate — usually because only one index applies — so on a query you
believed had two viable indexes, the empty array is the answer to why it is not
using the other one. Either the second index does not match the predicate's shape
at all, or its partial filter is not satisfied
([chunk 5](03b-partial-indexes.md)), or its collation differs
([chunk 6](04-collation-and-case.md)).

And a version note:

> *"Starting in MongoDB 8.0, rejected query plans only contain the `find` portion
> of the query. In previous versions, rejected plans can contain aggregation
> stages like `$group`. Those aggregation stages aren't used by the query planner
> to choose the winning plan, so the `rejectedPlans` field only contains the
> portion of the query that was used to choose the winning plan."*

So a comparison against a 7.x example shows less in 8.0, and nothing is missing —
the aggregation stages were never part of the choice.

## Two hashes that answer different questions

8.0 also renamed one of the plan-cache identifiers, which matters when reading
older material:

> *"Starting in MongoDB 8.0, the existing `queryHash` field is duplicated in a new
> field named `planCacheShapeHash`. … Future MongoDB versions will remove the
> deprecated `queryHash` field."*

The pair is worth understanding because they answer different questions:

- **`planCacheShapeHash`** — *"dependent only on the plan cache query shapes"*, so
  it identifies "queries of this shape" regardless of what indexes exist. It is
  how you group slow-query log lines that are the same query with different
  literals.
- **`planCacheKey`** — *"a function of both the plan cache query shape and the
  currently available indexes for that shape. Specifically, if indexes that can
  support the query shape are added or dropped, the `planCacheKey` value may
  change but the `planCacheShapeHash` value wouldn't change."*

So a `planCacheKey` that changed without a code change means **someone changed the
indexes**. That is a genuinely useful diagnostic and it is the bridge to
[chunk 16](12-hint-and-the-plan-cache.md).

## Gotchas

**★ The tree reads bottom-up.** The leaf is the access method and the root is the
final result. Reading it like a Postgres `EXPLAIN` — top-down — inverts the
causality and makes a normal plan look wrong.

**★ The output shape depends on the execution engine.** Classic puts the tree at
`winningPlan`; the slot-based engine puts it at `winningPlan.queryPlan` and adds
fields marked for internal use. Which engine runs a query is not your choice and
can change on upgrade.

**★ Tooling that walks a fixed path fails silently.** A check reading
`winningPlan.inputStage.stage` returns `undefined` under the other engine, and
`undefined !== 'COLLSCAN'` passes. The check goes green on the day it stopped
looking at anything. Search the serialised plan instead.

**★ `EXPRESS` stages are new in 8.0 and look like a missing index.** A simple
`_id` lookup may bypass normal planning entirely and report
`EXPRESS_IXSCAN` rather than `IXSCAN`. Nothing is wrong; the plan just does not
contain the stage name older documentation taught you to look for.

**★ An empty `rejectedPlans` is a finding.** It means only one candidate existed.
On a query you expected to have alternatives, that is the direct answer to "why is
it not using the other index" — and the cause is usually a partial filter or a
collation mismatch making the other index inapplicable.

**★ `rejectedPlans` shows less in 8.0 than in 7.x.** Aggregation stages were
removed from it because they never influenced the choice. A side-by-side against
older output looks like information was lost; it was noise.

**★ `queryHash` is deprecated in favour of `planCacheShapeHash`.** Both are
present in 8.0 with the same value, and the old one is slated for removal.
Monitoring and log-parsing written against `queryHash` needs updating on a
schedule you do not control.

**★ A `planCacheKey` that changed without a deploy means the indexes changed.**
It hashes the shape *and* the available indexes, unlike `planCacheShapeHash` which
hashes only the shape. That distinction is the cheapest available answer to "why
did this query's plan change last Tuesday".

**★ `FETCH` above `IXSCAN` is normal.** It only indicates a problem if you were
expecting a covered query ([chunk 11](08-covered-queries.md)). Most reads want the
document, so most plans fetch, and treating every `FETCH` as a failure leads to
covering indexes nobody needed.

## Interview questions

**★ Which direction do you read an explain tree, and why does it matter?**
Bottom-up. The leaf nodes access the collection or the indexes; each parent
consumes what its child produced; the root produces the result. Reading it
top-down — the habit from Postgres's `EXPLAIN`, which prints the root first — makes
a `FETCH` above an `IXSCAN` look like the fetch came first, and turns an ordinary
plan into an apparent mystery. The Manual states the direction explicitly, and it
is the first thing to fix in anyone's mental model.

**★ You are writing a CI check that fails the build if a query does a collection
scan. How do you write it robustly?**
Not by walking a fixed path into `winningPlan`. The output structure differs
between the classic and slot-based engines — the tree is under `winningPlan` for
one and `winningPlan.queryPlan` for the other — there is an `explainVersion` field
precisely because the format changes, and the Manual states the fields are subject
to change. Serialise the whole plan and search it for the stage names you care
about; it is cruder, and it survives an engine change on upgrade that would
otherwise make a path-walking check pass on nothing at all. A check that can go
green by looking at nothing is worse than no check.

**★ A query you expected to have two candidate indexes reports an empty
`rejectedPlans`. What does that tell you?**
That the planner found exactly one applicable index, so the other one is not
applicable for a structural reason rather than a costing one. The usual causes are
that the second index is partial and the query does not carry its filter
expression, that it has a collation the query did not specify, or that its key
order does not match the predicate's shape — a compound index whose leading key the
query does not constrain. It is a much more useful signal than a rejected plan
would have been, because it says "not considered" rather than "considered and
lost".

**★ What is the difference between `planCacheShapeHash` and `planCacheKey`?**
`planCacheShapeHash` hashes the query shape only, so every query of the same
shape with different literal values shares it — which makes it the right key for
grouping slow-query log lines. `planCacheKey` hashes the shape **and** the set of
indexes available to serve it, so adding or dropping an index changes the
`planCacheKey` while leaving the `planCacheShapeHash` alone. The practical use is
diagnostic: if a query's `planCacheKey` changed and nothing was deployed, someone
changed the indexes.

**★ Is a `FETCH` stage a problem?**
Almost never. It means the index did not carry every field the query returns, and
most queries return the document, so most plans fetch. It is only a signal when
you specifically built a covering index and expected the `IXSCAN` **not** to be a
descendant of a `FETCH`, which is how the Manual defines the covered case. Treating
every `FETCH` as a defect is how a collection ends up with wide covering indexes
nobody needed and everybody pays for on write.

**★ Your `_id` lookup's plan does not contain an `IXSCAN`. Is the `_id` index
broken?**
No — on MongoDB 8.0 it is probably an `EXPRESS_IXSCAN`. Express stages are new in
8.0 and exist *"for a limited set of queries that can bypass regular query
planning to use optimized index scan plans"*, so a narrow `_id` equality skips
normal planning and reports a different stage name. It is faster, not broken, and
it is a good illustration of why plan-shape assertions should be written against
what you are trying to prevent — a `COLLSCAN`, a blocking `SORT` — rather than
against the exact stage names you expect to see.

---

← Prev: [Reading `explain()`](10-explain-verbosity-and-stages.md) ·
Next → [The ratio and `SORT`](11-the-ratio-and-the-sort-stage.md)
