---
title: "Nouns, collections, items"
sidebar_label: "01 · Nouns, collections, items"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Resources are nouns. Collections are lists of them. Prefer `/orders/12/items`
over `/getOrderItems` — and nest exactly one level, because once an id is unique
the ancestry adds nothing but coupling.**

> Verified: 2026-08-14 — **no sandbox run, and deliberately not an Express
> question.** Express has no resource model: it matches paths to handlers and
> stops there, which is exactly why the discipline has to come from you. The
> mechanics behind the URLs *are* Express's and are documented — mounting a router
> at a prefix, and `req.params` for the id segments
> ([routing guide](https://expressjs.com/en/guide/routing.html)) — and the
> `mergeParams` behaviour is read from `router@2.2.0` in
> `sandbox/express-verify/node_modules/`
> ([Phase 1 · 03 · chunk 02](../../phase-1-routing/03-router-composition/02-mergeparams-and-isolation.md)).
> **The naming conventions below are this bible's guidance**, informed by common
> REST practice; treat them as defaults with reasons, not rules with citations.

## The four shapes

| Style | Example | When |
|---|---|---|
| Collection | `GET /users` | List, plus create with `POST /users` |
| Item | `GET /users/:id` | Read, update or delete one |
| Sub-resource | `/users/:id/orders` | An owned hierarchy |
| Action (RPC) | `POST /payments/:id/refund` | The verb *is* the product — [chunk 02](02-when-rest-stops-fitting.md) |

The first three are the ones a CRUD API is made of, and between them they cover
most of a normal surface:

```text
GET    /orders           list
POST   /orders           create
GET    /orders/:id       read
PUT    /orders/:id       replace
PATCH  /orders/:id       partial update
DELETE /orders/:id       delete
GET    /orders/:id/items sub-collection
```

Seven routes, one router, one mount. That regularity is the actual product of
REST: a client that has used one resource can guess the next one.

## How deep should a URL nest?

The honest answer is **one level, usually**. Nesting expresses ownership, and one
level says everything you need:

```text
/users/42/orders          ← orders belonging to user 42     ✅
/users/42/orders/7        ← ambiguous: is order 7 scoped, or global?
/users/42/orders/7/items/3/refunds   ← nobody can use this
```

Once you have the order id, the user id adds nothing — `/orders/7` identifies it
just as well. The rule that survives contact with real APIs:

- **Nest to reach a collection** — `/users/42/orders`, answering "which orders?"
- **Go flat to reach an item** — `/orders/7`, because the id is already unique.

Three costs of going deeper, each of which shows up in a different place:

**1 · Every URL becomes a compound key.** A client must remember the whole
ancestry to build a link, so a stored "order 7" is no longer enough — it needs
the user id too, and that is a schema change on the client side.

**2 · Every route needs `mergeParams`.** A `Router` mounted at
`/users/:userId/orders` **does not see `:userId`** unless it was constructed with
`{mergeParams: true}`, and the failure is `undefined` rather than an error
([Phase 1 · 03 · chunk 02](../../phase-1-routing/03-router-composition/02-mergeparams-and-isolation.md)).
Two levels means two flags to remember and a bare `:id` collision waiting to
happen.

🔴 **3 · Each segment is an authorization check, and the URL implies one you did
not do.** `/orgs/:orgId/projects/:projectId` looks like it guarantees the project
is in the org. It does not — both ids come from the caller. Checking access to
`orgId` and then loading `projectId` by id alone is broken object-level
authorization, and it is the highest-consequence bug in most APIs
([Phase 8 · 07](../../phase-8-validation-authz/07-ownership.md)). The fix is to
scope the query — `findProject(projectId, callerOrgId)` — which also means the
nesting was never doing the work you thought.

## Plural, singular, and the small decisions

They are trivial individually and expensive in aggregate, because **inconsistency
is what clients pay for**:

| Decision | Pick | Why |
|---|---|---|
| Plural or singular collections | **Plural** — `/users` | A collection is many things; `/user/42` reads as "the user", and then `/user` has no meaning |
| Casing in paths | **kebab-case** — `/order-items` | URLs are case-sensitive after the host; snake and camel both invite mistakes |
| Trailing slashes | **No** | Express treats `/users` and `/users/` the same by default (`strict routing` is unset — [Phase 0 · 05](../../phase-0-express-basics/05-application-settings.md)), so pick one and let the other redirect |
| Singleton resources | `/me`, `/settings` | Some resources genuinely have one instance per caller. Do not invent `/users/me/settings/1` |
| Ids in paths | opaque strings | A client should never parse an id. That keeps you free to change the format |
| File-extension suffixes | **no** `/orders.json` | Content type is negotiated by the `Accept` header — [Phase 4 · 09](../../phase-4-responses/09-content-negotiation.md) |

Whichever you choose, choose once. The cost of `/order-items` next to
`/orderStatuses` is paid by every client developer, forever — and unlike most
design debt, it can never be repaid without a version bump
([Phase 6 · 05](../05-versioning.md)).

## Ids: what goes in the path

The id in a URL is a public identifier, and the choice has consequences beyond
aesthetics:

| Id type | Leaks | Enumerable | Note |
|---|---|---|---|
| auto-increment integer | your row count, and your growth rate | **yes** | `/orders/1` to `/orders/1000` is a scraping loop |
| UUIDv4 | nothing | no | random, so poor index locality at scale |
| UUIDv7 / ULID | approximate creation time | no | time-ordered, so it indexes well |
| a natural key (email, slug) | the value itself | depends | changes when the thing is renamed, which breaks every stored URL |

🔴 **Sequential integers are an enumeration surface**, and the defence is not
obscurity — it is the authorization check on every item route. But "we check
properly" and "the ids are guessable" together mean any gap is immediately
exploitable at scale, so the two decisions interact.

**Never let an id be a natural key that can change.** A slug in the path is fine
as an *additional* lookup, with the canonical URL still using the stable id and a
redirect from the slug.

## Trade-off

Deep hierarchies mirror the domain and complicate authorization and caching.
Flatten when joins explode.

The deeper trade is **REST regularity versus expressiveness**. A strictly
resource-shaped API is predictable — a client that has used one endpoint can
guess the rest, and generic tooling works. The cost is that some operations are
not shaped like CRUD on a noun, and forcing them into that mould produces URLs
nobody can read. Where that line is, and what to do at it, is
[chunk 02](02-when-rest-stops-fitting.md).

## Gotchas

**Symptom:** `/users/export` is captured by `/users/:id`
**Cause:** Route order — registration order is absolute, with no specificity
ranking ([Phase 1 · 04](../../phase-1-routing/04-route-ordering.md))
**Fix:** Register static segments before parameterised ones

**Symptom:** A sub-resource route cannot see the parent's id
**Cause:** A `Router` mounted at `/users/:userId/orders` does not inherit
`:userId` — parent params are *"not accessible by default from the sub-routes"*
**Fix:** `express.Router({mergeParams: true})`, and name the params uniquely so
the child cannot shadow the parent

**Symptom:** Two endpoints return the same resource in different shapes
**Cause:** `/orders/7` and `/users/42/orders/7` implemented separately
**Fix:** One canonical route per resource. If both URLs must exist, make one
redirect to the other

**Symptom:** Clients hard-code URL construction and break on every change
**Cause:** No stable convention — plural here, singular there, camelCase in one
place
**Fix:** Write the conventions down and lint them. Consistency is worth more than
any individual choice

**Symptom:** A competitor has a copy of your entire order table
**Cause:** Sequential integer ids plus one route with a weak authorization check
**Fix:** Both halves — non-enumerable ids *and* a scoped query on every item
route. Neither alone is sufficient

**Symptom:** Every stored link breaks when a user renames something
**Cause:** A mutable natural key in the path
**Fix:** Canonical URLs use the immutable id; the slug is an alias that redirects

## Interview questions

**★ What is the collection URL for creating a user?**
`POST /users`, under whatever version prefix you mount — not `POST /createUser`,
unless you have deliberately chosen an RPC style for an operation that genuinely
is not CRUD.

**★ How deep should resource nesting go, and why?**
One level. Nest to identify a *collection* (`/users/42/orders`) and go flat to
identify an *item* (`/orders/7`) — once an id is unique the ancestry adds nothing
but coupling. Each extra segment is a compound key for the client, a
`mergeParams` flag for you, and an authorization check the URL implies but does
not perform.

**★ Does Express enforce any of this?**
None of it. Express matches paths to handlers; REST is a convention you impose.
That is precisely why it degrades without a written rule and a reviewer — nothing
in the framework will ever tell you the surface has become inconsistent.

**★ What is wrong with sequential integer ids in URLs?**
They are enumerable, so they leak your row count and growth rate and make any
authorization gap exploitable at scale in a loop. The defence is the scoped query
on every item route, but non-enumerable ids remove the amplification.

**Plural or singular collection names?**
Plural, consistently. The specific choice matters far less than making it once —
mixed conventions are what force clients to look up every endpoint instead of
guessing correctly.

**Why not put a slug in the canonical URL?**
Because it changes when the thing is renamed, and every stored link then breaks.
Keep the canonical URL on the immutable id and let the slug redirect to it.

---

Index: [REST resources](README.md) · Next → [When REST stops fitting](02-when-rest-stops-fitting.md)
