---
title: "Secrets"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex51-secrets.mjs`.

**"Never log the connection string" is the advice. The leaks that actually happen
are somewhere else** — the pool object a logger serialises, the `ALTER ROLE`
statement the server writes to its log in plaintext, and the bound parameters
everyone believes are safe from logging.

Each one below was caused for real and inspected.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Where secrets leak](01-where-secrets-leak.md)** | the pool object, `pg_stat_activity`, the server log, and why `pg`'s errors need no scrubbing |
| 02 | **[Storing and rotating](02-storing-and-rotating.md)** | the slash that breaks URL parsing, what to log instead, where the secret lives, short-lived credentials |

## Phase gate

You are done here when nothing in your service can serialise a credential into a
log, and you can rotate a database password without the plaintext reaching a log
file.

## Where this connects

- [Roles, GRANT and REVOKE](../roles-grant/) — the credential this page protects
  should be least-privileged in the first place; a leak of a `SELECT`-only role is
  a different incident from a leak of an owner.
- [pg_hba.conf](../05-pg-hba.md) decides which credentials are even accepted, and
  from where.
- [TLS to the database](../06-tls.md) protects the credential in flight; this page
  is about it at rest and in logs.
- [The pg driver](../../phase-7-pg-driver/) owns connection-string parsing and
  config precedence in detail.

---

← [Phase index](../README.md) · Start → [Where secrets leak](01-where-secrets-leak.md)
