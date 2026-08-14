---
title: "Folders and DTOs"
sidebar_label: "06 · Folders · DTOs"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

**Pick feature folders or layer folders and stay consistent. Map API DTOs at the edge.**

> Verified: 2026-08-14 — **no sandbox run**. Express is **completely indifferent to your
> folder layout**: it has no convention-over-configuration loader, no routes directory it
> scans, nothing. Every structure here is equally valid to the framework, which is why the
> only real argument is human. The one mechanism that makes feature folders practical is
> documented — a `Router` is a mountable *"mini-app"*, so a feature can own its routes and
> be attached with one `app.use` line
> ([routing guide](https://expressjs.com/en/guide/routing.html)).
> The DTO reasoning is [page 02](02-domain-vs-transport.md); transaction-per-request
> middleware now has its own page ([07](07-transaction-middleware.md)).

| Layout | Idea |
|---|---|
| Feature | `orders/routes.ts`, `orders/service.ts` |
| Layer | `routes/`, `services/`, `repos/` |

Transaction-per-request middleware is a thin wrapper; mechanism stays
[Node Phase 6](../../../nodejs/pages/phase-6-data-access/README.md) — see
[page 07](07-transaction-middleware.md) for the Express-side wrapper.

## The argument, settled by how you actually work

Both layouts hold the same files. The difference is **what a single change
touches**.

```text
layer folders                    feature folders
routes/    orders.js users.js    orders/   routes.js service.js repo.js
services/  orders.js users.js    users/    routes.js service.js repo.js
repos/     orders.js users.js
```

Adding a field to orders touches three folders on the left and one on the right.
Changing how *every* repository handles connections touches one folder on the left
and every folder on the right.

Which is better depends on which change you make more often — and for product
work, the answer is almost always the first. **Feature folders are the better
default**, because features are the unit of work, the unit of review, and
eventually the unit of ownership. They also give you a natural deletion boundary:
removing a feature is removing a directory, rather than a hunt through three.

Layer folders win when the app is small enough that six files fit on one screen,
or when the layers genuinely have more internal structure than the features do.

**The real failure is neither layout — it is drift.** Half the app in
`services/`, half in `orders/`, and now nobody knows where new code goes. Pick one,
write it down, and enforce it in review.

## Two things that stay shared, whichever you pick

Feature folders do not mean everything is per-feature:

- **Cross-cutting middleware** — auth, request id, error handling, logging — belongs
  in a shared place. It is not part of any feature.
- **The composition root** — one file wiring everything
  ([page 04](04-di-without-framework.md)). It necessarily knows all features; that
  is its job.

If a feature folder starts importing from three other feature folders, that is a
signal the boundary is wrong, or that a shared concept wants extracting — not that
the layout has failed.

## DTO mapping: where the functions live

Two small functions per resource, and their placement follows the layers exactly:

```js
// orders/repo.js        persistence → domain
const toOrder = (row) => ({id: row.id, status: row.status, placedAt: row.placed_at});

// orders/dto.js         domain → wire
export const toOrderDto = (order) => ({
  id: order.id,
  status: order.status,
  placedAt: order.placedAt.toISOString(),
});
```

The mapping is where the naming conventions of each world get reconciled —
`placed_at` in the database, `placedAt` in the domain, an ISO string on the wire.
Doing it explicitly is what allows all three to change independently, and what
stops a column rename from becoming an API break
([page 02](02-domain-vs-transport.md)).

**Map in one direction per function, and keep them dumb.** A mapper containing a
conditional is usually business logic that escaped the service.

## Trade-off

Feature folders optimise for the change you make weekly and cost you a little
duplication — each feature repeats a shape, and a cross-cutting refactor visits
every directory. Layer folders optimise for the cross-cutting change and make
ordinary feature work touch three places, which is also where merge conflicts come
from on a team.

Neither is expensive to get wrong at the start and both are painful to change at
ten thousand lines. **Choose feature folders unless you have a reason**, write the
choice into the repo's README, and spend the saved argument elsewhere.

## Gotchas

**Symptom:** Nobody knows where a new file goes  
**Cause:** Both layouts in use — drift, not a bad choice  
**Fix:** Write the convention down and enforce it in review. The specific choice matters
far less than having one

**Symptom:** A feature folder imports from four other feature folders  
**Cause:** The boundary is wrong, or a shared concept has not been extracted  
**Fix:** Extract the shared concept. Cross-feature imports in every direction mean the
folders are not really boundaries

**Symptom:** DTO mappers accumulate conditionals  
**Cause:** Business logic leaking into the mapping layer  
**Fix:** Mappers are dumb shape translations. A rule belongs in the service

**Symptom:** A database column rename becomes an API breaking change  
**Cause:** No DTO mapping — the row shape is the wire shape  
**Fix:** Map at the edge, so the two names are free to differ

**Symptom:** Auth middleware duplicated inside two feature folders  
**Cause:** Treating cross-cutting concerns as feature-local  
**Fix:** Shared middleware directory. Features own domain code, not infrastructure

## Interview questions

**★ Feature vs layer folders?**  
Feature scales by domain; layer scales by role — teams pick one convention.

**★ Which would you default to, and what is the actual argument?**  
Feature folders. The argument is which change you make more often: adding a field to
orders touches one folder in a feature layout and three in a layer layout, and feature
work is what teams do weekly. It also makes deleting a feature a directory removal.

**★ What does Express contribute to this decision?**  
Nothing. It has no convention-based loader and never scans a directory — every layout
is identical to the framework. That is why the argument is purely about humans.

**What stays shared in a feature-folder layout?**  
Cross-cutting middleware and the composition root. Neither belongs to a feature, and
duplicating auth per feature is how checks drift apart.

**Where do DTO mappers live and what should they contain?**  
Beside the layer they translate out of — persistence-to-domain in the repository,
domain-to-wire next to the routes. They should be pure shape translations; a
conditional inside one is usually escaped business logic.


---

← Prev: [Jobs from routes](05-jobs-from-routes.md) · Next → [Transaction middleware](07-transaction-middleware.md)
