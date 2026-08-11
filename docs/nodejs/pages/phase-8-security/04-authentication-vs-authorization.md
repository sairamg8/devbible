---
title: "Authorization vs authentication — enforced server-side, always"
sidebar_label: "04 · Authz vs authn"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**.

**Authentication asks who you are. Authorization asks what you may do.** Systems get
the first right and the second wrong, because authentication happens once at a chokepoint
and authorization has to happen at every single object you touch.

## The distinction, and why it matters

```js
// authentication — one place, at the edge
const session = await sessions.get(req.cookies.sid);
if (!session) return res.status(401).json({error: 'not authenticated'});
req.user = await users.findById(session.userId);
```

```js
// authorization — every handler, every object
const order = await orders.findById(req.params.id);
if (!order) return res.status(404).end();
if (order.userId !== req.user.id) return res.status(404).end();   // not 403 — see below
```

`401` means *I do not know who you are*. `403` means *I know, and no*. Getting these
backwards makes clients retry logins that will never help.

**Authentication is a chokepoint; authorization is not.** You can wrap authentication in
one middleware and be done. There is no middleware that knows whether *this* user may
read *that* invoice — that check belongs next to the data, in every handler, forever.
Any design that promises otherwise is hiding the check, not removing it.

## The failure that dominates real breaches

Broken object-level authorization — the API knows who you are and never checks whether
the record is yours:

```js
// authenticated, and completely broken
app.get('/api/invoices/:id', requireAuth, async (req, res) => {
  const invoice = await invoices.findById(req.params.id);
  res.json(invoice);                       // any logged-in user reads any invoice
});
```

Change the id in the URL and you have someone else's data. It is trivially discoverable,
it needs no tooling, and it is consistently near the top of the OWASP API list.

The fix is to make ownership part of the query rather than a separate check:

```js
// the scope is in the WHERE clause — you cannot forget it later
const invoice = await invoices.findByIdForUser(req.params.id, req.user.id);
if (!invoice) return res.status(404).end();
```

That is a repository method
([Phase 6, page 10](../phase-6-data-access/10-repository-pattern.md)), and it is
strictly better than an `if` after the fetch, because the unscoped version stops being
reachable. A code review can then ask one question: *does any query in this file run
without a tenant or owner predicate?*

**Return `404`, not `403`, for objects that are not yours.** A `403` confirms the record
exists, which leaks the very thing you are protecting — invoice numbering, user counts,
whether an email is registered. Reserve `403` for actions where existence is not a
secret.

## Where the check must live

**Server-side. Always.** A hidden button is not authorization; nor is a disabled form
field, a client-side route guard, or a `role` in the Redux store. Every one of them is
advisory decoration over an endpoint that must make the decision itself.

The same applies to anything the client sends you:

```js
// no — the client says it is an admin
if (req.body.role === 'admin') { … }

// no — the JWT was issued before the demotion (page 02)
if (req.user.claims.roles.includes('admin')) { … }

// yes — current state, from your database
const roles = await roles.forUser(req.user.id);
```

That middle case is the subtle one. A token's claims are a **snapshot from issue time**.
If authorization data lives in the token, a demoted admin keeps their powers until it
expires ([page 02](./02-sessions-vs-jwt.md)). Put identity in the token; look
authorization up.

## Models, in the order you should reach for them

**Ownership** — `resource.userId === user.id`. Most applications need nothing else, and
it belongs in the query as above.

**RBAC** — roles carry permissions; users have roles. Reach for it when "who may do
what" stops being expressible per-object:

```js
const can = (user, permission) => user.permissions.has(permission);
if (!can(req.user, 'invoice:refund')) return res.status(403).end();
```

Name permissions after **actions**, not screens — `invoice:refund`, not `canSeeAdminPage`.
Screens get redesigned; actions do not.

**ABAC** — decisions from attributes: department, amount, time, ownership together. Real
systems drift here naturally ("managers may refund up to £500 in their own region"). It
is more expressive and considerably harder to audit; do not start here.

**Multi-tenancy is authorization too**, and the strictest form. Every query carries a
tenant predicate, no exceptions. Consider enforcing it in the database with row-level
security so an application bug cannot cross the boundary.

## Denying by default

Authorization should fail closed. The shape that survives contact with a growing team:

```js
// every route declares what it needs; the router refuses to mount one that doesn't
router.get('/invoices/:id', authorize('invoice:read'), handler);
```

A route with no declared permission should **throw at startup**, not default to public.
The alternative — a route added on a Friday with no check — is the single most common way
authorization regresses, and a test that enumerates routes and asserts each has a policy
catches it for almost no effort.

## Gotchas

**Symptom:** A user reads another user's record by changing the id in the URL
**Cause:** Authentication checked, ownership not.
**Fix:** Put the owner in the `WHERE` clause; return `404`.

**Symptom:** `403` tells an attacker which records exist
**Cause:** Using `403` where existence is itself sensitive.
**Fix:** `404` for objects that are not theirs.

**Symptom:** A demoted admin keeps admin access for 15 minutes
**Cause:** Roles read from token claims issued before the change.
**Fix:** Identity in the token, authorization from the database.

**Symptom:** The API allows what the UI hides
**Cause:** Client-side checks treated as enforcement.
**Fix:** Enforce server-side; treat UI state as a hint.

**Symptom:** A new endpoint shipped with no authorization at all
**Cause:** Checks are per-handler and easy to omit.
**Fix:** Require a declared policy per route; fail at startup if missing, and test for it.

**Symptom:** One tenant sees another's data after a "small" query change
**Cause:** A hand-written query without the tenant predicate.
**Fix:** Scoped repository methods, and row-level security underneath.

**Symptom:** `401` returned to a logged-in user
**Cause:** `401` and `403` swapped.
**Fix:** `401` unauthenticated, `403` authenticated but not permitted.

## Interview questions

**★ What is the difference between authentication and authorization?**
Authentication establishes identity — who you are. Authorization decides what that
identity may do. The practical difference is shape: authentication is one chokepoint you
can put in middleware; authorization is a decision at every object, which is why it is
the one that gets forgotten.

**★ What is broken object-level authorization?**
The endpoint verifies you are logged in but never checks the record belongs to you, so
changing an id in the URL returns someone else's data. The durable fix is to make
ownership part of the query rather than a check after it — an unscoped fetch should not
be reachable from the handler.

**★ Should you return 403 or 404 for a record that is not yours?**
`404`. A `403` confirms the record exists, which leaks exactly what you are protecting.
Use `403` only where existence is not itself sensitive.

**★ Why not put roles in the JWT?**
Because claims are a snapshot from issue time. A demoted user keeps their permissions
until the token expires, and you cannot revoke it. Keep identity in the token and read
authorization from current state.

**Is hiding a button in the UI authorization?**
No. It is a usability affordance. Anyone can call the endpoint directly, so every check
the UI implies must exist on the server independently.

**How do you stop a new endpoint shipping without a check?**
Make the policy declaration mandatory at the route level and fail at startup when it is
missing, then add a test that enumerates routes and asserts each has one. Relying on
reviewers to notice an absence does not scale.

**When do you move from ownership checks to RBAC?**
When permissions stop being expressible as "is this mine" — shared resources, staff
actions, delegated access. Name permissions after actions rather than screens so the
model survives a redesign.

---

← Prev: [Where to store tokens](./03-token-storage.md) · Next → [Session management](./05-session-management.md)
