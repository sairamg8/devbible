---
title: "Testing against a real PostgreSQL"
sidebar_label: "16 · Testing against real PG"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex42-testing-rollback.mjs`.

**Everything in this phase — `ON CONFLICT`, `FOR UPDATE`, tuple comparison,
SQLSTATE codes, HOT updates — exists only in PostgreSQL.** A mocked database or an
in-memory substitute tests none of it. The question is not whether to use a real
server but how to give each test a clean one cheaply.

## Per-test transaction rollback

Open a transaction before the test, roll it back after. The test's writes are
never committed, so there is nothing to clean up:

```js
let client;
beforeEach(async () => {
  client = await pool.connect();
  await client.query('BEGIN');
});
afterEach(async () => {
  await client.query('ROLLBACK');
  client.release();
});
```

```console
$ node ex42-testing-rollback.mjs
seeded 2000 baseline rows

=== 1. BEGIN in beforeEach, ROLLBACK in afterEach ===
rows before any test: 2000
  inside test 1, visible rows: 2001
rows after test 1 : 2000
  test 2 inserted the same email with no conflict
rows after test 2 : 2000
```

Test 1 saw its own insert; after the rollback the count was back to 2000; test 2
inserted the *same email* with no unique violation, which proves test 1 left
nothing behind.

And it is fast:

```console
=== 5. how long each way of getting a clean database takes ===
median of 10 "tests", 2000 seed rows each:
  transaction rollback       1.66 ms
  TRUNCATE + reseed         42.50 ms
  DELETE + reseed           41.69 ms
```

**1.66 ms against 42.50 ms — 25×.** Over a thousand tests that is 1.7 seconds
against 42, and the gap grows with the size of the seed data.

## What rollback does not undo

```console
=== 2. sequences are not transactional ===
sequence last_value before: 2002
sequence last_value after : 2003
↑ the row is gone but the id was consumed — never assert on a literal id
```

Sequences are deliberately non-transactional — if they rolled back, concurrent
inserters would block on each other. So a rolled-back insert still burns an id.

The consequence for tests: **never assert on a literal id.** `expect(user.id).toBe('3')`
passes alone and fails when another test runs first. Assert on the shape, on
relationships, or capture the returned id and use that.

The same applies to anything else outside transactional control: `nextval`,
advisory locks taken without `pg_advisory_xact_lock`, and writes made over a
*different* connection.

## The trap that makes every test fail

```console
=== 3. the code under test calls pool.query instead of the test client ===
the test client sees it : 1
a pool connection sees  : 0
↑ uncommitted data is invisible to any other connection — so a service
  that grabs its own connection finds an empty database in every test
```

The test inserted a row on its transaction's client. Code reading through the pool
sees **zero rows** — uncommitted data is invisible to every other session.

So per-test rollback works **only if the code under test uses the client the test
provides**. This is the same executor contract as
[client propagation](12-client-propagation.md), and this is where violating it
shows up first: the fixture is invisible, and every test fails with "not found".

That is a useful property. A test suite built this way *cannot* pass if a
repository reaches for the pool, so the design rule is enforced by the test
harness rather than by review.

## Code that manages its own transaction

If the code under test issues `BEGIN`/`COMMIT` itself, its `COMMIT` ends the
*test's* transaction:

```console
=== 4. the code under test issues its own BEGIN/COMMIT ===
rows the service wrote that survived the test rollback: 1
↑ the inner COMMIT ended the outer transaction; the wrapper had nothing left to undo
with BEGIN/COMMIT remapped to savepoints, surviving rows: 0
```

PostgreSQL has no nested transactions — a second `BEGIN` is a warning, and the
`COMMIT` commits everything. The test's `ROLLBACK` then has nothing to undo, and
the row leaks into the next test.

The fix is to hand the code a wrapper that translates transaction control into
savepoints:

```js
const wrap = (db) => ({
  query: (text, params) => {
    if (text === 'BEGIN')    return db.query('SAVEPOINT svc');
    if (text === 'COMMIT')   return db.query('RELEASE SAVEPOINT svc');
    if (text === 'ROLLBACK') return db.query('ROLLBACK TO SAVEPOINT svc');
    return db.query(text, params);
  },
});
```

Measured: 0 rows survived. This is what ORMs and test helpers that advertise
"transactional tests" do internally. It needs a counter rather than a fixed
savepoint name once nesting can go more than one deep.

## When rollback is not enough

Per-test rollback cannot test the thing that only happens at commit: deferred
constraints, `AFTER ... COMMIT` behaviour, `LISTEN`/`NOTIFY` delivery (which is
commit-only — see
[Phase 7 · LISTEN/NOTIFY](../phase-7-pg-driver/14-listen-notify.md)), and any
test that spans two real connections, such as a lock or deadlock test.

Those need real commits, and therefore real cleanup — `TRUNCATE ... RESTART
IDENTITY CASCADE` and reseed, at the 42 ms measured above. Keep them in a separate,
smaller suite rather than paying that cost for every test.

## Isolating whole test files

```console
=== 7. two test files truncating the same table in parallel ===
file A: expected exactly ["a@x.com"], saw 1 row(s): [b@x.com]   ← WRONG ROW
file B: expected exactly ["b@x.com"], saw 1 row(s): [b@x.com]
↑ a row-count assertion still passes, which is why this is missed:
  both files saw one row, but not the one they inserted
```

Two files truncating the same table in parallel corrupted each other — and **file A
still saw exactly one row**. A `toHaveLength(1)` assertion passes; only checking
*which* row revealed it. That is why this is usually diagnosed as flakiness rather
than as interference.

Test runners default to running files in parallel, so this is the default
situation. Three ways out:

1. **Per-test transactions** — parallel-safe by construction, because nothing is
   committed. The reason to prefer it.
2. **A database per worker.** `CREATE DATABASE ... TEMPLATE` measured at **156 ms**
   — affordable once per file, not once per test. Point each worker at its own
   database via `process.env.VITEST_WORKER_ID`.
3. **A schema per worker**, with `search_path` set per connection. Cheaper than a
   database and shares the server's caches, but anything referencing a schema
   explicitly breaks.

## Containers

Testcontainers starts a PostgreSQL container per run and hands back a connection
string, which removes "install PostgreSQL 18 and match production's extensions"
from every developer's setup. It costs container startup once per run.

The setup used for this corpus is a long-lived container started once
(`podman start devbible-pg`) rather than per run — faster for iterating, and it
means the database persists between runs, which is a liability for tests and an
asset while writing measurement scripts. Either way the important property is the
same: **a real PostgreSQL of the same major version as production**, because the
whole point is to test the behaviour that is specific to it.

Node **[Phase 9 · Testing](/docs/nodejs/pages/phase-9-testing/)** owns the runner,
mocking and coverage material; this page is only the database side.

## Trade-off

Per-test rollback is 25× faster and parallel-safe, and it constrains the code under
test: everything must accept an injected client, and nothing may manage its own
transactions without the savepoint wrapper. That constraint is mostly good — it is
the same one that makes transactions work in production — but it does mean the
harness cannot test code that legitimately owns its transaction boundaries.

Truncate-and-reseed tests exactly what production does, at 25× the cost and with no
parallelism unless each worker gets its own database.

Use rollback for the bulk of the suite and a small committed suite for the things
that only exist after `COMMIT`.

## Gotchas

**Symptom:** Every test fails with "not found" although the fixture was inserted
**Cause:** The code under test used the pool, so it cannot see the test
transaction's uncommitted rows. Measured: test client 1, pool 0.
**Fix:** Inject the test's client. This failure is the harness enforcing the
executor contract.

**Symptom:** A test asserting `id === 3` passes alone and fails in the suite
**Cause:** Sequences are not rolled back — measured, `last_value` went 2002 → 2003
after a rolled-back insert.
**Fix:** Never assert on literal ids.

**Symptom:** Rows leak between tests despite the rollback
**Cause:** The code under test issued its own `COMMIT`, which committed the test's
transaction.
**Fix:** Wrap the client so `BEGIN`/`COMMIT`/`ROLLBACK` become savepoint
operations.

**Symptom:** Flaky failures only when tests run in parallel
**Cause:** Two files truncating shared tables. Measured: file A saw file B's row
while a row-count assertion still passed.
**Fix:** Per-test transactions, or a database or schema per worker.

**Symptom:** A `LISTEN`/`NOTIFY` test never receives anything
**Cause:** Notifications are delivered on commit, and the test never commits.
**Fix:** Put commit-dependent tests in the committed suite.

**Symptom:** The suite slows down as seed data grows
**Cause:** Truncate-and-reseed per test. Measured: 42.50 ms vs 1.66 ms with 2000
seed rows, and the gap widens with more.
**Fix:** Move to per-test rollback and seed once.

## Interview questions

**★ How do you isolate tests that hit a real database?**
Open a transaction in `beforeEach` and roll it back in `afterEach`, so nothing is
ever committed. Measured at 1.66 ms per test against 42.50 ms for
truncate-and-reseed with 2000 seed rows — 25× — and it is parallel-safe because
uncommitted data is invisible to other sessions.

**★ What does a rollback fail to undo?**
Sequences. They are deliberately non-transactional so concurrent inserters do not
block, so a rolled-back insert still consumes an id — measured, `last_value` went
2002 → 2003. Tests must never assert on literal ids.

**★ Why do all the tests fail if the code under test uses the pool?**
Because the fixture rows are uncommitted and therefore invisible to every other
connection — measured, the test client saw 1 row and a pool connection saw 0. It is
a useful failure: the harness enforces that repositories accept an injected client.

**★ What happens when the code under test runs its own `BEGIN`/`COMMIT`?**
PostgreSQL has no nested transactions, so its `COMMIT` commits the test's
transaction and the rollback has nothing to undo — measured, 1 row survived. Wrap
the client so `BEGIN`/`COMMIT`/`ROLLBACK` map to `SAVEPOINT`/`RELEASE`/`ROLLBACK
TO`; measured, 0 rows survived after that.

**★ What can't be tested inside a rolled-back transaction?**
Anything that only happens at commit — deferred constraints, `LISTEN`/`NOTIFY`
delivery, and any test needing two connections to see each other, such as lock and
deadlock tests. Those need a committed suite with real cleanup.

**How do you run test files in parallel against one server?**
Per-test transactions handle it for free. Otherwise give each worker its own
database — `CREATE DATABASE ... TEMPLATE` measured at 156 ms, fine per file — or its
own schema. Sharing tables across parallel files corrupts them in a way row-count
assertions do not catch.

---

← [Shaping in SQL vs JavaScript](15-shape-sql-vs-js.md) · Next → [created_at and updated_at](17-timestamps-trigger.md)
