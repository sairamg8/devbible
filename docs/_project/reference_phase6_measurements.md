---
name: devbible-phase6-measurements
description: The full measured dataset for Node Phase 6 (data access) — every number, error code and console line the 16 pages are built from, captured 2026-08-10 on Node 24.19.0
metadata:
  type: reference
---

Child of [[devbible-progress]]. **Working data, not curated** — this exists so the
remaining Phase 6 pages can be written without rebuilding the sandbox. Once all 16
pages are written, keep only the entries that contradict common advice (move them
into [[devbible-phase-findings]]) and delete the rest.

## The sandbox

Session scratchpad, **outside the project**: `…/scratchpad/p6/`. Deliberate — the
repo stays clean. Earlier phases used `scratchpad/` inside the project.

| Container | Image | Port | Notes |
|---|---|---|---|
| `p6-pg` | `postgres:17-alpine` (17.10) | 55432 | db `shop`, user `postgres`, pw `devbible` |
| `p6-pg-rep` | same, `--network=host` | 55433 | **real streaming replica** via `pg_basebackup -R`, data in `/tmp/rep` |
| `p6-mongo` | `mongo:8` (8.2.12) | 57017 | `--replSet rs0`, initiated, so transactions work |

**Connect with `127.0.0.1`, never `localhost`** — `localhost` resolved `::1` first
and every Mongo write died with `write ECONNRESET`. (Same `verbatim` DNS default as
the Phase 5 finding.)

Versions: `pg` 8.23.0 · `mongodb` 7.5.0 · `mongoose` 9.9.1 · `pg-cursor` 2.22.0 ·
`pg-query-stream` 4.17.0 · `drizzle-orm` 0.45.2 · `prisma` / `@prisma/client` /
`@prisma/adapter-pg` **7.9.1** · SQLite in `node:sqlite` **3.53.3**.

Schema: `users` (500) · `orders` (5000) · `order_items` (20 000) · `accounts` (2,
with a `balance_cents >= 0` check) · Mongo `users` 500 / `orders` 5000 /
`events` 200 000.

Scripts: `ex1-pool` `ex2-pg-types` `ex3-injection` `ex4-tx` `ex4b/c/d`
`ex5-nplus1` `ex6-cursors` `ex7-sqlite` `ex8-mongoose` `ex9-lifecycle`
`ex10-migrate` `ex11-drizzle` `ex12-prisma` `ex13-replica` `ex14-propagation`
`ex15-knobs`, plus `repo/` (repository + `node --test`).

## Pooling (page 01 — written)

- 10 × `pg_sleep(0.2)`: **max:2 → 1054 ms**, **max:10 → 239 ms**.
- 20 queries, new `Client` each → **279 ms**; one pooled connection → **6 ms**.
- Mid-flight `{total:2, idle:0, waiting:4}` → drained `{2,2,0}`.
- Both connections leaked → `Error: timeout exceeded when trying to connect`.
- Server: `max_connections 100`.
- `pg.Pool` defaults: `max 10, min 0, idleTimeoutMillis 10000,
  connectionTimeoutMillis undefined, maxUses Infinity, maxLifetimeSeconds 0,
  allowExitOnIdle false`.

## Lifecycle, timeouts, retry (pages 03, 14)

- `new Pool()` to a dead port returns in **0 ms**, `totalCount 0`; the first query
  fails after **9 ms** `ECONNREFUSED`. Wrong password → **28P01** on first use.
- Boot check `select 1` → **17 ms**. After `pool.end()`:
  `Cannot use a pool after calling end on the pool`.
- **Unhandled `'error'` crash**: `pg_terminate_backend` on an *idle* pooled
  connection → `Emitted 'error' event on BoundPool instance … code: '57P01'`,
  process exits 1. With `pool.on('error')`: logs `57P01`, next query returns `{ok:1}`.
- `statement_timeout: 500` → **57014** after 535 ms, *connection still usable*.
- `query_timeout: 500` → `Query read timeout` after 512 ms, **but the server query
  is still running** (`pg_stat_activity` count 1). Client-side only.
- `idle_in_transaction_session_timeout: 500` → **25P03**, emitted on the *checked-out
  client*, so `pool.on('error')` does **not** catch it — process crashed anyway.
- Retry loop, container stopped then started: attempts 1–5 `ECONNREFUSED` with
  jittered backoff 173/248/535/1557/1546 ms, **connected on attempt 6 after 4123 ms**.
- Mongo: `new MongoClient()` returns in 16 ms; `connect()` to a dead port fails after
  **2013 ms** with `MongoServerSelectionError` (`serverSelectionTimeoutMS=2000`).
  Defaults: `maxPoolSize 100, minPoolSize 0, serverSelectionTimeoutMS 30000,
  connectTimeoutMS 30000, retryWrites true, retryReads true`. After `close()`:
  `MongoNotConnectedError: Client must be connected before running operations`.

## Parameterized queries / injection (page 02)

- Concatenated `where email = '${input}'`: `x' or '1'='1` → **500 rows**;
  `x' union all select id, token from sessions --` → **returned the session tokens**;
  `x'; drop table sessions; --` → **the table was actually dropped**
  (`to_regclass` → `null`) because a **no-parameter `pool.query` uses the simple
  protocol, which allows stacked statements**.
- With `$1`, both hostile inputs → **0 rows**.
- Multi-statement **with** a parameter → `42601 cannot insert multiple commands into
  a prepared statement`. Without parameters it succeeds and returns an **array** of
  results.
- `$1` cannot be an identifier: `select * from $1` → `42601 syntax error at or near "$1"`.
  `pg.escapeIdentifier('email; drop table sessions; --')` →
  `"email; drop table sessions; --"` (quoted, harmless).
- Mongo: body `{"username":"ada","password":{"$ne":null}}` **logged in as the admin
  user**; `{"$regex":"^h"}` confirms a password prefix. `{$eq: String(v)}` → `null`.
  `$where: 'this.username.length > 2'` executed and returned both users.

## pg specifics (page 04)

- Type mapping: `int4 → number`, **`int8 → string`**, **`numeric → string`**,
  `float8 → number`, `bool`, `timestamptz → Date`, `jsonb → object`, `int[] → array`.
- **`count(*)` is a string**: `'5000' + 1 === '50001'`.
- **`current_date` becomes local midnight**: `2026-08-09T18:30:00.000Z` in IST — a
  whole-day shift.
- `select id from users where id = any($1::int[])` with `[[1,2,3]]` works.
- `insert … returning id, created_at` → `{id: 501, created_at: Date}`.
- 200 lookups: **unnamed 120 ms**, **named (prepared) 78 ms**.
- `rowMode: 'array'` → `[[1,"user1@example.com"], …]`.
- `pg.types.setTypeParser(20, BigInt)` → `count` is `5000n`.

## Transactions (page 06)

- `pool.query('BEGIN')` sequentially **reuses one connection** (pids 124,124,124) —
  which is why the bug survives development. Under concurrency the statements
  scatter: flow B's `UPDATE` ran on pid 137 and its **`ROLLBACK` on pid 136**, the
  connection belonging to flow A. Row locks serialised the two flows, so the balance
  still came out right — **do not claim a corrupted balance, claim the scatter**.
- **Deterministic damage instead**: `BEGIN` + `insert` through the pool with no
  commit leaves the pooled connection `state: 'idle in transaction'`, invisible to
  other connections (`count 0`), inherited by the next request on that connection
  (`txid 797`, sees its own row), and **gone after `pool.end()`**.
- A failed statement poisons the rest: `23514` then
  **`25P02 current transaction is aborted, commands ignored until end of transaction block`**.
- `SAVEPOINT s1` / `ROLLBACK TO SAVEPOINT s1` → outer work survived.
- 4 open transactions in a `max:4` pool → `waitingCount 1`, the queued query
  completed **103 ms** later, exactly when they released.
- `pg_stat_activity`: `active=1 idle=2 idle in transaction=1`.
- Mongo `session.withTransaction`: commit and abort both correct; **an operation
  that omits `{session}` writes anyway and survives the abort** (balance 7499).
- Propagation (ex14): executor-passing and `AsyncLocalStorage` both verified.
  **Using `pool` instead of `tx` for one statement inside a transaction keeps that
  write after the rollback** — measured (`2:2601`).

## N+1 (page 07)

100 orders + their items: **N+1 sequential 101 queries / 111 ms**, N+1 parallel
**49 ms**, batched `= any($1)` 2 queries **7 ms**, one `json_agg` query **6 ms**.
100 round trips to localhost = **58 ms (0.58 ms each)**.
Mongo: N+1 101 queries **158 ms**, `$in` 2 queries **6 ms**, `$lookup` **10 ms**.

## Cursors (page 16)

500 000 rows (`repeat('x',200)`), separate processes, baseline RSS 78 MB:
`pool.query` **300 MB / 1026 ms** · `Cursor.read(1000)` **111 MB / 1110 ms** ·
`QueryStream` **110 MB / 6353 ms** (object-mode streams are ~5.7× slower here).
Breaking out of a `for await` over a `QueryStream` after 10 rows leaves the
connection usable. Mongo 200 000 docs: `toArray()` **486 MB / 1739 ms** vs
`for await` cursor **143 MB / 4522 ms**.

## node:sqlite (page 12)

SQLite **3.53.3**. Exports: `DatabaseSync, Session, StatementSync, backup, constants`.
1000 inserts: **3 ms in one transaction vs 77 ms autocommit**.
**Foreign keys are ON by default** (`pragma foreign_keys` → 1) — unlike the sqlite3
CLI. Reading a value above `MAX_SAFE_INTEGER` **throws `ERR_OUT_OF_RANGE`** rather
than silently rounding; `stmt.setReadBigInts(true)` fixes it. Blobs come back as
`Uint8Array`. Rows are `[Object: null prototype]`. `insert … returning` works.
Writing `sqlite_schema` → `ERR_SQLITE_ERROR: table sqlite_master may not be modified`
(defensive mode). `loadExtension` → `ERR_INVALID_STATE: extension loading is not
allowed`. `db.function('cents_to_eur', …)` works.

## Mongoose 9.9.1 (page 09)

Queries issued **before `connect()` buffer** and resolve later. Unknown fields are
dropped silently (`isAdmin` gone); `age: '41'` cast to number; `email` lowercased and
trimmed. `create` runs validators (`ValidationError`), **`updateOne` does not** — a
40-char name was stored past a `maxlength: 30` until `runValidators: true`.
Hooks: `pre('save')` does **not** fire for updates; `updateOne` fires `pre('updateOne')`,
`findOneAndUpdate` fires only its own. **`{new: true}` is deprecated in Mongoose 9 —
use `returnDocument: 'after'`** (it printed the deprecation warning); without it you
get the pre-update document. `{age: {$ne: null}}` is allowed (operators are not
cast); `{age: 'not-a-number'}` → `CastError`. 5001 docs: **hydrated 136 ms vs
`.lean()` 57 ms**, RSS 166 MB. `autoIndex` defaults to **true**.

## ORMs and builders (pages 08, 13)

500 single-row lookups: **raw `pg` 296 ms · Drizzle 388 ms · Prisma 597 ms**.
Drizzle `.toSQL()` prints the exact SQL and params; `sql``` `` templates stay
parameterized; `bigint(…, {mode:'number'})` decides the JS type.
**Prisma 7 is a breaking change**: `url` in `datasource` is now a hard error
(`P1012 … no longer supported`), URLs move to **`prisma.config.ts`**
(`defineConfig({schema, datasource:{url: env('DATABASE_URL')}})`), and the client
requires a **driver adapter** (`new PrismaClient({adapter: new PrismaPg({connectionString})})`).
`prisma db pull` introspected 6 models in 134 ms and warned that **check constraints
are not supported**. A relation `select`/`include` is **two queries, not a join**
(`… where id IN ($1,$2,$3)`). `bigint` columns → JS `BigInt`.

## Migrations (page 11)

Hand-written runner (~40 lines): `schema_migrations(version, checksum, applied_at)`,
`pg_advisory_lock(8675309)`, one transaction per file, sha256 checksum.
First run applied 001/002; second run "already applied"; **two deploys at once — the
second waited 1306 ms for the lock** then found nothing to do. A migration whose
second statement failed rolled back **completely** (the column list was unchanged —
Postgres DDL is transactional). Editing an applied file was caught:
`001_create_invoices.sql was edited after it was applied (b98f68f3d6a3 -> 4131454e8d81)`.

## Read replicas (page 15)

Real streaming replica. `pg_is_in_recovery()` true on 55433. A write there →
**`25006 cannot execute INSERT in a read-only transaction`**.
Read-your-writes, 20 rounds on an idle localhost pair: visible after **8821 µs**
worst case, typically 1.5–2.5 ms, sometimes needing 2–3 reads.
`pg_stat_replication`: `state streaming, sync_state async, replay_lag 00:00:00.001587`.
**A routed read immediately after a routed write returned 0 rows**; the same query
sent to the primary returned 1. That is the whole argument for "read your own
writes from the primary".

## Repository pattern (page 10)

`repo/` — `makeOrderRepo(pool)` maps `row.total_cents` (string) to a domain number,
`refunds.mjs` has no driver import, `refunds.test.mjs` fakes the repo in three lines.
**4 tests pass in 139 ms with `node --test`, no database, no mocking library.**
