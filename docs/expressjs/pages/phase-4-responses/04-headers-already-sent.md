---
title: "Headers already sent"
sidebar_label: "04 · Headers already sent"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**The first write wins. A second `res.json` / `send` throws
`Cannot set headers after they are sent to the client`.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> `res.headersSent` is documented as the boolean that *"indicates if the app sent HTTP
> headers for the response"*, with the docs' own example showing `false` before
> `res.send` and `true` after ([response reference](https://expressjs.com/en/5x/api/response/)).
> The error-handling guide makes the same state load-bearing: *"if you call `next()` with
> an error after you have started writing the response … the Express default error
> handler closes the connection and fails the request"*, and the documented guard in a
> custom handler is `if (res.headersSent) return next(err)`
> ([error handling](https://expressjs.com/en/guide/error-handling.html)).

## Measured

```js
// double-res.mjs
import express from 'express';

const app = express();
app.get('/d', (req, res, next) => {
  res.json({a: 1});
  next();
});
app.use((req, res) => {
  try {
    res.json({b: 2});
  } catch (err) {
    console.log('error:', err.message);
  }
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  console.log('body', await (await fetch(`http://127.0.0.1:${port}/d`)).json());
  server.close();
});
```

```console
$ node double-res.mjs
error: Cannot set headers after they are sent to the client
body { a: 1 }
```

## Causes

- `next()` after `res.json`
- Error middleware after a handler already responded
- Multiple `return res…` paths fall through

Guard: `if (res.headersSent) return next(err);` in error middleware.

## Interview questions

**★ What does the headers-already-sent error mean?**  
Something tried to write status/headers/body after the response started.

**★ How do you write an error handler that is safe when the response has already begun?**  
Check `res.headersSent` first and delegate: `if (res.headersSent) return next(err)`.
That hands the request to Express's default handler, which closes the connection —
the only honest outcome, since the status line is already on the wire.

**Why is this so much more common in async handlers?**  
Because the two writes are separated in time. A handler that responds and then
forgets to `return` continues into the next line; an awaited call that rejects
after a response was already sent lands in the error handler with `headersSent`
true. Both look fine in a synchronous reading of the code.

**Is a second write always a bug?**  
Yes, in the sense that only one response can exist per request. Streaming writes
many chunks, but that is one response with one status line — quite different from
two terminal calls racing each other.

## Trade-off

A single `return res.json(...)` per branch is verbose — every guard needs its own
`return`, and deep handlers grow a ladder of them. The alternative, letting
control flow fall through and responding at the bottom, reads better right up
until one branch forgets it already responded. **Choose the verbosity.** The
failure mode of the tidier style is a 500 in production plus a half-written
response, and it is invisible in review because each line is individually correct.

## Gotchas

**Symptom:** `Cannot set headers after they are sent to the client` in an async route  
**Cause:** A missing `return` — the handler responded, then carried on and responded again  
**Fix:** `return` every terminal call. `return res.status(400).json(...)`, always

**Symptom:** The error appears only under load, never locally  
**Cause:** A timeout or client disconnect responded first, then the real handler finished  
**Fix:** Guard the late path with `if (res.headersSent) return` before writing, and let
the error handler delegate rather than trying to send a second status

**Symptom:** Error middleware itself throws the headers-sent error  
**Cause:** It called `res.status(500).json(...)` on a response that had already begun  
**Fix:** The documented guard — `if (res.headersSent) return next(err)` — as the first
line of every error handler

**Symptom:** A `finally` block corrupts otherwise-fine responses  
**Cause:** Cleanup code that writes to `res` runs after the happy path already responded  
**Fix:** Keep `res` writes out of `finally`. Cleanup releases resources; it does not
speak to the client

---

← Prev: [Response shapes](03-response-shapes.md) · Next → [Static files](05-static-files.md)
