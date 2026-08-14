---
title: "Mount order is the content"
sidebar_label: "02 · Mount order is the content"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**The factory's real value is that every ordering decision from the previous nine
phases becomes one readable sequence. Ordering bugs are invisible when the
sequence is assembled from six files.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run and
> no console block.** Middleware runs *"in the order that they are added"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)), and
> `app.use(path, fn)` matches any path beginning with `path`
> ([application reference](https://expressjs.com/en/5x/api/application/)) — those
> two facts are the whole mechanism. Error-handling middleware is identified by
> **four arguments** and *"defined last, after other `app.use()` and routes
> calls"* ([error handling](https://expressjs.com/en/guide/error-handling.html)).
> `app.set`/`app.disable` are application settings applied before any request is
> handled ([Phase 0 · 05](../../phase-0-express-basics/05-application-settings.md)).
> Every ordering *reason* below is argued on the page it links to.
> **The sequence itself is this bible's recommendation.**

## The sequence

```js
export function createApp({userService, orderService, config}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);   // Phase 9 — before anything reads req.ip

  app.use(requestId());                        // first: everything downstream logs it
  app.use(helmet());                           // headers before responses exist
  app.use(cors(config.cors));                  // before authn — preflights carry no creds
  app.use(express.json({limit: config.bodyLimit}));

  app.get('/health', (req, res) => res.sendStatus(200));   // above rate limiting
  app.use('/api', rateLimit(config.rateLimit));

  app.use('/api/users', usersRouter({userService}));
  app.use('/api/orders', ordersRouter({orderService}));

  app.use(notFound);                           // Phase 5 — after routes
  app.use(errorMiddleware);                    // Phase 5 — last, four arguments
  return app;
}
```

Reading top to bottom gives the whole request path. **One file where the order is
visible is worth more than the same middleware scattered across routers**, because
an ordering bug has no symptom at the line that caused it.

## Every line's reason, in one table

| Line | Why it sits there | Argued in |
|---|---|---|
| `disable('x-powered-by')` | a setting, so before any request | [Phase 0 · 05](../../phase-0-express-basics/05-application-settings.md) |
| `set('trust proxy', …)` | anything reading `req.ip` afterwards must see the corrected value | [Phase 9 · 01](../../phase-9-hardening/01-trust-proxy/README.md) |
| `requestId()` | every later log line, including a 401, carries a correlation id | [page 02](../02-request-id.md) |
| `helmet()` | response headers must be set before any handler can respond | [Phase 9 · 03](../../phase-9-hardening/03-helmet.md) |
| `cors()` | **before authn** — a preflight carries no credentials and must not 401 | [Phase 9 · 02](../../phase-9-hardening/02-cors.md) |
| `express.json()` | after the cheap rejections, before anything reading `req.body` | [Phase 3 · 02](../../phase-3-requests/02-json-and-urlencoded/README.md) |
| `/health` | above the limiter, so an incident cannot 429 your health check | [page 05](../05-health-and-boot.md) |
| `rateLimit` | before routers, so rejection happens before real work | [Phase 9 · 04](../../phase-9-hardening/04-rate-limiting.md) |
| routers | the actual application | [Phase 1 · 03](../../phase-1-routing/03-router-composition/README.md) |
| `notFound` | only after every route has declined | [Phase 5 · 06](../../phase-5-errors/06-not-found-and-process.md) |
| `errorMiddleware` | last, and four arguments or Express treats it as ordinary | [Phase 5 · 01](../../phase-5-errors/01-error-middleware/README.md) |

🔴 **Two of these are silent when wrong.** CORS after authentication produces a
browser CORS error on correct configuration; an error handler declared with three
parameters is simply never called as an error handler, and failures fall through to
the default one. Neither throws.

## Settings are not middleware

```js
app.set('trust proxy', config.trustProxy);   // ✅ applies to every request
app.use(somethingReadingIp);                 //    including this one
```

`app.set` and `app.disable` change the application, not the chain, so they take
effect for **all** requests regardless of where they appear. They still belong at
the top, for a reason that is about people rather than semantics: a setting buried
between two `app.use` lines reads as though it applies from that point on, and the
next person moves it "to fix" an ordering problem it never had.

⚠️ **Settings do not cross into a mounted sub-app.** An `express()` instance
mounted with `app.use('/admin', subApp)` has its own settings, so `trust proxy`
must be set there too if anything inside reads `req.ip`
([Phase 0 · 02](../../phase-0-express-basics/02-app-router-server/README.md)).
Routers are different — a `Router` has no settings of its own and uses the host
app's.

## Where conditionals belong

Environment differences are the main reason a factory grows unreadable. Keep them
few, keep them at the top, and make each one a line you can see:

```js
export function createApp({config, ...deps}) {
  const app = express();
  …
  if (config.logRequests) app.use(requestLogger());        // ✅ one visible line
  if (config.serveDocs) app.use('/docs', docsRouter());    // ✅ a feature flag
  …
}
```

Two rules that keep this from decaying:

**1 · Branch on config, never on `NODE_ENV` directly.** `if (config.logRequests)`
can be turned on in a single test; `if (process.env.NODE_ENV !== 'production')`
cannot, and it hides the fact that "development" now means six behaviours at once
([page 07](../07-flags-and-serverless.md)).

**2 · Never branch on config *inside* a request handler for something that could
be decided at mount time.** A flag checked per request is a decision made a
million times to produce the same answer, and it hides the app's real shape from
anyone reading the factory
([Phase 2 · 04](../../phase-2-middleware/04-middleware-factories.md)).

## What does not belong in the factory

The factory assembles; it does not implement. Three things that creep in:

- **Route handlers written inline.** A handler in the factory is untestable
  without a request and invisible from the router file that owns the resource. The
  `/health` one-liner is the deliberate exception — it has no dependencies and its
  position is the point.
- **Business logic in "just one" middleware.** If it needs the database it belongs
  in a service; if it needs the record it belongs after the load
  ([Phase 8 · 07](../../phase-8-validation-authz/07-ownership/README.md)).
- **Environment parsing.** Covered in [chunk 01](01-a-function-of-its-dependencies.md):
  the factory receives config, it does not derive it.

## Test the order, not just the routes

Ordering is a property of the assembled app, so it is testable in the same place —
and these are the tests that survive a refactor, because they assert consequences
rather than structure:

```js
it('answers a preflight without authentication', async () => {
  const res = await request(app).options('/api/orders')
    .set('Origin', 'https://app.example.com')
    .set('Access-Control-Request-Method', 'DELETE');
  expect(res.status).not.toBe(401);            // CORS is above authn
});

it('serves /health while the limiter is exhausted', async () => {
  await exhaust(request, '/api/orders');
  expect((await request(app).get('/health')).status).toBe(200);
});

it('returns the error envelope, not a stack trace', async () => {
  const res = await request(app).get('/api/boom');
  expect(res.body.error.code).toBeDefined();   // the 4-arg handler ran
});
```

Each one catches a reordering that no unit test can see: a mounting mistake, not a
broken function ([page 03](../03-supertest.md)).

## Gotchas

**Symptom:** A middleware ordering bug that only appears in production
**Cause:** Order assembled implicitly across router files
**Fix:** One factory where the sequence is read top to bottom

**Symptom:** `req.ip` is wrong despite `trust proxy` being set somewhere
**Cause:** It was set inside a mounted sub-app, or a reader ran on a different app
**Fix:** Settings at the top of the app that owns them; repeat for sub-apps

**Symptom:** The browser reports a CORS error on a correctly configured origin
**Cause:** Authentication is mounted above CORS, so the credential-free preflight
401s
**Fix:** CORS before authentication

**Symptom:** The health endpoint 429s during an incident
**Cause:** Mounted below the rate limiter
**Fix:** Health above limits, and excluded from them

**Symptom:** Errors return the default HTML page instead of the API envelope
**Cause:** The error handler was declared with three parameters, so it is ordinary
middleware
**Fix:** Four arguments, and last

**Symptom:** A 404 route never runs
**Cause:** `notFound` mounted before the routers
**Fix:** After the routes, before the error handler

**Symptom:** A feature flag cannot be toggled in a test
**Cause:** The branch reads `NODE_ENV` rather than config
**Fix:** Branch on config; the environment is parsed once at the edge

## Interview questions

**★ Why is the factory the right place to see mount order?**
Because ordering is a property of the whole stack, and ordering bugs are invisible
when the sequence is assembled across several files. `trust proxy` before anything
reads `req.ip`, CORS before authn, health above rate limits, 404 then error
handler — one readable sequence, top to bottom.

**★ Which ordering mistakes are silent?**
CORS below authentication, which surfaces as a browser CORS error on correct
configuration; and an error handler declared with three parameters, which Express
treats as ordinary middleware so it is simply never called. Neither throws.

**★ Do `app.set` calls need to be at the top?**
Not semantically — settings apply to every request wherever they appear. They
belong at the top so that nobody reads them as positional and "fixes" an ordering
problem they never had. They also do **not** cross into a mounted sub-app, which
has its own settings.

**★ Where do environment differences belong?**
As `if (config.x)` lines near the top of the factory, branching on config rather
than `NODE_ENV` so a single one can be toggled in a test. A flag checked inside a
request handler is a decision made a million times for the same answer, and it
hides the app's shape.

**How do you test mount order?**
Through the assembled app, asserting consequences: a preflight that is not 401'd,
`/health` still answering while the limiter is exhausted, an error returning the
envelope rather than a stack trace. Each catches a mounting mistake that a unit
test of the middleware cannot.

**What should never be in the factory?**
Inline route handlers, business logic, and environment parsing. It assembles; it
does not implement. The `/health` one-liner is the deliberate exception, because
its position relative to the limiter is exactly the thing being expressed.

---

← Prev: [A function of its dependencies](01-a-function-of-its-dependencies.md) · Index: [App factory](README.md) · Next → [What it buys](03-what-it-buys.md)
