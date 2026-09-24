---
name: devbible-mongodb-pages-progress
description: Live progress of the MongoDB explanation pages — claimed 2026-08-14 on finishing CSS; Phase 0 under way, doc-validated against the MongoDB Manual
metadata:
  type: progress
---

:::danger CONSOLIDATED 2026-08-15 — THE WORKTREE IN THIS FILE NO LONGER EXISTS
Every devbible worktree and branch was **merged into `main` and DELETED** on 2026-08-15
(*"commit every uncommitted branch to main and delete everything"*). **All the content
described below is on `main`** at `/run/media/sairam/Storage/Backup/Knowledge/devbible`
— nothing was lost, every branch was verified at 0 unique commits first. Ignore any
"worktree", "branch", "not merged" or "merge at the phase close" instruction below and
**work on `main`**. `main` builds 0 warnings / 0 broken links, so a break there is yours.
Full record: `progress_worktree_consolidation_20260815.md`.
:::

Live build log for the MongoDB pages. The syllabus was written by an earlier session and
is the approved plan — **15 phases, 204 topics**, four part files in
`docs/mongodb/syllabus/`.

## Claim — 🔴 RE-CLAIMED 2026-08-14 by session `05921047`

**Taken over on 2026-08-14 by session `05921047`**, on the user's instruction after that
session closed React Phase 14 (*"Incase if you finish please pick mongodb … make sure to
create new worktree"*).

🔴 **Work happens in a WORKTREE, not on `main`:**
`/run/media/sairam/Storage/Backup/Knowledge/devbible-mongodb`, branch **`mongodb-pages`**,
with `node_modules` **symlinked** to the main checkout's (no `yarn install` needed).
⚠️ **Not merged into `main` yet** — say so plainly; merge at a phase close.

The previous claim (`6f020813`) was stale — that session finished Phase 0 and stopped
without writing `pages/README.md`; `632ebd35` repaired two uncommitted pages without taking
the claim. Both notices are now replaced.

## Where I am

| | |
|---|---|
| **Pages written** | **34 of 82 topics** — Phases 0, 1, 2, 3, 4, 5 ✅ |
| **Next** | **Phase 6 · The aggregation pipeline (6 topics)** — ⚠️ **sources ALREADY FETCHED, see below** |
| **Merged** | ✅ `mongodb-pages` merged into `main` at **every phase close through Phase 5** — verified 0 unique commits vs `main`, nothing stranded; build clean, **0 broken links in `docs/mongodb/`** (6 remain in `javascript`/`typescript`, other sessions', left alone) |
| **Evidence** | **Documentation-validated** against the MongoDB Manual v8.0 + bsonspec.org. **No sandbox, no console blocks** — and note there is **no MongoDB server on this machine**, so there never can be |
| **Cap** | 0 files over 300 lines (Phase 1 pages are 150–175) |

### Phase 1 — Documents, BSON types and `_id` ✅ COMPLETE

| Topic | State |
|---|---|
| 01 The BSON types, completely | ✅ 171 lines |
| 02 `_id` | ✅ 152 lines |
| 03 `ObjectId` | ✅ 193 lines |
| 04 Numbers — int32, int64, double, Decimal128 | ✅ 193 lines |
| 05 Dates vs Timestamps | ✅ 178 lines |
| 06 Arrays as a first-class type | ✅ 222 lines |

**Phase 1 is COMPLETE — 6 topics, 1,177 lines including the index, 0 over the 300-line cap.**

**Sources fetched for this phase — do not re-fetch:** the Manual's
[BSON comparison/sort order](https://www.mongodb.com/docs/manual/reference/bson-type-comparison-order/)
(the full order MinKey → Null → Numbers → String → Object → Array → BinData → ObjectId →
Bool → Date → Timestamp → Regex → JS → MaxKey; **all numeric types compare as equivalent**;
non-existent fields sort as null; **`[]` sorts before null**),
[ObjectId](https://www.mongodb.com/docs/manual/reference/method/ObjectId/) (4-byte
timestamp + 5-byte per-process random + 3-byte counter, **big-endian** for timestamp and
counter unlike other BSON values; `getTimestamp()`; ⚠️ **the docs make no explicit ordering
guarantee**) and [Documents](https://www.mongodb.com/docs/manual/core/document/) (`_id`
required, immutable, auto unique index, driver-generated, **no array/regex/undefined**,
always moved to first position, time series collections exempt).

### Phase 0 — How MongoDB runs (5 topics after the cut)

| Topic | State |
|---|---|
| 01 What MongoDB actually is | ✅ |
| 02 The single-document atomicity guarantee | ✅ |
| 03 BSON | ✅ |
| 04 Document, collection, database | ✅ |
| 05 MongoDB vs PostgreSQL — the actual trade | ✅ |

*(the phase was 14 topics before the cut; the 5 that survived are exactly its Master rows,
and the 3 written before the cut were all among them — no work was wasted.)*


### Phase 6 — The aggregation pipeline 🚧 IN PROGRESS (session `fa340bd8`, 2026-09-01)

🔴 **LIVE RUN 2026-09-01.** Directory `docs/mongodb/pages/phase-6-aggregation/` exists,
`_category_.json` written (`{"label":"Phase 6 · The aggregation pipeline","position":6}`).

| Topic | File | State |
|---|---|---|
| 01 What a pipeline is | `01-what-a-pipeline-is.md` | ✅ 264 lines, committed `98f11153` |
| 02 `$match` first, always | `02-match-first.md` | ✅ 296 lines, committed `edd970d2` |
| 03 `$project` vs `$addFields`/`$set` | `03-project-vs-addfields.md` | ✅ written |
| 04 `$group` — the stage | `04-group-and-accumulators.md` | ✅ 253 lines |
| 04b The accumulators | `04b-the-accumulators.md` | ✅ 284 lines — 🔴 **SPLIT** from 04 (drafted 336, over cap) |
| 05 `$sort`, `$limit`, `$skip` | `05-sort-limit-skip.md` | ✅ 278 lines, `sidebar_position: 6` |
| 06 `$unwind` | `06-unwind.md` | 🔴 **START HERE — the only file owed.** `sidebar_position: 7` |
| — index | `README.md` | ✅ 82 lines, written early so no link dangles — **flip the 06 row to ✅ and "5 of 6"→"6 of 6" when 06 lands** |

**Phase 6 closed out at 5 of 6 — 1,750 lines across 7 files, 0 over the 300-line cap,
0 broken links, 24 ★ interview questions.** Session `fa340bd8` stopped here at 97% usage,
not because of a blocker.

🔴 **EXACTLY what the next session does, in order:**
1. Write `docs/mongodb/pages/phase-6-aggregation/06-unwind.md`, `sidebar_position: 7`.
   **Its source is already fetched** — the `$unwind` block further down this file has the
   whole Manual page recorded (`preserveNullAndEmptyArrays` defaults **false**, a missing/
   null/empty-array field produces **NO** output document — the documented example drops 3
   of 5 — `includeArrayIndex` adds a `Long` and `null` for non-array input, name cannot
   start with `$`). Also already recorded, from the optimization page: **`$lookup` +
   `$unwind` + `$match` coalesce INTO the `$lookup`** as a subpipeline with `unwinding`.
   Do **not** re-fetch.
2. Re-link it: in `05-sort-limit-skip.md` the footer currently reads
   `Next → **$unwind** *(not written yet)*` — turn it back into `[\`$unwind\`](./06-unwind.md)`.
3. Flip the 06 row in `phase-6-aggregation/README.md` to ✅ and its two "5 of 6" counts to 6.
4. `src/data/progress.js` mongodb phase 6 `pages: 5` → `pages: 6`.
5. `docs/mongodb/pages/README.md` phase-6 row → ✅ written; the caution banner → phase 7.
6. Then **phase 7 · Indexes and the query planner (6 topics)** — sources NOT yet fetched.

🔴 **Split proof for 04 (rule 1):** drafted as one file at **336 lines / 4 ★ / 13 gotchas**;
after the split **537 lines / 8 ★ / 20 gotchas** across two files. Both totals UP, nothing
trimmed. Commit `19a626a6`. Boundary: the stage vs its accumulators.

**Two MORE sources fetched 2026-09-01 — do not re-fetch:**
[Pipeline Optimization](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-optimization/)
— `$match` hoisted before `$project`/`$addFields`/`$set`/`$unset` (the `maxTime`/`avgTime` example
**splits one `$match` into three**), `$match` before `$sort` *"to minimize the number of documents to
sort"*, `$match`+`$match` → `$and`, `$limit`+`$limit` → the **smaller**, `$skip`+`$skip` → the
**sum**, `$sort`+`$limit` **coalesce into a top-k sort** (`{$sort: {sortKey: …, limit: Long(5)}}`),
`$sort`+`$skip`+`$limit` → limit raised **by** the skip, `$skip` hoisted above `$project`/`$unset`,
`$lookup`+`$unwind`+`$match` **coalesce into the `$lookup`** as a subpipeline with `unwinding`,
projection pruning is automatic (*"unlikely to improve performance"* to do it by hand), SBE `$group`
(5.2+, `stage: "GROUP"`) and `$lookup` (6.0+, `EQ_LOOKUP`), index-using stages, and
**`IXSCAN`/`DISTINCT_SCAN`** as the confirmation;
[`$set`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/set/) — **alias for
`$addFields`**, both *"equivalent to a `$project` stage that explicitly specifies all existing
fields"*; **overwrites including `_id`**; dot notation into embedded docs; `$concatArrays` to append;
[`$project`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/project/) — the four
specification forms; `_id` included by default; 🔴 **excluding a non-`_id` field bars every other
form** (`{rated: 0, title: 1}` is INVALID); **path collision** error for `contact: 1` +
`"contact.address.country": 1`; `$literal` for numeric/boolean literals; `[$year, $someField]`
substitutes **null**; `$$REMOVE` for conditional exclusion (and it is exempt from the mixing rule);
**empty spec is an error**; no array indices; `$unset` as the exclusion alternative;
[`$sort`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/sort/) — 1/-1/
`{$meta: "textScore"}`; **max 32 keys**; index use *"if it's used in the first stage of a pipeline or
if it's only preceded by a `$match` stage"*; 🔴 **not a stable sort** — add a unique field such as
`_id` for a consistent order.

### Phase 6 — the original scaffold note (sources fetched 2026-08-15)

🔴 **Start here on resume.** Nothing is written, the scaffold does not exist, but four Manual
pages were fetched at the end of the 2026-08-15 session. **Do not re-fetch these.**

The six topics (from `syllabus/02-querying.md`): 01 What a pipeline is · 02 `$match` first,
always · 03 `$project` vs `$addFields`/`$set` · 04 `$group` and the accumulators · 05 `$sort`,
`$limit`, `$skip` and the sort-before-group optimisation · 06 `$unwind`.
**Gate:** top 10 products by revenue for a date range, customer name joined, paginated, with a
total count, in one round trip.

- [Aggregation Pipeline](https://www.mongodb.com/docs/manual/core/aggregation-pipeline/) —
  *"one or more stages that process documents"*, each stage's output passed to the next; *"a
  stage does not need to output one document for every input document"*; the same stage may
  appear **multiple times except `$out`, `$merge` and `$geoNear`**. ⚠️ This page does **not**
  cover the memory limit or `$match`-early optimisation — that is the limits page below.
- [Aggregation Pipeline Limits](https://www.mongodb.com/docs/manual/core/aggregation-pipeline-limits/)
  — each **result document** is subject to the **16 MiB** BSON limit (documents may exceed it
  *during* processing); **100 MiB per stage** since 6.0, governed by `allowDiskUseByDefault` —
  when true, stages spill to temporary files and `{allowDiskUse: false}` disables it per query;
  when false, stages **error** and `{allowDiskUse: true}` enables spilling. Stages that can
  spill: `$bucket`, `$bucketAuto`, `$group`, `$setWindowFields`, **`$sort` when not supported by
  an index**, `$sortByCount`; `$search` is exempt as it runs in a separate process. *"If the
  results of one of your `$sort` pipeline stages exceed the limit, consider adding a `$limit`
  stage."* **Max 1000 stages per pipeline.**
- [`$group`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/group/) — `_id`
  is the group key and **`null`/a constant gives one document over everything**; accumulators
  `$sum`, `$avg` (both *ignore non-numeric values*), `$min`, `$max`, `$push`, `$addToSet`
  (unique), `$first`, `$last`, `$count`; **`$group` is a blocking stage**; over 100 MB it writes
  temporary files, and errors if `allowDiskUse` is false; 🔴 **if a pipeline sorts and groups by
  the same field, an index on that field lets `$group` find each group's first/last quickly**.
- [`$unwind`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/unwind/) — one
  output document per array element; **`preserveNullAndEmptyArrays` defaults to `false`**, and
  with the default a **missing, null or empty-array field produces NO output document** (the
  documented example drops 3 of 5 documents); with `true` the field is omitted (or stays null)
  and the document survives; `includeArrayIndex` adds the index as a `Long`, `null` for
  non-array input, and the name cannot start with `$`.

### Phase 5 — Query operators ✅ COMPLETE

01 Comparison ✅ · 02 Logical ✅ · 03 Element operators ✅ · 04 `$regex` ✅ · 05 `$expr` ✅ ·
06 Array matching ✅ (**the phase gate is worked on that page**)

**Sources fetched for Phase 5 — do not re-fetch:**
[`$regex`](https://www.mongodb.com/docs/manual/reference/operator/query/regex/) — options table;
case-sensitive patterns are matched against **index values**; anchored prefixes build a range and
**`/^a/` can stop scanning** while `/^a.*/` is *"slower"*; 🔴 **"case-insensitive indexes do not
improve performance for `$regex` queries, as the `$regex` operator is not collation-aware"**;
[`$expr`](https://www.mongodb.com/docs/manual/reference/operator/query/expr/) — aggregation
expressions in a predicate, field-to-field comparison, `$cond`; **index use only inside a
`$lookup` subpipeline**, only against constants, not for empty/missing `let` operands, and
**never multikey/partial/sparse**;
[`$elemMatch`](https://www.mongodb.com/docs/manual/reference/operator/query/elemMatch/) — *"at
least one element that matches all the specified query criteria"*, conditions otherwise *"can be
satisfied by different elements"*, the `results: [82,85,88]` example, **single-condition
`$elemMatch` restricts to arrays only** unlike a dot path, and `$where`/`$text` are barred inside
it;
[`$exists`](https://www.mongodb.com/docs/manual/reference/operator/query/exists/) — matches
**including null**; the performance table (**`$exists: false` cannot use a sparse index →
COLLSCAN**); and **`$ne: null` recommended** for "has a real value"; expressions do not support
`$exists` (use `$type` = `"missing"`).

### Phase 4 — CRUD and DML ✅ COMPLETE

01 insert ✅ · 02 find and the query document ✅ · 03 findOne ✅ · 04 Projection ✅ ·
05 update ✅ · 06 Field update operators ✅

**The phase gate is answered on the page** (topic 05): add-to-cart as `$inc` on a matched array
element, falling back to a `$ne`-filtered `$push` with `upsert` — atomic because a cart is one
document, and race-safe because the `$ne` filter stops a duplicate line if another request won.

**Sources fetched for Phase 4 — do not re-fetch:**
[`insertMany`](https://www.mongodb.com/docs/manual/reference/method/db.collection.insertMany/)
(**`ordered` defaults true** and stops at the first error with no rollback; `ordered: false`
continues and **may reorder**; returns `acknowledged` + `insertedIds` keyed by input position;
**no array-length limit**, batched at `maxWriteBatchSize` = **100,000**);
[Field update operators](https://www.mongodb.com/docs/manual/reference/operator/update-field/)
(`$set`, `$unset`, `$inc`, `$mul`, **`$min` only updates if the value is less**, **`$max` only
if greater**, `$rename`, **`$currentDate` sets a Date or a Timestamp**, `$setOnInsert` applies
only on an upsert insert);
[`findOne`](https://www.mongodb.com/docs/manual/reference/method/db.collection.findOne/)
(document or **null**, not a cursor; with 2+ matches returns the first in natural order or the
first from the index, and 🔴 **"if the query plan changes to use a different index, the method
may return a different document"** — sort if it matters);
[Query Documents](https://www.mongodb.com/docs/manual/tutorial/query-documents/) (filter shape;
empty document selects all);
[Project Fields](https://www.mongodb.com/docs/manual/tutorial/project-fields-from-query-results/)
(**cannot mix inclusion and exclusion**, except suppressing `_id`; dot notation for embedded
fields).

⚠️ The Query Documents page did **not** explicitly quote "multiple conditions imply AND", so the
page shows it via the documented `{field: value, …}` shape rather than claiming a quote.

### Phase 3 — Schema design ✅ COMPLETE

01 A query exercise ✅ · 02 Embed vs reference ✅ · 03 One-to-few ✅ ·
04 One-to-many ✅ · 05 One-to-squillions ✅ · 06 Extended reference ✅

Also fetched: [TTL Indexes](https://www.mongodb.com/docs/manual/core/index-ttl/) — the field
must be a date type or array of dates, **the background task runs every 60 seconds**, deletion
is **not** guaranteed immediately at expiry and may lag beyond that window, `expireAfterSeconds`
is 0–2147483647. Used in topic 05, which states TTL is a retention policy, not a deadline.

**Sources fetched for Phase 3 — do not re-fetch:**
[Data Modeling](https://www.mongodb.com/docs/manual/data-modeling/) — *"data that's accessed
together should be stored together … structure your data model based on your application's
data access patterns"*, and embedding *"allows you to avoid complex joins across multiple
collections"*;
[Embedding vs. References](https://www.mongodb.com/docs/manual/data-modeling/concepts/embedding-vs-references/)
— the two bullet lists (embed: simpler model, has-a/contains, queried together, updated
together, archived together · reference: high cardinality, duplication too complicated,
too much memory/bandwidth, **grows without bounds**, written at different times in a
write-heavy workload, child can exist alone), embedding *"allows atomic operations"*, and the
**staleness split** — sensitive data uses transactions or triggers, tolerant data uses a
background job, and if duplicated data updates often *"using a reference may be a better
approach"*.

**The framing chosen for the phase, so later topics stay consistent:** the Manual's two lists
are presented as an **ordered procedure where the first "yes" decides**, with **boundedness
first** because it is the only question with a hard failure (16 MiB) behind it. And the
repeated distinction worth keeping: **point-in-time data (the price paid) must be copied** —
referencing it is the bug, not the fix.

### Phase 2 — `mongosh`, mastered ✅ COMPLETE

| Topic | State |
|---|---|
| 01 Connecting | ✅ 172 lines |
| 02 Navigating | ✅ 166 lines |
| 03 Cursors | ✅ 181 lines |
| 04 `explain()` from the shell | ✅ 218 lines |
| 05 Shell safety on production | ✅ 199 lines |

**Sources fetched for Phase 2 — do not re-fetch:**
[Connection Strings](https://www.mongodb.com/docs/manual/reference/connection-string/) and
[Connection String Options](https://www.mongodb.com/docs/manual/reference/connection-string-options/)
(**SRV defaults `tls` to true**; `retryWrites` defaults true in official drivers; `authSource`
falls back to the path db then `admin`; `directConnection` false; `readPreference` primary);
[Databases and Collections](https://www.mongodb.com/docs/manual/core/databases-and-collections/)
(*"MongoDB creates the database when you first store data for it"* — and `createIndex()` also
creates a collection);
[Iterate a Cursor](https://www.mongodb.com/docs/manual/tutorial/iterate-a-cursor/)
(**20 documents per cursor iteration**, `displayBatchSize`, `let` suppresses auto-iteration,
`toArray()` loads everything into RAM);
[Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/) (the three
verbosities, `nReturned` / `totalKeysExamined` / `totalDocsExamined` / `executionTimeMillis`
with their documented caveats, the stage names, **explain ignores the plan cache**,
`planCacheShapeHash` replaces `queryHash` in 8.0);
[`updateMany`](https://www.mongodb.com/docs/manual/reference/method/db.collection.updateMany/)
(**a plain replacement document is not permitted**; empty filter updates all; upsert creates);
[`db.currentOp()`](https://www.mongodb.com/docs/manual/reference/method/db.currentOp/)
(fields; **6.2+ prefers the `$currentOp` stage**; **unsupported on Atlas M0/Flex**).

🔴 **Three things the docs would not settle, and the pages say so rather than guessing:** the
`it` cursor continuation (not in the mongosh help page consulted), a cursor first-batch size or
idle timeout, and the built-in **role privilege definitions** — `built-in-roles` renders behind
a deployment-type selector and the `.md` variant 404s, so topic 05 states the read-only
principle without quoting role definitions.

**Also fetched for Phase 1 (do not re-fetch):**
[Model Monetary Data](https://www.mongodb.com/docs/manual/tutorial/model-monetary-data/) —
binary floating point is *"unsuitable for monetary arithmetic"*, three models with
**Decimal128 preferred over the scale-factor method**;
[BSON Types](https://www.mongodb.com/docs/manual/reference/bson-types/) — the full
type/number/alias table, the **`"number"` alias** matching int/decimal/double/long, **Timestamp
is internal-only**, **Date is a signed 64-bit millisecond value**;
[Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/)
— created automatically, one entry per element with duplicates stored once, **at most one array
field per compound index and later inserts rejected**, covered-query exclusions (array in the
projection, `$elemMatch`), and the in-memory sort stage.

⚠️ **A claim I nearly shipped uncited:** topics 01 and 04 referenced the BSON Types page before
it had been fetched. Fetching it confirmed everything, but the habit is the risk — **fetch
first, then cite**. Same lesson as the Jest snapshot page in React Phase 14.

## 🔴 SCOPE CUT — 204 → 82 topics (2026-08-14)

I asked; the user answered *"go with option 1, critical only again damn it"* — with visible
frustration at being asked a third time. **Standing rule from now on: apply the
critical-path cut to a new language by default and say so, do not ask.**

**The cut:** Master tier only, **capped at 6 topics per phase**. The cap was necessary
because this syllabus's Master tier is inflated — **117 of 204 rows were already Master**
(57%), so a pure tier filter would have removed barely a third. Phase 4 (CRUD) had 14
Master of 16; Phase 9 (Mongoose) 12 of 18.

| | Before | After |
|---|---|---|
| Topics | 204 | **82** |
| Phases | 15 | 15 (all kept) |
| Per phase | up to 20 | **max 6** |

Per phase now: P0 5 · P1 6 · P2 5 · P3 6 · P4 6 · P5 6 · P6 6 · P7 6 · P8 6 · P9 6 ·
P10 6 · P11 4 · P12 3 · P13 5 · P14 6.

**Tiebreak within Master was source order** (these syllabi list the most important rows
first). That is the weakest part of the cut and the place to look if something critical is
missing — each phase carries a *"Cut from this phase: N topics"* line so the omission is
visible rather than silent.

**Wiring updated:** syllabus per-phase counts and all four part headers · `mongodb/README.md`
· `progress.js` (all 15 rows) · `docs/README.md` claims + coverage · **the homepage card was
activated** (`src/pages/index.js` — MongoDB was an inert placeholder with no `to`/`stats`).

## Load-bearing claims, verified against the Manual

- **The atomicity guarantee, quoted exactly:** *"In MongoDB, write operations are atomic
  on the single-document level, even if modifying multiple values."* And the limit:
  `updateMany` is atomic **per document**, not as a whole.
- **The Manual itself discourages transactions as a modelling crutch** — *"the
  availability of distributed transactions should not be a replacement for effective
  schema design"*. Worth quoting on the page rather than paraphrasing.
- **16 MiB** max BSON document size; GridFS for larger. The realistic way to hit it is an
  **unbounded `$push` array**, which eventually makes every write to that document fail.
- **Whole-subdocument equality is order- and completeness-sensitive** because BSON
  preserves field order — `find({addr: {city, pin}})` misses documents that dot-path
  queries match. One of the sharpest MongoDB surprises.
- **A JS number becomes a BSON `double`** — so money needs `Decimal128` (or integer minor
  units), and `$type: "int"` will not match values written from Node without `Int32`/`Long`.
- **ObjectId = 4-byte timestamp + 5 random + 3-byte counter**, so `getTimestamp()` is free
  and `_id` order is roughly insertion order — the same right-edge index property that
  makes UUIDv7 preferable to v4 in PostgreSQL.
- **WiredTiger**: document-level concurrency; cache defaults to `max(50% of (RAM − 1GB),
  256MB)`; **snappy** block compression by default (**zstd** for time-series); checkpoints
  every **60 seconds**.
- **Transactions require a replica set** — a standalone `mongod` cannot start one, which
  is why even local development should run a single-node replica set.

## Conventions in force

Same as the rest of the corpus: tier badge and `> Verified:` on every page, sources named,
gotchas as **symptom → cause → fix**, interview questions with answers and `★` on the
frequent ones, 300-line hard cap ([[devbible-never-compress-to-fit-cap]]),
[[devbible-no-new-sandbox-scripts]] — **no fabricated console output**.

Related: [[devbible-css-pages-progress]] · [[devbible-brief]] · [[devbible-progress]]
