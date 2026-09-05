---
title: "`TRUNCATE` takes an `ACCESS EXCLUSIVE` lock that blocks every other operation on the table, so the reset strategy most suites reach for second is the one that quietly converts a parallel suite into a serial one — and the three strategies that do not have that problem each buy their parallelism with a different setup cost"
sidebar_label: "12g · TRUNCATE, templates, schemas"
sidebar_position: 79
description: "TRUNCATE's four documented properties and the two that matter to a suite, why CASCADE is mandatory here and dangerous everywhere, template databases and the no-other-sessions rule, schema per worker and what search_path costs behind a pooler, and Neon branches."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 documentation — [`TRUNCATE`](https://www.postgresql.org/docs/18/sql-truncate.html), [`CREATE DATABASE`](https://www.postgresql.org/docs/18/sql-createdatabase.html), [§23.3 Template Databases](https://www.postgresql.org/docs/18/manage-ag-templatedbs.html) and [§20.11 Client Connection Defaults](https://www.postgresql.org/docs/18/runtime-config-client.html) — plus [Neon · Branching to test queries](https://neon.com/docs/guides/branching-test-queries) and [Vitest · Parallelism](https://vitest.dev/guide/parallelism). Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · Neon `@neondatabase/serverless` **1.1.0** · `drizzle-kit` **0.31.10** · Vitest **5.0.0** · Node **24.20.0**.

**Once a test needs real commits — which [12f](12f-the-seed-and-reset-story.md) established is every concurrency, retry and idempotency test in this chapter — the reset has to happen between tests rather than around them, and there are exactly three shapes it can take: delete the data, replace the database, or give each worker a namespace of its own. Each is documented, each has one property that decides whether it is right for your suite, and in two cases that property is not the one people compare on. `TRUNCATE` is chosen for speed and its actual constraint is a lock that serialises the suite. A template database is chosen for cleanliness and its actual constraint is that nothing may be connected to the template while it is copied — including the pool your own harness opened. This page states each property from the manual, then says which of this chapter's tests each strategy can carry.**

## `TRUNCATE`, and its four documented properties

> *"`TRUNCATE` quickly removes all rows from a set of tables. It has the same effect as an unqualified `DELETE` on each table, but since it does not actually scan the tables it is faster. Furthermore, it reclaims disk space immediately, rather than requiring a subsequent `VACUUM` operation."*
> — [PostgreSQL 18 · `TRUNCATE`](https://www.postgresql.org/docs/18/sql-truncate.html)

That is the property it is chosen for. Three more decide whether the choice is right.

**It takes the strongest lock there is.**

> *"`TRUNCATE` acquires an `ACCESS EXCLUSIVE` lock on each table it operates on, which blocks all other concurrent operations on the table."*

🔴 **This is the whole story for a parallel suite.** Vitest runs test files in parallel across workers by default. If every worker resets by truncating the same tables, then every reset blocks every other worker's queries on those tables for the duration — so the suite's actual concurrency is one, plus whatever overlap happens between resets. It does not fail; it just stops being parallel, and the wall-clock time looks like a slow database rather than like a design decision.

**It cannot run at all without `CASCADE` here.**

> *"`TRUNCATE` cannot be used on a table that has foreign-key references from other tables, unless all such tables are also truncated in the same command. Checking validity in such cases would require table scans, and the whole point is not to do one. The `CASCADE` option can be used to automatically include all dependent tables — but be very careful when using this option, or else you might lose data you did not intend to!"*

`cards.board_id` references `boards`, so truncating `boards` alone is rejected. Two ways out, and the safe one is not `CASCADE`:

```sql
-- ✅ name every table explicitly, in one statement. One lock acquisition, no FK ordering
-- problem, and the statement is a readable inventory of what the suite considers state.
TRUNCATE TABLE cards, boards, team_members, teams, idempotency_records RESTART IDENTITY;

-- ⚠️ CASCADE works and will silently include a table added next month
TRUNCATE TABLE teams RESTART IDENTITY CASCADE;
```

The explicit list is better in a test harness for the same reason `CARD_COLUMNS` is better than `SELECT *`: it fails loudly when the schema grows, and the manual's own warning about `CASCADE` — *"you might lose data you did not intend to"* — is exactly the failure mode you want a build to surface rather than absorb.

**It is transactional, including the sequence reset.**

> *"`TRUNCATE` is transaction-safe with respect to the data in the tables: the truncation will be safely rolled back if the surrounding transaction does not commit."*

and, for `RESTART IDENTITY`:

> *"the implied `ALTER SEQUENCE RESTART` operations are also done transactionally; that is, they will be rolled back if the surrounding transaction does not commit."*

That is a genuine advantage over `DELETE` plus a manual `setval`, since [12f](12f-the-seed-and-reset-story.md) noted `nextval` is otherwise not rolled back. `RESTART IDENTITY` is *"Automatically restart sequences owned by columns of the truncated table(s)"* — note **owned by**, so a sequence created independently and merely referenced in a default is not restarted.

**It is not MVCC-safe.**

> *"`TRUNCATE` is not MVCC-safe. After truncation, the table will appear empty to concurrent transactions, if they are using a snapshot taken before the truncation occurred."*

🔴 **This is the second reason not to truncate under parallelism, and it is worse than the lock.** A worker holding an open transaction from before another worker's truncate sees an empty table — not its own rows, not the new rows, nothing. The test fails with an impossible-looking assertion about data it definitely inserted. Combine that with the `ACCESS EXCLUSIVE` lock's serialisation and the honest summary is: **`TRUNCATE` is a fine reset for a suite running with one worker against its own database, and a source of unexplainable flakes in any other arrangement.**

One more property, harmless here but worth knowing: *"`TRUNCATE` will not fire any `ON DELETE` triggers that might exist for the tables. But it will fire `ON TRUNCATE` triggers."* If your schema ever grows an audit trigger on delete, the truncate reset will not exercise it, and an audit-row assertion will fail for reasons that have nothing to do with the code.

## Template database per worker

The cleanest isolation available: each worker gets a whole database, cloned from one that already has the schema.

> *"By default, the new database will be created by cloning the standard system database `template1`. A different template can be specified by writing `TEMPLATE name`."*
> — [PostgreSQL 18 · `CREATE DATABASE`](https://www.postgresql.org/docs/18/sql-createdatabase.html)

```ts
// test/global-setup.ts — runs once, before any worker exists
import { Client } from 'pg'

export default async function setup({ provide }) {
  const admin = new Client({ connectionString: process.env.ADMIN_URL })
  await admin.connect()

  // 1 · one migrated template for the whole run
  await admin.query('DROP DATABASE IF EXISTS sprintdesk_template')
  await admin.query('CREATE DATABASE sprintdesk_template')
  await migrateTemplate()                       // drizzle-kit migrate, see 12k
                                                // 🔴 and then DISCONNECT from it

  // 2 · one database per worker, cloned from it
  const workers = Number(process.env.VITEST_MAX_WORKERS ?? 4)
  for (let i = 1; i <= workers; i++) {
    await admin.query(`DROP DATABASE IF EXISTS sprintdesk_w${i} WITH (FORCE)`)
    await admin.query(`CREATE DATABASE sprintdesk_w${i} TEMPLATE sprintdesk_template`)
  }
  provide('workerDbPrefix', 'sprintdesk_w')
  await admin.end()

  return async () => { /* teardown: drop the per-worker databases */ }
}
```

Vitest's `globalSetup` *"is called before the test workers are created and only if there is at least one test queued, and teardown is called after all test files have finished running"* — which is precisely the window `CREATE DATABASE` needs, because of the rule that makes this strategy fail:

> *"The principal limitation is that no other sessions can be connected to the source database while it is being copied. `CREATE DATABASE` will fail if any other connection exists when it starts; during the copy operation, new connections to the source database are prevented."*
> — [PostgreSQL 18 · §23.3](https://www.postgresql.org/docs/18/manage-ag-templatedbs.html)

🔴 **"No other sessions" includes yours.** The migration you just ran against the template left a connection open unless you explicitly closed the pool, and `CREATE DATABASE … TEMPLATE` then fails. This is the single most common way this strategy is abandoned as "flaky" — it is not flaky, it is a documented precondition that a lingering pool violates. Close every client against the template before the first clone, and never let a test connect to the template itself.

Two more constraints from the same reference:

- **`CREATE DATABASE` cannot be executed inside a transaction block.** So it cannot appear inside any harness that wraps setup in a transaction, and it cannot be batched with other statements in one `BEGIN`.
- **`STRATEGY` defaults to `WAL_LOG`**, which the manual describes as copying *"block by block"* with each block written to the WAL, and calls *"the most efficient strategy in cases where the template database is small, and therefore it is the default."* A test template is small, so the default is right; `FILE_COPY` *"forces the system to perform a checkpoint both before and after the creation of the new database"*, which is the wrong trade for many small databases.

Each worker then reads its own connection string:

```ts
// test/concurrency/setup.ts
import { inject } from 'vitest'

const workerId = Number(process.env.VITEST_POOL_ID)      // 1-based in Vitest 5
const dbName = `${inject('workerDbPrefix')}${workerId}`
process.env.DIRECT_URL = withDatabase(process.env.ADMIN_URL!, dbName)
```

Vitest 5's migration guide states the identifier's range: *"This changes the values of the `VITEST_POOL_ID` and `VITEST_WORKER_ID` environment variables, which now range from `1` to the worker count."* If a harness was written against Vitest 4 with a `+ 1`, that is an off-by-one that lands two workers on one database — and the symptom is cross-test interference, not an error.

Playwright's equivalent carries a stronger guarantee, and it is the one you want for naming a database: `parallelIndex` is *"The index of the worker between `0` and `workers - 1`. It is guaranteed that workers running at the same time have a different `parallelIndex`."* — also available as `process.env.TEST_PARALLEL_INDEX`. Use `parallelIndex`, not `workerIndex`: *"When a worker is restarted, for example after a failure, the new worker process gets a new unique `workerIndex`"*, so `workerIndex` grows without bound and would create a new database on every retry.

## Schema per worker

Cheaper than a database — no clone, no connection restriction — and it buys namespace isolation inside one database.

```sql
CREATE SCHEMA test_w1;
SET search_path TO test_w1, public;
```

> *"This variable specifies the order in which schemas are searched when an object (table, data type, function, etc.) is referenced by a simple name with no schema specified. When there are objects of identical names in different schemas, the one found first in the search path is used."*
> — [PostgreSQL 18 · §20.11](https://www.postgresql.org/docs/18/runtime-config-client.html)

Reset is `DROP SCHEMA test_w1 CASCADE` and recreate, which takes no lock on any other worker's tables. That solves the `TRUNCATE` problem completely.

Three costs, all real:

**`search_path` is a session setting.** [03d](03d-what-does-not-survive-the-pooler.md) is a list of things that do not survive a transaction-mode pooler and session-level `SET` is on it. Behind a pooler, a worker can issue `SET search_path` on one server session and its next statement can land on another — where the path is still `public`. The result is a query against the wrong schema, silently. **A schema-per-worker harness must use `DIRECT_URL`**, and even then must set the path per acquired connection rather than once at startup.

**Every schema needs the migration run against it.** A cloned database gets the schema for free; a new namespace does not. That means `drizzle-kit migrate` per worker at setup, which is the cost the template strategy was avoiding.

**Types are schema-qualified too.** `card_status` is a `pgEnum`, and an enum type lives in a schema like a table does. A migration run into `test_w1` creates `test_w1.card_status`; one that was written assuming `public` may create or reference the wrong one. This is the detail that makes schema-per-worker fiddlier than it looks with an ORM whose generated SQL uses unqualified names.

## Neon: the branch is the reset

On Neon the primitive is different and better suited to this than any of the above.

> *"With Neon, you can instantly create a database branch with a full copy-on-write clone of your production data in just a few clicks."*
> — [Neon · Branching to test queries](https://neon.com/docs/guides/branching-test-queries)

A branch is a separate endpoint with its own connection strings, so a branch per CI run gives you total isolation from every other run, and a branch per worker gives you the template-database arrangement without the no-other-sessions rule. Teardown is deleting the branch.

⚠️ **Two things I did not confirm and you should check against your own plan.** The documentation describes branch creation as instant and copy-on-write, but I found no statement of a per-project branch limit or a rate limit on branch creation, and a suite that creates one branch per *test* rather than per run or per worker is the shape most likely to hit one. Nor did I find a statement about whether a branch's pooled endpoint is available immediately on creation. Both are answerable from your Neon project's own limits; neither should be assumed.

## Choosing

| If the tests… | Use |
|---|---|
| are DAL reads and writes on one session | transaction per test ([12f](12f-the-seed-and-reset-story.md)) |
| need two sessions and you have one database | 🔴 one worker, `TRUNCATE` between tests, `fileParallelism: false` |
| need two sessions and speed | database per worker from a template, or a Neon branch per worker |
| run in CI where you can create databases freely | template per run, database per worker |
| must exercise the migrations themselves | a database created empty and migrated ([12k](12k-migrations-in-the-test-path.md)) |

## Gotchas

**★ Symptom: the suite is configured for eight workers and runs at roughly the speed of one.** Cause: each worker truncates shared tables, and `TRUNCATE` takes `ACCESS EXCLUSIVE`, which blocks every other worker's operations on those tables. Fix: give each worker its own database or schema. If you cannot, stop pretending — set `fileParallelism: false` so the serialisation is a stated decision rather than an emergent one, and the profile stops lying about where the time goes.

**★ Symptom: a test fails asserting the table is empty when it just inserted five rows.** Cause: `TRUNCATE` is not MVCC-safe, and this transaction's snapshot predates another worker's truncate, so the table appears empty. Fix: never truncate a table another session may hold an open snapshot on. This is a hard incompatibility between `TRUNCATE` and parallel workers, not a tuning problem.

**★ Symptom: `TRUNCATE boards` fails with a foreign-key complaint.** Cause: `cards` references it, and the manual requires every referencing table to be truncated in the same command. Fix: name them all in one `TRUNCATE` statement. Prefer the explicit list over `CASCADE` so that adding a table to the schema breaks the harness visibly instead of silently widening what gets deleted.

**★ Symptom: `CREATE DATABASE … TEMPLATE` fails intermittently in global setup.** Cause: a connection to the template is still open — usually the migration pool, which was never `end()`ed, or a `db` module imported at the top of the setup file that opened a pool on import. The manual states plainly that the copy fails if any other connection exists when it starts. Fix: close every client against the template before the first clone, and never import the application's `db` module into global setup.

**★ Symptom: two workers write into the same database.** Cause: an off-by-one on the worker id. Vitest 5 made `VITEST_POOL_ID` and `VITEST_WORKER_ID` 1-based; a harness carrying a `+ 1` from Vitest 4 now maps workers 1 and 2 onto the same name as 2 and 3. Fix: read the id without adjusting it, and assert in setup that the resolved database name is unique — a `SELECT current_database()` logged once per worker settles it in seconds.

**★ Symptom: a Playwright suite creates a new database on every retry until the server refuses connections.** Cause: naming the database after `workerIndex`, which is documented to be unique per worker *process* and to increase when a worker restarts after a failure. Fix: use `parallelIndex`, which is bounded by the worker count and is guaranteed distinct among simultaneously-running workers — which is exactly the property a per-worker resource needs.

**★ Symptom: a schema-per-worker suite queries `public` instead of its own schema.** Cause: `SET search_path` was issued once on a pooled connection string, and a later statement landed on a different server session. Fix: use the direct endpoint, and set the path on every connection acquisition — most pools expose a `connect` hook for exactly this. Better still, if the ORM can emit schema-qualified names, use that and drop the reliance on session state entirely.

**★ Symptom: a schema-per-worker migration fails on `CREATE TYPE card_status`.** Cause: the enum type already exists in `public`, or was created in the first worker's schema and the second migration resolved the unqualified name to it. Fix: qualify the type in the migration, or accept that enums make this strategy awkward and use a database per worker instead — the template clone copies the type into each database cleanly.

**★ Symptom: an audit-trigger test passes under a `DELETE`-based reset and fails after switching to `TRUNCATE`.** Cause: `TRUNCATE` does not fire `ON DELETE` triggers, only `ON TRUNCATE` ones. Fix: this is the harness changing behaviour, not the code. If triggers are part of the contract, reset those tables with `DELETE`, or add the `ON TRUNCATE` trigger deliberately.

## Interview questions

**★ Why does `TRUNCATE` make a parallel suite slower rather than faster?**
Because it acquires `ACCESS EXCLUSIVE` on every table it names, and that lock blocks all other concurrent operations on those tables. Every worker's reset therefore stalls every other worker's queries, so the suite's effective concurrency collapses toward one while you continue paying the overhead of eight processes. The individual statement is fast — the manual is right that not scanning the table beats an unqualified `DELETE` — but throughput is decided by the lock, not by the statement.

**★ Beyond the lock, what makes `TRUNCATE` genuinely unsafe with concurrent tests?**
It is not MVCC-safe. The manual states that after truncation the table appears empty to concurrent transactions using a snapshot taken before it. So a worker in an open transaction does not merely miss the truncate — it sees *nothing*, including rows it inserted itself before the other worker truncated. The resulting assertion failure describes a state that cannot exist under normal MVCC rules, which is why these flakes are so hard to diagnose from the failure message alone.

**★ What is the one precondition that makes template databases fail, and why is it so often violated?**
No other session may be connected to the template while it is being copied. It is violated because the harness itself connects: you run the migration against the template, and the migration's pool is still open when the first `CREATE DATABASE … TEMPLATE` runs. Importing the application's `db` module into the setup file does it too, since that opens a pool on import. The fix is to close every client explicitly before the first clone and to treat the template as write-once, connect-never afterwards.

**★ When would you choose schema-per-worker over database-per-worker?**
When creating databases is not available — a managed instance where your role lacks `CREATEDB`, or an environment where the database name is fixed by the platform. Schema-per-worker gives real namespace isolation with no clone and no connection restriction, and reset is a `DROP SCHEMA … CASCADE`. The costs you accept are that `search_path` is session state and therefore unreliable behind a transaction-mode pooler, that every schema needs the migration run into it, and that schema-qualified types like a `pgEnum` make ORM-generated SQL fiddlier than it looks.

**★ Why should a per-worker resource be named from Playwright's `parallelIndex` rather than `workerIndex`?**
Because `parallelIndex` is bounded by the worker count and guaranteed distinct among workers running at the same time, which is exactly the invariant a per-worker database name needs. `workerIndex` is documented to be unique per worker process and to take a new value when a worker restarts after a failure, so it grows across a run with retries. Naming databases from it means a flaky suite creates unbounded databases and eventually exhausts something — connections, disk, or the server's patience.

**★ Which reset strategy do the concurrency tests in this chapter need, and why do the others not qualify?**
They need real commits visible from a second session, so the transaction wrapper is out. They must not be disturbed mid-transaction by another worker's reset, so shared-table `TRUNCATE` under parallelism is out. That leaves an isolated database per worker — a template clone, or a Neon branch — or, if you have only one database, running that project single-worker with `TRUNCATE` between tests and saying so in the config. The last is a perfectly respectable choice; the failure is running them in parallel against one database and believing the green tick.

---

← [12f · The seed and reset story](12f-the-seed-and-reset-story.md) · [Chapter index](01-explanation.md) · Next → [12h · Parallel workers against one Postgres](12h-parallel-workers-against-one-postgres.md)
