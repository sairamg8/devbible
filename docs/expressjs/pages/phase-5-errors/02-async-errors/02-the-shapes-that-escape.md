---
title: "The four shapes that escape"
sidebar_label: "02 · The shapes that escape"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Express can only catch what is on the promise you returned. Four common shapes
put an error somewhere else — and the most dangerous of them returns 200 to the
client first.**

> Verified: 2026-08-14. The limit is documented: the
> [error-handling guide](https://expressjs.com/en/guide/error-handling.html) says
> that for *"callback-based APIs and asynchronous code without error-first
> callbacks"* you must call `next(err)` yourself. The mechanism behind the limit
> is `Layer.prototype.handleRequest` in **`router@2.2.0`**, quoted in
> [chunk 01](01-what-is-forwarded.md), in
> `sandbox/express-verify/node_modules/`. Node's default of terminating on an
> unhandled rejection is per the
> [`process`](https://nodejs.org/api/process.html#event-unhandledrejection)
> documentation and the `--unhandled-rejections` flag. **No sandbox run backs this
> page and it carries no console block.**

## The five, side by side

```js
// ✅ forwarded — Express called this and got a rejected promise back
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

The rule underneath all of them: **Express can only catch what is on the promise
your function returned.** An error that escapes on a callback, a timer, an event
handler or an unawaited promise is never seen by Express — it becomes an
`uncaughtException` or an `unhandledRejection`, which is a *process* concern
([page 06](../06-not-found-and-process.md)).

## 1 · Error-first callbacks

The stack that throws is the one the I/O library created when it invoked your
callback. Express's frame is long gone, so the `try` in `handleRequest` cannot
see it, and a `throw` there is an `uncaughtException` — which by default takes the
process down.

```js
// ⛔ crashes the process
fs.readFile(p, (err, data) => { if (err) throw err; });

// ✅ explicit hand-off
fs.readFile(p, (err, data) => { if (err) return next(err); res.send(data); });

// ✅✅ better — get back onto the promise Express is watching
const data = await fs.promises.readFile(p);
res.send(data);
```

**Prefer the promise API of every library that offers one.** `node:fs/promises`,
`pg`'s promise interface, `redis` v4+, `mongodb`'s driver — all of them put the
failure back on the returned promise, which is where the guarantee is. For a
library with only a callback API, promisify it once at the boundary rather than
scattering `next(err)` calls through the handler.

## 2 · Floating promises — the one that bites

🔴 **This is the dangerous shape, because the request succeeds.**

```js
app.get('/d', async (req, res) => {
  sendWelcomeEmail(req.user);        // no await, no return, no .catch
  res.json({ok: true});
});
```

The client gets a 200. Then, later, the promise rejects, nothing is listening,
and Node emits `unhandledRejection` — which **since Node 15 terminates the
process by default**. So the symptom is not "an error was returned"; it is *"the
service restarts a few times an hour and nobody knows why"*, with the crash
arriving with no request context attached.

Three legitimate resolutions, in order of preference:

```js
// ✅ 1 — await it. The failure becomes a 500 for the request that caused it.
await sendWelcomeEmail(req.user);

// ✅ 2 — deliberately fire and forget, with an explicit catch
void sendWelcomeEmail(req.user).catch(err =>
  logger.error({err, requestId: req.id}, 'welcome email failed'));

// ✅ 3 — hand it to something built for out-of-band work
await queue.add('welcome-email', {userId: req.user.id});
```

**Option 2 is the one to be careful about.** It is correct only if the caller
genuinely does not need to know — and the `.catch` must log with the request id,
or you have traded a crash for a silent loss. Option 3 is what you want the
moment the work must actually happen: a queue gives you retries and visibility,
which a `.catch` does not
([Node Phase 7](/docs/nodejs/pages/phase-7-background-work/)).

**A lint rule catches this class mechanically** — `no-floating-promises` in
`typescript-eslint`, which is the strongest argument for TypeScript on an Express
codebase that this bible makes.

## 3 · Timers

```js
setTimeout(() => { throw new Error('gone'); }, 10);
```

Same reason as callbacks: a fresh stack, scheduled by the event loop. And the
same shape appears in `setInterval`, `setImmediate`, `process.nextTick` and
`queueMicrotask`.

If the work belongs to the request, `await` a promisified timer
(`node:timers/promises`) so it is back on the chain. If it does not belong to the
request, it should not be started from a handler at all — a per-request
`setInterval` that nobody clears is also a leak.

## 4 · Event emitters

```js
const stream = fs.createReadStream(p);
stream.pipe(res);                          // ⛔ a stream error is an 'error' event
```

An `'error'` event with no listener throws — as an uncaught exception, from the
emitter, on the emitter's stack. So:

```js
const stream = fs.createReadStream(p);
stream.on('error', next);                  // ✅ but see below
stream.pipe(res);
```

🔴 **And there is a second problem specific to streams.** By the time a stream
fails partway through, the response has usually started, so `next(err)` reaches
an error handler that cannot write. That is exactly the case
`if (res.headersSent) return next(err)` exists for, and the outcome is
`finalhandler` destroying the socket
([01 · chunk 02](../01-error-middleware/02-the-default-handler.md)).

`stream.pipeline` (or `node:stream/promises`' `pipeline`) is the better tool: it
propagates errors and destroys all the streams in the chain, which a bare `pipe`
does not.

## 5 · A fifth, less discussed: `Promise.all` and partial failure

```js
const [user, orders] = await Promise.all([getUser(id), getOrders(id)]);
```

This *is* forwarded — it is on the returned promise. The subtlety is that
**`Promise.all` rejects on the first failure while the others keep running**, so a
slow second call continues after the request has already 500'd, and its own
failure may then be unhandled.

Use `Promise.allSettled` when partial results are acceptable, and give each call
an `AbortSignal` derived from one controller so the survivors are actually
cancelled rather than merely ignored
([Phase 9 · 06](../../phase-9-hardening/06-timeouts-and-secrets.md)).

## Trade-off

Automatic forwarding is a genuine improvement — it deletes `express-async-errors`
and a wrapper from every project, and makes a bare `throw` the normal way to
fail. What it costs is **a false sense of coverage**: teams read "Express 5
handles async errors" and stop thinking about the four shapes above, which are
precisely the ones that take the process down rather than returning a 500.

Treat the feature as covering the common path, and keep auditing for the shapes.
The two cheap structural defences are **promise APIs everywhere** and **a
`no-floating-promises` lint rule**; the two cheap operational ones are
`process.on('unhandledRejection')` and `process.on('uncaughtException')` that log
before dying ([page 06](../06-not-found-and-process.md)).

## Gotchas

**Symptom:** A `throw` inside a `fs` or database callback crashes the whole
process
**Cause:** The callback runs on a later stack that Express never saw
**Fix:** `return next(err)` from inside the callback, or use the promise API so
the handler's own rejection is what propagates

**Symptom:** The service restarts several times an hour with no failing requests
**Cause:** A floating promise. The request returned 200; the rejection arrived
later as an `unhandledRejection`, which terminates the process by default since
Node 15
**Fix:** `await`, or an explicit `.catch` that logs, or a queue. Add
`no-floating-promises`

**Symptom:** An error is logged with no request context at all
**Cause:** It surfaced at the process level, long after the request finished
**Fix:** Same. The context only exists while the request does

**Symptom:** A file download fails and the client receives a truncated file that
looks complete
**Cause:** A stream error after headers were sent; the error handler could not
change the status
**Fix:** `pipeline` rather than `pipe`, plus
`if (res.headersSent) return next(err)` so the socket is destroyed instead

**Symptom:** After a 500 from `Promise.all`, an unrelated `unhandledRejection`
appears seconds later
**Cause:** `Promise.all` rejected on the first failure; the other calls kept
running and one of them failed too, with nothing listening
**Fix:** `allSettled` where partial results are fine, and an `AbortSignal` shared
across the calls so the rest are cancelled

**Symptom:** A per-request `setInterval` keeps firing after the response
**Cause:** Nothing clears it, and it is not tied to the request lifetime
**Fix:** Do not start recurring work from a handler. If you must, clear it on
`res.on('close')`

## Interview questions

**★ Name four things Express 5 will not catch.**
A `throw` inside an error-first callback, a floating promise, a `throw` in a
timer callback, and a `throw` in an event-emitter handler. All four are off the
promise the handler returned, which is the only thing the router attaches to.

**★ You call an async function in a handler and do not await it, and it rejects.
What happens?**
The request succeeds normally with a 200. The rejection surfaces later as an
`unhandledRejection`, which by default **terminates the process** since Node 15 —
with no request context attached. It is the most common way async errors go
missing in an Express 5 app.

**★ How do you fix the callback case properly?**
Prefer the library's promise API, so the failure is back on the promise Express
is watching. If only a callback API exists, `return next(err)` from inside the
callback, or promisify it once at the boundary.

**★ Why is a stream error particularly awkward?**
Because it usually happens after the response has started, so the error handler
cannot change the status or the body. `pipeline` propagates the error and
destroys the whole chain; the `res.headersSent` guard then lets `finalhandler`
destroy the socket, so the client sees a transport error rather than a truncated
body it would treat as complete.

**What is the subtle problem with `Promise.all` in a handler?**
It rejects on the first failure while the other promises keep running. The
request 500s, and a later failure among the survivors can be an unhandled
rejection. Use `allSettled` where partial results are acceptable, and share an
`AbortSignal` so the rest are actually cancelled.

**What is the strongest structural defence against this whole class?**
A `no-floating-promises` lint rule — it catches the dangerous shape mechanically,
across the codebase, rather than relying on review.

---

← Prev: [What is forwarded](01-what-is-forwarded.md) · Index: [Async errors](README.md) · Next → [Writing async handlers](03-writing-async-handlers.md)
