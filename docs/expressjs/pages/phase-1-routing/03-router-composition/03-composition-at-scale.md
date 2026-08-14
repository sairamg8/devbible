---
title: "Composition at scale"
sidebar_label: "03 · Composition at scale"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Once an app has thirty routers, the mount list *is* the architecture document —
and it is the only place the request pipeline is visible at all.**

> Verified: 2026-08-14. The mechanism claims here are the ones already established
> from `router@2.2.0` in `sandbox/express-verify/node_modules/` — registration
> order as an array walk, `trimPrefix`'s prefix rewrite, `restore`'s per-router
> isolation — cited in chunks 01 and 02. **No sandbox run backs this page and it
> carries no console block.** The `router.param` "called once per request" rule is
> quoted from the [routing guide](https://expressjs.com/en/guide/routing.html) and
> matches `processParams`'s `called` cache in the source. **The structural advice
> below is this bible's guidance** — Express documents no application structure and
> validates none.

## The mount list is the design document

Express has no declaration step, no route manifest and no introspection
([Phase 0 · 01 · chunk
01](../../phase-0-express-basics/01-what-express-is/01-the-mapping-problem.md)).
Nothing can tell you what runs before `POST /api/v1/orders` except reading every
`app.use` above it, in order, across however many files did the mounting.

So the single highest-value structural decision in an Express codebase is:
**assemble the whole thing in one visible function**, and let every module export
a router rather than reach for the app.

```js
// app.js — the entire pipeline, readable top to bottom
export function createApp(deps) {
  const app = express();

  app.set('trust proxy', 1);              // settings first — the router reads some
  app.set('query parser', 'simple');      // of these when it is first built

  app.use(requestId);                     // 1 · every log line needs it
  app.use(pinoHttp({logger: deps.logger}));
  app.use(helmet());
  app.use(cors(corsOptions));             // 2 · before authn — preflight has no creds
  app.use(express.json({limit: '100kb'}));

  app.get('/livez', livez);               // 3 · probes above the rate limiter
  app.get('/readyz', readyz(deps));

  app.use(rateLimit(limitOptions));       // 4 · after probes, before routes

  app.use('/api/v1', v1Router(deps));     // 5 · the actual product

  app.use(notFound);                      // 6 · three-arg, below every route
  app.use(errorHandler(deps.logger));     // 7 · four-arg, last

  return app;
}
```

Every line in that function is load-bearing and each has a reason that is a bug
somewhere else in this track:

| Position | Why it is there | Where it bites |
|---|---|---|
| `app.set` first | the base router reads `strict`/`caseSensitive` **once**, when it is first touched | [Phase 0 · 01 · chunk 03](../../phase-0-express-basics/01-what-express-is/03-what-express-delegates.md) |
| request id first | anything logged before it has no correlation id | [Phase 10 · 02](../../phase-10-app-factory/02-request-id.md) |
| CORS before authn | a preflight carries no credentials, so authn answers 401 and the browser says "CORS" | [Phase 9 · 02](../../phase-9-hardening/02-cors.md) |
| probes above the limiter | a rate-limited `/readyz` takes the instance out of rotation under load | [Phase 10 · 05](../../phase-10-app-factory/05-health-and-boot.md) |
| `trust proxy` before anything reading `req.ip` | the limiter keys on `req.ip` | [Phase 9 · 01](../../phase-9-hardening/01-trust-proxy.md) |
| 404 then error handler | a 404 is not an error and never reaches four-arg middleware | [Phase 5 · 06](../../phase-5-errors/06-not-found-and-process.md) |

**The failure mode this prevents:** the same six middleware mounted in five
different files, in an order determined by import order, which changes when
someone reorders imports for lint. Nothing breaks loudly; CORS just starts
failing for one route.

## Two levels, and a parent router per version

```js
// v1.js
export default function v1Router(deps) {
  const r = express.Router();
  r.use(requireApiKey);                 // applies to everything in v1
  r.use('/orders', ordersRouter(deps));
  r.use('/users',  usersRouter(deps));
  return r;
}
```

This gives the version prefix exactly one home, gives v1-only middleware an
obvious place, and makes `v2` a new file rather than a set of edits. When v1 is
deprecated, the `Sunset` header goes on that one router —
[Phase 6 · 05](../../phase-6-rest-surface/05-versioning.md).

**Take the dependencies as an argument.** `ordersRouter(deps)` rather than a
module-level `import {pool} from '../db.js'`: a module-scope `createPool()` opens
a socket at *import* time, which is how unit tests end up holding real database
connections and a suite hangs after passing.
[Phase 7 · 04](../../phase-7-layering/04-di-without-framework.md).

## Loading a resource once per request

The repeated shape in a nested route table is "look up the parent, check access,
then do the thing". `router.param` exists for it:

```js
const orders = express.Router({mergeParams: true});

orders.param('orderId', async (req, res, next, id) => {
  const order = await deps.orders.findOwned(id, req.user.orgId);
  if (!order) return next(); // fall through to 404 — do not confirm existence
  req.order = order;
  next();
});

orders.get('/:orderId', (req, res) => res.json(present(req.order)));
orders.put('/:orderId', replaceOrder);
```

Two properties worth knowing before relying on it. It is **scoped to the router**
it is declared on — a param callback does not apply to a sibling router with the
same param name. And it runs **once per request per value**: the source keeps a
`called` cache keyed by param name, so a param matched by three nested layers
triggers one callback, which is what the routing guide means by *"a param callback
will be called only once in a request-response cycle, even if the parameter is
matched in multiple routes."* Full treatment on
[page 06](../06-router-param.md).

🔴 **Note `findOwned(id, req.user.orgId)` rather than a load-then-compare.**
Scoping the query is what makes the whole router safe by construction; comparing
after the load leaves the unauthorised row inside the process and leaves list
endpoints unprotected. [Phase 8 · 07](../../phase-8-validation-authz/07-ownership/README.md).

## Testing a router in isolation

Because a router is just a function, it mounts onto a throwaway app:

```js
const app = express();
app.use(express.json());
app.use('/orders', ordersRouter({orders: fakeRepo}));
await request(app).get('/orders/1').expect(200);
```

That is fast and it is a trap, in one specific way: **the throwaway app is not
your app.** It has no authn, no rate limiter, no error handler and no 404. A
route that forgot `requireAuth` passes this test identically to one that did not,
and an error that your real error handler would map to 409 comes back as an HTML
500.

So use isolated mounting for behaviour, and **test authorization against the real
`createApp`** — including the deny paths, and specifically another user's id.
[Phase 10 · 04](../../phase-10-app-factory/04-auth-in-tests.md).

## Gotchas

**Symptom:** Middleware order differs between environments or after a refactor
**Cause:** Mounting is spread across modules, so the effective order depends on
import order
**Fix:** One `createApp` that does all the mounting. Modules export routers and
mount nothing

**Symptom:** A route works in its own test and 401s in the app
**Cause:** The isolated test app has no authn mounted. Both outcomes look the same
to a test that only exercises the happy path
**Fix:** Test the deny paths against the real factory: no token, expired token,
wrong role, and another user's id

**Symptom:** Importing a router opens a database connection
**Cause:** Module-scope `createPool()` in the router file
**Fix:** Take dependencies as a function argument. The router file should do
nothing at import time

**Symptom:** A new middleware added "at the top of the file" runs after the
routers
**Cause:** The routers were mounted above it — registration order is an array
walk, and nothing reorders
**Fix:** Position it in the factory's numbered sequence, not wherever it was
convenient

**Symptom:** v2 was added by editing v1's router
**Cause:** No per-version parent router, so the version prefix was repeated on
every resource mount
**Fix:** One router per version owning the prefix; v2 is a new file that reuses
the resource routers it did not change

## Interview questions

**★ Why does an Express app need an explicit factory function?**
Because Express has no declaration step and no introspection: the set of things
that run before a route is the accumulated result of every `app.use` above it, in
registration order. If that is spread across files, nothing — not your editor,
not the framework — can show you the pipeline. One factory makes the order
readable and reviewable.

**★ Name three ordering constraints in an Express app and what breaks if you get
them wrong.**
`app.set` before the first route (the router reads `strict`/`caseSensitive` once,
so later changes are silently ignored); CORS above authentication (a preflight
carries no credentials, so authn 401s it and the browser reports a CORS failure);
health probes above the rate limiter (a limited `/readyz` removes the instance
from rotation exactly when it is busiest).

**★ How do you avoid repeating a version prefix across twenty resource mounts?**
A parent router per version that owns the prefix and mounts the resource routers
under it. Version-specific middleware then has one home, and deprecation headers
go on one object.

**★ What does `router.param` give you that middleware does not?**
It is keyed to a param name rather than a path, so it applies to every route in
that router using that param, and the source caches by value so it runs once per
request even when several nested layers match it. It is scoped to the router it
is declared on.

**Why should a router module take its dependencies as an argument?**
Because a module-level `createPool()` or `new Client()` runs at *import* time, so
importing the router for a unit test opens a real connection — and the suite
hangs after the tests pass. Injecting also lets the same router be mounted twice
with different backing services.

**What is the limitation of testing a router mounted on a throwaway app?**
That app has none of your real middleware — no authn, no error handler, no 404.
A route missing `requireAuth` passes identically, and errors come back as HTML
500s rather than your mapped contract. Use it for behaviour; test authorization
against the real factory.

---

← Prev: [mergeParams and isolation](02-mergeparams-and-isolation.md) · Index: [Router composition](README.md) · Next topic → [Route ordering](../04-route-ordering.md)
