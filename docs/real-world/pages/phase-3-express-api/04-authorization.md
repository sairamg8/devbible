---
title: "Authorization"
sidebar_label: "04 · Authorization"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Express 5 docs and OWASP authorization cheat
> sheet. Concept home:
> [Express — RBAC middleware](../../../expressjs/pages/phase-8-validation-authz/06-rbac-middleware/README.md),
> [ownership](../../../expressjs/pages/phase-8-validation-authz/07-ownership/README.md),
> [Node — authz vs authn](../../../nodejs/pages/phase-8-security/04-authentication-vs-authorization.md).

## The problem

[Auth](03-auth/README.md) established *who*; this chapter decides *whether*.
The spec's two rules return: **role is coarse** (may customers do this kind
of thing at all?) and **ownership is fine** (may *this* customer touch
*this* order?). Both run server-side on every request that needs them —
hidden admin buttons are UX, not security — and the failure modes differ:
missing role checks leak admin powers; missing ownership checks are the
classic IDOR, one incremented id away.

## The implementation

Role gates are middleware — they need only `req.user`:

```js
// src/middleware/require.js
import {ApiError} from './errors.js';

export function requireAuth(req, res, next) {
  if (!req.user) return next(new ApiError(401, 'UNAUTHENTICATED',
    'authentication required'));
  next();
}

export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return next(new ApiError(401, 'UNAUTHENTICATED',
      'authentication required'));
    if (req.user.role !== role) return next(new ApiError(403, 'FORBIDDEN',
      'insufficient permissions'));
    next();
  };
}
```

Ownership is **not middleware** — it needs the resource, and fetching it
twice (once to check, once to use) is both a wasted query and a TOCTOU
window. Ownership lives in the query itself:

```js
// db/orders.js (excerpt) — ownership as a WHERE clause
async byIdForUser(orderId, userId) {
  const {rows: [order]} = await q(pool).query(
    `select id, status, address, total_cents, created_at
       from orders where id = $1 and user_id = $2`,
    [orderId, userId],
  );
  return order ?? null;                    // absent and forbidden look identical
},
```

```js
// src/routes/orders.js — the two layers composed
router.get('/orders', requireAuth, async (req, res) => {
  res.json({items: await orders.byUser(req.user.id)});
});

router.get('/orders/:id', requireAuth, validate({params: OrderParams}),
  async (req, res, next) => {
    const order = await orders.byIdForUser(req.valid.params.id, req.user.id);
    if (!order) return next(new ApiError(404, 'NOT_FOUND', 'order not found'));
    res.json(order);
  });

// the admin surface: one gate on the router, ungated handlers inside
// src/routes/admin.js — pseudo-code outline; handlers land in ch. 05–08
export function buildAdminRoutes(deps) {
  const router = express.Router();
  router.use(requireRole('admin'));        // every route below is admin-only
  router.get('/orders', listAllOrders);    // ALL orders — no user_id filter
  router.patch('/orders/:id/status', updateOrderStatus);
  router.patch('/reviews/:id', moderateReview);
  return router;
}
```

The review-writing rule — *bought it, once per purchase* — is the third
authorization shape: neither role nor simple ownership but a **domain
predicate**, and it lives where the schema already put it. The insert joins
the caller's delivered order and lets
[`unique (order_id, product_id)`](../phase-1-database/01-the-schema/02-carts-orders-reviews-outbox.md)
reject duplicates:

```js
async createReview({userId, productId, orderId, rating, body}) {
  const {rows: [review]} = await q(pool).query(
    `insert into reviews (product_id, user_id, order_id, rating, body)
     select $2, $1, o.id, $4, $5
       from orders o
       join order_items oi on oi.order_id = o.id and oi.product_id = $2
      where o.id = $3 and o.user_id = $1 and o.status = 'delivered'
     returning id, status`,
    [userId, productId, orderId, rating, body],
  );
  return review ?? null;                   // not yours / not delivered / no such item
},
```

## The rules

- **404 for ownership failures, 403 for role failures.** "That order exists
  but isn't yours" confirms the id space to an enumerator; `not found`
  reveals nothing. Role failures, by contrast, are honest 403s — "admin
  endpoints exist" is not a secret, and a 404 there would misdirect
  legitimate client debugging.
- **The gate sits on the router, not per-route, for uniform surfaces.** One
  `router.use(requireRole('admin'))` cannot be forgotten on route
  twenty-three; per-route gates are for genuinely mixed routers, which the
  [structure chapter](01-project-structure.md) avoided creating.
- **Services take the acting user as data.** `orders.byIdForUser(id,
  userId)` — the authorization fact travels *into* the query. A service
  that fetches-then-checks in JavaScript re-opens the window the WHERE
  clause closed and invites the check to be skipped by the next caller.
- **No permission matrix until there are permissions.** Two roles and
  ownership cover the spec. The day "support can refund but not edit
  products" arrives, roles become rows (`permissions`, `role_permissions`)
  and `requireRole` becomes `requirePermission` — an additive change *because*
  every check already flows through these two functions and the query
  layer. Premature RBAC frameworks are how two-role apps get twelve tables.

## Gotchas

- **Symptom:** an admin browsing the customer-facing "my orders" page sees
  nothing. **Cause:** `byUser(req.user.id)` — admins have no orders; someone
  "fixes" it by special-casing admin to skip the filter, and now the
  customer endpoint leaks everything to any admin cookie. **Fix:** the
  surfaces stay separate — `/orders` is always scoped to the caller,
  `/admin/orders` is the unscoped view behind the role gate. Never one
  endpoint with a role-dependent filter.
- **Symptom:** IDOR report — customer A fetched customer B's order.
  **Cause:** a new endpoint fetched by id and checked ownership in JS…
  after a refactor moved the check. **Fix:** the convention above is
  mechanical for a reason: repo methods that can return other users' rows
  end in `ForUser` or live in `admin`-prefixed modules; review flags any
  `byId(` call in a customer route.
- **Symptom:** review creation 500s with a unique violation instead of a
  clean error. **Cause:** the constraint fired (second review for the same
  purchase) and nobody mapped `23505`. **Fix:** chapter 09's error mapper
  translates that constraint name to a 409 `ALREADY_REVIEWED` — the
  database enforcing the rule is the design; the API's job is translating
  it.

## Interview questions

1. **★ Why is ownership a WHERE clause and not a middleware?** Middleware
   would need the resource — so it fetches, checks, and passes the row (or
   refetches). Both copies race writes (TOCTOU) and cost a query. `and
   user_id = $2` makes the check and the fetch one atomic read: the
   forbidden case is indistinguishable from the absent case at zero extra
   cost, exactly the response policy anyway.
2. **★ Why 404 rather than 403 when a customer requests someone else's
   order?** A 403 says "this id exists and belongs to someone" — an oracle
   for enumerating the order space (ids are sequential
   [by schema choice](../phase-1-database/01-the-schema/01-conventions-identity-catalog.md),
   and *authorization not obscurity* is what protects them). 404 gives the
   enumerator nothing. The asymmetry with admin 403s is deliberate:
   secrecy protects data, honesty aids debugging, and each surface gets
   the one it needs.
3. **Where does "only verified buyers review, once" belong, and why not in
   the endpoint?** In the insert's join + the unique constraint — the only
   race-free location. An endpoint check ("did they buy it?") reads state
   that can change before the insert; the constraint cannot be raced,
   cannot be forgotten by a second caller, and turns the rule into schema
   a reviewer can read.
4. **How does this design grow into permissions without a rewrite?** Every
   role decision already passes through `requireRole` and admin-scoped
   modules; every ownership decision through `ForUser` queries. Swapping
   `requireRole('admin')` for `requirePermission('orders:write')` backed
   by two tables changes the *predicate*, not the topology. The expensive
   part of authz changes is finding the checks — this design made them
   grep-able from day one.

---

← Prev: [Auth](03-auth/README.md) ·
Next → **Catalog endpoints** *(not written yet)*
