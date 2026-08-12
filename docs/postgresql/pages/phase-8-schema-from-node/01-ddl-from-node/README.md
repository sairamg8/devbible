---
title: "Creating tables from Node"
sidebar_label: "Overview"
sidebar_position: 0
---

# Creating tables from Node

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex1-ddl-from-node.mjs`,
> `ex2-ddl-edges.mjs`, `ex3-advisory-fix.mjs`, `ex7-ddl-locks.mjs`.

**`pg` will happily run `CREATE TABLE` for you. The question is never *can it* —
it is *when*, and the answer is: from a migration you can replay, never from a
request handler and never from application startup.**

This topic is chunked into three chapters. Read them in order: the mechanics of
getting DDL through the driver, then what those statements do to a table under
read load, then what happens when several processes try at once.

| # | Chunk | What it covers |
|---|---|---|
| 01 | **[Issuing DDL through the driver](01-issuing-ddl.md)** | What `query()` returns for DDL, why identifiers cannot be parameters, transactional DDL and rollback, the protocol switch that changes how many statements you may send, whether `ADD COLUMN` rewrites the table, and reading the schema back |
| 02 | **[DDL locks and the blocking they cause](02-locks-and-blocking.md)** | The lock mode each statement takes, the `ACCESS EXCLUSIVE` queue pile-up — a 12 ms `ALTER` blocking plain reads for 2.4 s — and `lock_timeout` as the seatbelt |
| 03 | **[Startup races and advisory locks](03-startup-races.md)** | Why `CREATE TABLE IF NOT EXISTS` races (228 of 500 failed), why the seeding variant fails silently instead, `pg_advisory_xact_lock`, and the rule for where DDL belongs |

## Phase gate

You should be able to answer these before moving to
[Migrations](../02-migrations.md):

- What does `client.query('CREATE TABLE …')` return, and how do you tell it worked?
- Why is `CREATE TABLE $1` a syntax error rather than a security feature?
- What does a failed migration leave behind on PostgreSQL, and why is that unusual?
- Why is `CREATE TABLE IF NOT EXISTS` unsafe at startup across several processes?
- Which lock does `ALTER TABLE` take, and why can a 12 ms migration cause a 3-second
  outage?
- What is the difference between *idempotent* and *concurrency-safe*?

## Where this connects

- **[Migrations](../02-migrations.md)** takes the rule this topic establishes —
  DDL belongs in a recorded, replayable file — and builds the runner for it.
- **[Wrapping a migration in `BEGIN`/`COMMIT`](../06-tx-migration.md)** develops the
  transactional-DDL property into the reason every migration file is atomic.
- **[Schema drift](../13-schema-drift.md)** uses the `information_schema` query from
  chunk 01 to fail fast at boot when the live schema and the code disagree.
- **Node [Phase 6 · Parameterized queries](/docs/nodejs/pages/phase-6-data-access/parameterized-queries)**
  owns the value-vs-identifier rule in general; this topic is the DDL-specific half.

---

← [Phase index](../README.md) · Start → [Issuing DDL through the driver](01-issuing-ddl.md)
