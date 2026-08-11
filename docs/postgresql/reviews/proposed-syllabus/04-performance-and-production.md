---
title: "Part 4 — Performance and production"
sidebar_label: "4 · Performance & production"
sidebar_position: 14
---

> **Phases 10–13 · 68 topics · 13 Master**
> What you need when the app works but is slow, when two requests collide, and
> when it has to survive in production.

The largest part, and the one most defensible to defer — see the
[sizing note](./README.md#sizing). Master is deliberately thin here: this is
material you must be able to *reason about*, not type from memory.

Every phase still answers the Node question: what does this mean for the process
holding the pool?

---

## Phase 10 — Indexes and the query planner

*17 topics.* Taught after the SQL phases on purpose — an index only makes sense
once you can see the scan it replaces. The "why is my index not used" row is the
single highest-value page in the syllabus.

| Topic | Tier |
|---|---|
| **What an index is** — and the write cost you pay on every insert for the reads you speed up | <span className="db-tier t-master">Master</span> |
| **B-tree** — the default, and everything it can serve: equality, range, sort order, prefix `LIKE` | <span className="db-tier t-master">Master</span> |
| **`EXPLAIN` vs `EXPLAIN ANALYZE`** — reading a plan, and the fact that `ANALYZE` actually runs the query | <span className="db-tier t-master">Master</span> |
| **Seq scan vs index scan vs bitmap heap scan** — and when a sequential scan is the *correct* plan | <span className="db-tier t-master">Master</span> |
| **Why an index is not being used** — type mismatch, a function wrapping the column, low selectivity, stale statistics | <span className="db-tier t-master">Master</span> |
| **Multicolumn indexes and column order** — the leftmost-prefix rule, and why `(a,b)` will not serve a query on `b` | <span className="db-tier t-understand">Understand</span> |
| `EXPLAIN (ANALYZE, BUFFERS)` — estimated versus actual rows, and spotting where the planner was wrong | <span className="db-tier t-understand">Understand</span> |
| **Index-only scans** and the visibility map | <span className="db-tier t-understand">Understand</span> |
| **Partial indexes** — `WHERE deleted_at IS NULL`, and matching the query's predicate exactly | <span className="db-tier t-understand">Understand</span> |
| **Expression indexes** — `lower(email)`, and the query that must match it character for character | <span className="db-tier t-understand">Understand</span> |
| `GIN` for `jsonb`, arrays and full-text; `pg_trgm` to make `LIKE '%x%'` indexable | <span className="db-tier t-understand">Understand</span> |
| **`CREATE INDEX CONCURRENTLY`** — adding an index without locking out writes, and its failure mode | <span className="db-tier t-understand">Understand</span> |
| Finding unused and duplicate indexes with `pg_stat_user_indexes` | <span className="db-tier t-understand">Understand</span> |
| **`pg_stat_statements`** — finding the queries that actually cost you, rather than the ones you suspect | <span className="db-tier t-understand">Understand</span> |
| `GiST`, `BRIN` and `hash` — what each is genuinely for | <span className="db-tier t-know">Know</span> |
| Statistics, `ANALYZE`, `default_statistics_target`, and extended statistics for correlated columns | <span className="db-tier t-know">Know</span> |
| Index bloat and `REINDEX CONCURRENTLY` | <span className="db-tier t-know">Know</span> |

---

## Phase 11 — Transactions, MVCC and concurrency

*16 topics.* The phase that explains bugs you cannot reproduce. Lost update is
promoted to Master because every application hits it and most "fix" it by
accident.

| Topic | Tier |
|---|---|
| **ACID, concretely, in PostgreSQL terms** — not the textbook definition | <span className="db-tier t-master">Master</span> |
| **`BEGIN`/`COMMIT`/`ROLLBACK`** — and what autocommit means from `pg` | <span className="db-tier t-master">Master</span> |
| **`READ COMMITTED`** — the default, what it guarantees, and the anomalies it still allows | <span className="db-tier t-master">Master</span> |
| **Lost update** — the read-modify-write bug, shown failing, and three real fixes | <span className="db-tier t-master">Master</span> |
| **MVCC** — snapshots and row versions, and why readers never block writers | <span className="db-tier t-understand">Understand</span> |
| `REPEATABLE READ` and `SERIALIZABLE` — and the serialization failures your Node code must retry | <span className="db-tier t-understand">Understand</span> |
| **Row locks** — `FOR UPDATE`, `FOR NO KEY UPDATE`, `FOR SHARE` | <span className="db-tier t-understand">Understand</span> |
| **`SKIP LOCKED`** — the job-queue-in-PostgreSQL pattern *(queue design: Node Phase 7)* | <span className="db-tier t-understand">Understand</span> |
| Savepoints and partial rollback | <span className="db-tier t-understand">Understand</span> |
| Table-level locks, and which DDL statement blocks which operations | <span className="db-tier t-understand">Understand</span> |
| **Deadlocks** — how two transactions create one, how PostgreSQL resolves it, and the ordering rule that prevents it | <span className="db-tier t-understand">Understand</span> |
| **Long-running transactions** — why they block vacuum and bloat tables | <span className="db-tier t-understand">Understand</span> |
| **`VACUUM`, autovacuum, dead tuples and bloat** | <span className="db-tier t-understand">Understand</span> |
| **Idle-in-transaction** — the leaked `BEGIN` from Node, and `idle_in_transaction_session_timeout` | <span className="db-tier t-understand">Understand</span> |
| Advisory locks — application-level mutexes that live in the database | <span className="db-tier t-know">Know</span> |
| Transaction id wraparound — the failure you must never actually reach | <span className="db-tier t-know">Know</span> |

---

## Phase 12 — Beyond plain tables

*17 topics.* PostgreSQL's differentiators. The JSON rows are Master-tier because
the schema-versus-document decision is made early and lived with for years.

| Topic | Tier |
|---|---|
| **`jsonb` operators** — `->`, `->>`, `#>`, `@>`, `?`, and `jsonb_path_query` | <span className="db-tier t-master">Master</span> |
| **When a column beats JSON** — the schema-versus-document decision, and the cost of getting it wrong | <span className="db-tier t-master">Master</span> |
| **Indexing `jsonb`** — GIN, `jsonb_path_ops`, and an expression index on one hot key | <span className="db-tier t-understand">Understand</span> |
| Building JSON responses in SQL — `jsonb_build_object`, `jsonb_agg`, `row_to_json` | <span className="db-tier t-understand">Understand</span> |
| **Full-text search** — `tsvector`, `tsquery`, `to_tsvector`, ranking, and the GIN index it needs | <span className="db-tier t-understand">Understand</span> |
| `pg_trgm` similarity and fuzzy matching — doing `ILIKE '%x%'` without a full scan | <span className="db-tier t-understand">Understand</span> |
| **Views** — naming a query, and their limits (no parameters, no free performance) | <span className="db-tier t-understand">Understand</span> |
| **Triggers** — `BEFORE`/`AFTER`, row versus statement, and `updated_at` as the honest use case | <span className="db-tier t-understand">Understand</span> |
| **Extensions** — `pgcrypto`, `uuid-ossp`, `citext`, `pg_stat_statements`, `pg_trgm`, `pgvector`; `CREATE EXTENSION` and what a managed provider allows | <span className="db-tier t-understand">Understand</span> |
| Set-returning functions in `FROM` — `generate_series`, `unnest`, `jsonb_to_recordset` | <span className="db-tier t-understand">Understand</span> |
| Materialized views and `REFRESH MATERIALIZED VIEW CONCURRENTLY` | <span className="db-tier t-know">Know</span> |
| **PL/pgSQL functions** — syntax, `RETURNS TABLE`, and when logic genuinely belongs in the database | <span className="db-tier t-know">Know</span> |
| **`LISTEN`/`NOTIFY`** — push from the database to Node, and its at-most-once nature *(compare: Redis pub/sub)* | <span className="db-tier t-know">Know</span> |
| **Partitioning** — range, list and hash; partition pruning, and how big a table must be to justify it | <span className="db-tier t-know">Know</span> |
| Procedures versus functions, and transaction control inside a procedure | <span className="db-tier t-when">When Needed</span> |
| Foreign data wrappers, `postgres_fdw` and `dblink` | <span className="db-tier t-when">When Needed</span> |
| `pgvector` — embeddings, distance operators, and HNSW indexes | <span className="db-tier t-when">When Needed</span> |

---

## Phase 13 — Security, operations and production

*18 topics.* The gap between "works on my machine" and "runs for three years".
Backups are Master because an unrestored backup is not a backup.

| Topic | Tier |
|---|---|
| **Roles, `GRANT` and `REVOKE`** — table, column, schema and default privileges | <span className="db-tier t-master">Master</span> |
| **Secrets** — keeping the connection string out of the repo, and out of logs and error messages | <span className="db-tier t-master">Master</span> |
| **The application role should not own the schema** — least privilege for a web app, and what it prevents | <span className="db-tier t-understand">Understand</span> |
| **`pg_dump` and `pg_restore`** — logical backups, the format choice, and restoring a single table | <span className="db-tier t-understand">Understand</span> |
| `pg_hba.conf` — authentication methods, `scram-sha-256`, and host rules | <span className="db-tier t-understand">Understand</span> |
| **TLS to the database** — `sslmode` values, what `require` does *not* verify, and managed-provider certificates | <span className="db-tier t-understand">Understand</span> |
| **Connection limits and PgBouncer** — transaction versus session pooling, and what breaks under each *(pool sizing: Node Phase 6)* | <span className="db-tier t-understand">Understand</span> |
| **Streaming replication and read replicas** — replication lag, and the read-your-writes problem it creates | <span className="db-tier t-understand">Understand</span> |
| **Monitoring** — `pg_stat_activity`, `pg_stat_database`, `pg_stat_user_tables`, and cache hit ratio | <span className="db-tier t-understand">Understand</span> |
| Key configuration — `shared_buffers`, `work_mem`, `max_connections`, `effective_cache_size` | <span className="db-tier t-understand">Understand</span> |
| **Logging** — `log_min_duration_statement`, and finding the slow query in production | <span className="db-tier t-understand">Understand</span> |
| **Zero-downtime schema changes** — the lock each `ALTER` takes, and the safe ordering for add/backfill/constrain | <span className="db-tier t-understand">Understand</span> |
| **Managed PostgreSQL** — RDS, Neon, Supabase: what you give up, what changes, and superuser-only features you lose | <span className="db-tier t-understand">Understand</span> |
| **Row-level security** — policies, and multi-tenant isolation enforced by the database | <span className="db-tier t-know">Know</span> |
| Physical backup, WAL archiving and point-in-time recovery | <span className="db-tier t-know">Know</span> |
| Logical replication, and how it enables a near-zero-downtime major upgrade | <span className="db-tier t-know">Know</span> |
| Major version upgrades — `pg_upgrade` versus dump/restore versus logical replication | <span className="db-tier t-know">Know</span> |
| **The disaster drill** — restoring a backup into a scratch database and verifying it, on a schedule | <span className="db-tier t-know">Know</span> |

---

## Where this connects

- **Phase 10 → Phase 9** — the indexes that make `list` endpoints and keyset
  pagination fast.
- **Phase 11 → Node Phase 7** — `SKIP LOCKED` is the database-side of the job
  queue; BullMQ/Redis is the alternative, already written.
- **Phase 13 → Node Phase 11 (Deployment)** — migrations at deploy time and
  health checks are already written there; this phase supplies the database half.
- **Phase 13 → Docker/Podman and Nginx syllabi** — container and edge concerns
  are named here but owned there.
- **Deliberately not here:** application-level caching strategy (Redis), and
  circuit breakers or bulkheads, which
  the scope-boundaries rule keeps project-based.

---

← [Part 3 — Node + raw `pg`](./03-node-and-pg.md) · [Overview](./README.md)
