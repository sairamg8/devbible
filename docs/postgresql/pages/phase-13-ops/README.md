---
title: "Phase 13 — Security, operations and production"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · `pg`.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[Roles, GRANT and REVOKE](roles-grant/)** | <span className="db-tier t-master">Master</span> | least privilege |
| 02 | **[Secrets](secrets/)** | <span className="db-tier t-master">Master</span> | no URI in logs |
| 03 | **[App role should not own schema](03-app-role-not-owner.md)** | <span className="db-tier t-understand">Understand</span> | what it prevents |
| 04 | **[pg_dump and pg_restore](pg-dump-restore/)** | <span className="db-tier t-understand">Understand</span> | logical backups |
| 05 | **[pg_hba.conf](05-pg-hba.md)** | <span className="db-tier t-understand">Understand</span> | scram host rules |
| 06 | **[TLS to the database](06-tls.md)** | <span className="db-tier t-understand">Understand</span> | sslmode |
| 07 | **[Connection limits and PgBouncer](07-pgbouncer.md)** | <span className="db-tier t-understand">Understand</span> | tx vs session pool |
| 08 | **[Streaming replication replicas](08-replication.md)** | <span className="db-tier t-understand">Understand</span> | read-your-writes |
| 09 | **[Monitoring views](09-monitoring.md)** | <span className="db-tier t-understand">Understand</span> | pg_stat_activity |
| 10 | **[Key configuration](10-config-keys.md)** | <span className="db-tier t-understand">Understand</span> | shared_buffers work_mem |
| 11 | **[Logging slow queries](11-logging.md)** | <span className="db-tier t-understand">Understand</span> | log_min_duration |
| 12 | **[Zero-downtime schema changes](12-zero-downtime-ddl.md)** | <span className="db-tier t-understand">Understand</span> | add backfill constrain |
| 13 | **[Managed PostgreSQL](13-managed-postgres.md)** | <span className="db-tier t-understand">Understand</span> | RDS Neon Supabase |
| 14 | **[Row-level security](14-rls.md)** | <span className="db-tier t-know">Know</span> | policies |
| 15 | **[Physical backup PITR](15-physical-backup.md)** | <span className="db-tier t-know">Know</span> | WAL archiving |
| 16 | **[Logical replication](16-logical-replication.md)** | <span className="db-tier t-know">Know</span> | major upgrades |
| 17 | **[Major version upgrades](17-major-upgrades.md)** | <span className="db-tier t-know">Know</span> | pg_upgrade paths |
| 18 | **[Disaster drill](18-disaster-drill.md)** | <span className="db-tier t-know">Know</span> | restore on a schedule |

## Phase gate

Move on when secrets are safe, privileges are least, and you have restored a backup once.

---

← Syllabus: [Part 4](../../syllabus/04-performance-and-production.md) · Start → [Roles, GRANT and REVOKE](roles-grant/)
