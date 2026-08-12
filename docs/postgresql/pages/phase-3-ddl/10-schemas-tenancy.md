---
title: "Schemas as namespaces, search_path, and multi-tenancy"
sidebar_label: "10 · Schemas and tenancy"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex12-ddl-rest.mjs`.

**A schema is a namespace inside a database. `search_path` decides which one an
unqualified table name resolves to — which makes it powerful, and makes it the
single most dangerous session setting in a pooled application.**

## The mechanism

```sql
CREATE SCHEMA tenant_a;  CREATE SCHEMA tenant_b;
CREATE TABLE tenant_a.items (id int, name text);
CREATE TABLE tenant_b.items (id int, name text);
```

```console
$ node ex12-ddl-rest.mjs
=== 5. schemas as namespaces ===
search_path=tenant_a  → SELECT FROM items gives "from A"
search_path=tenant_b  → SELECT FROM items gives "from B"
current search_path: tenant_b
default search_path: "$user", public
```

The identical query `SELECT name FROM items` returned different rows. That is the
whole feature: one set of application queries, many isolated copies of the schema.

The default `search_path` is `"$user", public` — a schema named after the connected
role if it exists, then `public`. Every table you have created so far went into
`public` because of that fallback.

## Three multi-tenant layouts

| Layout | Isolation | Cost |
|---|---|---|
| **Shared tables** with a `tenant_id` column | Weakest — one missing `WHERE` leaks data | Cheapest; one schema, one connection pool, easy cross-tenant reporting |
| **Schema per tenant** | Strong — wrong `search_path` shows an empty table, not another tenant's rows | Migrations run N times; catalog grows with tenants |
| **Database per tenant** | Strongest | A connection pool per tenant; cross-tenant queries impossible |

**Schema-per-tenant is the middle option and it stops scaling around the low
thousands.** Every tenant multiplies the catalog: 1 000 tenants × 50 tables is
50 000 tables, which slows autovacuum, `pg_dump`, and planning. Migrations become a
loop that must be transactional per tenant and resumable.

Shared tables with `tenant_id` is what most applications should use, with the
isolation enforced by **row-level security** rather than by remembering the
predicate:

```sql
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON items
  USING (tenant_id = current_setting('app.tenant_id')::bigint);
```

That moves the guarantee into the database, which is the same argument as
[Foreign keys](03-foreign-keys.md) — a rule the application can forget is not a
rule.

## `search_path` and connection pooling

**`SET search_path` persists for the connection**, and a pooled connection is
handed to the next request unchanged. That is a cross-tenant data leak:

```js
// ✗ leaks to whoever borrows this connection next
await pool.query(`SET search_path TO tenant_${id}`);
await pool.query('SELECT * FROM items');
```

The measured `SHOW search_path` above returned `tenant_b` after the loop — the
setting outlived the statement that needed it.

Two safe patterns:

```js
// (a) hold the client, and reset in finally
const client = await pool.connect();
try {
  await client.query('SET search_path TO $1', [schema]);   // see the caveat below
  ...
} finally {
  await client.query('RESET search_path');
  client.release();
}

// (b) better: scope it to a transaction
await client.query('BEGIN');
await client.query(`SET LOCAL search_path TO ${safeSchema}`);
...
await client.query('COMMIT');   // reverts automatically
```

**`SET LOCAL` inside a transaction is the correct tool** — it reverts on commit or
rollback, so a crash cannot leave the connection pointed at the wrong tenant.

`pg` also supports resetting on release via the pool's connection lifecycle, and
`node-postgres` users often add an `options` connection parameter
(`-c search_path=…`) so it is set at connect time rather than per query.

### The schema name cannot be a parameter

`SET search_path TO $1` does not work — the same identifier rule as
[Sort and filter allowlists](../phase-9-api-crud/allowlists/). A tenant schema name
built by concatenation is an injection vector. Validate it against the catalog:

```js
const {rows} = await client.query(
  `SELECT nspname FROM pg_namespace WHERE nspname = $1`, [requested]);
if (!rows.length) throw new Error('unknown tenant schema');
await client.query(`SET LOCAL search_path TO ${pg.escapeIdentifier(rows[0].nspname)}`);
```

The catalog lookup is the allowlist — it can only return a schema that exists.

## Other uses for schemas

Multi-tenancy is the flashy case; the everyday ones matter more:

- **Extensions in their own schema** — `CREATE EXTENSION pg_trgm SCHEMA ext;` keeps
  `public` clean and makes it obvious what is not yours.
- **Staging areas** — a `staging` schema for load tables, so `public` holds only the
  real model.
- **Access control boundaries** — `GRANT USAGE ON SCHEMA reporting TO analyst;`
  applies to everything inside it.

## `public` and the security note

Since PostgreSQL 15, `public` no longer grants `CREATE` to every user by default —
previously any role could create objects in it. On older databases, or ones migrated
forward, check:

```sql
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
```

The related hazard is `search_path` in `SECURITY DEFINER` functions: if `public` is
early in the path and writable, a user can shadow a function or operator your
function calls. Set an explicit `search_path` on such functions.

## Trade-off

Schemas give namespacing and a real isolation boundary without the operational cost
of separate databases, and `search_path` lets one codebase serve many tenants
unchanged.

The cost is that isolation now depends on a **session variable** rather than on the
query text. Everything else in this corpus argues for putting correctness where it
cannot be forgotten; `search_path` is the opposite — a connection-scoped setting in
an environment (a pool) explicitly designed to reuse connections between unrelated
requests. Use `SET LOCAL` inside a transaction, or prefer `tenant_id` with row-level
security, where the guarantee travels with the row rather than the connection.

## Gotchas

**Symptom:** A request returns another tenant's data
**Cause:** `SET search_path` persisted on a pooled connection into the next request.
**Fix:** `SET LOCAL` inside a transaction, or `RESET` in `finally`.

**Symptom:** `SET search_path TO $1` fails
**Cause:** A schema name is an identifier and cannot be a bound parameter.
**Fix:** Validate against `pg_namespace`, then interpolate the returned name with
`escapeIdentifier`.

**Symptom:** `42P01 relation does not exist` for a table that is definitely there
**Cause:** Its schema is not on `search_path`, or the path was reset.
**Fix:** Qualify the name (`tenant_a.items`) or set the path deliberately.

**Symptom:** A migration created the table in the wrong schema
**Cause:** It relied on the default `"$user", public` and the connecting role has a
matching schema.
**Fix:** Schema-qualify DDL in migrations.

**Symptom:** Autovacuum and `pg_dump` slow down as tenants are added
**Cause:** Schema-per-tenant multiplies the catalog — 1 000 tenants × 50 tables is
50 000 tables.
**Fix:** Shared tables with `tenant_id` and row-level security.

**Symptom:** A `SECURITY DEFINER` function behaves unexpectedly for some users
**Cause:** A mutable `search_path` let a user shadow a function or operator it calls.
**Fix:** Set an explicit `search_path` on the function.

## Interview questions

**★ What is `search_path` and why is it risky in a pooled application?**
It is the ordered list of schemas an unqualified name resolves against — measured,
the same `SELECT FROM items` returned different rows under `tenant_a` and
`tenant_b`. `SET search_path` persists for the *connection*, and a pool hands that
connection to the next request, so a stale path is a cross-tenant data leak. Use
`SET LOCAL` inside a transaction so it reverts on commit.

**★ What are the multi-tenancy layouts and how do you choose?**
Shared tables with `tenant_id` (cheapest, weakest isolation — pair with row-level
security), schema per tenant (strong isolation, but the catalog multiplies and
migrations loop over tenants; it stops scaling in the low thousands), and database
per tenant (strongest, a pool per tenant, no cross-tenant queries).

**★ Why can't the schema name be a parameter?**
It is an identifier, and identifiers are fixed at parse time. Validate the requested
name against `pg_namespace` — a lookup that can only return schemas that exist — and
then interpolate the returned value with `escapeIdentifier`.

**★ What is the default `search_path` and what does it mean?**
`"$user", public` — a schema matching the connected role name if it exists, then
`public`. It is why unqualified `CREATE TABLE` lands in `public` for most setups, and
why a role with a same-named schema can silently create tables somewhere else.

**★ Schema-per-tenant or `tenant_id` with row-level security?**
RLS for most applications: the guarantee travels with the row rather than with a
connection setting, and the catalog stays one size. Schema-per-tenant when tenants
are few, large, and need visibly separate data — accepting that migrations become a
per-tenant loop.

---

← [Adding a `NOT NULL` column safely](09-add-not-null.md) · Next → [Naming conventions](11-naming.md)
