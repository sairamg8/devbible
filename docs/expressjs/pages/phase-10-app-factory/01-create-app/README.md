---
title: "App factory createApp"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

**`createApp(deps)` returns an app and does nothing else. That one constraint is
what makes the mount order reviewable, the app testable a hundred times over, and
the same object usable by a server, a test runner and a platform adapter.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run and
> no console block in any chunk.** `express()` returns an application that is
> itself a **request listener**: `app.listen()` *"returns an `http.Server`
> object"* and is equivalent to `http.createServer(app).listen()`
> ([application reference](https://expressjs.com/en/5x/api/application/)), so an
> app that never listens is a complete handler. A `Router` is *"a complete
> middleware and routing system"* mountable with `app.use('/prefix', router)`
> ([routing guide](https://expressjs.com/en/guide/routing.html)). Middleware runs
> *"in the order that they are added"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)), and
> error handlers take **four arguments** and come last
> ([error handling](https://expressjs.com/en/guide/error-handling.html)).
> `app.disable('x-powered-by')` is the documented off switch
> ([Phase 0 · 05](../../phase-0-express-basics/05-application-settings.md)). The
> dependency-injection reasoning is
> [Phase 7 · 04](../../phase-7-layering/04-di-without-framework.md).
> **The rules, the sequence and the migration path are this bible's.**

| # | Chunk | In one line |
|---|---|---|
| 01 | **[A function of its dependencies](01-a-function-of-its-dependencies.md)** | Why an app that never listens is still an app, the four side effects that must not be in the factory, config as a parameter, and the two-independent-apps test |
| 02 | **[Mount order is the content](02-mount-order-is-the-content.md)** | The full sequence with every line's reason, the two ordering mistakes that are silent, where conditionals belong, and how to test order rather than routes |
| 03 | **[What it buys](03-what-it-buys.md)** | Factory assembles / entrypoint commits, what tests can do because of it, three runtimes from one object, the threading cost, and a six-step migration |

**Split on concept boundaries at the 300-line mark.** 01 is the constraint, 02 is
the content, 03 is the payoff and the price.

## Phase gate

You can explain how an app works without ever calling `listen`, name the four
things a factory must never do and what each one breaks, read a mount order top to
bottom giving the reason for every line, say which two ordering mistakes fail
silently, and state the point at which the factory stops being optional.

## Where this connects

- **← [Phase 0 · 02](../../phase-0-express-basics/02-app-router-server/README.md)**
  — app versus router versus server, and settings that do not cross into a
  sub-app.
- **← [Phase 7 · 04](../../phase-7-layering/04-di-without-framework.md)** — the
  injection this page is the composition root for.
- **← [Phase 9 · 01 · trust proxy](../../phase-9-hardening/01-trust-proxy/README.md)**
  — the setting that must come before anything reads `req.ip`.
- **← [Phase 5 · 06](../../phase-5-errors/06-not-found-and-process.md)** — 404
  after the routes, error handler last.
- **→ [02 · Request id](../02-request-id.md)** — the first middleware in the
  sequence.
- **→ [03 · Supertest](../03-supertest.md)** — driving the app without a port.
- **→ [05 · Health and boot](../05-health-and-boot.md)** — why `/health` sits
  above the limiter, and where config is validated.
- **→ [06 · Shutdown and entrypoint](../06-shutdown-and-entrypoint.md)** — the one
  file allowed to be irreversible.
- **→ [07 · Flags and serverless](../07-flags-and-serverless.md)** — config-driven
  branching, and the same app on a platform adapter.

---

← Index: [Phase 10](../README.md) · Start → [A function of its dependencies](01-a-function-of-its-dependencies.md)
