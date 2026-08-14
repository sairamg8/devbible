---
title: "Wiring it in Express"
sidebar_label: "02 · Wiring it in Express"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Three layers, one composition root, and a controller short enough to read in
one glance — because everything it might otherwise do lives somewhere testable
without a socket.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** The Express
> mechanics are established and cited inline: a router as a mountable mini-app
> and dependency injection by argument
> ([Phase 1 · 03](../../phase-1-routing/03-router-composition/README.md)), Express
> 5's rejection forwarding from `router@2.2.0`'s `lib/layer.js`
> ([Phase 5 · 02](../../phase-5-errors/02-async-errors/01-what-is-forwarded.md)),
> and the error-to-status mapping from
> [Phase 5 · 04](../../phase-5-errors/04-mapping-to-http.md) — the source in
> `sandbox/express-verify/node_modules/`. Transaction mechanics are
> [Node Phase 6](../../../../nodejs/pages/phase-6-data-access/README.md). **The
> structure is this bible's guidance**; Express supplies none of it.

## End to end

```js
// repository — knows the driver, nothing else
export function makeOrderRepo(db) {
  return {
    async findOwned(id, orgId) {
      const row = await db.query(
        'SELECT * FROM orders WHERE id = $1 AND org_id = $2', [id, orgId]);
      return row ? toOrder(row) : null;          // domain object, not a driver row
    },
    save(order) { /* … */ },
  };
}

// service — knows rules, no HTTP, no SQL
export function makeOrderService({orderRepo, clock}) {
  return {
    async cancel(orderId, actor) {
      const order = await orderRepo.findOwned(orderId, actor.orgId);
      if (!order) throw new NotFoundError('ORDER_NOT_FOUND');
      if (!order.cancellableAt(clock.now())) {
        throw new ConflictError('ORDER_NOT_CANCELLABLE');
      }
      return orderRepo.save(order.cancel(actor.id));
    },
  };
}

// controller — knows HTTP, nothing else
router.post('/:orderId/cancel', async (req, res) => {
  const order = await orderService.cancel(req.params.orderId, req.user);
  res.json(toOrderDto(order));                   // errors go to Phase 5 middleware
});
```

The controller is three lines. Five things it is *not* doing, each of which is
somewhere better:

| Not doing | Where it lives instead |
|---|---|
| validating input | a `validate(schema)` middleware, so `req.validated` is already safe — [Phase 8 · 02](../../phase-8-validation-authz/02-validation-factory/README.md) |
| a `try`/`catch` | Express 5 forwards the rejection of the promise the handler returns |
| choosing a status for `NotFoundError` | the error middleware's mapping table |
| checking ownership | the scoped repository call inside the service |
| shaping the response | `toOrderDto`, a presenter |

🔴 **The error-mapping table is the translation layer.** It is what lets a service
throw `NotFoundError` without knowing HTTP exists — remove it and every controller
grows a `try`/`catch` that re-implements the same mapping slightly differently.
Note also that `clock` is injected: a service that calls `Date.now()` cannot be
tested at two different times.

## The composition root

Nothing above constructs anything. One function does, and it is the only place
that knows how the pieces fit:

```js
// composition.js — the only file that wires
export function buildDeps(config) {
  const db        = makePool(config.database);
  const clock     = {now: () => new Date()};
  const orderRepo = makeOrderRepo(db);

  return {
    db,
    orders: makeOrderService({orderRepo, clock}),
  };
}

// app.js
export function createApp(deps) {
  const app = express();
  // … settings, global middleware …
  app.use('/api/v1/orders', ordersRouter(deps));
  // … 404, error handler …
  return app;
}

// server.js — the only file that starts anything
const deps = buildDeps(loadConfig());
const server = createApp(deps).listen(config.port);
```

Three properties that fall out, and they are the actual payoff:

- **Nothing happens at import time.** A module-level `makePool()` opens a socket
  when the file is *imported*, so a unit test that imports a service holds a real
  database connection — and the suite hangs after passing
  ([Phase 7 · 04](../04-di-without-framework.md)).
- **A test builds its own deps.** `createApp({orders: fakeOrderService})` needs no
  database at all, and the fake is a plain object.
- **The wiring is reviewable in one file**, in the same way the middleware order
  is reviewable in one factory
  ([Phase 10 · 01](../../phase-10-app-factory/01-create-app.md)).

You do not need a DI container for this. **Functions taking an options object are
a dependency-injection framework**, and one with no library, no decorators and no
startup magic.

## Where the transaction boundary goes

The question this pattern is worst at answering, and the one that comes up first.

🔴 **The service owns the boundary, not the middleware and not the repository.**
Only the service knows which operations must succeed together:

```js
// service
async placeOrder(input, actor) {
  return this.db.transaction(async (tx) => {
    const order = await this.orderRepo.insert(tx, input, actor.orgId);
    await this.inventoryRepo.reserve(tx, order.items);
    await this.outbox.enqueue(tx, 'order.placed', order.id);   // same transaction
    return order;
  });
}
```

The repository takes the transaction handle as a parameter rather than owning
one, which keeps it composable — the same `insert` works inside a transaction and
outside it.

**What not to do:** a transaction-per-request middleware. It is a real pattern
and it has three specific problems, covered in full on
[page 07](../07-transaction-middleware.md): deciding commit from `res.statusCode`
couples data integrity to HTTP mapping; committing in `res.on('finish')` means a
commit failure **cannot be reported**, because the headers are already sent; and
one transaction per request holds a connection across every slow external call in
the handler, exhausting the pool. It is right for a retrofit and for
request-scoped state like `SET LOCAL` tenant ids, and wrong as a default.

Note the outbox row in that transaction: **enqueueing inside the transaction** is
what makes "the order was placed but the email never sent" impossible — the
alternative is a commit followed by a failed enqueue, with no record that the work
was owed ([Node Phase 7](../../../../nodejs/pages/phase-7-background-work/README.md)).

## Three objects, not two

The shape people collapse. A single "order" object used as the request body, the
domain model and the database row seems economical and is not:

| Shape | Changes when | Lives in |
|---|---|---|
| **DTO in** — the validated request | the public API changes | the schema, `req.validated` |
| **Domain object** | the business rules change | the service |
| **Persistence row** | the schema changes | the repository |
| **DTO out** — the response | the public API changes | the presenter |

They look identical on day one, which is exactly why they get collapsed. They
diverge on the day you add a computed field, rename a column, or need to accept a
field you do not store. **The mapping functions are the cheap part; the coupling
is the expensive part**, and it is only visible in hindsight
([Phase 7 · 02](../02-domain-vs-transport.md)).

## Testing each layer

| Layer | Test with | No need for |
|---|---|---|
| Repository | a real database — a container or a transaction rolled back per test | HTTP |
| Service | fake repositories, an injected clock | HTTP, a database |
| Controller | Supertest against the **real** `createApp`, with faked services | a database |

The middle row is where the value is: **business rules get unit tests that run in
milliseconds**, with no I/O and no fixtures beyond plain objects.

⚠️ **The bottom row has a trap.** Mounting a router on a throwaway app skips
authn, the rate limiter, the 404 and the error handler — so a route that forgot
`requireAuth` passes identically, and an error that your real handler maps to 409
comes back as an HTML 500. Test authorization against the real factory, including
the deny paths and specifically another user's id
([Phase 10 · 04](../../phase-10-app-factory/04-auth-in-tests.md)).

## Gotchas

**Symptom:** Importing a service opens a database connection
**Cause:** A module-level `makePool()` or `new Client()`
**Fix:** Construct in the composition root and inject. Nothing should happen at
import time

**Symptom:** Every controller has the same `try`/`catch` mapping errors to
statuses
**Cause:** No central error-mapping table, so each one re-implements it
**Fix:** One mapping in the error middleware. Services throw domain errors and
know nothing about HTTP

**Symptom:** A service test fails at midnight or in another timezone
**Cause:** The service calls `Date.now()` directly
**Fix:** Inject a clock. The same applies to uuid, randomness and config

**Symptom:** A transaction is held open across an HTTP call to a payment provider
**Cause:** Transaction-per-request middleware, or a service that wraps too much
**Fix:** Keep the transaction around the database work only; do external calls
before or after, and use an outbox if they must be tied to the commit

**Symptom:** The order committed but the confirmation email was never queued
**Cause:** The enqueue happened after the commit and failed
**Fix:** Enqueue **inside** the transaction, into an outbox table a worker drains

**Symptom:** A route with no `requireAuth` passes all its tests
**Cause:** The tests mount the router on a throwaway app with no auth middleware
**Fix:** Test authorization against the real `createApp`, and test the deny paths

## Interview questions

**★ Why is the controller only three lines?**
Because validation is a middleware, error mapping is the error handler, ownership
is a scoped repository call inside the service, and the response shape is a
presenter. Each of those is testable without a socket, which is the entire point
of moving them.

**★ Where does the transaction boundary belong, and why not in middleware?**
In the service, because only it knows which operations must succeed together.
Transaction-per-request middleware couples commit to `res.statusCode`, cannot
report a commit failure once headers are sent, and holds a connection across every
slow external call in the handler.

**★ Do you need a DI container for this?**
No. Functions taking an options object are a dependency-injection framework — one
with no library, no decorators and no startup magic. The important property is
that construction happens in one composition root and nothing happens at import
time.

**★ Why are there four shapes rather than one object?**
Because the request DTO, the domain object, the persistence row and the response
DTO change for different reasons — the public API, the business rules, the schema,
the public API again. They look identical on day one, which is why they get
collapsed, and they diverge the first time you add a computed field or rename a
column.

**How do you test each layer?**
Repositories against a real database with a rollback per test; services with fake
repositories and an injected clock, in milliseconds; controllers with Supertest
against the real `createApp` — not a throwaway app, because that skips authn and
the error handler and makes a missing `requireAuth` invisible.

**Why enqueue background work inside the transaction?**
Because a commit followed by a failed enqueue leaves the state changed with no
record that the follow-up work was owed. Writing to an outbox table in the same
transaction makes the two atomic, and a worker drains it.

---

← Prev: [The three layers](01-the-three-layers.md) · Index: [CSR wiring](README.md) · Next → [When to adopt it](03-when-to-adopt.md)
