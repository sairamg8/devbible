---
title: "When the server does not run in Node, the runner cannot pass values in-process — so the environment communicates over `Request`/`Response` or over a hot channel instead"
sidebar_label: "Fetchable & Custom Environments"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Environment API for Frameworks](https://vite.dev/guide/api-environment-frameworks), [Using `Environment` Instances](https://vite.dev/guide/api-environment-instances), [Environment API for Runtimes](https://vite.dev/guide/api-environment-runtimes), [Environment API for Plugins § Application-Plugin Communication](https://vite.dev/guide/api-environment-plugins). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ `FetchableDevEnvironment` is documented as an open proposal. Its status is quoted rather than smoothed over.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Fetchable and Custom Environments

**[Chunk 1c](01c-the-module-runner.md) relies on one property: the runner shares the Vite
server's runtime, so a rendered `render` function can simply be called. Take that property
away — an edge worker, a separate thread, `workerd` — and the SSR seam has to become a
protocol. Vite documents three communication levels, and choosing the wrong one is how a
framework ends up unable to support the runtime its users actually deploy to.**

---

## 1. Under-The-Hood Mechanics

### The three levels

| Level | Crosses the boundary as | Requires |
|---|---|---|
| `RunnableDevEnvironment` | arbitrary JS values | runner runtime == Vite server runtime |
| `FetchableDevEnvironment` | serialized `Request` / `Response` | a Fetch API in the target runtime |
| raw `DevEnvironment` | whatever you build | you wire it yourself |

### `FetchableDevEnvironment` — and why the docs prefer it

> *"`FetchableDevEnvironment` is an environment that can communicate with its runtime via the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch) interface. Since the `RunnableDevEnvironment` is only possible to implement in a limited set of runtimes, we recommend to use the `FetchableDevEnvironment` instead of the `RunnableDevEnvironment`."*

The reasoning is about portability, not elegance:

> *"A common reason to reach for it is a framework that wants to support a runtime that can't run Vite directly (e.g. Cloudflare Workers). … Standardizing on the Fetch API lets the framework keep a single request-handling path across all of its target runtimes: its dev middleware forwards each incoming browser request as a `Request` and sends the returned `Response` back to the browser, mirroring how the app handles requests in production."*

Two guardrails are documented, and both matter:

> *"Vite validates the input and output of the `dispatchFetch` method: the request must be an instance of the global `Request` class and the response must be the instance of the global `Response` class. Vite will throw a `TypeError` if this is not the case."*
> *"Note that although the `FetchableDevEnvironment` is implemented as a class, it is considered an implementation detail by the Vite team and might change at any moment."*

⚠️ Status: *"We are looking for feedback on [the `FetchableDevEnvironment` proposal](https://github.com/vitejs/vite/discussions/18191)."*

### Raw `DevEnvironment` — two documented escape hatches

When neither interface fits, the docs describe the wiring you must do yourself. If your code
can run in the same runtime as user modules, use a **virtual module**:

> *"If your code can run in the same runtime as the user modules (i.e., it does not rely on Node.js-specific APIs), you can use a virtual module. This approach eliminates the need to access the value from the code using Vite's APIs."*

If it cannot, use the environment's **hot channel** — with a caveat stated up front:

> *"If your code requires Node.js APIs, you can use `hot.send` to communicate with the code that uses Vite's APIs from the user modules. However, be aware that this approach may not work the same way after the build process."*

### A `ModuleRunner` in someone else's runtime

`vite/module-runner` is a deliberately small entry point:

> *"A module runner is instantiated in the target runtime. All APIs in the next section are imported from `vite/module-runner` unless stated otherwise. This export entry point is kept as lightweight as possible, only exporting the minimal needed to create module runners."*

> *"The module evaluator in `ModuleRunner` is responsible for executing the code. Vite exports `ESModulesEvaluator` out of the box, it uses `new AsyncFunction` to evaluate the code. You can provide your own implementation if your JavaScript runtime doesn't support unsafe evaluation."*

`ModuleRunnerOptions` carries `transport` (required), `sourcemapInterceptor`, `hmr` (default
`true`), and `evaluatedModules` — *"Custom module cache. If not provided, it creates a separate module cache for each module runner instance."*

### What crosses the wire: `FetchResult`

`environment.fetchModule` — *"This method is not meant to be called manually"* — returns one
of three shapes, and the middle one is where externalisation becomes visible at runtime:

> *"`ExternalFetchResult` instructs the module runner to import the module using the `runExternalModule` method on the [`ModuleEvaluator`](https://vite.dev/guide/api-environment-runtimes#moduleevaluator). In this case, the default module evaluator will use the runtime's native `import` instead of processing the file through Vite."*

That is [chunk 1d](01d-ssr-externals.md)'s policy, executed. `CachedFetchResult` is
*"analogous to the `304` (Not Modified) HTTP status code"*, and `ViteFetchResult` carries the
code plus an `invalidate` flag that is *"usually `true` when an HMR update was triggered."*

### Talking to the application from a plugin

> *"`environment.hot` allows plugins to communicate with the code on the application side for a given environment. This is the equivalent of [the Client-server Communication feature](https://vite.dev/guide/api-plugin#client-server-communication), but supports environments other than the client environment."*
> *"Note that this feature is only available for environments that support HMR."*
> *"Be aware that there might be multiple application instances running in the same environment. For example, if you have multiple tabs open in the browser, each tab is a separate application instance and has a separate connection to the server."*

`vite:client:connect` and `vite:client:disconnect` fire on the environment's `hot` instance,
and each handler receives a `NormalizedHotChannelClient` as its second argument.

---

## 2. Real-World Engineering Scenario

**A framework that shipped Node SSR and then had to support Cloudflare Workers.**

The dev story was `runner.import('/src/entry-server.js')` returning a `render` function.
Workers cannot host that: the runner would have to evaluate user modules inside `workerd`,
and a function cannot cross from `workerd` back into the Vite server's Node process.

Rewriting the seam as Fetch removes the branch entirely. The framework's dev middleware
builds a `Request` from the incoming Node request, calls `dispatchFetch`, and streams the
`Response` back — the same code path it already had in production, where the Worker receives
a real `Request`. The Node target then becomes the special case, not the norm.

---

## 3. Production-Grade Code Example

```js
// vite.config.js + server wiring — a Fetch-based custom environment
import {
  createServer,
  createFetchableDevEnvironment,
  isFetchableDevEnvironment,
} from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  environments: {
    custom: {
      dev: {
        createEnvironment(name, config) {
          return createFetchableDevEnvironment(name, config, {
            async handleRequest(request) {
              // Must return a global Response, or Vite throws TypeError.
              return new Response('<!doctype html>…', {
                headers: { 'Content-Type': 'text/html' },
              })
            },
          })
        },
      },
    },
  },
})

// Guard with the exported predicate — NOT with `instanceof`.
if (isFetchableDevEnvironment(server.environments.custom)) {
  const response = await server.environments.custom.dispatchFetch(
    new Request('http://example.com/request-to-handle'),
  )
}
```

```js
// A ModuleRunner living in another runtime, over your own transport
import {
  ModuleRunner,
  ESModulesEvaluator,
  createNodeImportMeta,
} from 'vite/module-runner'
import { transport } from './rpc-implementation.js'

const moduleRunner = new ModuleRunner(
  {
    transport,
    createImportMeta: createNodeImportMeta, // if the runner runs in Node.js
  },
  new ESModulesEvaluator(),
)

await moduleRunner.import('/src/entry-point.js')
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

**`dispatchFetch` is validated on both ends.** A `Request` from a polyfill or from a
different realm is not *"an instance of the global `Request` class"*, and the `TypeError` names
the argument, not the polyfill — which makes it read like a Vite bug.

**`hmr` on `ModuleRunnerOptions` defaults to `true`.** A runner created for a one-shot
pre-render task keeps an HMR connection unless you turn it off, and `close()` is documented
as clearing caches and listeners without stopping the HMR connection.

**Sharing `evaluatedModules` is a deliberate act.** Each runner otherwise gets *"a separate module cache"*. Two runners over the same graph is a choice about isolation, not a default.

---

## Gotchas

**★ Symptom: `TypeError` from `dispatchFetch` on a request your code clearly constructed correctly.**
Cause: it is not an instance of the *global* `Request` — a `node-fetch`/`undici` import, or an
object from another realm. Fix: construct with the global constructor and let the runtime
provide it.
```js
const res = await env.dispatchFetch(new Request(`http://localhost${req.url}`))
```

**★ Symptom: an `instanceof FetchableDevEnvironment` check starts returning `false` after a Vite upgrade.**
Cause: the class is *"considered an implementation detail by the Vite team and might change at any moment"*. Fix: use the exported predicate, which is the supported surface.
```js
import { isFetchableDevEnvironment } from 'vite'
if (isFetchableDevEnvironment(env)) { /* … */ }
```

**★ Symptom: a plugin's `environment.hot.send` reply is delivered to the wrong browser tab.**
Cause: `send` broadcasts to every application instance in the environment, and each open tab
is a separate instance with its own connection. Fix: reply on the client handle passed as the
second argument to the handler.
```js
server.environments.ssr.hot.on('my:greetings', (data, client) => {
  client.send('my:foo:reply', `Hello from server! You said: ${data}`)
})
```

**★ Symptom: `environment.hot` exists but no message ever arrives.**
Cause: the environment does not support HMR — the docs restrict the feature explicitly:
*"this feature is only available for environments that support HMR."* Fix: gate on capability,
and use the virtual-module route for environments without a channel.

**★ Symptom: a raw-`DevEnvironment` integration works in dev and behaves differently in the built app.**
Cause: it was built on `hot.send`, and the docs warn *"this approach may not work the same way after the build process"* — the hot channel is a dev-time construct. Fix: prefer the
virtual-module route for anything that must survive the build, and keep the hot channel for
genuinely dev-only concerns.

**★ Symptom: a plugin calls `environment.fetchModule` and gets results that do not match what the runner sees.**
Cause: `fetchModule` is the runner's own transport call — *"This method is not meant to be called manually."* Fix: use `environment.transformRequest(url)` when you want the transform
result, and leave `fetchModule` to the runner.
```js
const result = await server.environments.ssr.transformRequest('/src/app.js')
```

**★ Symptom: a pre-render script never exits.**
Cause: the module runner keeps an HMR connection open; `hmr` defaults to `true`, and `close()`
*"doesn't stop the HMR connection."* Fix: disable HMR when the runner is for a one-shot task.
```js
const runner = new ModuleRunner({ transport, hmr: false }, new ESModulesEvaluator())
```

---

## Interview questions

**★ The docs recommend `FetchableDevEnvironment` over `RunnableDevEnvironment`. Isn't the runnable one strictly more capable?**
It is more capable and less portable, and portability is what the recommendation optimises
for. Runnable passes arbitrary values because it evaluates modules in the Vite server's own
runtime — that requirement is the whole cost. Any runtime that cannot host Vite (Workers,
`workerd`, a sandboxed VM) is excluded. Fetch is the one interface those runtimes share, so a
framework that standardises on `Request`/`Response` keeps a single request path across all its
targets and gets a dev seam that matches production. For an application that will only ever
run in Node, the runnable environment is simpler and entirely appropriate.

**★ What is an `ExternalFetchResult`, and why should an application developer care?**
It is the runner's instruction to skip Vite: *"the default module evaluator will use the runtime's native `import` instead of processing the file through Vite."* It is the runtime face
of the externalisation policy in [chunk 1d](01d-ssr-externals.md). Caring about it pays off
when a dependency behaves differently under SSR than you expect — the question "was this
module externalised or processed?" has an observable answer at this boundary, and it decides
whether your plugins, aliases and conditions applied to it at all.

**★ Why is the hot channel attached to an environment rather than to the server?**
Because there is one client per environment-runtime pair, not one per server. The client
environment's channel talks to browsers; an SSR environment's channel talks to whatever is
executing server modules. Vite 5's single `server.hot` could only ever mean "the browser",
which is why the documented migration is `server.hot` → `server.client.environment.hot`. Once
channels are per-environment, a plugin can message the server runtime the same way it
messages the browser.

**★ A plugin sends a message and gets several replies. What went wrong?**
Nothing — that is the documented model. *"There might be multiple application instances running in the same environment"*, one per open tab, each with its own connection. `send` on
the environment broadcasts. To address one instance you must keep the
`NormalizedHotChannelClient` handed to your handler as the second argument, which the docs say
*"is always the same for the same connection"*, and track connections through the
`vite:client:connect` / `vite:client:disconnect` events.

**★ Why does `vite/module-runner` exist as a separate entry point instead of being part of `vite`?**
Because it is imported *into the target runtime*, which may be an edge worker with a size
budget and no Node built-ins. Pulling in `vite` would drag the dev server, the config loader
and the bundler along with it. The docs describe the entry as *"kept as lightweight as possible, only exporting the minimal needed to create module runners"*. The same reasoning
explains the pluggable `ModuleEvaluator`: `ESModulesEvaluator` uses `new AsyncFunction`, which
some runtimes forbid, so the evaluator is swappable rather than assumed.

---

← [The Module Runner](01c-the-module-runner.md) · [Vite overview](../../README.md) · Next → [SSR Externals](01d-ssr-externals.md)
