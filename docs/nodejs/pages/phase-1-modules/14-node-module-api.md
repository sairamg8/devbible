---
title: "The node:module API"
sidebar_label: "14 · node:module"
sidebar_position: 14
---

<span className="db-tier t-when">Learn When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS). Customization hooks are still
> experimental; `enableCompileCache()` is not.

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

## `module.register()` — customization hooks

Hooks let you intervene in resolution and loading: rewrite specifiers, transform
source, or synthesise modules that have no file behind them.

```js
// hooks.js
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('config:')) {
    return {
      url: new URL('./config-' + specifier.slice(7) + '.js', import.meta.url).href,
      shortCircuit: true,
    };
  }
  return next(specifier, context);
}
```

```js
// register.js
import { register } from 'node:module';
register('./hooks.js', import.meta.url);

const { env } = await import('config:prod');
console.log('custom specifier resolved →', env);
```

```console
$ node register.js
custom specifier resolved → production
```

Two hooks exist: `resolve` (specifier → URL) and `load` (URL → source). Both
receive a `next` function so multiple hook modules chain, and both must be
registered **before** the modules they affect are imported — which is why
`register()` runs in a separate file from the code under test, or via
`--import ./register.js`.

Hooks run on a **separate thread** from application code. That isolation is
deliberate — it stops a loader from deadlocking the main thread — and it means
hooks cannot share memory with your app. Communicate through the
`register()` data argument and a `MessagePort`, not module-scope variables.

**When you actually need this:** a custom file format, an in-house
monorepo path resolver, instrumentation that must see every module. **When you do
not:** mocking in tests — `node:test` has `mock.module()`; and path aliases —
[subpath imports](08-exports-map.md) do it natively.

## Other members worth knowing

| Export | What it is for |
|---|---|
| `createRequire(url)` | A working `require` inside ESM — see [interop](04-cjs-esm-interop.md) |
| `builtinModules` | Array of every built-in name — see [the `node:` prefix](03-node-prefix.md) |
| `isBuiltin(name)` | Whether a specifier is a built-in, prefix or not |
| `syncBuiltinESMExports()` | Push monkey-patched CJS built-ins into their ESM views |
| `findPackageJSON(specifier, base)` | Locate the `package.json` governing a module |
| `stripTypeScriptTypes(code)` | The type-stripping transform, exposed directly |

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
**Cause:** The target module was imported before `register()` ran. Static imports
are hoisted, so a `register()` call in the same file is already too late.
**Fix:** Register in a separate file loaded first — `node --import ./register.js app.js`.

**Symptom:** A hook cannot see a variable from the app
**Cause:** Hooks run on their own thread with no shared memory.
**Fix:** Pass data through the `register()` `data` option and a `MessagePort`.

**Symptom:** `enableCompileCache()` seems to do nothing
**Cause:** It was called after the heavy imports, so nothing was left to cache.
**Fix:** Call it first, or use `NODE_COMPILE_CACHE` so it applies from process
start.

**Symptom:** An `ExperimentalWarning` about customization hooks in production logs
**Cause:** The hooks API is still experimental in Node 24.
**Fix:** Expected. Pin your Node minor version and re-test hooks on every upgrade —
this API has changed shape more than once.

## Interview questions

**★ What is `module.register()` for?**
Registering customization hooks that intercept module resolution and loading —
rewriting specifiers, transforming source, or serving modules that have no file.
It replaced the older `--experimental-loader` flag approach.

**★ Why do loader hooks run on a separate thread?**
To keep a loader from blocking or deadlocking the main thread, and to keep the
loader's own module graph isolated from the application's. The consequence is no
shared memory — data crosses via `register()`'s `data` argument and a
`MessagePort`.

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

← Prev: [Publishing a package](13-publishing.md) · Next → [Phase 1 overview](README.md)
