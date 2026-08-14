---
title: "Phase 13 — Security, operations and production"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Roles, GRANT and REVOKE](./01-roles-grant/README.md)** | <span className="db-tier t-master">Master</span> | least privilege |
| 02 | **[Secrets](./02-secrets/README.md)** | <span className="db-tier t-master">Master</span> | no URI in logs |
| 03 | **[App role should not own schema](03-app-role-not-owner.md)** | <span className="db-tier t-understand">Understand</span> | what it prevents |
| 04 | **[pg_dump and pg_restore](./04-pg-dump-restore/README.md)** | <span className="db-tier t-understand">Understand</span> | logical backups |
| 05 | **[pg_hba.conf](05-pg-hba.md)** | <span className="db-tier t-understand">Understand</span> | scram host rules |
| 06 | **[TLS to the database](06-tls.md)** | <span className="db-tier t-understand">Understand</span> | sslmode |
| 07 | **[Connection limits and PgBouncer](./07-pgbouncer/README.md)** | <span className="db-tier t-understand">Understand</span> | tx vs session pool |
| 08 | **[Streaming replication replicas](./08-replication/README.md)** | <span className="db-tier t-understand">Understand</span> | read-your-writes |
| 09 | **[Monitoring views](./09-monitoring/README.md)** | <span className="db-tier t-understand">Understand</span> | pg_stat_activity |
| 10 | **[Key configuration](./10-config-keys/README.md)** | <span className="db-tier t-understand">Understand</span> | shared_buffers work_mem |
| 11 | **[Logging slow queries](./11-logging/README.md)** | <span className="db-tier t-understand">Understand</span> | log_min_duration |
| 12 | **[Zero-downtime schema changes](./12-zero-downtime-ddl/README.md)** | <span className="db-tier t-understand">Understand</span> | add backfill constrain |
| 13 | **[Managed PostgreSQL](./13-managed-postgres/README.md)** | <span className="db-tier t-understand">Understand</span> | RDS Neon Supabase |
| 14 | **[Row-level security](./14-rls/README.md)** | <span className="db-tier t-know">Know</span> | policies |
| 15 | **[Physical backup PITR](./15-physical-backup/README.md)** | <span className="db-tier t-know">Know</span> | WAL archiving |
| 16 | **[Logical replication](16-logical-replication.md)** | <span className="db-tier t-know">Know</span> | major upgrades |
| 17 | **[Major version upgrades](17-major-upgrades.md)** | <span className="db-tier t-know">Know</span> | pg_upgrade paths |
| 18 | **[Disaster drill](18-disaster-drill.md)** | <span className="db-tier t-know">Know</span> | restore on a schedule |

## Build status — updated as each topic lands

> **Session of 2026-08-13 (overnight).** PostgreSQL was un-parked to be finished.
> Topics 01–06 were already written and measured. Topics 07–18 were 66-line
> stamps and were replaced one at a time. Nine of them then ran past the
> 300-line cap and were split on concept boundaries into chunk directories —
> content moved, nothing trimmed.
>
> Under the **no-new-sandboxes** rule, topics 07–18 are validated against the
> official documentation with the source named in each `> Verified:` line.
> Where an existing script already measured something, the page says so and
> marks it **sandbox-measured**. **No page carries a console block that was not
> produced by a run that actually happened.**

| Topic | State |
|---|---|
| 01–06 | ✅ written and measured (earlier sessions) |
| **07 PgBouncer** | ✅ **written 2026-08-13** — chunked ×4, `ex54` §1–3 measured + docs |
| **08 Replicas** | ✅ **written 2026-08-13** — chunked ×2, doc-validated, consumer half only |
| **09 Monitoring** | ✅ **written 2026-08-13** — chunked ×5, doc-validated |
| **10 Config keys** | ✅ **written 2026-08-13** — chunked ×3, doc-validated + `ex53` contexts |
| **11 Logging** | ✅ **written 2026-08-13** — chunked ×2, doc-validated + `ex51` measured |
| **12 Zero-downtime DDL** | ✅ **written 2026-08-13** — chunked ×3, doc-validated |
| **13 Managed Postgres** | ✅ **written 2026-08-13** — chunked ×2, provider docs, dated |
| **14 RLS** | ✅ **written 2026-08-13** — chunked ×3, doc-validated + `ex54` §3 |
| **15 Physical backup / PITR** | ✅ **written 2026-08-13** — chunked ×2, doc-validated |
| **16 Logical replication** | ✅ **written 2026-08-13** — single file, doc-validated |
| **17 Major upgrades** | ✅ **written 2026-08-13** — single file, doc-validated |
| **18 Disaster drill** | ✅ **written 2026-08-13** — single file, synthesis |

**✅ PHASE 13 COMPLETE — 18/18 topics.** Every stamp is gone. Remaining
PostgreSQL work is tracked in the memory store handoff, not here.

## Phase gate

Move on when secrets are safe, privileges are least, and you have restored a backup once.

---

← Syllabus: [Part 4](../../syllabus/04-performance-and-production.md) · Start → [Roles, GRANT and REVOKE](./01-roles-grant/README.md)
