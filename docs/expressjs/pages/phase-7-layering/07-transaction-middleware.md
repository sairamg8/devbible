---
title: "Transaction-per-request middleware"
sidebar_label: "07 · Transaction middleware"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

**A middleware that opens a transaction, hands it down, and commits or rolls back
when the response ends. Twenty lines of Express — and a decision about atomicity
you should make deliberately rather than by default.**

> Verified: 2026-08-14 — **no sandbox run**. The transaction mechanism itself is
> **[Node Phase 6](../../../nodejs/pages/phase-6-data-access/README.md)**: `BEGIN`,
> `COMMIT`, `ROLLBACK`, pooled clients and isolation levels are covered there with
> measured evidence, and none of it is repeated here. What this page owns is the Express
> wrapper, which rests on documented behaviour: middleware may *"modify the request and
> response objects"* and must call `next()` or end the cycle
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)), and error
> middleware takes four arguments and is *"defined last"*
> ([error handling](https://expressjs.com/en/guide/error-handling.html)).
> `res.on('finish')` is Node's `http.ServerResponse` event, not an Express API
> ([`node:http`](https://nodejs.org/api/http.html)).

## The shape

```js
export function transactional(pool) {
  return async (req, res, next) => {
    const client = await pool.connect();
    req.tx = client;                       // your namespace — Phase 2's caution applies

    try {
      await client.query('BEGIN');

      res.on('finish', async () => {       // response fully written
        try {
          if (res.statusCode < 400) await client.query('COMMIT');
          else await client.query('ROLLBACK');
        } finally {
          client.release();
        }
      });

      next();
    } catch (err) {
      await client.query('ROLLBACK');
      client.release();
      next(err);
    }
  };
}
```

That is the whole idea, and reading it carefully is more useful than adopting it —
**three of its details are wrong for most applications**, and knowing why is the
point of this page.

## Why deciding on `statusCode` is a trap

Committing when the status is below 400 sounds reasonable and quietly couples your
data integrity to your HTTP mapping. Two failure modes:

- A handler that **catches an error, responds 200 with a partial result**, and
  leaves the transaction committed.
- A handler that returns **404 after successfully writing an audit row** — now the
  audit row is rolled back because of a status code chosen for a different reason.

The transaction boundary should be decided by **whether the work succeeded**, not
by what number the response happens to carry. Those two usually agree, and
"usually" is not a property you want underneath a database.

## Why `res.on('finish')` is the wrong place to commit

`finish` fires when the response has been handed to the socket. By then:

- **You cannot report a commit failure.** Headers are sent; a deadlock or a
  constraint violation at `COMMIT` leaves the client holding a 200 for work that
  never persisted. There is no way to correct it — this is the same
  headers-already-sent wall as [Phase 4](../phase-4-responses/04-headers-already-sent.md).
- **The callback is async and nothing awaits it.** A rejection inside it is an
  unhandled rejection, exactly as in [page 05](05-jobs-from-routes.md).

**You must commit before you respond.** Anything else means the response is a claim
you have not yet verified.

## Why one transaction per request is usually too coarse

The pattern's appeal is that handlers never think about transactions. That is also
its cost:

- A request that reads for 200ms, calls a payment provider for 2 seconds, then
  writes, **holds a database connection and an open transaction for the whole 2.2
  seconds**. Under load, connections run out long before CPU does.
- Long transactions hold locks and, on PostgreSQL, keep old row versions alive —
  the vacuum and bloat consequences are covered in the PostgreSQL track.
- Read-only requests get a transaction they never needed.

The alternative is unglamorous and better: **the service owns the transaction, and
wraps only the operations that must be atomic.**

```js
// service — the boundary is a unit of work, not a request
async function placeOrder(input, actorId) {
  return db.transaction(async (tx) => {
    const order = await orderRepo.insert(tx, input);
    await inventoryRepo.reserve(tx, order.items);
    return order;
  });
}                                   // provider call happens OUTSIDE this
```

The transaction now lasts as long as the writes, not as long as the request, and
the boundary is visible in the code that needs it.

## When the middleware version is genuinely right

It is not a bad pattern — it is a narrow one. It fits when:

- **Every** request is a single unit of work with no slow external calls;
- you are retrofitting transactions onto an app with handlers that write in several
  places and no service layer to hold the boundary;
- request-scoped context is needed for something else anyway (a tenant id set via
  `SET LOCAL`, or row-level security), and the transaction is how you scope it.

That last case is the strongest, and it is the one where per-request really is the
correct granularity.

## Trade-off

Transaction-per-request buys uniformity — one place decides, no handler forgets,
and a half-written request cannot leave inconsistent data. For a CRUD app with
short handlers, that is genuinely good and costs almost nothing.

It buys it by **tying connection lifetime to request lifetime**, which is fine until
one endpoint calls something slow, and then it is a connection-pool outage under
load. It also hides the boundary: reading a service tells you nothing about what is
atomic.

**Prefer explicit transactions in the service, where the unit of work is.** Reach
for the middleware when retrofitting, or when the transaction is carrying
request-scoped state you need anyway.

## Gotchas

**Symptom:** The connection pool exhausts under moderate load  
**Cause:** A transaction held for the whole request, including a slow third-party call  
**Fix:** Narrow the boundary to the writes; make remote calls outside any transaction

**Symptom:** A client receives 200 but the data was never written  
**Cause:** Committing in `res.on('finish')` — the commit failed after the response went out  
**Fix:** Commit **before** responding, so a failure can still become a 500

**Symptom:** An error handler's own database write fails or is rolled back  
**Cause:** The error middleware ran after the request transaction was already rolled back  
**Fix:** Logging and audit writes belong outside the request transaction, on their own
connection

**Symptom:** A rollback happens for a deliberate 404 that also wrote an audit row  
**Cause:** Commit decided by `res.statusCode`  
**Fix:** Decide by whether the work succeeded, not by the response code

**Symptom:** Read-only endpoints show idle-in-transaction connections  
**Cause:** Every request opens a transaction, including pure reads  
**Fix:** Skip it for safe methods, or drop the middleware for an explicit boundary

**Symptom:** Two services in one request need different isolation levels  
**Cause:** One transaction chosen globally at the edge  
**Fix:** The service is the only layer that knows what it needs — the boundary belongs
there

## Interview questions

**★ What does transaction-per-request middleware do, and what does it cost?**
It opens a transaction before the handler, exposes it on the request, and
commits or rolls back at the end. It costs holding a database connection for the
entire request — including any slow external call — which exhausts the pool long
before anything else becomes the bottleneck.

**★ Why is committing in `res.on('finish')` wrong?**
Because the response is already sent. A commit failure at that point cannot be
reported — the client holds a 200 for work that never persisted — and the async
callback's rejection is unhandled. Commit before responding.

**★ Why is deciding commit-versus-rollback on `res.statusCode` fragile?**
It couples data integrity to HTTP mapping. A handler that catches an error and
responds 200 commits bad work; a deliberate 404 that also wrote an audit row rolls it
back. Decide on whether the work succeeded.

**Where does the transaction boundary belong instead?**
In the service, around the operations that must be atomic. That keeps the
transaction as short as the writes, keeps remote calls outside it, and makes the
atomic unit visible where someone reads the logic.

**When is the middleware version the right choice?**
Retrofitting an app with no service layer, or when the transaction is already
carrying request-scoped state — a tenant id via `SET LOCAL`, or row-level security —
where per-request really is the correct granularity.

**Which layer owns the mechanics of transactions in this bible?**
Node Phase 6. Express only decides where the boundary sits and how the handle gets
to the code that needs it.

---

← Prev: [Folders and DTOs](06-folders-and-dtos.md) · Index: [Phase 7](README.md)
