---
title: "BEGIN, COMMIT, ROLLBACK from Node"
sidebar_label: "02 · BEGIN COMMIT ROLLBACK"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex27-tx-basics.mjs`.

**PostgreSQL is autocommit: every statement you do not wrap is its own transaction.
Wrapping requires a single connection held for the whole transaction — `pool.query()`
gives you a different connection per call, so `BEGIN` sent to a pool is a bug that
passes its own tests.**

## Autocommit, demonstrated

```console
$ node ex27-tx-basics.mjs
=== 4. autocommit, and why BEGIN must go to a client not a pool ===
isolation default: read committed
two pool.query calls -> xid 44097 and 44098 (different transactions)
```

Two `pool.query()` calls, two transaction ids. There is no implicit transaction
spanning them and no way to roll the first one back once it has returned.

## The `pool.query('BEGIN')` bug

This is the one that survives code review, because with an idle pool it works:

```console
serial BEGIN/UPDATE/ROLLBACK via pool.query, ann balance: 100 <- rolled back, by luck
```

Three sequential `pool.query()` calls on an otherwise idle pool all land on the same
connection, so the rollback appears to work. Now run the identical code with one other
query in flight:

```console
BEGIN on backend 1055 · UPDATE on backend 1056 · ROLLBACK on backend 1056
  ann balance after the "rollback": 0 <- the UPDATE ran on another connection and autocommitted
```

**The balance is 0.** The `UPDATE` went to a different backend, where it was its own
autocommitted transaction, and the `ROLLBACK` rolled back a transaction that never
contained it. Worse, backend 1055 is now sitting in an open transaction nobody will
ever close — see [Idle in transaction](14-idle-in-transaction.md) for what that costs.

The failure is load-dependent, which is why it reaches production: it passes every
test that runs against a quiet pool.

```js
// WRONG — three statements, three possible connections
await pool.query('BEGIN');
await pool.query('UPDATE t_acct SET balance = 0 WHERE id = $1', [1]);
await pool.query('ROLLBACK');

// RIGHT — one connection, held for the whole transaction
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('UPDATE t_acct SET balance = 0 WHERE id = $1', [1]);
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK').catch(() => {});
  throw e;
} finally {
  client.release();
}
```

## The helper worth having

Write it once and never think about it again:

```js
export async function withTransaction(pool, fn, {isolation} = {}) {
  const client = await pool.connect();
  try {
    await client.query(isolation ? `BEGIN ISOLATION LEVEL ${isolation}` : 'BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
```

Two details that are not decoration:

- **`ROLLBACK` is wrapped in `.catch()`.** If the connection died, rollback throws, and
  an unwrapped cleanup would replace the real error with a confusing one.
- **`release()` is in `finally`.** A transaction that throws still has to return its
  connection, or the pool leaks one slot per failure until it is empty.

The isolation level is passed to `BEGIN` rather than `SET` afterwards, because setting
it late is an error:

```console
SET ISOLATION after the first query → 25001 SET TRANSACTION ISOLATION LEVEL must be called before any query
```

## An error inside the transaction poisons it

```console
=== 5. one error aborts the transaction — 25P02 until you roll back ===
the failing statement → 22012 division by zero
a perfectly valid SELECT after it → 25P02 current transaction is aborted, commands ignored until end of transaction block
COMMIT on an aborted transaction returns: ROLLBACK | ann balance: 100
```

**Catching an error inside a transaction and carrying on does not work.** Every
following statement returns `25P02`, and the eventual `COMMIT` is executed as a
rollback while reporting success at the protocol level. If you need to continue after a
failed statement, that is exactly what [savepoints](09-savepoints.md) are for.

## Stray BEGIN and ROLLBACK are warnings, not errors

```console
=== 6. nested BEGIN and stray ROLLBACK are warnings ===
  NOTICE/WARNING: WARNING 25001 there is already a transaction in progress
  NOTICE/WARNING: WARNING 25P01 there is no transaction in progress
```

`BEGIN` inside a transaction does **not** nest and does **not** fail — it warns and is
ignored, so the outer transaction continues and your inner "transaction" has no
boundary of its own. `ROLLBACK` with nothing open warns too. Both surface in `pg` only
if you listen:

```js
client.on('notice', (n) => log.warn({code: n.code, msg: n.message}, 'pg notice'));
```

Without that listener a double-`BEGIN` bug is completely silent. Nesting is done with
[savepoints](09-savepoints.md), which is what ORMs translate nested transactions into.

## Trade-off

**A transaction holds a connection for its entire duration.** With `max: 10`, ten
concurrent transactions is your ceiling, and everything else queues — so the cost of
wrapping work in a transaction is measured in connection-seconds, not CPU. Do not
open the transaction before you need it: fetch what you can outside, do any HTTP call
outside, then open, write, and commit. A transaction that stays open across an external
API call is the classic way to exhaust a pool and stall
[VACUUM](12-long-transactions.md) at the same time.

## Gotchas

**Symptom:** A rollback silently fails to undo anything, only under load
**Cause:** `BEGIN` was sent via `pool.query()`, so the statements were spread across connections
**Fix:** `pool.connect()`, one client for the whole transaction, `release()` in `finally`

**Symptom:** Pool exhausted after a burst of errors
**Cause:** A throwing transaction path that never reaches `release()`
**Fix:** `finally { client.release(); }` — always

**Symptom:** `25P02` on statements that are obviously valid
**Cause:** An earlier statement in the same transaction failed
**Fix:** Roll back, or use a savepoint around the statement that may fail

**Symptom:** A nested `BEGIN` silently does nothing
**Cause:** PostgreSQL warns (`25001`) instead of erroring, and `pg` does not print warnings
**Fix:** Attach `client.on('notice', …)`; use `SAVEPOINT` for nesting

**Symptom:** `SET TRANSACTION ISOLATION LEVEL` fails with `25001`
**Cause:** It was issued after the transaction's first query
**Fix:** Put the level on the `BEGIN` itself

## Interview questions

**★ Why must `BEGIN` go to a client rather than a pool?**
A pool hands out a possibly different connection per query, and a transaction is a
property of one connection. Measured: under load `BEGIN`, `UPDATE` and `ROLLBACK` ran on
backends 1055, 1056 and 1056 — the update autocommitted and survived the "rollback".

**★ Why does the pool version pass tests?**
With an idle pool all three statements get the same connection, so it behaves
correctly. The bug only appears when another query is in flight, which usually means
production.

**★ What happens to a statement issued after an error inside a transaction?**
It fails with `25P02` regardless of validity. The transaction accepts nothing but
`ROLLBACK` (or a rollback to a savepoint taken before the failure).

**★ Does `BEGIN` inside an open transaction nest?**
No. It emits `WARNING 25001` and is ignored, so there is no inner boundary. Use
`SAVEPOINT` for that.

**Where do you put `release()`?**
In `finally`, so failed transactions return their connection. This is the single most
common cause of pool exhaustion in `pg` code.

**Is `ROLLBACK` safe to call unconditionally in a catch block?**
Only with a `.catch()` of its own. If the connection is already dead it throws, and an
unguarded cleanup would mask the original error.

---

← [ACID in PostgreSQL](01-acid.md) · Next → [READ COMMITTED](03-read-committed.md)
