---
title: "Phase 5 — Query operators and projection"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-15 against the **MongoDB Manual** (v8.0). Sources named per page.
> **Documentation-validated** under the no-new-sandboxes rule; **no console blocks**.

**✅ 6 of 6 topics written — COMPLETE.** The operator surface — and the array-matching semantics that
produce the most confident wrong answers in MongoDB.

> **Scope:** the syllabus was cut to the critical path on 2026-08-14 — **204 → 82 topics**,
> Master tier only, capped at 6 per phase. This phase went from 14 to 6.

| # | Page | Tier | State |
|---|---|---|---|
| 01 | [Comparison operators](./01-comparison-operators.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 02 | [Logical operators](./02-logical-operators.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 03 | [Element operators — `$exists` and `$type`](./03-element-operators.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 04 | [`$regex`](./04-regex.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 05 | [`$expr`](./05-expr.md) | <span className="db-tier t-master">Master</span> | ✅ written |
| 06 | [Array matching — exact vs containment](./06-array-matching.md) | <span className="db-tier t-master">Master</span> | ✅ written |

## Coverage

| | |
|---|---|
| Topics written | **6 of 6 — COMPLETE** |
| Pages on disk | **6** |
| Evidence | MongoDB Manual, named per page; **no console blocks** |

## The theme

Every topic here is a variation on one thing: **a query that returns the wrong documents
without reporting any error.** A range that skips string values, an `$or` that cannot use an
index, an `$exists` that also matches nulls, a regex that scans, an array condition satisfied by
two different elements. None of them fail loudly, so none of them are caught by testing that
only checks the happy path.

## Phase gate

Given an `orders` collection with an array of line items, you can write the query for *"orders
containing a line item that is both product X **and** quantity > 2"* — and explain why the
obvious version returns the wrong orders.

## Where this connects

- **← [Phase 1 · Types](../phase-1-documents-and-bson/01-the-bson-types.md)** — type-bracketed
  comparison is the reason half of this phase exists.
- **← [Phase 4 · find](../phase-4-crud/02-find-and-the-query-document.md)** — the shape of a
  filter; this phase is the operators inside it.
- **→ Phase 6 · Aggregation** — `$expr` is the bridge between the two languages.
- **→ Phase 7 · Indexes** — which of these operators can use an index is the practical
  difference between a fast query and a scan.

---

Start → [01 · Comparison operators](./01-comparison-operators.md)
