---
title: "Link map · PostgreSQL · Part 3 (phases 7–9)"
sidebar_label: "03 · PostgreSQL · Node + pg"
sidebar_position: 3
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
- **Also good:** [SSL](https://node-postgres.com/features/ssl) · node-postgres.com · warns that `sslmode` in the connection string replaces the `ssl` object (*read*) · [34.15. Environment Variables](https://www.postgresql.org/docs/current/libpq-envars.html) · postgresql.org · the full `PG*` list (*headings only*)
- **Our delta:** managed-provider SSL recipe; `127.0.0.1` not `localhost` (README note); the `sslmode` override trap.

### T07-04 · `pool.query()` with `$1` placeholders — Master · ✅ written `docs/postgresql/pages/phase-7-pg-driver/04-query-placeholders.md`
- **Read this:** [Queries](https://node-postgres.com/features/queries) · node-postgres.com · parameters go to the server separately; identifiers cannot be parameters; JS-to-SQL conversion rules for `null`, `Date`, arrays, objects (*read*) · covers our angle: **partial** — no `= ANY($1)` example · fetched 2026-10-12
- **Also good:** [Postgres Query Boost: Using ANY Instead of IN](https://www.crunchydata.com/blog/postgres-query-boost-using-any-instead-of-in) · crunchydata.com · Matt Hudson, 2022-11-18; why `ANY` over a variable-length `IN` (*read*) · [9.25.3. ANY / SOME (array)](https://www.postgresql.org/docs/current/functions-comparisons.html) · postgresql.org · right-hand side must be an array (*read*)
- **Our delta:** `WHERE id = ANY($1::int[])` with a JS array as one parameter, and an empty-array case; neither node-postgres page shows it.

### T07-05 · Errors from PostgreSQL in Node — Master · ✅ written `docs/postgresql/pages/phase-7-pg-driver/05-errors.md`
- **Read this:** [Appendix A. PostgreSQL Error Codes](https://www.postgresql.org/docs/current/errcodes-appendix.html) · postgresql.org · class 23 lists `23505 unique_violation`, `23503 foreign_key_violation`, `23502 not_null_violation`, `23514 check_violation` (*read*) · covers our angle: **partial** — nothing on the Node `error` object · fetched 2026-10-12
- **Also good:** [`DatabaseError` in pg-protocol (raw source)](https://raw.githubusercontent.com/brianc/node-postgres/master/packages/pg-protocol/src/messages.ts) · github (raw) · class fields `code`, `detail`, `hint`, `schema`, `table`, `column`, `dataType`, `constraint` (*read* the class) · [53.8. Error and Notice Message Fields](https://www.postgresql.org/docs/current/protocol-error-fields.html) · postgresql.org · constraint-name field only set for some error types (*read*)
- **Our delta:** the 23505-to-409 mapping; the Node `error` object is not documented on node-postgres.com, so the field list rests on source code.

### T07-06 · The result object — Understand · ✅ written `docs/postgresql/pages/phase-7-pg-driver/06-result-object.md`
- **Read this:** [pg.Result](https://node-postgres.com/apis/result) · node-postgres.com · `rows`, `fields`, `command`, `rowCount` (can be `null`, e.g. `LOCK`); `rowCount` is rows processed, not rows returned (*read*) · covers our angle: full · fetched 2026-10-12
- **Our delta:** the empty-result shape (`rows: []`, `rowCount` 0) and the maintainer's caution against assuming `rows.length` equals `rowCount`.

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
- **Read this:** [34.3. Command Execution Functions](https://www.postgresql.org/docs/current/libpq-exec.html) · postgresql.org · `PQexecParams` allows at most one nonempty command, "a limitation of the underlying protocol", and a defence against injection (*read*) · covers our angle: **partial** — it is the C library page, not `pg` · fetched 2026-10-12
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
- **Read this:** [postgres.js README (raw)](https://raw.githubusercontent.com/porsager/postgres/master/README.md) · github (raw) · tagged-template queries, automatic prepared statements (`prepare: true`), `sql.begin`, `.listen`, bigint returned as a string (*read* the headings and several sections) · covers our angle: **partial** — a README, not a comparison · fetched 2026-10-12
- **Also good:** [Waddler <> PostgreSQL](https://waddler.drizzle.team/docs/connect-postgresql) · waddler.drizzle.team · lists differences it found: postgres.js prepares by default, `pg` allows per-query type parsers (*read* the section; vendor-adjacent, undated)
- **Our delta:** a neutral comparison — no benchmark source was fetched, so the README's "fastest" claim is **not confirmed** and must be worded as the author's claim.
- *Checked, not chosen:* StackShare "versus" pages (index noise, no comparison content; not fetched).
