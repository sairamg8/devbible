---
title: "Multi-tenant scoping and logout"
sidebar_label: "08 · Tenant · logout"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

**Force `tenantId` from identity, never from raw body alone. Logout clears cookies / hits revocation — storage is Node/Redis.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> The one hard Express fact on this page is the logout footgun: **`res.clearCookie` must
> be given the same options the cookie was set with**, because a cookie is identified by
> name *plus* `path` (default `"/"`) and `domain`
> ([response reference](https://expressjs.com/en/5x/api/response/)) — clear it with
> different values and the original survives untouched. Everything else is design:
> Express has no tenancy model and no session revocation. Denylist storage, token
> lifetimes and refresh rotation are
> [Node Phase 8](../../../nodejs/pages/phase-8-security/README.md) and the Redis track.

Optional auth middleware enriches `req.user` when a token is present but does not 401 when absent — useful for public+personalized routes.

## Tenant scope comes from identity, never from input

The rule is one line and the reason is worth stating precisely: **a client can send
any `tenantId` it likes.** If that value reaches a query, the caller chooses whose
data they read.

```js
// ⛔ tenant hopping — the body decides the scope
const rows = await repo.listOrders(req.body.tenantId);

// ⛔ still wrong — a query parameter is no more trustworthy
const rows = await repo.listOrders(req.query.tenantId);

// ✅ the token decides the scope; the request cannot influence it
const rows = await repo.listOrders(req.user.tenantId);
```

Two strengthenings worth having:

- **Never accept a tenant id in a schema.** If it is not in the validation schema,
  it cannot arrive through the parse output at all
  ([page 01](01-validate-at-boundary.md)) — the boundary removes the field rather
  than trusting a later check.
- **Make it structurally impossible to forget.** Repository methods that require a
  tenant id, or a database-level control such as row-level security with the tenant
  set per transaction ([Phase 7](../phase-7-layering/07-transaction-middleware.md)),
  turn "someone remembered" into "the query cannot run otherwise".

This is the same shape of defence as [ownership](07-ownership.md), one level up:
scope the data access, do not audit each call site.

## Logout has to clear both halves

Logout is where the stateless/stateful choice presents its bill.

| Auth style | What logout must do |
|---|---|
| Server session | Destroy the session server-side **and** clear the cookie. Clearing only the cookie leaves a valid session id that a copied cookie can still use |
| Stateless JWT | Clear the cookie **and** add the token id to a denylist until its natural expiry — otherwise the token keeps working |

The honest framing: **a stateless token cannot be revoked, only refused.** Every
revocation mechanism adds a lookup that reintroduces the state the token was chosen
to avoid. That is a legitimate trade — short expiry plus refresh rotation keeps the
lookup off the common path — but it should be a decision, not a surprise
discovered during an incident.

And the mechanical trap:

```js
res.cookie('sid', value, {httpOnly: true, sameSite: 'lax', path: '/app'});
res.clearCookie('sid');                        // ⛔ clears a DIFFERENT cookie
res.clearCookie('sid', {path: '/app'});        // ✅ same identity
```

## Optional auth: the shape that fails safe

A public route that personalises when a token is present is a real requirement —
and the middleware that serves it is one line away from being an authentication
bypass.

```js
export function optionalAuth({verifyToken}) {
  return async (req, res, next) => {
    const [scheme, token] = (req.get('Authorization') ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) return next();   // anonymous — fine

    try {
      req.user = await verifyToken(token);
    } catch {
      return next(new HttpError(401, 'UNAUTHENTICATED'));  // ← the important line
    }
    next();
  };
}
```

**A present-but-invalid token is a 401, not anonymous.** Falling through on
verification failure means an expired or forged token is treated exactly like no
token — which is fine on a genuinely public route and catastrophic the day someone
mounts this middleware on a route that assumes `req.user` is trustworthy.

Downstream, every handler behind `optionalAuth` must treat `req.user` as
**possibly undefined**. Mixing optional and required auth across a router is how a
handler ends up reading `req.user.id` on an anonymous request.

## Trade-off

Deriving tenancy from identity removes a whole vulnerability class and costs
flexibility: legitimate cross-tenant operations — support tooling, admin consoles,
data migrations — now need explicitly separate, privileged paths rather than a
parameter. That extra code is deliberate; a support tool that reads any tenant
should look different from a normal read.

For logout, server sessions give you real revocation at the cost of a lookup per
request; stateless tokens give you speed and a revocation story that is always a
compromise. **If instant revocation matters — an admin console, anything financial
— choose sessions and stop fighting the token model.**

## Gotchas

**Symptom:** A user reads another tenant's data by changing a field in the request  
**Cause:** `tenantId` taken from body or query  
**Fix:** Scope from `req.user`, and keep the field out of the schema entirely

**Symptom:** Logout appears to work but the session still functions  
**Cause:** `clearCookie` without the original `path`/`domain`, so a different cookie was
cleared  
**Fix:** Pass identical options to `clearCookie`

**Symptom:** A stolen JWT keeps working after the user logs out  
**Cause:** Stateless tokens are not revocable by clearing a cookie  
**Fix:** Denylist until expiry, or short expiry with refresh rotation — a decision to make
before the incident

**Symptom:** An expired token behaves as anonymous instead of failing  
**Cause:** `optionalAuth` swallowing verification errors  
**Fix:** Absent token → anonymous; **invalid token → 401**

**Symptom:** `Cannot read properties of undefined (reading 'id')` on a public route  
**Cause:** A handler behind `optionalAuth` assuming `req.user` exists  
**Fix:** Treat `req.user` as optional everywhere that middleware is mounted

**Symptom:** A new query forgets the tenant filter  
**Cause:** Tenancy enforced by convention rather than structure  
**Fix:** Repository signatures that demand a tenant id, or row-level security scoped per
transaction

## Interview questions

**★ Why ignore client-supplied tenantId?**  
Tenant hopping / IDOR if trusted.

**★ How do you make tenant scoping impossible to forget rather than merely required?**  
Keep the field out of the validation schema so it cannot arrive, and put the tenant id
in the repository signature — or enforce it in the database with row-level security
scoped per transaction. Convention plus review is the weak version.

**★ Why does clearing a cookie sometimes not log a user out?**  
Two reasons. Mechanically, `clearCookie` must repeat the original `path` and `domain`
or it clears a different cookie. Structurally, with a stateless JWT the cookie is not
the credential's only home — the token itself remains valid until it expires.

**★ What is the dangerous mistake in optional-auth middleware?**  
Treating an invalid token as anonymous. Absent means anonymous; **present but invalid
means 401**. Falling through turns a forged or expired token into an unauthenticated
request that some downstream route may trust.

**What does logout have to do for a session versus a JWT?**  
A session: destroy it server-side and clear the cookie. A JWT: clear the cookie and
denylist the token id until expiry — because a stateless token cannot be revoked, only
refused.

**When would you choose sessions over stateless tokens?**  
When instant revocation matters — admin tooling, financial operations, anything where
"logged out" must mean immediately. Every JWT revocation mechanism reintroduces the
lookup the token was chosen to avoid.

---

← Prev: [Ownership checks](07-ownership.md) · Next → [Type inference](09-type-inference.md)
