---
title: "Passing a client through services"
sidebar_label: "12 · Client propagation"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **PostgreSQL 18.4** (`postgres:18-alpine`, `127.0.0.1:55432`),
> **Node 24.19.0**, `pg` 8.23.0. Script: `sandbox/pg-api/ex39-tx-request.mjs`.

**One transaction spanning several repositories works only if every function in
the chain uses the same client.** One that quietly uses the pool instead breaks
atomicity without raising anything.

## The failure

A handler opens a transaction and calls two repositories. One gets the client; the
other gets the pool — the sort of thing that happens when a service is refactored
and a parameter is forgotten:

```js
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await insertOrder(client, 'split-1');        // inside the transaction
  await insertItem(pool, 'split-1', 'sku-a');  // ← its OWN connection, autocommit
  throw new Error('payment declined');
} catch (e) {
  await client.query('ROLLBACK');
} finally {
  client.release();
}
```

```console
$ node ex39-tx-request.mjs
=== 3. a service handed the pool instead of the client ===
rolled back because: payment declined
after the "rollback":              orders=0 items=1
↑ the order is gone, the item is not. Half the request committed.
```

**`orders=0 items=1`.** The rollback did exactly what it promised — for the
statements that were actually in the transaction. The item insert never was: it ran
on its own connection, in its own implicit transaction, and committed the moment it
finished.

An orphaned item row with no parent order, and no error anywhere.

## Why nothing complained

```console
=== 4. proof the two calls ran on different backends ===
pid inside the transaction : 3150
pid of the pool.query call : 3151
same backend? false
what the transaction backend looks like meanwhile: idle in transaction
```

Two backend pids: two sessions, two snapshots, two transactions. Neither knows the
other exists. From PostgreSQL's point of view these are two unrelated clients that
happened to connect from the same process — and there is no rule against that.

This is also why the bug survives review. `insertItem(pool, ...)` and
`insertItem(client, ...)` differ by one identifier, both compile, both run, both
return a normal result.

## The contract

Every function that touches the database takes the executor as its first argument
and passes it down unchanged:

```js
// repositories — never reach for the pool
export const insertOrder = (db, ref) =>
  db.query(`INSERT INTO t_orders (ref) VALUES ($1) RETURNING id`, [ref]);

// services — take db, pass db
export async function placeOrder(db, input) {
  const order = await orders.insert(db, input);
  await items.insertMany(db, order.id, input.items);
  await audit.record(db, 'order.created', order.id);
  return order;
}

// the handler — the only place that decides transaction boundaries
app.post('/orders', async (req, res) => {
  const order = await withTransaction(pool, (tx) => placeOrder(tx, req.body));
  res.status(201).json(order);
});
```

The rule that makes it enforceable: **only the outermost layer names `pool`.**
Repositories and services never import it. That is greppable — `grep -r "pool" src/services src/repositories` should return nothing — and a lint rule can make it
mechanical.

## Composing services

Because `placeOrder` takes `db` rather than opening its own transaction, another
service can call it inside a larger one:

```js
await withTransaction(pool, async (tx) => {
  const order = await placeOrder(tx, input);
  await inventory.reserve(tx, order.id);       // same transaction
});
```

If `placeOrder` had opened its own transaction, this would be impossible — its
work would commit independently, and a later failure in `inventory.reserve` could
not undo it. **A service that manages its own transaction cannot be composed**,
which is the practical reason transaction boundaries belong at the top.

Calling `placeOrder(pool, input)` still works when there is no surrounding
transaction: each statement autocommits. It is only atomic when someone wraps it,
and that is the caller's decision to make.

## The alternative: an ambient client

Threading `db` through every signature is the part people dislike. `AsyncLocalStorage`
removes it:

```js
export const runInTransaction = (fn) => withTransaction(pool, (tx) =>
  txStore.run(tx, fn));

export const db = () => txStore.getStore() ?? pool;   // fall back to the pool
```

```js
export const insertOrder = (ref) =>
  db().query(`INSERT INTO t_orders (ref) VALUES ($1) RETURNING id`, [ref]);
```

This genuinely works, and it makes the propagation bug structurally impossible —
there is no argument to forget.

What it costs is legibility of exactly the thing that went wrong above. With an
explicit `db`, whether a call participates in a transaction is visible at the call
site. With an ambient store it depends on what is above you on the stack, so the
same function call means different things in different contexts, and the fallback
`?? pool` silently turns "no transaction open" into "autocommit" — the same silent
half-commit, now harder to see.

It also breaks in the places async context tends to break: callbacks that escape
the async context, some event emitters, and worker threads.

Explicit `db` for most codebases. `AsyncLocalStorage` when the threading is
genuinely unmanageable, with the fallback throwing rather than defaulting to the
pool.

## Trade-off

The explicit contract puts a database parameter into the signature of every
service function, including ones whose logic is pure domain code. That is real
noise, and it makes signatures change when persistence changes — the coupling a
repository pattern was partly meant to avoid.

The alternatives each move the problem: an ambient client hides it, a
repository-owned transaction destroys composition, and no transaction at all gives
up atomicity. Threading the parameter is the option whose cost is verbosity rather
than correctness, and verbosity is the cost worth paying.

Node **[Phase 6 · Data access](/docs/nodejs/pages/phase-6-data-access/)** owns the
broader layering argument; this page is only about the mechanism and what breaks
without it.

## Gotchas

**Symptom:** A `ROLLBACK` leaves orphaned child rows
**Cause:** One repository call received the pool instead of the transaction's
client. Measured: `orders=0 items=1` after the rollback.
**Fix:** Pass `db` everywhere; never import the pool below the handler.

**Symptom:** No error is raised by the bug at all
**Cause:** The two calls are separate sessions — measured, backend pids 3150 and
3151 — and PostgreSQL has no reason to object.
**Fix:** Structural prevention: grep or lint for `pool` outside the composition
root.

**Symptom:** Two services cannot share a transaction
**Cause:** One of them opens its own with `withTransaction` internally.
**Fix:** Services take `db`; only handlers decide boundaries.

**Symptom:** Reads inside a transaction do not see writes made earlier in the same
request
**Cause:** The read went through the pool, so it is a different session and cannot
see uncommitted data.
**Fix:** Same client for reads and writes within a transaction.

**Symptom:** With `AsyncLocalStorage`, writes escape the transaction intermittently
**Cause:** The async context was lost — an escaped callback or an event emitter —
so `getStore()` returned `undefined` and the `?? pool` fallback took over.
**Fix:** Throw when no store is present rather than falling back.

## Interview questions

**★ What happens if one repository in a transaction is handed the pool instead of
the client?**
Its statement runs on a different connection in its own implicit transaction and
commits immediately, so a later `ROLLBACK` cannot undo it. Measured: after the
rollback, `orders=0 items=1` — an orphaned child row and no error anywhere.

**★ Why does PostgreSQL not detect this?**
Because there is nothing to detect. The two calls are two independent sessions —
measured, different backend pids — and a process is allowed to hold as many
connections as it likes. Nothing links them.

**★ Where do transaction boundaries belong?**
At the layer that knows what the request means — the handler or a use-case
function — not in repositories or services. A service that opens its own
transaction commits independently and therefore cannot be composed into a larger
one.

**★ What is the enforceable version of the rule?**
Only the composition root imports the pool. Repositories and services take `db` as
their first parameter and pass it down unchanged, so `grep -r pool src/services`
returning nothing is the invariant, and a lint rule can enforce it.

**What does `AsyncLocalStorage` change, and what does it cost?**
It removes the parameter, so the bug becomes structurally impossible. The cost is
that participation in a transaction is no longer visible at the call site, and the
usual `?? pool` fallback reintroduces silent autocommit when the async context is
lost. If you use it, make the missing-store case throw.

---

← [Idempotent writes](11-idempotent-writes.md) · Next → [Optimistic concurrency](13-optimistic.md)
