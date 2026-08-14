---
title: "The three layers"
sidebar_label: "01 · The three layers"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Controllers translate HTTP. Services own rules. Repositories own queries.
Driver types do not leak upward — and there is exactly one question that tells
you whether any of it is real.**

> Verified: 2026-08-14 — **no sandbox run, no console block, and none of this is
> an Express feature.** Express has no notion of a controller, a service or a
> repository; it has middleware and handlers, and everything here is a convention
> you impose on them. Said plainly because it matters: there is no framework
> support to lean on, so the boundaries hold only while someone enforces them in
> review. The two Express facts the pattern rests on *are* documented — a router
> is *"a complete middleware and routing system … often referred to as a
> 'mini-app'"* ([routing guide](https://expressjs.com/en/guide/routing.html)), and
> middleware may *"modify the request and response objects"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)). The
> mechanics of repositories and transactions are
> [Node Phase 6](../../../../nodejs/pages/phase-6-data-access/README.md).

## Responsibilities

| Layer | Does | Does not |
|---|---|---|
| Controller | read validated input from `req`, call the service, map the status | SQL, business rules |
| Service | invariants, orchestration | `res.json`, Express types |
| Repository | queries and commands via drivers | HTTP status decisions |

Node Phase 6 owns *how* repositories and transactions work. Express owns where
the HTTP layer stops.

## The test that tells you the layers are real

Boundaries drawn in folder names are decoration. There is one question that
establishes whether they exist:

> **Can you call the service from a script, with no HTTP anywhere?**

If yes, the boundary is real. If the service needs a `req`, reads `process.env`
for a per-request value, or calls `res.status()` somewhere deep, then you have
three folders and one layer.

The same test in the other direction: **can you swap the database without
touching the service?** If the service knows about SQL strings, driver error
codes or Mongo operators, the repository boundary is nominal.

A third, cheaper version you can apply during review: **read the service's import
list.** If `express`, `pg` or `mongodb` appears in it, the answer is already no.
That check is mechanical enough to lint — an ESLint `no-restricted-imports` rule
scoped to `src/services/**` costs one config entry and never forgets.

## What each layer is allowed to know

| Layer | Knows about | Must never touch |
|---|---|---|
| **Controller** | `req`, `res`, status codes, DTO mapping | Business rules, queries |
| **Service** | Domain objects, other services, repository *interfaces* | `req`/`res`, HTTP status, SQL, driver types |
| **Repository** | The driver, the schema, query construction | HTTP, business rules, what a 404 means |

Two leaks account for nearly all the damage.

**HTTP downward** — a service that takes `req` and reads `req.user` inside. Now
every test needs a request object, and reusing the service from a job or a CLI
means faking one. The tell is a service signature that mentions Express, and the
fix is passing primitives: `cancel(orderId, actorId)`, not `cancel(req)`.

🔴 **Persistence upward** — a repository returning driver rows, so the service
works with `RowDataPacket` or a raw document and a schema change ripples through
business logic. This is the more expensive of the two, because it is invisible:
the code compiles, the tests pass, and the coupling only shows up on the day
somebody renames a column.

Map at the repository boundary and the change stops there. It is also the same
discipline that stops `password_hash` reaching a response — the row never becomes
the domain object, so it can never become the DTO
([Phase 4 · 01 · chunk 03](../../phase-4-responses/01-res-methods/03-choosing-and-shaping.md)).

## "Not found" in three steps

A useful concrete rule, and the clearest illustration of the whole pattern:

| Step | Layer | Decision |
|---|---|---|
| `findById` returns `null` | **repository** | a *data* fact: there is no such row |
| `if (!order) throw new NotFoundError(...)` | **service** | that absence is an *error* in this operation |
| `NotFoundError` → 404 | **controller / error middleware** | that error is a *404* over HTTP |

Three decisions, three layers, and none of them belongs to another. Collapsing
any pair is what drags HTTP into the service.

And note the middle step is genuinely a decision, not a formality: for
`findById` on a GET, absence is an error; for `findByEmail` during registration,
absence is the **success** case. Only the service knows which.

## The boundary the pattern does not draw

🔴 **Ownership is a service concern, and the layering does not remind you.**
Middleware can answer *who is this?* and *what may this role do?*, because both
come from the token. It cannot answer *may this caller touch this record?* — the
record has not been loaded yet
([Phase 2 · 01 · chunk 03](../../phase-2-middleware/01-middleware-contract/03-what-middleware-must-not-do.md)).

So the check lands in the service, and the shape that works is a **scoped
repository call** rather than a comparison after loading:

```js
// ❌ the unauthorised row enters the process, and list endpoints get no defence
const order = await orderRepo.findById(id);
if (order.orgId !== actorOrgId) throw new ForbiddenError();

// ✅ the query cannot return someone else's row
const order = await orderRepo.findOwned(id, actorOrgId);
if (!order) throw new NotFoundError('ORDER_NOT_FOUND');
```

Putting the scope **in the repository signature** — so the method cannot be
called without it — is what makes this structural rather than a habit
([Phase 8 · 07](../../phase-8-validation-authz/07-ownership/README.md)). Note the 404
rather than a 403: confirming existence to someone who may not see it is an
enumeration oracle.

## Where the layers usually blur, and what to do

| Symptom | Which boundary | What actually belongs where |
|---|---|---|
| The service formats a currency for display | HTTP down | Formatting is presentation; the service returns an amount and a currency |
| The repository has `getUserForProfilePage` | HTTP down, two layers | Repositories speak the data language. A name mentioning a screen means the wrong layer is driving |
| The controller builds a query object | persistence up | The controller passes filters as domain values; the repository turns them into a query |
| The service catches `err.code === '23505'` | persistence up | The repository maps the driver code to a domain error |
| The service reads `process.env.FEATURE_X` | config down | Inject the flag. A service that reads the environment cannot be tested twice with different values |

That last row generalises: **anything a service reads from ambient state — the
environment, a clock, a random source, the current user via `AsyncLocalStorage` —
is a dependency it should have been given.** Injecting them is what makes tests
deterministic ([Phase 7 · 04](../04-di-without-framework.md)).

## Gotchas

**Symptom:** Service unit tests need a running HTTP server
**Cause:** The service takes `req`, or returns something only a route can use
**Fix:** Pass primitives and domain objects. A service signature that mentions
Express means the boundary is already broken

**Symptom:** A schema change breaks business logic in five files
**Cause:** Repositories return driver rows, so persistence shapes travel upward
**Fix:** Map to domain objects inside the repository. That mapping *is* the
boundary

**Symptom:** The service calls `res.status(404).json(...)`
**Cause:** HTTP leaked down a layer
**Fix:** Throw a domain error and let the error middleware map it. The service
should not know what a 404 is

**Symptom:** Three folders, but changing anything still touches all of them
**Cause:** Layering by folder name only
**Fix:** Apply the test — call the service from a script. Folders are not
boundaries. Lint the import list if review keeps missing it

**Symptom:** A repository method is named `getUserForProfilePage`
**Cause:** A presentation concern named a data operation
**Fix:** Repositories speak the data language. A name mentioning a screen or an
endpoint means the wrong layer is driving

**Symptom:** An ownership check passes and the caller still reads someone else's
record
**Cause:** The check compared after loading, and a list endpoint had no equivalent
**Fix:** Scope the query, with the scope in the repository signature so it cannot
be omitted

## Interview questions

**★ Why keep Express types out of services?**
So they stay testable without an HTTP server, and reusable from a CLI, a queue
consumer or a second transport. A service that takes `req` forces every caller to
fabricate one.

**★ How would you tell whether someone's layering is real or cosmetic?**
Call the service from a plain script with no HTTP. If it needs a `req` or reaches
for `res`, the layers are folder names. The mirror test is swapping the database
without touching the service. The cheap version is reading the service's import
list — and that one can be linted.

**★ Where does "not found" become a 404?**
In three steps. The repository returns `null` — a data fact. The service decides
that absence is an error in *this* operation, which is a real decision, because
for a registration check the same absence is success. The controller or the error
middleware maps that error to 404.

**★ Which layer owns the ownership check, and why?**
The service — middleware structurally cannot do it, because the record has not
been loaded. And it should be expressed as a scoped repository call rather than a
comparison after loading, so the unauthorised row never enters the process and
list endpoints inherit the same defence.

**Which leak is more expensive, HTTP downward or persistence upward?**
Persistence upward. HTTP downward is visible — the signature mentions `req`.
Persistence upward compiles, passes tests, and only surfaces the day a column is
renamed and business logic breaks in five files.

**Why is Express unable to help enforce any of this?**
Because Express only knows middleware and handlers. Controllers, services and
repositories are conventions — nothing in the framework fails when you violate
them, which is exactly why they erode without review or a lint rule.

---

Index: [CSR wiring](README.md) · Next → [Wiring it in Express](02-wiring-it-in-express.md)
