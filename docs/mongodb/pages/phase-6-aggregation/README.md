---
title: "Phase 6 — The aggregation pipeline"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-09-01 against the **MongoDB Manual** (v8.0). Sources named per page.
> **Documentation-validated** under the no-new-sandboxes rule; **no console blocks**.

**🚧 5 of 6 topics written — `$unwind` is the one still owed.** MongoDB's real query language:
everything the `find` API cannot do lives here, including every report and every screen that needs
data from two collections.

> **Scope:** the syllabus was cut to the critical path on 2026-08-14 — **204 → 82 topics**,
> Master tier only, capped at 6 per phase. This phase went from 20 to 6.

| # | Page | Tier | State |
|---|---|---|---|
| 01 | [What a pipeline is](./01-what-a-pipeline-is.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 02 | [`$match` first, always](./02-match-first.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 03 | [`$project` vs `$addFields` / `$set`](./03-project-vs-addfields.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 04 | [`$group` — the stage](./04-group-and-accumulators.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 04b | [The accumulators](./04b-the-accumulators.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 05 | [`$sort`, `$limit` and `$skip`](./05-sort-limit-skip.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 06 | `$unwind` — one document per array element | <span className="db-tier t-master">Master</span> | ⬜ **not written yet** |

Topic 04 was drafted as one page, ran past the 300-line file cap, and was **split** on the boundary
between the stage and its accumulators — 04 and 04b are one topic in two files, not two topics.

## Coverage

| | |
|---|---|
| Topics written | **5 of 6** |
| Pages on disk | **6** (04 is two files) |
| Evidence | MongoDB Manual, named per page; **no console blocks** |

## The theme

Phase 5 was about queries that return the wrong **documents**. This phase is about pipelines that
return the wrong **numbers** — and about the gap between the pipeline you write and the one the
server runs.

Three ideas carry the whole phase:

**Cardinality is not preserved.** `$group` collapses, `$unwind` multiplies, `$match` filters. Reading
a pipeline means tracking what a single document *represents* at each line, because that changes.

**Indexes are only reachable at the start.** Once a stage computes, reshapes or groups, the stream no
longer corresponds to anything on disk and every stage below is a scan. That is why `$match` first is
the one placement rule worth memorising, and why `$sort` loses its index the moment an `$addFields`
sneaks above it.

**Nothing fails loudly.** A field dropped by a `$project` is `null` three stages later, not an error.
`$sum` skips string values and under-reports revenue. An unstable `$sort` duplicates a row across two
pages. `$push` works for a year and then exceeds 16 MiB on one customer. Every page here is a variation
on a wrong answer that arrives with a `200 OK`.

## The three limits, in one place

| Limit | Applies to | What crossing it does |
|---|---|---|
| **16 MiB** | each **result** document | errors — documents may exceed it *during* processing, not on the way out |
| **100 MiB** | each **stage** | spills to temporary files, or errors, per `allowDiskUseByDefault` |
| **1000** | stages per pipeline | errors |

## The phase gate

**Move on when** you can write, and explain the cost of, a pipeline that returns the top 10 products
by revenue for a date range, with the customer name joined in, paginated, and with a total count — in
one round trip.

The pieces are spread across these pages deliberately: the early indexed `$match`
([02](./02-match-first.md)), the `$unwind` onto line items (06), the `$group` and its accumulators
([04](./04-group-and-accumulators.md), [04b](./04b-the-accumulators.md)), the `$sort` with a unique
tiebreaker and the top-*k* coalescence ([05](./05-sort-limit-skip.md)), and `$facet` to get the page
and the count from one pass ([04](./04-group-and-accumulators.md)).

---

← Prev: [Phase 5 · Query operators](../phase-5-query-operators/README.md) ·
Index: [MongoDB pages](../README.md)
