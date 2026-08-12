---
title: "Resetting to a known state between test runs"
sidebar_label: "11 · Test reset"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex8-bulk-and-seed.mjs`.

**Every integration test needs the database in a known state, and the strategy you
pick sets the speed of the whole suite.** The fastest option is also the one that
requires the most from your code — it only works if every query in a test runs on
one client you control.

## The four strategies, timed

10 000 rows in the table before each reset:

```console
$ node ex8-bulk-and-seed.mjs
=== 4. reset strategies, 10 000 rows ===
DELETE FROM                           12.7 ms  rows left=0
TRUNCATE                               4.4 ms  rows left=0
TRUNCATE ... RESTART IDENTITY          4.7 ms  rows left=0
BEGIN/ROLLBACK per test                0.8 ms  rows left=10000
```

Read the last line carefully: **rows left = 10000**. The rollback did not delete the
seeded data — it discarded only what the test itself wrote. That is the entire point,
and it is why it is 16× faster than `TRUNCATE`: nothing is removed, so nothing has
to be re-seeded afterwards.

Across a 500-test suite that is the difference between roughly 0.4 s and 2.2 s of
pure reset time, before counting the re-seed that `DELETE` and `TRUNCATE` both need.

## Transaction rollback per test — the fast path

Open a transaction before the test, hand that client to the code under test, roll
back afterwards. The database never sees a commit.

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

test('creates a user', async () => {
  const repo = makeUserRepo(client);        // ← the client is injected
  const user = await repo.create({email: 'a@x.com'});
  expect(user.id).toBeDefined();
});
```

**The requirement, and it is absolute: every query in the test must run on that same
client.** Code that reaches for a module-level pool internally will run outside the
transaction, so its writes commit and leak into the next test. This is exactly why
the repository functions in
[A repository module per resource](../phase-9-api-crud/01-repository.md) take a
client as their first argument — testability is the main reason that shape is worth
the extra parameter.

Two more limits worth knowing before you commit to this:

- **The code under test cannot manage its own transactions.** A `BEGIN` inside the
  test's transaction does not nest; a `COMMIT` in application code ends *your*
  transaction and the rollback afterwards does nothing. Use savepoints
  (`SAVEPOINT` / `ROLLBACK TO SAVEPOINT`) if the code under test needs transaction
  boundaries of its own.
- **It cannot test anything about commit itself** — triggers on commit, deferred
  constraints (`SET CONSTRAINTS ALL DEFERRED`), or `LISTEN`/`NOTIFY` delivery, which
  only fires on commit.

## `TRUNCATE` — when rollback is not available

When the code under test owns its connections, roll back is not on the table.
`TRUNCATE` is the next fastest, and 2.9× faster than `DELETE` here because it drops
whole data files rather than marking each row dead.

```sql
TRUNCATE users, orders, order_items RESTART IDENTITY CASCADE;
```

Three modifiers matter:

- **List every table in one statement.** `TRUNCATE a, b, c` takes its locks together;
  separate statements can deadlock against each other under a parallel test runner.
- **`CASCADE`** truncates tables with foreign keys pointing at these. Without it you
  get `0A000 cannot truncate a table referenced in a foreign key constraint`.
- **`RESTART IDENTITY`**, because plain `TRUNCATE` does not reset sequences:

```console
id after plain TRUNCATE: 10001 ← identity NOT reset
id after RESTART IDENTITY: 1
```

A test asserting `expect(user.id).toBe(1)` passes on a fresh database and fails on
the second run. Either add `RESTART IDENTITY` or — better — never assert on a
generated id.

`DELETE FROM` has one advantage worth remembering: it is transactional and takes a
weaker lock, so it works where `TRUNCATE`'s `ACCESS EXCLUSIVE` would block. It also
leaves dead rows for `VACUUM`, so a suite that uses it thousands of times will bloat
the tables.

## Drop and migrate — the slow, thorough option

Recreating the schema from migrations on every run is the only strategy that tests
the migrations themselves. It costs seconds, not milliseconds, so it belongs once
per suite rather than once per test:

```js
// global setup, not beforeEach
await runMigrations(pool);
await seed(pool);
```

A practical combination that most suites end at: **drop-and-migrate once per suite,
transaction rollback per test.** The migrations get exercised, each test starts
clean, and the per-test cost stays at 0.8 ms.

## Parallel test runners

Node's test runner runs *files* in parallel by default. Four files sharing one
database will interfere no matter which reset strategy you choose — one file's
`TRUNCATE` deletes another file's fixtures mid-test.

The options, cheapest first:

1. **Transaction rollback**, which isolates naturally — each test is in its own
   uncommitted transaction and cannot see the others' writes.
2. **A schema per worker.** One database, `SET search_path TO test_worker_3`, so
   each worker gets its own set of tables.
3. **A database per worker**, or a container per worker via Testcontainers. Total
   isolation, highest cost.

See Node [Phase 9 · Testing](/docs/nodejs/pages/phase-9-testing/) for the runner
mechanics and the Testcontainers setup under rootless podman.

## Trade-off

Transaction rollback is 16× faster and gives real isolation for free, but it
dictates your code's shape: every data-access function must accept an injected
client, and the code under test cannot own transaction boundaries. That is a
design constraint imposed by the tests — usually a good one, occasionally not.

`TRUNCATE` imposes nothing on the code and works with any architecture, at the cost
of speed and of re-seeding after every test. Choose it when the application manages
its own connections and you are not willing to change that.

## Gotchas

**Symptom:** Data from one test appears in the next, despite a rollback
**Cause:** The code under test used its own pool connection, so its writes were
outside the test's transaction and committed.
**Fix:** Inject the client. Every query in the test must use the one that has the
open transaction.

**Symptom:** A test asserting `id === 1` fails on the second run
**Cause:** Plain `TRUNCATE` does not reset sequences — measured, the next id was
10001.
**Fix:** `TRUNCATE … RESTART IDENTITY`, and prefer not asserting on generated ids.

**Symptom:** `0A000 cannot truncate a table referenced in a foreign key constraint`
**Cause:** Another table references this one.
**Fix:** `CASCADE`, or list every related table in the same `TRUNCATE`.

**Symptom:** Deadlocks between test files
**Cause:** Separate `TRUNCATE` statements per table, acquiring locks in different
orders under a parallel runner.
**Fix:** One `TRUNCATE a, b, c` statement, or isolate workers by schema/database.

**Symptom:** The rollback strategy silently stops isolating after a refactor
**Cause:** The code under test began managing its own transactions — its `COMMIT`
ended the test's transaction.
**Fix:** Savepoints instead of nested `BEGIN`, or switch that suite to `TRUNCATE`.

**Symptom:** The test suite gets slower over weeks
**Cause:** `DELETE FROM` leaves dead tuples; the tables bloat.
**Fix:** `TRUNCATE`, which reclaims space immediately.

**Symptom:** A `LISTEN`/`NOTIFY` or deferred-constraint test never fires
**Cause:** Those only happen at commit, and the test never commits.
**Fix:** Use `TRUNCATE`-based isolation for that specific suite.

## Interview questions

**★ What are the ways to reset a database between tests, and which is fastest?**
Transaction rollback per test (0.8 ms measured), `TRUNCATE` (4.4 ms), `TRUNCATE
RESTART IDENTITY` (4.7 ms), `DELETE FROM` (12.7 ms), and drop-and-migrate (seconds).
Rollback wins because it removes nothing — the seeded rows survive, so there is no
re-seed afterwards.

**★ What does transaction-rollback isolation require of your application code?**
That every data-access function accept a client rather than reaching for a pool
itself, and that the code under test not manage its own transaction boundaries. If
either is violated the writes escape the transaction and leak into the next test.

**★ Why did a test asserting on `id` start failing?**
Plain `TRUNCATE` empties the table but does not reset the identity sequence —
measured, the next inserted row got id 10001. `RESTART IDENTITY` resets it to 1.
The deeper fix is not to assert on generated ids.

**★ Why `TRUNCATE a, b, c` rather than three `TRUNCATE` statements?**
One statement takes all the locks together. Separate statements acquire locks in
whatever order each test file happens to use, which deadlocks under a parallel
runner.

**★ What can transaction-rollback isolation not test?**
Anything that only happens at commit: `LISTEN`/`NOTIFY` delivery, deferred
constraint checks, and commit triggers. Those suites need `TRUNCATE`-based
isolation.

**How do you keep parallel test files from interfering?**
Transaction rollback isolates for free. Otherwise give each worker its own schema
(`search_path`) or its own database/container. Sharing one database with a
`TRUNCATE` strategy across parallel files cannot work — one file's reset destroys
another's fixtures.

---

← [A local development database](10-local-dev-db.md) · Next → [Migration tools](12-migration-tools.md)
