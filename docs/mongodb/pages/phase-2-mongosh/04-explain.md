---
title: "explain() from the shell"
sidebar_label: "04 · explain()"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-15 against the **MongoDB Manual** —
> [Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/): the three
> verbosity modes (`queryPlanner` — the default, which does **not** execute the query;
> `executionStats`, which runs the winning plan; `allPlansExecution`, which runs all candidate
> plans), `winningPlan` as *"a tree of stages"* with `rejectedPlans` alongside, and the
> execution metrics `nReturned`, `totalKeysExamined` (*"index entries scanned"*),
> `totalDocsExamined` (which *"includes documents examined but filtered out"* and counts a
> document *"multiple times if examined multiple times"*) and `executionTimeMillis` (which
> *"includes trial phase time but excludes network transmission"* and *"may not represent
> actual steady-state query time"*); the stages `COLLSCAN`, `IXSCAN`, `FETCH`, `SORT`,
> `PROJECTION_COVERED`, `GROUP`, `LIMIT`; that **`explain()` ignores the plan cache**; and
> that MongoDB 8.0 uses `planCacheShapeHash` in place of the deprecated `queryHash`.
> **Documentation-validated; no console blocks.**

**This is the most useful skill in the syllabus.** Everything else tells you what MongoDB
*can* do; `explain()` tells you what it *did*, on your data, for your query.

## The three verbosities

```js
db.orders.find({ status: "open" }).explain();                    // queryPlanner (default)
db.orders.find({ status: "open" }).explain("executionStats");    // runs the winning plan
db.orders.find({ status: "open" }).explain("allPlansExecution"); // runs every candidate
```

| Mode | Runs the query? | Use it when |
|---|---|---|
| `queryPlanner` | **no** | "which index would it use?" — safe on production, cheap |
| `executionStats` | **yes**, the winning plan | the everyday choice: real counts and timings |
| `allPlansExecution` | **yes**, all candidates | "why did it pick *that* index?" |

🔴 **`executionStats` is the one you want**, because the interesting numbers only exist once
the query has run. The default mode shows the plan and nothing about cost.

⚠️ **`executionStats` executes the query**, so on a heavy query it costs what the query costs.
It does not return the documents, but the work happens.

## Reading the output — four numbers

Ignore most of the output at first. Four fields answer the question:

| Field | Meaning |
|---|---|
| **`nReturned`** | documents the query actually returned |
| **`totalKeysExamined`** | index entries scanned |
| **`totalDocsExamined`** | documents examined — *including those examined and filtered out*, and counted again if examined more than once |
| **`executionTimeMillis`** | plan selection plus execution, excluding network time |

**The health check is a ratio.** In a well-served query, `totalKeysExamined` and
`totalDocsExamined` are close to `nReturned`. The further they diverge, the more work is being
thrown away:

| Shape | Reading |
|---|---|
| keys ≈ docs ≈ returned | ideal — the index selects precisely what you asked for |
| keys 0, docs ≫ returned | **`COLLSCAN`** — no usable index |
| keys ≫ returned | the index is being scanned broadly — wrong field order, or a low-selectivity leading field |
| docs ≫ returned, keys ≈ docs | the index finds candidates, then each document is fetched and filtered — a field in the filter is not in the index |
| docs = 0, keys ≈ returned | **covered query** — answered from the index alone; the best case |

## Reading the plan — the stages

`winningPlan` is a tree of stages, each feeding its parent through `inputStage`. Read it
**inside out**: the leaf is where the data came from.

| Stage | What it means |
|---|---|
| **`COLLSCAN`** | every document was examined — usually the finding |
| **`IXSCAN`** | an index was scanned; `indexName` says which, and the key bounds say how much |
| **`FETCH`** | documents were retrieved after the index lookup — normal, unless it dominates |
| **`SORT`** | the sort happened **in memory**, because no index provided the order |
| **`PROJECTION_COVERED`** | the projection was satisfied from the index — no documents read |
| **`LIMIT`**, **`GROUP`** | limiting and aggregation stages |

Two shapes worth recognising immediately:

```
FETCH ← IXSCAN     good: index found candidates, documents fetched
COLLSCAN           bad: no index used
SORT ← COLLSCAN    worst: scan everything, then sort it in memory
```

🔴 **A `SORT` stage is a finding, not a detail.** It means the index did not supply the order,
so MongoDB sorted in memory — which has a memory limit and fails outright on large results
rather than degrading gracefully. An index covering the sort removes the stage entirely.

## Why *that* index? — `rejectedPlans`

The planner races candidate plans and keeps the winner. `rejectedPlans` lists the others, and
`allPlansExecution` shows how each performed — which is how you answer "there is a perfectly
good index and it is not being used". Common answers:

- The rejected index was **less selective on the leading field**.
- The query's sort made another index cheaper overall.
- The plan was chosen on a **trial** of the data, and your data has since changed.

⚠️ **`explain()` ignores the plan cache** and generates candidate plans fresh. So an
`explain()` can show a different plan from the one production is actually running from cache —
worth knowing before concluding that the planner is fine.

## The two-minute diagnosis

Given "this query is slow":

1. **`explain("executionStats")`** on the exact query, filter and sort included.
2. **Look at the leaf stage.** `COLLSCAN` → there is no usable index; that is the answer.
3. **Compare the three counts.** `keys ≫ returned` → wrong index or wrong field order.
   `docs ≫ returned` with keys close to docs → the filter needs a field the index lacks.
4. **Look for `SORT`.** Present → the sort is not index-supported.
5. **Only then** consider the data itself: if keys ≈ docs ≈ returned and it is still slow, the
   query is genuinely returning a lot, and the fix is pagination or projection, not an index.

That sequence answers the phase gate — index, selectivity, or document count — without
guessing.

## Explaining other operations

```js
db.orders.explain("executionStats").find({ status: "open" });          // same, prefix form
db.orders.explain("executionStats").aggregate([{ $match: { status: "open" } }]);
db.orders.explain("executionStats").updateMany({ status: "open" }, { $set: { seen: true } });
```

The prefix form is what you need for aggregations and writes. **Explaining an update does not
perform it** — the plan and the scan cost are what you get, which is exactly what you want
before running a bulk update on production ([topic 05](./05-shell-safety.md)).

## Gotchas

**Symptom:** `explain()` output has no counts.
**Cause:** the default `queryPlanner` mode does not execute the query.
**Fix:** `explain("executionStats")`.

**Symptom:** production is slow but `explain()` shows a good plan.
**Cause:** `explain()` ignores the plan cache, so it may not be showing what production runs —
or the explained query is not the query the application sends (different sort, different
projection, different literal values).
**Fix:** explain the exact operation, and check the cached plan separately.

**Symptom:** `totalDocsExamined` is far larger than the collection.
**Cause:** documents are counted each time they are examined, which happens with multikey
indexes and some plan shapes.
**Fix:** it is documented behaviour — read it as "how much work", not "how many documents
exist".

**Symptom:** the query is fast in `explain` and slow for users.
**Cause:** `executionTimeMillis` excludes network transmission, and the Manual warns it may not
represent steady-state time.
**Fix:** measure end-to-end separately; use `explain` for the plan and the counts, not as a
latency benchmark.

**Symptom:** a `SORT` stage appears despite an index on the sort field.
**Cause:** the index cannot supply that order given the filter — usually field order in a
compound index, or a multikey field.
**Fix:** build the compound index in the order equality → sort → range, and re-explain.

**Symptom:** an index exists and is not used.
**Cause:** low selectivity on the leading field, a competing plan winning on the trial, or a
type mismatch meaning the filter cannot use it at all
([Phase 1](../phase-1-documents-and-bson/01-the-bson-types.md)).
**Fix:** `allPlansExecution` to see the alternatives, and check the field's actual BSON types.

## Interview questions

**★ What are the three `explain()` verbosity levels?**
`queryPlanner` is the default and does not execute the query — it shows the winning plan and
the rejected ones. `executionStats` runs the winning plan and returns real counts and timings.
`allPlansExecution` runs every candidate plan and reports on each, which is how you find out
why a different index lost. `executionStats` is the everyday choice; the default's safety is
that it does no work.

**★ Which numbers do you look at, and what does a bad ratio mean?**
`nReturned`, `totalKeysExamined`, `totalDocsExamined` and `executionTimeMillis`. In a healthy
query the three counts are close. Keys far above returned means the index is being scanned too
broadly — usually the wrong leading field. Docs far above returned means documents are being
fetched and then filtered, so the filter needs a field the index does not have. Keys zero with
docs high is a `COLLSCAN`.

**★ What does a `SORT` stage tell you?**
That the sort happened in memory because no index supplied the order. It is a finding, not a
detail: in-memory sorts have a memory limit and fail on large results rather than slowing
gracefully. An index that supports the sort — compound, with the sort field in the right
position — removes the stage.

**★ You explain a slow production query and the plan looks fine. What now?**
Remember that `explain()` ignores the plan cache and builds candidate plans fresh, so it may
not reflect what production is running. Also check that you explained the *exact* operation —
the same filter, sort and projection — since a different sort changes plan selection entirely.
And `executionTimeMillis` excludes network time and may not be steady-state, so end-to-end
latency needs its own measurement.

**What does a covered query look like in explain output?**
`totalDocsExamined` is 0 and a `PROJECTION_COVERED` stage appears: every field needed was in
the index, so no documents were read. It is the best possible shape, and it is why projecting
only what you need can change a query's cost class.

**How do you check a bulk update before running it?**
`db.coll.explain("executionStats").updateMany(...)`. Explaining a write does not perform it, so
you see the plan and the scan cost first — which on production is the difference between a
targeted update and an accidental collection scan.

---

← Prev: [Cursors](./03-cursors.md) ·
Index: [Phase 2](./README.md) ·
Next → [Shell safety on production](./05-shell-safety.md)
