---
title: "Roles, GRANT and REVOKE"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex50-privileges.mjs`.

**Least privilege is not a policy you write down — it is a set of `GRANT`
statements, and the default state of a new role is that almost nothing works.**
Every denial on these pages is a live `42501` produced by connecting *as* the
role and running the statement.

The whole model in one sentence: a **role** is an identity, a **privilege** is a
verb that role holds on one object, **ownership** is a separate thing that
outranks both, and a role's effective privileges are the **union** over every
role it inherits.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Roles and membership](01-roles-and-membership.md)** | one object type for users and groups; attributes, `INHERIT`, `SET ROLE`, dropping a role that owns things |
| 02 | **[GRANT and REVOKE](02-grant-and-revoke.md)** | schema `USAGE` before table verbs, why `TRUNCATE` is separate, and the `VACUUM` that succeeds without doing anything |
| 03 | **[Columns, reads and ownership](03-columns-and-ownership.md)** | column grants only widen, the `UPDATE` that needs `SELECT`, and what `REVOKE` cannot take from an owner |
| 04 | **[Defaults and auditing](04-defaults-and-auditing.md)** | `ON ALL TABLES` vs `ALTER DEFAULT PRIVILEGES`, reading an ACL string, and the grant set an app actually needs |

## Phase gate

You are done with this topic when you can create an application role from scratch
that can run your app's queries and **cannot** drop a table, and when you can read
`relacl` without looking anything up.

## Where this connects

- [App role should not own the schema](../03-app-role-not-owner.md) is the direct
  consequence of the ownership rule in chunk 02.
- [Row-level security](../14-rls.md) filters *rows*; grants control *tables and
  columns*. RLS is only consulted after the grant check passes.
- [pg_hba.conf](../05-pg-hba.md) decides who may connect at all — it runs before
  any privilege here is considered.
- [Schema from Node](../../phase-8-schema-from-node/) creates the objects whose
  ownership this topic governs; the migration role there is the owner role here.

---

← [Phase index](../README.md) · Start → [Roles and membership](01-roles-and-membership.md)
