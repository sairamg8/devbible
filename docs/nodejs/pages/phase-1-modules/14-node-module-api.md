---
title: "The node:module API"
sidebar_label: "14 · node:module"
sidebar_position: 14
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-10-08 on **Node 24.19.0** (LTS) against the Node.js `module` docs
> ([v24.x](https://nodejs.org/docs/latest-v24.x/api/module.html),
> [v26.x](https://nodejs.org/docs/latest-v26.x/api/module.html)) and
> [DEP0205](https://nodejs.org/docs/latest-v24.x/api/deprecations.html#DEP0205).
> `registerHooks()` is **Stability 1.2 – Release candidate**, `register()` is
> **Stability 0 – Deprecated**, and `enableCompileCache()` is no longer
> experimental as of v24.15.0. The hook examples are written from the docs and
> **not run**; the compile-cache and `isBuiltin()` output blocks are from the
> 2026-08 run.

**The programmable side of the module system. You will go years without needing
it — then need it for exactly one thing: a loader, a test double, or a startup-time
win.**

Read this page when a problem sends you here. Nothing downstream in this bible
depends on it.

## `enableCompileCache()` — the one with immediate value

V8 compiles your JavaScript on every start. The compile cache stores the result on
disk and reuses it, cutting startup work for any process with a large dependency
tree.

```js
// cache.js
import { enableCompileCache, getCompileCacheDir } from 'node:module';
const r = enableCompileCache();
console.log('status:', r.status === 1 ? 'ENABLED' : r.status, '| dir:', getCompileCacheDir()?.includes('node-compile-cache'));
```

```console
$ node cache.js
status: ENABLED | dir: true
```

Call it at the very top of your entry point, before importing anything heavy —
it only helps modules compiled after it runs.

The zero-code version is an environment variable, which is usually the better
choice because it needs no change to your source:

```console
$ NODE_COMPILE_CACHE=/tmp/cc-demo node app.js
$ ls /tmp/cc-demo
v24.19.0-x64-cf738c9d-1000
```

The cache directory is keyed by Node version and architecture, so an upgrade
invalidates it safely rather than executing stale bytecode.

**The trade-off:** disk space, and a cold first run that is slightly slower while
the cache is written. For a CLI invoked constantly, or a serverless function where
cold start is the metric, it is close to free money. For a long-lived server that
starts once a day, it is noise.

## `module.registerHooks()` — customization hooks

Hooks let you intervene in resolution and loading: rewrite specifiers, transform
source, or synthesise modules that have no file behind them. Node has had two APIs
for this, and the docs now say which one to learn:

> *"The asynchronous hooks incur extra overhead from inter-thread communication, and have several caveats especially when customizing CommonJS modules in the module graph. In most cases, it's recommended to use synchronous hooks via `module.registerHooks()` for simplicity."*

`registerHooks()` takes the hook functions in-line and runs them *"directly on the
thread where the modules are loaded"*. It is `Stability: 1.2 - Release candidate`
(since v24.13.1): the supported path, not yet Stable.

```js
// register-hooks.mjs
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('config:')) {
      return {
        url: new URL('./config-' + specifier.slice(7) + '.js', import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
```

```js
// config-prod.js  ("type": "module" in package.json)
export const env = 'production';
```

```js
// app.mjs — run with: node --import ./register-hooks.mjs app.mjs
const { env } = await import('config:prod');
console.log('custom specifier resolved →', env);
```

Two hooks exist. These are the signatures the docs give:

```js
function resolve(specifier, context, nextResolve) {
  // Take an `import` or `require` specifier and resolve it to a URL.
}

function load(url, context, nextLoad) {
  // Take a resolved URL and return the source code to be evaluated.
}
```

| Hook | `context` carries | Returns |
|---|---|---|
| `resolve` | `conditions`, `importAttributes`, `parentURL` | `url` (absolute); optionally `format` (a hint to `load`), `importAttributes`, `shortCircuit` |
| `load` | `conditions`, `format`, `importAttributes` | `format` and `source`; optionally `shortCircuit` |

The full contract — every context field, the accepted `format` and `source` pairs, the
`format` hint rule, a module with no file behind it — is on
[14b](14b-hook-contracts-and-failure-modes.md).

**Hooks chain, last registered first.** Calling `registerHooks()` more than once is
allowed, and the order is the part people get backwards:

> *"These chains run last-in, first-out (LIFO). If both `hook1` and `hook2` define a `resolve` hook, they will be called like so (note the right-to-left, starting with `hook2.resolve`, then `hook1.resolve`, then the Node.js default): Node.js default `resolve` ← `hook1.resolve` ← `hook2.resolve`"*

**Register before the code you want to affect is loaded.** Static `import` hoists, so
the registering file cannot also statically import its targets:

> *"Do not use static `import` statements to load modules that need to be customized in the same module that registers the hooks, because static `import` statements are evaluated before any code in the importer module is run, including the call to `registerHooks()`, regardless of where the static `import` statements appear in the importer module."*

Register from a preload (`--import` or `--require`), or from the entry point and then
`await import()` the app. `app.mjs` above relies on the first.

**Hooks share the application's thread.** That is what makes them simple:

> *"Synchronous hooks are run in the same thread and the same realm where the modules are loaded, the code in the hook function can pass values to the modules being referenced directly via global variables or other shared states."*

**When you actually need this:** a custom file format, an in-house
monorepo path resolver, instrumentation that must see every module. **When you do
not:** mocking in tests — `node:test` has `mock.module()`; and path aliases —
[subpath imports](08-exports-map.md) do it natively.

## `module.register()` — the deprecated predecessor (DEP0205)

⚠️ **Deprecated.** `register()` loads a *module* of `async` hooks onto a separate
loader thread. It is the older of the two hook APIs, and the docs now mark it
`Stability: 0 - Deprecated: Use module.registerHooks() instead.` The deprecation is
**DEP0205**: documentation-only since v24.15.0, **runtime since v26.0.0**.

```js
// deprecated (DEP0205): hooks live in their own module, on another thread
import { register } from 'node:module';
register('./hooks.js', import.meta.url);
```

> *"`module.register()` is deprecated. Use `module.registerHooks()` instead."*

> *"The `module.register()` API provides off-thread async hooks for customizing ES modules; the `module.registerHooks()` API provides similar hooks that are synchronous, in-thread, and work for all types of modules."*

On Node 24.19.0 the deprecation is documentation-only, and the deprecations page says
of those: *"These generate no side-effects while running Node.js."* On 26 it is
`Type: Runtime`, which means a process warning, and nothing in DEP0205 names a
release for removal: *"will be removed in a future version of Node.js"*. The full
example, the reasons, the timeline and a side-by-side migration are on
[14c](14c-migrating-off-module-register.md).

## Other members worth knowing

| Export | What it is for |
|---|---|
| `createRequire(url)` | A working `require` inside ESM — see [interop](04-cjs-esm-interop.md) |
| `builtinModules` | Array of every built-in name — see [the `node:` prefix](03-node-prefix.md) |
| `isBuiltin(name)` | Whether a specifier is a built-in, prefix or not |
| `syncBuiltinESMExports()` | Push monkey-patched CJS built-ins into their ESM views |
| `findPackageJSON(specifier, base)` | Locate the `package.json` governing a module |
| `stripTypeScriptTypes(code)` | The type-stripping transform, exposed directly. On 24, `mode` also accepts `'transform'` (and there is a `sourceMap` option); both were removed in v26.0.0 |

```js
// isbuiltin.js
import { isBuiltin } from 'node:module';
console.log(isBuiltin('fs'), isBuiltin('node:fs'), isBuiltin('express'));
```

```console
$ node isbuiltin.js
true true false
```

## Gotchas

**Symptom:** A registered hook has no effect
**Cause:** The target module was imported before `registerHooks()` ran. Static imports
are hoisted, so a `registerHooks()` call in the same file is already too late.
**Fix:** Register in a separate file loaded first — `node --import ./register-hooks.mjs app.mjs` —
or register in the entry point and load the app dynamically:

```js
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier, context);
  },
});

await import('./my-app.mjs');   // not a static import at the top of this file
```

**Symptom:** An exception from a hook that looks harmless
**Cause:** A hook must either call `nextResolve()` / `nextLoad()` or end the chain on
purpose. The docs: *"A hook that returns without calling `next<hookName>()` _and_ without returning `shortCircuit: true` also triggers an exception."*
**Fix:** One of the two on every code path:

```js
resolve(specifier, context, nextResolve) {
  if (specifier === 'special-module') {
    return { url: 'file:///path/to/special-module.mjs', shortCircuit: true }; // ends the chain
  }
  return nextResolve(specifier, context);                                    // defers to the next hook
}
```

**Symptom:** `enableCompileCache()` seems to do nothing
**Cause:** It was called after the heavy imports, so nothing was left to cache.
**Fix:** Call it first, or use `NODE_COMPILE_CACHE` so it applies from process
start.

**Symptom:** The hooks API behaves differently after a Node upgrade
**Cause:** None of the three hook entry points is Stable. `registerHooks()` is
`Stability: 1.2 - Release candidate`, the async hooks behind `register()` are
`Stability: 1.1 - Active Development`, and `register()` is `Stability: 0 - Deprecated`.
**Fix:** Pin your Node minor version and re-test hooks on every upgrade — this API
has changed shape more than once. (Whether either API prints an
`ExperimentalWarning` on 24 could not be confirmed: the docs do not say so, and none
of the `v24.x` source files read for `register()` and `registerHooks()` emits one.
It was not run.)

## Interview questions

**★ Which customization-hooks API should new code use, and why?**
`module.registerHooks()`. It takes synchronous hook functions that run on the thread
loading the modules, and the docs recommend it *"in most cases"* because the
asynchronous hooks behind `module.register()` pay for inter-thread communication and
carry caveats, especially for CommonJS. `register()` is deprecated as DEP0205
(documentation-only in v24.15.0, runtime in v26.0.0). `registerHooks()` is
`Stability: 1.2 - Release candidate`, so it is the supported path rather than a
frozen one.

**★ Why must hooks be registered before the code they affect is imported?**
Because module loading is already done by then. Static `import` statements are
evaluated before any code in the importing module runs, so a `registerHooks()` call in
the same file cannot affect them. Register from a preload (`--import` /
`--require`), or register in the entry point and load the application with
`await import()`.

**★ What does a hook have to return if it does not call `next`?**
An object with `shortCircuit: true`, plus the required properties (`url` for
`resolve`; `format` and `source` for `load`). The docs say a hook that neither calls
`next<hookName>()` nor returns `shortCircuit: true` triggers an exception, and so does
one that returns a value lacking a required property. Both checks exist to stop an
accidental break in the chain.

**★ What does the compile cache do?**
It persists V8's compilation output to disk so subsequent starts skip recompiling
unchanged modules, reducing startup time. Enable it with `enableCompileCache()` at
the top of the entry point or the `NODE_COMPILE_CACHE` environment variable. The
cache is keyed by Node version and architecture, so upgrades invalidate it.

**When should you reach for hooks rather than a simpler tool?**
Rarely. Path aliases are better served by `imports` subpath mappings, and test
mocking by `mock.module()` in `node:test`. Hooks earn their complexity for custom
file formats, cross-cutting instrumentation, or resolution rules Node has no
native equivalent for.

---

← Prev: [Publishing a package](13-publishing.md) · Next → [Writing hooks: the resolve and load contracts](14b-hook-contracts-and-failure-modes.md)
