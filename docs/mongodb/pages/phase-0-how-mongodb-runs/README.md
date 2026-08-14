---
title: "Phase 0 — How MongoDB runs"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against the **MongoDB Manual** (v8.0) and the **BSON
> specification**. Sources named per page. **Documentation-validated** under the
> no-new-sandboxes rule — no console blocks unless a run produced them.

**✅ 5 of 5 topics written.** The architecture, and the sentence the rest of
the syllabus is downstream of: **the unit of atomicity is the single document.**

> **Scope:** the syllabus was cut to the critical path on 2026-08-14 — **204 → 82
> topics**, Master tier only, capped at 6 per phase. This phase went from 14 to 5.

| # | Page | Tier | State |
|---|---|---|---|
| 01 | [What MongoDB actually is](./01-what-mongodb-actually-is.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 02 | [The single-document atomicity guarantee](./02-single-document-atomicity.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 03 | [BSON](./03-bson.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 04 | [Document, collection, database](./04-document-collection-database.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 05 | [MongoDB vs PostgreSQL — the actual trade](./05-mongodb-vs-postgresql.md) | <span className="db-tier t-master">Master</span> | ✅ written |

## Coverage

| | |
|---|---|
| Topics written | **5 of 5 — COMPLETE** |
| Pages on disk | **5** |
| Evidence | MongoDB Manual and the BSON spec, named per page; **no console blocks** |

## The sentence everything follows from

> **Write operations are atomic on the single-document level, even if modifying
> multiple values.**

Atomicity is free *within* a document and costly *across* documents. Therefore
data that changes together should be stored together, therefore embedding is the
default, therefore every design question becomes **"can this be one document?"**

That chain is why MongoDB modelling inverts the relational habit: you model the
document your operation needs to be atomic over, rather than modelling entities
and gluing them with transactions.

## Phase gate

You can explain, without notes, why a MongoDB write to one document is atomic but
a write to two documents is not, and what that implies for how you would model an
order with line items.

## Where this connects

- **→ Phase 3 · Schema design** — the modelling patterns that follow from the
  atomicity boundary.
- **→ Phase 10 · Transactions** — what to do when the schema genuinely cannot
  absorb the operation.
- **→ [PostgreSQL](../../../postgresql/README.md)** — topic 11 compares the two
  directly rather than re-arguing either.

---

Start → [01 · What MongoDB actually is](./01-what-mongodb-actually-is.md)
