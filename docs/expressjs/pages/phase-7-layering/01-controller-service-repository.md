---
title: "Controller → service → repository"
sidebar_label: "01 · CSR wiring"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Controllers translate HTTP. Services own rules. Repositories own queries. Driver types do not leak upward.**

> Verified: 2026-08-14 — **no sandbox run**, and **none of this is an Express feature**.
> Express has no notion of a controller, a service or a repository; it has middleware and
> handlers, and everything below is a convention you impose on them. Said plainly because
> it matters: there is no framework support to lean on, so the boundaries hold only while
> someone enforces them in review.
> The two Express facts the pattern actually rests on are documented — a router is *"a
> complete middleware and routing system … often referred to as a 'mini-app'"*, which is
> what makes a feature module mountable
> ([routing guide](https://expressjs.com/en/guide/routing.html)) — and middleware may
> *"modify the request and response objects"*, which is how validated input reaches a
> handler without the handler doing the validating
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)).
> The mechanics of repositories and transactions are
> [Node Phase 6](../../../nodejs/pages/phase-6-data-access/README.md).

## Responsibilities

| Layer | Does | Does not |
|---|---|---|
| Controller | parse/validate input already on `req`, call service, map status | SQL, business rules |
| Service | invariants, orchestration | `res.json`, Express types |
| Repository | queries/commands via drivers | HTTP status decisions |

Node Phase 6 owns *how* repositories and transactions work. Express owns where
the HTTP layer stops.

## The test that tells you the layers are real

Boundaries drawn in folder names are decoration. There is one question that
establishes whether they exist:

> **Can you call the service from a script, with no HTTP anywhere?**

If yes, the boundary is real. If the service needs a `req`, or reads
`process.env` for a per-request value, or calls `res.status()` somewhere deep,
then you have three folders and one layer.

The same test in the other direction: **can you swap the database without
touching the service?** If the service knows about SQL strings, driver error
codes or Mongo operators, the repository boundary is nominal.

## What each layer is allowed to know

| Layer | Knows about | Must never touch |
|---|---|---|
| **Controller** | `req`, `res`, status codes, DTO mapping | Business rules, queries |
| **Service** | Domain objects, other services, repository *interfaces* | `req`/`res`, HTTP status, SQL, driver types |
| **Repository** | The driver, the schema, query construction | HTTP, business rules, what a 404 means |

Two leaks account for nearly all the damage:

- **HTTP downward** — a service that takes `req` and reads `req.user` inside. Now
  every test needs a request object, and reusing the service from a job or a CLI
  means faking one.
- **Persistence upward** — a repository returning driver rows, so the service
  works with `RowDataPacket` and a schema change ripples through business logic.
  Map at the repository boundary and the change stops there.

A useful concrete rule for the second: **the repository decides what "not found"
looks like in data terms (null, empty array); the service decides it is an error;
the controller decides that error is a 404.** Three decisions, three layers, and
none of them belongs to another.

## What it looks like end to end

```js
// repository — knows the driver, nothing else
export function makeOrderRepo(db) {
  return {
    async findById(id) {
      const row = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
      return row ? toOrder(row) : null;          // domain object, not a driver row
    },
  };
}

// service — knows rules, no HTTP, no SQL
export function makeOrderService({orderRepo, clock}) {
  return {
    async cancel(orderId, actorId) {
      const order = await orderRepo.findById(orderId);
      if (!order) throw new NotFoundError('ORDER_NOT_FOUND');
      if (!order.cancellableAt(clock.now())) {
        throw new ConflictError('ORDER_NOT_CANCELLABLE');
      }
      return orderRepo.save(order.cancel(actorId));
    },
  };
}

// controller — knows HTTP, nothing else
router.post('/:id/cancel', async (req, res) => {
  const order = await orderService.cancel(req.params.id, req.user.id);
  res.json(toOrderDto(order));                   // errors go to Phase 5 middleware
});
```

The controller is four lines because everything it might otherwise do lives
somewhere it can be tested without a socket. Note there is no `try/catch`: Express
5 forwards the rejection, and the error middleware maps `NotFoundError` to a 404
([Phase 5](../phase-5-errors/04-mapping-to-http.md)). **That mapping is the
translation layer** — it is what lets services throw domain errors without knowing
HTTP exists.

## Trade-off

Three layers mean three files and an indirection for every feature. For a
five-endpoint service that is pure overhead, and honest teams say so: a small app
with handlers that call the database directly is *fine*, and pretending otherwise
produces ceremony without benefit.

What the layers buy is **testability without a server** and **change isolation**.
Business rules get unit tests that run in milliseconds; a database swap or a
second transport (a CLI, a queue consumer, a gRPC endpoint) reuses the service
untouched. Those benefits arrive when the app grows, and the cost of retrofitting
boundaries later is much higher than the cost of starting with them.

**The signal to adopt them:** the second consumer of your business logic appears,
or a test needs an HTTP server to check a rule.

## Gotchas

**Symptom:** Service unit tests need a running HTTP server  
**Cause:** The service takes `req` or returns something only a route can use  
**Fix:** Pass primitives and domain objects. If a service signature mentions Express,
the boundary is already broken

**Symptom:** A schema change breaks business logic in five files  
**Cause:** Repositories return driver rows, so persistence shapes travel upward  
**Fix:** Map to domain objects inside the repository. That mapping is the boundary

**Symptom:** The service calls `res.status(404).json(...)`  
**Cause:** HTTP leaked down a layer  
**Fix:** Throw a domain error and let the error middleware map it. The service should
not know what a 404 is

**Symptom:** Three folders, but changing anything still touches all of them  
**Cause:** Layering by folder name only  
**Fix:** Apply the test above — call the service from a script. Folders are not
boundaries

**Symptom:** A repository method is named `getUserForProfilePage`  
**Cause:** A presentation concern named a data operation  
**Fix:** Repositories speak the data language. If a name mentions a screen or an
endpoint, the wrong layer is driving

## Interview questions

**★ Why keep Express types out of services?**  
Services stay testable without spinning an HTTP server.

**★ How would you tell whether someone's layering is real or cosmetic?**  
Call the service from a plain script with no HTTP. If it needs a `req`, or reaches
for `res`, the layers are folder names. The mirror test is swapping the database
without touching the service.

**★ Where does "not found" become a 404?**  
In three steps. The repository returns null — a data fact. The service turns that
into a domain error. The controller (or the error middleware) maps that error to
404. Collapsing those steps is what drags HTTP into the service.

**Is this pattern always worth it?**  
No. For a small app, handlers calling the database directly are honest and cheaper.
Adopt layers when a second consumer of the business logic appears, or when testing a
rule requires standing up a server.

**Why is Express unable to help enforce any of this?**  
Because Express only knows middleware and handlers. Controllers, services and
repositories are conventions — nothing in the framework fails when you violate them,
which is exactly why they erode without review.


---

← Index: [Phase 7](README.md) · Next → [Domain vs transport](02-domain-vs-transport.md)
