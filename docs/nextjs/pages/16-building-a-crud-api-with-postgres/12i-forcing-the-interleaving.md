---
title: "A lost-update test that runs its two writers one after the other proves that sequential writes work, which was never in doubt — the test only means something if you hold one transaction open at a chosen statement while the other overtakes it, and that requires two connections and a barrier you control"
sidebar_label: "12i · Forcing the interleaving"
sidebar_position: 81
description: "The barrier helper, the lost update demonstrated and then prevented, why the second writer's WHERE clause is re-evaluated against the new row version, asserting the invariant rather than the winner, a deterministic blocking test with NOWAIT, and the teardown that stops one failure poisoning the file."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 documentation — [§13.2.1 Read Committed](https://www.postgresql.org/docs/18/transaction-iso.html), [§13.3.2 Row-Level Locks](https://www.postgresql.org/docs/18/explicit-locking.html), [`SELECT … FOR UPDATE`](https://www.postgresql.org/docs/18/sql-select.html) and [Appendix A · Error Codes](https://www.postgresql.org/docs/18/errcodes-appendix.html) — and [RFC 9110 §15.5.13](https://www.rfc-editor.org/rfc/rfc9110.txt), fetched as raw text. Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · Vitest **5.0.0** · Node **24.20.0**.

**[07c](07c-the-lost-update.md) is the chapter's pivot: the read-modify-write that silently discards a colleague's edit, and the reason `version` is in the schema at all. It is also the single hardest thing in this chapter to test, because the bug only exists in an interleaving — A reads, B reads, A writes, B writes — and every convenient way to write the test produces A reads, A writes, B reads, B writes, which is not the same program. The sequential version passes whether or not the version guard exists, which makes it the most dangerous kind of test: one that a team believes covers the bug. Getting the real interleaving requires two independent connections and an explicit barrier between them, and once you have that machinery, four of this chapter's claims become testable and none of them were before. This page builds the machinery, then writes the four tests — and closes with the teardown discipline that keeps one failure from poisoning every test after it.**

## Why the convenient version proves nothing

```ts
// ❌ this is a sequential test wearing a concurrency costume
it('loses an update', async () => {
  const a = await getCard(cardId)          // version 1
  await rawUpdate(cardId, { title: 'A' })  // now version 2
  const b = await getCard(cardId)          // 🔴 version 2 — B never had a stale read
  await rawUpdate(cardId, { title: 'B' })
  expect((await getCard(cardId)).title).toBe('B')
})
```

`b` was read *after* A's write, so B is not working from stale state and there is no lost update to observe. Delete the version guard and this test is unchanged. Add it back and the test is unchanged. It is measuring nothing.

The interleaving the bug needs is:

```
session A:  BEGIN ─ SELECT (v1) ────────────────── UPDATE ─ COMMIT
session B:           BEGIN ─ SELECT (v1) ──────────────────────────── UPDATE ─ COMMIT
                            ↑ B's read must happen before A's write
```

Both sessions must hold the same stale view before either writes. One connection cannot do that, because a connection has one transaction at a time.

## The machinery: two connections and a barrier

```ts
// test/concurrency/support.ts
import { Pool, type PoolClient } from 'pg'

const pool = new Pool({ connectionString: process.env.DIRECT_URL, max: 4 })

/** A one-shot gate. `wait()` resolves when someone calls `open()`. */
export function gate() {
  let open!: () => void
  const waited = new Promise<void>((resolve) => { open = resolve })
  return { open, wait: () => waited }
}

/** Runs `body` on its own dedicated connection, guaranteeing cleanup. */
export async function session<T>(body: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    return await body(client)
  } finally {
    // 🔴 unconditional: a half-open transaction holds row locks the next test needs
    await client.query('ROLLBACK').catch(() => {})
    client.release()
  }
}

export async function closeSessions() { await pool.end() }
```

`gate()` is the whole trick. It is a deferred promise: one session awaits it, the other resolves it, and the ordering between the two is decided by your code rather than by the event loop. No `setTimeout`, no sleeps, no timing.

## Test 1 — the lost update, demonstrated

The seed must be **committed** before either session starts, which is why this file cannot run under the transaction wrapper ([12f](12f-the-seed-and-reset-story.md)).

```ts
// test/concurrency/lost-update.test.ts
it('a read-modify-write without a version guard discards the first writer', async () => {
  const card = await seedCommittedCard({ title: 'original' })

  const bHasRead = gate()
  const aHasWritten = gate()

  const a = session(async (c) => {
    await c.query('BEGIN')
    const { rows: [before] } = await c.query(
      'SELECT title, version FROM cards WHERE id = $1', [card.id])
    await bHasRead.wait()                                   // 1 · let B take its stale read
    await c.query('UPDATE cards SET title = $1, version = version + 1 WHERE id = $2',
      [`${before.title} + A`, card.id])
    await c.query('COMMIT')
    aHasWritten.open()                                      // 2 · release B
  })

  const b = session(async (c) => {
    await c.query('BEGIN')
    const { rows: [before] } = await c.query(
      'SELECT title, version FROM cards WHERE id = $1', [card.id])
    bHasRead.open()                                         // B is now holding v1
    await aHasWritten.wait()
    await c.query('UPDATE cards SET title = $1, version = version + 1 WHERE id = $2',
      [`${before.title} + B`, card.id])
    await c.query('COMMIT')
  })

  await Promise.all([a, b])

  const final = await readRowDirectly(card.id)
  expect(final.title).toBe('original + B')      // 🔴 A's edit is gone
  expect(final.title).not.toContain('+ A')
})
```

The gates make the schedule exact: B's `SELECT` is guaranteed to happen before A's `UPDATE`, and B's `UPDATE` is guaranteed to happen after A's `COMMIT`. **That is the lost update, reproduced deterministically**, and the assertion `not.toContain('+ A')` is the loss itself rather than a proxy for it.

## Test 2 — the version guard, and why the second `UPDATE` matches nothing

Change one thing: put `AND version = $3` in both updates. Now B's statement finds no row, and the reason is documented precisely.

> *"`UPDATE`, `DELETE`, `SELECT FOR UPDATE`, and `SELECT FOR SHARE` commands behave the same as `SELECT` in terms of searching for target rows: they will only find target rows that were committed as of the command start time. However, such a target row might have already been updated (or deleted or locked) by another concurrent transaction by the time it is found. In this case, the would-be updater will wait for the first updating transaction to commit or roll back (if it is still in progress). … If the first updater commits, the second updater will ignore the row if the first updater deleted it, otherwise it will attempt to apply its operation to the updated version of the row. The search condition of the command (the `WHERE` clause) is re-evaluated to see if the updated version of the row still matches the search condition."*
> — [PostgreSQL 18 · §13.2.1 Read Committed](https://www.postgresql.org/docs/18/transaction-iso.html)

🔴 **That last sentence is the entire mechanism of optimistic concurrency in this API.** B's `WHERE id = $1 AND version = 1` is re-evaluated against the row A just committed, whose `version` is now 2. It no longer matches, so B affects zero rows, and [07d](07d-optimistic-concurrency-with-a-version-column.md) turns zero affected rows into a `412`:

> *"The 412 (Precondition Failed) status code indicates that one or more conditions given in the request header fields evaluated to false when tested on the server (Section 13)."*
> — [RFC 9110 §15.5.13](https://www.rfc-editor.org/rfc/rfc9110.txt)

```ts
it('the version guard makes the second writer affect zero rows', async () => {
  const card = await seedCommittedCard({ title: 'original' })   // version 1
  /* …same two gated sessions… */
  const bResult = await c.query(
    'UPDATE cards SET title = $1, version = version + 1 WHERE id = $2 AND version = $3',
    ['B', card.id, 1])
  expect(bResult.rowCount).toBe(0)                              // 🔴 the whole mechanism

  const final = await readRowDirectly(card.id)
  expect(final.title).toBe('original + A')                      // A survived
  expect(final.version).toBe(2)                                 // exactly one bump
})
```

## Test 3 — assert the invariant, not the winner

The gated tests above prescribe an order. Some tests should not: what you really want to know about two clients sending `PATCH` with the same `If-Match` is that **exactly one succeeds**, whichever one the scheduler favours.

```ts
it('exactly one of two concurrent conditional updates succeeds', async () => {
  const card = await seedCommittedCard({ title: 'original' })
  const etag = `"c-${card.id}-1"`

  const [x, y] = await Promise.all([
    patchViaHandler(card.id, { title: 'X' }, { 'if-match': etag }),
    patchViaHandler(card.id, { title: 'Y' }, { 'if-match': etag }),
  ])

  const statuses = [x.status, y.status].sort()
  expect(statuses).toEqual([200, 412])                 // 🔴 not "x wins"

  const final = await readRowDirectly(card.id)
  expect(final.version).toBe(2)                        // exactly one write landed
  expect(['X', 'Y']).toContain(final.title)
})
```

**This is the more valuable of the two test styles and it is the one usually missing.** It has no ordering assumption, so it cannot flake on scheduling; it fails only when the invariant is genuinely broken — which is what happens if someone removes the guard (both get 200, version becomes 3) or breaks the mapping (both get 412, version stays 1). Both failure modes are caught by two assertions.

⚠️ **`Promise.all` does not guarantee overlap.** It starts both, but if the first completes before the second's first statement reaches the server, they ran sequentially and the test still passes vacuously. That is acceptable here precisely because the assertion is an invariant — it holds under both schedules — but it means this style cannot *demonstrate* a race, only refuse to break under one. Use gates when the point is the demonstration, `Promise.all` when the point is the invariant, and do not confuse the two.

## Test 4 — blocking, without a single timing assertion

[07f](07f-pessimistic-locking-and-when-it-is-right.md) argues for `SELECT … FOR UPDATE` where the work between read and write is genuinely serial. Testing "B blocks until A commits" looks like it needs a sleep. It does not: ask for the lock in a way that fails instead of waiting.

```ts
it('a row locked FOR UPDATE is not available to a second session', async () => {
  const card = await seedCommittedCard({ title: 'original' })
  const aHasLocked = gate()
  const bHasTried = gate()

  const a = session(async (c) => {
    await c.query('BEGIN')
    await c.query('SELECT * FROM cards WHERE id = $1 FOR UPDATE', [card.id])
    aHasLocked.open()
    await bHasTried.wait()
    await c.query('COMMIT')
  })

  const b = session(async (c) => {
    await aHasLocked.wait()
    const err = await c.query('SELECT * FROM cards WHERE id = $1 FOR UPDATE NOWAIT', [card.id])
      .then(() => null, (e) => e)
    bHasTried.open()
    expect(err?.code).toBe('55P03')          // lock_not_available — deterministic, no sleep
  })

  await Promise.all([a, b])
})
```

`NOWAIT` converts "would have waited" into an immediate, named error, and `55P03 lock_not_available` is in the error-code appendix. **This is the pattern for every blocking assertion in the suite**: never assert that something took time; assert that a non-blocking variant reported unavailability. `lock_timeout` set to a small value on the test role ([12h](12h-parallel-workers-against-one-postgres.md)) gives you the same effect for statements that have no `NOWAIT` form.

## Test 5 — two concurrent creates competing for the same position

[05ea](05ea-the-position-value-and-concurrent-creates.md) computes a new card's position from the board's current contents, which is a read-modify-write with a different shape: both sessions read the same maximum and both write a position derived from it.

```ts
it('two concurrent appends do not produce two cards at the same position', async () => {
  const board = await seedCommittedBoard()
  await Promise.all([
    createCardAtEnd(board.id, { title: 'first' }),
    createCardAtEnd(board.id, { title: 'second' }),
  ])
  const rows = await db.select().from(cards).where(eq(cards.boardId, board.id))
  const positions = rows.map((r) => r.position)
  expect(new Set(positions).size).toBe(positions.length)     // no collision
  expect(positions.every(Number.isFinite)).toBe(true)
})
```

If the strategy chosen in 05ea does not actually prevent the collision — because it computes the maximum in a separate statement at `READ COMMITTED` — this test fails, and that is the point: it tells you whether the mitigation you chose works, rather than whether you wrote it down. If your design accepts occasional collisions and relies on the `id` tiebreaker instead, invert the assertion to say so explicitly, so the file records the decision.

## Teardown is not optional here

Every session in these tests can be interrupted mid-transaction by a failed assertion, and an interrupted session holds row locks until its connection is rolled back or released. One failure then produces a cascade: the next test's `UPDATE` on the same row waits, `lock_timeout` fires, and three unrelated tests report `55P03`.

Three rules keep that from happening:

1. **`ROLLBACK` in a `finally`, ignoring errors** — as in `session()` above. It runs whether the body threw, returned or was cancelled.
2. **Never `await` an assertion while holding a gate the other session is waiting on.** If the assertion throws, the partner waits forever and the test times out with no diagnostic. Collect results, join with `Promise.all`, assert afterwards.
3. **Bound the whole test.** A Vitest per-test timeout plus `idle_in_transaction_session_timeout` on the role means a deadlocked pair fails in seconds with a named error instead of hanging the worker.

```ts
// ❌ if this throws, session A is still waiting on bHasTried and never commits
const b = session(async (c) => {
  const err = await tryLock(c)
  expect(err?.code).toBe('55P03')     // throws here, gate never opens
  bHasTried.open()
})
```

```ts
// ✅ open the gate first, assert after the join
const b = session(async (c) => {
  const err = await tryLock(c)
  bHasTried.open()
  return err
})
const [, bErr] = await Promise.all([a, b])
expect(bErr?.code).toBe('55P03')
```

## Gotchas

**★ Symptom: the lost-update test passes with and without the version guard.** Cause: the two reads and two writes ran in sequence on one connection, so neither writer ever held a stale view. Fix: two connections and a gate that forces B's `SELECT` before A's `UPDATE`. The check that this is real is the same as for the ownership tests — remove the guard and the test must change colour.

**★ Symptom: a concurrency test hangs until the suite times out and reports nothing useful.** Cause: an assertion threw inside a session while its partner was awaiting a gate that is now never opened. Fix: open gates before asserting, return values from sessions, and do all assertions after `Promise.all`. Add a per-test timeout so the failure at least arrives.

**★ Symptom: after one concurrency test fails, the next several fail with lock errors.** Cause: the failed test left a transaction open holding row locks. Fix: `ROLLBACK` in a `finally` before `release()`, swallowing errors from the rollback itself — the connection may already be in a state where the rollback is a no-op, and that must not mask the real failure.

**★ Symptom: a `Promise.all` race test never actually overlaps.** Cause: `Promise.all` starts both promises but does not synchronise their statements; a fast first request can finish before the second's first round trip. Fix: nothing, if the assertion is an invariant — it is valid under both schedules. If the test is meant to *demonstrate* the race, it needs gates; a `Promise.all` test that claims to demonstrate one is claiming more than it proves.

**★ Symptom: a blocking test flakes on CI.** Cause: it asserted elapsed time, or it slept a fixed interval and hoped the other session had progressed. Fix: `FOR UPDATE NOWAIT` and an assertion on `55P03`, or a small `lock_timeout` and an assertion on the resulting error. Neither contains a duration.

**★ Symptom: the concurrency file passes alone and fails in the full suite.** Cause: it ran in parallel with other workers writing the same rows, so an unrelated transaction interfered with the schedule. Fix: `fileParallelism: false` on the concurrency project, and its own database ([12g](12g-truncate-templates-and-schema-per-worker.md)). These tests are about contention, so any contention you did not create is noise.

**★ Symptom: the seed row is invisible to the second session.** Cause: the seed ran inside a wrapper transaction that has not committed. Fix: seed with an explicit commit, from a helper that is not routed through the DAL's injected context. `seedCommittedCard` exists as a separate helper for exactly this reason, and its name is the documentation.

**★ Symptom: the pool is exhausted halfway through the concurrency file.** Cause: `session()` acquires a dedicated connection and a test that starts three sessions against a pool of two waits forever. Fix: size the concurrency pool for the widest test in the file plus one, and set `connectionTimeoutMillis` so exhaustion fails rather than hangs.

**★ Symptom: both writers succeed and `version` ended at 3.** Cause: the guard was written as a read-then-check in application code rather than as a conjunct in the `UPDATE`'s `WHERE`. The check passed for both because both read before either wrote. Fix: the comparison belongs in the statement, so PostgreSQL re-evaluates it against the committed row version — that re-evaluation is the documented behaviour the whole mechanism rests on, and application code cannot reproduce it.

## Interview questions

**★ Why does a lost-update test need two connections rather than two sequential calls?**
Because the bug is an interleaving, not a sequence. The defect requires both writers to hold the same stale read before either commits, and a single connection has one transaction at a time, so the second read necessarily happens after the first write and is no longer stale. A sequential test therefore behaves identically with and without the version guard, which means it cannot detect the bug it was written for — the worst possible property for a test, since the team now believes the case is covered.

**★ Explain, from the documentation, why the second writer's `UPDATE` affects zero rows.**
At Read Committed, an `UPDATE` finds rows committed as of command start; if a target row is concurrently locked, the second updater waits for the first to finish. When the first commits, the manual says the second *"will attempt to apply its operation to the updated version of the row"* and that *"the search condition of the command (the `WHERE` clause) is re-evaluated to see if the updated version of the row still matches"*. Since the first writer incremented `version`, the second's `AND version = 1` no longer matches the new row version, so it affects nothing. That re-evaluation is what makes a version column work without any explicit locking, and it is a property of the database rather than of the ORM.

**★ When should a concurrency test prescribe an order and when should it assert an invariant?**
Prescribe an order when the point is to demonstrate a specific failure — the lost update needs A-read, B-read, A-write, B-write and nothing else shows the loss. Assert an invariant when the point is that the outcome is safe under *any* order: two conditional updates must produce exactly one 200 and one 412, and which client wins is not part of the contract. The invariant form is more robust because it cannot flake on scheduling, and it is usually the one missing from a suite, because it is less obvious that it is testing anything.

**★ How do you assert that a session blocked on a row lock, without asserting on time?**
Ask for the lock in a form that refuses to wait. `SELECT … FOR UPDATE NOWAIT` raises `55P03 lock_not_available` immediately when the row is locked, so the assertion is on an error code rather than on a duration and it is fully deterministic. Where a statement has no `NOWAIT` form, a small `lock_timeout` on the test role gives the same shape: the wait becomes a named error in a bounded time. Asserting elapsed milliseconds is measuring a shared CI runner and will flake.

**★ What is the specific teardown hazard in a gated concurrency test?**
An assertion throwing inside one session while the other is awaiting a gate that will now never open. The partner hangs, the test times out with no diagnostic, and — worse — the throwing session's transaction is still open holding row locks, so subsequent tests fail on lock waits. The discipline is to open every gate before asserting anything, return results from the sessions, join with `Promise.all`, and assert afterwards; plus an unconditional `ROLLBACK` in a `finally` so a failed session cannot hold locks past its own lifetime.

**★ Why can these tests not run under the transaction-per-test harness, in one sentence each for the two reasons?**
The seed row lives in an uncommitted transaction, so the second session cannot see it at any isolation level; and the sessions must commit for real to observe each other, which the harness's `ROLLBACK` neither prevents nor cleans up, so the tests would both prove nothing and leave residue.

---

← [12h · Parallel workers, one Postgres](12h-parallel-workers-against-one-postgres.md) · [Chapter index](01-explanation.md) · Next → [12j · The retry loop and the idempotency key](12j-testing-the-retry-loop-and-the-idempotency-key.md)
