---
title: "App factory createApp"
sidebar_label: "01 · createApp"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**`createApp(deps)` returns `app` without listening. Inject db/redis/queue clients.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> The pattern works because of two documented facts. `express()` returns an application
> that is itself a **request listener** — the docs show `app.listen()` as a convenience
> method that *"returns an `http.Server` object"* and is equivalent to
> `http.createServer(app).listen()`
> ([application reference](https://expressjs.com/en/5x/api/application/)), so an app that
> never listens is still a complete, usable handler. And a `Router` is *"a complete
> middleware and routing system"* mountable with `app.use('/prefix', router)`
> ([routing guide](https://expressjs.com/en/guide/routing.html)), which is what lets a
> factory assemble one from injected parts.
> `app.disable('x-powered-by')` is the documented off switch for the header Express sends
> by default ([Phase 0](../phase-0-express-basics/05-application-settings.md)).
> The dependency-injection reasoning is
> [Phase 7](../phase-7-layering/04-di-without-framework.md); this page is the composition
> root it referred to.

```js
export function createApp({userService, config}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({limit: config.bodyLimit}));
  app.use('/api/users', usersRouter({userService}));
  app.use(notFound);
  app.use(errorMiddleware);
  return app;
}
```

## The rule: no side effects in the factory

`createApp` should be a **pure function of its dependencies**. Calling it twice must
produce two independent apps and touch nothing outside them.

That rules out four things people routinely put in it:

```js
export function createApp(deps) {
  const app = express();

  app.listen(3000);                 // ⛔ binds a port — tests cannot run in parallel
  const pool = createPool(url);     // ⛔ connects — the factory now has a side effect
  const port = process.env.PORT;    // ⛔ reads config — inject it instead
  process.on('SIGTERM', …);         // ⛔ registers a global handler, once per call

  return app;
}
```

Each one breaks something specific: binding makes concurrent tests fight over
ports, connecting means importing the module opens a socket, reading `process.env`
makes the app unconfigurable per instance, and a signal handler registered per call
leaks listeners in a test suite that builds a hundred apps.

**Everything the app needs arrives as an argument. Everything the app does happens
when a request arrives.** That is the whole discipline, and it is what makes the
rest of this phase possible.

## Mount order is the factory's real content

The factory is where every ordering decision from the previous phases becomes one
readable sequence — which is the main reason to have it at all:

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

Reading top to bottom gives the whole request path. Every line has a reason
established earlier — `trust proxy` before anything reads `req.ip`
([Phase 9](../phase-9-hardening/01-trust-proxy.md)), CORS before authentication
([Phase 9](../phase-9-hardening/02-cors.md)), health above the limiter, 404 then
error handler ([Phase 5](../phase-5-errors/06-not-found-and-process.md)).

**One file where the order is visible is worth more than the same middleware
scattered across routers**, because ordering bugs are invisible when the sequence
is assembled from six files.

## Trade-off

A factory buys testability — `createApp({mocks})` under Supertest with no database
— and it makes the mount order reviewable in one place. Those two benefits are why
this is the default arrangement for anything with tests.

It costs a threading problem: every dependency must be passed from the entrypoint
through the factory to the router that needs it, and adding one touches three
files. For a very small app that is real overhead, and importing a singleton is
genuinely faster to write.

The line worth drawing: **the moment you want an integration test that does not
touch a real database, you need this.** Before that, it is optional.

## Gotchas

**Symptom:** Tests fail with `EADDRINUSE`  
**Cause:** The factory calls `listen`  
**Fix:** `listen` belongs in the entrypoint only
([page 06](06-shutdown-and-entrypoint.md))

**Symptom:** Importing the app module opens a database connection  
**Cause:** The factory (or a module it imports) connects at load time  
**Fix:** Connect in the entrypoint and inject the client
([Phase 7](../phase-7-layering/04-di-without-framework.md))

**Symptom:** `MaxListenersExceededWarning` during a test run  
**Cause:** `process.on(...)` inside the factory, called once per test  
**Fix:** Signal handlers belong in the entrypoint, which runs once

**Symptom:** A middleware ordering bug that only appears in production  
**Cause:** Order assembled implicitly across router files  
**Fix:** One factory where the sequence is read top to bottom

**Symptom:** `req.ip` is wrong despite `trust proxy` being set somewhere  
**Cause:** It was set after middleware that already read the IP  
**Fix:** Settings first, before any `app.use`

**Symptom:** The health endpoint 429s during an incident  
**Cause:** Mounted below the rate limiter  
**Fix:** Health above limits, and excluded from them
([Phase 9](../phase-9-hardening/04-rate-limiting.md))

## Interview questions

**★ Why not listen inside createApp?**  
Tests and serverless adapters need the app without binding a port.

**★ What must a factory never do?**  
Bind a port, open a connection, read `process.env`, or register process-level
handlers. Calling it twice should produce two independent apps and change nothing
outside them — otherwise tests cannot run in parallel and importing the module has
side effects.

**★ Why is the factory the right place to see mount order?**  
Because ordering is a property of the whole stack, and ordering bugs are invisible
when the sequence is assembled across several files. `trust proxy` before anything
reads `req.ip`, CORS before authn, health above rate limits, 404 then error handler —
one readable sequence.

**How does an app work without ever calling `listen`?**  
An Express app *is* a request listener; `app.listen()` is a convenience for
`http.createServer(app).listen()`. Supertest and serverless adapters use the app
directly, which is why binding is the entrypoint's job.

**When is the factory not worth it?**  
On a small app with no integration tests, where threading dependencies through costs
more than it returns. The moment you want a route test that does not touch a real
database, you need it.


---

← Index: [Phase 10](README.md) · Next → [Request id middleware](02-request-id.md)
