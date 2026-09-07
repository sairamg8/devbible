---
title: "`ssrLoadModule` is on a documented deprecation path and its replacement is a per-environment module runner that gives the server graph real HMR"
sidebar_label: "The Module Runner"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Environment API for Frameworks](https://vite.dev/guide/api-environment-frameworks), [SSR Using `ModuleRunner` API](https://vite.dev/changes/ssr-using-modulerunner), [Environment API for Runtimes § `ModuleRunner`](https://vite.dev/guide/api-environment-runtimes). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ `createServerModuleRunner` is **not** named anywhere in the pages fetched for this chunk; the documented way to reach a runner is `environment.runner`. Said as uncertain below rather than asserted.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The Module Runner Supersedes `ssrLoadModule`

**`server.ssrLoadModule` still works in Vite 8.2.2 and is still what the SSR guide's main
example uses. It is also, in writing, on the way out — replaced by importing through a
`ModuleRunner` that belongs to an environment rather than to the server. The upgrade is
small and buys something concrete: HMR on the server module graph, and stack traces you no
longer have to repair by hand.**

> *"`server.ssrLoadModule` has been replaced by importing from a [Module Runner](https://vite.dev/guide/api-environment-runtimes#modulerunner)."*
> *"`ModuleRunner` was first introduced in `v6.0`. The deprecation of `server.ssrLoadModule` is planned for a future major. To identify your usage, set `future.removeSsrLoadModule` to `"warn"` in your vite config."*

---

## 1. Under-The-Hood Mechanics

### Why the old API had to be replaced, in the docs' own words

> *"The `server.ssrLoadModule(url)` only allows importing modules in the `ssr` environment and can only execute the modules in the same process as the Vite dev server. For apps with custom environments, each is associated with a `ModuleRunner` that may be running in a separate thread or process. To import modules, we now have `moduleRunner.import(url)`."*

Two hard limits, both structural: **one environment**, and **one process**.

### `RunnableDevEnvironment` — the shape an SSR app actually gets

> *"`RunnableDevEnvironment` is an environment that can communicate arbitrary JavaScript values with your application code. Importing a module returns its real, live exports (functions, class instances, and any other values), so frameworks can run their server entries directly. The implicit `ssr` environment and other non-client environments use a `RunnableDevEnvironment` by default during dev."*

That is the default you already have. The runner on it:

> *"Its `runner` is a `ModuleRunner`. You import modules through it with `runner.import(url)`, which fetches, transforms, and evaluates a module from the Vite module graph (the `url` accepts a file path, server path, or id relative to the root) and returns the instantiated module with full HMR support. It is the modern replacement for `server.ssrLoadModule`, so frameworks can migrate to it to enable HMR for their SSR dev story."*

And why it can pass a class instance across at all:

> *"A `RunnableDevEnvironment` evaluates modules in the same runtime as the Vite server, so values cross the boundary in-process instead of being serialized. … As a result, using a `RunnableDevEnvironment` requires the runner's runtime to be the same as the one the Vite server is running in."*

### Guard the access, do not cast it away

`isRunnableDevEnvironment(env)` is the documented type guard. Reaching for `runner` on an
environment that has none is the failure this exists to prevent — and an app that later adds
a Cloudflare or worker environment will hit it.

### Two behaviours that surprise people

> *"The `runner` is evaluated lazily only when it's accessed for the first time. Beware that Vite enables source map support when the `runner` is created by calling `process.setSourceMapsEnabled` or by overriding `Error.prepareStackTrace` if it's not available."*

So the first property access has a side effect on the whole process's error formatting. And:

> *"Module runner exposes `import` method. When Vite server triggers `full-reload` HMR event, all affected modules will be re-executed. Be aware that Module Runner doesn't update `exports` object when this happens (it overrides it), you would need to run `import` or get the module from `evaluatedModules` again if you rely on having the latest `exports` object."*

That is the bug behind "my SSR handler renders with yesterday's component": a `render`
function captured once at boot is a **stale reference** after a full reload.

### Stack traces stop being your problem

> *"`server.ssrFixStacktrace` and `server.ssrRewriteStacktrace` do not have to be called when using the Module Runner APIs. The stack traces will be updated unless `sourcemapInterceptor` is set to `false`."*

### The server entry should accept its own updates

> *"When using environments that support HMR (such as `RunnableDevEnvironment`), you should add `import.meta.hot.accept()` in your server entry file for optimal behavior. Without this, server file changes will invalidate the entire server module graph"*

---

## 2. Real-World Engineering Scenario

**An SSR dev loop that got slower as the app grew.**

A team's `entry-server.tsx` imports the route table, which imports every page component. On
`ssrLoadModule` this is fine at first; as the route table grew past a hundred routes, every
save invalidated a large subgraph and the first request after a save took visibly longer,
because the server graph had nothing to stop invalidation propagating.

Moving to `runner.import` plus one line — `import.meta.hot.accept()` in `entry-server.tsx` —
puts a boundary at the entry: an update stops there instead of invalidating the whole server
graph. The team also deleted the `ssrFixStacktrace` call, since the runner installs source-map
support itself, and had to fix one real bug the move exposed: the handler had cached `render`
at boot, which is invalid once modules are re-executed.

---

## 3. Production-Grade Code Example

```js
// server.js — the same six steps, on the Environment API
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { createServer, isRunnableDevEnvironment } from 'vite'

const app = express()

const viteServer = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  environments: {
    // The name is yours; 'server' is the docs' own example.
    // By default, modules run in the same process as the Vite server.
    server: {},
  },
})

app.use(viteServer.middlewares)

const serverEnvironment = viteServer.environments.server
if (!isRunnableDevEnvironment(serverEnvironment)) {
  throw new Error('the "server" environment has no module runner')
}

app.use('*all', async (req, res, next) => {
  const url = req.originalUrl
  try {
    let template = fs.readFileSync(
      path.resolve(import.meta.dirname, 'index.html'),
      'utf-8',
    )
    template = await viteServer.transformIndexHtml(url, template)

    // Import PER REQUEST. Caching `render` outside the handler goes stale
    // after a full-reload, because the runner replaces the exports object.
    const { render } = await serverEnvironment.runner.import(
      '/src/entry-server.js',
    )

    const appHtml = await render(url)
    const html = template.replace('<!--ssr-outlet-->', () => appHtml)
    res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
  } catch (e) {
    // No ssrFixStacktrace: the runner installs source-map support itself.
    next(e)
  }
})

app.listen(5173)
```

```js
// src/entry-server.js — the HMR boundary the docs ask for
export function render(url) {
  return renderToString(createApp(url))
}

if (import.meta.hot) {
  import.meta.hot.accept()
}
```

```js
// vite.config.js — inventory your usage before the deprecation lands
export default {
  future: {
    removeSsrLoadModule: 'warn',
  },
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

**`environment.runner` is a getter with a side effect.** Touching it constructs the runner
and enables process-wide source-map support. Probing for it — `if (env.runner)` — is not a
free existence check; use `isRunnableDevEnvironment` instead.

**The URL grammar is wider than `ssrLoadModule`'s.** `runner.import` *"accepts a file path, server path, or id relative to the root"* — which includes virtual module ids, so a framework
can import `virtual:entrypoint` directly.

**⚠️ `createServerModuleRunner` is not documented on any page fetched for this chunk.** Older
material names it as the way to build a runner against a dev server. The current documented
route is `environment.runner`, and `new ModuleRunner(...)` from `vite/module-runner` for a
runner living in another runtime. Treat any other spelling as unverified.

---

## Gotchas

**★ Symptom: after a save, SSR keeps rendering the previous version of a component, but a full server restart fixes it.**
Cause: the module's exports were captured once. On a `full-reload` the runner *"doesn't update `exports` object … (it overrides it)"*, so your captured `render` still points at the old
object. Fix: import inside the request handler, every request.
```js
app.use('*all', async (req, res) => {
  const { render } = await serverEnvironment.runner.import('/src/entry-server.js')
})
```

**★ Symptom: one save invalidates the entire server module graph and the next request is slow.**
Cause: no HMR boundary in the server entry. The docs state the consequence explicitly —
*"Without this, server file changes will invalidate the entire server module graph"*. Fix: accept
in the entry.
```js
if (import.meta.hot) {
  import.meta.hot.accept()
}
```

**★ Symptom: `TypeError: Cannot read properties of undefined (reading 'import')` on `env.runner`.**
Cause: the environment is not a `RunnableDevEnvironment` — typically because a runtime plugin
(Cloudflare, a worker) replaced it. Fix: guard, do not cast.
```js
import { isRunnableDevEnvironment } from 'vite'
if (!isRunnableDevEnvironment(env)) throw new Error(`no runner in ${env.name}`)
await env.runner.import('/src/entry-server.js')
```

**★ Symptom: after migrating to the runner, stack traces regress to transformed output.**
Cause: `sourcemapInterceptor: false` was set on the runner options — the one documented
condition under which traces are *not* updated. Fix: leave it at its default, or restore
explicit remapping if you genuinely need the interceptor off.

**★ Symptom: `Error.prepareStackTrace` behaves oddly process-wide after an unrelated refactor.**
Cause: a diagnostic that touched `environment.runner` early moved runner creation earlier in
boot, and creation is what installs source-map support — via `process.setSourceMapsEnabled`
or by overriding `Error.prepareStackTrace`. Fix: create the runner deliberately at a known
point rather than as a side effect of a debug line.

**★ Symptom: you cannot find where to migrate, because `ssrLoadModule` is called from three packages.**
Cause: no inventory. Fix: turn the future flag on and let Vite point at every call site
before the deprecation is real.
```js
export default { future: { removeSsrLoadModule: 'warn' } }
```

---

## Interview questions

**★ `ssrLoadModule` works. Why does a replacement exist at all?**
Two limits that no amount of patching removes. It targets exactly one environment — the one
named `ssr` — so an app with an `edge` or `rsc` environment cannot use it for them. And it
executes in the Vite server's own process, so it cannot serve an environment whose runtime is
a worker or a separate thread. `runner.import` is the same operation re-homed onto the
environment, where both of those constraints disappear.

**★ What does a `RunnableDevEnvironment` do that a `FetchableDevEnvironment` cannot, and what does it cost?**
It passes *arbitrary JavaScript values* — functions, class instances — because it evaluates
modules in the Vite server's own runtime, so nothing is serialised. That is precisely why
`render` can be a function you call. The cost is the constraint that produces it: the runner's
runtime must be the same as the Vite server's. A Cloudflare Workers environment cannot satisfy
that, which is why the docs recommend the Fetch-based environment for portable frameworks
(see [chunk 1ca](01ca-fetchable-and-custom-environments.md)).

**★ Why does importing the server entry per request stop being wasteful once you are on the runner?**
Because the runner keeps evaluated modules in a cache; a repeat import of an unchanged module
is a cache hit, not a re-evaluation. What the per-request call buys you is *correctness after
an update* — on a full reload the runner replaces the exports object rather than mutating it,
so any reference you cached at boot is now pointing at a dead object. Per-request import is
how you always hold the live one.

**★ Why does adding `import.meta.hot.accept()` to a server entry help, when nothing on the server "hot swaps" a UI?**
Because HMR on the server graph is about *invalidation scope*, not about swapping DOM. An
accept call marks a boundary: an update that reaches it stops propagating upward. Without a
boundary, a change anywhere under the entry invalidates the whole server graph and the next
request pays to re-evaluate all of it. The docs name exactly this consequence.

**★ You are on `ssrLoadModule` today and the deprecation is "a future major". What do you actually do this quarter?**
Set `future.removeSsrLoadModule: 'warn'` and collect the call sites — that is what the flag is
for. Then migrate the ones you own, cheaply: `vite.ssrLoadModule(url)` becomes
`env.runner.import(url)` behind an `isRunnableDevEnvironment` guard, the `ssrFixStacktrace`
call is deleted, and the server entry gains an `import.meta.hot.accept()`. Leave call sites
inside third-party packages alone and record them; that is the vendor's migration, and the
API still works meanwhile.

---

← [Environments vs the `ssr` Boolean](01b-environments-replace-the-ssr-boolean.md) · [Vite overview](../../README.md) · Next → [Fetchable & Custom Environments](01ca-fetchable-and-custom-environments.md)
