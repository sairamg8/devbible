---
title: "REST resource modeling"
sidebar_label: "01 · REST resources"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Resources are nouns. Collections are lists of them. Prefer `/orders/12/items` over `/getOrderItems`.**

> Verified: 2026-08-14 — **no sandbox run**, and deliberately **not an Express question**.
> Express has no resource model: it matches paths to handlers and stops there. Nothing on
> this page is enforced by the framework, which is exactly why the discipline has to come
> from you. The mechanics behind the URLs are Express's, and they are documented —
> mounting a router at a prefix, and `req.params` for the id segments
> ([routing guide](https://expressjs.com/en/guide/routing.html)). The naming conventions
> are **this bible's guidance**, informed by common REST practice; treat them as
> defaults with reasons, not rules with citations.

## Modeling

| Style | Example | When |
|---|---|---|
| Collection | `GET /users` | List + create (`POST /users`) |
| Item | `GET /users/:id` | Read/update/delete one |
| Sub-resource | `/users/:id/orders` | Owned hierarchy |
| Action (RPC) | `POST /payments/:id/refund` | Verb is the product |

RPC-style routes are fine when the domain is an action, not a thing — name them
honestly instead of inventing fake nouns.

## How deep should a URL nest?

The honest answer is **one level, usually**. Nesting expresses ownership, and one
level says everything you need:

```text
/users/42/orders          ← orders belonging to user 42     ✅
/users/42/orders/7        ← ambiguous: is order 7 scoped, or global?
/users/42/orders/7/items/3/refunds   ← nobody can use this
```

Once you have the order id, the user id adds nothing — `/orders/7` identifies it
just as well, and the authorisation check is the same either way. The rule that
survives contact with real APIs:

- **Nest to reach a collection** (`/users/42/orders` — "which orders?").
- **Go flat to reach an item** (`/orders/7` — the id is already unique).

Deep nesting also makes every URL a compound key, so a client must remember the
whole ancestry to build a link, and every route needs `mergeParams`
([Phase 1](../phase-1-routing/03-router-composition.md)) to see the ids above it.

## Plural, singular, and the small decisions

They are trivial individually and expensive in aggregate, because inconsistency
is what clients pay for:

| Decision | Pick | Why |
|---|---|---|
| Plural or singular collections | **Plural** — `/users` | A collection is many things; `/user/42` reads as "the user" and then `/user` has no meaning |
| Casing in paths | **kebab-case** — `/order-items` | URLs are case-sensitive after the host; snake and camel both invite mistakes |
| Trailing slashes | **No** | Express treats `/users` and `/users/` the same by default (`strict routing` is unset — [Phase 0](../phase-0-express-basics/05-application-settings.md)), so pick one and let the other redirect |
| Singleton resources | `/me`, `/settings` | Some resources genuinely have one instance per caller. Do not invent `/users/me/settings/1` |

Whichever you choose, choose once. The cost of `/order-items` next to
`/orderStatuses` is paid by every client developer, forever.

## Trade-off

Deep hierarchies mirror the domain and complicate authorization and caching.
Flatten when joins explode.

The deeper trade is **REST purity versus honest naming**. Modelling everything as
a noun produces URLs like `POST /orders/7/cancellation` for what is plainly an
action, and readers have to decode the euphemism. An RPC-style
`POST /orders/7/cancel` says what it does. You lose uniform-interface elegance and
gain a route anyone can read.

Use nouns wherever the operation really is CRUD, and stop pretending when it is
not. A payment refund, a password reset and a batch re-index are actions; naming
them as fake resources helps nobody.

## Gotchas

**Symptom:** `/users/export` captured by `:id`  
**Cause:** Route order (Phase 1)  
**Fix:** Static segments first

**Symptom:** A sub-resource route cannot see the parent's id  
**Cause:** A `Router` mounted at `/users/:userId/orders` does not inherit `:userId`  
**Fix:** `express.Router({mergeParams: true})` — the parent's params are *"not accessible
by default from the sub-routes"*

**Symptom:** Two endpoints return the same resource in different shapes  
**Cause:** `/orders/7` and `/users/42/orders/7` implemented separately  
**Fix:** One canonical route per resource. If both URLs must exist, make one redirect

**Symptom:** Clients hard-code URL construction and break on every change  
**Cause:** No stable convention — plural here, singular there, camelCase in one place  
**Fix:** Write the conventions down and lint them. Consistency is worth more than any
individual choice

## Interview questions

**★ Collection URL for creating a user?**  
`POST /users` (or your versioned mount), not `POST /createUser` unless you chose RPC deliberately.

**When is RPC-style acceptable?**  
Multi-step operations that are not natural CRUD on a single resource.

**★ How deep should resource nesting go, and why?**  
One level. Nest to identify a *collection* (`/users/42/orders`), go flat to identify
an *item* (`/orders/7`) — once an id is unique the ancestry adds nothing but coupling,
and every extra segment is another param each route must carry.

**Does Express enforce any of this?**  
None of it. Express matches paths to handlers; REST is a convention you impose. That
is precisely why it degrades without a written rule and a reviewer.

**Plural or singular collection names?**  
Plural, and consistently. The specific choice matters far less than making it once —
mixed conventions are what force clients to look up every endpoint.


---

← Index: [Phase 6](README.md) · Next → [Status mapping](02-status-mapping.md)
