---
title: "The four endings"
sidebar_label: "03 · The four endings"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**A request ends in exactly one of four ways: something responded, an error
reached the end, nothing matched, or nobody did anything. Only the last one has
no status code.**

> Verified: 2026-08-14. The endings are read from `express@5.2.1`'s `app.handle`
> and `router@2.2.0`'s `Router.prototype.handle` in
> `sandbox/express-verify/node_modules/`, and from the behaviour of the
> `finalhandler` package they hand off to. **Reading source is not a run: nothing
> was executed for this page and it carries no console block.** The default
> error-handler behaviour is cross-checked against the Express
> [error-handling guide](https://expressjs.com/en/guide/error-handling.html);
> the response-state properties against the Node
> [`http.ServerResponse`](https://nodejs.org/api/http.html#class-httpserverresponse)
> docs.

## The four

| Ending | How the walk got there | What the client sees |
|---|---|---|
| **1 · Responded** | some layer wrote and ended the response | your status and body |
| **2 · Error** | `next(err)` reached the end of the stack | your error middleware's answer, or `finalhandler`'s |
| **3 · Unmatched** | the walk ran off the end with no error | your 404 middleware, or `finalhandler`'s 404 |
| **4 · Nothing** | a layer neither responded nor called `next` | **nothing** — the client hangs until a timeout |

Endings 2 and 3 arrive at the **same function**. `app.handle` installs
`finalhandler(req, res, …)` as the router's callback; the router calls it either
with an error or with nothing, and `finalhandler` chooses 500 or 404 on that
basis. That is the mechanical reason **a 404 is not an error in Express** and
never reaches four-argument middleware.

Ending 4 is the only one with no status code, because no code ever ran that could
choose one. There is nothing to log, nothing to trace, and no event — which is
what makes it the hardest of the four to debug.

## Ending 1 — responded

`res.json` → `res.send` → `res.end`. The state transitions that matter:

| Property | Becomes true when | Why you care |
|---|---|---|
| `res.headersSent` | the **first** byte of the response is written | after this, `res.status()` and `res.set()` silently do nothing |
| `res.writableEnded` | `res.end()` has been called | distinguishes "we answered" from "the client left" |
| `res.writableFinished` | the last byte has been flushed to the OS | what `'finish'` fires on |

The guard every error handler needs is built on the first of those, and it is in
the Express documentation verbatim:

```js
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);          // hand to the default handler — it closes the connection
  }
  res.status(500).json({error: 'internal'});
});
```

Without it, an error raised *after* the response started produces a second
`res.status().json()` and a `ERR_HTTP_HEADERS_SENT` throw inside your own error
handler — which then has nowhere to go.

## Ending 2 — an error reached the end

If no four-argument middleware handled it, Express's **default error handler**
answers. Its documented behaviour:

- Status from `err.status` or `err.statusCode`, falling back to **500** if the
  value is outside 4xx–5xx.
- Any `err.headers` are **copied onto the response** — which is how a `503` can
  carry `Retry-After` on the error object itself.
- `err.stack` in the body when `env` is `development`; a plain HTML page in
  production.
- The connection is **closed** if the response had already started.

That last point is the one to remember: the default handler is not only a
formatter, it is the thing that stops a half-written response from being
interpreted as complete.

## Ending 3 — nothing matched

`finalhandler` produces a 404. Two things follow:

- **A 404 never reaches error middleware.** It travelled as "no error", so the
  four-argument stack was never consulted.
- **Your own 404 handler is ordinary three-argument middleware**, mounted below
  every route and above the error handler. A four-argument version is
  unreachable, because nothing forwarded an error to reach it.

```js
app.use(routes);
app.use((req, res) => res.status(404).json({error: 'not found'}));   // ← ending 3
app.use((err, req, res, next) => { /* … */ });                        // ← ending 2
```

Express also does not answer **405** for a known path with an unregistered
method — that is a 404 too. The one exception is `OPTIONS`, where the router
builds an `Allow` header itself
([topic 02 · chunk 04](../02-app-router-server/04-url-rewriting-and-options.md)).

## Ending 4 — the hang

The documentation states the rule plainly: *"if a middleware function does not
end the request-response cycle, it must call `next()` … Otherwise, the request
will be left hanging."*

The four ways to arrive there, in order of how often they happen:

1. **A conditional with no `else`.** `if (bad) { return res.status(400)… }` — and
   `res.status()` alone does not end anything. It returns `res` for chaining. The
   `return` makes it look terminal.
2. **An early `return` on a code path nobody tested.** The success path calls
   `next()`; the "already exists" path returns.
3. **A rejected promise in Express 4-era code**, where the `catch` logs and does
   not call `next(err)`.
4. **Awaiting something that never settles** — a query with no statement timeout,
   a `fetch` with no `AbortSignal`.

The way to find it, given the request produced no log line and no status: **log
entry and exit of every layer** in the suspect stack and look for the layer with
an entry and no exit. It is the only technique that works, because the failure is
defined by an absence.

The way to *stop* it hurting: an outer timeout so the client gets a 503 instead of
a spinner, ordered inside-out — dependency timeout < app timeout < proxy timeout
< client. But be clear that this bounds the waiting and does not cancel the work
([Phase 9 · 06](../../phase-9-hardening/06-timeouts-and-secrets.md)).

## Trade-off

A long middleware chain is explicit, testable and easy to reason about one layer
at a time. Every hop costs a function call and a chance to get order wrong, and
each layer is another place a request can end in ending 4. **Keep global
middleware minimal and put feature logic on routers** — the fewer layers a
request crosses before something takes responsibility for answering, the smaller
the surface for all four endings to go wrong.

## Gotchas

**Symptom:** The browser spins forever, and nothing appears in the access log
**Cause:** Ending 4 — a layer neither responded nor called `next()`. There is no
status to log because none was chosen
**Fix:** Log entry and exit per layer; find the one with an entry and no exit. Add
an outer timeout so the failure is at least visible as a 503

**Symptom:** `res.status(400)` "returns" but the request hangs
**Cause:** `res.status()` sets a field and returns `res`. It does not send
anything. `return res.status(400)` returns a response object, not a response
**Fix:** `return res.status(400).json({…})` — the terminal call is `json`, `send`
or `end`

**Symptom:** `Cannot set headers after they are sent to the client`
**Cause:** Two layers both wrote — usually a handler that responded and then
called `next()` without returning
**Fix:** `return next()` and `return res.json(...)`, always. And guard error
handlers with `if (res.headersSent) return next(err)`

**Symptom:** Your 404 handler never runs; clients get an HTML 404 instead
**Cause:** It was registered as four-argument middleware, so it sits in the error
stack, which a 404 never enters
**Fix:** Three arguments, mounted below the routes and above the error handler

**Symptom:** A 500 page in production leaks a stack trace
**Cause:** `env` resolved to `development` — `NODE_ENV` was unset, or set after
`express()` had already read it at `app.init()`
**Fix:** Set `NODE_ENV=production` in the environment before the process starts

## Interview questions

**★ What are the possible ways a request can end in Express?**
Four: a layer responded; an error reached the end of the stack and was formatted
by your error middleware or the default handler; nothing matched and
`finalhandler` sent a 404; or nothing happened at all and the client hangs. Only
the last has no status code.

**★ Why does a 404 not reach error middleware?**
Because it is not an error. The router ran off the end of its stack and called
its callback with no error argument; `finalhandler` reads the absent error and
chooses 404. Error middleware is only consulted when something set an error.

**★ Where should the 404 handler sit, and what shape is it?**
Three-argument middleware, below every route and above the error handler. A
four-argument version is unreachable.

**★ What does `if (res.headersSent) return next(err)` protect against?**
An error raised after the response started. Writing a second status and body
throws `ERR_HTTP_HEADERS_SENT` inside your own error handler; forwarding instead
lets the default handler close the connection so a half-written response is not
read as complete.

**What does the default error handler actually do?**
Status from `err.status`/`err.statusCode`, defaulting to 500 outside 4xx–5xx;
copies `err.headers` onto the response; includes the stack in development and a
plain page in production; and closes the connection if the response had already
started.

**A request hangs. How do you find the layer responsible?**
Log entry and exit of each layer and look for an entry with no exit — the failure
is an absence, so nothing else will show it. The usual cause is a branch that
`return`s without responding or calling `next()`.

---

← Prev: [How a handler is invoked](02-how-a-handler-is-invoked.md) · Index: [Request lifecycle](README.md) · Next topic → [Creating an app](../04-creating-an-app.md)
