---
title: "The app role should not own the schema"
sidebar_label: "03 · App role ≠ owner"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex50-privileges.mjs`.

**Two connection strings, not one: migrations connect as the owner, the
application connects as a role that owns nothing.** The reason is narrow and
worth stating exactly — DDL is an ownership right with no `GRANT` form, so
ownership is the only thing that decides whether a stray `DROP TABLE` runs.

## The measurement

The same four statements, run as the application role and as the owner:

```console
$ node ex50-privileges.mjs
=== 11. why the app role must not own the schema ===
app role: DROP TABLE app.receipts                    → 42501 must be owner of table receipts
app role: ALTER TABLE ... DROP COLUMN                → 42501 must be owner of table customers
app role: CREATE TABLE in app                        → 42501 permission denied for schema app
owner: ALTER TABLE ... ADD COLUMN                    → OK
↑ A SQL-injected DROP TABLE is a 42501 for the app role and a completed
  migration for an owner role. That difference is the whole point.
```

The application role in that run holds `SELECT, INSERT, UPDATE, DELETE` on the
tables — everything the application needs. It still cannot drop a table, drop a
column, or create one.

Note the two different messages, because they mean different things:

- **`must be owner of table`** — DDL on an existing object. There is no `GRANT
  DROP` or `GRANT ALTER` in PostgreSQL; the right belongs to the owner and to
  members of the owning role, and nothing else can confer it.
- **`permission denied for schema app`** — `CREATE` on the schema, which *is* a
  grantable privilege. If you grant it, the app can create tables (and would then
  own them, which is how this boundary erodes).

## What it actually protects against

Be honest about the threat model, because this control is narrower than "it makes
you secure":

**It does protect against destructive DDL.** A SQL injection that reaches
`DROP TABLE users` or `ALTER TABLE users DROP COLUMN email`, an ORM's
"auto-migrate in production" flag, a wrong environment variable pointing a
migration tool at production — every one of these becomes `42501` for a
non-owning role.

**It does not protect your data.** The application role can still
`DELETE FROM users` and `UPDATE users SET email = …` — those are the privileges
it needs to function. Ownership separation is about the *schema*, not the rows.
`TRUNCATE` is the interesting middle case: it is a grantable privilege, so
withhold it and an injected `TRUNCATE users` also fails
([GRANT and REVOKE](01-roles-grant/02-grant-and-revoke.md)).

**It does not survive a compromised owner credential.** If CI holds the migration
credential and CI is compromised, everything above is available. Keep the owner
password in a different place from the app's, and prefer a CI secret that is not
readable by build steps.

The realistic summary: it removes an entire class of catastrophic-and-permanent
mistakes at the cost of one extra connection string.

## The shape

```sql
-- once, as a superuser or the database owner
CREATE ROLE shop_owner LOGIN PASSWORD :'owner_pw';   -- migrations only
CREATE ROLE shop_app   LOGIN PASSWORD :'app_pw';     -- the service
CREATE SCHEMA shop AUTHORIZATION shop_owner;

GRANT USAGE ON SCHEMA shop TO shop_app;              -- note: USAGE, not CREATE
ALTER DEFAULT PRIVILEGES FOR ROLE shop_owner IN SCHEMA shop
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shop_app;
```

`GRANT USAGE` without `CREATE` is the load-bearing line. The
`ALTER DEFAULT PRIVILEGES` line is what stops this design from adding a manual
grant step to every migration — see
[Defaults and auditing](01-roles-grant/04-defaults-and-auditing.md).

In the application:

```js
// migrations — run by CI or a release step, never by the service process
const migrationPool = new pg.Pool({connectionString: process.env.MIGRATION_DATABASE_URL});

// the service — the only pool the request path ever sees
const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});
```

Two variables, and the service must not be able to read `MIGRATION_DATABASE_URL`
at all. If both live in the same `.env`, you have the pattern without the
protection — a compromised process reads both.

## Objects created by migrations belong to the owner

An object is owned by whoever creates it, so as long as migrations run as
`shop_owner`, everything it creates is owned by `shop_owner`. The failure mode is
a table created by hand as someone else — a developer fixing something in `psql`,
or an early migration run before the roles existed. Then one table has a
different owner, default privileges recorded `FOR ROLE shop_owner` never apply to
it, and the app gets `42501` on exactly one table.

Find them before they surprise you:

```sql
SELECT tablename, tableowner
  FROM pg_tables
 WHERE schemaname = 'shop' AND tableowner <> 'shop_owner';
```

`ALTER TABLE … OWNER TO shop_owner` fixes each one; `REASSIGN OWNED BY dev TO
shop_owner` fixes all of a role's at once.

## Who owns the *database* and the schema

Three separate ownerships that are easy to conflate:

| Object | Owner | Why it matters |
|---|---|---|
| The database | usually a provisioning/admin role | Controls `ALTER DATABASE`, and `pg_database_owner` grants |
| The schema | the migration role | Controls `CREATE`/`DROP` of tables inside it |
| Each table | whoever created it — so, the migration role | Controls `ALTER`/`DROP` of that table |

A managed provider usually gives you a database whose owner is *your* admin role
rather than a true superuser — which is why some `ALTER SYSTEM` and extension
operations fail there. That is [Managed PostgreSQL](13-managed-postgres.md), not
this page, but it is the same ownership model.

## When one role is fine

Two cases where this is over-engineering:

- **A local development database.** One role, own everything, move on. The
  separation matters where the data is not disposable.
- **A service whose deploy runs migrations in-process at boot** and cannot be
  changed. Then the app role must own the schema, and the honest fix is to
  reduce the window: run the migration with a role obtained at boot and dropped
  from the pool afterwards, or accept the risk explicitly rather than believing
  in a boundary you do not have.

What is *not* an excuse is "our ORM needs it". Almost every migration tool takes
a separate connection string; check before conceding the point.

## Trade-off

The cost is real and it is operational, not technical: two credentials to
provision, rotate and keep apart, and a class of bug where the app works locally
(one role, owns everything) and fails in staging with `42501` on a new table
because someone forgot the default privileges. That failure lands at deploy time,
which is when you want it.

The benefit is that the credential most likely to leak — the one in the running
service, reachable through SQL injection and through anything that can read the
process environment — cannot destroy the schema. For anything holding data you
would not enjoy restoring from backup, that trade is clearly worth it.

## Gotchas

**Symptom:** The app gets `42501` on exactly one table
**Cause:** That table has a different owner, so the `FOR ROLE`-keyed default
privileges never applied to it — usually created by hand in `psql`.
**Fix:** `SELECT tablename, tableowner FROM pg_tables WHERE schemaname = '…'`,
then `ALTER TABLE … OWNER TO <migration role>` and re-grant.

**Symptom:** `42501 must be owner of table …` from a migration
**Cause:** The migration ran as the app role.
**Fix:** Point the migration tool at the owner connection string. There is no
`GRANT` that fixes this — DDL is an ownership right.

**Symptom:** The app can create tables although it does not own the schema
**Cause:** `CREATE` on the schema was granted, and objects it creates are then
owned by the app role — the boundary erodes silently.
**Fix:** `REVOKE CREATE ON SCHEMA … FROM app_role`; grant `USAGE` only.

**Symptom:** Separation is in place but a compromise still dropped tables
**Cause:** Both connection strings were readable by the service process — a
shared `.env`, or a CI secret exposed to build steps.
**Fix:** The migration credential must be unreachable from the running service.
Two variables in one file is the pattern without the protection.

**Symptom:** New tables are unreadable by the app after every migration
**Cause:** No `ALTER DEFAULT PRIVILEGES`, so each new table needs a manual grant.
**Fix:** Set defaults `FOR ROLE <migration role>` in the first migration.

## Interview questions

**★ Why should the application role not own its tables?**
Because DDL is an ownership right with no `GRANT` form — measured, a non-owning
role got `42501 must be owner of table` on `DROP TABLE` and on `ALTER TABLE …
DROP COLUMN`, while holding full `SELECT/INSERT/UPDATE/DELETE`. An injected or
accidental `DROP TABLE` is a denied statement rather than a permanent loss.

**★ What does that separation *not* protect?**
The rows. The app role can still `DELETE`/`UPDATE` everything — those are the
privileges it needs. It is a schema boundary, not a data boundary; `TRUNCATE` is
the one destructive verb you can additionally withhold because it is grantable.

**★ Can you grant DDL without transferring ownership?**
Not directly — there is no `GRANT DROP`/`GRANT ALTER`. The supported way is to
grant *membership* in the owning role, so a session can `SET ROLE` to the owner
deliberately. `CREATE` on a schema is grantable, but objects created that way are
owned by the creator.

**Two connection strings live in the same `.env`. What have you actually gained?**
Very little against a compromised process, which can read both. The pattern only
protects when the migration credential is unreachable from the running service —
CI-only, or a secret the app's role cannot fetch.

**A single table returns `42501` and the rest of the schema is fine. What is it?**
That table has a different owner — created by hand rather than by the migration
role — so the `FOR ROLE`-keyed default privileges never applied. Check
`pg_tables.tableowner`.

---

← [Secrets](secrets/) · Next → [pg_dump and pg_restore](pg-dump-restore/)
