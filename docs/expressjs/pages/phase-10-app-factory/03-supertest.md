---
title: "Integration testing with Supertest"
sidebar_label: "03 · Supertest"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

**Hit the real Express stack with mocked services. Do not mock Express itself.**

> Verified: 2026-08-14 — **no sandbox run**. Supertest is a third-party package; Express
> ships no test tooling. It works because of a documented property: an Express app **is a
> request listener**, and `app.listen()` is a convenience equivalent to
> `http.createServer(app).listen()`
> ([application reference](https://expressjs.com/en/5x/api/application/)) — so a test
> harness can hand the app to its own server on an ephemeral port. That is why
> [page 01](01-create-app.md)'s rule against listening inside the factory is what makes
> these tests possible at all.
> The broader testing curriculum — `node:test`, coverage, test doubles — is
> [Node Phase 9](../../../nodejs/pages/phase-9-testing/README.md); this page is only the
> Express seam.

```js
import request from 'supertest';
import {createApp} from '../src/app.js';

const app = createApp({
  userService: { list: async () => [{id: '1'}] },
});

const res = await request(app).get('/api/users').expect(200);
```

Node Phase 9 covers the broader testing curriculum.

## The seam is the dependency argument — nothing else

This is the whole discipline, and it decides what these tests are worth:

| Mock this | Never mock this |
|---|---|
| The services and clients you inject | `req` / `res` |
| Outbound HTTP, mail, payment providers | Express middleware |
| The clock, the id generator | Your own routers |
| The database — or use a real one in a container | The error handler |

**Mocking Express means testing nothing.** A test that stubs `req.params` and calls
the handler directly skips routing, body parsing, validation middleware,
authentication, the 404 handler and the error handler — which is to say it skips
every layer where the bugs in this bible actually live. Route ordering
([Phase 1](../phase-1-routing/04-route-ordering.md)), a validation factory that was
never mounted ([Phase 8](../phase-8-validation-authz/02-validation-factory.md)), an
error handler with three parameters ([Phase 5](../phase-5-errors/01-error-middleware.md))
— none of them are visible to a handler called as a function.

Going through Supertest exercises the real stack and catches all of them.

## What these tests are uniquely good at

Not business rules — those belong in service unit tests, which are faster and do
not need a request. Route tests earn their place on the things **only the HTTP
layer can get wrong**:

```js
it('rejects an unowned order with 404, not 403', async () => {
  const app = createApp({orderService: serviceWhereUserOwnsNothing()});
  await request(app)
    .get('/api/orders/7')
    .set('Authorization', `Bearer ${tokenFor('other-user')}`)
    .expect(404);                       // Phase 8 — existence must not leak
});

it('does not leak internal fields', async () => {
  const res = await request(app).get('/api/users/1').expect(200);
  expect(Object.keys(res.body)).toEqual(['id', 'name', 'createdAt']);
});
```

The second is the pattern worth stealing. **Assert on the exact key set**, not on
the fields you care about — that is the only test that catches
[Phase 7](../phase-7-layering/02-domain-vs-transport.md)'s persistence leak, where
`password_hash` rides along beside the fields you asserted.

Same shape for status codes: assert the **deny** paths, not just the allow path. A
401 without a token, a 403 for the wrong role, a 404 for someone else's record, a
400 for an invalid body. Those four tests are worth more than a dozen happy-path
assertions, because the happy path is what everyone already checks.

## Trade-off

Route tests are slower than unit tests — a real HTTP round trip through the whole
middleware stack — and they are coarse: a failure tells you the endpoint is wrong,
not which layer. Over-relying on them produces a suite that is slow and hard to
diagnose.

They are also the only tests that see the stack as a stack. **Use them for
integration concerns — status codes, response shape, middleware order, auth
behaviour — and push rule-level assertions into service tests**, which is possible
precisely because [Phase 7](../phase-7-layering/01-controller-service-repository.md)
made services callable without HTTP.

The other cost is fidelity: mocked services can drift from real ones, so a suite
that mocks everything can pass while production is broken. Where a real dependency
in a container is cheap (Testcontainers, Node Phase 9), use it for the paths that
matter most.

## Gotchas

**Symptom:** Tests pass but production 404s on the same route  
**Cause:** Handlers called directly, so routing was never exercised  
**Fix:** Go through Supertest and the real app

**Symptom:** `EADDRINUSE` when tests run in parallel  
**Cause:** The app or the test binds a fixed port  
**Fix:** Pass the app to Supertest and let it use an ephemeral port; never `listen` in
the factory

**Symptom:** The suite hangs after all tests pass  
**Cause:** An open pool or server from a test that never closed it — the same import-time
connection problem as [Phase 7](../phase-7-layering/04-di-without-framework.md)  
**Fix:** Build the graph per test and close it in teardown

**Symptom:** A response leaks an internal field and every test still passes  
**Cause:** Assertions check individual fields, not the key set  
**Fix:** Assert the exact keys

**Symptom:** Tests pass with mocks and fail against the real database  
**Cause:** The mock and the real client disagree  
**Fix:** Contract-test the mock, or use a real dependency in a container for the critical
paths

**Symptom:** Only 200s are tested  
**Cause:** Happy-path bias  
**Fix:** Assert the deny paths — 401, 403, 404, 400. They are what the middleware stack
exists to produce

## Interview questions

**★ What do you mock in route tests?**  
Outbound dependencies (DB, mail), not `req`/`res` plumbing.

**★ Why is calling the handler function directly a much weaker test?**  
It skips routing, body parsing, validation, authentication, the 404 handler and the
error handler — every layer where the interesting bugs are. Route ordering, an
unmounted validation middleware and a three-argument error handler are all invisible
to it.

**★ What should a route test assert that a service test cannot?**  
Status codes, response **shape**, middleware order and auth behaviour. Assert the exact
key set of a response — that is the only test that catches an internal field leaking
into the payload.

**Why does Supertest not need the app to listen?**  
An Express app is a request listener; `app.listen()` is only a convenience for
`http.createServer(app).listen()`. Supertest supplies its own server on an ephemeral
port, which is why the factory must not bind one.

**Which tests are worth more than the happy path?**  
The deny paths — 401 without a token, 403 for the wrong role, 404 for another user's
record, 400 for an invalid body. Those exercise what the middleware stack is for.

**What is the risk of mocking every dependency?**  
Mocks drift from the real implementations, so the suite passes while production is
broken. Contract-test the mocks, or run the critical paths against a real dependency in
a container.


---

← Prev: [Request id middleware](02-request-id.md) · Next → [Auth in tests](04-auth-in-tests.md)
