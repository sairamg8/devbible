---
title: "Phase 1 — Documents, BSON types and _id"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against the **MongoDB Manual** (v8.0) and the **BSON
> specification**. Sources named per page. **Documentation-validated** under the
> no-new-sandboxes rule — no console blocks unless a run produced them.

**✅ 6 of 6 topics written — COMPLETE.** The type system. **Most "why didn't my query match?"
bugs are type bugs**, and they are invisible until you go looking for them.

> **Scope:** the syllabus was cut to the critical path on 2026-08-14 — **204 → 82
> topics**, Master tier only, capped at 6 per phase. This phase went from 13 to 6.

| # | Page | Tier | State |
|---|---|---|---|
| 01 | [The BSON types, completely](./01-the-bson-types.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 02 | [`_id`](./02-the-id-field.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 03 | [`ObjectId`](./03-objectid.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 04 | [Numbers — int32, int64, double, Decimal128](./04-numbers.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 05 | [Dates vs Timestamps](./05-dates-vs-timestamps.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 06 | [Arrays as a first-class type](./06-arrays.md) | <span className="db-tier t-master">Master</span> | ✅ written |

## Coverage

| | |
|---|---|
| Topics written | **6 of 6 — COMPLETE** |
| Pages on disk | **6** |
| Evidence | MongoDB Manual and the BSON spec, named per page; **no console blocks** |

## Why a whole phase on types

A relational database rejects a wrong type at the door. MongoDB stores it, and
the mismatch surfaces later as a query that silently returns fewer rows than it
should — no error, no warning, just an answer that is quietly incomplete.

Three facts from this phase account for most of those:

- **A JavaScript number is a BSON `double`.** Not an int, and not a decimal.
- **Comparison is type-bracketed.** `{price: {$gt: 100}}` never matches the string
  `"150"`, because strings and numbers occupy different positions in the BSON
  comparison order.
- **A missing field and a `null` field are the same thing to a sort, and are not the
  same thing to `$exists`.**

## Phase gate

You can predict which documents `{price: {$gt: 100}}` matches in a collection where
some prices are strings, some are `Decimal128`, some are missing and some are
`null` — and say what you would do about it.

## Where this connects

- **← [Phase 0 · How MongoDB runs](../phase-0-how-mongodb-runs/README.md)** — BSON
  is introduced there; this phase is the type system in detail.
- **→ Phase 5 · Query operators** — `$type`, `$exists` and the comparison rules are
  what those operators are built on.
- **→ Phase 8 · Indexes** — a multikey index is the direct consequence of arrays
  being a first-class type (topic 06).
- **→ [PostgreSQL · types](../../../postgresql/pages/phase-2-types/README.md)** —
  the same decisions with a schema enforcing them.

---

Start → [01 · The BSON types, completely](./01-the-bson-types.md)
