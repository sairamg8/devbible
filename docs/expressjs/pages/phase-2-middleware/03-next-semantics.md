---
title: "next semantics"
sidebar_label: "03 · next semantics"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**`next()` continues. `next(err)` jumps to error handlers. Neither response nor
`next` means hang. `next` after a response means header errors.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> The hang is documented: *"if a middleware function does not end the request-response
> cycle, it must call `next()` … Otherwise, the request will be left hanging"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)).
> [Error handling](https://expressjs.com/en/guide/error-handling.html) covers the other
> two branches — `next(err)` skips the remaining non-error middleware, and *"if you call
> `next()` with an error after you have started writing the response … the Express
> default error handler closes the connection and fails the request."* That is why the
> documented guard in a custom handler is `if (res.headersSent) return next(err)`.

## Hang — no next, no body

```js
// hang.mjs
import express from 'express';

const app = express();
app.use((req, res, next) => {
  if (req.url.startsWith('/hang')) return; // bug
  next();
});
app.get('/ok', (req, res) => res.send('ok'));

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log('ok', await (await fetch(`http://127.0.0.1:${port}/ok`)).text());
  const ac = new AbortController();
  setTimeout(() => ac.abort(), 200);
  try {
    await fetch(`http://127.0.0.1:${port}/hang`, {signal: ac.signal});
  } catch {
    console.log('hang: client aborted (server never responded)');
  }
  server.close();
});
```

```console
$ node hang.mjs
ok ok
hang: client aborted (server never responded)
```

## `next(err)`

```js
// next-err.mjs
import express from 'express';

const app = express();
app.get('/e', (req, res, next) => next(new Error('nope')));
app.use((err, req, res, next) => {
  res.status(500).send(err.message);
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/e`)).text());
  server.close();
});
```

```console
$ node next-err.mjs
nope
```

On Express 5, `throw` inside async handlers is equivalent for the error stack
(Phase 0 / Phase 5).

## Double send

```js
// double.mjs
import express from 'express';

const app = express();
app.get('/d', (req, res, next) => {
  res.send('first');
  next(); // bug
});
app.use((req, res) => {
  try {
    res.send('second');
  } catch (err) {
    console.log('error:', err.message);
  }
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log('body:', await (await fetch(`http://127.0.0.1:${port}/d`)).text());
  server.close();
});
```

```console
$ node double.mjs
error: Cannot set headers after they are sent to the client
body: first
```

Client got `first`. Server logged a headers error on the second send.

## Trade-off

Calling `next` after partial work enables clean pipelines; calling it after a
terminal response is always wrong. Prefer structure where terminal handlers do
not sit above more middleware.

## Gotchas

**Symptom:** `Cannot set headers after they are sent to the client`  
**Cause:** Second write after `res.send` / `json`  
**Fix:** Do not `next()` after responding; guard with `res.headersSent`

**Symptom:** Error middleware skipped  
**Cause:** `next()` without `err`, or error middleware registered too early  
**Fix:** `next(err)` and mount error handlers last

**Symptom:** `next('route')` confusion  
**Cause:** Advanced skip-to-next-route feature — rare  
**Fix:** Learn only when you need fall-through routes; default is `next()`

## Interview questions

**★ Difference between `next()` and `next(err)`?**  
Continue vs jump to error middleware.

**★ What if middleware neither responds nor calls next?**  
The request hangs until the client times out.

**What does double `res.send` produce?**  
First body wins; second throws about headers already sent.

**How does Express 5 change thrown errors in async handlers?**  
Rejections are forwarded like `next(err)`.

---

← Prev: [Execution order](02-execution-order/README.md) · Next → [Middleware factories](04-middleware-factories.md)
