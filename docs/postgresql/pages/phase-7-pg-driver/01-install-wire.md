---
title: "Installing and wiring pg"
sidebar_label: "01 · Install and wire"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex20-driver.mjs`.

**One `Pool`, created once at module scope, exported, and shared by every request.
Constructing it opens nothing — the first connection is made by the first query, which
is also where a wrong host finally tells you.**

## Install

```bash
npm install pg
```

`pg` is the driver this whole part uses. It is pure JavaScript with no build step and no
`libpq` dependency, which is why it installs cleanly everywhere. Optional companions,
added only when a page needs them:

| Package | For |
|---|---|
| `pg-cursor` | Streaming large results ([Cursors](15-cursors.md)) |
| `pg-copy-streams` | `COPY` ([`COPY` from streams](../phase-8-schema-from-node/09-copy-streams.md)) |
| `postgres` | The alternative driver ([pg vs postgres.js](16-postgres-js.md)) |

There are no separate `@types/pg` worries in 8.x if you use the bundled types; for
TypeScript, `npm i -D @types/pg` still applies to older setups.

## The module every app has

```js
// db.js — created once, imported everywhere
import pg from 'pg';

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'devbible-api',
});

pool.on('error', (err) => {
  // a connection died while idle in the pool — never let this go unhandled
  console.error('idle client error', err);
});

export const query = (text, params) => pool.query(text, params);
```

Three things make this the shape to copy:

- **Module scope.** The pool is created once when the module is first imported and reused
  for the process's lifetime. A pool created per request is worse than no pool at all —
  see [Where the pool must live](/docs/nodejs/pages/phase-6-data-access/connection-pooling).
- **`pool.on('error')` is mandatory.** Idle connections can be killed by the server; the
  resulting `'error'` event is emitted on the pool, and unhandled it takes the process
  down. [Timeouts](11-timeouts.md) shows this happening.
- **`application_name`** costs nothing and pays for itself the first time you look at
  `pg_stat_activity` wondering which service is holding a lock.

`pg` is CommonJS-first; both import styles work on Node 24:

```js
import pg from 'pg';                    // ESM — default import, then pg.Pool
const { Pool } = require('pg');         // CommonJS
```

Named ESM imports (`import { Pool } from 'pg'`) work through Node's CJS interop, but the
default import is the form that has never broken.

## Nothing connects until the first query

```console
$ node ex20-driver.mjs
=== 2. when the connection actually opens ===
after new Pool()      → totalCount: 0 idleCount: 0
after first query     → totalCount: 1 idleCount: 1
what the server sees  → { application_name: 'devbible-ex20', state: 'active' }
```

`new Pool()` is a plain object construction — it performs no I/O, does not validate the
host, and never rejects. The pool opens connections lazily, one at a time, as demand
arrives. After a single query exactly one connection exists, and it stays in the pool as
`idle` ready for reuse.

The practical consequence is where errors appear:

```console
=== 3. where connection errors surface ===
constructed a pool to a dead port — no error yet
first query → ECONNREFUSED | connect ECONNREFUSED 127.0.0.1:1
```

A typo in the host, a wrong port, a firewall — none of it surfaces at startup. The
process boots happily and the first request fails. That is why a **startup check** is
worth the four lines:

```js
// index.js — fail fast, before accepting traffic
await pool.query('SELECT 1');
console.log('database reachable');
app.listen(3000);
```

Note this is a *liveness* check, not a readiness contract — the distinction, and what to
put in a health endpoint, is
[Driver lifecycle](/docs/nodejs/pages/phase-6-data-access/driver-lifecycle).

## `application_name` shows up server-side

```console
what the server sees  → { application_name: 'devbible-ex20', state: 'active' }
```

```sql
SELECT pid, application_name, state, query
FROM pg_stat_activity WHERE datname = current_database();
```

With it set, every connection is attributable. Without it, `pg_stat_activity` shows a
column of empty strings and you cannot tell the API from the worker from the migration
runner while an incident is in progress.

## Confirming what you are actually talking to

```js
const { rows: [v] } = await pool.query(
  `SELECT version(), current_database(), current_user, inet_server_port() AS port`);
```

Worth doing once when a setup misbehaves. The number of "why is my migration not
applying" problems that turn out to be two different databases is high.

## One pool per process, not per module

The pool belongs to the process. Import the same `db.js` everywhere rather than
constructing a second `Pool` in another file — two pools of `max: 10` are 20
connections, and PostgreSQL's default `max_connections` is 100 shared across *every*
client, including your migration runner and whatever `psql` sessions are open.

The exceptions are deliberate and few:

- A **separate pool for a replica** ([Read replicas](/docs/nodejs/pages/phase-6-data-access/read-replicas)).
- A **dedicated `Client`** for `LISTEN`, which must not be pooled
  ([LISTEN/NOTIFY](14-listen-notify.md)).
- A short-lived pool in a migration script that ends when the script does.

## Trade-off

A module-scope pool means shared, reused connections and one place to configure
everything, at the cost of process-global state: the pool outlives every request, so a
leaked client is leaked forever ([`connect` and `release`](07-connect-release.md)), and
tests need explicit teardown or the process will not exit ([`pool.end`](13-pool-end.md)).

Lazy connection keeps startup fast and lets the app boot when the database is briefly
unavailable — at the cost of moving connection failures into the first request, which is
why an explicit startup check is worth adding back deliberately.

## Gotchas

**Symptom:** The app starts fine and every request fails with `ECONNREFUSED`
**Cause:** `new Pool()` does no I/O — measured, `totalCount: 0` until the first query.
**Fix:** `await pool.query('SELECT 1')` before `listen()`.

**Symptom:** The process exits with an uncaught error hours after starting
**Cause:** An idle pooled connection was terminated server-side and no `pool.on('error')`
handler exists.
**Fix:** Always attach one.

**Symptom:** `too many clients already` (`53300`)
**Cause:** Several pools per process, or many processes × `max`.
**Fix:** One shared pool; size it against `max_connections` across all clients —
[Sizing the pool](/docs/nodejs/pages/phase-6-data-access/connection-pooling).

**Symptom:** `pg_stat_activity` cannot tell you which service is blocking
**Cause:** No `application_name`.
**Fix:** Set it in the pool config.

**Symptom:** A test suite hangs after the last test
**Cause:** The module-scope pool keeps the event loop alive.
**Fix:** `await pool.end()` in global teardown.

**Symptom:** `import { Pool } from 'pg'` fails in some toolchain
**Cause:** CJS/ESM interop in an older bundler.
**Fix:** `import pg from 'pg'` then `pg.Pool`.

## Interview questions

**★ When does `new Pool()` connect to the database?**
It does not. Construction performs no I/O — measured, `totalCount: 0` and `idleCount: 0`
straight after `new Pool()`, becoming 1 and 1 after the first query. Connections are
opened lazily on demand, so a bad host produces `ECONNREFUSED` at first query rather than
at startup. Add an explicit `SELECT 1` at boot if you want to fail fast.

**★ Where should the pool be created?**
Once, at module scope, exported and shared for the process's lifetime. Per-request pools
defeat the entire point — you pay a TCP connect, TLS handshake and authentication round
trip per request, and you exhaust `max_connections` under load.

**★ Why is `pool.on('error')` not optional?**
Because connections sitting idle in the pool can be terminated by the server — an
administrator, an idle timeout, a restart. `pg` emits that as an `'error'` event, and an
unhandled `'error'` event in Node is an uncaught exception that kills the process. The
handler usually just logs; the pool discards the dead connection itself.

**Why set `application_name`?**
It appears in `pg_stat_activity`, so every connection is attributable to a service during
an incident. Measured, the value set in the pool config showed up server-side
immediately. It costs nothing.

**How many pools should an application have?**
One per process, per database. Legitimate exceptions are a replica pool, a dedicated
non-pooled `Client` for `LISTEN`, and short-lived pools in scripts.

---

← [Phase index](README.md) · Next → [`Pool` vs `Client`](02-pool-vs-client.md)
