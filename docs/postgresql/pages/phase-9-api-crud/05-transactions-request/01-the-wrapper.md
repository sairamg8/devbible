---
title: "The wrapper"
sidebar_label: "01 · The wrapper"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex39-tx-request.mjs`.

**`BEGIN` is a statement sent on a connection, not a method on the pool.**
Everything that goes wrong with transactions in a request comes from forgetting
that one sentence.

## The shape

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await insertOrder(client, 'ok-1');
  await insertItem(client, 'ok-1', 'sku-a');
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

Four rules, and each one is load-bearing:

1. **`connect()` before `BEGIN`.** The transaction belongs to the connection.
2. **Every statement inside uses `client`** — the executor contract from
   [the repository topic](../01-repository/01-the-executor-contract.md).
3. **`ROLLBACK` in `catch`, and rethrow.** Swallowing the error here turns a
   failed request into a silent 200.
4. **`release()` in `finally`.** It runs on both the commit and the rollback path.
   Without it the connection is gone for good — measured in
   [the executor contract](../01-repository/01-the-executor-contract.md), where
   `pool.end()` then never resolves.

Both paths, measured:

```console
$ node ex39-tx-request.mjs
=== 1. BEGIN / COMMIT / ROLLBACK on one checked-out client ===
committed
after a clean commit:              orders=1 items=1

=== 2. an error mid-request rolls both writes back ===
rolled back because: payment declined
after the rollback:                orders=0 items=0
```

The error was thrown *after* both writes, from application code that had nothing
to do with the database, and both writes disappeared. That is the entire point:
the transaction covers the request, not the statements.

## The reusable version

Writing that block in every handler is how the `finally` eventually gets missed.
Write it once:

```js
export async function withTransaction(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

```js
app.post('/orders', async (req, res) => {
  const order = await withTransaction(pool, async (tx) => {
    const o = await orders.create(tx, req.body);
    await items.createMany(tx, o.id, req.body.items);
    return o;
  });
  res.status(201).json(order);
});
```

The callback receives `tx` and every repository call inside takes it. There is now
exactly one place in the codebase that knows the `BEGIN`/`COMMIT`/`release`
sequence, and a handler physically cannot forget the `finally`.

**One refinement worth adding.** If the body throws, the `ROLLBACK` itself can
throw — typically because the connection is already broken — and that error
replaces the real one:

```js
} catch (e) {
  try { await client.query('ROLLBACK'); } catch { /* keep the original error */ }
  throw e;
}
```

Losing the original error to a rollback failure is a genuinely miserable debugging
session: the logs show a connection error and nothing about the business failure
that caused it.

## `pool.query('BEGIN')` is not a transaction

`pool.query()` checks out a connection, runs one statement, and returns it. So
`BEGIN`, the writes and `ROLLBACK` are three *separate* checkouts, and the pool
decides which connection each one gets.

```js
await pool.query('BEGIN');
await insertOrder(pool, 'poolbegin-1');
await pool.query('ROLLBACK');
```

Here is why this bug reaches production. Run it on an idle pool:

```console
=== 5. pool.query("BEGIN") — the transaction that is not one ===
sequential pids: begin-then=3153 insert-then=3153
5a sequential:                     orders=0 items=0
↑ it appears to work — an idle pool hands back the same connection each time
```

**It works.** Same backend pid, the rollback undid the insert, `orders=0`. Every
test you write against an idle pool will pass.

Now add the concurrency that production has — eight inserts in flight between the
`BEGIN` and the `ROLLBACK`:

```console
5b with 8 concurrent inserts:      orders=7 items=0
↑ ROLLBACK undid only whatever shared the ROLLBACK's connection
```

**Seven of the eight writes survived a `ROLLBACK`.** The pool handed them
different connections, each in its own implicit transaction, each autocommitted.
The `ROLLBACK` undid the one write that happened to share its connection.

No error was raised at any point. PostgreSQL logs a warning for the stray
`ROLLBACK` on connections with no open transaction, but the driver reports
success, and your handler returns 200.

The proof that these are separate sessions:

```console
=== 4. proof the two calls ran on different backends ===
pid inside the transaction : 3150
pid of the pool.query call : 3151
same backend? false
what the transaction backend looks like meanwhile: idle in transaction
```

Two different backend pids means two different sessions, two different snapshots
and two different transactions. The transaction's own backend sits in
`idle in transaction` the whole time — the state that
[Phase 11](../../phase-11-mvcc/14-idle-in-transaction.md) explains the cost of.

## Trade-off

The wrapper holds a connection for the entire request body, and connections are
the scarcest resource in the system — a default pool is 10, and PostgreSQL's
`max_connections` is 100. A handler that takes 200 ms of application time inside
its transaction occupies a connection for 200 ms, not for the few milliseconds
its queries take.

The cost is real, and the alternatives are worse. Doing without a transaction
means partial writes on failure. Making the transaction narrower — several small
transactions — means the request is no longer atomic and you have to design the
intermediate states so they are safe, which is a much larger piece of work than it
sounds.

What you *can* do cheaply is make sure the transaction contains only database
work. Validation, authorization, template rendering and every external call belong
outside it. That is the subject of
[the next chunk](02-savepoints-and-duration.md).

## Gotchas

**Symptom:** A `ROLLBACK` leaves some of the request's writes in the database
**Cause:** Statements ran through `pool.query()` rather than the transaction's
client, so they were separate autocommitted transactions.
**Fix:** Check out one client, pass it everywhere. Measured: with 8 concurrent
inserts, 7 survived the `ROLLBACK`.

**Symptom:** The transaction bug passes every test and fails in production
**Cause:** On an idle pool, consecutive `pool.query()` calls reuse the same
connection, so it behaves correctly. Measured: same pid, correct rollback.
**Fix:** Do not rely on tests to catch this; grep for `pool.query` inside
transaction bodies.

**Symptom:** The connection count climbs until the pool is exhausted
**Cause:** `release()` outside `finally`, so an error path skips it.
**Fix:** `finally`, always — or use one `withTransaction` helper.

**Symptom:** A failing request logs a connection error instead of the real cause
**Cause:** The `ROLLBACK` in the `catch` threw and replaced the original error.
**Fix:** Wrap the `ROLLBACK` in its own try/catch and rethrow the original.

**Symptom:** `WARNING: there is no transaction in progress`
**Cause:** A `COMMIT` or `ROLLBACK` on a connection with no open transaction —
usually the `pool.query('BEGIN')` bug.
**Fix:** As above. Note this is a warning, not an error: the driver reports
success.

## Interview questions

**★ Why can't you call `BEGIN` on the pool?**
Because a transaction is a property of one connection, and `pool.query()` checks
out a connection per call. `BEGIN`, the writes and `ROLLBACK` can each land on a
different backend, so the writes are separate autocommitted transactions.
Measured: with 8 concurrent inserts between the `BEGIN` and the `ROLLBACK`, 7
survived.

**★ Why does that bug survive testing?**
Because on an idle pool every call gets the same free connection, so the sequence
behaves exactly like a real transaction — measured, same backend pid and a correct
rollback. It only breaks when other work is interleaved, which is production and
not the test suite.

**★ Walk through the try/catch/finally shape and say what each part is for.**
`connect()` first, because the transaction belongs to the connection. `BEGIN`,
then the body, then `COMMIT` in the `try`. `ROLLBACK` in the `catch`, then rethrow
so the failure still reaches the caller. `release()` in the `finally`, so the
connection returns on both paths — without it the pool loses a connection per
failed request.

**★ Why should the `ROLLBACK` in the catch block have its own try/catch?**
Because if it throws — a broken connection, for instance — that error propagates
instead of the original, and the logs then describe the cleanup failure rather
than the business failure that caused it.

**What is `idle in transaction` and when does a connection enter it?**
It is a backend that has an open transaction but no query running — measured as
the state of the transaction's own backend while other work happened elsewhere.
It matters because such a connection is unusable by anyone else and holds back
`VACUUM`.

**Why not put `BEGIN`/`COMMIT` inside each repository function?**
Because then each one is its own transaction and they cannot compose: two calls
that must succeed or fail together no longer can. Transaction boundaries belong to
the layer that knows what the request means.

---

← [Topic index](README.md) · Next → [Savepoints, aborts and duration](02-savepoints-and-duration.md)
