---
title: "Mutating req and res"
sidebar_label: "06 · Mutating req/res"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

**Attaching fields on `req` is how identity and timing flow down the chain. Do
not overwrite Express or Node core properties.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> Mutation is a documented capability — middleware may *"modify the request and response
> objects"* — and `res.locals` is documented as the request-scoped place for values
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html),
> [response reference](https://expressjs.com/en/5x/api/response/)).
> The "do not clobber" half is reasoning from the documented surface rather than a
> quotable rule: `req.params`, `req.query`, `req.body`, `req.baseUrl`, `req.path`,
> `req.originalUrl`, `req.ip` and `req.route` are all defined by Express, and
> `req`/`res` also carry every `http.IncomingMessage` / `http.ServerResponse` member.
> Anything you attach must avoid that whole namespace, which is why a single namespaced
> object is the safe habit. **The docs do not enumerate a reserved list**; treat the
> request and response references as the list.

## Safe attachments

```js
// attach.mjs
import express from 'express';

const app = express();

app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  req.ctx = {started: Date.now()};
  next();
});

app.use((req, res, next) => {
  res.on('finish', () => {
    const ms = Date.now() - req.ctx.started;
    console.log(req.requestId, req.method, req.url, res.statusCode, ms + 'ms');
  });
  next();
});

app.get('/t', (req, res) => {
  res.json({requestId: req.requestId});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log('body', await (await fetch(`http://127.0.0.1:${port}/t`)).json());
  server.close();
});
```

Typical attachments later: `req.user` (auth), `req.validated` (Zod output). Prefer
**namespaced** objects (`req.ctx`) when many features share the request.

## Do not clobber

| Avoid overwriting | Why |
|---|---|
| `req.url`, `req.method`, `req.headers` | Routing and security depend on them |
| `res.end` / `res.json` wholesale | Breaks the response contract unless you wrap carefully |
| `req.query` / `req.params` in place with untrusted merges | Prototype / pollution risks |

Wrapping `res.json` for envelope formatting is a known pattern — do it
deliberately and test, or format in a helper the handler calls.

## Trade-off

Implicit `req.user` is convenient and hides dependencies. Passing `user` into
services as a plain argument is more testable. Use `req` for transport concerns;
keep domain functions free of Express types (Phase 7).

## Gotchas

**Symptom:** `req.user` set but handler sees undefined  
**Cause:** Auth middleware after the route, or different router stack  
**Fix:** Order and mount path

**Symptom:** Memory leak from `res.on('finish')` accumulators  
**Cause:** Capturing huge closures per request without bound  
**Fix:** Only store scalars you need; do not retain `req` in global arrays

## Interview questions

**★ How does `req.user` usually get set?**  
Authentication middleware attaches it after verifying session or token.

**Why avoid putting DB clients on `req`?**  
Lifecycle and testing — inject via `app.locals` or factory `deps` instead
(Phase 10).

**Is mutating `req` thread-unsafe?**  
Each request has its own `req` object on the single JS thread; the risk is
logical clobbering, not OS threads.

---

← Prev: [First and last](05-first-and-last.md) · Next → [Built-in and third-party](07-builtin-and-third-party.md)
