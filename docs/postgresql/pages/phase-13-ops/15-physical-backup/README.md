---
title: "Physical backup and PITR"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-13 against the **PostgreSQL 18 documentation**
> ([continuous archiving and PITR](https://www.postgresql.org/docs/18/continuous-archiving.html),
> [`pg_basebackup`](https://www.postgresql.org/docs/18/app-pgbasebackup.html)),
> cited inline. **Not sandbox-measured** — no console output in this topic. The
> measured backup numbers in this corpus are for **logical** backups
> ([04 · pg_dump and pg_restore](../04-pg-dump-restore/README.md)).

**Your managed provider does this for you.** You need to understand it anyway,
because the two questions it answers — *how much data can we lose* and *how long
until we are back* — are product decisions that nobody else is going to make.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Base backups and archiving](01-archiving.md)** | logical vs physical, how PITR works, `archive_command` and the way it fails dangerously |
| 02 | **[Restoring and RPO/RTO](02-restoring-and-rpo.md)** | the recovery procedure, why `pause` is the right default, timelines, and the two numbers that are yours |

## The idea in one line

**Base backup + every WAL record since = the ability to land on any second.**
The base backup does not even need to be filesystem-consistent, because log
replay repairs it — the same mechanism as crash recovery.

## Three things worth carrying away

1. **A failing `archive_command` is an outage**, not just a backup problem — WAL
   that cannot be archived is retained until the disk fills. Alert on
   `pg_stat_archiver.failed_count`.
2. **`recovery_target_action` defaults to `pause`.** Verify before promoting;
   timelines mean a wrong attempt can be repeated.
3. **RTO is the number nobody measures.** A restore you have never timed is a
   hope, not a plan — see [18 · Disaster drill](../18-disaster-drill.md).

## Phase gate

You are done here when you can state your RPO and RTO as numbers rather than
intentions, and you know which of them your current backup arrangement actually
delivers.

## Where this connects

- [pg_dump and pg_restore](../04-pg-dump-restore/README.md) — the logical half,
  and the only measured backup numbers in this corpus.
- [Disaster drill](../18-disaster-drill.md) — the rehearsal that turns all of
  this from a cost into a capability.
- [Streaming replication replicas](../08-replication/README.md) — `standby.signal`
  and the other use of the same WAL.
- [Logical replication](../16-logical-replication.md) — the other way a retained
  WAL stream fills a disk.
- [Managed PostgreSQL](../13-managed-postgres/README.md) — who runs this for you,
  and what remains yours.

---

← [Phase index](../README.md) · Start → [Base backups and archiving](01-archiving.md)
