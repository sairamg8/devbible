---
title: "The `ssr` flag on three plugin hooks is the last survivor of the two-environment world, and `this.environment` is what replaces it"
sidebar_label: "SSR Plugin Logic"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [SSR § SSR-specific Plugin Logic](https://vite.dev/guide/ssr), [`this.environment` in Hooks](https://vite.dev/changes/this-environment-in-hooks), [Environment API for Plugins](https://vite.dev/guide/api-environment-plugins), [Plugin API § Conditional Application](https://vite.dev/guide/api-plugin). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ SSR-Specific Plugin Logic

**A framework compiler cannot emit the same output for both targets: a component that
hydrates in a browser and a component that serialises to a string are different programs.
Vite's original answer was a boolean on three hooks. Vite 8's answer is that every module is
processed *in an environment*, and the environment is in the hook's context. Both work today
and the old one is documented as going away.**

> *"Some frameworks such as Vue or Svelte compile components into different formats based on client vs. SSR. To support conditional transforms, Vite passes an additional `ssr` property in the `options` object of the following plugin hooks:"* — `resolveId`, `load`, `transform`

---

## 1. Under-The-Hood Mechanics

### The legacy flag, exactly as documented

```js
export function mySSRPlugin() {
  return {
    name: 'my-ssr',
    transform(code, id, options) {
      if (options?.ssr) {
        // perform ssr-specific transform...
      }
    },
  }
}
```

Note the optional chaining in the docs' own sample — it is not defensive style:

> *"The options object in `load` and `transform` is optional, Rollup is not currently using this object but may extend these hooks with additional metadata in the future."*

And a historical note that explains older code you will meet:

> *"Before Vite 2.7, this was informed to plugin hooks with a positional `ssr` param instead of using the `options` object. All major frameworks and plugins are updated but you may find outdated posts using the previous API."*

### Why a boolean stopped being enough

> *"Before Vite 6, only two environments were available: `client` and `ssr`. A single `options.ssr` plugin hook argument in `resolveId`, `load` and `transform` allowed plugin authors to differentiate between these two environments when processing modules in plugin hooks. In Vite 6, a Vite application can define any number of named environments as needed. We're introducing `this.environment` in the plugin context to interact with the environment of the current module in hooks."*

> *"`this.environment` not only allow the plugin hook implementation to know the current environment name, it also gives access to the environment config options, module graph information, and transform pipeline (`environment.config`, `environment.moduleGraph`, `environment.transformRequest()`). Having the environment instance available in the context allows plugin authors to avoid the dependency of the whole dev server (typically cached at startup through the `configureServer` hook)."*

That last clause is a real architectural win: a plugin that only needed `server.moduleGraph`
no longer has to capture the whole server object in `configureServer` and hold it.

### The documented migration, verbatim

> *"For the existing plugin to do a quick migration, replace the `options.ssr` argument with `this.environment.config.consumer === 'server'` in the `resolveId`, `load` and `transform` hooks"*
> *"For a more robust long term implementation, the plugin hook should handle for [multiple environments](https://vite.dev/guide/api-environment-plugins#accessing-the-current-environment-in-hooks) using fine-grained environment options instead of relying on the environment name."*

⚠️ Deprecation status: *"`this.environment` was introduced in `v6.0`. The deprecation of `options.ssr` is planned for a future major. At that point we'll start recommending migrating your plugins to use the new API. To identify your usage, set `future.removePluginHookSsrArgument` to `"warn"` in your vite config."*

### Reading the environment's own configuration

The docs' minimal illustration is one line, and it is the whole idea:

```ts
  transform(code, id) {
    console.log(this.environment.config.resolve.conditions)
  }
```

A plugin that reads `this.environment.config` sees the *resolved* options for the environment
currently processing the module — its conditions, its `define` map, its build settings — not
the top-level defaults. That is what "fine-grained environment options" means in practice.

### `apply` still exists and answers a different question

> *"By default plugins are invoked for both serve and build. In cases where a plugin needs to be conditionally applied only during serve or build, use the `apply` property"*

```js
apply(config, { command }) {
  // apply only on build but not for SSR
  return command === 'build' && !config.build.ssr
}
```

`apply` decides serve-versus-build for the whole run. Deciding *which environment* a plugin
participates in is a different hook — see
**chunk 1ha** *(not written yet)*.

---

## 2. Real-World Engineering Scenario

**A CSS-modules plugin that returned class names to the server and stylesheets to the browser.**

The plugin's `transform` emits a JS object of class names in both targets, and additionally
registers the compiled CSS for the client build to extract. Written against `options.ssr` it
worked for years. When the team added a `rsc` environment for React Server Components, the
plugin started registering CSS from that environment too — because `options.ssr` was `false`
there in a way nobody had reasoned about, and the plugin's only question had been "is this the
server?"

Rewritten against `this.environment.config.consumer === 'server'`, the branch became correct
for an environment the plugin's author had never heard of. That is the difference between
asking "am I in the one non-client environment?" and asking "what kind of environment is
this?"

---

## 3. Production-Grade Code Example

```js
// A transform that branches on the environment, written for Vite 8
export function frameworkCompiler() {
  return {
    name: 'framework-compiler',

    resolveId(id, importer, options) {
      // Legacy-compatible read, kept for plugins consumed by older Vite.
      const legacySsr = options?.ssr === true

      // Preferred: a capability, not a name. Correct for `edge`, `rsc`,
      // or any environment this plugin has never heard of.
      const isServer = this.environment.config.consumer === 'server'

      if (isServer || legacySsr) {
        return resolveServerVariant(id, importer)
      }
      return null
    },

    transform(code, id) {
      const env = this.environment
      return compile(code, {
        id,
        target: env.config.consumer === 'server' ? 'ssr' : 'dom',
        // Fine-grained: the environment's own resolved options.
        conditions: env.config.resolve.conditions,
        define: env.config.define,
      })
    },
  }
}
```

```js
// vite.config.js — inventory legacy usage before the deprecation lands
export default {
  future: {
    removePluginHookSsrArgument: 'warn',
  },
}
```

```js
// A plugin that must run for the client build only
function clientOnlyBuildPlugin() {
  return {
    name: 'client-only-build',
    apply(config, { command }) {
      return command === 'build' && !config.build.ssr
    },
  }
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

**`options?.ssr` needs the optional chaining.** The options object is documented as optional
on `load` and `transform`. A bare `options.ssr` is a `TypeError` waiting for the one caller
that omits it.

**A plugin published to npm must support both spellings for now.** `options.ssr` still works
in Vite 8 and `this.environment` does not exist in Vite 5. Reading the legacy flag and falling
back to `consumer` — in that order or the reverse — is the compatible shape until you drop
Vite 5 support.

**`apply` sees `config.build.ssr`, which is the legacy flag, not the environment list.** In an
app built with `builder`/`--app` ([chunk 1fa](01fa-building-all-environments.md)),
`config.build.ssr` is not how the SSR environment is expressed, so an `apply` written against
it will not exclude the server environment there.

---

## Gotchas

**★ Symptom: `TypeError: Cannot read properties of undefined (reading 'ssr')` inside `transform`.**
Cause: the third argument is optional — *"The options object in `load` and `transform` is optional"*. Fix: optional-chain it, exactly as the docs' own example does.
```js
transform(code, id, options) {
  if (options?.ssr) { /* … */ }
}
```

**★ Symptom: a plugin behaves correctly for `client` and `ssr` and does the wrong thing in an `edge` or `rsc` environment.**
Cause: it branches on the environment's name, or on a boolean that only ever meant "the one
non-client environment". The docs steer away from both — the robust form uses *"fine-grained environment options instead of relying on the environment name."* Fix: branch on capability.
```js
const isServer = this.environment.config.consumer === 'server'
```

**★ Symptom: a plugin reads top-level `resolve.conditions` and gets the client's list while transforming a server module.**
Cause: `config` in a hook closure is the resolved *top-level* config; the environment's own
options live on the environment. Fix: read them from the context.
```js
transform(code, id) {
  const conditions = this.environment.config.resolve.conditions
}
```

**★ Symptom: a build-only plugin also runs during the SSR build and corrupts the server bundle.**
Cause: `apply: 'build'` does not distinguish the two builds. Fix: use the function form, which
the docs show for exactly this case.
```js
apply(config, { command }) {
  return command === 'build' && !config.build.ssr
}
```

**★ Symptom: a plugin holds the whole `ViteDevServer` from `configureServer` only to reach the module graph.**
Cause: pre-environment habit. The docs name the improvement — `this.environment` *"allows plugin authors to avoid the dependency of the whole dev server (typically cached at startup through the `configureServer` hook)."* Fix: read the graph off the environment in the hook
that needs it.
```js
transform(code, id) {
  const mod = this.environment.moduleGraph.getModuleById(id)
}
```

**★ Symptom: you cannot tell how much `options.ssr` usage a codebase has before the deprecation lands.**
Cause: no inventory. Fix: turn the future flag on and let Vite report the call sites.
```js
export default { future: { removePluginHookSsrArgument: 'warn' } }
```

---

## Interview questions

**★ Why did the `ssr` flag appear on `resolveId`, `load` and `transform` and nowhere else?**
Because those are the three hooks that process a *module*, and a module is the thing that
belongs to one graph or the other. Config hooks resolve once for the whole run; server hooks
set up one HTTP server. Only module-level hooks can meaningfully be asked "which target is
this for?" That framing is also why the replacement is `this.environment` on the plugin
context rather than a wider argument: the context already exists exactly where a module is
being processed.

**★ Why is `this.environment.config.consumer === 'server'` the recommended migration rather than checking the environment name?**
Because names are chosen by the application, not by Vite. The docs state that an app *"doesn't need to use the `ssr` name for its SSR environment, it could name it `server` for example"*, and
plugins routinely add `rsc` or `edge`. A name check silently fails on every environment the
plugin has not heard of, and fails *open* — it takes the client branch on a server. `consumer`
is a declared capability, so it stays correct for environments that did not exist when the
plugin was written.

**★ What does `this.environment` give a plugin beyond knowing which target it is in?**
The environment's resolved config, its module graph, and its transform pipeline —
`environment.config`, `environment.moduleGraph`, `environment.transformRequest()`. The
practical consequence the docs highlight is that a plugin no longer has to capture the whole
dev server in `configureServer` just to reach a module graph later. That matters for
correctness as well as tidiness: the server-level graph is a mixed compatibility view, while
the environment's graph is the real one for the module you are processing.

**★ `options.ssr` still works. Why migrate now?**
Because the migration is mechanical today and will not be later. Right now it is one
expression per hook and the two spellings coexist, so you can change it, test it, and ship it
without a deadline. Once the deprecation lands, the same change has to happen under time
pressure alongside whatever else that major release breaks. The `future.removePluginHookSsrArgument: 'warn'` flag exists precisely so you can do the inventory
before that. The one legitimate reason to keep the old flag is publishing a plugin that must
still support Vite 5, where `this.environment` does not exist.

**★ A plugin uses `apply` to skip the SSR build. Is that still correct in Vite 8?**
Only for the legacy two-command build. The documented example — `command === 'build' && !config.build.ssr` — reads `build.ssr`, which is the flag set by `vite build --ssr`. In an app
that opts into `builder`/`--app`, every environment is built in one run and the SSR environment
is expressed through `environments`, not `build.ssr`, so the check no longer excludes it.
Environment-level participation is `applyToEnvironment`'s job — see
**chunk 1ha** *(not written yet)*.

---

← [The SSR Manifest](01g-the-ssr-manifest-and-preload.md) · [Vite overview](../../README.md) · Next → [Optimization & Performance](../11-optimization-and-performance/01-build-time-performance.md)
