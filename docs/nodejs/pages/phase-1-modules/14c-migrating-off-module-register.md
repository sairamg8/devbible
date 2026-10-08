---
title: "module.register() has been deprecated since v24.15.0 and warns at runtime from v26.0.0 — migrating means moving the hooks in-line, dropping initialize and the MessagePort, and dropping every await, because the replacement is synchronous"
sidebar_label: "14c · Migrating off register()"
sidebar_position: 14.2
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-10-08 on **Node 24.19.0** against [DEP0205](https://nodejs.org/docs/latest-v24.x/api/deprecations.html#DEP0205) ([v24.x](https://nodejs.org/docs/latest-v24.x/api/deprecations.html) and [v26.x](https://nodejs.org/docs/latest-v26.x/api/deprecations.html)), the `module` docs ([v24.x](https://nodejs.org/docs/latest-v24.x/api/module.html), [v26.x](https://nodejs.org/docs/latest-v26.x/api/module.html)), the `--experimental-loader` entry in the [v26.x CLI docs](https://nodejs.org/docs/latest-v26.x/api/cli.html), and the changelogs for [24.x](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V24.md) and [26.x](https://github.com/nodejs/node/blob/main/doc/changelogs/CHANGELOG_V26.md).
> The `register()` example and its output are from the 2026-08 run on 24.19.0; the `registerHooks()` code is written from the docs and **not run**.

**`module.register()` is the older of Node's two customization-hooks APIs, and Node now calls it deprecated: documentation-only on Node 24 since v24.15.0, a runtime warning from v26.0.0, removal promised but unscheduled. The replacement is not a rename. Hooks stop living in their own module on their own thread and become plain synchronous functions passed in-line — so `initialize`, `data`, `transferList`, `MessagePort` plumbing and every `await` inside a hook go away. This page is the old code, the reasons, the timeline and the translation.**

[Page 14](14-node-module-api.md) teaches `registerHooks()`; [14b](14b-hook-contracts-and-failure-modes.md) is its contract.

## What DEP0205 says

> *"`module.register()` is deprecated. Use `module.registerHooks()` instead."*

> *"The `module.register()` API provides off-thread async hooks for customizing ES modules; the `module.registerHooks()` API provides similar hooks that are synchronous, in-thread, and work for all types of modules. Supporting async hooks has proven to be complex, involving worker threads orchestration, and there are issues that have proven unresolvable. See caveats of asynchronous customization hooks. Please migrate to `module.registerHooks()` as soon as possible as `module.register()` will be removed in a future version of Node.js."*

| Release | What happened | Where it is stated |
|---|---|---|
| v18.19.0, v20.6.0 | `register()` added | `module.md` history |
| v22.15.0, v23.5.0 | `registerHooks()` added | `module.md` history |
| v24.13.1, v25.4.0 | synchronous and in-thread hooks become `Stability: 1.2 - Release candidate` | `module.md` history |
| v24.15.0, v25.9.0 | `register()` deprecated, **documentation-only** ([#62395](https://github.com/nodejs/node/pull/62395)) | `deprecations.md`; CHANGELOG_V24.md |
| v26.0.0 | **runtime** deprecation ([#62401](https://github.com/nodejs/node/pull/62401)) | `deprecations.md`; CHANGELOG_V26.md, "runtime-deprecate module.register()" |
| "a future version" | removal | DEP0205; no release is named |

What each deprecation type does, from the deprecations page:

> *"A Documentation-only deprecation is one that is expressed only within the Node.js API docs. These generate no side-effects while running Node.js."*

> *"When the `--throw-deprecation` command-line flag is used, a Runtime deprecation will cause an error to be thrown."*

So on 24.19.0 `register()` runs exactly as it always did. On 26 it emits a warning whose text, in the v26.x source, is `` `module.register()` is deprecated. Use `module.registerHooks()` instead. ``; with `--throw-deprecation` the docs say it becomes an error.

## The `register()` code being replaced

Hooks in a module of their own, registered by specifier, on a separate thread:

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

Run on Node 24.19.0 in the 2026-08 pass, with the `config-prod.js` shown on [page 14](14-node-module-api.md) (it exports `env`), this printed `custom specifier resolved → production`. That output is carried over from that run, not re-run for this page. The same hook written for `registerHooks()` is the first example on page 14.

## What changes in the translation

| | `register()` — deprecated | `registerHooks()` |
|---|---|---|
| Where hooks live | a module that exports them, named by specifier | functions passed in-line |
| Thread | *"run in a separate thread, isolated from the main thread where application code runs"*, a different realm | *"directly on the thread where the modules are loaded"* |
| Hook functions | `async`; may return promises | synchronous; *"each one must always return a plain object"* |
| Setup | `initialize` hook, `data`, `transferList` | none needed |
| Sharing state | message channels | *"directly via global variables or other shared states"* |
| Removing hooks | not available | `deregister()` |
| Worker threads | *"inherited into child workers by default"* | not by default |
| Stability | async hooks `1.1 - Active Development`; `register()` `0 - Deprecated` | `1.2 - Release candidate` |

The docs on `initialize`:

> *"The `initialize` hook is only accepted by `register`. `registerHooks()` does not support nor need it since initialization done for synchronous hooks can be run directly before the call to `registerHooks()`."*

So this:

```js
// before — hooks.js receives setup data on the hooks thread
let prefix = 'config:';
export async function initialize(data) {
  prefix = data.prefix;
}
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(prefix)) {
    return { url: new URL('./config-' + specifier.slice(prefix.length) + '.js', import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
// register.js: register('./hooks.js', { parentURL: import.meta.url, data: { prefix: 'cfg:' } });
```

becomes this, with the setup value just a variable:

```js
// after — one file, no thread, no initialize
import { registerHooks } from 'node:module';

const prefix = 'cfg:';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(prefix)) {
      return {
        url: new URL('./config-' + specifier.slice(prefix.length) + '.js', import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});
```

Anything asynchronous inside a hook has to become synchronous. The docs' CoffeeScript example ships both versions. In the synchronous `getPackageType()` below, `readFile` from `node:fs/promises` becomes `readFileSync` from `node:fs`, `async` and `await` go away, the `.then()` chain becomes a `try` / `catch`, and the docs add an `if (!pJson)` guard that the asynchronous version does not have:

```js
import { readFileSync } from 'node:fs';
import { findPackageJSON } from 'node:module';

function getPackageType(url) {
  const pJson = findPackageJSON(url);
  if (!pJson) {
    return undefined;
  }
  try {
    return JSON.parse(readFileSync(pJson, 'utf-8'))?.type;
  } catch {
    return undefined;
  }
}
```

## Gotchas

**Symptom:** A deprecation warning about `module.register()` appears after moving to Node 26, or a CI job run with `--throw-deprecation` fails
**Cause:** DEP0205 is `Type: Runtime` from v26.0.0, and the docs say `--throw-deprecation` turns a runtime deprecation into a thrown error.
**Fix:** Migrate, as in the before/after above. The deprecation text itself says to do so *"as soon as possible"*.

**Symptom:** The Node CLI docs tell you to use `register()` instead of `--experimental-loader`
**Cause:** The `--experimental-loader` entry still reads, in both v24.x and v26.x: *"This flag is discouraged and may be removed in a future version of Node.js. Please use `--import` with `register()` instead."* `register()` is the deprecated API, and the `--experimental-loader` warning in the v24.x and v26.x source prints the same advice as an `ExperimentalWarning`.
**Fix:** Preload a file that calls `registerHooks()`: `node --import ./register-hooks.mjs app.mjs`. That is the form the `module` docs show for synchronous hooks.

**Symptom:** A hook cannot see a variable from the app
**Cause:** Hooks registered with `register()` run on their own thread, in a different realm, with no shared memory.
**Fix:** Pass a port through `register()`, as the docs do — or migrate, after which the hook shares the application's globals:

```js
import { register } from 'node:module';
import { MessageChannel } from 'node:worker_threads';

const { port1, port2 } = new MessageChannel();

port1.on('message', (msg) => {
  console.log(msg);
});
port1.unref();

register('./my-hooks.mjs', {
  parentURL: import.meta.url,
  data: { number: 1, port: port2 },
  transferList: [port2],
});
```

**Symptom:** `console.log` inside an async hook prints nothing, or sometimes prints
**Cause:** The docs: *"The hooks thread may be terminated by the main thread at any time, so do not depend on asynchronous operations (like `console.log`) to complete."*
**Fix:** Send the message over the port above and log on the main thread, or migrate to `registerHooks()`, where the hook runs on the main thread.

**Symptom:** Some `require()` calls skip the hooks
**Cause:** Two caveats from the docs: *"Custom `require` functions created using `module.createRequire()` are not affected"*, and if the async `load` hook does not override `source` for CommonJS modules, *"the child modules loaded by those CommonJS modules via built-in `require()` would not be affected by the asynchronous hooks either."*
**Fix:** Migrate. The docs contrast the two: *"Unlike synchronous hooks, the asynchronous hooks would not run for these modules loaded in the file that calls `register()`"*.

**Symptom:** Synchronous hooks run more than once for a CommonJS `require()`
**Cause:** The docs: *"if both asynchronous hooks and synchronous hooks are registered and the asynchronous hooks choose to customize the CommonJS module, the synchronous hooks may be invoked multiple times for the `require()` calls in that CommonJS module."*
**Fix:** Finish the migration so only one kind is registered.

**Symptom:** A migrated hook fails because it is still `async`
**Cause:** The docs require every hook to return a plain object; an `async` function returns a promise, which has none of the required properties, and a hook that *"returns a value lacking a required property triggers an exception."* The docs do not describe this exact mistake, and it was not run.
**Fix:** Drop `async` and every `await`, and use the synchronous API for any I/O, as in `readFileSync` above.

**Symptom:** `register()` is called from inside the hooks module and fails
**Cause:** The docs: *"The `register()` method cannot be called from the thread running the hook module that exports the asynchronous hooks or its dependencies."* They do not name the error.
**Fix:** Call it from the main thread, or with `registerHooks()`, from wherever you like.

**Symptom:** `register()` fails under the Permission Model
**Cause:** *"This feature requires `--allow-worker` if used with the Permission Model."* The `registerHooks()` entry carries no such sentence, and what it requires was not confirmed.
**Fix:** Pass `--allow-worker`, or migrate and re-test under the model.

## Interview questions

**★ Why was `module.register()` deprecated?**
Because the asynchronous, off-thread design proved too costly. DEP0205 says *"Supporting async hooks has proven to be complex, involving worker threads orchestration, and there are issues that have proven unresolvable."* The `module` docs add the practical side: inter-thread overhead, hooks that cannot mutate application state, hooks that miss some `require()` calls, and CommonJS sources that may be loaded more than once.

**★ Is `module.register()` removed in Node 26?**
No. It is runtime-deprecated in v26.0.0, which means a process warning, and the deprecation says it *"will be removed in a future version of Node.js"* without naming one. Treat Node 26 as the release where ignoring it stops being silent, not as the release where it stops working.

**★ What replaces the `initialize` hook and the `data` option?**
Nothing — they are not needed. Synchronous hooks run on the application's thread, so initialization is ordinary code executed before the `registerHooks()` call, and values reach the hooks as closures or shared globals. The docs say `registerHooks()` *"does not support nor need"* `initialize`.

**★ How do you migrate a `register()` loader?**
Move the exported `resolve` and `load` functions into the object passed to `registerHooks()`; delete `async`, `await`, `initialize`, the `data` option and any `MessagePort`; replace asynchronous I/O with synchronous calls; and preload the file with `--import` instead of calling `register()` from a file that statically imports its targets. Register once, so synchronous and asynchronous hooks are not mixed.

**Why did `register()` run hooks on a separate thread?**
The docs say the hooks run in *"a separate thread, isolated from the main thread where application code runs"* and that this makes it a different realm. They give no design rationale beyond that, so none is claimed here. What the docs do state is the cost: no shared memory, hooks that cannot be removed, and the caveats above.

**What happens if synchronous and asynchronous hooks are both registered?**
The docs: *"the synchronous hooks are always run first before the asynchronous hooks start running, that is, in the last synchronous hook being run, its next hook includes invocation of the asynchronous hooks."* That is a bridge for a partial migration, with the double-invocation caveat above.

---

← Prev: [Hook contracts](14b-hook-contracts-and-failure-modes.md) · Next → [Phase 1 overview](README.md)
