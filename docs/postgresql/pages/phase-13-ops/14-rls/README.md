---
title: "Row-level security"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation**
> ([row security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html),
> [`CREATE POLICY`](https://www.postgresql.org/docs/18/sql-createpolicy.html)),
> cited inline. The `SET` vs `SET LOCAL` leak is **sandbox-measured**
> (`sandbox/pg-api/ex54-pgbouncer.mjs` §3). **No timing claim in this topic is
> presented as measured.**

**Authorization that cannot be forgotten.** RLS moves "which rows may this user
see" out of application code and into the database, where a missing `WHERE`
clause stops being a data breach.

It is **Know** tier for a general PERN developer and effectively **Master** tier
if you build on Supabase, where it is the entire authorization model.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Policies](01-policies.md)** | default-deny, `USING` vs `WITH CHECK`, permissive vs restrictive, and who silently bypasses the whole thing |
| 02 | **[Carrying the identity](02-carrying-the-identity.md)** | `set_config`, and why `SET LOCAL` is a security requirement rather than a style choice |
| 03 | **[Performance and practice](03-performance-and-practice.md)** | indexing policy columns, function volatility, testing that actually proves something, and `BYPASSRLS` for jobs |

## The four facts that cause every RLS bug

1. **Enabling RLS with no policy makes the table look empty** — default-deny, not
   an error.
2. **Table owners bypass RLS by default.** An app connecting as the schema owner
   is unprotected, and its tests pass anyway. Fix with a non-owner role plus
   `FORCE ROW LEVEL SECURITY`.
3. **`UPDATE` needs `WITH CHECK` as well as `USING`** — otherwise a user can
   modify a row they own into one they should not.
4. **`SET LOCAL`, never `SET`.** A plain `SET` persists on a pooled connection
   into the next request — measured — which here is a cross-tenant exposure.

## Phase gate

You are done here when you can write a tenant-isolation policy, explain why it
does nothing if the app connects as the table owner, and test it as the real
application role with the negative cases asserted.

## Where this connects

- [App role should not own schema](../03-app-role-not-owner.md) — the
  prerequisite that makes RLS actually apply.
- [Roles, GRANT and REVOKE](../01-roles-grant/README.md) — RLS filters rows;
  `GRANT` controls tables and columns. Different layers, both needed.
- [Connection limits and PgBouncer](../07-pgbouncer/02-pool-modes.md) — where the
  `SET` vs `SET LOCAL` behaviour was measured.
- [Managed PostgreSQL](../13-managed-postgres/README.md) — why this topic is
  central on Supabase.
- [Phase 3 · Multi-tenancy](../../phase-3-ddl/20-multi-tenancy/README.md) — the
  wider decision RLS is one component of.
- [Phase 10 · Indexes](../../phase-10-indexes/README.md) — policy columns are
  query predicates and want indexes accordingly.

---

← [Phase index](../README.md) · Start → [Policies](01-policies.md)
