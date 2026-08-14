---
title: "20.1 · Choosing a tenancy model"
sidebar_label: "01 · Choosing a model"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13. The `search_path` mechanism and the three layouts are
> **sandbox-measured** in
> [10 · Schemas and tenancy](../10-schemas-tenancy.md)
> (`sandbox/pg-api/ex12-ddl-rest.mjs`); the pooled-connection `SET` leak is
> measured in `sandbox/pg-api/ex54-pgbouncer.mjs` §3. Everything else is
> validated against the **PostgreSQL 18 documentation**
> ([schemas](https://www.postgresql.org/docs/18/ddl-schemas.html),
> [row security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)).
> **No console output on this page** — the measured output is on the pages cited.

**This page is the decision, not the mechanism.**
[10 · Schemas and tenancy](../10-schemas-tenancy.md) shows how `search_path`
works and proves that the same query returns different rows per schema. This page
is about which of the three models to choose, and what each one costs you two
years in — which is where the choice actually gets paid for.

## The three models

| | **Shared schema** | **Schema per tenant** | **Database per tenant** |
|---|---|---|---|
| Separation | a `tenant_id` column | a schema each | a database each |
| Isolation | weakest — one missing `WHERE` leaks | strong — wrong `search_path` gives an empty table | strongest — no shared connection |
| Migrations | **once** | **N times** | **N times**, across N connections |
| Cross-tenant reporting | trivial — one query | painful — `UNION` over N schemas | very hard — separate databases |
| Per-tenant backup/restore | hard — filter rows out | moderate | **trivial** |
| Connection pooling | one pool | one pool | **N pools**, or reconnects |
| Catalog size | small | **grows with tenants** | grows fastest |
| Noisy neighbour | shared everything | shared everything | isolated |
| Cost per tenant | lowest | low | highest |
| Scales to | millions of tenants | hundreds to low thousands | tens to low hundreds |

The two rows that decide most real cases are **migrations** and **cross-tenant
reporting**, and they pull in opposite directions from isolation. That tension is
the whole decision.

## Start with shared schema

For most SaaS products, **shared schema with a `tenant_id` column is the right
default**, and it is what the large multi-tenant products actually run.

```sql
CREATE TABLE documents (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id  uuid NOT NULL REFERENCES tenants(id),
  title      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- tenant_id LEADS every index
CREATE INDEX ON documents (tenant_id, created_at DESC);
CREATE UNIQUE INDEX ON documents (tenant_id, slug);
```

Three design rules that matter more than they look:

**`tenant_id` leads every index.** Every query is tenant-scoped in practice, so an
index on `(created_at)` is nearly useless while `(tenant_id, created_at)` serves
the queries you actually run. Getting this wrong is the most common performance
problem in shared-schema designs.

**Uniqueness is per tenant.** A `slug` unique across the whole table means tenant
B cannot use a slug tenant A took — a cross-tenant coupling that will confuse
someone. `UNIQUE (tenant_id, slug)` is almost always what you meant.

**`tenant_id` is `NOT NULL`, everywhere, with a foreign key.** A nullable
`tenant_id` is a row belonging to nobody, and it will eventually be returned to
somebody.

### The obvious objection, and the answer

The objection to shared schema is real: **one forgotten `WHERE tenant_id = $1`
and you have shown one customer another customer's data.** That is not a bug, it
is an incident with legal consequences.

The answer is not to abandon the model. It is to make the filter impossible to
forget, in layers:

1. **A repository layer that takes the tenant as a required argument** and adds
   the predicate itself — so application code cannot express an unscoped query.
2. **Row-level security underneath**, so that even a raw `psql` session, a
   migration script, or a query that escaped the repository is filtered. This
   converts "someone forgot a `WHERE`" from a data breach into an empty result.
3. **Tests that assert the negative case** — tenant A's session sees zero of
   tenant B's rows.

Layer 2 is the one that changes the risk profile, and it is
[13 · Row-level security](../../phase-13-ops/14-rls/README.md).

```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON documents AS RESTRICTIVE
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

`RESTRICTIVE` is deliberate: tenant isolation must apply regardless of whichever
permissive policy let the query in. `FORCE` is deliberate too — without it the
table owner bypasses the policy entirely, which is exactly the role a careless
application connects as.

## The setting that makes or breaks it

Carrying `app.tenant_id` is the mechanism the whole scheme rests on, and there is
one rule:

**`SET LOCAL`, never `SET`.**

This was measured (`ex54` §3): a plain `SET` **persisted across a pooled
connection handoff** while `SET LOCAL` did not. On a pooled connection — which is
every production application — a plain `SET` leaves the tenant id on the backend
for whoever gets that connection next.

Read that consequence plainly: **the next request, possibly another tenant's,
inherits the previous tenant's identity.** With RLS driven by that setting, this
is not a subtle bug; it is a cross-tenant data exposure that appears only under
concurrency and therefore never in development.

```js
export async function withTenant(pool, tenantId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)',   // true = LOCAL
                       ['app.tenant_id', tenantId]);
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

Two details: `set_config(name, value, true)` is the function form of `SET LOCAL`
and takes the value as a **parameter**, which matters because `SET LOCAL x = $1`
is not valid syntax — `SET` does not accept parameters, and attempting it raises
`42601`. And the whole thing must be inside a transaction, since `LOCAL` scoping
is transaction scoping.

Under a transaction-mode pooler this is not merely good practice — session state
is documented as unsupported entirely
([PgBouncer pool modes](../../phase-13-ops/07-pgbouncer/02-pool-modes.md)).

## Trade-off

Shared schema takes the cheapest operations and the weakest *structural*
isolation, then buys most of the isolation back with RLS. That is why it is the
default: the layered defence is nearly as strong in practice, and vastly cheaper
to run than N schemas or N databases.

What you accept is that isolation is now a property of your **configuration**
rather than your **structure** — it holds only while RLS is enabled, the app
connects as a non-owner, and every session sets `app.tenant_id` with `SET LOCAL`.
Those are three things that can be got wrong, and none of them can be got wrong
in a database-per-tenant design.

The mistake worth avoiding is paying for isolation twice: choosing
schema-per-tenant *and* maintaining tenant filtering in application code gives
you both costs and little extra safety.

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

**Symptom:** `SET LOCAL app.tenant_id = $1` raises `42601`
**Cause:** `SET` does not accept parameters.
**Fix:** `SELECT set_config('app.tenant_id', $1, true)`.

## Interview questions

**★ Why is shared schema the usual default?**
It is the only model that scales to thousands of tenants, migrations run once,
cross-tenant reporting is an ordinary query, and onboarding is an `INSERT`. Its
weakness — a forgotten `WHERE tenant_id` — is addressed in layers: a repository
that requires the tenant, RLS underneath as a backstop, and tests asserting the
negative case.

**★ How do you prevent cross-tenant data leaks in a shared-schema design?**
A repository that takes the tenant id as a required argument and adds the
predicate itself; row-level security underneath as a `RESTRICTIVE` policy with
`FORCE ROW LEVEL SECURITY`, so anything escaping that layer — a migration, a
`psql` session — is still filtered; and tests that assert one tenant sees zero of
another's rows.

**★ Why is `SET LOCAL` mandatory rather than preferred here?**
Because a plain `SET` persists on a pooled connection after the transaction ends
— measured — so the next request, potentially another tenant's, inherits the
previous tenant id. With RLS driven by that setting, the result is a cross-tenant
data exposure that only appears under concurrency and therefore never shows up in
development.

**★ Why must `tenant_id` lead your indexes?**
Because every query is tenant-scoped in practice — explicitly in application code
and implicitly through the RLS predicate — so an index that does not lead with
`tenant_id` cannot serve the filter that is on every query. This is the most
common performance failure in shared-schema designs.

**Why should uniqueness be per tenant?**
A `slug` unique across the whole table means one tenant can consume a value
another wanted, which is a cross-tenant coupling nobody intends.
`UNIQUE (tenant_id, slug)` is almost always what was meant.

---

← [Phase index](../README.md) · Next → [The models compared](02-models-compared.md)
