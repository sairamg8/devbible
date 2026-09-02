---
title: "$merge turns a pipeline into a table, and a rollup collection is a denormalisation that owes the same three answers as any other"
sidebar_label: "18 · $merge and the ladder"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [`$merge`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/merge/)
> (must be the last stage; `whenMatched` defaults to `merge`, `whenNotMatched`
> defaults to `insert`; the unique-index requirement on the `on` fields),
> [`$out`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/out/),
> [Read Preference](https://www.mongodb.com/docs/manual/core/read-preference/).
> Counterpart:
> [1·09 — the performance posture](../../phase-1-database/09-dashboard-queries.md).
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Phase 1 ended its dashboard chapter with an escalation ladder — cache, then
materialised view, then read replica — and the point of writing it down was that
each rung should be chosen rather than stumbled into. Every rung has a MongoDB
spelling, and the middle one is `$merge`: a stage that writes a pipeline's output
into a real collection, incrementally, so a nightly job can refresh three days
rather than rebuild a year. The thing to hold onto is that the resulting rollup
collection is a **denormalisation**, and it owes the same three answers chapter
01 demands of every other one.**

## `$merge` — the materialised view

> *"`$merge` writes the results of an aggregation pipeline to a specified
> collection. It must be the last stage in the pipeline."*
> — [`$merge`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/merge/)

```js
// jobs/rollup-daily.js — runs nightly, and again after any backfill
const pipeline = [
  {$match: {createdAt: {$gte: from, $lt: to}, status: {$in: REVENUE_STATUSES}}},
  {$group: {_id: {$dateTrunc: {date: '$createdAt', unit: 'day', timezone: TZ}},
            revenueCents: {$sum: '$totalCents'}, orders: {$sum: 1}}},
  {$set: {day: '$_id'}},
  {$merge: {
    into: 'dashboardDaily',
    on: 'day',
    whenMatched: 'replace',
    whenNotMatched: 'insert',
  }},
];
```

The options and their defaults:

| Option | Values | Default |
|---|---|---|
| `whenMatched` | `replace`, `keepExisting`, `merge`, `fail`, or a pipeline | `merge` |
| `whenNotMatched` | `insert`, `discard`, `fail` | `insert` |

`replace` is the right choice for a rollup, and the default `merge` is the
dangerous one: it *combines* fields, so a re-run after the pipeline's output
shape changed leaves stale fields from the previous shape alongside the new ones,
and the document becomes a union of two eras. `replace` makes the rollup
**idempotent** — re-running it over the same range produces exactly the same
documents regardless of what was there before, which is the property that lets a
backfill be run twice without anyone worrying.

`whenMatched` can also take a **pipeline**, using `$addFields`, `$project` or
`$replaceRoot`, which is how you express "increment the existing value" rather
than replace it. Resist it for a rollup: an incrementing merge is not idempotent,
so re-running the job double-counts, and a job that cannot be safely re-run is a
job nobody can fix at 2am.

## The `on` field needs a unique index

`$merge` requires a unique index whose keys are exactly the `on` fields, with the
same collation, and it must already exist on the output collection:

```js
await db.collection('dashboardDaily').createIndex({day: 1}, {unique: true});
```

The default `on` is `_id`, which is unique already — so a rollup keyed on `_id`
needs no extra index, at the cost of putting a date into `_id`, which
[chapter 01·06](../01-modeling-the-store/05-ids-and-the-api-contract.md) argues
against for entities and is entirely reasonable for a derived rollup nobody
links to.

The failure mode of forgetting is good: the job errors on its first run. The
failure mode of creating a *non-unique* index instead is bad: it does not satisfy
the requirement either, and if you work around it by keying on `_id` while
leaving `day` unindexed and non-unique, a second run of the job over the same
range inserts a second set of rows and the dashboard doubles.

## `$merge` versus `$out`

`$out` replaces the **entire** output collection. `$merge` writes documents into
it, incrementally.

That difference is what makes the nightly job cheap: it re-merges only the last
three days, not the year, so a backfill after a late-arriving correction touches
three documents instead of rebuilding the collection. With `$out` the same job
re-aggregates the full history on every run, so its cost grows with the data
while its output does not — the pattern that turns a five-second job into a
forty-minute one over two years without anyone changing a line.

`$out` also cannot write to a sharded collection and cannot merge into an
existing one, so **`$merge` is the general tool and `$out` is for "regenerate
this snapshot wholesale"** — a nightly search-index feed, a full export.

Neither may appear inside a `$facet`
([chunk 13](05-facet-and-one-round-trip.md)), so a single pipeline cannot both
serve panels and materialise one. That constraint is why a materialised dashboard
is always two code paths: the job that writes and the endpoint that reads.

## Reading the rollup

```js
// db/mongo/dashboard.js
export function revenueByDay(db, {from, to}) {
  return db.collection('dashboardDaily')
    .find({day: {$gte: from, $lt: to}})
    .sort({day: 1})
    .toArray();
}
```

A `find`, an index scan, a bounded result. That is the whole point: the read cost
stops depending on the order volume and starts depending on the number of days
requested.

Two things the rollup does not give you for free. **Today is incomplete** — the
job ran last night, so the current day is either missing or stale, and the
endpoint has to decide whether to hide it, label it, or top it up with a live
query for the one open day. And **the gap-filling still applies**: a day with no
orders produced no rollup document, so the `$densify` problem from
[chunk 3](01c-densify-and-fill.md) reappears in the read query — unless the job
writes zero rows for empty days, which is the better place to solve it, because
the job knows the full range it processed.

## The escalation ladder, MongoDB edition

Phase 1's ladder, rung for rung:

| Rung | Phase 1 | Phase 8 | Buys | Costs |
|---|---|---|---|---|
| 0 | run it live | run it live | freshness | latency under load |
| 1 | 60-second API cache | the same cache | removes repeated cost | staleness the business accepts |
| 2 | materialized view + refresh | `$merge` into a rollup collection | bounded read cost | a job, and a staleness budget |
| 3 | read replica | `readPreference: 'secondaryPreferred'` | isolation from checkout | replication lag, and reads that can go backwards |

Rung 3 deserves an extra sentence because the MongoDB version is one line of
config and therefore much easier to reach for than Phase 1's, which required
provisioning a replica and routing connections. A secondary read is eventually
consistent: two consecutive dashboard refreshes can hit secondaries with
different lag, so a total can appear to *decrease*, and "the number went down" is
a support ticket. For an admin chart that is usually acceptable — and it should
still be a decision, framed the way Phase 1 framed it: an ops commitment that
buys isolation this load does not yet need.

**This app stays on rung 0, with rung 1 available.** Hundreds of orders a day
against an indexed `$match` is milliseconds, and freshness beats cleverness. The
ladder is written down so the next rung is chosen on evidence rather than
discovered during an incident.

## When precomputing beats querying

Three signals, in the order they usually appear:

1. **The `$match` cannot be made selective enough.** An "all time" report has no
   date range to narrow on, so every run touches every order and the cost grows
   forever. Precompute.
2. **The same expensive result is read many times per write.** A dashboard
   refreshed every thirty seconds against a collection written a few times a
   minute recomputes a nearly-identical answer. Cache, then precompute.
3. **A stage needs `allowDiskUse` on a live endpoint.** That is the design signal
   from [chunk 17](07-limits-and-materialisation.md), and precomputing is usually
   the answer to it.

And the counter-signal, which is the reason this is a ladder and not a default:
**precomputing adds a staleness budget, an owner and a repair path** — the same
three questions
[chapter 01·10](../01-modeling-the-store/07-denormalization-and-staleness.md) asks
of every denormalisation, because a rollup collection *is* one. For
`dashboardDaily` the answers are: stale by up to one night plus the current day;
owned by `jobs/rollup-daily.js`; repaired by re-running that job over any range,
which is safe precisely because `whenMatched: 'replace'` makes it idempotent.

If you cannot give those three answers, the rollup is a liability rather than an
optimisation — a second set of numbers that will one day disagree with the live
query, with nobody able to say which is right.

## Gotchas

**★ `$merge`'s default `whenMatched` is `merge`, not `replace`.** The default
combines fields, so a re-run after the pipeline's output shape changed leaves
fields from the old shape alongside the new ones. A rollup wants `replace`, which
is what makes re-running it idempotent.

**★ A `whenMatched` pipeline that increments is not idempotent.** It reads well —
"add today's orders to the running total" — and it double-counts the moment the
job runs twice, which it will, because retries exist. Rollups recompute; they do
not accumulate.

**★ `$merge` on a non-`_id` field needs a pre-existing unique index.** The
requirement is a unique index whose keys are exactly the `on` fields, with the
same collation. Forgetting it fails the first run, which is fine. Working around
it with a non-unique index and an `_id`-keyed merge is what produces duplicate
rollup rows and a dashboard that doubles.

**★ `$out` replaces the whole collection, every time.** A nightly `$out` job
re-aggregates all history on every run, so its cost grows with the data while its
output does not. Two years later it is the slowest thing in the schedule and
nothing changed.

**★ Neither `$out` nor `$merge` can appear inside a `$facet`.** So "compute the
four panels and materialise one of them" is not one pipeline. The materialised
dashboard is always two code paths, and they have to be kept in agreement by
something other than the compiler.

**★ The rollup's most recent day is incomplete.** The job ran last night; today is
partly or entirely missing. An endpoint that serves the rollup unmodified shows
today as a zero or omits it, and the first person to notice will be whoever
checks the dashboard at lunchtime. Decide explicitly: hide today, label it, or
union a live query for the open day.

**★ Empty days are still empty in the rollup.** The `$group` in the job emits
nothing for a day with no orders, so the read query inherits the gap-filling
problem. Solve it in the *job* — write explicit zero rows for the full processed
range — because the job knows what range it covered and the reader only knows
what it asked for.

**★ A secondary read can go backwards.** `readPreference: 'secondaryPreferred'`
is one line and gives eventual consistency. Two consecutive refreshes can hit
secondaries with different lag, so a total can decrease. For an admin chart that
is usually fine, and it is always worth saying out loud before shipping it.

**★ A rollup collection is a denormalisation and needs the same three answers.**
Staleness budget, owner, repair path. A `$merge` job with no documented way to
rebuild a range is a set of numbers nobody can defend when they disagree with the
live query — and they will disagree, because that is what two sources of one
truth do.

## Interview questions

**★ When does `$merge` beat `$out`, and what does `$merge` require that `$out`
does not?**
`$merge` writes incrementally into an existing collection, so a nightly rollup
can re-merge the last three days rather than rebuilding the year — which keeps
the job's cost proportional to what changed rather than to the history. `$out`
replaces the whole collection on every run, so its cost grows forever. `$merge`
requires a unique index on the `on` fields to already exist on the output
collection, and it requires you to choose `whenMatched`: the default is `merge`,
which unions fields and is not idempotent across a shape change, where a rollup
wants `replace`.

**★ Walk through the escalation ladder for this dashboard and say where you would
stop.**
Rung 0 is running it live, which is where this app stays: hundreds of orders a
day against an indexed `$match` is milliseconds and freshness beats cleverness.
Rung 1 is a short API cache, which removes the repeated cost of a refreshed
dashboard for a staleness the business will not notice. Rung 2 is `$merge` into a
rollup collection, which bounds the read cost but adds a job, a staleness budget
and a repair path. Rung 3 is reading from a secondary, which buys isolation from
checkout traffic and costs eventual consistency — a total that can appear to go
backwards between refreshes. Each rung is chosen on evidence; the reason for
writing the ladder down is so the choice is deliberate rather than made during an
incident.

**★ What makes a rollup job safe to re-run, and why does that matter more than it
sounds?**
`whenMatched: 'replace'` plus a deterministic pipeline over a stated range: the
job's output depends only on the source data and the range, so running it twice
produces the same result as running it once. It matters because every repair
begins with re-running the job. If the job accumulates rather than recomputes,
re-running it corrupts the very numbers you were trying to fix, so the only safe
repair is a manual delete-then-rebuild — which is the procedure nobody documents
and everybody gets wrong under pressure.

**★ You materialise the daily rollup. What is the first bug users report?**
That today is missing or wrong. The job runs nightly, so the current day has no
rollup document until tomorrow, and a chart of "the last thirty days" shows
twenty-nine plus a hole. The fixes, in increasing order of effort: label the
range as "through yesterday"; hide the current day; or serve the historical days
from the rollup and union a live aggregation for the single open day, which is
cheap because it is one day's `$match`.

**★ A rollup number and the live query disagree. How do you decide which is
right?**
By re-running the job for that range and seeing whether the rollup changes. If it
does, the rollup was stale or was written by an older version of the pipeline,
and the live query is right. If it does not, the two pipelines have diverged —
which is the failure mode of maintaining the same logic in two places, and the
reason the job and the endpoint should share the aggregation stages and differ
only in the terminal stage. The deeper answer is that this question is precisely
why a rollup needs a named owner and a documented repair path before it ships.

---

← Prev: [The three limits](07-limits-and-materialisation.md) ·
[Overview](README.md) ·
Next → [Running it from Node](08-running-it-from-node.md)
