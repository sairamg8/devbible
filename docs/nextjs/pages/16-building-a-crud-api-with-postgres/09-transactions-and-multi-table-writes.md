---
title: "Most of what people wrap in a transaction does not need one, and the writes that genuinely do are the ones where two tables have to agree — so the useful question is never 'should this be transactional' but 'which invariant would be violated if the process died between these two statements'"
sidebar_label: "09 · Transactions — what needs one"
sidebar_position: 46
description: "Why a single statement is already atomic, the test that identifies a real transaction boundary, the four multi-table writes in SprintDesk that need one and the three that do not, Drizzle's db.transaction, and what a rollback does and does not undo."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual — [3.4. Transactions](https://www.postgresql.org/docs/18/tutorial-transactions.html), [13.2. Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html) — and the published `drizzle-orm` **0.45.2** typings for `PgTransaction` and `PgTransactionConfig` ([unpkg](https://unpkg.com/drizzle-orm@0.45.2/pg-core/session.d.ts)).
> Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · **Next.js 16.3.4** · Node **24.20.0**.

**Wrapping every handler in `db.transaction` is a habit, not a design, and it costs you something real: a transaction occupies a pooled connection for its whole life, and on a serverless deployment pooled connections are the scarcest thing you have. A single `UPDATE` is already atomic — PostgreSQL gives it all-or-nothing semantics whether or not you said `BEGIN` — so wrapping it buys nothing and pays the overhead of two extra round trips. What a transaction actually buys is that two or more statements become one fact: either both the card moved and the event was recorded, or neither. This page is about identifying that boundary honestly, because the writes that need one are fewer than people think and more important than people notice.**

## A single statement is already a transaction

PostgreSQL's own introduction says it plainly:

> *"PostgreSQL actually treats every SQL statement as being executed within a transaction. If you do not issue a `BEGIN` command, then each individual statement has an implicit `BEGIN` and (if successful) `COMMIT` wrapped around it. A group of statements surrounded by `BEGIN` and `COMMIT` is sometimes called a transaction block."*
> — [PostgreSQL 18 · 3.4](https://www.postgresql.org/docs/18/tutorial-transactions.html)

Which means all of these are atomic without you doing anything:

```sql
-- one row, all-or-nothing
UPDATE cards SET status = 'done', version = version + 1 WHERE id = $1 AND version = $2;

-- many rows, still all-or-nothing: either every matching row shifts or none does
UPDATE cards SET position = position + 1024 WHERE board_id = $1 AND position >= $2;

-- an insert with a computed value read in the same statement
INSERT INTO cards (board_id, title, position)
SELECT $1, $2, coalesce(max(position), 0) + 1024 FROM cards WHERE board_id = $1;

-- two tables in one statement, via a data-modifying CTE — still one statement
WITH moved AS (
  UPDATE cards SET board_id = $2, version = version + 1
   WHERE id = $1 AND version = $3
  RETURNING id, board_id
)
INSERT INTO board_events (board_id, kind, card_id)
SELECT board_id, 'card.moved', id FROM moved;
```

🔴 **That last one is worth staring at.** A data-modifying CTE writes to two tables in a single statement, so it is atomic with no transaction block and no extra round trips. When a "multi-table write" can be expressed this way, it usually should be — the atomicity is free and the connection is held for one statement instead of four.

⚠️ **The catch with CTEs:** all sub-statements of one statement see the same snapshot, so the `INSERT` cannot see the `UPDATE`'s effect except through `RETURNING`. That is exactly the shape above, and it is why the pattern works for "write A, then record that A happened" and not for "write A, then read A back and branch on it".

## The test for a real transaction boundary

Ask one question about every pair of adjacent writes:

> **If the process died between these two statements, would the database be in a state that violates something a reader is entitled to assume?**

If yes, they belong in one transaction. If no, they do not. Applied to SprintDesk:

| Operation | Needs a transaction? | Why |
|---|---|---|
| Patch a card's title | **No** | One statement, already atomic |
| Shift every card's position after an insert | **No** | One statement over many rows |
| Move a card **and** record a `board_events` row | **Yes** | A stream consumer that missed the event has a permanently stale board |
| Move a card **and** enqueue a digest job | **Yes** | The whole argument for a database-backed queue — [09g](09g-the-one-genuine-superpower.md) |
| Soft-delete a card **and** its comments | **Yes** | A half-deleted card shows comments on nothing — [08c](08c-cascades-and-referential-integrity.md) |
| Restore a card **and** its comments | **Yes** | Same, in reverse — [08e](08e-restoring-a-soft-deleted-row.md) |
| Create a board **and** its default columns | **Yes** | A board with no columns is not a board any UI can render |
| Log an audit row after a successful write | **Usually yes** | A write with no audit row is a gap in the trail; an audit row with no write is a lie |
| Write a card **and** send an email | **No — and never** | An email is not rollback-able, and an HTTP call inside a transaction is [09f](09f-transaction-duration-as-pool-occupancy.md)'s classic outage |
| Read a card, then read its board | **No** | Two reads with no invariant between them. If they must be consistent, that is an isolation question, not a transaction-boundary one |

**The pattern in the "yes" rows: a second table records that something happened in the first.** Events, jobs, audit rows, child rows. The invariant is always "these two agree", and the failure is always silent — an event that never fired, a job that never ran, an audit trail with a hole in it.

## `db.transaction` in Drizzle 0.45.2

```ts
// lib/dal/cards.ts
import { db } from '@/db'
import { cards, boardEvents } from '@/db/schema'

export async function moveCard(cardId: string, toBoardId: string,
                               position: number, expectedVersion: number) {
  return db.transaction(async (tx) => {
    const [moved] = await tx.update(cards)
      .set({ boardId: toBoardId, position,
             version: sql`${cards.version} + 1`, updatedAt: sql`now()` })
      .where(and(eq(cards.id, cardId), eq(cards.version, expectedVersion),
                 isNull(cards.deletedAt)))
      .returning()
    if (!moved) return null            // conflict or gone — 07d disambiguates

    await tx.insert(boardEvents).values({
      boardId: toBoardId, kind: 'card.moved', cardId,
    })

    return moved
  })
}
```

Three mechanics that are worth knowing precisely, all checked against the 0.45.2 typings:

**1 · The callback's return value is the transaction's return value.** `PgSession.transaction<T>` is declared as returning `Promise<T>`, so `moveCard` above resolves to the moved row. There is no separate "get the result out" step.

**2 · A thrown error rolls back.** Returning `null` from the callback, as the guard above does, **commits** — an early `return` is not a rollback. If the guard should abort the whole transaction, it must throw, or call `tx.rollback()`, which is declared as returning `never`:

```ts
if (!moved) tx.rollback()          // throws; nothing after this runs
```

**3 · Nested `tx.transaction()` is a savepoint, not a new transaction.** Drizzle's `PgTransaction` carries a `nestedIndex` and exposes `transaction()` itself. An inner failure rolls back to the savepoint; the outer transaction can continue. That is occasionally useful and is usually a sign that the inner operation wanted to be its own transaction.

🔴 **The rule that matters more than all three is [09b](09b-the-tx-rule.md)'s: every query inside the callback must use `tx`, never `db`.** A stray `db` call runs on a different connection, outside the transaction, commits independently, and survives the rollback. It is the most common transaction bug in this codebase shape and it produces no error at all.

## What a rollback does not undo

A rollback is a database operation. It reverses rows. It reverses nothing else:

| Thing | Rolled back? |
|---|---|
| `INSERT`, `UPDATE`, `DELETE` on tables | **Yes** |
| A row inserted through `tx` in a nested savepoint | Yes, to the savepoint |
| A sequence value consumed by `serial`/`bigserial` | **No** — the manual warns changes to a sequence *"are immediately visible to all other transactions and are not rolled back if the transaction that made the changes aborts"* |
| An email, a webhook, a Stripe charge, an S3 upload | **No** |
| A `revalidateTag()` call | **No** |
| A message published to an external broker | **No** |
| A row written through `db` instead of `tx` | **No** — this is [09b](09b-the-tx-rule.md) |
| An in-memory cache you populated | **No** |

**The practical rule that falls out: nothing with an external effect goes inside a transaction.** Not because it is slow — though it is, and [09f](09f-transaction-duration-as-pool-occupancy.md) is about that — but because the transaction's guarantee does not extend to it, so putting it inside creates the illusion of atomicity without the substance. The one thing that does compose is writing the *intent* to a table inside the transaction and performing the effect afterwards, which is [09g](09g-the-one-genuine-superpower.md).

## Where the boundary belongs in the code

**In the Data Access Layer, at the operation.** Not in the Route Handler, and not in the individual query functions.

```ts
// ✅ the operation owns its transaction
export async function moveCard(...) { return db.transaction(async (tx) => { /* … */ }) }

// 🔴 the handler owns it — now every entry point must remember, and a Server
//    Action that calls the same DAL function opens a second one by accident
export async function POST(req: Request) {
  return db.transaction(async (tx) => { await moveCardImpl(tx, ...) })
}
```

If two DAL operations must compose into one transaction, the honest form is a function that takes a `tx` and a thin wrapper that supplies one:

```ts
// lib/db/tx.ts — the one type alias the whole DAL shares
import { db } from '@/db'
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// lib/dal/cards.ts
/** Composable: runs in whatever transaction the caller already has. */
export async function moveCardIn(
  tx: Tx, cardId: string, toBoardId: string, position: number, expectedVersion: number,
) {
  /* … the body from moveCard above, using tx throughout … */
}

/** Standalone: opens its own transaction and delegates. */
export function moveCard(
  cardId: string, toBoardId: string, position: number, expectedVersion: number,
) {
  return db.transaction((tx) => moveCardIn(tx, cardId, toBoardId, position, expectedVersion))
}
```

That `Tx` type alias is the same one [09b](09b-the-tx-rule.md) uses to make the "always use `tx`" rule enforceable by the compiler rather than by memory.

## Gotchas

**★ Symptom: every endpoint is wrapped in `db.transaction` and the pool exhausts under moderate load.** Cause: a transaction pins one pooled client for its whole life, including the round trips for `BEGIN` and `COMMIT` that a single-statement write did not need. Fix: wrap only operations that write more than one fact. A single `UPDATE` is already atomic; a two-table write is often expressible as one data-modifying CTE.

**★ Symptom: a transaction "rolled back" and half the work is still there.** Cause: one of the queries inside the callback used `db` instead of `tx`, so it ran on a different connection and committed on its own. Fix: [09b](09b-the-tx-rule.md), in full — this is the single most common transaction bug in a Drizzle codebase and it produces no error.

**★ Symptom: an early `return` inside the callback was expected to abort and the write committed.** Cause: returning is not rolling back; only a throw or `tx.rollback()` aborts. Fix: decide deliberately, and make it visible:

```ts
if (!moved) tx.rollback()     // declared `(): never` — it throws
```

**★ Symptom: `id` values in a table have gaps after failed requests.** Cause: sequences are non-transactional, and the manual says so — a consumed `serial` value is not returned on rollback. Fix: nothing, and do not try. Gaps in a surrogate key are normal; if a *user-visible* number must be gapless (an invoice number), it needs its own allocation table and a row lock, not a sequence.

**★ Symptom: an email was sent for a write that was rolled back.** Cause: the send was inside the transaction callback, and a rollback cannot un-send it. Fix: write the intent inside the transaction and perform the effect after it commits — a `jobs` row claimed by a worker, which is [09g](09g-the-one-genuine-superpower.md) and the reason a database-backed queue exists.

**★ Symptom: two DAL functions each open a transaction and the caller wanted one.** Cause: the boundary was put inside each query function rather than at the operation. Fix: split each into a `…In(tx, …)` form that composes and a thin standalone wrapper that opens the transaction. Nesting instead gives you a savepoint, which is not the same guarantee.

**★ Symptom: a read-only handler is wrapped in a transaction "for consistency" and nothing changes.** Cause: at Read Committed, each statement takes its own snapshot whether or not there is a transaction block, so wrapping two reads changes nothing. Fix: if the two reads genuinely must see the same snapshot, that is an isolation-level decision — a `repeatable read` transaction — not a transaction-block decision. [09c](09c-isolation-levels-in-postgresql-18.md) is where that is argued.

**★ Symptom: a data-modifying CTE writes to two tables and the second cannot see the first's rows.** Cause: correct behaviour — all parts of one statement see the same snapshot, so the second sub-statement cannot observe the first's effect except through `RETURNING`. Fix: pass the values through `RETURNING`, as the `WITH moved AS (…)` example does. If the second write must *branch* on the first's result, it is not one statement and it needs a real transaction.

**★ Symptom: an audit row exists for a write that did not happen.** Cause: the audit insert was outside the transaction, or committed on a separate connection. Fix: the audit row is written with `tx`, inside the same transaction as the write it records — that is the entire reason the audit trail is trustworthy.

## Interview questions

**★ Does a single `UPDATE` need a transaction?**
No. PostgreSQL treats every statement as being inside a transaction already — the manual says an individual statement has "an implicit `BEGIN` and (if successful) `COMMIT` wrapped around it" — so a single statement is atomic whatever you do. Wrapping it in an explicit block adds two round trips and holds a pooled connection across all three, which on a serverless deployment is the resource you are shortest of.

**★ What is the test for whether two writes belong in one transaction?**
Whether a reader would be entitled to assume something that becomes false if the process dies between them. A card moved with no event row means a stream consumer's board is permanently stale; a card deleted with its comments left live means the UI shows comments on nothing. Those are invariants, so those pairs are transactions. Two writes that merely happen to be adjacent — a card update and a "last seen" timestamp on the user — are not.

**★ What does a rollback not undo?**
Anything that is not a row in this database. Sequence values are explicitly non-transactional and are not returned. Emails, webhooks, payment charges and object-store uploads are gone. `revalidateTag` has already fired. And a query issued through `db` rather than `tx` inside the callback ran on a different connection and committed independently. The last one is the dangerous entry, because it looks like it is inside the transaction.

**★ How do you make a two-table write atomic without opening a transaction block?**
A data-modifying CTE. `WITH moved AS (UPDATE cards … RETURNING …) INSERT INTO board_events SELECT … FROM moved` is one statement, therefore atomic, and holds the connection for a single round trip. The limitation is that all parts of the statement see the same snapshot, so the second write cannot observe the first except through `RETURNING`, and it cannot branch on the result — the moment you need a conditional, you need a real transaction.

**★ Where should the transaction boundary live in the code, and why not in the Route Handler?**
At the operation, in the Data Access Layer. Putting it in the handler means every entry point has to remember to open one, and a Server Action calling the same underlying function either forgets or opens a second one. Putting it inside each individual query function means two operations that must compose cannot. The shape that works is a `…In(tx, …)` function that runs in whatever transaction it is given, plus a thin wrapper that supplies one for standalone callers.

**★ You return early from the transaction callback because a precondition failed. What happens?**
It commits everything written so far, because returning is not rolling back. If the intent was to abort, the code has to throw or call `tx.rollback()` — which Drizzle declares as returning `never`, so the type system will at least tell you nothing after it runs. This is a bug that reads correctly, passes review, and only shows up as a partially applied operation in production.

**★ Why is nesting `tx.transaction()` not the same as two transactions?**
Because it is a savepoint. An inner failure rolls back to the savepoint and the outer transaction carries on and can still commit; a genuine second transaction would commit or roll back independently of the first. That makes nesting useful for "attempt this part, tolerate its failure" and wrong for "these two things must succeed or fail separately" — and when you find yourself wanting the latter, the inner operation should be its own transaction outside the outer one.

---

← [08e · Restoring a soft-deleted row](08e-restoring-a-soft-deleted-row.md) · [Chapter 16 overview](01-explanation.md) · Next → [09b · The tx rule](09b-the-tx-rule.md)
