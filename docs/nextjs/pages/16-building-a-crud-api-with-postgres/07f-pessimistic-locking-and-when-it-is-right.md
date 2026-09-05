---
title: "SELECT … FOR UPDATE is the wrong default for an HTTP API not because locking is bad but because the lock's lifetime is a database transaction and the thing you want to protect spans a human — and the narrow case where it is right is the one where nothing human happens in between"
sidebar_label: "07f · Pessimistic locking"
sidebar_position: 55
description: "What FOR UPDATE actually locks and for how long, the four costs of holding it across a request, the PostgreSQL warning about SELECT FOR UPDATE that surprises people from other databases, NOWAIT and lock_timeout, and the three cases where pessimistic locking is genuinely correct."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual — [13.3. Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html), [13.4.2. Enforcing Consistency with Explicit Blocking Locks](https://www.postgresql.org/docs/18/applevel-consistency.html), [`SELECT`, The Locking Clause](https://www.postgresql.org/docs/18/sql-select.html). Every locking rule is quoted verbatim from the manual. Drizzle's locking clause was checked against the published `drizzle-orm` **0.45.2** typings — `for(strength: LockStrength, config?: LockConfig)` with `LockStrength = 'update' | 'no key update' | 'share' | 'key share'` and `LockConfig` carrying `of`, `noWait` or `skipLocked` ([unpkg](https://unpkg.com/drizzle-orm@0.45.2/pg-core/query-builders/select.types.d.ts)).
> Documentation-verified; **no sandbox run, no timings, no benchmarks**.
> Target: **PostgreSQL 18.4** · `drizzle-orm` **0.45.2** · `pg` **8.23.0** · **Next.js 16.3.4** · Node **24.20.0**.

**Pessimistic locking gets dismissed with "it doesn't scale", which is not the reason and does not help anyone decide. The real reason is a lifetime mismatch: a row lock lives exactly as long as the transaction that took it, and the interval you actually need to protect — from the client's read to the client's write — contains a network round trip and a human. You cannot make a transaction last that long, and the three separate mechanisms that stop you are [09e](09e-a-transaction-cannot-span-an-http-boundary.md)'s subject. What is left is a lock held for a few milliseconds inside one request, which protects a read-modify-write the *server* performs — and that is a genuinely useful thing that optimistic concurrency handles clumsily. This page states what the lock does, what it costs, and the three shapes where it is the right tool.**

## What `FOR UPDATE` does, exactly

> *"`FOR UPDATE` causes the rows retrieved by the `SELECT` statement to be locked as though for update. This prevents them from being locked, modified or deleted by other transactions until the current transaction ends. That is, other transactions that attempt `UPDATE`, `DELETE`, `SELECT FOR UPDATE`, `SELECT FOR NO KEY UPDATE`, `SELECT FOR SHARE` or `SELECT FOR KEY SHARE` of these rows will be blocked until the current transaction ends; conversely, `SELECT FOR UPDATE` will wait for a concurrent transaction that has run any of those commands on the same row, and will then lock and return the updated row (or no row, if the row was deleted). Within a `REPEATABLE READ` or `SERIALIZABLE` transaction, however, an error will be thrown if a row to be locked has changed since the transaction started."*
> — [PostgreSQL 18 · 13.3.2](https://www.postgresql.org/docs/18/explicit-locking.html)

Four things are in that paragraph and all four matter:

1. **"until the current transaction ends"** — the lock's lifetime is the transaction's, not the request's, not the user's editing session's.
2. **"will then lock and return the updated row"** — under Read Committed, the waiter gets the *new* version. It does not get an error; it gets fresh data and proceeds. That is what makes the pattern work inside one request.
3. **"or no row, if the row was deleted"** — you must handle the empty result. `SELECT … FOR UPDATE` returning nothing is a normal outcome, not an anomaly.
4. **"Within a `REPEATABLE READ` or `SERIALIZABLE` transaction … an error will be thrown"** — the same statement behaves differently at a higher isolation level: instead of returning the new row it aborts with a serialization failure and you need the retry loop from [09d](09d-serialization-failures-and-the-retry-loop.md).

## The warning that catches people coming from other databases

> *"Also of note to those converting from other environments is the fact that `SELECT FOR UPDATE` does not ensure that a concurrent transaction will not update or delete a selected row. To do that in PostgreSQL you must actually update the row, even if no values need to be changed. `SELECT FOR UPDATE` temporarily blocks other transactions from acquiring the same lock or executing an `UPDATE` or `DELETE` which would affect the locked row, but once the transaction holding this lock commits or rolls back, a blocked transaction will proceed with the conflicting operation unless an actual `UPDATE` of the row was performed while the lock was held."*
> — [PostgreSQL 18 · 13.4.2](https://www.postgresql.org/docs/18/applevel-consistency.html)

🔴 **A `SELECT … FOR UPDATE` that decides not to write has protected nothing.** The queued writer wakes up and applies its stale change. If your locked read can conclude "no change needed", you must either write anyway (a touch of `version = version + 1` is enough) or accept that the other transaction proceeds on the state it read.

## The four costs of holding it across a request

Suppose you tried to hold the lock from the user's `GET` to the user's `PUT`.

**1 — The connection is occupied for the whole time.** A transaction pins one pooled client. Ten users with a card open is ten connections doing nothing, out of a `max` that ch15 [01b](../15-databases-apis-and-full-stack-patterns/01b-the-three-kinds-of-pool.md) shows is smaller than you think.

**2 — Every other writer of that row blocks, indefinitely.** The manual is direct:

> *"So long as no deadlock situation is detected, a transaction seeking either a table-level or row-level lock will wait indefinitely for conflicting locks to be released. This means it is a bad idea for applications to hold transactions open for long periods of time (e.g., while waiting for user input)."*
> — [PostgreSQL 18 · 13.3.5](https://www.postgresql.org/docs/18/explicit-locking.html)

That parenthesis — *"while waiting for user input"* — is the manual naming this exact anti-pattern.

**3 — There is nobody to release it.** The user closes the tab. The lock is held until the connection dies or a timeout fires. In a serverless deployment the invocation may be frozen or reclaimed with the transaction open, and the backend behind a pooler may never learn about it.

**4 — Behind a transaction pooler, the next statement is not on the same backend.** The pooler returns the connection at `COMMIT`; a second HTTP request cannot resume a transaction the first one opened. Chapter 15 [01c](../15-databases-apis-and-full-stack-patterns/01c-transaction-pooling-and-session-state.md) is the whole argument, and it applies to locks as much as to `SET`.

**This is why optimistic concurrency exists.** The token the client carries — a version or an entity tag — is a lock you do not have to hold.

## Where it is genuinely right

Three shapes. All three have one thing in common: **the read and the write are in the same request, milliseconds apart, with no human in between.**

### 1 · A server-side read-modify-write that SQL cannot express in one statement

Reordering a card requires reading the neighbours to compute a midpoint. That is a decision the server makes from data it just read, and it must not change underneath.

```ts
// lib/dal/cards.ts — compute a position between two neighbours, atomically
export async function insertCardBetween(boardId: string, beforeId: string, afterId: string,
                                        cardId: string) {
  return db.transaction(async (tx) => {
    const rows = await tx.select({ id: cards.id, position: cards.position })
      .from(cards)
      .where(and(inArray(cards.id, [beforeId, afterId]), eq(cards.boardId, boardId)))
      .for('update')                            // Drizzle's locking clause
    if (rows.length !== 2) return null

    const [a, b] = rows.sort((x, y) => x.position - y.position)
    const mid = (a.position + b.position) / 2

    const [moved] = await tx.update(cards)
      .set({ position: mid, version: sql`${cards.version} + 1`, updatedAt: sql`now()` })
      .where(and(eq(cards.id, cardId), eq(cards.boardId, boardId)))
      .returning()
    return moved ?? null
  })
}
```

The lock is held for two statements. Nothing waits on a network. If a concurrent mover held the neighbours, this one waits a moment and then reads their new positions — which is exactly the behaviour the manual describes.

### 2 · A queue claim, where the lock is the point

`FOR UPDATE SKIP LOCKED` is pessimistic locking used deliberately so that concurrent workers get *different* rows instead of one waiting for the other. That pattern is ch15 [04d](../15-databases-apis-and-full-stack-patterns/04d-postgres-as-a-queue-skip-locked.md) and it is not a CRUD write, but it is the clearest example of a lock earning its keep.

### 3 · An invariant across rows that a single statement cannot check

"A board may have at most 50 cards in `doing`." Counting and then inserting is a read-modify-write across many rows; a version column on one row cannot express it. Either lock the parent row so all writers to that board serialise on it, or use an exclusion/unique constraint if the invariant can be expressed as one:

```ts
// Serialise every WIP-limit check for a board on the board row itself.
await db.transaction(async (tx) => {
  await tx.select({ id: boards.id }).from(boards).where(eq(boards.id, boardId)).for('update')

  const [{ n }] = await tx.select({ n: count() }).from(cards)
    .where(and(eq(cards.boardId, boardId), eq(cards.status, 'doing'), isNull(cards.deletedAt)))
  if (n >= 50) throw new WipLimitExceeded(boardId)

  await tx.update(cards).set({ status: 'doing', version: sql`${cards.version} + 1` })
    .where(eq(cards.id, cardId))
})
```

⚠️ This makes the board row a serialisation point for every WIP check on that board. That is the cost, it is deliberate, and it is bounded because nothing in the transaction waits on anything external.

## Bounding the wait — `NOWAIT` and `lock_timeout`

Never let a request block indefinitely on a lock. There are two instruments and they answer different questions.

> *"To prevent the operation from waiting for other transactions to commit, use either the `NOWAIT` or `SKIP LOCKED` option. With `NOWAIT`, the statement reports an error, rather than waiting, if a selected row cannot be locked immediately. With `SKIP LOCKED`, any selected rows that cannot be immediately locked are skipped."*
> — [PostgreSQL 18 · `SELECT`](https://www.postgresql.org/docs/18/sql-select.html)

```ts
// (a) NOWAIT: fail instantly rather than queue. Right when a queued request is
//     worthless anyway because the client has already timed out.
await tx.select().from(cards).where(eq(cards.id, id)).for('update', { noWait: true })

// (b) lock_timeout: wait, but not forever. Transaction-local via SET LOCAL.
await db.transaction(async (tx) => {
  await tx.execute(sql`SET LOCAL lock_timeout = '2s'`)
  const rows = await tx.select().from(cards).where(eq(cards.id, id)).for('update')
  // ...
})
```

`SET LOCAL` rather than `SET` is not optional behind a pooler — a session-scoped `SET` outlives your transaction on a connection somebody else will borrow, which is the leak ch15 [01c](../15-databases-apis-and-full-stack-patterns/01c-transaction-pooling-and-session-state.md) is about.

## Optimistic or pessimistic — the decision, stated plainly

| | Optimistic (version / `If-Match`) | Pessimistic (`FOR UPDATE`) |
|---|---|---|
| Protects | the interval between a **client's** read and write | the interval between a **server's** read and write |
| Held for | nothing — no lock exists | the transaction |
| Contention cost | a 409/412 the client must handle | a wait, and a queue |
| Fails as | a visible conflict | a wait, a `lock_timeout`, or a deadlock |
| Works across an HTTP round trip | yes | **no** |
| Right when | humans edit the same row | the server computes a value from rows it just read |

**They compose.** The board-WIP example above takes a row lock *and* bumps a version: the lock serialises the server-side check, the version protects the human's edit. Choosing one does not exclude the other.

## Gotchas

**★ Symptom: an endpoint using `SELECT … FOR UPDATE` starts timing out under load while CPU is idle.** Cause: requests are queued on a row lock; each waiter also holds a pooled connection while it waits, so lock contention converts directly into pool exhaustion. Fix: bound the wait so a queued request fails fast instead of occupying a connection — `SET LOCAL lock_timeout = '2s'` inside the transaction, or `for('update', { noWait: true })` when a queued request is worthless.

**★ Symptom: a `SELECT … FOR UPDATE` "protected" a check and a concurrent transaction still applied its change.** Cause: the locked read decided nothing needed writing and committed without an `UPDATE`. The manual: *"you must actually update the row, even if no values need to be changed."* Fix: touch the row so the queued writer's re-evaluation sees a new version:

```ts
await tx.update(cards).set({ version: sql`${cards.version} + 1` }).where(eq(cards.id, id))
```

**★ Symptom: `FOR UPDATE` raises an error instead of returning the updated row.** Cause: the transaction is at Repeatable Read or Serializable, where the manual says *"an error will be thrown if a row to be locked has changed since the transaction started"*. Fix: this is correct behaviour, not a bug — either drop to Read Committed for this operation, or wrap it in the bounded retry loop of [09d](09d-serialization-failures-and-the-retry-loop.md). Silently ignoring the error is the one option that is wrong.

**★ Symptom: intermittent deadlocks between two endpoints that both move cards.** Cause: the two code paths lock the same rows in different orders. The manual: *"The best defense against deadlocks is generally to avoid them by being certain that all applications using a database acquire locks on multiple objects in a consistent order."* Fix: order the ids before locking, so every path takes them in the same sequence:

```ts
const ids = [beforeId, afterId].sort()
await tx.select().from(cards).where(inArray(cards.id, ids))
  .orderBy(cards.id).for('update')
```

**★ Symptom: a lock is held long after the request finished.** Cause: an `await` on something external — an HTTP call, an email send, a slow third-party SDK — sits between the locked read and the commit. Fix: nothing that talks to the network belongs inside a transaction; the reasoning and the pattern are [09f](09f-transaction-duration-as-pool-occupancy.md).

**★ Symptom: `SET lock_timeout` had no effect on the next request, or affected an unrelated one.** Cause: plain `SET` is session-scoped, and behind a transaction pooler the session is shared and recycled. Fix: `SET LOCAL`, inside the transaction, every time.

**★ Symptom: the locked `SELECT` returns no rows and the handler treats it as an internal error.** Cause: the manual's *"or no row, if the row was deleted"* case — a concurrent transaction deleted the row while this one waited. Fix: an empty locked read is a normal outcome and maps to 404 (or, for a soft delete, to 410 if you have decided the distinction is worth exposing — [08d](08d-status-codes-and-idempotency.md)).

**★ Symptom: a developer proposes holding the transaction open across the user's editing session "so nobody else can touch it".** Cause: a mental model borrowed from a desktop application with a persistent connection. Fix: show the manual's own sentence — *"it is a bad idea for applications to hold transactions open for long periods of time (e.g., while waiting for user input)"* — and offer the thing they actually want, which is an application-level lease: a `locked_by`/`locked_until` pair of columns that expires on its own and is enforced in the DAL, not by the database's lock manager.

**★ Symptom: locking works in development and behaves oddly in production behind Neon's pooled endpoint.** Cause: the code takes a *session*-scoped lock (`pg_advisory_lock`) rather than a transaction-scoped one, and the session is not yours. Fix: `pg_advisory_xact_lock` inside the transaction; the full argument is ch15 [01c](../15-databases-apis-and-full-stack-patterns/01c-transaction-pooling-and-session-state.md).

## Interview questions

**★ Why is `SELECT … FOR UPDATE` the wrong default for an HTTP API?**
Because the lock lives for the duration of a database transaction and the interval you want to protect — the client's read, the user thinking, the client's write — is longer than any transaction you can responsibly hold. Trying to stretch it pins a pooled connection, blocks every other writer indefinitely, leaves nobody to release the lock if the user closes the tab, and does not even survive a transaction pooler, which hands the connection to someone else at commit. Optimistic concurrency exists precisely because that interval cannot be locked.

**★ Then when is it right?**
When the read and the write are both on the server, inside one request, with nothing external in between — computing a card's new position from its neighbours, enforcing a WIP limit by counting before inserting, or claiming a job from a queue. The lock is held for a couple of statements and a couple of milliseconds, and it protects a decision the server made from data it just read, which is the one thing a client-carried version token cannot do.

**★ A `SELECT … FOR UPDATE` finds the state is already correct, so the handler commits without writing. What did the lock accomplish?**
Nothing durable. PostgreSQL's manual is explicit that `FOR UPDATE` does not prevent a concurrent transaction from updating the row once your transaction ends unless you actually updated it — the blocked writer wakes up and applies its change to whatever it read. If the point of the lock was to invalidate the other writer's assumption, you have to write something, and bumping the version column is the cheapest way to do that.

**★ What is the difference between `NOWAIT`, `SKIP LOCKED` and `lock_timeout`?**
`NOWAIT` fails the statement immediately if any selected row cannot be locked. `SKIP LOCKED` silently omits rows it cannot lock, which gives an inconsistent view and is right only for queue-like access. `lock_timeout` is a session or transaction setting that bounds how long *any* lock acquisition waits before erroring, and it is the general safety net — the one you set with `SET LOCAL` on every transaction that takes row locks in a request path, so contention degrades into a fast error instead of a pool full of waiters.

**★ How do you make deadlocks impossible rather than merely rare?**
Acquire locks in a deterministic order everywhere — sorting the ids before locking is usually enough — and take the strongest lock you will need on an object first, rather than upgrading later. PostgreSQL detects deadlocks and aborts one transaction, so a low rate is survivable with a retry, but the manual is clear that consistent ordering is the defence and retrying is the fallback. A rising deadlock rate is a lock-ordering bug, not a retry-budget problem.

**★ A product manager wants "check out this card so nobody else can edit it". How do you build that?**
Not with a database lock, because the lifetime is wrong in every respect. Build an application-level lease: `locked_by` and `locked_until` columns on the card, taken by a short conditional `UPDATE`, renewed by a heartbeat from the open editor, and expiring by itself if the tab dies. Enforcement lives in the DAL alongside the ownership predicate, so every entry point respects it. It is advisory — a lease is a coordination hint, not a guarantee — so it still sits on top of the version check rather than replacing it.

---

← [07e · ETag, If-Match and 412](07e-etag-if-match-and-412.md) · [Chapter 16 overview](01-explanation.md) · Next → [07g · Position collisions and updatedAt](07g-position-collisions-and-updatedat.md)
