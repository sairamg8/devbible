---
title: "Project structure"
sidebar_label: "01 · Project structure"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Express 5 docs (`express.Router`, application
> settings). Concept home:
> [Express — the app factory](../../../expressjs/pages/phase-10-app-factory/README.md)
> and [layering](../../../expressjs/pages/phase-7-layering/README.md).

## The problem

Twelve chapters of endpoints are about to land in one codebase. Without a
fixed shape, every route handler grows its own SQL, its own validation style
and its own error handling — the "big ball of middleware" that makes Express
codebases infamous. The shape here is the
[layering concept](../../../expressjs/pages/phase-7-layering/README.md)
applied: **routers parse HTTP, services decide, repositories fetch** — and
the app is a factory function because
[testability demanded it](../../../expressjs/pages/phase-10-app-factory/README.md).

## The layout

```text
src/
├── config.js            # Phase 2·01 — the zod env schema
├── server.js            # Phase 2·01 — main(): boot order, shutdown
├── app.js               # buildApp(deps) — the factory, below
├── health.js            # Phase 2·09
├── middleware/
│   ├── auth.js          # ch. 03 — session resolution
│   ├── require.js       # ch. 04 — requireAuth / requireRole / ownership
│   ├── validate.js      # ch. 02 — the zod boundary
│   ├── rate-limit.js    # ch. 10
│   └── errors.js        # ch. 09 — the one error handler
├── routes/
│   ├── catalog.js       # ch. 05    products, categories, search
│   ├── carts.js         # ch. 06
│   ├── checkout.js      # ch. 07
│   ├── uploads.js       # ch. 08
│   ├── auth.js          # ch. 03    signup, login, logout
│   ├── admin.js         # ch. 04    gated: products, orders, moderation
│   └── webhooks.js      # ch. 11    inbound, raw-body
└── services/
    ├── catalog.js       # Phase 2·08's cached reads
    ├── carts.js         # merge-on-login and friends
    └── checkout.js      # orchestrates payment + Phase 1's transaction
db/                      # Phase 1 — pool, tx, migrations, query modules
worker/                  # Phase 2 — relay, handlers, schedule
```

## The factory

```js
// src/app.js
import express from 'express';
import {errorHandler, notFound} from './middleware/errors.js';
import {sessionMiddleware} from './middleware/auth.js';
import {buildCatalogRoutes} from './routes/catalog.js';
import {buildCartRoutes} from './routes/carts.js';
import {buildCheckoutRoutes} from './routes/checkout.js';
import {buildUploadRoutes} from './routes/uploads.js';
import {buildAuthRoutes} from './routes/auth.js';
import {buildAdminRoutes} from './routes/admin.js';
import {buildWebhookRoutes} from './routes/webhooks.js';

export function buildApp(deps) {           // {config, pool, health, cache, uploads…}
  const app = express();
  app.set('trust proxy', 1);               // one hop: the Nginx in front (ch. 09's
  app.disable('x-powered-by');             // rate limits need the real client IP)

  app.get('/livez', (req, res) => res.json(deps.health.livez()));
  app.get('/readyz', async (req, res) => {
    const r = await deps.health.readyz(deps);
    res.status(r.ok ? 200 : 503).json(r);
  });

  // webhooks FIRST and with a raw body — before any JSON parser (ch. 11)
  app.use('/webhooks', buildWebhookRoutes(deps));

  app.use(express.json({limit: '100kb'})); // the default body budget
  app.use(sessionMiddleware(deps));        // req.user | req.session, or neither

  app.use('/auth', buildAuthRoutes(deps));
  app.use('/products', buildCatalogRoutes(deps));
  app.use('/cart', buildCartRoutes(deps));
  app.use('/checkout', buildCheckoutRoutes(deps));
  app.use('/uploads', buildUploadRoutes(deps));
  app.use('/admin', buildAdminRoutes(deps));

  app.use(notFound);                       // JSON 404, same contract as errors
  app.use(errorHandler(deps));             // the single error boundary (ch. 09)
  return app;
}
```

## The rules the shape enforces

**Routers receive dependencies; nothing imports a live pool.** Every
`buildXRoutes(deps)` closure gets what it needs — which is what lets tests
build an app over a test database and a fake mailer with zero module
mocking. The factory *is* the dependency-injection story
([the testable-code concept](../../../nodejs/pages/phase-9-testing/04-testable-code.md)).

**Order is meaning in the middleware stack.** Webhooks mount before the JSON
parser (signature verification needs raw bytes); the session middleware runs
before every authenticated router; the error handler is last because
[Express finds it by position](../../../expressjs/pages/phase-2-middleware/README.md).
The mount order above is not style — five chapters depend on it.

**Handlers stay at HTTP altitude.** A route handler parses input (chapter
02's `validate`), calls one service function, shapes one response. The
checkout handler will not know SQL exists; the checkout *service* will not
know what a status code is. When a handler grows an `if` about business
state, it is a service function trying to be born.

**Per-route body parsing, deliberately.** `express.json` at 100 kB covers
the JSON surface; the uploads router mounts busboy on its own routes
(avoiding [the buffering trap](../phase-2-node-services/03-the-upload-service.md) — see chapter 08); the
webhook router reads raw. There is no single global parser because the three
surfaces have three different body disciplines.

## Gotchas

- **Symptom:** every request logs the proxy's IP; rate limits throttle the
  whole site as one client. **Cause:** `trust proxy` unset — `req.ip` is
  the Nginx hop. **Fix:** `app.set('trust proxy', 1)` for exactly one
  trusted hop — not `true`, which trusts whatever any client writes into
  `X-Forwarded-For` ([the proxy concept](../../../expressjs/pages/phase-9-hardening/README.md)).
- **Symptom:** webhook signature verification fails only in production.
  **Cause:** a globally mounted `express.json()` consumed and re-serialized
  the body before the webhook router saw it. **Fix:** the mount order above —
  raw-body routes come first; this is why the order is written down.
- **Symptom:** tests are slow and flaky because each spins up the real
  boot. **Cause:** testing through `server.js` instead of the factory.
  **Fix:** tests call `buildApp(testDeps)` and hand it to supertest — no
  port, no migrations, no real mailer; the
  [supertest pattern](../../../expressjs/pages/phase-10-app-factory/03-supertest.md)
  is built for exactly this seam.

## Interview questions

1. **★ Why is the app a factory function instead of a module that exports
   `app`?** A module-level app builds itself from module-level state —
   ambient config, a singleton pool — so tests inherit whatever the module
   grabbed. A factory makes every dependency a parameter: tests inject
   fakes, two apps can coexist (one per test file), and the boot file is
   the only place that assembles production reality.
2. **★ Why do webhooks mount before the body parser when every tutorial
   mounts parsers first?** Signature schemes MAC the raw bytes. Any parser
   that touches the stream first leaves the router verifying a
   *reconstruction* — which fails on key order, whitespace, unicode. Raw
   first is not preference; it is what makes verification mathematically
   meaningful. (Chapter 11 implements it.)
3. **What belongs in a route handler, and what is the smell it's growing
   past it?** Parse, delegate, respond — roughly ten lines. The smells:
   a second service call whose result feeds the first (orchestration —
   move into the service), a status-code decision based on domain state
   (the error contract's job), or SQL (three layers out of place).
4. **Why `trust proxy` = `1` and not `true`?** `true` believes the
   left-most `X-Forwarded-For` entry — which the *client* controls, letting
   anyone spoof their IP to the rate limiter and the logs. `1` trusts
   exactly the one hop you operate (Nginx) and takes the address *it*
   observed. Trust is a topology fact, not a boolean.

---

Next → [The validation boundary](02-the-validation-boundary.md) ·
Phase index: [Phase 3 — The Express API](README.md)
