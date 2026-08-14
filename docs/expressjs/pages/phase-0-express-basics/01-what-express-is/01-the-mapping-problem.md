---
title: "The mapping problem Express solves"
sidebar_label: "01 · The mapping problem"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Express is not a language and not an application architecture. It is a
programmable layer of routing and middleware on top of Node's `http.Server`.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. The `node:http`
> surface described here is from the Node documentation —
> [HTTP](https://nodejs.org/api/http.html), specifically
> `http.createServer`, `http.IncomingMessage` and `http.ServerResponse`. The
> Express side is from [expressjs.com](https://expressjs.com/en/5x/api.html) and
> from the installed `express@5.2.1` source in
> `sandbox/express-verify/node_modules/express/`, cited by file and function.
> **No sandbox run backs this chunk** — the one console block in this topic is on
> [chunk 02](02-the-app-is-a-function.md) and is re-used from an earlier
> authorised run, not reproduced here.

## What `node:http` actually gives you

Start from the thing Express sits on, because every Express behaviour that
surprises people is a Node behaviour that Express did not hide.

Node's HTTP server takes one function and calls it once per request:

```js
// raw.mjs — no framework at all
import http from 'node:http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('hello');
});

server.listen(3000);
```

That callback is the **request listener**, and its two arguments are the whole
API surface Node hands you:

| Argument | Actual class | What it is |
|---|---|---|
| `req` | `http.IncomingMessage` | A **readable stream** of the request body, with the request line and headers already parsed onto it |
| `res` | `http.ServerResponse` | A **writable stream** for the response, with helpers for the status line and headers |

Four consequences follow directly, and each one is a thing Express will later be
accused of doing wrong when it is simply not doing it at all:

- **`req.url` is not a URL.** It is the request target — path plus query string,
  with no origin. `http://localhost:3000/orders?page=2` arrives as the string
  `/orders?page=2`. There is no host in it, because the host is a header.
- **There is no body.** `req` is a stream that has not been read. Nothing has
  decoded JSON, nothing has decoded a form, nothing has checked a size.
- **There is no routing.** The same function runs for `GET /`, for
  `DELETE /orders/12`, and for a request to a path nobody implemented.
- **Nothing is automatic on the way out.** No status defaulting you did not ask
  for, no content type, no serialisation.

## The dispatcher you write if you do not use a framework

Given only that, the first thing every Node codebase grows is a method-and-path
switch. It starts honest:

```js
const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end('{"ok":true}');
  }

  res.writeHead(404, { 'content-type': 'application/json' });
  res.end('{"error":"not found"}');
});
```

Then the requirements arrive, and each one deforms it in a predictable way:

| The requirement | What it forces into the dispatcher |
|---|---|
| `GET /orders/:id` | Splitting `req.url` on `?`, then splitting the path on `/`, then positional matching — and now `/orders/12/items` needs its own case |
| A JSON body | Collecting stream chunks, concatenating, `JSON.parse` in a `try`, and a size cap so a client cannot exhaust memory |
| `?page=2&sort=desc` | Parsing the query string, and deciding what `?tag=a&tag=b` means |
| Logging every request | A line at the top of the function, and a hook on `res` `'finish'` to capture the status you have not chosen yet |
| Auth on some routes | A conditional that must run *before* the dispatch, but must know which route was going to run |
| One error format | A `try`/`catch` around everything, and a second one for the async paths the first cannot see |

The last two are where hand-rolling loses. Logging, auth, body parsing and error
formatting are **cross-cutting**: each one wants to run for many routes but not
all of them, in a defined order, with the ability to stop the request early.
A `switch` has no vocabulary for "run these three things, in this order, then
the handler, and let any of them end the request."

**That is the mapping problem**, and it has two halves:

1. **Dispatch** — turn (method, path) into the right function.
2. **Composition** — run an ordered pipeline of functions around that dispatch,
   any of which may respond, mutate the request, or hand off.

Every Node HTTP framework in existence is an answer to those two. Express is the
answer most of the ecosystem already speaks.

## What Express supplies, exactly

Four things, and it is worth being able to name them separately, because three
of the four are things people mistakenly attribute to "Express" as a whole.

| Piece | Role | Owned by |
|---|---|---|
| **Router** | Match method + path → an ordered list of handlers | The separate `router` package — see [chunk 02](02-the-app-is-a-function.md) |
| **Middleware stack** | Ordered `(req, res, next)` functions, mounted by path | The same router |
| **`req` / `res` helpers** | `req.params`, `req.query`, `res.json`, `res.status`, `res.sendFile`, … | `express/lib/request.js` and `response.js` |
| **Settings** | App-wide knobs — `trust proxy`, `query parser`, `etag`, `views` | `express/lib/application.js` |

A one-line version worth memorising: **Express is a middleware engine with a
router, plus a set of convenience methods on Node's request and response.**

What that sentence deliberately excludes is the whole rest of a backend.
Business rules, databases, queues, hashing, background work and configuration are
not "Express". They are what you call *from* handlers, and they are why this
bible splits [Node](/docs/nodejs/pages/README.md) and Express into separate
tracks rather than one "backend" pile.

## Why the pipeline model — and not decorators or a controller registry

Express's answer to composition is the smallest one available: a list of
functions, called in order, each given the ability to call the next.

```js
app.use(requestId);        // runs for everything
app.use(express.json());   // runs for everything
app.get('/orders/:id', requireAuth, loadOrder, sendOrder);
```

The interesting property is that **there is no separate concept for
"middleware" and "handler"**. `requireAuth` and `sendOrder` have the same
signature and the same powers; the only difference is that the last one happens
to respond. That is why Express has such a large ecosystem: a package only has to
export a function of the right shape to plug in, with no base class to extend, no
decorator to import, no registry to join and no framework version to match.

The cost is that **nothing is declared anywhere**. The set of things that run
before a handler is the accumulated result of every `app.use` above it in file
order, spread across however many files assemble the app. Express cannot tell
you what will run for a given route without running it, and neither can your
editor. Frameworks with schemas and decorators buy introspection, generated
documentation and compile-time checks with exactly the ceremony Express refuses.

That trade is the honest summary of the framework: **maximum composability,
minimum declaration.** It is also why [Phase 10 · the app
factory](../../phase-10-app-factory/01-create-app.md) exists as a Master topic —
when nothing is declared, the assembly order becomes the design document, and it
has to be readable in one place.

## Gotchas

**Symptom:** `req.url` does not contain the host, so building an absolute URL from
it produces `Invalid URL`
**Cause:** `req.url` is the HTTP **request target**, not a URL — the origin lives in
the `Host` header, and Express exposes it as `req.hostname`
**Fix:** Build the base from `req.protocol` and `req.get('host')` and resolve
`req.originalUrl` against it with `new URL(target, base)`. See
[Phase 3 · req anatomy](../../phase-3-requests/01-req-anatomy/02-the-twelve-getters.md) for which of these
Express derives and which it passes straight through

**Symptom:** `req.body` is `undefined` and no error was thrown
**Cause:** Nothing parses a body unless you mount a parser — and in Express 5 an
unparsed body is `undefined`, where Express 4 gave you `{}`
**Fix:** Mount `express.json()` / `express.urlencoded()`, and see
[Phase 3 · 02](../../phase-3-requests/02-json-and-urlencoded/01-the-four-gates.md) for the
content-type gate that decides whether they run at all

**Symptom:** Tutorials treat "Express" as the whole backend curriculum
**Cause:** Course marketing folds databases, auth theory and Docker into "Express"
**Fix:** Keep the boundary — HTTP surface here; Node, database, Redis and infra
elsewhere. [Chunk 04](04-the-boundary.md) states the rule this bible uses

**Symptom:** You cannot debug a hang, a truncated response or a wrong status
**Cause:** Express was learned without `node:http` underneath it
**Fix:** Finish [Node Phase 5](/docs/nodejs/pages/phase-5-http-processes/) first —
bodies are streams, the server is real, and Express hides none of it

## Interview questions

**★ What problem does Express solve that `node:http` does not?**
Two: **dispatch** — mapping (method, path) to a function, including path
parameters — and **composition** — running an ordered pipeline of cross-cutting
functions around that dispatch, any of which can end the request. `node:http`
gives you exactly one callback for every request and nothing else.

**★ What is Express, in one sentence?**
A routing and middleware framework on top of Node's `http` module — not a
language, not an ORM, and not a full application stack.

**★ Why does `req.url` not contain the hostname?**
Because it is the HTTP request target, which for an ordinary origin-form request
is only the path and query. The host travels as the `Host` header, which is why
`req.hostname` exists on the Express request and why it is affected by
[`trust proxy`](../../phase-9-hardening/01-trust-proxy/README.md).

**★ What is the difference between a middleware function and a route handler in
Express?**
Nothing structural — same signature, same powers, same stack. The difference is
positional: a handler is registered against a method and path and usually
responds; middleware is usually registered with `app.use` and usually calls
`next()`. Express does not enforce either habit.

**Why does Express have such a large middleware ecosystem compared with more
modern frameworks?**
Because the plug-in contract is a plain function of three arguments. There is no
base class, decorator, registry or plug-in API to satisfy, so a package can
support many framework versions — and often several frameworks — with no
adapter.

**What does Express give up by having no declaration step?**
Introspection. Nothing can enumerate what runs before a given route without
executing it, so there is no generated documentation, no compile-time check that
a route is authenticated, and no framework-level view of the request pipeline.
That is the whole argument for schema-first frameworks, and the reason the app
factory is a Master topic here.

---

Index: [What Express is](README.md) · Next → [The app is a function](02-the-app-is-a-function.md)
