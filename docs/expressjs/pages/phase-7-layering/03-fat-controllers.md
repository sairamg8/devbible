---
title: "Avoiding fat controllers"
sidebar_label: "03 · Fat controllers"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

**If a handler needs scrolling, logic leaked upward. Push validation and auth to middleware; keep one use-case per handler.**

> Verified: 2026-08-14 — **no sandbox run**; this is design guidance, and Express
> enforces none of it. The mechanism it relies on *is* documented: a route accepts
> **multiple handler functions** in sequence — the docs call these middleware sub-stacks
> and show several functions mounted at one path
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)) — so
> `router.post('/x', authenticate, validate(schema), handler)` is ordinary Express, not a
> pattern requiring a library. Express 5's automatic forwarding of rejected promises
> ([migration guide](https://expressjs.com/en/guide/migrating-5.html)) is what removes the
> `try/catch` that used to pad every handler. Those two facts do most of the slimming.

## Smells

- SQL in the route file  
- 200-line `try/catch` with five status codes  
- Copy-pasted auth checks  

## Fix

Auth middleware → validate middleware → thin handler → service.

## The four jobs a handler actually has

A thin controller does exactly four things, in order, and nothing else:

1. **Read** what the middleware prepared — `req.validated`, `req.user`, `req.params`.
2. **Call** one service method.
3. **Choose** a status.
4. **Map** the result to a DTO.

```js
router.post(
  '/orders',
  authenticate,                 // sets req.user, or 401
  authorize('orders:create'),   // or 403
  validate(createOrderSchema),  // sets req.validated, or 400
  async (req, res) => {
    const order = await orderService.place(req.validated, req.user.id);
    res.status(201).location(`/orders/${order.id}`).json(toOrderDto(order));
  },
);
```

Everything that used to make handlers long has a home elsewhere: **authentication
and authorisation** are middleware, **input validation** is middleware, **error
translation** is the Phase 5 handler, and **business rules** are the service. What
is left cannot help but be short.

Note the missing `try/catch`. Express 5 forwards the rejection, so the handler has
no error branch — that alone removes a third of the bulk from a typical Express 4
controller.

## Why fat controllers are self-perpetuating

Worth naming, because "keep handlers thin" as advice does not survive a deadline.
A fat handler is *locally* the fastest thing to write: everything is in scope, no
new file, no new name. The costs are all deferred and land on other people —
duplicated logic across routes, no unit test without a server, and a merge conflict
magnet.

Two habits keep it from creeping back:

- **A line budget in review.** "Handlers under ~20 lines" is arbitrary and works,
  because it makes the discussion mechanical rather than a matter of taste.
- **One use case per handler.** A handler with a branch that changes what the
  operation *is* — `if (req.body.mode === 'bulk')` — is two endpoints sharing a
  URL. Split the route, not the function.

## Where authorisation actually goes

The one genuinely hard case, and the answer is "both, at different granularities":

| Check | Where | Why |
|---|---|---|
| "Is this caller authenticated?" | Middleware | Same for every route; no domain knowledge |
| "Does this role have this permission?" | Middleware | Static, declarative, readable at the route |
| **"Does this caller own *this* record?"** | **Service** | Needs the record — you cannot know before loading it |

The third row is the one that gets skipped, and it is the highest-consequence bug
in most APIs: a valid token for user A retrieving user B's order because the route
checked the *role* and never the *owner*. Middleware physically cannot do it —
the record has not been loaded yet. It belongs in the service, next to the load
([Phase 8](../phase-8-validation-authz/README.md) covers it in full).

## Trade-off

Pushing work into middleware makes handlers readable and reusable, and puts each
concern in one place. The cost is **indirection**: reading a route no longer tells
you what happens — you have to know what `authenticate` attaches, what `validate`
sets, and what order they run in. A newcomer sees four lines and cannot answer
"where does `req.user` come from?"

That cost is real and worth paying, with one mitigation: keep the middleware chain
**visible at the route**. `router.post('/orders', authenticate, validate(schema), handler)`
declares its dependencies in the line you are already reading. The same middleware
applied invisibly with a global `app.use` several files away gets you the
indirection without the readability.

## Gotchas

**Symptom:** The same ownership check appears in eight handlers, and one is wrong  
**Cause:** Authorisation logic copy-pasted rather than centralised  
**Fix:** Role checks in middleware, ownership checks in the service beside the load

**Symptom:** A handler cannot be tested without starting a server  
**Cause:** Business rules live inside it  
**Fix:** Move the rule to a service. The handler should have nothing worth unit-testing

**Symptom:** `req.validated is undefined`  
**Cause:** The validation middleware was not mounted on that route, or was mounted after
the handler  
**Fix:** Keep the chain explicit at the route so a missing link is visible where you
read it

**Symptom:** One handler serves two operations behind an `if`  
**Cause:** A mode flag in the body  
**Fix:** Two routes. A branch that changes what the request *means* is two endpoints
sharing a URL

**Symptom:** Handlers slimmed down, but every route file imports fifteen middleware  
**Cause:** Over-decomposition — middleware for things used once  
**Fix:** Middleware is for cross-cutting concerns. A one-off transformation can live in
the handler

## Interview questions

**★ Where should RBAC checks live?**  
Route-level middleware or service for multi-resource rules — not duplicated string compares in every handler.

**★ Which authorisation check cannot be middleware, and why?**  
Ownership — "does this caller own *this* record?". Middleware runs before the record
is loaded, so it cannot know. It belongs in the service, next to the load, and
skipping it is how one user reads another's data with a perfectly valid token.

**★ What are the only four things a controller should do?**  
Read what middleware prepared, call one service method, choose a status, map to a
DTO. Anything else has a home somewhere better.

**Why do handlers get fat even on teams that know better?**  
Because inline is locally fastest and all the costs are deferred onto other people.
A mechanical rule in review — a line budget — works where taste does not.

**What did Express 5 change about controller size?**  
Rejected promises forward to error middleware automatically, so the `try/catch` that
wrapped every async handler in Express 4 is gone. That is a third of the bulk of a
typical old controller.


---

← Prev: [Domain vs transport](02-domain-vs-transport.md) · Next → [DI without a framework](04-di-without-framework.md)
