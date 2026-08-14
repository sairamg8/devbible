---
title: "What RBAC cannot do"
sidebar_label: "03 · What RBAC cannot do"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Middleware runs before the resource is loaded, so it can never answer "is this
row yours?" That gap is the most common serious authorization bug in APIs, and it
passes every test written against the happy path.**

> Verified: 2026-08-14 — **no sandbox run and no console block.** The limit is
> structural, not a policy choice: middleware runs in registration order before
> the route handler ([using middleware](https://expressjs.com/en/guide/using-middleware.html)),
> and Express supplies **no** hook that runs after a handler has loaded data —
> `router.param` still runs before the handler
> ([router reference](https://expressjs.com/en/5x/api/router.html#router.param)),
> so it moves the load earlier rather than making authorization later.
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15.5.4 permits **404**
> in place of 403 when a server does not wish to reveal that the target exists —
> the basis for the ownership answer. **The layering, the matrix test and the
> logging guidance are this bible's.**

## The gap, stated exactly

> **Middleware runs before the resource is loaded**, so it can never answer *"is
> this row yours?"*

`requirePermission('orders:read')` confirms the caller may read **orders in
general**. It cannot confirm they may read **order 7**, because at that point
order 7 has not been fetched and nothing in the request knows who owns it. The
only thing present is `req.params.id` — a string the caller chose.

**This is the single highest-consequence gap in most APIs.** A route with a
correct permission check, a valid token, and no ownership check lets any
authenticated user read any record by changing the id:

```
GET /api/orders/7      ✅ mine        — 200
GET /api/orders/8      ⛔ not mine    — 200, because nothing checked
```

🔴 **Every test passes.** The authentication test passes, the permission test
passes, the happy-path integration test passes — they all use ids the test user
owns. The bug is only visible in a test that deliberately asks for someone
else's record, which is the test nobody writes
([Phase 10 · 04](../../phase-10-app-factory/04-auth-in-tests.md)).

RBAC and ownership are **complementary, not alternatives**: the first narrows who
gets through the door, the second decides which rows they may touch
([page 07](../07-ownership/README.md)).

## Why you cannot just load it earlier

The obvious repair is to fetch the record in middleware and check it there.
Express even offers a place — `router.param` runs before the handler for any
route with that parameter:

```js
// ⚠️ this works, and it is a controller wearing middleware's clothes
router.param('orderId', async (req, res, next, id) => {
  req.order = await orders.findById(id);
  if (req.order.userId !== req.user.id) return next(new HttpError(404, 'NOT_FOUND'));
  next();
});
```

It runs, and it costs more than it looks
([Phase 1 · 06](../../phase-1-routing/06-router-param.md)):

- **It loads on every route with that parameter**, including ones that only need
  the id — a query bought for nothing.
- **It hides an I/O dependency in the routing layer.** The handler now silently
  requires that a middleware ran, and its signature says nothing
  ([Phase 2 · 01 · chunk 03](../../phase-2-middleware/01-middleware-contract/03-what-middleware-must-not-do.md)).
- **It cannot express the interesting rules.** "The author, or a support agent
  during the refund window, unless the order is archived" is business logic, and
  business logic in the routing layer is unreachable from a job, a CLI or a
  test.
- **It splits authorization across two layers**, so answering "who may cancel an
  order?" now means reading both.

**Where it does earn its place** is the narrow, uniform case: a tenant-scoped
router where *every* route under it must be scoped identically, and the check is
a comparison rather than a rule
([page 08](../08-tenant-and-logout.md)).

## The division that works

| Check | Needs | Lives in |
|---|---|---|
| Is there a caller? | `req.user` | authn middleware |
| May this role do this kind of thing? | `req.user` + a static map | **authz middleware** |
| May they touch **this record**? | the record | **the service**, at the load |
| Is the state right for this action? | the record + rules | **the service** |

**Middleware for the checks that need only identity; the service for everything
that needs data.** The line is not stylistic — it is where the required
information becomes available. Trying to push resource-aware checks earlier
produces middleware that loads records, which is a controller in disguise
([Phase 7 · 01](../../phase-7-layering/01-controller-service-repository/README.md)).

```js
// ✅ the route declares the capability; the service owns the row-level rule
router.post('/orders/:id/refund',
  requirePermission('orders:refund'),
  ctrl.refund);

// in the service — actor passed in, never read from req
async function refund(orderId, actor) {
  const order = await repo.findById(orderId);
  if (!order) throw new NotFoundError();
  if (!canRefund(order, actor)) throw new NotFoundError();   // not 403 — see page 07
  …
}
```

Passing the actor as an argument is what keeps the rule testable and reusable
([Phase 7 · 02](../../phase-7-layering/02-domain-vs-transport.md)); a service
reading `req.user` is coupled to HTTP without saying so.

## When RBAC itself stops fitting

Roles answer *what kind of thing may this person do*. Some requirements are not
of that shape, and the signal is unmistakable — you find yourself inventing roles
that describe **relationships** rather than jobs:

- "The **owner** of a document may share it" → a relationship, not a role.
- "A manager may approve expenses **for their own reports**" → a relationship
  plus an attribute.
- "Editors may publish **between 9 and 5**, from the office network" → attributes
  of the request, not of the person.

The industry names for the next steps are **ABAC** (decisions from attributes of
the subject, resource, action and environment) and **ReBAC** (decisions from a
graph of relationships — the model behind document-sharing systems). Both are
real, and both are a policy engine with its own storage, evaluation and debugging
story.

🔴 **This bible's recommendation: do not build one early.** The RBAC-plus-service
split above covers the overwhelming majority of APIs, and it keeps every decision
in ordinary code you can read and test. Reach for a policy engine when
**per-record grants become a product feature** — sharing, delegation, customer-
defined roles — because that is the point where the rules stop living in your
code and start living in your data. Until then a policy engine adds a second
system that must agree with the first, and disagreements between them are
security bugs.

## The duplication of intent, honestly

Middleware authorization is declarative and visible: reading the route line tells
you what is required, and one implementation means one place to audit. **A
security control you can grep for is a security control you can verify** — that
is the main argument and it is a strong one.

The cost is real and worth naming: **the permission is asserted at the route,
while the rule it protects lives in the service**, so the two can drift. A route
guarded by `orders:refund` whose service no longer refunds anything is a stale
claim nobody notices, and the reverse — a service rule tightened without the
route guard changing — is the version that bites.

Two mitigations, both cheap:

- **Name the permission after the capability, not the endpoint**
  ([chunk 02](02-permissions-not-roles.md)), so a route move does not invalidate
  it.
- **Test the matrix**, below, so the *effect* of the guards is asserted rather
  than their presence.

## The authorization matrix test

The guards are declarations; what matters is the reachable set. Assert it
directly:

```js
const MATRIX = [
  // route,                        method,   member, support, admin
  ['/api/orders',                  'get',    200,    200,     200],
  ['/api/orders/1/refund',         'post',   403,    200,     200],
  ['/api/orders/1',                'delete', 403,    403,     200],
  ['/api/users',                   'get',    403,    403,     200],
];

for (const [path, method, ...expected] of MATRIX) {
  ROLES.forEach((role, i) => {
    it(`${role} ${method.toUpperCase()} ${path} → ${expected[i]}`, async () => {
      const res = await request(app)[method](path).set(authHeaderFor(role));
      expect(res.status).toBe(expected[i]);
    });
  });
}
```

Why this table rather than unit tests on the guard:

- **It fails on a mounting mistake**, which a unit test of `requirePermission`
  cannot — the guard is correct and simply was not mounted.
- **It reads as policy.** A reviewer who knows nothing about Express can check the
  table against what the product intends.
- **It makes a widening change loud.** Granting `orders:delete` to `support`
  turns a `403` into a `200` in a diff of a file that exists to state those
  answers.

⚠️ **It still does not catch ownership**, because every row uses a record the
test user owns. That test lives with the rule it protects
([page 07](../07-ownership/README.md)).

## Log the denials

A 403 is a security event, and it is the cheapest signal you will ever get about
a misconfigured client, a probing caller, or a permission you got wrong:

```js
logger.warn({actorId: req.user.id, role: req.user.role,
             permission, route: req.route?.path, requestId: req.id},
            'authorization denied');
```

Log the **actor, the permission and the route** — not the token, not the whole
`req.user`, and nothing the caller supplied unescaped
([Phase 5 · 07](../../phase-5-errors/07-error-logging.md)). A burst of 403s from
one actor across many routes is enumeration; a steady trickle from one route is
usually a permission that should have been granted.

## Gotchas

**Symptom:** Any authenticated user can read any record by changing the id
**Cause:** RBAC present, ownership check absent — the classic IDOR
**Fix:** Ownership belongs in the service, next to the load ([page 07](../07-ownership/README.md))

**Symptom:** Authorization tests are green and the API is exposed
**Cause:** Every test uses ids the test user owns
**Fix:** A test that requests another user's record and expects 404

**Symptom:** Middleware grew a database query
**Cause:** A resource-aware check pushed into the layer that runs before the load
**Fix:** Identity-only checks in middleware; anything needing the record in the
service

**Symptom:** A handler breaks when a route is mounted on a different router
**Cause:** It depended on a `router.param` load that only exists under one mount
**Fix:** Load in the controller or service, where the dependency is visible

**Symptom:** A route is guarded by a permission its service no longer implements
**Cause:** Intent duplicated at the route and in the service, drifting
**Fix:** Name permissions after capabilities, and assert the matrix rather than
the guard

**Symptom:** Granting one role a new capability silently widened three others
**Cause:** A hierarchy or wildcard, and no test that states the reachable set
**Fix:** The matrix table — the diff shows a 403 becoming a 200

**Symptom:** Nobody noticed an account probing every endpoint
**Cause:** Denials are not logged
**Fix:** Log actor, permission and route on every 403 — and never the credential

## Interview questions

**★ What can RBAC middleware fundamentally not check?**
Whether this caller may touch **this specific record**. Middleware runs before
the resource is loaded, so ownership is impossible there. That gap is the most
common serious authorization bug in APIs, and it passes every happy-path test
because those tests use records the test user owns.

**★ Why not load the record in `router.param` and check ownership there?**
Because it loads on every route carrying that parameter, hides an I/O dependency
in the routing layer, cannot express rules that involve state or time, and splits
authorization across two layers. It earns its place only for uniform scoping,
such as a tenant check applied identically to every route under a router.

**★ Where exactly is the line between middleware and service authorization?**
Where the required information becomes available. Checks that need only identity
— is there a caller, may this role do this kind of thing — belong in middleware.
Anything that needs the record, or its state, belongs in the service, with the
actor passed as an argument.

**★ When does RBAC stop being the right model?**
When you start inventing roles that describe relationships rather than jobs —
"owner", "manager of this report's author" — or when per-record grants become a
product feature such as sharing. That is ABAC/ReBAC territory, and it means a
policy engine with its own storage and debugging story, so it should be adopted
deliberately rather than early.

**What is the trade-off of doing authorization in middleware at all?**
Visibility versus duplication. The route line declares what is required and there
is one implementation to audit — a control you can grep for. But the assertion
sits at the route while the rule lives in the service, so the two can drift.
Testing the matrix asserts the effect rather than the declaration.

**Why test a role × route matrix instead of the guard itself?**
Because the common failure is not a broken guard but a guard that was never
mounted, and because the table reads as policy — a widening change shows up as a
403 becoming a 200 in a file whose only job is to state those answers.

---

← Prev: [Permissions, not role names](02-permissions-not-roles.md) · Index: [RBAC middleware](README.md) · Next → [Ownership checks](../07-ownership/README.md)
