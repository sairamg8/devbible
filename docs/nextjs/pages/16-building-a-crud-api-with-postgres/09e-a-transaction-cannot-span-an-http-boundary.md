---
title: "You cannot hold a transaction open across a client round trip, and there are three independent reasons rather than one — the manual advises against it, the platform may freeze the function that opened it, and behind a pooler the next statement will not reach the same backend anyway"
sidebar_label: "09e · Transactions and the HTTP boundary"
sidebar_position: 66
description: "The three mechanisms that each independently forbid a request-spanning transaction, why this is the reason optimistic concurrency exists, the application-level lease that gives you what people actually want, and the idle_in_transaction timeout that limits the damage."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the PostgreSQL 18 manual — [13.3.5 Deadlocks](https://www.postgresql.org/docs/18/explicit-locking.html), [20.11. Client Connection Defaults](https://www.postgresql.org/docs/18/runtime-config-client.html) — the [node-postgres pooling documentation](https://node-postgres.com/features/pooling) — and the Next.js documentation on [Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route). Material on transaction pooling is carried from ch15 [01c](../15-databases-apis-and-full-stack-patterns/01c-transaction-pooling-and-session-state.md), verified there.
> Documentation-verified; **no sandbox run, no timings**.
> Target: **PostgreSQL 18.4** · `pg` **8.23.0** · `drizzle-orm` **0.45.2** · **Next.js 16.3.4** · Node **24.20.0**.

**Somebody on every team eventually proposes it: open a transaction when the user starts editing, hold it while they work, commit when they press save. It is a clean mental model borrowed from a desktop application with one persistent database connection, and in a serverless HTTP API it is impossible three times over. Each of the three reasons would be sufficient alone, and it is worth being able to state all three, because a colleague who has an answer to one will move to the next. The reason this page belongs in this topic is that the impossibility is not a limitation to work around — it is the premise the whole of [topic 07 · UPDATE](07-update.md) is built on. Optimistic concurrency exists precisely because the interval between a client's read and its write cannot be locked.**

## Reason 1 — the manual tells you not to, and the mechanism is unbounded waiting

> *"So long as no deadlock situation is detected, a transaction seeking either a table-level or row-level lock will wait indefinitely for conflicting locks to be released. This means it is a bad idea for applications to hold transactions open for long periods of time (e.g., while waiting for user input)."*
> — [PostgreSQL 18 · 13.3.5](https://www.postgresql.org/docs/18/explicit-locking.html)

The parenthesis names this exact design. A transaction that holds a row lock while a human decides something blocks **every** other writer of that row for the duration, and the duration is set by a person's attention span. There is no timeout on the waiting side by default — a blocked writer waits indefinitely.

There are also two costs nobody mentions when proposing it:

- **The snapshot is pinned.** At Repeatable Read or Serializable the transaction holds a snapshot from its first statement, which prevents `VACUUM` from cleaning up row versions that transaction might still need. A long-lived transaction is a bloat source, and one open for an hour is a bloat source for an hour across the whole database.
- **Rollback is the default outcome.** The user closes the tab, and nothing sends `COMMIT`. Whatever they did is discarded — which is exactly what they will not expect from a form that has been showing their edits for ten minutes.

## Reason 2 — the function that opened it may not be there when you want to close it

A Route Handler is one invocation of a serverless function. It has three exits, and only one is the one you were planning for:

1. It returns a response and the platform may **freeze** the instance. Work not tied to the response is not guaranteed to continue — the whole reason `after()` and `waitUntil` exist, argued in ch15 [04b](../15-databases-apis-and-full-stack-patterns/04b-after-and-waituntil-are-not-a-queue.md).
2. It hits the platform's maximum duration and is terminated.
3. It is reclaimed during a scale-down, a deploy, or a routine instance recycle.

**None of those runs your `COMMIT`.** And the second request — the one carrying the user's save — is a *different invocation*, quite possibly on a *different instance*, with no access to the JavaScript object holding the open transaction. There is no mechanism by which request B can obtain the `tx` handle that request A created, because they do not share a process.

⚠️ Even on a long-lived Node server this remains a bad idea for reason 1, and it acquires a new failure: the map of "open transactions by session id" is per process, so it breaks the moment you run two instances behind a load balancer. It works in development, on one machine, with one user. That is the profile of a design that ships.

## Reason 3 — behind a pooler, the next statement is not on the same backend

This is the reason that closes the door even if you solved the first two.

In transaction pooling mode, the pooler assigns a server connection **for the duration of a transaction** and returns it at `COMMIT` or `ROLLBACK`. Your client connection is not a server connection. A second request cannot resume a transaction the first one opened, because from the pooler's point of view there is nothing to resume — and if you somehow kept it open, you would have pinned one of a small number of real backends for as long as the user was thinking.

The same reasoning is why `SET`, session advisory locks, temp tables and `LISTEN` do not survive between statements behind a pooler; ch15 [01c](../15-databases-apis-and-full-stack-patterns/01c-transaction-pooling-and-session-state.md) is the full argument and every item on its list is an instance of "the session is not yours".

With `pg` directly, the same fact appears one layer down: a transaction requires a **checked-out client**, not the pool.

```ts
// ✅ correct: one transaction, one client, one request, unconditional release
const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query('UPDATE cards SET status = $2 WHERE id = $1', [cardId, 'done'])
  await client.query('COMMIT')
} catch (e) {
  await client.query('ROLLBACK')
  throw e
} finally {
  client.release()      // 🔴 without this the connection never returns to the pool
}
```

🔴 **A checked-out client that is never released is a leaked connection, and `max` of them is an outage.** Drizzle's `db.transaction` does the checkout and the release for you, which is a good reason to use it rather than hand-rolling — but only if nothing inside the callback reaches for `db` and checks out a second one ([09b](09b-the-tx-rule.md)).

## Therefore: the token, not the lock

The whole of [topic 07 · UPDATE](07-update.md) — and [07d · Optimistic concurrency with a version column](07d-optimistic-concurrency-with-a-version-column.md) in particular — is the consequence of this page.

```text
  request 1 (GET)                gap: network + human            request 2 (PATCH)
  ────────────────               ─────────────────────           ─────────────────
  BEGIN                                                          BEGIN
  SELECT card                    ← no transaction can            UPDATE … WHERE
  COMMIT                           exist here                      id = $1 AND
  → card + version 7                                               version = 7
                                                                 COMMIT
       │                                                              ▲
       └──────────── the client carries version 7 across ─────────────┘
```

The version — or the `ETag` — **is** the lock, in a form that survives being handed to a client and brought back. It costs nothing to hold, it cannot leak a connection, it does not block anyone, and it is checked atomically at write time by the `WHERE` clause ([07d](07d-optimistic-concurrency-with-a-version-column.md)). The trade is that a conflict is discovered at the end rather than prevented at the beginning, which is why 409 and 412 exist ([07e](07e-etag-if-match-and-412.md)).

## What people actually want: a lease

"Nobody else should edit this while I have it open" is a reasonable product requirement and it is not a database lock. It is an **advisory lease**, expressed in your own tables, with an expiry so it cleans itself up.

```ts
// db/schema.ts — two columns on cards
lockedBy:    uuid('locked_by').references(() => users.id),
lockedUntil: timestamp('locked_until', { withTimezone: true }),
```

```ts
// lib/dal/leases.ts
const LEASE_MS = 2 * 60_000       // deliberately short; the client renews

/** Take or renew the lease. One statement, so it is atomic without a transaction. */
export async function acquireLease(cardId: string, userId: string) {
  const [row] = await db.update(cards)
    .set({ lockedBy: userId, lockedUntil: sql`now() + interval '2 minutes'` })
    .where(and(
      eq(cards.id, cardId),
      isNull(cards.deletedAt),
      or(
        isNull(cards.lockedUntil),              // nobody holds it
        lt(cards.lockedUntil, sql`now()`),      // the holder's lease expired
        eq(cards.lockedBy, userId),             // it is already ours — renew
      ),
    ))
    .returning({ lockedBy: cards.lockedBy, lockedUntil: cards.lockedUntil })

  return row ?? null      // null = someone else holds a live lease
}

export async function releaseLease(cardId: string, userId: string) {
  await db.update(cards)
    .set({ lockedBy: null, lockedUntil: null })
    .where(and(eq(cards.id, cardId), eq(cards.lockedBy, userId)))
}
```

Four properties this has and a database lock does not:

1. **It expires on its own.** A closed tab releases it in two minutes, with no cleanup job.
2. **It survives across requests**, because it is a row, not a connection.
3. **It is one atomic statement**, so two clients racing for it cannot both win — the `WHERE` clause is the arbitration.
4. **It is renewable**, so a user who is actually working keeps it, and a user who wandered off loses it.

🔴 **A lease is advisory and must not replace the version check.** It reduces the *chance* of a conflict; it does not make one impossible, because a lease can expire mid-edit and a client can misbehave. The write still carries `WHERE version = $2`. Belt and braces, and the braces are the version.

## Limiting the damage from the ones that slip through

Some transaction, somewhere, will end up open longer than intended — a `fetch` that hangs, a bug, a slow query. Two settings bound the damage, and both belong on the role rather than in a `SET` a pooled session will not keep:

```sql
-- kill a session sitting idle inside a transaction, releasing its locks and connection
ALTER ROLE sprintdesk_app SET idle_in_transaction_session_timeout = '15s';

-- kill any single statement that runs too long
ALTER ROLE sprintdesk_app SET statement_timeout = '10s';
```

`idle_in_transaction_session_timeout` is the one that matters here, and the manual describes both of the harms this page has been arguing:

> *"Terminate any session that has been idle (that is, waiting for a client query) within an open transaction for longer than the specified amount of time. … This option can be used to ensure that idle sessions do not hold locks for an unreasonable amount of time. Even when no significant locks are held, an open transaction prevents vacuuming away recently-dead tuples that may be visible only to this transaction; so remaining idle for a long time can contribute to table bloat."*
> — [PostgreSQL 18 · 20.11](https://www.postgresql.org/docs/18/runtime-config-client.html)

*"Waiting for a client query"* inside an open transaction is precisely the state a request-spanning transaction would sit in while the user thinks. Setting it turns "a row locked indefinitely" into "a request that fails after fifteen seconds", and a failure you can see is better than a lock you cannot.

⚠️ Setting these on the role means they apply at backend start on every connection, which is what you want behind a pooler — a `SET` issued by your client is session-scoped and will not survive the connection being handed on (ch15 [01c](../15-databases-apis-and-full-stack-patterns/01c-transaction-pooling-and-session-state.md)).

## Gotchas

**★ Symptom: a design review proposes opening a transaction on `GET` and committing on `PUT`.** Cause: a mental model from a desktop application with one persistent connection. Fix: name all three reasons, because a counter-argument exists for each one alone — the manual's advice against holding transactions across user input, the serverless invocation that may be frozen before `COMMIT`, and the pooler that will not give the second request the same backend. Then offer the lease above, which is what the requirement actually was.

**★ Symptom: an in-memory map of open transactions works locally and fails in production.** Cause: the map is per process, and production runs more than one instance. Fix: nothing that must survive between two requests can live in process memory — it lives in a row. The lease columns are that row.

**★ Symptom: `too many connections` under moderate load, with most connections `idle in transaction`.** Cause: transactions being held open across something slow — usually an external call, sometimes a hand-rolled `pool.connect()` with no `finally { client.release() }`. Fix: `idle_in_transaction_session_timeout` on the role to bound it, an unconditional `release()` in a `finally`, and no network calls inside a transaction ([09f](09f-transaction-duration-as-pool-occupancy.md)).

**★ Symptom: a user's edits vanish when they close the tab, and they expected them saved.** Cause: an open transaction is rolled back when its connection dies, so "in progress" work was never durable in the first place. Fix: if drafts must survive, they are rows — a `draft` column or a `card_drafts` table written by an ordinary committed statement — not uncommitted state in a transaction.

**★ Symptom: table bloat grows and `VACUUM` cannot reclaim rows, correlated with long request times.** Cause: a long-lived transaction pins a snapshot — the manual says an open transaction *"prevents vacuuming away recently-dead tuples that may be visible only to this transaction; so remaining idle for a long time can contribute to table bloat"*. Fix: keep transactions short; `idle_in_transaction_session_timeout` on the role turns "long-lived" into "terminated".

**★ Symptom: two users both acquire the lease.** Cause: the lease was implemented as read-then-write in application code, so both read "free" before either wrote. Fix: one statement, with the availability test in the `WHERE` clause, as `acquireLease` does — the affected-row count is the arbitration and there is no window between the check and the take.

**★ Symptom: a card stays locked after its holder disappeared, and support has to clear it by hand.** Cause: the lease has no expiry, so it depends on a `releaseLease` call that a closed tab never made. Fix: `locked_until` plus a short window and a client-side renewal, so absence of a heartbeat is release. A boolean `is_locked` column has this bug built in.

**★ Symptom: leases are in place and two users still overwrite each other.** Cause: expected — a lease is advisory. It expired mid-edit, or a client wrote without taking one. Fix: keep the version check on the write. The lease is a UX improvement that reduces conflicts; the `WHERE version = $2` is the correctness mechanism.

**★ Symptom: `SET idle_in_transaction_session_timeout` had no effect.** Cause: it was issued as a session-level `SET` on a pooled connection and did not survive. Fix: `ALTER ROLE … SET`, so it is applied at backend start on every connection regardless of who borrowed it, or `SET LOCAL` inside the specific transaction you want to bound.

## Interview questions

**★ Why can a transaction not span two HTTP requests?**
Three independent reasons, any one of which is fatal. The manual advises against holding transactions open across user input because a blocked writer waits indefinitely for the lock. A serverless invocation may be frozen, terminated at its maximum duration, or reclaimed before it ever issues `COMMIT`, and the second request is a different invocation with no access to the first's transaction handle. And behind a transaction pooler the server connection is assigned for the duration of a transaction and returned at commit, so a second request will not reach the same backend even in principle. Solving one of these does not help; all three have to be false.

**★ How is this the reason optimistic concurrency exists?**
Because the interval that actually needs protecting — from the client's read to the client's write — cannot be locked, so the check has to be carried across it by something that can survive being handed to a client. A version number or an entity tag is exactly that: a lock in a form that fits in a JSON field or an HTTP header. The cost is that the conflict is discovered at write time rather than prevented at read time, which is why the API needs a 409 or a 412 and the client needs a story for it.

**★ A product manager wants "check out this card so nobody else can edit it". What do you build?**
An advisory lease in your own tables: `locked_by` and `locked_until` columns, taken by a single conditional `UPDATE` whose `WHERE` clause tests that the card is free or the existing lease has expired, renewed by a heartbeat from the open editor, and expiring by itself if the tab dies. It survives across requests because it is a row, it needs no cleanup job because it expires, and it is atomic because it is one statement. It does not replace the version check, because a lease can expire mid-edit and a client can decline to take one.

**★ What is `idle_in_transaction_session_timeout` and why is it the setting for this page?**
It terminates a session that has an open transaction and is not executing anything — exactly the state a request-spanning transaction sits in while a human thinks, and exactly the state a transaction that awaits a hanging HTTP call sits in. It converts an unbounded lock hold and a pinned connection into a failed request, which is strictly better because a failure is visible. Set it on the role rather than with a session `SET`, so it applies at backend start on every pooled connection.

**★ Why does an in-memory map of open transactions keyed by session id "work" and then fail?**
Because it works on one process, and production is not one process. The second instance has an empty map, so a save routed there finds no transaction and either errors or silently starts a new one. It also fails on the first instance recycle, deploy or scale-down. The general rule it violates is that nothing needing to survive between two requests may live in process memory — and once you accept that it must be a row, you have discovered the lease and no longer need the transaction.

**★ A long-lived transaction is bad for locking. What else does it hurt?**
Vacuum. A transaction holds a snapshot, and row versions that snapshot might still need cannot be removed, so a transaction open for an hour prevents an hour's worth of cleanup across the tables it could see. That shows up as table and index bloat, and therefore as slower scans, long after the transaction itself has gone. It also occupies a pooled connection for its whole life, which on a serverless deployment is the scarcest resource you have.

---

← [09d · Serialization failures and retries](09d-serialization-failures-and-the-retry-loop.md) · [Chapter 16 overview](01-explanation.md) · Next → [09f · Transaction duration as pool occupancy](09f-transaction-duration-as-pool-occupancy.md)
