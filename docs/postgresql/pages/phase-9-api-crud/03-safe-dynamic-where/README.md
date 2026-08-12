---
title: "Safe dynamic WHERE"
sidebar_label: "Overview"
sidebar_position: 0
---

# Safe dynamic `WHERE`

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex5-filter-sort.mjs`.

**A list endpoint takes filters that may or may not be present. Build the predicate
strings and the parameter array in the same loop, so the `$n` numbering can never
drift out of step with the values.** The moment those two are built separately, you
have either a runtime error or an injection hole.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[Building predicates and parameters](01-predicates-and-params.md)** | The one-pass builder, why the placeholder number comes from `params.length`, omitting `WHERE` when there are no filters, why a bound value can never become syntax, and `= ANY($1)` for variable-length lists |
| 02 | **[Pattern matching and composition](02-patterns-and-composition.md)** | `ILIKE` and the wildcards hiding in user input, escaping `\`, `%` and `_`, and how the filter builder composes with sorting and pagination into the finished endpoint |

## Phase gate

- Why does the placeholder number have to come from the array rather than a counter?
- What makes a bound parameter incapable of becoming SQL?
- How do you parameterize `IN` with a list whose length varies per request?
- A user searches for `%` and gets every row — is that injection, and what is it?
- Why can sorting not use any of this machinery?

## Where this connects

- **[Sort and filter allowlists](../allowlists/)** handles the other half of the
  endpoint — identifiers, which can never be parameters.
- **[`list` with filtering, sorting and pagination](../02-list-endpoint.md)**
  assembles filters, sort and pagination into one query.
- **Node [Phase 6 · Parameterized queries](/docs/nodejs/pages/phase-6-data-access/parameterized-queries)**
  owns the general rule; this topic is the dynamic-query-building half.

---

← [`list` with filtering, sorting and pagination](../02-list-endpoint.md) · Start → [Building predicates and parameters](01-predicates-and-params.md)
