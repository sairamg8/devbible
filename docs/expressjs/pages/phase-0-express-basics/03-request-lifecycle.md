---
title: "The request lifecycle"
sidebar_label: "03 · Request lifecycle"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**Every request walks one path: middleware chain → route handler → response, or
it falls into error middleware. If nothing calls `next` and nothing writes a
response, the client hangs.**

## The path end to end

1. Node’s `http.Server` accepts a connection and creates `req` / `res`.
2. Express runs the **application stack** top to bottom.
3. Each middleware either:
   - sends a response and **stops**, or
   - calls `next()` to continue, or
   - calls `next(err)` to jump to **error middleware**.
4. A matching route handler runs (still middleware, with a path).
5. If nothing matched, your 404 middleware (if any) runs.
6. If an error was forwarded, four-argument error middleware runs.

There is no parallel “Express event loop.” It is still Node’s loop; Express is
synchronous scheduling of your functions on that one thread until they await.

## Minimal map

```js
// lifecycle.mjs
import express from 'express';

const app = express();

app.use((req, res, next) => {
  console.log('1 middleware', req.method, req.url);
  next();
});

app.get('/ok', (req, res) => {
  console.log('2 handler');
  res.status(200).json({ok: true});
});

app.use((req, res) => {
  console.log('3 404');
  res.status(404).json({error: 'not found'});
});

app.use((err, req, res, next) => {
  console.log('4 error', err.message);
  res.status(500).json({error: err.message});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const base = `http://127.0.0.1:${port}`;
  console.log('status', (await fetch(`${base}/ok`)).status);
  console.log('status', (await fetch(`${base}/missing`)).status);
  server.close();
});
```

```console
$ node lifecycle.mjs
1 middleware GET /ok
2 handler
status 200
1 middleware GET /missing
3 404
status 404
```

## Where requests die

| Failure | What you see |
|---|---|
| Middleware never calls `next` and never responds | Client hang / timeout |
| Handler throws without error middleware | Express 5 → error middleware; if none, default handler |
| `next()` after `res.json` | “Cannot set headers after they are sent” |
| Route registered after a catch-all that already responded | Handler never runs |

Phase 2 deepens `next` semantics. Phase 5 deepens error middleware. Here you only
need the map.

## Trade-off

A long middleware chain is clear and testable; every hop costs a little and makes
order bugs more likely. Keep global middleware minimal; put feature logic on
routers.

## Gotchas

**Symptom:** Browser spins forever, no response  
**Cause:** A middleware returned without `next()` and without `res.end`/`json`  
**Fix:** Log entry/exit of each layer; find the function that neither continued
nor finished

**Symptom:** Error middleware never runs  
**Cause:** Signature is not exactly four args `(err, req, res, next)`, or it is
registered *before* the routes that throw  
**Fix:** Error middleware last; four parameters required so Express can detect it

**Symptom:** Two JSON bodies or header errors  
**Cause:** Two layers both tried to send  
**Fix:** One terminal response per request; after send, do not `next()`

## Interview questions

**★ Walk through a successful `GET /users` in Express.**  
Server accepts → app stack runs → matching route → handler writes response →
connection completes. No error middleware involved.

**★ What happens if middleware forgets `next()`?**  
Unless it already sent a response, the request stalls. Express will not
auto-continue.

**What is `next(err)` for?**  
Skip remaining normal middleware and jump to the error-handling stack.

**Does Express process two requests on two threads?**  
No. One JS thread (Node model). Concurrency is async I/O, not multi-threaded
handlers.

**Where should 404 handling sit?**  
After all routes, as a normal middleware that sends 404 — not as error middleware
(no `err`).

---

← Prev: [app, Router, and http.Server](02-app-router-server.md) · Next → [Creating an app](04-creating-an-app.md)
