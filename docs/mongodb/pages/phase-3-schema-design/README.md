---
title: "Phase 3 — Schema design and modelling"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-15 against the **MongoDB Manual** (v8.0) — Data Modeling, and
> Embedding vs. References. Sources named per page. **Documentation-validated** under the
> no-new-sandboxes rule; **no console blocks**.

**✅ 6 of 6 topics written — COMPLETE.** The phase that decides whether an application is pleasant or
awful to work on — and the one where relational experience actively misleads.

> **Scope:** the syllabus was cut to the critical path on 2026-08-14 — **204 → 82 topics**,
> Master tier only, capped at 6 per phase. This phase went from 16 to 6.

| # | Page | Tier | State |
|---|---|---|---|
| 01 | [Schema design is a query exercise](./01-schema-design-is-a-query-exercise.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 02 | [Embed vs reference — the decision procedure](./02-embed-vs-reference.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 03 | [One-to-few](./03-one-to-few.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 04 | [One-to-many](./04-one-to-many.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 05 | [One-to-squillions](./05-one-to-squillions.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 06 | [The extended reference pattern](./06-extended-reference.md) | <span className="db-tier t-master">Master</span> | ✅ written |

## Coverage

| | |
|---|---|
| Topics written | **6 of 6 — COMPLETE** |
| Pages on disk | **6** |
| Evidence | MongoDB Manual, named per page; **no console blocks** |

## The sentence this phase turns on

> **A core principle of data modeling in MongoDB is that data that's accessed together should
> be stored together.**
>
> — MongoDB Manual, *Data Modeling*

Relational design starts from the entities and normalises until the data cannot contradict
itself. MongoDB design starts from **the queries the application will run** and stores each
answer close to itself. The two produce different schemas from the same domain, and applying
the first habit to MongoDB is the most common way to end up with a slow, awkward application.

## Phase gate

Given a product catalogue with variants, reviews and inventory, you can produce a schema,
justify every embed and every reference against the queries the application will run, and
name the write cost of every denormalisation you chose.

## Where this connects

- **← [Phase 0 · Atomicity](../phase-0-how-mongodb-runs/02-single-document-atomicity.md)** —
  the single-document guarantee is *why* embedding is the default.
- **← [Phase 1 · Arrays](../phase-1-documents-and-bson/06-arrays.md)** — the 16 MiB limit and
  multikey indexes are the constraints every decision here runs into.
- **→ Phase 6 · Aggregation** — `$lookup` is what a reference costs at read time.
- **→ Phase 10 · Transactions** — what to do when the schema genuinely cannot absorb an
  operation.

---

Start → [01 · Schema design is a query exercise](./01-schema-design-is-a-query-exercise.md)
