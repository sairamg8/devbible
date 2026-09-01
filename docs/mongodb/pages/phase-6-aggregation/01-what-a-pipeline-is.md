---
title: "What a pipeline is"
sidebar_label: "01 · What a pipeline is"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **MongoDB Manual** (v8.0) —
> [Aggregation Pipeline](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/): a pipeline
> consists of *"one or more stages that process documents"*, each stage performing an operation on
> its input and passing its output documents to the next stage; *"a stage does not need to output
> one document for every input document"*; and the same stage **may appear multiple times in a
> pipeline, with the exception of `$out`, `$merge` and `$geoNear`** —
> [Aggregation Pipeline Limits](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-limits/):
> each **result document** is subject to the **16 MiB** BSON document limit (documents *may* exceed
> it while being processed), **100 MiB per stage** with `allowDiskUseByDefault` governing spilling,
> and a **maximum of 1000 stages** per pipeline —
> [Aggregation Pipeline Optimization](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-optimization/)
> for the rewriting the server does before executing what you wrote.
> **Documentation-validated; no console blocks.**

`find()` answers one question: *which documents match?* It can project fields and sort them, and
that is the end of its vocabulary. It cannot count per group, cannot compute a field from two
others, cannot join, cannot turn one document into five.

**The aggregation pipeline is MongoDB's actual query language.** Everything a report, a dashboard,
or a screen backed by two collections needs is expressed here.

```js
db.orders.aggregate([
  { $match: { status: "paid", placedAt: { $gte: since } } },
  { $unwind: "$lines" },
  { $group: { _id: "$lines.sku", revenue: { $sum: "$lines.total" } } },
  { $sort: { revenue: -1 } },
  { $limit: 10 },
]);
```

Five stages, read top to bottom: narrow, explode, aggregate, order, cut. That is the whole model.

## The mental model: a stream of documents through a list of stages

A pipeline is an **array of stages**. Documents enter the first stage, and each stage's output is
the next stage's input. The Manual's own wording is that each stage *"performs an operation on the
input documents"* and *"passes the results to the next stage"*.

Two consequences fall straight out of that, and almost every misunderstanding on this page is a
failure to hold one of them.

**1. Cardinality is not preserved.** The Manual states it plainly: *"a stage does not need to output
one document for every input document."* A stage may emit

| Stage | In → Out |
|---|---|
| `$match` | N → fewer (a filter) |
| `$project`, `$addFields`, `$set` | N → N (a reshape) |
| `$unwind` | N → **more** (one per array element) |
| `$group` | N → one per distinct key |
| `$limit` | N → at most *n* |
| `$count` | N → **exactly 1** |

`$unwind` and `$group` are the two that change the *unit* of the stream. After `$unwind: "$lines"`
you are no longer looking at orders, you are looking at order lines. After `$group` by SKU you are
looking at SKUs. Every stage below has to be written against the new unit, and reading a pipeline
means tracking what one document *is* at each line.

**2. There is no "the collection" after stage one.** Later stages see only what was handed to them.
A field dropped by a `$project` in stage 3 does not exist in stage 4, no matter that it is right
there on disk. This is the single most common cause of a `$sort` or `$group` that silently produces
nothing: it is keyed on a field an earlier stage removed, and a missing field is `null`, not an
error.

## What you actually write

`db.collection.aggregate(pipeline, options)`. The pipeline is a plain array — build it with
ordinary JavaScript, because it *is* ordinary data:

```js
const pipeline = [{ $match: filter }];
if (needsCustomer) pipeline.push({ $lookup: customerJoin });
pipeline.push({ $sort: { placedAt: -1 } }, { $limit: pageSize });

const cursor = db.orders.aggregate(pipeline);
```

That composability is worth naming: a pipeline built by pushing objects onto an array is testable
and diffable in a way a hand-concatenated query string never is. A filter that must be conditional
is an `if`, not a string template.

**`aggregate()` returns a cursor**, like `find()` — not an array. It is lazy, it is batched, and in
`mongosh` it is printed for you, which is exactly why so many people believe it returns an array. In
a driver you iterate it or call `toArray()`, and `toArray()` on an unbounded pipeline is how a Node
process gets OOM-killed by a report.

## Repeating a stage is normal — and three stages that cannot repeat

The Manual is explicit that the same stage **may appear multiple times in a pipeline**, and good
pipelines use that constantly: `$match` early to hit an index, `$match` again after a `$group` to
filter on the computed total, because the computed total did not exist the first time.

```js
db.orders.aggregate([
  { $match: { placedAt: { $gte: since } } },          // indexed, on a stored field
  { $group: { _id: "$customerId", spend: { $sum: "$total" } } },
  { $match: { spend: { $gte: 1000 } } },              // on a field that only exists now
]);
```

The exceptions, named in the Manual: **`$out`, `$merge` and `$geoNear`**. The first two write the
result somewhere and are therefore terminal by nature; `$geoNear` must be first, because it *is* the
index scan.

## The three limits that decide whether a pipeline survives production

From the Aggregation Pipeline Limits page, and worth memorising as a set — they fail at different
times and for different reasons.

**16 MiB, on each result document.** The BSON document limit applies to what comes *out*. The
Manual notes documents may exceed it *while being processed*, which sounds generous and is a trap:
a `$group` that does `{ items: { $push: "$$ROOT" } }` builds a document that grows with the group,
and it fails at the moment it is returned, on the day one group finally gets big enough. It passes
every test written against a small dataset.

**100 MiB per stage.** Since 6.0 this is governed by the `allowDiskUseByDefault` server parameter:

| `allowDiskUseByDefault` | Behaviour over 100 MiB | Per-query override |
|---|---|---|
| `true` (the default from 6.0) | the stage **spills to temporary files** and continues | `{ allowDiskUse: false }` forbids it — the stage errors instead |
| `false` | the stage **errors** | `{ allowDiskUse: true }` permits spilling |

The stages that can spill are named: `$bucket`, `$bucketAuto`, `$group`, `$setWindowFields`,
**`$sort` when it is not supported by an index**, and `$sortByCount`. `$search` is exempt — it runs
in a separate process. The Manual's advice for a `$sort` that exceeds the limit is direct: *"consider
adding a `$limit` stage."*

Note what "spills to disk" actually buys you: correctness, not speed. A pipeline that spills has
stopped being a query and become a batch job, and if a request is waiting on it, the user is waiting
on disk I/O.

**1000 stages, maximum.** You will not hit this by hand. You hit it by generating a pipeline in a
loop.

## The server rewrites what you wrote

Before executing, the optimizer rewrites the pipeline: it moves `$match` earlier, coalesces `$limit`
into `$sort`, merges adjacent `$match`/`$limit`/`$skip` stages, and prunes fields nobody reads. The
next pages cover each of those. Two things follow immediately.

**Write the pipeline that is clearest, not the one you think is fastest** — with one exception
(`$match` first, which is topic 02, because the optimizer can only move a `$match` it is *allowed*
to move). The Manual is blunt about the common premature optimisation: placing a `$project` early to
cut fields *"is unlikely to improve performance — the database performs this optimization
automatically."*

**Read the plan, not the source.** `db.orders.aggregate(pipeline, { explain: true })` — or
`.explain()` in `mongosh` — shows the pipeline the server will actually run, after rewriting. If you
are reasoning about index use from the array you typed, you are reasoning about the wrong pipeline.

## Where the pipeline runs

On the server, in the data-bearing node — not in your application. That is the entire point, and it
is the honest justification for the complexity: a report that fetches 200,000 orders into Node and
reduces them there pays for 200,000 documents of BSON decoding and network transfer to produce ten
rows. The same work as a pipeline transfers ten documents. The phase gate — top ten products by
revenue, joined, paginated, with a total count — is *one round trip* for exactly this reason.

## Gotchas

**Symptom:** a `$group` or `$sort` on a field returns one bucket keyed `null`, or an arbitrary order.
**Cause:** an earlier `$project` dropped the field. Referencing a field that does not exist yields
`null` silently, in every stage.
**Fix:** track the document shape stage by stage; prefer `$addFields`/`$set` over `$project` unless
you genuinely mean to discard everything else.

**Symptom:** a pipeline that worked for months suddenly errors with a BSON size error.
**Cause:** a `$push` or `$addToSet` accumulator built a result document past 16 MiB for one group.
The limit is on the *result*, so it fails only when a group finally gets big enough.
**Fix:** do not accumulate whole documents. `$push` the two fields you need, or `$limit` upstream, or
restructure so the group produces a count rather than a list.

**Symptom:** the pipeline errors with "Exceeded memory limit" on production but not locally.
**Cause:** `allowDiskUseByDefault` is `false` on that deployment, or the query passes
`{allowDiskUse: false}`, and a `$sort`/`$group` crossed 100 MiB with more data than your dev set.
**Fix:** support the `$sort` with an index (an index-supported sort is not subject to the limit) or
add a `$limit`. Turning on disk use makes it succeed slowly; that is a fallback, not a fix.

**Symptom:** you added `$project: {a: 1, b: 1}` as the first stage and nothing got faster.
**Cause:** the optimizer already prunes unused fields. The Manual says this explicitly.
**Fix:** delete the stage. Optimise the `$match` and its index instead.

**Symptom:** `$geoNear` errors with a complaint about position, or `$out` "must be the last stage".
**Cause:** these are the three stages with placement rules — `$geoNear` first, `$out`/`$merge` last,
and none of the three may appear twice.
**Fix:** restructure. If you need geo *and* a prior filter, put the filter in `$geoNear`'s own
`query` option.

**Symptom:** a Node process running a report gets OOM-killed.
**Cause:** `toArray()` on an unbounded pipeline. The cursor is lazy; `toArray()` is not.
**Fix:** iterate the cursor, or bound the pipeline with `$limit` — and remember the server's 100 MiB
stage limit does not protect your client's heap at all.

**Symptom:** the same pipeline gives different pagination results between page 1 and page 2.
**Cause:** an unstable sort. Documents with equal sort keys have no guaranteed relative order.
**Fix:** always add a tiebreaker with unique values — `{ revenue: -1, _id: 1 }`. Covered in topic 05.

**Symptom:** you build the pipeline with string concatenation and get a syntax or injection problem.
**Cause:** treating a pipeline as text. It is data.
**Fix:** build the array with ordinary code. Never interpolate user input into an operator position.

## Interview questions

**★ What is an aggregation pipeline, and how does it differ from `find()`?**
An ordered array of stages, where each stage takes documents in, performs an operation, and passes
its output to the next. `find()` can only filter, project and sort a single collection's documents —
the unit of the result is always "a document from this collection". A pipeline can change that unit:
`$group` collapses many documents into one per key, `$unwind` expands one into many, `$lookup` pulls
in another collection. It runs on the server, so the reduction happens next to the data rather than
after a full transfer to the client.

**★ Does every stage output one document per input document?**
No — and the Manual says so explicitly. `$match` and `$limit` output fewer, `$unwind` outputs more,
`$group` outputs one per distinct key, `$count` outputs exactly one. Reading a pipeline means
tracking what a single document represents after each stage, because that changes.

**★ What are the limits on a pipeline?**
Three. Each **result document** is subject to the 16 MiB BSON limit — documents may exceed it during
processing but not on the way out. Each **stage** is limited to 100 MiB of memory; from 6.0 the
`allowDiskUseByDefault` parameter decides whether crossing it spills to temporary files or errors,
and a query can override it per-call with `allowDiskUse`. And a pipeline may have at most **1000
stages**.

**★ Which stages can spill to disk, and which cannot?**
`$bucket`, `$bucketAuto`, `$group`, `$setWindowFields`, `$sortByCount`, and `$sort` **only when it is
not supported by an index**. `$search` is exempt because it runs in a separate process. The
qualification on `$sort` is the useful half: an index-supported sort does not accumulate documents in
memory at all, which is why the real fix for a sort that blows the limit is an index, not
`allowDiskUse`.

**Can the same stage appear more than once?**
Yes, and it should. `$match` before a `$group` uses an index on a stored field; `$match` after the
`$group` filters on the computed value, which did not exist earlier. The documented exceptions are
`$out`, `$merge` and `$geoNear`.

**Does `aggregate()` return an array?**
No, a cursor — lazily evaluated and batched, like `find()`. `mongosh` prints it, which is why people
think otherwise. `toArray()` in application code on an unbounded pipeline pulls the whole result into
your process's heap, where none of the server's memory limits apply.

**Should you put a `$project` early to reduce the data flowing through the pipeline?**
Generally no. The Manual states the optimizer already determines whether only a subset of fields is
needed and reduces what passes through, and that adding a `$project` for this *"is unlikely to
improve performance"*. The stage that genuinely belongs first is `$match`, because it decides whether
an index can be used at all.

**How would you confirm what a pipeline actually does before it runs?**
Explain it. The server rewrites the pipeline before execution — moving `$match` forward, coalescing
`$sort` with `$limit`, merging adjacent stages — so the array you typed is not the plan. `explain`
shows the optimized pipeline and whether the first stage reaches an `IXSCAN`.

---

Index: [Phase 6](./README.md) ·
Next → [`$match` first, always](./02-match-first.md)
