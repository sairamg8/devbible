---
title: "Link map · PostgreSQL · Part 3 (phases 7–9)"
sidebar_label: "03 · PostgreSQL · Node + pg"
sidebar_position: 4
---

# Link map · PostgreSQL · Part 3 (phases 7–9)

Covers all 48 topic rows of `docs/postgresql/syllabus/03-node-and-pg.md`: T07-01 to T07-16 phase 7 (the `pg` driver), T08-01 to T08-14 phase 8 (schema and data from Node), T09-01 to T09-18 phase 9 (CRUD patterns for a real API). All 48 have a page of ours (✅, path checked on disk).
*read* = passage read; *headings only* = fetched, headings/size checked. Third-party links carry their date; `#anchors` are given only where the id was found in the page HTML.

🔴 **Version note.** Our syllabus targets PostgreSQL **18.4**; `/docs/current/` served major **18** on 2026-10-12 (page titles read "Documentation: 18"). npm registry on 2026-10-12: `pg` 8.23.1, `pg-pool` 3.14.0, `pg-types` 4.1.0, `pg-cursor` 2.22.1, `pg-query-stream` 4.17.1, `pg-copy-streams` 7.0.0, `postgres` (postgres.js) 3.4.9, `node-pg-migrate` 9.0.0, `graphile-migrate` 1.4.1, `testcontainers` 12.2.0, `kysely-codegen` 0.20.0. Pin versions in each page's `> Verified:` line.

🔴 **Source note.** `github.com` returns 403 to our fetcher, so READMEs are read from `raw.githubusercontent.com` (marked "raw"). The node-postgres site (`node-postgres.com`) carries no per-page dates, so only the fetch date is given. It does not document the error object's fields; the field list below comes from the `pg-protocol` source (raw).

---

## Phase 7 — The `pg` driver, end to end

### T07-01 · Installing and wiring `pg` — Master · ✅ written `docs/postgresql/pages/phase-7-pg-driver/01-install-wire.md`
- **Read this:** [Welcome / Introduction](https://node-postgres.com/) · node-postgres.com · `npm install pg`; supports current and LTS Node plus bun, deno, Cloudflare Workers (*read*) · covers our angle: **partial** — nothing on module-scope `Pool` creation or Node-version pinning · fetched 2026-10-12
- **Also good:** [ESM](https://node-postgres.com/features/esm) · node-postgres.com · ESM support since v8.15.x; named import `import { Client } from 'pg'` now works, the old default-import form still does (*read*) · [Pooling](https://node-postgres.com/features/pooling) · node-postgres.com · "usually just 1" pool per app; unbounded pools defeat pooling (*read*)
- **Our delta:** one pool created once at module scope and exported; the ESM named-import point; pin `pg` 8.23.1 in `> Verified:`.

### T07-02 · `Pool` vs `Client` — Master · ✅ written `docs/postgresql/pages/phase-7-pg-driver/02-pool-vs-client.md`
- **Read this:** [Pooling](https://node-postgres.com/features/pooling) · node-postgres.com · handshake costs 20-30 ms; one client runs one query at a time, first-in first-out; `pool.query` is the preferred way for a single query (*read*) · covers our angle: **partial** — no list of cases that still need a dedicated `Client` · fetched 2026-10-12
- **Also good:** [pg.Pool API](https://node-postgres.com/apis/pool) · node-postgres.com · config defaults: `max` 10, `idleTimeoutMillis` 10000 (*read* the config block) · [Pool sizing](https://node-postgres.com/guides/pool-sizing) · node-postgres.com · serverless and PgBouncer cases (*headings only*)
- **Our delta:** the dedicated-`Client` cases (`LISTEN`, session state, a transaction) and a one-paragraph recap with a link to Node Phase 6 for sizing.

### T07-03 · Connection configuration — Master · ✅ written `docs/postgresql/pages/phase-7-pg-driver/03-connection-config.md`
- **Read this:** [Connecting](https://node-postgres.com/features/connecting) · node-postgres.com · same `PG*` env vars as libpq/psql, defaults listed, config object, connection URI, dynamic password callback (*read* env vars and programmatic parts) · covers our angle: **partial** — SSL is on a separate page · fetched 2026-10-12
- **Also good:** [SSL](https://node-postgres.com/features/ssl) · node-postgres.com · warns that `sslmode` in the connection string replaces the `ssl` object (*read*) · [32.15. Environment Variables](https://www.postgresql.org/docs/current/libpq-envars.html) · postgresql.org · the full `PG*` list (*headings only*)
- **Our delta:** managed-provider SSL recipe; `127.0.0.1` not `localhost` (README note); the `sslmode` override trap.

### T07-04 · `pool.query()` with `$1` placeholders — Master · ✅ written `docs/postgresql/pages/phase-7-pg-driver/04-query-placeholders.md`
- **Read this:** [Queries](https://node-postgres.com/features/queries) · node-postgres.com · parameters go to the server separately; identifiers cannot be parameters; JS-to-SQL conversion rules for `null`, `Date`, arrays, objects (*read*) · covers our angle: **partial** — no `= ANY($1)` example · fetched 2026-10-12
- **Also good:** [Postgres Query Boost: Using ANY Instead of IN](https://www.crunchydata.com/blog/postgres-query-boost-using-any-instead-of-in) · crunchydata.com · Matt Hudson, 2022-11-18; why `ANY` over a variable-length `IN`; examples are Java, not Node (*read*) · [9.25.3. ANY / SOME (array)](https://www.postgresql.org/docs/current/functions-comparisons.html) · postgresql.org · right-hand side must be an array (*read*)
- **Our delta:** `WHERE id = ANY($1::int[])` with a JS array as one parameter, and an empty-array case; neither node-postgres page shows it.

### T07-05 · Errors from PostgreSQL in Node — Master · ✅ written `docs/postgresql/pages/phase-7-pg-driver/05-errors.md`
- **Read this:** [Appendix A. PostgreSQL Error Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html) · postgresql.org · class 23 lists `23505 unique_violation`, `23503 foreign_key_violation`, `23502 not_null_violation`, `23514 check_violation` (*read*) · covers our angle: **partial** — nothing on the Node `error` object · fetched 2026-10-12
- **Also good:** [`DatabaseError` in pg-protocol (raw source)](https://raw.githubusercontent.com/brianc/node-postgres/master/packages/pg-protocol/src/messages.ts) · github (raw) · class fields `code`, `detail`, `hint`, `schema`, `table`, `column`, `dataType`, `constraint` (*read* the class) · [54.8. Error and Notice Message Fields](https://www.postgresql.org/docs/current/protocol-error-fields.html) · postgresql.org · constraint-name field only set for some error types (*read*)
- **Our delta:** the 23505-to-409 mapping; the Node `error` object is not documented on node-postgres.com, so the field list rests on source code.

### T07-06 · The result object — Understand · ✅ written `docs/postgresql/pages/phase-7-pg-driver/06-result-object.md`
- **Read this:** [pg.Result](https://node-postgres.com/apis/result) · node-postgres.com · `rows`, `fields`, `command`, `rowCount` (can be `null`, e.g. `LOCK`); `rowCount` is rows processed, not rows returned (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the empty-result shape (`rows: []`, `rowCount` 0) and the quoted caution (@sehrope, on the page) against assuming `rows.length` equals `rowCount`.

### T07-07 · `pool.connect()` and `client.release()` — Understand · ✅ written `docs/postgresql/pages/phase-7-pg-driver/07-connect-release.md`
- **Read this:** [Pooling → Checkout, use, and return](https://node-postgres.com/features/pooling) · node-postgres.com · "You must always return the client to the pool"; a leaked client empties the pool and later checkouts wait forever (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [pg.Pool → releasing clients](https://node-postgres.com/apis/pool) · node-postgres.com · `release(destroy?)` — a truthy value destroys the client instead of reusing it (*read*) · [Transactions](https://node-postgres.com/features/transactions) · node-postgres.com · `try`/`catch`/`finally` with `release()` (*read*)
- **Our delta:** how the leak shows up in production (requests hang, no error) and when to pass `true` to `release`.

### T07-08 · Type parsing — Understand · ✅ written `docs/postgresql/pages/phase-7-pg-driver/08-type-parsing.md`
- **Read this:** [Data Types](https://node-postgres.com/features/types) · node-postgres.com · anything without a registered parser comes back as a string; `uuid` is a string, `json`/`jsonb` parsed via `JSON.parse`, dates become `Date` in the process time zone; JS keeps only milliseconds (*read*) · covers our angle: **partial** — never says `bigint` and `numeric` arrive as strings; it only states the default rule · fetched 2026-10-12
- **Also good:** [pg-types README (raw)](https://raw.githubusercontent.com/brianc/node-pg-types/master/README.md) · github (raw) · names `int8` as returned as string because JS cannot hold 64 bits, with the `COUNT(*)` example (*read*)
- **Our delta:** a table of type to JS value (bigint/numeric string, timestamptz `Date`, arrays) — no page gives it; run it to prove each row.

### T07-09 · Overriding type parsers with `pg-types` — Understand · ✅ written `docs/postgresql/pages/phase-7-pg-driver/09-pg-types.md`
- **Read this:** [pg-types README (raw)](https://raw.githubusercontent.com/brianc/node-pg-types/master/README.md) · github (raw) · `setTypeParser(20, ...)` to get numbers from `int8`; `null` is never parsed; find OIDs via `pg_type` (*read*) · covers our angle: **partial** — example uses `var` and `require('pg').types`; does not cover the "keep it a string or use `BigInt`" decision · fetched 2026-10-12
- **Also good:** [Queries → Types](https://node-postgres.com/features/queries) · node-postgres.com · per-query `types` override via `getTypeParser` (*read*) · [pg.Types](https://node-postgres.com/apis/types) · node-postgres.com · page says "incomplete" and points at pg-types (*read*)
- **Our delta:** the bigint-as-string decision (global parser vs per query vs `::text`), with the 2^53 limit stated; `pg-types` is 4.1.0 on npm — which version `pg` 8.23.1 bundles: not confirmed.

### T07-10 · Prepared (named) statements — Understand · ✅ written `docs/postgresql/pages/phase-7-pg-driver/10-prepared.md`
- **Read this:** [Queries → Prepared statements](https://node-postgres.com/features/queries) · node-postgres.com · a `name` caches the plan per connection; parse is skipped on the second use; the author calls it premature optimisation for most queries (*read*) · covers our angle: **partial** — nothing on generic versus custom plans or pooler trouble · fetched 2026-10-12
- **Also good:** [PREPARE](https://www.postgresql.org/docs/current/sql-prepare.html) · postgresql.org · a statement runs with a generic or a custom plan (*read* the notes) · [54.2. Message Flow](https://www.postgresql.org/docs/current/protocol-flow.html) · postgresql.org · extended-query protocol (*headings only*)
- **Our delta:** when it backfires (per-connection cache, transaction-mode PgBouncer, a skewed parameter value with a generic plan); the PG pages cover the planner, the Node page the API.

### T07-11 · Query timeouts — Understand · ✅ written `docs/postgresql/pages/phase-7-pg-driver/11-timeouts.md`
- **Read this:** [pg.Client config](https://node-postgres.com/apis/client) · node-postgres.com · config comments define `statement_timeout`, `query_timeout`, `lock_timeout`, `connectionTimeoutMillis`, `idle_in_transaction_session_timeout`; defaults "no timeout" (*read* the config block) · covers our angle: **partial** — one-line comments only, no "which saves you" · fetched 2026-10-12
- **Also good:** [19.11. Client Connection Defaults](https://www.postgresql.org/docs/current/runtime-config-client.html) · postgresql.org · `statement_timeout` aborts a statement running past the limit (*read*)
- **Our delta:** the difference between a server-side abort (`statement_timeout`) and a client-side give-up (`query_timeout`), and which one frees the backend.

### T07-12 · One `query()` is one statement — Understand · ✅ written `docs/postgresql/pages/phase-7-pg-driver/12-one-statement.md`
- **Read this:** [32.3. Command Execution Functions](https://www.postgresql.org/docs/current/libpq-exec.html) · postgresql.org · `PQexecParams` allows at most one nonempty command, "a limitation of the underlying protocol", and a defence against injection (*read*) · covers our angle: **partial** — it is the C library page, not `pg` · fetched 2026-10-12
- **Also good:** [postgres.js README (raw)](https://raw.githubusercontent.com/porsager/postgres/master/README.md) · github (raw) · simple queries allow several statements but no parameters; extended allow parameters but one statement (*read*)
- **Our delta:** how `pg` behaves with a multi-statement string with and without values — node-postgres.com does not say, so run it.

### T07-13 · `pool.end()` — Understand · ✅ written `docs/postgresql/pages/phase-7-pg-driver/13-pool-end.md`
- **Read this:** [Pooling → Shutdown](https://node-postgres.com/features/pooling) · node-postgres.com · `pool.end()` waits for checked-out clients; later checkouts return errors (*read*) · covers our angle: **partial** — nothing on HTTP server shutdown order · fetched 2026-10-12
- **Also good:** [pg.Pool → pool.end](https://node-postgres.com/apis/pool) · node-postgres.com · `allowExitOnIdle` for scripts and tests (*read*)
- **Our delta:** order — stop accepting requests, drain, then `pool.end()`; and calling it only once.

### T07-14 · `LISTEN`/`NOTIFY` from Node — Know · ✅ written `docs/postgresql/pages/phase-7-pg-driver/14-listen-notify.md`
- **Read this:** [NOTIFY](https://www.postgresql.org/docs/current/sql-notify.html) · postgresql.org · payload, channel and sender PID; delivery waits until the listener's transaction ends (*read*) · covers our angle: **partial** — no Node code · fetched 2026-10-12
- **Also good:** [pg.Client → notification event](https://node-postgres.com/apis/client) · node-postgres.com · `client.on('notification', ...)` after `LISTEN foo` (*read*) · [LISTEN](https://www.postgresql.org/docs/current/sql-listen.html) · postgresql.org · registers the *current session* as a listener (*read*)
- **Our delta:** a listener is session state, so it needs one long-lived `Client` outside the pool; reconnect handling.

### T07-15 · `pg-cursor` and streaming — Know · ✅ written `docs/postgresql/pages/phase-7-pg-driver/15-cursors.md`
- **Read this:** [Cursor](https://node-postgres.com/apis/cursor) · node-postgres.com · `new Cursor(text, values)`, `read(rowCount)`, `close()`; reads a large result without holding it all in memory (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [pg-query-stream README (raw)](https://raw.githubusercontent.com/brianc/node-postgres/master/packages/pg-query-stream/README.md) · github (raw) · readable object stream over a server cursor; does not work with native bindings (*read*)
- **Our delta:** the cursor holds one pooled client until closed; release it in `finally`.

### T07-16 · `pg` vs `postgres.js` — Know · ✅ written `docs/postgresql/pages/phase-7-pg-driver/16-postgres-js.md`
- **Read this:** [postgres.js README (raw)](https://raw.githubusercontent.com/porsager/postgres/master/README.md) · github (raw) · tagged-template queries, prepared statements created automatically for static queries (off with `prepare: false`), `sql.begin`, `.listen`, bigint returned as a string (*read* the headings and several sections) · covers our angle: **partial** — a README, not a comparison · fetched 2026-10-12
- **Also good:** [`Waddler <> PostgreSQL`](https://waddler.drizzle.team/docs/connect-postgresql) · waddler.drizzle.team · lists differences it found: postgres.js prepares by default, `pg` allows per-query type parsers (*read* the section; vendor-adjacent, undated)
- **Our delta:** a neutral comparison — no benchmark source was fetched, so the README's "fastest" claim is **not confirmed** and must be worded as the author's claim.
- *Checked, not chosen:* StackShare "versus" pages (index noise, no comparison content; not fetched).

---

## Phase 8 — Schema and data from Node

### T08-01 · Creating tables from Node — Master · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/01-ddl-from-node/README.md`
- **Read this:** [5.1. Table Basics](https://www.postgresql.org/docs/current/ddl-basics.html) · postgresql.org · the manual's `CREATE TABLE` introduction (*read* the opening) · covers our angle: **partial** — nothing on issuing DDL through a driver or when that is lazy · fetched 2026-10-12
- **Also good:** [CREATE TABLE](https://www.postgresql.org/docs/current/sql-createtable.html) · postgresql.org · full synopsis (*read* the synopsis and `IF NOT EXISTS`)
- **Our delta:** `pool.query` happily runs DDL (it is just text); the legitimate cases (migrations, test setup) versus table creation at app boot, with the startup-race argument.

### T08-02 · Migrations — Master · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/02-migrations.md`
- **Read this:** [graphile-migrate README (raw): Why? and Opinions](https://raw.githubusercontent.com/graphile/migrate/main/README.md) · github (raw) · roll-forward only, a signed-off migration is never edited, each file wrapped in a transaction by default (*read* those sections) · covers our angle: **partial** — a tool README with a strong stance, not a neutral guide; the tracking table is not described there · fetched 2026-10-12
- **Also good:** [postgres-migrations README (raw): Design decisions](https://raw.githubusercontent.com/akheron/postgres-migrations/master/README.md) · github (raw) · no down migrations, `migrations` table, hash check of past files, one transaction per migration (*read*) · [Evolutionary Database Design](https://martinfowler.com/articles/evodb.html) · martinfowler.com · the general practice behind versioned schema changes (*headings only*; 9,313 words, undated in the fetch)
- **Our delta:** the four-part rule in our row (forward-only, one file per change, one transaction, a tracking table) in a single page; the tools disagree on rollbacks, say so.

### T08-03 · Seeding — Master · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/03-seeding.md`
- **Read this:** [INSERT](https://www.postgresql.org/docs/current/sql-insert.html) · postgresql.org · `ON CONFLICT DO NOTHING` skips a conflicting row; `conflict_target` optional for `DO NOTHING` (*read* that passage) · covers our angle: **partial** — multi-row `VALUES` and deterministic fixtures are not explained here · fetched 2026-10-12
- **Also good:** [6.1. Inserting Data](https://www.postgresql.org/docs/current/dml-insert.html) · postgresql.org · more than one row in a single command (*read* the opening)
- **Our delta:** deterministic fixtures (fixed ids and timestamps, no `random()`), and re-runnable seeds via `ON CONFLICT`.

### T08-04 · Bulk insert that scales — Master · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/04-bulk-insert.md`
- **Read this:** [Boosting Postgres INSERT Performance by 2x With UNNEST](https://www.tigerdata.com/blog/boosting-postgres-insert-performance) · tigerdata.com · James Blackwood-Sewell; published 2024-11-15, modified 2026-01-08; `INSERT ... UNNEST` was 2.13x faster than `VALUES` at the database layer at batch size 1000, measured with `pg_stat_statements` (*read* the results; the "Should I use UNNEST?" section *headings only*) · covers our angle: **partial** — SQL only, no Node `pg` code; vendor blog · fetched 2026-10-12
- **Also good:** [14.4. Populating a Database](https://www.postgresql.org/docs/current/populate.html) · postgresql.org · disable autocommit, use `COPY`, drop indexes, run `ANALYZE` after (*headings only*; page metadata dated 2026-08-13)
- **Our delta:** the Node side (one JS array per column, `::bigint[]` casts, `pg` array conversion) and **our own measurement** — a 2x claim from a vendor benchmark is not ours to repeat unmeasured.

### T08-05 · SQL in `.sql` files, not template literals — Understand · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/05-sql-files.md`
- **Read this:** [PgTyped: Queries in SQL files](https://pgtyped.dev/docs/sql-file-intro) · pgtyped.dev · a `.sql` file with named queries yields typed TS functions that run on a `pg` `Client`; parameters sent separately (*read*) · covers our angle: **partial** — it sells a code generator; the plain `node:fs` loading and reviewability case is ours · fetched 2026-10-12
- **Also good:** [postgres.js README (raw): Queries in Files](https://raw.githubusercontent.com/porsager/postgres/master/README.md) · github (raw) · `sql.file(path, args, options)` as a built-in alternative (*headings only* for that section)
- **Our delta:** a 10-line loader with `fs.readFile`, cached at start-up, and the diff-review argument. `pgtyped` last npm publish 2025-03-15 (`@pgtyped/cli` 2.4.3); maintenance status **not confirmed**.

### T08-06 · Wrapping a migration in `BEGIN`/`COMMIT` — Understand · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/06-tx-migration.md`
- **Read this:** [Postgres vs. MySQL: DDL Transaction Difference](https://www.bytebase.com/blog/postgres-vs-mysql-ddl-transaction/) · bytebase.com · published 2025-05-27; PostgreSQL DDL can sit in transaction blocks and roll back as one unit, except database and tablespace operations (*read*; vendor blog written for PostgreSQL 17) · covers our angle: **partial** — nothing on migration files or the tracking row · fetched 2026-10-12
- **Also good:** [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html) · postgresql.org · a plain `CREATE INDEX` works in a transaction block; `CONCURRENTLY` cannot (*read*) · [Transactional DDL in PostgreSQL: A Competitive Analysis](https://wiki.postgresql.org/wiki/Transactional_DDL_in_PostgreSQL:_A_Competitive_Analysis) · wiki.postgresql.org · last edited 2012-06-11, shows a table gone after `ROLLBACK` on PostgreSQL 8.3.7 (*read*; old, concept only)
- **Our delta:** a failed migration leaves nothing behind (run it to show); the escape hatch for `CONCURRENTLY` (graphile-migrate and postgres-migrations both mark such files).

### T08-07 · `CREATE TABLE IF NOT EXISTS` — Understand · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/07-if-not-exists.md`
- **Read this:** [CREATE TABLE → IF NOT EXISTS](https://www.postgresql.org/docs/current/sql-createtable.html) · postgresql.org · no error, a notice instead, and "no guarantee" the existing relation matches (*read*) · covers our angle: full for the "why it is not a migration system" point · fetched 2026-10-12
- **Our delta:** show a table with a changed column surviving `IF NOT EXISTS` unchanged; the notice appears on `client.on('notice')`.

### T08-08 · A minimal migration runner in Node — Understand · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/08-minimal-runner.md`
- **Read this:** [postgres-migrations README (raw): Design decisions and Concurrency](https://raw.githubusercontent.com/akheron/postgres-migrations/master/README.md) · github (raw) · `migrations` table, hash check, transaction per file, advisory lock so a second runner waits; warns that advisory locks break under PgBouncer transaction pooling (*read*) · covers our angle: full as a design reference · fetched 2026-10-12
- **Also good:** [node-pg-migrate CLI reference](https://salsita.github.io/node-pg-migrate/cli) · salsita.github.io · `--single-transaction` default, `--check-order` default true, advisory lock for redo (*read* the options)
- **Our delta:** our own 40-line runner; "when to stop and adopt one" is our judgement. Repository activity of `postgres-migrations` **not confirmed**.

### T08-09 · `COPY FROM STDIN` via `pg-copy-streams` — Understand · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/09-copy-streams.md`
- **Read this:** [pg-copy-streams README (raw)](https://raw.githubusercontent.com/brianc/node-pg-copy-streams/master/README.md) · github (raw) · `copyFrom('COPY my_table FROM STDIN')` with `stream/promises` `pipeline`; `destroy()` sends CopyFail and rolls back unless CopyDone was already sent; v7.0.0 published 2025-05-27 (*read*) · covers our angle: full for the Node side · fetched 2026-10-12
- **Also good:** [COPY](https://www.postgresql.org/docs/current/sql-copy.html) · postgresql.org · `FROM STDIN` syntax and options (*read* the synopsis)
- **Our delta:** error handling and client release around the stream; `COPY` cannot use `ON CONFLICT`.

### T08-10 · A local development database in Podman/Docker — Understand · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/10-local-dev-db.md`
- **Read this:** [Docker Official Image `postgres` README (raw)](https://raw.githubusercontent.com/docker-library/docs/master/postgres/README.md) · github (raw) · from PostgreSQL 18 the image's `PGDATA` is version specific and the volume is `/var/lib/postgresql`; `/docker-entrypoint-initdb.d` scripts only run on an empty data directory (*read*) · covers our angle: **partial** — a Docker compose example, nothing on Podman or a reset script · fetched 2026-10-12
- **Also good:** [podman compose](https://docs.podman.io/en/latest/markdown/podman-compose.1.html) · docs.podman.io · a thin wrapper around an external compose provider (*read*)
- **Our delta:** the compose file with `127.0.0.1:55432`, a named volume mounted at the new PG 18 location, and the reset script (`down -v`, `up`, migrate, seed).

### T08-11 · Resetting to a known state between test runs — Understand · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/11-test-reset.md`
- **Read this:** [Database Test Isolation](https://eradman.com/posts/database-test-isolation.html) · eradman.com · Eric Radman; four options (transaction, truncate and reload, copy via template, restore point) with trade-offs (*read*; undated page) · covers our angle: **partial** — not Node, and our row names drop-and-migrate rather than template copy · fetched 2026-10-12
- **Also good:** [22.3. Template Databases](https://www.postgresql.org/docs/current/manage-ag-templatedbs.html) · postgresql.org · `CREATE DATABASE ... TEMPLATE` copies a database (*headings only*) · [TRUNCATE](https://www.postgresql.org/docs/current/sql-truncate.html) · postgresql.org · (*headings only*)
- **Our delta:** the two strategies in our row, timed on our schema; identity restart (`RESTART IDENTITY`) so ids are deterministic.

### T08-12 · `node-pg-migrate`, `graphile-migrate`, Prisma Migrate — Know · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/12-migration-tools.md`
- **Read this:** [graphile-migrate README (raw)](https://raw.githubusercontent.com/graphile/migrate/main/README.md) · github (raw) · states its opinions plainly: SQL-written, roll-forward only, no stack coupling, roles outside migrations (*read* Why? and Opinions) · covers our angle: **partial** — one of the three tools · fetched 2026-10-12
- **Also good:** [node-pg-migrate: Getting Started](https://salsita.github.io/node-pg-migrate/getting-started) · salsita.github.io · JS/TS migration files with a `pgm` builder, `up` and `down` (*read*) · [Prisma: Understanding Migrations (v7)](https://www.prisma.io/docs/orm/v7/prisma-migrate/understanding-prisma-migrate/mental-model) · prisma.io · Prisma schema is the source of truth; SQL history plus a migrations table in the database (*read* the tracking section)
- **Our delta:** what each assumes (DSL vs SQL vs schema file; down migrations or not); Prisma docs have moved between layouts, so the URL may change.

### T08-13 · Schema drift — failing fast at boot — Know · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/13-schema-drift.md`
- **Read this:** none found — tried: WebSearch "PostgreSQL schema drift detection check database schema matches migrations CI", "node check schema at startup"; results were tool READMEs (pgmold, dbdiff, Bytebase), none explaining a boot-time check from Node
- **Also good:** [node-pg-migrate CLI reference](https://salsita.github.io/node-pg-migrate/cli) · salsita.github.io · `--check-order` verifies the migration order before running (*read*) · [kysely-codegen README (raw)](https://raw.githubusercontent.com/RobinBlomberg/kysely-codegen/master/README.md) · github (raw) · `--verify` checks generated types are up to date (*read* the option)
- **Our delta:** the boot check is ours to write: compare the migrations table against the files on disk, optionally a catalog query. Neither tool detects drift made outside migrations.
- *Not opened:* pgmold (docs.rs), dbdiff, Bytebase drift pages — search hits only.

### T08-14 · Generating TypeScript types from the schema — Know · ✅ written `docs/postgresql/pages/phase-8-schema-from-node/14-codegen-types.md`
- **Read this:** [PgTyped: Getting Started](https://pgtyped.dev/docs/getting-started) · pgtyped.dev · config with `transforms`, `db` connection; types inferred from the live schema, run in watch mode (*read*) · covers our angle: **partial** — types per query, not per table · fetched 2026-10-12
- **Also good:** [kysely-codegen README (raw)](https://raw.githubusercontent.com/RobinBlomberg/kysely-codegen/master/README.md) · github (raw) · types from a live database; `--camel-case`; `numericParser` default `string` (*read*)
- **Our delta:** the types must follow the runtime: `bigint` and `numeric` are strings in `pg` (T07-08), so a generated `number` is a lie unless a parser is set. `kysely-codegen` is built for Kysely, not raw `pg`.

---

## Phase 9 — CRUD patterns for a real API

### T09-01 · A repository module per resource — Master · ✅ written `docs/postgresql/pages/phase-9-api-crud/01-repository/README.md`
- **Read this:** [Suggested Code Structure](https://node-postgres.com/guides/project-structure) · node-postgres.com · one `db/index.js` exports `query` and `getClient`, so logging and leak tracing live in one place (*read*) · covers our angle: **partial** — a data-access module, not a repository per resource · fetched 2026-10-12
- **Our delta:** plain functions taking an executor (pool or client) and returning rows; layering rationale stays in Node Phase 6.

### T09-02 · `list` with filtering, sorting and pagination — Master · ✅ written `docs/postgresql/pages/phase-9-api-crud/02-list-endpoint.md`
- **Read this:** [7.6. LIMIT and OFFSET](https://www.postgresql.org/docs/current/queries-limit.html) · postgresql.org · `LIMIT` without `ORDER BY` returns an unpredictable subset; skipped rows are still computed (*read*) · covers our angle: **partial** — no endpoint design · fetched 2026-10-12
- **Also good:** [7.5. Sorting Rows (ORDER BY)](https://www.postgresql.org/docs/current/queries-order.html) · postgresql.org · (*headings only*) · [Paging Through Results](https://use-the-index-luke.com/sql/partial-results/fetch-next-page) · use-the-index-luke.com · offset versus seek (*read*)
- **Our delta:** one `list` function combining optional filters, an allowlisted sort, and a deterministic tie-break column.

### T09-03 · Safe dynamic `WHERE` — Master · ✅ written `docs/postgresql/pages/phase-9-api-crud/03-safe-dynamic-where/README.md`
- **Read this:** [Queries → Parameterized query](https://node-postgres.com/features/queries) · node-postgres.com · values travel separately; "PostgreSQL does not support parameters for identifiers" (*read*) · covers our angle: **partial** — no pattern for building predicates and the value array together · fetched 2026-10-12
- **Also good:** [SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) · owasp.org · "Stop writing dynamic queries with string concatenation"; defense option 1 is parameterised queries (*read*)
- **Our delta:** push a predicate string and a value in lock step so `$n` always equals `values.length`; no page shows it for `pg`.

### T09-04 · Sort and filter allowlists — Master · ✅ written `docs/postgresql/pages/phase-9-api-crud/04-allowlists/README.md`
- **Read this:** [OWASP SQL Injection Prevention → Defense Option 3: Allow-list Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html#defense-option-3-allow-list-input-validation) · owasp.org · for table names, column names and sort indicators that cannot be bind variables, map the input to known values (*read*; anchor id found in the page HTML) · covers our angle: full for the principle; its code is Java · fetched 2026-10-12
- **Our delta:** a JS `Map` from public sort keys to column expressions, plus direction `ASC`/`DESC` only; unknown key means 400, not a default.

### T09-05 · Transactions in a request — Master · ✅ written `docs/postgresql/pages/phase-9-api-crud/05-transactions-request/README.md`
- **Read this:** [Transactions](https://node-postgres.com/features/transactions) · node-postgres.com · same client for every statement; never `pool.query` for a transaction; `BEGIN`, `COMMIT`, `ROLLBACK` in `try`/`catch`/`finally` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Tutorial → Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html) · postgresql.org · the SQL-side explanation (*headings only*)
- **Our delta:** a `withTransaction(fn)` wrapper; a failed `ROLLBACK` must not hide the original error.

### T09-06 · `create` — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/06-create.md`
- **Read this:** [6.4. Returning Data from Modified Rows](https://www.postgresql.org/docs/current/dml-returning.html) · postgresql.org · `RETURNING` on `INSERT` avoids an extra query (*read*) · covers our angle: **partial** — no row-to-domain mapping · fetched 2026-10-12
- **Also good:** [Queries](https://node-postgres.com/features/queries) · node-postgres.com · example `INSERT ... RETURNING *` then reads `res.rows[0]` (*read*)
- **Our delta:** mapping the returned row to the domain object, and the `23505` case (T07-05).

### T09-07 · `findById` — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/07-find-by-id.md`
- **Read this:** none found — tried: WebSearch "node-postgres findById not found null vs throw repository", node-postgres.com guides, PostgreSQL manual (no page decides the not-found policy)
- **Also good:** [pg.Result](https://node-postgres.com/apis/result) · node-postgres.com · an empty result is `rows.length === 0`, not an error (*read*)
- **Our delta:** the `null`-versus-throw decision is ours to argue; state one rule per layer.

### T09-08 · `update` — partial updates — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/08-update-partial.md`
- **Read this:** [9.18. Conditional Expressions → COALESCE](https://www.postgresql.org/docs/current/functions-conditional.html) · postgresql.org · returns the first non-null argument (*read*) · covers our angle: **partial** — nothing on why `COALESCE($2, col)` cannot set a column to `NULL` · fetched 2026-10-12
- **Our delta:** the null-versus-absent problem: `COALESCE` keeps the old value on `NULL`, so a client cannot clear a column; a dynamic `SET` built from keys actually present (allowlisted) can. No single page covers both; web search found only mailing-list threads, not opened.

### T09-09 · `delete` — hard versus soft — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/09-delete-soft-hard.md`
- **Read this:** [Soft deletion with PostgreSQL: but with logic on the database!](https://evilmartians.com/chronicles/soft-deletion-with-postgresql-but-with-logic-on-the-database) · evilmartians.com · 2022-05-16; hard delete loses data, soft delete needs every read scoped; cascades and a hard-delete hatch (*read* the intro; rest *headings only*) · covers our angle: **partial** — Rails-flavoured, written for a database-side design · fetched 2026-10-12
- **Also good:** [6.4. Returning Data from Modified Rows](https://www.postgresql.org/docs/current/dml-returning.html) · postgresql.org · `DELETE ... RETURNING` (*read*) · [11.8. Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html) · postgresql.org · (*headings only*)
- **Our delta:** soft delete versus unique constraints (a partial unique index `WHERE deleted_at IS NULL`); return the deleted row.

### T09-10 · Keyset (cursor) pagination — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/10-keyset/README.md`
- **Read this:** [Paging Through Results](https://use-the-index-luke.com/sql/partial-results/fetch-next-page) · use-the-index-luke.com · Markus Winand; the seek method with SQL row values, and the index that makes it fast (*read* the row-values passage; undated page) · covers our angle: full for the idea; PostgreSQL syntax is ours · fetched 2026-10-12
- **Also good:** [9.25.5. Row Constructor Comparison](https://www.postgresql.org/docs/current/functions-comparisons.html) · postgresql.org · both sides need the same field count; the operator applies pairwise (*read*)
- **Our delta:** `(created_at, id) < ($1, $2)` with a matching index, and an opaque cursor encoding.

### T09-11 · Idempotent writes — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/11-idempotent-writes.md`
- **Read this:** [Stripe API: Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · docs.stripe.com · for v1, the first response (status and body) is saved under the key and returned on retry, including 500s (*read*) · covers our angle: **partial** — client-facing contract, no database design · fetched 2026-10-12
- **Also good:** [INSERT → ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html) · postgresql.org · `DO NOTHING` / `DO UPDATE` (*read*)
- **Our delta:** the key table, claim-then-work in one transaction, 409 for an in-flight key. *Checked, not chosen:* IETF `draft-ietf-httpapi-idempotency-key-header-07` (datatracker page loaded; draft status **not confirmed**, the page needs JavaScript).

### T09-12 · Passing a client through service functions — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/12-client-propagation.md`
- **Read this:** [Transactions](https://node-postgres.com/features/transactions) · node-postgres.com · "You must use the same client instance for all statements within a transaction" (*read*) · covers our angle: **partial** — one function; no multi-repository service · fetched 2026-10-12
- **Our delta:** every repository function takes the executor first; the service owns `BEGIN`/`COMMIT`. Propagation mechanics stay in Node Phase 6.

### T09-13 · Optimistic concurrency — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/13-optimistic.md`
- **Read this:** [Implementing Optimistic Locking in PostgreSQL](https://reintech.io/blog/implementing-optimistic-locking-postgresql) · reintech.io · dated July 3, 2024; `UPDATE ... WHERE id AND version`, a zero row count means missing or changed, then a follow-up read tells which (*read*; the code is Python, the byline reads "Arthur C. Codex") · covers our angle: **partial** — not Node · fetched 2026-10-12
- **Our delta:** `rowCount === 0` handling with `pg` (T07-06) and `RETURNING version`; a retry must re-read the row.

### T09-14 · `SELECT ... FOR UPDATE` in a request — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/14-for-update.md`
- **Read this:** [13.3. Explicit Locking → Row-Level Locks](https://www.postgresql.org/docs/current/explicit-locking.html) · postgresql.org · `FOR UPDATE` blocks other updates, deletes and locks until the transaction ends; under `REPEATABLE READ` a changed row raises an error (*read*) · covers our angle: full for lock semantics · fetched 2026-10-12
- **Our delta:** keep the lock window short (no network call between lock and write) and always order lock acquisition; Node-side timing is ours.

### T09-15 · Shaping the response in SQL (`jsonb_agg`) versus JavaScript — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/15-shape-sql-vs-js.md`
- **Read this:** [JSON — the relational database's built-in ORM?](https://blogg.knowit.no/json-the-relational-databases-built-in-orm) · blogg.knowit.no · Audun Halland, 2020-11-18 (modified 2023-06-15); N+1 versus `json_agg` nested in one query, almost no mapping code (*read*) · covers our angle: **partial** — one-sided case for SQL; no costs · fetched 2026-10-12
- **Also good:** [9.21. Aggregate Functions](https://www.postgresql.org/docs/current/functions-aggregate.html) · postgresql.org · `jsonb_agg` collects values including nulls into a JSON array (*read*)
- **Our delta:** the honest trade-off the syllabus asks for (payload size, empty-array `NULL`, dates arrive as strings from `jsonb`); no benchmark source fetched.

### T09-16 · Testing against a real PostgreSQL — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/16-testing-real-pg.md`
- **Read this:** [Testcontainers for NodeJS: PostgreSQL module](https://node.testcontainers.org/modules/postgresql/) · node.testcontainers.org · `PostgreSqlContainer`, `getConnectionUri()`, snapshots (not with the `postgres` database) (*read*) · covers our angle: **partial** — module reference; per-test rollback isolation is elsewhere · fetched 2026-10-12
- **Also good:** [Getting started with Testcontainers for Node.js](https://testcontainers.com/guides/getting-started-with-testcontainers-for-nodejs/) · testcontainers.com · `pg` plus `jest` with the PostgreSQL module (*read*) · [Database Test Isolation](https://eradman.com/posts/database-test-isolation.html) · eradman.com · wrap each test in a transaction, if one connection is used (*read*)
- **Our delta:** per-test `BEGIN`/`ROLLBACK` on one client; written second, with Node Phase 9 once it lands.

### T09-17 · `created_at`/`updated_at` — trigger versus application — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/17-timestamps-trigger.md`
- **Read this:** [F.41. spi → moddatetime](https://www.postgresql.org/docs/current/contrib-spi.html) · postgresql.org · a `BEFORE UPDATE` trigger storing the current time in a named column (*read*) · covers our angle: **partial** — an extension, not the trade-off · fetched 2026-10-12
- **Also good:** [PL/pgSQL Trigger Functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html) · postgresql.org · the `emp_stamp` example sets `last_date` and `last_user` in `BEFORE` (*read*)
- **Our delta:** why the trigger wins (every writer, including `psql`, is covered); `moddatetime` availability on managed hosts **not confirmed**.

### T09-18 · `snake_case` to `camelCase` mapping — Understand · ✅ written `docs/postgresql/pages/phase-9-api-crud/18-snake-camel.md`
- **Read this:** none found for `pg` — node-postgres.com has no page on it; tried: WebSearch "node-postgres snake_case camelCase mapping"
- **Also good:** [postgres.js README (raw): Data Transformation](https://raw.githubusercontent.com/porsager/postgres/master/README.md) · github (raw) · `transform: postgres.camel` converts names both ways, only from snake_case (*read*; other driver) · [PgTyped: Getting Started](https://pgtyped.dev/docs/getting-started) · pgtyped.dev · config key `camelCaseColumnNames` (*read*)
- **Our delta:** one mapper function at the repository boundary; writes need the reverse map, so name it in the allowlist (T09-04).
