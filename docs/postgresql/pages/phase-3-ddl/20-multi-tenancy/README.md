---
title: "Multi-tenancy as a decision"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13. The `search_path` mechanism is **sandbox-measured** in
> [10 · Schemas and tenancy](../10-schemas-tenancy.md)
> (`sandbox/pg-api/ex12-ddl-rest.mjs`); the pooled-connection `SET` leak is
> **sandbox-measured** in `sandbox/pg-api/ex54-pgbouncer.mjs` §3. Everything else
> is validated against the **PostgreSQL 18** documentation, cited inline.
> **No console output in this topic** — the measured output lives on the pages
> cited above.

**[10 · Schemas and tenancy](../10-schemas-tenancy.md) shows how the mechanism
works. This topic is which one to choose, and what it costs you two years in.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Choosing a model](01-choosing-a-model.md)** | why shared schema is the default, and the `SET LOCAL` rule that makes it safe |
| 02 | **[The models compared](02-models-compared.md)** | when schema- or database-per-tenant is genuinely right, and the order to decide in |
| 03 | **[Operating it](03-operating-it.md)** | onboarding, deleting a tenant properly, noisy neighbours, cross-tenant queries, and the isolation test everyone forgets |

## The decision in one table

| | **Shared schema** | **Schema per tenant** | **Database per tenant** |
|---|---|---|---|
| Migrations | **once** | N times | N times |
| Cross-tenant queries | trivial | `UNION` over N | very hard |
| Tenant deletion | `DELETE` per table | `DROP SCHEMA` | `DROP DATABASE` |
| Onboarding | an `INSERT` | seconds–minutes | provisioning |
| Isolation | RLS (strong, layered) | structural | strongest |
| Scales to | millions | hundreds–thousands | tens |

**Default to shared schema with RLS.** Choose separation when isolation is a
contractual or regulatory requirement — not for reassurance, because
schema-per-tenant chosen "for safety" buys a permanent migration tax in exchange
for a property `FORCE ROW LEVEL SECURITY` already provides.

## The two rules that prevent the incident

1. **`tenant_id` leads every index.** Every query is tenant-scoped in practice —
   explicitly in your code and implicitly through the RLS predicate — so an index
   that does not lead with it cannot serve the filter on every query.
2. **`SET LOCAL`, never `SET`.** Measured: a plain `SET` persists on a pooled
   connection into the next request, so the next tenant inherits the previous
   tenant's identity. With RLS keyed on that setting, this is a cross-tenant data
   exposure that appears only under concurrency.

## Phase gate

You are done here when you can justify your tenancy model against tenant count,
isolation requirements and cross-tenant reporting needs — and when your isolation
tests run as the application role and include two sequential requests for
different tenants on one pooled connection.

## Where this connects

- [10 · Schemas and tenancy](../10-schemas-tenancy.md) — the measured mechanism
  this topic decides between.
- [Row-level security](../../phase-13-ops/14-rls/README.md) — how shared schema
  buys back the isolation it lacks structurally.
- [Connection limits and PgBouncer](../../phase-13-ops/07-pgbouncer/02-pool-modes.md)
  — where the `SET` leak was measured, and why session state is unsafe on a pool.
- [Indexes](../../phase-10-indexes/README.md) — why `tenant_id` leads.
- [Zero-downtime DDL](../../phase-13-ops/12-zero-downtime-ddl/README.md) —
  migrations, which schema-per-tenant multiplies by N.
- [Physical backup and PITR](../../phase-13-ops/15-physical-backup/README.md) — why
  deleted tenant data still exists for the retention window.

---

← [Phase index](../README.md) · Start → [Choosing a model](01-choosing-a-model.md)
