---
title: "Startup races and advisory locks"
sidebar_label: "03 · Startup races"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex2-ddl-edges.mjs`,
> `ex3-advisory-fix.mjs`.

**Chapter 3 of [Creating tables from Node](README.md).** Why `ensureSchema()` at
boot is a bug, what it actually fails with, and the one mechanism that makes
bootstrapping safe when it genuinely has to live in the app.

## `CREATE TABLE IF NOT EXISTS` is not concurrency-safe

The tempting pattern is an `ensureSchema()` on boot, so a fresh checkout just
works. It survives one process. It does not survive a rolling deploy, a `cluster`
fork, or three replicas starting together.

```js
const boot = () => pool.query('CREATE TABLE IF NOT EXISTS race_demo (id int, tag text)');
// 20 connections, 25 rounds, dropping the table between rounds
```

```console
$ node ex2-ddl-edges.mjs
=== B. CREATE TABLE IF NOT EXISTS race — 20 connections, 25 rounds ===
succeeded: 272 of 500
  228× 23505 duplicate key value violates unique constraint "pg_type_typname_nsp_index"
```

**228 of 500 failed.** `IF NOT EXISTS` checks the catalog and then inserts into it,
and those are not one atomic step. Two sessions both pass the check, both try to
insert the row type, and one loses — on a *system* index. The error is `23505`
(`unique_violation`) naming `pg_type_typname_nsp_index`: a constraint you did not
write, on a table you have never heard of. That is exactly why it reads as a
PostgreSQL bug the first time it appears in your logs during a deploy.

`IF NOT EXISTS` makes the statement **idempotent**, not **concurrency-safe**. Those
are different properties and only one of them is in the syntax.

### The seeding variant is worse, because it does not fail

```console
=== C. create-then-seed at boot, 20 workers ===
ok: 20 | failed: 0
rows in boot_seed after "idempotent" startup: 20
```

Twenty processes, twenty "idempotent" startups, twenty duplicate admin rows, and no
error anywhere. Silence is not correctness. The fix is a real unique constraint plus
`ON CONFLICT DO NOTHING` ([Seeding](../03-seeding.md)) — the database enforcing
uniqueness, rather than each process independently believing it is first.

## If bootstrapping must live in the app, take a lock

Sometimes it genuinely has to: a test harness, a single-binary tool, a local dev
reset. Serialise it with an **advisory lock** — a lock on an arbitrary integer you
choose, held for the transaction, costing nothing when uncontended.

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock($1)', [4242]);
  await client.query('CREATE TABLE IF NOT EXISTS race_demo (id int, tag text)');
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

```console
$ node ex3-advisory-fix.mjs
succeeded: 500 of 500 in 1252 ms
errors: (none)
```

Same 500 attempts, same concurrency, **zero failures**, 1252 ms for all of it.

Use `pg_advisory_xact_lock`, not `pg_advisory_lock`. The `_xact_` form releases
automatically at commit or rollback; the session-scoped form must be released
explicitly, so a process that crashes between lock and unlock leaves it held until
the connection dies — wedging every other instance's migration. The lock key is an
arbitrary `bigint`; pick one constant per concern and write it down, because two
unrelated subsystems choosing `1` will serialise against each other for no reason.

This is the same mechanism real migration tools use internally, which is the
strongest argument for not writing your own.

## Trade-off

Issuing DDL from Node buys one thing: the schema travels with the code, in the same
language and repository, with no second toolchain to install. It costs
replayability. A `CREATE TABLE` inside `server.js` has no version, no ordering
relative to other changes, no record of having run, and no down path — so "what
shape is production?" becomes "read the source and guess".

The rule that falls out of this chapter:

| Where the DDL is | Verdict |
|---|---|
| A numbered migration file, run by a runner that records what it applied | ✅ The normal way |
| A one-off script run deliberately by an operator | ✅ Fine, if recorded |
| `ensureSchema()` at application startup | ❌ Races across processes; unversioned |
| Inside a request handler | ❌ Takes `ACCESS EXCLUSIVE` on a live table under load |

The last row is worth stating plainly: a request handler that runs DDL will,
sooner or later, take an `ACCESS EXCLUSIVE` lock on a busy table and stall every
other request touching it — the incident measured above, triggered by user traffic
instead of by a deploy.

## Gotchas

**Symptom:** `duplicate key value violates unique constraint "pg_type_typname_nsp_index"`
**Cause:** Two processes ran `CREATE TABLE IF NOT EXISTS` simultaneously; the
catalog check and insert are not atomic.
**Fix:** `SELECT pg_advisory_xact_lock($1)` first, or move DDL out of startup into
a migration step that runs once.

**Symptom:** Seed data duplicated once per replica, no errors logged
**Cause:** Startup seeding that is idempotent per process, not per cluster.
**Fix:** A real unique constraint plus `ON CONFLICT DO NOTHING`.

**Symptom:** A migration hangs forever and never times out
**Cause:** `pg_advisory_lock` (session-scoped) held by a process that crashed
before releasing it.
**Fix:** `pg_advisory_xact_lock`, which releases on commit or rollback.

**Symptom:** Two unrelated subsystems block each other at startup
**Cause:** Both chose the same advisory lock key.
**Fix:** Allocate keys deliberately and record them; the key space is arbitrary
`bigint`, so there is no excuse for collisions.

**Symptom:** The schema is right in dev and wrong in production, with no failed deploy
**Cause:** DDL at startup is unversioned — nothing records what ran or in what order.
**Fix:** Numbered migration files and a tracking table ([Migrations](../02-migrations.md)).

## Interview questions

**★ Why is `CREATE TABLE IF NOT EXISTS` not enough for startup?**
It is idempotent, not concurrency-safe. The catalog check and the catalog insert
are separate steps, so two sessions can both pass the check and one loses on the
system index. Measured: under 20 concurrent connections, **228 of 500** attempts
failed with `23505` on `pg_type_typname_nsp_index`. Serialise with
`pg_advisory_xact_lock`, or run migrations as a separate step before the app boots.

**★ Why is the seeding variant worse than the `CREATE TABLE` variant?**
Because it does not fail. Measured: 20 workers each ran an "idempotent" startup
seed and produced **20 duplicate rows with zero errors**. The `CREATE` race at
least announces itself with a `23505`; the seed race is silent data corruption.

**★ Why `pg_advisory_xact_lock` rather than `pg_advisory_lock`?**
The transaction-scoped form releases automatically at commit or rollback. The
session-scoped form must be released explicitly, so a crash between lock and unlock
leaves it held until the connection dies, blocking every other instance's
migration.

**★ Where is it legitimate to run DDL from Node?**
In a numbered migration file executed by a runner that records what it applied,
inside a transaction, with a `lock_timeout` set. Everywhere else it is a problem:
at startup it races across processes and leaves the schema unversioned; in a
request handler it takes `ACCESS EXCLUSIVE` on a live table under load.

**What is the difference between idempotent and concurrency-safe?**
Idempotent means running it twice *in sequence* leaves the same state.
Concurrency-safe means running it twice *at the same time* is also correct.
`IF NOT EXISTS` buys the first and not the second — and only the syntax suggests
otherwise.

---

← [DDL locks and the blocking they cause](02-locks-and-blocking.md) · Next → [Migrations](../02-migrations.md)
