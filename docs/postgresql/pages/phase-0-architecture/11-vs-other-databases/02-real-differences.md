---
title: "The differences that survive"
sidebar_label: "02 · Real differences"
sidebar_position: 2
---

# The differences that survive

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **MySQL 8.4.11** (`mysql:8`, `127.0.0.1:55440`), **SQLite 3.53.3** via `node:sqlite`,
> **Node 24.19.0**, `pg` 8.23.0. Scripts: `sandbox/pg-api/ex56-vs-sqlite.mjs`,
> `sandbox/pg-api/ex57-vs-mysql.sh`.

**What is left after the folklore is stripped out: isolation, identifiers, two
statement forms, one real boolean, and a hard concurrency ceiling.**

## Default isolation level

```console
$ ./ex57-vs-mysql.sh
=== 4. default transaction isolation level ===
  postgres   read committed
  mysql      REPEATABLE-READ
```

This one silently changes application behaviour. On MySQL, a second `SELECT` inside
the same transaction returns the **same** rows as the first even if another
transaction committed in between; on PostgreSQL it sees the new data. Code that
reads, decides, then writes behaves differently on the two engines with no error to
tell you.

## Identifier case folding

```console
=== 5. unquoted mixed-case column identifiers ===
  postgres   mixedcol
  mysql      MixedCol
```

```console
$ node ex56-vs-sqlite.mjs
=== 5. what happens to an unquoted mixed-case identifier? ===
  postgres   OK   [{"column_name":"MixedCol"},{"column_name":"plaincol"}]
  sqlite     OK   [{"name":"MixedCol"},{"name":"PlainCol"}]
```

PostgreSQL **down-cases** an unquoted identifier; the quoted `"MixedCol"` keeps its
case and then requires quotes forever after. MySQL and SQLite preserve what you typed.
This is why `createdAt` becomes `createdat` on PostgreSQL and why the convention in
this corpus is `snake_case` everywhere.

## `RETURNING` and `UPDATE … ORDER BY … LIMIT`

```console
=== 8. RETURNING on an INSERT ===
  postgres   9|99
  mysql      ERROR 1064 (42000) … near 'returning k, v'

=== 7. UPDATE ... ORDER BY ... LIMIT ===
  postgres   ERROR: syntax error at or near "order"
  mysql      (succeeded)
```

They trade. PostgreSQL gives you the affected rows back in one round trip; MySQL gives
you a bounded, ordered `UPDATE`. On PostgreSQL the same bounded update needs
`WHERE id IN (SELECT id … ORDER BY … LIMIT n)`.

## What a `BOOLEAN` really is

```console
=== 9. what is a BOOLEAN really? ===
  postgres   boolean
  mysql      tinyint(1)
```

MySQL's `BOOLEAN` is an alias for `TINYINT(1)`, so it stores `2` as happily as `0` or
`1`. SQLite reports `integer` for `true` as well:

```console
=== 3. is there a real boolean type? ===
  postgres   OK   [{"t":true,"type":"boolean"}]
  sqlite     OK   [{"t":1,"type":"integer"}]
```

Only PostgreSQL has a real boolean type, and only PostgreSQL will reject a
non-boolean.

## The concurrency ceiling

```console
=== 6. two concurrent writers ===
  postgres   B still waiting after 300 ms: true
  postgres   B proceeded once A committed → final v = 2
  sqlite     second writer → database is locked

=== 8. what the numbers actually are ===
  postgres   max_connections = 100 (process per connection)
  sqlite     writers = 1 at a time (file lock); readers = many with WAL
```

PostgreSQL's second writer **blocks and then proceeds** — the row lock serialises them
and both transactions succeed. SQLite's second writer gets an **error**, because the
whole database has one write lock. That is the line between "an application database"
and "an embedded database": SQLite is excellent under many readers and one writer, and
needs application-level retry the moment there are two.

## What the driver hands JavaScript

```console
=== 7. what does the driver hand JavaScript? ===
  postgres   big=string:"9007199254740993"  num=string:"1.1"  d=object:Date  j=object:{"a":1}
  sqlite     big  → THROWS: Value is too large to be represented as a JavaScript number: 9007199254740993
  sqlite     num=number:1.1  d=string:"2026-01-01"  j=string:"{\"a\":1}"
  sqlite     (no date type and no jsonb — both are just TEXT)
```

Two opposite failure modes for the same problem. `pg` protects precision by handing
`bigint` and `numeric` back as **strings** — quiet, and it breaks arithmetic if you
forget. `node:sqlite` **throws** rather than lose precision. The loud one is easier to
work with; the quiet one is the one that reaches production.

SQLite has no date and no JSON type, so both arrive as `TEXT` and every comparison is
string comparison. PostgreSQL parses `date` into a JS `Date` and `jsonb` into an
object — see [Type parsing](../../phase-7-pg-driver/08-type-parsing.md) for the traps
that creates.

## Choosing

| Want | Pick |
|---|---|
| Multi-writer application database, rich types, transactional migrations | **PostgreSQL** |
| Existing MySQL estate, or you need `UPDATE … ORDER BY … LIMIT` | **MySQL 8** — but plan migrations knowing DDL cannot roll back |
| Single-writer, embedded, tests, local prototyping, edge | **SQLite** — with `STRICT` tables |
| Prototype on one and deploy on another | Only SQLite→PostgreSQL bites hard; use `STRICT` and expect type errors to appear late |

## Trade-off

PostgreSQL's strictness, real types and transactional DDL cost you an install, a
running server and roughly 100 connections' worth of process overhead. SQLite costs
nothing and takes one writer. MySQL sits between them on features and behind both on
migration safety. The honest summary is that the three differ far less on
*correctness* than they did five years ago, and most of the remaining distance is
concurrency and DDL.

## Gotchas

**Symptom:** `column "createdAt" does not exist` on PostgreSQL
**Cause:** Unquoted identifiers are down-cased, so the column is `createdat`.
**Fix:** `snake_case` everywhere; quote only when you intend to keep the case forever.

**Symptom:** Read-then-write logic behaves differently after a MySQL→PostgreSQL port
**Cause:** MySQL defaults to `REPEATABLE READ`, PostgreSQL to `READ COMMITTED` —
measured. A repeated `SELECT` sees different data.
**Fix:** Set the isolation level explicitly where the logic depends on it.

**Symptom:** `SQLITE_BUSY` / `database is locked` under load
**Cause:** One write lock for the whole database; a second writer fails rather than
waits.
**Fix:** WAL mode, a busy timeout, and application-level retry — or PostgreSQL.

**Symptom:** `bigint` arithmetic is wrong, or the query throws
**Cause:** `pg` returns `bigint` as a string; `node:sqlite` throws above
`Number.MAX_SAFE_INTEGER`.
**Fix:** `BigInt`, or keep large ids as strings end to end.

**Symptom:** A `boolean` column contains `2`
**Cause:** MySQL's `BOOLEAN` is `TINYINT(1)` — measured — and accepts any small integer.
**Fix:** A `CHECK (flag IN (0,1))` on MySQL; on PostgreSQL the type already does it.

**Symptom:** Date comparisons behave like string comparisons
**Cause:** SQLite has no date type; the value is `TEXT`.
**Fix:** ISO-8601 strings sort correctly, but use real `date`/`timestamptz` once on
PostgreSQL.

## Interview questions

**★ Why does `createdAt` become `createdat` on PostgreSQL?**
Unquoted identifiers are folded to lower case. Quoting preserves the case but then
every reference must be quoted too. MySQL and SQLite preserve what you typed, which is
why a port from either surfaces this immediately.

**★ What is SQLite's actual concurrency limit?**
One writer at a time for the whole database — measured, a second `BEGIN IMMEDIATE`
fails with `database is locked` rather than waiting. Many concurrent readers are fine
in WAL mode. PostgreSQL serialises the same conflict with a row lock and both
transactions succeed.

**What changes when you port from MySQL to PostgreSQL and nothing errors?**
The default isolation level — `REPEATABLE READ` to `READ COMMITTED`, measured. A
repeated `SELECT` in one transaction starts seeing other transactions' commits, so
read-then-write logic can silently change behaviour.

**Which of the three has a real boolean type?**
Only PostgreSQL. MySQL's `BOOLEAN` is `TINYINT(1)` and SQLite reports `integer` for
`true` — both accept values a boolean should not hold.

**When would you still choose SQLite?**
Tests, local development, embedded and edge deployments, and any single-writer
workload — with `STRICT` tables so the type behaviour matches production.

---

← [The folklore that no longer holds](01-outdated-folklore.md) · Next → [Templates](../12-templates.md)
