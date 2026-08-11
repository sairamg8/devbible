---
title: "Transactions from Node"
sidebar_label: "06 · Transactions"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**, `pg` 8.23.0 / PostgreSQL 17.10 and
> `mongodb` 7.5.0 / MongoDB 8.2.12.

**A transaction lives on one connection. Every statement in it must go through
that connection, and nothing else may.** Get that wrong and you have a rollback
that rolls back nothing — silently, intermittently, in production.

## The bug that looks like working code

```js
// ✗ every one of these takes a different connection from the pool
await pool.query('BEGIN');
await pool.query('update accounts set balance_cents = balance_cents - $1 where id = $2', [5000, 1]);
await pool.query('update accounts set balance_cents = balance_cents + $1 where id = $2', [5000, 2]);
await pool.query('COMMIT');
```

The cruelty is that **it usually works in development**. `pool.query` returns its
connection to the pool immediately, and the next call takes the most recently
freed one — so on a quiet process, all four statements land together:

```console
$ node ex4b-tx-pool.mjs
-- quiet process: sequential pool.query calls reuse one connection --
  BEGIN    pid 124
  UPDATE   pid 124
  COMMIT   pid 124
```

Add a second concurrent request and they scatter. Two flows, each doing
`BEGIN` / `UPDATE` / `ROLLBACK|COMMIT` through the pool:

```console
$ node ex4c-tx-race.mjs
  A (+1):   pids 129, 129, 129
  B (-500): pids 130, 130, 129   <- different connections
```

**Flow B's `ROLLBACK` executed on flow A's connection.** B's own update sat on 130,
uncommitted; A's transaction took the rollback that was meant for someone else.
Which statement lands where depends on timing, so the damage is different every
time — that is why this reproduces once a week and never in a test.

The deterministic half of the same bug: a handler that opens a transaction through
the pool and returns without committing.

```console
$ node ex4d-leaked-tx.mjs
the pooled connection is now: [ { state: 'idle in transaction', in_xact: true } ]
visible to another connection? 0
the next request on that connection sees: { xid: '797', count: '1' }
after the pool closed: 0 rows -> the insert is gone
```

The write is invisible to everyone else, the **next request inherits the open
transaction**, and the whole thing evaporates on shutdown — while that connection
sits `idle in transaction`, holding locks and pinning the oldest snapshot, which is
the state that stops Postgres vacuuming.

## The shape that is correct

Check a connection out, do everything on it, release it in `finally`.

```js
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

```js
await withTransaction(async (tx) => {
  await tx.query('update accounts set balance_cents = balance_cents - $1 where id = $2', [2500, from]);
  await tx.query('update accounts set balance_cents = balance_cents + $1 where id = $2', [2500, to]);
});
```

```console
$ node ex4-tx.mjs
  committed: 1:7500 2:2500
  failed: card declined
  after rollback: 1:7500 2:2500
```

Write it once; never write `BEGIN` in a handler again.

## Propagating the transaction without leaking the driver

The real question is how `tx` reaches a repository three calls down without every
function growing a `pg` import.

### Style 1 — pass the executor

Repositories take a `db` that is *either* the pool or a transaction client. Both
have `.query()`, so nothing else changes.

```js
const accounts = {
  async debit(db, id, cents) {
    const {rowCount} = await db.query(
      'update accounts set balance_cents = balance_cents - $1 where id = $2 and balance_cents >= $1',
      [cents, id]);
    if (rowCount !== 1) throw new Error('insufficient funds');
  },
  credit: (db, id, cents) =>
    db.query('update accounts set balance_cents = balance_cents + $1 where id = $2', [cents, id]),
};

await accounts.debit(pool, 1, 100);                       // no transaction
await withTransaction(async (tx) => {                     // inside one
  await accounts.debit(tx, 1, 2000);
  await accounts.credit(tx, 2, 2000);
});
```

Explicit, greppable, type-checkable. The cost is a first parameter everywhere.

### Style 2 — `AsyncLocalStorage`

Keep the current transaction in async context ([Phase 2, page
20](../phase-2-async/20-asynclocalstorage.md)) and let the data layer look it up:

```js
const als = new AsyncLocalStorage();

// the executor every repository uses: the current transaction, or the pool
export const db = {query: (...args) => (als.getStore() ?? pool).query(...args)};

// the same helper as above, with the checked-out client put into async context
export const transactional = (fn) => withTransaction((client) => als.run(client, fn));
```

The repository now has no `db` argument at all — it calls `db.query()` and gets
whichever executor is in scope.

```console
$ node ex14-propagation.mjs
ALS rollback:  1:7900 2:2000
ALS commit:    1:7400 2:2500
```

Cleaner call sites, invisible coupling. The trade-off is that "am I in a
transaction?" is no longer visible at the call site, and work whose promise escapes
the `als.run` scope still runs on the transaction's client — verified. It is the
right choice when the alternative is threading `tx` through fifteen functions.

**Whichever you pick, one statement on the wrong executor undoes the whole point:**

```console
after a rollback where one statement used the pool: 1:7399 2:2601 <- account 2 kept the credit
```

## Rules Postgres will enforce on you

**A failed statement poisons the transaction.** There is no "catch it and carry
on":

```console
  first statement failed: 23514 new row for relation "accounts" violates check constraint
  next statement -> 25P02 current transaction is aborted, commands ignored until end of transaction block
```

To continue anyway, take a savepoint first:

```js
await tx.query('SAVEPOINT s1');
try {
  await tx.query('…optional work…');
} catch {
  await tx.query('ROLLBACK TO SAVEPOINT s1');    // the outer transaction survives
}
```

**A transaction holds its connection for its whole duration.** Four open
transactions in a pool of four means zero connections for anything else:

```console
  4 open transactions, max 4 -> waiting: 1
  the queued query completed after 103 ms
```

So: **no HTTP calls inside a transaction.** Charge the card *before* `BEGIN` and
record the result inside, or the payment provider's latency becomes your pool's
occupancy.

## MongoDB

Transactions require a replica set (any Atlas cluster, or `--replSet` locally) and
are explicitly opt-in per operation.

```js
const session = client.startSession();
try {
  await session.withTransaction(async () => {
    await accounts.updateOne({_id: from}, {$inc: {balance: -2500}}, {session});
    await accounts.updateOne({_id: to},   {$inc: {balance:  2500}}, {session});
  });
} finally {
  await session.endSession();
}
```

`withTransaction` also **retries** the whole callback on a transient error or a
commit that is unknown-in-doubt — so the callback must be safe to run twice.

The failure mode is the one-word omission:

```console
$ node ex4-tx.mjs
-- forgetting {session} --
  after an aborted transaction: [{"_id":1,"balance":7499}, …]
```

That `updateOne` had no `{session}`, so it ran outside the transaction, committed
on its own, and **survived the abort**. No error, no warning. It is the Mongo
equivalent of using `pool` instead of `tx`.

Keep Mongo transactions short and few — needing one often means the two documents
wanted to be one document, since the model's atomic unit is a single update.

## Gotchas

**Symptom:** A rollback did not roll anything back
**Cause:** `BEGIN` and the statements went through the pool, onto different
connections.
**Fix:** `pool.connect()` once, all statements on that client, `release()` in
`finally`.

**Symptom:** Connections stuck `idle in transaction`; vacuum stops keeping up
**Cause:** A path that returns without `COMMIT` or `ROLLBACK`.
**Fix:** The `withTransaction` helper, plus `idle_in_transaction_session_timeout`.

**Symptom:** A Mongo write persisted despite an aborted transaction
**Cause:** The operation was missing `{session}`.
**Fix:** Pass it to every operation inside the callback; review by grep.

**Symptom:** Deadlocks under concurrency (`40P01`)
**Cause:** Two transactions updating the same rows in different orders.
**Fix:** Order writes consistently, keep transactions short, and retry `40P01` —
it is safe to retry by definition.

## Interview questions

**★ Why is `pool.query('BEGIN')` wrong?**
Because the pool hands each call whatever connection is free, and a transaction is
per-connection state. Measured: with two concurrent flows, one flow's `ROLLBACK`
executed on the other flow's connection. It appears to work when the process is
idle, which is why it survives testing.

**★ How do you scope a transaction correctly in `pg`?**
`pool.connect()` to check out a client, `BEGIN`, all statements on that client,
`COMMIT` on success, `ROLLBACK` in `catch`, `release()` in `finally`. Wrap it in a
`withTransaction(fn)` helper so no handler writes `BEGIN`.

**★ How do you pass a transaction to a repository without leaking the driver?**
Either pass an executor — the repo takes a `db` that is the pool or the transaction
client, both of which have `.query()` — or hold the client in `AsyncLocalStorage`
so the data layer picks it up implicitly. The first is explicit and greppable; the
second keeps call sites clean at the cost of visibility.

**★ Why must you never make an HTTP call inside a transaction?**
The transaction pins a connection and its locks for as long as it is open, so an
upstream that takes two seconds occupies a pool slot for two seconds. Measured:
four open transactions in a `max:4` pool left the next query waiting until they
released.

**What happens after a statement fails inside a Postgres transaction?**
The transaction enters an aborted state and every subsequent statement returns
`25P02` until `ROLLBACK`. Continuing requires a `SAVEPOINT` taken beforehand.

**What does `session.withTransaction` add over commit/abort by hand in MongoDB?**
It retries the callback on transient transaction errors and on an unknown commit
outcome, which is the correct handling for both. The price is that your callback
must be idempotent, because it can run more than once.

**Why did a write survive an aborted Mongo transaction?**
Because the operation did not receive `{session}`, so it never joined the
transaction and committed independently. The driver does not warn about this.

---

← Prev: [MongoDB from Node](./05-mongodb-from-node.md) · Next → [N+1 queries](./07-n-plus-1.md)
