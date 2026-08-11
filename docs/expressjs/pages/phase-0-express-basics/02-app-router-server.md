---
title: "app, Router, and http.Server"
sidebar_label: "02 · Object graph"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Three different objects. Confusing them is how “my middleware never runs”
starts.**

## The graph

```text
http.Server          ← owns the socket, accept, listen, close
    │
    └── app          ← Express application: settings + top-level stack
            │
            ├── middleware (json, cors, …)
            └── Router     ← modular stack mounted at a path prefix
                    └── route handlers
```

| Object | Creates with | Job |
|---|---|---|
| **`http.Server`** | `http.createServer(app)` or `app.listen` | TCP listen, connections |
| **`app`** | `express()` | Settings, top-level middleware, mounts |
| **`Router`** | `express.Router()` | A portable stack of routes/middleware |

`app` is itself a request listener function. A `Router` is a stack you **mount**
on `app` (or on another router). Only the server **listens**.

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

`app.listen(port)` is sugar for `http.createServer(app).listen(port)`. Prefer the
explicit server when you need TLS, shared server with WebSockets, or tests that
import `app` without listening.

## Who owns what

| Concern | Owner |
|---|---|
| Port, `SIGTERM`, `server.close` | **`http.Server`** (Node Phase 5) |
| `trust proxy`, `query parser` | **`app` settings** |
| Feature routes under `/api/v1` | **`Router`** mounted on `app` |
| Global body parser | **`app.use`** before routers |

## Trade-off

Mounting many routers keeps files small. Too many nested mounts make mount-path
debugging harder (`req.baseUrl` vs `req.path`). Prefer shallow, feature-sized
routers over deep trees.

## Gotchas

**Symptom:** Middleware registered on a router never runs for `/api/x`  
**Cause:** Router mounted at `/api` but middleware was attached to a different
router, or after the route that already responded  
**Fix:** Draw the graph. Mount order is load-bearing (Phase 2)

**Symptom:** Tests call `app.listen` and ports collide  
**Cause:** Listening inside the app module  
**Fix:** Export `app` (or `createApp()`); listen only in `server.js` (Phase 10)

**Symptom:** “Is `app` a server?”  
**Cause:** `app.listen` hides the server object  
**Fix:** Capture it: `const server = app.listen(...)` or build `http.Server`
yourself

## Interview questions

**★ What is the difference between `app` and `Router`?**  
`app` is the root application (settings + top stack). `Router` is a mountable
sub-stack. Both handle `use`/`get`/…; only `app` owns application settings and
typically the listen entry.

**★ Who actually binds the TCP port?**  
`http.Server`. Express does not replace Node’s server; it provides the listener.

**Can you pass `app` to `http.createServer`?**  
Yes — `app` is a function `(req, res) => …` (with an internal handle). That is
the integration point.

**Why mount routers instead of putting every route on `app`?**  
Modularity, testing a feature stack alone, and clear URL prefixes. The cost is
mount-path bookkeeping.

**Where does graceful shutdown hang off?**  
The **server** (`server.close`), not `app`. Express does not own process signals.

---

← Prev: [What Express is](01-what-express-is.md) · Next → [The request lifecycle](03-request-lifecycle.md)
