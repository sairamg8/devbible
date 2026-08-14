---
title: "The hang"
sidebar_label: "02 · The hang"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**No response and no `next` is a request that never ends. There is no timeout, no
warning, no log line and no status code — the only trace it leaves is a socket
that stays open.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. **The console block
> below is re-used unchanged from the earlier authorised `sandbox/express-verify`
> run and is sandbox-measured** — nothing was executed for this rewrite. The
> behaviour is documented in
> [using middleware](https://expressjs.com/en/guide/using-middleware.html): *"if a
> middleware function does not end the request-response cycle, it must call
> `next()` … Otherwise, the request will be left hanging."* The absence of any
> framework-level timeout is read from `router@2.2.0` and `express@5.2.1` in
> `sandbox/express-verify/node_modules/` — nothing in either package sets a timer.
> Node's socket-level timeouts are per the
> [`http.Server`](https://nodejs.org/api/http.html#class-httpserver) docs.

## What it looks like

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

The client gave up. **The server never noticed.** No error was thrown, no handler
ran, and if that app had an access logger on `res.on('finish')` it would have
logged nothing at all — because `'finish'` never fires for a response that was
never written.

## The five ways to get there

In rough order of how often they happen:

**1 · A branch with no `else`, where `res.status()` looked terminal.**

```js
if (!valid) return res.status(400);     // ← sends NOTHING
```

`res.status` sets a field and returns `res` for chaining. `return res.status(400)`
returns a response object. This is the single most common cause.

**2 · An early `return` on a path nobody tested.**

```js
if (cached) return;                     // meant "we're done" — we are not
```

The happy path calls `next()`, so the tests pass. The cache-hit path hangs.

**3 · A `catch` that logs and falls through.**

```js
try { req.user = await verify(token); }
catch (err) { logger.warn(err); }       // no next(), no response, no rethrow
```

**4 · Awaiting something that never settles.** A query with no statement timeout,
a `fetch` with no `AbortSignal`, a lock that is never released. The handler is
alive and stuck, which is worse than crashed: it holds a pooled connection too.

**5 · A promise you never awaited, in a handler that then falls off the end.**
The handler returns `undefined`, nothing has responded, and the work continues in
the background. This one *also* produces an `unhandledRejection` later if the
promise rejects — [Phase 5 · 02](../../phase-5-errors/02-async-errors.md).

## Finding it

The failure is defined by an **absence**, so nothing you normally look at will
show it. Two techniques work.

**Trace entry and exit per layer**, and look for an entry with no exit:

```js
const mark = label => (req, res, next) => {
  (req.trace ??= []).push(`→${label}`);
  res.on('finish', () => req.trace.push(`✓${label}`));
  next();
};
```

Simpler and usually enough: `DEBUG=router` prints each matched layer by
`layer.name`, so the **last line printed for that request names the layer that
swallowed it** — provided your middleware are named functions
([Phase 2 · 02 · chunk 02](../02-execution-order/02-ordering-in-practice.md)).

**Count in-flight requests.** Increment on entry, decrement on
`res.on('close')` — which fires whether the response completed or the client
gave up. A gauge that only goes up is a hang, and it is the metric that turns
"the service feels slow" into "eleven requests have been open for an hour".

## Bounding it — and what that does and does not fix

Nothing in Express or the router sets a timer. There are three places a limit can
live, and they are not interchangeable:

| Where | What it does | What it does **not** do |
|---|---|---|
| `server.requestTimeout`, `server.headersTimeout` (Node) | destroys the socket after a limit | stop your handler; it keeps running |
| a timeout middleware | responds 503 after *n* ms | stop your handler; it keeps running |
| the resource — statement timeout, `AbortSignal`, driver timeout | actually **cancels the work** | help if the hang is a missing `next()` |

🔴 **A timeout stops the waiting, not the work.** Nothing in Express or Node
unwinds an in-flight `await`; there is no thread to kill. The query keeps its
pooled connection, the HTTP call keeps its socket, and under load you now have
both a 503 storm and a pool exhaustion. Real cancellation is at the resource, and
the ordering must be **inside-out**: dependency timeout < application timeout <
proxy timeout < client timeout. [Phase 9 ·
06](../../phase-9-hardening/06-timeouts-and-secrets.md).

For a hang caused by a missing `next()`, the timeout is worth having anyway —
not because it fixes anything, but because it converts an invisible failure into
a 503 with a log line, which is the difference between a bug you find in an hour
and one you find in a quarter.

## Preventing it

- **`return` on every terminal call.** `return res.json(...)`, `return next()`,
  `return next(err)`. Almost every hang and every double-send is one missing
  `return`.
- **Never `return res.status(n)` alone.** If a lint rule can enforce one thing
  here, make it this.
- **Every `catch` ends the request or rethrows.** A `catch` that only logs is a
  hang waiting for the right input.
- **Exhaustive branches.** If a middleware has an `if`, ask what the `else` does.
  The `else` that does nothing is the bug.
- **A timeout middleware plus a resource-level timeout**, so the failure is
  visible and the work is actually cancelled.

## Gotchas

**Symptom:** The browser spins and nothing appears in the access log
**Cause:** A layer neither responded nor called `next()`. There is no status to
log because none was chosen, and `res.on('finish')` never fired
**Fix:** `DEBUG=router` and read the last layer named for that request; or an
in-flight gauge decremented on `res.on('close')`

**Symptom:** `return res.status(400)` hangs
**Cause:** `res.status` sets a field and returns `res`. It sends nothing
**Fix:** `return res.status(400).json({…})`

**Symptom:** A route hangs only for one input
**Cause:** A branch — a cache hit, a validation failure, a `catch` — that returns
without responding
**Fix:** Read every branch of that function, including `catch` blocks

**Symptom:** The connection pool is exhausted and requests are timing out at the
proxy
**Cause:** Handlers awaiting a query with no statement timeout. The proxy gave up;
the handlers did not, and they still hold their connections
**Fix:** A statement timeout at the database, inside the application timeout.
Cancelling at the HTTP layer cancels nothing

**Symptom:** After adding a timeout middleware, the service still degrades under
load
**Cause:** The timeout responds; the work continues. You now have 503s *and* the
original resource contention
**Fix:** Timeouts inside-out, with the innermost one at the resource, where
cancellation is real

## Interview questions

**★ What happens if middleware neither responds nor calls `next()`?**
The request hangs until something else gives up — the client, or a socket-level
timeout. Express sets no timer, throws nothing and logs nothing, and because the
response is never written, `res.on('finish')` never fires, so an access logger
records nothing either.

**★ How do you debug a hanging request?**
`DEBUG=router` names each matched layer, so the last line printed for that
request identifies the layer that swallowed it — provided your middleware are
named functions. For production, an in-flight gauge decremented on
`res.on('close')` turns it into a metric.

**★ Why is `return res.status(400)` a bug?**
`res.status` sets the status field and returns `res` for chaining; it sends
nothing. The `return` makes it read as terminal, so the request hangs on
precisely the error path.

**★ Does a timeout middleware fix a hang?**
It makes it visible, not fixed. Nothing in Express or Node cancels a running
handler — there is no thread to kill and no way to unwind an in-flight `await`.
The query keeps its pooled connection. Real cancellation is at the resource:
statement timeouts, `AbortSignal`, driver timeouts.

**What order should timeouts be in?**
Inside-out: the dependency's timeout shorter than the application's, the
application's shorter than the proxy's, the proxy's shorter than the client's.
Any inversion means the outer layer gives up while the inner one is still
holding resources.

**Why is a hung handler worse than a crashed one?**
A crash is loud, is captured by a supervisor, and releases everything it held. A
hang is silent and keeps its pooled connection, its socket and its memory — so a
handful of them degrade the whole process while every dashboard looks normal.

---

← Prev: [What you can pass](01-what-you-can-pass.md) · Index: [`next` semantics](README.md) · Next → [Double send and guards](03-double-send-and-guards.md)
