---
title: "Roles and membership"
sidebar_label: "01 · Roles and membership"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex50-privileges.mjs`.

**There is no user type in PostgreSQL. There is one object — a role — and
`LOGIN` is an attribute of it.** `CREATE USER` is an alias that adds `LOGIN`;
everything else about the two is identical, including that either can be granted
to the other.

## One object type, four roles

The sandbox creates the shape a real application uses: a role that owns the
schema, a role the application logs in as, a group role holding read access, and
a human analyst who is a member of that group.

```sql
CREATE ROLE p13_owner   LOGIN PASSWORD 'pw';   -- owns the tables, runs migrations
CREATE ROLE p13_app     LOGIN PASSWORD 'pw';   -- what the connection string uses
CREATE ROLE p13_analyst LOGIN PASSWORD 'pw';   -- a person
CREATE ROLE p13_ro      NOLOGIN;               -- a group: no password, no login
CREATE SCHEMA app AUTHORIZATION p13_owner;
```

```console
$ node ex50-privileges.mjs
=== 1. role attributes — what a role IS before any GRANT ===
[
  { rolname: 'p13_analyst', super: false, inherit: true,  login: true,  createdb: false, connlimit: -1 },
  { rolname: 'p13_app',     super: false, inherit: true,  login: true,  createdb: false, connlimit: -1 },
  { rolname: 'p13_noinh',   super: false, inherit: false, login: true,  createdb: false, connlimit: -1 },
  { rolname: 'p13_owner',   super: false, inherit: true,  login: true,  createdb: false, connlimit: -1 },
  { rolname: 'p13_ro',      super: false, inherit: true,  login: false, createdb: false, connlimit: -1 }
]
↑ CREATE ROLE ... LOGIN is what CREATE USER expands to; there is one object type
```

The only difference between "the group" and "the user" in that list is
`login: false`. A group role is just a role nobody logs in as — which is why the
same `GRANT` syntax grants a table to a person and a role to a role.

**Roles are cluster-wide, not per-database.** They live in `pg_authid`, shared by
every database in the cluster. Privileges are per-object and therefore
per-database; the role itself is not. This is the first surprise when you restore
a dump into a different cluster — the grants are in the dump, the roles are not
(unless you used `pg_dumpall --roles-only`).

## A new role can connect and see nothing

```console
=== 2. a brand-new role can connect but sees nothing ===
SELECT 1 (connect at all)                            → OK (1 rows)
SELECT from app.customers                            → 42501 permission denied for schema app
↑ CONNECT on the database is granted to PUBLIC by default — the table is not
```

Two separate facts, and both matter:

- **Connecting worked with no grant at all.** `CONNECT` on a database is granted
  to `PUBLIC` when the database is created. If you want a role that cannot reach
  a database, you must `REVOKE CONNECT ON DATABASE x FROM PUBLIC` first — nothing
  is closed by default at that level.
- **The read failed before it ever reached the table**, with *permission denied
  for schema*. Schema access and table access are two independent grants, in that
  order. Chunk 02 takes that apart.

## Membership, `INHERIT`, and `SET ROLE`

`GRANT p13_ro TO p13_analyst` makes the analyst a member of the group. What that
membership *does* depends on the member's `INHERIT` attribute — measured with a
second role created `NOINHERIT`:

```console
=== 13. INHERIT vs NOINHERIT, and SET ROLE ===
NOINHERIT member of p13_ro: SELECT app.orders        → 42501 permission denied for schema app
same, after SET ROLE p13_ro                          → OK (1 rows)
[
  { member: 'p13_analyst', granted_role: 'p13_ro', admin_option: false, inherit_option: true  },
  { member: 'p13_noinh',   granted_role: 'p13_ro', admin_option: false, inherit_option: false }
]
```

With `INHERIT` (the default) a member automatically holds everything the group
holds — no action needed. With `NOINHERIT` the membership is *available* but not
*active*: the role must run `SET ROLE p13_ro` to use it, and the same statement
then succeeds.

`inherit_option` is per-grant, from PostgreSQL 16 onward: `GRANT g TO r WITH
INHERIT FALSE` sets it for that one membership regardless of the role's own
attribute. Read it from `pg_auth_members`, as above — the role's `rolinherit` is
only the default for new grants.

**`SET ROLE` is not `SET SESSION AUTHORIZATION`.** `SET ROLE` switches the
*current* role for privilege checks and can be reversed with `RESET ROLE`;
`SET SESSION AUTHORIZATION` changes the session's own identity and needs
superuser. Both persist for the rest of the session — which, on a pooled
connection, means the *next* request inherits it. That leak is measured in
[Phase 11](../../phase-11-mvcc/); the fix is `RESET ROLE` or `DISCARD ALL` before
release.

`NOINHERIT` for humans is worth the friction: an admin who must type `SET ROLE`
before doing damage cannot do it by accident. `NOINHERIT` for an application role
is not — the app would have to issue `SET ROLE` on every pooled connection.

## Attributes are not privileges

`CONNECTION LIMIT` and `VALID UNTIL` belong to the role itself, not to any
object, and they fail *before* any grant is consulted:

```console
=== 14. CONNECTION LIMIT and VALID UNTIL are role attributes, not grants ===
second connection with CONNECTION LIMIT 1            → 53300 too many connections for role "p13_analyst"
login after VALID UNTIL 2020-01-01                   → 28P01 password authentication failed for user "p13_analyst"
login after VALID UNTIL infinity                     → OK (1 rows)
```

Both error codes are worth memorising because neither says what it means:

- **`53300 too many connections for role`** — not the server being full, one role
  over its own limit. `ALTER ROLE r CONNECTION LIMIT n` is the cheapest way to
  stop one runaway service starving every other client of connections. `-1` is
  unlimited, which is the default.
- **`28P01 password authentication failed`** — an *expired* role reports exactly
  what a wrong password reports. There is no "your account has expired" message.
  When a service that has worked for a year suddenly cannot authenticate and the
  password is definitely right, check `rolvaliduntil` before anything else.

`VALID UNTIL` applies to the **password**, not the role: it stops password
authentication and has no effect on `trust`, `peer` or certificate auth. A role
that authenticates by client certificate keeps working past its `VALID UNTIL`.

## What the server stores for a password

```console
=== 16. password encryption and what the server stores ===
{ password_encryption: 'scram-sha-256' }
{ rolname: 'p13_app', stored: 'SCRAM-SHA-256$...' }
```

Since PostgreSQL 14 the default is `scram-sha-256`, and what lands in
`pg_authid.rolpassword` is a verifier — salt, iteration count and two derived
keys — not the password and not something reversible into it. `md5` still exists
and should not be used; it is a plain unsalted hash of the password and username.

**The statement text is the exposure, not the storage.** `CREATE ROLE … PASSWORD
'pw'` contains the plaintext, so it lands in `log_statement` output, in
`pg_stat_activity.query` while it runs, and in shell history. `psql`'s
`\password` computes the verifier client-side and sends only that — use it. From
an application, hash it yourself or use a provider API rather than sending a
plaintext `ALTER ROLE`.

## Dropping a role

```console
=== 15. dropping a role that owns or is granted things ===
DROP ROLE p13_owner (owns tables)                    → 2BP01 role "p13_owner" cannot be dropped because some objects depend on it
{ the_three_steps: 'REASSIGN OWNED BY p13_owner TO devbible; DROP OWNED BY p13_owner; DROP ROLE p13_owner;' }
```

A role cannot be dropped while it owns an object or holds a grant anywhere, and
the error does not tell you *which* object. The sequence that always works:

```sql
REASSIGN OWNED BY p13_owner TO new_owner;  -- moves ownership of everything it owns
DROP OWNED BY p13_owner;                   -- drops the grants it still holds
DROP ROLE p13_owner;
```

`DROP OWNED BY` after a `REASSIGN` drops privileges, not tables — the tables now
belong to `new_owner`. Run it in the wrong order and it drops the objects
themselves. Both commands are **per database**: run them in every database of the
cluster before the `DROP ROLE`, which is cluster-wide.

## Trade-off

Separate roles cost you a bootstrap step in every environment and a migration
that must run as a different connection string than the app uses. What you buy is
that the blast radius of a leaked application credential is bounded by a grant
list you can read in one query — instead of being "everything", which is what a
single superuser connection string means.

The version that is *not* worth it is one role per developer with hand-maintained
grants. Grant to group roles, put people in groups, and keep the number of ACL
entries per table small enough to read.

## Gotchas

**Symptom:** `28P01 password authentication failed` for a service whose password
is definitely correct
**Cause:** The role's `VALID UNTIL` has passed. Expiry and a wrong password are
reported identically.
**Fix:** `SELECT rolvaliduntil FROM pg_roles WHERE rolname = '…'`, then
`ALTER ROLE … VALID UNTIL 'infinity'` or a new date.

**Symptom:** `53300 too many connections for role`
**Cause:** That role's `CONNECTION LIMIT`, not the server's `max_connections`.
**Fix:** Raise the role limit, or size the pool below it. Check
`rolconnlimit` in `pg_roles`.

**Symptom:** `2BP01 role … cannot be dropped because some objects depend on it`
**Cause:** The role owns objects or holds grants somewhere in this database.
**Fix:** `REASSIGN OWNED BY` then `DROP OWNED BY`, in that order, in every
database, then `DROP ROLE`.

**Symptom:** Restoring a dump into a new cluster fails with "role does not exist"
**Cause:** Roles are cluster-wide and are not in a `pg_dump` of one database.
**Fix:** `pg_dumpall --roles-only` alongside the dump, or create the roles first.

**Symptom:** A member of a group role gets `42501` anyway
**Cause:** The member is `NOINHERIT`, or the grant carried `WITH INHERIT FALSE`.
**Fix:** `SET ROLE thegroup` first, or check `inherit_option` in
`pg_auth_members` — the role's own `rolinherit` is only the default.

**Symptom:** A pooled connection behaves as the wrong role
**Cause:** A `SET ROLE` from an earlier request survived `release()`.
**Fix:** `RESET ROLE` or `DISCARD ALL` before returning the client to the pool.

## Interview questions

**★ What is the difference between a user and a group in PostgreSQL?**
Nothing structural — both are roles. `CREATE USER` is `CREATE ROLE … LOGIN`.
Measured: the group role in the sandbox differs from the login roles only by
`login: false`. That is also why a role can be granted to a role.

**★ A role is a member of a group but still gets `42501`. Why?**
`NOINHERIT`, or a membership granted `WITH INHERIT FALSE`. Membership is then
available but inactive until `SET ROLE`. Measured: the same `SELECT` that failed
with `42501` succeeded immediately after `SET ROLE p13_ro`.

**★ Where are roles stored, and what does that mean for backups?**
Cluster-wide in `pg_authid`, shared across every database, so a `pg_dump` of one
database contains the grants but not the roles. Restoring into a fresh cluster
needs `pg_dumpall --roles-only` first.

**A service that worked for a year cannot authenticate. What do you check first?**
`rolvaliduntil`. An expired password reports `28P01 password authentication
failed` — identical to a wrong password, with no hint that expiry is the cause.

**Why can't you just `DROP ROLE` an old employee's role?**
It fails with `2BP01` while the role owns any object or holds any grant.
`REASSIGN OWNED BY` moves ownership, `DROP OWNED BY` then removes the remaining
privileges, and both are per-database while `DROP ROLE` is cluster-wide.

**What does PostgreSQL actually store when you set a password?**
A `scram-sha-256` verifier — salt, iteration count and derived keys — not the
password. The real exposure is the statement text: `CREATE ROLE … PASSWORD 'pw'`
reaches the log and `pg_stat_activity`. `\password` avoids that by computing the
verifier client-side.

---

← [Topic index](README.md) · Next → [GRANT and REVOKE](02-grant-and-revoke.md)
