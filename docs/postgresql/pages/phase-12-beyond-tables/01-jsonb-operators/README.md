---
title: "jsonb operators"
sidebar_label: "Overview"
sidebar_position: 0
---

# jsonb operators

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex44-jsonb-ops.mjs`.

**There are two families of jsonb operator and they are not interchangeable: the
accessors that dig a value out, and the predicates that ask a question about the
document.** Which family you use decides whether an index can help you at all —
so this is a performance decision disguised as a syntax choice.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[Accessors and paths](01-accessors-and-paths.md)** | `->` vs `->>`, `#>` and `#>>`, array indexing, and the trap that a missing key and a JSON `null` both return SQL `NULL` |
| 02 | **[Containment and jsonpath](02-containment-and-jsonpath.md)** | `@>`, `<@`, `?`, `?\|`, `?&`, the `@?`/`@@` jsonpath predicates, the mutation operators `\|\|`, `-` and `#-`, and which of them an index can serve |

## Phase gate

- What is the difference between `->` and `->>`, and when does it matter?
- How do you tell a missing key from a key whose value is JSON `null`?
- Which operator should a filter use if you want a GIN index to serve it?
- What does `?` do that `@>` does not?

## Where this connects

- **[Indexing jsonb](../03-index-jsonb.md)** measures what each index kind can
  actually serve — the payoff for the distinction drawn here.
- **[When a column beats JSON](../02-column-vs-json.md)** is the decision this
  syntax exists to serve.
- **[Phase 2 · jsonb](../../phase-2-types/08-jsonb.md)** owns `json` versus
  `jsonb` as types — storage, key ordering and deduplication.
- **[Building JSON in SQL](../04-build-json-sql.md)** is the other direction:
  producing documents rather than reading them.

---

← [Phase index](../README.md) · Start → [Accessors and paths](01-accessors-and-paths.md)
