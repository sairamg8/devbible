---
title: "MongoDB — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

:::caution 🔒 CLAIMED — MongoDB is being actively written by another session

**Owner:** session `6ffd754d` · **Since:** 2026-08-14 · **Scope:** the whole of
`docs/mongodb/`.

**If you are a different session, do not write MongoDB pages.** Docker & Podman,
Redis and Nginx still have zero pages, and **React is parked at phases 0–4 with
161 topics free** — see the claims table in [`docs/README.md`](../README.md).

**Shared-checkout rules:** never `git add -A` — stage explicit paths only.
`src/data/progress.js` is edited by every session; change only your own
language's rows.

:::

> Verified: 2026-08-14 against the **MongoDB 8.0** manual, the current Major
> Release (two-year cadence, five-year lifecycle). MongoDB **8.2** is the current
> minor release supported on Atlas and on-premises, and **8.3** is available on
> Atlas clusters set to auto-upgrade. Where a topic is version-sensitive the row
> says so.
> ⚠️ **No MongoDB server is installed on this machine** and, under the
> no-new-sandboxes rule, none will be. Every page will be validated against the
> official manual and driver documentation, with the source named — there will be
> **no console blocks**.

The complete topic inventory for MongoDB, tiered for **mastery in fullstack
application development**. **15 phases, 82 topics**, split into 4 parts to stay
under the 300-line file cap.

The bar is **no knowledge gaps**: every MongoDB decision you would meet building a
real MERN application — whether to embed or reference, why a query is doing a
collection scan, what `upsert` does to a unique index under concurrency, why the
aggregation is slow after the third `$lookup`, whether you need a transaction, and
what happens to in-flight writes when a primary steps down — has a row here.

Architectural role: **a document store whose unit of atomicity is the single
document.** MongoDB is not "a database without schemas" and not "JSON on disk"; it
is a system that trades joins for locality, and gives you exactly one free
guarantee — that a write to one document either fully happens or does not. Almost
everything in this syllabus is downstream of that sentence: it is why embedding is
the default, why schema design is a *query* exercise rather than a normalisation
exercise, why transactions exist but are a last resort, and why the `_id` index is
the only one you never have to think about.

## Why MongoDB is in scope

MongoDB is technology **6** in `instructions.md` and the **M in MERN** — the last
major gap in the stack this bible covers. PostgreSQL is complete at 298 pages, so
the two halves of the "which database" question can finally be answered against
each other rather than in the abstract. A recurring column in these phases is
**"and how this differs from PostgreSQL"**, linking to the finished PG pages
instead of re-explaining relational behaviour.

## Scope — what this syllabus owns

**In scope:** the document model and BSON; `mongosh`; schema design and the
modelling patterns; CRUD and the full query operator surface; the aggregation
pipeline; indexes and `explain`; the **Node.js driver**; **Mongoose**;
transactions and sessions; replica sets, sharding, read and write concerns;
performance, monitoring and operations; security; Atlas; and an applied phase
building the storefront's data layer.

**Out of scope:** MongoDB as an analytics warehouse, Realm/Device Sync, Atlas
Search beyond a working introduction, and the C++ internals below the storage
engine's observable behaviour.

## The four parts

| Part | Phases | Topics | What it establishes |
|---|---|---|---|
| **[1 — The document model](./syllabus/01-the-document-model.md)** | 0–3 | 22 | What a document is, how the server stores it, and how to design collections around queries |
| **[2 — Querying](./syllabus/02-querying.md)** | 4–7 | 24 | CRUD, the operator surface, aggregation, and making the planner do what you meant |
| **[3 — MongoDB from Node](./syllabus/03-from-node.md)** | 8–10 | 18 | The driver, Mongoose, and where transactions are actually warranted |
| **[4 — Production](./syllabus/04-production.md)** | 11–14 | 18 | Replication, sharding, operations, security, and the applied data layer |

## Priority tiers

The same four tiers used across this bible, assigned **for fullstack application
development**:

| Badge | Bar to clear |
|---|---|
| <span className="db-tier t-master">Master</span> | Use it confidently **without opening documentation** |
| <span className="db-tier t-understand">Understand</span> | Know **how it works**; looking up exact signatures is fine |
| <span className="db-tier t-know">Know</span> | Know **what it is, why it exists, when it's the right tool** |
| <span className="db-tier t-when">When Needed</span> | **Don't study upfront** — learn it the day a project demands it |

Sharding is a worked example of tier assignment: it is
<span className="db-tier t-know">Know</span> here, because a MERN application
reaches for a replica set long before it needs a shard key, and choosing a shard
key badly is a decision you cannot take back. The *consequences* of that
irreversibility are worth knowing early; the operational mechanics are not.

## Working agreement

**Syllabus first, approved, then pages — one phase at a time.** No mass
scaffolding ahead of being asked.

Every page carries a `> Verified:` line naming its sources, gotchas written
**symptom → cause → fix**, and interview questions with answers. The 300-line cap
is a *file* rule: a topic that needs 600 lines becomes a topic directory with
chunks, never one file with the depth cut.

## Progress

import Progress from '@site/src/components/Progress';

<Progress lang="mongodb" />
