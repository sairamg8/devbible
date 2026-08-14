---
title: "Designing a resource surface"
sidebar_label: "03 · Designing a surface"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**One resource, end to end: the routes, the canonical URL, the representation,
and the Express shape that holds it — a router per resource, mounted once, taking
its dependencies as arguments.**

> Verified: 2026-08-14. The Express mechanics are established and cited inline —
> a router as a mountable mini-app and `mergeParams` from `router@2.2.0`
> ([Phase 1 · 03](../../phase-1-routing/03-router-composition/README.md)),
> `res.location` and the 201 shape from `express@5.2.1`'s `lib/response.js`
> ([Phase 4 · 01](../../phase-4-responses/01-res-methods/README.md)), both in
> `sandbox/express-verify/node_modules/`. Status semantics are
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §15; the `Link` header is
> [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288.html). **No sandbox run backs
> this page and it carries no console block.** The design below is **this bible's
> guidance** — Express supplies none of it.

## One resource, completely

```js
// routes/orders.js
export default function ordersRouter({orders, logger}) {
  const router = express.Router();

  router.get('/',        listOrders);
  router.post('/',       validate(createOrder), createOrderHandler);
  router.get('/:orderId',    getOrder);
  router.put('/:orderId',    validate(replaceOrder), replaceOrderHandler);
  router.patch('/:orderId',  validate(patchOrder),   patchOrderHandler);
  router.delete('/:orderId', deleteOrder);

  router.post('/:orderId/cancel', cancelOrder);        // an action, named honestly
  router.use('/:orderId/items', itemsRouter({orders}));  // a sub-collection

  return router;
}

// app.js
app.use('/api/v1/orders', ordersRouter(deps));
```

Five decisions in that file, each of which is a mistake somewhere else:

- **`:orderId`, not `:id`.** A nested router with `mergeParams` and a bare `:id`
  silently takes the child's value
  ([Phase 1 · 03 · chunk 02](../../phase-1-routing/03-router-composition/02-mergeparams-and-isolation.md)).
- **The prefix lives at the mount**, not in the routes, so the same router serves
  `/api/v1/orders` and a later `/api/v2/orders` unchanged.
- **Dependencies are an argument.** A module-level `createPool()` opens a socket
  at *import* time, which is how a test suite ends up holding real connections
  ([Phase 7 · 04](../../phase-7-layering/04-di-without-framework.md)).
- **Validation is per route**, because the schema differs per operation — `PUT`
  requires every field, `PATCH` requires none.
- **The action route is a `POST` and it is named `cancel`**, not disguised as a
  status field write ([chunk 02](02-when-rest-stops-fitting.md)).

## The status and body for each

| Route | Success | Body | Headers |
|---|---|---|---|
| `GET /orders` | 200 | a page — never a bare array, see below | `Link` for pagination |
| `POST /orders` | **201** | the created resource | **`Location`** |
| `GET /orders/:id` | 200 | the resource | `ETag`, `Cache-Control` |
| `PUT /orders/:id` | 200 | the new state | |
| `PATCH /orders/:id` | 200 | the new state | |
| `DELETE /orders/:id` | **204** | none — `res.send` strips it anyway | |
| `POST /orders/:id/cancel` | 200 or **202** | the new state, or an id to poll | |

```js
res.status(201)
   .location(`${req.baseUrl}/${order.id}`)
   .json(present(order));
```

Two details in those three lines. **`req.baseUrl`, not a hard-coded prefix** — the
router does not know where it is mounted, and a constant duplicates the mount
path in a second place. And **returning the created resource** saves the client a
round trip for the one thing it could not compute: the id.

🔴 **A list endpoint must not return a bare array.** `[{…}, {…}]` has nowhere to
put pagination, a total, or a warning, so adding any of them later is a breaking
change. Wrap it from day one:

```json
{"data": [ … ], "page": {"next": "eyJpZCI6…", "limit": 20}}
```

That decision costs nothing on day one and cannot be made later
([Phase 6 · 03](../03-pagination/README.md)).

## The representation is not the row

```js
export const present = (order) => ({
  id: order.id,
  status: order.status,
  total: {amount: order.total_cents, currency: order.currency},
  createdAt: order.created_at.toISOString(),
});
```

**One function per resource, and every field named explicitly.** The alternative —
`res.json(row)` — makes the API shape equal to the table schema, so the next
migration that adds `internal_notes` or `password_hash` ships it
([Phase 4 · 01 · chunk 03](../../phase-4-responses/01-res-methods/03-choosing-and-shaping.md)).

Four conventions worth fixing once, because they are all breaking changes later:

| Decision | This bible's default | Why |
|---|---|---|
| Field casing | `camelCase` in JSON, whatever the database uses internally | The presenter is the translation layer; leaking `snake_case` couples the API to the schema |
| Dates | **ISO 8601 strings, UTC** | Unambiguous, sortable as text, and every client can parse it. Epoch seconds vs milliseconds is a recurring bug |
| Money | an **integer minor unit plus a currency** | Never a float. `0.1 + 0.2` is the canonical demonstration |
| Absent values | pick **always-null** or **always-omitted**, and enforce it in the presenter | `JSON.stringify` drops `undefined` and keeps `null`, so a database `NULL` and a missing field look different by accident |

## Canonical URLs and links

**One canonical URL per resource**, and every other route redirects to it. Two
independently-implemented routes returning the same resource is how the shapes
drift apart.

Where a client needs to navigate, give it the URL rather than making it build
one:

```js
res.links({next: `${req.baseUrl}?cursor=${next}`});   // RFC 8288 Link header
```

`res.links` appends to any existing `Link`, so pagination and other relations
coexist ([Phase 4 · 02 · chunk 02](../../phase-4-responses/02-status-and-headers/02-headers-and-timing.md)).
How far to take that — links for every action, HATEOAS proper — is
[Phase 6 · 11](../11-hypermedia.md); the minimum that is always worth it is
pagination cursors and a `Location` on creates.

## Writing the surface down before building it

The route table is short enough to review as a table, and reviewing it is far
cheaper than reviewing the implementation:

| Method | Path | Auth | Status | Idempotent |
|---|---|---|---|---|
| GET | `/orders` | user | 200 | ✓ |
| POST | `/orders` | user | 201 | ✗ — needs an idempotency key |
| GET | `/orders/:orderId` | owner | 200 / 404 | ✓ |
| DELETE | `/orders/:orderId` | owner | 204 / 404 | ✓ |
| POST | `/orders/:orderId/cancel` | owner | 200 / 409 | ✗ |

Four things fall out of a table like that which are invisible in code: **the
non-idempotent rows** are exactly the ones needing idempotency keys
([Phase 6 · 06](../06-idempotency-keys.md)); **the "owner" rows** are exactly the
ones needing a scoped query rather than a load-then-compare
([Phase 8 · 07](../../phase-8-validation-authz/07-ownership.md)); the 404s show
where you have decided existence is hidden; and the missing rows are obvious.

Then generate or hand-write the OpenAPI from the same table, so the contract is
stated once ([Phase 6 · 08](../08-openapi.md)).

## Trade-off

Designing the whole surface up front is slower than adding endpoints as they are
needed, and it risks modelling things nobody asks for.

**What makes it worth it is that URL shape and response shape are the two
decisions you cannot revise cheaply.** Internals can be rewritten; a published
URL and a field name are contracts, and changing either needs a version
([Phase 6 · 05](../05-versioning.md)). Spending an hour on the route table before
the first handler is the cheapest hour in the project.

The compromise that works: **design the resource, implement one endpoint.** Fix
the naming, the presenter, the envelope and the error codes on the first route,
then the rest are mechanical.

## Gotchas

**Symptom:** Adding pagination to a list endpoint breaks every client
**Cause:** It returned a bare array, so there was nowhere to add metadata
**Fix:** Wrap list responses in an object from the first commit. It is free then
and impossible later

**Symptom:** `Location` on a 201 points at the wrong path after a remount
**Cause:** A hard-coded prefix instead of `req.baseUrl`
**Fix:** Build it from `req.baseUrl` — the router does not know its own mount, and
the constant duplicated it

**Symptom:** A new database column appears in the API
**Cause:** `res.json(row)`
**Fix:** A presenter per resource, plus a test asserting the exact response key
set

**Symptom:** Two clients disagree about whether a timestamp is seconds or
milliseconds
**Cause:** Numeric epoch timestamps
**Fix:** ISO 8601 strings in UTC. Unambiguous and self-describing

**Symptom:** A currency total is off by a cent after a discount
**Cause:** Floating-point money
**Fix:** Integer minor units plus a currency code, converted only for display

**Symptom:** The same resource has two URLs with slightly different fields
**Cause:** `/orders/7` and `/users/42/orders/7` implemented independently
**Fix:** One canonical route; the other redirects

## Interview questions

**★ Why must a list endpoint never return a bare array?**
Because there is nowhere to put pagination, a total or a warning, so adding any
of them is a breaking change. Wrapping in an object costs nothing on day one and
cannot be retrofitted without a version bump.

**★ What should a `POST /orders` return?**
201, the created resource, and a `Location` header built from `req.baseUrl` plus
the new id. The id is the one thing the client could not compute, so returning it
saves a round trip — and `req.baseUrl` rather than a constant because the router
does not know where it is mounted.

**★ Why a presenter function per resource?**
Because `res.json(row)` makes the API shape equal to the table schema, so the
next migration ships whatever it added. The presenter is also where casing, date
format and null-versus-absent are enforced, all of which are breaking changes if
they drift.

**★ What does a route table tell you that the code does not?**
Which rows are non-idempotent — those need idempotency keys; which rows are
owner-scoped — those need a scoped query rather than a comparison after loading;
where you decided a 404 hides existence; and which rows are missing.

**How should money and dates be represented?**
Money as an integer minor unit plus a currency code, never a float. Dates as ISO
8601 strings in UTC — unambiguous, sortable as text, and free of the
seconds-versus-milliseconds bug that numeric epochs invite.

**If you can only design one endpoint carefully, which?**
The first one. Fix the naming convention, the presenter, the response envelope
and the error codes there; every subsequent route is then mechanical, and all
four of those are decisions you cannot revise without a version.

---

← Prev: [When REST stops fitting](02-when-rest-stops-fitting.md) · Index: [REST resources](README.md) · Next topic → [Status mapping](../02-status-mapping/README.md)
