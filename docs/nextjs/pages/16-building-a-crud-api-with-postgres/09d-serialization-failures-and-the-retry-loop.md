---
title: "A Serializable transaction with no retry loop is not safer than Read Committed, it is differently broken — the database is telling you to run the transaction again, and an application that turns that instruction into a 500 has bought the overhead of the level and none of the guarantee"
sidebar_label: "09d · Serialization failures and retries"
sidebar_position: 49
description: "SQLSTATE 40001 and 40P01 quoted from the error-code appendix, the retry loop with bounded attempts and jittered backoff written out, why the loop must wrap the whole transaction, which error classes are safe to retry and which are not, and what must never go inside."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual — [13.5. Serialization Failure Handling](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html), [13.2. Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html), [13.3.5. Deadlocks](https://www.postgresql.org/docs/18/explicit-locking.html), [Appendix A. Error Codes](https://www.postgresql.org/docs/18/errcodes-appendix.html) — and the published `drizzle-orm` **0.45.2** typings ([unpkg](https://unpkg.com/drizzle-orm@0.45.2/pg-core/session.d.ts)). SQLSTATE values and their condition names are quoted from the appendix.
> Documentation-verified; **no sandbox run, no timings, no measured retry rates**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · **Next.js 16.3.4** · Node **24.20.0**.

**When PostgreSQL aborts your transaction with `40001`, it is not reporting a fault. It is reporting that the concurrent schedule could not be made equivalent to any serial one, and that running your transaction again — against the state that now exists — will produce a correct answer. The manual states the required response in plain words: abort, and retry the whole thing from the beginning. An application that does not is not running a safer isolation level; it is running the same code with a new class of 500. This page writes the loop, says what it may and may not contain, and separates the SQLSTATE classes that are worth retrying from the ones that will never succeed no matter how many times you try.**

## The codes

From the error-code appendix, *"Class 40 — Transaction Rollback"*, quoted with the appendix's own condition names:

| SQLSTATE | Condition name | Retry? |
|---|---|---|
| `40001` | `serialization_failure` | **Yes, unconditionally** |
| `40P01` | `deadlock_detected` | **Yes** |
| `40003` | `statement_completion_unknown` | ⚠️ **Not named** in the manual's retry guidance. The condition name says the outcome is unknown, so retry only if the operation is idempotent by construction |
| `40002` | `transaction_integrity_constraint_violation` | No |
| `40000` | `transaction_rollback` | No |

The appendix gives you the discriminator for free:

> *"the first two characters of an error code denote a class of errors, while the last three characters indicate a specific condition within that class."*
> — [PostgreSQL 18 · Appendix A](https://www.postgresql.org/docs/18/errcodes-appendix.html)

**Class 40 is the retryable class.** Class 23 is a fact about your data — a unique or foreign-key violation will be violated again. Class 25 is a bug in your own transaction control. Class 08 is a connection failure and is the genuinely hard one, because the transaction may have committed before the connection dropped.

PostgreSQL devotes a whole section to this — **13.5, Serialization Failure Handling** — and it is short enough to read in full. Its first two paragraphs pin the codes:

> *"Both Repeatable Read and Serializable isolation levels can produce errors that are designed to prevent serialization anomalies. As previously stated, applications using these levels must be prepared to retry transactions that fail due to serialization errors. Such an error's message text will vary according to the precise circumstances, but it will always have the SQLSTATE code 40001 (`serialization_failure`)."*

> *"It may also be advisable to retry deadlock failures. These have the SQLSTATE code 40P01 (`deadlock_detected`)."*
> — [PostgreSQL 18 · 13.5](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html)

⚠️ **"Its message text will vary"** — match on the SQLSTATE, never on the message string.

The Serializable section says the same thing from the other direction:

> *"It is important that an environment which uses this technique have a generalized way of handling serialization failures (which always return with an SQLSTATE value of '40001')."*
> — [PostgreSQL 18 · 13.2.3](https://www.postgresql.org/docs/18/transaction-iso.html)

And the manual tells you what the retry accomplishes, which is the reason retrying is not merely hopeful:

> *"When an application receives this error message, it should abort the current transaction and retry the whole transaction from the beginning. The second time through, the transaction will see the previously-committed change as part of its initial view of the database, so there is no logical conflict in using the new version of the row as the starting point for the new transaction's update."*
> — [PostgreSQL 18 · 13.2.2](https://www.postgresql.org/docs/18/transaction-iso.html)

🔴 **"Retry the whole transaction from the beginning" is literal, and 13.5 says how literal:**

> *"It is important to retry the complete transaction, including all logic that decides which SQL to issue and/or which values to use. Therefore, PostgreSQL does not offer an automatic retry facility, since it cannot do so with any guarantee of correctness."*
> — [PostgreSQL 18 · 13.5](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html)

*"Including all logic that decides which SQL to issue"* is the sentence that determines where the loop goes: it wraps the **whole callback**, including the reads, the branching and the value computation — not just the write. Re-running only the failed statement cannot work anyway; the transaction is dead (any further command in it raises class 25, `25P02` `in_failed_sql_transaction`), and at Repeatable Read or Serializable the snapshot it was using is precisely the stale thing that caused the abort.

And the manual sets your expectations about the loop's termination, which is why `attempts` is a number you tune rather than a constant:

> *"Transaction retry does not guarantee that the retried transaction will complete; multiple retries may be needed. In cases with very high contention, it is possible that completion of a transaction may take many attempts. In cases involving a conflicting prepared transaction, it may not be possible to make progress until the prepared transaction commits or rolls back."*

Deadlocks get the same treatment, from the locking chapter:

> *"If it is not feasible to verify this in advance, then deadlocks can be handled on-the-fly by retrying transactions that abort due to deadlocks."*
> — [PostgreSQL 18 · 13.3.5](https://www.postgresql.org/docs/18/explicit-locking.html)

## The loop

```ts
// lib/db/retry.ts
import { db } from '@/db'
import type { Tx } from '@/lib/db/tx'

const RETRYABLE = new Set(['40001', '40P01'])   // serialization_failure, deadlock_detected

function sqlstate(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e
    ? String((e as { code: unknown }).code)
    : undefined
}

export class TooManyRetries extends Error {
  constructor(readonly attempts: number, readonly last: unknown) {
    super(`transaction failed after ${attempts} attempts`)
  }
}

/**
 * Runs `fn` in a transaction, retrying only on class-40 aborts.
 * 🔴 `fn` MUST be pure with respect to the outside world: it may be run several times.
 */
export async function withRetry<T>(
  fn: (tx: Tx) => Promise<T>,
  opts: { attempts?: number; isolationLevel?: 'repeatable read' | 'serializable' } = {},
): Promise<T> {
  const attempts = opts.attempts ?? 5
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await db.transaction(fn, { isolationLevel: opts.isolationLevel ?? 'serializable' })
    } catch (e) {
      const code = sqlstate(e)
      if (!code || !RETRYABLE.has(code)) throw e     // not ours — surface it unchanged
      lastError = e
      if (attempt === attempts) break

      // exponential backoff with full jitter: 2^n base, randomised across the window
      const base = Math.min(20 * 2 ** (attempt - 1), 400)
      await new Promise((r) => setTimeout(r, Math.random() * base))
    }
  }
  throw new TooManyRetries(attempts, lastError)
}
```

Five decisions in that function, each of which is wrong in at least one codebase I have read about:

**1 · The loop wraps `db.transaction`, not the body.** A retry must start a new transaction; re-running statements inside the aborted one is impossible.

**2 · Only class-40 codes are retried.** Everything else is rethrown untouched, so a unique-violation still reaches [10 · errors and one response shape](10-errors-and-one-response-shape.md) as itself and not as `TooManyRetries`.

**3 · Attempts are bounded.** An unbounded retry under sustained contention is a way to convert a hot row into an outage: every retrying request holds a pooled connection, so the loop competes for the resource it needs.

**4 · Backoff is jittered.** Without jitter, N transactions that collided will collide again on the same schedule. Full jitter — a uniform random delay in `[0, base)` — decorrelates them. The constants above are a starting point and **were not measured**; tune them against your own contention.

**5 · Exhaustion throws a distinct error.** `TooManyRetries` is a 503 with a `Retry-After`, not a 500 — the request may well succeed later, and telling the client that is more useful than a generic failure.

## Using it

```ts
// lib/dal/cards.ts — a WIP limit, which 09c says needs Serializable
import { withRetry } from '@/lib/db/retry'

export async function startCard(cardId: string, boardId: string) {
  return withRetry(async (tx) => {
    const [{ n }] = await tx.select({ n: count() }).from(cards)
      .where(and(eq(cards.boardId, boardId), eq(cards.status, 'doing'),
                 isNull(cards.deletedAt)))
    if (n >= 50) throw new WipLimitExceeded(boardId)     // not class 40 — not retried

    const [moved] = await tx.update(cards)
      .set({ status: 'doing', version: sql`${cards.version} + 1`, updatedAt: sql`now()` })
      .where(and(eq(cards.id, cardId), isNull(cards.deletedAt)))
      .returning()
    return moved ?? null
  })
}
```

Note that `WipLimitExceeded` is a domain error and passes straight through the loop, which is why the retry predicate is an allow-list of SQLSTATEs rather than a catch-all.

## 🔴 What must never go inside the retried function

The loop may run the body **several times**. Anything inside it that is not a database write against `tx` will therefore happen several times, and the transaction's rollback will not undo it.

| Inside the retried body | Verdict |
|---|---|
| Queries through `tx` | ✅ the only thing that belongs there |
| Pure computation from the rows read | ✅ |
| `fetch()` to a payment provider, an email API, a webhook | 🔴 **never** — a retried transaction charges twice |
| Writing to S3 or any object store | 🔴 never |
| `revalidateTag()` / `revalidatePath()` | 🔴 never — fires on an attempt that rolled back |
| Publishing to an external broker | 🔴 never |
| A query through `db` | 🔴 never, for [09b](09b-the-tx-rule.md)'s reasons *and* this one |
| Incrementing an in-memory counter or metric | ⚠️ it will over-count; move it outside or count attempts deliberately |
| Reading a clock or `Math.random()` | ⚠️ each attempt gets a different value — usually fine, occasionally the bug |

**The correct shape for anything with an external effect** is the one ch15 [04d](../15-databases-apis-and-full-stack-patterns/04d-postgres-as-a-queue-skip-locked.md) argues for: write the *intent* as a row inside the transaction, and let a worker perform the effect after the transaction has actually committed.

```ts
// ✅ the effect is a row, so a rolled-back attempt enqueues nothing
await withRetry(async (tx) => {
  const [moved] = await tx.update(cards).set(patch).where(pred).returning()
  await tx.insert(jobs).values({
    kind: 'card.moved.notify',
    payload: { cardId: moved.id },
    idempotencyKey: `notify:${moved.id}:${moved.version}`,
  })
  return moved
})
revalidateTag(`board:${boardId}`)   // ✅ after the transaction returned successfully
```

The `idempotencyKey` includes the version, so a retry that eventually succeeds enqueues one job for the version it actually committed — and at-least-once delivery is handled where it belongs, in ch15 [04e](../15-databases-apis-and-full-stack-patterns/04e-at-least-once-and-idempotency.md).

## When retrying is wrong

**Class 23 — integrity constraint violation.** Ordinarily never: a `23505` will violate again. But 13.5 carves out a real exception, and it is worth quoting in full because the reasoning generalises:

> *"In some cases it is also appropriate to retry unique-key failures, which have SQLSTATE code 23505 (`unique_violation`), and exclusion constraint failures, which have SQLSTATE code 23P01 (`exclusion_violation`). For example, if the application selects a new value for a primary key column after inspecting the currently stored keys, it could get a unique-key failure because another application instance selected the same new key concurrently. This is effectively a serialization failure, but the server will not detect it as such because it cannot 'see' the connection between the inserted value and the previous reads. There are also some corner cases in which the server will issue a unique-key or exclusion constraint error even though in principle it has enough information to determine that a serialization problem is the underlying cause."*
> — [PostgreSQL 18 · 13.5](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html)

That description matches one real SprintDesk operation: `insertCardBetween` in [07f](07f-pessimistic-locking-and-when-it-is-right.md) reads two neighbours and computes a value from them. It matches nothing else in this chapter.

**And the manual attaches its own warning, which is the sentence to remember:**

> *"While it's recommendable to just retry serialization_failure errors unconditionally, more care is needed when retrying these other error codes, since they might represent persistent error conditions rather than transient failures."*

🔴 **So `23505` goes on the retry list only for a specific operation that provably has that shape, never on the global list.** If you widen `RETRYABLE` to include it, a genuine duplicate — a user submitting the same board name twice — is retried five times and then reported as a retry exhaustion instead of as a duplicate.

**Class 25 — invalid transaction state.** Never. `25P02` (`in_failed_sql_transaction`) means you issued a command in a transaction that had already aborted, and a retry of the same structure does the same thing.

**Class 08 — connection exception.** The hard one. The transaction may have committed before the connection dropped, so a retry may apply it twice. Retry only if the operation is idempotent by construction — which for a versioned update it is, because the second attempt's `WHERE version = $2` will not match if the first attempt committed.

**A rising deadlock rate is a lock-ordering bug, not a retry-budget problem.** The manual's primary defence is *"being certain that all applications using a database acquire locks on multiple objects in a consistent order"*; retrying is the fallback for what ordering cannot prevent. If `40P01` is climbing, fix the ordering ([07f](07f-pessimistic-locking-and-when-it-is-right.md)) rather than raising `attempts`.

## Observability

Retries are invisible by default: a transaction that succeeds on attempt three looks identical to one that succeeded on attempt one. Count them, or you will not know contention is rising until it becomes exhaustion:

```ts
// inside the catch, before the backoff
metrics.increment('db.transaction.retry', { code, attempt: String(attempt) })
```

⚠️ That counter is a genuine exception to "no side effects in the loop" — it is deliberately outside the retried function, in the `catch`, so it counts attempts rather than being replayed by them.

## Gotchas

**★ Symptom: switching an endpoint to Serializable produced a burst of 500s under load.** Cause: serialization failures are the level's normal operating mode, and they were unhandled. Fix: `withRetry` around the whole transaction, retrying only `40001` and `40P01`. Without it the level's overhead was paid and its guarantee was not delivered.

**★ Symptom: the retry re-runs only the failing statement and every command raises class 25, `25P02` (`in_failed_sql_transaction`).** Cause: the transaction is already dead; nothing can run in it until the block ends. Fix: the loop must call `db.transaction` again, so a new transaction with a new snapshot starts — the manual's *"retry the complete transaction, including all logic that decides which SQL to issue and/or which values to use"*.

**★ Symptom: `23505` was added to the retry list and a user reporting a duplicate board name now gets a 503.** Cause: a permanent constraint violation is being treated as transient. The manual permits retrying `23505` only for the narrow case where the application chose the key after inspecting the existing ones — otherwise it warns those codes "might represent persistent error conditions rather than transient failures". Fix: keep `23505` off the global list; retry it, if at all, only inside the one operation that has that shape.

**★ Symptom: a customer was charged twice for one action.** Cause: a payment call inside the retried function, and the transaction was retried. A rollback does not un-charge anything. Fix: write the intent as a `jobs` row inside the transaction and let a worker call the provider afterwards, with a provider-side idempotency key — ch15 [04ea](../15-databases-apis-and-full-stack-patterns/04ea-external-effects-and-provider-idempotency.md).

**★ Symptom: a cache was invalidated for a change that never committed.** Cause: `revalidateTag()` inside the transaction callback. Fix: it goes after `withRetry` resolves, never inside — a rolled-back attempt must leave no trace outside the database.

**★ Symptom: a unique-violation is reported as "transaction failed after 5 attempts".** Cause: the retry predicate was a catch-all rather than an allow-list of SQLSTATEs, so a permanent error was retried to exhaustion and then rethrown as the wrong type. Fix: retry `40001` and `40P01` only, and rethrow everything else unchanged so the error envelope can classify it.

**★ Symptom: under contention the pool exhausts and latency collapses.** Cause: unbounded or unjittered retries — every retrying request holds a pooled connection while it waits, so the loop competes for the resource it needs, and unjittered retries recollide on the same schedule. Fix: bounded attempts plus full jitter, as in `withRetry`, and treat exhaustion as a 503 with `Retry-After` rather than an endless loop.

**★ Symptom: `40P01` deadlocks climb steadily as traffic grows and more retries do not help.** Cause: two code paths lock the same rows in different orders, so the collision rate scales with concurrency. Fix: order lock acquisition deterministically — sort ids before locking — which is the manual's own primary defence; the retry is the fallback, not the remedy.

**★ Symptom: a metric counting "transactions" is lower than the number of statements the database saw.** Cause: retries are invisible unless counted. Fix: increment a counter in the `catch` branch, labelled by SQLSTATE and attempt number, so rising contention is observable before it becomes exhaustion.

**★ Symptom: a retried transaction produced a different `created_at` or id than the first attempt.** Cause: the body reads a clock or generates a value per attempt. Fix: usually harmless and occasionally not — if a value must be stable across attempts, compute it *before* calling `withRetry` and close over it, so every attempt writes the same thing.

**★ Symptom: the loop is used on a read-only report and never retries.** Cause: correct — the manual says "only updating transactions might need to be retried; read-only transactions will never have serialization conflicts". Fix: nothing, but drop the loop; it is dead code that suggests to the next reader that the report is riskier than it is.

## Interview questions

**★ What does SQLSTATE `40001` mean, and what is the application obliged to do?**
It is `serialization_failure`: PostgreSQL detected that the concurrent schedule could not be made equivalent to any serial execution and aborted your transaction to break the cycle. The manual's instruction is to abort and "retry the whole transaction from the beginning", and it explains why that works — the second attempt sees the previously-committed change as part of its initial view, so there is no logical conflict left. It is an instruction, not a fault report.

**★ Why is a Serializable transaction without a retry loop not safer than Read Committed?**
Because you have paid for the monitoring and converted the anomalies into aborts without handling the aborts. At Read Committed, a conflicting schedule would have produced a wrong-but-successful result; at Serializable it produces a correct-but-failed request, which reaches the user as a 500. The guarantee the level offers is "either serializable or it will not commit", and the second half of that only becomes safety if something re-runs the transaction.

**★ Which SQLSTATEs do you retry, and how do you decide?**
`40001` and `40P01`, as an allow-list, never a catch-all — the manual names exactly those two, saying a serialization error "will always have the SQLSTATE code 40001" and that "it may also be advisable to retry deadlock failures … SQLSTATE code 40P01". Class 25 is a bug in your transaction control; class 08 is a connection failure where the transaction may already have committed, so retrying is only safe if the operation is idempotent by construction. The interesting case is class 23: the manual does permit retrying `23505` and `23P01` in the narrow situation where the application chose a key after inspecting the existing ones — "effectively a serialization failure" the server could not detect as one — while warning that in general those codes "might represent persistent error conditions rather than transient failures". So it goes on the retry list for one specific operation, never globally.

**★ Why must the retry create a new transaction rather than re-running the statement?**
Because the aborted transaction cannot execute anything — every subsequent command is rejected until the block ends. More importantly, at Repeatable Read and Serializable the transaction's snapshot is fixed for its lifetime, and that snapshot is the stale view that caused the conflict. Only a new transaction gets a new snapshot that includes the change you collided with, which is precisely why the manual says the second attempt has no logical conflict.

**★ What must never appear inside the retried function?**
Anything the database cannot roll back. An HTTP call to a payment provider or an email service, an object-store write, a `revalidateTag`, a publish to an external broker, and any query through `db` rather than `tx`. The body may run several times and the rollback only reverses rows, so an external effect inside it is a duplicate waiting to happen. The correct shape is to write the intent as a row inside the transaction and perform the effect after it commits — which is the strongest argument for a database-backed queue.

**★ Why does the backoff need jitter?**
Because the transactions that collided are, by construction, running at the same time, so a fixed or purely exponential delay makes them collide again on the same schedule — a thundering herd that converges instead of dispersing. Full jitter, a uniform random delay in the window rather than the whole window, decorrelates them. And the attempts must be bounded, because every waiting retry is holding a pooled connection, so an unbounded loop competes for exactly the resource it is waiting on.

**★ Your deadlock rate is rising with traffic. Do you raise the retry budget?**
No. Deadlocks are retryable and the manual says so, but a rate that scales with concurrency means two code paths acquire the same locks in different orders, and more retries just spend more connections on the same collision. The manual's primary defence is consistent lock ordering across every application touching the database — sorting ids before locking is usually enough — with retrying as the fallback for what ordering cannot prevent.

**★ How do you know retries are happening at all?**
Only if you count them. A transaction that succeeds on the third attempt is indistinguishable from one that succeeded immediately in every log and metric you have by default, so contention rises invisibly right up until it becomes exhaustion and users see 503s. A counter in the `catch` branch, labelled by SQLSTATE and attempt number, turns that into a gradient you can watch — and it is deliberately outside the retried body so it counts attempts rather than being replayed by them.

---

← [09c · Isolation levels](09c-isolation-levels-in-postgresql-18.md) · [Chapter 16 overview](01-explanation.md) · Next → [09e · A transaction cannot span an HTTP boundary](09e-a-transaction-cannot-span-an-http-boundary.md)
