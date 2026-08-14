---
title: "20.2 · When separation is right, and how to decide"
sidebar_label: "02 · The models compared"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13. The `search_path` mechanism is **sandbox-measured** in
> [10 · Schemas and tenancy](../10-schemas-tenancy.md)
> (`sandbox/pg-api/ex12-ddl-rest.mjs`). Everything else is validated against the
> **PostgreSQL 18** documentation. **No console output on this page.**

**[Chunk 01](01-choosing-a-model.md) argues for shared schema as the default.**
This chunk is the other side: when separation is genuinely required, what it
costs, and the order in which to make the decision.

## When schema-per-tenant is right

Choose it when **isolation is a product requirement rather than an engineering
preference**:

- Enterprise customers contractually requiring their data be separated.
- Regulatory regimes where per-tenant data residency or deletion must be
  demonstrable.
- Per-tenant schema variation — genuinely different columns per customer, which
  a shared table cannot express without sprawl.
- Per-tenant restore as a routine operation, not an emergency.

What you accept in exchange, and it is more than it first appears:

**Migrations run N times.** With 500 tenants, every schema change is 500
executions, each of which can fail independently, leaving you partially migrated
across tenants. You need migration tooling that iterates, records per-tenant
state, and resumes — that is real infrastructure, and it is the cost people
underestimate.

**Cross-tenant queries become `UNION` over N schemas**, which is unpleasant at 10
tenants and impractical at 500. "How many documents were created across all
customers this month" stops being a one-line query.

**The catalog grows.** N schemas × M tables means a large `pg_class`, which slows
catalog operations and affects tools that enumerate objects — `pg_dump` among
them.

**`search_path` becomes safety-critical**, with the same pooled-connection
hazard as `app.tenant_id` and the same `SET LOCAL` requirement. The measured
`search_path` behaviour is in [10 · Schemas and tenancy](../10-schemas-tenancy.md).

## When database-per-tenant is right

Rarely, and deliberately: a small number of large tenants, strict isolation,
per-tenant restore and per-tenant resource limits. Think enterprise deployments
of tens of customers, not a self-serve product.

The costs escalate rather than merely repeat: **connection pooling multiplies**
(each database needs its own pool, so the arithmetic from
[PgBouncer](../../phase-13-ops/07-pgbouncer/01-why-connections-cost.md) applies
per tenant), cross-tenant anything requires application-level aggregation or
foreign data wrappers, and tenant onboarding becomes provisioning rather than an
`INSERT`.

## How to actually decide

In order:

1. **Do you have a contractual or regulatory isolation requirement?**
   Yes → schema or database per tenant. This dominates everything else.
2. **How many tenants, at the size you are planning for?**
   Thousands+ → shared schema; it is the only one that scales there.
   Tens → any model works; pick for the other reasons.
3. **How often do you need cross-tenant queries?**
   Often → shared schema. This is underweighted and becomes painful late.
4. **Do tenants need different schemas?**
   Genuinely yes → schema per tenant. "Might one day" → no.
5. **Otherwise → shared schema with RLS.**

**Do not choose for hypothetical isolation.** Schema-per-tenant chosen "for
safety" without a requirement demanding it buys a migration burden you pay on
every deploy forever, in exchange for a property that RLS provides at a fraction
of the cost.

## The migration between models

Worth knowing the asymmetry before choosing: **shared → separated is
straightforward**; you filter by `tenant_id` and copy each tenant out.
**Separated → shared is hard**, because identity values collide across schemas
and must be remapped everywhere they are referenced.

So the reversible choice is shared schema, and that is another argument for
starting there when the decision is genuinely uncertain.

## Trade-off

The three models trade **isolation against operational leverage**, and the
trade is close to linear: every increment of isolation costs you migration
simplicity, cross-tenant queryability and connection efficiency.

Shared schema takes the cheapest operations and the weakest structural isolation,
then buys most of the isolation back with RLS — which is why it is the default:
the layered defence is nearly as strong in practice, and vastly cheaper to run.

The trade people get wrong is paying for isolation twice. Choosing
schema-per-tenant *and* maintaining tenant filtering in application code gives
you both costs; choosing it because shared schema "feels risky", without a
requirement, spends a permanent migration tax on a risk that
`FORCE ROW LEVEL SECURITY` and a repository layer already address.

## Gotchas

**Symptom:** A query returns another tenant's rows
**Cause:** A missing `WHERE tenant_id`, and no RLS underneath.
**Fix:** RLS as a `RESTRICTIVE` policy plus `FORCE ROW LEVEL SECURITY`, and a
repository layer that cannot express an unscoped query.

**Symptom:** Cross-tenant leakage that appears only under load
**Cause:** Plain `SET` instead of `SET LOCAL` — the setting persists on the
pooled connection into the next request. Measured.
**Fix:** `set_config('app.tenant_id', $1, true)` inside a transaction, always.

**Symptom:** RLS policies exist and do nothing
**Cause:** The application connects as the table owner, which bypasses RLS by
default.
**Fix:** A non-owner application role plus `FORCE ROW LEVEL SECURITY`.

**Symptom:** Queries are slow despite indexes
**Cause:** Indexes do not lead with `tenant_id`, so the tenant predicate — added
to every query, and by RLS to every query you did not write — cannot use them.
**Fix:** `(tenant_id, …)` on every index that matters.

**Symptom:** Tenant B cannot use a name tenant A took
**Cause:** A global unique constraint where per-tenant uniqueness was intended.
**Fix:** `UNIQUE (tenant_id, slug)`.

**Symptom:** A schema-per-tenant migration left tenants inconsistent
**Cause:** N executions, each able to fail independently.
**Fix:** Migration tooling that records per-tenant state and resumes. Budget for
this when choosing the model, not after.

**Symptom:** `SET LOCAL search_path = $1` raises `42601`
**Cause:** `SET` does not accept parameters.
**Fix:** `set_config('search_path', $1, true)`.

## Interview questions

**★ What are the multi-tenancy models and how do you choose?**
Shared schema with a `tenant_id` column, schema per tenant, and database per
tenant — in increasing isolation and increasing operational cost. Choose by
contractual isolation requirements first, then tenant count (thousands force
shared schema), then how often you need cross-tenant queries. Default to shared
schema with RLS; it is also the only reversible choice, since separated → shared
requires remapping colliding identity values.

**★ How do you prevent cross-tenant data leaks in a shared-schema design?**
In layers: a repository that requires the tenant id and adds the predicate so
application code cannot express an unscoped query; row-level security underneath
as a `RESTRICTIVE` policy with `FORCE ROW LEVEL SECURITY`, so anything escaping
that layer — a migration, a `psql` session — is still filtered; and tests
asserting that one tenant sees zero of another's rows.

**★ Why is `SET LOCAL` mandatory rather than preferred here?**
Because a plain `SET` persists on a pooled connection after the transaction ends
— measured — so the next request, potentially another tenant's, inherits the
previous tenant id. With RLS driven by that setting, the result is a cross-tenant
data exposure that only appears under concurrency and therefore never shows up in
development.

**★ What does schema-per-tenant actually cost?**
Migrations run N times and can fail per tenant, so you need tooling that tracks
and resumes per-tenant state; cross-tenant reporting becomes a `UNION` over N
schemas; the catalog grows with tenant count, slowing catalog operations and
tools; and `search_path` becomes safety-critical with the same pooled-connection
hazard. It is the right choice when isolation is a contractual requirement, and
an expensive one when it is chosen for reassurance.

**Why must `tenant_id` lead your indexes?**
Because every query is tenant-scoped in practice — explicitly in application code
and implicitly through the RLS predicate — so an index that does not lead with
`tenant_id` cannot serve the filter that is on every query. This is the most
common performance failure in shared-schema designs.

**Which direction is a tenancy migration easy in?**
Shared → separated is straightforward: filter by `tenant_id` and copy each tenant
out. Separated → shared is hard, because identity values collide across schemas
and every reference must be remapped. That asymmetry is a strong argument for
starting shared when the requirement is uncertain.

---


---

← [Choosing a model](01-choosing-a-model.md) · Next → [Operating it](03-operating-it.md)
