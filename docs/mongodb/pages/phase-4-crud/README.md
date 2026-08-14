---
title: "Phase 4 — CRUD and DML"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-15 against the **MongoDB Manual** (v8.0). Sources named per page.
> **Documentation-validated** under the no-new-sandboxes rule; **no console blocks**.

**✅ 6 of 6 topics written — COMPLETE.** The write surface. Small, and full of operations that look
interchangeable and are not.

> **Scope:** the syllabus was cut to the critical path on 2026-08-14 — **204 → 82 topics**,
> Master tier only, capped at 6 per phase. This phase went from 16 to 6.

| # | Page | Tier | State |
|---|---|---|---|
| 01 | [`insertOne` / `insertMany`](./01-insert.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 02 | [`find` and the query document](./02-find-and-the-query-document.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 03 | [`findOne`](./03-findone.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 04 | [Projection](./04-projection.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 05 | [`updateOne` / `updateMany`](./05-update.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 06 | [Field update operators](./06-field-update-operators.md) | <span className="db-tier t-master">Master</span> | ✅ written |

## Coverage

| | |
|---|---|
| Topics written | **6 of 6 — COMPLETE** |
| Pages on disk | **6** |
| Evidence | MongoDB Manual, named per page; **no console blocks** |

## What makes this phase worth reading carefully

There are only a handful of write methods, and the differences between them are the kind that
do not show up in development:

- **`ordered: true` versus `false`** decides whether a failing insert stops the batch or lets
  the rest through.
- **An update without an operator is a replacement**, which silently drops every field you did
  not mention.
- **`updateOne` with `upsert`** is how you write an idempotent operation with no transaction —
  the phase gate below.

## Phase gate

You can write an idempotent *"add this item to the cart, or increment its quantity if it is
already there"* operation as a **single atomic statement**, and explain why it needs no
transaction.

## Where this connects

- **← [Phase 0 · Atomicity](../phase-0-how-mongodb-runs/02-single-document-atomicity.md)** —
  why a single-document write needs no transaction.
- **← [Phase 1 · Types](../phase-1-documents-and-bson/01-the-bson-types.md)** — a filter that
  matches nothing is usually a type mismatch, not a missing document.
- **→ Phase 5 · Query operators** — this phase covers the shape of a filter; that one covers
  the operators inside it.
- **→ [Phase 2 · Shell safety](../phase-2-mongosh/05-shell-safety.md)** — the same write
  methods, with the production habits around them.

---

Start → [01 · `insertOne` / `insertMany`](./01-insert.md)
