---
title: "Wrapping each test in a transaction and rolling it back is the fastest reset available and it is structurally incompatible with the half of this chapter that made the chapter worth writing — a savepoint is not a transaction, a second connection cannot see uncommitted rows, and the isolation level cannot be set after the first statement"
sidebar_label: "12f · The seed and reset story"
sidebar_position: 78
description: "The five reset strategies and what each costs, transaction-per-test written out including the connection injection it requires, and the six documented reasons it cannot host a concurrency, retry or idempotency test."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 documentation — [`SET TRANSACTION`](https://www.postgresql.org/docs/18/sql-set-transaction.html), [`SAVEPOINT`](https://www.postgresql.org/docs/18/sql-savepoint.html), [`ROLLBACK TO SAVEPOINT`](https://www.postgresql.org/docs/18/sql-rollback-to.html), [§13.2 Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html), [§9.17 Sequence Functions](https://www.postgresql.org/docs/18/functions-sequence.html) and [Appendix A · Error Codes](https://www.postgresql.org/docs/18/errcodes-appendix.html) — and [Drizzle · Transactions](https://orm.drizzle.team/docs/transactions). Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · **Next.js 16.3.4** · Vitest **5.0.0** · Node **24.20.0**.

**Every suite that talks to a real database has to answer one question — after a test writes rows, how does the next test see a clean world? — and there are five answers, each of which is right for a different subset of tests. The one everybody reaches for first, because it is the fastest and the tidiest, is to open a transaction before each test and roll it back afterwards. It is genuinely excellent for the DAL suite. It is also, for six separate and individually sufficient reasons, incapable of hosting a single test of topic 07's lost update, topic 09's retry loop, or topic 05d's idempotency key — and the failure mode is not a clear error. It is a test that runs, passes, and proves the opposite of what it claims. This page writes the strategy out properly, then enumerates exactly what it cannot host and why, with the documentation that settles each one.**

## The five strategies

| Strategy | Reset cost | Parallel-safe | Hosts concurrency tests | Hosts migrations |
|---|---|---|---|---|
| **Transaction per test, rolled back** | lowest — one `ROLLBACK` | yes, if each worker has its own connection | 🔴 **no** | no (DDL inside the wrapper is rolled back too) |
| **`TRUNCATE … RESTART IDENTITY CASCADE`** | one statement, `ACCESS EXCLUSIVE` lock | 🔴 no — the lock serialises the suite | yes | yes |
| **Template database per worker** | one `CREATE DATABASE … TEMPLATE` per worker | yes | yes | schema is baked into the template |
| **Schema per worker** | `DROP SCHEMA … CASCADE` + recreate | yes | yes, within a worker | needs the migration run per schema |
| **Unique data per test** (a fresh team) | nothing to reset | yes | yes | yes |

The last row is [ch13 · 5](../13-testing-and-developer-experience/05-project-milestone-sprintdesk-test-suite.md)'s answer and it is a good one for a multi-tenant application, since the tenancy predicate *is* the isolation. Its limits are worth naming: it cannot test anything global (a `TRUNCATE`, a migration, a `COUNT(*)` over the table), the database grows monotonically across a run, and a bug in the predicate — the exact bug [12e](12e-the-ownership-negative-test.md) exists to catch — is also a bug in your test isolation, so a leaking predicate produces confusing cross-test failures rather than a clean report.

🔴 **These are not alternatives to choose between once.** A real suite uses two or three: transaction-per-test for `test/dal/`, a per-worker database for `test/concurrency/`, and unique-data-per-test inside both. The mistake is picking one and forcing every test into it.

## Transaction per test, written out

The mechanism has one hard requirement that is easy to underestimate: **every query the code under test issues must run on the same connection as the wrapper's `BEGIN`.** A `db` object that acquires a connection from the pool per query will get a *different* connection, which cannot see uncommitted rows, and the test will fail with "no such card" for a card the seed just inserted.

So the harness has to inject a connection, and the cleanest way is a request-scoped context the DAL already reads from:

```ts
// lib/db/context.ts
import { AsyncLocalStorage } from 'node:async_hooks'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { db as poolDb } from '@/db'

const store = new AsyncLocalStorage<NodePgDatabase<typeof schema>>()

/** Every DAL function calls this instead of importing `db` directly. */
export function conn(): NodePgDatabase<typeof schema> {
  return store.getStore() ?? poolDb
}

export function runWith<T>(bound: NodePgDatabase<typeof schema>, fn: () => Promise<T>) {
  return store.run(bound, fn)
}
```

```ts
// test/dal/setup.ts
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { runWith } from '@/lib/db/context'

const pool = new Pool({ connectionString: process.env.DIRECT_URL, max: 1 })

export function withRollback(name: string, body: () => Promise<void>) {
  it(name, async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await runWith(drizzle(client, { schema }), body)
    } finally {
      await client.query('ROLLBACK')     // 🔴 always, including after a failure
      client.release()
    }
  })
}
```

Three details that are load-bearing:

**`max: 1` and an explicit `client`.** The wrapper owns one physical connection for the duration of the test. Anything that reaches around the context and uses the pool directly is outside the transaction and will not be rolled back — the leak is silent and shows up as one test polluting another much later.

**`DIRECT_URL`, not `DATABASE_URL`.** A transaction-mode pooler does not guarantee that consecutive statements land on the same server session, which is precisely what this technique depends on ([03d](03d-what-does-not-survive-the-pooler.md)). Point the test harness at the direct endpoint.

**`ROLLBACK` in `finally`.** If the body threw, the transaction is in `25P02 in_failed_sql_transaction` and every subsequent statement on it errors until it is rolled back. Skipping the rollback on failure leaves the connection unusable and turns one failing test into a cascade of confusing ones.

## What this strategy covers, and it is most of the DAL suite

Everything whose truth is decided by a single session: constraints and their SQLSTATEs, the ownership predicate, projections, soft-delete filtering, cascade behaviour, keyset continuity, the `version` bump, the sparse-position arithmetic. That is genuinely the majority of `test/dal/`, and for those tests it is the right choice — the reset is one statement and it cannot leave residue.

## The six reasons it cannot host a concurrency test

Each of these is independently fatal. They are listed separately because teams typically discover one, work around it, and are then surprised by the next.

### 1 · A second connection cannot see uncommitted rows

The whole point of a concurrency test is two sessions racing on one row. The seed row lives inside the wrapper's uncommitted transaction, so session two — a different connection — cannot see it at all. At `READ COMMITTED` it sees nothing; the test's second writer operates on an empty table and the race it was written to demonstrate never happens.

**There is no configuration that fixes this.** It is what an uncommitted transaction means.

### 2 · The retry loop opens its own transaction, on the pool

`withRetry` ([09d](09d-serialization-failures-and-the-retry-loop.md)) calls `db.transaction(fn, { isolationLevel: 'serializable' })` on the module-level `db` — a pooled handle. Under the wrapper that is a *different* connection from the seed's, so the same problem as (1) plus a second one: the retry's transaction commits for real, and the wrapper's `ROLLBACK` never touches it. **The test leaves rows behind**, which is the one failure mode this strategy was supposed to make impossible.

If instead you route `withRetry` through the injected connection, you get reason (3).

### 3 · The isolation level cannot be set after the first statement

> *"The transaction isolation level cannot be changed after the first query or data-modification statement (`SELECT`, `INSERT`, `DELETE`, `UPDATE`, `MERGE`, `FETCH`, or `COPY`) of a transaction has been executed."*
> — [PostgreSQL 18 · `SET TRANSACTION`](https://www.postgresql.org/docs/18/sql-set-transaction.html)

The wrapper's `BEGIN` is followed by the seed's inserts. By the time the code under test asks for `SERIALIZABLE`, the transaction has executed several data-modification statements and the request is rejected.

⚠️ **I could not confirm from the documentation which SQLSTATE PostgreSQL emits for this specific rejection.** The invalid-transaction-state conditions are class 25, and `25001 active_sql_transaction` is the condition name that describes the situation, but the manual states the rule rather than the code. Do not key any retry predicate or test assertion on a guessed code — key on the documented rule, which is unambiguous.

The practical consequence is worse than an error, because of reason (4).

### 4 · A nested `db.transaction()` is a savepoint, not a transaction

Drizzle supports nested transactions through savepoints. So a DAL function that opens `db.transaction(...)` while already inside one does not get a new transaction with its own isolation level and its own snapshot — it gets a `SAVEPOINT` inside yours.

> *"SAVEPOINT establishes a new savepoint within the current transaction. A savepoint is a special mark inside a transaction that allows all commands that are executed after it was established to be rolled back, restoring the transaction state to what it was at the time of the savepoint."*
> — [PostgreSQL 18 · `SAVEPOINT`](https://www.postgresql.org/docs/18/sql-savepoint.html)

A savepoint gives you partial rollback. It does **not** give you a separate snapshot, separate visibility, a separate isolation level, or an independent commit. Every property topic 09 relies on is a property of a top-level transaction. So `test/dal/` tests of a transactional DAL function run — and pass — while testing a construct that behaves differently from the one that runs in production.

⚠️ **I could not confirm what `drizzle-orm` 0.45.2 does with an `isolationLevel` option on a *nested* `transaction()` call** — whether it is ignored, or emitted as a statement that PostgreSQL rejects. The documented config accepts `isolationLevel`, `accessMode` and `deferrable` for PostgreSQL transactions, and nested calls are documented as using savepoints, but the interaction is not stated. Treat it as unspecified and do not build a harness that depends on either behaviour.

### 5 · A serialization failure does not become correct by being caught

`ROLLBACK TO SAVEPOINT` can restore a transaction that an error aborted — the manual says so in passing, discussing cursors: *"a cursor whose execution causes a transaction to abort is put in a cannot-execute state, so while the transaction can be restored using `ROLLBACK TO SAVEPOINT`, the cursor can no longer be used."* So a retry loop built on savepoints will appear to work.

It is not the retry the manual prescribes. For Repeatable Read:

> *"When an application receives this error message, it should abort the current transaction and retry the whole transaction from the beginning. The second time through, the transaction will see the previously-committed change as part of its initial view of the database, so there is no logical conflict in using the new version of the row as the starting point for the new transaction's update."*
> — [PostgreSQL 18 · §13.2.2](https://www.postgresql.org/docs/18/transaction-iso.html)

The reason retrying works is *"the second time through, the transaction will see the previously-committed change as part of its initial view"* — a new snapshot. Rolling back to a savepoint keeps the same top-level transaction and therefore the same snapshot, so the condition that made the retry correct has not been met. And at Serializable the manual is blunt about what may be relied on:

> *"In all other cases applications must not depend on results read during a transaction that later aborted; instead, they should retry the transaction until it succeeds."*

🔴 **So a savepoint-based retry inside a test wrapper is not a slower version of the production retry. It is a different algorithm that the manual tells you not to depend on**, and a test that passes under it has evidenced nothing about the loop that runs in production.

### 6 · Sequences and other non-transactional state survive the rollback

> *"To avoid blocking concurrent transactions that obtain numbers from the same sequence, the value obtained by `nextval` is not reclaimed for re-use if the calling transaction later aborts. This means that transaction aborts or database crashes can result in gaps in the sequence of assigned values."*
> — [PostgreSQL 18 · §9.17](https://www.postgresql.org/docs/18/functions-sequence.html)

`cards.id` is a UUID, so this API is largely insulated — but any table in the schema with a `serial` or an identity column advances permanently on every rolled-back test. A test asserting an id, an ordering by id, or a "first row" is asserting something that changes with the number of times the suite has ever run.

The same applies to anything else PostgreSQL treats as non-transactional: `setval`, advisory locks taken and released outside the transaction's lifetime, and `NOTIFY` payloads, which are delivered only on commit and therefore never delivered here at all.

## The decision, stated as a rule

🔴 **If the test needs two sessions to see each other's work, it cannot be wrapped. If it does not, wrapping is the best reset available.**

That is a clean split and it is why [12](12-testing-the-api.md) gave `test/concurrency/` its own directory: the two groups need different Vitest projects because they need different `setupFiles`, and putting them in one project means one of them is silently running under the wrong harness.

```ts
// vitest.config.ts — two projects, two harnesses, one command
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'dal',         include: ['test/dal/**/*.test.ts'],
                setupFiles: ['test/dal/setup.ts'] } },
      { test: { name: 'concurrency', include: ['test/concurrency/**/*.test.ts'],
                setupFiles: ['test/concurrency/setup.ts'], fileParallelism: false } },
      { test: { name: 'boundary',    include: ['test/boundary/**/*.test.ts'] } },
    ],
  },
})
```

`fileParallelism: false` on the concurrency project is deliberate and [12h](12h-parallel-workers-against-one-postgres.md) explains why; the boundary project needs no setup at all because it never touches a database.

## Gotchas

**★ Symptom: a test inserts a card and the very next DAL call reports it missing.** Cause: the insert ran on the wrapper's pinned connection and the read went to the pool, so it is outside the uncommitted transaction. Fix: route every query through the injected context — `conn()` rather than an imported `db` — and set the harness pool to `max: 1` so a stray direct use fails loudly by starving rather than quietly by isolation.

**★ Symptom: after one test fails, every subsequent test in the file fails with an unrelated error.** Cause: the failing test left the transaction in `25P02 in_failed_sql_transaction` and the connection was returned to the pool in that state. Fix: `ROLLBACK` in a `finally`, before `release()`, unconditionally.

**★ Symptom: rows survive a suite that is supposed to roll everything back.** Cause: something inside the code under test opened its own top-level transaction on the pool — a `withRetry` call, a background write, a second `db` import — and committed. Fix: for those tests, stop wrapping. They belong in the concurrency project with a real reset. A wrapper that is only *mostly* enclosing is worse than none, because it makes the residue unpredictable.

**★ Symptom: the transaction-wrapped suite works locally and hangs on the pooled connection string.** Cause: `DATABASE_URL` points at a transaction-mode pooler, which does not promise session affinity between statements, so `BEGIN` and the following statements may not share a server session. Fix: the harness uses `DIRECT_URL`. This is the same rule migrations follow ([02c](02c-the-migration-is-a-release-step.md)) and for the same underlying reason.

**★ Symptom: a `SERIALIZABLE` DAL test passes and the production endpoint throws `40001` under load.** Cause: the nested transaction became a savepoint, so the level was never actually in effect and no predicate locks were taken. Fix: move the test out of the wrapper. There is no version of this that works inside one, because the isolation level cannot be set after the wrapper's first statement anyway.

**★ Symptom: a migration test rolls itself back.** Cause: DDL in PostgreSQL is transactional, so `CREATE TABLE` inside the wrapper vanishes with everything else. Fix: migrations are not tested under this strategy at all; they get their own database and their own lifecycle ([12k](12k-migrations-in-the-test-path.md)).

**★ Symptom: a test asserting "the first card" broke after the suite had been run a few hundred times.** Cause: a sequence in the schema advanced permanently despite the rollbacks, because `nextval` is documented as not reclaiming values on abort. Fix: never assert on a generated integer id or on an ordering derived from one. Order by a column you control, and identify rows by a value the test supplied.

**★ Symptom: a `LISTEN`/`NOTIFY` test never receives anything.** Cause: notifications are delivered on commit and the wrapper never commits. Fix: this test cannot be wrapped either — it is the same class as the concurrency tests, and it belongs in the same project.

**★ Symptom: two tests in the same file interfere despite the rollback.** Cause: state held outside PostgreSQL — a module-level cache, an in-process idempotency map, a `unstable_cache` entry. The database reset is complete and irrelevant. Fix: reset the application-level state in the same hook, and prefer a per-test fresh team so that even a leaked cache entry is keyed differently.

## Interview questions

**★ Why is a transaction-per-test harness unable to test optimistic concurrency, even though optimistic concurrency is implemented with a single `UPDATE`?**
Because the interesting case needs two writers, and two writers means two connections. The seed row lives inside the harness's uncommitted transaction, which a second connection cannot see at any isolation level, so the second writer has nothing to collide with. You can simulate the shape of the test by issuing two updates on the same connection, but that is sequential by construction: the second one sees the first one's effect immediately and the `version` guard behaves exactly as it would with no concurrency at all. The test passes and proves nothing about the race.

**★ What is the difference between a nested transaction and a savepoint, and why does it matter to a test harness?**
A savepoint is a mark inside one transaction that lets you undo statements after it. It shares the enclosing transaction's snapshot, isolation level, locks and commit. A top-level transaction has its own snapshot and its own commit, and that is where every guarantee in the isolation chapter comes from. Drizzle implements a nested `transaction()` as a savepoint, so a DAL function that relies on being in its own transaction — for a snapshot, for an isolation level, for an atomic commit boundary — is silently running under different semantics when a harness has already opened one. The test exercises a construct that does not exist in production.

**★ PostgreSQL will not let you change the isolation level after the first statement of a transaction. What does that mean for a wrapped test?**
It means the code under test cannot ask for `REPEATABLE READ` or `SERIALIZABLE` at all, because the wrapper's `BEGIN` plus the seed inserts have already executed data-modification statements. So the entire Serializable path — predicate locks, `40001`, the retry loop — is unreachable from inside the wrapper. It is not a matter of doing the seed more carefully; any seed at all consumes the window, and a test with no seed has nothing to race over.

**★ A colleague builds a retry loop on savepoints so the serialization test can live inside the wrapper. What is wrong with it?**
It will appear to work, because a transaction aborted by an error can be restored with `ROLLBACK TO SAVEPOINT`. But the manual explains that retrying is correct because the new transaction *"will see the previously-committed change as part of its initial view of the database"* — a fresh snapshot. Rolling back to a savepoint keeps the same top-level transaction and the same snapshot, so the premise does not hold, and the manual separately says applications must not depend on results read during a transaction that later aborted. The savepoint retry is a different algorithm from the one shipping in production, so a green test carries no information about the shipping one.

**★ Which reset strategy would you choose for this suite, and why is that question slightly wrong?**
Because the answer is more than one. Transaction-per-test for the DAL suite, where it is the fastest possible reset and covers constraints, the predicate, projections, cascades and pagination. A separate database or schema per worker for the concurrency suite, which needs real commits visible across sessions. Unique data per test inside both, because it costs nothing and makes cross-test interference nearly impossible even when a reset misses something. Forcing every test into one strategy is what produces either a slow serialised suite or a concurrency suite that silently proves nothing.

**★ Why does the harness point at `DIRECT_URL` rather than `DATABASE_URL`?**
Because it depends on session affinity: `BEGIN`, the seed, the code under test and `ROLLBACK` must all land on the same server session. A transaction-mode pooler multiplexes client connections onto server connections and does not promise that, so a wrapped statement may execute on a session that never saw the `BEGIN`. The symptom is not an error but a missing row, which is one of the hardest failures to diagnose. It is the same constraint that makes migrations use the direct endpoint.

---

← [12e · The ownership negative test](12e-the-ownership-negative-test.md) · [Chapter index](01-explanation.md) · Next → [12g · TRUNCATE, templates and schema per worker](12g-truncate-templates-and-schema-per-worker.md)
