---
title: "SSR is no longer an alternate build — it is one environment among many, each with its own config, its own plugin pipeline and its own module graph"
sidebar_label: "Environments vs the `ssr` Boolean"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Environment API](https://vite.dev/guide/api-environment), [Using `Environment` Instances](https://vite.dev/guide/api-environment-instances), [Move to Per-environment APIs](https://vite.dev/changes/per-environment-apis), [Plugin API § Rolldown Hooks](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ The Environment API is documented as **release candidate**, not stable. Every claim below is quoted from that state of the docs, and the stability caveat is repeated where it changes what you should do.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Environments Replace the `ssr` Boolean

**The mental model "SSR is the second build" is the single staleest idea in older Vite SSR
material. Since Vite 6 the client and the server are two *environments*: peer objects, each
with resolved config, a plugin pipeline and an isolated module graph. A boolean cannot
address three of anything, and modern apps run in three — browser, node server, edge.**

> *"Vite 6 formalizes the concept of Environments. Until Vite 5, there were two implicit Environments (`client`, and optionally `ssr`). The new Environment API allows users and framework authors to create as many environments as needed to map the way their apps work in production."* — [Environment API](https://vite.dev/guide/api-environment)

---

## 1. Under-The-Hood Mechanics

### What an SSR app has, concretely

> *"When we move to a typical server-side rendered (SSR) app, we'll have two environments:"*
> *"`client`: runs the app in the browser."*
> *"`ssr`: runs the app in node (or other server runtimes) which renders pages before sending them to the browser."*

And in dev they share a process — which is what makes middleware-mode SSR feel immediate:

> *"In dev, Vite executes the server code in the same Node process as the Vite dev server, giving a close approximation to the production environment."*

The important structural change is underneath: **one HTTP server, one plugin pipeline, N
independent dev environments.**

> *"On top of the shared HTTP server, middlewares, resolved config, and plugins pipeline, the Vite dev server now has a set of independent dev environments. Each of them is configured to match the production environment as closely as possible, and is connected to a dev runtime where the code is executed"*

### Isolated module graphs — the property that fixes HMR

> *"Each environment has an isolated module graph. All module graphs have the same signature, so generic algorithms can be implemented to crawl or query the graph without depending on the environment. `hotUpdate` is a good example. When a file is modified, the module graph of each environment will be used to discover the affected modules and perform HMR for each environment independently."*

Contrast the Vite 5 shape the docs describe, because inherited code still assumes it:

> *"Vite v5 had a mixed Client and SSR module graph. Given an unprocessed or invalidated node, it isn't possible to know if it corresponds to the Client, SSR, or both environments."*

### Which environments exist, and when

This asymmetry between dev and build is not obvious and it bites:

> *"The `client` and a server environment named `ssr` are always present during dev. This allows backward compatibility with `server.ssrLoadModule(url)` and `server.moduleGraph`. During build, the `client` environment is always present, and the `ssr` environment is only present if it is explicitly configured (using `environments.ssr` or for backward compatibility `build.ssr`). An app doesn't need to use the `ssr` name for its SSR environment, it could name it `server` for example."*

### Configuration: top-level is the default, `environments` is the override

```ts
interface EnvironmentOptions {
  define?: Record<string, any>
  resolve?: EnvironmentResolveOptions
  optimizeDeps: DepOptimizationOptions
  consumer?: 'client' | 'server'
  dev: DevOptions
  build: BuildOptions
}
```

> *"When not explicitly documented, environment inherits the configured top-level config options (for example, the new `server` and `edge` environments will inherit the `build.sourcemap: false` option). A small number of top-level options, like `optimizeDeps`, only apply to the `client` environment, as they don't work well when applied as a default to server environments."*

`consumer` is the field to reach for when you need to branch. It is a *capability* claim —
this environment is a server — where the name `ssr` is merely a label someone chose.

### The `ssr` top-level option is on its way out

> *"Note that the `ssr` top-level property is going to be deprecated once the Environment API is stable. This option has the same role as `environments`, but for the default `ssr` environment and only allowed configuring of a small set of options."*

⚠️ Deprecated **once stable**, and it is not stable yet. `ssr.noExternal` and friends
(chunks [1d](01d-ssr-externals.md) and [1e](01e-ssr-target-and-resolve-conditions.md)) remain
the documented, supported spelling today.

### Stability, stated plainly

> *"The Environment API is generally in the release candidate phase. We'll maintain stability in the APIs between major releases to allow the ecosystem to experiment and build upon them."*
> *"We don't recommend switching to Environment API yet. We are aiming for a good portion of the user base to adopt Vite 6 before so plugins don't need to maintain two versions."*

That last sentence is aimed at **plugin authors** shipping to the ecosystem. The calculus is
different for an application you control end to end.

---

## 2. Real-World Engineering Scenario

**Adding an edge environment to an app that had two.**

A product renders pages in Node and runs personalisation at the CDN edge. Under the Vite 5
model that meant a third `vite build` invocation with a hand-rolled config, its own process,
and a manifest file on disk to carry information back to the other two builds — because a
`ssr: true` boolean has no way to say "this is the *other* server."

With environments it is a config entry. The edge environment declares its own `resolve`
options, inherits everything else, gets its own module graph in dev, and is built in the same
process as the others so plugins can share state directly:

```js
export default {
  build: { sourcemap: false },
  environments: {
    server: {},
    edge: { resolve: { noExternal: true } },
  },
}
```

That two-line `edge` entry is exactly the example the Environment API guide gives.

---

## 3. Production-Grade Code Example

```js
// vite.config.js — an explicit three-environment app
import { defineConfig } from 'vite'

export default defineConfig({
  // Top-level options configure `client` AND supply defaults to the rest.
  build: { sourcemap: true },

  // optimizeDeps is one of the options that applies to `client` only.
  optimizeDeps: { include: ['lodash-es'] },

  environments: {
    // An empty object is enough to register an environment.
    server: {},

    edge: {
      // Bundle everything: no Node built-ins available at the edge.
      resolve: { noExternal: true },
      build: { outDir: 'dist/edge' },
    },
  },
})
```

```js
// Reading environments back off a dev server — each has its own graph.
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
})

server.environments.client.transformRequest('/src/main.js')
server.environments.ssr.moduleGraph          // isolated from client's
server.environments.edge.config.resolve.conditions
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

**`environments.ssr` and `build.ssr` are not the same knob.** The former declares an
environment; the latter is the backward-compatible flag that produces the legacy SSR-only
build. During build, either one is what makes the `ssr` environment exist at all.

**Naming is free, but `ssrLoadModule` is not renameable.** The docs are explicit that an app
*"doesn't need to use the `ssr` name"* — but `server.ssrLoadModule` targets the environment
literally called `ssr`. Rename it to `server` and the legacy API has nothing to load from;
you must go through `server.environments.server` instead.

**Server methods are documented as future-deprecated, not deprecated.** The docs list
`future.removeServerModuleGraph`, `removeServerReloadModule`, `removeServerPluginContainer`,
`removeServerHot`, `removeServerTransformRequest` and `removeServerWarmupRequest` as
`'warn'` opt-ins for *finding* your usage — alongside *"We don't recommend moving away from server methods yet."*

---

## Gotchas

**★ Symptom: `optimizeDeps.include` has no effect on a dependency that only the server imports.**
Cause: `optimizeDeps` is one of the top-level options that *"only apply to the `client` environment"* — it is not inherited as a default by server environments. Fix: set it on the
environment that actually needs it.
```js
export default defineConfig({
  environments: {
    ssr: { optimizeDeps: { include: ['some-cjs-only-dep'] } },
  },
})
```

**★ Symptom: an HMR or plugin routine walks `server.moduleGraph` and sees each module twice, or attributes a server module to the client.**
Cause: `server.moduleGraph` is a compatibility view — *"The `server.moduleGraph` returns a mixed view of the client and ssr module graphs."* Fix: address the graph you mean.
```js
const mod = await server.environments.ssr.moduleGraph.getModuleByUrl(url)
```

**★ Symptom: `server.ssrLoadModule()` fails after renaming the SSR environment to `server`.**
Cause: the legacy API is hard-wired to the environment named `ssr`; the rename removed it.
Fix: keep the name `ssr`, or move to the environment's own runner (see
[chunk 1c](01c-the-module-runner.md)).
```js
const env = server.environments.server
const { render } = await env.runner.import('/src/entry-server.js')
```

**★ Symptom: a build produces client output only, even though the dev server clearly had an `ssr` environment.**
Cause: dev always creates `client` and `ssr`; **build does not**. The `ssr` environment
*"is only present if it is explicitly configured"*. Fix: declare it, or pass the legacy flag.
```js
export default defineConfig({ environments: { ssr: {} } })
// or: vite build --ssr src/entry-server.js
```

**★ Symptom: an upgrade breaks code written against `server.hot`.**
Cause: it moved. The documented mapping is `server.hot` → `server.client.environment.hot`.
Fix: address the client environment's channel — and note that other environments have one
too, which is what makes plugin-to-server messaging possible.
```js
server.client.environment.hot.send({ type: 'full-reload' })
```

**★ Symptom: a library plugin built on `this.environment` breaks for users still on Vite 5-era plugins.**
Cause: adopting an RC API in a package many people consume. The docs say so directly:
*"We don't recommend switching to Environment API yet … so plugins don't need to maintain two versions."* Fix: for a *published plugin*, keep the compatibility path; for an application
you own, the RC surface is a reasonable bet because you upgrade both halves together.

---

## Interview questions

**★ Why was a `ssr` boolean not enough, given that most apps really do have exactly two targets?**
Because the boolean encodes *count*, not *identity*. Two targets need one bit; three need a
name, and modern deployments routinely have three — browser, Node server, edge worker — each
with different resolve conditions, different built-ins and different externalisation rules.
The docs give the concrete failure: *"Vite 5 didn't allow to properly represent these environments."* Once you accept names, everything keyed on the boolean has to be re-keyed:
plugin state, module graphs, transform requests, HMR.

**★ What does `consumer: 'client' | 'server'` give you that the environment's name does not?**
The name is arbitrary — an app may call its server environment `server`, `edge` or `rsc`. The
`consumer` field states the *kind*. That is why the documented quick migration for the old
`options.ssr` boolean is `this.environment.config.consumer === 'server'` and not a name
comparison: a plugin that branches on `consumer` keeps working in an app whose environments
it has never heard of.

**★ Why do isolated module graphs matter for HMR specifically?**
Because HMR is a graph traversal, and a mixed graph makes the traversal ambiguous. The docs
describe the Vite 5 problem exactly: given an invalidated node you *"can't know if it corresponds to the Client, SSR, or both environments."* With one graph per environment, a
file change is resolved independently in each — the client may hot-update while the server
graph invalidates a different, larger set, and neither decision contaminates the other.

**★ The Environment API is a release candidate. How should that change what you build on it?**
Split by who bears the upgrade cost. In an application, you own the config and the plugins
and you upgrade everything in one commit, so using `environments`, `this.environment` and
per-environment config is a contained bet. In a *published* plugin, every one of your users
bears it, and the docs explicitly ask you to wait so *"plugins don't need to maintain two versions."* The intermediate position the docs support is to keep using stable APIs while
setting the `future.*` flags to `'warn'` so you can inventory your usage before the deprecation
actually lands.

**★ In dev the `ssr` environment always exists; at build time it may not. Why the asymmetry, and what breaks?**
Dev creates it unconditionally to keep `server.ssrLoadModule` and `server.moduleGraph`
working for every existing project. Build has no such obligation — building an environment
nobody asked for would emit output nobody wants — so it appears only when configured via
`environments.ssr` or `build.ssr`. What breaks is a CI pipeline that works locally and then
ships a client-only `dist`: the dev server proved the server code ran, and the build was never
told to produce it.

---

← [The Dev Request Pipeline](01a-the-dev-request-pipeline.md) · [Vite overview](../../README.md) · Next → [The Module Runner](01c-the-module-runner.md)
