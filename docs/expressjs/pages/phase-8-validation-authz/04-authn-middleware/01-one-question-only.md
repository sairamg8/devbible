---
title: "One question only"
sidebar_label: "01 · One question only"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Authentication answers *who is this?* and nothing else. Every extra
responsibility it takes on makes it slower, more coupled, and harder to reason
about when it fails.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** **Express ships
> no authentication of any kind** — its six built-ins are `json`, `urlencoded`,
> `raw`, `text`, `static` and `Router`
> ([express reference](https://expressjs.com/en/5x/api/express.html)), and the
> re-export list is read from `express@5.2.1`'s `lib/express.js` in
> `sandbox/express-verify/node_modules/`. So every line here is yours or a
> package's. **`req.user` is not an Express property**: it exists because
> middleware may *"modify the request and response objects"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)), and
> Express publishes **no reserved-name list**
> ([Phase 2 · 06](../../phase-2-middleware/06-mutating-req-res.md)).
> `req.get('Authorization')` is case-insensitive per the
> [request reference](https://expressjs.com/en/5x/api/request.html). Password
> hashing, JWT signing and session storage are
> [Node Phase 8](../../../../nodejs/pages/phase-8-security/README.md) —
> deliberately not repeated. **The design guidance is this bible's.**

## The shape

```js
export function requireAuth({verifyToken}) {
  return async function requireAuth(req, res, next) {
    const header = req.get('Authorization') ?? '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return next(new HttpError(401, 'UNAUTHENTICATED'));
    }

    try {
      req.user = await verifyToken(token);   // throws on invalid/expired
      next();
    } catch {
      next(new HttpError(401, 'UNAUTHENTICATED'));   // same code, always
    }
  };
}
```

Note it goes through `next(err)` rather than responding directly, so the envelope
comes from the one error handler and an auth failure looks like every other
failure to a client
([Phase 5 · 03](../../phase-5-errors/03-error-contract/README.md)). And the
returned function is **named**, so `DEBUG=router` shows `requireAuth` rather than
`<anonymous>`
([Phase 2 · 02 · chunk 02](../../phase-2-middleware/02-execution-order/02-ordering-in-practice.md)).

## Three questions, three layers

| Question | Layer | Failure |
|---|---|---|
| **Who is this?** | authentication — this page | 401, `req.user` or nothing |
| What may this role do? | RBAC — [page 06](../06-rbac-middleware.md) | 403 |
| May they touch **this row**? | ownership — [page 07](../07-ownership.md), **in the service** | 404 (not 403) |

🔴 **Collapsing any two of those is where the bugs are.** The third cannot be done
in middleware at all, because the record has not been loaded yet — which is the
single most consequential structural fact in this phase
([Phase 2 · 01 · chunk 03](../../phase-2-middleware/01-middleware-contract/03-what-middleware-must-not-do.md)).

`req.user` should carry **identity plus whatever the credential already proves** —
an id, a role, a tenant id. If establishing it requires a database round trip on
every request, that is a design decision worth making consciously rather than a
side effect of loading "the full user" out of habit
([chunk 02](02-tokens-sessions-and-cost.md)).

## Fail closed, and say the right thing

Three rules, and the third is the one that gets missed:

**1 · No credential → 401**, always. Not "continue as anonymous" on a protected
route.

**2 · Invalid, expired or malformed → 401**, with the **same body** as a missing
one. Distinguishing "expired" from "invalid" tells an attacker their token was
once real — information they did not have.

🔴 **3 · Any error inside the middleware → 401 or 500, never `next()`.**

```js
// ⛔ the dangerous version
try { req.user = await verifyToken(token); }
catch (err) { logger.warn(err); }        // no next(err), no return
next();                                   // continues as anonymous
```

A `catch` that logs and falls through turns a verification failure into an
**unauthenticated request reaching a handler that assumes `req.user` exists** —
which then either crashes on `req.user.id` or, worse, treats `undefined` as a
valid scope. Either the middleware establishes identity or the request stops.

## The optional-auth trap

An endpoint that serves both anonymous and authenticated callers is a legitimate
need — a public post that shows an edit button to its author. The dangerous line
is in the middle:

```js
export function optionalAuth({verifyToken}) {
  return async function optionalAuth(req, res, next) {
    const header = req.get('Authorization');
    if (!header) return next();                    // ✅ absent ⇒ anonymous

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return next(new HttpError(401, 'UNAUTHENTICATED'));   // 🔴 present-but-bad ⇒ 401
    }
    try {
      req.user = await verifyToken(token);
      next();
    } catch {
      next(new HttpError(401, 'UNAUTHENTICATED'));          // 🔴 not next()
    }
  };
}
```

**Absent ⇒ anonymous. Present-but-invalid ⇒ 401.** Falling through on an invalid
token turns a forged credential into an unauthenticated request that some
downstream code may treat as safe — and it hides a client bug that would
otherwise be obvious.

## `WWW-Authenticate`, and the status pair

[RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15.5.2 says a 401
**must** include a `WWW-Authenticate` header. It matters if anything generic
consumes your API — a client library, a browser, an API gateway:

```js
res.set('WWW-Authenticate', 'Bearer');
```

The easiest way to get it right everywhere is to put it on the error, since the
default handler copies `err.headers` and a custom one can too
([Phase 4 · 02 · chunk 02](../../phase-4-responses/02-status-and-headers/02-headers-and-timing.md)).

And the pairing that decides client behaviour: **401 means "authenticate and
retry"; 403 means "retrying will not help"**. Using 401 for an authorization
failure produces a retry loop that can never succeed — the client refreshes its
token successfully and is refused again
([Phase 4 · 02 · chunk 01](../../phase-4-responses/02-status-and-headers/01-status-as-contract.md)).

## Keep it at the edge

`req.user` is convenient and it is an **invisible dependency**: a service reading
it is coupled to the auth middleware without saying so in its signature — the
exact leak [Phase 7 · 02](../../phase-7-layering/02-domain-vs-transport.md)
warns about.

```js
// ✅ the controller reads req.user; the service takes an actor
const order = await orders.cancel(req.params.orderId, req.user);
```

That one habit is what lets the same service be called from a job, a CLI or a
test without fabricating a request — and it makes the actor visible in the
signature, where a reviewer checking authorization will actually look.

⚠️ **`AsyncLocalStorage` is the wrong tool for the current user**, tempting though
it is. It works, and it makes authorization **invisible and untestable**: a
service whose behaviour depends on ambient state has no signature that says so.
Request id and a logger, yes; identity, no
([Phase 10 · 02](../../phase-10-app-factory/02-request-id.md)).

## Gotchas

**Symptom:** Requests with an expired token reach handlers as anonymous
**Cause:** The middleware caught the verification error, logged it, and called
`next()`
**Fix:** A failure in authentication is a 401. Never fall through

**Symptom:** An optional-auth endpoint accepts a forged token as "anonymous"
**Cause:** The invalid-token branch falls through instead of 401ing
**Fix:** Absent ⇒ anonymous; present-but-invalid ⇒ 401

**Symptom:** Attackers learn which tokens were once valid
**Cause:** Different responses for "expired" and "invalid"
**Fix:** One code, one message, for every authentication failure

**Symptom:** `req.user` is `undefined` inside a service
**Cause:** The service was called from a job or a test, where no middleware ran
**Fix:** Pass the actor as an argument. Services should not read request state

**Symptom:** `Authorization` header not found
**Cause:** A manual `req.headers['Authorization']` lookup — Node lowercases the
keys
**Fix:** `req.get('Authorization')`, which is case-insensitive by documentation

**Symptom:** A client retries a 401 forever after refreshing its token
**Cause:** 401 was used for an authorization failure
**Fix:** 403 when the caller is authenticated and simply may not

**Symptom:** A generic API client does not know how to authenticate
**Cause:** The 401 has no `WWW-Authenticate` header, which RFC 9110 requires
**Fix:** Set it — most simply by putting it on the error's `headers`

## Interview questions

**★ What does authentication middleware put on `req`, and what should it not?**
The authenticated principal — an id, and whatever the credential already proves,
such as a role and a tenant. Not a full user record loaded from the database
unless that round trip is a decision you made deliberately, and not permissions
computed for the route.

**★ What should it do when token verification throws?**
Return 401, with the same code and message as a missing token. Catching, logging
and calling `next()` is the dangerous version: the request continues as anonymous
into a handler that assumes `req.user` exists.

**★ What is the dangerous line in optional authentication?**
Present-but-invalid. Absent must mean anonymous, but an invalid or expired token
must be a 401 — falling through turns a forged credential into an
unauthenticated request that downstream code may treat as safe.

**★ Why must expired and invalid tokens produce identical responses?**
Because the difference tells an attacker their token was once real. The same
reasoning makes "no such user" and "wrong password" indistinguishable on a login
form.

**Is `req.user` an Express feature?**
No. Express has no authentication and no `user` property — it is a convention
built on middleware's ability to modify the request, with no reserved-name list
to protect it from collisions.

**Why not put the current user in `AsyncLocalStorage`?**
Because it makes authorization invisible and untestable: a service whose
behaviour depends on ambient identity has no signature that says so. Request id
and a logger are fine there; identity should be an argument.

---

Index: [Authn middleware](README.md) · Next → [Tokens, sessions and cost](02-tokens-sessions-and-cost.md)
