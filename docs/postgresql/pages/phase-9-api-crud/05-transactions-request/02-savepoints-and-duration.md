---
title: "Savepoints, aborts and duration"
sidebar_label: "02 · Savepoints and duration"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex39-tx-request.mjs`.

**Once a statement inside a transaction fails, the transaction is dead — every
later statement is refused until you end it.** That single rule explains why
"catch the error and carry on" does not work, and why `SAVEPOINT` exists.

## The first error poisons the rest

```js
await client.query('BEGIN');
try {
  await client.query(`SELECT 1/0`);
} catch (e) {
  console.log('first error :', e.code, e.message);
}
try {
  await client.query(`SELECT 1`);          // a query that cannot possibly fail
} catch (e) {
  console.log('next query  :', e.code, e.message);
}
```

```console
$ node ex39-tx-request.mjs
=== 7. carrying on after an error without ROLLBACK TO ===
first error : 22012 division by zero
next query  : 25P02 current transaction is aborted, commands ignored until end of transaction block
```

`SELECT 1` failed. Not because of anything wrong with it, but because the
transaction entered the **aborted** state and PostgreSQL refuses everything except
`ROLLBACK`, `COMMIT` (which behaves as a rollback) and `ROLLBACK TO SAVEPOINT`.

`25P02` in your logs almost always means an earlier error was caught and ignored,
and the real cause is the exception *before* it. When you see it, look upward for
the first failure.

Note also that `COMMIT` on an aborted transaction does **not** raise an error — it
rolls back and reports success. A handler that catches an error, logs it, and
commits anyway will report 200 and have written nothing.

## `SAVEPOINT` for a step allowed to fail

Sometimes one part of a request is genuinely optional — an audit row, a cache
warm, a nice-to-have denormalisation — and its failure should not lose the rest.

```js
await client.query('BEGIN');
await insertOrder(client, 'sp-1');

await client.query('SAVEPOINT optional_step');
try {
  await insertItem(client, 'sp-1', 'sku-a');
  await client.query(`INSERT INTO t_items (order_ref, sku) VALUES ($1, NULL)`, ['sp-1']);
  await client.query('RELEASE SAVEPOINT optional_step');
} catch (e) {
  await client.query('ROLLBACK TO SAVEPOINT optional_step');
}

await client.query('COMMIT');
```

```console
=== 6. SAVEPOINT so one optional step can fail without losing the request ===
optional step failed with 23502 — rolled back to the savepoint
outer transaction still committed
after savepoint recovery:          orders=1 items=0
```

`orders=1 items=0` is exactly right: the order committed, and **both** item
inserts were undone — including the first one, which had succeeded. `ROLLBACK TO
SAVEPOINT` rewinds to the savepoint, not to the failing statement.

That is the part people get wrong. A savepoint block is all-or-nothing, so put the
savepoint immediately before the *group* of statements that belong together, and
do not expect partial survival within it.

`ROLLBACK TO SAVEPOINT` also clears the aborted state, which is what makes the
outer `COMMIT` legal. Without it, the `COMMIT` would have silently rolled the
whole thing back.

### The cost

Savepoints are not free. Each one is an entry on the transaction's subtransaction
stack, and each subtransaction that writes gets its own XID. Thousands of
savepoints in one transaction — a savepoint per row in a loop, say — overflows the
per-backend cache of 64 subtransaction XIDs and pushes lookups to disk, which
degrades performance for *every* backend, not just yours. The measured detail is
in [Phase 11 · Savepoints](../../phase-11-mvcc/09-savepoints.md).

For a handful of optional steps per request they are the right tool. For a loop
over a thousand rows they are not — batch the work instead, or accept the failure.

## What an `await` costs inside a transaction

The transaction is open for as long as the JavaScript between `BEGIN` and `COMMIT`
takes, whether or not that time is spent talking to PostgreSQL:

```js
await client.query('BEGIN');
await insertOrder(client, 'slow-1');
await slowExternalCall();          // e.g. a payment provider, 1200 ms
await client.query('COMMIT');
```

```console
=== 8. an await inside the transaction that is not a query ===
after 1240 ms of waiting on the external call:
  backend state : idle in transaction
  xact open for : 1223 ms
↑ that connection was unusable by anyone else for the whole call
```

For 1223 ms that backend held an open transaction and did nothing. During that
window it:

- **occupies a pool slot**, so with `max: 10` you can serve ten concurrent
  requests and the eleventh waits;
- **holds every lock it has taken**, so any request touching the same rows queues
  behind a payment provider's latency;
- **holds back `VACUUM`**, because its snapshot pins the xmin horizon and dead
  rows anywhere in the database cannot be cleaned up while it lives.

The third one is the one that surprises people: a slow handler in one endpoint
causes table bloat in tables it never touches. See
[Phase 11 · Long transactions](../../phase-11-mvcc/12-long-transactions.md).

### The fix

Do the external work outside the transaction and keep the transaction for the
database work:

```js
const charge = await paymentProvider.charge(req.body);      // no transaction open
await withTransaction(pool, async (tx) => {
  const order = await orders.create(tx, {...req.body, chargeId: charge.id});
  await items.createMany(tx, order.id, req.body.items);
});
```

This changes the failure model rather than removing it: the charge can succeed and
the transaction then fail, leaving money taken and no order. That is a real
problem and it has a real answer — make the charge idempotent, record its id, and
reconcile — which is the subject of
[idempotent writes](../11-idempotent-writes.md). It is a better problem than
holding a connection and the xmin horizon for the length of a third party's
timeout.

**Set a backstop.** `idle_in_transaction_session_timeout` kills sessions that sit
idle in a transaction, turning an unbounded stall into a specific error you can
find:

```sql
ALTER ROLE api_user SET idle_in_transaction_session_timeout = '15s';
```

## Trade-off

Both mechanisms here buy resilience with complexity. A savepoint around every
fallible step makes a handler that almost never fails outright — and also one
where it is hard to say what state the database is in after a partial failure,
because the answer depends on which savepoints were reached.

The same is true of shortening transactions. Every piece of work you move outside
the transaction is a piece that can now succeed while the rest fails, and each of
those needs its own reconciliation story. A long transaction is simpler to reason
about and worse for the database; a short one is better for the database and moves
the complexity into your failure handling.

The default worth starting from: one transaction per request, containing only
database work, with no savepoints. Add a savepoint when a step is genuinely
optional, and split the transaction when profiling shows connections are the
constraint — not before.

## Gotchas

**Symptom:** `25P02 current transaction is aborted, commands ignored until end of
transaction block`
**Cause:** An earlier statement in the transaction failed and was caught; every
later statement is refused.
**Fix:** Find the first error — it is the real one. To continue deliberately, wrap
the fallible statement in a savepoint and `ROLLBACK TO SAVEPOINT`.

**Symptom:** A handler catches an error, commits, returns 200, and nothing was
written
**Cause:** `COMMIT` on an aborted transaction rolls back and reports success.
**Fix:** Do not commit after catching a database error unless a savepoint was
rolled back to.

**Symptom:** A savepoint rollback undid more than the failing statement
**Cause:** `ROLLBACK TO SAVEPOINT` rewinds to the savepoint. Measured: an order
survived, but both item inserts were undone including the one that succeeded.
**Fix:** Place the savepoint immediately before the group that belongs together.

**Symptom:** Table bloat in tables an endpoint never touches
**Cause:** A long-open transaction elsewhere pins the xmin horizon so `VACUUM`
cannot remove dead rows anywhere.
**Fix:** Keep external calls out of transactions; set
`idle_in_transaction_session_timeout`.

**Symptom:** The pool is exhausted although queries are fast
**Cause:** Connections held across non-database `await`s. Measured: a 1240 ms
external call held the transaction open for 1223 ms.
**Fix:** Do the external work before `BEGIN`.

**Symptom:** Performance degrades for every session after a batch job runs
**Cause:** A savepoint per row overflowed the 64-XID subtransaction cache.
**Fix:** Batch the work rather than wrapping each row in a savepoint.

## Interview questions

**★ What happens if a statement fails inside a transaction and you catch the
error and continue?**
Every subsequent statement fails with `25P02`, including ones that cannot fail on
their own — measured, a plain `SELECT 1` was refused after a division by zero. The
transaction is in the aborted state and accepts only `ROLLBACK`, `COMMIT` (which
rolls back) or `ROLLBACK TO SAVEPOINT`.

**★ How do you let one step of a request fail without losing the rest?**
`SAVEPOINT` before it, `RELEASE SAVEPOINT` on success, `ROLLBACK TO SAVEPOINT` on
failure. The rollback also clears the aborted state, so the outer transaction can
still commit — measured, the order committed after the optional step failed with
`23502`.

**★ Why is calling a payment API between `BEGIN` and `COMMIT` a problem?**
The transaction stays open for the whole call — measured, 1223 ms in
`idle in transaction`. That connection is unusable by anyone else, holds all its
locks, and pins the xmin horizon so `VACUUM` cannot clean dead rows anywhere in
the database. Do the call first, then open the transaction.

**★ If you move the payment call outside the transaction, what new problem do you
have?**
The charge can succeed while the transaction fails, so money was taken with no
order. The fix is to make the charge idempotent and reconcilable rather than to
put it back inside the transaction — it is a better failure mode than an unbounded
transaction.

**Does `COMMIT` on an aborted transaction raise an error?**
No — it rolls back and reports success. That is why catching a database error and
committing anyway produces a 200 with no data written.

**When are savepoints the wrong tool?**
In a loop. Each writing subtransaction consumes an XID, and more than 64 per
backend overflows the subtransaction cache and pushes lookups to disk, degrading
performance for every session on the server.

---

← [The wrapper](01-the-wrapper.md) · Next → [`create` — INSERT RETURNING](../06-create.md)
