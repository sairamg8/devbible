---
title: "Defaults and auditing"
sidebar_label: "04 · Defaults and auditing"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex50-privileges.mjs`.

**The grant that breaks in production is the one on the table you added last
week.** `GRANT … ON ALL TABLES` is a loop over the tables that exist at that
instant, not a rule. This chunk covers the rule that does apply to future
objects, how to read what is actually granted, and the working recipe.

## `ON ALL TABLES` is a snapshot

```console
=== 7. ON ALL TABLES covers only the tables that exist NOW ===
SELECT app.orders via group p13_ro                   → OK (1 rows)
SELECT a table created AFTER the grant                → 42501 permission denied for table invoices
```

`GRANT SELECT ON ALL TABLES IN SCHEMA app TO p13_ro` ran, then the owner created
one more table, and the group could not read it. The grant expanded to the table
list at execution time and stored one ACL entry per table — there is nothing left
behind that a later `CREATE TABLE` consults.

This is the single most common cause of "the read-only user works everywhere
except the new feature's table", and of a reporting role that silently misses
data rather than failing loudly.

## `ALTER DEFAULT PRIVILEGES` is the rule

```console
=== 8. ALTER DEFAULT PRIVILEGES fixes it — for future tables only ===
table created after ALTER DEFAULT PRIVILEGES          → OK (1 rows)
app.invoices (created before it) still                → 42501 permission denied for table invoices
[ { for_role: 'p13_owner', schema: 'app', objtype: 'r', acl: '{p13_ro=r/p13_owner}' } ]
↑ FOR ROLE matters: defaults are recorded per creating role, not per schema
```

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE p13_owner IN SCHEMA app
  GRANT SELECT ON TABLES TO p13_ro;
```

The table created afterwards was readable with no further grant. The one created
*before* still was not — defaults are not retroactive. **You need both
statements**, and this is the part people get wrong: `ON ALL TABLES` for what
exists, `ALTER DEFAULT PRIVILEGES` for what comes next.

**`FOR ROLE` is the trap.** The stored rule is keyed on the *creating* role, as
`pg_default_acl.defaclrole` shows. A default set `FOR ROLE p13_owner` does
nothing for a table created by anyone else. Omit `FOR ROLE` and it silently
defaults to the role running the statement — so a DBA setting it up as `postgres`
records a rule for `postgres`, and the migration role's tables keep arriving
ungranted. Always name the role your migrations actually run as, and check:

```sql
SELECT pg_get_userbyid(defaclrole) AS for_role, n.nspname, defaclobjtype, defaclacl
  FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace;
```

`defaclobjtype` is `r` tables, `S` sequences, `f` functions, `T` types, `n`
schemas. Each needs its own statement — `ON TABLES` does not cover sequences.

## Reading an ACL

```console
=== 9. reading the ACL — what \dp actually shows ===
[
  { relname: 'customers', relacl: '{p13_owner=arwdDxtm/p13_owner,p13_app=arwd/p13_owner,p13_ro=r/p13_owner}' },
  { relname: 'invoices',  relacl: null },
  { relname: 'orders',    relacl: '{p13_owner=arwdDxtm/p13_owner,p13_ro=r/p13_owner}' },
  { relname: 'receipts',  relacl: '{p13_owner=arwdDxtm/p13_owner,p13_ro=r/p13_owner}' }
]
  grantee=verbs/grantor · r=SELECT w=UPDATE a=INSERT d=DELETE D=TRUNCATE x=REFERENCES t=TRIGGER
{ app_select: true, app_truncate: false, analyst_ssn: true }
```

The format is `grantee=privileges/grantor`, and the letters are worth learning
because `\dp` in `psql` prints exactly this:

| Letter | Privilege | | Letter | Privilege |
|---|---|---|---|---|
| `r` | SELECT (**r**ead) | | `D` | TRUNCATE |
| `w` | UPDATE (**w**rite) | | `x` | REFERENCES |
| `a` | INSERT (**a**ppend) | | `t` | TRIGGER |
| `d` | DELETE | | `m` | MAINTAIN |

So `p13_app=arwd/p13_owner` is INSERT, SELECT, UPDATE, DELETE granted by the
owner — the application set, with no `D` for TRUNCATE. The owner's own
`arwdDxtm` is every privilege, printed for readability.

Two things in that output are easy to misread:

- **`relacl: null` does not mean "no access".** It means *no ACL has ever been
  set*, so the built-in default applies — owner-only for a table, but `EXECUTE`
  to `PUBLIC` for a function. An empty ACL column is not evidence of a locked-down
  object.
- **An empty grantee** — an entry beginning `=`, as in the `public` schema's
  `=U/pg_database_owner` — means `PUBLIC`. That is how you spot a
  granted-to-everyone privilege while skimming.

For a direct answer, ask the server rather than parsing the string:

```sql
SELECT has_table_privilege('p13_app', 'app.customers', 'SELECT');
SELECT has_column_privilege('p13_analyst', 'app.customers', 'ssn', 'SELECT');
SELECT has_schema_privilege('p13_app', 'app', 'USAGE');
```

These functions resolve group membership and inheritance, which is exactly what
reading `relacl` by eye does not. Use them in a test that asserts your app role
*cannot* do the things it should not — the only form of privilege audit that
keeps working as the schema grows.

## The `public` schema changed in PostgreSQL 15

```console
=== 12. the public schema in PostgreSQL 15+ ===
CREATE TABLE public.t (PG15+ default)                → 42501 permission denied for schema public
{ nspname: 'public', nspacl: '{pg_database_owner=UC/pg_database_owner,=U/pg_database_owner}' }
```

Read the ACL with the rule above: `pg_database_owner` has `U`SAGE and `C`REATE,
and the empty grantee — `PUBLIC` — has `U`SAGE only. Before PostgreSQL 15,
`PUBLIC` had `CREATE` there too, meaning any role could create objects in
`public` on any database.

That is the concrete "it worked before we upgraded" break: an application that
created temp reporting tables in `public` as a non-owner starts failing with
`42501 permission denied for schema public` after an upgrade to 15+. The fix is a
deliberate `GRANT CREATE ON SCHEMA public TO role` — or better, give the app its
own schema, as this whole topic's sandbox does.

Also note `pg_database_owner`: a role that is not a real role but resolves to
whoever owns the current database, so a restored dump ends up owned correctly
without rewriting grants.

## The working recipe

Everything above, as the four statements you actually run for a new service:

```sql
-- 1. the roles: one owner for migrations, one login for the app
CREATE ROLE shop_owner LOGIN PASSWORD :'owner_pw';
CREATE ROLE shop_app   LOGIN PASSWORD :'app_pw';
CREATE SCHEMA shop AUTHORIZATION shop_owner;

-- 2. close the defaults you do not want
REVOKE CREATE ON SCHEMA public FROM PUBLIC;      -- no-op on PG15+, harmless
REVOKE ALL ON DATABASE shopdb FROM PUBLIC;
GRANT CONNECT ON DATABASE shopdb TO shop_app;

-- 3. what the app may do — note: no TRUNCATE, no DDL
GRANT USAGE ON SCHEMA shop TO shop_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA shop TO shop_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA shop TO shop_app;   -- only if any serial

-- 4. and the same for every table the migrations create from now on
ALTER DEFAULT PRIVILEGES FOR ROLE shop_owner IN SCHEMA shop
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO shop_app;
ALTER DEFAULT PRIVILEGES FOR ROLE shop_owner IN SCHEMA shop
  GRANT USAGE ON SEQUENCES TO shop_app;
```

Step 4 is the one that gets skipped, and the failure only appears at the next
migration. Put both `ALTER DEFAULT PRIVILEGES` statements in migration `0001` so
they are part of the schema's history rather than something done once by hand on
a laptop.

## From Node

The application connects as `shop_app`; the migration runner connects as
`shop_owner` with a different connection string. That is the entire operational
difference, and it is worth asserting rather than assuming:

```js
import pg from 'pg';

const pool = new pg.Pool({connectionString: process.env.DATABASE_URL});

// Fail at boot, not at 3am: prove the app role is the one we think it is.
export async function assertLeastPrivilege() {
  const {rows: [p]} = await pool.query(`
    SELECT current_user,
           has_table_privilege('shop.orders', 'SELECT')   AS can_read,
           has_table_privilege('shop.orders', 'TRUNCATE') AS can_truncate,
           has_schema_privilege('shop', 'CREATE')         AS can_create,
           (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS is_super`);

  if (!p.can_read) throw new Error(`${p.current_user} cannot read shop.orders`);
  if (p.can_truncate || p.can_create || p.is_super)
    throw new Error(`${p.current_user} has more privilege than the app needs: ` +
                    JSON.stringify(p));
  return p;
}
```

A misconfigured environment that hands the app a superuser connection string
looks completely healthy until it does something irreversible. This check turns
that into a failed deploy.

## Trade-off

Default privileges make new tables work automatically — and that is also their
cost: a table created by the migration role is readable by the reporting group
before anyone decides it should be. A schema holding one sensitive table
inherits the rule along with everything else, and nothing warns you.

If that matters, keep sensitive tables in their own schema with no defaults
attached, and grant them one at a time. For everything else the automatic grant
is worth far more than the review it skips — the alternative is a reporting role
that quietly stops seeing new data.

## Gotchas

**Symptom:** A read-only role works on every table except recently added ones
**Cause:** `GRANT … ON ALL TABLES` applied only to the tables existing when it
ran. Measured: a table created seconds later was `42501`.
**Fix:** `ALTER DEFAULT PRIVILEGES … GRANT … ON TABLES`, plus a one-time
`ON ALL TABLES` for the existing ones. You need both.

**Symptom:** `ALTER DEFAULT PRIVILEGES` was run and new tables *still* arrive
ungranted
**Cause:** The rule is keyed on the creating role. Set without `FOR ROLE` it
records the role that ran it, which is usually not the migration role.
**Fix:** `FOR ROLE <migration_role>`, and verify in `pg_default_acl` — the
`for_role` column must match whoever runs `CREATE TABLE`.

**Symptom:** Sequences still raise `42501` although default privileges are set
**Cause:** `ON TABLES` does not cover sequences.
**Fix:** A second statement with `GRANT USAGE ON SEQUENCES`. Same for
`ON FUNCTIONS` and `ON TYPES`.

**Symptom:** `relacl` is empty and you conclude the object is locked down
**Cause:** `NULL` means "no ACL set, built-in default applies" — owner-only for a
table, but `EXECUTE` to `PUBLIC` for a function.
**Fix:** Use `has_*_privilege()` for the real answer; it also resolves group
membership, which reading the string does not.

**Symptom:** After upgrading to PostgreSQL 15+, an app cannot create tables in
`public`
**Cause:** `PUBLIC` lost `CREATE` on the `public` schema in 15. Measured:
`nspacl` shows `=U/pg_database_owner` — usage only.
**Fix:** Grant `CREATE` deliberately, or move the app to its own schema.

## Interview questions

**★ What is the difference between `GRANT ON ALL TABLES` and `ALTER DEFAULT
PRIVILEGES`?**
`ON ALL TABLES` expands to the tables that exist at that moment and stores one
ACL entry each; it has no effect on future tables. `ALTER DEFAULT PRIVILEGES`
stores a rule applied when new objects are created, and is not retroactive.
Measured both ways in one run — you need both statements.

**★ `ALTER DEFAULT PRIVILEGES` is set and new tables are still inaccessible. Why?**
The rule is recorded per *creating* role. Without `FOR ROLE` it takes the role
that ran the statement, so a rule set up by an admin does nothing for tables the
migration role creates. Check `pg_default_acl.defaclrole`.

**★ How do you read `p13_app=arwd/p13_owner`?**
`grantee=privileges/grantor`: INSERT, SELECT, UPDATE, DELETE granted to `p13_app`
by `p13_owner`. No `D`, so no TRUNCATE. An entry starting with `=` is a grant to
`PUBLIC`.

**★ Why can't a role create tables in `public` any more?**
PostgreSQL 15 removed `CREATE` on the `public` schema from `PUBLIC`; only
`USAGE` remains. Applications relying on the old behaviour break on upgrade with
`42501 permission denied for schema public`.

**How would you audit that an application role is least-privileged?**
Assert it, don't inspect it: `has_table_privilege`/`has_schema_privilege` at boot
or in a test, checking both that the required verbs are present and that
`TRUNCATE`, schema `CREATE` and `rolsuper` are absent. Those functions resolve
inheritance, which reading `relacl` by eye does not.

---

← [Columns, reads and ownership](03-columns-and-ownership.md) · Next → [Secrets](../secrets/)
