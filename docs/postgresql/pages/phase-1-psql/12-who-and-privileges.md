---
title: "\\conninfo, \\du and \\dp — who am I, what can I touch"
sidebar_label: "12 · Who and privileges"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **psql 18.4**. Script: `sandbox/pg-api/ex32-psql-io.sh`.

**"It works in psql but not from the app" is nearly always this page. You are connected as
a different role, to a different database, with different privileges — and three commands
tell you exactly which.**

## Who am I

```console
$ ./ex32-psql-io.sh
=== 12a. \conninfo and the identity functions ===
      Connection Information
      Parameter       |   Value
----------------------+-----------
 Database             | devbible
 Client User          | devbible
 Host                 | 127.0.0.1
 Server Port          | 55432
 Backend PID          | 1495
 SSL Connection       | false
 Superuser            | on

 current_user | session_user | current_database | current_schema | inet_server_port
--------------+--------------+------------------+----------------+------------------
 devbible     | devbible     | devbible         | public         |             5432
```

**`Superuser | on` is the field that explains most "works here, not there" reports.** A
superuser bypasses every privilege check, so testing permissions from a superuser session
proves nothing about what your application role can do.

Two subtleties in that output:

- **`current_user` vs `session_user`.** `session_user` is who authenticated;
  `current_user` is who you are acting as *right now*, which differs after `SET ROLE` or
  inside a `SECURITY DEFINER` function. Privilege checks use `current_user`.
- **`inet_server_port` says 5432 while `\conninfo` says 55432.** Both are right:
  55432 is the published host port, 5432 is the port the server itself listens on inside
  the container. `\conninfo` reports the client's view, `inet_server_port()` the server's.

## `\du` — the roles

```console
=== 12b. \du — roles and their attributes ===
                             List of roles
 Role name |                         Attributes
-----------+------------------------------------------------------------
 devbible  | Superuser, Create role, Create DB, Replication, Bypass RLS
```

Attributes are role-level powers: `Superuser`, `Create DB`, `Create role`, `Replication`,
`Bypass RLS`, `Cannot login` (a group role rather than a user). `\du+` adds the
description and the list of member roles.

**In PostgreSQL there is no distinction between a "user" and a "group"** — both are roles;
one simply has `LOGIN`. Membership is how permissions are grouped:

```sql
CREATE ROLE app_read;                      -- a group role, no LOGIN
GRANT SELECT ON ALL TABLES IN SCHEMA public TO app_read;
CREATE ROLE reporting LOGIN PASSWORD '…';
GRANT app_read TO reporting;               -- reporting inherits app_read's rights
```

## `\dp` — the table privileges

```console
=== 12d. \dp / \z — who has what on which table ===
                                   Access privileges
 Schema |   Name    | Type  |     Access privileges      | Column privileges | Policies
--------+-----------+-------+----------------------------+-------------------+----------
 public | p1_import | table | devbible=arwdDxtm/devbible+|                   |
        |           |       | p1_reader=r/devbible       |                   |
```

The notation is `grantee=privileges/grantor`:

| Letter | Privilege |
|---|---|
| `r` | SELECT (**r**ead) |
| `w` | UPDATE (**w**rite) |
| `a` | INSERT (**a**ppend) |
| `d` | DELETE |
| `D` | TRUNCATE |
| `x` | REFERENCES |
| `t` | TRIGGER |
| `m` | MAINTAIN (PostgreSQL 17+ — VACUUM, ANALYZE, REINDEX) |

So `p1_reader=r/devbible` reads as "`p1_reader` has SELECT, granted by `devbible`", and
`devbible=arwdDxtm/devbible` is the owner with everything. **An empty `Access privileges`
column means no grants have ever been made** — the owner still has everything implicitly.

`\dp` and `\z` are the same command.

## What a limited role actually experiences

```console
=== 12e. what the limited role can and cannot do ===
3
ERROR:  permission denied for table p1_import
ERROR:  permission denied for table p1_orders
```

The same role: `SELECT` on `p1_import` succeeded (3 rows), `DELETE` on it was refused, and
`SELECT` on a table it was never granted was refused. That is the shape of every
permission bug — and reproducing it takes one command:

```bash
psql -h 127.0.0.1 -p 55432 -U app_role -d devbible -c 'SELECT * FROM some_table'
```

**Test as the application's role, not as yourself.** It is the only reliable way to find a
missing grant before the deploy does.

## The grants a new role actually needs

A common failure is granting table privileges and stopping there:

```sql
GRANT CONNECT ON DATABASE devbible TO app_role;     -- reach the database
GRANT USAGE ON SCHEMA public TO app_role;           -- see inside the schema  ← the forgotten one
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_role;   -- for identity/serial inserts

-- and for tables created later
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_role;
```

Two of these catch people repeatedly. **`USAGE ON SCHEMA`** — without it every table is
invisible however many table grants exist. And **`ALTER DEFAULT PRIVILEGES`** — `GRANT … ON
ALL TABLES` applies only to tables that exist at that moment, so the next migration's table
is unreadable until someone re-runs the grant.

Related pages: [roles and GRANT](../phase-13-ops/roles-grant/) and
[why the app role should not own the schema](../phase-13-ops/03-app-role-not-owner.md).

## Trade-off

**Working as a superuser is fast and hides every privilege problem until production.**
Developing against a role with production-like grants costs you occasional `permission
denied` errors during development — which is precisely the point, since each one is a bug
found early. Keep a superuser connection for administration and a second, restricted one
that matches the application, and do ordinary work in the restricted one.

## Gotchas

**Symptom:** A query works in psql and fails from the application
**Cause:** Your psql session is superuser; the app role is not
**Fix:** Check `Superuser` in `\conninfo`, then retest as the app role

**Symptom:** `permission denied for schema public` despite table grants
**Cause:** Missing `GRANT USAGE ON SCHEMA`
**Fix:** Grant schema usage first; table grants are inert without it

**Symptom:** A new table is unreadable although the role was granted "all tables"
**Cause:** `ON ALL TABLES` applies only to tables existing at grant time
**Fix:** `ALTER DEFAULT PRIVILEGES … GRANT … ON TABLES`

**Symptom:** `permission denied for sequence …` on insert
**Cause:** Identity/serial columns need `USAGE` on the sequence
**Fix:** `GRANT USAGE ON ALL SEQUENCES IN SCHEMA public`

**Symptom:** `\dp` shows an empty privileges column
**Cause:** No explicit grants have been made; the owner's implicit rights are not listed
**Fix:** Normal — the owner has everything regardless

**Symptom:** `current_user` and `session_user` differ unexpectedly
**Cause:** `SET ROLE`, or a `SECURITY DEFINER` function
**Fix:** Remember privilege checks use `current_user`

## Interview questions

**★ Why does a query work in psql but fail in the application?**
Usually a different role. `\conninfo` shows `Superuser: on` for your session; the app role
has real privilege checks. Also check the database and schema, which may differ too.

**★ What is the difference between `current_user` and `session_user`?**
`session_user` is the authenticated role; `current_user` is the effective one after
`SET ROLE` or inside a `SECURITY DEFINER` function. Privileges are checked against
`current_user`.

**★ How do you read `\dp` output?**
`grantee=privileges/grantor`. Measured: `p1_reader=r/devbible` means `p1_reader` has SELECT
granted by `devbible`. `r` read, `w` update, `a` insert, `d` delete, `D` truncate.

**★ Which grant is most often forgotten?**
`GRANT USAGE ON SCHEMA` — without it, table grants have no effect and every table appears
not to exist.

**★ Why do tables created later become unreadable to a granted role?**
`GRANT … ON ALL TABLES` is a one-time operation over existing tables. `ALTER DEFAULT
PRIVILEGES` is what covers future ones.

**Is there a difference between users and groups?**
No. Both are roles; a "user" is simply a role with `LOGIN`. Grouping is done by granting
one role to another.

**What is the fastest way to verify a role's permissions?**
Connect as it: `psql -U app_role -c 'SELECT …'`. Measured — SELECT succeeded, DELETE
returned `permission denied for table`.

---

← [\i and \ir](11-include-files.md) · Next → [.psqlrc and prompt](13-psqlrc.md)
