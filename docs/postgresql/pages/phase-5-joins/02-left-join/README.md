---
title: "LEFT JOIN"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex35-joins.mjs`.

**A LEFT JOIN keeps every left row, filling the right side with NULL when nothing matches.
Put a condition on the right table in `WHERE` instead of `ON` and you have thrown that
guarantee away — the query is an INNER JOIN again, and nothing tells you.**

Two chunks. The first is about the NULLs the join manufactures and what they do to
everything downstream; the second is the `ON`-versus-`WHERE` rule, which is the single
most common SQL bug in application code.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[The guarantee and its NULLs](01-null-extension.md)** | NULL extension, the count trap, how manufactured NULLs reach JS, and the anti-join idiom |
| 02 | **[ON vs WHERE](02-on-vs-where.md)** | the bug measured, why clause order causes it, the classification rule, and the outer-join-cancelling patterns |

## Phase gate

You are done with this topic when you can classify any predicate in an outer join as
belonging in `ON` or `WHERE` without thinking, and when you can explain why
`count(*)` and `count(o.id)` disagree by exactly the number of unmatched left rows.

## Where this connects

- **[INNER JOIN](../01-inner-join/README.md)** — the pair semantics this builds on; fan-out applies
  here unchanged
- **[Semi and anti joins](../03-semi-anti/README.md)** — `NOT EXISTS` states the anti-join intent
  directly and cannot be broken by a nullable test column
- **[RIGHT and FULL OUTER](../06-outer-joins.md)** — the same rules with the sides swapped
- **[NULL semantics](../../phase-2-types/06-null.md)** — the three-valued logic every trap
  here reduces to

---

← [Phase index](../README.md) · Start → [The guarantee and its NULLs](01-null-extension.md)
