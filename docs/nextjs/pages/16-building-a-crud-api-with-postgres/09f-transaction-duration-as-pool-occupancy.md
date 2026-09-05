---
title: "A transaction's real cost is not CPU, it is one pooled connection multiplied by its duration — which is why an HTTP call inside a transaction is the classic outage: it converts an unrelated third party's latency into your database's concurrency limit"
sidebar_label: "09f · Duration and pool occupancy"
sidebar_position: 51
description: "Why transaction duration is the resource, the anatomy of the third-party-slowdown outage, the four rules for what may sit inside a transaction, the timeouts that bound each layer, and how to shorten a transaction that genuinely has work to do."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-05 against the [node-postgres pooling documentation](https://node-postgres.com/features/pooling), the PostgreSQL 18 manual — [20.11. Client Connection Defaults](https://www.postgresql.org/docs/18/runtime-config-client.html), [13.3.5 Deadlocks](https://www.postgresql.org/docs/18/explicit-locking.html) — and ch15 [01b](../15-databases-apis-and-full-stack-patterns/01b-the-three-kinds-of-pool.md), where the connection arithmetic is derived.
> Documentation-verified; **no sandbox run, no timings, no load tests**.
> Target: **PostgreSQL 18.4** · `pg` **8.23.0** · `drizzle-orm` **0.45.2** · **Next.js 16.3.4** · Node **24.20.0**.

**A pool has `max` connections. A transaction holds exactly one for its entire life. So the number of transactions your application can run concurrently is `max`, and the number of *requests* it can serve concurrently is `max` divided by how long each transaction lasts relative to the request rate. Every millisecond a transaction is open is a millisecond that connection is unavailable to anyone else — including to the retry loop in [09d](09d-serialization-failures-and-the-retry-loop.md), which needs a connection to make progress. This is why the single worst thing you can put inside a transaction is a network call to someone else's server: you have handed a third party the ability to set your database's concurrency limit, and they will exercise it on a day you find out about from your users.**

## The arithmetic

```text
pool max                = 10 connections per instance
instances at peak       = 8
total connections       = 80        ← what Postgres sees (ch15 01b)

transaction duration    = 5 ms      → one connection serves ~200 tx/second
transaction duration    = 500 ms    → one connection serves ~2 tx/second
```

Those numbers are **illustrative arithmetic, not measurements** — the point is the shape. A hundredfold increase in transaction duration is a hundredfold decrease in the throughput of the same pool, with no change to the database's CPU, no slow query in the log, and nothing in an APM trace that says "database". The symptom is requests queuing for a connection, which surfaces as latency in the *application* and looks nothing like a database problem.

⚠️ **`pool.connect()` queues rather than failing.** With `pg`, when every client is checked out, the next `connect()` waits — so the failure presents as growing latency until `connectionTimeoutMillis` (if you set it) turns it into an error. Set it, so an exhausted pool is a visible, fast failure rather than a slow mystery:

```ts
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 3_000,   // fail fast instead of queueing forever
  idleTimeoutMillis: 30_000,
})
```

## The classic outage, step by step

```text
t+0    normal:  every request opens a tx, updates a card, calls Stripe
                inside the tx, commits.  tx duration ~120 ms.  Fine.

t+1    Stripe's p99 rises from 120 ms to 8 s. Nothing about your system
       has changed. No deploy. No traffic spike.

t+2    each transaction now holds its connection for 8 s instead of 120 ms.
       At max = 10, the instance can now run 10 concurrent requests, total.

t+3    request 11 calls pool.connect() and waits.
       Requests 12..N queue behind it.

t+4    every request is slow, including the ones that never touch Stripe —
       a board list, a health check that queries the database, the login page.

t+5    the platform scales out. New instances open new pools. Postgres hits
       max_connections. Now the database refuses connections.
       The health check fails. Everything is down.
```

🔴 **The failure propagates from an unrelated third party to your entire application, through the pool, and it accelerates when the platform scales out to help.** Nothing in that sequence is a bug in your SQL, your schema or your indexes.

## The four rules

**1 · No network call inside a transaction. None.**

```ts
// 🔴 the outage above
await db.transaction(async (tx) => {
  const [order] = await tx.insert(orders).values(input).returning()
  const charge = await stripe.charges.create({ amount, currency: 'usd' })   // 🔴
  await tx.update(orders).set({ chargeId: charge.id }).where(eq(orders.id, order.id))
})

// ✅ the transaction writes the intent; a worker performs the effect after commit
const order = await db.transaction(async (tx) => {
  const [o] = await tx.insert(orders).values({ ...input, status: 'pending' }).returning()
  await tx.insert(jobs).values({
    kind: 'charge.create',
    payload: { orderId: o.id, amount },
    idempotencyKey: `charge:${o.id}`,
  })
  return o
})
```

The second form is also *more correct*, not merely faster: a charge inside a transaction that later rolls back has still happened, so the first version can charge a customer for an order that does not exist. [09g](09g-the-one-genuine-superpower.md) is the full argument for the enqueue-in-the-same-transaction pattern.

**2 · No user-facing latency inside a transaction.** No waiting for input ([09e](09e-a-transaction-cannot-span-an-http-boundary.md)), no file upload streaming through, no `await` on anything whose duration you do not control.

**3 · Read what you need before you open it.** Anything that does not have to be inside the atomic unit should not be:

```ts
// 🔴 authorisation lookup inside the transaction — three extra round trips of occupancy
await db.transaction(async (tx) => {
  const member = await tx.select().from(teamMembers).where(/* … */)
  if (!member.length) throw new Forbidden()
  await tx.update(cards).set(patch).where(eq(cards.id, cardId))
  await tx.insert(boardEvents).values(event)
})

// ✅ authorise first, then open the transaction for the writes that must be atomic
await requireBoardAccess(boardId, userId)     // its own short query, own connection
await db.transaction(async (tx) => {
  await tx.update(cards).set(patch).where(eq(cards.id, cardId))
  await tx.insert(boardEvents).values(event)
})
```

⚠️ **There is a real trade here and it is worth naming.** Moving the check outside means it is evaluated against a slightly earlier state, so someone could lose access between the check and the write. For a membership check that is acceptable; for an invariant that must hold at write time — a WIP limit, a balance — it is not, and the check belongs inside. **The rule is not "move everything out", it is "move out everything that does not have to be atomic with the write."**

**4 · No CPU-bound work inside a transaction.** Image resizing, PDF generation, large JSON transforms, cryptographic key derivation. Node is single-threaded, so a 200 ms CPU burn is 200 ms of transaction *and* 200 ms during which the event loop cannot even process the database's response.

## Bounding each layer

Four timeouts, each guarding a different failure. All four should be set; the defaults for the first two are "never".

```sql
-- on the role, so every pooled backend gets them at start
ALTER ROLE sprintdesk_app SET statement_timeout = '10s';
ALTER ROLE sprintdesk_app SET lock_timeout = '3s';
ALTER ROLE sprintdesk_app SET idle_in_transaction_session_timeout = '15s';
```

```ts
// in the pool
new Pool({ connectionString, max: 10, connectionTimeoutMillis: 3_000 })
```

| Setting | Guards against | Default |
|---|---|---|
| `statement_timeout` | one query running away | disabled |
| `lock_timeout` | waiting forever for a row lock | disabled |
| `idle_in_transaction_session_timeout` | a transaction open with nothing running | disabled |
| `connectionTimeoutMillis` | queueing for a connection forever | unset |

The manual's own note on `lock_timeout` is worth having in mind: *"Unlike `statement_timeout`, this timeout can only occur while waiting for locks."* They are not substitutes — a query that is slow because it is scanning needs `statement_timeout`; one that is slow because it is blocked needs `lock_timeout`.

PostgreSQL 18 also offers `transaction_timeout`, which bounds the whole transaction rather than a statement or an idle period. ⚠️ The manual advises against setting it globally — *"Setting `transaction_timeout` in `postgresql.conf` is not recommended because it would affect all sessions"* — so use it per operation with `SET LOCAL` if you use it at all.

## Shortening a transaction that genuinely has work

Sometimes the work really is multi-statement. Three ways to shrink it, in order of preference:

**1 · Collapse it into one statement.** A data-modifying CTE writes two tables atomically in one round trip ([09](09-transactions-and-multi-table-writes.md)). Four `await`s become one.

**2 · Compute outside, write inside.**

```ts
// ✅ everything expensive happens before BEGIN
const neighbours = await readNeighbours(boardId, beforeId, afterId)
const newPosition = midpoint(neighbours)      // pure, no I/O

await db.transaction(async (tx) => {
  await tx.update(cards).set({ position: newPosition, version: sql`${cards.version} + 1` })
    .where(and(eq(cards.id, cardId), eq(cards.version, expectedVersion)))
  await tx.insert(boardEvents).values({ boardId, kind: 'card.moved', cardId })
})
```

⚠️ Reading outside means the read is not protected by the transaction, so the neighbours may move — which is exactly why the write carries `WHERE version = $2` and why [07f](07f-pessimistic-locking-and-when-it-is-right.md) sometimes wants the locked read *inside*. Pick deliberately: outside is cheaper, inside is stronger.

**3 · Batch, do not loop.** A loop of N single-row writes inside one transaction holds a connection for N round trips. One statement over N rows holds it for one:

```ts
// 🔴 N round trips inside one transaction
for (const c of moves) {
  await tx.update(cards).set({ position: c.position }).where(eq(cards.id, c.id))
}

// ✅ one statement, one round trip, same atomicity
await tx.execute(sql`
  UPDATE cards AS c SET position = v.position, version = c.version + 1
    FROM (VALUES ${sql.join(moves.map((m) => sql`(${m.id}::uuid, ${m.position}::float8)`),
                            sql`, `)}) AS v(id, position)
   WHERE c.id = v.id
`)
```

## Gotchas

**★ Symptom: every endpoint gets slow at once, including ones that touch no external service, and the database is idle.** Cause: pool exhaustion. Requests are queueing for a connection because something else is holding transactions open — almost always a network call inside a transaction. Fix: find the `await` that is not a database call inside a `db.transaction` callback and move it out; enqueue a job for it if it must happen.

**★ Symptom: a third party got slow and your application went down.** Cause: their latency became your transaction duration became your concurrency limit. Fix: rule 1, without exceptions — no network call inside a transaction. Even with a timeout on the third-party call, that timeout is now your transaction's floor under failure.

**★ Symptom: scaling out made the outage worse.** Cause: each new instance opens its own pool, so total connections is instances × `max`, and the database hit `max_connections`. Fix: the arithmetic in ch15 [01b](../15-databases-apis-and-full-stack-patterns/01b-the-three-kinds-of-pool.md), a pooled endpoint, and a `max` sized for peak instance count rather than for one machine.

**★ Symptom: a request hangs indefinitely with no error.** Cause: `pool.connect()` queues when every client is checked out, and there is no default connection timeout. Fix: `connectionTimeoutMillis` on the pool, so exhaustion is a fast, attributable error rather than a growing latency curve.

**★ Symptom: `pg_stat_activity` is full of `idle in transaction`.** Cause: transactions opened and then left waiting on something — a hung call, an unreleased client, a bug in an error path. Fix: `idle_in_transaction_session_timeout` on the role to bound it, plus an unconditional `client.release()` in a `finally` for any hand-rolled `pool.connect()`.

**★ Symptom: a transaction does ten single-row updates and the endpoint is slow under load.** Cause: ten round trips of connection occupancy where one would do. Fix: one statement over a `VALUES` list, as above — same atomicity, one tenth the occupancy.

**★ Symptom: moving the authorisation check outside the transaction introduced a permissions race.** Cause: the check is now evaluated against a slightly earlier state. Fix: this is the trade, and it is not always acceptable — a membership check usually is; an invariant that must hold at write time is not, and belongs inside the transaction with the write. Do not apply "move everything out" mechanically.

**★ Symptom: `statement_timeout` is set and a request still hangs for minutes.** Cause: it was blocked on a lock, not executing — the manual notes `lock_timeout` *"can only occur while waiting for locks"* and is therefore not covered by `statement_timeout` in the way people assume. Fix: set both, and `idle_in_transaction_session_timeout` for the third state.

**★ Symptom: image processing inside a transaction stalls unrelated requests on the same instance.** Cause: CPU-bound work blocks Node's single event loop, so the transaction stays open *and* nothing else on that instance progresses — including reading the database's response. Fix: do the work before the transaction, or off the request entirely via a job.

**★ Symptom: transaction durations are unknown, so nobody can say whether any of this applies.** Cause: no instrumentation. Fix: time the transaction wrapper itself, because it is the unit that matters — a histogram around `db.transaction` tells you your occupancy directly, in a way that per-query timings never will.

## Interview questions

**★ What is the actual cost of a long transaction?**
One pooled connection, held for its entire duration, unavailable to anything else. That makes transaction duration the divisor in your concurrency budget: the number of transactions per second one pool can serve is roughly `max` divided by the average duration. Because the connection is the constrained resource and the database itself may be idle, the symptom is application latency with no slow query anywhere, which is why this is diagnosed late.

**★ Why is an HTTP call inside a transaction the classic outage?**
Because it lets a third party set your database's concurrency limit. Their latency becomes your transaction duration; your transaction duration divided into `max` becomes your concurrent request capacity; and once that is exhausted, every request queues for a connection — including ones that never touch the third party, and including your health checks. Then the platform scales out to help, each new instance opens a new pool, and the database hits `max_connections`. Nothing in that chain is a bug in your code except the position of one `await`.

**★ A charge inside a transaction that later rolls back — what happened?**
The customer was charged and the order does not exist. A rollback reverses rows in your database and nothing else, so an external side effect performed inside a transaction is not covered by the atomicity you think you have. The correct shape is to write the *intent* — a job row — inside the transaction and let a worker perform the effect after the commit, which is the strongest argument for a database-backed queue.

**★ Should authorisation checks go inside or outside the transaction?**
Outside, usually, because they add round trips of connection occupancy to an atomic unit that does not need them, and the window they open — someone losing access between the check and the write — is acceptable for a membership test. Inside, when the thing being checked is an invariant that must hold at the moment of the write: a WIP limit, a balance, a quota. The rule is "move out everything that does not have to be atomic with the write", not "move everything out".

**★ Which timeouts would you set, and what does each catch?**
`statement_timeout` for a single query that runs away; `lock_timeout` for a statement blocked waiting on a row lock, which `statement_timeout` does not cover in the way people expect; `idle_in_transaction_session_timeout` for a transaction that is open with nothing running, which is the state a hung external call or a leaked client produces; and `connectionTimeoutMillis` on the pool so that waiting for a connection fails fast instead of queueing forever. All four default to disabled or unset, and all four should be set on the role rather than by a session `SET` that a pooled connection will not keep.

**★ Your transaction genuinely needs to write fifty rows. How do you keep it short?**
One statement, not fifty. A loop of single-row updates inside a transaction holds the connection for fifty round trips; the same fifty rows written by one `UPDATE … FROM (VALUES …)` holds it for one, with identical atomicity. Before that, ask whether the whole thing collapses into a single data-modifying CTE, and whether any computation in the loop can be done before `BEGIN`.

**★ How would you know if any of this is happening in your system?**
Instrument the transaction wrapper, not the individual queries. A histogram of `db.transaction` durations and a counter of connection-acquisition waits tell you your pool occupancy directly; per-query timings will look perfectly healthy the entire time the pool is saturated, because the queries are fast and the waiting happens before them.

---

← [09e · Transactions and the HTTP boundary](09e-a-transaction-cannot-span-an-http-boundary.md) · [Chapter 16 overview](01-explanation.md) · Next → [09g · The one genuine superpower](09g-the-one-genuine-superpower.md)
