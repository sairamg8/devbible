---
title: "One process can now build every environment, which removes the reason frameworks passed state between the client and SSR builds through files on disk"
sidebar_label: "Building All Environments"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Environment API for Frameworks § Environments During Build](https://vite.dev/guide/api-environment-frameworks), [Environment API for Plugins § Shared Plugins During Build](https://vite.dev/guide/api-environment-plugins), [CLI](https://vite.dev/guide/cli), [JavaScript API § `build`](https://vite.dev/guide/api-javascript). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ `vite build --app` is listed as **experimental** in the CLI reference, and `builder.sharedConfigBuild` is described as an opt-in that *"would only work of a small subset of projects at first"*. Both are quoted rather than recommended.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Building All Environments in One Process

**The two-command build in [chunk 1f](01f-the-two-builds.md) is the backward-compatible
shape, and it has an architectural consequence people rarely name: two commands are two
processes, so a plugin that runs in both cannot hold shared state in memory. That is why
frameworks wrote manifests to disk. The `builder` option removes the constraint.**

> *"In the CLI, calling `vite build` and `vite build --ssr` will still build the client only and ssr only environments for backward compatibility."*

---

## 1. Under-The-Hood Mechanics

### Opting in — and why an empty object is not a no-op

> *"When the `builder` option is set (even to an empty object `{}`, which is what `vite build --app` does), `vite build` opts in to building the entire app instead. This will become the default in a future major. In this mode, Vite creates a `ViteBuilder` instance (the build-time equivalent of a `ViteDevServer`) and uses it to build all configured environments for production. By default, environments are built in series, following the order of the `environments` record."*

The CLI flag is documented as `--app` — *"Build all environments, same as `builder: {}` (`boolean`, experimental)"*.

Two facts to carry away: **presence, not content, is the switch**, and the default order is
**the declaration order of your `environments` record**, in series.

### `builder.buildApp` — taking over the loop

> *"A framework or user can control how the environments are built through the `builder.buildApp` option. It receives the `ViteBuilder` instance (named `builder` in the example below) and is responsible for building each environment; for instance, to build some of them in parallel"*

### The `buildApp` plugin hook and its ordering

* **Kind:** `async`, `sequential` · **Scope:** Global

> *"Besides the `builder.buildApp` config option, plugins can define a `buildApp` hook to participate in the app build. The config option and the plugin hooks run in a defined order: hooks with order `'pre'` or `null` run first, then the configured `builder.buildApp`, then hooks with order `'post'`. Within a hook, `environment.isBuilt` tells you whether an environment has already been built, which lets a plugin avoid building it twice."*

Global scope is the important word: `buildApp` is an app-level hook, so there is no
"current environment" in its context — see
[`../08-plugin-system/01c-per-environment-hooks.md`](../08-plugin-system/01c-per-environment-hooks.md)
for the global-versus-per-environment split.

### `createBuilder` — the programmatic entry point

> *"To trigger an app build from your own code, use `createBuilder` instead of the standalone `build` function. `createBuilder` is the build-time equivalent of `createServer`: it resolves the config and returns a `ViteBuilder`, whose `buildApp` method builds every configured environment. You can also build a single environment with `builder.build(environment)`."*
> *"`createBuilder` supersedes the standalone `build` function for environment-aware builds. `build` still works as the simple entry point for the legacy client-only and ssr-only builds described above, but it cannot build arbitrary environments. Running `builder.buildApp()` is the programmatic equivalent of `vite build --app`."*

### The problem this actually solved

> *"Before Vite 6, the plugins pipelines worked in a different way during dev and build:"*
> *"**During dev:** plugins are shared"*
> *"**During Build:** plugins are isolated for each environment (in different processes: `vite build` then `vite build --ssr`)."*
> *"This forced frameworks to share state between the `client` build and the `ssr` build through manifest files written to the file system. In Vite 6, we are now building all environments in a single process so the way the plugins pipeline and inter-environment communication can be aligned with dev."*

⚠️ One process is **not** yet one config. The docs are explicit about the intermediate step:

> *"Ecosystem plugins are currently using `config.build` instead of `environment.config.build` to access configuration, so we need to create a new `ResolvedConfig` per-environment by default. A project can opt-in into sharing the full config and plugins pipeline setting `builder.sharedConfigBuild` to `true`."*
> *"This option would only work of a small subset of projects at first, so plugin authors can opt-in for a particular plugin to be shared by setting the `sharedDuringBuild` flag to `true`."*

So there are two granularities: `builder.sharedConfigBuild` for the whole project, and
`sharedDuringBuild` on a single plugin.

---

## 2. Real-World Engineering Scenario

**A CSS-extraction plugin that needed the client build's output during the SSR build.**

The plugin collects which components produced which CSS chunks so the SSR renderer can emit
the right `<link>` tags. Under two processes there was no way to hand that map across, so the
plugin wrote a JSON file at the end of the client build and read it at the start of the SSR
build — with all the usual costs: a temp path to agree on, a stale file when a build fails
halfway, and an ordering requirement enforced only by the shape of the npm script.

With a single process and `sharedDuringBuild: true`, the map is a `Map` in a closure. The
ordering requirement does not disappear — the SSR build must still run after the client build
— but it moves into `builder.buildApp`, where it is expressible and checkable via
`environment.isBuilt`, instead of living in the order of two shell commands.

---

## 3. Production-Grade Code Example

```js
// vite.config.js — build every environment, controlling the order explicitly
import { defineConfig } from 'vite'

export default defineConfig({
  environments: {
    client: {},
    ssr: { build: { outDir: 'dist/server', ssr: 'src/entry-server.js' } },
    edge: { build: { outDir: 'dist/edge' }, resolve: { noExternal: true } },
  },

  builder: {
    async buildApp(builder) {
      // The client build must complete first: the SSR build consumes its
      // manifest. Only the two independent server targets go in parallel.
      await builder.build(builder.environments.client)
      await Promise.all([
        builder.build(builder.environments.ssr),
        builder.build(builder.environments.edge),
      ])
    },
  },
})
```

```js
// build.js — the programmatic equivalent of `vite build --app`
import { createBuilder } from 'vite'

const builder = await createBuilder()
await builder.buildApp()
```

```js
// A plugin that shares state across environments in one build process
function collectStyles() {
  const perEnvironment = new Map() // keyed by this.environment

  return {
    name: 'collect-styles',

    // Opt this plugin into a single instance for all environments.
    sharedDuringBuild: true,

    transform(code, id) {
      const bucket = perEnvironment.get(this.environment) ?? new Set()
      perEnvironment.set(this.environment, bucket)
      if (id.endsWith('.css')) bucket.add(id)
      return null
    },

    // Global hook: no this.environment here.
    buildApp(builder) {
      for (const environment of Object.values(builder.environments)) {
        if (!environment.isBuilt) continue
        // the client's collected styles are readable here, in memory
      }
    },
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

**Parallel is not the default, and should not be your default either.** The docs' parallel
example is a demonstration of the hook's power, not a recommendation. An SSR build that reads
the client's SSR manifest ([chunk 1g](01g-the-ssr-manifest-and-preload.md)) has a real
dependency; running the two concurrently makes the outcome depend on which finishes first.

**`environment.isBuilt` is the guard the hook ordering needs.** With a config option and both
`'pre'` and `'post'` plugin hooks all able to trigger builds, "has this already been built?"
is a genuine question, and the docs point at this flag as the answer.

**`build()` still exists and still returns Rolldown types.** Its signature is
`Promise<RolldownOutput | RolldownOutput[] | RolldownWatcher>` — Vite 8 is Rolldown-based, so
code that annotated against Rollup's output types needs updating independently of anything in
this chunk.

---

## Gotchas

**★ Symptom: `environments` is fully configured and `vite build` still produces the client output only.**
Cause: the CLI keeps the legacy behaviour — *"calling `vite build` and `vite build --ssr` will still build the client only and ssr only environments for backward compatibility."* Fix: opt in.
```js
export default defineConfig({ builder: {} }) // or: vite build --app
```

**★ Symptom: adding an empty `builder: {}` to a config "for later" changes what CI produces.**
Cause: it is the opt-in switch; presence is the signal, not content. Fix: this is intended
behaviour — add `builder` only when you mean to build every environment, and expect `vite build` to start emitting the other environments' output directories.

**★ Symptom: the SSR build reads a stale or missing client manifest under a custom `buildApp`.**
Cause: environments were built in parallel, so the SSR build started before the client build
had written its output. Fix: sequence the dependency explicitly and parallelise only what is
independent.
```js
builder: {
  async buildApp(builder) {
    await builder.build(builder.environments.client)
    await builder.build(builder.environments.ssr)
  },
}
```

**★ Symptom: a plugin's shared cache is empty during the SSR build even though everything runs in one process.**
Cause: one process, but a `ResolvedConfig` and plugin instance **per environment** by default.
Fix: opt the plugin in — or the project, if you own every plugin in it.
```js
function myPlugin() {
  return { name: 'my-plugin', sharedDuringBuild: true }
}
// project-wide alternative: builder: { sharedConfigBuild: true }
```

**★ Symptom: `this.environment` is `undefined` inside a `buildApp` hook.**
Cause: `buildApp` is a **global** hook by documented scope — it runs once for the app, not per
environment. Fix: iterate the builder's environments instead of expecting a current one.
```js
buildApp(builder) {
  for (const env of Object.values(builder.environments)) { /* … */ }
}
```

**★ Symptom: an environment is built twice and the second build overwrites hand-tuned output.**
Cause: both a `builder.buildApp` config option and a plugin `buildApp` hook triggered a build
for it. Fix: check the flag the docs provide for exactly this.
```js
buildApp(builder) {
  const env = builder.environments.edge
  if (!env.isBuilt) await builder.build(env)
}
```

**★ Symptom: a programmatic build script cannot build a custom environment.**
Cause: it uses the standalone `build()` function, which *"cannot build arbitrary environments"*. Fix: use the builder.
```js
import { createBuilder } from 'vite'
const builder = await createBuilder()
await builder.build(builder.environments.edge)
```

---

## Interview questions

**★ Why did frameworks write manifest files to disk to pass state between the client and SSR builds?**
Because the two builds were two *processes* — `vite build` then `vite build --ssr`. Plugins
were instantiated separately in each, so a `Map` populated during the client build simply did
not exist during the SSR build. The filesystem was the only channel. The docs name this as the
motivation for single-process builds: *"This forced frameworks to share state between the `client` build and the `ssr` build through manifest files written to the file system."*

**★ One process now — so is the disk hand-off obsolete?**
Not automatically, for two reasons. First, the default is still a separate `ResolvedConfig`
and plugin instance per environment, for ecosystem compatibility; sharing requires opting in
per plugin (`sharedDuringBuild: true`) or per project (`builder.sharedConfigBuild: true`),
and the docs say the project-wide option *"would only work of a small subset of projects at first"*. Second, the SSR *manifest* in [chunk 1g](01g-the-ssr-manifest-and-preload.md) is a
deliberate build artefact consumed by your production server at runtime, not a workaround —
that one stays on disk regardless.

**★ `builder: {}` is an empty object. Why does setting it change anything?**
Because Vite tests for the option's presence, not its contents: *"even to an empty object `{}`, which is what `vite build --app` does"*. It is a mode switch expressed as a config key,
chosen so that the mode can later carry options (`buildApp`, `sharedConfigBuild`) without a
second flag. The practical consequence is that adding the key speculatively changes what your
build emits, which is unusual for a config object and worth flagging in review.

**★ When is building environments in parallel unsafe?**
Whenever one environment consumes another's output. The canonical case is SSR preload
injection: the client build emits the SSR manifest, and the server build (or the server at
runtime) reads it. Series is the documented default for that reason — *"By default, environments are built in series, following the order of the `environments` record."*
Parallelism is safe between mutually independent server targets, such as a Node server and an
edge worker that share no artefacts.

**★ Why does `createBuilder` supersede `build()` rather than extending it?**
Because `build()`'s signature encodes the old world: one invocation produces one output, with
`build.ssr` as a boolean-ish switch between two implicit environments. There is no argument
that means "the `edge` environment". `createBuilder` mirrors `createServer` instead — resolve
the config once, get an object holding every environment, then act on them individually
(`builder.build(env)`) or together (`builder.buildApp()`). `build()` is retained as the simple
entry point for the legacy client-only and ssr-only builds.

---

← [The Two Builds](01f-the-two-builds.md) · [Vite overview](../../README.md) · Next → [The SSR Manifest](01g-the-ssr-manifest-and-preload.md)
