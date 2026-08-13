---
title: "pg_dump and pg_restore"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> client tools **18.4**. Script: `sandbox/pg-api/ex52-backup-restore.sh`.

**Logical backup: SQL that recreates the database, taken from one consistent
snapshot.** Portable across major versions and selective down to a single table —
and four times slower to restore than to take, which is the fact that decides
whether it can be your only backup.

Measured against a 202 MB database of 2 000 000 rows.

| # | Chunk | In one line |
|---|---|---|
| 01 | **[Dump formats and what is in them](01-dump-formats.md)** | `-Fc` vs the rest at 7.5× size, the table of contents, and the roles a dump leaves behind |
| 02 | **[Restoring](02-restoring.md)** | restore costs 4× the dump, why `-j` bought nothing, snapshot consistency, and what a dump locks |

## Phase gate

You are done when you have restored a dump into a scratch database and checked a
row count — and when you know which of your backups contains the roles.

## Where this connects

- [Physical backup and PITR](../15-physical-backup.md) is the other half:
  logical dumps are portable and selective, physical backups are fast to restore
  and can target a point in time. Large systems need both.
- [Disaster drill](../18-disaster-drill.md) is this topic practised on a schedule.
- [Major version upgrades](../17-major-upgrades.md) uses dump/restore as one of
  its paths — the portable one.
- [Roles, GRANT and REVOKE](../roles-grant/) explains why the roles are missing:
  they are cluster-wide, and a dump covers one database.

---

← [Phase index](../README.md) · Start → [Dump formats](01-dump-formats.md)
