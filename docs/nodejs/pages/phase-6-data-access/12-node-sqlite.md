---
title: "node:sqlite — SQL with zero setup"
sidebar_label: "12 · node:sqlite"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — bundled **SQLite 3.53.3**, no flag
> required, no experimental warning printed.

**Node ships a SQL database.** No install, no server, no driver from npm — a real
relational database inside the runtime. It is not a PostgreSQL replacement, and
knowing exactly what it *is* good for is the whole value of this page.

## It is there right now

```js
import {DatabaseSync} from 'node:sqlite';

const db = new DatabaseSync(':memory:');
db.exec(`
  create table invoices (
    id integer primary key,
    user_id integer not null,
    total_cents integer not null
  )`);

const insert = db.prepare('insert into invoices (user_id, total_cents) values (?, ?)');
insert.run(7, 250000);

const row = db.prepare('select * from invoices where user_id = ?').get(7);
console.log(row);
console.log(db.prepare('select sqlite_version() as v').get());
```

```console
$ node invoices.mjs
[Object: null prototype] { id: 1, user_id: 7, total_cents: 250000 }
[Object: null prototype] { v: '3.53.3' }
```

Five exports, and that is the entire surface:

```js
import * as sqlite from 'node:sqlite';
console.log(Object.keys(sqlite));
```

```console
[ 'DatabaseSync', 'StatementSync', 'Session', 'constants', 'backup' ]
```

`DatabaseSync` is the connection. `StatementSync` is what `prepare()` returns, with
`.run()` (writes, returns `{changes, lastInsertRowid}`), `.get()` (first row) and
`.all()` (every row). `Session` is SQLite's changeset API for replicating edits.
`backup()` copies a live database. `constants` holds the flags.

**Everything is synchronous.** That is the design, not an omission: SQLite is a local
file read, not a network round trip, so there is no I/O to await. It also means a
slow query blocks the event loop — see the limits below.

## Details that differ from what you expect

**Rows have a null prototype.** `[Object: null prototype] { id: 1 }` — there is no
`toString`, no `hasOwnProperty`, and `{...row}` or `Object.assign({}, row)` is how you
get an ordinary object before something downstream trips over it.

**Foreign keys are ON by default** — unlike the `sqlite3` CLI and unlike most
libraries, where the default is off and everyone learns that the hard way:

```js
console.log(db.prepare('pragma foreign_keys').get());
```

```console
[Object: null prototype] { foreign_keys: 1 }
```

**Big integers throw rather than round.** SQLite's `integer` is 64-bit; JavaScript's
`number` is not:

```js
db.exec('insert into t (big) values (9007199254740993)');
db.prepare('select big from t').get();
```

```console
ERR_OUT_OF_RANGE: Value is too large to be represented as a JavaScript number:
9007199254740993
```

That is a much better failure than the silent rounding other bindings do. Opt into
`BigInt` per statement:

```js
const stmt = db.prepare('select big from t');
stmt.setReadBigInts(true);
console.log(stmt.get());
```

```console
[Object: null prototype] { big: 9007199254740993n }
```

**Blobs come back as `Uint8Array`**, not `Buffer` — `Buffer.from(row.blob)` if you
need Buffer methods, which is a view, not a copy.

**`returning` works**, so you get the inserted row in one statement:

```js
db.prepare('insert into t (big) values (?) returning id').get(5);
```

```console
[Object: null prototype] { id: 3 }
```

**Custom functions in JavaScript** — something no client-server database gives you:

```js
db.function('cents_to_eur', (c) => c / 100);
db.prepare('select cents_to_eur(250000) as eur').get();
```

```console
[Object: null prototype] { eur: 2500 }
```

## Defensive mode is on, and you cannot turn it off

Two things are blocked deliberately:

```js
db.exec("update sqlite_schema set name = 'x'");
```

```console
ERR_SQLITE_ERROR: table sqlite_master may not be modified
```

```js
db.loadExtension('/tmp/vector0.so');
```

```console
ERR_INVALID_STATE: extension loading is not allowed
```

Defensive mode blocks writing the schema table directly and loading native
extensions, because a database file is untrusted input — opening a file someone sent
you should not be able to run their code. `allowExtension: true` in the constructor
enables extension loading if you truly need it; the schema-table block stays. If your
plan involved `sqlite-vec` or `sqlite-vss`, check that option before choosing this
module over `better-sqlite3`.

## The one performance fact that matters

Every write outside an explicit transaction is its own transaction, with its own
fsync. 1000 inserts into a file-backed database:

```console
autocommit          66 ms
one transaction      1 ms
```

**Around 60×.** The prepared statement is identical; only the transaction differs.

```js
const insert = db.prepare('insert into n (v) values (?)');
db.exec('begin');
for (const v of values) insert.run(v);
db.exec('commit');
```

Batch every bulk write. The other knob is the journal mode — the default is
`delete`, and `db.exec('pragma journal_mode = WAL')` lets readers run concurrently
with a writer, which matters the moment more than one thing touches the file.

## What it is actually for

**Learning and practising SQL.** Joins, window functions, CTEs, `explain query plan`
— all available with zero setup. This is the fastest path from "I should learn SQL"
to running a query, and it is why this page sits in a Node reference at all.

**Tests.** A schema created in `beforeEach` against `:memory:` and thrown away, with
no container and no cleanup. Real SQL, real constraints, microseconds. The caveat is
that SQLite is not PostgreSQL: no `jsonb`, different type affinity, no `RETURNING` on
every path, different locking. Testing PostgreSQL queries against SQLite tests a
dialect you do not ship.

**Local tooling and CLIs.** Caches, indexes, offline state, anything where the
alternative was a JSON file being rewritten in full. A single-file database with
transactions and queries beats hand-rolled persistence.

**Small production workloads, honestly.** SQLite runs real applications — the
constraint is one machine and mostly-reads. What rules it out for a typical PERN API
is not throughput, it is that it is a file: no network clients, no replica
([page 15](./15-read-replicas.md)), and horizontal scaling means shared state you
cannot share.

**The event loop is the other limit.** Synchronous calls mean a 200 ms query stalls
every request the process is serving. Fine for a CLI or a test; for a server, keep
queries small or move them to a worker thread.

## `node:sqlite` versus `better-sqlite3`

`better-sqlite3` is the mature npm equivalent, with the same synchronous design.
Take the built-in when you want **zero dependencies** — no native build, no
`node-gyp`, nothing to break on a Node upgrade. Take `better-sqlite3` when you need
extensions, a specific SQLite build, or an API that has been stable for years.

## Gotchas

**Symptom:** `row.hasOwnProperty is not a function`
**Cause:** Rows have a null prototype.
**Fix:** `{...row}` before handing it to code that expects a plain object.

**Symptom:** `ERR_OUT_OF_RANGE` reading a perfectly valid row
**Cause:** A 64-bit integer that exceeds `Number.MAX_SAFE_INTEGER`.
**Fix:** `stmt.setReadBigInts(true)` and handle `BigInt` — including that `JSON.stringify`
throws on it.

**Symptom:** A bulk import takes a minute for a few thousand rows
**Cause:** Autocommit — one fsync per statement.
**Fix:** Wrap the loop in `begin`/`commit`; measured 66 ms → 1 ms for 1000 inserts.

**Symptom:** `ERR_INVALID_STATE: extension loading is not allowed`
**Cause:** Defensive mode.
**Fix:** `new DatabaseSync(path, {allowExtension: true})`, and only for files you trust.

**Symptom:** `SQLITE_BUSY` with more than one process on the file
**Cause:** Default `delete` journal mode locks the whole database for a write.
**Fix:** `pragma journal_mode = WAL`, and set a busy timeout.

**Symptom:** Tests pass against SQLite and the query fails in production
**Cause:** Dialect differences — `jsonb`, type affinity, `numeric` handling.
**Fix:** Test PostgreSQL queries against PostgreSQL. Use SQLite where the SQL is
genuinely portable.

**Symptom:** Request latency spikes under load with SQLite in a server
**Cause:** Synchronous queries blocking the event loop.
**Fix:** Keep queries indexed and small, or run them in a worker thread.

## Interview questions

**★ Node ships a database — what is `node:sqlite` for?**
Zero-setup SQL: learning and practising queries, fast tests against a real relational
engine, and local tooling that would otherwise rewrite a JSON file. It is a
single-file, single-machine database, so it does not replace PostgreSQL for a
networked API.

**★ Why is the whole API synchronous?**
SQLite is a library reading a local file, not a server over a socket — there is no
I/O to await, so a callback would only add overhead. The consequence is that a slow
query blocks the event loop, which is fine in a CLI or a test and a real risk in a
server.

**★ Why does reading a large integer throw?**
SQLite integers are 64-bit and JavaScript numbers lose precision above
`Number.MAX_SAFE_INTEGER`. Rather than silently rounding, it raises `ERR_OUT_OF_RANGE`.
`stmt.setReadBigInts(true)` returns `BigInt` instead. Same class of problem as `pg`
returning `bigint` as a string — see [page 04](./04-postgresql-from-node.md).

**★ Why is a bulk insert slow, and what is the fix?**
Each statement outside a transaction commits and fsyncs on its own. Measured: 1000
inserts took 66 ms in autocommit and 1 ms inside one transaction. Wrap bulk writes in
`begin`/`commit`.

**What is defensive mode?**
It blocks writing `sqlite_schema` directly and loading native extensions, because a
database file may be untrusted input. Extensions can be re-enabled with
`allowExtension: true`; the schema-table protection stays.

**Would you use SQLite in production?**
For a single-machine, read-mostly workload or a local tool, yes — it is a real
database with transactions and constraints. Not for a horizontally scaled API: it is
a file, so there are no network clients, no replicas, and no shared state between
instances.

---

← Prev: [Migrations as code](./11-migrations.md) · Next → [Prisma and Drizzle](./13-prisma-drizzle.md)
