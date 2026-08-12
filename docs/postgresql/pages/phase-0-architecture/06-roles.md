---
title: "Roles, users, and groups"
sidebar_label: "06 · Roles"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

**In PostgreSQL, “user” and “group” are both roles.** A role can login, own
objects, and be a member of other roles. The three English words are one catalog
concept wearing different habits.

## Why it exists

Access control needs principals: who connected, what they may create, what they
may `SELECT`. Roles are those principals — unified so group membership and login
users share one system.

## The vocabulary

| Word people say | PostgreSQL reality |
|---|---|
| **User** | A role with `LOGIN` |
| **Group** | A role usually *without* `LOGIN`, used for membership |
| **Role** | The real object (`CREATE ROLE`) |

```sql
CREATE ROLE app_login LOGIN PASSWORD '...';
CREATE ROLE app_read NOLOGIN;
GRANT app_read TO app_login;
```

## See it

```console
$ psql -h 127.0.0.1 -p 55432 -U devbible -d devbible -c '\du'
                             List of roles
 Role name |                         Attributes
-----------+------------------------------------------------------------
 devbible  | Superuser, Create role, Create DB, Replication, Bypass RLS
```

> Verified: 2026-08 on **PostgreSQL 18.4**. Container bootstrap user is a
> superuser — fine for local learning, **wrong** as the production app role
> (Phase 13).

## From Node

The role is whichever user is in the connection string. Node does not create a
second identity layer unless you `SET ROLE` (rare in app code).

```js
// whoami.mjs
import pg from 'pg';

const pool = new pg.Pool({
  connectionString:
    'postgresql://devbible:devbible@127.0.0.1:55432/devbible',
});

const {rows} = await pool.query(`
  select
    current_user,
    session_user,
    current_setting('is_superuser') as is_superuser
`);
console.log(rows[0]);
await pool.end();
```

```console
$ node whoami.mjs
{ current_user: 'devbible', session_user: 'devbible', is_superuser: 'on' }
```

## Trade-off

Superuser local bootstraps speed learning. Production apps should connect as a
**least-privilege** role that cannot drop the database or bypass RLS — cost is
more `GRANT` work up front (Phase 13 Master).

## Gotchas

**Symptom:** Migrations work; the app gets `permission denied for table`  
**Cause:** Objects owned by migrator role; app role never granted  
**Fix:** Consistent ownership + `GRANT` strategy (Phase 13)

**Symptom:** “I created a user but cannot log in”  
**Cause:** Role without `LOGIN`, or `pg_hba.conf` rejects the method  
**Fix:** `LOGIN` attribute + auth config (page 08)

## Interview questions

**★ Are users and roles different in PostgreSQL?**  
No. Users are roles with login privilege; groups are roles used for membership.

**★ What should a web app’s database role be able to do?**  
Only what the app needs (DML on app tables, maybe specific functions) — not
superuser, not arbitrary DDL in production traffic paths.

**What is `session_user` vs `current_user`?**  
`session_user` is who authenticated; `current_user` can change after `SET ROLE`.

---

← [WAL](05-wal.md) · Next → [Local install](07-local-install.md)
