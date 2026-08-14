---
title: "20.3 · Operating a multi-tenant database"
sidebar_label: "03 · Operating it"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation**
> ([schemas](https://www.postgresql.org/docs/18/ddl-schemas.html),
> [row security](https://www.postgresql.org/docs/18/ddl-rowsecurity.html),
> [`ALTER ROLE`](https://www.postgresql.org/docs/18/sql-alterrole.html)).
> **Not sandbox-measured** — no console output on this page; the measured results
> it refers to are cited to their own pages.

**The tenancy model is chosen once; the consequences arrive every week
afterwards.** This chunk is the part that does not appear in the comparison
table: onboarding, deletion, noisy neighbours, and the queries that have to
cross tenants anyway.

## Onboarding a tenant

The models differ enormously here, and this is a good sanity check on the choice
made in [chunk 01](01-choosing-a-model.md):

| Model | Onboarding a tenant is… |
|---|---|
| Shared schema | `INSERT INTO tenants …` — milliseconds |
| Schema per tenant | `CREATE SCHEMA` + run every migration + grants — seconds to minutes |
| Database per tenant | provision a database, migrate, add a connection pool — minutes, and infrastructure |

For a self-serve product where sign-up must be instant, the second and third rows
are a product constraint, not just an operational one. If a trial sign-up has to
wait for a schema build, you have made a database decision that is now a
conversion-rate decision.

Whatever the model, make onboarding **idempotent and transactional**. A
half-created tenant — row inserted, schema missing, or vice versa — is a support
ticket that recurs. In shared schema this is free (one transaction); in
schema-per-tenant it needs care, because `CREATE SCHEMA` and migrations inside a
single transaction hold locks for the duration
([12 · Zero-downtime DDL](../../phase-13-ops/12-zero-downtime-ddl/01-the-lock-queue.md)).

## Deleting a tenant, and meaning it

"Delete my data" is a legal obligation in most jurisdictions, and the models
differ sharply:

**Database or schema per tenant** — `DROP DATABASE` / `DROP SCHEMA CASCADE`.
Complete, verifiable, fast. This is the strongest argument for separation and it
is worth weighing properly.

**Shared schema** — a `DELETE` per table, in dependency order, which means:

```sql
BEGIN;
DELETE FROM document_versions WHERE tenant_id = $1;
DELETE FROM documents         WHERE tenant_id = $1;
-- … every table, in FK order …
DELETE FROM tenants           WHERE id = $1;
COMMIT;
```

Three things make this harder than it looks:

- **You must enumerate every table**, and a table added later without being added
  here silently retains data. Generate the list from
  `information_schema.columns WHERE column_name = 'tenant_id'` rather than
  maintaining it by hand — a query is harder to forget to update than a list.
- **`ON DELETE CASCADE` from the `tenants` row** does much of this automatically
  and is worth designing in from the start, though it makes the delete a single
  large transaction — batch it for big tenants
  ([12 · Expand and contract](../../phase-13-ops/12-zero-downtime-ddl/02-expand-and-contract.md)).
- **Deleted rows are not gone.** They are dead tuples until vacuum, and they
  persist in **backups** for the retention window
  ([15 · Physical backup](../../phase-13-ops/15-physical-backup/README.md)). If your
  obligation is genuine erasure rather than deletion, backup retention is part of
  the answer and needs to be stated in your policy.

## Noisy neighbours

In shared schema every tenant shares connections, cache, CPU and autovacuum. One
tenant importing ten million rows degrades everyone.

Nothing in PostgreSQL isolates this within a single database, which is the honest
answer. What you can do:

- **Per-role limits** for tenants you can separate by role:
  ```sql
  ALTER ROLE tenant_bulk SET statement_timeout = '30s';
  ALTER ROLE tenant_bulk SET work_mem = '16MB';
  ```
- **Rate limiting in the application**, which is where per-tenant quotas
  realistically live.
- **Separate connection pools per tier**, so a bulk-import pool cannot consume
  the pool the interactive API needs — the pool-exhaustion mechanism measured in
  [07 · PgBouncer](../../phase-13-ops/07-pgbouncer/03-exhaustion-and-sizing.md).
- **A separate replica for reporting**, so analytical tenants do not compete with
  transactional ones ([08 · Replicas](../../phase-13-ops/08-replication/README.md)).

If noisy neighbours are a genuine product problem — a few very large tenants
alongside many small — that is a legitimate reason to move those specific tenants
to their own database. **Hybrid is allowed**: shared schema for the long tail,
dedicated databases for the largest few. Many mature products end up here, and
arriving deliberately is better than pretending one model must serve everyone.

## Cross-tenant queries you cannot avoid

Even in a strict multi-tenant design, some queries are legitimately global:
billing, usage metering, admin dashboards, product analytics, and support tools
that look up a user across tenants.

In shared schema these are ordinary queries — but note they must **bypass RLS**,
which means a dedicated role:

```sql
CREATE ROLE analytics LOGIN BYPASSRLS;
```

The important property is that this is *explicit*. One role, named for the
purpose, not used by the application. The alternative — running admin queries as
the table owner, which bypasses RLS implicitly — makes unrestricted access
indistinguishable from an oversight
([14 · RLS](../../phase-13-ops/14-rls/03-performance-and-practice.md)).

In schema-per-tenant, the same query is a `UNION` over N schemas, usually
generated dynamically. This is the cost that grows silently: fine at 10 tenants,
a real engineering problem at 500, and it tends to be discovered when the first
serious reporting requirement arrives — long after the model was chosen.

## Per-tenant observability

Being able to answer "which tenant is causing this?" is worth building early.

```sql
-- shared schema: rows and size per tenant
SELECT tenant_id, count(*) AS rows
  FROM documents GROUP BY tenant_id ORDER BY rows DESC LIMIT 20;
```

Set **`application_name` to include the tenant** where practical, so
`pg_stat_activity` and the slow-query log attribute work to a tenant rather than
to "the API"
([09 · Monitoring](../../phase-13-ops/09-monitoring/01-whats-happening-now.md),
[11 · Logging](../../phase-13-ops/11-logging/01-what-to-log.md)). This costs
nothing to set up and is the difference between diagnosing a tenant-specific
problem in minutes and in hours.

Note that `pg_stat_statements` aggregates by **normalised query**, so it will not
separate tenants — the tenant id is a parameter. That is the correct behaviour
for finding expensive query shapes and the reason you need per-tenant
attribution from `application_name` or the application's own metrics as well.

## Testing tenant isolation

This deserves a real test suite, because the failure is silent over-exposure
rather than an error:

| Test | Expectation |
|---|---|
| Tenant A reads tenant B's rows by id | **0 rows** |
| Tenant A inserts with tenant B's id | rejected by RLS `WITH CHECK` |
| Tenant A updates a row to tenant B's id | rejected |
| No tenant context set | 0 rows, or a clear error |
| `count(*)` as tenant A | only A's rows |
| Two sequential requests on one pooled connection | the second does **not** inherit the first's tenant |

The last row is the one nobody writes and the one that catches the `SET` versus
`SET LOCAL` bug measured in
[07 · Pool modes](../../phase-13-ops/07-pgbouncer/02-pool-modes.md). It requires
deliberately reusing a connection across two requests with different tenants —
which is exactly what production does and what a test suite usually does not.

Run these as the **application role**, never the owner: owners bypass RLS, so
owner-run isolation tests pass regardless of whether the policies work.

## When to think about sharding

Sharding — splitting tenants across multiple PostgreSQL clusters — is a different
problem from tenancy and should be deferred until it is genuinely needed.
Indicators that it is:

- A single instance cannot hold the data or serve the write volume, after
  indexing and query work.
- Per-tenant isolation requirements that separate databases on one instance no
  longer satisfy.
- Regional data residency requirements.

Shared schema with `tenant_id` **shards well later**, because the tenant is
already the natural partition key — another argument for it as the default. If
you expect to shard, keeping `tenant_id` on every table and avoiding cross-tenant
foreign keys keeps that door open at no cost.

## Trade-off

Operating multi-tenancy trades **per-tenant control against per-tenant effort**,
and the trade compounds over time rather than being paid once. Shared schema
gives you instant onboarding, trivial cross-tenant queries and one migration per
change — and asks you to build deletion, noisy-neighbour control and per-tenant
observability yourself, in the application, because the database gives you none
of them.

Separated models give you those properties directly — deletion is a `DROP`,
isolation is structural, per-tenant restore is real — and charge you on every
migration, every report and every connection pool, forever.

The mistake worth avoiding is treating this as one decision made once. **Hybrid
is a legitimate destination**: the long tail on shared schema, the few very large
or contractually separated tenants on their own databases. What makes that work
is choosing shared schema first — because it is the reversible direction — and
moving specific tenants out when a specific reason appears, rather than paying
for separation across all of them in advance.

## Gotchas

**Symptom:** Deleted tenant data reappears in a report
**Cause:** A table added after the deletion routine was written and never added
to it.
**Fix:** Generate the table list from
`information_schema.columns WHERE column_name = 'tenant_id'`, or use
`ON DELETE CASCADE` from the `tenants` row.

**Symptom:** "Delete my data" completed but the data is still in backups
**Cause:** Deletion removes rows from the live database, not from backups within
the retention window.
**Fix:** State this in your data policy and align retention with your erasure
obligation. It is a policy question, not a technical oversight.

**Symptom:** One tenant's import makes the product slow for everyone
**Cause:** Shared schema shares connections, cache and CPU; PostgreSQL offers no
intra-database isolation.
**Fix:** Per-role `statement_timeout` and `work_mem`, separate pools per
workload tier, application rate limits — and consider moving that tenant to its
own database.

**Symptom:** Admin dashboards return nothing after enabling RLS
**Cause:** Correct — RLS filters them too, including aggregates.
**Fix:** A dedicated `BYPASSRLS` role for analytics, used only there.

**Symptom:** Isolation tests pass; production leaks
**Cause:** Tests ran as the table owner (which bypasses RLS), or never reused a
pooled connection across two tenants.
**Fix:** Test as the application role, and add the sequential-requests-on-one-
connection case.

**Symptom:** Cannot tell which tenant caused a slow query
**Cause:** `pg_stat_statements` normalises the tenant id into a parameter, so it
aggregates across tenants by design.
**Fix:** Put the tenant in `application_name` so `pg_stat_activity` and the log
attribute it, and keep per-tenant metrics in the application.

## Interview questions

**★ How do you delete a tenant's data completely?**
With schema or database per tenant, `DROP SCHEMA CASCADE` / `DROP DATABASE` —
complete and verifiable. In shared schema it is a `DELETE` per table in FK order,
best driven by `ON DELETE CASCADE` from the tenant row and by generating the
table list from `information_schema` so a newly added table is not missed. In
both cases the data persists in backups for the retention window, which is a
policy question that belongs in your erasure commitments.

**★ How do you handle a noisy tenant in a shared-schema design?**
PostgreSQL provides no isolation within a database, so: per-role
`statement_timeout` and `work_mem`, separate connection pools per workload tier
so bulk work cannot exhaust the interactive pool, application-level rate limits,
and a reporting replica. If it is a persistent product problem, moving that
specific tenant to its own database is legitimate — hybrid models are a normal
destination.

**★ How do you run admin queries that must cross tenants under RLS?**
With a dedicated role holding `BYPASSRLS`, used only for that purpose. The value
is that it is explicit — the common alternative of running admin work as the
table owner bypasses RLS implicitly and makes intentional unrestricted access
indistinguishable from a mistake.

**★ What is the tenant-isolation test that people forget?**
Two sequential requests for different tenants on the **same pooled connection**.
That is the case that catches a plain `SET` leaking the tenant id into the next
request — measured behaviour — and it is precisely what production does and what
test suites usually do not.

**Why does shared schema shard well later?**
Because `tenant_id` is already the natural partition key, so splitting tenants
across clusters is mostly routing. Keeping `tenant_id` on every table and
avoiding cross-tenant foreign keys preserves that option at no cost, which is
another reason to start there when future scale is uncertain.

**Why set `application_name` to include the tenant?**
Because `pg_stat_statements` normalises the tenant id into a parameter and
therefore aggregates across tenants by design. Putting the tenant in
`application_name` gives `pg_stat_activity` and the slow-query log per-tenant
attribution, which turns "the API is slow" into "this tenant is slow".

---

← [The models compared](02-models-compared.md) · Next → [Phase index](../README.md)
