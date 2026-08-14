---
title: "Async errors on Express 5"
sidebar_label: "02 · Async errors"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Rejected promises from async handlers reach error middleware on Express 5.
You do not need `express-async-errors` for that baseline.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [Migrating to Express 5](https://expressjs.com/en/guide/migrating-5.html) shows the
> before/after directly: Express 4 needed `.catch(next)`, while in Express 5 an async
> handler's errors are *"automatically forwarded to the error handler"*.
> [Error handling](https://expressjs.com/en/guide/error-handling.html) documents the
> limit that gives this page its gotchas — for *"callback-based APIs and asynchronous
> code without error-first callbacks"* you must still call `next(err)` yourself.

```js
// async-err.mjs
import express from 'express';

const app = express();
app.get('/boom', async (req, res) => {
  throw new Error('async boom');
});
app.use((err, req, res, next) => {
  res.status(500).json({error: err.message});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log(await (await fetch(`http://127.0.0.1:${port}/boom`)).json());
  server.close();
});
```

```console
$ node async-err.mjs
{ error: 'async boom' }
```

Still use `try/catch` when you convert errors to domain responses inside the
handler without wanting the global mapper.

## What Express 5 does *not* catch

The automatic forwarding covers one specific thing: **a promise returned by a
handler or middleware that Express itself invoked, rejecting**. Everything
outside that chain is still yours.

```js
// ✅ forwarded — Express called this function and got a rejected promise back
app.get('/a', async (req, res) => {
  throw new Error('caught by Express 5');
});

// ⛔ NOT forwarded — the callback runs later, on a different stack
app.get('/b', (req, res) => {
  fs.readFile('missing.txt', (err, data) => {
    if (err) throw err;              // crashes the process
  });
});

// ✅ the fix for callbacks: hand it to next yourself
app.get('/c', (req, res, next) => {
  fs.readFile('missing.txt', (err, data) => {
    if (err) return next(err);
    res.send(data);
  });
});

// ⛔ NOT forwarded — nothing awaits this, so nothing sees the rejection
app.get('/d', async (req, res) => {
  sendWelcomeEmail(req.user);        // floating promise
  res.json({ok: true});
});

// ⛔ NOT forwarded — the timer callback is a fresh stack
app.get('/e', (req, res) => {
  setTimeout(() => { throw new Error('gone'); }, 10);
});
```

The rule underneath all five: **Express can only catch what it awaits.** If your
error escapes on a callback, a timer, an event handler or an unawaited promise,
Express never sees it — it becomes an `uncaughtException` or an
`unhandledRejection`, which is a *process* concern
([page 06](06-not-found-and-process.md)).

`/d` is the one that bites in real code, because it looks correct and the request
succeeds. The failure surfaces later, in a process-level handler, with no request
context attached to it.

## Trade-off

Automatic forwarding is a genuine improvement — it deletes `express-async-errors`
and a wrapper function from every project, and a bare `throw` in a handler becomes
the normal way to fail. What it costs is a false sense of coverage. Teams read
"Express 5 handles async errors" and stop thinking about the callback and floating-
promise cases, which are exactly the ones that take the process down rather than
returning a 500.

Treat the feature as covering the common path, and keep auditing for the four
shapes above.

## Gotchas

**Symptom:** A `throw` inside a `fs`/`db` callback crashes the whole process  
**Cause:** The callback runs on a later stack that Express never awaited  
**Fix:** `return next(err)` from inside the callback, or use the promise API so the
handler's own rejection is what propagates

**Symptom:** An error is logged by an `unhandledRejection` handler with no request context  
**Cause:** A floating promise — work started in a handler but never awaited  
**Fix:** `await` it, or attach a `.catch()` that logs deliberately. If it is genuinely
fire-and-forget, say so with an explicit `.catch(logAndSwallow)` rather than leaving it bare

**Symptom:** `express-async-errors` is still in `package.json` after the upgrade  
**Cause:** Left over from Express 4  
**Fix:** Remove it. Express 5 does this natively, and the shim patches router internals
that have since changed

**Symptom:** An error thrown *after* `res.json()` produces the headers-already-sent error  
**Cause:** The handler responded, then threw; Express forwards the rejection to the error
handler, which tries to respond again  
**Fix:** `return` after responding, and guard the error handler with
`if (res.headersSent) return next(err)`

## Interview questions

**★ Express 5 vs 4 for async throw?**  
5 forwards rejections; 4 often needed wrappers or manual `next(err)`.

**★ Name something Express 5 still will not catch.**  
Anything off the awaited chain: a `throw` inside an error-first callback, an
unawaited (floating) promise, a `setTimeout` callback, an event-emitter handler.
Express only catches what it awaited.

**★ You call an async function in a handler but do not await it, and it rejects. What happens?**  
The request succeeds normally, and the rejection surfaces later as an
`unhandledRejection` with no request context. This is the most common way async
errors go missing in an Express 5 app.

**Is `try/catch` in a handler ever still worth writing?**  
Yes — when you want to *translate* the failure rather than propagate it: mapping a
driver error to a 409, adding context, or choosing a fallback. Use it to make a
decision, not merely to call `next(err)` with the same error.

---

← Prev: [Four-arg error middleware](01-error-middleware/README.md) · Next → [Error response contract](03-error-contract.md)
