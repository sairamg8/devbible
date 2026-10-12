---
title: "Link map · PostgreSQL · Part 5 (phases 12–13)"
sidebar_label: "05 · Beyond tables, Security and Ops (12–13)"
sidebar_position: 5
---

# Link map · PostgreSQL · Part 5 — Beyond plain tables, Security and operations (phases 12–13)

Covers every topic row of phases 12 and 13 in `docs/postgresql/syllabus/04-performance-and-production.md`: T12-01 to T12-19 (Beyond plain tables) and T13-01 to T13-18 (Security, operations and production). **All 37 rows have a page of ours (✅).**
*read* = I read the passage; *headings only* = fetched, headings/size checked. Third-party links carry a date where the page shows one. No `#anchors` are given.

🔴 **Version note.** postgresql.org/docs/current served **PostgreSQL 18.6** on 2026-10-12; our syllabus says **18.4** (minor drift only, same major 18). Official docs show a page date only in metadata, so only the fetch date is given. `github.com` returns 403 to our fetcher, so the pgvector and strong_migrations READMEs are cited as `raw.githubusercontent.com` copies. dzone.com returned 403, so it is never cited.

---

## Phase 12 — Beyond plain tables

### T12-01 · `jsonb` operators — Master · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/01-jsonb-operators/`
- **Read this:** [JSON Functions and Operators](https://www.postgresql.org/docs/current/functions-json.html) · postgresql.org · the operator tables (`->`, `@>`, `?`) and `jsonb_path_query` with its `vars` argument (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [JSON Types](https://www.postgresql.org/docs/current/datatype-json.html) · postgresql.org · containment and existence, `jsonpath` type (*headings only*) · fetched 2026-10-12

### T12-02 · When a column beats JSON — Master · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/02-column-vs-json.md`
- **Read this:** [JSON Types, section "Designing JSON Documents"](https://www.postgresql.org/docs/current/datatype-json.html) · postgresql.org · JSON can be "considerably more flexible" than the relational model, and both can coexist (*read* the opening of the section) · covers our angle: **partial** — states the trade-off, does not price the cost of getting it wrong · fetched 2026-10-12
- **Our delta:** the decision table (stable queried field means a column) and the planner-statistics and constraint costs; not confirmed in any page I read.
- *Checked, not chosen:* a Contentsquare blog post "when to avoid jsonb" (our fetch of it failed, connection error). *Not opened:* DEV Community and DZone summaries.

### T12-03 · Indexing `jsonb` — Understand · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/03-index-jsonb.md`
- **Read this:** [JSON Types, section "jsonb Indexing"](https://www.postgresql.org/docs/current/datatype-json.html) · postgresql.org · default GIN class versus `jsonb_path_ops` (no key-exists operators, supports `@>`, `@?`, `@@`) (*read*) · covers our angle: **partial** — no expression index on one hot key walkthrough in what I read · fetched 2026-10-12
- **Also good:** [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html) · postgresql.org · the expression-index syntax (*headings only*; synopsis seen) · fetched 2026-10-12

### T12-04 · Building JSON responses in SQL — Understand · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/04-build-json-sql.md`
- **Read this:** [JSON Functions and Operators](https://www.postgresql.org/docs/current/functions-json.html) · postgresql.org · `jsonb_build_object` takes alternating keys and values; `jsonb_agg` and `jsonb_object_agg` aggregate (*read*) · covers our angle: **partial** — a reference, no nested-response recipe; `row_to_json` not checked · fetched 2026-10-12
- **Our delta:** the nested-array-of-objects response pattern and the Node side.

### T12-05 · Full-text search — Understand · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/05-full-text/`
- **Read this:** [Introduction to Full Text Searching](https://www.postgresql.org/docs/current/textsearch-intro.html) · postgresql.org · `tsvector` for preprocessed documents, `tsquery` for queries, the `@@` match operator (*read*) · covers our angle: **partial** — ranking and the index are in the next pages · fetched 2026-10-12
- **Also good:** [Tables and Indexes](https://www.postgresql.org/docs/current/textsearch-tables.html) · postgresql.org · `CREATE INDEX ... USING GIN (to_tsvector('english', body))`; only the two-argument `to_tsvector` can be indexed (*read*) · [Controlling Text Search](https://www.postgresql.org/docs/current/textsearch-controls.html) · postgresql.org · `ts_rank` versus `ts_rank_cd` (*read* the ranking part) · fetched 2026-10-12

### T12-06 · `pg_trgm` similarity and fuzzy matching — Understand · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/06-pg-trgm.md`
- **Read this:** [pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) · postgresql.org · trigram indexes also support `LIKE`, `ILIKE`, `~`, `~*` and `=` (*read*) · covers our angle: full · fetched 2026-10-12

### T12-07 · Views — Understand · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/07-views.md`
- **Read this:** [CREATE VIEW](https://www.postgresql.org/docs/current/sql-createview.html) · postgresql.org · automatically updatable views and `WITH CHECK OPTION` (*read*) · covers our angle: **partial** — no page states "no parameters, no free performance" in one place · fetched 2026-10-12
- **Also good:** [Views (tutorial)](https://www.postgresql.org/docs/current/tutorial-views.html) · postgresql.org · a 300-word first example (*read*) · fetched 2026-10-12

### T12-08 · Triggers — Understand · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/08-triggers.md`
- **Read this:** [Overview of Trigger Behavior](https://www.postgresql.org/docs/current/trigger-definition.html) · postgresql.org · row-level versus statement-level; `BEFORE`, `AFTER`, `INSTEAD OF`; `TRUNCATE` is statement-level only (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Trigger Functions (PL/pgSQL)](https://www.postgresql.org/docs/current/plpgsql-trigger.html) · postgresql.org · `NEW` and `OLD` are null in statement-level triggers (*read*) · fetched 2026-10-12
- **Our delta:** the `updated_at` trigger as the honest use case.

### T12-09 · Extensions — Understand · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/09-extensions.md`
- **Read this:** [CREATE EXTENSION](https://www.postgresql.org/docs/current/sql-createextension.html) · postgresql.org · most extensions need superuser unless marked trusted, which any user with `CREATE` on the database can install (*read*) · covers our angle: **partial** — one extension at a time, nothing on managed providers · fetched 2026-10-12
- **Also good:** [Additional Supplied Modules](https://www.postgresql.org/docs/current/contrib.html) · postgresql.org · lists `pgcrypto`, `pg_stat_statements` and the rest (*headings only*) · [Supabase: Postgres Extensions](https://supabase.com/docs/guides/database/extensions) · Supabase docs · some extensions are pre-installed; enable or disable from the dashboard or SQL (*read*) · fetched 2026-10-12
- **Our delta:** `citext`, `uuid-ossp` and `pgvector` availability per provider; no page I read lists them all.

### T12-10 · Set-returning functions in `FROM` — Understand · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/10-srf.md`
- **Read this:** [Set Returning Functions](https://www.postgresql.org/docs/current/functions-srf.html) · postgresql.org · `generate_series` and the `unnest` examples (*read*) · covers our angle: **partial** — `jsonb_to_recordset` lives on another page · fetched 2026-10-12
- **Also good:** [JSON Functions and Operators](https://www.postgresql.org/docs/current/functions-json.html) · postgresql.org · `jsonb_to_recordset` needs an `AS` column list (*read*) · fetched 2026-10-12

### T12-11 · Materialized views and `REFRESH ... CONCURRENTLY` — Know · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/11-matviews.md`
- **Read this:** [REFRESH MATERIALIZED VIEW](https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html) · postgresql.org · `CONCURRENTLY` needs a UNIQUE index of plain columns and an already populated view; one refresh at a time (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Materialized Views](https://www.postgresql.org/docs/current/rules-materializedviews.html) · postgresql.org · how they differ from views (*headings only*, 915 words) · fetched 2026-10-12

### T12-12 · PL/pgSQL functions — Know · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/12-plpgsql.md`
- **Read this:** [PL/pgSQL Overview](https://www.postgresql.org/docs/current/plpgsql-overview.html) · postgresql.org · grouping queries inside the server saves client/server round trips (*read*) · covers our angle: **partial** — the case for it, little on "when not to" · fetched 2026-10-12
- **Also good:** [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html) · postgresql.org · `RETURNS TABLE (...)` syntax, volatility, `SECURITY DEFINER` (*read* the synopsis) · fetched 2026-10-12

### T12-13 · `LISTEN`/`NOTIFY` — Know · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/13-listen-notify.md`
- **Read this:** [NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html) · postgresql.org · delivered only on commit, in commit order, duplicates folded; send a record key rather than the data; a full queue fails commits (*read*) · covers our angle: **partial** — the at-most-once consequence is inferred from the listener rules, not stated as a headline · fetched 2026-10-12
- **Our delta:** the Node `pg` client's `notification` event and reconnect handling.

### T12-14 · Partitioning — Know · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/14-partitioning.md`
- **Read this:** [Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) · postgresql.org · range, list, hash; pruning; the rule of thumb that a table should exceed the server's physical memory (*read*) · covers our angle: full · fetched 2026-10-12

### T12-15 · Procedures versus functions — When Needed · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/15-procedures.md`
- **Read this:** [CREATE PROCEDURE](https://www.postgresql.org/docs/current/sql-createprocedure.html) · postgresql.org · a `SECURITY DEFINER` procedure cannot run `COMMIT` or `ROLLBACK` (*read*) · covers our angle: **partial** — the function side is on another page · fetched 2026-10-12
- **Also good:** [CREATE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html) · postgresql.org · (*read* the synopsis) · fetched 2026-10-12

### T12-16 · Foreign data wrappers, `postgres_fdw` and `dblink` — When Needed · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/16-fdw.md`
- **Read this:** [postgres_fdw](https://www.postgresql.org/docs/current/postgres-fdw.html) · postgresql.org · access to data on external PostgreSQL servers (≈5,900 words, *headings only*) · covers our angle: **partial** — `dblink` is a separate page · fetched 2026-10-12
- **Also good:** [dblink](https://www.postgresql.org/docs/current/contrib-dblink-function.html) · postgresql.org · (*headings only*, 835 words) · fetched 2026-10-12

### T12-17 · `pgvector` — When Needed · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/17-pgvector.md`
- **Read this:** [pgvector README (raw)](https://raw.githubusercontent.com/pgvector/pgvector/master/README.md) · github (raw) · distances (L2, inner product, cosine, L1, Hamming, Jaccard); HNSW is faster than IVFFlat at the cost of build time and memory; `hnsw.ef_search` defaults to 40 (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the Node `pg` side (passing a vector as text); the README lists the operators `<->` (L2), `<#>` (negative inner product), `<=>` (cosine) and `<+>` (L1).

### T12-18 · The transactional outbox — Understand · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/18-transactional-outbox.md`
- **Read this:** [The Transactional Outbox Pattern: Reliable Events Without Distributed Transactions](https://ndthuan.com/transactional-outbox-pattern/) · ndthuan.com, 2026-09-04 · same-transaction write, then claim unpublished rows with `SKIP LOCKED`, publish, mark (*read*) · covers our angle: **partial** — Go, not Node · fetched 2026-10-12
- **Also good:** [Pattern: Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html) · microservices.io, undated · after a crash the message is published again, so consumers must be idempotent (*read*) · [SELECT, locking clause](https://www.postgresql.org/docs/current/sql-select.html) · postgresql.org · `FOR UPDATE ... SKIP LOCKED` in the synopsis (*headings only*) · fetched 2026-10-12

### T12-19 · Audit and history tables — Understand · ✅ written `docs/postgresql/pages/phase-12-beyond-tables/19-audit-history-tables.md`
- **Read this:** [Audit trigger 91plus](https://wiki.postgresql.org/wiki/Audit_trigger_91plus) · PostgreSQL wiki, last edited 4 Nov 2017 · what it records: change type, session user (not `SET ROLE`), timestamps, top-level statement, before/after rows (*read*) · covers our angle: **partial** — a library snippet, built on `hstore` rather than `jsonb`, and old (9.1+) · fetched 2026-10-12
- **Also good:** [Trigger Functions (PL/pgSQL), Example 41.4](https://www.postgresql.org/docs/current/plpgsql-trigger.html) · postgresql.org · a minimal audit trigger into `emp_audit` (*read*) · [Postgres Auditing in 150 lines of SQL](https://supabase.com/blog/postgres-audit) · Supabase blog, 8 Mar 2022 · a single `jsonb` audit table (*headings only*) · fetched 2026-10-12
- **Our delta:** why the app cannot be trusted to write history; the trigger answers it.

---

## Phase 13 — Security, operations and production

### T13-01 · Roles, `GRANT` and `REVOKE` — Master · ✅ written `docs/postgresql/pages/phase-13-ops/01-roles-grant/`
- **Read this:** [Privileges](https://www.postgresql.org/docs/current/ddl-priv.html) · postgresql.org · owner by default; `PUBLIC` gets `CONNECT`, `TEMPORARY`, `EXECUTE` on functions (*read*) · covers our angle: **partial** — default privileges are a separate page · fetched 2026-10-12
- **Also good:** [ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html) · postgresql.org · (*headings only*) · [Database Roles](https://www.postgresql.org/docs/current/user-manag.html) · postgresql.org · chapter index (*headings only*) · fetched 2026-10-12

### T13-02 · Secrets — Master · ✅ written `docs/postgresql/pages/phase-13-ops/02-secrets/`
- **Read this:** [Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) · OWASP · centralise storage, rotation and auditing; hard-coded secrets in code and config are the leak (*read* the intro and contents) · covers our angle: **partial** — not PostgreSQL-specific, nothing on connection strings in error messages · fetched 2026-10-12
- **Also good:** [The Password File](https://www.postgresql.org/docs/current/libpq-pgpass.html) · postgresql.org · `.pgpass` keeps passwords out of the URL (*read*) · fetched 2026-10-12

### T13-03 · The application role should not own the schema — Understand · ✅ written `docs/postgresql/pages/phase-13-ops/03-app-role-not-owner.md`
- **Read this:** [Auditing Users and Roles in PostgreSQL](https://www.enterprisedb.com/blog/auditing-users-and-roles-postgresql) · EDB, 11 May 2019 · section "Owner is a small superuser": the role should not be superuser and should not own the objects, because owners can grant themselves anything (*read*) · covers our angle: **partial** — a security-audit checklist, no web-app walkthrough of a migration role versus a runtime role · fetched 2026-10-12
- **Also good:** [Privileges](https://www.postgresql.org/docs/current/ddl-priv.html) · postgresql.org · (*read*) · fetched 2026-10-12

### T13-04 · `pg_dump` and `pg_restore` — Master · ✅ written `docs/postgresql/pages/phase-13-ops/04-pg-dump-restore/`
- **Read this:** [pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html) · postgresql.org · custom and directory formats allow selecting and reordering, parallel restore; only directory supports parallel dump (*read*) · covers our angle: **partial** — the restore side is on `pg_restore` · fetched 2026-10-12
- **Also good:** [pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html) · postgresql.org · `--list` and `--use-list` to restore chosen items (*read*) · [SQL Dump](https://www.postgresql.org/docs/current/backup-dump.html) · postgresql.org · owning roles must exist before restore (*read*) · fetched 2026-10-12

### T13-05 · `pg_hba.conf` — Understand · ✅ written `docs/postgresql/pages/phase-13-ops/05-pg-hba.md`
- **Read this:** [The pg_hba.conf File](https://www.postgresql.org/docs/current/auth-pg-hba-conf.html) · postgresql.org · first matching line wins; `scram-sha-256`; MD5 support deprecated (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Password Authentication](https://www.postgresql.org/docs/current/auth-password.html) · postgresql.org · SCRAM prevents password sniffing (*read*) · fetched 2026-10-12

### T13-06 · TLS to the database — Understand · ✅ written `docs/postgresql/pages/phase-13-ops/06-tls.md`
- **Read this:** [SSL Support (libpq)](https://www.postgresql.org/docs/current/libpq-ssl.html) · postgresql.org · `verify-ca` checks the chain, `verify-full` also checks the host name; `require` validates only if a root CA file exists (*read*) · covers our angle: **partial** — nothing on managed-provider certificates, nothing on `pg` options · fetched 2026-10-12
- **Our delta:** the Node `ssl` option and provider CA bundles.

### T13-07 · Connection limits and PgBouncer — Understand · ✅ written `docs/postgresql/pages/phase-13-ops/07-pgbouncer/`
- **Read this:** [PgBouncer features](https://www.pgbouncer.org/features.html) · pgbouncer.org · session versus transaction pooling and a feature-by-mode table (`SET`, `PREPARE`, advisory locks break in transaction mode) (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [PgBouncer configuration](https://www.pgbouncer.org/config.html) · pgbouncer.org · `pool_mode` session, transaction, statement (*read*) · [Connection settings](https://www.postgresql.org/docs/current/runtime-config-connection.html) · postgresql.org · `max_connections` defaults to about 100 (*read*) · fetched 2026-10-12

### T13-08 · Streaming replication and read replicas — Understand · ✅ written `docs/postgresql/pages/phase-13-ops/08-replication/`
- **Read this:** [Read your own writes, off the primary](https://boringsql.com/posts/read-your-own-writes/) · boringSQL, 2026-08-31 · measured: reading the replica at once was stale in 992 of 1,000 tries; LSN tokens and `WAIT FOR` (*read*) · covers our angle: **partial** — routing and lag, not building a replica; `WAIT FOR LSN` is a PostgreSQL 19 feature (tested by the author on 19 beta 3), not in our 18 · fetched 2026-10-12
- **Also good:** [Log-Shipping Standby Servers](https://www.postgresql.org/docs/current/warm-standby.html) · postgresql.org · streaming replication, slots, synchronous replication (*headings only*) · [Hot Standby](https://www.postgresql.org/docs/current/hot-standby.html) · postgresql.org · read-only queries on a standby (*headings only*) · fetched 2026-10-12

### T13-09 · Monitoring — Understand · ✅ written `docs/postgresql/pages/phase-13-ops/09-monitoring/`
- **Read this:** [The Cumulative Statistics System](https://www.postgresql.org/docs/current/monitoring-stats.html) · postgresql.org · `pg_stat_activity`, `pg_stat_database` (`blks_hit` and `blks_read` give the cache hit ratio), `pg_stat_user_tables` (*read*) · covers our angle: **partial** — column reference, no triage recipes · fetched 2026-10-12
- **Also good:** [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html) · postgresql.org · (*headings only*, 3,400 words) · fetched 2026-10-12

### T13-10 · Key configuration — Understand · ✅ written `docs/postgresql/pages/phase-13-ops/10-config-keys/`
- **Read this:** [Resource Consumption](https://www.postgresql.org/docs/current/runtime-config-resource.html) · postgresql.org · `shared_buffers` (default typically 128MB) and `work_mem` (default 4MB, per sort or hash operation) (*read*) · covers our angle: **partial** — `effective_cache_size` and `max_connections` are on other pages · fetched 2026-10-12
- **Also good:** [Planner Cost Constants and query tuning](https://www.postgresql.org/docs/current/runtime-config-query.html) · postgresql.org · `effective_cache_size`, the planner's assumption about disk cache for one query (*read*) · [Connection settings](https://www.postgresql.org/docs/current/runtime-config-connection.html) · postgresql.org · `max_connections`, set only at server start (*read*) · fetched 2026-10-12

### T13-11 · Logging — Understand · ✅ written `docs/postgresql/pages/phase-13-ops/11-logging/`
- **Read this:** [Error Reporting and Logging](https://www.postgresql.org/docs/current/runtime-config-logging.html) · postgresql.org · `log_min_duration_statement`: log statements running at least that long, for example 250ms (*read*) · covers our angle: **partial** — a parameter reference; `auto_explain` is another module · fetched 2026-10-12

### T13-12 · Zero-downtime schema changes — Understand · ✅ written `docs/postgresql/pages/phase-13-ops/12-zero-downtime-ddl/`
- **Read this:** [Zero-downtime Postgres migrations: the hard parts](https://gocardless.com/blog/zero-downtime-postgres-migrations-the-hard-parts) · GoCardless, page metadata 2019-07-08 (modified 2024-06-27) · an `ACCESS EXCLUSIVE` lock waiting in the queue blocks every later query on the table; set `lock_timeout` (*read*) · covers our angle: **partial** — old post, no add/backfill/constrain ordering for current versions · fetched 2026-10-12
- **Also good:** [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) · postgresql.org · `ACCESS EXCLUSIVE` unless noted per subform; `NOT VALID` then `VALIDATE CONSTRAINT` (*read*) · [strong_migrations README (raw)](https://raw.githubusercontent.com/ankane/strong_migrations/master/README.md) · github (raw) · per-operation safe-versus-unsafe list, `lock_timeout` advice (*read*; Rails-flavoured) · fetched 2026-10-12
- *Checked, not chosen:* [part 2, "a little help"](https://gocardless.com/blog/zero-downtime-postgres-migrations-a-little-help) (same date, `lock_timeout` and `statement_timeout`, *read*); [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html) for `CONCURRENTLY` (synopsis only).

### T13-13 · Managed PostgreSQL — Understand · ✅ written `docs/postgresql/pages/phase-13-ops/13-managed-postgres/`
- **Read this:** [Neon: Postgres compatibility](https://neon.com/docs/reference/compatibility) · Neon docs · no host access and no true superuser; a `neon_superuser` role instead; `track_commit_timestamp` unsupported (*read*) · covers our angle: **partial** — one provider only · fetched 2026-10-12
- **Also good:** [RDS: roles and the rds_superuser role](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Appendix.PostgreSQL.CommonDBATasks.Roles.html) · AWS docs · the first user is a member of `rds_superuser` (*read* the intro) · [Supabase: Postgres Extensions](https://supabase.com/docs/guides/database/extensions) · Supabase docs · (*read*) · fetched 2026-10-12
- **Our delta:** a side-by-side of what each provider withholds; no single page gives it.

### T13-14 · Row-level security — Know · ✅ written `docs/postgresql/pages/phase-13-ops/14-rls/`
- **Read this:** [Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) · postgresql.org · no policy means default-deny; the table owner is typically exempt; per-command policies (*read*) · covers our angle: **partial** — no multi-tenant recipe or Node identity pattern · fetched 2026-10-12

### T13-15 · Physical backup, WAL archiving and PITR — Know · ✅ written `docs/postgresql/pages/phase-13-ops/15-physical-backup/`
- **Read this:** [Continuous Archiving and Point-in-Time Recovery](https://www.postgresql.org/docs/current/continuous-archiving.html) · postgresql.org · `wal_level` replica or higher, `archive_mode`, `archive_command` with `%p` and `%f` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [pg_verifybackup](https://www.postgresql.org/docs/current/app-pgverifybackup.html) · postgresql.org · (*read*) · fetched 2026-10-12

### T13-16 · Logical replication — Know · ✅ written `docs/postgresql/pages/phase-13-ops/16-logical-replication.md`
- **Read this:** [Logical Replication: Quick Setup](https://www.postgresql.org/docs/current/logical-replication-quick-setup.html) · postgresql.org · `CREATE PUBLICATION` then `CREATE SUBSCRIPTION`, initial sync, then streaming (*read*) · covers our angle: **partial** — nothing on the upgrade use · fetched 2026-10-12
- **Also good:** [Restrictions](https://www.postgresql.org/docs/current/logical-replication-restrictions.html) · postgresql.org · schema and DDL are not replicated (*read*) · [Upgrading via Replication](https://www.postgresql.org/docs/current/upgrading.html) · postgresql.org · logical replication works across major versions (*read*) · fetched 2026-10-12

### T13-17 · Major version upgrades — Know · ✅ written `docs/postgresql/pages/phase-13-ops/17-major-upgrades.md`
- **Read this:** [Upgrading a PostgreSQL Cluster](https://www.postgresql.org/docs/current/upgrading.html) · postgresql.org · the three routes: `pg_dumpall`, `pg_upgrade`, replication (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [pg_upgrade](https://www.postgresql.org/docs/current/pgupgrade.html) · postgresql.org · `--check` changes nothing; `--link` uses hard links (*read*) · fetched 2026-10-12

### T13-18 · The disaster drill — Know · ✅ written `docs/postgresql/pages/phase-13-ops/18-disaster-drill.md`
- **Read this:** [How to Test PostgreSQL Backup Restoration](https://oneuptime.com/blog/post/2026-01-21-postgresql-backup-testing/view) · OneUptime, 2026-01-21 · tiered checks from file existence up to full restore, with scripts (*headings only*, then the `pg_restore -l` script *read*) · covers our angle: **partial** — vendor blog, scripts not run by us · fetched 2026-10-12
- **Also good:** [pg_verifybackup](https://www.postgresql.org/docs/current/app-pgverifybackup.html) · postgresql.org · its checks do not cover everything; "still perform test restores" (*read*) · [amcheck](https://www.postgresql.org/docs/current/amcheck.html) · postgresql.org · tools to verify table and index consistency (*headings only*) · fetched 2026-10-12
- **Our delta:** the scheduled scratch-database restore as one script.
