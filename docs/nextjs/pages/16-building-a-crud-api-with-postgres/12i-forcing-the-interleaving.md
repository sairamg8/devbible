---
title: "A lost-update test that runs its two writers one after the other proves that sequential writes work, which was never in doubt — the test only means something if you hold one transaction open at a chosen statement while the other overtakes it, and that requires two connections and a barrier you control"
sidebar_label: "12i · Forcing the interleaving"
sidebar_position: 64
description: "Why a sequential lost-update test is unfalsifiable, the gate and session helpers, the lost update reproduced deterministically, why the second writer's WHERE clause is re-evaluated against the new row version, and the teardown discipline that stops one failure poisoning the file."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 documentation — [§13.2.1 Read Committed](https://www.postgresql.org/docs/18/transaction-iso.html) and [Appendix A · Error Codes](https://www.postgresql.org/docs/18/errcodes-appendix.html) — and [RFC 9110 §15.5.13](https://www.rfc-editor.org/rfc/rfc9110.txt), fetched as raw text from rfc-editor.org. Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · Vitest **5.0.0** · Node **24.20.0**.

**[07c](07c-the-lost-update.md) is the chapter's pivot: the read-modify-write that silently discards a colleague's edit, and the reason `version` is in the schema at all. It is also the single hardest thing in this chapter to test, because the bug only exists in an interleaving — A reads, B reads, A writes, B writes — and every convenient way to write the test produces A reads, A writes, B reads, B writes, which is not the same program. The sequential version passes whether or not the version guard exists, which makes it the most dangerous kind of test: one that a team believes covers the bug. Getting the real interleaving requires two independent connections and an explicit barrier between them, and once you have that machinery, four of this chapter's claims become testable and none of them were before. This page builds the machinery and writes the two tests that are about the lost update itself; [12ia](12ia-invariants-blocking-and-position-races.md) writes the three that use the same machinery for a different kind of claim.**

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

const pool = new Pool({
  connectionString: process.env.DIRECT_URL,
  max: 4,                       // widest test in the file, plus one
  connectionTimeoutMillis: 5_000,
})

/** A one-shot gate. `wait()` resolves when someone calls `open()`. */
export function gate() {
  let open!: () => void
  const waited = new Promise<void>((resolve) => { open = resolve })
  return { open, wait: () => waited }
}

/** An n-party barrier: every participant blocks until all n have arrived. */
export function counter(parties: number) {
  let arrived = 0
  let release!: () => void
  const all = new Promise<void>((resolve) => { release = resolve })
  return {
    async arriveAndWait() {
      if (++arrived === parties) release()
      await all
    },
  }
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

`gate()` is the whole trick. It is a deferred promise: one session awaits it, the other resolves it, and the ordering between the two is decided by your code rather than by the event loop. No `setTimeout`, no sleeps, no timing. `counter()` is the same idea for the symmetric case, where neither session leads.

🔴 **Use a raw `PoolClient` and literal `BEGIN`/`COMMIT`, not `db.transaction()`.** The gate has to be awaited *between* two statements of an open transaction, and a callback-style transaction API gives you no place to hand control to another session mid-flight without also risking the nested-transaction-is-a-savepoint behaviour [12f](12f-the-seed-and-reset-story.md) describes. Raw statements make the schedule explicit and readable, which is the entire value of these tests.

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

One thing changes: `AND version = $3` in both updates. Now B's statement finds no row, and the reason is documented precisely.

> *"`UPDATE`, `DELETE`, `SELECT FOR UPDATE`, and `SELECT FOR SHARE` commands behave the same as `SELECT` in terms of searching for target rows: they will only find target rows that were committed as of the command start time. However, such a target row might have already been updated (or deleted or locked) by another concurrent transaction by the time it is found. In this case, the would-be updater will wait for the first updating transaction to commit or roll back (if it is still in progress). … If the first updater commits, the second updater will ignore the row if the first updater deleted it, otherwise it will attempt to apply its operation to the updated version of the row. The search condition of the command (the `WHERE` clause) is re-evaluated to see if the updated version of the row still matches the search condition."*
> — [PostgreSQL 18 · §13.2.1 Read Committed](https://www.postgresql.org/docs/18/transaction-iso.html)

🔴 **That last sentence is the entire mechanism of optimistic concurrency in this API.** B's `WHERE id = $1 AND version = 1` is re-evaluated against the row A just committed, whose `version` is now 2. It no longer matches, so B affects zero rows, and [07d](07d-optimistic-concurrency-with-a-version-column.md) turns zero affected rows into a `412`:

> *"The 412 (Precondition Failed) status code indicates that one or more conditions given in the request header fields evaluated to false when tested on the server (Section 13)."*
> — [RFC 9110 §15.5.13](https://www.rfc-editor.org/rfc/rfc9110.txt)

```ts
// test/concurrency/version-guard.test.ts
it('the version guard makes the second writer affect zero rows', async () => {
  const card = await seedCommittedCard({ title: 'original' })   // version 1
  const bHasRead = gate()
  const aHasWritten = gate()
  const GUARDED =
    'UPDATE cards SET title = $1, version = version + 1 WHERE id = $2 AND version = $3'

  const a = session(async (c) => {
    await c.query('BEGIN')
    const { rows: [before] } = await c.query(
      'SELECT title, version FROM cards WHERE id = $1', [card.id])
    await bHasRead.wait()
    const r = await c.query(GUARDED, [`${before.title} + A`, card.id, before.version])
    await c.query('COMMIT')
    aHasWritten.open()
    return r.rowCount
  })

  const b = session(async (c) => {
    await c.query('BEGIN')
    const { rows: [before] } = await c.query(
      'SELECT title, version FROM cards WHERE id = $1', [card.id])
    bHasRead.open()
    await aHasWritten.wait()
    const r = await c.query(GUARDED, [`${before.title} + B`, card.id, before.version])
    await c.query('COMMIT')
    return r.rowCount
  })

  const [aRows, bRows] = await Promise.all([a, b])
  expect(aRows).toBe(1)
  expect(bRows).toBe(0)                          // 🔴 the whole mechanism, in one number

  const final = await readRowDirectly(card.id)
  expect(final.title).toBe('original + A')       // A survived
  expect(final.version).toBe(2)                  // exactly one bump
})
```

Note that both sessions read `before.version` rather than hard-coding `1`. That is not cosmetic: a hard-coded version makes the test pass for the wrong reason if the seed helper ever starts at a different value, and it hides the fact that the guard is a comparison against *what this caller read*, which is the property being tested.

## Teardown is not optional here

Every session in these tests can be interrupted mid-transaction by a failed assertion, and an interrupted session holds row locks until its connection is rolled back or released. One failure then produces a cascade: the next test's `UPDATE` on the same row waits, `lock_timeout` fires, and three unrelated tests report `55P03`.

Three rules keep that from happening:

1. **`ROLLBACK` in a `finally`, ignoring errors** — as in `session()` above. It runs whether the body threw, returned or was cancelled, and swallowing the rollback's own error matters because the connection may already be in a state where it is a no-op.
2. **Never `await` an assertion while holding a gate the other session is waiting on.** If the assertion throws, the partner waits forever and the test times out with no diagnostic. Collect results, join with `Promise.all`, assert afterwards.
3. **Bound the whole test.** A Vitest per-test timeout plus `idle_in_transaction_session_timeout` on the role ([12h](12h-parallel-workers-against-one-postgres.md)) means a stuck pair fails in seconds with a named error instead of hanging the worker.

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

**★ Symptom: a concurrency test hangs until the suite times out and reports nothing useful.** Cause: an assertion threw inside a session while its partner was awaiting a gate that is now never opened. Fix: open gates before asserting, return values from sessions, and do all assertions after `Promise.all`. Add a per-test timeout so a failure at least arrives.

**★ Symptom: after one concurrency test fails, the next several fail with lock errors.** Cause: the failed test left a transaction open holding row locks. Fix: `ROLLBACK` in a `finally` before `release()`, swallowing errors from the rollback itself — the connection may already be aborted, and that must not mask the real failure.

**★ Symptom: the seed row is invisible to the second session.** Cause: the seed ran inside a wrapper transaction that has not committed. Fix: seed with an explicit commit, from a helper that is not routed through the DAL's injected context. `seedCommittedCard` exists as a separate helper for exactly this reason, and its name is the documentation.

**★ Symptom: both writers succeed and `version` ended at 3.** Cause: the guard was written as a read-then-check in application code rather than as a conjunct in the `UPDATE`'s `WHERE`. The check passed for both because both read before either wrote. Fix: the comparison belongs in the statement, so PostgreSQL re-evaluates it against the committed row version — that re-evaluation is the documented behaviour the whole mechanism rests on, and application code cannot reproduce it.

**★ Symptom: the test deadlocks at the gates and neither session ever proceeds.** Cause: a circular wait written by hand — A awaits a gate B opens after awaiting a gate A opens. The gates are promises, so nothing detects it and PostgreSQL's deadlock detector never sees it either, because the cycle is in your JavaScript rather than in the lock table. Fix: draw the schedule as the two-line diagram above before writing the code; every gate must be opened by a session that is not, at that moment, awaiting one the other has not opened.

**★ Symptom: the version-guard test passes even after the guard is removed.** Cause: the version was hard-coded as `1` in the update parameters, and the seed happened to produce a state where the unguarded statement gave the same visible result. Fix: read the version in the same session that will use it, and assert on `rowCount` rather than only on the final row — `rowCount` is the direct observation of the guard doing its job.

**★ Symptom: using `db.transaction()` inside a gated session produced confusing isolation behaviour.** Cause: a nested `transaction()` is a savepoint, and a callback-style API leaves no clean point to yield to the other session mid-transaction. Fix: raw `PoolClient` with literal `BEGIN` and `COMMIT` in these tests. It is more verbose and it is the only form in which the schedule is legible.

## Interview questions

**★ Why does a lost-update test need two connections rather than two sequential calls?**
Because the bug is an interleaving, not a sequence. The defect requires both writers to hold the same stale read before either commits, and a single connection has one transaction at a time, so the second read necessarily happens after the first write and is no longer stale. A sequential test therefore behaves identically with and without the version guard, which means it cannot detect the bug it was written for — the worst possible property for a test, since the team now believes the case is covered.

**★ Explain, from the documentation, why the second writer's `UPDATE` affects zero rows.**
At Read Committed, an `UPDATE` finds rows committed as of command start; if a target row is concurrently locked, the second updater waits for the first to finish. When the first commits, the manual says the second *"will attempt to apply its operation to the updated version of the row"* and that *"the search condition of the command (the `WHERE` clause) is re-evaluated to see if the updated version of the row still matches"*. Since the first writer incremented `version`, the second's `AND version = 1` no longer matches the new row version, so it affects nothing. That re-evaluation is what makes a version column work without any explicit locking, and it is a property of the database rather than of the ORM.

**★ What is the specific teardown hazard in a gated concurrency test?**
An assertion throwing inside one session while the other is awaiting a gate that will now never open. The partner hangs, the test times out with no diagnostic, and — worse — the throwing session's transaction is still open holding row locks, so subsequent tests fail on lock waits. The discipline is to open every gate before asserting anything, return results from the sessions, join with `Promise.all`, and assert afterwards; plus an unconditional `ROLLBACK` in a `finally` so a failed session cannot hold locks past its own lifetime.

**★ Why can these tests not run under the transaction-per-test harness, in one sentence each for the two reasons?**
The seed row lives in an uncommitted transaction, so the second session cannot see it at any isolation level; and the sessions must commit for real to observe each other, which the harness's `ROLLBACK` neither prevents nor cleans up, so the tests would both prove nothing and leave residue.

**★ Why use a raw `PoolClient` with literal `BEGIN` and `COMMIT` rather than the ORM's transaction API here?**
Because the gate has to be awaited between two statements of an open transaction, and a callback-style transaction API gives no clean point to hand control to another session mid-flight. There is also a correctness trap: a nested `transaction()` call becomes a savepoint rather than a transaction, so a harness that already opened one silently changes the semantics of the code under test. Raw statements make the schedule explicit, which is the whole value of the test — someone reading it should be able to see the interleaving without reconstructing it from the ORM's behaviour.

**★ The gates are promises, so what happens if you write a circular wait between two sessions?**
Nothing detects it. PostgreSQL's deadlock detector only sees cycles in its lock table, and this cycle is in JavaScript — two promises each awaiting the other's resolution — so the test simply hangs until the runner's timeout fires, typically with no useful message. That is why the schedule is worth drawing as two timelines before it is written as code: the invariant to check is that every gate is opened by a session which, at that moment, is not itself awaiting a gate the other has not yet opened.

---

← [12h · Parallel workers, one Postgres](12h-parallel-workers-against-one-postgres.md) · [Chapter 16 overview](01-explanation.md) · Next → [12ia · Invariants and blocking](12ia-invariants-blocking-and-position-races.md)
