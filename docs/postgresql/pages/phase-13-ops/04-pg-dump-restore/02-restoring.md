---
title: "Restoring"
sidebar_label: "02 · Restoring"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> client tools **18.4**. Script: `sandbox/pg-api/ex52-backup-restore.sh`.

**A backup you have never restored is a hypothesis.** This chunk measures what
restore actually does: how long it takes relative to the dump, why `-j` may buy
nothing, what happens when you restore over an existing database, and the two
properties — snapshot consistency and locking — that decide whether you can dump
a live production system.

## Restore costs far more than dump

```console
=== 6. restore into a fresh database ===
  restore -Fc           10.29 s
restored rows: orders=2000000 audit_log=50000

=== 7. parallel restore ===
  restore -Fc -j 4      10.06 s
```

The dump took **2.55 s**; the restore took **10.29 s** — 4× longer for the same
data. That ratio is the number to carry away, because it is what makes a
restore-time estimate from dump timings wrong in the dangerous direction.

The asymmetry is structural: dumping reads rows and writes a file, while
restoring inserts every row, **rebuilds every index from scratch**, revalidates
every constraint, and writes it all to WAL.

## `-j 4` bought nothing here, and that is the lesson

`10.06 s` against `10.29 s` — within noise, on four workers. The same happened
for the parallel dump (`2.33 s` against `2.53 s`).

**`pg_restore -j` parallelises across items, not within one.** This database has
two tables, one of which holds 97 % of the data, so one worker did nearly all the
work while three idled. Parallelism helps when a database has many comparably
sized tables and indexes; it does nothing for a single dominant table.

This is worth measuring on your own data before planning a maintenance window
around it. The estimate people carry — "we'll use `-j 8` and it will be eight
times faster" — is true only for the shape of database that happens to suit it.

```console
=== 3. parallel dump — only the directory format supports it ===
  -Fd -j 4    2.33 s
  -Fc -j 4 → pg_dump: error: parallel backup only supported by the directory format
```

Note also that parallel *dumping* requires `-Fd`. `-Fc -j 4` is a hard error, not
a silent fallback.

## Restoring over an existing database

```console
=== 8. restoring over an existing database ===
  pg_restore: error: could not execute query: ERROR:  relation "audit_log" already exists
  Command was: CREATE TABLE public.audit_log (
rows after a second restore: 2000000
  ↑ errors are reported but the process continues; --exit-on-error changes that
  rows after --clean restore: 2000000
```

**`pg_restore` reports the error and keeps going.** It exits non-zero, but by
then it has run everything it could — the `CREATE TABLE`s failed while the data
loads may have succeeded, so a database restored this way can end up with
duplicated rows or a half-old, half-new schema.

Two flags fix this, and they answer different questions:

- **`--exit-on-error`** — stop at the first failure. Use it in any automated
  restore, where "kept going despite errors" is never the desired behaviour.
- **`--clean --if-exists`** — drop each object before recreating it. This is how
  you restore *over* a database on purpose. Without `--if-exists` the `DROP`
  statements themselves error on anything that is not there.

The safest restore is neither: **create a new empty database and restore into
it**, then rename. Nothing is dropped, the old database survives if the restore
fails, and the switch is one command.

## Selective restore leaves the indexes behind

```console
=== 9. selective restore of one table ===
tables present: audit_log
  ↑ -t restores the table's data but NOT its indexes/constraints by default
indexes on audit_log: 0
```

`pg_restore -t audit_log` restored the table and its rows into an empty database
— **and zero indexes**, including the primary key. The table's `id` column is
there; the `audit_log_pkey` constraint is not.

`-t` selects the table item, and indexes and constraints are separate items in
the manifest. If you are recovering one table into a live database this is a real
trap: the restored table works, accepts duplicate keys, and performs badly, all
without an error. Either use `-L` with an edited manifest that includes the
constraint items, or recreate them by hand afterwards and verify:

```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'audit_log';
```

## A dump is a consistent snapshot

```console
=== 10. is a dump a consistent snapshot? ===
source now has: 2001000 rows
the dump captured: 2000000 rows
rows inserted during the dump that made it in: 0
```

1000 rows were inserted **while the dump was running**, and the restored copy
contains exactly zero of them. `pg_dump` opens a `REPEATABLE READ` transaction
and exports a single snapshot, so the backup is the database as it was at the
instant the dump began — not a smear across the dump's duration.

That is what makes dumping a live database safe, and it holds across tables: a
foreign key written halfway through the dump cannot appear on one side only. In
a parallel dump the workers **share** the leader's snapshot (via
`pg_export_snapshot`), so consistency survives `-j` too.

The cost is the one from [MVCC](../../phase-11-mvcc/): the dump's long-running
transaction holds back the xmin horizon, so `VACUUM` cannot clean up rows dead
during that window. A multi-hour dump on a busy database is a multi-hour bloat
window.

## What a dump locks

```console
=== 11. what pg_dump locks, and what blocks it ===
  ALTER TABLE, no dump running     0.04 s  (baseline)
  the dump holds: AccessShareLock on orders
  ALTER TABLE during the dump      2.00 s  ← waited for the dump to finish
  the dump itself took             2.01 s
```

The same `ALTER TABLE ADD COLUMN` took **0.04 s** normally and **2.00 s** while a
dump was running, finishing the instant the dump did. `pg_dump` takes
`ACCESS SHARE` on every table it reads and holds it for the whole dump.

`ACCESS SHARE` conflicts only with `ACCESS EXCLUSIVE`, which means:

- **Reads and writes are unaffected.** `SELECT`, `INSERT`, `UPDATE`, `DELETE` all
  proceed normally throughout — dumping a live database does not block your
  application.
- **DDL waits.** `ALTER TABLE`, `DROP TABLE`, `TRUNCATE`, `REINDEX` and
  `VACUUM FULL` queue behind the dump.

The second point is worse than it looks, because of how PostgreSQL's lock queue
works: the waiting `ALTER TABLE` blocks *everything queued behind it*, including
ordinary reads. A migration started during a nightly dump can stall the whole
application even though the dump alone would not have. Details in
[DDL locks](../../phase-3-ddl/).

**Practical rule:** do not run migrations and dumps in the same window, and set
`lock_timeout` on your migration sessions so a collision fails fast instead of
queueing.

## The operational part

The measurements above only matter if the restore is real. A backup process that
is worth having:

```bash
#!/usr/bin/env bash
set -euo pipefail                       # a partial backup must not exit 0

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
pg_dumpall --roles-only -f "roles-$STAMP.sql"
pg_dump -d appdb -Fc -f "appdb-$STAMP.dump"

# Prove it is restorable, every time — not once a year in an incident.
createdb verify_$STAMP
pg_restore -d verify_$STAMP --exit-on-error "appdb-$STAMP.dump"
psql -d verify_$STAMP -tAc "SELECT count(*) FROM orders" > "verify-$STAMP.txt"
dropdb verify_$STAMP
```

The `--exit-on-error` restore into a throwaway database is what turns "we have
backups" into "we have restores". It also catches the failure this page opened
with — a dump whose grants reference roles the target does not have.

What it does not give you is a recovery point: a nightly dump means up to 24
hours of data loss. If that is unacceptable, this topic is not your backup
strategy — [physical backup and PITR](../15-physical-backup.md) is, and dumps
become the portable secondary copy.

## Trade-off

Restoring into a fresh database and renaming is safer than `--clean`, and costs
disk space for two copies of the database during the switch. `--exit-on-error`
turns a partially-succeeded restore into a clearly failed one, which is right for
automation and annoying during manual recovery, when finishing what it can is
sometimes exactly what you want.

Testing every backup by restoring it doubles the storage and the time the backup
job occupies. It is still the cheapest possible insurance — the alternative is
discovering the problem while the production database is already gone.

## Gotchas

**Symptom:** The restore estimate from dump timings is badly wrong
**Cause:** Restore rebuilds indexes and revalidates constraints. Measured: 2.55 s
to dump, 10.29 s to restore the same data — 4×.
**Fix:** Time an actual restore. The ratio grows with index count, so it is worse
on a real schema than in this sandbox.

**Symptom:** `pg_restore -j 8` is no faster
**Cause:** Parallelism is across items. One dominant table cannot be split.
Measured: 10.06 s on 4 workers against 10.29 s serial.
**Fix:** Expect gains only with many comparably sized tables; measure on your own
data before planning a window around it.

**Symptom:** `pg_dump -Fc -j 4` fails
**Cause:** Parallel dumping requires the directory format.
**Fix:** `-Fd -j 4`. Parallel *restore* works from `-Fc`.

**Symptom:** A restore over an existing database leaves a mangled schema
**Cause:** `pg_restore` reports errors and continues by default — measured,
`relation already exists` while the run kept going.
**Fix:** `--exit-on-error` in automation; `--clean --if-exists` to replace
deliberately; ideally restore into a new database and rename.

**Symptom:** A restored table has no primary key and accepts duplicates
**Cause:** `pg_restore -t` restores the table item, not the separate index and
constraint items. Measured: zero indexes after `-t audit_log`.
**Fix:** Restore with an edited `-L` manifest including the constraints, or
recreate them and verify with `pg_indexes`.

**Symptom:** A migration hangs during the nightly backup window
**Cause:** `pg_dump` holds `ACCESS SHARE` for its whole run; DDL needs
`ACCESS EXCLUSIVE` and waits — measured, 0.04 s becoming 2.00 s — and everything
queued behind that DDL waits too.
**Fix:** Separate the windows, and set `lock_timeout` on migration sessions.

**Symptom:** Bloat grows during long dumps
**Cause:** The dump's `REPEATABLE READ` transaction holds the xmin horizon, so
`VACUUM` cannot reclaim rows that died during it.
**Fix:** Dump from a replica, or shorten the dump with `-Fd -j`.

## Interview questions

**★ Is `pg_dump` on a live database safe, and is the result consistent?**
Yes to both. It runs in a `REPEATABLE READ` transaction against one snapshot —
measured, 1000 rows inserted during the dump appeared in the source but zero in
the restored copy. Reads and writes are unaffected; only DDL waits.

**★ What does a dump block?**
Nothing that applications normally do. It takes `ACCESS SHARE`, which conflicts
only with `ACCESS EXCLUSIVE` — so `ALTER TABLE`, `DROP`, `TRUNCATE` and
`VACUUM FULL` queue behind it. Measured: an `ALTER TABLE` went from 0.04 s to
2.00 s, finishing exactly when the dump did. The real danger is the queue behind
that DDL.

**★ Why might `pg_restore -j` not help?**
It parallelises across manifest items, so a database dominated by one large table
gets nothing. Measured: 10.06 s on four workers against 10.29 s serial.

**★ What is wrong with restoring over an existing database?**
`pg_restore` continues after errors by default, so you can end up with a
half-restored schema and duplicated data while the command "finished". Use
`--exit-on-error`, `--clean --if-exists` to replace deliberately, or restore into
a fresh database and rename.

**You restored one table with `-t` and writes now allow duplicates. Why?**
Indexes and constraints are separate items in the dump manifest; `-t` restored
only the table and its data. Measured: zero indexes afterwards, primary key
included. Restore with `-L` or recreate them.

**How do you know a backup works?**
Restore it every time, into a throwaway database, with `--exit-on-error`, and
assert a row count. Anything less is an untested hypothesis — and it is the step
that catches missing roles, since grants are dumped and roles are not.

---

← [Dump formats and what is in them](01-dump-formats.md) · Next → [pg_hba.conf](../05-pg-hba.md)
