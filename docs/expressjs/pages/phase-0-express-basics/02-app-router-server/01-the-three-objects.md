---
title: "The three objects"
sidebar_label: "01 · The three objects"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

**Three different objects. Confusing them is how "my middleware never runs" and
"the server won't shut down" both start.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0**. **The console block
> below is re-used unchanged from the earlier authorised `sandbox/express-verify`
> run and is sandbox-measured** — nothing was executed for this rewrite. The
> ownership claims are read from the installed `express@5.2.1` source
> (`lib/application.js`) and the Node
> [`http.Server`](https://nodejs.org/api/http.html#class-httpserver) and
> [`net.Server`](https://nodejs.org/api/net.html#class-netserver) documentation.
> Note that `mountpath` is a property of a mounted **app**, not of a `Router` —
> [chunk 05](05-sub-apps-and-the-server.md) has the full comparison.

## The graph

```text
http.Server          ← owns the socket: accept, listen, close, timeouts
    │
    └── app          ← Express application: settings + the top-level stack
            │
            ├── middleware (json, cors, …)
            └── Router     ← a portable stack, mounted at a path prefix
                    └── Route  ← one path, a handler per method
                          └── handlers
```

| Object | You create it with | Its job | Where it lives |
|---|---|---|---|
| **`http.Server`** | `http.createServer(app)`, or `app.listen` returns one | Bind a port, accept connections, apply socket timeouts, shut down | `node:http` |
| **`app`** | `express()` | Application settings, the top-level stack, mounting | `express/lib/application.js` |
| **`Router`** | `express.Router()` | A portable, mountable stack of middleware and routes | the `router` package |
| **`Route`** | `app.route(path)` / created internally by `app.get(…)` | One path, with a handler stack per HTTP method | `router/lib/route.js` |

Most explanations stop at three. The fourth — `Route` — is worth naming, because
it is the object that knows which **methods** a path supports, and that is what
makes Express's automatic `OPTIONS` response possible
([chunk 04](04-url-rewriting-and-options.md)).

`app` is itself a request listener function. A `Router` is a stack you **mount**
on `app` or on another router. Only the **server** listens.

## Prove it

```js
// object-graph.mjs
import express from 'express';
import http from 'node:http';

const app = express();
const users = express.Router();

users.get('/', (req, res) => {
  res.json({mountpath: req.baseUrl, path: req.path});
});

app.use('/users', users);

const server = http.createServer(app);
server.listen(0, async () => {
  const {port} = server.address();
  const r = await fetch(`http://127.0.0.1:${port}/users`);
  console.log(await r.json());
  console.log('server is http.Server:', server instanceof http.Server);
  console.log('app === users?', app === users);
  server.close();
});
```

```console
$ node object-graph.mjs
{ mountpath: '/users', path: '/' }
server is http.Server: true
app === users? false
```

Two results in that output are the whole topic in miniature. **`req.baseUrl` is
`/users` and `req.path` is `/`** — inside a mounted router the URL has been
rewritten, and the mechanism for that is in
[chunk 04](04-url-rewriting-and-options.md). And **`app === users` is false**: they
look interchangeable because both are callable, but only one of them owns
settings.

## Who owns what

The reason to keep the graph straight is that each object answers a different
class of question, and asking the wrong object is a silent failure rather than an
error.

| Concern | Owner | Why it is not the others |
|---|---|---|
| Port, `listen`, `close`, `SIGTERM` handling | **`http.Server`** | `app` has no socket; `app.close` does not exist |
| `keepAliveTimeout`, `headersTimeout`, `requestTimeout` | **`http.Server`** | These are socket-level and pre-date routing |
| The `'upgrade'` event (WebSockets) | **`http.Server`** | An upgrade never becomes a normal request, so it never reaches the router |
| TLS | **`https.Server`** | You build it yourself and pass `app` as the listener |
| `trust proxy`, `query parser`, `etag`, `env` | **`app` settings** | A `Router` has no settings object at all |
| Template engines and `res.render` | **`app`** | `app.set('views')`, `app.engine(…)` |
| `app.locals` | **`app`** | `res.locals` is per request; `app.locals` is per app |
| Feature routes under `/api/v1` | **`Router`** | Mountable and testable in isolation |
| Global body parser, request id, CORS | **`app.use`** | They must run before any router matches |
| Which methods a path supports | **`Route`** | The router asks the route, for `OPTIONS` |

🔴 **The highest-consequence row is the first.** `app.listen()` returns the
`http.Server` and most code throws that return value away. Every graceful
shutdown then has nothing to call, and the usual outcome is a `process.exit()`
that cuts in-flight requests. Capture it —
[Phase 10 · 06](../../phase-10-app-factory/06-shutdown-and-entrypoint.md) is the
full treatment.

## Why `app.listen` is the wrong default in real code

`app.listen(port)` is documented as sugar for
`http.createServer(app).listen(port)`, and it is fine in a tutorial. Build the
server explicitly when you need any of:

- **TLS** — `https.createServer({key, cert}, app)`. There is no `app.listenTls`.
- **WebSockets on the same port** — `ws` and Socket.IO attach to the
  `http.Server`'s `'upgrade'` event, which you need a reference to.
- **Two apps on one server** — a single listener can dispatch by `Host` before
  handing off to one app or another.
- **Tests** — Supertest creates and binds its own server per request, on an
  ephemeral port, precisely so parallel tests never collide.
- **Graceful shutdown** — you need `server.close()` and
  `server.closeIdleConnections()`.

The rule that falls out, and the reason [Phase 10 ·
01](../../phase-10-app-factory/01-create-app/README.md) is a Master topic: **the module
that builds the app must not listen.** Export `createApp()`; let one entrypoint
decide what server wraps it.

## Gotchas

**Symptom:** `app.close is not a function`
**Cause:** `app` is a request listener, not a server; `listen()` returned the
server and it was discarded
**Fix:** `const server = app.listen(...)` — or build `http.createServer(app)`
yourself and keep the reference

**Symptom:** WebSocket upgrades 404, or never reach your handler
**Cause:** An upgrade is emitted as `'upgrade'` on the `http.Server` and never
becomes an ordinary request, so Express never sees it
**Fix:** Attach to the server object, not to `app`

**Symptom:** `app.set('trust proxy', true)` on a `Router` does nothing
**Cause:** `Router` has no settings — the method does not exist on it
**Fix:** Settings belong to the app. If a mounted **sub-app** needs its own, set
them on the sub-app, which inherits the parent's by prototype chain
([chunk 05](05-sub-apps-and-the-server.md))

**Symptom:** Tests call `app.listen` and ports collide when run in parallel
**Cause:** Listening inside the app module, so importing it binds a port
**Fix:** Export `app` or `createApp()`; listen only in the entrypoint. Supertest
binds an ephemeral port per request and never needs a fixed one

## Interview questions

**★ What is the difference between `app` and `Router`?**
`app` is the root application: it owns settings, the view engine, `app.locals`,
and the top-level stack, and it is what you hand to a server. `Router` is a
mountable sub-stack with the same `use`/`get`/`post` surface and **no settings**.
Both are callable functions — which is why they compose.

**★ Who actually binds the TCP port?**
`http.Server`. Express does not replace Node's server; it supplies the request
listener that server calls. `app.listen` builds one for you and returns it.

**★ Where does graceful shutdown hang off, and why does it matter?**
The **server** — `server.close()`, and `server.closeIdleConnections()` for the
keep-alive sockets that otherwise stall the close callback. It matters because
`app` has no shutdown surface at all, so code that discards `app.listen`'s return
value has no option except killing in-flight requests.

**★ You need TLS and WebSockets on the same port as your API. What changes?**
Nothing about the app; everything about how it is hosted. Build
`https.createServer({key, cert}, app)`, keep the reference, and attach the
WebSocket library to that server's `'upgrade'` event. This is exactly why the app
factory must not call `listen`.

**Why mount routers instead of putting every route on `app`?**
Modularity, a testable feature stack, and one place that owns a URL prefix. The
cost is mount-path bookkeeping — `req.url` is rewritten inside a mounted router,
so `req.baseUrl` and `req.originalUrl` become the values you actually want in
logs.

**Is `Route` an object you use directly?**
Rarely by name, but `app.route('/orders').get(h1).post(h2)` returns one, and it
is the object that removes the repeated path string. Internally every
`app.get(path, …)` creates one.

---

Index: [Object graph](README.md) · Next → [A Router is a function too](02-a-router-is-a-function-too.md)
