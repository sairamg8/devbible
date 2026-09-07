---
title: "Vite ships SSR primitives, not an SSR framework — middleware mode hands your server the transform pipeline and leaves every other decision to you"
sidebar_label: "SSR Primitives"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Server-Side Rendering](https://vite.dev/guide/ssr), [`server.middlewareMode`](https://vite.dev/config/server-options#server-middlewaremode), [`appType`](https://vite.dev/config/shared-options#apptype), and the Express 5 [migration guide](https://expressjs.com/en/guide/migrating-5.html). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Vite Ships SSR Primitives, Not an SSR Framework

**Vite's SSR support is four small APIs and a build flag. It does not route, it does not
stream, it does not decide where hydration happens, and it does not own your HTTP server —
you do. The documentation is unusually blunt about who this is for, and reading that
sentence correctly is the first engineering decision in the topic, because everything else
in this topic is the cost of having said "yes, I will own the server."**

> *"This is a low-level API meant for library and framework authors. If your goal is to create an application, make sure to check out the higher-level SSR plugins and tools at [Awesome Vite SSR section](https://github.com/vitejs/awesome-vite#ssr) first. That said, many applications are successfully built directly on top of Vite's native low-level API."* — [SSR guide](https://vite.dev/guide/ssr)

Note also what "SSR" means in this guide, because it is narrower than the industry usage:

> *"SSR specifically refers to front-end frameworks (for example React, Preact, Vue, and Svelte) that support running the same application in Node.js, pre-rendering it to HTML, and finally hydrating it on the client. If you are looking for integration with traditional server-side frameworks, check out the [Backend Integration guide](https://vite.dev/guide/backend-integration) instead."*

A Rails or Laravel app that wants Vite to build its assets is **backend integration** — a
different mechanism with a different manifest. This topic is about one application running
in two runtimes.

---

## 1. Under-The-Hood Mechanics

### The source layout every SSR primitive assumes

Each API here is shaped around a three-entry source tree. The guide states it exactly:

```text
- index.html
- server.js # main application server
- src/
  - main.js          # exports env-agnostic (universal) app code
  - entry-client.js  # mounts the app to a DOM element
  - entry-server.js  # renders the app using the framework's SSR API
```

`index.html` is not a build artefact you hand-edit; it is the **template both runtimes
share**. It references the client entry and marks the injection point:

```html
<div id="app"><!--ssr-outlet--></div>
<script type="module" src="/src/entry-client.js"></script>
```

> *"You can use any placeholder you prefer instead of `<!--ssr-outlet-->`, as long as it can be precisely replaced."*

The word *precisely* is load-bearing and gets its own chunk — see
**chunk 1j** *(not written yet)*.

### `server.middlewareMode` — Vite as a library, not a process

`middlewareMode` is typed `boolean | { server: http.Server }`, default `false`. Setting it
means Vite does not open a port. Instead `vite.middlewares` is a **Connect instance**,
mountable in any Connect-compatible Node framework:

> *"`vite.middlewares` is a [Connect](https://github.com/senchalabs/connect) instance which can be used as a middleware in any connect-compatible Node.js framework."*

The reference is stable across restarts, which is the property that lets you mount once at
boot and never think about it again:

> *"When the server restarts (for example after the user modifies `vite.config.js`), `vite.middlewares` is still going to be the same reference (with a new internal stack of Vite and plugin-injected middlewares). The following is valid even after restarts."*

That middleware stack is not decoration. It answers `/@vite/client`, `/@fs/…`,
`/node_modules/.vite/…` and **every source-module request the browser makes**. Ordering it
against your own routes is therefore a correctness question, not a preference.

### `appType: 'custom'` — the switch that gets forgotten

`appType` is `'spa' | 'mpa' | 'custom'`, default `'spa'`. The doc enumerates precisely what
each value installs:

> *"`'spa'`: include HTML middlewares and use SPA fallback. Configure [sirv](https://github.com/lukeed/sirv) with `single: true` in preview"*
> *"`'mpa'`: include HTML middlewares"*
> *"`'custom'`: don't include HTML middlewares"*

Leave it at `'spa'` and Vite's own HTML middleware answers the request before your handler
sees it. Your renderer never runs and nothing errors — you get a valid `200` carrying the
un-rendered shell. `appType` and `middlewareMode` are documented as related options for
exactly this reason; in an SSR app they are a pair.

---

## 2. Real-World Engineering Scenario

**A team migrating an Express-rendered app to React SSR, one route at a time.**

The existing Express app owns auth, a dozen JSON APIs, a legacy `/admin` mounted from
another package, and a session store. Adopting a full SSR framework would have meant
re-homing all of that behind the framework's server. Middleware mode inverts the
relationship: Express stays the HTTP server, Vite becomes a middleware stack mounted inside
it, and exactly one catch-all route at the bottom renders React. Auth middleware still runs
first, so the renderer receives an already-authenticated `req`. `/admin` is untouched. The
team ships route by route by moving one path above the catch-all at a time.

The cost is that everything the framework would have decided — the two builds, the dev/prod
branch, the manifest and preload tags, externalisation policy, resolve conditions, the
hydration contract — now lives in the team's `server.js`. That is the rest of this topic.

---

## 3. Production-Grade Code Example

```js
// server.js — the wiring half. The request handler is chunk 1a.
import express from 'express'
import { createServer as createViteServer } from 'vite'

async function createServer() {
  const app = express()

  // Vite does not listen on a port; it hands back a Connect middleware stack.
  // appType 'custom' removes Vite's HTML middlewares so our handler owns HTML.
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom',
  })

  // Your own middleware runs BEFORE Vite's, so the renderer sees an
  // authenticated request.
  app.use(sessionMiddleware)
  app.use(authMiddleware)

  // JSON APIs and anything already server-rendered stay above the catch-all.
  app.use('/api', apiRouter)
  app.use('/admin', legacyAdminRouter)

  // Mount ONCE. The reference survives config-triggered restarts.
  // Under an express.Router() this must be router.use(vite.middlewares).
  app.use(vite.middlewares)

  // LAST. Express 5 requires a NAMED wildcard: '*all', not '*'.
  app.use('*all', ssrHandler(vite))

  app.listen(5173)
}

createServer()
```

And the script that starts it — `vite` no longer runs the dev server, your file does:

```json
{
  "scripts": {
    "dev": "node server"
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

**The catch-all must be last, and it must be `use`, not `get`.** Registered above
`vite.middlewares`, it intercepts `/@vite/client` and every source-module URL and answers
them with HTML. The browser then reports a MIME-type error on a script tag, which points at
the wrong layer entirely.

**`middlewareMode` accepts an object for a reason.** Typed `boolean | { server: http.Server }`:

> *"If [proxy](https://vite.dev/config/server-options#server-proxy) is setup for WebSocket, the `server` should be provided to bind the proxy correctly."*

---

## Gotchas

**★ Symptom: the browser gets the raw `index.html` shell and your renderer never executes.**
Cause: `appType` is still the default `'spa'`, so Vite's HTML middleware answers the request
before your catch-all. Nothing errors, so it reads as a hydration bug. Fix: set it
explicitly, on the same call as `middlewareMode`.
```js
const vite = await createViteServer({
  server: { middlewareMode: true },
  appType: 'custom', // 'custom': don't include HTML middlewares
})
```

**★ Symptom: the server throws on boot with a path-matching error after an Express upgrade.**
Cause: Express 5 changed path matching — *"The wildcard `*` must have a name, matching the behavior of parameters `:`, use `/*splat` instead of `/*`"*. Fix: name the wildcard. The Vite
guide's own sample now writes `'*all'`; if you need to match the root path too, brace it.
```js
app.use('*all', handler)      // as written in the Vite SSR guide
app.get('/{*splat}', handler) // Express 5: braces make the root path match too
```

**★ Symptom: script tags fail with a MIME-type error and HMR never connects.**
Cause: the catch-all is registered above `vite.middlewares`, so module requests are answered
with the HTML template. Fix: mount Vite's middlewares first and the catch-all last — the
order in the code example is the contract, not a style choice.

**★ Symptom: HMR and module requests 404 once the app is mounted under a sub-router.**
Cause: `app.use(vite.middlewares)` mounts on the app, but your routes live on an
`express.Router()` mounted at a prefix, so Vite's middlewares never see the rewritten path.
Fix: the guide states the rule directly — *"If you use your own express router (`express.Router()`), you should use `router.use`"*.
```js
const router = express.Router()
router.use(vite.middlewares)
router.use('*all', ssrHandler(vite))
app.use('/app', router)
```

**★ Symptom: you re-mount `vite.middlewares` inside a restart handler and requests start being processed twice.**
Cause: an assumption that a config edit invalidates the middleware reference. It does not —
the same Connect instance is reused with a fresh internal stack. Fix: mount once at boot and
never again; there is nothing to re-wire.

**★ Symptom: HMR works locally and silently dies behind nginx or a corporate proxy.**
Cause: `middlewareMode: true` gives Vite no handle on the HTTP server, so it cannot bind the
WebSocket upgrade to the proxied server. Fix: pass the server through the object form.
```js
const httpServer = http.createServer(app)
const vite = await createViteServer({
  server: { middlewareMode: { server: httpServer }, proxy: { /* … */ } },
  appType: 'custom',
})
httpServer.listen(5173)
```

---

## Interview questions

**★ What exactly does `appType: 'custom'` turn off, and why does an SSR app need it?**
It removes Vite's HTML middlewares — the ones that serve `index.html` for HTML requests and
perform the SPA fallback. An SSR app must produce that HTML itself, from a render call, so
those middlewares are not merely redundant, they win the race. The failure mode is silent:
a valid 200 carrying the un-rendered template, which looks like a client-side bug.

**★ `vite.middlewares` is documented as a Connect instance whose reference survives a restart. What does that buy you?**
The mount point is a stable object and the *contents* are swapped underneath it. When a
config change triggers a restart, Vite rebuilds its internal middleware stack and the
plugin-injected middlewares, but the outer handle your framework holds does not change. So
`app.use(vite.middlewares)` is a boot-time statement, not something to re-run — and code
that re-registers on restart creates duplicates instead of fixing anything.

**★ Why does the ordering of `vite.middlewares` against your own routes matter more in middleware mode than it looks?**
Because Vite's middlewares are not an add-on: they *are* the dev server. They serve
`/@vite/client`, the transformed source modules, the optimised dependency chunks and the
`/@fs/` escape hatch. Your catch-all is by definition a route that matches those URLs too.
Whichever is registered first wins, and the losing case produces a confusing symptom — a
script tag that 200s with `text/html`. Application middleware that must see every request
(sessions, auth, logging) goes above; the render catch-all goes below.

**★ The docs open with "a low-level API meant for library and framework authors." What decision should that sentence drive?**
It is a build-versus-buy prompt, not a warning label. Choosing these primitives means
accepting ownership of six things a framework would have decided: two builds, the dev/prod
branch, the SSR manifest and preload injection, externalisation policy, resolve conditions,
and the hydration contract. Take it when the constraint is on the *server* — an existing
Express app, an unusual routing or auth model, an incremental migration. Do not take it
because a framework's defaults were merely unfamiliar. The doc softens it deliberately:
*"many applications are successfully built directly on top of Vite's native low-level API."*

**★ Why is the dev script `node server` instead of `vite`?**
Because in middleware mode Vite never opens a port; your process does. `vite` would start
Vite's own dev server, which knows nothing about your Express routes or your renderer. The
guide shows the change as a diff for exactly that reason.

---

← [CSS: Styling Pipeline](../09-css-handling/01-styling-pipeline.md) · [Vite overview](../../README.md) · Next → [The Dev Request Pipeline](01a-the-dev-request-pipeline.md)
