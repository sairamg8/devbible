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

- **[Safe dynamic `WHERE`](../03-safe-dynamic-where/README.md)** handles the other half of
  the same endpoint — filter *values*, which can be parameters.
- **[`list` with filtering, sorting and pagination](../02-list-endpoint.md)**
  assembles both, and explains the tiebreaker `orderClause` appends.
- **Node [Phase 6 · Parameterized queries](/docs/nodejs/pages/phase-6-data-access/parameterized-queries)**
  owns the general value-vs-identifier rule.

{/* LINKMAP:START */}

## Further reading

*Best explanations found elsewhere on the web — added alongside this page, nothing here replaces it.*

- **Read this:** [OWASP SQL Injection Prevention → Defense Option 3: Allow-list Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html#defense-option-3-allow-list-input-validation) — owasp.org: for table names, column names and sort indicators that cannot be bind variables, map the input to known values (*read*; anchor id found in the page HTML)

{/* LINKMAP:END */}

---

← [Safe dynamic `WHERE`](../03-safe-dynamic-where/README.md) · Start → [The two failure modes](01-two-failure-modes.md)
