---
title: "What middleware must not do"
sidebar_label: "03 · What middleware must not do"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**The contract permits far more than it should. Every rule below is something
Express will happily let you do, and every one of them has a characteristic
production failure.**

> Verified: 2026-08-14. The permitted-but-unwise behaviours are read against
> `router@2.2.0`'s `Router.prototype.handle` and `lib/layer.js` in
> `sandbox/express-verify/node_modules/` — the stack walk resuming from a stored
> index, the arity gates, the `try`/promise handling — cited in
> [chunk 01](01-the-shape-and-the-endings.md) and
> [Phase 0 · 03](../../phase-0-express-basics/03-request-lifecycle/02-how-a-handler-is-invoked.md).
> **No sandbox run backs this page and it carries no console block.** The rules
> themselves are this bible's guidance; Express documents no such constraints and
> enforces none.

## 1 · Never call `next` twice

```js
app.use((req, res, next) => {
  loadThing(req, (err, thing) => {
    if (err) next(err);          // ← no return
    req.thing = thing;
    next();                      // ← runs too
  });
});
```

The walk resumes **from the stored index, twice**. Every layer below runs twice,
including the one that writes the response, and the second write throws
`ERR_HTTP_HEADERS_SENT` from somewhere that has nothing to do with the bug. In an
async chain the two paths can interleave, so the symptom is intermittent and the
stack points at the wrong file.

**There is no guard.** Express does not track whether `next` was called. The only
defence is `return next(...)` on every path, and it is why that habit is worth
being dogmatic about.

## 2 · Never respond and continue

```js
app.use((req, res, next) => {
  if (req.headers['x-legacy']) res.set('Deprecation', 'true');
  if (!req.user) res.status(401).json({error: 'unauthenticated'});
  next();                                     // ← always runs
});
```

Setting a header and continuing is fine. **Sending a body and continuing is
not.** The request is already answered; everything downstream is now operating on
a finished response, and the first one to write throws.

If you need to know whether the response has started — inside an error handler,
or in a generic wrapper — the check is `res.headersSent`, and the documented
pattern is `if (res.headersSent) return next(err)`.

## 3 · Never do expensive work unconditionally

A global middleware runs for **every** request, including `/livez`, `/readyz`,
the 404s from a scanner, and the `OPTIONS` preflights. So:

| Global middleware | What it costs you |
|---|---|
| a database lookup to hydrate `req.user` | every health probe queries the database, and a database blip fails liveness — restart storm ([Phase 10 · 05](../../phase-10-app-factory/05-health-and-boot.md)) |
| `express.json()` with a large `limit` | every request allocates a buffer it may not need |
| a JWT verification with a per-request JWKS fetch | one network round trip per request, and an outage in the identity provider becomes an outage in you |
| deep request logging with full bodies | log volume proportional to traffic, and bodies contain secrets |

**Mount cost where the cost is needed.** Body parsing on the routes that take
bodies, auth on the routes that need identity, and the health probes **above**
all of it so that they answer when everything else is struggling — which is
precisely when you need them to.

## 4 · Never hide authorization in middleware alone

Middleware can answer *who is this?* (401) and *may this role do this kind of
thing?* (403). It **cannot** answer *may this caller touch this record?* —
because the record has not been loaded yet.

```js
router.get('/orders/:id', requireAuth, requirePermission('orders:read'), async (req, res) => {
  const order = await orders.findById(req.params.id);   // ← any id, any tenant
  res.json(order);
});
```

Every line looks right. The token is valid, the permission is correct, the query
is ordinary — and the endpoint returns anyone's order. This is broken
object-level authorization, OWASP API #1, and it is invisible to a test suite
that only ever uses one user's ids.

The fix is not more middleware. **Scope the query**:
`orders.findOwned(req.params.id, req.user.orgId)`, so the unauthorised row never
enters the process and list endpoints inherit the same defence.
[Phase 8 · 07](../../phase-8-validation-authz/07-ownership.md).

## 5 · Never swallow an error

```js
app.use(async (req, res, next) => {
  try {
    await doSomething();
  } catch (err) {
    console.error(err);      // logged, and then…
  }
  next();                    // …the request continues as if it worked
});
```

The request proceeds with an inconsistent assumption, and the eventual failure
happens three layers away with no relationship to the cause. **Catch to add
context and rethrow, or do not catch.** If a failure genuinely is non-fatal — a
best-effort analytics call — say so in the code and record it as a metric, not a
`console.error` nobody reads.

## 6 · Keep business logic out

A middleware is defined by *where it runs*, not by what it knows. The moment it
contains a domain rule — "orders over £10,000 need approval" — that rule can only
be tested through HTTP, can only be reused by another HTTP route, and is
invisible to anyone reading the service.

**The test:** could you call this logic from a script with no `req`? If not, and
if it is a domain rule rather than a transport concern, it is in the wrong place.
[Phase 7 · 01](../../phase-7-layering/01-controller-service-repository/README.md).

Transport concerns that legitimately belong in middleware: parsing, correlation
ids, authentication, coarse authorization, content negotiation, compression,
rate limiting, timeouts, logging, error mapping. Everything else is a service.

## 7 · Do not assume order you have not written down

Order is registration order — an array walked from index 0, with no priority
system and no specificity ranking
([Phase 2 · 02](../02-execution-order/01-the-four-levels.md)). So a middleware that depends on
another having run is depending on a fact recorded nowhere.

Two mitigations that cost almost nothing:

- **Fail loudly on a missing precondition.** `if (!req.id) throw new Error('requestId
  middleware must be mounted first')` turns a silent misordering into a boot-time
  or first-request error.
- **Assemble in one factory**, so the order is readable in one screen rather than
  inferred across six files —
  [Phase 10 · 01](../../phase-10-app-factory/01-create-app.md).

## Trade-off

Middleware is the most reusable unit Express has, and it is also the easiest
place to put something that does not belong there. Everything that goes global is
paid for on every request forever, including the ones you did not think about;
everything that goes into middleware becomes invisible to the service layer.

**The heuristic:** middleware should be about the *request*, not about the
*domain*, and it should be mounted as narrowly as it can usefully be. Global is
for things that are genuinely true of every request. Everything else goes on the
route, where it can be seen.

## Gotchas

**Symptom:** `Cannot set headers after they are sent`, intermittently, with a
stack pointing at unrelated code
**Cause:** `next` called twice — usually an error branch with no `return`. The
walk resumes from the stored index twice and everything below runs twice
**Fix:** `return next(...)` on every path. Express tracks nothing and will not
warn

**Symptom:** Health probes fail whenever the database is slow, and every instance
restarts at once
**Cause:** A global middleware doing a database lookup runs for `/livez` too
**Fix:** Probes above everything; dependency checks in **readiness** only, never
liveness

**Symptom:** A valid token and the correct role still returned someone else's
record
**Cause:** Authorization stopped at the middleware layer; ownership was never
checked because the record was not loaded yet
**Fix:** Scope the query by the caller's tenant or id, rather than checking after
the load

**Symptom:** An error is logged but the request succeeds with wrong data
**Cause:** A `catch` that logs and calls `next()`
**Fix:** Rethrow, or `next(err)`. A genuinely non-fatal failure should be a
metric and a comment saying why

**Symptom:** A middleware works locally and breaks in production after a deploy
that only reordered imports
**Cause:** Its position depended on module import order because mounting is
spread across files
**Fix:** One factory that does all mounting, plus a loud precondition check in
any middleware that depends on another

## Interview questions

**★ What happens if you call `next()` twice?**
The stack walk resumes from the stored index twice, so every layer below runs
twice — including whichever one writes the response. The second write throws
`ERR_HTTP_HEADERS_SENT`, usually from code unrelated to the bug. Express has no
guard for it; `return next()` is the only defence.

**★ Can middleware do authorization?**
Partly. It can answer "who is this?" and "may this role do this kind of thing?",
because both are answerable from the token. It cannot answer "may this caller
touch **this record**?", because the record has not been loaded. That check
belongs in the service, and is best expressed as a scoped query rather than a
comparison after the load.

**★ What is the cost of a global middleware?**
It runs for every request — health probes, 404s from scanners, CORS preflights.
A database lookup in a global middleware means your liveness probe queries the
database, which turns a database blip into a fleet-wide restart storm.

**★ How do you decide whether logic belongs in middleware or a service?**
Ask whether it could be called from a plain script with no `req`. Transport
concerns — parsing, correlation ids, authn, content negotiation, rate limiting,
error mapping — belong in middleware. Domain rules do not, because putting them
there makes them testable only over HTTP and reusable only by HTTP.

**Why is `router.use(requireAuth)` riskier than per-route auth?**
Because it is opt-out. A route added above that line is silently public and looks
identical to every protected route in the file. Per-route auth appears in the
diff and can be grepped for.

**A middleware depends on another having run. How do you make that safe?**
Assert it — throw or log loudly when the precondition is missing, so a
misordering fails immediately instead of producing `undefined` three layers
later — and assemble the whole stack in one factory so the order is readable
rather than inferred.

---

← Prev: [Middleware that composes](02-middleware-that-composes.md) · Index: [The middleware contract](README.md) · Next topic → [Execution order](../02-execution-order/README.md)
