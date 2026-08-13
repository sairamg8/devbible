---
title: "GRANT and REVOKE"
sidebar_label: "02 · GRANT and REVOKE"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex50-privileges.mjs`.

**A grant on a table is not enough to read the table.** You need `USAGE` on the
schema *and* the verb on the object, and the two failures look nearly identical.
This chunk causes every one of them for real.

## Schema `USAGE` comes first

```console
=== 3. USAGE on the schema is a separate grant from SELECT on the table ===
SELECT after GRANT SELECT, no schema USAGE           → 42501 permission denied for schema app
SELECT after GRANT USAGE ON SCHEMA                   → OK (1 rows)
```

`GRANT SELECT ON app.customers TO p13_app` succeeded, and the read still failed —
with **permission denied for schema app**, not *for table customers*. The schema
check happens first, and until it passes the table grant is unreachable.

Read the noun in the message. It is the fastest diagnosis in this whole area:

| Message | Missing |
|---|---|
| `permission denied for schema app` | `GRANT USAGE ON SCHEMA app` |
| `permission denied for table customers` | `GRANT <verb> ON app.customers` |
| `must be owner of table customers` | Not a grant at all — see ownership below |

## One verb at a time

```console
=== 4. the grants an app actually needs, one verb at a time ===
INSERT (only SELECT granted)                         → 42501 permission denied for table customers
INSERT after GRANT INSERT                            → OK
UPDATE after GRANT UPDATE                            → OK
DELETE after GRANT DELETE                            → OK
TRUNCATE (not covered by DELETE)                     → 42501 permission denied for table orders
```

The verbs are independent. The one that catches people is the last: **`DELETE`
does not imply `TRUNCATE`.** They are separate privileges because they are
different operations — `DELETE` is MVCC-visible row removal that can be rolled
back and leaves dead tuples for `VACUUM`; `TRUNCATE` takes an
`ACCESS EXCLUSIVE` lock and discards the whole file.

For an application role, *not* granting `TRUNCATE` is the right default. An app
that legitimately empties a table can `DELETE`, and the missing privilege turns a
catastrophic injected `TRUNCATE` into a `42501`.

The full table-level set is `SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
REFERENCES, TRIGGER, MAINTAIN`. `MAINTAIN` (PostgreSQL 17+) covers `VACUUM`,
`ANALYZE`, `REINDEX`, `CLUSTER` and `REFRESH MATERIALIZED VIEW` without
ownership — before it, those needed the owner, which is why so many maintenance
scripts historically ran as superuser.

**And it fails in a way no other privilege does:**

```console
=== 17. MAINTAIN (PG17+) and the default EXECUTE grant on functions ===
GRANT MAINTAIN                                       → OK (privilege exists on 18.4)
VACUUM app.m_probe with MAINTAIN granted             → OK
VACUUM after REVOKE MAINTAIN                         → OK
                                                      ↳ WARNING: permission denied to vacuum "m_probe", skipping it
{ after_revoke: false }
```

`VACUUM` without `MAINTAIN` **returns success**. It emits a `WARNING` and skips
the table. `has_table_privilege` confirms the privilege is genuinely gone, and
the statement still reports OK — `ANALYZE` behaves the same way.

That matters for anything automated. A nightly maintenance job that lost its
grant does not fail, alert, or exit non-zero; it reports success and vacuums
nothing, and you find out when the table is bloated. `pg` surfaces the warning
only if you attach a listener:

```js
client.on('notice', (n) => log.warn({severity: n.severity}, n.message));
```

Without that listener the warning is discarded by the driver. Check
`pg_stat_user_tables.last_vacuum` to confirm a vacuum actually happened rather
than trusting the exit status — see [Monitoring views](../09-monitoring.md).

## Identity columns need no sequence grant

```console
=== 5. identity columns need USAGE on the sequence — or do they? ===
[ { relname: 'orders_id_seq', relkind: 'S' }, { relname: 'customers_id_seq', relkind: 'S' } ]
INSERT into GENERATED ALWAYS AS IDENTITY             → OK
↑ identity sequences are owned by the column: no separate GRANT USAGE needed.
  A serial/nextval() DEFAULT is the case that DOES need GRANT USAGE ON SEQUENCE.
```

The sequences exist — they are ordinary `relkind = 'S'` objects — but an
`INSERT` by a role holding only `INSERT` on the table worked. An identity
sequence is *owned by the column*, and the privilege check follows the column.

A `serial` column is the opposite: its `DEFAULT nextval('t_id_seq')` is an
ordinary function call on an ordinary sequence, and it needs
`GRANT USAGE ON SEQUENCE t_id_seq`. This is the practical argument for
`GENERATED … AS IDENTITY` over `serial` on top of the standards argument — one
fewer grant to forget, and one fewer `42501` in a code path that only runs on
insert.


## Trade-off

Granting verb by verb means a new code path can fail at runtime with `42501` —
the `TRUNCATE` you never granted, the sequence you forgot — instead of at deploy
time. The cost is real and it is paid in incident minutes.

What you buy is that the destructive verbs are simply unavailable to the role
your connection string uses. An injected `TRUNCATE` or a mistaken maintenance
script is a denied statement rather than an outage. Grant `SELECT, INSERT,
UPDATE, DELETE` and stop; add anything else only when a failure proves you need
it.

## Gotchas

**Symptom:** `42501 permission denied for schema app`, and you already granted
`SELECT` on the table
**Cause:** Schema `USAGE` is a separate grant and is checked first.
**Fix:** `GRANT USAGE ON SCHEMA app TO role`. Read the noun in the error message
— schema or table — before adding grants at random.

**Symptom:** `TRUNCATE` denied for a role that can `DELETE`
**Cause:** They are separate privileges — different operation, different lock.
**Fix:** Grant `TRUNCATE` deliberately, or leave it ungranted, which is the
better default for an application role.

**Symptom:** `42501` on `INSERT` into a `serial` column, but the identity column
next to it works
**Cause:** A `serial` default calls `nextval()` on a sequence that needs its own
`USAGE` grant; an identity sequence is owned by the column and needs none.
**Fix:** `GRANT USAGE ON SEQUENCE …`, or migrate the column to
`GENERATED … AS IDENTITY`.

**Symptom:** A nightly `VACUUM`/`ANALYZE` job reports success but the table keeps
bloating
**Cause:** The role lost `MAINTAIN`. Measured: `VACUUM` returned OK and emitted
only `WARNING: permission denied to vacuum "m_probe", skipping it`.
**Fix:** Listen for notices in the driver (`client.on('notice', …)`) and check
`pg_stat_user_tables.last_vacuum` rather than the exit status.

## Interview questions

**★ You granted `SELECT` on a table and the read still fails. What is missing?**
`USAGE` on the schema. It is checked first and reports *permission denied for
schema*, not for the table — reading the noun in the message is the whole
diagnosis.

**★ Why is `TRUNCATE` a separate privilege from `DELETE`?**
Different operation: `ACCESS EXCLUSIVE` lock and file discard, against MVCC row
removal that can be rolled back. Withholding it from the application role turns
an injected `TRUNCATE` into a `42501`.

**★ What happens when a role runs `VACUUM` without `MAINTAIN`?**
It succeeds and does nothing. Measured on 18.4: the statement returned OK with
`WARNING: permission denied to vacuum … skipping it`, while
`has_table_privilege` reported the privilege gone. Automated maintenance can
therefore fail silently for months.

**Why does an identity column need no sequence grant when `serial` does?**
An identity sequence is owned by the column, so the privilege check follows the
column. A `serial` default is an ordinary `nextval()` call on an ordinary
sequence and needs `GRANT USAGE ON SEQUENCE`.

**What is `MAINTAIN` for?**
PostgreSQL 17 added it so `VACUUM`, `ANALYZE`, `REINDEX`, `CLUSTER` and `REFRESH
MATERIALIZED VIEW` can be delegated without ownership — previously those needed
the table owner, which is why so many maintenance jobs historically ran as
superuser.

---

← [Roles and membership](01-roles-and-membership.md) · Next → [Columns, reads and ownership](03-columns-and-ownership.md)
