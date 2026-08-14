---
title: "Creating an app"
sidebar_label: "04 · Creating an app"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**`express()` builds the app. `listen` (or `http.createServer`) puts it on the
network. Keep those two jobs separable.**

> Verified: 2026-08-14 on **Express 5.2.1** / **Node 24.19.0** — console block re-run
> through `sandbox/express-verify`. **Sandbox-measured.**

## The minimal app

```js
// create-app.mjs
import express from 'express';

const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({ok: true});
});

const server = app.listen(0, async () => {
  const {port} = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/health`);
  console.log(res.status, await res.json());
  server.close();
});
```

```console
$ node create-app.mjs
200 { ok: true }
```

`app.listen(port, cb)` returns the `http.Server`. Capture it when you care about
`close`, address, or sharing the server.

## Listen yourself

```js
// create-server.mjs
import express from 'express';
import http from 'node:http';

const app = express();
app.get('/health', (req, res) => res.json({ok: true}));

const server = http.createServer(app);
server.listen(0, () => {
  console.log('port', server.address().port);
  server.close();
});
```

Same listener, more control — HTTPS, HTTP/2 edge cases, attaching other
protocols. Prefer this shape in production entrypoints once TLS or multi-protocol
shows up.

## Settings are not listen

`express()` gives you a configured application object. Calling `listen` is a
**side effect**. For tests and composition:

```js
// app factory sketch — full treatment in Phase 10
export function createApp() {
  const app = express();
  app.get('/health', (req, res) => res.json({ok: true}));
  return app; // no listen here
}
```

Import `createApp()` in tests; only `server.js` listens after deps are ready.

## Trade-off

`app.listen` is shorter for demos. Explicit `http.createServer` + factory is more
lines and far easier to test and shut down cleanly. Pay the lines in real apps.

## Gotchas

**Symptom:** `EADDRINUSE` in tests  
**Cause:** Module-level `app.listen(3000)` runs on import  
**Fix:** Never listen at import time; use port `0` in tests or inject the server

**Symptom:** Cannot HTTPS  
**Cause:** Assumed `app.listen` was enough  
**Fix:** `https.createServer(options, app).listen(...)`

**Symptom:** Process ignores `SIGTERM`  
**Cause:** No handle on `server` to call `close`  
**Fix:** Keep the server reference; Node Phase 5 graceful shutdown applies

## Interview questions

**★ What does `express()` return?**  
An application — a request-handler function with `use`, `get`, settings, and
`listen` sugar.

**★ What does `app.listen` do under the hood?**  
Creates an `http.Server` with `app` as the listener and calls `listen` on it.

**Why separate `createApp` from listen?**  
Tests import the app without binding a port; production controls boot order
(env → deps → listen).

**Can one process have multiple Express apps?**  
Yes — multiple listeners or mount one app on another path — but one API process
usually has one root `app`.

---

← Prev: [The request lifecycle](03-request-lifecycle.md) · Next → [Application settings](05-application-settings.md)
