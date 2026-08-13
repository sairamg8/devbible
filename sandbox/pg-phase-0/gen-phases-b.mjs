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
Use \`pg\` with parameters; verify SQL in \`psql\` first.`;
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

const p7 = [
  R('01-install-wire.md','Installing and wiring pg','Install pg','Master','master','Pool at module scope',
    'Install pg, import it as ESM, create one Pool at module scope for the process.',
    `\`\`\`js
import pg from 'pg';
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});
\`\`\`

## Gotchas

**Symptom:** New Pool per request  
**Cause:** Factory in the handler  
**Fix:** Single module-scope pool (sizing details: Node Phase 6)`),
  R('02-pool-vs-client.md','Pool vs Client','Pool vs Client','Master','master','default Pool',
    'Use Pool by default; use a dedicated Client for transactions, LISTEN, and session features.',
    `Recap only — full lifecycle in Node Phase 6. Transactions need one client for BEGIN..COMMIT.`),
  R('03-connection-config.md','Connection configuration','Config','Master','master','URI vs object SSL',
    'Configure with a URI or object; honor PG* env vars; set SSL correctly for managed providers.',
    `Never log the URI. sslmode semantics matter in production (Phase 13).`),
  R('04-query-placeholders.md','pool.query and placeholders','query $1','Master','master','safe path including ANY',
    'pool.query(sql, params) with $1 is the safe path; use = ANY($1) for IN-lists.',
    `\`\`\`js
await pool.query('select * from measure_users where id = any($1::bigint[])', [[1n, 2n]]);
// or number/string arrays per your id type
\`\`\``),
  R('05-errors.md','Errors from PostgreSQL in Node','Errors','Master','master','SQLSTATE to HTTP',
    'Map error.code (SQLSTATE), constraint, and detail — e.g. 23505 to HTTP 409.',
    `\`\`\`js
// measured: unique violation
// code 23505, constraint measure_users_email_key
\`\`\`

Common: 23505 unique, 23503 FK, 23514 check, 40001 serialization, 40P01 deadlock, 57014 query_canceled.`),
  R('06-result-object.md','The result object','Result','Understand','understand','rows rowCount fields',
    'result.rows, rowCount, fields, command — know empty SELECT vs UPDATE 0.',
    `Empty SELECT → rows []. UPDATE no match → rowCount 0.`),
  R('07-connect-release.md','pool.connect and release','connect release','Understand','understand','finally release',
    'Checked-out clients must release in finally or the pool leaks to death.',
    `\`\`\`js
const c = await pool.connect();
try {
  await c.query('begin');
  // ...
  await c.query('commit');
} catch (e) {
  await c.query('rollback');
  throw e;
} finally {
  c.release();
}
\`\`\``),
  R('08-type-parsing.md','Type parsing','Type parsing','Understand','understand','bigint numeric strings',
    'pg returns bigint and numeric as strings; timestamptz as Date; jsonb as object.',
    `Measured shape: big string, num string, ts object, bool boolean, arr array, j object.`),
  R('09-pg-types.md','Overriding type parsers','pg-types','Understand','understand','bigint decision',
    'pg-types can change parsers; decide bigint-as-string vs BigInt explicitly for the app.',
    `Changing globally affects the whole process — document the choice.`),
  R('10-prepared.md','Prepared statements','Prepared','Understand','understand','name field',
    'Named queries can use the server plan cache; wrong use can backfire with changing types.',
    `Prefer simple queries first; add names when profiling says so.`),
  R('11-timeouts.md','Query timeouts','Timeouts','Understand','understand','which timeout saves you',
    'statement_timeout, query_timeout, connectionTimeoutMillis protect different layers.',
    `Set a statement_timeout for the app role; fail fast rather than hang forever.`),
  R('12-one-statement.md','One query one statement','One statement','Understand','understand','multi-statement feature',
    'Simple query path is one statement — multi-statement strings are restricted for safety.',
    `Use transactions for multi-step work, not semicolon soup from the app.`),
  R('13-pool-end.md','pool.end','pool.end','Understand','understand','graceful shutdown',
    'Call pool.end() during graceful HTTP shutdown so backends exit cleanly.',
    `Wire to SIGTERM with server.close (Node deployment phase).`),
  R('14-listen-notify.md','LISTEN NOTIFY from Node','LISTEN','Know','know','dedicated Client',
    'LISTEN/NOTIFY needs a long-lived Client, not a borrowed pool client.',
    `At-most-once delivery — compare Redis pub/sub in the Redis syllabus.`),
  R('15-cursors.md','pg-cursor streaming','Cursors','Know','know','large results',
    'Stream large results with pg-cursor instead of buffering millions of rows.',
    `Default query buffers all rows in memory.`),
  R('16-postgres-js.md','pg vs postgres.js','postgres.js','Know','know','when to switch',
    'postgres.js offers tagged templates and different ergonomics — choose deliberately.',
    `This syllabus standardizes on pg for ecosystem familiarity.`),
];

const p8 = [
  R('01-ddl-from-node.md','Creating tables from Node','DDL from Node','Master','master','when legitimate',
    'Issuing DDL through the driver is for migrations and setup — not request handlers.',
    `Runtime CREATE TABLE on every boot is not a migration system.`),
  R('02-migrations.md','Migrations','Migrations','Master','master','forward-only files',
    'Forward-only, one file per change, applied in a transaction, recorded in a tracking table.',
    `Never edit applied migrations; add a new file.`),
  R('03-seeding.md','Seeding','Seeding','Master','master','deterministic fixtures',
    'Seed with multi-row INSERT and ON CONFLICT DO NOTHING for idempotent fixtures.',
    `Deterministic emails/ids make tests debuggable.`),
  R('04-bulk-insert.md','Bulk insert that scales','Bulk insert','Master','master','unnest vs loop',
    'INSERT ... SELECT * FROM unnest($1::...) beats one insert per row — measure it.',
    `Phase 4 VALUES/unnest bridge lands here operationally.`),
  R('05-sql-files.md','SQL in .sql files','SQL files','Understand','understand','reviewable SQL',
    'Keep SQL in .sql files loaded with node:fs so reviews see pure SQL.',
    `Template literals hide diffs and invite injection habits.`),
  R('06-tx-migration.md','Migrations in transactions','Tx migrations','Understand','understand','failed leaves nothing',
    'Wrap migration steps in BEGIN/COMMIT; transactional DDL rolls back on failure.',
    `Know exceptions (CONCURRENTLY) before using them.`),
  R('07-if-not-exists.md','IF NOT EXISTS is not migrations','IF NOT EXISTS','Understand','understand','idempotent setup only',
    'CREATE TABLE IF NOT EXISTS is fine for demos; it is not versioned schema management.',
    `It cannot rename/alter safely across versions.`),
  R('08-minimal-runner.md','Minimal migration runner','Runner','Understand','understand','know when to stop',
    'A tiny runner teaches the model; adopt a real tool when teams grow.',
    `node-pg-migrate, graphile-migrate, etc. — Know row below.`),
  R('09-copy-streams.md','COPY FROM STDIN from Node','COPY streams','Understand','understand','fast loads',
    'pg-copy-streams feeds COPY FROM STDIN for large loads.',
    `Faster than multi INSERT for bulk analytics loads.`),
  R('10-local-dev-db.md','Local dev database','Local DB','Understand','understand','compose reset script',
    'Compose/Podman file, volume, port 55432, one-command reset script.',
    `Use 127.0.0.1 not localhost.`),
  R('11-test-reset.md','Reset between tests','Test reset','Understand','understand','truncate vs migrate',
    'Truncate-and-reseed vs drop-and-migrate — pick for speed vs fidelity.',
    `Transaction rollback per test is another isolation pattern (Phase 9).`),
  R('12-migration-tools.md','Migration tools overview','Tools','Know','know','what each assumes',
    'node-pg-migrate, graphile-migrate, Prisma Migrate assume different workflows.',
    `Raw SQL first — tools are optional accelerators.`),
  R('13-schema-drift.md','Schema drift','Drift','Know','know','fail fast at boot',
    'Verify live schema matches expectations; fail boot on drift when critical.',
    `Migrations applied count is the usual check.`),
  R('14-codegen-types.md','Types from schema','Codegen','Know','know','keep TS in step',
    'Generate TypeScript types from SQL schema and CI-fail on drift.',
    `Hand-written types rot.`),
];

const p9 = [
  R('01-repository.md','Repository module per resource','Repository','Master','master','plain functions',
    'One repository module per resource: plain functions taking a client/pool, returning rows.',
    `Layering rationale lives in Node Phase 6 — link, do not re-teach.`),
  R('02-list-endpoint.md','list with filter sort page','list','Master','master','every resource',
    'list with filtering, sorting, and pagination is the endpoint every resource has.',
    `Compose WHERE, ORDER BY, LIMIT from allowlists.`),
  R('03-safe-dynamic-where.md','Safe dynamic WHERE','Dynamic WHERE','Master','master','param array',
    'Build predicates and a parameter array together — never concatenate values.',
    `\`\`\`js
const where = [];
const params = [];
if (email) { params.push(email); where.push(\`email = $\${params.length}\`); }
\`\`\``),
  R('04-allowlists.md','Sort and filter allowlists','Allowlists','Master','master','identifier injection',
    'Identifiers cannot be parameterized — allowlist sort/filter columns or attackers inject SQL.',
    `## Gotchas

**Symptom:** Parameterized queries still injectable  
**Cause:** String-built column names  
**Fix:** Map API fields to SQL columns via a frozen allowlist`),
  R('05-transactions-request.md','Transactions in a request','Request TX','Master','master','try catch finally',
    'BEGIN/COMMIT/ROLLBACK on one checked-out client with try/catch/finally.',
    `Propagating the client through services is Node Phase 6 — short recap only.`),
  R('06-create.md','create INSERT RETURNING','create','Understand','understand','map to domain',
    'create uses INSERT ... RETURNING and maps the row to a domain object.',
    `Map 23505 to conflict responses.`),
  R('07-find-by-id.md','findById','findById','Understand','understand','null vs throw',
    'findById returns null or throws — pick one convention per codebase.',
    `Do not mix both silently.`),
  R('08-update-partial.md','Partial updates','update','Understand','understand','COALESCE vs dynamic SET',
    'Partial updates: COALESCE($n, col) or dynamically build SET with allowlisted columns.',
    `Avoid overwriting with undefined by accident.`),
  R('09-delete-soft-hard.md','delete hard vs soft','delete','Understand','understand','return removed',
    'Hard delete vs soft delete; return what was removed when useful.',
    `Soft delete must align with UNIQUE (partial unique indexes).`),
  R('10-keyset.md','Keyset pagination','Keyset','Understand','understand','tuple + index',
    'Keyset uses tuple comparison plus a matching index — faster than deep OFFSET.',
    `ORDER BY created_at, id and WHERE (created_at, id) < ($1, $2).`),
  R('11-idempotent-writes.md','Idempotent writes','Idempotency','Understand','understand','upsert flows',
    'Idempotent writes use upsert or idempotency keys for clients that retry.',
    `Pair with unique constraints.`),
  R('12-client-propagation.md','Passing client through services','Client prop','Understand','understand','one TX many repos',
    'Pass a client through service functions so one transaction spans repositories.',
    `Recap + link Node Phase 6 — do not re-own propagation theory.`),
  R('13-optimistic.md','Optimistic concurrency','Optimistic','Understand','understand','version column',
    'version column with WHERE version = $n; rowCount 0 means conflict.',
    `Return 409/412 per API style.`),
  R('14-for-update.md','SELECT FOR UPDATE','FOR UPDATE','Understand','understand','short locks',
    'FOR UPDATE in a request locks rows — hold the transaction as short as possible.',
    `Long locks kill throughput (Phase 11).`),
  R('15-shape-sql-vs-js.md','Shape in SQL vs JS','Shape trade-off','Understand','understand','jsonb_agg decision',
    'Shape aggregates in SQL (jsonb_agg) or assemble in JS — name the trade-off.',
    `SQL wins for fewer round trips; JS wins for complex policy branching.`),
  R('16-testing-real-pg.md','Testing against real PostgreSQL','Testcontainers','Understand','understand','after Node Phase 9',
    'Test against real PostgreSQL (Testcontainers) with per-test rollback when possible.',
    `Write this page in lockstep with Node Phase 9 measurements when those land.`),
  R('17-timestamps-trigger.md','created_at updated_at','Timestamps','Understand','understand','trigger usually wins',
    'created_at/updated_at via trigger usually beats scattered app code.',
    `One trigger function, many tables.`),
  R('18-snake-camel.md','snake_case to camelCase','snake camel','Understand','understand','one mapping place',
    'Map snake_case columns to camelCase fields in exactly one place.',
    `Dual mapping layers cause silent field loss.`),
];

console.log({
  p7: mkPhase('phase-7-pg-driver', 'Phase 7 — The pg driver, end to end', ['Part 3', '../../syllabus/03-node-and-pg.md'], p7,
    'Move on when you can open a pool, parameterize queries, map 23505, and never leak clients.'),
  p8: mkPhase('phase-8-schema-from-node', 'Phase 8 — Schema and data from Node', ['Part 3', '../../syllabus/03-node-and-pg.md'], p8,
    'Move on when you can migrate forward-only and seed idempotently without runtime DDL in requests.'),
  p9: mkPhase('phase-9-api-crud', 'Phase 9 — CRUD patterns for a real API', ['Part 3', '../../syllabus/03-node-and-pg.md'], p9,
    'Move on when list/filter/sort is allowlisted and transactions use try/catch/finally release.'),
});
