---
title: "MongoDB — Explanations"
sidebar_label: "Overview"
sidebar_position: 0
---

:::tip Consolidated 2026-08-15 — all work is on `main`
Every worktree and branch in this repo was **merged into `main` and deleted** on
2026-08-15. Any "worktree `devbible-…`", "branch `…`" or "not merged" note below is
**historical** — nothing is stranded, and all of it is on `main`. Work in
`/run/media/sairam/Storage/Backup/Knowledge/devbible` on `main`, and keep staging
explicit paths (never `git add -A`) since everyone shares the checkout again.
:::

:::caution 🚧 Phase 6 in progress — session `fa340bd8`, 2026-09-01

**State: phases 0–5 COMPLETE, phase 6 at 5 of 6 — 39 of 82 topics.**
All of it is on `main`; the worktree named in older notes is long deleted.

Next file: **`phase-6-aggregation/06-unwind.md`** — the only topic left in phase 6.
Its Manual source is already fetched and recorded in the store, so it needs no
re-fetch. Then phase 7 · Indexes and the query planner.

:::

> Verified: 2026-08-14 against the **MongoDB Manual (v8.0)** and the **BSON
> specification**, with sources named per page. **Documentation-validated** under
> the no-new-sandboxes rule.
> ⚠️ **No MongoDB server is installed on this machine**, so these pages carry
> **no console blocks** — every claim is cited to the manual rather than measured.

The explanation pages behind the [MongoDB syllabus](../README.md) — one page per
topic, each with a tier badge, a `> Verified:` line naming its sources, gotchas
written **symptom → cause → fix**, and interview questions with answers.

## Progress

import Progress from '@site/src/components/Progress';

<Progress lang="mongodb" />

## Phases

| Phase | Topics | State |
|---|---|---|
| [0 · How MongoDB runs](./phase-0-how-mongodb-runs/README.md) | 5 | ✅ written |
| [1 · Documents, BSON types and `_id`](./phase-1-documents-and-bson/README.md) | 6 | ✅ written |
| [2 · `mongosh`, mastered](./phase-2-mongosh/README.md) | 5 | ✅ written |
| [3 · Schema design and modelling](./phase-3-schema-design/README.md) | 6 | ✅ written |
| [4 · CRUD and DML](./phase-4-crud/README.md) | 6 | ✅ written |
| [5 · Query operators and projection](./phase-5-query-operators/README.md) | 6 | ✅ written |
| [6 · The aggregation pipeline](./phase-6-aggregation/README.md) | 6 | 🚧 **5 of 6 written** — `$unwind` owed |
| 7 · Indexes and the query planner | 6 | ⬜ planned |
| 8 · The Node.js driver, end to end | 6 | ⬜ planned |
| 9 · Mongoose | 6 | ⬜ planned |
| 10 · Transactions, sessions and consistency | 6 | ⬜ planned |
| 11 · Replication, sharding and the cluster | 4 | ⬜ planned |
| 12 · Performance, monitoring and operations | 3 | ⬜ planned |
| 13 · Security and deployment | 5 | ⬜ planned |
| 14 · The storefront data layer | 6 | ⬜ planned |

**5 of 82 topics written.** Only written phases are linked — a link to a page that
does not exist yet would ship as a 404.

## What each phase covers

| Phase | Covers |
|---|---|
| **0 — How MongoDB runs** | The architecture, and the sentence the rest is downstream of: the unit of atomicity is the single document |
| **1 — Documents, BSON types and `_id`** | The type system. Most "why didn't my query match?" bugs are type bugs |
| **2 — `mongosh`, mastered** | The shell is the debugging tool; fluency in it is the difference between guessing and knowing |
| **3 — Schema design and modelling** | Embed or reference, and the patterns that follow. Decides whether the application is pleasant or awful |
| **4 — CRUD and DML** | The write surface — small, and full of operations that look safer than they are |
| **5 — Query operators and projection** | The operator surface, and the array-matching semantics that produce surprises |
| **6 — The aggregation pipeline** | MongoDB's real query language — everything the find API cannot do |
| **7 — Indexes and the query planner** | 🔴 The highest-value phase here. `explain`, compound-index order, and why a query scans |
| **8 — The Node.js driver, end to end** | Not a thin wrapper: connection pooling, retries, and what the driver does on your behalf |
| **9 — Mongoose** | The ODM most MERN applications use, and where its abstractions leak |
| **10 — Transactions, sessions and consistency** | The guarantees you can ask for, what each costs, and why they are a last resort |
| **11 — Replication, sharding and the cluster** | What "the database" is once it is more than one process |
| **12 — Performance, monitoring and operations** | The slow query log and the profiler — finding the problem before users do |
| **13 — Security and deployment** | The configuration failures that make the news |
| **14 — The storefront data layer** | Applied. One coherent build rather than isolated examples |

## The sentence everything follows from

> **Write operations are atomic on the single-document level, even if modifying
> multiple values.**

Atomicity is free *within* a document and costly *across* documents — therefore
data that changes together should be stored together, therefore embedding is the
default, therefore every design question becomes **"can this be one document?"**
Phase 0 establishes it; phases 3, 9 and 10 are its consequences.

## Where this connects

- **→ [PostgreSQL](../../postgresql/README.md)** — complete at 298 pages. Phase 0
  topic 05 compares the two directly rather than re-arguing either.
- **→ [Node.js](../../nodejs/pages/README.md)** and
  **[Express](../../expressjs/pages/README.md)** — both complete, and both defer
  the persistence layer to this track.

The topic inventory these follow starts at
[Part 1 — The document model](../syllabus/01-the-document-model.md).
