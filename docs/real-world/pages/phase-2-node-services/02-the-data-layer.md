---
title: "The data layer over raw pg"
sidebar_label: "02 · The data layer"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the node-postgres docs (Pool, Client, transactions)
> and Node v24 docs (`AsyncLocalStorage`). Concept home:
> [Node — connection pooling](../../../nodejs/pages/phase-6-data-access/01-connection-pooling.md),
> [transactions from Node](../../../nodejs/pages/phase-6-data-access/06-transactions.md),
> [the repository pattern](../../../nodejs/pages/phase-6-data-access/10-repository-pattern.md).

## The problem

Phase 1 wrote queries; something has to own *how they run*: one pool,
configured once; transactions that compose across modules without every
function signature dragging a client; and a boundary that keeps `pg` types
out of business logic. This chapter is that layer — four small files the
whole backend imports.

## The design choices

**One pool module, imported everywhere.** The pool is process-wide state
(the [module-scope rule](../../../nodejs/pages/phase-6-data-access/01-connection-pooling.md));
creating it in a function invites per-request pools, the classic
self-inflicted outage. The type parsers from
[money and time](../phase-1-database/07-money-and-time.md) live here — set
once, true everywhere.

**Transactions propagate through `AsyncLocalStorage`, not parameters.** The
alternative — every query function taking `(client, …)` — works and Phase 1's
`checkout` shows it. But it leaks the decision "am I in a transaction?" into
every call signature between the endpoint and the query. ALS carries the
transaction client down the async call chain invisibly: query modules ask
"current client or pool?" through one function. The cost, named honestly:
propagation is implicit, so a reader must know the convention — which is why
it is *this chapter's* convention, documented at the layer boundary, and not
scattered.

**Query modules per entity, returning plain objects.** `db/products.js`,
`db/orders.js`, `db/carts.js` — each exports functions that take domain
arguments and return domain shapes. No `pg.Result` escapes; renames happen in
the select list, not in mappers.

## The implementation

```js
// db/pool.js — the one pool
import pg from 'pg';

pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v)); // ch. 1·07

export function createPool(config) {
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  pool.on('error', (err) => {
    // an *idle* client died (server restart, network); the pool replaces it.
    console.error(JSON.stringify({msg: 'idle client error', err: err.message}));
  });
  return pool;
}
```

```js
// db/tx.js — transactions that compose
import {AsyncLocalStorage} from 'node:async_hooks';

const als = new AsyncLocalStorage();

/** The querier every module uses: the transaction's client when inside one,
 *  the pool otherwise. */
export function q(pool) {
  return als.getStore() ?? pool;
}

export async function withTransaction(pool, fn) {
  const existing = als.getStore();
  if (existing) return fn(existing);        // nested calls join the outer tx

  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await als.run(client, () => fn(client));
    await client.query('commit');
    return result;
  } catch (err) {
    try {
      await client.query('rollback');
    } catch (rollbackErr) {
      // a dead connection makes rollback throw; the original error matters more
      console.error(JSON.stringify({msg: 'rollback failed', err: rollbackErr.message}));
    }
    throw err;
  } finally {
    client.release();
  }
}
```

```js
// db/orders.js — a query module in the house shape
import {q} from './tx.js';

export function ordersRepo(pool) {
  return {
    async byUser(userId, {limit = 20} = {}) {
      const {rows} = await q(pool).query(
        `select id, status, total_cents, created_at
           from orders where user_id = $1
          order by created_at desc, id desc limit $2`,
        [userId, limit],
      );
      return rows;
    },
    async setStatus(orderId, status) {
      const {rowCount} = await q(pool).query(
        `update orders set status = $2 where id = $1`, [orderId, status],
      );
      if (rowCount === 0) throw new Error(`order ${orderId} not found`);
    },
  };
}
```

The pieces compose exactly like the phase gate wants: an endpoint calls
`withTransaction(pool, () => orderService.fulfil(orderId))`, the service calls
two repo methods, both silently run on the transaction's client, and a
service called *without* a transaction runs each statement on the pool —
same code, both modes.

## What to notice

- **The guarded rollback.** On a dead connection, `rollback` itself throws —
  unguarded, it *replaces* the original error with a useless
  "connection terminated", the exact failure the
  [transactions concept page](../../../nodejs/pages/phase-6-data-access/06-transactions.md)
  warns about. Log the rollback failure; throw the real one.
- **Nested `withTransaction` joins, not nests.** The inner call sees the ALS
  store and runs inside the outer transaction — savepoint semantics are *not*
  provided, deliberately: no code path in this app wants partial rollback,
  and pretending to support it invites designs that need it.
- **`q(pool)` is the single point of indirection.** Grep-ably small, and the
  one place the ALS convention lives. A new teammate reads `db/tx.js` once
  and every module makes sense.
- **Phase 1's `checkout` keeps its explicit `tx` parameter** — it *is* the
  transaction boundary and locks rows; explicitness there is documentation.
  ALS serves the layers above it.

## Gotchas

- **Symptom:** intermittent "current transaction is aborted" errors on
  unrelated queries. **Cause:** a query ran on the transaction's client after
  an earlier statement failed but before rollback — usually a `Promise.all`
  inside `withTransaction` whose second branch fired after the first threw.
  **Fix:** inside a transaction, sequence dependent statements; `Promise.all`
  on one client is false parallelism anyway — the client serializes.
- **Symptom:** a background job's queries mysteriously run inside a request's
  transaction. **Cause:** the job was *started* inside `als.run` (a
  fire-and-forget `setImmediate` from an endpoint) — ALS context propagates
  into it. **Fix:** detached work opts out explicitly:
  `als.exit(() => startJob())` — or better, goes through the outbox like
  everything else.
- **Symptom:** under load, requests queue and time out; the database is
  idle. **Cause:** pool exhaustion — `max: 10` with a slow endpoint holding
  clients (often a transaction wrapping an outbound HTTP call). **Fix:** the
  rule the concept page states: **no network I/O inside a transaction** —
  and the pool metrics in chapter 09 make the queue visible before users
  feel it.

## Interview questions

1. **★ Why does `withTransaction` join an existing transaction instead of
   opening a nested one?** Because callers compose: `placeOrder` calls
   `reserveStock` which calls repo methods — if each opened its own
   transaction, the outer commit couldn't guarantee the inner work, and true
   nesting needs savepoints nobody here wants. Join-semantics make
   "transactional when transacted" the default and keep one commit point.
2. **★ What does AsyncLocalStorage actually propagate through, and where
   does it break?** It follows the async continuation chain — awaits,
   promise callbacks, timers started within the run. It breaks where the
   chain is deliberately severed: work queued outside the run context,
   EventEmitter listeners registered elsewhere, or callback APIs that lose
   async context (rare in modern Node; `AsyncResource` is the repair). The
   [ALS concept page](../../../nodejs/pages/phase-2-async/20-asynclocalstorage.md)
   maps the edges.
3. **Why must the rollback be guarded when the transaction helper already
   catches errors?** The catch handles *statement* failure; rollback failure
   is a second, different failure (dead connection) that would otherwise
   shadow the first. Error handling that can itself fail must not replace
   the original error — a rule that generalizes well beyond databases.
4. **Why `max: 10` and not 100?** Postgres does work per connection;
   [pool sizing](../../../nodejs/pages/phase-6-data-access/01-connection-pooling.md)
   is about the database's parallelism, not the app's appetite. Ten covers
   this app's per-instance concurrency; more connections would trade
   database memory and context-switching for queueing that belongs in the
   app. Size from the database backwards.

---

← Prev: [The API boot, assembled](01-the-api-boot.md) ·
Next → [The upload service](03-the-upload-service.md)
