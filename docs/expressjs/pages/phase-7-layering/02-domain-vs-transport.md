---
title: "Domain vs transport"
sidebar_label: "02 · Domain vs transport"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

**Transport is HTTP. Domain is your product language. Crossing them freely couples tests to Express.**

> Verified: 2026-08-14 — **no sandbox run**; architectural guidance, not an Express API.
> One documented fact underpins the whole page: middleware may *"modify the request and
> response objects"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)), which is how
> `req.validated` and `req.user` come to exist — Express defines neither. Because they are
> your own fields, **the request object accumulates whatever every middleware decided to
> attach**, and that is exactly why passing `req` into a service couples the service to
> the entire middleware stack rather than to one contract.
> The naming caution from [Phase 2](../phase-2-middleware/06-mutating-req-res.md) applies:
> the docs publish no reserved-name list, so attach under a namespace you own.

```js
// controller
const input = req.validated; // from Zod middleware
const user = await userService.register(input);
res.status(201).json(toUserDto(user));
```

```js
// service — pure-ish
export async function register(input, {users, hasher}) { /* … */ }
```

## Three vocabularies, not two

"Domain versus transport" undersells it — a request crosses **three** shapes, and
collapsing any pair is a distinct kind of pain.

| Shape | Lives in | Changes when |
|---|---|---|
| **DTO** (wire) | Request/response bodies | Your public API changes — a breaking change with versioning consequences |
| **Domain object** | Services | The business rules change |
| **Persistence row** | Repositories | The schema changes |

They *look* alike early on — `{id, name, email}` in all three — and that
resemblance is the trap. The moment you return a persistence row as a response
body, a column rename becomes a public API break, and adding an internal column
(`password_hash`, `internal_risk_score`) leaks it to every client.

The mapping functions are boring and that is the point:

```js
toOrder(row)        // repository: persistence → domain
toOrderDto(order)   // controller:  domain → wire
```

Two small functions per resource, and each layer changes independently.

## Which direction actually causes damage

Both leaks are bad; they fail differently.

**Transport leaking down** — `service.register(req)`:

- Every service test must construct a request object.
- The service silently depends on whichever middleware set `req.user` — an
  invisible coupling that no signature reveals.
- Reusing the logic from a job, a CLI or a test means faking HTTP.

**Persistence leaking up** — `res.json(row)`:

- Internal columns become public contract by accident.
- A schema change is a breaking API change, discovered by a client.
- You cannot rename a column without a migration *and* a version bump.

The second is the one that ships to production unnoticed, because it works
perfectly until the day it does not. `res.json(user)` on a row containing
`password_hash` is a single character away from `res.json(toUserDto(user))`, and
no test catches it unless someone asserts on the exact response keys.

**Assert on response shape in tests.** It is the cheapest defence against the
expensive leak.

## Where `req.user` belongs

The compromise that stays honest: **middleware puts identity on the request; the
controller passes a value, not the request.**

```js
// ✅ the controller unwraps transport; the service takes a plain id
router.post('/orders', async (req, res) => {
  const order = await orderService.place(req.validated, req.user.id);
  res.status(201).json(toOrderDto(order));
});

// ⛔ the service now depends on the auth middleware, invisibly
router.post('/orders', async (req, res) => {
  const order = await orderService.place(req);
  res.status(201).json(order);
});
```

The first version's signature — `place(input, actorId)` — documents exactly what
the operation needs. The second's says `place(req)`, which means "anything the
middleware stack happened to attach".

## Trade-off

Separate shapes and explicit mapping mean more code for identical-looking objects,
and every new field is touched in three places. That is a real cost, and it is
felt most in the first month when all three shapes are the same.

It buys the ability to change any layer alone — rename a column, restructure the
domain, evolve the API — and it makes accidental exposure structurally impossible
rather than a matter of vigilance. **For anything with a public API or personal
data, take the cost.** For an internal service with one consumer that deploys
together, returning rows is a defensible shortcut you should expect to pay back.

## Gotchas

**Symptom:** A password hash or internal flag appears in an API response  
**Cause:** `res.json(row)` — the persistence shape shipped straight to the client  
**Fix:** Always map through a DTO, and assert on exact response keys in tests

**Symptom:** Renaming a database column breaks mobile clients  
**Cause:** No DTO layer, so the schema *is* the public contract  
**Fix:** Map at the edge. The column and the field name should be free to differ

**Symptom:** Service tests build fake `req` objects  
**Cause:** The service takes `req`  
**Fix:** Pass what it needs — validated input and an actor id. If the signature
mentions Express, the boundary is gone

**Symptom:** A service works in a route but fails in a background job  
**Cause:** It read something a middleware had attached to `req`  
**Fix:** Make every dependency an argument. Invisible coupling only shows up in the
second caller

**Symptom:** Adding an API field requires touching six files  
**Cause:** Over-layering a small app — the mapping tax with none of the benefit  
**Fix:** This is the trade-off working against you. For a small internal service,
fewer layers is the right call

## Interview questions

**★ What is a DTO at the edge for?**  
Stable API shapes when persistence models change.

**★ Name the three shapes a request crosses, and what makes each change.**  
The DTO on the wire (changes when the public API changes), the domain object
(changes when the rules change), and the persistence row (changes when the schema
changes). They look identical early on, which is exactly why people collapse them.

**★ Which leak is more dangerous — transport downward or persistence upward?**  
Persistence upward. It works perfectly until a row gains an internal column, and
then you have leaked it to every client. Transport downward is painful but shows up
immediately, in tests.

**Where should `req.user` be read?**  
In the controller. It passes an actor id to the service. A service taking `req`
depends on the auth middleware without saying so in its signature.

**How do you catch the persistence leak in tests?**  
Assert on the exact response keys, not just the values you care about. A test that
checks `body.id === 42` passes happily while `password_hash` sits beside it.


---

← Prev: [CSR wiring](01-controller-service-repository/README.md) · Next → [Fat controllers](03-fat-controllers.md)
