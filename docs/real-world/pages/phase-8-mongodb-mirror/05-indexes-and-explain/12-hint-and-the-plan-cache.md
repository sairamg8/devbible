---
title: "hint() is a diagnostic that shipped by accident in a thousand codebases, and the plan cache is why the query got slow without anybody changing it"
sidebar_label: "16 · hint() and the plan cache"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`cursor.hint()`](https://www.mongodb.com/docs/manual/reference/method/cursor.hint/)
> (*"Specify the index either by the index name or by the index specification
> document"*; *"You can specify `{ $natural : 1 }` to force the query to perform a
> forwards collection scan"*),
> [Query Plans](https://www.mongodb.com/docs/manual/core/query-plans/)
> (the Missing / Inactive / Active cache states; the flush triggers; *"Query
> settings have more functionality and are preferred over deprecated index
> filters"*),
> [`$planCacheStats`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/planCacheStats/),
> [Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/)
> (`planCacheShapeHash`, `planCacheKey`, `isCached`),
> [`aggregate`](https://www.mongodb.com/docs/manual/reference/command/aggregate/)
> (*"The `hint` does not apply to `$lookup` and `$graphLookup` stages"*),
> [Text Index Restrictions](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/text-index-restrictions/)
> (*"If a query includes a `$text` expression, you cannot use `hint()`"*).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Two things in this chunk look unrelated and are the same subject. `hint()`
overrides the planner for one query; the plan cache is the planner overriding
*itself* for every query of a shape. Both answer the question "why is this query
using that index", and both are places where a system gets slower with nobody
having changed anything. The rule the chapter lands on is short: **`hint()` is how
you test a hypothesis, not how you ship a fix** — and if you feel you need it
permanently, the thing to reach for in 8.0 is query settings.**

## `hint()` — what it does

> *"Specify the index either by the index name or by the index specification
> document."*
> — [`cursor.hint()`](https://www.mongodb.com/docs/manual/reference/method/cursor.hint/)

```js
// by specification
await products.find(filter).sort(sortSpec)
  .hint({'category.slug': 1, priceCents: 1, _id: 1})
  .explain('executionStats');

// by name — what getIndexes() reports
await products.find(filter).hint('category.slug_1_priceCents_1__id_1').toArray();
```

and the escape hatch:

> *"You can specify `{ $natural : 1 }` to force the query to perform a forwards
> collection scan."*

`{$natural: -1}` reverses it. Both bypass indexes entirely, which is occasionally
what you want when the question is "how slow is this *without* the index" — the
control condition for a decision about whether an index is earning its cost.

## Why it belongs in a diagnostic, not in a repository

**It tells you what you already suspected.** The useful pattern is a comparison:
run `explain('executionStats')` twice, once as written and once hinted at the
index you expected, and compare the counters. If the hinted plan is dramatically
better, the planner's choice is the problem. If it is not, the index is.

**In shipped code it is a decision frozen at the wrong time.** A hint is a claim
that this index is best for this query, asserted once, that will not be revisited
when the data distribution shifts, when a better index is added, or when the
planner improves. The planner re-evaluates; a hint does not. A hinted query is
the one query in the system that cannot benefit from anything you do later.

**It also breaks the measurement.** From the explain page:

> *"During steady state operations (when the query plan is cached), or when using
> `cursor.hint()` with `cursor.explain()`, MongoDB bypasses the plan selection
> process, resulting in a faster actual time, leading to a lower
> `executionTimeMillis` value."*

So a hinted `explain` reports a *lower* time than the same query would take
unhinted, for reasons that have nothing to do with the index. Compare counters,
not clocks.

**And it does not always apply.** Two documented exclusions matter here:
`hint` *"does not apply to `$lookup` and `$graphLookup` stages"*, so hinting an
aggregation directs only the initial collection access
([04·15](../04-the-dashboard/06-lookup-and-why-mostly-you-dont.md)); and a query
containing `$text` cannot be hinted at all
([chunk 10](07-the-text-index.md)).

**The 8.0 answer if you genuinely need to pin a plan** is *query settings*, not a
hint in application code. The Manual is direct: *"Query settings have more
functionality and are preferred over deprecated index filters"*, they *"apply to
the query shape on the entire cluster"*, and *"The cluster retains the settings
after shutdown"*. That puts the decision in the database, where an operator can
see it and remove it, rather than in a repository function where it is invisible
to everyone diagnosing the query.

## The plan cache — why a query gets slower on its own

The planner does not re-plan every query. It runs candidate plans through a trial,
picks a winner, and **caches it against the plan cache query shape**, reusing it
for subsequent queries of the same shape.

Cache entries have three states:

| State | What it means |
|---|---|
| **Missing** | no entry; candidates are evaluated and a winner chosen |
| **Inactive** | a placeholder holding work metrics; plans are still evaluated on each query |
| **Active** | the winning plan is cached and used |

The `Inactive` state is the interesting one: a plan does not become authoritative
on its first win. It records how much work it did, and only becomes `Active` once
it has proved itself against that recorded budget — which is the mechanism that
stops one unrepresentative query from pinning a bad plan forever.

`explain` reports an `isCached` boolean per plan, *"true for a maximum of one plan
between the winning plan and the rejected plans"*, so you can see whether the plan
you are looking at is the cached one.

### What flushes it

- **`mongod` restarts or shuts down** — the cache does not persist.
- **any DDL event on the collection**: dropping the collection, and **creating,
  deleting or hiding an index**.
- **LRU eviction**, which *"clears the least recently accessed entry, regardless
  of state"*.
- **manually**, via `PlanCache.clear()` or `PlanCache.clearPlansByQuery()`.

The second bullet is the one to hold onto: **adding an index invalidates the
cached plans for that collection.** So the plan change you observe after a
deployment may be caused by an index you added for a *different* query — the cache
was flushed, everything re-planned, and something else landed on a different
winner.

### `$planCacheStats`

```js
await db.collection('products').aggregate([{$planCacheStats: {}}]).toArray();
```

One document per cached shape. It is the only tool that answers "what is
production actually running", because — as
[chunk 13](10-explain-verbosity-and-stages.md) established — `explain` deliberately
ignores the cache. If the hypothesis is "the cached plan is bad", `explain` will
show you a healthy freshly-planned alternative and tell you nothing.

Note it is on the list of stages that cannot appear inside a `$facet` and cannot
run inside a transaction.

## The two hashes, used in anger

From [chunk 14](10b-the-plan-tree.md): `planCacheShapeHash` hashes the shape
only; `planCacheKey` hashes the shape **and the available indexes**.

The diagnostic that falls out is worth stating as a procedure:

1. A query got slower and nobody deployed.
2. Compare its `planCacheKey` with what it was before.
3. **Changed** → the set of indexes able to serve that shape changed. Somebody
   added, dropped or hid an index, and the cache was flushed.
4. **Unchanged** → the indexes are the same, so it is the data. Either the cached
   plan is now wrong for the current distribution, or the collection grew past a
   threshold. `$planCacheStats` and `PlanCache.clear()` are the next steps.

## Gotchas

**★ A hint in shipped code is a plan decision frozen at the wrong time.** It
cannot benefit from a better index added later, and it will not adapt when the data
distribution changes. The one query in the system that is pinned is the one that
will not improve when you improve everything else.

**★ A hinted `explain` reports a lower `executionTimeMillis` than reality.**
Hinting bypasses plan selection, so the reported time excludes work the unhinted
query would do. Comparing a hinted run's time against an unhinted one's is
comparing two different measurements.

**★ `hint` does not apply to `$lookup` or `$graphLookup`.** Hinting an aggregation
directs the index used for the initial collection access only. The join still
chooses its own index on `foreignField`, and no hint reaches it.

**★ `$text` queries cannot be hinted at all.** The one query shape whose plan is
least obvious is the one where the forcing diagnostic is unavailable. What remains
is `explain()` on the query as written.

**★ Adding an index flushes the plan cache for that collection.** Every query
shape against it re-plans, so an index added for one query can change the plan of
an unrelated one. A plan change with no code change is often exactly this.

**★ The plan cache does not survive a restart.** A cold `mongod` re-plans
everything, so the first requests after a deployment or a failover are slower for
a reason that is not a regression. Reading a latency graph across a restart
without knowing this produces the wrong conclusion.

**★ `explain` cannot see the cached plan.** It ignores the cache by design and
prevents caching its own winner. When the suspicion is a bad cached plan, `explain`
is actively misleading — it will show you the healthy plan the planner would pick
today. `$planCacheStats` is the tool.

**★ An `Inactive` cache entry means plans are still being evaluated on every
query.** So a shape stuck in `Inactive` is paying plan-selection cost repeatedly.
It is not a failure state — it is the mechanism that prevents one unlucky trial
from pinning a bad plan — but a shape that never reaches `Active` is worth
understanding.

**★ `planCacheKey` changes when indexes change; `planCacheShapeHash` does not.**
That is the whole diagnostic. Monitoring that records only one of them records the
wrong one for "why did this get slow".

**★ `queryHash` is deprecated in 8.0** in favour of `planCacheShapeHash`, with
both present and equal for now and the old one slated for removal. Dashboards and
log parsers written against `queryHash` have an expiry date.

**★ `PlanCache.clear()` is a blunt instrument on a live system.** It forces every
shape against the collection to re-plan, which is a latency spike proportional to
how many shapes there are. `clearPlansByQuery()` narrows it to one shape, and is
what you want when you have identified the bad entry.

## Interview questions

**★ When do you use `hint()`?**
To test a hypothesis, in a diagnostic session, never in shipped code. The pattern
is to run `explain('executionStats')` twice — once as the application writes the
query, once hinted at the index you believe should be used — and compare the
counters. If the hinted plan is much better, the planner's choice is the problem;
if it is not, the index is. Shipping the hint freezes a plan decision that the
planner would otherwise revisit as the data and the index set change, so the
hinted query becomes the one query that cannot benefit from future work.

**★ Why is `executionTimeMillis` particularly untrustworthy under a hint?**
Because hinting bypasses plan selection. The Manual says so explicitly: using
`hint()` with `explain()` skips the trial phase, producing a faster actual time
and therefore a lower reported value. So a hinted run and an unhinted run are not
measuring the same amount of work, and the difference between their times includes
planning overhead that has nothing to do with which index was used. Compare
`totalKeysExamined` and `totalDocsExamined` instead.

**★ A query got slower and nobody deployed anything. Walk through the
diagnosis.**
Start with `planCacheKey`. It hashes the query shape together with the indexes
available to serve it, whereas `planCacheShapeHash` hashes only the shape. If
`planCacheKey` changed, someone changed the indexes — added, dropped or hid one —
which also flushed the plan cache for that collection and caused every shape to
re-plan, so an index added for a different query can change this one's plan. If it
did not change, the indexes are the same and the cause is the data: either the
cached plan is now wrong for the current distribution, or the collection crossed a
size where a different plan wins. `$planCacheStats` shows what is actually cached;
`PlanCache.clearPlansByQuery()` forces a re-plan of that shape alone.

**★ Why can `explain` not diagnose a bad cached plan?**
Because it ignores the plan cache by design — it generates candidates and picks a
winner from scratch — and it additionally prevents the winner it chose from being
cached. So when the problem *is* the cache entry, `explain` shows the healthy plan
the planner would choose today and reports no problem. `$planCacheStats` is the
only tool that reports what is actually cached, and `isCached` in explain output
tells you whether a given plan is the cached one.

**★ What are the three plan cache states and why does `Inactive` exist?**
Missing, Inactive and Active. Missing means no entry, so candidates are evaluated.
Inactive means a placeholder exists holding work metrics, but plans are still
evaluated on each query. Active means the cached plan is used. `Inactive` exists to
stop a single unrepresentative execution from pinning a plan: the first winner
records how much work it did, and only becomes authoritative once a subsequent
execution confirms the estimate. The cost is that a shape in the Inactive state
pays plan-selection overhead repeatedly.

**★ If you genuinely must pin a plan in production, what do you use in MongoDB
8.0?**
Query settings, not a hint in application code. They apply to a query shape across
the entire cluster, survive shutdown, and the Manual states they have more
functionality than the deprecated index filters and are preferred over them. The
argument is not that pinning is better — it is that the pin belongs in the
database, visible to an operator running `$querySettings`, rather than buried in a
repository function where the person diagnosing the query has no reason to look.

**★ What does adding an index do to unrelated queries on the same collection?**
It flushes the plan cache for that collection, because creating an index is a DDL
event. Every query shape against the collection then re-plans on its next
execution, and any of them can land on a different winner than before. So "we
added an index for the reports query and the catalog got slower" is a completely
coherent sentence, and the mechanism is the cache flush rather than the index
itself.

---

← Prev: [The ratio and `SORT`](11-the-ratio-and-the-sort-stage.md) ·
Next → [Building indexes live](13-building-indexes-live.md)
