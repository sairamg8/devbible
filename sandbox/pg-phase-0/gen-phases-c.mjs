import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'docs/postgresql/pages';
function w(dir, file, content) {
  fs.mkdirSync(path.join(ROOT, dir), {recursive: true});
  fs.writeFileSync(path.join(ROOT, dir, file), content);
}
function mkPhase(dir, phaseTitle, syllabusLink, rows, gate) {
  rows.forEach((r, i) => {
    const prev = i > 0 ? rows[i - 1] : null;
    const next = i < rows.length - 1 ? rows[i + 1] : null;
    const label = `${String(i + 1).padStart(2, '0')} · ${r.short || r.title}`.slice(0, 48);
    const iq = r.iq || `**★ Takeaway?**  
${r.lead}

**Node?**  
Slow queries show up as slow API handlers — EXPLAIN in psql, fix SQL/indexes, keep pool healthy.`;
    w(dir, r.file, `---
title: "${r.title}"
sidebar_label: "${label.replace(/"/g, '')}"
sidebar_position: ${i + 1}
---

<span className="db-tier t-${r.tk}">${r.tier}</span>

**${r.lead}**

${r.body}

## Interview questions

${iq}

---

${prev ? `← [${prev.title}](${prev.file})` : `← [Phase index](README.md)`} · ${next ? `Next → [${next.title}](${next.file})` : `[Phase index](README.md)`}
`);
  });
  w(dir, 'README.md', `---
title: "${phaseTitle}"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: PostgreSQL 18.4 · Node 24 · \`pg\`.**

| # | Page | Tier | In one line |
|---|---|---|---|
${rows.map((r,i)=>`| ${String(i+1).padStart(2,'0')} | **[${r.title}](${r.file})** | <span className="db-tier t-${r.tk}">${r.tier}</span> | ${r.one} |`).join('\n')}

## Phase gate

${gate}

---

← Syllabus: [${syllabusLink[0]}](${syllabusLink[1]}) · Start → [${rows[0].title}](${rows[0].file})
`);
  return rows.length;
}
const R = (file, title, short, tier, tk, one, lead, body) => ({file, title, short, tier, tk, one, lead, body});

const p10 = [
  R('01-what-index.md','What an index is','Indexes','Master','master','write cost',
    'An index speeds reads you plan for and costs writes on every insert/update/delete.',
    `No free lunch — measure both sides.`),
  R('02-btree.md','B-tree indexes','B-tree','Master','master','default index',
    'B-tree is the default: equality, range, sort order, prefix LIKE.',
    `Most application indexes are B-tree.`),
  R('03-explain.md','EXPLAIN vs EXPLAIN ANALYZE','EXPLAIN','Master','master','ANALYZE runs it',
    'EXPLAIN shows the plan; EXPLAIN ANALYZE executes and shows actual times/rows.',
    `Never EXPLAIN ANALYZE a destructive query on prod without care.`),
  R('04-scan-types.md','Seq vs index vs bitmap','Scans','Master','master','seq can be correct',
    'Sequential scan can be the right plan for large fractions of a table.',
    `Measured: Bitmap Index Scan on measure_orders_user_id_idx for user_id = 1.`),
  R('05-index-not-used.md','Why an index is not used','Not used','Master','master','highest-value page',
    'Type mismatch, functions on the column, low selectivity, stale stats — classic reasons indexes are ignored.',
    `## Gotchas

**Symptom:** Index exists, seq scan forever  
**Cause:** \`WHERE lower(email) =\` without expression index; or wrong type  
**Fix:** Match predicate to index; ANALYZE; fix types`),
  R('06-multicolumn.md','Multicolumn indexes','Multicolumn','Understand','understand','leftmost prefix',
    'Column order matters: (a,b) serves a and a,b — not b alone.',
    `Put equality columns first in common patterns.`),
  R('07-explain-buffers.md','EXPLAIN ANALYZE BUFFERS','BUFFERS','Understand','understand','est vs actual',
    'BUFFERS and actual vs estimated rows show where the planner was wrong.',
    `Large mis-estimates → bad plans; fix stats or rewrite SQL.`),
  R('08-index-only.md','Index-only scans and INCLUDE','Index-only','Understand','understand','INCLUDE covering',
    'Index-only scans use the index and visibility map; INCLUDE adds non-key columns for covering indexes.',
    `CREATE INDEX ON t (id) INCLUDE (email) style covering.`),
  R('09-partial.md','Partial indexes','Partial','Understand','understand','hot subsets',
    'Partial indexes match a WHERE predicate — e.g. WHERE deleted_at IS NULL.',
    `Query predicate must match enough to use the index.`),
  R('10-expression.md','Expression indexes','Expression','Understand','understand','lower(email)',
    'Expression indexes require the query to match the expression exactly.',
    `lower(email) index needs WHERE lower(email) = $1.`),
  R('11-gin-trgm.md','GIN jsonb arrays FTS trgm','GIN','Understand','understand','jsonb and LIKE',
    'GIN supports jsonb/arrays/FTS; pg_trgm can make %x% searchable.',
    `Not free — write amplification and size.`),
  R('12-concurrently.md','CREATE INDEX CONCURRENTLY','CONCURRENTLY','Understand','understand','no write lock',
    'CONCURRENTLY builds without long write locks; failure modes leave invalid indexes.',
    `Check pg_indexes / invalid indexes after failures.`),
  R('13-unused-indexes.md','Unused and duplicate indexes','Unused','Understand','understand','pg_stat_user_indexes',
    'Find unused/duplicate indexes with pg_stat_user_indexes before dropping carefully.',
    `Stats reset on restart depending on config.`),
  R('14-pg-stat-statements.md','pg_stat_statements','stat_statements','Understand','understand','real hot queries',
    'pg_stat_statements finds the queries that actually cost you.',
    `Enable the extension in dev/staging and production carefully.`),
  R('15-gist-brin-hash.md','GiST BRIN hash','Other indexes','Know','know','when each fits',
    'GiST for ranges/geo, BRIN for huge append-only time series, hash rarely needed.',
    `Default remains B-tree for CRUD.`),
  R('16-statistics.md','Statistics and ANALYZE','Statistics','Know','know','extended stats',
    'ANALYZE, default_statistics_target, extended statistics for correlated columns.',
    `Planner is only as good as its stats.`),
  R('17-bloat-reindex.md','Index bloat REINDEX','Bloat','Know','know','REINDEX CONCURRENTLY',
    'Indexes bloat; REINDEX CONCURRENTLY rebuilds with less locking.',
    `Ops territory paired with vacuum (Phase 11).`),
  // FK indexing explicit page (from re-review - user said complete syllabus pages; I'll include as it's critical and was a gap - actually user said park re-review. Skip extra topic. We have 17 topics in syllabus - I have 17 above. Good.)
];

const p11 = [
  R('01-acid.md','ACID in PostgreSQL','ACID','Master','master','concrete not textbook',
    'ACID in PostgreSQL terms: transactions, durability via WAL, isolation levels, constraints.',
    `Not marketing slides — default READ COMMITTED realities.`),
  R('02-begin-commit.md','BEGIN COMMIT ROLLBACK','BEGIN','Master','master','autocommit from pg',
    'Each pool.query is auto-commit unless you BEGIN on a held client.',
    `Node must hold one client across the transaction.`),
  R('03-read-committed.md','READ COMMITTED','READ COMMITTED','Master','master','default anomalies',
    'READ COMMITTED is the default — know what it allows (non-repeatable reads).',
    `Many apps are fine here; know when to raise isolation.`),
  R('04-lost-update.md','Lost update','Lost update','Master','master','read-modify-write',
    'Lost update is the classic RMW bug — show it failing and three fixes.',
    `Fixes: atomic UPDATE, optimistic version, SELECT FOR UPDATE.`),
  R('05-mvcc.md','MVCC snapshots','MVCC','Understand','understand','readers vs writers',
    'MVCC versions rows so readers do not block writers (generally).',
    `Dead tuples need vacuum.`),
  R('06-isolation-levels.md','REPEATABLE READ SERIALIZABLE','Isolation','Understand','understand','retry 40001',
    'Higher isolation can throw serialization failures — Node must retry safely.',
    `SQLSTATE 40001.`),
  R('07-row-locks.md','Row locks FOR UPDATE','Row locks','Understand','understand','lock modes',
    'FOR UPDATE / NO KEY UPDATE / SHARE control what concurrent txs may do.',
    `Hold locks for the minimum time.`),
  R('08-skip-locked.md','SKIP LOCKED','SKIP LOCKED','Understand','understand','job queue',
    'SKIP LOCKED powers job-queue-in-Postgres patterns without waiting.',
    `Compare Node Phase 7 queues / Redis.`),
  R('09-savepoints.md','Savepoints','Savepoints','Understand','understand','partial rollback',
    'Savepoints allow partial rollback; a second BEGIN is not a nested transaction.',
    `## Gotchas

**Symptom:** Nested begin expected  
**Cause:** Driver warning / ignored second BEGIN  
**Fix:** Savepoints or redesign`),
  R('10-table-locks-ddl.md','Table locks and DDL','Table locks','Understand','understand','DDL blocks',
    'DDL takes locks that block other operations — know the dangerous ALTERs.',
    `Phase 13 zero-downtime sequences.`),
  R('11-deadlocks.md','Deadlocks','Deadlocks','Understand','understand','ordering rule',
    'Deadlocks are resolved by aborting one tx — order lock acquisition consistently.',
    `SQLSTATE 40P01; retry carefully.`),
  R('12-long-transactions.md','Long-running transactions','Long TX','Understand','understand','bloat',
    'Long transactions block vacuum and create bloat — keep them short.',
    `Idle-in-transaction is especially toxic.`),
  R('13-vacuum.md','VACUUM and bloat','VACUUM','Understand','understand','dead tuples',
    'VACUUM reclaims dead tuples; autovacuum is mandatory knowledge for production.',
    `Updates create new row versions.`),
  R('14-idle-in-transaction.md','Idle in transaction','Idle in TX','Understand','understand','leaked BEGIN',
    'Idle-in-transaction from a leaked BEGIN in Node freezes vacuum progress.',
    `idle_in_transaction_session_timeout saves you; fix the leak.`),
  R('15-advisory-locks.md','Advisory locks','Advisory','Know','know','app mutex',
    'Advisory locks are application mutexes inside the database.',
    `Prefer for rare cross-node coordination; do not overuse.`),
  R('16-xid-wraparound.md','XID wraparound','Wraparound','Know','know','never reach it',
    'Transaction ID wraparound is catastrophic if vacuum fails for ages.',
    `Managed services alert — still know the failure mode.`),
];

const p12 = [
  R('01-jsonb-operators.md','jsonb operators','jsonb ops','Master','master','arrow and containment',
    '->, ->>, #>, @>, ? and path queries are the jsonb daily drivers.',
    `Prefer jsonb over json for app data.`),
  R('02-column-vs-json.md','When a column beats JSON','Column vs JSON','Master','master','early decision',
    'Stable queried fields want columns; optional bag-of-attrs can be jsonb.',
    `Wrong call creates unindexable mess or endless migrations.`),
  R('03-index-jsonb.md','Indexing jsonb','Index jsonb','Understand','understand','GIN path ops',
    'GIN, jsonb_path_ops, and expression indexes on hot keys.',
    `Index only what you query.`),
  R('04-build-json-sql.md','Building JSON in SQL','JSON build','Understand','understand','jsonb_build_object',
    'jsonb_build_object, jsonb_agg, row_to_json shape responses in SQL.',
    `Great for nested resources in one round trip.`),
  R('05-full-text.md','Full-text search','FTS','Understand','understand','tsvector',
    'tsvector/tsquery with language configuration and GIN indexes.',
    `Always specify language: to_tsvector('english', col).`),
  R('06-pg-trgm.md','pg_trgm fuzzy','pg_trgm','Understand','understand','ILIKE without full scan',
    'pg_trgm supports similarity and accelerates %pattern% searches with indexes.',
    `Extension must be allowed on managed hosts.`),
  R('07-views.md','Views','Views','Understand','understand','named queries',
    'Views name a query; they are not free performance and take no parameters.',
    `Security barrier views exist for special cases.`),
  R('08-triggers.md','Triggers','Triggers','Understand','understand','updated_at',
    'BEFORE/AFTER, row vs statement; updated_at is the honest default use case.',
    `Heavy business logic in triggers is hard to test — be careful.`),
  R('09-extensions.md','Extensions','Extensions','Understand','understand','CREATE EXTENSION',
    'pgcrypto, uuid-ossp, citext, pg_stat_statements, pg_trgm, pgvector — know create and host limits.',
    `Managed Postgres may restrict superuser extensions.`),
  R('10-srf.md','Set-returning functions in FROM','SRFs','Understand','understand','unnest jsonb_to_recordset',
    'generate_series, unnest, jsonb_to_recordset belong in FROM.',
    `Powerful for transforming JSON payloads.`),
  R('11-matviews.md','Materialized views','Matviews','Know','know','REFRESH CONCURRENTLY',
    'Materialized views cache query results; REFRESH CONCURRENTLY needs unique indexes.',
    `Stale until refreshed.`),
  R('12-plpgsql.md','PL/pgSQL functions','PL/pgSQL','Know','know','when logic belongs in DB',
    'PL/pgSQL for set-based logic that must be close to data — not a second app server.',
    `RETURNS TABLE for tabular results.`),
  R('13-listen-notify.md','LISTEN NOTIFY','LISTEN','Know','know','at-most-once',
    'LISTEN/NOTIFY pushes events to Node; delivery is at-most-once.',
    `Dedicated client connection required (Phase 7).`),
  R('14-partitioning.md','Partitioning','Partitioning','Know','know','when big enough',
    'Range/list/hash partitioning and partition pruning — only when size justifies complexity.',
    `Wrong partition key hurts.`),
  R('15-procedures.md','Procedures vs functions','Procedures','When Needed','when','tx control',
    'Procedures can control transactions differently than functions.',
    `Rare in simple CRUD apps.`),
  R('16-fdw.md','Foreign data wrappers','FDW','When Needed','when','postgres_fdw',
    'FDW queries remote data as local tables — ops complexity high.',
    `Not a free distributed database.`),
  R('17-pgvector.md','pgvector','pgvector','When Needed','when','embeddings',
    'pgvector stores embeddings with distance operators and HNSW indexes.',
    `One row here until an AI feature track expands it.`),
];

const p13 = [
  R('01-roles-grant.md','Roles GRANT REVOKE','GRANT','Master','master','least privilege',
    'GRANT/REVOKE at table, column, schema, default privileges — least privilege for apps.',
    `App role ≠ superuser.`),
  R('02-secrets.md','Secrets','Secrets','Master','master','no URI in logs',
    'Keep connection strings out of repos, logs, and error messages.',
    `Env/secret manager only.`),
  R('03-app-role-not-owner.md','App role should not own schema','App role','Understand','understand','what it prevents',
    'Application role should not own the schema — prevents accidental DDL and privilege creep.',
    `Migrator role owns objects; app gets DML grants.`),
  R('04-pg-dump-restore.md','pg_dump and pg_restore','pg_dump','Understand','understand','logical backups',
    'Logical backups with format choice; restore a single table when needed.',
    `An unrestored backup is not a backup — practice restores (drill below).`),
  R('05-pg-hba.md','pg_hba.conf','pg_hba','Understand','understand','scram host rules',
    'pg_hba.conf chooses auth methods and host rules — scram-sha-256 is modern default.',
    `Managed providers abstract this; still understand failures.`),
  R('06-tls.md','TLS to the database','TLS','Understand','understand','sslmode',
    'sslmode values: require does not verify CA the way verify-full does.',
    `Use provider-recommended SSL settings.`),
  R('07-pgbouncer.md','Connection limits and PgBouncer','PgBouncer','Understand','understand','tx vs session pool',
    'PgBouncer transaction vs session pooling — LISTEN and session features break under transaction pooling.',
    `Pool sizing also Node Phase 6.`),
  R('08-replication.md','Streaming replication replicas','Replicas','Understand','understand','read-your-writes',
    'Streaming replicas lag; read-your-writes can fail if you read the replica immediately.',
    `Route reads carefully after writes.`),
  R('09-monitoring.md','Monitoring views','Monitoring','Understand','understand','pg_stat_activity',
    'pg_stat_activity, database/table stats, cache hit ratio — basic observability.',
    `Find idle-in-transaction and long queries here.`),
  R('10-config-keys.md','Key configuration','Config keys','Understand','understand','shared_buffers work_mem',
    'shared_buffers, work_mem, max_connections, effective_cache_size — know what they buy.',
    `Do not cargo-cult values; size to RAM and workload.`),
  R('11-logging.md','Logging slow queries','Logging','Understand','understand','log_min_duration',
    'log_min_duration_statement finds slow SQL in production logs.',
    `Pair with pg_stat_statements.`),
  R('12-zero-downtime-ddl.md','Zero-downtime schema changes','ZDD DDL','Understand','understand','add backfill constrain',
    'Know locks per ALTER; safe ordering: add nullable → backfill → constrain.',
    `EXPAND/CONTRACT migrations.`),
  R('13-managed-postgres.md','Managed PostgreSQL','Managed','Understand','understand','RDS Neon Supabase',
    'Managed Postgres trades control for ops — superuser and extension limits differ.',
    `Learn what you give up before relying on superuser features.`),
  R('14-rls.md','Row-level security','RLS','Know','know','policies',
    'RLS policies enforce tenant isolation in the database.',
    `Easy to misconfigure — test with non-superuser roles.`),
  R('15-physical-backup.md','Physical backup PITR','PITR','Know','know','WAL archiving',
    'Physical backup + WAL archiving enables point-in-time recovery.',
    `Ops runbooks more than app code.`),
  R('16-logical-replication.md','Logical replication','Logical repl','Know','know','major upgrades',
    'Logical replication can enable near-zero-downtime major upgrades.',
    `More moving parts than dump/restore.`),
  R('17-major-upgrades.md','Major version upgrades','Upgrades','Know','know','pg_upgrade paths',
    'pg_upgrade vs dump/restore vs logical replication — pick for downtime budget.',
    `Always test on a copy.`),
  R('18-disaster-drill.md','Disaster drill','Drill','Know','know','restore on a schedule',
    'Restore a backup into a scratch database and verify it on a schedule.',
    `Until you restore, you only hope you have a backup.`),
];

console.log({
  p10: mkPhase('phase-10-indexes', 'Phase 10 — Indexes and the query planner', ['Part 4', '../../syllabus/04-performance-and-production.md'], p10,
    'Move on when you can read EXPLAIN ANALYZE and explain why an index was not used.'),
  p11: mkPhase('phase-11-mvcc', 'Phase 11 — Transactions, MVCC and concurrency', ['Part 4', '../../syllabus/04-performance-and-production.md'], p11,
    'Move on when you can prevent lost updates and never leave idle-in-transaction connections.'),
  p12: mkPhase('phase-12-beyond-tables', 'Phase 12 — Beyond plain tables', ['Part 4', '../../syllabus/04-performance-and-production.md'], p12,
    'Move on when you can choose columns vs jsonb and know when FTS/partitioning is justified.'),
  p13: mkPhase('phase-13-ops', 'Phase 13 — Security, operations and production', ['Part 4', '../../syllabus/04-performance-and-production.md'], p13,
    'Move on when secrets are safe, privileges are least, and you have restored a backup once.'),
});
