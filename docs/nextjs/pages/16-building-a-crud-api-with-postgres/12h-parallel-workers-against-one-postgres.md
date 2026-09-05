---
title: "Eight test workers each holding a ten-connection pool is eighty connections against a server whose default limit is a hundred, and that is the least subtle of the four ways a parallel suite collides inside one PostgreSQL instance"
sidebar_label: "12h · Parallel workers, one Postgres"
sidebar_position: 63
description: "The connection arithmetic and SQLSTATE 53300, the global assertions that are wrong the moment a second worker exists, cross-worker deadlocks appearing as random failures, the four timeouts that turn a hung suite into a fast failure, and the leaked pool that stops the worker exiting."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 documentation — [§20.3 Connection Settings](https://www.postgresql.org/docs/18/runtime-config-connection.html), [§20.11 Client Connection Defaults](https://www.postgresql.org/docs/18/runtime-config-client.html), [§20.13 Lock Management](https://www.postgresql.org/docs/18/runtime-config-locks.html) and [Appendix A · Error Codes](https://www.postgresql.org/docs/18/errcodes-appendix.html) — and [Vitest · Parallelism](https://vitest.dev/guide/parallelism). Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · Vitest **5.0.0** · `pg` **8.23.0** · **Next.js 16.3.4** · Node **24.20.0**.

**[12g](12g-truncate-templates-and-schema-per-worker.md) gave each worker its own namespace, which solves the data-isolation half of parallelism. The other half is that the workers still share one PostgreSQL *server*, and a server has finite connection slots, one lock table, one deadlock detector and one set of timeouts — all of which are global no matter how carefully you separated the rows. Four distinct failures come out of that, and each one manifests as an intermittent failure in a test that looks innocent: a connection refusal in whichever worker happened to start last, a `COUNT(*)` assertion that was correct when the suite ran single-threaded, a deadlock reported to whichever transaction the detector chose to abort, and a suite that hangs until CI kills the job because nothing in the default configuration has a time limit. This page does the arithmetic, then configures the four timeouts that convert every one of these from a mystery into a fast, legible failure.**

## The connection arithmetic

> *"Determines the maximum number of concurrent connections to the database server. The default is typically 100 connections, but might be less if your kernel settings will not support it (as determined during initdb). This parameter can only be set at server start."*
> — [PostgreSQL 18 · `max_connections`](https://www.postgresql.org/docs/18/runtime-config-connection.html)

And it is not 100 available to you:

> *"Determines the number of connection 'slots' that are reserved for connections by PostgreSQL superusers. … The default value is three connections."*
> — [PostgreSQL 18 · `superuser_reserved_connections`](https://www.postgresql.org/docs/18/runtime-config-connection.html)

So the budget for a default instance is 97, and the suite's demand is:

```
workers                    × pool `max` per worker
+ the migration client in global setup
+ any `next start` the Playwright project launched (its own pool)
+ your local psql, your GUI client, a stray dev server
```

Eight Vitest workers at `max: 10` is 80 before anything else. Add a Playwright project running concurrently in the same CI job with its own application pool and the total crosses the line. The server then refuses with SQLSTATE **`53300 too_many_connections`**, and the failure lands in whichever worker happened to ask last — which is why it reads as a random test failing rather than as a configuration problem.

🔴 **A test worker needs a pool of one or two, not ten.** [03b](03b-the-arithmetic-and-the-three-escapes.md) does this arithmetic for production; the test version is simpler because a worker runs one test at a time by default:

> *"Within individual files, Vitest runs tests sequentially by default. Tests execute in the order they are defined, one after another."*
> — [Vitest · Parallelism](https://vitest.dev/guide/parallelism)

```ts
// test/support/db.ts — one connection per worker, plus one spare for the second session
export const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  max: 2,                       // 1 for the test, 1 for the concurrency partner
  idleTimeoutMillis: 1_000,     // release fast so a stalled worker frees its slot
  connectionTimeoutMillis: 5_000,
})
```

`connectionTimeoutMillis` is the one people omit and it matters most here: without it, a worker that cannot get a connection because the server is full waits forever, and the suite hangs instead of failing.

## The global assertions that stop being true

Give each worker its own database and this problem disappears. Share one database — the common arrangement when the suite uses per-test teams rather than per-worker databases — and every assertion whose scope is the whole table is wrong the moment a second worker exists.

```ts
// ❌ true with one worker, false with two, and the failure is nondeterministic
expect(await db.select({ n: count() }).from(cards)).toEqual([{ n: 3 }])
const all = await db.select().from(cards)
expect(all.map((c) => c.title)).toEqual(['a', 'b', 'c'])
```

```ts
// ✅ every assertion scoped the way the API scopes its queries
const mine = await db.select().from(cards).where(eq(cards.boardId, board.id))
expect(mine).toHaveLength(3)
```

**The rule generalises usefully: a test assertion should be scoped exactly the way the production query is scoped.** If the production query filters by board and by the ownership predicate, so should the verification query. An assertion broader than the API's own scope is testing the suite's arrangement rather than the API.

The `(board_id, created_at, id)` index is the physical version of the same story. Every worker writing cards into one table writes into that one index, so workers contend for its pages and for the table's — and a page-split-heavy insert pattern from one worker is felt by another. ⚠️ **I did not measure this and will not put a number on it**; the actionable part is not the contention but the correctness consequence above, and the fact that a "slow parallel suite" against one shared table has a plausible cause that is not your code.

## Cross-worker deadlocks

Two workers that each touch two boards in opposite orders deadlock, and PostgreSQL resolves it by aborting one of them.

> *"This is the amount of time to wait on a lock before checking to see if there is a deadlock condition. … The default is one second (`1s`), which is probably about the smallest value you would want in practice."*
> — [PostgreSQL 18 · `deadlock_timeout`](https://www.postgresql.org/docs/18/runtime-config-locks.html)

The victim receives `40P01 deadlock_detected`. Three things make this nasty in a test suite:

1. **The victim is chosen by the server**, so the failure lands in whichever test lost — not in the one that was written badly.
2. **`withRetry` retries `40P01`** ([09d](09d-serialization-failures-and-the-retry-loop.md)), so a deadlock caused purely by test arrangement is silently absorbed by the production retry loop and reappears as a slow test rather than a failed one.
3. **It takes a second to be detected**, by default, so a suite with a handful of these gets mysteriously slower before it gets flaky.

The fix is the same one production uses: **acquire in a consistent order**. If a fixture touches multiple boards, sort by id before writing. And if a test *is* about deadlocks, it belongs in the concurrency project running single-worker, where the only two contending sessions are the ones the test created.

## The four timeouts that make failures fast

Nothing in a default PostgreSQL configuration has a time limit, so the natural failure mode of every mistake above is *hanging*. A hung Vitest worker takes the whole suite to the CI job's limit and produces no useful output. Four settings fix that, and all four should be set on the test role rather than per query.

> *"Abort any statement that takes more than the specified amount of time. … A value of zero (the default) disables the timeout."* — `statement_timeout`
>
> *"Abort any statement that waits longer than the specified amount of time while attempting to acquire a lock on a table, index, row, or other database object. The time limit applies separately to each lock acquisition attempt. The limit applies both to explicit locking requests (such as `LOCK TABLE`, or `SELECT FOR UPDATE` without `NOWAIT`) and to implicitly-acquired locks."* — `lock_timeout`
>
> *"Terminate any session that has been idle (that is, waiting for a client query) within an open transaction for longer than the specified amount of time."* — `idle_in_transaction_session_timeout`
>
> — [PostgreSQL 18 · §20.11](https://www.postgresql.org/docs/18/runtime-config-client.html)

```sql
-- once, against the test database, as part of provisioning
ALTER ROLE sprintdesk_test SET statement_timeout = '10s';
ALTER ROLE sprintdesk_test SET lock_timeout = '5s';
ALTER ROLE sprintdesk_test SET idle_in_transaction_session_timeout = '30s';
```

What each one buys, concretely:

| Setting | Turns this hang into |
|---|---|
| `statement_timeout` | a runaway query failing in 10s instead of running to the job limit |
| `lock_timeout` | a `55P03 lock_not_available` naming the contended object, in 5s |
| `idle_in_transaction_session_timeout` | a `25P03` on a test that opened a transaction and then awaited something that never resolved — the classic forgotten `await` |
| `connectionTimeoutMillis` (client side) | a fast, legible failure when the pool cannot get a slot |

PostgreSQL 17 added a fourth server-side one, `transaction_timeout`, whose condition name is `25P04 transaction_timeout` in the error-code appendix; it bounds the whole transaction rather than a statement or an idle period. ⚠️ **I confirmed the code exists in the PostgreSQL 18 appendix but did not read its parameter documentation**, so treat the exact semantics as something to check before relying on it.

🔴 **Set these on the test role, never globally on a shared development server.** A `statement_timeout` inherited by a migration is how a `CREATE INDEX` on a large table gets aborted halfway ([02d](02d-the-lock-a-migration-actually-takes.md) is the topic that cares).

## Vitest's parallelism model, in the terms this suite needs

> *"By default, Vitest runs test files in parallel across multiple workers. Each file gets its own isolated environment, so tests in different files can't interfere with each other."*
>
> *"forks (the default) and vmForks run each file in a separate child process"* … *"threads and vmThreads run each file in a separate worker thread."*
> — [Vitest · Parallelism](https://vitest.dev/guide/parallelism)

Three consequences for a database suite:

**Isolation is per file, not per test.** So a per-worker database is really a per-file-batch database, and two tests in the same file share everything. That is fine and is why per-test teams remain worthwhile inside a per-worker database.

**`forks` means separate processes**, which means each worker has its own module registry and therefore its own pool. The connection arithmetic multiplies by worker count; it does not amortise.

**Tests inside a file are sequential unless you opt in.** 🔴 **Never put `test.concurrent` on a database test.** Two concurrent tests in one file share the worker's pool of two connections and its database, so they interleave in a way nothing controls — which is the opposite of the *controlled* interleaving [12i](12i-forcing-the-interleaving.md) builds.

For the concurrency project specifically, `fileParallelism: false` is the right setting: those tests create their own contention deliberately and any additional worker turns a deterministic race into a nondeterministic one.

## Detecting order dependence deliberately

The failure that survives every isolation strategy is a test that only passes because another test ran first. Vitest can shuffle execution order, and running the suite shuffled in a nightly job — not on every pull request, where nondeterminism is a cost — surfaces exactly those.

```ts
// vitest.config.ts, in a nightly-only config
export default defineConfig({ test: { sequence: { shuffle: true } } })
```

A test that fails only under shuffle is depending on residue. That is worth knowing about even when the residue is harmless, because the next person will assume it was not there.

## Gotchas

**★ Symptom: a random test fails with a connection error whenever the whole suite runs, and never in isolation.** Cause: workers × pool size exceeded the server's slots, and `53300 too_many_connections` landed on whichever worker asked last. Fix: pool `max: 2` per worker, `connectionTimeoutMillis` set so the failure is fast and legible, and do the arithmetic against `max_connections` minus `superuser_reserved_connections` — 97 on a default instance, not 100.

**★ Symptom: `expect(count).toBe(3)` passes single-threaded and fails at eight workers.** Cause: the assertion's scope is the whole table and other workers' rows are in it. Fix: scope every verification query the way the production query is scoped — by board, by team. An assertion broader than the API's own scope is not testing the API.

**★ Symptom: a test intermittently fails with a deadlock and the test does nothing unusual.** Cause: another worker held locks on the same rows in the opposite order; the server picked your transaction as the victim. Fix: order multi-row writes consistently in fixtures, and move genuine deadlock tests into the single-worker concurrency project. Note that `withRetry` retries `40P01`, so this can hide as slowness rather than surface as a failure.

**★ Symptom: the CI job hangs for its full time limit and produces no failure.** Cause: nothing has a timeout — a lock wait, a runaway statement, or a transaction left open by a missing `await`. Fix: `statement_timeout`, `lock_timeout` and `idle_in_transaction_session_timeout` on the test role, plus `connectionTimeoutMillis` on the client. Every one of those converts a hang into a named error in seconds.

**★ Symptom: the Vitest run finishes reporting all tests passed and the process never exits.** Cause: a `Pool` was created and never `end()`ed, so a live socket keeps the worker's event loop alive. Fix: `pool.end()` in `afterAll`, and if a pool is created in global setup, close it in the returned teardown function. Reaching for `--forceExit`-style flags hides a leak that will eventually exhaust the server's connection slots too.

**★ Symptom: adding `test.concurrent` made a database test flake.** Cause: two tests in one file now share the worker's connections and its data with no coordination. Fix: remove it. Parallelism for a database suite comes from files and workers with separate namespaces, never from concurrent tests inside one file.

**★ Symptom: a migration in CI was aborted partway with a timeout.** Cause: a `statement_timeout` set on the role or the database, inherited by the migration client. `CREATE INDEX` on a real table exceeds any value that is sensible for a test. Fix: scope the timeouts to the test role only, and have the migration client explicitly `SET statement_timeout = 0` for its session if it shares a role.

**★ Symptom: a test passes alone and fails when the file order changes.** Cause: it depends on residue from an earlier test — a row, a cached value, a sequence position. Fix: find it by running with `sequence.shuffle` in a nightly job. Then fix the test rather than pinning the order; a pinned order is a dependency you have written down rather than removed.

**★ Symptom: `lock_timeout` fires during an ordinary test.** Cause: usually another worker's `TRUNCATE` holding `ACCESS EXCLUSIVE` ([12g](12g-truncate-templates-and-schema-per-worker.md)). Fix: the timeout did its job — it told you the suite is not actually isolated. Give the workers separate databases rather than raising the timeout.

## Interview questions

**★ Do the connection-count arithmetic for a suite with eight Vitest workers.**
Each worker is a separate process with its own module registry, so each has its own pool; the counts multiply rather than amortise. Eight workers at a pool `max` of ten is eighty connections, against a default `max_connections` of 100 less the three reserved for superusers — 97 usable. Add the global-setup migration client, any application server a Playwright project launched with its own pool, and a developer's psql session, and it crosses. Since Vitest runs tests inside a file sequentially by default, a worker needs one connection for the test plus one for a concurrency partner, so `max: 2` is the right number and the arithmetic comfortably fits.

**★ Why is `expect(await countCards()).toBe(3)` a bug rather than a strict assertion?**
Because its scope is the whole table and the table is shared. It encodes an assumption — that this test is the only writer — which is true under one worker and false under any parallelism, so it becomes a nondeterministic failure that depends on scheduling. The correct form scopes the verification exactly as the production query scopes itself: count the cards on *this* board, for *this* team. That assertion is true regardless of how many workers are running, and it is also closer to what the API actually promises.

**★ A test intermittently fails with `40P01` and touches only its own fixtures. What happened?**
Another worker held locks on overlapping rows in the opposite order, the deadlock detector fired after `deadlock_timeout` — one second by default — and the server chose your transaction as the victim. The failure lands in a blameless test because victim selection has nothing to do with which transaction was written badly. It is also easy to miss entirely, because the production retry loop retries `40P01`, so it may present as a slow suite rather than a failing one. Fixtures should acquire in a consistent order, and real deadlock tests belong in a single-worker project.

**★ Which timeouts would you set on a test database, and what does each convert?**
`statement_timeout` turns a runaway query into a fast failure instead of a job that runs to its limit. `lock_timeout` turns a wait on another worker's `ACCESS EXCLUSIVE` into a `55P03` that names the contended object, which is a diagnosis rather than a hang. `idle_in_transaction_session_timeout` catches the classic missing `await` that leaves a transaction open holding locks. On the client, `connectionTimeoutMillis` turns connection-slot exhaustion into a legible error. All of them go on the test role, never globally, because a migration inheriting a `statement_timeout` gets aborted mid-`CREATE INDEX`.

**★ Why must a database test never use `test.concurrent`?**
Because Vitest's isolation boundary is the file, not the test. Two concurrent tests in one file share the worker's process, its pool and its database, and nothing sequences their statements — so they contend in a way neither test controls, which is indistinguishable from a flake. The parallelism a database suite wants comes from files running in separate workers with separate namespaces. Where deliberate overlap *is* the subject, it is built inside a single test with two explicitly-managed connections and a barrier, which is a controlled interleaving rather than a scheduling accident.

**★ The suite reports every test passing and then the process hangs. Where do you look first?**
An unclosed `Pool`. A live socket keeps the worker's event loop alive after the last test resolves, so the run completes and the process does not exit. Every pool needs an `end()` — in `afterAll` for per-file pools, in global setup's returned teardown for a shared one. The temptation is a force-exit flag, which hides the leak and lets it keep consuming server connection slots across a long CI run until something else fails with `53300` instead.

---

← [12g · TRUNCATE, templates, schemas](12g-truncate-templates-and-schema-per-worker.md) · [Chapter 16 overview](01-explanation.md) · Next → [12i · Forcing the interleaving](12i-forcing-the-interleaving.md)
