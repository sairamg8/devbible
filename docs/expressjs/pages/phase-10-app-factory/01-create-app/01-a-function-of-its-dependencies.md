---
title: "A function of its dependencies"
sidebar_label: "01 · A function of its dependencies"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**`createApp(deps)` returns an app and does nothing else — no port, no
connection, no `process.env`, no signal handler. Calling it twice must produce
two independent apps and touch nothing outside them.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run and
> no console block.** The pattern rests on two documented facts. `express()`
> returns an application that is itself a **request listener**: `app.listen()` is
> a convenience that *"returns an `http.Server` object"* and is equivalent to
> `http.createServer(app).listen()`
> ([application reference](https://expressjs.com/en/5x/api/application/)), so an
> app that never listens is still a complete, usable handler. And a `Router` is
> *"a complete middleware and routing system"* mountable with
> `app.use('/prefix', router)`
> ([routing guide](https://expressjs.com/en/guide/routing.html)), which is what
> lets a factory assemble one from injected parts.
> `app.disable('x-powered-by')` is the documented off switch for the header
> Express sends by default
> ([Phase 0 · 05](../../phase-0-express-basics/05-application-settings.md)). The
> dependency-injection reasoning is
> [Phase 7 · 04](../../phase-7-layering/04-di-without-framework.md); this is the
> composition root it referred to. **The rules and their consequences are this
> bible's.**

## The shape

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

Everything the app needs arrives as an argument; everything the app *does* happens
when a request arrives. That is the whole discipline, and the rest of this phase
depends on it.

## An app that never listens is still an app

The reason this works at all is worth stating plainly, because it is the fact
people find surprising: **an Express app is a request handler**, and `listen` is a
convenience that wraps it in an `http.Server`.

```js
const app = createApp(deps);          // a complete handler — nothing is bound
http.createServer(app).listen(3000);  // what app.listen(3000) does for you
```

Which means the same object serves three consumers without change:

| Consumer | What it does with the app |
|---|---|
| The entrypoint | wraps it in a server and binds a port |
| Supertest | drives it directly, on an ephemeral port it manages |
| A serverless adapter | translates the platform's event into a request for it |

**Binding is not part of being an app** — it is one thing you can choose to do
with one ([page 06](../06-shutdown-and-entrypoint.md),
[page 07](../07-flags-and-serverless.md)).

## The rule: no side effects in the factory

`createApp` should be a **pure function of its dependencies**. Four things
routinely end up inside it, and each breaks something specific:

```js
export function createApp(deps) {
  const app = express();

  app.listen(3000);                 // ⛔ binds a port
  const pool = createPool(url);     // ⛔ connects
  const port = process.env.PORT;    // ⛔ reads config
  process.on('SIGTERM', …);         // ⛔ registers a global handler

  return app;
}
```

| Line | What it breaks |
|---|---|
| `listen` | concurrent tests fight over the port; the app cannot be used serverless |
| `createPool` | **importing** the module opens a socket; tests need a real database |
| `process.env` | the app is unconfigurable per instance — two apps cannot differ |
| `process.on` | one listener per call, so a suite building a hundred apps leaks a hundred |

🔴 **The `process.on` one is the most insidious**, because it works perfectly in
production — where the factory is called once — and only misbehaves in the test
suite, as a `MaxListenersExceededWarning` that everyone learns to ignore.

## Config is a dependency, not an ambient fact

```js
// ⛔ the factory reaches for the environment
app.set('trust proxy', process.env.TRUST_PROXY === 'true');

// ✅ the environment is read once, at the edge, and passed in
export function createApp({config}) {
  app.set('trust proxy', config.trustProxy);
}
```

Reading `process.env` inside the factory means **every app built in a process is
identical**, which is exactly what a test needs to vary: one app with
`trustProxy: false`, another with a strict CORS origin, a third with rate limiting
disabled. It also hides the app's real inputs — a `config` parameter is a list of
everything the app is sensitive to, and `process.env` is a list of nothing.

**Parse and validate the environment once, in the entrypoint**, and pass a plain
object. A missing variable then fails at boot with a clear message rather than
producing `undefined` deep inside a middleware
([page 05](../05-health-and-boot.md)).

## What "two independent apps" buys

The test for whether a factory is honest: call it twice and check that the two
apps share nothing.

```js
const a = createApp({config: {rateLimit: {max: 1}}, ...deps});
const b = createApp({config: {rateLimit: {max: 100}}, ...deps});
```

If a module-level counter, a shared limiter store, a cached client or a global
route table sneaks in, `a` and `b` interfere — and the symptom is the worst kind
of test failure: **one that depends on test order**. A suite that passes alone and
fails in CI is usually this.

⚠️ **Injected dependencies may legitimately be shared** — one database pool across
both apps is normal and desirable. The rule is about what the *factory* creates,
not about what it is given.

## Dependencies in, not imports

```js
// ⛔ the router imports its own service; nothing can substitute it
import {userService} from '../services/userService.js';

// ✅ the router is a factory too, and the app threads dependencies down
app.use('/api/users', usersRouter({userService}));
```

A router that imports its collaborators is untestable in isolation and couples the
route layer to a concrete implementation. Making routers factories as well is what
lets `createApp` be the **single composition root** — the one place where "what is
wired to what" is decided and therefore the one place to read
([Phase 7 · 04](../../phase-7-layering/04-di-without-framework.md)).

## Gotchas

**Symptom:** Tests fail with `EADDRINUSE`
**Cause:** The factory calls `listen`
**Fix:** `listen` belongs in the entrypoint only
([page 06](../06-shutdown-and-entrypoint.md))

**Symptom:** Importing the app module opens a database connection
**Cause:** The factory, or a module it imports, connects at load time
**Fix:** Connect in the entrypoint and inject the client

**Symptom:** `MaxListenersExceededWarning` during a test run
**Cause:** `process.on(...)` inside the factory, called once per test
**Fix:** Signal handlers belong in the entrypoint, which runs once

**Symptom:** A test passes alone and fails in the suite
**Cause:** Two apps sharing state the factory created — a counter, a limiter
store, a cached client
**Fix:** Everything the factory creates must be per-app; only injected
dependencies are shared

**Symptom:** A test cannot disable rate limiting or CORS
**Cause:** The factory reads `process.env` instead of a `config` argument
**Fix:** Read the environment once at the edge and pass a plain config object

**Symptom:** A missing environment variable surfaces as `undefined` inside a
middleware
**Cause:** The environment is read lazily, deep in the stack
**Fix:** Parse and validate config at boot, before the factory is called

**Symptom:** A router cannot be tested without a database
**Cause:** It imports its service rather than receiving it
**Fix:** Routers are factories too — thread dependencies from the composition root

## Interview questions

**★ Why not call `listen` inside `createApp`?**
Because binding is not part of being an app. An Express app *is* a request
listener; `app.listen()` is a convenience for `http.createServer(app).listen()`.
Tests and serverless adapters need the app without a port, and a factory that
binds one makes parallel tests fight.

**★ What must a factory never do?**
Bind a port, open a connection, read `process.env`, or register process-level
handlers. Calling it twice should produce two independent apps and change nothing
outside them — otherwise tests cannot run in parallel and importing the module has
side effects.

**★ Why is `process.env` inside the factory a problem, specifically?**
Because it makes every app built in that process identical, which is the thing
tests need to vary, and it hides the app's real inputs. A `config` parameter
enumerates everything the app is sensitive to; the environment enumerates nothing.

**★ How do you tell whether a factory is honest?**
Call it twice with different config and check the two apps share nothing the
factory created. Shared injected dependencies — a pool, a cache client — are fine
and intended; shared factory-created state produces order-dependent test failures.

**Why should routers be factories too?**
So the app can thread dependencies down to them and substitute fakes in tests. A
router that imports its service is coupled to a concrete implementation and cannot
be tested in isolation, which also means the composition root stops being the one
place where wiring is decided.

**Is it a problem for two apps to share a database pool?**
No — that is the intended arrangement. The rule constrains what the factory
*creates*, not what it is handed.

---

Index: [App factory](README.md) · Next → [Mount order is the content](02-mount-order-is-the-content.md)
