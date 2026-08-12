---
title: "Sort and filter allowlists"
sidebar_label: "Overview"
sidebar_position: 0
---

# Sort and filter allowlists

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex5-filter-sort.mjs`.

**`?sort=price` is the request that reintroduces SQL injection to a codebase that
parameterizes everything else.** Values can be parameters; column names and
`ASC`/`DESC` cannot. The only safe construction is a map from request keys to SQL
text you wrote yourself.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[The two failure modes](01-two-failure-modes.md)** | `ORDER BY $1` binding as a constant and silently doing nothing; concatenating the identifier and executing a stacked `DROP TABLE`. Why the same payload is inert as a value and lethal as an identifier |
| 02 | **[Building the allowlist](02-building-the-allowlist.md)** | The key→SQL map, why direction is a ternary, prototype-key pitfalls, filter fields and operators, `quote_ident`/`format('%I')` as an escape hatch, and the trade-off |

## Phase gate

- Why does `ORDER BY $1` not raise an error, and what does it actually sort by?
- What makes a concatenated `?sort=` value able to execute a second statement?
- Why is an allowlist a *lookup*, not *validation*?
- What does `quote_ident` protect against, and what does it not?

## Where this connects

- **[Safe dynamic `WHERE`](../safe-dynamic-where/)** handles the other half of
  the same endpoint — filter *values*, which can be parameters.
- **[`list` with filtering, sorting and pagination](../02-list-endpoint.md)**
  assembles both, and explains the tiebreaker `orderClause` appends.
- **Node [Phase 6 · Parameterized queries](/docs/nodejs/pages/phase-6-data-access/parameterized-queries)**
  owns the general value-vs-identifier rule.

---

← [Safe dynamic `WHERE`](../safe-dynamic-where/) · Start → [The two failure modes](01-two-failure-modes.md)
