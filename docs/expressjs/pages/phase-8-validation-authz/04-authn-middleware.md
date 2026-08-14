---
title: "Authentication middleware"
sidebar_label: "04 · Authn middleware"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

**Parse session or Bearer JWT, attach `req.user`, else 401. Do not re-teach argon2 or JWT structure here — Node Phase 8.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> **Express ships no authentication of any kind** — its six built-ins are `json`,
> `urlencoded`, `raw`, `text`, `static` and `Router`
> ([express reference](https://expressjs.com/en/5x/api/express/)) — so every line here is
> yours or a package's. `req.user` is **not an Express property**: it exists because
> middleware may *"modify the request and response objects"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)), and Express
> publishes no reserved-name list, so the name is a convention only
> ([Phase 2](../phase-2-middleware/06-mutating-req-res.md)).
> `req.get('Authorization')` is case-insensitive per the
> [request reference](https://expressjs.com/en/5x/api/request/).
> Password hashing, JWT signing and session storage are
> [Node Phase 8](../../../nodejs/pages/phase-8-security/README.md) — deliberately not
> repeated.

```js
export function requireAuth({sessions, tokens}) {
  return async (req, res, next) => {
    try {
      const user = await resolveUser(req, {sessions, tokens});
      if (!user) return res.status(401).json({error: {code: 'UNAUTHENTICATED'}});
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}
```

## Authentication answers exactly one question

*Who is this?* Nothing more. The temptation is to have it also load the user's
permissions, their tenant, their preferences — and each addition makes it slower
and more coupled.

| Question | Layer |
|---|---|
| **Who is this?** | Authentication ([this page](04-authn-middleware.md)) → `req.user` or 401 |
| What may this role do? | RBAC ([page 06](06-rbac-middleware.md)) → 403 |
| May they touch *this row*? | Ownership ([page 07](07-ownership.md)) — in the service |

`req.user` should carry **identity plus whatever the token already proves** — an id,
a role, a tenant id. If establishing it requires a database round trip on every
request, that is a design decision worth making consciously, not a side effect.

## Fail closed, and say the right thing

Three rules, and the third is the one that gets missed:

1. **No credential → 401**, always. Not "continue as anonymous" on a protected route.
2. **Invalid, expired or malformed credential → 401**, with the same body as a
   missing one. Distinguishing "expired" from "invalid" in the response tells an
   attacker their token was once real.
3. **Any error inside the middleware → 401 or 500, never `next()`.** A `try/catch`
   that logs and calls `next()` turns a verification failure into an
   unauthenticated request reaching a handler that assumes `req.user` exists.

```js
export function requireAuth({verifyToken}) {
  return async (req, res, next) => {
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

Note it goes through `next(err)` rather than responding directly — so the envelope
comes from the one error handler
([Phase 5](../phase-5-errors/03-error-contract.md)) and an auth failure looks like
every other failure to a client.

**`WWW-Authenticate` on a 401** is what the specification expects, and matters if
anything generic consumes your API: `res.set('WWW-Authenticate', 'Bearer')`.

## Mounting it: opt-in, not opt-out

The single most consequential line in this phase is where you mount it.

```js
// ✅ opt-in: each protected route names its guard. A new route is public by
//    default — visibly, in the line you are reading.
router.get('/orders', requireAuth(deps), listOrders);

// ⚠️ opt-out: everything below is protected. Convenient, and a route added
//    above this line is silently public.
app.use(requireAuth(deps));
```

Neither is wrong, and the failure modes differ in kind: opt-in forgets to protect,
opt-out accidentally exposes by ordering. **Opt-in is greppable** — you can list
every protected route by searching for `requireAuth`, and a reviewer sees the guard
without knowing the mount order of a file three directories away. Prefer it, and if
you use opt-out, put the public routes *above* it deliberately and comment why.

## Trade-off

Authentication as middleware means one implementation, one place to change the
token format, and a `req.user` every downstream layer can rely on. That is the
right shape and nobody seriously argues otherwise.

The cost is that **`req.user` becomes an invisible dependency**. A service reading
it is coupled to the auth middleware without saying so in its signature — the exact
leak [Phase 7](../phase-7-layering/02-domain-vs-transport.md) warns about. Keep the
attachment at the edge and pass an actor id downward.

The second cost is a genuine decision: **a stateless token avoids a database round
trip and cannot be revoked instantly; a session lookup can be revoked and costs a
round trip per request.** Node Phase 8 covers the trade properly; what belongs here
is knowing that the middleware is where the cost is paid.

## Gotchas

**Symptom:** Requests with an expired token reach handlers as anonymous  
**Cause:** The middleware caught the verification error, logged it, and called `next()`  
**Fix:** A failure in authentication is a 401. Never fall through

**Symptom:** A newly added route is unprotected  
**Cause:** Opt-out mounting, and the route was registered above the `app.use`  
**Fix:** Opt-in per route — then "which routes are protected?" is a grep, not an audit

**Symptom:** `req.user` is undefined inside a service  
**Cause:** The service was called from a job or a test, where no middleware ran  
**Fix:** Pass the actor id as an argument. Services should not read request state

**Symptom:** Attackers learn which tokens were once valid  
**Cause:** Different responses for "expired" and "invalid"  
**Fix:** One code, one message, for every authentication failure

**Symptom:** `Authorization` header not found for lowercase `authorization`  
**Cause:** Manual `req.headers['Authorization']` lookup — the raw object is lowercased  
**Fix:** `req.get('Authorization')`, which is case-insensitive by documentation

**Symptom:** A revoked user keeps working for another hour  
**Cause:** Stateless token with a long expiry and no denylist check  
**Fix:** Short expiry plus refresh, or a revocation check
([page 08](08-tenant-and-logout.md)) — a deliberate choice, not a default

## Interview questions

**★ What does authn middleware put on req?**  
The authenticated principal (`req.user`), not permissions alone.

**★ What should authentication middleware do when token verification throws?**  
Return 401 — with the same code and message as a missing token. Catching, logging and
calling `next()` is the dangerous version: the request continues as anonymous into a
handler that assumes `req.user` exists.

**★ Why prefer mounting it per route rather than globally?**  
Because "which routes are protected?" becomes a grep instead of an audit of mount
order. Global mounting silently exposes any route registered above it, and the guard
is invisible where you read the route.

**Is `req.user` an Express feature?**  
No. Express has no authentication at all and no `user` property — it is a convention
built on middleware's ability to modify the request, with no reserved-name list to
protect it.

**Why should the response body be identical for expired and invalid tokens?**  
Because distinguishing them tells an attacker their token was once real, which is
information they should not get for free.

**Where does the authn/authz boundary sit?**  
Authentication answers "who is this?" and nothing else. What a role may do is RBAC;
whether they may touch a specific row is an ownership check that cannot happen in
middleware at all.


---

← Prev: [Coercion traps](03-coercion-traps.md) · Next → [Cookies and sessions wire-up](05-cookies-sessions-wireup.md)
