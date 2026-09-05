---
title: "A retry loop has two halves that need two entirely different kinds of test — its policy is a pure function you can exercise with a fake that throws on cue, and its trigger is a read/write dependency cycle that only two Serializable transactions can create, and testing one while believing you tested the other is how a loop ships that retries the wrong SQLSTATE forever"
sidebar_label: "12j · Retry loop and idempotency"
sidebar_position: 66
description: "Unit-testing the retry policy without a database, forcing a real 40001 with a gated pair of Serializable transactions, proving the loop's body is re-executed and what that costs, the duplicate-POST race against an idempotency key, and where fake timers finally are the right tool."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 documentation — [§13.2.3 Serializable Isolation Level](https://www.postgresql.org/docs/18/transaction-iso.html), [Appendix A · Error Codes](https://www.postgresql.org/docs/18/errcodes-appendix.html) — and [RFC 9110 §9.2.2 Idempotent Methods](https://www.rfc-editor.org/rfc/rfc9110.txt), fetched as raw text from rfc-editor.org. Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · Vitest **5.0.0** · Node **24.20.0**.

**`withRetry` from [09d](09d-serialization-failures-and-the-retry-loop.md) is two things wearing one name. Its *policy* — retry `40001` and `40P01`, rethrow everything else unchanged, bound the attempts, back off with jitter, throw a distinct exhaustion error — is a pure function over a callback that throws, and it can be tested exhaustively in milliseconds with no database at all. Its *trigger* is a read/write dependency cycle that PostgreSQL detects between two concurrent Serializable transactions, and nothing short of two real sessions can produce one. Teams almost always test the first and believe they have tested the second, which leaves the most consequential line in the function — the allow-list of retryable SQLSTATEs — validated only against codes the test author typed in themselves. This page writes both, plus the duplicate-`POST` race that the idempotency key exists for, which is the same problem in a different costume: a correctness claim that only appears when two requests overlap.**

## Half one — the policy, as a pure unit test

No database, no connection, no timing. The callback is a fake that throws what you tell it to.

```ts
// test/unit/retry.test.ts
import { withRetry, TooManyRetries } from '@/lib/db/retry'

const pgError = (code: string) => Object.assign(new Error(`pg ${code}`), { code })

it('retries a serialization failure and returns the eventual value', async () => {
  let calls = 0
  const result = await withRetry(async () => {
    if (++calls < 3) throw pgError('40001')
    return 'ok'
  })
  expect(result).toBe('ok')
  expect(calls).toBe(3)
})

it('retries a deadlock', async () => {
  let calls = 0
  await withRetry(async () => { if (++calls < 2) throw pgError('40P01'); return null })
  expect(calls).toBe(2)
})

it.each(['23505', '23503', '23514', '22P02', '25P02', '08006'])(
  'rethrows %s unchanged, without retrying', async (code) => {
    let calls = 0
    const err = await withRetry(async () => { calls++; throw pgError(code) }).catch((e) => e)
    expect(err.code).toBe(code)          // 🔴 the SAME error, not TooManyRetries
    expect(calls).toBe(1)
  })

it('throws TooManyRetries after the bound, carrying the last error', async () => {
  const err = await withRetry(async () => { throw pgError('40001') }, { attempts: 3 })
    .catch((e) => e)
  expect(err).toBeInstanceOf(TooManyRetries)
  expect(err.attempts).toBe(3)
  expect(err.last.code).toBe('40001')
})
```

The `it.each` row is the one that earns its place. [09d](09d-serialization-failures-and-the-retry-loop.md) is explicit that the predicate must be an allow-list, quoting the manual's warning that other codes *"might represent persistent error conditions rather than transient failures"* — and the failure of a catch-all predicate is not a wrong answer but a *disguised* one: a unique violation retried five times and then reported as `transaction failed after 5 attempts`, which the error envelope classifies as a `503` instead of a `409`. That table of six codes is the test that stops it.

### The re-execution test, which is the one people skip

`withRetry`'s doc comment says the body may be run several times. That is a constraint on every caller, and it deserves an assertion rather than a comment.

```ts
it('runs the body once per attempt — the body must be pure', async () => {
  const sideEffects: string[] = []
  let calls = 0
  await withRetry(async () => {
    sideEffects.push('sent')            // pretend this is an email, or a Stripe charge
    if (++calls < 3) throw pgError('40001')
  })
  expect(sideEffects).toEqual(['sent', 'sent', 'sent'])   // 🔴 three times, not once
})
```

The assertion is deliberately the *undesirable* outcome. It exists to be quoted in a review: this is what happens to anything you put inside the callback that is not a database statement. Pair it with a lint rule or a code-review habit, because no test can detect the day someone moves a webhook call inside the loop.

### Backoff without asserting a duration

The loop sleeps between attempts. Asserting that it slept is asserting a timing, which [12d](12d-representation-assertions-and-what-not-to-assert.md) rules out. Inject the sleep instead:

```ts
// lib/db/retry.ts — one extra option, and the loop becomes fully testable
// pseudo-code: only the two lines that differ from 09d's implementation are shown.
export async function withRetry<T>(
  fn: (tx: Tx) => Promise<T>,
  opts: { attempts?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<T> {
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)))
  // and in the loop, `await sleep(Math.random() * base)` replaces the inline setTimeout
}
```

```ts
it('backs off with a bounded, growing window', async () => {
  const waits: number[] = []
  await withRetry(async () => { if (waits.length < 3) throw pgError('40001') },
                  { sleep: async (ms) => { waits.push(ms) } })
  expect(waits).toHaveLength(3)
  expect(waits.every((w) => w >= 0 && w <= 400)).toBe(true)   // the documented cap
})
```

Because the backoff is *full jitter* — a uniform random delay in `[0, base)` — the only stable assertions are the bound and the count. Asserting an exact sequence would require seeding the random source, which is more machinery than the property is worth.

## Half two — a real `40001`, forced

The policy tests above never touch PostgreSQL, so nothing in them confirms that `40001` is the code the server actually sends for this application's contention. That needs two Serializable transactions in a read/write dependency cycle, built with the gate helper from [12i](12i-forcing-the-interleaving.md).

The shape that produces one here is the WIP limit from [09d](09d-serialization-failures-and-the-retry-loop.md): each session **reads** the count of `doing` cards on a board and then **writes** into that same set.

```ts
// test/concurrency/serialization.test.ts
it('two concurrent WIP-limit checks produce a serialization failure', async () => {
  const board = await seedCommittedBoard()
  const [c1, c2] = await seedCommittedCards(board.id, 2)     // both 'todo'

  const bothRead = counter(2)          // the barrier from 12i's support module

  async function attempt(cardId: string) {
    return session(async (c) => {
      try {
        await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE')
        await c.query(
          "SELECT count(*) FROM cards WHERE board_id = $1 AND status = 'doing'", [board.id])
        await bothRead.arriveAndWait()                        // the rw-cycle needs overlap
        await c.query("UPDATE cards SET status = 'doing' WHERE id = $1", [cardId])
        await c.query('COMMIT')                               // 🔴 inside the try, see below
        return null
      } catch (e) {
        return e as { code?: string }
      }
    })
  }

  const errors = (await Promise.all([attempt(c1.id), attempt(c2.id)])).filter(Boolean)
  expect(errors).toHaveLength(1)
  expect(errors[0]!.code).toBe('40001')
})
```

Three things about that test.

**`BEGIN ISOLATION LEVEL SERIALIZABLE` is issued as the transaction's first statement**, because [12f](12f-the-seed-and-reset-story.md)'s quoted rule forbids setting the level after any query has run. This is also why the file cannot live under the transaction wrapper.

**`COMMIT` is inside the `try`.** ⚠️ **The isolation chapter does not state whether the abort is reported by the offending statement or by `COMMIT`** — it says only that *"detection of the conditions which could cause a serialization anomaly will trigger a serialization failure"*. Since the manual leaves it open, the test must tolerate either, and putting the commit inside the same `try` costs nothing. Do not write a test that assumes one; you would be asserting an undocumented detail.

**The assertion is on the count of failures, not on which session failed.** The manual is explicit about the unpredictability:

> *"It is important that an environment which uses this technique have a generalized way of handling serialization failures (which always return with an SQLSTATE value of '40001'), because it will be very hard to predict exactly which transactions might contribute to the read/write dependencies and need to be rolled back to prevent serialization anomalies."*
> — [PostgreSQL 18 · §13.2.3](https://www.postgresql.org/docs/18/transaction-iso.html)

⚠️ **One honest caveat about this test.** I could not confirm from the documentation that this *particular* pair of statements is guaranteed to produce a cycle rather than, say, blocking and succeeding — SSI's conflict detection is described in terms of the anomalies it prevents, not as a decision procedure you can predict statement by statement. If the test proves flaky in your schema, treat it as evidence about SSI rather than about your loop, and fall back on the two-part structure below, which does not depend on any particular pair being guaranteed to conflict.

### The two-part structure that does not depend on guessing

```
Test A (concurrency project) — the same schedule with `withRetry` REMOVED.
  Assert: at least one caller sees a `40001`.  → proves the contention is real.

Test B (concurrency project) — the same schedule WITH `withRetry`.
  Assert: both callers succeed, and the final row state is the correct one.
         → proves the loop converts the contention into a correct answer.
```

That is the only pair of tests that says something about the loop *in situ*, and neither of them asserts an attempt count — which is good, because the attempt count depends on scheduling and would flake. **Assert the outcome the retry exists to produce, never the number of retries it took.**

## The duplicate `POST`, and what RFC 9110 does and does not promise

`POST` is not idempotent, and the specification is clear about why that matters to a client:

> *"Idempotent methods are distinguished because the request can be repeated automatically if a communication failure occurs before the client is able to read the server's response. For example, if a client sends a PUT request and the underlying connection is closed before any response is received, then the client can establish a new connection and retry the idempotent request."*
> — [RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.txt)

The idempotency key ([05d](05d-idempotency-keys-for-a-retried-post.md)) buys `POST` that property by hand, and it has two failure modes that need two different tests.

**The sequential replay** — easy, and usually the only one written:

```ts
it('a replayed POST with the same key returns the original card', async () => {
  const key = randomUUID()
  const first = await postCard(board.id, { title: 'Deploy' }, { 'idempotency-key': key })
  const second = await postCard(board.id, { title: 'Deploy' }, { 'idempotency-key': key })

  expect(first.status).toBe(201)
  expect(await bodyId(second)).toBe(await bodyId(first))
  expect(await countCardsOn(board.id)).toBe(1)
})
```

**The concurrent replay** — the one the constraint actually exists for, because a retry that arrives before the first request finished is exactly the case a network timeout produces:

```ts
it('two concurrent POSTs with one key create exactly one card', async () => {
  const key = randomUUID()
  const [a, b] = await Promise.all([
    postCard(board.id, { title: 'Deploy' }, { 'idempotency-key': key }),
    postCard(board.id, { title: 'Deploy' }, { 'idempotency-key': key }),
  ])

  expect(await countCardsOn(board.id)).toBe(1)          // 🔴 the invariant that matters
  const statuses = [a.status, b.status].sort()
  expect(statuses).toEqual([201, 409])                  // per the contract chosen in 05d
})
```

🔴 **The `countCardsOn` assertion is the load-bearing one and it must come first.** Without it, a broken implementation that creates two cards and returns `201` twice fails only the status assertion, which reads as a status-code bug rather than as duplicate data. State the invariant, then the rendering.

The status pair depends on which contract [05d](05d-idempotency-keys-for-a-retried-post.md) chose — `409` for a request still in flight, or blocking until the first completes and replaying its stored response. Whichever it is, write it in the test, because the two are indistinguishable from the outside once the race has resolved.

## Where fake timers finally are the right tool

[12d](12d-representation-assertions-and-what-not-to-assert.md) rules out `vi.useFakeTimers()` for anything the database stamped. Idempotency-key **expiry** is the opposite case: [05da](05da-scoping-expiry-and-the-records-table.md) computes it in application code, so the clock being faked is the one that matters.

```ts
it('a key outside its window is treated as a fresh request', async () => {
  vi.useFakeTimers()
  try {
    const key = randomUUID()
    await postCard(board.id, { title: 'Deploy' }, { 'idempotency-key': key })
    vi.advanceTimersByTime(25 * 60 * 60 * 1000)          // past a 24-hour window
    const again = await postCard(board.id, { title: 'Deploy' }, { 'idempotency-key': key })
    expect(again.status).toBe(201)
    expect(await countCardsOn(board.id)).toBe(2)
  } finally {
    vi.useRealTimers()
  }
})
```

⚠️ **This works only if the expiry comparison happens in JavaScript.** If the record's expiry is evaluated in SQL — `WHERE expires_at > now()` — then the fake clock is invisible to it and this test asserts nothing. That is a design question worth settling deliberately: an application-side comparison is testable with fake timers, a database-side one is testable only by inserting a record with a past `expires_at`. Both are fine; a codebase that does one and tests the other is not.

## Gotchas

**★ Symptom: a unique violation surfaces as `transaction failed after 5 attempts` and a `503`.** Cause: the retry predicate is a catch-all rather than an allow-list, so a permanent error was retried to exhaustion and rethrown as the wrong type. Fix: the `it.each` table of non-retryable codes above, asserting both that the original error object comes back and that the callback ran exactly once.

**★ Symptom: a webhook fired three times for one request.** Cause: a side effect inside the `withRetry` callback, which is documented as possibly running several times. Fix: nothing inside the callback but database statements; queue side effects on a table inside the transaction and dispatch them after it commits. The re-execution test above exists to make the hazard visible rather than to permit it.

**★ Symptom: the serialization test hangs.** Cause: both sessions are waiting at the barrier because one of them already threw, or one holds a lock the other needs and neither can reach the gate. Fix: the counter-barrier must be signalled before any assertion, the sessions must roll back in a `finally`, and `lock_timeout` on the test role bounds the wait ([12h](12h-parallel-workers-against-one-postgres.md)).

**★ Symptom: the serialization test passes sometimes and both transactions commit other times.** Cause: the two sessions did not overlap — one finished before the other's read — so no dependency cycle formed. Fix: the barrier must release only when *both* have taken their read, not after a delay. If it still varies, prefer the two-part structure (with and without the loop) over asserting that a specific pair of statements must conflict; SSI's detection is described by the anomalies it prevents rather than as a predictable rule.

**★ Symptom: the retry test asserts three attempts and flakes.** Cause: attempt count is a function of contention and scheduling. Fix: assert the outcome — both callers succeeded and the final state is right — and leave attempt counts to the pure policy tests, where the callback controls exactly when it throws.

**★ Symptom: `BEGIN ISOLATION LEVEL SERIALIZABLE` fails in the test.** Cause: a statement already ran on that connection inside the transaction — a harness wrapper, or a `SET` issued on acquisition. The level cannot be changed after the first query or data-modification statement. Fix: this file gets a connection with no prior statements in its transaction, which is another reason it cannot live in the wrapped project.

**★ Symptom: the concurrent-duplicate-POST test passes with two cards created.** Cause: only the status codes were asserted, and the implementation returned `201` twice. Fix: assert the row count first. The invariant is "one card exists"; the status pair is how that invariant is reported, and asserting the reporting without the invariant inverts the priority.

**★ Symptom: the idempotency expiry test passes whether or not expiry works.** Cause: fake timers move Node's clock and the expiry is evaluated by PostgreSQL's `now()`. Fix: either move the comparison into application code, or test it by writing a record with an `expires_at` in the past and asserting the next request creates a new card. Do not fake a clock the code under test does not read.

**★ Symptom: after adding the retry loop, a test that expected a `409` now gets a `503`.** Cause: `TooManyRetries` is a distinct error mapped to `503` with a `Retry-After`, and something retryable-looking was thrown by a path that should have produced a domain conflict. Fix: assert in the boundary suite that `TooManyRetries` maps to `503` and that every other `DomainError` is unaffected — that keeps the two classifications from drifting into each other.

## Interview questions

**★ Which parts of a retry loop can be tested without a database, and which cannot?**
The policy is fully testable without one: which SQLSTATEs are retried, that non-retryable errors are rethrown as themselves rather than wrapped, the attempt bound, the distinct exhaustion error, that the body is re-executed once per attempt, and that the backoff stays within its cap when the sleep function is injected. What cannot be tested that way is the trigger — that PostgreSQL actually raises `40001` for this application's contention pattern. That needs two Serializable transactions in a read/write dependency cycle, and it is the half that validates the allow-list against reality rather than against a string the test author typed.

**★ Why should the retry test not assert how many attempts were made?**
Because the attempt count is a function of contention and scheduling, both of which vary between a laptop and a CI runner. Asserting it produces a test that flakes without indicating any defect. The property worth asserting is the one the loop exists to deliver: given a schedule that reliably produces a serialization failure, the caller with the loop succeeds and leaves the correct final state, while the same schedule without the loop surfaces a `40001`. That pair says the loop works; the attempt count says only how busy the machine was.

**★ Why must the `COMMIT` be inside the `try` in a serialization test?**
Because the documentation does not say whether the abort is reported by the statement that created the conflict or by the commit. The isolation chapter says only that detecting the conditions which could cause an anomaly triggers a serialization failure. A test that catches only around the statements would miss a commit-time abort and report a pass; a test that catches around both is correct under either behaviour and does not assert an undocumented detail.

**★ What does testing the retry loop's body for purity actually assert, and why is a comment insufficient?**
It asserts that the callback runs once per attempt, by counting side effects — so a body containing an email, a payment or a queue publish produces that effect once per attempt rather than once per request. A comment is insufficient because the failure is invisible in every normal run: attempts are one under no contention, so a side effect inside the loop behaves perfectly until the day production gets busy, at which point customers receive duplicates. Making the multiplication explicit in a test gives reviewers something concrete to point at.

**★ Why is the concurrent duplicate-`POST` test more important than the sequential replay test?**
Because the sequential case is the one a correct-looking implementation handles by accident: the first request has finished, its record is committed, and a simple lookup finds it. The case the unique constraint actually exists for is a retry that arrives while the first request is still in flight — which is precisely what a client timeout produces, since the client retries because it did not get a response, not because the server finished. That race is where a lookup-then-insert implementation creates two rows, and only two overlapping requests expose it.

**★ When are fake timers the right tool in a database-backed suite?**
Only when the clock being faked is the one the code under test reads. Idempotency-key expiry computed in application code qualifies: advancing Node's timers moves the value the comparison uses. A `created_at` default, an `updated_at`, or an expiry evaluated as `WHERE expires_at > now()` do not, because those are stamped or compared by PostgreSQL and are completely unaffected by the test process's clock. The diagnostic question is simply: which process performs the comparison?

---

← [12ia · Invariants and blocking](12ia-invariants-blocking-and-position-races.md) · [Chapter 16 overview](01-explanation.md) · Next → [12k · Migrations in the test path](12k-migrations-in-the-test-path.md)
