---
title: "Double send and guards"
sidebar_label: "03 · Double send and guards"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**The first response wins and the second throws — usually inside code that has
nothing to do with the bug. The guard is one word on every terminal call, and one
line at the top of every error handler.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. **The console block
> below is re-used unchanged from the earlier authorised `sandbox/express-verify`
> run and is sandbox-measured** — nothing was executed for this rewrite. The
> documented guard is from the
> [error-handling guide](https://expressjs.com/en/guide/error-handling.html):
> *"if you call `next()` with an error after you have started writing the response
> … the Express default error handler closes the connection and fails the
> request"*, hence `if (res.headersSent) return next(err)`. `res.headersSent`,
> `res.writableEnded` and `res.writableFinished` are per the Node
> [`http.ServerResponse`](https://nodejs.org/api/http.html#class-httpserverresponse)
> docs.

## What it looks like

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

**The client got `first`.** The failure is entirely server-side: an
`ERR_HTTP_HEADERS_SENT` thrown in the *second* writer, which in real code is
usually a piece of shared infrastructure — a 404 handler, an error handler, a
logging wrapper — with no visible relationship to the handler that actually
misbehaved.

That is what makes this hard to diagnose. **The stack points at the victim, not
the cause.**

## Why it happens: the walk resumes twice

There is no guard anywhere. `next` is an ordinary closure over an index; calling
it twice resumes the walk twice, from the same position:

```js
app.use((req, res, next) => {
  loadThing(req, (err, thing) => {
    if (err) next(err);        // ← no return
    req.thing = thing;
    next();                    // ← also runs
  });
});
```

Everything below index *n* now runs **twice** — the route, the response, the
logger, the error handler. In an async chain the two passes interleave, so the
symptom is intermittent, which is the worst property a bug can have.

Express tracks nothing about whether `next` was called. There is no
"already dispatched" flag to check and no warning to enable.

## The three response-state properties

Node exposes exactly what you need to know, and the three are not
interchangeable:

| Property | True once | Use it for |
|---|---|---|
| `res.headersSent` | the **first** byte of the response is written | "is it too late to set a status or header?" |
| `res.writableEnded` | `res.end()` has been called | "did *we* finish, or did the client leave?" |
| `res.writableFinished` | the last byte reached the OS | what `'finish'` fires on |

**After `headersSent`, `res.status()` and `res.set()` silently do nothing.** They
do not throw; they mutate fields nobody will read. Only a *write* throws. So a
handler that sets a status too late fails invisibly, and one that writes a body
too late fails loudly in someone else's code.

## The two guards

**1 · `return` on every terminal call.**

```js
if (!req.user) return next(new Error('unauthenticated'));
if (cached)    return res.json(cached);
return next();
```

`return` is ordinary JavaScript control flow doing the work the framework will
not. Applied consistently it removes both the double-send class and most of the
hang class, because the two share a root cause: **`next` and `res.json` do not
stop your function.**

**2 · `res.headersSent` at the top of every error handler.**

```js
app.use((err, req, res, next) => {
  logger.error({err, requestId: req.id});

  if (res.headersSent) {
    return next(err);      // hand to the default handler — it closes the connection
  }

  res.status(statusFor(err)).json(bodyFor(err));
});
```

This is the documented pattern, and the *why* matters: an error raised **after**
the response started — a stream that failed mid-body, a serialisation error
halfway through — cannot be answered. Trying produces
`ERR_HTTP_HEADERS_SENT` **inside your error handler**, which then has nowhere to
go. Forwarding lets Express's default handler close the connection, so the client
sees a truncated response rather than a plausible-looking complete one. That
distinction is the whole point: a half-written body that ends cleanly is
**worse** than a broken connection, because a client will parse it.

## Where the second write actually comes from

In real codebases, rarely from an obvious `res.send` twice. The recurring shapes:

- **`next()` after responding**, as above — the classic.
- **A stream error after headers.** `res.sendFile` or a piped stream that fails
  partway: headers are out, the error reaches your handler, and the handler tries
  to write JSON. This is the case `headersSent` exists for.
- **A timeout middleware that responds 503** while the real handler is still
  running — and then the handler finishes and writes too. Any timeout middleware
  needs the `headersSent` check on **both** sides.
- **Two error handlers that both respond.** Chained error middleware is a good
  pattern — one logs, one responds — but only one may write. The logger must
  `next(err)`.
- **A `finally` block that responds.** `finally` runs on the success path too.

## Trade-off

Calling `next` after partial work is what makes pipelines composable — a
middleware that enriches `req` and hands on is the entire model. Calling it after
a **terminal response** is always wrong, and there is no framework check for the
difference.

**Structure it away rather than guarding it away.** A stack where terminal
handlers sit at the bottom, and nothing below a route can respond except the 404
and the error handler, makes the double-send unreachable by construction. Guards
are the fallback for the paths that structure cannot reach — streams, timeouts,
error handlers.

## Gotchas

**Symptom:** `Cannot set headers after they are sent to the client`, with a stack
pointing at the 404 handler or the error handler
**Cause:** Something upstream already responded and then called `next()`. The
stack names the victim, not the cause
**Fix:** Find the layer that responded without returning. `DEBUG=router` shows
which layers ran; anything after the responder is suspicious

**Symptom:** The bug is intermittent and only under load
**Cause:** `next` called twice on an async path, so the two passes interleave
differently each time
**Fix:** `return next(...)` on every branch, especially inside callbacks

**Symptom:** `res.status(404)` after `res.send()` produces a 200
**Cause:** Headers were flushed on the first write. `res.status` after that
mutates a field nobody reads and does **not** throw
**Fix:** Decide the status before writing anything

**Symptom:** A stream fails halfway and the client receives valid-looking JSON
containing half a payload
**Cause:** The error handler wrote a body on top of a partially sent response —
or worse, did not, and the truncated body ended cleanly
**Fix:** `if (res.headersSent) return next(err)`. The default handler closes the
connection so the client sees a transport error rather than parsing garbage

**Symptom:** A timeout middleware and the real handler both respond
**Cause:** The timeout fired, responded 503, and the handler completed afterwards
**Fix:** `headersSent` checks on both sides. And remember the timeout did not stop
the handler — [chunk 02](02-the-hang.md)

## Interview questions

**★ What does a double `res.send` produce?**
The first body reaches the client; the second write throws
`ERR_HTTP_HEADERS_SENT` server-side. The client sees a successful response, so
the failure is invisible from outside and shows up as an exception in whichever
layer wrote second.

**★ Why does calling `next()` twice break things?**
Because `next` is a closure over the walk's index with no guard. Calling it twice
resumes the walk twice from the same position, so every layer below runs twice —
including whichever one writes the response.

**★ What is `if (res.headersSent) return next(err)` for?**
For an error raised after the response has started — a failed stream, a
mid-serialisation throw. Writing a second status and body throws inside your own
error handler; forwarding lets Express's default handler close the connection, so
the client sees a truncated transfer rather than a complete-looking wrong answer.

**★ What is the difference between `res.headersSent` and `res.writableEnded`?**
`headersSent` becomes true at the first byte written — after that, `res.status`
and `res.set` are silent no-ops. `writableEnded` becomes true when `res.end()`
has been called, which is how you distinguish "we answered" from "the client left"
inside a `'close'` handler.

**Why does `res.status()` after a send fail silently while `res.send()` throws?**
Because setting a status only mutates a field on the response object, and nothing
reads it once the status line is on the wire. Writing actually attempts a socket
operation, which is where Node raises `ERR_HTTP_HEADERS_SENT`.

**How would you make double-sends structurally impossible rather than guarded
against?**
Put terminal handlers at the bottom of the stack, so nothing below a route can
respond except the 404 and the error handler, and `return` every terminal call.
Guards are then only needed for the cases structure cannot reach: streams,
timeouts and error handlers.

---

← Prev: [The hang](02-the-hang.md) · Index: [`next` semantics](README.md) · Next topic → [Middleware factories](../04-middleware-factories.md)
