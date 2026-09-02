---
title: "explain() has three verbosities that answer three different questions, and the act of running it changes the thing you are measuring"
sidebar_label: "13 · Reading explain()"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/)
> (*"`explain` ignores the plan cache. Instead, a set of candidate plans are
> generated, and a winner is chosen without consulting the plan cache. Furthermore,
> `explain` prevents the MongoDB query planner from caching the winning plan"*;
> *"The `explain` results present the query plans as a tree of stages"*; the stage
> name list; the `queryPlanner` / `executionStats` / `serverInfo` structure;
> *"Starting in MongoDB 8.0, rejected query plans only contain the `find` portion
> of the query"*),
> [`db.collection.explain()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.explain/),
> [`cursor.explain()`](https://www.mongodb.com/docs/manual/reference/method/cursor.explain/).
> Counterpart: `EXPLAIN (ANALYZE, BUFFERS)`
> ([1·10](../../phase-1-database/10-indexes.md)).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Every index in [chunk 2's list](02-the-index-list.md) was derived from a query;
`explain()` is how you check the derivation was right. It plays the role
`EXPLAIN ANALYZE` plays in Phase 1 and it differs in two ways worth knowing before
you trust the output. It has three verbosity levels, and the default one does not
run the query at all — so the field everyone looks at first is absent unless you
ask for it. And **running `explain` changes the system**: it bypasses the plan
cache and prevents the winning plan from being cached, which means the plan you
are shown is not necessarily the plan production is using. The plan tree itself —
the stage names, which way to read it, and why its shape depends on which
execution engine ran the query — is [the next chunk](10b-the-plan-tree.md).**

## 🔴 Never trust a plan you have not run yourself

One rule before anything else, and it is the reason this chunk contains no
`explain()` output: **plan output is specific to a deployment, a data
distribution, a version and a moment.** Two servers running the same MongoDB
version over the same schema will choose different plans if their data differ, and
the same server will choose differently next week. A plan pasted from anywhere —
a blog, a colleague, a page like this one — is evidence about *that* system, not
yours.

So this chunk describes the fields and what they mean, quoting the Manual for
each, and leaves the running to you. The gate at the end of the chapter is
mechanical and you perform it against your own data.

## Three verbosities, three questions

| Mode | Runs the query? | Answers |
|---|---|---|
| `queryPlanner` *(default)* | no | "which plan would be chosen, and what was rejected?" |
| `executionStats` | yes, the winning plan | "and what did it actually cost?" |
| `allPlansExecution` | yes, plus trial data for the losers | "and why was that one chosen?" |

The Manual is explicit that the counters live only in the last two: *"In order to
include `executionStats` in the results, you must run the explain in either
`executionStats` or `allPlansExecution` verbosity mode."*

Which means the default mode gives you a plan shape and **no numbers**. That is
frequently what you want — "is it using the index I built?" is a `queryPlanner`
question — and it is a common source of confusion when someone runs `explain()`
with no argument and cannot find `totalDocsExamined`.

`allPlansExecution` earns its keep exactly once: when the planner picked a plan
you did not expect and you want to see how the alternatives scored during the
trial period. It *"includes partial execution data captured during plan
selection"* for both winning and rejected plans.

## How to run it

From the driver, on a cursor:

```js
const plan = await db.collection('products')
  .find({'category.slug': 'desks', deletedAt: null})
  .sort({priceCents: 1, _id: 1})
  .limit(24)
  .explain('executionStats');
```

or on the collection, which takes the verbosity first and then the operation:

```js
const plan = await db.collection('products')
  .explain('executionStats')
  .find({'category.slug': 'desks', deletedAt: null});
```

and for an aggregation, the option goes on the call:

```js
const plan = await db.collection('orders')
  .aggregate(dashboardPipeline({from, to}), {explain: true}).toArray();
```

Note that `explain` on an aggregation is **not available inside a transaction** —
the `aggregate` command's documentation lists `explain` among the things you
cannot specify there — and it is not available under Stable API V1.

## 🔴 `explain` is not a passive observer

> *"`explain` ignores the plan cache. Instead, a set of candidate plans are
> generated, and a winner is chosen without consulting the plan cache.
> Furthermore, `explain` prevents the MongoDB query planner from caching the
> winning plan."*
> — [Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/)

Two consequences, and both matter when you are debugging a slow query in
production.

**The plan you are shown may not be the plan production ran.** Production
consults the cache; `explain` does not. If a stale or unlucky cache entry is the
actual problem, `explain` will show you a healthy plan and you will conclude
nothing is wrong. The tool for that question is `$planCacheStats`
([chunk 16](12-hint-and-the-plan-cache.md)), not `explain`.

**`explain` also prevents caching the plan it just chose**, so running it does not
warm anything and repeated runs re-plan every time.

And the timing is affected too:

> *"The time reported by `explain.executionStats.executionTimeMillis` is not
> necessarily representative of actual query time. During steady state operations
> (when the query plan is cached), or when using `cursor.hint()` with
> `cursor.explain()`, MongoDB bypasses the plan selection process, resulting in a
> faster actual time, leading to a lower `executionTimeMillis` value."*

So the number is inflated relative to steady state when `explain` plans from
scratch, and deflated when a `hint` skips planning. **`executionTimeMillis` is the
least trustworthy field in the output** and the counters beside it are the ones to
read — which is
[chunk 15](11-the-ratio-and-the-sort-stage.md).

## Gotchas

**★ The default verbosity does not run the query.** `explain()` with no argument
is `queryPlanner` mode and returns no `executionStats`, so
`totalDocsExamined` and `nReturned` are simply absent. Ask for
`'executionStats'` when you want numbers.

**★ `explain` bypasses the plan cache and prevents caching its own result.** The
plan it shows is planned from scratch, so it may differ from the plan production
is executing from a cache entry. If the suspicion is "the cached plan is bad",
`explain` is the wrong tool and `$planCacheStats` is the right one.

**★ `executionTimeMillis` is not the query's real time.** The Manual says so
directly: it includes plan-selection time when planning from scratch, and it drops
when `hint()` skips planning. Two `explain` runs of the same query can differ by
more than the change you are testing. Read the counters, not the clock.

**★ You cannot `explain` an aggregation inside a transaction, or under Stable API
V1.** Both are documented exclusions, and both are the kind of thing you discover
while trying to debug something else.

**★ A plan copied from anywhere else is worthless.** Plans depend on data
distribution, index availability, version and the moment. This is why this page
quotes field definitions rather than showing output, and why the gate is something
you run.

## Interview questions

**★ What are the three `explain` verbosities and when do you use each?**
`queryPlanner` is the default and does **not** run the query: it shows the winning
plan and the rejected candidates, which is what you want for "is it using the index
I built?". `executionStats` runs the winning plan and adds the counters —
`nReturned`, `totalKeysExamined`, `totalDocsExamined` — which is what you want for
"and what did it cost?". `allPlansExecution` additionally includes partial
execution data captured for the rejected plans during the trial period, which is
what you want for "why did it choose *that*?". Most confusion about missing fields
is someone in the default mode looking for `executionStats` numbers.

**★ Why can `explain` show you a plan production is not using?**
Because `explain` ignores the plan cache — it generates candidates and picks a
winner from scratch — while a production query consults the cache and may be
executing a plan chosen under different conditions. The Manual also notes that
`explain` prevents the winning plan it chose from being cached, so it does not
even leave the system in the state it just described. When the hypothesis is "the
cached plan is wrong", the tool is `$planCacheStats`, not `explain`.

**★ Someone shows you `executionTimeMillis: 240` and says the query is slow. What
do you say?**
That the field is unreliable in both directions and the counters are the evidence.
The Manual states it includes plan-selection time — so an `explain` that plans
from scratch reports more than steady state, where the plan is cached — and that
using `hint()` with `explain()` bypasses planning and reports less. Ask instead
for `totalKeysExamined`, `totalDocsExamined` and `nReturned`, which describe work
done rather than time taken and do not move with planning overhead.

**★ Why does this page contain no `explain` output?**
Because plan output is a property of one deployment's data, indexes, version and
moment, and a plan copied from elsewhere is evidence about that system rather than
yours. The useful, portable content is what each field means and which
combinations indicate a problem; the output itself has to come from running the
query against your own data at a realistic size, which is what the chapter's gate
asks you to do.

---

← Prev: [Index intersection](09-index-intersection.md) ·
Next → [The plan tree](10b-the-plan-tree.md)
