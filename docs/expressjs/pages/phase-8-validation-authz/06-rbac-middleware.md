---
title: "RBAC middleware"
sidebar_label: "06 · RBAC"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

**Role checks after authentication. Fail closed with 403 — not 401.**

> Verified: 2026-08-14 — **no sandbox run**. **Express has no authorization primitives**:
> no roles, no permissions, no guards. The factory below is the documented
> *"configurable middleware"* shape — a function taking options and returning middleware
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)) — and
> `req.user` is a convention set by [page 04](04-authn-middleware.md), not an Express
> property. The status semantics are
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html): **401 means the request lacks
> valid authentication credentials** (and the response must carry `WWW-Authenticate`),
> while **403 means the server understood the request and refuses to authorise it** —
> which is why re-authenticating does not help a 403.

```js
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({error: {code: 'UNAUTHENTICATED'}});
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({error: {code: 'FORBIDDEN'}});
    }
    next();
  };
}
```

## Check permissions, not role names

`requireRole('admin')` reads well and ages badly. The moment a second role needs
the same capability, every route mentioning `'admin'` has to be found and edited —
and the ones that are missed become the bug.

```js
// ⛔ the route knows about roles
router.delete('/orders/:id', requireRole('admin', 'support'), handler);

// ✅ the route knows about capabilities; roles map to them in one place
router.delete('/orders/:id', requirePermission('orders:delete'), handler);

const ROLE_PERMISSIONS = {
  admin:   ['orders:delete', 'orders:read', 'users:manage'],
  support: ['orders:delete', 'orders:read'],
  member:  ['orders:read'],
};
```

The route now states **what it protects** rather than **who happens to have
access**, which is also the more reviewable statement — `orders:delete` tells a
reader the consequence, `admin` does not. Adding a role becomes one line in the map
instead of a search across the codebase.

This is worth doing on day one. Retrofitting it means auditing every route, which
is precisely the work nobody has time for.

## What RBAC cannot do

The critical limit, and the reason [page 07](07-ownership.md) exists:

> **Middleware runs before the resource is loaded**, so it can never answer "is this
> row yours?"

`requirePermission('orders:read')` confirms the caller may read *orders in general*.
It cannot confirm they may read *order 7*, because at that point order 7 has not
been fetched and nothing knows who owns it.

**This is the single highest-consequence gap in most APIs.** A route with a correct
permission check, a valid token, and no ownership check lets any authenticated user
read any record by changing the id — and it passes every test written against the
happy path.

RBAC and ownership are complementary, not alternatives: the first narrows *who gets
through the door*, the second decides *which rows they may touch*.

## Fail closed, everywhere

Three habits, all of which are the difference between a bug and a breach:

1. **Unknown role → deny.** `ROLE_PERMISSIONS[req.user.role] ?? []` — an empty list,
   never a permissive default. A typo in a role name must lock someone out, not let
   them in.
2. **Missing `req.user` → 401, not a crash.** Reaching `requirePermission` without
   authentication means the chain is wrong; answer 401 rather than throwing on
   `undefined.role`.
3. **New routes are protected by default.** If your framework of guards makes it
   possible to forget one, that is the design to fix — see the opt-in argument on
   [page 04](04-authn-middleware.md).

## Trade-off

Middleware authorisation is declarative and visible: reading the route line tells
you what is required, and one implementation means one place to audit. That
visibility is the main argument, and it is a strong one — a security control you
can grep for is a security control you can verify.

The costs are two. **Coarse granularity** — anything needing the resource cannot
live here at all. And **duplication of intent** — the permission is asserted at the
route, while the rule it protects lives in the service, so the two can drift.

The workable division: **middleware for the checks that need only identity, the
service for everything that needs data.** Trying to push resource-aware checks into
middleware produces middleware that loads records, which is a controller in
disguise.

## Gotchas

**Symptom:** Any authenticated user can read any record by changing the id  
**Cause:** RBAC present, ownership check absent — the classic IDOR  
**Fix:** Ownership belongs in the service, next to the load ([page 07](07-ownership.md))

**Symptom:** A role check returns 401 and the client loops trying to re-authenticate  
**Cause:** 401 used for an authorisation failure  
**Fix:** 403 — the credentials were fine, the permission was not. 401 tells a client to
retry with new credentials, which cannot help

**Symptom:** A typo in a role name grants access  
**Cause:** A permissive default in the lookup  
**Fix:** Unknown role → empty permission list. Fail closed

**Symptom:** Adding a role means editing forty routes  
**Cause:** Routes checking role names instead of permissions  
**Fix:** `requirePermission('orders:delete')` and one role→permission map

**Symptom:** `Cannot read properties of undefined (reading 'role')`  
**Cause:** The authorisation middleware ran without authentication before it  
**Fix:** Guard for missing `req.user` and answer 401. The crash is a symptom of a broken
chain

**Symptom:** A permission check passes in tests and fails in production for admins  
**Cause:** Roles seeded differently per environment, or case sensitivity  
**Fix:** Normalise role values at the boundary; test the deny path, not just the allow path

## Interview questions

**★ 401 vs 403 after a role check fails?**  
403 when identity is known; 401 when missing.

**★ Why check permissions rather than role names in routes?**  
Because a role is *who*, a permission is *what is protected*. Checking roles means
every capability change is a search across routes; checking permissions makes it one
line in a map — and the route line becomes self-documenting.

**★ What can RBAC middleware fundamentally not check?**  
Whether this caller may touch **this specific record**. Middleware runs before the
resource is loaded, so ownership is impossible there. That gap is the most common
serious authorisation bug in APIs, and it passes every happy-path test.

**Why is returning 401 for an authorisation failure harmful, not just imprecise?**  
401 tells the client its credentials were rejected, so a well-behaved client
re-authenticates and retries — a loop that cannot succeed, because the credentials
were never the problem.

**What does "fail closed" mean here concretely?**  
An unknown role resolves to no permissions; a missing `req.user` is a 401 rather than
a crash; and a new route without a guard should be unreachable rather than open. Every
uncertainty resolves toward denial.


---

← Prev: [Cookies and sessions wire-up](05-cookies-sessions-wireup.md) · Next → [Ownership checks](07-ownership.md)
