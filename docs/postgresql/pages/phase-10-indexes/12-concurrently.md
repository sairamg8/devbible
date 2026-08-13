---
title: "CREATE INDEX CONCURRENTLY"
sidebar_label: "12 · CONCURRENTLY"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex26-index-ops.mjs`.

**A plain `CREATE INDEX` locks out every writer for the whole build. `CONCURRENTLY` does
not — at the price of two table passes, no transaction wrapper, and a failure mode that
leaves an invalid index behind.**

## What the plain form does to your writers

68 MB table, 1.5 million rows. One session builds the index inside a transaction; another
tries to insert with a 1.5-second timeout:

```console
$ node ex26-index-ops.mjs
=== 1. CREATE INDEX blocks writes; CONCURRENTLY does not ===
table: 68 MB
lock held by the builder: [{"mode":"ShareLock","granted":true}]
INSERT while plain CREATE INDEX runs → 57014 canceling statement due to statement timeout
```

`CREATE INDEX` takes a **`ShareLock`**, which conflicts with the `RowExclusiveLock` every
`INSERT`, `UPDATE` and `DELETE` needs. Reads continue; **writes queue**. On a table where
the build takes minutes, that is an outage.

## `CONCURRENTLY`, with a writer hammering throughout

```console
CREATE INDEX CONCURRENTLY: 3289 ms, and 1610 INSERTs completed during it
plain CREATE INDEX       : 2812 ms — one table pass instead of two
```

1610 inserts landed during the concurrent build. The plain build is **17% faster** because
it scans the table once; `CONCURRENTLY` scans twice — once to build, once to catch rows
that changed during the first pass — and then waits for every transaction that started
before it to finish.

That wait is the part people forget. **A long-running transaction anywhere in the database
will stall a `CREATE INDEX CONCURRENTLY` indefinitely**, even one that never touches this
table.

## It cannot run inside a transaction

```console
CIC inside BEGIN → 25001 CREATE INDEX CONCURRENTLY cannot run inside a transaction block
```

`25001` is the SQLSTATE to recognise. This is what makes `CONCURRENTLY` awkward in
migration tools: most wrap each migration in `BEGIN`/`COMMIT` by default, and this
statement must be run outside one.

## The failure mode: an INVALID index

Build a unique index concurrently over data that has duplicates:

```console
=== 2. what a failed CONCURRENTLY leaves behind ===
unique CIC over duplicate data → 23505 could not create unique index "x_dup_email_uq"
┌─────────┬──────────────────┬────────────┬────────────┬───────────┐
│ (index) │ name             │ indisvalid │ indisready │ size      │
├─────────┼──────────────────┼────────────┼────────────┼───────────┤
│ 0       │ 'x_dup_email_uq' │ false      │ false      │ '0 bytes' │
└─────────┴──────────────────┴────────────┴────────────┴───────────┘
the index still EXISTS and still costs write time, but no query can use it
plan: Seq Scan on x_dup
```

**The statement failed and the index is still there.** `indisvalid = false` means no query
will ever use it — but it is a real object: it occupies the name, and for a partially-built
index it is maintained by every subsequent write. All cost, no benefit.

A plain `CREATE INDEX` in the same situation rolls back cleanly. This asymmetry is the
main reason `CONCURRENTLY` needs a follow-up check rather than fire-and-forget.

Find them:

```console
find them all with:
┌─────────┬──────────────────┬─────────┐
│ (index) │ index            │ table   │
├─────────┼──────────────────┼─────────┤
│ 0       │ 'x_dup_email_uq' │ 'x_dup' │
└─────────┴──────────────────┴─────────┘
```

```sql
SELECT indexrelid::regclass AS index, indrelid::regclass AS table
FROM pg_index WHERE NOT indisvalid;
```

The remedy is always `DROP INDEX` (itself best run `CONCURRENTLY`), fix the cause, and
rebuild. There is no way to resume a failed build.

## In SQL

```sql
CREATE INDEX CONCURRENTLY idx ON t (col);     -- outside any transaction
DROP INDEX CONCURRENTLY idx;                   -- dropping also takes ACCESS EXCLUSIVE otherwise

-- always, afterwards:
SELECT indexrelid::regclass, indisvalid FROM pg_index WHERE indrelid = 't'::regclass;

-- what is actually blocking a build that seems stuck
SELECT pid, state, wait_event_type, left(query, 60), xact_start
FROM pg_stat_activity
WHERE state <> 'idle' ORDER BY xact_start;
```

Add `IF NOT EXISTS` and the statement becomes safe to re-run — but note it will *not*
rebuild an existing invalid index, it will skip it.

## From Node

Two hard requirements, both visible in the driver.

**1. Do not wrap it.** With `pg`, a statement issued on a client outside an explicit
`BEGIN` runs in its own implicit transaction, which is fine — but a migration runner that
opens a transaction around every step is not:

```js
const client = await pool.connect();
try {
  // NOT inside BEGIN — this would raise 25001
  await client.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS x_big_v_cc ON x_big (v)`);
} finally {
  client.release();
}
```

Most runners have an opt-out per migration (`node-pg-migrate`'s
`export const noTransaction = true`, or an equivalent flag). See
[migrations](../phase-8-schema-from-node/02-migrations.md).

**2. Raise the timeout, then verify.** A concurrent build on a large table can far exceed
a default `statement_timeout`, and being cancelled halfway is exactly how you get an
invalid index:

```js
await client.query(`SET statement_timeout = 0`);
await client.query(`SET lock_timeout = '5s'`);
await client.query(`CREATE INDEX CONCURRENTLY ...`);

const {rows: [idx]} = await client.query(
  `SELECT indisvalid FROM pg_index WHERE indexrelid = $1::regclass`, ['x_big_v_cc']);
if (!idx.indisvalid) throw new Error('index built INVALID — drop and retry');
```

That check is not optional. The `CREATE` can fail *after* the statement returns success
to an earlier phase, and the only reliable signal is `indisvalid`.

## Trade-off

**`CONCURRENTLY` trades build time and operational safety for availability.** It was 17%
slower here on a small table — on a large one the gap widens, because of the second pass
and the wait for concurrent transactions — and it can hang indefinitely behind an
unrelated long transaction.

Use the plain form on tables nobody is writing to: a new table, a maintenance window, a
staging database. Use `CONCURRENTLY` on anything live. What you must not do is use
`CONCURRENTLY` and then not check `indisvalid`, which gives you the cost of both
approaches and the benefit of neither.

## Gotchas

**Symptom:** `25001 CREATE INDEX CONCURRENTLY cannot run inside a transaction block`
**Cause:** The migration runner wrapped the step in `BEGIN`
**Fix:** Mark the migration as non-transactional

**Symptom:** Writes hang during a deploy
**Cause:** A plain `CREATE INDEX` holding `ShareLock`
**Fix:** `CONCURRENTLY`; measured, 1610 inserts completed during the concurrent build and
zero during the plain one

**Symptom:** The build never finishes
**Cause:** It waits for all transactions that started before it — including an idle-in-
transaction session elsewhere
**Fix:** Find it in `pg_stat_activity` by `xact_start`; set `idle_in_transaction_session_timeout`

**Symptom:** Query still slow after the index "was created"
**Cause:** It is `indisvalid = false` from a failed or cancelled build
**Fix:** `SELECT … FROM pg_index WHERE NOT indisvalid`, drop, fix the data, rebuild

**Symptom:** A unique index build failed and inserts got slower
**Cause:** The invalid index is still maintained by writes
**Fix:** Drop it. An invalid index is never used for reads but is not free

## Interview questions

**★ What does `CREATE INDEX CONCURRENTLY` avoid?**
The `ShareLock` that blocks all writes for the duration. Measured: with the plain form an
`INSERT` was cancelled by a 1.5 s timeout; with `CONCURRENTLY`, 1610 inserts completed
during the build.

**★ What does it cost?**
Two table passes plus a wait for pre-existing transactions — 3289 ms against 2812 ms here
— and it cannot run inside a transaction block (`25001`).

**★ What happens when it fails?**
It leaves an index with `indisvalid = false`: unusable by queries but still occupying the
name and maintained by writes. Measured after a unique build over duplicate data
(`23505`). Drop it and rebuild; there is no resume.

**How do you find invalid indexes?**
`SELECT indexrelid::regclass, indrelid::regclass FROM pg_index WHERE NOT indisvalid`.

**Why might a concurrent build hang forever?**
It waits for every transaction that began before it, anywhere in the database — including
idle-in-transaction sessions that never touch the table.

**Is checking the statement returned successfully enough?**
No. Verify `indisvalid` afterwards; that is the only reliable signal.

---

← [GIN and trigrams](11-gin-trgm.md) · Next → [Unused and duplicate indexes](13-unused-indexes.md)
