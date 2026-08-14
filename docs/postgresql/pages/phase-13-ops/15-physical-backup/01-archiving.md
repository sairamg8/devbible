---
title: "15.1 · Base backups and WAL archiving"
sidebar_label: "01 · Base backups & archiving"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation** —
> [continuous archiving and PITR](https://www.postgresql.org/docs/18/continuous-archiving.html),
> [`pg_basebackup`](https://www.postgresql.org/docs/18/app-pgbasebackup.html).
> **Not sandbox-measured** — no console output on this page. The *measured*
> backup numbers in this corpus are for **logical** backups
> ([04 · pg_dump and pg_restore](../04-pg-dump-restore/README.md),
> `sandbox/pg-api/ex52-backup-restore.sh`).

**Your managed provider does this for you.** You need to understand it anyway,
because the two questions it answers — *how much data can we lose* and *how long
until we are back* — are product decisions, not infrastructure ones, and nobody
else is going to make them.

## Two kinds of backup, and they are not alternatives

| | **Logical** (`pg_dump`) | **Physical** (base backup + WAL) |
|---|---|---|
| What it is | SQL statements or an archive of them | a byte-level copy of the data directory |
| Granularity | one table, one schema, one database | the **whole cluster**, always |
| Restore target | any PostgreSQL version, any platform | same major version, same architecture |
| Restore to a **point in time** | no — only to the dump's instant | **yes**, to any moment covered by WAL |
| Restore speed on a large database | slow — rebuilds indexes | fast — files are already built |
| Typical use | moving data, per-table recovery, environments | disaster recovery, replicas |

The measured evidence for the logical side is on
[04 · pg_dump and pg_restore](../04-pg-dump-restore/README.md), where **restore
cost 4× the dump** — because a logical restore re-executes inserts and rebuilds
every index, while a physical restore copies files that are already built. That
difference is the whole reason physical backups exist for disaster recovery.

**You want both.** Physical backup answers "the server is gone"; logical backup
answers "someone dropped the wrong table three days ago and we need just that one
back into staging".

## How PITR works

Two components, and the relationship between them is the concept:

1. **A base backup** — a consistent snapshot of the entire cluster at some
   moment.
2. **The WAL archive** — every change since, in order.

Restore the base backup, then replay WAL forward until the moment you want. As
the documentation puts it, without WAL "you could only recover to the exact
backup moment. With WAL, you can replay forward to any later time."

The elegant part, and the reason this works at all: the base backup does **not**
need to be a perfectly consistent filesystem snapshot. Internal inconsistencies
from copying files while the database was running are corrected by log replay —
the same mechanism that makes crash recovery work.

**This is what "point-in-time recovery" means literally.** You can restore to
09:14:59, one second before the migration that deleted the rows. That is a
capability logical backups simply do not have, and it is why the retention window
on your provider matters so much.

## Setting up archiving

```conf
wal_level    = replica      # default; 'logical' also works
archive_mode = on           # default off — requires a RESTART
archive_command = 'test ! -f /archive/%f && cp %p /archive/%f'
archive_timeout = '60s'     # default 0 (disabled)
```

Details worth the attention:

- **`archive_mode` defaults to `off` and requires a restart.** It is not
  something you enable during an incident.
- **`%p` is the full path to the WAL file, `%f` the filename.** The
  `test ! -f` guard is in the documentation's own example and matters: it refuses
  to overwrite an existing archived file, because silently replacing one corrupts
  the archive.
- **The command must return zero on success and non-zero on failure.** A command
  that returns zero while failing means WAL is deleted locally and never stored —
  a backup that does not exist, discovered only during a restore.
- **`archive_timeout`** forces a WAL switch every N seconds. Without it, a
  low-traffic database may not fill a segment for hours, so the last hours of
  changes are not archived. This directly bounds your worst-case data loss.
- **`archive_library`** is the newer alternative to a shell command, using an
  archive module for better performance.

Watch it with `pg_stat_archiver`, which reports the last archived file and — the
number that matters — the count of failures:

```sql
SELECT archived_count, last_archived_wal, last_archived_time,
       failed_count, last_failed_wal, last_failed_time
  FROM pg_stat_archiver;
```

**A non-zero, growing `failed_count` is an emergency**, for two reasons: your
recovery window has stopped advancing, and PostgreSQL retains WAL it cannot
archive, so `pg_wal` grows until the disk fills. A failing archive command is one
of the few ways a backup problem becomes an availability problem.

## Taking a base backup

```bash
pg_basebackup -D /backups/base -Ft -z -P -X stream
```

| Flag | Meaning |
|---|---|
| `-D` | destination |
| `-Ft` | tar format |
| `-z` | compress |
| `-P` | progress |
| `-X stream` | **stream the WAL generated during the backup**, making it standalone |

`-X stream` is the one to remember: without WAL covering the duration of the
backup itself, the backup is not restorable on its own.

PostgreSQL 18 also supports **incremental** base backups —
`pg_basebackup --incremental` against a previous backup's manifest, recombined at
restore time with `pg_combinebackup`. It reduces backup size and time at the cost
of a restore that depends on a chain of backups, all of which must be intact.

## Trade-off

Continuous archiving trades **storage and a permanently running process for a
near-zero RPO**. You store a full cluster copy plus every byte of WAL since, and
in exchange you can land on any second rather than on last night's dump.

The trade *within* it is retention against cost: every additional day of window
is more stored WAL, and the right length is set by how long a silent data problem
might go unnoticed rather than by what looks reasonable on a pricing page.

There is also a sharp operational asymmetry worth naming. Logical backups fail
*safely* — a failed `pg_dump` leaves the database untouched. Archiving fails
*dangerously*: WAL that cannot be archived is retained on disk, so a broken
`archive_command` becomes a full disk and an outage. The mechanism protecting you
is the one that can take you down.

## Gotchas

**Symptom:** `pg_wal` grows until the disk fills
**Cause:** `archive_command` is failing, so WAL cannot be recycled. Check
`pg_stat_archiver.failed_count`. (A stuck replication slot does the same thing —
[16 · Logical replication](../16-logical-replication.md).)
**Fix:** Fix the archive command. Monitor `failed_count`; it is one of the few
backup problems that becomes an outage.

**Symptom:** The archive looks healthy but a restore fails
**Cause:** An `archive_command` returning zero on failure — WAL was deleted
locally and never stored.
**Fix:** Ensure it returns non-zero on failure, refuses to overwrite existing
files (`test ! -f`), and — decisively — **test a restore**.

**Symptom:** On a quiet database the last hours are unrecoverable
**Cause:** `archive_timeout` defaults to `0`, so a partially filled WAL segment
is never archived.
**Fix:** Set `archive_timeout` to bound worst-case loss.

**Symptom:** A base backup will not restore on its own
**Cause:** No `-X stream`, so WAL generated during the backup is missing.
**Fix:** Always `-X stream` for standalone backups.

**Symptom:** `archive_mode = on` had no effect
**Cause:** It requires a **restart**, not a reload.
**Fix:** Restart, and check `pg_settings.pending_restart`. Enable it before you
need it.

**Symptom:** Needing one table back and having only cluster snapshots
**Cause:** Physical backups are whole-cluster by nature.
**Fix:** Keep logical backups alongside — restore the snapshot elsewhere and
`pg_dump` the table out, or have a dump already.

## Interview questions

**★ What is the difference between a logical and a physical backup?**
Logical (`pg_dump`) produces SQL or an archive of it: portable across versions and
platforms, restorable per table, and slow to restore because indexes are rebuilt
— measured at 4× the dump time in this corpus. Physical is a byte-level copy of
the whole cluster plus WAL: same-version only, all-or-nothing, fast to restore,
and the only one supporting point-in-time recovery. Production wants both.

**★ How does point-in-time recovery work, in principle?**
A base backup provides a starting state and the archived WAL provides every
change since, so recovery replays forward from the backup to a chosen moment. The
base backup need not be a consistent filesystem snapshot because log replay
repairs it — the same mechanism as crash recovery.

**★ What breaks when `archive_command` fails?**
WAL cannot be recycled, so `pg_wal` grows until the disk fills — a backup problem
that becomes an availability incident — and the recovery window stops advancing.
`pg_stat_archiver.failed_count` is the thing to alert on, and the command must
return non-zero on failure or you will never know.

**Why does `archive_timeout` matter on a low-traffic database?**
Because WAL is archived by the segment, and a quiet database may take hours to
fill one. Until it is archived, those changes are not in the backup, so
worst-case data loss is "however long since the last segment filled".
`archive_timeout` forces a switch and bounds that.

**What does `-X stream` do and why is it not optional?**
It streams the WAL generated *during* the backup into the backup itself. Without
it the base backup covers a window it does not have the WAL to make consistent,
so it is not restorable standalone.

---

← [Phase index](../README.md) · Next → [Restoring, and RPO/RTO](02-restoring-and-rpo.md)
